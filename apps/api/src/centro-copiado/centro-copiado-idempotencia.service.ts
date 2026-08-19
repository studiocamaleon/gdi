import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CentroCopiadoIdempotenciaService {
  constructor(private readonly prisma: PrismaService) {}

  async ejecutar<T>(args: {
    tenantId: string;
    tipo: string;
    clave?: string;
    accion: () => Promise<T>;
  }): Promise<T> {
    if (!args.clave) return args.accion();

    const existente = await this.prisma.centroCopiadoOperacion.findUnique({
      where: {
        tenantId_tipo_idempotencyKey: {
          tenantId: args.tenantId,
          tipo: args.tipo,
          idempotencyKey: args.clave,
        },
      },
    });
    if (existente?.estado === 'COMPLETADA' && existente.resultadoJson) {
      return existente.resultadoJson as T;
    }
    if (existente) {
      throw new ConflictException(
        'La misma operación todavía está en proceso. Esperá un momento y reintentá.',
      );
    }

    try {
      await this.prisma.centroCopiadoOperacion.create({
        data: {
          tenantId: args.tenantId,
          tipo: args.tipo,
          idempotencyKey: args.clave,
          estado: 'EN_PROCESO',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'La misma operación ya está siendo procesada.',
        );
      }
      throw error;
    }

    try {
      const resultado = await args.accion();
      await this.prisma.centroCopiadoOperacion.update({
        where: {
          tenantId_tipo_idempotencyKey: {
            tenantId: args.tenantId,
            tipo: args.tipo,
            idempotencyKey: args.clave,
          },
        },
        data: {
          estado: 'COMPLETADA',
          resultadoJson: resultado as Prisma.InputJsonValue,
        },
      });
      return resultado;
    } catch (error) {
      await this.prisma.centroCopiadoOperacion.deleteMany({
        where: {
          tenantId: args.tenantId,
          tipo: args.tipo,
          idempotencyKey: args.clave,
          estado: 'EN_PROCESO',
        },
      });
      throw error;
    }
  }
}
