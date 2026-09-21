import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, type PlanBorrador } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';
import { mfaPlataformaCompleta } from '../../auth/enrolamiento-plataforma';
import {
  CATALOGO_PLANES,
  GRUPOS_PLANES,
  VERSION_CATALOGO_PLANES,
  type BorradorPlan,
  type ContenidoPlan,
} from './catalogo-planes';
import { problemasPlan } from './validacion-planes';
import type { GuardarPlanesDto } from './planes-borradores.controller';

function serializar(p: PlanBorrador): BorradorPlan {
  return {
    id: p.id,
    codigo: p.codigo,
    orden: p.orden,
    revision: p.revision,
    catalogoVersion: p.catalogoVersion,
    actualizadoEl: p.actualizadoEl.toISOString(),
    contenido: p.contenido as unknown as ContenidoPlan,
  };
}

@Injectable()
export class PlanesBorradoresService {
  constructor(private readonly prisma: PrismaService) {}
  async listar() {
    const borradores = await this.prisma.planBorrador.findMany({
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    });
    return {
      catalogoVersion: VERSION_CATALOGO_PLANES,
      capacidades: CATALOGO_PLANES,
      grupos: GRUPOS_PLANES,
      borradores: borradores.map(serializar),
    };
  }
  async guardar(auth: CurrentAuth, dto: GuardarPlanesDto) {
    if (
      !auth.esPlataforma ||
      auth.impersonacion ||
      auth.mcp ||
      auth.plataformaMfaPendiente !== false
    )
      throw new ForbiddenException(
        'Usá una sesión personal de administración de Plataforma.',
      );
    if (dto.catalogoVersion !== VERSION_CATALOGO_PLANES)
      throw new ConflictException(
        'El catálogo cambió. Volvé a cargar los planes antes de guardar.',
      );
    if (
      !dto.cambios?.length ||
      dto.cambios.length > 20 ||
      new Set(dto.cambios.map((p) => p.id)).size !== dto.cambios.length
    )
      throw new BadRequestException('La lista de borradores no es válida.');
    for (const p of dto.cambios) {
      if (!p.contenido || !Number.isInteger(p.revision) || p.revision < 1)
        throw new BadRequestException('Borrador inválido.');
      const errores = problemasPlan(p.contenido);
      if (errores.length) throw new BadRequestException(errores);
    }
    return this.prisma.$transaction(async (tx) => {
      // Mismo lock que la gestión de equipo: una revocación de staff no puede
      // intercalarse entre la comprobación de permisos y el guardado.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(724611, 1)::text`;
      const actor = await tx.user.findUnique({
        where: { id: auth.userId },
        select: {
          activo: true,
          rolPlataforma: true,
          mfa: {
            select: { activatedAt: true, recuperacionConfirmadaEl: true },
          },
        },
      });
      const sesion = await tx.authSession.findFirst({
        where: {
          id: auth.sessionId,
          userId: auth.userId,
          currentTenantId: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { mfaVerificadoEl: true },
      });
      if (
        !actor?.activo ||
        actor.rolPlataforma !== 'ADMIN' ||
        !sesion ||
        !mfaPlataformaCompleta(actor.mfa, sesion.mfaVerificadoEl)
      )
        throw new ForbiddenException(
          'Esta acción requiere una sesión vigente de administración de Plataforma.',
        );
      const guardados: BorradorPlan[] = [];
      // Orden estable para que dos guardados de varios planes no se bloqueen en orden inverso.
      for (const cambio of [...dto.cambios].sort((a, b) =>
        a.id.localeCompare(b.id),
      )) {
        const anterior = await tx.planBorrador.findUnique({
          where: { id: cambio.id },
        });
        if (
          !anterior ||
          anterior.revision !== cambio.revision ||
          anterior.catalogoVersion !== dto.catalogoVersion
        )
          throw new ConflictException(
            'Otro integrante actualizó estos planes. Tus cambios siguen en pantalla; recargá para comparar con la versión guardada.',
          );
        const contenido = {
          ...cambio.contenido,
          nombre: cambio.contenido.nombre.trim(),
          descripcion: cambio.contenido.descripcion.trim(),
        };
        const update = await tx.planBorrador.updateMany({
          where: {
            id: cambio.id,
            revision: cambio.revision,
            catalogoVersion: dto.catalogoVersion,
          },
          data: {
            contenido: contenido as unknown as Prisma.InputJsonValue,
            revision: { increment: 1 },
          },
        });
        if (update.count !== 1)
          throw new ConflictException(
            'El borrador cambió mientras guardabas. Recargá antes de volver a intentarlo.',
          );
        await tx.plataformaEvento.create({
          data: {
            staffUserId: auth.userId,
            tipo: 'plan_borrador_actualizado',
            descripcion: `Actualizó ${contenido.nombre} · revisión ${cambio.revision + 1}`,
            datosJson: {
              borradorId: cambio.id,
              revisionAnterior: cambio.revision,
              antes: anterior.contenido,
              despues: contenido,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        guardados.push(
          serializar(
            await tx.planBorrador.findUniqueOrThrow({
              where: { id: cambio.id },
            }),
          ),
        );
      }
      return { borradores: guardados };
    });
  }
}
