import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ActualizarImpuestoCatalogoDto,
  CrearImpuestoCatalogoDto,
} from '../dto/impuesto-catalogo.dto';

/**
 * Service del catálogo de esquemas impositivos del tenant
 * (`ProductoImpuestoCatalogo`).
 *
 * Patrón soft-delete: si está en uso (hay productos aplicándolo), borrar
 * marca `activo: false`. Si no hay aplicaciones, hard-delete.
 */
@Injectable()
export class ImpuestosCatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string, soloActivos = true) {
    return this.prisma.productoImpuestoCatalogo.findMany({
      where: { tenantId, ...(soloActivos ? { activo: true } : {}) },
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { productosAplicados: true } } },
    });
  }

  async obtener(tenantId: string, id: string) {
    const item = await this.prisma.productoImpuestoCatalogo.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { productosAplicados: true } } },
    });
    if (!item) throw new NotFoundException(`Impuesto ${id} no encontrado`);
    return item;
  }

  async crear(tenantId: string, dto: CrearImpuestoCatalogoDto) {
    try {
      return await this.prisma.productoImpuestoCatalogo.create({
        data: {
          tenantId,
          codigo: dto.codigo,
          nombre: dto.nombre,
          porcentaje: dto.porcentaje,
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
          `Ya existe un impuesto con código "${dto.codigo}"`,
        );
      }
      throw err;
    }
  }

  async actualizar(
    tenantId: string,
    id: string,
    dto: ActualizarImpuestoCatalogoDto,
  ) {
    const existente = await this.prisma.productoImpuestoCatalogo.findFirst({
      where: { id, tenantId },
    });
    if (!existente) throw new NotFoundException(`Impuesto ${id} no encontrado`);

    const data: Prisma.ProductoImpuestoCatalogoUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.porcentaje !== undefined) data.porcentaje = dto.porcentaje;
    if (dto.detalleJson !== undefined)
      data.detalleJson = dto.detalleJson as Prisma.InputJsonValue;
    if (dto.activo !== undefined) data.activo = dto.activo;

    return this.prisma.productoImpuestoCatalogo.update({ where: { id }, data });
  }

  /**
   * Eliminar con soft-delete inteligente:
   * - Si hay productos aplicándolo → marca `activo: false` (preserva integridad).
   * - Si no hay aplicaciones → hard-delete.
   * Devuelve `{ tipo: 'soft' | 'hard', item }`.
   */
  async eliminar(tenantId: string, id: string) {
    const existente = await this.prisma.productoImpuestoCatalogo.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { productosAplicados: true } } },
    });
    if (!existente) throw new NotFoundException(`Impuesto ${id} no encontrado`);

    if (existente._count.productosAplicados > 0) {
      const item = await this.prisma.productoImpuestoCatalogo.update({
        where: { id },
        data: { activo: false },
      });
      return { tipo: 'soft' as const, item };
    }

    const item = await this.prisma.productoImpuestoCatalogo.delete({
      where: { id },
    });
    return { tipo: 'hard' as const, item };
  }
}
