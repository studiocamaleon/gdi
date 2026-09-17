import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { EquipoProduccionDto } from './dto/equipo-produccion.dto';
import { normalizarCalendarioAlmacenado, parseCalendario } from './calendario';

@Injectable()
export class EquiposProduccionService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string) {
    const equipos = await this.prisma.equipoProduccion.findMany({
      where: { tenantId },
      orderBy: { nombre: 'asc' },
    });
    return equipos.map(({ calendarioJson, ...equipo }) => ({
      ...equipo,
      calendario: normalizarCalendarioAlmacenado(calendarioJson),
    }));
  }

  async guardar(tenantId: string, dto: EquipoProduccionDto, id?: string) {
    const calendario = parseCalendario(dto.calendario);
    if (!dto.nombre.trim() || !calendario)
      throw new BadRequestException(
        'Indicá un nombre y el horario del equipo.',
      );
    const data = {
      nombre: dto.nombre.trim(),
      personas: dto.personas,
      activo: dto.activo,
      calendarioJson: calendario as unknown as Prisma.InputJsonValue,
    };
    try {
      if (id) {
        const actualizado = await this.prisma.equipoProduccion.updateMany({
          where: { id, tenantId },
          data,
        });
        if (actualizado.count !== 1)
          throw new NotFoundException('Equipo de producción no encontrado.');
        return { id };
      }
      const creado = await this.prisma.equipoProduccion.create({
        data: { ...data, tenantId },
      });
      return { id: creado.id };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ya existe un equipo con ese nombre.');
      }
      throw error;
    }
  }
}
