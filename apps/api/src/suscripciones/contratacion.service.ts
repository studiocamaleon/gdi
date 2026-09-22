import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type PlanContratacion } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleService } from '../cobro/paddle.service';
import {
  SuscripcionSyncService,
  type SuscripcionExterna,
} from '../cobro/suscripcion-sync.service';
import { resolverContratoOferta } from '../cobro/contrato-oferta-paddle';
import { bloquearCupoUsuarios } from './cupos-usuarios';
import { revisarContratacion } from './revision-contratacion';
import { ConsultaContratacionService } from './consulta-contratacion.service';
import { ESTADOS_CONTRATACION_PENDIENTE } from './contratacion-pendiente';
import type {
  CobroContratacion,
  RevisionContratacion,
  SeleccionContratacion,
  VistaContratacion,
} from './contratacion-tipos';

const PENDIENTES = ESTADOS_CONTRATACION_PENDIENTE;
const json = (value: unknown) => value as Prisma.InputJsonValue;
function serializar(op: PlanContratacion): VistaContratacion {
  return {
    id: op.id,
    ofertaId: op.ofertaId,
    tipo: op.tipo as 'checkout' | 'cambio',
    estado: op.estado,
    expiraEl: op.expiraEl.toISOString(),
    revision: op.revisionJson as unknown as RevisionContratacion,
    cobro: op.cobroJson as unknown as CobroContratacion,
    transaccionId: op.transaccionId,
    detalle: op.detalle,
  };
}

@Injectable()
export class ContratacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleService,
    private readonly sync: SuscripcionSyncService,
  ) {}

  private async autorizar(tx: Prisma.TransactionClient, auth: CurrentAuth) {
    if (
      auth.impersonacion ||
      auth.mcp ||
      auth.esPlataforma ||
      auth.role !== 'ADMINISTRADOR'
    )
      throw new ForbiddenException(
        'La contratación requiere una sesión propia del administrador de la empresa.',
      );
    const [miembro, sesion] = await Promise.all([
      tx.membership.findFirst({
        where: {
          id: auth.membershipId,
          tenantId: auth.tenantId,
          userId: auth.userId,
          activa: true,
          rol: 'ADMINISTRADOR',
          user: { activo: true },
        },
        include: { rolDelTenant: true },
      }),
      tx.authSession.findFirst({
        where: {
          id: auth.sessionId,
          userId: auth.userId,
          currentTenantId: auth.tenantId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);
    if (
      !miembro ||
      !sesion ||
      (miembro.rolDelTenant &&
        !miembro.rolDelTenant.permisos.includes('configuracion.gestionar'))
    )
      throw new ForbiddenException(
        'La sesión o los permisos de administración cambiaron. Volvé a ingresar.',
      );
  }

  private async verificarPrecios(
    revision: Awaited<ReturnType<typeof revisarContratacion>>,
  ) {
    if (!this.paddle.habilitado)
      throw new BadRequestException(
        'El cobro no está disponible en este entorno.',
      );
    await Promise.all(
      revision.items.map(async (item) => {
        const guardado = revision.oferta.precios.find(
          (p) => p.priceId === item.priceId,
        )!;
        const p = await this.paddle.leerPrecioOferta(item.priceId);
        if (
          !p ||
          p.status !== 'active' ||
          p.product?.status !== 'active' ||
          p.type !== 'standard' ||
          p.taxMode !== 'external' ||
          p.unitPrice.currencyCode !== guardado.moneda ||
          Number(p.unitPrice.amount) !==
            Math.round(Number(guardado.importe) * 100) ||
          (guardado.ciclo === 'unico'
            ? p.billingCycle !== null
            : p.billingCycle?.frequency !== 1 ||
              p.billingCycle.interval !==
                (guardado.ciclo === 'mensual' ? 'month' : 'year')) ||
          p.trialPeriod ||
          p.unitPriceOverrides.length ||
          p.quantity.minimum > item.quantity ||
          p.quantity.maximum < item.quantity
        )
          throw new ConflictException(
            'El precio de Paddle cambió o dejó de estar disponible. Revisá la oferta antes de continuar.',
          );
      }),
    );
  }

  private async remoto(
    revision: Awaited<ReturnType<typeof revisarContratacion>>,
  ) {
    const s = revision.suscripcion;
    const data = await this.paddle.obtenerSuscripcion(s.referenciaExterna!);
    const externa = this.sync.extraer(data);
    if (
      !externa ||
      externa.referencia !== s.referenciaExterna ||
      (externa.tenantId && externa.tenantId !== s.tenantId) ||
      !externa.actualizadoEl ||
      !['active', 'trialing'].includes(externa.estadoProveedor) ||
      externa.cambioProgramado
    )
      throw new ConflictException(
        'No se pudo verificar una suscripción activa y sin cambios programados en Paddle.',
      );
    // No eliminar otros ítems que Grafo no conoce al enviar la lista completa.
    const contrato = await this.prisma.$transaction((tx) =>
      resolverContratoOferta(tx, externa),
    );
    const coincide =
      contrato.tipo === 'version'
        ? contrato.ofertaId === s.ofertaId &&
          contrato.usuariosAdicionales === s.usuariosAdicionales &&
          contrato.cicloFacturacion === s.cicloFacturacion
        : contrato.tipo === 'legacy' &&
          !s.ofertaId &&
          externa.items?.length === 1 &&
          externa.items[0].quantity === 1 &&
          (externa.precios[0] === s.plan.paddlePriceId ||
            externa.precios[0] === s.plan.paddlePriceIdAnual);
    if (!coincide)
      throw new ConflictException(
        'Los ítems de Paddle difieren del contrato registrado. Actualizá el estado de la suscripción antes de cambiarlo.',
      );
    return externa;
  }

  async preparar(
    auth: CurrentAuth,
    dto: SeleccionContratacion,
  ): Promise<VistaContratacion> {
    const r = await this.prisma.$transaction(async (tx) => {
      await this.autorizar(tx, auth);
      await bloquearCupoUsuarios(tx, auth.tenantId);
      const pendiente = await tx.planContratacion.findFirst({
        where: { tenantId: auth.tenantId, estado: { in: PENDIENTES } },
      });
      if (pendiente)
        throw new ConflictException({
          message:
            'Ya hay una contratación pendiente. Revisá su estado antes de iniciar otra.',
          contratacionId: pendiente.id,
        });
      return revisarContratacion(tx, auth.tenantId, dto);
    });
    if (r.vista.bloqueos.length)
      return {
        id: null,
        ofertaId: dto.ofertaId,
        tipo: r.tipo,
        estado: 'requiere_revision',
        expiraEl: null,
        revision: r.vista,
        cobro: null,
        transaccionId: null,
        detalle: null,
      };
    await this.verificarPrecios(r);
    const externa = r.tipo === 'cambio' ? await this.remoto(r) : null;
    const cobro: CobroContratacion = externa
      ? await this.paddle.previsualizarItems(externa.referencia, r.items)
      : {
          aCobrar: null,
          aCredito: 0,
          moneda: 'USD',
          impuestosEnCheckout: true,
        };
    if (
      cobro.moneda !== 'USD' ||
      (cobro.aCobrar !== null &&
        (!Number.isFinite(cobro.aCobrar) || cobro.aCobrar < 0)) ||
      !Number.isFinite(cobro.aCredito) ||
      cobro.aCredito < 0
    )
      throw new BadRequestException(
        'La previsualización del cobro no es válida.',
      );
    return this.prisma.$transaction(async (tx) => {
      await this.autorizar(tx, auth);
      await bloquearCupoUsuarios(tx, auth.tenantId);
      const fresca = await revisarContratacion(tx, auth.tenantId, dto);
      if (fresca.huella !== r.huella)
        throw new ConflictException(
          'La empresa cambió durante la revisión. Volvé a revisar la contratación.',
        );
      return serializar(
        await tx.planContratacion.create({
          data: {
            tenantId: auth.tenantId,
            userId: auth.userId,
            ...dto,
            tipo: r.tipo,
            huella: r.huella,
            revisionContrato: r.suscripcion.revisionContrato,
            referencia: externa?.referencia ?? null,
            revisionRemota: externa?.actualizadoEl?.toISOString() ?? null,
            revisionJson: json(r.vista),
            cobroJson: json(cobro),
            expiraEl: new Date(Date.now() + 10 * 60000),
          },
        }),
      );
    });
  }

  async confirmar(
    auth: CurrentAuth,
    id: string,
    revisionesAceptadas: string[],
  ): Promise<VistaContratacion> {
    const inicio = await this.prisma.$transaction(async (tx) => {
      await this.autorizar(tx, auth);
      await bloquearCupoUsuarios(tx, auth.tenantId);
      const op = await tx.planContratacion.findFirst({
        where: { id, tenantId: auth.tenantId, userId: auth.userId },
      });
      if (!op)
        throw new NotFoundException('La revisión de contratación no existe.');
      if (op.estado !== 'preparada') return { op, enviar: false };
      if (op.expiraEl <= new Date())
        throw new ConflictException(
          'La revisión venció. Volvé a consultar el impacto y el cobro.',
        );
      const r = await revisarContratacion(tx, auth.tenantId, seleccion(op));
      if (op.huella !== r.huella || r.vista.bloqueos.length)
        throw new ConflictException(
          'Cambió el contrato, el uso o la oferta. Revisá nuevamente antes de confirmar.',
        );
      if (
        !Array.isArray(revisionesAceptadas) ||
        r.vista.revisiones.some((k) => !revisionesAceptadas.includes(k))
      )
        throw new BadRequestException(
          'Confirmá las revisiones de continuidad antes de contratar.',
        );
      const pendiente = await tx.planContratacion.findFirst({
        where: { tenantId: auth.tenantId, estado: { in: PENDIENTES } },
      });
      if (pendiente)
        throw new ConflictException({
          message: 'Ya hay una contratación pendiente.',
          contratacionId: pendiente.id,
        });
      return {
        op: await tx.planContratacion.update({
          where: { id, tenantId: auth.tenantId },
          data: { estado: 'enviando', enviadaEl: new Date() },
        }),
        enviar: true,
      };
    });
    if (!inicio.enviar) return serializar(inicio.op);
    let enviado = false;
    try {
      // Los cupos de usuarios/archivos comparten este lock. Ninguna admisión
      // puede ocupar el cupo anterior mientras se confirma el cambio remoto.
      return await this.prisma.$transaction(
        async (tx) => {
          await this.autorizar(tx, auth);
          if (inicio.op.referencia)
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`paddle:${inicio.op.referencia}`}, 0))::text`;
          await bloquearCupoUsuarios(tx, auth.tenantId);
          const r = await revisarContratacion(
            tx,
            auth.tenantId,
            seleccion(inicio.op),
          );
          if (r.huella !== inicio.op.huella)
            throw new ConflictException(
              'Cambió el uso o la oferta. Volvé a revisar antes de cobrar.',
            );
          await this.verificarPrecios(r);
          if (r.tipo === 'checkout') {
            enviado = true;
            const t = await this.paddle.crearCheckoutContratacion(
              r.items,
              auth.tenantId,
              id,
            );
            return serializar(
              await tx.planContratacion.update({
                where: { id, tenantId: auth.tenantId },
                data: {
                  estado: 'checkout',
                  transaccionId: t.id,
                  detalle: 'Esperando la confirmación del pago.',
                },
              }),
            );
          }
          // Lectura fuera de la resolución local para no abrir otra transacción
          // mientras ésta mantiene el lock de la empresa.
          const remoto = this.sync.extraer(
            await this.paddle.obtenerSuscripcion(inicio.op.referencia!),
          );
          if (
            !remoto ||
            remoto.referencia !== inicio.op.referencia ||
            remoto.actualizadoEl?.toISOString() !== inicio.op.revisionRemota
          )
            throw new ConflictException(
              'La suscripción cambió en Paddle. Volvé a revisar el cobro.',
            );
          const preview = await this.paddle.previsualizarItems(
            inicio.op.referencia,
            r.items,
          );
          const aprobado = inicio.op.cobroJson as unknown as CobroContratacion;
          if (
            preview.aCobrar !== aprobado.aCobrar ||
            preview.aCredito !== aprobado.aCredito ||
            preview.moneda !== aprobado.moneda
          )
            throw new ConflictException(
              'El importe del ajuste cambió. Volvé a revisarlo antes de cobrar.',
            );
          enviado = true;
          const respuesta = await this.paddle.cambiarItems(
            inicio.op.referencia,
            r.items,
          );
          const externa = this.sync.extraer(respuesta);
          if (!externa || !(await this.coincide(tx, inicio.op, externa)))
            throw new Error('Respuesta remota pendiente de confirmar');
          const aplicada = await this.sync.aplicarEnTransaccion(tx, externa, {
            origen: 'accion',
          });
          if (!aplicada.aplicado)
            throw new Error('No se pudo reconciliar el cambio confirmado');
          return serializar(
            await tx.planContratacion.update({
              where: { id, tenantId: auth.tenantId },
              data: {
                estado: 'aplicada',
                finalizadaEl: new Date(),
                detalle: 'Plan y usuarios adicionales actualizados.',
              },
            }),
          );
        },
        { timeout: 60000, maxWait: 10000 },
      );
    } catch (error) {
      // Si hubo un envío, una excepción local o una respuesta perdida no
      // prueban que Paddle lo rechazara. Consultar; jamás repetir el PATCH/POST.
      const rechazo = !enviado || this.paddle.esRechazoDefinitivo(error);
      const detalle =
        !enviado && error instanceof Error
          ? error.message
          : rechazo
            ? 'Paddle rechazó el cambio. Revisá el medio de pago y las condiciones antes de intentarlo nuevamente.'
            : 'Estamos verificando el resultado con Paddle. Esta solicitud no volverá a enviarse.';
      // El webhook puede haber terminado entre el error y esta escritura.
      await this.prisma.planContratacion.updateMany({
        where: { id, tenantId: auth.tenantId, estado: 'enviando' },
        data: {
          estado: rechazo ? 'rechazada' : 'verificar',
          detalle,
          ...(rechazo ? { finalizadaEl: new Date() } : {}),
        },
      });
      return serializar(
        await this.prisma.planContratacion.findFirstOrThrow({
          where: { id, tenantId: auth.tenantId },
        }),
      );
    }
  }

  private async coincide(
    tx: Prisma.TransactionClient,
    op: PlanContratacion,
    externa: SuscripcionExterna,
  ) {
    if (externa.tenantId && externa.tenantId !== op.tenantId) return false;
    if (op.referencia && op.referencia !== externa.referencia) return false;
    if (!['active', 'trialing'].includes(externa.estadoProveedor)) return false;
    const contrato = await resolverContratoOferta(tx, externa);
    return (
      contrato.tipo === 'version' &&
      contrato.ofertaId === op.ofertaId &&
      contrato.cicloFacturacion === op.ciclo &&
      contrato.usuariosAdicionales === op.adicionales
    );
  }

  async pendiente(auth: CurrentAuth): Promise<VistaContratacion | null> {
    return this.prisma.$transaction(async (tx) => {
      await this.autorizar(tx, auth);
      const op = await tx.planContratacion.findFirst({
        where: { tenantId: auth.tenantId, estado: { in: PENDIENTES } },
      });
      return op ? serializar(op) : null;
    });
  }

  async descartar(auth: CurrentAuth, id: string): Promise<VistaContratacion> {
    const actual = await this.consultar(auth, id);
    if (!PENDIENTES.includes(actual.estado)) return actual;
    if (actual.tipo !== 'checkout' || !actual.transaccionId)
      throw new ConflictException(
        'Primero necesitamos verificar el resultado en Paddle. No se puede iniciar otro cobro mientras tanto.',
      );
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.autorizar(tx, auth);
          await bloquearCupoUsuarios(tx, auth.tenantId);
          const op = await tx.planContratacion.findFirstOrThrow({
            where: { id, tenantId: auth.tenantId },
          });
          if (!PENDIENTES.includes(op.estado)) return serializar(op);
          const t = await this.paddle.leerCheckoutContratacion(
            op.transaccionId!,
          );
          if (
            !t ||
            t.customData?.tenantId !== auth.tenantId ||
            t.customData?.contratacionId !== id ||
            !['draft', 'ready'].includes(t.status)
          )
            throw new ConflictException(
              'El pago ya está procesándose o requiere verificación. Actualizá su estado antes de continuar.',
            );
          const cancelada = await this.paddle.cancelarCheckoutContratacion(
            t.id,
          );
          if (cancelada.status !== 'canceled')
            throw new Error('Cancelación no confirmada');
          return serializar(
            await tx.planContratacion.update({
              where: { id, tenantId: auth.tenantId },
              data: {
                estado: 'rechazada',
                finalizadaEl: new Date(),
                detalle: 'Checkout descartado sin completar el pago.',
              },
            }),
          );
        },
        { timeout: 60000, maxWait: 10000 },
      );
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      )
        throw error;
      // Puede haberse completado o cancelado durante la llamada. Leer el
      // resultado, sin dar por cancelado un pago sólo por un error de red.
      return this.consultar(auth, id);
    }
  }

  async consultar(auth: CurrentAuth, id: string): Promise<VistaContratacion> {
    const resultado = await new ConsultaContratacionService(
      this.prisma,
      this.paddle,
      this.sync,
    ).consultar(auth.tenantId, id, (tx) => this.autorizar(tx, auth));
    return serializar(resultado.operacion);
  }
}

function seleccion(op: PlanContratacion): SeleccionContratacion {
  return {
    ofertaId: op.ofertaId,
    ciclo: op.ciclo as 'mensual' | 'anual',
    adicionales: op.adicionales,
  };
}
