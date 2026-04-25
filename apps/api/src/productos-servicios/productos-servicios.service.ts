import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FAMILIAS, listarFamilias as listarFamiliasCatalogo } from './pasos/familias';
import { CATEGORIAS } from './pasos/categorias';
import type { ActualizarProductoDto, CrearProductoDto } from './dto/producto.dto';

/**
 * Service F.3 — CRUD del Modelo Universal V2.
 *
 * MVP: read-only para arrancar UI de listados/detalles. POST/PUT/DELETE
 * se implementan cuando la UI de edición esté lista en sub-fases siguientes.
 */
@Injectable()
export class ProductosServiciosService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // PRODUCTOS
  // ============================================================================

  async listarProductos(tenantId: string, activo?: boolean) {
    return this.prisma.producto.findMany({
      where: { tenantId, ...(activo !== undefined ? { activo } : {}) },
      orderBy: { nombre: 'asc' },
      include: {
        rutasAlternativas: {
          where: { activo: true },
          select: {
            id: true,
            nombre: true,
            esPreferida: true,
            ruta: { select: { id: true, codigo: true, nombre: true } },
          },
          orderBy: { orden: 'asc' },
        },
      },
    });
  }

  async crearProducto(tenantId: string, dto: CrearProductoDto) {
    try {
      return await this.prisma.producto.create({
        data: {
          tenantId,
          codigo: dto.codigo,
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          unidadComercial: dto.unidadComercial,
          modoMedidas: dto.modoMedidas,
          medidaDefaultAnchoMm: dto.medidaDefaultAnchoMm
            ? new Prisma.Decimal(dto.medidaDefaultAnchoMm)
            : null,
          medidaDefaultAltoMm: dto.medidaDefaultAltoMm
            ? new Prisma.Decimal(dto.medidaDefaultAltoMm)
            : null,
          precioConfigJson: (dto.precioConfigJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          activo: true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(`Ya existe un producto con código "${dto.codigo}"`);
      }
      throw err;
    }
  }

  async actualizarProducto(tenantId: string, id: string, dto: ActualizarProductoDto) {
    // Verifica que existe
    const existente = await this.prisma.producto.findFirst({ where: { id, tenantId } });
    if (!existente) throw new NotFoundException(`Producto ${id} no encontrado`);

    const data: Prisma.ProductoUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;
    if (dto.unidadComercial !== undefined) data.unidadComercial = dto.unidadComercial;
    if (dto.modoMedidas !== undefined) data.modoMedidas = dto.modoMedidas;
    if (dto.medidaDefaultAnchoMm !== undefined) {
      data.medidaDefaultAnchoMm =
        dto.medidaDefaultAnchoMm === null ? null : new Prisma.Decimal(dto.medidaDefaultAnchoMm);
    }
    if (dto.medidaDefaultAltoMm !== undefined) {
      data.medidaDefaultAltoMm =
        dto.medidaDefaultAltoMm === null ? null : new Prisma.Decimal(dto.medidaDefaultAltoMm);
    }
    if (dto.precioConfigJson !== undefined) {
      data.precioConfigJson = dto.precioConfigJson as Prisma.InputJsonValue;
    }
    if (dto.activo !== undefined) data.activo = dto.activo;

    return this.prisma.producto.update({ where: { id }, data });
  }

  async eliminarProducto(tenantId: string, id: string) {
    const existente = await this.prisma.producto.findFirst({
      where: { id, tenantId },
      include: {
        cotizacionItems: { take: 1 },
      },
    });
    if (!existente) throw new NotFoundException(`Producto ${id} no encontrado`);

    if (existente.cotizacionItems.length > 0) {
      // Soft-delete: marcar inactivo en vez de borrar (preserva trazabilidad de cotizaciones)
      return this.prisma.producto.update({
        where: { id },
        data: { activo: false },
      });
    }

    // Hard delete (cascade limpia rutasAlternativas, configPasos, slots, etc.)
    return this.prisma.producto.delete({ where: { id } });
  }

  async obtenerProducto(tenantId: string, id: string) {
    const producto = await this.prisma.producto.findFirst({
      where: { id, tenantId },
      include: {
        rutasAlternativas: {
          where: { activo: true },
          include: {
            ruta: {
              include: {
                pasos: { orderBy: { orden: 'asc' } },
              },
            },
            configPasos: {
              include: {
                rutaPaso: true,
                maquinaM1: { select: { id: true, codigo: true, nombre: true, plantilla: true } },
                perfilM1: { select: { id: true, nombre: true } },
                slotsMateriales: {
                  include: {
                    materialVariante: {
                      select: { id: true, sku: true, nombreVariante: true, precioReferencia: true },
                    },
                  },
                },
                cargosDirectosPaso: {
                  include: { cargoDirectoCatalogo: true },
                },
              },
              orderBy: { rutaPaso: { orden: 'asc' } },
            },
          },
          orderBy: { orden: 'asc' },
        },
        pasosExtras: { orderBy: { ordenInterno: 'asc' } },
        cargosDirectosCotizacion: {
          include: { cargoDirectoCatalogo: true },
        },
      },
    });
    if (!producto) throw new NotFoundException(`Producto ${id} no encontrado`);
    return producto;
  }

  // ============================================================================
  // RUTAS
  // ============================================================================

  async listarRutas(tenantId: string) {
    return this.prisma.ruta.findMany({
      where: { tenantId, activo: true },
      orderBy: { nombre: 'asc' },
      include: {
        pasos: {
          orderBy: { orden: 'asc' },
          select: { id: true, orden: true, familiaCodigo: true },
        },
        _count: { select: { productosAlternativas: true } },
      },
    });
  }

  async obtenerRuta(tenantId: string, id: string) {
    const ruta = await this.prisma.ruta.findFirst({
      where: { id, tenantId },
      include: {
        pasos: { orderBy: { orden: 'asc' } },
        versiones: { orderBy: { version: 'desc' }, take: 5 },
        productosAlternativas: {
          include: { producto: { select: { id: true, codigo: true, nombre: true } } },
        },
      },
    });
    if (!ruta) throw new NotFoundException(`Ruta ${id} no encontrada`);
    return ruta;
  }

  // ============================================================================
  // CATÁLOGO DE FAMILIAS (hardcoded)
  // ============================================================================

  listarFamilias() {
    return {
      categorias: Object.values(CATEGORIAS).sort((a, b) => a.orden - b.orden),
      familias: listarFamiliasCatalogo().map((codigo) => {
        const f = FAMILIAS[codigo];
        return {
          codigo: f.codigo,
          nombre: f.nombre,
          categoria: f.categoria,
          descripcion: f.descripcion,
          relacionMaquinaSoportada: f.relacionMaquinaSoportada,
          modosTiempoSoportados: f.modosTiempoSoportados,
          mecanismosCantidadSoportados: f.mecanismosCantidadSoportados,
          modosActivacionSoportados: f.modosActivacionSoportados,
          slotsRequeridos: f.slotsRequeridos,
          plantillasCompatibles: f.plantillasCompatibles,
          productosTipicos: f.productosTipicos,
        };
      }),
    };
  }

  // ============================================================================
  // CARGOS DIRECTOS CATÁLOGO
  // ============================================================================

  async listarCargosDirectos(tenantId: string) {
    return this.prisma.cargoDirectoCatalogo.findMany({
      where: { tenantId, activo: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
