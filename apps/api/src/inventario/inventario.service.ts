import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import {
  bloquearVariantesStock,
  exigirStockLibre,
  reservasPorSaldo,
} from './stock-reservas';
import {
  TipoCambioService,
  factorCambioMaterial,
} from '../cotizaciones/tipo-cambio.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
  NotFoundException,
} from '@nestjs/common';
import {
  FamiliaMateriaPrima,
  type MovimientoStockMateriaPrima,
  OrigenMovimientoStockMateriaPrima,
  Prisma,
  SubfamiliaMateriaPrima,
  TipoMovimientoStockMateriaPrima,
  UnidadMateriaPrima,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { regionalDelTenant } from '../common/regional';
import { monedas } from '../common/monedas';
import { randomUUID } from 'crypto';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginatedResponse } from '../common/dto/pagination.dto';
import { BulkUpdateCostosDto } from './dto/bulk-update-costos.dto';
import { GetKardexQueryDto } from './dto/get-kardex-query.dto';
import { GetStockQueryDto } from './dto/get-stock-query.dto';
import { GetStockPageQueryDto } from './dto/get-stock-page-query.dto';
import {
  RegistrarMovimientoStockDto,
  TipoMovimientoStockMateriaPrimaDto,
} from './dto/registrar-movimiento-stock.dto';
import { RegistrarTransferenciaStockDto } from './dto/registrar-transferencia-stock.dto';
import { UpdateVariantePrecioReferenciaDto } from './dto/update-variante-precio-referencia.dto';
import { UpsertAlmacenDto } from './dto/upsert-almacen.dto';
import { UpsertMateriaPrimaDto } from './dto/upsert-materia-prima.dto';
import { UpsertUbicacionDto } from './dto/upsert-ubicacion.dto';
import { type UnitCode } from './unidades-canonicas';
import {
  materialPriceContext,
  materialPriceInStockUnit,
  materialUnitConversion,
  readMaterialEquivalences,
  materialEquivalences,
  normalizeMaterialUnit,
  validateMaterialUnits,
} from './material-units';

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
  };
}>;

const stockInclude = {
  variante: { include: { materiaPrima: true } },
  ubicacion: { include: { almacen: true } },
} satisfies Prisma.StockMateriaPrimaVarianteInclude;
type StockRow = Prisma.StockMateriaPrimaVarianteGetPayload<{
  include: typeof stockInclude;
}>;

@Injectable()
export class InventarioService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly tipoCambio?: TipoCambioService,
    private readonly capacidades: CapacidadesEmpresaService = new CapacidadesEmpresaService(
      prisma,
    ),
  ) {}

  async findAllMateriasPrimas(
    auth: CurrentAuth,
    opts: { pagination: PaginationDto; search?: string },
  ) {
    const { pagination, search } = opts;
    const where: Prisma.MateriaPrimaWhereInput = {
      tenantId: auth.tenantId,
      ...(search
        ? {
            OR: [
              { nombre: { contains: search, mode: 'insensitive' } },
              { codigo: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.materiaPrima.findMany({
        where,
        include: {
          variantes: {
            include: {
              proveedorReferencia: true,
            },
            orderBy: [{ createdAt: 'asc' }],
          },
        },
        orderBy: [{ nombre: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.materiaPrima.count({ where }),
    ]);

    return paginatedResponse(
      items.map((item) => this.toResponse(item)),
      total,
      pagination,
    );
  }

  async findMateriaPrima(auth: CurrentAuth, id: string) {
    const item = await this.findMateriaPrimaOrThrow(auth, id, this.prisma);
    return this.toResponse(item);
  }

  /**
   * Valida que todos los `proveedorReferenciaId` de las variantes existan y
   * pertenezcan al tenant. Evita vincular (y filtrar) proveedores ajenos.
   */
  private async assertProveedoresDelTenant(
    auth: CurrentAuth,
    variantes: { proveedorReferenciaId?: string | null }[],
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const ids = Array.from(
      new Set(
        variantes
          .map((variante) => variante.proveedorReferenciaId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (ids.length === 0) return;

    const encontrados = await client.proveedor.findMany({
      where: { tenantId: auth.tenantId, activo: true, id: { in: ids } },
      select: { id: true },
    });
    if (encontrados.length !== ids.length) {
      throw new BadRequestException(
        'Uno o más proveedores referenciados no existen, están inhabilitados o no pertenecen a tu empresa.',
      );
    }
  }

  async createMateriaPrima(auth: CurrentAuth, payload: UpsertMateriaPrimaDto) {
    await this.capacidades.exigir(auth.tenantId, 'materiales');
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    const normalized = this.normalizePayload({
      ...payload,
      variantes: payload.variantes.map((v) => ({
        ...v,
        moneda: v.moneda || regional.moneda.codigo,
      })),
    });

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await this.assertProveedoresDelTenant(auth, normalized.variantes, tx);
        // Código libre: permite crear otro material con el mismo nombre (ej.
        // "Vinilo impreso" de otra marca) sin chocar — mismo criterio que la
        // biblioteca (código, código-2, código-3…).
        const codigo = await this.nextCodigoDisponible(
          tx,
          auth.tenantId,
          normalized.codigo,
        );
        const materiaPrima = await tx.materiaPrima.create({
          data: {
            tenantId: auth.tenantId,
            codigo,
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
            unidadUso: this.toPrismaEnum<UnidadMateriaPrima>(
              normalized.unidadUso,
            ),
            unidadCompra: this.toPrismaEnum<UnidadMateriaPrima>(
              normalized.unidadCompra,
            ),
            esConsumible: normalized.esConsumible,
            esRepuesto: normalized.esRepuesto,
            esProductoBase: normalized.esProductoBase,
            activo: normalized.activo,
            atributosTecnicosJson: this.toInputJson(
              normalized.atributosTecnicos,
            ),
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
                  atributosVarianteJson: this.toInputJson(
                    variante.atributosVariante,
                  ),
                  unidadStock: variante.unidadStock
                    ? this.toPrismaEnum<UnidadMateriaPrima>(
                        variante.unidadStock,
                      )
                    : null,
                  unidadCompra: variante.unidadCompra
                    ? this.toPrismaEnum<UnidadMateriaPrima>(
                        variante.unidadCompra,
                      )
                    : null,
                  unidadUso: variante.unidadUso
                    ? this.toPrismaEnum<UnidadMateriaPrima>(variante.unidadUso)
                    : null,
                  equivalenciasJson:
                    variante.equivalencias == null
                      ? Prisma.DbNull
                      : variante.equivalencias.map((relation) => ({
                          ...relation,
                        })),
                  precioReferencia: variante.precioReferencia,
                  unidadPrecio: variante.unidadPrecio
                    ? this.toPrismaEnum<UnidadMateriaPrima>(
                        variante.unidadPrecio,
                      )
                    : null,
                  equivalenciaCompra:
                    variante.equivalenciaCompra == null
                      ? null
                      : this.toDecimal(variante.equivalenciaCompra),
                  moneda: variante.moneda,
                  proveedorReferenciaId: variante.proveedorReferenciaId,
                },
              }),
            ),
          );
        }

        return materiaPrima.id;
      });

      const item = await this.findMateriaPrimaOrThrow(
        auth,
        created,
        this.prisma,
      );
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
    await this.capacidades.exigir(auth.tenantId, 'materiales');
    const previous = await this.findMateriaPrimaOrThrow(auth, id, this.prisma);
    const regional = await regionalDelTenant(this.prisma, auth.tenantId);
    const normalized = this.normalizePayload({
      ...payload,
      unidadUso:
        payload.unidadUso ??
        (this.toApiEnum(
          previous.unidadUso ?? previous.unidadStock,
        ) as UpsertMateriaPrimaDto['unidadUso']),
      variantes: payload.variantes.map((v) => {
        const old = previous.variantes.find((item) => item.sku === v.sku);
        return {
          ...v,
          moneda: v.moneda || old?.moneda || regional.moneda.codigo,
          unidadUso:
            v.unidadUso ??
            ((payload.unidadUso &&
            payload.unidadUso !==
              (previous.unidadUso ?? previous.unidadStock).toLowerCase()
              ? undefined
              : old?.unidadUso?.toLowerCase()) as UpsertMateriaPrimaDto['variantes'][number]['unidadUso']),
          equivalencias:
            v.equivalencias ??
            (v.equivalenciaCompra === undefined
              ? ((readMaterialEquivalences(old?.equivalenciasJson) ??
                  undefined) as UpsertMateriaPrimaDto['variantes'][number]['equivalencias'])
              : undefined),
          unidadPrecio:
            v.unidadPrecio === undefined
              ? ((old?.unidadPrecio?.toLowerCase() as typeof v.unidadPrecio) ??
                null)
              : v.unidadPrecio,
          equivalenciaCompra:
            v.equivalenciaCompra === undefined
              ? old?.equivalenciaCompra == null
                ? null
                : Number(old.equivalenciaCompra)
              : v.equivalenciaCompra,
        };
      }),
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.assertProveedoresDelTenant(auth, normalized.variantes, tx);
        await bloquearVariantesStock(
          tx,
          auth.tenantId,
          previous.variantes.map((v) => v.id),
        );
        for (const old of previous.variantes) {
          const incoming = normalized.variantes.find((v) => v.sku === old.sku);
          if (incoming)
            await this.assertStockUnitChange(
              auth,
              old.id,
              old.unidadStock ?? previous.unidadStock,
              incoming.unidadStock ?? normalized.unidadStock,
              tx,
            );
        }
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
            unidadUso: this.toPrismaEnum<UnidadMateriaPrima>(
              normalized.unidadUso,
            ),
            unidadCompra: this.toPrismaEnum<UnidadMateriaPrima>(
              normalized.unidadCompra,
            ),
            esConsumible: normalized.esConsumible,
            esRepuesto: normalized.esRepuesto,
            esProductoBase: normalized.esProductoBase,
            activo: normalized.activo,
            atributosTecnicosJson: this.toInputJson(
              normalized.atributosTecnicos,
            ),
          },
        });
        const existentes = await tx.materiaPrimaVariante.findMany({
          where: {
            tenantId: auth.tenantId,
            materiaPrimaId: id,
          },
          select: {
            id: true,
            sku: true,
          },
        });

        const existenteBySku = new Map(
          existentes.map((variante) => [variante.sku, variante]),
        );
        const incomingSkus = new Set(
          normalized.variantes.map((item) => item.sku),
        );

        if (normalized.variantes.length > 0) {
          await Promise.all(
            normalized.variantes.map((variante) => {
              const data = {
                tenantId: auth.tenantId,
                materiaPrimaId: id,
                sku: variante.sku,
                nombreVariante: variante.nombreVariante,
                activo: variante.activo,
                atributosVarianteJson: this.toInputJson(
                  variante.atributosVariante,
                ),
                unidadStock: variante.unidadStock
                  ? this.toPrismaEnum<UnidadMateriaPrima>(variante.unidadStock)
                  : null,
                unidadCompra: variante.unidadCompra
                  ? this.toPrismaEnum<UnidadMateriaPrima>(variante.unidadCompra)
                  : null,
                unidadUso: variante.unidadUso
                  ? this.toPrismaEnum<UnidadMateriaPrima>(variante.unidadUso)
                  : null,
                equivalenciasJson:
                  variante.equivalencias == null
                    ? Prisma.DbNull
                    : variante.equivalencias.map((relation) => ({
                        ...relation,
                      })),
                precioReferencia: variante.precioReferencia,
                unidadPrecio: variante.unidadPrecio
                  ? this.toPrismaEnum<UnidadMateriaPrima>(variante.unidadPrecio)
                  : null,
                equivalenciaCompra:
                  variante.equivalenciaCompra == null
                    ? null
                    : this.toDecimal(variante.equivalenciaCompra),
                moneda: variante.moneda,
                proveedorReferenciaId: variante.proveedorReferenciaId,
              };
              const existente = existenteBySku.get(variante.sku);
              if (existente) {
                return tx.materiaPrimaVariante.update({
                  where: { id: existente.id },
                  data,
                });
              }
              return tx.materiaPrimaVariante.create({ data });
            }),
          );
        }

        const deleteIds = existentes
          .filter((variante) => !incomingSkus.has(variante.sku))
          .map((variante) => variante.id);
        if (deleteIds.length > 0) {
          await tx.materiaPrimaVariante.deleteMany({
            where: {
              tenantId: auth.tenantId,
              materiaPrimaId: id,
              id: {
                in: deleteIds,
              },
            },
          });
        }
      });

      const item = await this.findMateriaPrimaOrThrow(auth, id, this.prisma);
      return this.toResponse(item);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async toggleMateriaPrima(auth: CurrentAuth, id: string) {
    await this.capacidades.exigir(auth.tenantId, 'materiales');
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
    await this.capacidades.exigir(auth.tenantId, 'materiales');
    await this.findVarianteOrThrow(auth, varianteId, this.prisma);
    if (payload.moneda) this.validarMoneda(payload.moneda);

    try {
      const updated = await this.prisma.materiaPrimaVariante.update({
        where: { id: varianteId },
        data: {
          precioReferencia: this.toDecimal(
            this.roundToScale(payload.precioReferencia, 6),
          ),
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

  /**
   * Edición masiva de costos: precios/moneda por variante y unidades por
   * material, en una sola transacción. Pensado para la pantalla de "Editar
   * costos" que carga precios de muchos materiales sin entrar uno por uno.
   */
  async bulkUpdateCostos(auth: CurrentAuth, payload: BulkUpdateCostosDto) {
    await this.capacidades.exigir(auth.tenantId, 'materiales');
    const variantes = payload.variantes ?? [];
    variantes.forEach((v) => {
      if (v.moneda) this.validarMoneda(v.moneda);
    });
    const materiales = payload.materiales ?? [];
    if (variantes.length === 0 && materiales.length === 0) {
      return { variantesActualizadas: 0, materialesActualizados: 0 };
    }

    // Validación de pertenencia al tenant (anti-IDOR) antes de escribir nada.
    const varianteIds = Array.from(new Set(variantes.map((item) => item.id)));
    if (varianteIds.length > 0) {
      const owned = await this.prisma.materiaPrimaVariante.findMany({
        where: { tenantId: auth.tenantId, id: { in: varianteIds } },
        select: { id: true },
      });
      if (owned.length !== varianteIds.length) {
        throw new NotFoundException(
          'Una de las variantes no existe o no pertenece a tu empresa.',
        );
      }
    }
    const materialIds = Array.from(new Set(materiales.map((item) => item.id)));
    if (
      materiales.length > 0 &&
      variantes.some((v) => v.unidadStock || v.unidadCompra)
    ) {
      throw new BadRequestException(
        'Actualizá unidades por material o por variante en operaciones separadas.',
      );
    }
    if (materialIds.length > 0) {
      const owned = await this.prisma.materiaPrima.findMany({
        where: { tenantId: auth.tenantId, id: { in: materialIds } },
        select: { id: true },
      });
      if (owned.length !== materialIds.length) {
        throw new NotFoundException(
          'Uno de los materiales no existe o no pertenece a tu empresa.',
        );
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const unitEdits =
          variantes.some(
            (v) =>
              v.unidadUso !== undefined ||
              v.equivalencias !== undefined ||
              v.unidadStock !== undefined ||
              v.unidadCompra !== undefined ||
              v.equivalenciaCompra !== undefined ||
              v.unidadPrecio !== undefined,
          ) || materiales.length > 0;
        if (unitEdits) {
          const records = await tx.materiaPrimaVariante.findMany({
            where: {
              tenantId: auth.tenantId,
              OR: [
                { id: { in: varianteIds } },
                { materiaPrimaId: { in: materialIds } },
              ],
            },
            include: { materiaPrima: true },
          });
          await bloquearVariantesStock(
            tx,
            auth.tenantId,
            records.map((v) => v.id),
          );
          for (const record of records) {
            const edit = variantes.find((v) => v.id === record.id);
            const materialEdit = materiales.find(
              (m) => m.id === record.materiaPrimaId,
            );
            const stock =
              edit?.unidadStock ??
              materialEdit?.unidadStock ??
              record.unidadStock ??
              record.materiaPrima.unidadStock;
            const compra =
              edit?.unidadCompra ??
              materialEdit?.unidadCompra ??
              record.unidadCompra ??
              record.materiaPrima.unidadCompra;
            await this.assertStockUnitChange(
              auth,
              record.id,
              record.unidadStock ?? record.materiaPrima.unidadStock,
              stock,
              tx,
            );
            const factor =
              edit?.equivalenciaCompra === undefined
                ? record.equivalenciaCompra == null
                  ? null
                  : Number(record.equivalenciaCompra)
                : edit.equivalenciaCompra;
            const error = validateMaterialUnits({
              unidadStock: stock,
              unidadCompra: compra,
              unidadUso:
                edit?.unidadUso ??
                materialEdit?.unidadUso ??
                record.unidadUso ??
                record.materiaPrima.unidadUso ??
                stock,
              equivalencias:
                edit?.equivalencias ??
                (edit?.equivalenciaCompra !== undefined
                  ? null
                  : readMaterialEquivalences(record.equivalenciasJson)),
              equivalenciaCompra: factor,
              templateId: record.materiaPrima.templateId,
              atributos: record.atributosVarianteJson as Record<
                string,
                unknown
              >,
            });
            if (error) throw new BadRequestException(`${record.sku}: ${error}`);
            if (
              factor != null &&
              edit?.equivalencias === undefined &&
              record.equivalenciasJson == null &&
              edit?.equivalenciaCompra === undefined &&
              (stock.toLowerCase() !==
                (
                  record.unidadStock ?? record.materiaPrima.unidadStock
                ).toLowerCase() ||
                compra.toLowerCase() !==
                  (
                    record.unidadCompra ?? record.materiaPrima.unidadCompra
                  ).toLowerCase())
            )
              throw new BadRequestException(
                `${record.sku}: actualizá también el contenido al cambiar las unidades.`,
              );
          }
        }
        for (const variante of variantes) {
          const data: Prisma.MateriaPrimaVarianteUpdateInput = {};
          if (variante.precioReferencia !== undefined) {
            data.precioReferencia = this.toDecimal(
              this.roundToScale(variante.precioReferencia, 6),
            );
          }
          if (variante.unidadUso)
            data.unidadUso = this.toPrismaEnum<UnidadMateriaPrima>(
              variante.unidadUso,
            );
          if (variante.equivalencias !== undefined) {
            data.equivalenciasJson = variante.equivalencias.map((relation) => ({
              ...relation,
            }));
            data.equivalenciaCompra = null;
          } else if (variante.equivalenciaCompra !== undefined)
            data.equivalenciasJson = Prisma.DbNull;
          if (variante.unidadPrecio !== undefined) {
            data.unidadPrecio = variante.unidadPrecio
              ? this.toPrismaEnum<UnidadMateriaPrima>(variante.unidadPrecio)
              : null;
          }
          if (variante.equivalenciaCompra !== undefined) {
            data.equivalenciaCompra =
              variante.equivalenciaCompra == null
                ? null
                : this.toDecimal(variante.equivalenciaCompra);
          }
          if (variante.moneda?.trim()) {
            data.moneda = variante.moneda.trim().toUpperCase();
          }
          if (variante.unidadStock) {
            data.unidadStock = this.toPrismaEnum<UnidadMateriaPrima>(
              variante.unidadStock,
            );
          }
          if (variante.unidadCompra) {
            data.unidadCompra = this.toPrismaEnum<UnidadMateriaPrima>(
              variante.unidadCompra,
            );
          }
          if (Object.keys(data).length === 0) continue;
          await tx.materiaPrimaVariante.update({
            where: { id: variante.id },
            data,
          });
        }

        for (const material of materiales) {
          const data: Prisma.MateriaPrimaUpdateInput = {};
          if (material.unidadUso)
            data.unidadUso = this.toPrismaEnum<UnidadMateriaPrima>(
              material.unidadUso,
            );
          if (material.unidadStock) {
            data.unidadStock = this.toPrismaEnum<UnidadMateriaPrima>(
              material.unidadStock,
            );
          }
          if (material.unidadCompra) {
            data.unidadCompra = this.toPrismaEnum<UnidadMateriaPrima>(
              material.unidadCompra,
            );
          }
          if (Object.keys(data).length === 0) continue;
          await tx.materiaPrima.update({
            where: { id: material.id },
            data,
          });
          // Editar la unidad del material aplica a todas sus variantes.
          await tx.materiaPrimaVariante.updateMany({
            where: { tenantId: auth.tenantId, materiaPrimaId: material.id },
            data: {
              ...(material.unidadUso ? { unidadUso: null } : {}),
              ...(material.unidadStock ? { unidadStock: null } : {}),
              ...(material.unidadCompra ? { unidadCompra: null } : {}),
            },
          });
        }
      });
    } catch (error) {
      this.handleWriteError(error);
    }

    return {
      variantesActualizadas: variantes.length,
      materialesActualizados: materiales.length,
    };
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
    await this.capacidades.exigir(auth.tenantId, 'existencias');
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

  async updateAlmacen(
    auth: CurrentAuth,
    id: string,
    payload: UpsertAlmacenDto,
  ) {
    await this.capacidades.exigir(auth.tenantId, 'existencias');
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
    await this.capacidades.exigir(auth.tenantId, 'existencias');
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
    await this.capacidades.exigir(auth.tenantId, 'existencias');
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
    await this.capacidades.exigir(auth.tenantId, 'existencias');
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
    await this.capacidades.exigir(auth.tenantId, 'existencias');
    const current = await this.findUbicacionOrThrow(auth, id, this.prisma);
    return this.prisma.almacenMateriaPrimaUbicacion.update({
      where: { id },
      data: {
        activo: !current.activo,
      },
    });
  }

  async registrarMovimiento(
    auth: CurrentAuth,
    payload: RegistrarMovimientoStockDto,
  ) {
    await this.capacidades.exigir(auth.tenantId, 'existencias');
    if (!this.isSupportedSimpleMovement(payload.tipo)) {
      throw new BadRequestException(
        'Tipo de movimiento no soportado por este endpoint.',
      );
    }

    // El costo de stock se expresa en la moneda de la empresa. Resolver fuera
    // de la transacción evita sostener locks durante una consulta al proveedor.
    const usaReferencia =
      (!payload.costoUnitario || payload.costoUnitario <= 0) &&
      ['ingreso', 'ajuste_entrada'].includes(payload.tipo);
    const cambioStock =
      usaReferencia && this.tipoCambio
        ? await this.tipoCambio.resolver(auth.tenantId, auth.userId)
        : null;

    return this.prisma.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(tx, auth.tenantId, [
        'existencias',
      ]);
      return this.registrarMovimientoTx(tx, auth, payload, cambioStock);
    });
  }

  /** Reutilizable por consumo y futuras recepciones: conserva la transacción del llamador. */
  async registrarMovimientoTx(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    payload: RegistrarMovimientoStockDto,
    cambioStock: Awaited<
      ReturnType<TipoCambioService['resolver']>
    > | null = null,
  ) {
    if (!this.isSupportedSimpleMovement(payload.tipo))
      throw new BadRequestException('Tipo de movimiento no soportado.');
    const usaReferencia =
      (!payload.costoUnitario || payload.costoUnitario <= 0) &&
      ['ingreso', 'ajuste_entrada'].includes(payload.tipo);

    await bloquearVariantesStock(tx, auth.tenantId, [payload.varianteId]);
    const variante = await this.findVarianteOrThrow(
      auth,
      payload.varianteId,
      tx,
    );
    const contextoUnidades = materialPriceContext(variante);
    const unidadOriginal = normalizeMaterialUnit(
      payload.unidad ?? contextoUnidades.unidadStock,
    );
    const conversion = materialUnitConversion(
      contextoUnidades,
      unidadOriginal,
      contextoUnidades.unidadStock,
    );
    const ingreso = ['ingreso', 'ajuste_entrada'].includes(payload.tipo);
    const pesoReal = payload.cantidadStock != null;
    if (
      pesoReal &&
      (!ingreso ||
        !['kg', 'gramo'].includes(unidadOriginal) ||
        !['hoja', 'placa', 'unidad'].includes(
          normalizeMaterialUnit(contextoUnidades.unidadStock),
        ))
    ) {
      throw new BadRequestException(
        'La cantidad real de stock sólo se puede indicar al recibir por peso placas o unidades.',
      );
    }
    if (!pesoReal && !conversion.ok)
      throw new BadRequestException(conversion.mensaje);
    const factor = pesoReal
      ? payload.cantidadStock! / payload.cantidad
      : conversion.ok
        ? conversion.factor
        : 0;
    const cantidadNumber = new Prisma.Decimal(payload.cantidad)
      .mul(factor)
      .toDecimalPlaces(8)
      .toNumber();
    if (
      !Number.isFinite(cantidadNumber) ||
      cantidadNumber <= 0 ||
      cantidadNumber >= 1e12
    )
      throw new BadRequestException(
        'La cantidad convertida excede la precisión de stock.',
      );
    const cantidad = this.toDecimal(cantidadNumber);
    const conversionSnapshot = {
      version: 1,
      unidadOriginal,
      cantidadOriginal: payload.cantidad,
      unidadStock: normalizeMaterialUnit(contextoUnidades.unidadStock),
      cantidadStock: cantidadNumber,
      unidadUso: normalizeMaterialUnit(
        contextoUnidades.unidadUso ?? contextoUnidades.unidadStock,
      ),
      factor,
      origen: pesoReal
        ? 'recepcion_real'
        : conversion.ok
          ? conversion.origen
          : 'manual',
      pasos: pesoReal
        ? [
            {
              origen: unidadOriginal,
              destino: normalizeMaterialUnit(contextoUnidades.unidadStock),
              factor,
              origenFactor: 'recepcion_real',
            },
          ]
        : conversion.ok
          ? conversion.pasos
          : [],
      equivalencias: materialEquivalences(contextoUnidades),
      costoOriginal: usaReferencia
        ? variante.precioReferencia == null
          ? null
          : Number(variante.precioReferencia)
        : (payload.costoUnitario ?? null),
      unidadCostoOriginal:
        payload.costoUnitario != null && payload.costoUnitario > 0
          ? unidadOriginal
          : contextoUnidades.unidadPrecio,
      monedaCostoOriginal: usaReferencia ? variante.moneda : null,
      tipoCambio: cambioStock,
    };
    const ubicacion = await this.findUbicacionOrThrow(
      auth,
      payload.ubicacionId,
      tx,
    );
    const stockActual = await this.findStockRow(
      auth,
      payload.varianteId,
      payload.ubicacionId,
      tx,
    );

    let saldoPosterior = stockActual
      ? this.decimalToNumber(stockActual.cantidadDisponible)
      : 0;
    let costoPromedioPosterior = stockActual
      ? this.decimalToNumber(stockActual.costoPromedio)
      : 0;

    const tipo = this.toPrismaEnum<TipoMovimientoStockMateriaPrima>(
      payload.tipo,
    );
    const origen = this.toPrismaEnum<OrigenMovimientoStockMateriaPrima>(
      payload.origen,
    );
    let unitCost =
      payload.costoUnitario === undefined || payload.costoUnitario === null
        ? null
        : new Prisma.Decimal(payload.costoUnitario)
            .div(factor)
            .toDecimalPlaces(6)
            .toNumber();
    const stockPrevio = stockActual
      ? this.decimalToNumber(stockActual.cantidadDisponible)
      : 0;
    const costoPromedioPrevio = stockActual
      ? this.decimalToNumber(stockActual.costoPromedio)
      : 0;

    if (
      tipo === TipoMovimientoStockMateriaPrima.INGRESO ||
      tipo === TipoMovimientoStockMateriaPrima.AJUSTE_ENTRADA
    ) {
      if (unitCost === null || unitCost <= 0) {
        const precioReferenciaVariante =
          pesoReal &&
          contextoUnidades.unidadPrecio &&
          variante.precioReferencia != null
            ? (() => {
                const precioAOrigen = materialUnitConversion(
                  contextoUnidades,
                  contextoUnidades.unidadPrecio!,
                  unidadOriginal,
                );
                if (!precioAOrigen.ok)
                  throw new BadRequestException(precioAOrigen.mensaje);
                return new Prisma.Decimal(variante.precioReferencia)
                  .div(precioAOrigen.factor)
                  .div(factor)
                  .toNumber();
              })()
            : this.resolvePrecioReferenciaPorUnidadStock(variante);
        if (precioReferenciaVariante != null && precioReferenciaVariante > 0) {
          unitCost = cambioStock
            ? new Prisma.Decimal(precioReferenciaVariante)
                .mul(factorCambioMaterial(variante.moneda, cambioStock))
                .toNumber()
            : precioReferenciaVariante;
        }
      }

      const nextQty = stockPrevio + cantidadNumber;
      const costIn = unitCost ?? costoPromedioPrevio ?? 0;
      const newAvg =
        nextQty > 0
          ? (stockPrevio * costoPromedioPrevio + cantidadNumber * costIn) /
            nextQty
          : 0;

      saldoPosterior = this.roundToScale(nextQty, 8);
      costoPromedioPosterior = this.roundToScale(newAvg, 6);
    } else {
      await exigirStockLibre(
        tx,
        auth.tenantId,
        payload.varianteId,
        payload.ubicacionId,
        stockPrevio,
        cantidad,
      );
      const nextQty = new Prisma.Decimal(stockPrevio)
        .minus(cantidadNumber)
        .toDecimalPlaces(8)
        .toNumber();
      if (nextQty < 0) {
        throw new BadRequestException(
          `Stock insuficiente para ${variante.sku} en ${ubicacion.nombre}.`,
        );
      }

      saldoPosterior = this.roundToScale(nextQty, 8);
      costoPromedioPosterior = this.roundToScale(costoPromedioPrevio, 6);
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
        conversionSnapshotJson:
          conversionSnapshot as unknown as Prisma.InputJsonObject,
        costoUnitario: unitCost === null ? null : this.toDecimal(unitCost),
        saldoPosterior: upsertedStock.cantidadDisponible,
        costoPromedioPost: upsertedStock.costoPromedio,
        referenciaTipo: payload.referenciaTipo?.trim() || null,
        referenciaId: payload.referenciaId?.trim() || null,
        notas: payload.notas?.trim() || null,
      },
    });

    return this.toMovimientoResponse(movimiento);
  }

  async registrarTransferencia(
    auth: CurrentAuth,
    payload: RegistrarTransferenciaStockDto,
  ) {
    await this.capacidades.exigir(auth.tenantId, 'existencias');
    if (payload.ubicacionOrigenId === payload.ubicacionDestinoId) {
      throw new BadRequestException('Origen y destino deben ser distintos.');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(tx, auth.tenantId, [
        'existencias',
      ]);
      await bloquearVariantesStock(tx, auth.tenantId, [payload.varianteId]);
      const qtyTransfer = this.roundToScale(payload.cantidad, 8);
      const cantidad = this.toDecimal(qtyTransfer);
      const transferenciaId = randomUUID();
      const variante = await this.findVarianteOrThrow(
        auth,
        payload.varianteId,
        tx,
      );
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

      await exigirStockLibre(
        tx,
        auth.tenantId,
        payload.varianteId,
        payload.ubicacionOrigenId,
        qtyOrigen,
        cantidad,
      );
      if (qtyOrigen < qtyTransfer) {
        throw new BadRequestException(
          `Stock insuficiente para transferir ${variante.sku}.`,
        );
      }

      const costPromOrigen = stockOrigen
        ? this.decimalToNumber(stockOrigen.costoPromedio)
        : 0;
      const saldoOrigenPost = this.roundToScale(qtyOrigen - qtyTransfer, 8);

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
          costoUnitario: this.toDecimal(this.roundToScale(costPromOrigen, 6)),
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
      const saldoDestinoPost = this.roundToScale(qtyDestino + qtyTransfer, 8);
      const costPromDestinoPost =
        saldoDestinoPost > 0
          ? this.roundToScale(
              (qtyDestino * costPromDestino + qtyTransfer * costPromOrigen) /
                saldoDestinoPost,
              6,
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
          costoUnitario: this.toDecimal(this.roundToScale(costPromOrigen, 6)),
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

  private stockWhere(
    auth: CurrentAuth,
    query: GetStockPageQueryDto,
  ): Prisma.StockMateriaPrimaVarianteWhereInput {
    const search = query.search?.trim();
    return {
      tenantId: auth.tenantId,
      varianteId: query.varianteId,
      ubicacionId: query.ubicacionId,
      ...(query.soloConStock === 'true'
        ? { cantidadDisponible: { gt: new Prisma.Decimal(0) } }
        : {}),
      variante: {
        materiaPrimaId: query.materiaPrimaId,
        ...(search
          ? {
              OR: [
                {
                  nombreVariante: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
                { sku: { contains: search, mode: 'insensitive' as const } },
                {
                  materiaPrima: {
                    nombre: { contains: search, mode: 'insensitive' as const },
                  },
                },
              ],
            }
          : {}),
      },
      ubicacion: query.almacenId ? { almacenId: query.almacenId } : undefined,
    };
  }

  private toStockResponse(row: StockRow, reservada = new Prisma.Decimal(0)) {
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
      cantidadFisica: cantidad,
      cantidadReservada: reservada.toNumber(),
      cantidadLibre: row.cantidadDisponible.minus(reservada).toNumber(),
      unidadStock: normalizeMaterialUnit(
        row.variante.unidadStock ?? row.variante.materiaPrima.unidadStock,
      ),
      unidadUso: normalizeMaterialUnit(
        row.variante.unidadUso ??
          row.variante.materiaPrima.unidadUso ??
          row.variante.unidadStock ??
          row.variante.materiaPrima.unidadStock,
      ),
      costoPromedio: costo,
      valorStock: this.roundToScale(cantidad * costo),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // Contrato sin paginar conservado para los consumidores existentes.
  async getStockActual(auth: CurrentAuth, query: GetStockQueryDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.stockMateriaPrimaVariante.findMany({
          where: this.stockWhere(auth, query),
          include: stockInclude,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        });
        const reservas = await reservasPorSaldo(
          tx,
          auth.tenantId,
          rows.map((r) => r.varianteId),
        );
        return rows.map((row) =>
          this.toStockResponse(
            row,
            reservas.get(`${row.varianteId}:${row.ubicacionId}`),
          ),
        );
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async getStockPage(auth: CurrentAuth, query: GetStockPageQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where = this.stockWhere(auth, query);
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.stockMateriaPrimaVariante.findMany({
          where,
          include: stockInclude,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        });
        const total = await tx.stockMateriaPrimaVariante.count({ where });
        const reservas = await reservasPorSaldo(
          tx,
          auth.tenantId,
          rows.map((r) => r.varianteId),
        );
        return {
          items: rows.map((row) =>
            this.toStockResponse(
              row,
              reservas.get(`${row.varianteId}:${row.ubicacionId}`),
            ),
          ),
          total,
          page,
          pageSize,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async getResumenStockMaterial(auth: CurrentAuth, materiaPrimaId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const material = await this.findMateriaPrimaOrThrow(
          auth,
          materiaPrimaId,
          tx,
        );
        const stocks = await tx.stockMateriaPrimaVariante.findMany({
          where: { tenantId: auth.tenantId, variante: { materiaPrimaId } },
          select: {
            varianteId: true,
            cantidadDisponible: true,
            costoPromedio: true,
            ubicacion: { select: { almacenId: true } },
          },
        });
        // Una consulta y un acceso indexado por variante, sin traer todo su historial.
        const ultimos = await tx.$queryRaw<MovimientoStockMateriaPrima[]>`
        SELECT m.* FROM "MateriaPrimaVariante" v
        CROSS JOIN LATERAL (
          SELECT * FROM "MovimientoStockMateriaPrima" m
          WHERE m."tenantId" = ${auth.tenantId}::uuid AND m."varianteId" = v.id
          ORDER BY m."createdAt" DESC, m.id DESC LIMIT 1
        ) m
        WHERE v."tenantId" = ${auth.tenantId}::uuid AND v."materiaPrimaId" = ${materiaPrimaId}::uuid
      `;
        const porVariante = new Map<
          string,
          {
            cantidad: Prisma.Decimal;
            valor: Prisma.Decimal;
            almacenes: Set<string>;
          }
        >();
        for (const stock of stocks) {
          const summary = porVariante.get(stock.varianteId) ?? {
            cantidad: new Prisma.Decimal(0),
            valor: new Prisma.Decimal(0),
            almacenes: new Set<string>(),
          };
          summary.cantidad = summary.cantidad.plus(stock.cantidadDisponible);
          summary.valor = summary.valor.plus(
            stock.cantidadDisponible.mul(stock.costoPromedio),
          );
          if (stock.cantidadDisponible.gt(0))
            summary.almacenes.add(stock.ubicacion.almacenId);
          porVariante.set(stock.varianteId, summary);
        }
        const ultimoPorVariante = new Map(
          ultimos.map((item) => [
            item.varianteId,
            this.toMovimientoResponse(item),
          ]),
        );
        const reservas = await reservasPorSaldo(
          tx,
          auth.tenantId,
          material.variantes.map((v) => v.id),
        );
        const reservadoPorVariante = new Map<string, Prisma.Decimal>();
        for (const [key, cantidad] of reservas) {
          const id = key.split(':')[0];
          reservadoPorVariante.set(
            id,
            (reservadoPorVariante.get(id) ?? new Prisma.Decimal(0)).plus(
              cantidad,
            ),
          );
        }
        return material.variantes.map((variante) => {
          const summary = porVariante.get(variante.id);
          return {
            varianteId: variante.id,
            unidadStock: normalizeMaterialUnit(
              variante.unidadStock ?? material.unidadStock,
            ),
            stockTotal: summary?.cantidad.toNumber() ?? 0,
            cantidadReservada: (
              reservadoPorVariante.get(variante.id) ?? new Prisma.Decimal(0)
            ).toNumber(),
            cantidadLibre: (summary?.cantidad ?? new Prisma.Decimal(0))
              .minus(reservadoPorVariante.get(variante.id) ?? 0)
              .toNumber(),
            valorStock: summary?.valor.toDecimalPlaces(2).toNumber() ?? 0,
            costoPromedio: summary?.cantidad.gt(0)
              ? summary.valor
                  .div(summary.cantidad)
                  .toDecimalPlaces(6)
                  .toNumber()
              : 0,
            almacenesConStock: summary?.almacenes.size ?? 0,
            ultimoMovimiento: ultimoPorVariante.get(variante.id) ?? null,
          };
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getKardex(auth: CurrentAuth, query: GetKardexQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const where: Prisma.MovimientoStockMateriaPrimaWhereInput = {
      tenantId: auth.tenantId,
      varianteId: query.varianteId,
      ubicacionId: query.ubicacionId,
      variante: query.materiaPrimaId
        ? { materiaPrimaId: query.materiaPrimaId }
        : undefined,
      ubicacion: query.almacenId ? { almacenId: query.almacenId } : undefined,
      createdAt: {
        gte: query.fechaDesde ? new Date(query.fechaDesde) : undefined,
        lte: query.fechaHasta ? new Date(query.fechaHasta) : undefined,
      },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.movimientoStockMateriaPrima.findMany({
        where,
        include: {
          ubicacion: { include: { almacen: true } },
          variante: {
            include: {
              materiaPrima: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.movimientoStockMateriaPrima.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...this.toMovimientoResponse(item),
        ubicacionNombre: item.ubicacion.nombre,
        almacenId: item.ubicacion.almacenId,
        almacenNombre: item.ubicacion.almacen.nombre,
        unidadStock: normalizeMaterialUnit(
          item.variante.unidadStock ?? item.variante.materiaPrima.unidadStock,
        ),
        materiaPrimaId: item.variante.materiaPrimaId,
        varianteSku: item.variante.sku,
        materiaPrimaNombre: item.variante.materiaPrima.nombre,
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
        precioReferencia: true,
        moneda: true,
        unidadPrecio: true,
        equivalenciaCompra: true,
        equivalenciasJson: true,
        unidadUso: true,
        atributosVarianteJson: true,
        unidadStock: true,
        unidadCompra: true,
        materiaPrima: {
          select: {
            nombre: true,
            subfamilia: true,
            templateId: true,
            unidadStock: true,
            unidadUso: true,
            unidadCompra: true,
          },
        },
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

  private toCanonicalUnitCode(value: unknown): UnitCode | null {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }
    const normalized = this.normalizeInventoryUnit(value.trim().toLowerCase());
    const supported: UnitCode[] = [
      'pallet',
      'unidad',
      'pack',
      'caja',
      'kit',
      'hoja',
      'placa',
      'resma',
      'rollo',
      'pieza',
      'par',
      'metro_lineal',
      'mm',
      'cm',
      'm2',
      'm3',
      'litro',
      'ml',
      'kg',
      'gramo',
    ];
    return supported.includes(normalized) ? normalized : null;
  }

  private normalizeInventoryUnit(value: string): UnitCode {
    const normalized = value.trim().toLowerCase();
    const canonical =
      normalized === 'pliego' || normalized === 'pliegos' ? 'hoja' : normalized;
    return canonical as UnitCode;
  }

  private resolvePrecioReferenciaPorUnidadStock(
    variante: Parameters<typeof materialPriceContext>[0],
  ) {
    if (variante.precioReferencia == null) return null;
    const result = materialPriceInStockUnit(
      materialPriceContext(variante),
      Number(variante.precioReferencia),
    );
    if (!result.ok) throw new BadRequestException(result.mensaje);
    return result.precio;
  }

  private async assertStockUnitChange(
    auth: CurrentAuth,
    varianteId: string,
    previous: string,
    next: string,
    db: Prisma.TransactionClient,
  ) {
    const actual = await db.materiaPrimaVariante.findFirstOrThrow({
      where: { tenantId: auth.tenantId, id: varianteId },
      include: { materiaPrima: true },
    });
    const previousUnit = this.normalizeInventoryUnit(
      actual.unidadStock ?? actual.materiaPrima.unidadStock,
    );
    const nextUnit = this.normalizeInventoryUnit(next);
    if (
      previousUnit === nextUnit ||
      [previousUnit, nextUnit].every((unit) => ['hoja', 'placa'].includes(unit))
    )
      return;
    const movements = await db.movimientoStockMateriaPrima.count({
      where: { tenantId: auth.tenantId, varianteId },
    });
    const balance = await db.stockMateriaPrimaVariante.findFirst({
      where: {
        tenantId: auth.tenantId,
        varianteId,
        cantidadDisponible: { not: 0 },
      },
      select: { id: true },
    });
    const necesidades = await db.necesidadMaterialOt.count({
      where: { tenantId: auth.tenantId, varianteId },
    });
    const compras = await db.lineaOrdenCompra.count({
      where: {
        tenantId: auth.tenantId,
        varianteId,
        orden: { estado: { in: ['BORRADOR', 'EMITIDA', 'PARCIAL'] } },
      },
    });
    if (compras > 0)
      throw new BadRequestException(
        'Esta variante tiene compras abiertas. Resolvelas antes de cambiar su unidad de stock.',
      );
    if (movements > 0 || balance || necesidades > 0)
      throw new BadRequestException(
        movements > 0 || balance
          ? 'Esta variante tiene stock o movimientos. No se puede cambiar su unidad de stock sin convertir el historial.'
          : 'Esta variante tiene necesidades de una OT. No se puede cambiar su unidad de stock sin revisar esas necesidades.',
      );
  }

  private roundToScale(value: number, scale = 2) {
    return Number(value.toFixed(scale));
  }

  private toMovimientoResponse(item: {
    id: string;
    varianteId: string;
    ubicacionId: string;
    tipo: TipoMovimientoStockMateriaPrima;
    origen: OrigenMovimientoStockMateriaPrima;
    cantidad: Prisma.Decimal;
    costoUnitario: Prisma.Decimal | null;
    conversionSnapshotJson?: Prisma.JsonValue | null;
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
      cantidad: this.roundToScale(this.decimalToNumber(item.cantidad), 8),
      conversionSnapshot: item.conversionSnapshotJson ?? null,
      costoUnitario: item.costoUnitario
        ? this.roundToScale(this.decimalToNumber(item.costoUnitario), 6)
        : null,
      saldoPosterior: this.roundToScale(
        this.decimalToNumber(item.saldoPosterior),
        8,
      ),
      costoPromedioPost: this.roundToScale(
        this.decimalToNumber(item.costoPromedioPost),
        6,
      ),
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
      },
    });

    if (!item) {
      throw new NotFoundException(`No existe la materia prima ${id}`);
    }

    return item;
  }

  private normalizePayload(payload: UpsertMateriaPrimaDto) {
    const unidadStock = this.normalizeInventoryUnit(payload.unidadStock);
    const unidadCompra = this.normalizeInventoryUnit(payload.unidadCompra);
    const unidadUso = this.normalizeInventoryUnit(
      payload.unidadUso ?? unidadStock,
    );
    for (const variante of payload.variantes) {
      const error = validateMaterialUnits({
        unidadStock: variante.unidadStock ?? unidadStock,
        unidadCompra: variante.unidadCompra ?? unidadCompra,
        unidadUso: variante.unidadUso ?? unidadUso,
        equivalencias: variante.equivalencias,
        equivalenciaCompra: variante.equivalenciaCompra,
        templateId: payload.templateId,
        atributos: variante.atributosVariante,
      });
      if (error) throw new BadRequestException(`${variante.sku}: ${error}`);
    }
    const variantes = payload.variantes.map((variante) => ({
      ...variante,
      sku: variante.sku.trim(),
      nombreVariante: variante.nombreVariante?.trim() || null,
      unidadStock: variante.unidadStock ?? null,
      unidadUso: variante.unidadUso ?? null,
      equivalencias:
        variante.equivalencias?.map((r) => ({
          origen: this.normalizeInventoryUnit(r.origen),
          destino: this.normalizeInventoryUnit(r.destino),
          factor: r.factor,
        })) ?? null,
      unidadCompra: variante.unidadCompra ?? null,
      unidadPrecio:
        variante.unidadPrecio ??
        ((variante.unidadStock ?? unidadStock) ===
        (variante.unidadCompra ?? unidadCompra)
          ? (variante.unidadStock ?? unidadStock)
          : null),
      equivalenciaCompra: variante.equivalenciaCompra ?? null,
      precioReferencia:
        variante.precioReferencia === undefined ||
        variante.precioReferencia === null
          ? null
          : this.toDecimal(this.roundToScale(variante.precioReferencia, 6)),
      moneda: variante.moneda ? this.validarMoneda(variante.moneda) : null,
      proveedorReferenciaId: variante.proveedorReferenciaId || null,
    }));

    return {
      codigo: payload.codigo.trim(),
      nombre: payload.nombre.trim(),
      descripcion: payload.descripcion?.trim() || null,
      familia: payload.familia,
      subfamilia: payload.subfamilia,
      tipoTecnico: payload.tipoTecnico.trim(),
      templateId: payload.templateId.trim(),
      unidadStock,
      unidadUso,
      unidadCompra,
      esConsumible: payload.esConsumible,
      esRepuesto: payload.esRepuesto,
      esProductoBase: payload.esProductoBase ?? false,
      activo: payload.activo,
      atributosTecnicos: payload.atributosTecnicos,
      variantes,
    };
  }

  private validarMoneda(value: string): string {
    const codigo = value.trim().toUpperCase();
    if (!monedas.some((m) => m.codigo === codigo))
      throw new BadRequestException('La moneda del costo no es válida.');
    return codigo;
  }

  private toResponse(item: MateriaPrimaEntity) {
    return {
      id: item.id,
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      materialPresetId: item.materialPresetId ?? null,
      canonicalMaterialKey: item.canonicalMaterialKey ?? null,
      canonicalMaterialName: item.canonicalMaterialName ?? null,
      canonicalAliasUsado: item.canonicalAliasUsado ?? null,
      familia: this.toApiEnum(item.familia),
      subfamilia: this.toApiEnum(item.subfamilia),
      tipoTecnico: item.tipoTecnico,
      templateId: item.templateId,
      unidadStock: this.normalizeInventoryUnit(
        this.toApiEnum(item.unidadStock),
      ),
      unidadCompra: this.normalizeInventoryUnit(
        this.toApiEnum(item.unidadCompra),
      ),
      unidadUso: this.normalizeInventoryUnit(
        item.unidadUso ?? item.unidadStock,
      ),
      esConsumible: item.esConsumible,
      esRepuesto: item.esRepuesto,
      esProductoBase: item.esProductoBase,
      activo: item.activo,
      atributosTecnicos: item.atributosTecnicosJson,
      variantes: item.variantes.map((variante) => ({
        id: variante.id,
        sku: variante.sku,
        nombreVariante: variante.nombreVariante ?? '',
        materialPresetVarianteId: variante.materialPresetVarianteId ?? null,
        activo: variante.activo,
        atributosVariante: variante.atributosVarianteJson,
        unidadStock: variante.unidadStock
          ? this.normalizeInventoryUnit(this.toApiEnum(variante.unidadStock))
          : null,
        unidadCompra: variante.unidadCompra
          ? this.normalizeInventoryUnit(this.toApiEnum(variante.unidadCompra))
          : null,
        unidadPrecio: variante.unidadPrecio
          ? this.normalizeInventoryUnit(this.toApiEnum(variante.unidadPrecio))
          : (variante.unidadStock ?? item.unidadStock) ===
              (variante.unidadCompra ?? item.unidadCompra)
            ? this.normalizeInventoryUnit(
                variante.unidadStock ?? item.unidadStock,
              )
            : null,
        unidadUso: variante.unidadUso
          ? this.normalizeInventoryUnit(variante.unidadUso)
          : null,
        equivalencias: materialEquivalences(
          materialPriceContext({ ...variante, materiaPrima: item }),
        ),
        equivalenciaCompra:
          variante.equivalenciaCompra == null
            ? null
            : Number(variante.equivalenciaCompra),
        precioReferencia: variante.precioReferencia
          ? this.decimalToNumber(variante.precioReferencia)
          : null,
        moneda: variante.moneda ?? '',
        proveedorReferenciaId: variante.proveedorReferenciaId,
        proveedorReferenciaNombre: variante.proveedorReferencia?.nombre ?? '',
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

  /** Primer código libre a partir del deseado (código, código-2, código-3…). */
  private async nextCodigoDisponible(
    tx: Prisma.TransactionClient,
    tenantId: string,
    base: string,
  ): Promise<string> {
    for (let intento = 1; intento <= 999; intento += 1) {
      const candidato = intento === 1 ? base : `${base}-${intento}`;
      const ocupado = await tx.materiaPrima.findFirst({
        where: { tenantId, codigo: candidato },
        select: { id: true },
      });
      if (!ocupado) return candidato;
    }
    return `${base}-${Date.now()}`;
  }

  private handleWriteError(error: unknown): never {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Ya existe un registro con uno de los identificadores unicos cargados.',
        );
      }
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'No se puede eliminar una variante que está vinculada a maquinaria, stock o productos.',
        );
      }
    }

    throw error;
  }
}
