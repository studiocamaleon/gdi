import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertEstacionDto } from './dto/upsert-estacion.dto';

@Injectable()
export class ProduccionService {
  constructor(private readonly prisma: PrismaService) {}

  async findEstaciones(auth: CurrentAuth) {
    const rows = await this.prisma.estacion.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: [{ nombre: 'asc' }],
    });
    return rows.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      activo: item.activo,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  async createEstacion(auth: CurrentAuth, payload: UpsertEstacionDto) {
    try {
      const created = await this.prisma.estacion.create({
        data: {
          tenantId: auth.tenantId,
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion?.trim() || null,
          activo: payload.activo ?? true,
        },
      });
      return {
        id: created.id,
        nombre: created.nombre,
        descripcion: created.descripcion ?? '',
        activo: created.activo,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Ya existe una estación con ese nombre.');
      }
      throw error;
    }
  }

  async updateEstacion(auth: CurrentAuth, id: string, payload: UpsertEstacionDto) {
    const existing = await this.prisma.estacion.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Estación no encontrada.');
    }

    try {
      const updated = await this.prisma.estacion.update({
        where: { id },
        data: {
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion?.trim() || null,
          activo: payload.activo,
        },
      });
      return {
        id: updated.id,
        nombre: updated.nombre,
        descripcion: updated.descripcion ?? '',
        activo: updated.activo,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Ya existe una estación con ese nombre.');
      }
      throw error;
    }
  }

  async toggleEstacion(auth: CurrentAuth, id: string) {
    const existing = await this.prisma.estacion.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Estación no encontrada.');
    }
    const updated = await this.prisma.estacion.update({
      where: { id },
      data: { activo: !existing.activo },
    });
    return {
      id: updated.id,
      nombre: updated.nombre,
      descripcion: updated.descripcion ?? '',
      activo: updated.activo,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
