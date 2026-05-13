import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AsignarComisionesBatchDto,
  AsignarImpuestosBatchDto,
} from '../dto/precio-aplicacion.dto';

/**
 * Service de aplicación de impuestos y comisiones a un producto.
 *
 * Patrón principal: **replace-all batch** (operación atómica). El frontend
 * envía la lista completa de impuestos/comisiones que el producto debe tener
 * y el service:
 *   1) borra las que no estén,
 *   2) crea las nuevas,
 *   3) actualiza el orden de las existentes.
 *
 * Este patrón evita races (ej: dos usuarios editando el mismo producto) y
 * es la API más simple para el frontend (sólo "guardar" — el editor maneja
 * el array localmente).
 *
 * Operaciones individuales (`agregarImpuesto` / `quitarImpuesto`) también
 * se exponen para casos puntuales (futuro hover-add desde otra UI).
 */
@Injectable()
export class PrecioAplicacionesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Listar lo aplicado ──────────────────────────────────────────────

  async listarImpuestosAplicados(tenantId: string, productoId: string) {
    await this.assertProductoExiste(tenantId, productoId);
    return this.prisma.productoImpuestoAplicado.findMany({
      where: { tenantId, productoId },
      include: { impuestoCatalogo: true },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async listarComisionesAplicadas(tenantId: string, productoId: string) {
    await this.assertProductoExiste(tenantId, productoId);
    return this.prisma.productoComisionAplicada.findMany({
      where: { tenantId, productoId },
      include: { comisionCatalogo: true },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // ── Replace-all (atómico) ───────────────────────────────────────────

  async setImpuestos(
    tenantId: string,
    productoId: string,
    dto: AsignarImpuestosBatchDto,
  ) {
    await this.assertProductoExiste(tenantId, productoId);

    // Validar que todos los catálogos referenciados existan y pertenezcan al tenant
    if (dto.items.length > 0) {
      const ids = dto.items.map((i) => i.impuestoCatalogoId);
      const validos = await this.prisma.productoImpuestoCatalogo.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true },
      });
      if (validos.length !== new Set(ids).size) {
        throw new BadRequestException(
          'Hay impuestos del catálogo que no existen en el tenant',
        );
      }
    }

    // Validar que no haya duplicados en el batch
    const idsSet = new Set(dto.items.map((i) => i.impuestoCatalogoId));
    if (idsSet.size !== dto.items.length) {
      throw new BadRequestException(
        'No podés aplicar el mismo impuesto dos veces',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1) Borrar las que no estén en el batch
      await tx.productoImpuestoAplicado.deleteMany({
        where: {
          tenantId,
          productoId,
          impuestoCatalogoId: {
            notIn:
              Array.from(idsSet).length > 0
                ? Array.from(idsSet)
                : ['00000000-0000-0000-0000-000000000000'],
          },
        },
      });

      // 2) Upsert por par (productoId, impuestoCatalogoId)
      for (const [idx, item] of dto.items.entries()) {
        await tx.productoImpuestoAplicado.upsert({
          where: {
            tenantId_productoId_impuestoCatalogoId: {
              tenantId,
              productoId,
              impuestoCatalogoId: item.impuestoCatalogoId,
            },
          },
          update: { orden: item.orden ?? idx },
          create: {
            tenantId,
            productoId,
            impuestoCatalogoId: item.impuestoCatalogoId,
            orden: item.orden ?? idx,
          },
        });
      }

      return tx.productoImpuestoAplicado.findMany({
        where: { tenantId, productoId },
        include: { impuestoCatalogo: true },
        orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
      });
    });
  }

  async setComisiones(
    tenantId: string,
    productoId: string,
    dto: AsignarComisionesBatchDto,
  ) {
    await this.assertProductoExiste(tenantId, productoId);

    if (dto.items.length > 0) {
      const ids = dto.items.map((i) => i.comisionCatalogoId);
      const validos = await this.prisma.productoComisionCatalogo.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true },
      });
      if (validos.length !== new Set(ids).size) {
        throw new BadRequestException(
          'Hay comisiones del catálogo que no existen en el tenant',
        );
      }
    }

    const idsSet = new Set(dto.items.map((i) => i.comisionCatalogoId));
    if (idsSet.size !== dto.items.length) {
      throw new BadRequestException(
        'No podés aplicar la misma comisión dos veces',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.productoComisionAplicada.deleteMany({
        where: {
          tenantId,
          productoId,
          comisionCatalogoId: {
            notIn:
              Array.from(idsSet).length > 0
                ? Array.from(idsSet)
                : ['00000000-0000-0000-0000-000000000000'],
          },
        },
      });

      for (const [idx, item] of dto.items.entries()) {
        await tx.productoComisionAplicada.upsert({
          where: {
            tenantId_productoId_comisionCatalogoId: {
              tenantId,
              productoId,
              comisionCatalogoId: item.comisionCatalogoId,
            },
          },
          update: { orden: item.orden ?? idx },
          create: {
            tenantId,
            productoId,
            comisionCatalogoId: item.comisionCatalogoId,
            orden: item.orden ?? idx,
          },
        });
      }

      return tx.productoComisionAplicada.findMany({
        where: { tenantId, productoId },
        include: { comisionCatalogo: true },
        orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
      });
    });
  }

  // ── Operaciones individuales (utilitarias) ──────────────────────────

  async quitarImpuesto(
    tenantId: string,
    productoId: string,
    impuestoCatalogoId: string,
  ) {
    await this.assertProductoExiste(tenantId, productoId);
    try {
      return await this.prisma.productoImpuestoAplicado.delete({
        where: {
          tenantId_productoId_impuestoCatalogoId: {
            tenantId,
            productoId,
            impuestoCatalogoId,
          },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException(
          'El impuesto no estaba aplicado a este producto',
        );
      }
      throw err;
    }
  }

  async quitarComision(
    tenantId: string,
    productoId: string,
    comisionCatalogoId: string,
  ) {
    await this.assertProductoExiste(tenantId, productoId);
    try {
      return await this.prisma.productoComisionAplicada.delete({
        where: {
          tenantId_productoId_comisionCatalogoId: {
            tenantId,
            productoId,
            comisionCatalogoId,
          },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException(
          'La comisión no estaba aplicada a este producto',
        );
      }
      throw err;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private async assertProductoExiste(tenantId: string, productoId: string) {
    const p = await this.prisma.producto.findFirst({
      where: { id: productoId, tenantId },
      select: { id: true },
    });
    if (!p) throw new NotFoundException(`Producto ${productoId} no encontrado`);
  }
}
