import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Archivo,
  ArchivoScope,
  Prisma,
  TipoEnlacePublico,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { CurrentAuth } from '../auth/auth.types';
import { runWithTenant } from '../common/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  EnlacesPublicosService,
  generarTokenPublico,
} from '../enlaces-publicos/enlaces-publicos.service';
import { NotificacionesComprobantesService } from '../integraciones/notificaciones/notificaciones-comprobantes.service';
import {
  CargarCaeDto,
  CrearComprobanteDto,
  FacturarLoteDto,
  FacturarOrdenDto,
  NotaCreditoOrdenDto,
  type ComprobanteOrdenVinculoDto,
  type ComprobanteTipo,
} from './dto/comprobante.dto';
import { FacturacionOrdenesService } from './facturacion-ordenes.service';
import { FacturaService } from './factura.service';
import { FacturaPdfService } from './factura-pdf.service';
import { ArchivosService } from '../archivos/archivos.service';
import {
  bloqueoEmision,
  letraComprobante,
  type CondicionFiscalEmisor,
  type CondicionFiscalReceptor,
  type LeyendaA,
} from './letra-comprobante';
import { ManualProvider } from './invoicing/manual.provider';
import { AfipSdkProvider } from './invoicing/afip-sdk.provider';
import { AfipIntegracionService } from './afip-integracion.service';
import { texto } from './invoicing/codigos-arca';
import { regionalDelTenant } from '../common/regional';
import { claveFechaEnZona } from '../common/zona';
import type {
  ComprobanteItemProvider,
  InvoicingProvider,
  LetraProvider,
} from './invoicing/invoicing-provider';
import {
  calcularTotales,
  type ItemCalculo,
} from './invoicing/totales-comprobante';
import { renglonesDetalladosOrden } from './invoicing/items-orden-descuento';

/** Lo que guardamos en itemsJson: el ítem que calcula + su descripción. */
type ItemPersistido = ItemCalculo & { descripcion: string };

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

const redondear2 = (n: number) => Math.round(n * 100) / 100;

/** ivaPorAlicuota es Json para Prisma pero siempre lo escribimos nosotros. */
function leerIvaPorAlicuota(
  json: Prisma.JsonValue,
): Array<{ alicuota: number; base: number; monto: number }> {
  if (!Array.isArray(json)) return [];
  return json.flatMap((raw) => {
    if (typeof raw !== 'object' || raw === null) return [];
    const o = raw as Record<string, unknown>;
    const alicuota = Number(o.alicuota);
    if (!Number.isFinite(alicuota)) return [];
    return [
      { alicuota, base: Number(o.base) || 0, monto: Number(o.monto) || 0 },
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
  private readonly logger = new Logger(ComprobantesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly manualProvider: ManualProvider,
    private readonly afipSdkProvider: AfipSdkProvider,
    private readonly afipIntegracion: AfipIntegracionService,
    private readonly facturacionOrdenes: FacturacionOrdenesService,
    private readonly factura: FacturaService,
    private readonly facturaPdf: FacturaPdfService,
    private readonly archivos: ArchivosService,
    private readonly enlaces: EnlacesPublicosService,
    private readonly avisos: NotificacionesComprobantesService,
  ) {}

  // ── PDF del comprobante ─────────────────────────────────────────────

  /**
   * El PDF ya guardado, o generado y guardado si todavía no existe.
   *
   * Que sea una foto y no un render vivo importa más acá que en el
   * presupuesto: los items, el receptor y el CAE ya estaban congelados en la
   * fila, pero los datos del EMISOR salían de `ConfiguracionFiscal`, que está
   * viva. Es decir: cambiar el domicilio fiscal reescribía el domicilio de
   * todas las facturas ya emitidas. Un comprobante autorizado por ARCA no
   * puede mutar.
   */
  async pdfDe(tenantId: string, id: string): Promise<Archivo> {
    const existente = await this.archivos.generadoDe(
      ArchivoScope.COMPROBANTE,
      id,
    );
    if (existente) return existente;
    return this.materializarPdf(tenantId, id);
  }

  async materializarPdf(tenantId: string, id: string): Promise<Archivo> {
    const [doc, logo] = await Promise.all([
      this.factura.documento(tenantId, id),
      this.archivos.logoDataUri(tenantId),
    ]);
    const contenido = await this.facturaPdf.generar(doc, logo);
    return this.archivos.materializar({
      tenantId,
      scope: ArchivoScope.COMPROBANTE,
      entidadId: id,
      nombre: `${doc.letra}-${doc.puntoVenta}-${doc.numero}.pdf`,
      mimeType: 'application/pdf',
      contenido,
    });
  }

  /**
   * Congela el PDF apenas el comprobante queda emitido. Best-effort y con el
   * error tragado: que falle el archivo no puede tumbar una emisión fiscal
   * que ARCA ya autorizó — el endpoint lo genera después si hace falta.
   */
  private async congelarPdf(tenantId: string, id: string): Promise<void> {
    try {
      await this.materializarPdf(tenantId, id);
    } catch (error) {
      this.logger.warn(
        `No pude congelar el PDF del comprobante ${id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * El comprobante visto por el CLIENTE desde el link de WhatsApp.
   *
   * Devuelve el documento fiscal COMPLETO y no un resumen, porque es
   * exactamente lo que dice el PDF que igual se le manda: el emisor, sus datos,
   * los ítems, los totales y el CAE. Nada de lo que hay ahí es interno —los
   * costos y los márgenes no viven en el comprobante— así que no hay nada que
   * recortar. Sí se saca el estado, que sólo tiene sentido de este lado.
   */
  async documentoPublico(tenantId: string, id: string) {
    // Sin sesión no hay tenant en contexto y el guard de Prisma lo exige. El
    // tenant sale del enlace, no del pedido: el token es la credencial.
    const [doc, logo] = await runWithTenant(tenantId, () =>
      Promise.all([
        this.factura.documento(tenantId, id),
        this.archivos.urlDeLogoPublico(tenantId),
      ]),
    );
    // `tieneLogo` sólo si HAY: la vista es un server component y no puede
    // reaccionar a una imagen rota, así que necesita saberlo antes de pintar
    // el <img>.
    const publico = { ...doc, tieneLogo: logo !== null };
    delete (publico as { estado?: string }).estado;
    return publico;
  }

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
    filtros: {
      estado?: string;
      tipo?: string;
      clienteId?: string;
      ordenId?: string;
      q?: string;
    },
  ) {
    const where: Prisma.ComprobanteWhereInput = {
      tenantId: auth.tenantId,
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
      // El tab "Comprobantes asociados" de la ficha de la orden. El OR
      // cubre históricos que sólo tienen la columna deprecada.
      ...(filtros.ordenId
        ? {
            OR: [
              { ordenId: filtros.ordenId },
              { ordenes: { some: { ordenId: filtros.ordenId } } },
            ],
          }
        : {}),
    };
    const comprobantes = await this.prisma.comprobante.findMany({
      where,
      include: {
        puntoVenta: { select: { numero: true } },
        cliente: { select: { nombre: true, cuit: true } },
        orden: { select: { numero: true } },
        ordenes: {
          select: {
            ordenId: true,
            monto: true,
            orden: { select: { numero: true } },
          },
        },
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
        ordenes: {
          select: {
            ordenId: true,
            monto: true,
            orden: { select: { numero: true } },
          },
        },
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

    const { cliente, items, vinculos } = await this.resolverReceptorEItems(
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

    // El comprobante se reparte COMPLETO entre sus órdenes. Con el atajo
    // `ordenId` el monto es el total; con `ordenes` explícitas la suma
    // tiene que dar el total (tolerancia de redondeo: un centavo).
    const vinculosFinales =
      vinculos.length === 1 && payload.ordenId
        ? [{ ordenId: vinculos[0].ordenId, monto: totales.total }]
        : vinculos;
    if (vinculosFinales.length > 0) {
      const suma = vinculosFinales.reduce((s, v) => s + v.monto, 0);
      if (Math.abs(suma - totales.total) > 0.01) {
        throw new BadRequestException(
          `Los montos por orden suman $${suma.toLocaleString('es-AR')} pero el comprobante es de $${totales.total.toLocaleString('es-AR')}: el comprobante se reparte completo entre sus órdenes.`,
        );
      }
    }
    // Aviso temprano del tope (la validación autoritativa corre al
    // emitir: dos borradores del 100% conviven, el segundo rebota allá).
    if (payload.tipo === 'factura') {
      for (const v of vinculosFinales) {
        const orden = await this.prisma.ordenTrabajo.findFirst({
          where: { id: v.ordenId, tenantId: auth.tenantId },
          select: { numero: true, total: true, facturadoTotal: true },
        });
        if (!orden) continue;
        const saldo = Number(orden.total ?? 0) - Number(orden.facturadoTotal);
        if (v.monto > saldo + 0.01) {
          throw new BadRequestException(
            `La orden ${orden.numero} tiene $${Math.max(0, Math.round(saldo * 100) / 100).toLocaleString('es-AR')} sin facturar: no se puede facturar más que el total de la orden.`,
          );
        }
      }
    }

    // `fecha` es una columna DATE: un `new Date()` crudo mete la hora y
    // Postgres trunca en UTC — una factura emitida a las 22:00 del taller
    // quedaba fechada al día siguiente. Se normaliza al día LOCAL del taller.
    const { zonaHoraria, paisCodigo } = await regionalDelTenant(
      this.prisma,
      auth.tenantId,
    );
    // El circuito de comprobantes es ARCA: letras, CUIT, CAE. Para un tenant
    // de otro país no es que "todavía no anda": es normativa de otro fisco.
    // Su circuito es la deuda comercial + recibos (D14).
    if (paisCodigo !== 'AR') {
      throw new ConflictException(
        'Los comprobantes fiscales (ARCA) son del circuito argentino. Para tu país usá recibos de pago y el estado de cuenta.',
      );
    }
    const claveHoy = claveFechaEnZona(new Date(), zonaHoraria);
    const fecha = payload.fecha
      ? new Date(`${payload.fecha.slice(0, 10)}T00:00:00.000Z`)
      : new Date(`${claveHoy}T00:00:00.000Z`);
    const dias =
      payload.diasVencimiento ??
      DIAS_POR_CONDICION[payload.condicionVenta ?? 'contado'] ??
      0;
    const vencimiento = new Date(fecha);
    vencimiento.setUTCDate(vencimiento.getUTCDate() + dias);

    const comprobante = await this.prisma.comprobante.create({
      data: {
        tenantId: auth.tenantId,
        tipo: payload.tipo,
        letra: resultadoLetra.letra,
        puntoVentaId: pv.id,
        numero: null,
        fecha,
        clienteId: cliente?.id ?? null,
        // ordenId (deprecado) ya no se escribe: el vínculo vive en
        // ComprobanteOrden, con monto y soporte de varias órdenes.
        ordenes: {
          create: vinculosFinales.map((v) => ({
            tenantId: auth.tenantId,
            ordenId: v.ordenId,
            monto: v.monto,
          })),
        },
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
        ordenes: {
          select: {
            ordenId: true,
            monto: true,
            orden: { select: { numero: true } },
          },
        },
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

    // Tope AUTORITATIVO antes de pedir el CAE: acá rebota el segundo
    // borrador del 100% (los borradores no reservan cupo).
    if (comprobante.tipo === 'factura') {
      await this.facturacionOrdenes.validarTope(
        this.prisma,
        auth.tenantId,
        comprobante.id,
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
      ivaPorAlicuota: leerIvaPorAlicuota(comprobante.ivaPorAlicuota),
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
          ordenes: {
            select: {
              ordenId: true,
              monto: true,
              orden: { select: { numero: true } },
            },
          },
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
          ordenes: {
            select: {
              ordenId: true,
              monto: true,
              orden: { select: { numero: true } },
            },
          },
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
        ordenes: {
          select: {
            ordenId: true,
            monto: true,
            orden: { select: { numero: true } },
          },
        },
      },
    });
    // Recién emitido cuenta para el facturado de sus órdenes (una NC
    // resta), y una factura absorbe los cobros libres de sus órdenes.
    await this.facturacionOrdenes.alEmitirComprobante(auth.tenantId, id);
    // El comprobante queda congelado con los datos del emisor de ESTE
    // momento; si mañana cambia el domicilio fiscal, éste no muta.
    await this.congelarPdf(auth.tenantId, id);
    await this.publicar(auth.tenantId, id);
    return this.toResponse(actualizado);
  }

  /**
   * Le da al comprobante emitido su link público y le avisa al cliente.
   *
   * Best-effort y en ese orden: el link tiene que existir antes del aviso —el
   * mensaje lo lleva adentro— pero ninguno de los dos puede voltear una
   * emisión que ARCA ya autorizó. Por eso el error se traga y el aviso va sin
   * `await`: si Wati no contesta, la factura sigue emitida igual.
   */
  private async publicar(tenantId: string, id: string): Promise<void> {
    try {
      await this.enlaces.emitir(this.prisma, {
        tenantId,
        tipo: TipoEnlacePublico.FACTURA,
        entidadId: id,
        token: generarTokenPublico(),
      });
    } catch (error) {
      this.logger.warn(
        `No pude emitir el link público del comprobante ${id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Sin link no hay nada que mandar: el aviso no sale y no tiene sentido
      // intentarlo.
      return;
    }
    void this.avisos.avisar(id);
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
        ordenes: {
          select: {
            ordenId: true,
            monto: true,
            orden: { select: { numero: true } },
          },
        },
      },
    });
    // El PDF congelado al emitir salió sin CAE (el manual lo carga después):
    // se rehace para que el guardado tenga el número de autorización.
    await this.congelarPdf(auth.tenantId, id);
    // Recién ahora el comprobante es válido y hay algo que mandarle al
    // cliente. Al emitir no salió nada: `avisar` corta sin CAE.
    void this.avisos.avisar(id);
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

  /**
   * Facturar una orden desde su ficha: arma el renglón con el concepto,
   * crea el borrador vinculado y (salvo pedido contrario) lo emite por el
   * circuito normal. `monto` es TOTAL (IVA incluido): para letra A el
   * renglón va neto (÷1.21), para B/C/E el precio del renglón ES el
   * total (ver totales-comprobante.ts).
   */
  async facturarOrden(
    auth: CurrentAuth,
    ordenId: string,
    payload: FacturarOrdenDto,
  ) {
    const orden = await this.prisma.ordenTrabajo.findFirst({
      where: { id: ordenId, tenantId: auth.tenantId },
      select: {
        id: true,
        numero: true,
        estado: true,
        clienteId: true,
        total: true,
        facturadoTotal: true,
        descuentoTotal: true,
        tratamientoFiscal: true,
        items: {
          orderBy: { ordenIndice: 'asc' },
          select: {
            nombre: true,
            cantidad: true,
            subtotal: true,
            total: true,
            descuentoMonto: true,
          },
        },
      },
    });
    if (!orden) throw new NotFoundException('La orden no existe.');
    // Candado: una orden marcada sin comprobante no se factura, aunque el
    // pedido venga de un lote o de un POST directo (la cola ya la filtra).
    // Ver docs/margen-y-decisiones-de-precio.md §6.
    if (orden.tratamientoFiscal === 'SIN_COMPROBANTE') {
      throw new BadRequestException(
        'La orden está marcada sin comprobante fiscal en el sistema. Quitá esa marca desde la ficha para poder emitirle factura.',
      );
    }
    if (orden.estado === 'borrador') {
      throw new BadRequestException(
        'No se puede facturar una orden en borrador: emitila primero.',
      );
    }
    // No se factura lo que se dio de baja. Al revés tampoco: una orden con
    // facturación emitida no se puede cancelar hasta que se le emita la NC.
    if (orden.estado === 'cancelada') {
      throw new BadRequestException(
        'La orden está cancelada: no se puede facturar.',
      );
    }
    // La red del gate de UI: aunque el botón se filtre, sin la integración AFIP
    // activa no se emite. Ver docs/integracion-afip-delegacion-diseno.md
    if (!(await this.afipIntegracion.facturacionHabilitada())) {
      throw new BadRequestException(
        'La facturación electrónica no está activa. Verificá la delegación de AFIP en Configuración → Integraciones.',
      );
    }
    const saldo = redondear2(
      Number(orden.total ?? 0) - Number(orden.facturadoTotal),
    );
    if (saldo <= 0.01) {
      throw new BadRequestException(
        `La orden ${orden.numero} ya está facturada por completo.`,
      );
    }
    const monto = payload.monto ?? saldo;
    if (monto > saldo + 0.01) {
      throw new BadRequestException(
        `La orden ${orden.numero} tiene $${saldo.toLocaleString('es-AR')} sin facturar: no se puede facturar más que el total de la orden.`,
      );
    }

    const puntoVentaId =
      payload.puntoVentaId ?? (await this.puntoVentaDefault(auth));
    const letra = await this.letraParaCliente(auth, orden.clienteId);
    // F5 descuentos: una orden CON descuento que se factura completa y de una
    // sola vez sale DETALLADA — un renglón por producto con precio de lista +
    // bonificación (decisión 2026-08-08, ver descuentos-diseno.md §10). Los
    // montos parciales siguen como renglón único: no mapean a items y el
    // descuento ya viaja embebido en el monto.
    const items = this.itemsFacturaOrden(
      orden,
      letra,
      monto,
      saldo,
      payload.concepto?.trim() || `Trabajos de impresión — ${orden.numero}`,
    );
    // El vínculo lleva el total RECALCULADO de los renglones (en A el redondeo
    // del neto puede correr un centavo) para que el reparto cierre exacto.
    const total = calcularTotales(letra, items).total;

    const borrador = await this.crear(auth, {
      tipo: 'factura',
      puntoVentaId,
      clienteId: orden.clienteId ?? undefined,
      ordenes: [{ ordenId: orden.id, monto: total }],
      items,
      condicionVenta: 'contado',
    } as CrearComprobanteDto);
    if (payload.emitir === false) return borrador;
    return this.emitir(auth, borrador.id);
  }

  /**
   * Nota de crédito contra una factura de la orden.
   *
   * Es la única forma de deshacer lo fiscal: ARCA no tiene "anular", se corrige
   * emitiendo un comprobante que referencia al original (por eso el provider no
   * expone `anular`, sino otro `emitir` con asociados). Sale por el mismo
   * camino que la factura —AFIP SDK si el tenant tiene la integración activa,
   * manual si no—, así que hereda el gate del plan sin pedir nada nuevo.
   *
   * Al emitirse, `alEmitirComprobante` revierte la factura corregida: le saca
   * los cobros imputados y rehace su saldo. Es lo que permite después cancelar
   * la orden, que se frena mientras haya facturación viva.
   */
  async notaCreditoDeOrden(
    auth: CurrentAuth,
    ordenId: string,
    payload: NotaCreditoOrdenDto,
  ) {
    const orden = await this.prisma.ordenTrabajo.findFirst({
      where: { id: ordenId, tenantId: auth.tenantId },
      select: { id: true, numero: true, clienteId: true },
    });
    if (!orden) throw new NotFoundException('La orden no existe.');

    const factura = await this.prisma.comprobante.findFirst({
      where: {
        id: payload.comprobanteOrigenId,
        tenantId: auth.tenantId,
        tipo: 'factura',
      },
      select: {
        id: true,
        estado: true,
        anuladoEl: true,
        total: true,
        letra: true,
        numero: true,
        puntoVentaId: true,
        clienteId: true,
        puntoVenta: { select: { numero: true } },
        ordenes: { select: { ordenId: true } },
      },
    });
    if (!factura) {
      throw new NotFoundException('No se encontró la factura a corregir.');
    }
    if (factura.estado !== 'emitido' || factura.anuladoEl) {
      throw new BadRequestException(
        'Sólo se le emite nota de crédito a una factura emitida. Un borrador se descarta.',
      );
    }
    const pv = String(factura.puntoVenta.numero).padStart(4, '0');
    const nro =
      factura.numero === null ? '—' : String(factura.numero).padStart(8, '0');
    const numeroFactura = `${factura.letra} ${pv}-${nro}`;

    if (!factura.ordenes.some((v) => v.ordenId === orden.id)) {
      throw new BadRequestException(
        `La factura ${numeroFactura} no está vinculada a la orden ${orden.numero}.`,
      );
    }

    // Lo que queda vivo de esa factura: su total menos lo que otras NC ya le
    // sacaron. Sin esto se podría acreditar dos veces la misma factura.
    const previas = await this.prisma.comprobante.aggregate({
      where: {
        tenantId: auth.tenantId,
        comprobanteOrigenId: factura.id,
        tipo: 'nota_credito',
        estado: 'emitido',
        anuladoEl: null,
      },
      _sum: { total: true },
    });
    const vivo = redondear2(
      Number(factura.total) - Number(previas._sum.total ?? 0),
    );
    if (vivo <= 0.01) {
      throw new BadRequestException(
        'Esa factura ya está acreditada por completo.',
      );
    }
    const monto = payload.monto ?? vivo;
    if (monto > vivo + 0.01) {
      throw new BadRequestException(
        `La factura tiene $${vivo.toLocaleString('es-AR')} sin acreditar: la nota de crédito no puede ser mayor.`,
      );
    }

    const letra = await this.letraParaCliente(auth, factura.clienteId);
    const item = this.renglonPorMonto(
      letra,
      monto,
      `Anulación ${numeroFactura} — ${payload.motivo.trim()}`,
    );
    const total = calcularTotales(letra, [item]).total;

    const borrador = await this.crear(auth, {
      tipo: 'nota_credito',
      puntoVentaId: factura.puntoVentaId,
      clienteId: factura.clienteId ?? orden.clienteId ?? undefined,
      comprobanteOrigenId: factura.id,
      ordenes: [{ ordenId: orden.id, monto: total }],
      items: [item],
      condicionVenta: 'contado',
    } as CrearComprobanteDto);
    if (payload.emitir === false) return borrador;
    return this.emitir(auth, borrador.id);
  }

  /**
   * Lote desde Administración → Facturación: cada orden por su saldo sin
   * facturar. 'por_orden' emite N facturas SECUENCIALES y nunca es
   * todo-o-nada (el CAE es por comprobante: las que fallan quedan
   * reportadas, las demás salen). 'agrupada' arma UNA factura con un
   * renglón por orden — mismo cliente obligatorio.
   */
  async facturarLote(auth: CurrentAuth, payload: FacturarLoteDto) {
    const ordenes = await this.prisma.ordenTrabajo.findMany({
      where: { id: { in: payload.ordenIds }, tenantId: auth.tenantId },
      select: {
        id: true,
        numero: true,
        estado: true,
        clienteId: true,
        total: true,
        facturadoTotal: true,
        tratamientoFiscal: true,
      },
    });
    const porId = new Map(ordenes.map((o) => [o.id, o]));
    const faltantes = payload.ordenIds.filter((id) => !porId.has(id));
    if (faltantes.length > 0) {
      throw new BadRequestException('Hay órdenes que no existen en el lote.');
    }
    // Candado (también acá porque la 'agrupada' no pasa por facturarOrden).
    // Ver docs/margen-y-decisiones-de-precio.md §6.
    const sinComprobante = ordenes.filter(
      (o) => o.tratamientoFiscal === 'SIN_COMPROBANTE',
    );
    if (sinComprobante.length > 0) {
      throw new BadRequestException(
        `Hay órdenes sin comprobante fiscal en el lote (${sinComprobante
          .map((o) => o.numero)
          .join(', ')}): no se pueden facturar.`,
      );
    }

    if (payload.modo === 'agrupada') {
      const clientes = new Set(ordenes.map((o) => o.clienteId ?? 'CF'));
      if (clientes.size > 1) {
        throw new BadRequestException(
          'Una factura tiene un solo receptor: para agrupar, las órdenes tienen que ser del mismo cliente.',
        );
      }
      const clienteId = ordenes[0]?.clienteId ?? null;
      const letra = await this.letraParaCliente(auth, clienteId);
      const items: ItemPersistido[] = [];
      const vinculos: ComprobanteOrdenVinculoDto[] = [];
      for (const id of payload.ordenIds) {
        const orden = porId.get(id)!;
        const saldo = redondear2(
          Number(orden.total ?? 0) - Number(orden.facturadoTotal),
        );
        if (saldo <= 0.01) {
          throw new BadRequestException(
            `La orden ${orden.numero} ya está facturada por completo.`,
          );
        }
        const item = this.renglonPorMonto(
          letra,
          saldo,
          `Trabajos de impresión — ${orden.numero}`,
        );
        items.push(item);
        vinculos.push({
          ordenId: orden.id,
          monto: calcularTotales(letra, [item]).total,
        });
      }
      const puntoVentaId =
        payload.puntoVentaId ?? (await this.puntoVentaDefault(auth));
      const borrador = await this.crear(auth, {
        tipo: 'factura',
        puntoVentaId,
        clienteId: clienteId ?? undefined,
        ordenes: vinculos,
        items,
        condicionVenta: 'contado',
      } as CrearComprobanteDto);
      const emitido = await this.emitir(auth, borrador.id);
      return {
        modo: 'agrupada' as const,
        resultados: payload.ordenIds.map((ordenId) => ({
          ordenId,
          numero: porId.get(ordenId)!.numero,
          ok: emitido.estado === 'emitido',
          comprobante: emitido,
          error:
            emitido.estado === 'emitido'
              ? null
              : 'El comprobante quedó ' + emitido.estado,
        })),
      };
    }

    const resultados: Array<{
      ordenId: string;
      numero: string;
      ok: boolean;
      comprobante: Awaited<ReturnType<typeof this.facturarOrden>> | null;
      error: string | null;
    }> = [];
    for (const ordenId of payload.ordenIds) {
      const orden = porId.get(ordenId)!;
      try {
        const comprobante = await this.facturarOrden(auth, ordenId, {
          puntoVentaId: payload.puntoVentaId,
        });
        resultados.push({
          ordenId,
          numero: orden.numero,
          ok: comprobante.estado === 'emitido',
          comprobante,
          error:
            comprobante.estado === 'emitido'
              ? null
              : 'El comprobante quedó ' + comprobante.estado,
        });
      } catch (e) {
        resultados.push({
          ordenId,
          numero: orden.numero,
          ok: false,
          comprobante: null,
          error: e instanceof Error ? e.message : 'Error desconocido',
        });
      }
    }
    return { modo: 'por_orden' as const, resultados };
  }

  /** El renglón de "facturar por monto": total elegido → precio según letra. */
  /**
   * Borrador de UN renglón por monto final (IVA incluido), sin orden de por
   * medio. Lo usa el billing de suscripciones del control plane: mismo
   * camino fiscal que facturarOrden (letra por receptor, neto/IVA por
   * totales-comprobante), sin duplicar la matemática.
   */
  async crearBorradorPorMonto(
    auth: CurrentAuth,
    payload: {
      clienteId?: string;
      puntoVentaId: string;
      monto: number;
      concepto: string;
      condicionVenta?: string;
    },
  ) {
    const letra = await this.letraParaCliente(auth, payload.clienteId ?? null);
    const item = this.renglonPorMonto(letra, payload.monto, payload.concepto);
    return this.crear(auth, {
      tipo: 'factura',
      puntoVentaId: payload.puntoVentaId,
      clienteId: payload.clienteId,
      items: [item],
      condicionVenta: payload.condicionVenta ?? 'cuenta_corriente',
    } as CrearComprobanteDto);
  }

  private renglonPorMonto(
    letra: LetraProvider,
    monto: number,
    descripcion: string,
  ): ItemPersistido {
    return {
      descripcion,
      cantidad: 1,
      precioUnitarioSinIva: letra === 'A' ? redondear2(monto / 1.21) : monto,
      alicuotaIva: 21,
    };
  }

  /**
   * Renglones de la factura de una orden (F5 descuentos): detallados con
   * bonificación cuando `renglonesDetalladosOrden` lo permite; si no, el
   * renglón único por monto de siempre.
   */
  private itemsFacturaOrden(
    orden: {
      facturadoTotal: Prisma.Decimal | number;
      descuentoTotal: Prisma.Decimal | number | null;
      items: Array<{
        nombre: string;
        cantidad: Prisma.Decimal | number;
        subtotal: Prisma.Decimal | number;
        total: Prisma.Decimal | number;
        descuentoMonto: Prisma.Decimal | number | null;
      }>;
    },
    letra: LetraProvider,
    monto: number,
    saldo: number,
    concepto: string,
  ): ItemPersistido[] {
    const detallados = renglonesDetalladosOrden({
      letra,
      monto,
      saldo,
      facturadoTotal: Number(orden.facturadoTotal),
      descuentoTotal: Number(orden.descuentoTotal ?? 0),
      items: orden.items.map((item) => ({
        nombre: item.nombre,
        cantidad: Number(item.cantidad),
        subtotal: Number(item.subtotal),
        total: Number(item.total),
        descuentoMonto: Number(item.descuentoMonto ?? 0),
      })),
    });
    return detallados ?? [this.renglonPorMonto(letra, monto, concepto)];
  }

  private async puntoVentaDefault(auth: CurrentAuth): Promise<string> {
    const pv = await this.prisma.puntoVenta.findFirst({
      where: { tenantId: auth.tenantId, activo: true },
      orderBy: { numero: 'asc' },
      select: { id: true },
    });
    if (!pv) {
      throw new BadRequestException(
        'No hay un punto de venta activo: configuralo en Administración → Datos fiscales.',
      );
    }
    return pv.id;
  }

  /** La letra que le saldría a este cliente (misma matriz que crear()). */
  private async letraParaCliente(
    auth: CurrentAuth,
    clienteId: string | null,
  ): Promise<LetraProvider> {
    const config = await this.prisma.configuracionFiscal.findUnique({
      where: { tenantId: auth.tenantId },
      select: { condicionFiscal: true, leyendaFacturaA: true },
    });
    if (!config) {
      throw new BadRequestException(
        'Configurá primero los datos fiscales del emisor (Administración → Datos fiscales).',
      );
    }
    const cliente = clienteId
      ? await this.prisma.cliente.findFirst({
          where: { id: clienteId, tenantId: auth.tenantId },
          select: { condicionFiscal: true },
        })
      : null;
    const resultado = letraComprobante(
      config.condicionFiscal as CondicionFiscalEmisor,
      (cliente?.condicionFiscal ??
        'consumidor_final') as CondicionFiscalReceptor,
      config.leyendaFacturaA as LeyendaA | null,
    );
    return resultado.letra as LetraProvider;
  }

  private async resolverReceptorEItems(
    auth: CurrentAuth,
    payload: CrearComprobanteDto,
  ) {
    let clienteId = payload.clienteId ?? null;
    const vinculos: ComprobanteOrdenVinculoDto[] = [];
    let items: ItemCalculo[] = (payload.items ?? []).map((i) => ({
      cantidad: i.cantidad,
      precioUnitarioSinIva: i.precioUnitarioSinIva,
      alicuotaIva: i.alicuotaIva ?? 21,
      bonificacionPct: i.bonificacionPct,
      descripcion: i.descripcion,
    })) as ItemCalculo[];

    if (payload.ordenId && payload.ordenes?.length) {
      throw new BadRequestException(
        '`ordenId` y `ordenes` son excluyentes: usá la lista con montos.',
      );
    }

    if (payload.ordenId) {
      const orden = await this.validarOrdenFacturable(auth, payload.ordenId);
      vinculos.push({ ordenId: orden.id, monto: 0 }); // monto = total, se fija en crear()
      clienteId = clienteId ?? orden.clienteId;
      if (items.length === 0) {
        // Los ítems de la OT ya traen el precio con impuestos calculados por
        // el motor. Acá se factura el subtotal (neto): el IVA lo recalcula
        // el comprobante según su letra. Una línea con descuento comercial se
        // expresa como precio de LISTA + bonificación — misma base, el
        // descuento se hace visible en el comprobante (F5 descuentos). El pct
        // va sin redondear para que la bonificación aterrice en el subtotal
        // persistido al centavo.
        items = orden.items.map((it) => {
          const subtotal = Number(it.subtotal);
          const descuento = Math.max(0, Number(it.descuentoMonto ?? 0));
          const lista = subtotal + descuento;
          const pct = lista > 0 ? (descuento / lista) * 100 : 0;
          const cantidad = Number(it.cantidad) > 0 ? Number(it.cantidad) : 1;
          return {
            descripcion: it.nombre,
            cantidad,
            precioUnitarioSinIva: lista / cantidad,
            alicuotaIva: 21,
            ...(pct > 0 ? { bonificacionPct: pct } : {}),
          };
        }) as ItemCalculo[];
      }
    }

    if (payload.ordenes?.length) {
      const vistos = new Set<string>();
      for (const v of payload.ordenes) {
        if (vistos.has(v.ordenId)) {
          throw new BadRequestException(
            'Hay una orden repetida en los vínculos del comprobante.',
          );
        }
        vistos.add(v.ordenId);
        const orden = await this.validarOrdenFacturable(auth, v.ordenId);
        // Una factura tiene UN receptor: todas las órdenes del lote
        // tienen que ser del mismo cliente (o venir sin cliente y
        // salir a Consumidor Final).
        if (clienteId && orden.clienteId && orden.clienteId !== clienteId) {
          throw new BadRequestException(
            `La orden ${orden.numero} es de otro cliente: una factura tiene un solo receptor.`,
          );
        }
        clienteId = clienteId ?? orden.clienteId;
        vinculos.push({ ordenId: v.ordenId, monto: v.monto });
      }
      if (items.length === 0) {
        throw new BadRequestException(
          'Un comprobante con montos por orden necesita sus ítems (un renglón por orden).',
        );
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

    return { cliente, items, vinculos };
  }

  private async validarOrdenFacturable(auth: CurrentAuth, ordenId: string) {
    const orden = await this.prisma.ordenTrabajo.findFirst({
      where: { id: ordenId, tenantId: auth.tenantId },
      include: { items: true },
    });
    if (!orden) throw new BadRequestException('La orden no existe.');
    if (orden.estado === 'borrador') {
      throw new BadRequestException(
        'No se puede facturar una orden en borrador: emitila primero.',
      );
    }
    // No se factura lo que se dio de baja. Al revés tampoco: una orden con
    // facturación emitida no se puede cancelar hasta que se le emita la NC.
    if (orden.estado === 'cancelada') {
      throw new BadRequestException(
        'La orden está cancelada: no se puede facturar.',
      );
    }
    return orden;
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
    ordenes: Array<{
      ordenId: string;
      monto: Prisma.Decimal;
      orden: { numero: string };
    }>;
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
      // Legacy: el primer vínculo (o la columna deprecada en históricos).
      ordenId: c.ordenId ?? c.ordenes[0]?.ordenId ?? null,
      ordenNumero: c.orden?.numero ?? c.ordenes[0]?.orden.numero ?? null,
      /** Vínculos con monto: cuánto de este comprobante aplica a cada orden. */
      ordenes: c.ordenes.map((v) => ({
        ordenId: v.ordenId,
        numero: v.orden.numero,
        monto: Number(v.monto),
      })),
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
