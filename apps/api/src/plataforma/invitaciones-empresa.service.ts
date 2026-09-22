import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Invitation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CorreoTransaccionalService } from '../registro/correo-transaccional.service';
import {
  bloquearCupoUsuarios,
  exigirCupoUsuario,
} from '../suscripciones/cupos-usuarios';
import { contratoSuscripcion } from '../suscripciones/contrato-suscripcion';
import type { ContenidoPlan } from './planes/catalogo-planes';

export function presentarInvitacionEmpresa(i: Invitation) {
  return {
    id: i.id,
    email: i.email,
    venceEl: i.expiresAt.toISOString(),
    aceptadaEl: i.acceptedAt?.toISOString() ?? null,
    correoEstado: i.correoEstado ?? 'sin_enviar',
    ultimoIntentoEl: i.correoIntentoEl?.toISOString() ?? null,
    enviadoEl: i.correoEnviadoEl?.toISOString() ?? null,
  };
}

@Injectable()
export class InvitacionesEmpresaService {
  private readonly logger = new Logger(InvitacionesEmpresaService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoTransaccionalService,
  ) {}

  /** Se ejecuta DESPUÉS del commit del alta: un fallo de transporte nunca
   * informa que falló crear la empresa ni invita a crearla una segunda vez. */
  async enviar(
    staffUserId: string,
    tenantId: string,
    invitacionId: string,
    rawToken: string,
  ) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const i = await this.prisma.invitation.findFirst({
      where: {
        id: invitacionId,
        tenantId,
        tokenHash,
        invitedByMembershipId: null,
        rol: 'ADMINISTRADOR',
        revokedAt: null,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        tenant: {
          include: {
            suscripcion: {
              include: {
                plan: true,
                planVersion: true,
                oferta: { include: { precios: true } },
              },
            },
          },
        },
      },
    });
    if (!i) throw new NotFoundException('La invitación ya no está pendiente.');
    const s = i.tenant.suscripcion;
    const contenido = s?.planVersion?.contenido as ContenidoPlan | undefined;
    const precioMensual = s?.oferta?.precios.find(
      (p) => p.tipo === 'base' && p.ciclo === 'mensual',
    );
    const base = (
      process.env.REGISTRO_PUBLICO_URL ??
      process.env.FRONTEND_URL?.split(',')[0]?.trim() ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
    const invitacionUrl = `${base}/aceptar-invitacion?token=${rawToken}`;
    let proveedorId: string | null = null;
    let estado = 'error';
    try {
      const enviado = await this.correo.enviarInvitacionEmpresa(
        {
          para: i.email,
          empresa: i.tenant.nombre,
          plan: contratoSuscripcion(s).nombre,
          url: invitacionUrl,
          venceEl: i.expiresAt,
          trialHasta: s?.trialHasta ?? null,
          moneda:
            precioMensual?.moneda ??
            contenido?.precios?.moneda ??
            s?.plan.moneda ??
            'USD',
          mensual: s?.oferta
            ? precioMensual
              ? Number(precioMensual.importe)
              : null
            : contenido?.precios
              ? contenido.precios.mensual
              : s && !s.plan.precioAConsultar
                ? Number(s.plan.precioMensual)
                : null,
          implementacion: contenido?.comercial?.implementacion ?? null,
        },
        { idempotencyKey: `invitacion-empresa/${i.id}/${tokenHash}` },
      );
      proveedorId = enviado.id;
      estado = 'enviado';
    } catch {
      this.logger.warn(`No se confirmó el envío de la invitación ${i.id}.`);
    }
    try {
      const actual = await this.prisma.$transaction(async (tx) => {
        const actualizado = await tx.invitation.updateMany({
          where: { id: i.id, tenantId, tokenHash },
          data: {
            correoEstado: estado,
            correoProveedorId: proveedorId,
            correoEnviadoEl: estado === 'enviado' ? new Date() : null,
          },
        });
        if (actualizado.count)
          await tx.plataformaEvento.create({
            data: {
              staffUserId,
              tenantAfectadoId: tenantId,
              tipo:
                estado === 'enviado'
                  ? 'invitacion_empresa_enviada'
                  : 'invitacion_empresa_envio_fallido',
              descripcion:
                estado === 'enviado'
                  ? `Envió la invitación de acceso a ${i.email}.`
                  : `No se confirmó el envío de la invitación a ${i.email}. La empresa sigue creada.`,
              datosJson: {
                invitacionId: i.id,
                proveedorMensajeId: proveedorId,
              },
            },
          });
        return tx.invitation.findUniqueOrThrow({
          where: { id: i.id, tenantId },
        });
      });
      return {
        tenantId,
        invitacionUrl:
          actual.tokenHash === tokenHash ? invitacionUrl : undefined,
        invitacion: presentarInvitacionEmpresa(actual),
      };
    } catch {
      // El proveedor puede haber aceptado el correo. No repetir el alta ni
      // prometer un estado persistido si la confirmación local falló.
      this.logger.error(
        `No se pudo registrar el resultado de correo de ${i.id}.`,
      );
      return {
        tenantId,
        invitacionUrl,
        invitacion: {
          ...presentarInvitacionEmpresa(i),
          correoEstado: 'sin_confirmar',
        },
      };
    }
  }

  async reenviar(staffUserId: string, tenantId: string) {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const i = await this.prisma.$transaction(async (tx) => {
      await bloquearCupoUsuarios(tx, tenantId);
      const invitacion = await tx.invitation.findFirst({
        where: {
          tenantId,
          invitedByMembershipId: null,
          rol: 'ADMINISTRADOR',
          revokedAt: null,
          acceptedAt: null,
          tenant: { activo: true, origenAlta: 'plataforma' },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!invitacion)
        throw new NotFoundException(
          'No hay una invitación de administrador pendiente para esta empresa.',
        );
      const ahora = new Date();
      const transcurrido =
        ahora.getTime() - (invitacion.correoIntentoEl?.getTime() ?? 0);
      if (
        transcurrido <
        (invitacion.correoEstado === 'enviando' ? 120_000 : 60_000)
      ) {
        throw new ConflictException(
          'Esperá un momento antes de reenviar la invitación. El envío anterior puede seguir en curso.',
        );
      }
      const suscripcion = await tx.suscripcion.findUnique({
        where: { tenantId },
      });
      if (suscripcion?.trialHasta && suscripcion.trialHasta <= ahora) {
        throw new BadRequestException(
          'La prueba ya venció. Revisá la suscripción antes de renovar la invitación.',
        );
      }
      await exigirCupoUsuario(tx, tenantId, {
        email: invitacion.email,
        userId: invitacion.userId,
      });
      const actualizada = await tx.invitation.update({
        where: { id: invitacion.id, tenantId },
        data: {
          tokenHash,
          expiresAt: new Date(ahora.getTime() + 7 * 86400000),
          correoEstado: 'enviando',
          correoIntentoEl: ahora,
          correoEnviadoEl: null,
          correoProveedorId: null,
        },
      });
      await tx.plataformaEvento.create({
        data: {
          staffUserId,
          tenantAfectadoId: tenantId,
          tipo: 'invitacion_empresa_renovada',
          descripcion: `Renovó el enlace de invitación para ${invitacion.email}; el enlace anterior deja de ser válido.`,
          datosJson: { invitacionId: invitacion.id },
        },
      });
      return actualizada;
    });
    return this.enviar(staffUserId, tenantId, i.id, rawToken);
  }
}
