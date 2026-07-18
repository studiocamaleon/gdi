import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { OrdenesTrabajoService } from '../ordenes-trabajo/ordenes-trabajo.service';
import type { CrearOrdenTrabajoItemDto } from '../ordenes-trabajo/dto/crear-orden-trabajo.dto';
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

const MS_DIA = 86_400_000;

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
  cargosDirectos?: number;
  items: CrearOrdenTrabajoItemDto[];
};

function generarPublicToken(): string {
  return randomBytes(16).toString('base64url');
}

const r2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class PresupuestosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordenes: OrdenesTrabajoService,
  ) {}

  // ── Configuración por tenant ───────────────────────────────────────
  async config(tenantId: string) {
    const row = await this.prisma.configuracionPresupuestos.findUnique({
      where: { tenantId },
    });
    return {
      validezDiasDefault: row?.validezDiasDefault ?? 15,
      senaSugeridaPctDefault: Number(row?.senaSugeridaPctDefault ?? 50),
      condicionesTexto: row?.condicionesTexto ?? null,
    };
  }

  async actualizarConfig(tenantId: string, dto: ActualizarConfigPresupuestosDto) {
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
      where: { id: dto.clienteId },
      select: { id: true },
    });
    if (!cliente) throw new BadRequestException('El cliente no existe.');

    // Vendedor: el indicado, o el empleado ligado al usuario que emite
    // (mismo default que la OT).
    let vendedorEmpleadoId = dto.vendedorEmpleadoId ?? null;
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
    const fechaValidez = new Date(ahora.getTime() + validezDias * MS_DIA);
    const subtotal = r2(dto.items.reduce((a, i) => a + i.subtotal, 0));
    const impuestos = r2(dto.items.reduce((a, i) => a + i.impuestos, 0));
    const total = r2(
      dto.items.reduce((a, i) => a + i.total, 0) + (dto.cargosDirectos ?? 0),
    );
    const emisionJson: EmisionJson = {
      fechaEntrega: dto.fechaEntrega,
      canalVenta: dto.canalVenta,
      cargosDirectos: dto.cargosDirectos,
      items: dto.items,
    };

    const numero = await this.prisma.$transaction(async (tx) => {
      const anio = ahora.getFullYear();
      const contador = await tx.cotizacionContador.upsert({
        where: { tenantId_anio: { tenantId: auth.tenantId, anio } },
        create: { tenantId: auth.tenantId, anio, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      });
      const nro = `PRES-${anio}-${String(contador.ultimo).padStart(4, '0')}`;
      await tx.cotizacion.update({
        where: { id: dto.cotizacionId },
        data: {
          numero: nro,
          clienteId: dto.clienteId,
          vendedorEmpleadoId,
          canalVenta: dto.canalVenta,
          estado: 'borrador',
          fechaEmision: ahora,
          fechaValidez,
          observaciones: dto.observaciones,
          senaSugeridaPct: dto.senaSugeridaPct ?? cfg.senaSugeridaPctDefault,
          subtotal,
          impuestos,
          total,
          emisionJson: emisionJson as unknown as Prisma.InputJsonValue,
        },
      });
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

    return this.detalle(auth, dto.cotizacionId, { numero });
  }

  // ── Listado + stats (pipeline en $) ────────────────────────────────
  async listado(auth: CurrentAuth, filtros: ListarPresupuestosDto) {
    await this.vencerExpirados(auth.tenantId);
    const where: Prisma.CotizacionWhereInput = {
      numero: { not: null },
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
      ...(filtros.busqueda
        ? {
            OR: [
              { numero: { contains: filtros.busqueda, mode: 'insensitive' } },
              { cliente: { nombre: { contains: filtros.busqueda, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, porEstado] = await Promise.all([
      this.prisma.cotizacion.findMany({
        where,
        orderBy: { fechaEmision: 'desc' },
        take: 200,
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
        fechaValidez: rw.fechaValidez?.toISOString().slice(0, 10) ?? null,
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
      },
    });
    if (!c) throw new NotFoundException('El presupuesto no existe.');
    const emision = (c.emisionJson ?? { items: [] }) as unknown as EmisionJson;
    const ordenConvertida = c.convertidaOrdenId
      ? await this.prisma.ordenTrabajo.findFirst({
          where: { id: c.convertidaOrdenId },
          select: { id: true, numero: true },
        })
      : null;
    return {
      id: c.id,
      numero: extra?.numero ?? c.numero,
      estado: c.estado as PresupuestoEstado,
      cliente: c.cliente ? { id: c.cliente.id, nombre: c.cliente.nombre } : null,
      vendedor: c.vendedor
        ? { id: c.vendedor.id, nombre: c.vendedor.nombreCompleto }
        : null,
      canalVenta: c.canalVenta,
      fechaEmision: c.fechaEmision?.toISOString() ?? null,
      fechaValidez: c.fechaValidez?.toISOString().slice(0, 10) ?? null,
      fechaEnvio: c.fechaEnvio?.toISOString() ?? null,
      fechaResuelto: c.fechaResuelto?.toISOString() ?? null,
      primeraVistaEl: c.primeraVistaEl?.toISOString() ?? null,
      motivoPerdida: c.motivoPerdida,
      motivoPerdidaDetalle: c.motivoPerdidaDetalle,
      observaciones: c.observaciones,
      senaSugeridaPct: c.senaSugeridaPct != null ? Number(c.senaSugeridaPct) : null,
      subtotal: Number(c.subtotal ?? 0),
      impuestos: Number(c.impuestos ?? 0),
      total: Number(c.total ?? 0),
      cargosDirectos: emision.cargosDirectos ?? 0,
      fechaEntrega: emision.fechaEntrega ?? null,
      publicToken: c.publicToken,
      ordenConvertida: ordenConvertida?.numero ?? null,
      ordenConvertidaId: ordenConvertida?.id ?? null,
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
        specs: i.specs ?? [],
        adicionales: i.adicionales ?? [],
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
  async enviar(auth: CurrentAuth, id: string) {
    const c = await this.exigir(id, ['borrador', 'enviado']);
    if (!c.clienteId) {
      throw new BadRequestException('Asigná un cliente antes de enviar.');
    }
    const token = c.publicToken ?? generarPublicToken();
    const yaEnviado = c.estado === 'enviado';
    await this.prisma.cotizacion.update({
      where: { id },
      data: {
        estado: 'enviado',
        fechaEnvio: new Date(),
        publicToken: token,
      },
    });
    await this.evento(auth, id, {
      tipo: 'enviado',
      descripcion: yaEnviado
        ? 'Presupuesto reenviado al cliente.'
        : 'Presupuesto enviado al cliente.',
    });
    return this.detalle(auth, id);
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
      if (!dto.motivoPerdida || !MOTIVOS_PERDIDA.includes(dto.motivoPerdida as never)) {
        throw new BadRequestException(
          'Elegí el motivo de la pérdida (sirve para las métricas comerciales).',
        );
      }
    }
    await this.prisma.cotizacion.update({
      where: { id },
      data: {
        estado: dto.resultado,
        fechaResuelto: new Date(),
        motivoPerdida: dto.resultado === 'rechazado' ? dto.motivoPerdida : null,
        motivoPerdidaDetalle:
          dto.resultado === 'rechazado' ? dto.motivoPerdidaDetalle : null,
      },
    });
    await this.evento(auth, id, {
      tipo: dto.resultado,
      descripcion:
        dto.resultado === 'aprobado'
          ? 'Marcado como aprobado por el cliente.'
          : `Marcado como perdido: ${ETIQUETA_MOTIVO[dto.motivoPerdida!] ?? dto.motivoPerdida}${dto.motivoPerdidaDetalle ? ` — ${dto.motivoPerdidaDetalle}` : ''}.`,
    });
    return this.detalle(auth, id);
  }

  // ── Convertir: aprobado → OT (total o parcial) ─────────────────────
  async convertir(auth: CurrentAuth, id: string, dto: ConvertirPresupuestoDto) {
    const c = await this.exigir(id, ['enviado', 'aprobado']);
    const emision = (c.emisionJson ?? null) as unknown as EmisionJson | null;
    if (!emision?.items?.length) {
      throw new BadRequestException(
        'El presupuesto no tiene la proyección de items para convertir.',
      );
    }
    let items = emision.items;
    if (dto.itemIds?.length) {
      items = items.filter(
        (i) => i.cotizacionItemId && dto.itemIds!.includes(i.cotizacionItemId),
      );
      if (items.length === 0) {
        throw new BadRequestException('Ningún item seleccionado para convertir.');
      }
    }
    const parcial = items.length < emision.items.length;

    // Si el vendedor convierte directo desde "enviado", el acto implica la
    // aprobación del cliente — queda explícito en el timeline.
    if (c.estado === 'enviado') {
      await this.prisma.cotizacion.update({
        where: { id },
        data: { estado: 'aprobado', fechaResuelto: new Date() },
      });
      await this.evento(auth, id, {
        tipo: 'aprobado',
        descripcion: 'Aprobado al convertir en orden de trabajo.',
      });
    }

    // La fecha de entrega cotizada puede haber quedado en el pasado: la OT
    // nace en borrador para revisarla y emitirla desde su propia ficha.
    const hoyIso = new Date().toISOString().slice(0, 10);
    const fechaEntrega =
      emision.fechaEntrega && emision.fechaEntrega >= hoyIso
        ? emision.fechaEntrega
        : undefined;

    const orden = await this.ordenes.create(auth, {
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

    await this.prisma.cotizacion.update({
      where: { id },
      data: { estado: 'convertido', convertidaOrdenId: orden.id },
    });
    await this.evento(auth, id, {
      tipo: 'convertido',
      descripcion: `Convertido en la orden ${orden.numero}${parcial ? ` (${items.length} de ${emision.items.length} items)` : ''}. La orden queda en borrador para revisar fecha y emitir.`,
      datosJson: { ordenId: orden.id, parcial },
    });

    return { ordenId: orden.id, ordenNumero: orden.numero, parcial };
  }

  // ── Link público: ver + decidir ────────────────────────────────────
  /** findUnique por token global (sin sesión no hay tenantContext — el
   *  token único ES la credencial; mismo patrón que el tracking de OT). */
  async publico(token: string) {
    const c = await this.prisma.cotizacion.findUnique({
      where: { publicToken: token },
      include: {
        tenant: { select: { nombre: true } },
        cliente: { select: { nombre: true } },
        vendedor: { select: { nombreCompleto: true } },
      },
    });
    if (!c || !c.numero) throw new NotFoundException('Presupuesto no encontrado.');

    // Vencimiento lazy también por acá (el cliente puede abrir tarde).
    let estado = c.estado;
    if (estado === 'enviado' && c.fechaValidez && c.fechaValidez < new Date()) {
      estado = 'vencido';
      await this.prisma.cotizacion.update({ where: { id: c.id }, data: { estado } });
      await this.eventoSistema(c.tenantId, c.id, {
        tipo: 'vencido',
        descripcion: 'El presupuesto venció (fecha de validez cumplida).',
      });
    }

    if (!c.primeraVistaEl && estado === 'enviado') {
      await this.prisma.cotizacion.update({
        where: { id: c.id },
        data: { primeraVistaEl: new Date() },
      });
      await this.eventoSistema(c.tenantId, c.id, {
        tipo: 'visto',
        descripcion: 'El cliente abrió el presupuesto por primera vez.',
        origen: 'cliente',
      });
    }

    const emision = (c.emisionJson ?? { items: [] }) as unknown as EmisionJson;
    return {
      numero: c.numero,
      estado,
      negocio: c.tenant.nombre,
      cliente: c.cliente?.nombre ?? null,
      vendedor: c.vendedor?.nombreCompleto ?? null,
      fechaEmision: c.fechaEmision?.toISOString().slice(0, 10) ?? null,
      fechaValidez: c.fechaValidez?.toISOString().slice(0, 10) ?? null,
      observaciones: c.observaciones,
      senaSugeridaPct: c.senaSugeridaPct != null ? Number(c.senaSugeridaPct) : null,
      subtotal: Number(c.subtotal ?? 0),
      impuestos: Number(c.impuestos ?? 0),
      cargosDirectos: emision.cargosDirectos ?? 0,
      total: Number(c.total ?? 0),
      items: emision.items.map((i) => ({
        nombre: i.nombre,
        cantidad: i.cantidad,
        cantidadUnidad: i.cantidadUnidad,
        total: i.total,
        specs: i.specs ?? [],
        adicionales: i.adicionales ?? [],
      })),
    };
  }

  async decisionPublica(token: string, dto: DecisionPublicaDto) {
    const c = await this.prisma.cotizacion.findUnique({
      where: { publicToken: token },
      select: { id: true, tenantId: true, numero: true, estado: true, fechaValidez: true },
    });
    if (!c || !c.numero) throw new NotFoundException('Presupuesto no encontrado.');
    if (c.estado !== 'enviado') {
      throw new BadRequestException(
        c.estado === 'vencido'
          ? 'El presupuesto está vencido: pedí una actualización.'
          : 'El presupuesto ya no admite esta acción.',
      );
    }
    if (c.fechaValidez && c.fechaValidez < new Date()) {
      await this.prisma.cotizacion.update({
        where: { id: c.id },
        data: { estado: 'vencido' },
      });
      throw new BadRequestException(
        'El presupuesto está vencido: pedí una actualización.',
      );
    }
    await this.prisma.cotizacion.update({
      where: { id: c.id },
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
    if (c.estado === 'enviado' && c.fechaValidez && c.fechaValidez < new Date()) {
      await this.prisma.cotizacion.update({
        where: { id },
        data: { estado: 'vencido' },
      });
      await this.eventoSistema(c.tenantId, c.id, {
        tipo: 'vencido',
        descripcion: 'El presupuesto venció (fecha de validez cumplida).',
      });
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
    await this.prisma.cotizacion.updateMany({
      where: { id: { in: vencidos.map((v) => v.id) } },
      data: { estado: 'vencido' },
    });
    await this.prisma.cotizacionEvento.createMany({
      data: vencidos.map((v) => ({
        tenantId,
        cotizacionId: v.id,
        tipo: 'vencido',
        descripcion: 'El presupuesto venció (fecha de validez cumplida).',
        usuarioNombre: 'Sistema',
        origen: 'sistema',
      })),
    });
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
        datosJson: (e.datosJson ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private async eventoSistema(
    tenantId: string,
    cotizacionId: string,
    e: { tipo: string; descripcion: string; origen?: string; datosJson?: unknown },
  ) {
    await this.prisma.cotizacionEvento.create({
      data: {
        tenantId,
        cotizacionId,
        tipo: e.tipo,
        descripcion: e.descripcion,
        usuarioNombre: e.origen === 'cliente' ? 'Cliente' : 'Sistema',
        origen: e.origen ?? 'sistema',
        datosJson: (e.datosJson ?? undefined) as Prisma.InputJsonValue | undefined,
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
