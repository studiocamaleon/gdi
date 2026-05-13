import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ActualizarProductoDto,
  CrearProductoDto,
} from './dto/producto.dto';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  listarProductos(tenantId: string, activo?: boolean) {
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
          precioConfigJson: (dto.precioConfigJson ??
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
          `Ya existe un producto con código "${dto.codigo}"`,
        );
      }
      throw err;
    }
  }

  async actualizarProducto(
    tenantId: string,
    id: string,
    dto: ActualizarProductoDto,
  ) {
    const existente = await this.prisma.producto.findFirst({
      where: { id, tenantId },
    });
    if (!existente) throw new NotFoundException(`Producto ${id} no encontrado`);

    const data: Prisma.ProductoUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;
    if (dto.unidadComercial !== undefined) {
      data.unidadComercial = dto.unidadComercial;
    }
    if (dto.modoMedidas !== undefined) data.modoMedidas = dto.modoMedidas;
    if (dto.medidaDefaultAnchoMm !== undefined) {
      data.medidaDefaultAnchoMm =
        dto.medidaDefaultAnchoMm === null
          ? null
          : new Prisma.Decimal(dto.medidaDefaultAnchoMm);
    }
    if (dto.medidaDefaultAltoMm !== undefined) {
      data.medidaDefaultAltoMm =
        dto.medidaDefaultAltoMm === null
          ? null
          : new Prisma.Decimal(dto.medidaDefaultAltoMm);
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
      return this.prisma.producto.update({
        where: { id },
        data: { activo: false },
      });
    }

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
                maquinaM1: {
                  select: {
                    id: true,
                    codigo: true,
                    nombre: true,
                    plantilla: true,
                    parametrosTecnicosJson: true,
                    centroCostoPrincipalId: true,
                    centroCostoPrincipal: {
                      select: {
                        id: true,
                        codigo: true,
                        nombre: true,
                      },
                    },
                    consumibles: {
                      where: { activo: true },
                      select: {
                        id: true,
                        perfilOperativoId: true,
                        consumoBase: true,
                        detalleJson: true,
                        materiaPrimaVariante: {
                          select: {
                            id: true,
                            precioReferencia: true,
                          },
                        },
                      },
                    },
                  },
                },
                perfilM1: {
                  select: { id: true, nombre: true, detalleJson: true },
                },
                centroCosto: {
                  select: {
                    id: true,
                    codigo: true,
                    nombre: true,
                    unidadBaseFutura: true,
                  },
                },
                slotsMateriales: {
                  include: {
                    materialVariante: {
                      select: {
                        id: true,
                        sku: true,
                        nombreVariante: true,
                        precioReferencia: true,
                      },
                    },
                  },
                },
                maquinasCandidatas: {
                  where: { activo: true },
                  orderBy: [{ esPreferida: 'desc' }, { orden: 'asc' }],
                  include: {
                    maquina: {
                      select: {
                        id: true,
                        codigo: true,
                        nombre: true,
                        plantilla: true,
                        centroCostoPrincipalId: true,
                        centroCostoPrincipal: {
                          select: {
                            id: true,
                            codigo: true,
                            nombre: true,
                          },
                        },
                      },
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
    return {
      ...producto,
      rutasAlternativas: producto.rutasAlternativas.map((rutaAlt) => ({
        ...rutaAlt,
        ruta: {
          ...rutaAlt.ruta,
          pasos: rutaAlt.ruta.pasos.filter(
            (paso) => paso.version === rutaAlt.rutaVersion,
          ),
        },
      })),
    };
  }
}
