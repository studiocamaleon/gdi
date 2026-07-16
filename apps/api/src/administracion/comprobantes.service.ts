import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  CargarCaeDto,
  CrearComprobanteDto,
  type ComprobanteTipo,
} from './dto/comprobante.dto';
import {
  bloqueoEmision,
  letraComprobante,
  type CondicionFiscalEmisor,
  type CondicionFiscalReceptor,
  type LeyendaA,
} from './letra-comprobante';
import { ManualProvider } from './invoicing/manual.provider';
import { AfipSdkProvider } from './invoicing/afip-sdk.provider';
import type {
  ComprobanteItemProvider,
  InvoicingProvider,
  LetraProvider,
} from './invoicing/invoicing-provider';
import {
  calcularTotales,
  type ItemCalculo,
} from './invoicing/totales-comprobante';

/** Lo que guardamos en itemsJson: el ítem que calcula + su descripción. */
type ItemPersistido = ItemCalculo & { descripcion: string };

/**
 * Texto de un campo Json. Sólo acepta strings de verdad: si viniera un
 * objeto, String() lo convertiría en "[object Object]" y ese texto
 * terminaría impreso en un comprobante fiscal.
 */
function texto(valor: unknown, porDefecto = ''): string {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : porDefecto;
}

/**
 * itemsJson es Json para Prisma, pero siempre lo escribimos nosotros con
 * esta forma. Se relee acá en un solo lugar, tolerando basura.
 */
function leerItems(json: Prisma.JsonValue): ItemPersistido[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((raw) => {
    if (typeof raw !== 'object' || raw === null) return [];
    const o = raw as Record<string, unknown>;
    const cantidad = Number(o.cantidad);
    const precio = Number(o.precioUnitarioSinIva);
    if (!Number.isFinite(cantidad) || !Number.isFinite(precio)) return [];
    const ali = o.alicuotaIva;
    return [
      {
        descripcion: texto(o.descripcion),
        cantidad,
        precioUnitarioSinIva: precio,
        alicuotaIva:
          ali === 'exento' || ali === 'no_gravado' ? ali : Number(ali ?? 21),
        ...(o.bonificacionPct !== undefined
          ? { bonificacionPct: Number(o.bonificacionPct) }
          : {}),
      },
    ];
  });
}

const DIAS_POR_CONDICION: Record<string, number> = {
  contado: 0,
  transferencia: 0,
  tarjeta: 0,
  cuenta_corriente: 30,
  otra: 0,
};

@Injectable()
export class ComprobantesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manualProvider: ManualProvider,
    private readonly afipSdkProvider: AfipSdkProvider,
  ) {}

  /**
   * Qué provider usa el tenant. Si pide AFIP SDK pero falta el token, cae
   * al manual en vez de romper: mejor emitir sin CAE que no emitir.
   */
  private resolverProvider(proveedor: string | undefined): InvoicingProvider {
    if (proveedor === 'afipsdk' && this.afipSdkProvider.disponible) {
      return this.afipSdkProvider;
    }
    return this.manualProvider;
  }

  async listar(
    auth: CurrentAuth,
    filtros: { estado?: string; tipo?: string; clienteId?: string; q?: string },
  ) {
    const where: Prisma.ComprobanteWhereInput = {
      tenantId: auth.tenantId,
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
    };
    const comprobantes = await this.prisma.comprobante.findMany({
      where,
      include: {
        puntoVenta: { select: { numero: true } },
        cliente: { select: { nombre: true, cuit: true } },
        orden: { select: { numero: true } },
      },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
    const q = filtros.q?.trim().toLowerCase();
    const lista = comprobantes.map((c) => this.toResponse(c));
    if (!q) return lista;
    return lista.filter((c) =>
      [c.numeroCompleto, c.clienteNombre, c.clienteCuit, c.ordenNumero, c.letra]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }

  async obtener(auth: CurrentAuth, id: string) {
    const c = await this.prisma.comprobante.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        puntoVenta: { select: { numero: true } },
        cliente: { select: { nombre: true, cuit: true } },
        orden: { select: { numero: true } },
        imputaciones: {
          include: {
            cobro: {
              include: {
                metodoPago: { select: { nombre: true } },
                cuentaDestino: { select: { nombre: true } },
              },
            },
          },
        },
      },
    });
    if (!c) throw new NotFoundException(`No existe el comprobante ${id}`);
    return {
      ...this.toResponse(c),
      cobrosImputados: c.imputaciones.map((i) => ({
        id: i.id,
        cobroId: i.cobroId,
        fecha: i.cobro.fecha.toISOString().slice(0, 10),
        metodoNombre: i.cobro.metodoPago.nombre,
        cuentaNombre: i.cobro.cuentaDestino.nombre,
        monto: Number(i.monto),
      })),
    };
  }

  /**
   * Crea el comprobante en borrador. La letra sale de la matriz
   * emisor×receptor y se congela acá: si el cliente después cambia de
   * condición fiscal, este comprobante no cambia.
   */
  async crear(auth: CurrentAuth, payload: CrearComprobanteDto) {
    const config = await this.prisma.configuracionFiscal.findUnique({
      where: { tenantId: auth.tenantId },
      select: { condicionFiscal: true, leyendaFacturaA: true },
    });
    if (!config) {
      throw new BadRequestException(
        'Configurá primero los datos fiscales del emisor (Administración → Datos fiscales).',
      );
    }

    const pv = await this.prisma.puntoVenta.findFirst({
      where: { id: payload.puntoVentaId, tenantId: auth.tenantId },
    });
    if (!pv) throw new BadRequestException('El punto de venta no existe.');
    if (!pv.activo) {
      throw new BadRequestException(
        `El punto de venta ${String(pv.numero).padStart(4, '0')} está inactivo.`,
      );
    }

    const { cliente, items, ordenId } = await this.resolverReceptorEItems(
      auth,
      payload,
    );

    const receptorCondicion = (cliente?.condicionFiscal ??
      'consumidor_final') as CondicionFiscalReceptor;
    const resultadoLetra = letraComprobante(
      config.condicionFiscal as CondicionFiscalEmisor,
      receptorCondicion,
      config.leyendaFacturaA as LeyendaA | null,
    );

    const bloqueo = bloqueoEmision(resultadoLetra.letra, cliente?.cuit ?? null);
    if (bloqueo) throw new BadRequestException(bloqueo);

    if (items.length === 0) {
      throw new BadRequestException(
        'El comprobante necesita al menos un ítem.',
      );
    }

    if (payload.moneda === 'USD' && !payload.cotizacion) {
      throw new BadRequestException(
        'Una factura en USD necesita el tipo de cambio.',
      );
    }

    if (payload.tipo !== 'factura' && !payload.comprobanteOrigenId) {
      throw new BadRequestException(
        'Una nota de crédito o débito tiene que referenciar al comprobante que corrige.',
      );
    }

    const totales = calcularTotales(
      resultadoLetra.letra as LetraProvider,
      items,
    );
    const fecha = payload.fecha ? new Date(payload.fecha) : new Date();
    const dias =
      payload.diasVencimiento ??
      DIAS_POR_CONDICION[payload.condicionVenta ?? 'contado'] ??
      0;
    const vencimiento = new Date(fecha);
    vencimiento.setDate(vencimiento.getDate() + dias);

    const comprobante = await this.prisma.comprobante.create({
      data: {
        tenantId: auth.tenantId,
        tipo: payload.tipo,
        letra: resultadoLetra.letra,
        puntoVentaId: pv.id,
        numero: null,
        fecha,
        clienteId: cliente?.id ?? null,
        ordenId: ordenId ?? null,
        receptorSnapshot: {
          nombre: cliente?.nombre ?? 'Consumidor Final',
          razonSocial: cliente?.razonSocial ?? null,
          cuit: cliente?.cuit ?? null,
          condicionFiscal: receptorCondicion,
        },
        itemsJson: items as unknown as Prisma.InputJsonValue,
        netoGravado: totales.netoGravado,
        ivaPorAlicuota:
          totales.ivaPorAlicuota as unknown as Prisma.InputJsonValue,
        ivaTotal: totales.ivaTotal,
        total: totales.total,
        moneda: payload.moneda ?? 'ARS',
        cotizacion: payload.cotizacion ?? null,
        estado: 'borrador',
        condicionVenta: payload.condicionVenta ?? 'contado',
        vencimiento,
        leyenda: resultadoLetra.leyenda ?? null,
        // Clave anti-duplicado: se genera y persiste ANTES de hablar con
        // cualquier provider.
        idempotencyKey: randomUUID(),
        saldoPendiente: totales.total,
        comprobanteOrigenId: payload.comprobanteOrigenId ?? null,
      },
      include: {
        puntoVenta: { select: { numero: true } },
        cliente: { select: { nombre: true, cuit: true } },
        orden: { select: { numero: true } },
      },
    });
    return this.toResponse(comprobante);
  }

  /**
   * Emite: resuelve el número y le pide el CAE al provider.
   *
   * Sobre el número: con provider manual manda nuestro contador atómico, y
   * se toma DENTRO de una transacción para que dos emisiones simultáneas no
   * lo compartan. Pero cuando hay integración **manda ARCA**: su contador es
   * la fuente de verdad y el nuestro se sincroniza, porque ARCA rechaza
   * cualquier número que no sea correlativo al último que autorizó.
   */
  async emitir(auth: CurrentAuth, id: string) {
    const comprobante = await this.prisma.comprobante.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { puntoVenta: true },
    });
    if (!comprobante) {
      throw new NotFoundException(`No existe el comprobante ${id}`);
    }
    if (comprobante.estado !== 'borrador') {
      throw new ConflictException(
        `El comprobante ya está ${comprobante.estado}: sólo se puede emitir un borrador.`,
      );
    }

    const config = await this.prisma.configuracionFiscal.findUnique({
      where: { tenantId: auth.tenantId },
      select: { cuit: true, proveedorFacturacion: true },
    });
    const provider = this.resolverProvider(config?.proveedorFacturacion);
    const emisorCuit = config?.cuit ?? null;

    // ¿Hasta dónde numeró ARCA? Si contesta, su número manda.
    let ultimoArca: number | null = null;
    if (provider.codigo !== 'manual' && emisorCuit) {
      ultimoArca = await provider.ultimoNumero(
        comprobante.puntoVenta.numero,
        comprobante.tipo as ComprobanteTipo,
        comprobante.letra as LetraProvider,
        emisorCuit,
      );
    }

    const numero = await this.prisma.$transaction(async (tx) => {
      const clave = {
        tenantId: auth.tenantId,
        puntoVentaId: comprobante.puntoVentaId,
        tipo: comprobante.tipo,
        letra: comprobante.letra,
      };
      const contador = await tx.comprobanteContador.upsert({
        where: { tenantId_puntoVentaId_tipo_letra: clave },
        create: { ...clave, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      });
      if (ultimoArca === null) return contador.ultimo;

      // ARCA manda: sincronizamos nuestro contador con el suyo para no
      // volver a pedirle un número que ya usó.
      const siguienteArca = ultimoArca + 1;
      if (siguienteArca !== contador.ultimo) {
        await tx.comprobanteContador.update({
          where: { tenantId_puntoVentaId_tipo_letra: clave },
          data: { ultimo: siguienteArca },
        });
      }
      return siguienteArca;
    });

    const resultado = await provider.emitir({
      emisorCuit,
      netoGravado: Number(comprobante.netoGravado),
      ivaTotal: Number(comprobante.ivaTotal),
      idempotencyKey: comprobante.idempotencyKey,
      tipo: comprobante.tipo as ComprobanteTipo,
      letra: comprobante.letra as LetraProvider,
      puntoVenta: comprobante.puntoVenta.numero,
      numero,
      fecha: comprobante.fecha.toISOString().slice(0, 10),
      receptor: this.receptorDesdeSnapshot(comprobante.receptorSnapshot),
      items: leerItems(
        comprobante.itemsJson,
      ) satisfies ComprobanteItemProvider[],
      moneda: comprobante.moneda as 'ARS' | 'USD',
      cotizacion: comprobante.cotizacion
        ? Number(comprobante.cotizacion)
        : undefined,
      total: Number(comprobante.total),
      condicionVenta: comprobante.condicionVenta ?? undefined,
      vencimiento: comprobante.vencimiento
        ? comprobante.vencimiento.toISOString().slice(0, 10)
        : null,
      leyenda: comprobante.leyenda,
    });

    if (resultado.estado === 'rechazado') {
      const actualizado = await this.prisma.comprobante.update({
        where: { id },
        data: {
          estado: 'rechazado',
          rechazoJson: {
            errores: resultado.errores,
          } as unknown as Prisma.InputJsonValue,
          providerRaw: resultado.raw as Prisma.InputJsonValue,
        },
        include: {
          puntoVenta: { select: { numero: true } },
          cliente: { select: { nombre: true, cuit: true } },
          orden: { select: { numero: true } },
        },
      });
      return this.toResponse(actualizado);
    }

    if (resultado.estado === 'en_cola') {
      const actualizado = await this.prisma.comprobante.update({
        where: { id },
        data: {
          numero,
          providerRaw: resultado.raw as Prisma.InputJsonValue,
        },
        include: {
          puntoVenta: { select: { numero: true } },
          cliente: { select: { nombre: true, cuit: true } },
          orden: { select: { numero: true } },
        },
      });
      return this.toResponse(actualizado);
    }

    const actualizado = await this.prisma.comprobante.update({
      where: { id },
      data: {
        estado: 'emitido',
        numero: resultado.numero || numero,
        // El manual emite sin CAE: se carga después.
        cae: resultado.cae || null,
        caeVencimiento: resultado.caeVencimiento
          ? new Date(resultado.caeVencimiento)
          : null,
        providerRaw: resultado.raw as Prisma.InputJsonValue,
      },
      include: {
        puntoVenta: { select: { numero: true } },
        cliente: { select: { nombre: true, cuit: true } },
        orden: { select: { numero: true } },
      },
    });
    return this.toResponse(actualizado);
  }

  /** Carga a mano el CAE que devolvió el portal de ARCA (provider manual). */
  async cargarCae(auth: CurrentAuth, id: string, payload: CargarCaeDto) {
    const comprobante = await this.prisma.comprobante.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!comprobante) {
      throw new NotFoundException(`No existe el comprobante ${id}`);
    }
    if (comprobante.estado !== 'emitido') {
      throw new ConflictException(
        'Sólo se le puede cargar el CAE a un comprobante emitido.',
      );
    }
    const actualizado = await this.prisma.comprobante.update({
      where: { id },
      data: {
        cae: payload.cae.trim(),
        caeVencimiento: new Date(payload.caeVencimiento),
      },
      include: {
        puntoVenta: { select: { numero: true } },
        cliente: { select: { nombre: true, cuit: true } },
        orden: { select: { numero: true } },
      },
    });
    return this.toResponse(actualizado);
  }

  /**
   * Un comprobante emitido NO se borra ni se "anula" contra ARCA: se anula
   * emitiendo una nota de crédito que lo referencia. Esto sólo marca el
   * estado interno de un borrador o de un rechazado.
   */
  async descartar(auth: CurrentAuth, id: string) {
    const comprobante = await this.prisma.comprobante.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!comprobante) {
      throw new NotFoundException(`No existe el comprobante ${id}`);
    }
    if (comprobante.estado === 'emitido') {
      throw new ConflictException(
        'Un comprobante emitido no se descarta: emitile una nota de crédito.',
      );
    }
    await this.prisma.comprobante.update({
      where: { id },
      data: { estado: 'anulado', anuladoEl: new Date() },
    });
    return { ok: true };
  }

  private async resolverReceptorEItems(
    auth: CurrentAuth,
    payload: CrearComprobanteDto,
  ) {
    let clienteId = payload.clienteId ?? null;
    let ordenId: string | null = null;
    let items: ItemCalculo[] = (payload.items ?? []).map((i) => ({
      cantidad: i.cantidad,
      precioUnitarioSinIva: i.precioUnitarioSinIva,
      alicuotaIva: i.alicuotaIva ?? 21,
      bonificacionPct: i.bonificacionPct,
      descripcion: i.descripcion,
    })) as ItemCalculo[];

    if (payload.ordenId) {
      const orden = await this.prisma.ordenTrabajo.findFirst({
        where: { id: payload.ordenId, tenantId: auth.tenantId },
        include: { items: true },
      });
      if (!orden) throw new BadRequestException('La orden no existe.');
      if (orden.estado === 'borrador') {
        throw new BadRequestException(
          'No se puede facturar una orden en borrador: emitila primero.',
        );
      }
      ordenId = orden.id;
      clienteId = clienteId ?? orden.clienteId;
      if (items.length === 0) {
        // Los ítems de la OT ya traen el precio con impuestos calculados por
        // el motor. Acá se factura el subtotal (neto): el IVA lo recalcula
        // el comprobante según su letra.
        items = orden.items.map((it) => ({
          descripcion: it.nombre,
          cantidad: Number(it.cantidad),
          precioUnitarioSinIva:
            Number(it.cantidad) > 0
              ? Number(it.subtotal) / Number(it.cantidad)
              : Number(it.subtotal),
          alicuotaIva: 21,
        })) as ItemCalculo[];
      }
    }

    const cliente = clienteId
      ? await this.prisma.cliente.findFirst({
          where: { id: clienteId, tenantId: auth.tenantId },
          select: {
            id: true,
            nombre: true,
            razonSocial: true,
            cuit: true,
            condicionFiscal: true,
          },
        })
      : null;

    if (clienteId && !cliente) {
      throw new BadRequestException('El cliente no existe.');
    }

    return { cliente, items, ordenId };
  }

  private receptorDesdeSnapshot(snapshot: Prisma.JsonValue) {
    const s = (snapshot ?? {}) as Record<string, unknown>;
    return {
      razonSocial: texto(s.razonSocial, texto(s.nombre, 'Consumidor Final')),
      cuit: (s.cuit as string | null) ?? null,
      condicionFiscal: texto(s.condicionFiscal, 'consumidor_final'),
    };
  }

  private toResponse(c: {
    id: string;
    tipo: string;
    letra: string;
    numero: number | null;
    fecha: Date;
    puntoVenta: { numero: number };
    cliente: { nombre: string; cuit: string | null } | null;
    orden: { numero: string } | null;
    ordenId: string | null;
    receptorSnapshot: Prisma.JsonValue;
    itemsJson: Prisma.JsonValue;
    netoGravado: Prisma.Decimal;
    ivaPorAlicuota: Prisma.JsonValue;
    ivaTotal: Prisma.Decimal;
    total: Prisma.Decimal;
    moneda: string;
    cotizacion: Prisma.Decimal | null;
    estado: string;
    cae: string | null;
    caeVencimiento: Date | null;
    condicionVenta: string | null;
    vencimiento: Date | null;
    leyenda: string | null;
    rechazoJson: Prisma.JsonValue;
    saldoPendiente: Prisma.Decimal;
    comprobanteOrigenId: string | null;
  }) {
    const pv = String(c.puntoVenta.numero).padStart(4, '0');
    const nro = c.numero === null ? null : String(c.numero).padStart(8, '0');
    const snapshot = (c.receptorSnapshot ?? {}) as Record<string, unknown>;
    return {
      id: c.id,
      tipo: c.tipo,
      letra: c.letra,
      puntoVentaNumero: pv,
      numero: c.numero,
      /** "A 0001-00000123" — como lo muestra el diseño. */
      numeroCompleto: nro ? `${c.letra} ${pv}-${nro}` : `${c.letra} ${pv}-—`,
      fecha: c.fecha.toISOString().slice(0, 10),
      clienteNombre:
        c.cliente?.nombre ?? texto(snapshot.nombre, 'Consumidor Final'),
      clienteCuit: c.cliente?.cuit ?? (snapshot.cuit as string | null) ?? null,
      ordenId: c.ordenId,
      ordenNumero: c.orden?.numero ?? null,
      items: c.itemsJson,
      netoGravado: Number(c.netoGravado),
      ivaPorAlicuota: c.ivaPorAlicuota,
      ivaTotal: Number(c.ivaTotal),
      total: Number(c.total),
      moneda: c.moneda,
      cotizacion: c.cotizacion ? Number(c.cotizacion) : null,
      estado: c.estado,
      cae: c.cae,
      caeVencimiento: c.caeVencimiento
        ? c.caeVencimiento.toISOString().slice(0, 10)
        : null,
      condicionVenta: c.condicionVenta,
      vencimiento: c.vencimiento
        ? c.vencimiento.toISOString().slice(0, 10)
        : null,
      leyenda: c.leyenda,
      rechazo: c.rechazoJson,
      saldoPendiente: Number(c.saldoPendiente),
      comprobanteOrigenId: c.comprobanteOrigenId,
    };
  }
}
