import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ActualizarProductoRutaAlternativaDto,
  CrearProductoRutaAlternativaDto,
} from './dto/producto-ruta.dto';

@Injectable()
export class ProductoRutasService {
  constructor(private readonly prisma: PrismaService) {}

  async crearProductoRutaAlternativa(
    tenantId: string,
    productoId: string,
    dto: CrearProductoRutaAlternativaDto,
  ) {
    const [producto, ruta, rutaVersion] = await Promise.all([
      this.prisma.producto.findFirst({ where: { id: productoId, tenantId } }),
      this.prisma.ruta.findFirst({ where: { id: dto.rutaId, tenantId } }),
      this.prisma.rutaVersion.findFirst({
        where: { tenantId, rutaId: dto.rutaId, version: dto.rutaVersion },
      }),
    ]);
    if (!producto)
      throw new NotFoundException(`Producto ${productoId} no encontrado`);
    if (!ruta) throw new NotFoundException(`Ruta ${dto.rutaId} no encontrada`);
    if (!rutaVersion) {
      throw new BadRequestException(
        `La versión ${dto.rutaVersion} de la ruta seleccionada no existe`,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.esPreferida) {
          await tx.productoRutaAlternativa.updateMany({
            where: { tenantId, productoId, esPreferida: true },
            data: { esPreferida: false },
          });
        }

        return tx.productoRutaAlternativa.create({
          data: {
            tenantId,
            productoId,
            rutaId: dto.rutaId,
            rutaVersion: dto.rutaVersion,
            nombre: dto.nombre,
            esPreferida: dto.esPreferida ?? false,
            reglaAutoSeleccionJson: (dto.reglaAutoSeleccionJson ??
              Prisma.JsonNull) as Prisma.InputJsonValue,
            orden: dto.orden ?? 0,
            activo: true,
          },
        });
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Este producto ya tiene esa ruta como alternativa`,
        );
      }
      throw err;
    }
  }

  async actualizarProductoRutaAlternativa(
    tenantId: string,
    rutaAltId: string,
    dto: ActualizarProductoRutaAlternativaDto,
  ) {
    const existente = await this.prisma.productoRutaAlternativa.findFirst({
      where: { id: rutaAltId, tenantId },
    });
    if (!existente)
      throw new NotFoundException(
        `Ruta alternativa ${rutaAltId} no encontrada`,
      );

    const data: Prisma.ProductoRutaAlternativaUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.esPreferida !== undefined) data.esPreferida = dto.esPreferida;
    if (dto.reglaAutoSeleccionJson !== undefined) {
      data.reglaAutoSeleccionJson =
        dto.reglaAutoSeleccionJson as Prisma.InputJsonValue;
    }
    if (dto.orden !== undefined) data.orden = dto.orden;
    if (dto.activo !== undefined) data.activo = dto.activo;

    return this.prisma.$transaction(async (tx) => {
      if (dto.esPreferida === true) {
        await tx.productoRutaAlternativa.updateMany({
          where: {
            tenantId,
            productoId: existente.productoId,
            esPreferida: true,
            id: { not: rutaAltId },
          },
          data: { esPreferida: false },
        });
      }

      return tx.productoRutaAlternativa.update({
        where: { id: rutaAltId },
        data,
      });
    });
  }

  async eliminarProductoRutaAlternativa(tenantId: string, rutaAltId: string) {
    const existente = await this.prisma.productoRutaAlternativa.findFirst({
      where: { id: rutaAltId, tenantId },
    });
    if (!existente)
      throw new NotFoundException(
        `Ruta alternativa ${rutaAltId} no encontrada`,
      );
    return this.prisma.productoRutaAlternativa.delete({
      where: { id: rutaAltId },
    });
  }
}
