import {
  BadRequestException,
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
import { createHash } from 'node:crypto';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ArchivosService } from '../archivos/archivos.service';
import { PresupuestoPdfService } from './presupuesto-pdf.service';
import { DatosEmpresaService } from '../tenants/datos-empresa.service';
import { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import type { CrearOrdenTrabajoItemDto } from '../ordenes-trabajo/dto/crear-orden-trabajo.dto';
import { claveFechaEnZona, instanteDe, sumarDiasAClave } from '../common/zona';
import { evaluarAprobacion } from './aprobacion';
import {
  ConvertirPresupuestoDto,
  DecisionPublicaDto,
  EmitirPresupuestoDto,
  ListarPresupuestosDto,
  MOTIVOS_PERDIDA,
  ResolverPresupuestoDto,
  ActualizarConfigPresupuestosDto,
  type PresupuestoEstado,
} from './dto/presupuestos.dto';
import { NotificacionesPresupuestosService } from '../integraciones/notificaciones/notificaciones-presupuestos.service';
import {
  EnlacesPublicosService,
  generarTokenPublico,
} from '../enlaces-publicos/enlaces-publicos.service';
import { CuponesService } from '../cupones/cupones.service';

/**
 * Presupuestos — el ciclo comercial de la cotización
 * (docs/presupuestos-modulo-estudio.md). Una Cotizacion CON numero es un
 * presupuesto formal; sin numero sigue siendo el contenedor de snapshots
 * de la venta directa (ese camino no se toca).
 *
 * Estados: borrador → enviado → aprobado | rechazado | vencido →
 * convertido. "Visto" no es estado: es primeraVistaEl (link público).
 * Todo cambio queda en CotizacionEvento (timeline = respaldo del acuerdo).
 */

const ETIQUETA_MOTIVO: Record<string, string> = {
  precio: 'Precio',
  plazo: 'Plazo de entrega',
  sin_respuesta: 'Sin respuesta del cliente',
  competencia: 'Se fue a la competencia',
  otro: 'Otro',
};

type EmisionJson = {
  fechaEntrega?: string;
  canalVenta?: string;
  validezDias?: number;
  cargosDirectos?: number;
  cargos?: unknown[];
  items: CrearOrdenTrabajoItemDto[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function fechaValidezPresupuesto(
  ahora: Date,
  dias: number,
  zonaHoraria: string,
): Date {
  const hoy = claveFechaEnZona(ahora, zonaHoraria);
  const ultimoDia = sumarDiasAClave(hoy, dias);
  const diaSiguiente = sumarDiasAClave(ultimoDia, 1);
  return new Date(instanteDe(diaSiguiente, '00:00', zonaHoraria).getTime() - 1);
}

export function idempotenciaConversionPresupuesto(
  cotizacionId: string,
  itemIds: string[],
): string {
  const base = `${cotizacionId}:${[...itemIds].sort().join(',')}`;
  const hex = createHash('sha256').update(base).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

@Injectable()
export class PresupuestosService {
  private readonly logger = new Logger(PresupuestosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordenes: OrdenesTrabajoService,
    private readonly archivos: ArchivosService,
    private readonly pdf: PresupuestoPdfService,
    private readonly avisos: NotificacionesPresupuestosService,
    private readonly enlaces: EnlacesPublicosService,
    private readonly empresa: DatosEmpresaService,
    private readonly cupones: CuponesService,
  ) {}

  /**
   * Le avisa al cliente por WhatsApp si el estado del presupuesto lo amerita.
   *
   * Post-commit y sin `await`: enviar un presupuesto no puede tardar lo que
   * tarde Wati, y un aviso que falla no puede voltear la operación. Se puede
   * llamar de más — `sincronizar` lee el estado actual y la clave única
   * descarta el repetido.
   */
  private avisarAlCliente(cotizacionId: string): void {
    void this.avisos.sincronizar(cotizacionId);
  }

  // ── Configuración por tenant ───────────────────────────────────────
  async config(tenantId: string) {
    const row = await this.prisma.configuracionPresupuestos.findUnique({
      where: { tenantId },
    });
    return {
      validezDiasDefault: row?.validezDiasDefault ?? 15,
      senaSugeridaPctDefault: Number(row?.senaSugeridaPctDefault ?? 50),
      condicionesTexto: row?.condicionesTexto ?? null,
      // Reglas de aprobación (F2): null = desactivada.
      aprobacionMontoMax:
        row?.aprobacionMontoMax != null ? Number(row.aprobacionMontoMax) : null,
      aprobacionMargenMinPct:
        row?.aprobacionMargenMinPct != null
          ? Number(row.aprobacionMargenMinPct)
          : null,
      aprobacionDescuentoMaxPct:
        row?.aprobacionDescuentoMaxPct != null
          ? Number(row.aprobacionDescuentoMaxPct)
          : null,
      requiereAprobacionSinCosteo: row?.requiereAprobacionSinCosteo ?? false,
    };
  }

  async actualizarConfig(
    tenantId: string,
    dto: ActualizarConfigPresupuestosDto,
  ) {
    await this.prisma.configuracionPresupuestos.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: { ...dto },
    });
    return this.config(tenantId);
  }

  // ── Emitir: la Cotizacion de la ficha se vuelve presupuesto formal ─
  async emitir(auth: CurrentAuth, dto: EmitirPresupuestoDto) {
    const cotizacion = await this.prisma.cotizacion.findFirst({
      where: { id: dto.cotizacionId },
      select: { id: true, numero: true },
    });
    if (!cotizacion) throw new NotFoundException('La cotización no existe.');
    if (cotizacion.numero) {
      throw new BadRequestException(
        `Esta cotización ya es el presupuesto ${cotizacion.numero}.`,
      );
    }
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: dto.clienteId, activo: true },
      select: { id: true },
    });
    if (!cliente) {
      throw new BadRequestException(
        'El cliente no existe o está inhabilitado.',
      );
    }

    // Vendedor: el indicado, o el empleado ligado al usuario que emite
    // (mismo default que la OT).
    let vendedorEmpleadoId = dto.vendedorEmpleadoId ?? null;
    if (vendedorEmpleadoId) {
      const vendedor = await this.prisma.empleado.findFirst({
        where: { id: vendedorEmpleadoId },
        select: { id: true },
      });
      if (!vendedor) throw new BadRequestException('El vendedor no existe.');
    }
    if (!vendedorEmpleadoId) {
      const emisor = await this.prisma.empleado.findFirst({
        where: { userId: auth.userId },
        select: { id: true },
      });
      vendedorEmpleadoId = emisor?.id ?? null;
    }

    const cfg = await this.config(auth.tenantId);
    const ahora = new Date();
    const validezDias = dto.validezDias ?? cfg.validezDiasDefault;
    const items = await this.ordenes.autorizarItemsCotizados(
      auth,
      dto.cotizacionId,
      dto.items,
      dto.clienteId,
    );
    const subtotal = r2(items.reduce((a, i) => a + i.subtotal, 0));
    const impuestos = r2(items.reduce((a, i) => a + i.impuestos, 0));
    const cargos = await this.ordenes.autorizarCargosCotizados(
      auth,
      dto.cargos ?? [],
      subtotal,
    );
    const cargosDirectos = r2(
      cargos.reduce((a, cargo) => a + Number(cargo.total ?? 0), 0),
    );
    const total = r2(items.reduce((a, i) => a + i.total, 0) + cargosDirectos);
    const emisionJson: EmisionJson = {
      fechaEntrega: dto.fechaEntrega,
      canalVenta: dto.canalVenta,
      validezDias,
      cargosDirectos,
      cargos,
      items,
    };

    const numero = await this.prisma.$transaction(async (tx) => {
      const anio = ahora.getFullYear();
      const contador = await tx.cotizacionContador.upsert({
        where: { tenantId_anio: { tenantId: auth.tenantId, anio } },
        create: { tenantId: auth.tenantId, anio, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      });
      const nro = `PRES-${anio}-${String(contador.ultimo).padStart(4, '0')}`;
      const actualizada = await tx.cotizacion.updateMany({
        where: { id: dto.cotizacionId, numero: null },
        data: {
          numero: nro,
          clienteId: dto.clienteId,
          vendedorEmpleadoId,
          canalVenta: dto.canalVenta,
          estado: 'borrador',
          fechaEmision: ahora,
          fechaValidez: null,
          observaciones: dto.observaciones,
          senaSugeridaPct: dto.senaSugeridaPct ?? cfg.senaSugeridaPctDefault,
          subtotal,
          impuestos,
          total,
          cargosDirectosCotizacionJson:
            cargos as unknown as Prisma.InputJsonValue,
          emisionJson: emisionJson as unknown as Prisma.InputJsonValue,
        },
      });
      if (actualizada.count !== 1) {
        throw new BadRequestException(
          'Esta cotización ya fue emitida como presupuesto.',
        );
      }
      await tx.cotizacionEvento.create({
        data: {
          tenantId: auth.tenantId,
          cotizacionId: dto.cotizacionId,
          tipo: 'creado',
          descripcion: `Presupuesto ${nro} emitido (validez ${validezDias} días).`,
          usuarioId: auth.userId,
          usuarioNombre: await this.nombreDe(auth),
        },
      });
      return nro;
    });

    // Emitir es emitir: el comercial que apretó "Emitir presupuesto" quiere
    // que salga, no dejarlo en borrador para acordarse de enviarlo después.
    // `enviar` aplica las reglas de aprobación: si el total supera el umbral
    // y el actor es OPERADOR, queda en `pendiente_aprobacion` en vez de
    // salir. Para guardar sin emitir está el botón de borrador.
    //
    // Best-effort: si el envío falla, el presupuesto ya existe y queda en
    // borrador para reintentar desde el listado — mejor eso que perder la
    // numeración por un error de envío.
    try {
      return await this.enviar(auth, dto.cotizacionId);
    } catch (error) {
      this.logger.warn(
        `${numero} quedó en borrador: no pude enviarlo — ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        ...(await this.detalle(auth, dto.cotizacionId, { numero })),
        advertenciaEnvio:
          error instanceof Error
            ? error.message
            : 'No se pudo enviar el presupuesto.',
      };
    }
  }

  // ── PDF ────────────────────────────────────────────────────────────

  /**
   * Devuelve el PDF ya guardado, y si todavía no existe lo genera y lo
   * guarda. Antes se renderizaba con Chrome headless en CADA request: cada
   * vez que el cliente abría el link público del presupuesto se levantaba un
   * navegador. Ahora es un render por presupuesto.
   *
   * Nota de comportamiento: el PDF pasa a ser una FOTO del documento. Los
   * items y los totales ya venían congelados en `emisionJson`, así que eso no
   * cambia; lo que sí queda fijo ahora son el nombre del negocio, el texto de
   * condiciones y el logo vigentes al emitir. Para un documento comercial que
   * el cliente aprueba, congelarlos es lo correcto: si mañana cambian las
   * condiciones de pago, el presupuesto que ya se mandó no debería mutar.
   */
  async pdfDe(auth: CurrentAuth, id: string): Promise<Archivo> {
    const existente = await this.archivos.generadoDe(
      ArchivoScope.COTIZACION,
      id,
    );
    if (existente) return existente;
    return this.materializarPdf(auth, id);
  }

  /** Rehace el PDF y reemplaza el anterior. */
  async materializarPdf(auth: CurrentAuth, id: string): Promise<Archivo> {
    const [detalle, cfg, negocio, logoDataUri, empresa] = await Promise.all([
      this.detalle(auth, id),
      this.config(auth.tenantId),
      this.nombreDelNegocio(auth.tenantId),
      this.archivos.logoDataUri(auth.tenantId),
      this.empresa.paraDocumentos(auth.tenantId),
    ]);

    const contenido = await this.pdf.generar({
      numero: detalle.numero!,
      negocio,
      empresa,
      logoDataUri,
      cliente: detalle.cliente?.nombre ?? null,
      vendedor: detalle.vendedor?.nombre ?? null,
      fechaEmision: detalle.fechaEmision,
      fechaValidez: detalle.fechaValidez,
      observaciones: detalle.observaciones,
      senaSugeridaPct: detalle.senaSugeridaPct,
      condicionesTexto: cfg.condicionesTexto,
      subtotal: detalle.subtotal,
      impuestos: detalle.impuestos,
      cargosDirectos: detalle.cargosDirectos,
      total: detalle.total,
      descuentoTotal: detalle.descuentoTotal,
      items: detalle.items,
    });

    return this.archivos.materializar({
      tenantId: auth.tenantId,
      scope: ArchivoScope.COTIZACION,
      entidadId: id,
      nombre: `${detalle.numero}.pdf`,
      mimeType: 'application/pdf',
      contenido,
    });
  }

  /**
   * Descuento comercial de un item de la emisión, listo para MOSTRAR (F2
   * descuentos): monto, % y precio final de lista. `totalLista` sale por
   * gross-up escala-libre del total persistido (el IVA es proporcional al
   * neto — mismo criterio que facturación). Presupuestos viejos sin los
   * campos devuelven `{}` y nada cambia.
   */
  private descuentoDeItem(i: {
    subtotal: number;
    total: number;
    descuentoMonto?: number | null;
  }): { descuentoMonto?: number; descuentoPct?: number; totalLista?: number } {
    const monto = Number(i.descuentoMonto ?? 0);
    if (!(monto > 0)) return {};
    const netoLista = i.subtotal + monto;
    const pct = netoLista > 0 ? (monto / netoLista) * 100 : 0;
    const totalLista = pct < 100 ? i.total / (1 - pct / 100) : i.total + monto;
    return {
      descuentoMonto: monto,
      descuentoPct: r2(pct),
      totalLista: r2(totalLista),
    };
  }

  /** Σ del descuento de los items de la emisión (0 en presupuestos viejos). */
  private descuentoTotalDe(emision: EmisionJson): number {
    return r2(
      emision.items.reduce((a, i) => a + Number(i.descuentoMonto ?? 0), 0),
    );
  }

  private async nombreDelNegocio(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nombre: true },
    });
    return tenant?.nombre ?? 'Presupuesto';
  }

  // ── Listado + stats (pipeline en $) ────────────────────────────────
  async listado(auth: CurrentAuth, filtros: ListarPresupuestosDto) {
    await this.vencerExpirados(auth.tenantId);
    const regional = await this.empresa.regional(auth.tenantId);
    const where: Prisma.CotizacionWhereInput = {
      numero: { not: null },
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
      ...(filtros.busqueda
        ? {
            OR: [
              { numero: { contains: filtros.busqueda, mode: 'insensitive' } },
              {
                cliente: {
                  nombre: { contains: filtros.busqueda, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const skip = filtros.skip ?? 0;
    const limit = filtros.limit ?? 50;
    const [rows, totalFiltrado, porEstado] = await Promise.all([
      this.prisma.cotizacion.findMany({
        where,
        orderBy: { fechaEmision: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          numero: true,
          estado: true,
          fechaEmision: true,
          fechaValidez: true,
          fechaEnvio: true,
          fechaResuelto: true,
          primeraVistaEl: true,
          motivoPerdida: true,
          total: true,
          publicToken: true,
          convertidaOrdenId: true,
          cliente: { select: { id: true, nombre: true } },
          vendedor: { select: { id: true, nombreCompleto: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.cotizacion.count({ where }),
      this.prisma.cotizacion.groupBy({
        by: ['estado'],
        where: { numero: { not: null } },
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);

    const ordenIds = rows
      .map((rw) => rw.convertidaOrdenId)
      .filter((id): id is string => id != null);
    const ordenes = ordenIds.length
      ? await this.prisma.ordenTrabajo.findMany({
          where: { id: { in: ordenIds } },
          select: { id: true, numero: true },
        })
      : [];
    const numeroOrden = new Map(ordenes.map((o) => [o.id, o.numero] as const));

    return {
      presupuestos: rows.map((rw) => ({
        id: rw.id,
        numero: rw.numero,
        estado: rw.estado as PresupuestoEstado,
        fechaEmision: rw.fechaEmision?.toISOString() ?? null,
        fechaValidez: rw.fechaValidez
          ? claveFechaEnZona(rw.fechaValidez, regional.zonaHoraria)
          : null,
        fechaEnvio: rw.fechaEnvio?.toISOString() ?? null,
        fechaResuelto: rw.fechaResuelto?.toISOString() ?? null,
        visto: rw.primeraVistaEl != null,
        motivoPerdida: rw.motivoPerdida,
        total: Number(rw.total ?? 0),
        items: rw._count.items,
        cliente: rw.cliente?.nombre ?? 'Sin cliente',
        clienteId: rw.cliente?.id ?? null,
        vendedor: rw.vendedor?.nombreCompleto ?? null,
        publicToken: rw.publicToken,
        ordenConvertida: rw.convertidaOrdenId
          ? (numeroOrden.get(rw.convertidaOrdenId) ?? null)
          : null,
        ordenConvertidaId: rw.convertidaOrdenId,
      })),
      stats: porEstado.map((e) => ({
        estado: e.estado as PresupuestoEstado,
        cantidad: e._count._all,
        total: Number(e._sum.total ?? 0),
      })),
      paginacion: {
        skip,
        limit,
        total: totalFiltrado,
        hayMas: skip + rows.length < totalFiltrado,
      },
    };
  }

  // ── Detalle: proyección + timeline ─────────────────────────────────
  async detalle(auth: CurrentAuth, id: string, extra?: { numero?: string }) {
    await this.vencerExpirados(auth.tenantId, id);
    const c = await this.prisma.cotizacion.findFirst({
      where: { id, numero: { not: null } },
      include: {
        cliente: { select: { id: true, nombre: true } },
        vendedor: { select: { id: true, nombreCompleto: true } },
        eventos: { orderBy: { fecha: 'desc' }, take: 50 },
        items: {
          select: {
            id: true,
            ordenTrabajoItems: {
              select: {
                orden: { select: { id: true, numero: true } },
              },
            },
          },
        },
      },
    });
    if (!c) throw new NotFoundException('El presupuesto no existe.');
    const regional = await this.empresa.regional(auth.tenantId);
    const emision = (c.emisionJson ?? { items: [] }) as unknown as EmisionJson;
    const ordenConvertida = c.convertidaOrdenId
      ? await this.prisma.ordenTrabajo.findFirst({
          where: { id: c.convertidaOrdenId },
          select: { id: true, numero: true },
        })
      : null;
    const conversionPorItem = new Map(
      c.items.flatMap((item) =>
        item.ordenTrabajoItems.map(
          (otItem) => [item.id, otItem.orden] as const,
        ),
      ),
    );
    const ordenesConvertidas = Array.from(
      new Map(
        Array.from(conversionPorItem.values()).map((orden) => [
          orden.id,
          orden,
        ]),
      ).values(),
    );
    return {
      id: c.id,
      numero: extra?.numero ?? c.numero,
      estado: c.estado as PresupuestoEstado,
      cliente: c.cliente
        ? { id: c.cliente.id, nombre: c.cliente.nombre }
        : null,
      vendedor: c.vendedor
        ? { id: c.vendedor.id, nombre: c.vendedor.nombreCompleto }
        : null,
      canalVenta: c.canalVenta,
      fechaEmision: c.fechaEmision?.toISOString() ?? null,
      fechaValidez: c.fechaValidez
        ? claveFechaEnZona(c.fechaValidez, regional.zonaHoraria)
        : null,
      fechaEnvio: c.fechaEnvio?.toISOString() ?? null,
      fechaResuelto: c.fechaResuelto?.toISOString() ?? null,
      primeraVistaEl: c.primeraVistaEl?.toISOString() ?? null,
      motivoPerdida: c.motivoPerdida,
      motivoPerdidaDetalle: c.motivoPerdidaDetalle,
      aprobacionMotivos: (c.aprobacionMotivosJson ?? []) as Array<{
        regla: string;
        detalle: string;
      }>,
      aprobacionSolicitadaEl: c.aprobacionSolicitadaEl?.toISOString() ?? null,
      aprobacionResueltaPor: c.aprobacionResueltaPorNombre,
      observaciones: c.observaciones,
      senaSugeridaPct:
        c.senaSugeridaPct != null ? Number(c.senaSugeridaPct) : null,
      subtotal: Number(c.subtotal ?? 0),
      impuestos: Number(c.impuestos ?? 0),
      total: Number(c.total ?? 0),
      descuentoTotal: this.descuentoTotalDe(emision),
      cargosDirectos: emision.cargosDirectos ?? 0,
      fechaEntrega: emision.fechaEntrega ?? null,
      publicToken: c.publicToken,
      ordenConvertida: ordenConvertida?.numero ?? null,
      ordenConvertidaId: ordenConvertida?.id ?? null,
      ordenesConvertidas,
      items: emision.items.map((i) => ({
        cotizacionItemId: i.cotizacionItemId ?? null,
        codigo: i.codigo,
        nombre: i.nombre,
        familia: i.familia,
        cantidad: i.cantidad,
        cantidadUnidad: i.cantidadUnidad,
        subtotal: i.subtotal,
        impuestos: i.impuestos,
        total: i.total,
        ...this.descuentoDeItem(i),
        specs: i.specs ?? [],
        adicionales: i.adicionales ?? [],
        conversion: i.cotizacionItemId
          ? (conversionPorItem.get(i.cotizacionItemId) ?? null)
          : null,
      })),
      eventos: c.eventos.map((e) => ({
        fecha: e.fecha.toISOString(),
        tipo: e.tipo,
        descripcion: e.descripcion,
        usuario: e.usuarioNombre,
        origen: e.origen,
      })),
    };
  }

  // ── Enviar: borrador → enviado (habilita el link público) ──────────
  // F2: al PRIMER envío se evalúan las reglas de aprobación. Si disparan
  // y el actor es OPERADOR, el presupuesto queda BLOQUEADO en
  // pendiente_aprobacion (sin token público). SUPERVISOR/ADMIN están
  // exentos: envían igual y el evento registra que asumieron el envío.
  async enviar(auth: CurrentAuth, id: string) {
    const c = await this.exigir(id, ['borrador', 'enviado']);
    if (!c.clienteId) {
      throw new BadRequestException('Asigná un cliente antes de enviar.');
    }

    if (c.estado === 'borrador') {
      const motivos = await this.evaluarReglas(
        auth.tenantId,
        id,
        Number(c.total ?? 0),
      );
      if (motivos.length > 0) {
        const detalleMotivos = motivos.map((m) => m.detalle).join(' ');
        if (auth.role === 'OPERADOR') {
          await this.prisma.cotizacion.update({
            where: { id },
            data: {
              estado: 'pendiente_aprobacion',
              aprobacionMotivosJson:
                motivos as unknown as Prisma.InputJsonValue,
              aprobacionSolicitadaEl: new Date(),
              aprobacionResueltaPorId: null,
              aprobacionResueltaPorNombre: null,
              aprobacionResueltaEl: null,
            },
          });
          await this.evento(auth, id, {
            tipo: 'aprobacion_solicitada',
            descripcion: `Requiere aprobación de un supervisor antes de enviarse: ${detalleMotivos}`,
            datosJson: { motivos },
          });
          return this.detalle(auth, id);
        }
        // Exento por rol: envía igual, pero queda dicho.
        await this.prisma.cotizacion.update({
          where: { id },
          data: {
            aprobacionMotivosJson: motivos as unknown as Prisma.InputJsonValue,
          },
        });
        await this.evento(auth, id, {
          tipo: 'envio_asumido',
          descripcion: `Las reglas de aprobación dispararon y el envío fue asumido por su rol: ${detalleMotivos}`,
          datosJson: { motivos, rol: auth.role },
        });
      }
    }

    const enviado = await this.ejecutarEnvio(auth, c, {
      reenvio: c.estado === 'enviado',
    });
    this.avisarAlCliente(c.id);
    return enviado;
  }

  /** El acto de envío en sí (token + fecha + estado + evento). */
  private async ejecutarEnvio(
    auth: CurrentAuth,
    c: {
      id: string;
      clienteId?: string | null;
      publicToken: string | null;
      fechaValidez?: Date | null;
      emisionJson?: Prisma.JsonValue | null;
    },
    opts: { reenvio: boolean; descripcion?: string },
  ) {
    const token = c.publicToken ?? generarTokenPublico();
    const emision = (c.emisionJson ?? { items: [] }) as unknown as EmisionJson;
    const fechaValidez =
      c.fechaValidez ??
      (await this.fechaValidezDesdeEnvio(
        auth.tenantId,
        emision.validezDias ??
          (await this.config(auth.tenantId)).validezDiasDefault,
      ));
    await this.prisma.$transaction(async (tx) => {
      await this.cupones.reservarParaPresupuesto(
        tx,
        auth,
        c.id,
        c.clienteId ?? null,
        emision.items,
      );
      const actualizada = await tx.cotizacion.updateMany({
        where: {
          id: c.id,
          estado: opts.reenvio
            ? 'enviado'
            : { in: ['borrador', 'pendiente_aprobacion'] },
        },
        data: {
          estado: 'enviado',
          fechaEnvio: new Date(),
          fechaValidez,
          publicToken: token,
        },
      });
      if (actualizada.count !== 1) {
        throw new BadRequestException(
          'El presupuesto cambió de estado mientras se intentaba enviar.',
        );
      }
      // Reenviar no acuña token nuevo: `emitir` es idempotente por entidad, así
      // que el link que el cliente ya tiene sigue siendo el mismo.
      await this.enlaces.emitir(tx, {
        tenantId: auth.tenantId,
        tipo: TipoEnlacePublico.PRESUPUESTO,
        entidadId: c.id,
        token,
      });
    });
    await this.evento(auth, c.id, {
      tipo: 'enviado',
      descripcion:
        opts.descripcion ??
        (opts.reenvio
          ? 'Presupuesto reenviado al cliente.'
          : 'Presupuesto enviado al cliente.'),
    });
    await this.materializarPdf(auth, c.id).catch((error: unknown) => {
      this.logger.warn(
        `No pude materializar el PDF del presupuesto ${c.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    return this.detalle(auth, c.id);
  }

  /** Fin del último día de validez en la zona horaria comercial del tenant. */
  private async fechaValidezDesdeEnvio(tenantId: string, dias: number) {
    const { zonaHoraria } = await this.empresa.regional(tenantId);
    return fechaValidezPresupuesto(new Date(), dias, zonaHoraria);
  }

  /** Reglas de aprobación contra los items con costo del snapshot. */
  private async evaluarReglas(
    tenantId: string,
    cotizacionId: string,
    total: number,
  ) {
    const [cfg, items, cotizacion, regional] = await Promise.all([
      this.config(tenantId),
      this.prisma.cotizacionItem.findMany({
        where: { cotizacionId },
        select: {
          id: true,
          precioNetoTotal: true,
          precioTotal: true,
          costoTotal: true,
          descuentoMonto: true,
        },
      }),
      this.prisma.cotizacion.findUnique({
        where: { id: cotizacionId },
        select: { emisionJson: true },
      }),
      this.empresa.regional(tenantId),
    ]);
    const emision = (cotizacion?.emisionJson ?? {
      items: [],
    }) as unknown as EmisionJson;
    const autorizadosPorCupon = new Set(
      emision.items
        .filter((item) => Boolean(item.descuentoCuponId))
        .map((item) => item.cotizacionItemId),
    );
    const descuentoMaxPct = items.reduce((max, i) => {
      if (autorizadosPorCupon.has(i.id)) return max;
      const monto = Number(i.descuentoMonto ?? 0);
      const netoLista = Number(i.precioNetoTotal ?? 0) + monto;
      const pct = monto > 0 && netoLista > 0 ? (monto / netoLista) * 100 : 0;
      return Math.max(max, pct);
    }, 0);
    return evaluarAprobacion(
      {
        aprobacionMontoMax: cfg.aprobacionMontoMax,
        aprobacionMargenMinPct: cfg.aprobacionMargenMinPct,
        aprobacionDescuentoMaxPct: cfg.aprobacionDescuentoMaxPct,
        requiereAprobacionSinCosteo: cfg.requiereAprobacionSinCosteo,
      },
      {
        total,
        items: items.map((i) => ({
          subtotal: Number(i.precioNetoTotal ?? i.precioTotal ?? 0),
          costoTotal: i.costoTotal != null ? Number(i.costoTotal) : null,
        })),
        descuentoMaxPct,
      },
      regional.moneda,
    );
  }

  // ── Resolución de la aprobación pendiente (SUPERVISOR/ADMIN) ───────
  async resolverAprobacion(
    auth: CurrentAuth,
    id: string,
    dto: { decision: 'aprobar' | 'devolver'; comentario?: string },
  ) {
    const c = await this.exigir(id, ['pendiente_aprobacion']);
    const nombre = await this.nombreDe(auth);
    await this.prisma.cotizacion.update({
      where: { id },
      data: {
        aprobacionResueltaPorId: auth.userId,
        aprobacionResueltaPorNombre: nombre,
        aprobacionResueltaEl: new Date(),
        ...(dto.decision === 'devolver' ? { estado: 'borrador' } : {}),
      },
    });
    if (dto.decision === 'devolver') {
      await this.evento(auth, id, {
        tipo: 'aprobacion_devuelta',
        descripcion: `Devuelto por ${nombre} sin enviar${dto.comentario ? `: ${dto.comentario}` : '.'}`,
        datosJson: { comentario: dto.comentario ?? null },
      });
      return this.detalle(auth, id);
    }
    // Aprobar = aprobar Y enviar en el mismo acto (decisión del plan §9).
    await this.evento(auth, id, {
      tipo: 'aprobacion_aprobada',
      descripcion: `Aprobación interna otorgada por ${nombre}.`,
    });
    return this.ejecutarEnvio(auth, c, {
      reenvio: false,
      descripcion: 'Presupuesto enviado al cliente (con aprobación interna).',
    });
  }

  // ── Resolver: el vendedor marca la decisión ────────────────────────
  async resolver(auth: CurrentAuth, id: string, dto: ResolverPresupuestoDto) {
    const c = await this.exigir(id, ['enviado', 'vencido']);
    if (c.estado === 'vencido' && dto.resultado === 'aprobado') {
      throw new BadRequestException(
        'El presupuesto está vencido: recotizalo antes de aprobarlo (los precios ya no valen).',
      );
    }
    if (dto.resultado === 'rechazado') {
      if (
        !dto.motivoPerdida ||
        !MOTIVOS_PERDIDA.includes(dto.motivoPerdida as never)
      ) {
        throw new BadRequestException(
          'Elegí el motivo de la pérdida (sirve para las métricas comerciales).',
        );
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.cotizacion.update({
        where: { id },
        data: {
          estado: dto.resultado,
          fechaResuelto: new Date(),
          motivoPerdida:
            dto.resultado === 'rechazado' ? dto.motivoPerdida : null,
          motivoPerdidaDetalle:
            dto.resultado === 'rechazado' ? dto.motivoPerdidaDetalle : null,
        },
      });
      if (dto.resultado === 'rechazado') {
        await this.cupones.liberarReservasPresupuesto(
          tx,
          auth.tenantId,
          id,
          'Presupuesto rechazado.',
        );
      }
    });
    await this.evento(auth, id, {
      tipo: dto.resultado,
      descripcion:
        dto.resultado === 'aprobado'
          ? 'Marcado como aprobado por el cliente.'
          : `Marcado como perdido: ${ETIQUETA_MOTIVO[dto.motivoPerdida!] ?? dto.motivoPerdida}${dto.motivoPerdidaDetalle ? ` — ${dto.motivoPerdidaDetalle}` : ''}.`,
    });
    this.avisarAlCliente(id);
    return this.detalle(auth, id);
  }

  // ── Convertir: aprobado → OT (total o parcial) ─────────────────────
  // Sólo desde APROBADO: convertir sin la decisión del cliente saltearía
  // el ciclo (decisión del usuario 2026-07-18).
  async convertir(auth: CurrentAuth, id: string, dto: ConvertirPresupuestoDto) {
    const c = await this.exigir(id, ['aprobado']);
    const emision = (c.emisionJson ?? null) as unknown as EmisionJson | null;
    if (!emision?.items?.length) {
      throw new BadRequestException(
        'El presupuesto no tiene la proyección de items para convertir.',
      );
    }
    const todosLosIds = emision.items
      .map((item) => item.cotizacionItemId)
      .filter((itemId): itemId is string => Boolean(itemId));
    const conversiones = await this.prisma.ordenTrabajoItem.findMany({
      where: {
        cotizacionItemId: { in: todosLosIds },
        orden: { cotizacionId: id },
      },
      select: { cotizacionItemId: true, ordenId: true },
    });
    const convertidos = new Set(
      conversiones
        .map((item) => item.cotizacionItemId)
        .filter((itemId): itemId is string => Boolean(itemId)),
    );
    const restantes = emision.items.filter(
      (item) =>
        item.cotizacionItemId && !convertidos.has(item.cotizacionItemId),
    );
    if (restantes.length === 0) {
      throw new BadRequestException(
        'Todos los items de este presupuesto ya fueron convertidos.',
      );
    }

    let items = restantes;
    if (dto.itemIds?.length) {
      const solicitados = new Set(dto.itemIds);
      if (solicitados.size !== dto.itemIds.length) {
        throw new BadRequestException(
          'La selección contiene items duplicados.',
        );
      }
      const desconocidos = dto.itemIds.filter(
        (itemId) => !todosLosIds.includes(itemId),
      );
      if (desconocidos.length > 0) {
        throw new BadRequestException(
          'Algún item seleccionado no pertenece al presupuesto.',
        );
      }
      const yaConvertidos = dto.itemIds.filter((itemId) =>
        convertidos.has(itemId),
      );
      if (yaConvertidos.length > 0) {
        throw new BadRequestException(
          'Algún item seleccionado ya fue convertido en una orden.',
        );
      }
      items = restantes.filter(
        (i) => i.cotizacionItemId && dto.itemIds!.includes(i.cotizacionItemId),
      );
      if (items.length === 0) {
        throw new BadRequestException(
          'Ningún item seleccionado para convertir.',
        );
      }
    }
    const parcial = items.length < emision.items.length;

    // La fecha de entrega cotizada puede haber quedado en el pasado: la OT
    // nace en borrador para revisarla y emitirla desde su propia ficha.
    const hoyIso = new Date().toISOString().slice(0, 10);
    const fechaEntrega =
      emision.fechaEntrega && emision.fechaEntrega >= hoyIso
        ? emision.fechaEntrega
        : undefined;

    const orden = await this.ordenes.create(auth, {
      idempotencyKey: idempotenciaConversionPresupuesto(
        id,
        items.map((item) => item.cotizacionItemId),
      ),
      clienteId: c.clienteId ?? undefined,
      vendedorEmpleadoId: c.vendedorEmpleadoId ?? undefined,
      cotizacionId: id,
      estado: 'borrador',
      fechaEntrega,
      canalVenta: emision.canalVenta,
      cargosDirectos: parcial ? undefined : emision.cargosDirectos,
      observaciones: c.observaciones ?? undefined,
      items,
    });

    // El arte que el cliente mandó con el presupuesto tiene que seguir a la
    // orden: producción lo necesita ahí, no en un documento ya cerrado.
    await this.archivos.revincularCotizacionAOrden(id, orden.id);

    const convertidosTrasEstaOrden = new Set([
      ...convertidos,
      ...items
        .map((item) => item.cotizacionItemId)
        .filter((itemId): itemId is string => Boolean(itemId)),
    ]);
    const completa = convertidosTrasEstaOrden.size === todosLosIds.length;
    await this.prisma.cotizacion.update({
      where: { id },
      data: {
        estado: completa ? 'convertido' : 'aprobado',
        convertidaOrdenId: orden.id,
      },
    });
    await this.evento(auth, id, {
      tipo: 'convertido',
      descripcion: `Convertido en la orden ${orden.numero}${parcial ? ` (${items.length} de ${emision.items.length} items; ${todosLosIds.length - convertidosTrasEstaOrden.size} pendientes)` : ''}. La orden queda en borrador para revisar fecha y emitir.`,
      datosJson: { ordenId: orden.id, parcial, completa },
    });

    return {
      ordenId: orden.id,
      ordenNumero: orden.numero,
      parcial,
      completa,
      itemsPendientes: todosLosIds.length - convertidosTrasEstaOrden.size,
    };
  }

  // ── Link público: ver + decidir ────────────────────────────────────
  /** El token se resuelve contra EnlacePublico (sin sesión no hay
   *  tenantContext — el token ES la credencial; mismo patrón que el
   *  tracking de OT). Ver docs/enlaces-publicos-diseno.md */
  async publico(token: string) {
    const enlace = await this.enlaces.resolver(
      token,
      TipoEnlacePublico.PRESUPUESTO,
      { contarVisita: true },
    );
    if (!enlace) throw new NotFoundException('Presupuesto no encontrado.');
    const c = await this.prisma.cotizacion.findUnique({
      where: { id: enlace.entidadId },
      include: {
        tenant: { select: { nombre: true } },
        cliente: { select: { nombre: true } },
        vendedor: { select: { nombreCompleto: true } },
      },
    });
    if (!c || !c.numero)
      throw new NotFoundException('Presupuesto no encontrado.');

    // Vencimiento lazy también por acá (el cliente puede abrir tarde).
    let estado = c.estado;
    if (estado === 'enviado' && c.fechaValidez && c.fechaValidez < new Date()) {
      estado = 'vencido';
      const vencida = await this.prisma.$transaction(async (tx) => {
        const cambio = await tx.cotizacion.updateMany({
          where: { id: c.id, estado: 'enviado' },
          data: { estado },
        });
        if (cambio.count === 1) {
          await this.cupones.liberarReservasPresupuesto(
            tx,
            c.tenantId,
            c.id,
            'Presupuesto vencido.',
          );
        }
        return cambio;
      });
      if (vencida.count === 1) {
        await this.eventoSistema(c.tenantId, c.id, {
          tipo: 'vencido',
          descripcion: 'El presupuesto venció (fecha de validez cumplida).',
        });
      }
    }

    if (!c.primeraVistaEl && estado === 'enviado') {
      const vista = await this.prisma.cotizacion.updateMany({
        where: { id: c.id, primeraVistaEl: null, estado: 'enviado' },
        data: { primeraVistaEl: new Date() },
      });
      if (vista.count === 1) {
        await this.eventoSistema(c.tenantId, c.id, {
          tipo: 'visto',
          descripcion: 'El cliente abrió el presupuesto por primera vez.',
          origen: 'cliente',
        });
      }
    }

    const emision = (c.emisionJson ?? { items: [] }) as unknown as EmisionJson;
    const regional = await this.empresa.regional(c.tenantId);
    return {
      numero: c.numero,
      estado,
      negocio: c.tenant.nombre,
      // El link es público y cruza fronteras: el front formatea los montos
      // con esta moneda (símbolo desambiguado), no con un "$" asumido.
      monedaCodigo: regional.moneda.codigo,
      cliente: c.cliente?.nombre ?? null,
      vendedor: c.vendedor?.nombreCompleto ?? null,
      fechaEmision: c.fechaEmision?.toISOString().slice(0, 10) ?? null,
      fechaValidez: c.fechaValidez
        ? claveFechaEnZona(c.fechaValidez, regional.zonaHoraria)
        : null,
      observaciones: c.observaciones,
      senaSugeridaPct:
        c.senaSugeridaPct != null ? Number(c.senaSugeridaPct) : null,
      subtotal: Number(c.subtotal ?? 0),
      impuestos: Number(c.impuestos ?? 0),
      cargosDirectos: emision.cargosDirectos ?? 0,
      total: Number(c.total ?? 0),
      descuentoTotal: this.descuentoTotalDe(emision),
      items: emision.items.map((i) => ({
        nombre: i.nombre,
        cantidad: i.cantidad,
        cantidadUnidad: i.cantidadUnidad,
        total: i.total,
        ...this.descuentoDeItem(i),
        specs: i.specs ?? [],
        adicionales: i.adicionales ?? [],
      })),
    };
  }

  async decisionPublica(token: string, dto: DecisionPublicaDto) {
    const enlace = await this.enlaces.resolver(
      token,
      TipoEnlacePublico.PRESUPUESTO,
    );
    if (!enlace) throw new NotFoundException('Presupuesto no encontrado.');
    const c = await this.prisma.cotizacion.findUnique({
      where: { id: enlace.entidadId },
      select: {
        id: true,
        tenantId: true,
        numero: true,
        estado: true,
        fechaValidez: true,
      },
    });
    if (!c || !c.numero)
      throw new NotFoundException('Presupuesto no encontrado.');
    if (c.estado !== 'enviado') {
      throw new BadRequestException(
        c.estado === 'vencido'
          ? 'El presupuesto está vencido: pedí una actualización.'
          : 'El presupuesto ya no admite esta acción.',
      );
    }
    if (c.fechaValidez && c.fechaValidez < new Date()) {
      await this.prisma.$transaction(async (tx) => {
        await tx.cotizacion.update({
          where: { id: c.id },
          data: { estado: 'vencido' },
        });
        await this.cupones.liberarReservasPresupuesto(
          tx,
          c.tenantId,
          c.id,
          'Presupuesto vencido.',
        );
      });
      throw new BadRequestException(
        'El presupuesto está vencido: pedí una actualización.',
      );
    }
    const resuelta = await this.prisma.$transaction(async (tx) => {
      const cambio = await tx.cotizacion.updateMany({
        where: {
          id: c.id,
          estado: 'enviado',
          ...(c.fechaValidez ? { fechaValidez: { gte: new Date() } } : {}),
        },
        data: {
          estado: dto.decision,
          fechaResuelto: new Date(),
          motivoPerdida: dto.decision === 'rechazado' ? 'otro' : null,
          motivoPerdidaDetalle:
            dto.decision === 'rechazado'
              ? (dto.comentario ?? 'Rechazado por el cliente desde el link.')
              : null,
        },
      });
      if (cambio.count === 1 && dto.decision === 'rechazado') {
        await this.cupones.liberarReservasPresupuesto(
          tx,
          c.tenantId,
          c.id,
          'Presupuesto rechazado por el cliente.',
        );
      }
      return cambio;
    });
    if (resuelta.count !== 1) {
      throw new BadRequestException(
        'El presupuesto ya fue resuelto o venció mientras se registraba la decisión.',
      );
    }
    // El timestamp de esta decisión ES la firma virtual del acuerdo.
    await this.eventoSistema(c.tenantId, c.id, {
      tipo: dto.decision,
      descripcion:
        dto.decision === 'aprobado'
          ? `El cliente APROBÓ el presupuesto desde el link público.${dto.comentario ? ` Comentario: ${dto.comentario}` : ''}`
          : `El cliente rechazó el presupuesto desde el link público.${dto.comentario ? ` Comentario: ${dto.comentario}` : ''}`,
      origen: 'cliente',
      datosJson: { comentario: dto.comentario ?? null },
    });
    this.avisarAlCliente(c.id);
    return { estado: dto.decision };
  }

  // ── Helpers ────────────────────────────────────────────────────────
  private async exigir(id: string, estados: PresupuestoEstado[]) {
    const c = await this.prisma.cotizacion.findFirst({
      where: { id, numero: { not: null } },
    });
    if (!c) throw new NotFoundException('El presupuesto no existe.');
    // Vencimiento lazy SIEMPRE antes de validar la transición: un enviado
    // con validez cumplida no se puede convertir ni reenviar sin recotizar.
    if (
      c.estado === 'enviado' &&
      c.fechaValidez &&
      c.fechaValidez < new Date()
    ) {
      const vencida = await this.prisma.$transaction(async (tx) => {
        const cambio = await tx.cotizacion.updateMany({
          where: { id, estado: 'enviado' },
          data: { estado: 'vencido' },
        });
        if (cambio.count === 1) {
          await this.cupones.liberarReservasPresupuesto(
            tx,
            c.tenantId,
            c.id,
            'Presupuesto vencido.',
          );
        }
        return cambio;
      });
      if (vencida.count === 1) {
        await this.eventoSistema(c.tenantId, c.id, {
          tipo: 'vencido',
          descripcion: 'El presupuesto venció (fecha de validez cumplida).',
        });
      }
      c.estado = 'vencido';
    }
    if (!estados.includes(c.estado as PresupuestoEstado)) {
      throw new BadRequestException(
        `La acción no aplica en estado "${c.estado}".`,
      );
    }
    return c;
  }

  /** Pasa a 'vencido' los enviados con validez cumplida (lazy, en lote). */
  private async vencerExpirados(tenantId: string, soloId?: string) {
    const vencidos = await this.prisma.cotizacion.findMany({
      where: {
        ...(soloId ? { id: soloId } : {}),
        numero: { not: null },
        estado: 'enviado',
        fechaValidez: { lt: new Date() },
      },
      select: { id: true },
    });
    if (vencidos.length === 0) return;
    for (const vencido of vencidos) {
      const actualizado = await this.prisma.$transaction(async (tx) => {
        const cambio = await tx.cotizacion.updateMany({
          where: { id: vencido.id, estado: 'enviado' },
          data: { estado: 'vencido' },
        });
        if (cambio.count === 1) {
          await this.cupones.liberarReservasPresupuesto(
            tx,
            tenantId,
            vencido.id,
            'Presupuesto vencido.',
          );
        }
        return cambio;
      });
      if (actualizado.count === 1) {
        await this.eventoSistema(tenantId, vencido.id, {
          tipo: 'vencido',
          descripcion: 'El presupuesto venció (fecha de validez cumplida).',
        });
      }
    }
  }

  private async evento(
    auth: CurrentAuth,
    cotizacionId: string,
    e: { tipo: string; descripcion: string; datosJson?: unknown },
  ) {
    await this.prisma.cotizacionEvento.create({
      data: {
        tenantId: auth.tenantId,
        cotizacionId,
        tipo: e.tipo,
        descripcion: e.descripcion,
        usuarioId: auth.userId,
        usuarioNombre: await this.nombreDe(auth),
        datosJson: (e.datosJson ?? undefined) as
          Prisma.InputJsonValue | undefined,
      },
    });
  }

  private async eventoSistema(
    tenantId: string,
    cotizacionId: string,
    e: {
      tipo: string;
      descripcion: string;
      origen?: string;
      datosJson?: unknown;
    },
  ) {
    await this.prisma.cotizacionEvento.create({
      data: {
        tenantId,
        cotizacionId,
        tipo: e.tipo,
        descripcion: e.descripcion,
        usuarioNombre: e.origen === 'cliente' ? 'Cliente' : 'Sistema',
        origen: e.origen ?? 'sistema',
        datosJson: (e.datosJson ?? undefined) as
          Prisma.InputJsonValue | undefined,
      },
    });
  }

  private nombreCache = new Map<string, string>();
  private async nombreDe(auth: CurrentAuth): Promise<string> {
    const cacheado = this.nombreCache.get(auth.userId);
    if (cacheado) return cacheado;
    const user = await this.prisma.user.findFirst({
      where: { id: auth.userId },
      select: { nombreCompleto: true, email: true },
    });
    const nombre = user?.nombreCompleto ?? user?.email ?? 'Usuario';
    this.nombreCache.set(auth.userId, nombre);
    return nombre;
  }
}
