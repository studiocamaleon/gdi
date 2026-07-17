import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import { paginatedResponse } from '../common/dto/pagination.dto';
import {
  ORDEN_TRABAJO_ESTADOS,
  ORDEN_TRABAJO_ESTADO_LABELS,
  progresoEfectivo,
  type OrdenTrabajoEstado,
  type OrdenTrabajoPasoAccion,
  type OrdenTrabajoPasoEstado,
} from './ordenes-trabajo.types';
import type {
  CambiarEstadoOrdenTrabajoDto,
  CrearOrdenTrabajoDto,
  CrearOrdenTrabajoItemDto,
  EditarOrdenTrabajoDto,
} from './dto/crear-orden-trabajo.dto';
import type { AccionPasoOrdenTrabajoDto } from './dto/accion-paso.dto';
import { FAMILIAS } from '../productos-servicios/pasos/familias';
import type { FamiliaCodigo } from '../productos-servicios/pasos/types';

/**
 * Token url-safe (~22 chars) para el link público de seguimiento del cliente.
 * base64url de 16 bytes aleatorios: sin colisiones prácticas, sin caracteres
 * que rompan una URL. Ver docs/tracking-publico-diseno.md
 */
function generarPublicToken(): string {
  return randomBytes(16).toString('base64url');
}

/** Primer nombre visible ("Carolina Méndez" → "Carolina"). */
function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || nombre;
}

/** Hasta 2 iniciales ("Gráfica Corporearte" → "GC"). */
function inicialesDe(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');
}

/** "2026-07-22" → "22/07/2026" (para descripciones humanas de eventos). */
function formatFechaCorta(iso: string | null): string {
  if (!iso) return '—';
  const [anio, mes, dia] = iso.split('-');
  if (!anio || !mes || !dia) return iso;
  return `${dia}/${mes}/${anio}`;
}
import type { OrdenesTrabajoQueryDto } from './dto/ordenes-trabajo-query.dto';

type OrdenConRelaciones = Prisma.OrdenTrabajoGetPayload<{
  include: {
    cliente: { select: { nombre: true } };
    vendedor: { select: { nombreCompleto: true } };
    _count: { select: { items: true } };
    items: true;
  };
}>;

const LIST_INCLUDE = {
  cliente: { select: { nombre: true } },
  vendedor: { select: { nombreCompleto: true } },
  _count: { select: { items: true } },
  items: {
    select: { nombre: true, ordenIndice: true },
    orderBy: { ordenIndice: 'asc' as const },
  },
};

/** Órdenes que viven en el Tablero: emitidas y todavía no terminadas. */
const ESTADOS_TABLERO: OrdenTrabajoEstado[] = ['pendiente', 'produccion'];

/**
 * Proyección mínima del PasoEjecutado del snapshot del cotizador
 * (`CotizacionItem.trazabilidadJson.pasos`) que necesita la materialización.
 * El JSON viene del motor universal (apps/api/src/motor-universal/tipos.ts).
 */
type PasoTrazabilidad = {
  rutaPasoId?: string;
  rutaPasoOrden?: number;
  familiaCodigo?: string;
  nombreVisible?: string | null;
  activado?: boolean;
  tiempo?: {
    totalMin?: number;
    centroCostoId?: string | null;
    centroCostoNombre?: string | null;
  };
};

function pasosActivados(trazabilidad: unknown): PasoTrazabilidad[] {
  const pasos = (trazabilidad as { pasos?: unknown } | null | undefined)
    ?.pasos;
  if (!Array.isArray(pasos)) return [];
  return (pasos as PasoTrazabilidad[]).filter((paso) => paso?.activado);
}

type ItemAMaterializar = {
  id: string;
  ordenId: string;
  cotizacionItemId: string | null;
};

/** Transiciones válidas de un paso de producción por acción del Tablero. */
export const TRANSICIONES_PASO: Record<
  AccionPasoOrdenTrabajoDto['accion'],
  { desde: OrdenTrabajoPasoEstado[]; verbo: string }
> = {
  iniciar: { desde: ['pendiente'], verbo: 'iniciado' },
  completar: { desde: ['pendiente', 'en_curso'], verbo: 'completado' },
  bloquear: { desde: ['pendiente', 'en_curso'], verbo: 'bloqueado' },
  desbloquear: { desde: ['bloqueado'], verbo: 'desbloqueado' },
  reabrir: { desde: ['hecho'], verbo: 'reabierto' },
};

type PasoSecuencia = { indice: number; estado: string };

/**
 * La ruta es una SECUENCIA: un paso está listo para ejecutarse (activo) sólo
 * si es el primero o todos los anteriores ya están hechos. Iniciar,
 * completar o bloquear fuera de la frontera rompería el orden de la ruta.
 */
export function pasoEjecutable(
  pasos: PasoSecuencia[],
  indice: number,
): boolean {
  return pasos
    .filter((paso) => paso.indice < indice)
    .every((paso) => paso.estado === 'hecho');
}

/**
 * Deshacer un paso hecho sólo vale en la frontera hacia atrás: si un paso
 * posterior ya arrancó (o también está hecho/bloqueado), reabrir éste
 * dejaría la secuencia inconsistente.
 */
export function pasoReabrible(
  pasos: PasoSecuencia[],
  indice: number,
): boolean {
  return pasos
    .filter((paso) => paso.indice > indice)
    .every((paso) => paso.estado === 'pendiente');
}

/**
 * Una OT se finaliza sola cuando se completa su último paso pendiente: el
 * total de pasos ya está hecho tras un `completar`. Sólo aplica a esa acción
 * (bloquear/reabrir/desbloquear/iniciar nunca dejan todo hecho).
 */
export function ordenSeFinaliza(
  accion: OrdenTrabajoPasoAccion,
  total: number,
  hechos: number,
): boolean {
  return accion === 'completar' && total > 0 && hechos === total;
}

@Injectable()
export class OrdenesTrabajoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Listado ──────────────────────────────────────────────────────────

  async findAll(auth: CurrentAuth, query: OrdenesTrabajoQueryDto) {
    const q = query.q?.trim();
    const where: Prisma.OrdenTrabajoWhereInput = {
      tenantId: auth.tenantId,
      ...(query.estado ? { estado: query.estado } : {}),
      ...(q
        ? {
            OR: [
              { numero: { contains: q, mode: 'insensitive' } },
              { cliente: { nombre: { contains: q, mode: 'insensitive' } } },
              {
                vendedor: {
                  nombreCompleto: { contains: q, mode: 'insensitive' },
                },
              },
              {
                items: {
                  some: { nombre: { contains: q, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };

    // Los KPIs y los contadores de los chips son del TENANT COMPLETO, no de
    // la página cargada: si se calcularan sobre las filas devueltas (como
    // hacía el front), con más órdenes que el límite empezarían a mentir.
    // Van en la misma transacción: un solo round-trip, snapshot consistente.
    const hoy0 = new Date();
    hoy0.setHours(0, 0, 0, 0);
    const manana0 = new Date(hoy0);
    manana0.setDate(manana0.getDate() + 1);
    const en8dias = new Date(hoy0);
    en8dias.setDate(en8dias.getDate() + 8);

    const [ordenes, total, porEstado, proximasEntregar, emitidasHoy] =
      await this.prisma.$transaction([
        this.prisma.ordenTrabajo.findMany({
          where,
          include: LIST_INCLUDE,
          orderBy: { createdAt: 'desc' },
          skip: query.skip,
          take: query.limit,
        }),
        this.prisma.ordenTrabajo.count({ where }),
        this.prisma.ordenTrabajo.groupBy({
          by: ['estado'],
          where: { tenantId: auth.tenantId },
          orderBy: { estado: 'asc' },
          _count: { _all: true },
          _sum: { total: true },
        }),
        // "Próximas a entregar": activas que vencen dentro de los 7 días.
        this.prisma.ordenTrabajo.count({
          where: {
            tenantId: auth.tenantId,
            estado: { in: ['pendiente', 'produccion'] },
            fechaEntrega: { gte: hoy0, lt: en8dias },
          },
        }),
        // "Emitidas hoy": todo lo que no es borrador creado en el día.
        this.prisma.ordenTrabajo.count({
          where: {
            tenantId: auth.tenantId,
            estado: { not: 'borrador' },
            createdAt: { gte: hoy0, lt: manana0 },
          },
        }),
      ]);

    const counts: Record<OrdenTrabajoEstado, number> = {
      borrador: 0,
      pendiente: 0,
      produccion: 0,
      finalizada: 0,
      entregada: 0,
    };
    // "Valor en curso": suma de todo lo que no está entregado ni en borrador.
    let valorEnCurso = 0;
    for (const grupo of porEstado as Array<{
      estado: string;
      _count: { _all: number };
      _sum: { total: Prisma.Decimal | null };
    }>) {
      const estado = grupo.estado as OrdenTrabajoEstado;
      counts[estado] = grupo._count._all;
      if (estado !== 'entregada' && estado !== 'borrador') {
        valorEnCurso += Number(grupo._sum.total ?? 0);
      }
    }

    return {
      ...paginatedResponse(
        ordenes.map((orden) => this.toListItem(orden)),
        total,
        query,
      ),
      stats: {
        porEstado: counts,
        totalOrdenes: Object.values(counts).reduce((a, b) => a + b, 0),
        activas: counts.pendiente + counts.produccion,
        valorEnCurso,
        proximasEntregar,
        emitidasHoy,
      },
    };
  }

  // ── Detalle ──────────────────────────────────────────────────────────

  async findOne(auth: CurrentAuth, id: string) {
    const orden = await this.prisma.ordenTrabajo.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        ...LIST_INCLUDE,
        items: {
          orderBy: { ordenIndice: 'asc' as const },
          include: {
            // Payload de rehidratación: la vista de la OT emitida es la misma
            // ficha de creación, reconstruida desde el snapshot del cotizador.
            cotizacionItem: {
              select: {
                productoId: true,
                rutaAlternativaId: true,
                jobContextJson: true,
                snapshotJson: true,
                trazabilidadJson: true,
                costoUnitario: true,
                costoTotal: true,
                precioUnitario: true,
                precioTotal: true,
                precioConfigSnapshotJson: true,
                impuestosSnapshotJson: true,
                comisionesSnapshotJson: true,
                precioEspecialClienteSnapshotJson: true,
              },
            },
          },
        },
        // Sólo lo que se serializa (datosJson pesa y no viaja al front) y
        // con tope: el historial crece con cada edición y no puede volver
        // ilimitado el detalle de una orden vieja.
        eventos: {
          orderBy: { fecha: 'desc' as const },
          take: 200,
          select: {
            fecha: true,
            tipo: true,
            descripcion: true,
            usuarioNombre: true,
          },
        },
      },
    });
    if (!orden) {
      throw new NotFoundException('No se encontró la orden de trabajo.');
    }
    // Backfill perezoso del link público: OTs emitidas antes de existir el
    // token no tienen uno; se genera la primera vez que se abre el detalle
    // para que "Compartir seguimiento" siempre tenga link.
    let publicToken = orden.publicToken;
    if (!publicToken && orden.estado !== 'borrador') {
      publicToken = generarPublicToken();
      await this.prisma.ordenTrabajo.update({
        where: { id: orden.id },
        data: { publicToken },
      });
    }
    return this.toDetalle({ ...orden, publicToken });
  }

  // ── Crear ────────────────────────────────────────────────────────────

  async create(auth: CurrentAuth, payload: CrearOrdenTrabajoDto) {
    const estadoInicial: OrdenTrabajoEstado = payload.estado ?? 'borrador';
    const emitida = estadoInicial === 'pendiente';
    this.validarEmision(estadoInicial, payload.clienteId ?? null);
    this.validarFechaEntregaEmision(
      estadoInicial,
      payload.fechaEntrega ?? null,
    );
    this.validarMontosItems(payload.items);

    // Dos items de la orden no pueden apuntar al mismo snapshot del cotizador.
    const idsSnapshot = payload.items
      .map((item) => item.cotizacionItemId)
      .filter((v): v is string => Boolean(v));
    if (new Set(idsSnapshot).size !== idsSnapshot.length) {
      throw new BadRequestException(
        'Hay items duplicados: dos productos referencian la misma cotización.',
      );
    }

    // Validaciones de integridad referencial dentro del tenant. El emisor
    // (empleado vinculado al usuario autenticado) es el vendedor por defecto
    // cuando el payload no manda uno explícito.
    const [cliente, vendedor, emisor] = await Promise.all([
      payload.clienteId
        ? this.prisma.cliente.findFirst({
            where: { id: payload.clienteId, tenantId: auth.tenantId },
            select: { id: true, nombre: true },
          })
        : null,
      payload.vendedorEmpleadoId
        ? this.prisma.empleado.findFirst({
            where: { id: payload.vendedorEmpleadoId, tenantId: auth.tenantId },
            select: { id: true, nombreCompleto: true },
          })
        : null,
      this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { id: true, nombreCompleto: true },
      }),
    ]);
    if (payload.clienteId && !cliente) {
      throw new NotFoundException('No se encontró el cliente.');
    }
    if (payload.vendedorEmpleadoId && !vendedor) {
      throw new NotFoundException('No se encontró el vendedor.');
    }
    if (payload.cotizacionId) {
      const cot = await this.prisma.cotizacion.findFirst({
        where: { id: payload.cotizacionId, tenantId: auth.tenantId },
        select: { id: true },
      });
      if (!cot) throw new NotFoundException('No se encontró la cotización.');
    }
    const cotizacionItemIds = payload.items
      .map((item) => item.cotizacionItemId)
      .filter((v): v is string => Boolean(v));
    if (cotizacionItemIds.length > 0) {
      const encontrados = await this.prisma.cotizacionItem.count({
        where: { id: { in: cotizacionItemIds }, tenantId: auth.tenantId },
      });
      if (encontrados !== new Set(cotizacionItemIds).size) {
        throw new NotFoundException(
          'Algún item de cotización referenciado no existe.',
        );
      }
    }

    const subtotal = payload.items.reduce((s, i) => s + i.subtotal, 0);
    const impuestos = payload.items.reduce((s, i) => s + i.impuestos, 0);
    const cargosDirectos = payload.cargosDirectos ?? 0;
    const total = subtotal + impuestos + cargosDirectos;
    const vendedorEmpleadoId = payload.vendedorEmpleadoId ?? emisor?.id ?? null;
    const usuarioNombre =
      vendedor?.nombreCompleto ?? emisor?.nombreCompleto ?? auth.email;
    const ahora = new Date();

    const creada = await this.prisma.$transaction(async (tx) => {
      const anio = ahora.getFullYear();
      const contador = await tx.ordenTrabajoContador.upsert({
        where: { tenantId_anio: { tenantId: auth.tenantId, anio } },
        create: { tenantId: auth.tenantId, anio, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      });
      const numero = `OT-${anio}-${String(contador.ultimo).padStart(4, '0')}`;

      const orden = await tx.ordenTrabajo.create({
        data: {
          tenantId: auth.tenantId,
          numero,
          clienteId: payload.clienteId ?? null,
          vendedorEmpleadoId,
          cotizacionId: payload.cotizacionId ?? null,
          estado: estadoInicial,
          fechaEmision: emitida ? ahora : null,
          // Emitida al taller → link público de seguimiento del cliente.
          publicToken: emitida ? generarPublicToken() : null,
          fechaEntrega: payload.fechaEntrega
            ? new Date(payload.fechaEntrega)
            : null,
          canalVenta: payload.canalVenta ?? null,
          observaciones: payload.observaciones ?? null,
          subtotal,
          impuestos,
          cargosDirectos,
          total,
          items: {
            create: payload.items.map((item, indice) => ({
              tenantId: auth.tenantId,
              cotizacionItemId: item.cotizacionItemId ?? null,
              codigo: item.codigo,
              nombre: item.nombre,
              familia: item.familia,
              categoriaComercial: item.categoriaComercial ?? '',
              subcategoriaComercial: item.subcategoriaComercial ?? '',
              cantidad: item.cantidad,
              cantidadUnidad: item.cantidadUnidad,
              subtotal: item.subtotal,
              impuestos: item.impuestos,
              total: item.total,
              // Serializado a objetos planos: los DTOs (clases) no matchean
              // InputJsonValue de Prisma.
              specsJson: (item.specs ?? []).map((spec) => ({
                etiqueta: spec.etiqueta,
                valor: spec.valor,
              })),
              adicionalesJson: item.adicionales ?? [],
              ordenIndice: indice,
            })),
          },
        },
      });

      // Emitir al taller materializa los pasos de producción del Tablero
      // desde la trazabilidad del snapshot (el borrador espera a emitirse).
      if (emitida) {
        const itemsCreados = await tx.ordenTrabajoItem.findMany({
          where: { ordenId: orden.id },
          select: { id: true, ordenId: true, cotizacionItemId: true },
        });
        await this.materializarPasosItems(tx, auth.tenantId, itemsCreados);
      }

      // Timeline: se insertan en orden cronológico (productos → borrador →
      // número → emisión) con timestamps levemente separados para que el
      // orden por fecha sea estable.
      const eventos: Array<{ tipo: string; descripcion: string }> = [
        {
          tipo: 'productos',
          descripcion: `${payload.items.length} producto${
            payload.items.length === 1 ? '' : 's'
          } agregado${payload.items.length === 1 ? '' : 's'} a la orden`,
        },
        { tipo: 'borrador', descripcion: 'Borrador guardado' },
        { tipo: 'numero_asignado', descripcion: `Nº asignado ${numero}` },
        ...(emitida
          ? [{ tipo: 'emision', descripcion: 'OT emitida al taller' }]
          : []),
      ];
      await tx.ordenTrabajoEvento.createMany({
        data: eventos.map((evento, i) => {
          const esSistema = evento.tipo === 'numero_asignado';
          return {
            tenantId: auth.tenantId,
            ordenId: orden.id,
            fecha: new Date(ahora.getTime() - (eventos.length - 1 - i) * 1000),
            tipo: evento.tipo,
            descripcion: evento.descripcion,
            usuarioNombre: esSistema ? 'Sistema' : usuarioNombre,
            usuarioId: esSistema ? null : auth.userId,
            origen: esSistema ? 'sistema' : 'usuario',
          };
        }),
      });

      return orden;
    });

    return this.findOne(auth, creada.id);
  }

  // ── Edición de datos comerciales ─────────────────────────────────────

  /**
   * Qué campos admiten edición según el estado. Regla acordada 2026-07-16:
   * borrador/pendiente = datos comerciales completos; produccion = sólo
   * fecha y observaciones (el taller ya arrancó); finalizada/entregada =
   * nada (sólo lectura; notas y pagos van por sus propios flujos).
   */
  camposEditables(estado: OrdenTrabajoEstado): ReadonlySet<string> {
    switch (estado) {
      case 'borrador':
      case 'pendiente':
        return new Set([
          'clienteId',
          'vendedorEmpleadoId',
          'canalVenta',
          'fechaEntrega',
          'observaciones',
        ]);
      case 'produccion':
        return new Set(['fechaEntrega', 'observaciones']);
      case 'finalizada':
      case 'entregada':
        return new Set();
    }
  }

  async editar(auth: CurrentAuth, id: string, payload: EditarOrdenTrabajoDto) {
    const [orden, actor] = await Promise.all([
      this.prisma.ordenTrabajo.findFirst({
        where: { id, tenantId: auth.tenantId },
        include: {
          cliente: { select: { nombre: true } },
          vendedor: { select: { nombreCompleto: true } },
        },
      }),
      this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { nombreCompleto: true },
      }),
    ]);
    if (!orden) {
      throw new NotFoundException('No se encontró la orden de trabajo.');
    }

    const estado = orden.estado as OrdenTrabajoEstado;
    const editables = this.camposEditables(estado);
    const enviados = (
      [
        'clienteId',
        'vendedorEmpleadoId',
        'canalVenta',
        'fechaEntrega',
        'observaciones',
      ] as const
    ).filter((campo) => payload[campo] !== undefined);
    if (enviados.length === 0) return this.findOne(auth, orden.id);
    const bloqueados = enviados.filter((campo) => !editables.has(campo));
    if (bloqueados.length > 0) {
      throw new BadRequestException(
        `Con la orden en estado "${ORDEN_TRABAJO_ESTADO_LABELS[estado]}" no se puede editar: ${bloqueados.join(', ')}.`,
      );
    }

    // Integridad referencial + reglas de negocio de los campos enviados.
    const [clienteNuevo, vendedorNuevo] = await Promise.all([
      payload.clienteId
        ? this.prisma.cliente.findFirst({
            where: { id: payload.clienteId, tenantId: auth.tenantId },
            select: { id: true, nombre: true },
          })
        : null,
      payload.vendedorEmpleadoId
        ? this.prisma.empleado.findFirst({
            where: { id: payload.vendedorEmpleadoId, tenantId: auth.tenantId },
            select: { id: true, nombreCompleto: true },
          })
        : null,
    ]);
    if (payload.clienteId && !clienteNuevo) {
      throw new NotFoundException('No se encontró el cliente.');
    }
    if (payload.vendedorEmpleadoId && !vendedorNuevo) {
      throw new NotFoundException('No se encontró el vendedor.');
    }
    if (payload.fechaEntrega !== undefined) {
      this.validarFechaEntregaEmision(estado, payload.fechaEntrega);
    }

    // Diff campo por campo: sólo lo que realmente cambia genera update+evento.
    const fechaActualIso = orden.fechaEntrega
      ? orden.fechaEntrega.toISOString().slice(0, 10)
      : null;
    const ordenCanal = (orden as { canalVenta?: string | null }).canalVenta;
    const cambios: Array<{
      campo: string;
      antes: string | null;
      despues: string | null;
      descripcion: string;
      data: Prisma.OrdenTrabajoUpdateInput;
    }> = [];
    if (payload.clienteId && payload.clienteId !== orden.clienteId) {
      cambios.push({
        campo: 'clienteId',
        antes: orden.clienteId,
        despues: payload.clienteId,
        descripcion: `Cliente: ${orden.cliente?.nombre ?? 'Sin cliente'} → ${clienteNuevo!.nombre}`,
        data: { cliente: { connect: { id: payload.clienteId } } },
      });
    }
    if (
      payload.vendedorEmpleadoId &&
      payload.vendedorEmpleadoId !== orden.vendedorEmpleadoId
    ) {
      cambios.push({
        campo: 'vendedorEmpleadoId',
        antes: orden.vendedorEmpleadoId,
        despues: payload.vendedorEmpleadoId,
        descripcion: `Vendedor: ${orden.vendedor?.nombreCompleto ?? '—'} → ${vendedorNuevo!.nombreCompleto}`,
        data: { vendedor: { connect: { id: payload.vendedorEmpleadoId } } },
      });
    }
    if (payload.canalVenta && payload.canalVenta !== ordenCanal) {
      cambios.push({
        campo: 'canalVenta',
        antes: ordenCanal ?? null,
        despues: payload.canalVenta,
        descripcion: `Canal de venta: ${ordenCanal ?? '—'} → ${payload.canalVenta}`,
        data: { canalVenta: payload.canalVenta } as never,
      });
    }
    if (
      payload.fechaEntrega !== undefined &&
      payload.fechaEntrega !== fechaActualIso
    ) {
      cambios.push({
        campo: 'fechaEntrega',
        antes: fechaActualIso,
        despues: payload.fechaEntrega,
        descripcion: `Fecha de entrega: ${formatFechaCorta(fechaActualIso)} → ${formatFechaCorta(payload.fechaEntrega)}`,
        data: { fechaEntrega: new Date(payload.fechaEntrega) },
      });
    }
    if (
      payload.observaciones !== undefined &&
      payload.observaciones !== (orden.observaciones ?? '')
    ) {
      cambios.push({
        campo: 'observaciones',
        antes: orden.observaciones,
        despues: payload.observaciones,
        descripcion: 'Observaciones actualizadas',
        data: { observaciones: payload.observaciones },
      });
    }

    if (cambios.length === 0) return this.findOne(auth, orden.id);

    const usuarioNombre = actor?.nombreCompleto ?? auth.email;
    const ahora = new Date();
    await this.prisma.$transaction([
      this.prisma.ordenTrabajo.update({
        where: { id: orden.id },
        data: cambios.reduce(
          (acc, cambio) => ({ ...acc, ...cambio.data }),
          {} as Prisma.OrdenTrabajoUpdateInput,
        ),
      }),
      this.prisma.ordenTrabajoEvento.createMany({
        data: cambios.map((cambio, i) => ({
          tenantId: auth.tenantId,
          ordenId: orden.id,
          fecha: new Date(ahora.getTime() + i),
          tipo: 'modificacion',
          descripcion: cambio.descripcion,
          usuarioNombre,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            campo: cambio.campo,
            antes: cambio.antes,
            despues: cambio.despues,
          },
        })),
      }),
    ]);

    return this.findOne(auth, orden.id);
  }

  // ── Edición de items ─────────────────────────────────────────────────

  /**
   * Los items sólo se tocan mientras el taller no arrancó (regla acordada
   * 2026-07-16): borrador y pendiente. En produccion+ el contenido queda
   * congelado — cambios de alcance ahí son otra conversación de negocio.
   */
  puedeEditarItems(estado: OrdenTrabajoEstado): boolean {
    return estado === 'borrador' || estado === 'pendiente';
  }

  private async cargarOrdenParaItems(auth: CurrentAuth, ordenId: string) {
    const [orden, actor] = await Promise.all([
      this.prisma.ordenTrabajo.findFirst({
        where: { id: ordenId, tenantId: auth.tenantId },
        select: {
          id: true,
          estado: true,
          cargosDirectos: true,
          _count: { select: { items: true } },
        },
      }),
      this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { nombreCompleto: true },
      }),
    ]);
    if (!orden) {
      throw new NotFoundException('No se encontró la orden de trabajo.');
    }
    const estado = orden.estado as OrdenTrabajoEstado;
    if (!this.puedeEditarItems(estado)) {
      throw new BadRequestException(
        `Con la orden en estado "${ORDEN_TRABAJO_ESTADO_LABELS[estado]}" no se pueden modificar los productos.`,
      );
    }
    return { orden, usuarioNombre: actor?.nombreCompleto ?? auth.email };
  }

  /** Recalcula los denormalizados de la orden a partir de sus items. */
  private async recalcularTotales(
    tx: Prisma.TransactionClient,
    ordenId: string,
    cargosDirectos: number,
  ) {
    const agregado = await tx.ordenTrabajoItem.aggregate({
      where: { ordenId },
      _sum: { subtotal: true, impuestos: true },
    });
    const subtotal = Number(agregado._sum.subtotal ?? 0);
    const impuestos = Number(agregado._sum.impuestos ?? 0);
    await tx.ordenTrabajo.update({
      where: { id: ordenId },
      data: {
        subtotal,
        impuestos,
        total: subtotal + impuestos + cargosDirectos,
      },
    });
  }

  private buildItemData(item: CrearOrdenTrabajoItemDto) {
    return {
      cotizacionItemId: item.cotizacionItemId ?? null,
      codigo: item.codigo,
      nombre: item.nombre,
      familia: item.familia,
      categoriaComercial: item.categoriaComercial ?? '',
      subcategoriaComercial: item.subcategoriaComercial ?? '',
      cantidad: item.cantidad,
      cantidadUnidad: item.cantidadUnidad,
      subtotal: item.subtotal,
      impuestos: item.impuestos,
      total: item.total,
      specsJson: (item.specs ?? []).map((spec) => ({
        etiqueta: spec.etiqueta,
        valor: spec.valor,
      })),
      adicionalesJson: item.adicionales ?? [],
    };
  }

  private async validarSnapshotDisponible(
    auth: CurrentAuth,
    ordenId: string,
    cotizacionItemId: string | undefined,
    exceptoItemId?: string,
  ) {
    if (!cotizacionItemId) return;
    const existe = await this.prisma.cotizacionItem.count({
      where: { id: cotizacionItemId, tenantId: auth.tenantId },
    });
    if (!existe) {
      throw new NotFoundException(
        'El item de cotización referenciado no existe.',
      );
    }
    const usado = await this.prisma.ordenTrabajoItem.count({
      where: {
        tenantId: auth.tenantId,
        ordenId,
        cotizacionItemId,
        ...(exceptoItemId ? { id: { not: exceptoItemId } } : {}),
      },
    });
    if (usado > 0) {
      throw new BadRequestException(
        'Otro producto de la orden ya referencia esa cotización.',
      );
    }
  }

  async agregarItem(
    auth: CurrentAuth,
    ordenId: string,
    payload: CrearOrdenTrabajoItemDto,
  ) {
    const { orden, usuarioNombre } = await this.cargarOrdenParaItems(
      auth,
      ordenId,
    );
    this.validarMontosItems([payload]);
    await this.validarSnapshotDisponible(
      auth,
      orden.id,
      payload.cotizacionItemId,
    );

    const ultimo = await this.prisma.ordenTrabajoItem.aggregate({
      where: { ordenId: orden.id },
      _max: { ordenIndice: true },
    });
    await this.prisma.$transaction(async (tx) => {
      const creado = await tx.ordenTrabajoItem.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          ...this.buildItemData(payload),
          ordenIndice: (ultimo._max.ordenIndice ?? -1) + 1,
        },
      });
      // La orden ya está emitida: el item nuevo entra al Tablero con pasos.
      if (orden.estado === 'pendiente') {
        await this.materializarPasosItems(tx, auth.tenantId, [
          {
            id: creado.id,
            ordenId: orden.id,
            cotizacionItemId: creado.cotizacionItemId,
          },
        ]);
      }
      await this.recalcularTotales(
        tx,
        orden.id,
        Number(orden.cargosDirectos ?? 0),
      );
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          tipo: 'item_agregado',
          descripcion: `Producto agregado: "${payload.nombre}" · ${payload.cantidad} ${payload.cantidadUnidad} · $${Math.round(payload.total).toLocaleString('es-AR')}`,
          usuarioNombre,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            itemId: creado.id,
            codigo: payload.codigo,
            nombre: payload.nombre,
            cantidad: payload.cantidad,
            total: payload.total,
          },
        },
      });
    });
    return this.findOne(auth, orden.id);
  }

  async editarItem(
    auth: CurrentAuth,
    ordenId: string,
    itemId: string,
    payload: CrearOrdenTrabajoItemDto,
  ) {
    const { orden, usuarioNombre } = await this.cargarOrdenParaItems(
      auth,
      ordenId,
    );
    const existente = await this.prisma.ordenTrabajoItem.findFirst({
      where: { id: itemId, tenantId: auth.tenantId, ordenId: orden.id },
    });
    if (!existente) {
      throw new NotFoundException('No se encontró el producto en la orden.');
    }
    this.validarMontosItems([payload]);
    await this.validarSnapshotDisponible(
      auth,
      orden.id,
      payload.cotizacionItemId,
      existente.id,
    );

    const antes = {
      cantidad: Number(existente.cantidad),
      subtotal: Number(existente.subtotal),
      impuestos: Number(existente.impuestos),
      total: Number(existente.total),
      specs: existente.specsJson,
      adicionales: existente.adicionalesJson,
    };
    const partes: string[] = [];
    if (antes.cantidad !== payload.cantidad) {
      partes.push(
        `cantidad ${antes.cantidad} → ${payload.cantidad} ${payload.cantidadUnidad}`,
      );
    }
    if (antes.total !== payload.total) {
      partes.push(
        `total $${Math.round(antes.total).toLocaleString('es-AR')} → $${Math.round(payload.total).toLocaleString('es-AR')}`,
      );
    }
    if (partes.length === 0) partes.push('especificaciones actualizadas');

    await this.prisma.$transaction(async (tx) => {
      await tx.ordenTrabajoItem.update({
        where: { id: existente.id },
        data: this.buildItemData(payload),
      });
      // Emitida: el item pudo cambiar de snapshot/ruta → pasos de nuevo.
      // No hay ejecución que pisar: ejecutar promueve a `produccion`, y ahí
      // los items quedan congelados.
      if (orden.estado === 'pendiente') {
        await this.materializarPasosItems(
          tx,
          auth.tenantId,
          [
            {
              id: existente.id,
              ordenId: orden.id,
              cotizacionItemId: payload.cotizacionItemId ?? null,
            },
          ],
          { reemplazar: true },
        );
      }
      await this.recalcularTotales(
        tx,
        orden.id,
        Number(orden.cargosDirectos ?? 0),
      );
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          tipo: 'item_modificado',
          descripcion: `Producto modificado: "${payload.nombre}" — ${partes.join(' · ')}`,
          usuarioNombre,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            itemId: existente.id,
            antes,
            despues: {
              cantidad: payload.cantidad,
              subtotal: payload.subtotal,
              impuestos: payload.impuestos,
              total: payload.total,
              // Objetos planos: los DTOs (clases) no matchean InputJsonValue.
              specs: (payload.specs ?? []).map((spec) => ({
                etiqueta: spec.etiqueta,
                valor: spec.valor,
              })),
              adicionales: payload.adicionales ?? [],
            },
          },
        },
      });
    });
    return this.findOne(auth, orden.id);
  }

  async quitarItem(auth: CurrentAuth, ordenId: string, itemId: string) {
    const { orden, usuarioNombre } = await this.cargarOrdenParaItems(
      auth,
      ordenId,
    );
    const existente = await this.prisma.ordenTrabajoItem.findFirst({
      where: { id: itemId, tenantId: auth.tenantId, ordenId: orden.id },
    });
    if (!existente) {
      throw new NotFoundException('No se encontró el producto en la orden.');
    }
    if (orden._count.items <= 1) {
      throw new BadRequestException(
        'La orden no puede quedar sin productos. Agregá otro antes de quitar este, o anulá la orden.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ordenTrabajoItem.delete({ where: { id: existente.id } });
      await this.recalcularTotales(
        tx,
        orden.id,
        Number(orden.cargosDirectos ?? 0),
      );
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          tipo: 'item_quitado',
          descripcion: `Producto quitado: "${existente.nombre}" · $${Math.round(Number(existente.total)).toLocaleString('es-AR')}`,
          usuarioNombre,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            itemId: existente.id,
            codigo: existente.codigo,
            nombre: existente.nombre,
            cantidad: Number(existente.cantidad),
            total: Number(existente.total),
            cotizacionItemId: existente.cotizacionItemId,
          },
        },
      });
    });
    return this.findOne(auth, orden.id);
  }

  // ── Transición de estado ─────────────────────────────────────────────

  async cambiarEstado(
    auth: CurrentAuth,
    id: string,
    payload: CambiarEstadoOrdenTrabajoDto,
  ) {
    const [orden, actor] = await Promise.all([
      this.prisma.ordenTrabajo.findFirst({
        where: { id, tenantId: auth.tenantId },
        include: { vendedor: { select: { nombreCompleto: true } } },
      }),
      this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { nombreCompleto: true },
      }),
    ]);
    if (!orden) {
      throw new NotFoundException('No se encontró la orden de trabajo.');
    }

    const desde = orden.estado as OrdenTrabajoEstado;
    const hacia = payload.estado as OrdenTrabajoEstado;
    this.validarTransicion(desde, hacia);
    // Salir de borrador (a cualquier estado) es emitir: exige cliente y
    // fecha de entrega vigente, igual que la emisión directa.
    if (desde === 'borrador') {
      this.validarEmision(hacia, orden.clienteId);
      this.validarFechaEntregaEmision(
        hacia,
        orden.fechaEntrega
          ? orden.fechaEntrega.toISOString().slice(0, 10)
          : null,
      );
    }

    const progresoPct =
      payload.progresoPct !== undefined
        ? Math.min(100, payload.progresoPct)
        : hacia === 'finalizada' || hacia === 'entregada'
          ? 100
          : orden.progresoPct;

    await this.prisma.$transaction(async (tx) => {
      await tx.ordenTrabajo.update({
        where: { id: orden.id },
        data: {
          estado: hacia,
          progresoPct,
          // Cualquier salida de borrador marca la emisión si faltaba.
          fechaEmision:
            desde === 'borrador' && !orden.fechaEmision
              ? new Date()
              : undefined,
          // Salir de borrador es emitir → link público de seguimiento.
          publicToken:
            desde === 'borrador' && !orden.publicToken
              ? generarPublicToken()
              : undefined,
        },
      });
      // Salir de borrador es emitir: se materializan los pasos de
      // producción del Tablero desde la trazabilidad del snapshot.
      if (desde === 'borrador') {
        const items = await tx.ordenTrabajoItem.findMany({
          where: { ordenId: orden.id },
          select: { id: true, ordenId: true, cotizacionItemId: true },
        });
        await this.materializarPasosItems(tx, auth.tenantId, items);
      }
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId: orden.id,
          tipo: hacia === 'pendiente' ? 'emision' : 'estado',
          descripcion:
            hacia === 'pendiente'
              ? 'OT emitida al taller'
              : `Estado: ${ORDEN_TRABAJO_ESTADO_LABELS[desde]} → ${ORDEN_TRABAJO_ESTADO_LABELS[hacia]}`,
          // El evento registra a QUIEN ejecutó el cambio, no al vendedor.
          usuarioNombre: actor?.nombreCompleto ?? auth.email,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            campo: 'estado',
            antes: desde,
            despues: hacia,
            ...(payload.progresoPct !== undefined
              ? { progresoPct: payload.progresoPct }
              : {}),
          },
        },
      });
    });

    return this.findOne(auth, orden.id);
  }

  /**
   * Emitir al taller (o cualquier salida de borrador) exige cliente asignado;
   * el borrador puede no tenerlo todavía (se completa antes de emitir).
   */
  validarEmision(estado: OrdenTrabajoEstado, clienteId: string | null) {
    if (estado !== 'borrador' && !clienteId) {
      throw new BadRequestException(
        'Para emitir la orden al taller tenés que asignar un cliente.',
      );
    }
  }

  /**
   * Emitir exige fecha de entrega comprometida y que no sea pasada. El
   * borrador puede no tenerla todavía.
   */
  validarFechaEntregaEmision(
    estado: OrdenTrabajoEstado,
    fechaEntrega: string | null,
  ) {
    if (estado === 'borrador') return;
    if (!fechaEntrega) {
      throw new BadRequestException(
        'Para emitir la orden definí la fecha de entrega comprometida.',
      );
    }
    const [datePart] = fechaEntrega.split('T');
    const [anio, mes, dia] = datePart.split('-').map(Number);
    const entrega = new Date(anio, (mes ?? 1) - 1, dia ?? 1);
    const ahora = new Date();
    const hoy = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
    );
    if (Number.isNaN(entrega.getTime()) || entrega < hoy) {
      throw new BadRequestException(
        'La fecha de entrega no puede ser anterior a hoy.',
      );
    }
  }

  /**
   * Coherencia de montos por item: total = subtotal + impuestos, con
   * tolerancia de $1 por redondeos de la capa comercial.
   */
  validarMontosItems(
    items: Array<{
      nombre: string;
      subtotal: number;
      impuestos: number;
      total: number;
    }>,
  ) {
    for (const item of items) {
      const esperado = item.subtotal + item.impuestos;
      if (Math.abs(item.total - esperado) > 1) {
        throw new BadRequestException(
          `Los montos de "${item.nombre}" no cierran: total ${item.total} ≠ subtotal + impuestos (${esperado.toFixed(2)}).`,
        );
      }
    }
  }

  /** Sólo transiciones hacia adelante en el flujo (sin saltos hacia atrás). */
  validarTransicion(desde: OrdenTrabajoEstado, hacia: OrdenTrabajoEstado) {
    const desdeIdx = ORDEN_TRABAJO_ESTADOS.indexOf(desde);
    const haciaIdx = ORDEN_TRABAJO_ESTADOS.indexOf(hacia);
    if (desdeIdx < 0 || haciaIdx < 0) {
      throw new BadRequestException('Estado de orden inválido.');
    }
    if (haciaIdx <= desdeIdx) {
      throw new BadRequestException(
        `Transición inválida: ${ORDEN_TRABAJO_ESTADO_LABELS[desde]} → ${ORDEN_TRABAJO_ESTADO_LABELS[hacia]}. El flujo sólo avanza.`,
      );
    }
  }

  // ── Tablero de producción ────────────────────────────────────────────
  // Los pasos de producción (OrdenTrabajoItemPaso) se materializan desde el
  // snapshot del cotizador al emitir la orden; acá vive su ejecución.
  // Ver docs/tablero-produccion-conexion-diseno.md

  /** Filas de pasos a crear para un item, desde su trazabilidad. */
  private pasosDesdeTrazabilidad(
    tenantId: string,
    ordenId: string,
    itemId: string,
    trazabilidad: unknown,
  ) {
    return pasosActivados(trazabilidad).map((paso, indice) => {
      const familiaCodigo = paso.familiaCodigo ?? 'trabajo_manual';
      const familia = FAMILIAS[familiaCodigo as FamiliaCodigo] as
        | (typeof FAMILIAS)[FamiliaCodigo]
        | undefined;
      return {
        tenantId,
        ordenId,
        itemId,
        indice,
        rutaPasoId: paso.rutaPasoId ?? null,
        familiaCodigo,
        categoriaFamilia: familia?.categoria ?? 'operaciones_manuales',
        nombre: paso.nombreVisible?.trim() || familia?.nombre || familiaCodigo,
        centroCostoId: paso.tiempo?.centroCostoId ?? null,
        centroCostoNombre: paso.tiempo?.centroCostoNombre ?? null,
        duracionEstimadaMin: paso.tiempo?.totalMin ?? null,
      };
    });
  }

  /**
   * Materializa los pasos de producción de los items dados. Con
   * `reemplazar` pisa los existentes (edición de item en `pendiente`, donde
   * todavía no puede haber ejecución: ejecutar promueve a `produccion`, que
   * congela los items).
   */
  private async materializarPasosItems(
    tx: Prisma.TransactionClient,
    tenantId: string,
    items: ItemAMaterializar[],
    opts?: { reemplazar?: boolean },
  ) {
    const conSnapshot = items.filter((item) => item.cotizacionItemId);
    if (opts?.reemplazar && items.length > 0) {
      await tx.ordenTrabajoItemPaso.deleteMany({
        where: { tenantId, itemId: { in: items.map((item) => item.id) } },
      });
    }
    if (conSnapshot.length === 0) return;

    const snapshots = await tx.cotizacionItem.findMany({
      where: {
        id: { in: conSnapshot.map((item) => item.cotizacionItemId!) },
        tenantId,
      },
      select: { id: true, trazabilidadJson: true },
    });
    const trazabilidadPorId = new Map(
      snapshots.map((snap) => [snap.id, snap.trazabilidadJson]),
    );
    const data = conSnapshot.flatMap((item) =>
      this.pasosDesdeTrazabilidad(
        tenantId,
        item.ordenId,
        item.id,
        trazabilidadPorId.get(item.cotizacionItemId!),
      ),
    );
    if (data.length > 0) {
      await tx.ordenTrabajoItemPaso.createMany({ data });
    }
  }

  /**
   * Backfill perezoso: órdenes emitidas ANTES de que existieran los pasos
   * materializados (o cuya trazabilidad no se procesó) reciben sus pasos la
   * primera vez que alguien abre el Tablero. Idempotente: sólo toma items
   * activos con snapshot y cero pasos.
   */
  private async backfillPasosTablero(auth: CurrentAuth) {
    const candidatos = await this.prisma.ordenTrabajoItem.findMany({
      where: {
        tenantId: auth.tenantId,
        cotizacionItemId: { not: null },
        pasos: { none: {} },
        orden: { estado: { in: ESTADOS_TABLERO } },
      },
      select: { id: true, ordenId: true, cotizacionItemId: true },
    });
    if (candidatos.length === 0) return;
    await this.prisma.$transaction((tx) =>
      this.materializarPasosItems(tx, auth.tenantId, candidatos),
    );
  }

  /** Items activos con sus pasos: el dataset COMPLETO del Tablero. */
  async tablero(auth: CurrentAuth) {
    await this.backfillPasosTablero(auth);
    const ordenes = await this.prisma.ordenTrabajo.findMany({
      where: { tenantId: auth.tenantId, estado: { in: ESTADOS_TABLERO } },
      include: {
        cliente: { select: { nombre: true } },
        vendedor: { select: { nombreCompleto: true } },
        items: {
          orderBy: { ordenIndice: 'asc' as const },
          include: {
            pasos: {
              orderBy: { indice: 'asc' as const },
              include: {
                mesaUsuario: { select: { nombreCompleto: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { fechaEntrega: { sort: 'asc' as const, nulls: 'last' as const } },
        { createdAt: 'asc' as const },
      ],
    });
    return {
      items: ordenes.flatMap((orden) =>
        orden.items.map((item) => this.toTableroItem(orden, item, auth.userId)),
      ),
    };
  }

  /**
   * Toma o suelta un paso de "mi mesa de trabajo" (vista Por estación).
   * Reclamo simple y visible: tomar pisa el reclamo de otro (taller chico);
   * los pasos hechos no se reclaman. Devuelve el item re-proyectado.
   */
  async mesaPaso(auth: CurrentAuth, pasoId: string, en: boolean) {
    const paso = await this.prisma.ordenTrabajoItemPaso.findFirst({
      where: { id: pasoId, tenantId: auth.tenantId },
      select: { id: true, itemId: true, estado: true },
    });
    if (!paso) {
      throw new NotFoundException('No se encontró el paso de producción.');
    }
    if (en && paso.estado === 'hecho') {
      throw new BadRequestException('El paso ya está hecho: no va a ninguna mesa.');
    }
    await this.prisma.ordenTrabajoItemPaso.update({
      where: { id: paso.id },
      data: { mesaUsuarioId: en ? auth.userId : null },
    });
    return this.tableroItemActualizado(auth, paso.itemId);
  }

  /** Acción de ejecución sobre un paso (iniciar/completar/bloquear/…). */
  async accionPaso(
    auth: CurrentAuth,
    ordenId: string,
    itemId: string,
    pasoId: string,
    payload: AccionPasoOrdenTrabajoDto,
  ) {
    const [paso, actor] = await Promise.all([
      this.prisma.ordenTrabajoItemPaso.findFirst({
        where: { id: pasoId, tenantId: auth.tenantId, ordenId, itemId },
        include: {
          orden: { select: { estado: true, progresoPct: true } },
          item: { select: { nombre: true, ordenIndice: true } },
        },
      }),
      this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { nombreCompleto: true },
      }),
    ]);
    if (!paso) {
      throw new NotFoundException('No se encontró el paso de producción.');
    }
    const ordenEstado = paso.orden.estado as OrdenTrabajoEstado;
    // Reabrir un paso de una OT ya finalizada la vuelve a producción (deshacer
    // la auto-finalización); el resto de acciones exige orden activa.
    const reabreFinalizada =
      ordenEstado === 'finalizada' && payload.accion === 'reabrir';
    if (!ESTADOS_TABLERO.includes(ordenEstado) && !reabreFinalizada) {
      throw new BadRequestException(
        `Con la orden en estado "${ORDEN_TRABAJO_ESTADO_LABELS[ordenEstado]}" no se pueden ejecutar pasos.`,
      );
    }

    const transicion = TRANSICIONES_PASO[payload.accion];
    const estadoActual = paso.estado as OrdenTrabajoPasoEstado;
    if (!transicion.desde.includes(estadoActual)) {
      throw new BadRequestException(
        `No se puede ${payload.accion} un paso en estado "${estadoActual}".`,
      );
    }

    // La ruta es una secuencia: sólo se ejecuta el paso ACTIVO (frontera).
    const pasosItem = await this.prisma.ordenTrabajoItemPaso.findMany({
      where: { tenantId: auth.tenantId, itemId },
      select: { indice: true, estado: true },
    });
    const ejecuta =
      payload.accion === 'iniciar' ||
      payload.accion === 'completar' ||
      payload.accion === 'bloquear';
    if (ejecuta && !pasoEjecutable(pasosItem, paso.indice)) {
      throw new BadRequestException(
        `"${paso.nombre}" todavía no está listo: la ruta es secuencial y hay pasos anteriores sin completar.`,
      );
    }
    if (payload.accion === 'reabrir' && !pasoReabrible(pasosItem, paso.indice)) {
      throw new BadRequestException(
        `No se puede reabrir "${paso.nombre}": hay pasos posteriores que ya arrancaron.`,
      );
    }

    const motivo = payload.motivo?.trim();
    if (payload.accion === 'bloquear' && !motivo) {
      throw new BadRequestException(
        'Para bloquear un paso indicá el motivo (qué lo está frenando).',
      );
    }

    const ahora = new Date();
    const data: Prisma.OrdenTrabajoItemPasoUpdateInput = (() => {
      switch (payload.accion) {
        case 'iniciar':
          return { estado: 'en_curso', iniciadoEl: ahora };
        case 'completar':
          return {
            estado: 'hecho',
            completadoEl: ahora,
            iniciadoEl: paso.iniciadoEl ?? ahora,
          };
        case 'bloquear':
          return { estado: 'bloqueado', motivoBloqueo: motivo };
        case 'desbloquear':
          return {
            estado: paso.iniciadoEl ? 'en_curso' : 'pendiente',
            motivoBloqueo: null,
          };
        case 'reabrir':
          return {
            estado: 'pendiente',
            iniciadoEl: null,
            completadoEl: null,
          };
      }
    })();

    // Arrancar trabajo sobre una orden emitida la promueve a "produccion".
    const promueve =
      ordenEstado === 'pendiente' &&
      (payload.accion === 'iniciar' || payload.accion === 'completar');
    const usuarioNombre = actor?.nombreCompleto ?? auth.email;
    const letraItem = String.fromCharCode(65 + (paso.item.ordenIndice % 26));

    await this.prisma.$transaction(async (tx) => {
      await tx.ordenTrabajoItemPaso.update({
        where: { id: paso.id },
        data,
      });

      // Progreso real de la orden: pasos hechos sobre el total (D3 del doc).
      const [total, hechos] = await Promise.all([
        tx.ordenTrabajoItemPaso.count({ where: { ordenId } }),
        tx.ordenTrabajoItemPaso.count({
          where: { ordenId, estado: 'hecho' },
        }),
      ]);
      // Estado destino de la OT tras la acción:
      // - completar el último paso pendiente la FINALIZA sola;
      // - reabrir un paso de una OT finalizada la reabre a producción;
      // - el primer trabajo sobre una OT pendiente la promueve a producción.
      const nuevoEstadoOrden: OrdenTrabajoEstado | null = ordenSeFinaliza(
        payload.accion,
        total,
        hechos,
      )
        ? 'finalizada'
        : reabreFinalizada
          ? 'produccion'
          : promueve
            ? 'produccion'
            : null;
      await tx.ordenTrabajo.update({
        where: { id: ordenId },
        data: {
          ...(nuevoEstadoOrden ? { estado: nuevoEstadoOrden } : {}),
          ...(total > 0
            ? { progresoPct: Math.round((hechos / total) * 100) }
            : {}),
        },
      });

      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId: auth.tenantId,
          ordenId,
          tipo: 'paso',
          descripcion: `Producción: "${paso.nombre}" ${transicion.verbo} — item ${letraItem} · ${paso.item.nombre}${
            payload.accion === 'bloquear' ? ` (${motivo})` : ''
          }`,
          usuarioNombre,
          usuarioId: auth.userId,
          origen: 'usuario',
          datosJson: {
            pasoId: paso.id,
            itemId,
            accion: payload.accion,
            antes: estadoActual,
            ...(motivo ? { motivo } : {}),
          },
        },
      });
      if (nuevoEstadoOrden) {
        const nota =
          nuevoEstadoOrden === 'finalizada'
            ? 'todos los pasos completados'
            : ordenEstado === 'finalizada'
              ? 'se reabrió un paso'
              : 'arrancó la producción';
        await tx.ordenTrabajoEvento.create({
          data: {
            tenantId: auth.tenantId,
            ordenId,
            fecha: new Date(ahora.getTime() + 1),
            tipo: 'estado',
            descripcion: `Estado: ${ORDEN_TRABAJO_ESTADO_LABELS[ordenEstado]} → ${ORDEN_TRABAJO_ESTADO_LABELS[nuevoEstadoOrden]} (${nota})`,
            usuarioNombre: 'Sistema',
            usuarioId: null,
            origen: 'sistema',
            datosJson: {
              campo: 'estado',
              antes: ordenEstado,
              despues: nuevoEstadoOrden,
            },
          },
        });
      }
    });

    return this.tableroItemActualizado(auth, itemId);
  }

  /** Re-proyección de un item del tablero después de una acción. */
  private async tableroItemActualizado(auth: CurrentAuth, itemId: string) {
    const item = await this.prisma.ordenTrabajoItem.findFirst({
      where: { id: itemId, tenantId: auth.tenantId },
      include: {
        pasos: {
          orderBy: { indice: 'asc' as const },
          include: {
            mesaUsuario: { select: { nombreCompleto: true, email: true } },
          },
        },
        orden: {
          include: {
            cliente: { select: { nombre: true } },
            vendedor: { select: { nombreCompleto: true } },
          },
        },
      },
    });
    if (!item) {
      throw new NotFoundException('No se encontró el item de la orden.');
    }
    return this.toTableroItem(item.orden, item, auth.userId);
  }

  private toTableroItem(
    orden: {
      id: string;
      numero: string;
      estado: string;
      fechaEntrega: Date | null;
      cliente: { nombre: string } | null;
      vendedor: { nombreCompleto: string } | null;
    },
    item: {
      id: string;
      ordenIndice: number;
      codigo: string;
      nombre: string;
      cantidad: Prisma.Decimal;
      cantidadUnidad: string;
      specsJson: Prisma.JsonValue;
      cotizacionItemId: string | null;
      pasos: Array<{
        id: string;
        indice: number;
        nombre: string;
        familiaCodigo: string;
        categoriaFamilia: string;
        centroCostoId: string | null;
        centroCostoNombre: string | null;
        duracionEstimadaMin: Prisma.Decimal | null;
        estado: string;
        motivoBloqueo: string | null;
        iniciadoEl: Date | null;
        completadoEl: Date | null;
        mesaUsuarioId: string | null;
        mesaUsuario: { nombreCompleto: string | null; email: string } | null;
      }>;
    },
    /** Usuario que MIRA el tablero: define `mesaEsMia` por paso. */
    viewerUserId: string,
  ) {
    return {
      id: item.id,
      ordenId: orden.id,
      ordenNumero: orden.numero,
      ordenEstado: orden.estado,
      itemIndice: item.ordenIndice,
      codigo: item.codigo,
      nombre: item.nombre,
      clienteNombre: orden.cliente?.nombre ?? 'Sin cliente',
      vendedorNombre: orden.vendedor?.nombreCompleto ?? '—',
      cantidad: Number(item.cantidad),
      cantidadUnidad: item.cantidadUnidad,
      specs: (item.specsJson ?? []) as Array<{
        etiqueta: string;
        valor: string;
      }>,
      fechaEntrega: orden.fechaEntrega
        ? orden.fechaEntrega.toISOString().slice(0, 10)
        : null,
      sinRuta: item.pasos.length === 0,
      pasos: item.pasos.map((paso) => ({
        id: paso.id,
        indice: paso.indice,
        nombre: paso.nombre,
        familiaCodigo: paso.familiaCodigo,
        categoriaFamilia: paso.categoriaFamilia,
        centroCostoId: paso.centroCostoId,
        centroCostoNombre: paso.centroCostoNombre,
        duracionEstimadaMin:
          paso.duracionEstimadaMin != null
            ? Number(paso.duracionEstimadaMin)
            : null,
        estado: paso.estado,
        motivoBloqueo: paso.motivoBloqueo,
        iniciadoEl: paso.iniciadoEl ? paso.iniciadoEl.toISOString() : null,
        completadoEl: paso.completadoEl
          ? paso.completadoEl.toISOString()
          : null,
        mesaEsMia: paso.mesaUsuarioId === viewerUserId,
        mesaUsuarioNombre: paso.mesaUsuario
          ? paso.mesaUsuario.nombreCompleto || paso.mesaUsuario.email
          : null,
      })),
    };
  }

  // ── Mapeos al contrato del frontend ──────────────────────────────────

  private toListItem(
    orden: Omit<OrdenConRelaciones, 'items'> & {
      items: Array<{ nombre: string }>;
    },
  ) {
    const estado = orden.estado as OrdenTrabajoEstado;
    return {
      id: orden.id,
      numero: orden.numero,
      clienteId: orden.clienteId,
      clienteNombre: orden.cliente?.nombre ?? 'Sin cliente',
      vendedorEmpleadoId: orden.vendedorEmpleadoId,
      vendedorNombre: orden.vendedor?.nombreCompleto ?? '—',
      estado,
      creadaEl: orden.createdAt.toISOString(),
      fechaEntrega: orden.fechaEntrega
        ? orden.fechaEntrega.toISOString().slice(0, 10)
        : null,
      itemsCount: orden._count.items,
      total: Number(orden.total ?? 0),
      progresoPct: progresoEfectivo(estado, orden.progresoPct),
      resumen: orden.items.map((item) => item.nombre).join(' · '),
    };
  }

  private toDetalle(
    orden: OrdenConRelaciones & {
      eventos: Array<{
        fecha: Date;
        tipo: string;
        descripcion: string;
        usuarioNombre: string;
      }>;
    },
  ) {
    return {
      ...this.toListItem(orden),
      cotizacionId: orden.cotizacionId,
      observaciones: orden.observaciones,
      canalVenta: (orden as { canalVenta?: string | null }).canalVenta ?? null,
      cargosDirectos: Number(orden.cargosDirectos ?? 0),
      // Token del link público de seguimiento (para "Compartir" desde el staff).
      publicToken:
        (orden as { publicToken?: string | null }).publicToken ?? null,
      productos: orden.items.map((item) => {
        const cotItem = (
          item as typeof item & {
            cotizacionItem?: {
              productoId: string;
              rutaAlternativaId: string | null;
              jobContextJson: unknown;
              snapshotJson: unknown;
              trazabilidadJson: unknown;
              costoUnitario: unknown;
              costoTotal: unknown;
              precioUnitario: unknown;
              precioTotal: unknown;
              precioConfigSnapshotJson: unknown;
              impuestosSnapshotJson: unknown;
              comisionesSnapshotJson: unknown;
              precioEspecialClienteSnapshotJson: unknown;
            } | null;
          }
        ).cotizacionItem;
        const itemCategorias = item as typeof item & {
          categoriaComercial?: string;
          subcategoriaComercial?: string;
        };
        return {
          id: item.id,
          cotizacionItemId: item.cotizacionItemId,
          codigo: item.codigo,
          nombre: item.nombre,
          familia: item.familia,
          categoriaComercial: itemCategorias.categoriaComercial ?? '',
          subcategoriaComercial: itemCategorias.subcategoriaComercial ?? '',
          cantidad: Number(item.cantidad),
          cantidadUnidad: item.cantidadUnidad,
          subtotal: Number(item.subtotal),
          impuestos: Number(item.impuestos),
          total: Number(item.total),
          specs: (item.specsJson ?? []) as Array<{
            etiqueta: string;
            valor: string;
          }>,
          adicionales: (item.adicionalesJson ?? []) as string[],
          snapshot: cotItem
            ? {
                productoId: cotItem.productoId,
                rutaAlternativaId: cotItem.rutaAlternativaId,
                jobContext: cotItem.jobContextJson ?? null,
                resumen: cotItem.snapshotJson ?? null,
                trazabilidad: cotItem.trazabilidadJson ?? null,
                costoUnitario:
                  cotItem.costoUnitario != null
                    ? Number(cotItem.costoUnitario)
                    : null,
                costoTotal:
                  cotItem.costoTotal != null
                    ? Number(cotItem.costoTotal)
                    : null,
                precioUnitario:
                  cotItem.precioUnitario != null
                    ? Number(cotItem.precioUnitario)
                    : null,
                precioTotal:
                  cotItem.precioTotal != null
                    ? Number(cotItem.precioTotal)
                    : null,
                precioSnapshots: {
                  precioConfig: cotItem.precioConfigSnapshotJson ?? null,
                  impuestos: cotItem.impuestosSnapshotJson ?? null,
                  comisiones: cotItem.comisionesSnapshotJson ?? null,
                  precioEspecialCliente:
                    cotItem.precioEspecialClienteSnapshotJson ?? null,
                },
              }
            : null,
        };
      }),
      eventos: orden.eventos.map((evento) => ({
        fecha: evento.fecha.toISOString(),
        tipo: evento.tipo,
        descripcion: evento.descripcion,
        usuarioNombre: evento.usuarioNombre,
      })),
      // El plan de pagos llega con el módulo de pagos (ver doc de diseño).
      pago: null,
    };
  }

  // ── Seguimiento público (cliente) ────────────────────────────────────
  // Vista pública por link privado (token). SIN sesión: se resuelve la OT
  // por su publicToken único (que ES el scope) y se devuelve SÓLO una
  // proyección cliente-facing — nunca montos, costos ni datos internos.
  // Ver docs/tracking-publico-diseno.md

  async trackingPublico(token: string) {
    // findUnique por token global-único: sin sesión no hay tenantContext, así
    // que la extensión de aislamiento no filtra — está bien, el token único
    // identifica una sola orden y sus relaciones son FK de esa orden (no
    // pueden cruzar tenants).
    const orden = await this.prisma.ordenTrabajo.findUnique({
      where: { publicToken: token },
      select: {
        numero: true,
        estado: true,
        createdAt: true,
        fechaEntrega: true,
        cliente: { select: { nombre: true } },
        vendedor: {
          select: {
            nombreCompleto: true,
            telefonoCodigo: true,
            telefonoNumero: true,
          },
        },
        tenant: { select: { nombre: true } },
        items: {
          orderBy: { ordenIndice: 'asc' as const },
          select: {
            id: true,
            nombre: true,
            specsJson: true,
            pasos: {
              orderBy: { indice: 'asc' as const },
              select: {
                indice: true,
                nombre: true,
                familiaCodigo: true,
                estado: true,
                completadoEl: true,
                duracionEstimadaMin: true,
                centroCostoNombre: true,
              },
            },
          },
        },
        eventos: {
          where: { tipo: 'emision' },
          orderBy: { fecha: 'asc' as const },
          take: 1,
          select: { fecha: true },
        },
      },
    });
    if (!orden || orden.estado === 'borrador') {
      throw new NotFoundException('No encontramos ese pedido.');
    }

    let pasosTotal = 0;
    let pasosHechos = 0;
    const items = orden.items.map((item) => {
      const total = item.pasos.length;
      const hechos = item.pasos.filter((p) => p.estado === 'hecho').length;
      pasosTotal += total;
      pasosHechos += hechos;
      const actual = item.pasos.find((p) => p.estado !== 'hecho');
      return {
        id: item.id,
        nombre: item.nombre,
        specs: (item.specsJson ?? []) as Array<{
          etiqueta: string;
          valor: string;
        }>,
        progresoPct: total > 0 ? Math.round((hechos / total) * 100) : 0,
        pasoActual: actual?.nombre ?? null,
        estacionActual: actual?.centroCostoNombre ?? null,
        pasos: item.pasos.map((p) => ({
          indice: p.indice,
          nombre: p.nombre,
          familiaCodigo: p.familiaCodigo,
          estado: p.estado,
          completadoEl: p.completadoEl ? p.completadoEl.toISOString() : null,
          duracionEstimadaMin:
            p.duracionEstimadaMin != null ? Number(p.duracionEstimadaMin) : null,
        })),
      };
    });

    // Actividad cliente-facing: pasos completados (con su fecha) + emisión.
    // Se arma desde los pasos (no desde los eventos internos, que traen texto
    // de staff/montos), así nunca hay fuga de datos internos.
    const actividad: Array<{ fecha: string; texto: string }> = [];
    for (const item of orden.items) {
      for (const paso of item.pasos) {
        if (paso.estado === 'hecho' && paso.completadoEl) {
          actividad.push({
            fecha: paso.completadoEl.toISOString(),
            texto: `Listo: ${paso.nombre}`,
          });
        }
      }
    }
    if (orden.eventos[0]) {
      actividad.push({
        fecha: orden.eventos[0].fecha.toISOString(),
        texto: 'Recibimos tu pedido y entró a producción.',
      });
    }
    actividad.sort((a, b) => b.fecha.localeCompare(a.fecha));

    const telefono =
      orden.vendedor &&
      (orden.vendedor.telefonoCodigo || orden.vendedor.telefonoNumero)
        ? `${orden.vendedor.telefonoCodigo ?? ''}${orden.vendedor.telefonoNumero ?? ''}`.trim()
        : null;

    return {
      numero: orden.numero,
      estado: orden.estado,
      creadaEl: orden.createdAt.toISOString(),
      fechaEntrega: orden.fechaEntrega
        ? orden.fechaEntrega.toISOString().slice(0, 10)
        : null,
      progresoPct:
        pasosTotal > 0 ? Math.round((pasosHechos / pasosTotal) * 100) : 0,
      imprenta: {
        nombre: orden.tenant.nombre,
        iniciales: inicialesDe(orden.tenant.nombre),
      },
      cliente: {
        primerNombre: orden.cliente
          ? primerNombre(orden.cliente.nombre)
          : 'Hola',
        iniciales: orden.cliente ? inicialesDe(orden.cliente.nombre) : '·',
      },
      vendedor: orden.vendedor
        ? {
            nombre: orden.vendedor.nombreCompleto,
            iniciales: inicialesDe(orden.vendedor.nombreCompleto),
            telefono,
          }
        : null,
      items,
      actividad: actividad.slice(0, 8),
    };
  }
}
