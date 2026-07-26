import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { formatearCuit } from '../common/cuit';
import { PrismaService } from '../prisma/prisma.service';
import { DatosEmpresaService } from '../tenants/datos-empresa.service';
import { construirUrlQr } from './invoicing/afip-qr';
import {
  CBTE_TIPO,
  CBTE_TIPO_CON_RETENCION,
  CONDICION_IVA_RECEPTOR_LABEL,
  DOC_TIPO_CUIT,
  codigoComprobante,
  texto,
} from './invoicing/codigos-arca';

const TIPO_LABEL: Record<string, string> = {
  factura: 'Factura',
  nota_credito: 'Nota de Crédito',
  nota_debito: 'Nota de Débito',
};

const CONDICION_EMISOR_LABEL: Record<string, string> = {
  RI: 'Responsable Inscripto',
  monotributo: 'Responsable Monotributo',
  exento: 'IVA Sujeto Exento',
};

const CONDICION_VENTA_LABEL: Record<string, string> = {
  contado: 'Contado',
  cuenta_corriente: 'Cuenta corriente',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  otra: 'Otra',
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * ivaPorAlicuota es Json para Prisma pero siempre lo escribimos nosotros
 * con esta forma. Se relee tipado en un solo lugar.
 */
function leerIva(
  json: Prisma.JsonValue,
): Array<{ alicuota: number; base: number; monto: number }> {
  if (!Array.isArray(json)) return [];
  return json.flatMap((raw) => {
    if (typeof raw !== 'object' || raw === null) return [];
    const o = raw as Record<string, unknown>;
    const alicuota = Number(o.alicuota);
    if (!Number.isFinite(alicuota)) return [];
    return [
      {
        alicuota,
        base: Number(o.base) || 0,
        monto: Number(o.monto) || 0,
      },
    ];
  });
}

/**
 * Arma el comprobante impreso: todo lo que la ley exige que figure.
 *
 * Es su propio servicio y no una proyección más de ComprobantesService
 * porque acá manda la normativa, no nuestro modelo: el contenido está
 * fijado por la RG 1415 (datos), la RG 4892 (QR), la RG 5616 (condición
 * del receptor) y la RG 5614 (transparencia fiscal al consumidor).
 */
@Injectable()
export class FacturaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly empresaDatos: DatosEmpresaService,
  ) {}

  async documento(tenantId: string, id: string) {
    const c = await this.prisma.comprobante.findFirst({
      where: { id, tenantId },
      include: {
        puntoVenta: { select: { numero: true } },
        cliente: {
          select: {
            nombre: true,
            razonSocial: true,
            cuit: true,
            condicionFiscal: true,
            direcciones: {
              where: { principal: true },
              take: 1,
              select: {
                direccion: true,
                numero: true,
                ciudad: true,
                codigoPostal: true,
              },
            },
          },
        },
        orden: { select: { numero: true } },
      },
    });
    if (!c) throw new NotFoundException(`No existe el comprobante ${id}`);

    const config = await this.prisma.configuracionFiscal.findUnique({
      where: { tenantId },
    });
    if (!config) {
      throw new NotFoundException(
        'Faltan los datos fiscales del emisor: no se puede armar el comprobante.',
      );
    }

    const empresa = await this.empresaDatos.paraDocumentos(tenantId);

    const snapshot = (c.receptorSnapshot ?? {}) as Record<string, unknown>;
    const receptorCondicion = texto(
      snapshot.condicionFiscal,
      'consumidor_final',
    );
    const receptorCuit =
      (snapshot.cuit as string | null) ?? c.cliente?.cuit ?? null;

    const conRetencion = c.leyenda === 'OPERACIÓN SUJETA A RETENCIÓN';
    const codigo = codigoComprobante(c.tipo, c.letra, conRetencion);
    const tipoArca =
      (conRetencion
        ? CBTE_TIPO_CON_RETENCION[`${c.tipo}:${c.letra}`]
        : undefined) ?? CBTE_TIPO[`${c.tipo}:${c.letra}`];

    const dir = c.cliente?.direcciones?.[0];
    const domicilioReceptor = dir
      ? [
          [dir.direccion, dir.numero].filter(Boolean).join(' '),
          dir.ciudad,
          dir.codigoPostal ? `(${dir.codigoPostal})` : null,
        ]
          .filter(Boolean)
          .join(', ')
      : null;

    const discrimina = c.letra === 'A';
    const neto = Number(c.netoGravado);
    const ivaTotal = Number(c.ivaTotal);
    const total = Number(c.total);

    // El QR sólo existe si ARCA autorizó: sin CAE no hay nada que verificar.
    const qrUrl =
      c.cae && tipoArca
        ? construirUrlQr({
            fecha: c.fecha.toISOString().slice(0, 10),
            cuitEmisor: config.cuit,
            puntoVenta: c.puntoVenta.numero,
            tipoComprobante: tipoArca,
            numero: c.numero ?? 0,
            importeTotal: total,
            moneda: c.moneda === 'USD' ? 'DOL' : 'PES',
            cotizacion: c.cotizacion ? Number(c.cotizacion) : 1,
            tipoDocReceptor: receptorCuit ? DOC_TIPO_CUIT : null,
            nroDocReceptor: receptorCuit ? Number(receptorCuit) : null,
            cae: c.cae,
          })
        : null;

    return {
      // ── Emisor (RG 1415) ──
      emisor: {
        razonSocial: config.razonSocial,
        // La RG 1415 pide el domicilio COMERCIAL. Hasta que existió
        // Configuración › Empresa lo único que había era el fiscal —que puede
        // ser el estudio contable—, así que se imprimía ese. Ahora se usa el
        // comercial cuando está cargado y el fiscal queda de respaldo.
        domicilioFiscal: empresa.domicilio ?? config.domicilioFiscal,
        telefono: empresa.telefono,
        sitioWeb: empresa.sitioWebLegible,
        condicionFiscal:
          CONDICION_EMISOR_LABEL[config.condicionFiscal] ??
          config.condicionFiscal,
        cuit: formatearCuit(config.cuit),
        ingresosBrutos: config.ingresosBrutos,
        inicioActividades: config.inicioActividades
          ? config.inicioActividades.toISOString().slice(0, 10)
          : null,
      },
      // ── Comprobante ──
      letra: c.letra,
      /** El recuadro central de la letra lo exige la norma: "COD. 01". */
      codigoArca: codigo,
      tipoLabel: `${TIPO_LABEL[c.tipo] ?? c.tipo} ${c.letra}`,
      puntoVenta: String(c.puntoVenta.numero).padStart(4, '0'),
      numero: c.numero ? String(c.numero).padStart(8, '0') : '—',
      fecha: c.fecha.toISOString().slice(0, 10),
      vencimientoPago: c.vencimiento
        ? c.vencimiento.toISOString().slice(0, 10)
        : null,
      // ── Receptor (RG 1415 + RG 5616) ──
      receptor: {
        razonSocial: texto(
          snapshot.razonSocial,
          texto(snapshot.nombre, 'Consumidor Final'),
        ),
        cuit: receptorCuit ? formatearCuit(receptorCuit) : null,
        domicilio: domicilioReceptor,
        /** RG 5616: obligatorio desde 2025. */
        condicionFiscal:
          CONDICION_IVA_RECEPTOR_LABEL[receptorCondicion] ?? receptorCondicion,
      },
      condicionVenta:
        CONDICION_VENTA_LABEL[c.condicionVenta ?? 'contado'] ??
        c.condicionVenta,
      moneda:
        c.moneda === 'USD'
          ? `Dólares estadounidenses (USD)${c.cotizacion ? ` · TC ${Number(c.cotizacion)}` : ''}`
          : 'Pesos argentinos (ARS)',
      // ── Ítems ──
      /** Sólo la A lleva la columna de alícuota. */
      discriminaIva: discrimina,
      items: this.itemsDocumento(c.itemsJson, discrimina),
      // ── Totales ──
      subtotal: neto,
      ivaPorAlicuota: discrimina ? leerIva(c.ivaPorAlicuota) : [],
      /**
       * RG 5614 (Ley 27.743, Transparencia Fiscal al Consumidor): un
       * comprobante que no discrimina IVA igual tiene que informar el que
       * lleva contenido, con su importe.
       */
      ivaContenido: discrimina ? null : r2(ivaTotal),
      otrosImpuestosIndirectos: discrimina ? null : 0,
      otrosTributos: [] as Array<{ descripcion: string; monto: number }>,
      otrosTributosTotal: 0,
      total,
      // ── Autorización (RG 4892) ──
      cae: c.cae,
      caeVencimiento: c.caeVencimiento
        ? c.caeVencimiento.toISOString().slice(0, 10)
        : null,
      qrUrl,
      leyendas: this.leyendas(c),
      // ── Contexto (no va impreso) ──
      estado: c.estado,
      ordenNumero: c.orden?.numero ?? null,
    };
  }

  private itemsDocumento(json: Prisma.JsonValue, discrimina: boolean) {
    if (!Array.isArray(json)) return [];
    return json.flatMap((raw) => {
      if (typeof raw !== 'object' || raw === null) return [];
      const o = raw as Record<string, unknown>;
      const cantidad = Number(o.cantidad) || 0;
      const unit = Number(o.precioUnitarioSinIva) || 0;
      const ali = o.alicuotaIva;
      return [
        {
          codigo: typeof o.codigo === 'string' ? o.codigo : null,
          descripcion: typeof o.descripcion === 'string' ? o.descripcion : '',
          cantidad,
          precioUnitario: unit,
          alicuota: discrimina && typeof ali === 'number' ? ali : null,
          subtotal: r2(cantidad * unit),
        },
      ];
    });
  }

  /**
   * Leyendas que el comprobante debe llevar impresas. Las de ARCA vienen en
   * la respuesta de la emisión (observaciones); la de transparencia fiscal
   * la exige la RG 5614 en todo comprobante que no discrimine IVA.
   */
  private leyendas(c: {
    letra: string;
    providerRaw: Prisma.JsonValue;
    leyenda: string | null;
  }) {
    const out: Array<{ codigo: string | null; texto: string }> = [];

    if (c.letra !== 'A') {
      out.push({
        codigo: null,
        texto: 'Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)',
      });
    }
    if (c.letra === 'C') {
      out.push({
        codigo: null,
        texto:
          'El presente comprobante corresponde a un sujeto adherido al Régimen Simplificado para Pequeños Contribuyentes (Monotributo). No genera crédito fiscal.',
      });
    }
    if (c.leyenda) {
      out.push({ codigo: null, texto: c.leyenda });
    }

    // Observaciones que devolvió ARCA al autorizar: son leyendas, no errores.
    const raw = (c.providerRaw ?? {}) as { observaciones?: unknown };
    if (Array.isArray(raw.observaciones)) {
      for (const o of raw.observaciones) {
        if (typeof o !== 'string') continue;
        const m = /^\[(\d+)\]\s*(.*)$/.exec(o);
        out.push(
          m ? { codigo: m[1], texto: m[2] } : { codigo: null, texto: o },
        );
      }
    }
    return out;
  }
}
