import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FamiliaMateriaPrima,
  ModoUsoCompatibilidadMateriaPrima,
  PlantillaMaquinaria,
  Prisma,
  SubfamiliaMateriaPrima,
  UnidadMateriaPrima,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpsertMateriaPrimaDto,
} from './dto/upsert-materia-prima.dto';
import { unitsAreCompatible } from './unidades-canonicas';

type MateriaPrimaEntity = Prisma.MateriaPrimaGetPayload<{
  include: {
    variantes: {
      include: {
        proveedorReferencia: true;
      };
      orderBy: {
        createdAt: 'asc';
      };
    };
    compatibilidades: {
      include: {
        maquina: true;
        perfilOperativo: true;
      };
      orderBy: {
        createdAt: 'asc';
      };
    };
  };
}>;

@Injectable()
export class InventarioService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllMateriasPrimas(auth: CurrentAuth) {
    const items = await this.prisma.materiaPrima.findMany({
      where: {
        tenantId: auth.tenantId,
      },
      include: {
        variantes: {
          include: {
            proveedorReferencia: true,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
        compatibilidades: {
          include: {
            maquina: true,
            perfilOperativo: true,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
      orderBy: [{ nombre: 'asc' }],
    });

    return items.map((item) => this.toResponse(item));
  }

  async findMateriaPrima(auth: CurrentAuth, id: string) {
    const item = await this.findMateriaPrimaOrThrow(auth, id, this.prisma);
    return this.toResponse(item);
  }

  async createMateriaPrima(auth: CurrentAuth, payload: UpsertMateriaPrimaDto) {
    const normalized = this.normalizePayload(payload);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const materiaPrima = await tx.materiaPrima.create({
          data: {
            tenantId: auth.tenantId,
            codigo: normalized.codigo,
            nombre: normalized.nombre,
            descripcion: normalized.descripcion,
            familia: this.toPrismaEnum<FamiliaMateriaPrima>(normalized.familia),
            subfamilia: this.toPrismaEnum<SubfamiliaMateriaPrima>(
              normalized.subfamilia,
            ),
            tipoTecnico: normalized.tipoTecnico,
            templateId: normalized.templateId,
            unidadStock: this.toPrismaEnum<UnidadMateriaPrima>(
              normalized.unidadStock,
            ),
            unidadCompra: this.toPrismaEnum<UnidadMateriaPrima>(
              normalized.unidadCompra,
            ),
            esConsumible: normalized.esConsumible,
            esRepuesto: normalized.esRepuesto,
            activo: normalized.activo,
            atributosTecnicosJson: this.toInputJson(normalized.atributosTecnicos),
          },
          select: { id: true },
        });

        if (normalized.variantes.length > 0) {
          await Promise.all(
            normalized.variantes.map((variante) =>
              tx.materiaPrimaVariante.create({
                data: {
                  tenantId: auth.tenantId,
                  materiaPrimaId: materiaPrima.id,
                  sku: variante.sku,
                  nombreVariante: variante.nombreVariante,
                  activo: variante.activo,
                  atributosVarianteJson: this.toInputJson(variante.atributosVariante),
                  unidadStock: variante.unidadStock
                    ? this.toPrismaEnum<UnidadMateriaPrima>(variante.unidadStock)
                    : null,
                  unidadCompra: variante.unidadCompra
                    ? this.toPrismaEnum<UnidadMateriaPrima>(variante.unidadCompra)
                    : null,
                  precioReferencia: variante.precioReferencia,
                  moneda: variante.moneda,
                  proveedorReferenciaId: variante.proveedorReferenciaId,
                },
              }),
            ),
          );
        }

        if (normalized.compatibilidades.length > 0) {
          const variantesGuardadas = await tx.materiaPrimaVariante.findMany({
            where: {
              tenantId: auth.tenantId,
              materiaPrimaId: materiaPrima.id,
            },
            select: {
              id: true,
              sku: true,
            },
          });
          const skuToVarianteId = new Map(
            variantesGuardadas.map((variante) => [variante.sku, variante.id]),
          );

          await Promise.all(
            normalized.compatibilidades.map((compatibilidad) => {
              const varianteId = compatibilidad.varianteSku
                ? skuToVarianteId.get(compatibilidad.varianteSku) ?? null
                : compatibilidad.varianteId ?? null;

              return (
              tx.materiaPrimaCompatibilidadMaquina.create({
                data: {
                  tenantId: auth.tenantId,
                  materiaPrimaId: materiaPrima.id,
                  varianteId,
                  plantillaMaquinaria: compatibilidad.plantillaMaquinaria
                    ? this.toPrismaEnum<PlantillaMaquinaria>(
                        compatibilidad.plantillaMaquinaria,
                      )
                    : null,
                  maquinaId: compatibilidad.maquinaId,
                  perfilOperativoId: compatibilidad.perfilOperativoId,
                  modoUso: this.toPrismaEnum<ModoUsoCompatibilidadMateriaPrima>(
                    compatibilidad.modoUso,
                  ),
                  consumoBase: compatibilidad.consumoBase,
                  unidadConsumo: compatibilidad.unidadConsumo
                    ? this.toPrismaEnum<UnidadMateriaPrima>(
                        compatibilidad.unidadConsumo,
                      )
                    : null,
                  mermaBasePct: compatibilidad.mermaBasePct,
                  activo: compatibilidad.activo,
                },
              })
              );
            }),
          );
        }

        return materiaPrima.id;
      });

      const item = await this.findMateriaPrimaOrThrow(auth, created, this.prisma);
      return this.toResponse(item);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async updateMateriaPrima(
    auth: CurrentAuth,
    id: string,
    payload: UpsertMateriaPrimaDto,
  ) {
    await this.findMateriaPrimaOrThrow(auth, id, this.prisma);
    const normalized = this.normalizePayload(payload);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.materiaPrima.update({
          where: { id },
          data: {
            codigo: normalized.codigo,
            nombre: normalized.nombre,
            descripcion: normalized.descripcion,
            familia: this.toPrismaEnum<FamiliaMateriaPrima>(normalized.familia),
            subfamilia: this.toPrismaEnum<SubfamiliaMateriaPrima>(
              normalized.subfamilia,
            ),
            tipoTecnico: normalized.tipoTecnico,
            templateId: normalized.templateId,
            unidadStock: this.toPrismaEnum<UnidadMateriaPrima>(
              normalized.unidadStock,
            ),
            unidadCompra: this.toPrismaEnum<UnidadMateriaPrima>(
              normalized.unidadCompra,
            ),
            esConsumible: normalized.esConsumible,
            esRepuesto: normalized.esRepuesto,
            activo: normalized.activo,
            atributosTecnicosJson: this.toInputJson(normalized.atributosTecnicos),
          },
        });

        await tx.materiaPrimaCompatibilidadMaquina.deleteMany({
          where: {
            tenantId: auth.tenantId,
            materiaPrimaId: id,
          },
        });

        await tx.materiaPrimaVariante.deleteMany({
          where: {
            tenantId: auth.tenantId,
            materiaPrimaId: id,
          },
        });

        if (normalized.variantes.length > 0) {
          await Promise.all(
            normalized.variantes.map((variante) =>
              tx.materiaPrimaVariante.create({
                data: {
                  tenantId: auth.tenantId,
                  materiaPrimaId: id,
                  sku: variante.sku,
                  nombreVariante: variante.nombreVariante,
                  activo: variante.activo,
                  atributosVarianteJson: this.toInputJson(variante.atributosVariante),
                  unidadStock: variante.unidadStock
                    ? this.toPrismaEnum<UnidadMateriaPrima>(variante.unidadStock)
                    : null,
                  unidadCompra: variante.unidadCompra
                    ? this.toPrismaEnum<UnidadMateriaPrima>(variante.unidadCompra)
                    : null,
                  precioReferencia: variante.precioReferencia,
                  moneda: variante.moneda,
                  proveedorReferenciaId: variante.proveedorReferenciaId,
                },
              }),
            ),
          );
        }

        if (normalized.compatibilidades.length > 0) {
          const skuToVarianteId = new Map<string, string>();
          const variantesGuardadas = await tx.materiaPrimaVariante.findMany({
            where: {
              tenantId: auth.tenantId,
              materiaPrimaId: id,
            },
            select: {
              id: true,
              sku: true,
            },
          });

          for (const variante of variantesGuardadas) {
            skuToVarianteId.set(variante.sku, variante.id);
          }

          await Promise.all(
            normalized.compatibilidades.map((compatibilidad) => {
              const varianteId = compatibilidad.varianteSku
                ? skuToVarianteId.get(compatibilidad.varianteSku) ?? null
                : compatibilidad.varianteId ?? null;

              return tx.materiaPrimaCompatibilidadMaquina.create({
                data: {
                  tenantId: auth.tenantId,
                  materiaPrimaId: id,
                  varianteId,
                  plantillaMaquinaria: compatibilidad.plantillaMaquinaria
                    ? this.toPrismaEnum<PlantillaMaquinaria>(
                        compatibilidad.plantillaMaquinaria,
                      )
                    : null,
                  maquinaId: compatibilidad.maquinaId,
                  perfilOperativoId: compatibilidad.perfilOperativoId,
                  modoUso: this.toPrismaEnum<ModoUsoCompatibilidadMateriaPrima>(
                    compatibilidad.modoUso,
                  ),
                  consumoBase: compatibilidad.consumoBase,
                  unidadConsumo: compatibilidad.unidadConsumo
                    ? this.toPrismaEnum<UnidadMateriaPrima>(
                        compatibilidad.unidadConsumo,
                      )
                    : null,
                  mermaBasePct: compatibilidad.mermaBasePct,
                  activo: compatibilidad.activo,
                },
              });
            }),
          );
        }
      });

      const item = await this.findMateriaPrimaOrThrow(auth, id, this.prisma);
      return this.toResponse(item);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async toggleMateriaPrima(auth: CurrentAuth, id: string) {
    const item = await this.findMateriaPrimaOrThrow(auth, id, this.prisma);

    await this.prisma.materiaPrima.update({
      where: { id },
      data: {
        activo: !item.activo,
      },
    });

    const updated = await this.findMateriaPrimaOrThrow(auth, id, this.prisma);
    return this.toResponse(updated);
  }

  private async findMateriaPrimaOrThrow(
    auth: CurrentAuth,
    id: string,
    db: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await db.materiaPrima.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
      include: {
        variantes: {
          include: {
            proveedorReferencia: true,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
        compatibilidades: {
          include: {
            maquina: true,
            perfilOperativo: true,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`No existe la materia prima ${id}`);
    }

    return item;
  }

  private normalizePayload(payload: UpsertMateriaPrimaDto) {
    if (!unitsAreCompatible(payload.unidadStock, payload.unidadCompra)) {
      throw new BadRequestException(
        'Unidad de uso y unidad de compra deben ser compatibles para conversion.',
      );
    }

    const variantes = payload.variantes.map((variante) => ({
      ...variante,
      sku: variante.sku.trim(),
      nombreVariante: variante.nombreVariante?.trim() || null,
      moneda: variante.moneda?.trim().toUpperCase() || null,
    }));

    const compatibilidades = payload.compatibilidades.map((compatibilidad) => ({
      ...compatibilidad,
      varianteSku: compatibilidad.varianteSku?.trim() || null,
    }));

    return {
      codigo: payload.codigo.trim(),
      nombre: payload.nombre.trim(),
      descripcion: payload.descripcion?.trim() || null,
      familia: payload.familia,
      subfamilia: payload.subfamilia,
      tipoTecnico: payload.tipoTecnico.trim(),
      templateId: payload.templateId.trim(),
      unidadStock: payload.unidadStock,
      unidadCompra: payload.unidadCompra,
      esConsumible: payload.esConsumible,
      esRepuesto: payload.esRepuesto,
      activo: payload.activo,
      atributosTecnicos: payload.atributosTecnicos,
      variantes,
      compatibilidades,
    };
  }

  private toResponse(item: MateriaPrimaEntity) {
    return {
      id: item.id,
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      familia: this.toApiEnum(item.familia),
      subfamilia: this.toApiEnum(item.subfamilia),
      tipoTecnico: item.tipoTecnico,
      templateId: item.templateId,
      unidadStock: this.toApiEnum(item.unidadStock),
      unidadCompra: this.toApiEnum(item.unidadCompra),
      esConsumible: item.esConsumible,
      esRepuesto: item.esRepuesto,
      activo: item.activo,
      atributosTecnicos: item.atributosTecnicosJson,
      variantes: item.variantes.map((variante) => ({
        id: variante.id,
        sku: variante.sku,
        nombreVariante: variante.nombreVariante ?? '',
        activo: variante.activo,
        atributosVariante: variante.atributosVarianteJson,
        unidadStock: variante.unidadStock
          ? this.toApiEnum(variante.unidadStock)
          : null,
        unidadCompra: variante.unidadCompra
          ? this.toApiEnum(variante.unidadCompra)
          : null,
        precioReferencia: variante.precioReferencia
          ? this.decimalToNumber(variante.precioReferencia)
          : null,
        moneda: variante.moneda ?? '',
        proveedorReferenciaId: variante.proveedorReferenciaId,
        proveedorReferenciaNombre: variante.proveedorReferencia?.nombre ?? '',
      })),
      compatibilidades: item.compatibilidades.map((compatibilidad) => ({
        id: compatibilidad.id,
        varianteId: compatibilidad.varianteId,
        plantillaMaquinaria: compatibilidad.plantillaMaquinaria
          ? this.toApiEnum(compatibilidad.plantillaMaquinaria)
          : null,
        maquinaId: compatibilidad.maquinaId,
        maquinaNombre: compatibilidad.maquina?.nombre ?? '',
        perfilOperativoId: compatibilidad.perfilOperativoId,
        perfilOperativoNombre: compatibilidad.perfilOperativo?.nombre ?? '',
        modoUso: this.toApiEnum(compatibilidad.modoUso),
        consumoBase: compatibilidad.consumoBase
          ? this.decimalToNumber(compatibilidad.consumoBase)
          : null,
        unidadConsumo: compatibilidad.unidadConsumo
          ? this.toApiEnum(compatibilidad.unidadConsumo)
          : null,
        mermaBasePct: compatibilidad.mermaBasePct
          ? this.decimalToNumber(compatibilidad.mermaBasePct)
          : null,
        activo: compatibilidad.activo,
      })),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private toPrismaEnum<T>(value: string): T {
    return value.toUpperCase() as T;
  }

  private toApiEnum(value: string) {
    return value.toLowerCase();
  }

  private decimalToNumber(value: Prisma.Decimal) {
    return Number(value);
  }

  private toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private handleWriteError(error: unknown): never {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Ya existe un registro con uno de los identificadores unicos cargados.',
        );
      }
    }

    throw error;
  }
}
