import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ActualizarComisionCatalogoDto,
  CrearComisionCatalogoDto,
} from '../dto/comision-catalogo.dto';

/**
 * Service del catálogo de esquemas de comisiones del tenant
 * (`ProductoComisionCatalogo`).
 *
 * Mismo patrón de soft-delete que ImpuestosCatalogoService.
 */
@Injectable()
export class ComisionesCatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string, soloActivos = true) {
    return this.prisma.productoComisionCatalogo.findMany({
      where: { tenantId, ...(soloActivos ? { activo: true } : {}) },
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { productosAplicados: true } } },
    });
  }

  async obtener(tenantId: string, id: string) {
    const item = await this.prisma.productoComisionCatalogo.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { productosAplicados: true } } },
    });
    if (!item) throw new NotFoundException(`Comisión ${id} no encontrada`);
    return item;
  }

  async crear(tenantId: string, dto: CrearComisionCatalogoDto) {
    try {
      return await this.prisma.productoComisionCatalogo.create({
        data: {
          tenantId,
          codigo: dto.codigo,
          nombre: dto.nombre,
          porcentaje: dto.porcentaje,
          baseCalculo: dto.baseCalculo ?? 'NETO',
          detalleJson: (dto.detalleJson ??
            Prisma.JsonNull) as Prisma.InputJsonValue,
          activo: true,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          `Ya existe una comisión con código "${dto.codigo}"`,
        );
      }
      throw err;
    }
  }

  async actualizar(
    tenantId: string,
    id: string,
    dto: ActualizarComisionCatalogoDto,
  ) {
    const existente = await this.prisma.productoComisionCatalogo.findFirst({
      where: { id, tenantId },
    });
    if (!existente) throw new NotFoundException(`Comisión ${id} no encontrada`);

    const data: Prisma.ProductoComisionCatalogoUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.porcentaje !== undefined) data.porcentaje = dto.porcentaje;
    if (dto.baseCalculo !== undefined) data.baseCalculo = dto.baseCalculo;
    if (dto.detalleJson !== undefined)
      data.detalleJson = dto.detalleJson as Prisma.InputJsonValue;
    if (dto.activo !== undefined) data.activo = dto.activo;

    return this.prisma.productoComisionCatalogo.update({ where: { id }, data });
  }

  async eliminar(tenantId: string, id: string) {
    const existente = await this.prisma.productoComisionCatalogo.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { productosAplicados: true } } },
    });
    if (!existente) throw new NotFoundException(`Comisión ${id} no encontrada`);

    if (existente._count.productosAplicados > 0) {
      const item = await this.prisma.productoComisionCatalogo.update({
        where: { id },
        data: { activo: false },
      });
      return { tipo: 'soft' as const, item };
    }

    const item = await this.prisma.productoComisionCatalogo.delete({
      where: { id },
    });
    return { tipo: 'hard' as const, item };
  }
}
