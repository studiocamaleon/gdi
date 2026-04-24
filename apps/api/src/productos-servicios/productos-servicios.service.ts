import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FAMILIAS, listarFamilias as listarFamiliasCatalogo } from './pasos/familias';
import { CATEGORIAS } from './pasos/categorias';

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
