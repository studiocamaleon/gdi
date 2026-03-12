import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FamiliaMateriaPrima,
  OrigenMovimientoStockMateriaPrima,
  ModoUsoCompatibilidadMateriaPrima,
  PlantillaMaquinaria,
  Prisma,
  SubfamiliaMateriaPrima,
  TipoMovimientoStockMateriaPrima,
  UnidadMateriaPrima,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { GetKardexQueryDto } from './dto/get-kardex-query.dto';
import { GetStockQueryDto } from './dto/get-stock-query.dto';
import {
  OrigenMovimientoStockMateriaPrimaDto,
  RegistrarMovimientoStockDto,
  TipoMovimientoStockMateriaPrimaDto,
} from './dto/registrar-movimiento-stock.dto';
import { RegistrarTransferenciaStockDto } from './dto/registrar-transferencia-stock.dto';
import { UpdateVariantePrecioReferenciaDto } from './dto/update-variante-precio-referencia.dto';
import { UpsertAlmacenDto } from './dto/upsert-almacen.dto';
import {
  UpsertMateriaPrimaDto,
} from './dto/upsert-materia-prima.dto';
import { UpsertUbicacionDto } from './dto/upsert-ubicacion.dto';
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

  async updateVariantePrecioReferencia(
    auth: CurrentAuth,
    varianteId: string,
    payload: UpdateVariantePrecioReferenciaDto,
  ) {
    await this.findVarianteOrThrow(auth, varianteId, this.prisma);

    try {
      const updated = await this.prisma.materiaPrimaVariante.update({
        where: { id: varianteId },
        data: {
          precioReferencia: this.toDecimal(payload.precioReferencia),
          ...(payload.moneda?.trim()
            ? { moneda: payload.moneda.trim().toUpperCase() }
            : {}),
        },
        select: {
          id: true,
          precioReferencia: true,
          moneda: true,
          updatedAt: true,
        },
      });

      return {
        varianteId: updated.id,
        precioReferencia: this.decimalToNumber(updated.precioReferencia!),
        moneda: updated.moneda ?? '',
        updatedAt: updated.updatedAt.toISOString(),
      };
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async findAllAlmacenes(auth: CurrentAuth) {
    const items = await this.prisma.almacenMateriaPrima.findMany({
      where: {
        tenantId: auth.tenantId,
      },
      include: {
        ubicaciones: {
          orderBy: [{ nombre: 'asc' }],
        },
      },
      orderBy: [{ nombre: 'asc' }],
    });

    return items.map((item) => ({
      id: item.id,
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      activo: item.activo,
      ubicaciones: item.ubicaciones.map((ubicacion) => ({
        id: ubicacion.id,
        codigo: ubicacion.codigo,
        nombre: ubicacion.nombre,
        descripcion: ubicacion.descripcion ?? '',
        activo: ubicacion.activo,
      })),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  async createAlmacen(auth: CurrentAuth, payload: UpsertAlmacenDto) {
    const normalized = this.normalizeAlmacenPayload(payload);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const almacen = await tx.almacenMateriaPrima.create({
          data: {
            tenantId: auth.tenantId,
            codigo: normalized.codigo,
            nombre: normalized.nombre,
            descripcion: normalized.descripcion,
            activo: normalized.activo,
          },
        });

        // UX PyME: cada almacen nace con una ubicacion principal para evitar
        // que el usuario deba gestionar granularidad interna desde el inicio.
        await tx.almacenMateriaPrimaUbicacion.create({
          data: {
            tenantId: auth.tenantId,
            almacenId: almacen.id,
            codigo: 'PRINCIPAL',
            nombre: 'Principal',
            descripcion: 'Ubicacion interna por defecto',
            activo: true,
          },
        });

        return almacen;
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async updateAlmacen(auth: CurrentAuth, id: string, payload: UpsertAlmacenDto) {
    await this.findAlmacenOrThrow(auth, id, this.prisma);
    const normalized = this.normalizeAlmacenPayload(payload);

    try {
      return await this.prisma.almacenMateriaPrima.update({
        where: { id },
        data: {
          codigo: normalized.codigo,
          nombre: normalized.nombre,
          descripcion: normalized.descripcion,
          activo: normalized.activo,
        },
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async toggleAlmacen(auth: CurrentAuth, id: string) {
    const current = await this.findAlmacenOrThrow(auth, id, this.prisma);

    return this.prisma.almacenMateriaPrima.update({
      where: { id },
      data: {
        activo: !current.activo,
      },
    });
  }

  async findUbicacionesByAlmacen(auth: CurrentAuth, almacenId: string) {
    await this.findAlmacenOrThrow(auth, almacenId, this.prisma);

    const items = await this.prisma.almacenMateriaPrimaUbicacion.findMany({
      where: {
        tenantId: auth.tenantId,
        almacenId,
      },
      orderBy: [{ nombre: 'asc' }],
    });

    return items.map((item) => ({
      id: item.id,
      almacenId: item.almacenId,
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      activo: item.activo,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  async createUbicacion(
    auth: CurrentAuth,
    almacenId: string,
    payload: UpsertUbicacionDto,
  ) {
    await this.findAlmacenOrThrow(auth, almacenId, this.prisma);
    const normalized = this.normalizeUbicacionPayload(payload);

    try {
      return await this.prisma.almacenMateriaPrimaUbicacion.create({
        data: {
          tenantId: auth.tenantId,
          almacenId,
          codigo: normalized.codigo,
          nombre: normalized.nombre,
          descripcion: normalized.descripcion,
          activo: normalized.activo,
        },
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async updateUbicacion(
    auth: CurrentAuth,
    id: string,
    payload: UpsertUbicacionDto,
  ) {
    await this.findUbicacionOrThrow(auth, id, this.prisma);
    const normalized = this.normalizeUbicacionPayload(payload);

    try {
      return await this.prisma.almacenMateriaPrimaUbicacion.update({
        where: { id },
        data: {
          codigo: normalized.codigo,
          nombre: normalized.nombre,
          descripcion: normalized.descripcion,
          activo: normalized.activo,
        },
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async toggleUbicacion(auth: CurrentAuth, id: string) {
    const current = await this.findUbicacionOrThrow(auth, id, this.prisma);
    return this.prisma.almacenMateriaPrimaUbicacion.update({
      where: { id },
      data: {
        activo: !current.activo,
      },
    });
  }

  async registrarMovimiento(auth: CurrentAuth, payload: RegistrarMovimientoStockDto) {
    if (!this.isSupportedSimpleMovement(payload.tipo)) {
      throw new BadRequestException(
        'Tipo de movimiento no soportado por este endpoint.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const cantidad = this.toDecimal(payload.cantidad);
      const variante = await this.findVarianteOrThrow(auth, payload.varianteId, tx);
      const ubicacion = await this.findUbicacionOrThrow(auth, payload.ubicacionId, tx);
      const stockActual = await this.findStockRow(auth, payload.varianteId, payload.ubicacionId, tx);

      let saldoPosterior = stockActual
        ? this.decimalToNumber(stockActual.cantidadDisponible)
        : 0;
      let costoPromedioPosterior = stockActual
        ? this.decimalToNumber(stockActual.costoPromedio)
        : 0;

      const tipo = this.toPrismaEnum<TipoMovimientoStockMateriaPrima>(payload.tipo);
      const origen = this.toPrismaEnum<OrigenMovimientoStockMateriaPrima>(payload.origen);
      const unitCost = payload.costoUnitario ?? null;
      const stockPrevio = stockActual ? this.decimalToNumber(stockActual.cantidadDisponible) : 0;
      const costoPromedioPrevio = stockActual ? this.decimalToNumber(stockActual.costoPromedio) : 0;

      if (
        tipo === TipoMovimientoStockMateriaPrima.INGRESO ||
        tipo === TipoMovimientoStockMateriaPrima.AJUSTE_ENTRADA
      ) {
        const nextQty = stockPrevio + this.decimalToNumber(cantidad);
        const costIn = unitCost ?? costoPromedioPrevio ?? 0;
        const newAvg = nextQty > 0
          ? ((stockPrevio * costoPromedioPrevio) + (this.decimalToNumber(cantidad) * costIn)) / nextQty
          : 0;

        saldoPosterior = Number(nextQty.toFixed(4));
        costoPromedioPosterior = Number(newAvg.toFixed(6));
      } else {
        const nextQty = stockPrevio - this.decimalToNumber(cantidad);
        if (nextQty < 0) {
          throw new BadRequestException(
            `Stock insuficiente para ${variante.sku} en ${ubicacion.nombre}.`,
          );
        }

        saldoPosterior = Number(nextQty.toFixed(4));
        costoPromedioPosterior = Number(costoPromedioPrevio.toFixed(6));
      }

      const upsertedStock = await tx.stockMateriaPrimaVariante.upsert({
        where: {
          tenantId_varianteId_ubicacionId: {
            tenantId: auth.tenantId,
            varianteId: payload.varianteId,
            ubicacionId: payload.ubicacionId,
          },
        },
        update: {
          cantidadDisponible: new Prisma.Decimal(saldoPosterior),
          costoPromedio: new Prisma.Decimal(costoPromedioPosterior),
        },
        create: {
          tenantId: auth.tenantId,
          varianteId: payload.varianteId,
          ubicacionId: payload.ubicacionId,
          cantidadDisponible: new Prisma.Decimal(saldoPosterior),
          costoPromedio: new Prisma.Decimal(costoPromedioPosterior),
        },
      });

      const movimiento = await tx.movimientoStockMateriaPrima.create({
        data: {
          tenantId: auth.tenantId,
          varianteId: payload.varianteId,
          ubicacionId: payload.ubicacionId,
          tipo,
          origen,
          cantidad,
          costoUnitario: unitCost === null ? null : new Prisma.Decimal(unitCost),
          saldoPosterior: upsertedStock.cantidadDisponible,
          costoPromedioPost: upsertedStock.costoPromedio,
          referenciaTipo: payload.referenciaTipo?.trim() || null,
          referenciaId: payload.referenciaId?.trim() || null,
          notas: payload.notas?.trim() || null,
        },
      });

      return this.toMovimientoResponse(movimiento);
    });
  }

  async registrarTransferencia(
    auth: CurrentAuth,
    payload: RegistrarTransferenciaStockDto,
  ) {
    if (payload.ubicacionOrigenId === payload.ubicacionDestinoId) {
      throw new BadRequestException('Origen y destino deben ser distintos.');
    }

    return this.prisma.$transaction(async (tx) => {
      const cantidad = this.toDecimal(payload.cantidad);
      const transferenciaId = randomUUID();
      const variante = await this.findVarianteOrThrow(auth, payload.varianteId, tx);
      await this.findUbicacionOrThrow(auth, payload.ubicacionOrigenId, tx);
      await this.findUbicacionOrThrow(auth, payload.ubicacionDestinoId, tx);

      const stockOrigen = await this.findStockRow(
        auth,
        payload.varianteId,
        payload.ubicacionOrigenId,
        tx,
      );
      const qtyOrigen = stockOrigen
        ? this.decimalToNumber(stockOrigen.cantidadDisponible)
        : 0;

      const qtyTransfer = this.decimalToNumber(cantidad);
      if (qtyOrigen < qtyTransfer) {
        throw new BadRequestException(
          `Stock insuficiente para transferir ${variante.sku}.`,
        );
      }

      const costPromOrigen = stockOrigen
        ? this.decimalToNumber(stockOrigen.costoPromedio)
        : 0;
      const saldoOrigenPost = Number((qtyOrigen - qtyTransfer).toFixed(4));

      const stockOrigenPost = await tx.stockMateriaPrimaVariante.upsert({
        where: {
          tenantId_varianteId_ubicacionId: {
            tenantId: auth.tenantId,
            varianteId: payload.varianteId,
            ubicacionId: payload.ubicacionOrigenId,
          },
        },
        update: {
          cantidadDisponible: new Prisma.Decimal(saldoOrigenPost),
          costoPromedio: new Prisma.Decimal(costPromOrigen),
        },
        create: {
          tenantId: auth.tenantId,
          varianteId: payload.varianteId,
          ubicacionId: payload.ubicacionOrigenId,
          cantidadDisponible: new Prisma.Decimal(saldoOrigenPost),
          costoPromedio: new Prisma.Decimal(costPromOrigen),
        },
      });

      const movimientoSalida = await tx.movimientoStockMateriaPrima.create({
        data: {
          tenantId: auth.tenantId,
          varianteId: payload.varianteId,
          ubicacionId: payload.ubicacionOrigenId,
          tipo: TipoMovimientoStockMateriaPrima.TRANSFERENCIA_SALIDA,
          origen: OrigenMovimientoStockMateriaPrima.TRANSFERENCIA,
          cantidad,
          costoUnitario: new Prisma.Decimal(costPromOrigen),
          saldoPosterior: stockOrigenPost.cantidadDisponible,
          costoPromedioPost: stockOrigenPost.costoPromedio,
          referenciaTipo: payload.referenciaTipo?.trim() || 'transferencia',
          referenciaId: payload.referenciaId?.trim() || null,
          transferenciaId,
          notas: payload.notas?.trim() || null,
        },
      });

      const stockDestino = await this.findStockRow(
        auth,
        payload.varianteId,
        payload.ubicacionDestinoId,
        tx,
      );

      const qtyDestino = stockDestino
        ? this.decimalToNumber(stockDestino.cantidadDisponible)
        : 0;
      const costPromDestino = stockDestino
        ? this.decimalToNumber(stockDestino.costoPromedio)
        : 0;
      const saldoDestinoPost = Number((qtyDestino + qtyTransfer).toFixed(4));
      const costPromDestinoPost =
        saldoDestinoPost > 0
          ? Number(
              (
                (qtyDestino * costPromDestino + qtyTransfer * costPromOrigen) /
                saldoDestinoPost
              ).toFixed(6),
            )
          : 0;

      const stockDestinoPost = await tx.stockMateriaPrimaVariante.upsert({
        where: {
          tenantId_varianteId_ubicacionId: {
            tenantId: auth.tenantId,
            varianteId: payload.varianteId,
            ubicacionId: payload.ubicacionDestinoId,
          },
        },
        update: {
          cantidadDisponible: new Prisma.Decimal(saldoDestinoPost),
          costoPromedio: new Prisma.Decimal(costPromDestinoPost),
        },
        create: {
          tenantId: auth.tenantId,
          varianteId: payload.varianteId,
          ubicacionId: payload.ubicacionDestinoId,
          cantidadDisponible: new Prisma.Decimal(saldoDestinoPost),
          costoPromedio: new Prisma.Decimal(costPromDestinoPost),
        },
      });

      const movimientoEntrada = await tx.movimientoStockMateriaPrima.create({
        data: {
          tenantId: auth.tenantId,
          varianteId: payload.varianteId,
          ubicacionId: payload.ubicacionDestinoId,
          tipo: TipoMovimientoStockMateriaPrima.TRANSFERENCIA_ENTRADA,
          origen: OrigenMovimientoStockMateriaPrima.TRANSFERENCIA,
          cantidad,
          costoUnitario: new Prisma.Decimal(costPromOrigen),
          saldoPosterior: stockDestinoPost.cantidadDisponible,
          costoPromedioPost: stockDestinoPost.costoPromedio,
          referenciaTipo: payload.referenciaTipo?.trim() || 'transferencia',
          referenciaId: payload.referenciaId?.trim() || null,
          transferenciaId,
          notas: payload.notas?.trim() || null,
        },
      });

      return {
        transferenciaId,
        salida: this.toMovimientoResponse(movimientoSalida),
        entrada: this.toMovimientoResponse(movimientoEntrada),
      };
    });
  }

  async getStockActual(auth: CurrentAuth, query: GetStockQueryDto) {
    const soloConStock = query.soloConStock === 'true';
    const rows = await this.prisma.stockMateriaPrimaVariante.findMany({
      where: {
        tenantId: auth.tenantId,
        varianteId: query.varianteId,
        ubicacionId: query.ubicacionId,
        ...(soloConStock
          ? { cantidadDisponible: { gt: new Prisma.Decimal(0) } }
          : {}),
        variante: query.materiaPrimaId
          ? { materiaPrimaId: query.materiaPrimaId }
          : undefined,
        ubicacion: query.almacenId ? { almacenId: query.almacenId } : undefined,
      },
      include: {
        variante: {
          include: {
            materiaPrima: true,
          },
        },
        ubicacion: {
          include: {
            almacen: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return rows.map((row) => {
      const cantidad = this.decimalToNumber(row.cantidadDisponible);
      const costo = this.decimalToNumber(row.costoPromedio);
      return {
        id: row.id,
        varianteId: row.varianteId,
        varianteSku: row.variante.sku,
        materiaPrimaId: row.variante.materiaPrimaId,
        materiaPrimaNombre: row.variante.materiaPrima.nombre,
        ubicacionId: row.ubicacionId,
        ubicacionNombre: row.ubicacion.nombre,
        almacenId: row.ubicacion.almacenId,
        almacenNombre: row.ubicacion.almacen.nombre,
        cantidadDisponible: cantidad,
        costoPromedio: costo,
        valorStock: Number((cantidad * costo).toFixed(4)),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  async getKardex(auth: CurrentAuth, query: GetKardexQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const where: Prisma.MovimientoStockMateriaPrimaWhereInput = {
      tenantId: auth.tenantId,
      varianteId: query.varianteId,
      ubicacionId: query.ubicacionId,
      createdAt: {
        gte: query.fechaDesde ? new Date(query.fechaDesde) : undefined,
        lte: query.fechaHasta ? new Date(query.fechaHasta) : undefined,
      },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.movimientoStockMateriaPrima.findMany({
        where,
        include: {
          ubicacion: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.movimientoStockMateriaPrima.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...this.toMovimientoResponse(item),
        ubicacionNombre: item.ubicacion.nombre,
      })),
      total,
      page,
      pageSize,
    };
  }

  private isSupportedSimpleMovement(tipo: TipoMovimientoStockMateriaPrimaDto) {
    return (
      tipo === TipoMovimientoStockMateriaPrimaDto.ingreso ||
      tipo === TipoMovimientoStockMateriaPrimaDto.egreso ||
      tipo === TipoMovimientoStockMateriaPrimaDto.ajuste_entrada ||
      tipo === TipoMovimientoStockMateriaPrimaDto.ajuste_salida
    );
  }

  private normalizeAlmacenPayload(payload: UpsertAlmacenDto) {
    return {
      codigo: payload.codigo.trim(),
      nombre: payload.nombre.trim(),
      descripcion: payload.descripcion?.trim() || null,
      activo: payload.activo,
    };
  }

  private normalizeUbicacionPayload(payload: UpsertUbicacionDto) {
    return {
      codigo: payload.codigo.trim(),
      nombre: payload.nombre.trim(),
      descripcion: payload.descripcion?.trim() || null,
      activo: payload.activo,
    };
  }

  private async findAlmacenOrThrow(
    auth: CurrentAuth,
    id: string,
    db: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await db.almacenMateriaPrima.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
    });

    if (!item) {
      throw new NotFoundException(`No existe el almacen ${id}`);
    }

    return item;
  }

  private async findUbicacionOrThrow(
    auth: CurrentAuth,
    id: string,
    db: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await db.almacenMateriaPrimaUbicacion.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
      },
    });

    if (!item) {
      throw new NotFoundException(`No existe la ubicacion ${id}`);
    }

    return item;
  }

  private async findVarianteOrThrow(
    auth: CurrentAuth,
    varianteId: string,
    db: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await db.materiaPrimaVariante.findFirst({
      where: {
        id: varianteId,
        tenantId: auth.tenantId,
      },
      select: {
        id: true,
        sku: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`No existe la variante ${varianteId}`);
    }

    return item;
  }

  private async findStockRow(
    auth: CurrentAuth,
    varianteId: string,
    ubicacionId: string,
    db: PrismaService | Prisma.TransactionClient,
  ) {
    return db.stockMateriaPrimaVariante.findFirst({
      where: {
        tenantId: auth.tenantId,
        varianteId,
        ubicacionId,
      },
    });
  }

  private toDecimal(value: number) {
    return new Prisma.Decimal(value);
  }

  private toMovimientoResponse(item: {
    id: string;
    varianteId: string;
    ubicacionId: string;
    tipo: TipoMovimientoStockMateriaPrima;
    origen: OrigenMovimientoStockMateriaPrima;
    cantidad: Prisma.Decimal;
    costoUnitario: Prisma.Decimal | null;
    saldoPosterior: Prisma.Decimal;
    costoPromedioPost: Prisma.Decimal;
    referenciaTipo: string | null;
    referenciaId: string | null;
    transferenciaId: string | null;
    notas: string | null;
    createdAt: Date;
  }) {
    return {
      movimientoId: item.id,
      varianteId: item.varianteId,
      ubicacionId: item.ubicacionId,
      tipo: this.toApiEnum(item.tipo),
      origen: this.toApiEnum(item.origen),
      cantidad: this.decimalToNumber(item.cantidad),
      costoUnitario: item.costoUnitario
        ? this.decimalToNumber(item.costoUnitario)
        : null,
      saldoPosterior: this.decimalToNumber(item.saldoPosterior),
      costoPromedioPost: this.decimalToNumber(item.costoPromedioPost),
      referenciaTipo: item.referenciaTipo,
      referenciaId: item.referenciaId,
      transferenciaId: item.transferenciaId,
      notas: item.notas,
      createdAt: item.createdAt.toISOString(),
    };
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
