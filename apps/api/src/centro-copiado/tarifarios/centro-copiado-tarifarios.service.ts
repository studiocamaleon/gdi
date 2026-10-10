import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type CentroCopiadoTarifarioVersion } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { CentroCopiadoAuditoriaService } from '../centro-copiado-auditoria.service';
import {
  validarContenidoTarifario,
  type ContenidoTarifario,
} from './contenido-tarifario';
import type {
  CrearTarifarioDto,
  EditarTarifarioDto,
  PublicarTarifarioDto,
} from './tarifarios.dto';

const resumenVersion = {
  id: true,
  numero: true,
  revisionBorrador: true,
  nombre: true,
  tipoVigencia: true,
  vigenteDesde: true,
  publicadoEl: true,
  publicadoPorId: true,
} satisfies Prisma.CentroCopiadoTarifarioVersionSelect;

function nombreValido(nombre: string) {
  const limpio = nombre.trim();
  if (!limpio || limpio.length > 120)
    throw new BadRequestException('Ingresá un nombre de hasta 120 caracteres.');
  return limpio;
}

function fechaSolicitada(dto: PublicarTarifarioDto): Date | null {
  if (dto.tipoVigencia === 'INMEDIATA') {
    if (dto.vigenteDesde !== undefined)
      throw new BadRequestException(
        'La vigencia inmediata usa la hora del servidor.',
      );
    return null;
  }
  const fecha = z.iso.datetime({ offset: true }).safeParse(dto.vigenteDesde);
  if (!fecha.success || /\.\d{4,}/.test(fecha.data)) {
    throw new BadRequestException(
      'Indicá una fecha ISO con zona horaria y hasta milisegundos.',
    );
  }
  return new Date(fecha.data);
}

function comprobarReintento(
  version: CentroCopiadoTarifarioVersion,
  dto: PublicarTarifarioDto,
  fecha: Date | null,
) {
  if (
    version.tipoVigencia !== dto.tipoVigencia ||
    (fecha && version.vigenteDesde.getTime() !== fecha.getTime())
  ) {
    throw new ConflictException(
      'Esa revisión ya se publicó con otra vigencia. Recargá el tarifario.',
    );
  }
  return version;
}

@Injectable()
export class CentroCopiadoTarifariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: CentroCopiadoAuditoriaService,
  ) {}

  async listar(tenantId: string, desplazamiento = 0) {
    const filas = await this.prisma.centroCopiadoTarifario.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: desplazamiento,
      take: 51,
      select: {
        id: true,
        nombre: true,
        revision: true,
        ultimoNumero: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return {
      items: filas.slice(0, 50),
      siguiente: filas.length > 50 ? desplazamiento + 50 : null,
    };
  }

  async obtener(
    tenantId: string,
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const borrador = await db.centroCopiadoTarifario.findFirst({
      where: { id, tenantId },
    });
    if (!borrador) throw new NotFoundException('Tarifario inexistente.');
    return borrador;
  }

  async versiones(tenantId: string, id: string, desplazamiento = 0) {
    await this.obtener(tenantId, id);
    const filas = await this.prisma.centroCopiadoTarifarioVersion.findMany({
      where: { tenantId, tarifarioId: id },
      orderBy: { numero: 'desc' },
      skip: desplazamiento,
      take: 51,
      select: resumenVersion,
    });
    return {
      items: filas.slice(0, 50),
      siguiente: filas.length > 50 ? desplazamiento + 50 : null,
    };
  }

  async version(tenantId: string, tarifarioId: string, id: string) {
    const version = await this.prisma.centroCopiadoTarifarioVersion.findFirst({
      where: { id, tenantId, tarifarioId },
    });
    if (!version) throw new NotFoundException('Versión inexistente.');
    return version;
  }

  /** Sólo resuelve dentro de un tarifario; no asigna políticas ni recalcula pedidos. */
  async vigente(tenantId: string, tarifarioId: string, ahora = new Date()) {
    await this.obtener(tenantId, tarifarioId);
    return this.prisma.centroCopiadoTarifarioVersion.findFirst({
      where: { tenantId, tarifarioId, vigenteDesde: { lte: ahora } },
      orderBy: [{ vigenteDesde: 'desc' }, { numero: 'desc' }],
    });
  }

  private async validarPapeles(
    db: Prisma.TransactionClient,
    tenantId: string,
    contenido: ContenidoTarifario,
  ) {
    const ids = [
      ...new Set([
        ...(contenido.hojas?.filas ?? []).map(
          (f) => f.combinacion.papelMateriaPrimaId,
        ),
        ...(contenido.cad?.filas ?? []).map(
          (f) => f.combinacion.papelMateriaPrimaId,
        ),
      ]),
    ];
    if (!ids.length) return;
    const propios = await db.materiaPrima.count({
      where: { tenantId, id: { in: ids } },
    });
    if (propios !== ids.length)
      throw new BadRequestException(
        'El tarifario contiene papeles inexistentes o ajenos a la empresa.',
      );
    // La oferta y producibilidad se verifican al cotizar/activar, no se habilitan al guardar precios.
  }

  async crear(tenantId: string, actorUserId: string, dto: CrearTarifarioDto) {
    const nombre = nombreValido(dto.nombre);
    const contenido = validarContenidoTarifario(dto.contenido);
    return this.prisma.$transaction(async (tx) => {
      await this.validarPapeles(tx, tenantId, contenido);
      const borrador = await tx.centroCopiadoTarifario.create({
        data: { tenantId, nombre, contenido },
      });
      await this.auditoria.registrar(tx, {
        tenantId,
        actorUserId,
        tipo: 'TARIFARIO_CREADO',
        descripcion: 'Borrador de tarifario creado.',
        datos: { tarifarioId: borrador.id, revision: borrador.revision },
      });
      return borrador;
    });
  }

  async editar(
    tenantId: string,
    id: string,
    actorUserId: string,
    dto: EditarTarifarioDto,
  ) {
    const nombre = nombreValido(dto.nombre);
    const contenido = validarContenidoTarifario(dto.contenido);
    return this.prisma.$transaction(async (tx) => {
      await this.obtener(tenantId, id, tx);
      await this.validarPapeles(tx, tenantId, contenido);
      const cambio = await tx.centroCopiadoTarifario.updateMany({
        where: { id, tenantId, revision: dto.revision },
        data: { nombre, contenido, revision: { increment: 1 } },
      });
      if (cambio.count !== 1)
        throw new ConflictException(
          'El borrador cambió. Recargalo antes de guardar.',
        );
      const borrador = await this.obtener(tenantId, id, tx);
      await this.auditoria.registrar(tx, {
        tenantId,
        actorUserId,
        tipo: 'TARIFARIO_EDITADO',
        descripcion: 'Borrador de tarifario actualizado.',
        datos: { tarifarioId: id, revision: borrador.revision },
      });
      return borrador;
    });
  }

  async publicar(
    tenantId: string,
    id: string,
    actorUserId: string,
    dto: PublicarTarifarioDto,
  ) {
    const fecha = fechaSolicitada(dto);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const whereRevision = {
          tenantId,
          tarifarioId: id,
          revisionBorrador: dto.revision,
        };
        const anterior = await tx.centroCopiadoTarifarioVersion.findFirst({
          where: whereRevision,
        });
        if (anterior) return comprobarReintento(anterior, dto, fecha);
        const borrador = await this.obtener(tenantId, id, tx);
        if (borrador.revision !== dto.revision) {
          const concurrente = await tx.centroCopiadoTarifarioVersion.findFirst({
            where: whereRevision,
          });
          if (concurrente) return comprobarReintento(concurrente, dto, fecha);
          throw new ConflictException(
            'El borrador cambió. Revisalo antes de publicar.',
          );
        }
        const contenido = validarContenidoTarifario(borrador.contenido);
        await this.validarPapeles(tx, tenantId, contenido);
        const ahora = new Date();
        if (fecha && fecha <= ahora)
          throw new BadRequestException(
            'La publicación programada debe tener una fecha futura.',
          );
        const cambio = await tx.centroCopiadoTarifario.updateMany({
          where: { id, tenantId, revision: dto.revision },
          data: { revision: { increment: 1 }, ultimoNumero: { increment: 1 } },
        });
        if (cambio.count !== 1) {
          const concurrente = await tx.centroCopiadoTarifarioVersion.findFirst({
            where: whereRevision,
          });
          if (concurrente) return comprobarReintento(concurrente, dto, fecha);
          throw new ConflictException(
            'El borrador cambió. Revisalo antes de publicar.',
          );
        }
        const actualizado = await this.obtener(tenantId, id, tx);
        const version = await tx.centroCopiadoTarifarioVersion.create({
          data: {
            tenantId,
            tarifarioId: id,
            numero: actualizado.ultimoNumero,
            revisionBorrador: dto.revision,
            nombre: borrador.nombre,
            contenido,
            tipoVigencia: dto.tipoVigencia,
            vigenteDesde: fecha ?? ahora,
            publicadoPorId: actorUserId,
            publicadoEl: ahora,
          },
        });
        await this.auditoria.registrar(tx, {
          tenantId,
          actorUserId,
          tipo: 'TARIFARIO_PUBLICADO',
          descripcion: 'Versión de tarifario publicada.',
          datos: {
            tarifarioId: id,
            versionId: version.id,
            numero: version.numero,
            revisionBorrador: dto.revision,
            tipoVigencia: dto.tipoVigencia,
            vigenteDesde: version.vigenteDesde.toISOString(),
          },
        });
        return version;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una publicación para esa revisión o fecha. Recargá el tarifario.',
        );
      }
      throw error;
    }
  }
}
