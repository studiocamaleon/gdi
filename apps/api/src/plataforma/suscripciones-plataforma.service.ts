import { contratoSuscripcion } from '../suscripciones/contrato-suscripcion';
import { exigirSinContratacionPendiente } from '../suscripciones/contratacion-pendiente';
import {
  bloquearCupoUsuarios,
  resumenCupoUsuarios,
} from '../suscripciones/cupos-usuarios';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Suscripcion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleService } from '../cobro/paddle.service';
import { SuscripcionSyncService } from '../cobro/suscripcion-sync.service';
import { resolverAccesoEmpresa } from '../suscripciones/acceso-empresa';
import type { CurrentAuth } from '../auth/auth.types';
import { mfaPlataformaCompleta } from '../auth/enrolamiento-plataforma';

export type ConsultaSuscripciones = {
  pagina: number;
  limite: number;
  q?: string;
  proveedor?: 'paddle' | 'manual';
  caso?: 'atencion' | 'mora' | 'prueba' | 'desactualizada' | 'bloqueada';
};
const MEDIA_HORA = 30 * 60_000;
const DOS_MINUTOS = 120_000;
const iso = (d: Date | null) => d?.toISOString() ?? null;
const include = {
  tenant: {
    select: {
      id: true,
      nombre: true,
      slug: true,
      activo: true,
      bloqueoAccesoMotivo: true,
    },
  },
  plan: {
    select: { id: true, nombre: true, codigo: true, featuresJson: true },
  },
  planVersion: true,
} satisfies Prisma.SuscripcionInclude;
type Fila = Prisma.SuscripcionGetPayload<{ include: typeof include }>;

function resumen(s: Suscripcion): Prisma.InputJsonObject {
  return {
    estado: s.estado,
    estadoProveedor: s.estadoProveedor,
    planId: s.planId,
    referencia: s.referenciaExterna,
    graciaHasta: iso(s.graciaHasta),
    trialHasta: iso(s.trialHasta),
    proximoCobro: iso(s.proximoCobro),
    ultimaConsulta: iso(s.ultimaSyncProveedorEl),
  };
}

@Injectable()
export class SuscripcionesPlataformaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleService,
    private readonly sync: SuscripcionSyncService,
  ) {}

  private integracion() {
    return {
      apiConfigurada: this.paddle.habilitado,
      firmaConfigurada: this.paddle.puedeVerificarFirma,
      entorno:
        process.env.PADDLE_ENV === 'production' ? 'produccion' : 'sandbox',
      consultaAntiguaMinutos: 30,
    };
  }

  private fila(s: Fila, ahora = new Date()) {
    // El trial local se elimina al vincular Paddle; su prueba termina en el próximo cobro.
    const pruebaHasta =
      s.proveedor === 'paddle'
        ? s.estadoProveedor === 'trialing'
          ? s.proximoCobro
          : null
        : s.trialHasta;
    const acceso = resolverAccesoEmpresa(
      s.tenant.activo,
      s,
      s.tenant.bloqueoAccesoMotivo,
      ahora,
    );
    const senales: Array<{ codigo: string; titulo: string; detalle: string }> =
      [];
    if (!s.tenant.activo)
      senales.push({
        codigo: 'bloqueo',
        titulo: 'Bloqueo administrativo',
        detalle: acceso.descripcion,
      });
    if (s.estadoProveedor === 'past_due')
      senales.push({
        codigo: 'mora',
        titulo: 'Pago pendiente',
        detalle:
          s.graciaHasta && s.graciaHasta > ahora
            ? 'La empresa conserva acceso durante la gracia.'
            : 'Revisá el pago y el acceso efectivo de la empresa.',
      });
    if (pruebaHasta && pruebaHasta.getTime() < ahora.getTime() + 3 * 86_400_000)
      senales.push({
        codigo: 'prueba',
        titulo: pruebaHasta <= ahora ? 'Prueba vencida' : 'Prueba por terminar',
        detalle: 'Revisá la continuidad de la empresa.',
      });
    if (s.proveedor === 'paddle' && !s.referenciaExterna)
      senales.push({
        codigo: 'vinculo',
        titulo: 'Sin vínculo con Paddle',
        detalle:
          'Falta la referencia de suscripción. Revisá el alta; no se puede consultar una suscripción sin identificarla.',
      });
    else if (
      s.proveedor === 'paddle' &&
      (!s.ultimaSyncProveedorEl ||
        s.ultimaSyncProveedorEl.getTime() < ahora.getTime() - MEDIA_HORA)
    )
      senales.push({
        codigo: 'consulta',
        titulo: 'Consulta pendiente',
        detalle:
          'Hace más de 30 minutos que no se obtiene una consulta exitosa, o aún no hubo ninguna. Los eventos pueden haber seguido llegando.',
      });
    if (
      s.estado !== 'activa' &&
      !senales.some((x) => x.codigo === 'mora' || x.codigo === 'prueba')
    )
      senales.push({
        codigo: 'inactiva',
        titulo:
          s.estado === 'baja'
            ? 'Suscripción dada de baja'
            : 'Suscripción inactiva',
        detalle:
          'Consultá el estado comercial y el historial antes de intervenir.',
      });
    return {
      id: s.id,
      empresa: {
        id: s.tenant.id,
        nombre: s.tenant.nombre,
        slug: s.tenant.slug,
      },
      plan: {
        id: s.plan.id,
        codigo: s.plan.codigo,
        nombre: contratoSuscripcion(s).nombre,
      },
      proveedor: s.proveedor,
      referencia: s.referenciaExterna,
      estado: s.estado,
      estadoProveedor: s.estadoProveedor,
      acceso,
      senales,
      trialHasta: iso(pruebaHasta),
      graciaHasta: iso(s.graciaHasta),
      moraDesde: iso(s.moraDesde),
      proximoCobro: iso(s.proximoCobro),
      periodoDesde: iso(s.periodoDesde),
      cambioProgramado: s.cambioProgramado,
      cambioProgramadoEl: iso(s.cambioProgramadoEl),
      ultimaConsulta: iso(s.ultimaSyncProveedorEl),
      ultimoEvento: iso(s.ultimoEventoProveedorEl),
      actualizadoProveedorEl: iso(s.actualizadoProveedorEl),
      puedeConsultar:
        s.proveedor === 'paddle' &&
        !!s.referenciaExterna &&
        this.paddle.habilitado,
    };
  }

  async listar(c: ConsultaSuscripciones) {
    const ahora = new Date();
    const desactualizada: Prisma.SuscripcionWhereInput = {
      proveedor: 'paddle',
      OR: [
        { referenciaExterna: null },
        { ultimaSyncProveedorEl: null },
        {
          ultimaSyncProveedorEl: { lt: new Date(ahora.getTime() - MEDIA_HORA) },
        },
      ],
    };
    const prueba: Prisma.SuscripcionWhereInput = {
      OR: [
        {
          proveedor: 'manual',
          trialHasta: {
            not: null,
            lt: new Date(ahora.getTime() + 3 * 86_400_000),
          },
        },
        {
          proveedor: 'paddle',
          estadoProveedor: 'trialing',
          proximoCobro: {
            not: null,
            lt: new Date(ahora.getTime() + 3 * 86_400_000),
          },
        },
      ],
    };
    const casos: Record<string, Prisma.SuscripcionWhereInput> = {
      mora: { estadoProveedor: 'past_due' },
      prueba: {
        OR: [
          { proveedor: 'manual', trialHasta: { not: null } },
          { proveedor: 'paddle', estadoProveedor: 'trialing' },
        ],
      },
      desactualizada,
      bloqueada: { tenant: { activo: false } },
      atencion: {
        OR: [
          desactualizada,
          prueba,
          { estadoProveedor: 'past_due' },
          { estado: { not: 'activa' } },
          { tenant: { activo: false } },
        ],
      },
    };
    const where: Prisma.SuscripcionWhereInput = {
      AND: [
        ...(c.proveedor ? [{ proveedor: c.proveedor }] : []),
        ...(c.caso ? [casos[c.caso]] : []),
        ...(c.q?.trim()
          ? [
              {
                OR: [
                  {
                    tenant: {
                      nombre: {
                        contains: c.q.trim(),
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                  {
                    tenant: {
                      slug: {
                        contains: c.q.trim(),
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                  {
                    referenciaExterna: {
                      contains: c.q.trim(),
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.suscripcion.count({ where }),
      this.prisma.suscripcion.findMany({
        where,
        include,
        orderBy: [{ tenant: { nombre: 'asc' } }, { id: 'asc' }],
        skip: (c.pagina - 1) * c.limite,
        take: c.limite,
      }),
    ]);
    return {
      total,
      pagina: c.pagina,
      limite: c.limite,
      suscripciones: rows.map((s) => this.fila(s, ahora)),
      integracion: this.integracion(),
      consultadoEl: ahora.toISOString(),
    };
  }

  async detalle(id: string) {
    const s = await this.prisma.suscripcion.findUnique({
      where: { id },
      include,
    });
    if (!s) throw new NotFoundException('La suscripción no existe.');
    return { ...this.fila(s), integracion: this.integracion() };
  }

  async cupoUsuarios(id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const s = await tx.suscripcion.findUnique({ where: { id } });
        if (!s) throw new NotFoundException('La suscripción no existe.');
        return {
          ...(await resumenCupoUsuarios(tx, s.tenantId)),
          editable: s.proveedor === 'manual' && !s.referenciaExterna,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async ajustarCupoUsuarios(
    auth: CurrentAuth,
    id: string,
    dto: { adicionales: number; anteriores: number; motivo: string },
  ) {
    const motivo = dto.motivo.trim();
    if (
      !Number.isInteger(dto.adicionales) ||
      dto.adicionales < 0 ||
      dto.adicionales > 10000 ||
      motivo.length < 5 ||
      motivo.length > 300
    )
      throw new BadRequestException(
        'Revisá la cantidad de adicionales y el motivo del ajuste.',
      );
    return this.prisma.$transaction(async (tx) => {
      await this.autorizar(tx, auth);
      const referencia = await tx.suscripcion.findUnique({
        where: { id },
        select: { tenantId: true },
      });
      if (!referencia) throw new NotFoundException('La suscripción no existe.');
      await bloquearCupoUsuarios(tx, referencia.tenantId);
      await exigirSinContratacionPendiente(tx, referencia.tenantId);
      const s = await tx.suscripcion.findUniqueOrThrow({
        where: { id },
        include: { plan: true, planVersion: true },
      });
      if (s.proveedor !== 'manual' || s.referenciaExterna)
        throw new BadRequestException(
          'Los adicionales de suscripciones con cobro automático requieren su integración comercial.',
        );
      if (
        dto.adicionales > 0 &&
        contratoSuscripcion(s).adicionalesPermitidos === false
      )
        throw new BadRequestException(
          'La versión asignada no admite usuarios adicionales.',
        );
      if (s.usuariosAdicionales !== dto.anteriores)
        throw new ConflictException(
          'El cupo cambió. Actualizá la ficha antes de continuar.',
        );
      const antes = await resumenCupoUsuarios(tx, s.tenantId);
      if (antes.incluidos === null)
        throw new BadRequestException(
          'Esta empresa ya tiene usuarios sin límite.',
        );
      if (antes.incluidos + dto.adicionales < antes.ocupados)
        throw new ConflictException(
          `Hay ${antes.ocupados} lugares ocupados. Liberá accesos o invitaciones antes de reducir el cupo.`,
        );
      if (s.usuariosAdicionales === dto.adicionales) return antes;
      await tx.suscripcion.update({
        where: { id },
        data: { usuariosAdicionales: dto.adicionales },
      });
      await tx.plataformaEvento.create({
        data: {
          staffUserId: auth.userId,
          tenantAfectadoId: s.tenantId,
          tipo: 'suscripcion_cupo_usuarios_ajustado',
          descripcion: `Usuarios adicionales: ${s.usuariosAdicionales} → ${dto.adicionales}. ${motivo}`,
          datosJson: {
            suscripcionId: id,
            motivo,
            anteriores: s.usuariosAdicionales,
            adicionales: dto.adicionales,
            ocupados: antes.ocupados,
          },
        },
      });
      return resumenCupoUsuarios(tx, s.tenantId);
    });
  }

  async eventos(id: string, pagina: number, limite: number) {
    const s = await this.prisma.suscripcion.findUnique({
      where: { id },
      select: { referenciaExterna: true },
    });
    if (!s) throw new NotFoundException('La suscripción no existe.');
    if (!s.referenciaExterna) return { total: 0, pagina, limite, eventos: [] };
    const where = {
      proveedor: 'paddle',
      referenciaSuscripcion: s.referenciaExterna,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.eventoCobro.count({ where }),
      this.prisma.eventoCobro.findMany({
        where,
        orderBy: [{ recibidoEl: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * limite,
        take: limite,
        select: {
          id: true,
          eventoId: true,
          tipo: true,
          resultado: true,
          ocurridoEl: true,
          recibidoEl: true,
          procesadoEl: true,
          errorTexto: true,
        },
      }),
    ]);
    return {
      total,
      pagina,
      limite,
      eventos: rows.map((e) => {
        const resultado =
          e.resultado ??
          (!e.procesadoEl
            ? e.errorTexto
              ? 'fallido'
              : 'pendiente'
            : !e.tipo.startsWith('subscription.')
              ? 'ignorado'
              : e.errorTexto
                ? 'sin_aplicar'
                : 'aplicado');
        // Nunca devolver payloads ni excepciones históricas: pueden contener datos de terceros.
        const detalle =
          resultado === 'sin_aplicar'
            ? /anterior|más reciente/i.test(e.errorTexto ?? '')
              ? 'Llegó un estado anterior. Grafo conservó el más reciente.'
              : 'El evento se recibió pero no pudo actualizar esta suscripción. Consultá el estado actual de Paddle.'
            : resultado === 'ignorado'
              ? 'Registrado como información; este tipo de evento no modifica el acceso.'
              : resultado === 'fallido'
                ? 'Falló el procesamiento. Paddle puede reintentar; también podés consultar su estado actual.'
                : resultado === 'pendiente'
                  ? 'Recibido; aún no hay un resultado de procesamiento.'
                  : e.errorTexto?.startsWith('Se aplicó el estado de cobro conservando el contrato anterior:')
                    ? 'Estado de cobro aplicado. Los ítems requieren revisión; se conservó la versión anterior del contrato.'
                    : 'Grafo aplicó el estado informado por Paddle.';
        return {
          id: e.id,
          eventoId: e.eventoId,
          tipo: e.tipo,
          resultado,
          detalle,
          ocurridoEl: iso(e.ocurridoEl),
          recibidoEl: iso(e.recibidoEl),
          procesadoEl: iso(e.procesadoEl),
        };
      }),
    };
  }

  async historial(id: string, pagina: number, limite: number) {
    const s = await this.prisma.suscripcion.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (!s) throw new NotFoundException('La suscripción no existe.');
    const where = { suscripcionId: id, tenantId: s.tenantId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.sincronizacionPaddle.count({ where }),
      this.prisma.sincronizacionPaddle.findMany({
        where,
        orderBy: [{ creadaEl: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * limite,
        take: limite,
        include: { staff: { select: { nombreCompleto: true, email: true } } },
      }),
    ]);
    return {
      total,
      pagina,
      limite,
      operaciones: rows.map((o) => ({
        ...o,
        actor: o.staff.nombreCompleto ?? o.staff.email,
        estado:
          o.estado === 'en_curso' &&
          Date.now() - o.creadaEl.getTime() > DOS_MINUTOS
            ? 'interrumpida'
            : o.estado,
        staff: undefined,
      })),
    };
  }

  private async autorizar(tx: Prisma.TransactionClient, auth: CurrentAuth) {
    if (!auth.esPlataforma || auth.impersonacion || auth.mcp)
      throw new ForbiddenException(
        'Ingresá con una sesión personal de Plataforma.',
      );
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${auth.userId}::uuid FOR UPDATE`;
    const u = await tx.user.findUnique({
      where: { id: auth.userId },
      include: { mfa: true },
    });
    const sesion = await tx.authSession.findFirst({
      where: {
        id: auth.sessionId,
        userId: auth.userId,
        currentTenantId: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (
      !u?.activo ||
      u.rolPlataforma !== 'ADMIN' ||
      !sesion ||
      !mfaPlataformaCompleta(u.mfa, sesion.mfaVerificadoEl)
    )
      throw new ForbiddenException(
        'La consulta requiere una sesión vigente de Administración con MFA.',
      );
  }

  async sincronizar(
    auth: CurrentAuth,
    id: string,
    solicitudId: string,
    motivo: string,
  ) {
    motivo = motivo.trim();
    if (motivo.length < 5 || motivo.length > 300)
      throw new BadRequestException(
        'Indicá un motivo de entre 5 y 300 caracteres.',
      );
    const inicio = await this.prisma.$transaction(async (tx) => {
      await this.autorizar(tx, auth);
      // Lock específico de la suscripción: distintos operadores no disparan la misma consulta.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`consulta-paddle:${id}`}, 0))::text`;
      const anterior = await tx.sincronizacionPaddle.findUnique({
        where: { id: solicitudId },
      });
      if (anterior) {
        if (
          anterior.suscripcionId !== id ||
          anterior.staffUserId !== auth.userId ||
          anterior.motivo !== motivo
        )
          throw new ConflictException(
            'La solicitud ya corresponde a otra operación.',
          );
        return { operacion: anterior, nueva: false };
      }
      const s = await tx.suscripcion.findUnique({ where: { id } });
      if (!s) throw new NotFoundException('La suscripción no existe.');
      if (s.proveedor !== 'paddle' || !s.referenciaExterna)
        throw new BadRequestException(
          'Esta suscripción no tiene un vínculo consultable con Paddle.',
        );
      if (!this.paddle.habilitado)
        throw new BadRequestException(
          'La API de Paddle no está configurada en este entorno.',
        );
      const activas = await tx.sincronizacionPaddle.findMany({
        where: { suscripcionId: id, estado: 'en_curso' },
      });
      if (activas.some((o) => Date.now() - o.creadaEl.getTime() <= DOS_MINUTOS))
        throw new ConflictException(
          'Ya hay una consulta en curso. Actualizá el historial en unos segundos.',
        );
      await tx.sincronizacionPaddle.updateMany({
        where: { suscripcionId: id, estado: 'en_curso' },
        data: {
          estado: 'interrumpida',
          detalle:
            'La consulta no registró un resultado a tiempo. Se habilitó una nueva consulta.',
          finalizadaEl: new Date(),
        },
      });
      const operacion = await tx.sincronizacionPaddle.create({
        data: {
          id: solicitudId,
          tenantId: s.tenantId,
          suscripcionId: s.id,
          referencia: s.referenciaExterna,
          staffUserId: auth.userId,
          motivo,
          antesJson: resumen(s),
        },
      });
      await tx.plataformaEvento.create({
        data: {
          staffUserId: auth.userId,
          tenantAfectadoId: s.tenantId,
          tipo: 'suscripcion_consulta_solicitada',
          descripcion: `Consulta del estado de Paddle. Motivo: ${motivo}`,
          datosJson: { operacionId: solicitudId, suscripcionId: s.id },
        },
      });
      return { operacion, nueva: true };
    });
    if (!inicio.nueva) return inicio.operacion;
    const op = inicio.operacion;
    const consultadaDesde = new Date();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // La consulta es de lectura. Una respuesta tardía nunca se aplica después del timeout.
      const remoto = await Promise.race([
        this.paddle.obtenerSuscripcion(op.referencia),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), 20_000);
        }),
      ]);
      const externa = this.sync.extraer(remoto);
      if (!externa || externa.referencia !== op.referencia)
        throw new Error('consulta_sin_respuesta_valida');
      return await this.prisma.$transaction(async (tx) => {
        await this.autorizar(tx, auth);
        await tx.$queryRaw`SELECT id FROM "SincronizacionPaddle" WHERE id = ${op.id}::uuid FOR UPDATE`;
        const actual = await tx.sincronizacionPaddle.findUniqueOrThrow({
          where: { id: op.id },
        });
        if (actual.estado !== 'en_curso') return actual;
        const s = await tx.suscripcion.findUnique({ where: { id } });
        if (
          !s ||
          s.proveedor !== 'paddle' ||
          s.referenciaExterna !== op.referencia ||
          (externa.tenantId && externa.tenantId !== s.tenantId)
        )
          throw new ConflictException(
            'El vínculo de la suscripción cambió. Se requiere una nueva consulta.',
          );
        const r = await this.sync.aplicarEnTransaccion(tx, externa, {
          origen: 'reconciliacion',
          consultadaDesde,
          suscripcionEsperada: {
            id,
            tenantId: op.tenantId,
            referencia: op.referencia,
          },
        });
        const despues = await tx.suscripcion.findUniqueOrThrow({
          where: { id },
        });
        const estado = r.aplicado
          ? r.planCodigo
            ? 'completada'
            : 'revisar'
          : 'sin_aplicar';
        const detalle = r.aplicado
          ? r.planCodigo
            ? 'Estado de Paddle consultado y actualizado en Grafo.'
            : 'Estado actualizado. El precio de Paddle no está vinculado a un plan de Grafo: se conservó el plan anterior. Revisá Planes y precios.'
          : 'La respuesta no se aplicó. Se conservó el estado local; revisá el diagnóstico y los eventos.';
        const resultado = await tx.sincronizacionPaddle.update({
          where: { id: op.id },
          data: {
            estado,
            detalle,
            despuesJson: resumen(despues),
            finalizadaEl: new Date(),
          },
        });
        await tx.plataformaEvento.create({
          data: {
            staffUserId: auth.userId,
            tenantAfectadoId: op.tenantId,
            tipo: `suscripcion_consulta_${estado}`,
            descripcion: detalle,
            datosJson: {
              operacionId: op.id,
              antes: op.antesJson,
              despues: resumen(despues),
            },
          },
        });
        return resultado;
      });
    } catch (error) {
      const detalle =
        error instanceof ForbiddenException
          ? 'El operador perdió autorización durante la consulta. No se aplicó la respuesta.'
          : error instanceof ConflictException
            ? 'El vínculo de la suscripción cambió durante la consulta. No se aplicó la respuesta.'
            : 'No se pudo completar la consulta. Revisá la conexión y configuración de Paddle y volvé a consultar. El resultado se puede verificar en el historial.';
      return this.prisma.$transaction(async (tx) => {
        const cambio = await tx.sincronizacionPaddle.updateMany({
          where: { id: op.id, estado: 'en_curso' },
          data: { estado: 'fallida', detalle, finalizadaEl: new Date() },
        });
        if (cambio.count)
          await tx.plataformaEvento.create({
            data: {
              staffUserId: auth.userId,
              tenantAfectadoId: op.tenantId,
              tipo: 'suscripcion_consulta_fallida',
              descripcion: detalle,
              datosJson: { operacionId: op.id },
            },
          });
        return tx.sincronizacionPaddle.findUniqueOrThrow({
          where: { id: op.id },
        });
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
