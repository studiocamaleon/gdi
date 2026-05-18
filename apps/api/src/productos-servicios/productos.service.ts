import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildModoColorOptionsFromProfiles } from './modo-color-comercial';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ActualizarProductoDto,
  CrearProductoDto,
  MedidaPredefinidaDto,
} from './dto/producto.dto';

type MedidaPredefinidaNormalizada = {
  id: string;
  nombre: string;
  anchoMm: number;
  altoMm: number;
  esDefault: boolean;
};

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  listarProductos(tenantId: string, activo?: boolean) {
    return this.prisma.producto.findMany({
      where: { tenantId, ...(activo !== undefined ? { activo } : {}) },
      orderBy: { nombre: 'asc' },
      include: {
        subcategoriaComercial: {
          include: { categoria: true },
        },
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
    const subcategoriaComercial = await this.assertSubcategoriaComercial(
      dto.subcategoriaComercialCodigo,
    );
    const medidas = this.normalizarMedidasPredefinidas({
      modoMedidas: dto.modoMedidas,
      medidas: dto.medidasPredefinidasJson,
      anchoDefault: dto.medidaDefaultAnchoMm,
      altoDefault: dto.medidaDefaultAltoMm,
    });
    const medidaDefault = medidas.find((medida) => medida.esDefault);

    try {
      return await this.prisma.producto.create({
        data: {
          tenantId,
          subcategoriaComercialId: subcategoriaComercial.id,
          codigo: dto.codigo,
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          unidadComercial: dto.unidadComercial,
          modoMedidas: dto.modoMedidas,
          medidaDefaultAnchoMm: medidaDefault
            ? new Prisma.Decimal(medidaDefault.anchoMm)
            : null,
          medidaDefaultAltoMm: medidaDefault
            ? new Prisma.Decimal(medidaDefault.altoMm)
            : null,
          medidasPredefinidasJson:
            medidas.length > 0
              ? (medidas as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          precioConfigJson: (dto.precioConfigJson ??
            Prisma.JsonNull) as Prisma.InputJsonValue,
          atributosComercialesJson: (dto.atributosComercialesJson ??
            Prisma.JsonNull) as Prisma.InputJsonValue,
          activo: true,
        },
        include: {
          subcategoriaComercial: { include: { categoria: true } },
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
    const touchedMedidas =
      dto.modoMedidas !== undefined ||
      dto.medidaDefaultAnchoMm !== undefined ||
      dto.medidaDefaultAltoMm !== undefined ||
      dto.medidasPredefinidasJson !== undefined;
    const medidas = touchedMedidas
      ? this.normalizarMedidasPredefinidas({
          modoMedidas: dto.modoMedidas ?? existente.modoMedidas,
          medidas:
            dto.medidasPredefinidasJson !== undefined
              ? dto.medidasPredefinidasJson
              : this.jsonToMedidas(existente.medidasPredefinidasJson),
          anchoDefault:
            dto.medidaDefaultAnchoMm !== undefined
              ? dto.medidaDefaultAnchoMm
              : this.decimalToNumber(existente.medidaDefaultAnchoMm),
          altoDefault:
            dto.medidaDefaultAltoMm !== undefined
              ? dto.medidaDefaultAltoMm
              : this.decimalToNumber(existente.medidaDefaultAltoMm),
        })
      : [];
    const medidaDefault = medidas.find((medida) => medida.esDefault);
    if (dto.subcategoriaComercialCodigo !== undefined) {
      await this.assertSubcategoriaComercial(dto.subcategoriaComercialCodigo);
      data.subcategoriaComercial = {
        connect: { codigo: dto.subcategoriaComercialCodigo },
      };
    }
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;
    if (dto.unidadComercial !== undefined) {
      data.unidadComercial = dto.unidadComercial;
    }
    if (dto.modoMedidas !== undefined) data.modoMedidas = dto.modoMedidas;
    if (touchedMedidas) {
      data.medidaDefaultAnchoMm = medidaDefault
        ? new Prisma.Decimal(medidaDefault.anchoMm)
        : null;
      data.medidaDefaultAltoMm = medidaDefault
        ? new Prisma.Decimal(medidaDefault.altoMm)
        : null;
      data.medidasPredefinidasJson =
        medidas.length > 0
          ? (medidas as Prisma.InputJsonValue)
          : Prisma.JsonNull;
    }
    if (dto.precioConfigJson !== undefined) {
      data.precioConfigJson = dto.precioConfigJson as Prisma.InputJsonValue;
    }
    if (dto.atributosComercialesJson !== undefined) {
      data.atributosComercialesJson =
        dto.atributosComercialesJson as Prisma.InputJsonValue;
    }
    if (dto.activo !== undefined) data.activo = dto.activo;

    return this.prisma.producto.update({
      where: { id },
      data,
      include: {
        subcategoriaComercial: { include: { categoria: true } },
      },
    });
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

  private decimalToNumber(value: Prisma.Decimal | null): number | null {
    return value == null ? null : Number(value);
  }

  private jsonToMedidas(value: Prisma.JsonValue | null): MedidaPredefinidaDto[] | null {
    return Array.isArray(value) ? (value as MedidaPredefinidaDto[]) : null;
  }

  private normalizarMedidasPredefinidas(input: {
    modoMedidas: string;
    medidas?: MedidaPredefinidaDto[] | null;
    anchoDefault?: number | null;
    altoDefault?: number | null;
  }): MedidaPredefinidaNormalizada[] {
    if (input.modoMedidas === 'LIBRE') return [];

    const fuente =
      input.medidas && input.medidas.length > 0
        ? input.medidas
        : input.anchoDefault && input.altoDefault
          ? [
              {
                id: 'default',
                nombre: `${input.anchoDefault} x ${input.altoDefault} mm`,
                anchoMm: input.anchoDefault,
                altoMm: input.altoDefault,
                esDefault: true,
              },
            ]
          : [];

    if (input.modoMedidas === 'FIJA' && fuente.length === 0) {
      throw new BadRequestException(
        'Los productos con medida fija deben tener al menos una medida predefinida.',
      );
    }

    const medidas = fuente.map((medida, index) => {
      const anchoMm = Number(medida.anchoMm);
      const altoMm = Number(medida.altoMm);
      if (!Number.isFinite(anchoMm) || anchoMm <= 0) {
        throw new BadRequestException('Cada medida debe tener ancho mayor a 0.');
      }
      if (!Number.isFinite(altoMm) || altoMm <= 0) {
        throw new BadRequestException('Cada medida debe tener alto mayor a 0.');
      }
      return {
        id:
          typeof medida.id === 'string' && medida.id.trim()
            ? medida.id.trim()
            : `medida-${index + 1}`,
        nombre:
          typeof medida.nombre === 'string' && medida.nombre.trim()
            ? medida.nombre.trim()
            : `${anchoMm} x ${altoMm} mm`,
        anchoMm,
        altoMm,
        esDefault: medida.esDefault === true,
      };
    });

    const defaults = medidas.filter((medida) => medida.esDefault);
    if (defaults.length > 1) {
      throw new BadRequestException(
        'Solo una medida predefinida puede ser predeterminada.',
      );
    }
    if (medidas.length > 0 && defaults.length === 0) {
      medidas[0].esDefault = true;
    }

    return medidas;
  }

  async obtenerProducto(tenantId: string, id: string) {
    const producto = await this.prisma.producto.findFirst({
      where: { id, tenantId },
      include: {
        subcategoriaComercial: {
          include: { categoria: true },
        },
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
                    perfilesOperativos: {
                      where: { activo: true },
                      select: {
                        id: true,
                        activo: true,
                        tipoPerfil: true,
                        detalleJson: true,
                      },
                    },
                  },
                },
                perfilM1: {
                  select: { id: true, nombre: true, tipoPerfil: true, detalleJson: true },
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
                    candidatos: {
                      orderBy: { orden: 'asc' },
                      include: {
                        materiaPrima: {
                          select: {
                            id: true,
                            codigo: true,
                            nombre: true,
                            familia: true,
                            subfamilia: true,
                            templateId: true,
                          },
                        },
                        defaultVariante: {
                          select: {
                            id: true,
                            sku: true,
                            nombreVariante: true,
                            precioReferencia: true,
                          },
                        },
                        variantes: {
                          orderBy: { orden: 'asc' },
                          include: {
                            variante: {
                              select: {
                                id: true,
                                sku: true,
                                nombreVariante: true,
                                precioReferencia: true,
                                atributosVarianteJson: true,
                              },
                            },
                          },
                        },
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
                        perfilesOperativos: {
                          where: { activo: true },
                          select: {
                            id: true,
                            activo: true,
                            tipoPerfil: true,
                            detalleJson: true,
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
	        configPasos: rutaAlt.configPasos.map((configPaso) => ({
	          ...configPaso,
	          modoColorOptions: this.buildModoColorOptions(configPaso),
	        })),
	      })),
	    };
	  }

	  private buildModoColorOptions(configPaso: {
	    paramsPasoJson?: Prisma.JsonValue | null;
	    maquinaM1?: {
	      perfilesOperativos?: Array<{
	        id: string;
	        activo?: boolean;
	        tipoPerfil?: string | null;
	        detalleJson?: Prisma.JsonValue | null;
	      }>;
	    } | null;
	    maquinasCandidatas?: Array<{
	      maquina?: {
	        perfilesOperativos?: Array<{
	          id: string;
	          activo?: boolean;
	          tipoPerfil?: string | null;
	          detalleJson?: Prisma.JsonValue | null;
	        }>;
	      } | null;
	    }>;
	  }) {
	    const params =
	      configPaso.paramsPasoJson &&
	      typeof configPaso.paramsPasoJson === 'object' &&
	      !Array.isArray(configPaso.paramsPasoJson)
	        ? (configPaso.paramsPasoJson as Record<string, unknown>)
	        : {};
	    const modoColorConfig =
	      params.modoColorConfig &&
	      typeof params.modoColorConfig === 'object' &&
	      !Array.isArray(params.modoColorConfig)
	        ? (params.modoColorConfig as Record<string, unknown>)
	        : {};
	    const profiles = [
	      ...(configPaso.maquinaM1?.perfilesOperativos ?? []),
	      ...(configPaso.maquinasCandidatas ?? []).flatMap(
	        (candidate) => candidate.maquina?.perfilesOperativos ?? [],
	      ),
	    ];
	    return buildModoColorOptionsFromProfiles(
	      profiles,
	      modoColorConfig.allowedModes,
	    );
	  }

  listarCatalogoComercial() {
    return this.prisma.productoCategoriaComercial.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      include: {
        subcategorias: {
          where: { activo: true },
          orderBy: { orden: 'asc' },
        },
      },
    });
  }

  private async assertSubcategoriaComercial(codigo: string) {
    const subcategoria =
      await this.prisma.productoSubcategoriaComercial.findUnique({
        where: { codigo },
        select: { id: true, activo: true },
      });
    if (!subcategoria || !subcategoria.activo) {
      throw new BadRequestException(
        `Subcategoría comercial inválida: ${codigo}`,
      );
    }
    return subcategoria;
  }
}
