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
} from './ordenes-trabajo.types';
import type {
  CambiarEstadoOrdenTrabajoDto,
  CrearOrdenTrabajoDto,
  CrearOrdenTrabajoItemDto,
  EditarOrdenTrabajoDto,
} from './dto/crear-orden-trabajo.dto';

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

    const [ordenes, total] = await this.prisma.$transaction([
      this.prisma.ordenTrabajo.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.ordenTrabajo.count({ where }),
    ]);

    return paginatedResponse(
      ordenes.map((orden) => this.toListItem(orden)),
      total,
      query,
    );
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
        eventos: { orderBy: { fecha: 'desc' as const } },
      },
    });
    if (!orden) {
      throw new NotFoundException('No se encontró la orden de trabajo.');
    }
    return this.toDetalle(orden);
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
    const vendedorEmpleadoId =
      payload.vendedorEmpleadoId ?? emisor?.id ?? null;
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
    // Salir de borrador (a cualquier estado) es emitir: exige cliente.
    if (desde === 'borrador') {
      this.validarEmision(hacia, orden.clienteId);
    }

    const progresoPct =
      payload.progresoPct !== undefined
        ? Math.min(100, payload.progresoPct)
        : hacia === 'finalizada' || hacia === 'entregada'
          ? 100
          : orden.progresoPct;

    await this.prisma.$transaction([
      this.prisma.ordenTrabajo.update({
        where: { id: orden.id },
        data: {
          estado: hacia,
          progresoPct,
          // Cualquier salida de borrador marca la emisión si faltaba.
          fechaEmision:
            desde === 'borrador' && !orden.fechaEmision
              ? new Date()
              : undefined,
        },
      }),
      this.prisma.ordenTrabajoEvento.create({
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
      }),
    ]);

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
      canalVenta:
        (orden as { canalVenta?: string | null }).canalVenta ?? null,
      cargosDirectos: Number(orden.cargosDirectos ?? 0),
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
}
