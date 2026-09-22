import { CapacidadesEmpresaService } from '../../../suscripciones/capacidades-empresa.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ActualizarPrecioEspecialClienteDto,
  CrearPrecioEspecialClienteDto,
} from '../dto/precio-especial-cliente.dto';

/**
 * CRUD de precios especiales por cliente (`ProductoPrecioEspecialClienteV2`).
 *
 * Override del precio standard del producto cuando el cliente X compra:
 * tiene su propia config de método de cálculo (mismo schema que
 * `Producto.precioConfigJson`).
 *
 * Constraint: un cliente puede tener máximo 1 precio especial por producto
 * (ya viene de @@unique([tenantId, productoId, clienteId]) en el schema).
 */
@Injectable()
export class PreciosEspecialesClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService = new CapacidadesEmpresaService(
      prisma,
    ),
  ) {}

  async listarPorProducto(tenantId: string, productoId: string) {
    await this.assertProductoExiste(tenantId, productoId);
    return this.prisma.productoPrecioEspecialClienteV2.findMany({
      where: { tenantId, productoId },
      include: {
        cliente: { select: { id: true, nombre: true, razonSocial: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async crear(
    tenantId: string,
    productoId: string,
    dto: CrearPrecioEspecialClienteDto,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.capacidades.exigirOperacionTx(
          tx,
          tenantId,
          ['precios_especiales'],
          ['precios_especiales'],
        );
        await this.assertProductoExiste(tenantId, productoId, tx);
        await this.assertClienteExiste(tenantId, dto.clienteId, tx);
        return tx.productoPrecioEspecialClienteV2.create({
          data: {
            tenantId,
            productoId,
            clienteId: dto.clienteId,
            configJson: dto.configJson as Prisma.InputJsonValue,
            activo: true,
          },
          include: {
            cliente: { select: { id: true, nombre: true, razonSocial: true } },
          },
        });
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Ya existe un precio especial para este cliente en este producto',
        );
      }
      throw err;
    }
  }

  async actualizar(
    tenantId: string,
    id: string,
    dto: ActualizarPrecioEspecialClienteDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(
        tx,
        tenantId,
        ['precios_especiales'],
        ['precios_especiales'],
      );
      const existente = await tx.productoPrecioEspecialClienteV2.findFirst({
        where: { id, tenantId },
      });
      if (!existente)
        throw new NotFoundException(`Precio especial ${id} no encontrado`);

      const data: Prisma.ProductoPrecioEspecialClienteV2UpdateInput = {};
      if (dto.configJson !== undefined)
        data.configJson = dto.configJson as Prisma.InputJsonValue;
      if (dto.activo !== undefined) data.activo = dto.activo;

      return tx.productoPrecioEspecialClienteV2.update({
        where: { id },
        data,
        include: {
          cliente: { select: { id: true, nombre: true, razonSocial: true } },
        },
      });
    });
  }

  async eliminar(tenantId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(
        tx,
        tenantId,
        ['precios_especiales'],
        ['precios_especiales'],
      );
      const existente = await tx.productoPrecioEspecialClienteV2.findFirst({
        where: { id, tenantId },
      });
      if (!existente)
        throw new NotFoundException(`Precio especial ${id} no encontrado`);
      return tx.productoPrecioEspecialClienteV2.delete({
        where: { id },
      });
    });
  }

  /**
   * Buscar el precio especial activo de un cliente para un producto.
   * Usado por `aplicar-precio.service` cuando se cotiza con cliente.
   */
  async buscarActivo(tenantId: string, productoId: string, clienteId: string) {
    if (!(await this.capacidades.puedeOperar(tenantId, 'precios_especiales')))
      return null;
    return this.prisma.productoPrecioEspecialClienteV2.findFirst({
      where: {
        tenantId,
        productoId,
        clienteId,
        activo: true,
        cliente: { tenantId, activo: true },
        producto: { tenantId },
      },
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private async assertProductoExiste(
    tenantId: string,
    productoId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const p = await db.producto.findFirst({
      where: { id: productoId, tenantId },
      select: { id: true },
    });
    if (!p) throw new NotFoundException(`Producto ${productoId} no encontrado`);
  }

  private async assertClienteExiste(
    tenantId: string,
    clienteId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const c = await db.cliente.findFirst({
      where: { id: clienteId, tenantId, activo: true },
      select: { id: true },
    });
    if (!c) {
      throw new NotFoundException(
        `Cliente ${clienteId} no encontrado o inhabilitado`,
      );
    }
  }
}
