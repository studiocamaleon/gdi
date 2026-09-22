import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type PlanVersion } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAuth } from '../../auth/auth.types';
import {
  CATALOGO_PLANES,
  GRUPOS_PLANES,
  VERSION_CATALOGO_PLANES,
  type ContenidoPlan,
} from './catalogo-planes';
import { problemasPublicacionPlan } from './validacion-planes';
import { autorizarEdicionPlanes } from './autorizar-edicion-planes';
import type { PublicarPlanDto } from './planes-versiones.controller';
import type { HistorialPlanes, VersionPlan } from './versiones-planes';

function serializar(p: PlanVersion): VersionPlan {
  return {
    id: p.id,
    borradorId: p.borradorId,
    codigo: p.codigo,
    numero: p.numero,
    revisionBorrador: p.revisionBorrador,
    catalogoVersion: p.catalogoVersion,
    publicadoPorNombre: p.publicadoPorNombre,
    motivo: p.motivo,
    publicadoEl: p.publicadoEl.toISOString(),
    contenido: p.contenido as unknown as ContenidoPlan,
    catalogoSnapshot:
      p.catalogoSnapshot as unknown as VersionPlan['catalogoSnapshot'],
  };
}

@Injectable()
export class PlanesVersionesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(borradorId: string, antes?: number): Promise<HistorialPlanes> {
    if (antes !== undefined && (!Number.isInteger(antes) || antes < 1))
      throw new BadRequestException('El cursor del historial no es válido.');
    if (
      !(await this.prisma.planBorrador.findUnique({
        where: { id: borradorId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('No se encontró el borrador.');
    const filas = await this.prisma.planVersion.findMany({
      where: { borradorId, ...(antes ? { numero: { lt: antes } } : {}) },
      orderBy: { numero: 'desc' },
      take: 21,
      omit: { catalogoSnapshot: true, publicadoPorId: true },
    });
    return {
      versiones: filas.slice(0, 20).map((p) => ({
        ...p,
        publicadoEl: p.publicadoEl.toISOString(),
        contenido: p.contenido as unknown as ContenidoPlan,
      })),
      siguiente: filas.length > 20 ? filas[19].numero : null,
    };
  }

  async detalle(id: string): Promise<VersionPlan> {
    const version = await this.prisma.planVersion.findUnique({ where: { id } });
    if (!version) throw new NotFoundException('No se encontró la versión.');
    return serializar(version);
  }

  async publicar(
    auth: CurrentAuth,
    borradorId: string,
    dto: PublicarPlanDto,
  ): Promise<VersionPlan> {
    if (
      !Number.isInteger(dto.revision) ||
      dto.revision < 1 ||
      typeof dto.motivo !== 'string' ||
      dto.motivo.trim().length < 5 ||
      dto.motivo.trim().length > 500
    )
      throw new BadRequestException(
        'Indicá la revisión y un motivo de entre 5 y 500 caracteres.',
      );
    return this.prisma.$transaction(async (tx) => {
      const actor = await autorizarEdicionPlanes(tx, auth);
      // La revisión guardada identifica la operación: reintentar devuelve la misma versión.
      const publicada = await tx.planVersion.findUnique({
        where: {
          borradorId_revisionBorrador: {
            borradorId,
            revisionBorrador: dto.revision,
          },
        },
      });
      if (publicada) {
        if (publicada.catalogoVersion !== dto.catalogoVersion)
          throw new ConflictException(
            'La versión corresponde a otro catálogo. Recargá los planes.',
          );
        return serializar(publicada);
      }
      const borrador = await tx.planBorrador.findUnique({
        where: { id: borradorId },
      });
      if (!borrador) throw new NotFoundException('No se encontró el borrador.');
      if (
        dto.catalogoVersion !== VERSION_CATALOGO_PLANES ||
        borrador.catalogoVersion !== dto.catalogoVersion ||
        borrador.revision !== dto.revision
      )
        throw new ConflictException(
          'El borrador o el catálogo cambió. Recargá y revisá su contenido antes de publicar.',
        );
      const contenido = borrador.contenido as unknown as ContenidoPlan;
      const problemas = problemasPublicacionPlan(contenido);
      if (problemas.length) throw new BadRequestException(problemas);
      const ultima = await tx.planVersion.findFirst({
        where: { borradorId },
        orderBy: { numero: 'desc' },
      });
      const version = await tx.planVersion.create({
        data: {
          borradorId,
          codigo: borrador.codigo,
          numero: (ultima?.numero ?? 0) + 1,
          revisionBorrador: borrador.revision,
          catalogoVersion: borrador.catalogoVersion,
          contenido: borrador.contenido as Prisma.InputJsonValue,
          catalogoSnapshot: {
            capacidades: CATALOGO_PLANES,
            grupos: GRUPOS_PLANES,
          } as unknown as Prisma.InputJsonValue,
          publicadoPorId: auth.userId,
          publicadoPorNombre:
            actor.nombreCompleto?.trim() || 'Administración de Plataforma',
          motivo: dto.motivo.trim(),
        },
      });
      await tx.plataformaEvento.create({
        data: {
          staffUserId: auth.userId,
          tipo: 'plan_version_publicada',
          descripcion: `Publicó ${contenido.nombre} · versión ${version.numero}`,
          datosJson: {
            versionId: version.id,
            borradorId,
            revisionBorrador: version.revisionBorrador,
            numero: version.numero,
            catalogoVersion: version.catalogoVersion,
            motivo: version.motivo,
          },
        },
      });
      return serializar(version);
    });
  }
}
