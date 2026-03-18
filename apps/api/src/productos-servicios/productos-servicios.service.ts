import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CarasProductoVariante,
  DimensionOpcionProductiva,
  ModoProductividadProceso,
  EstadoProductoServicio,
  EstadoTarifaCentroCostoPeriodo,
  ReglaCostoChecklist,
  ReglaCostoAdicionalEfecto,
  MetodoCostoProductoAdicional,
  PlantillaMaquinaria,
  Prisma,
  TipoProductoAdicionalEfecto,
  TipoConsumoAdicionalMaterial,
  TipoConsumibleMaquina,
  TipoProductoAdicional,
  TipoProductoChecklistPregunta,
  TipoProductoChecklistReglaAccion,
  TipoImpresionProductoVariante,
  TipoOperacionProceso,
  TipoProductoServicio,
  ValorOpcionProductiva,
  UnidadConsumoMaquina,
  UnidadDesgasteMaquina,
  UnidadProceso,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { randomUUID } from 'node:crypto';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { evaluateProductividad } from '../procesos/proceso-productividad.engine';
import {
  AssignProductoVariantesRutaMasivaDto,
  AssignProductoAdicionalDto,
  AssignProductoMotorDto,
  AssignVarianteRutaDto,
  DimensionOpcionProductivaDto,
  CarasProductoVarianteDto,
  ReglaCostoAdicionalEfectoDto,
  MetodoCostoProductoAdicionalDto,
  CotizarProductoVarianteDto,
  CreateProductoVarianteDto,
  TipoProductoAdicionalEfectoDto,
  SetVarianteAdicionalRestrictionDto,
  UpsertProductoAdicionalEfectoDto,
  TipoConsumoAdicionalMaterialDto,
  TipoProductoAdicionalDto,
  TipoInsercionRouteEffectDto,
  UpsertProductoAdicionalServicioPricingDto,
  UpsertVarianteOpcionesProductivasDto,
  UpsertProductoAdicionalDto,
  UpsertProductoChecklistDto,
  PreviewImposicionProductoVarianteDto,
  ReglaCostoChecklistDto,
  TipoChecklistPreguntaDto,
  TipoChecklistAccionReglaDto,
  UpdateProductoRutaPolicyDto,
  EstadoProductoServicioDto,
  TipoImpresionProductoVarianteDto,
  TipoProductoServicioDto,
  ValorOpcionProductivaDto,
  UpsertProductoMotorConfigDto,
  UpsertVarianteMotorOverrideDto,
  UpdateProductoVarianteDto,
  UpsertFamiliaProductoDto,
  UpsertProductoServicioDto,
  UpsertSubfamiliaProductoDto,
} from './dto/productos-servicios.dto';

const DEFAULT_PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
type ServicioPricingNivel = {
  id: string;
  nombre: string;
  orden: number;
  activo: boolean;
};
type ServicioPricingRegla = {
  id: string;
  nivelId: string;
  tiempoMin: number;
};
type ServicioPricingConfig = {
  niveles: ServicioPricingNivel[];
  reglas: ServicioPricingRegla[];
};
type RouteEffectInsertionMode = 'append' | 'before_step' | 'after_step';
type RouteEffectInsertionConfig = {
  modo: RouteEffectInsertionMode;
  pasoPlantillaId: string | null;
};

@Injectable()
export class ProductosServiciosService {
  private static readonly CODIGO_PREFIX = 'PRS';
  private static readonly CODIGO_MAX_RETRIES = 5;
  private static readonly ADICIONAL_CODIGO_PREFIX = 'ADI';
  private static readonly ADICIONAL_CODIGO_MAX_RETRIES = 5;
  private static readonly FAMILIA_BASE_CODIGO = 'IMP_DIG';
  private static readonly SUBFAMILIA_BASE_CODIGO = 'PA_COM';
  private static readonly FAMILIA_BASE_CODIGO_LEGACY = 'IMP_DIG_HOJA';
  private static readonly SUBFAMILIA_BASE_CODIGO_LEGACY = 'TARJETAS';
  private static readonly MOTOR_DEFAULT = {
    code: 'impresion_digital_laser',
    version: 1,
    label: 'Impresión digital laser · v1',
  } as const;
  private static readonly DEFAULT_A4_AREA_M2 = 0.06237;
  private static readonly TERMINACION_PLANTILLAS_SOPORTADAS = new Set<PlantillaMaquinaria>([
    PlantillaMaquinaria.GUILLOTINA,
    PlantillaMaquinaria.LAMINADORA_BOPP_ROLLO,
    PlantillaMaquinaria.REDONDEADORA_PUNTAS,
    PlantillaMaquinaria.PERFORADORA,
  ]);
  private static readonly CANONICAL_PLIEGOS_MM: Array<{
    codigo: string;
    nombre: string;
    anchoMm: number;
    altoMm: number;
  }> = [
    { codigo: 'A6', nombre: 'A6', anchoMm: 105, altoMm: 148 },
    { codigo: 'A5', nombre: 'A5', anchoMm: 148, altoMm: 210 },
    { codigo: 'A4', nombre: 'A4', anchoMm: 210, altoMm: 297 },
    { codigo: 'A3', nombre: 'A3', anchoMm: 297, altoMm: 420 },
    { codigo: 'SRA3', nombre: 'SRA3', anchoMm: 320, altoMm: 450 },
  ];

  constructor(private readonly prisma: PrismaService) {}

  getCatalogoPliegosImpresion() {
    return ProductosServiciosService.CANONICAL_PLIEGOS_MM.map((item) => ({
      ...item,
      label: `${item.nombre} (${item.anchoMm} x ${item.altoMm} mm)`,
    }));
  }

  getMotoresCosto() {
    return [
      {
        code: ProductosServiciosService.MOTOR_DEFAULT.code,
        version: ProductosServiciosService.MOTOR_DEFAULT.version,
        label: ProductosServiciosService.MOTOR_DEFAULT.label,
        schema: this.getDefaultMotorConfig(),
      },
    ];
  }

  async findAdicionalesCatalogo(auth: CurrentAuth) {
    const rows = await this.prisma.productoAdicionalCatalogo.findMany({
      where: { tenantId: auth.tenantId },
      include: {
        centroCosto: true,
        materiales: {
          include: {
            materiaPrimaVariante: {
              include: {
                materiaPrima: true,
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
        efectos: {
          where: { activo: true },
          select: {
            id: true,
            tipo: true,
            activo: true,
          },
        },
      },
      orderBy: [{ nombre: 'asc' }],
    });

    return rows.map((item) => this.toAdicionalCatalogoResponse(item));
  }

  async createAdicionalCatalogo(
    auth: CurrentAuth,
    payload: UpsertProductoAdicionalDto,
  ) {
    await this.validateAdicionalPayload(auth, payload, this.prisma);

    try {
      const codigo = payload.codigo?.trim()
        ? payload.codigo.trim().toUpperCase()
        : await this.generateAdicionalCodigo(auth, this.prisma);
      const created = await this.prisma.$transaction(async (tx) => {
        const adicional = await tx.productoAdicionalCatalogo.create({
          data: {
            tenantId: auth.tenantId,
            codigo,
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
            tipo: this.toTipoAdicional(payload.tipo),
            metodoCosto: this.toMetodoCostoAdicional(payload.metodoCosto),
            centroCostoId: payload.centroCostoId || null,
            activo: payload.activo,
            metadataJson: this.toNullableJson(payload.metadata),
          },
        });

        if (payload.materiales.length) {
          await tx.productoAdicionalMaterial.createMany({
            data: payload.materiales.map((material) => ({
              tenantId: auth.tenantId,
              productoAdicionalId: adicional.id,
              materiaPrimaVarianteId: material.materiaPrimaVarianteId,
              tipoConsumo: this.toTipoConsumoAdicionalMaterial(material.tipoConsumo),
              factorConsumo: material.factorConsumo,
              mermaPct: material.mermaPct ?? null,
              activo: material.activo,
              detalleJson: this.toNullableJson(material.detalle),
            })),
          });
        }

        return adicional.id;
      });

      return this.getAdicionalCatalogoByIdOrThrow(auth, created);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async updateAdicionalCatalogo(
    auth: CurrentAuth,
    adicionalId: string,
    payload: UpsertProductoAdicionalDto,
  ) {
    const item = await this.findAdicionalCatalogoOrThrow(auth, adicionalId, this.prisma);
    await this.validateAdicionalPayload(auth, payload, this.prisma);

    try {
      const savedId = await this.prisma.$transaction(async (tx) => {
        await tx.productoAdicionalCatalogo.update({
          where: { id: item.id },
          data: {
            codigo: payload.codigo?.trim()
              ? payload.codigo.trim().toUpperCase()
              : item.codigo,
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
            tipo: this.toTipoAdicional(payload.tipo),
            metodoCosto: this.toMetodoCostoAdicional(payload.metodoCosto),
            centroCostoId: payload.centroCostoId || null,
            activo: payload.activo,
            metadataJson: this.toNullableJson(payload.metadata),
          },
        });

        await tx.productoAdicionalMaterial.deleteMany({
          where: {
            tenantId: auth.tenantId,
            productoAdicionalId: item.id,
          },
        });

        if (payload.materiales.length) {
          await tx.productoAdicionalMaterial.createMany({
            data: payload.materiales.map((material) => ({
              tenantId: auth.tenantId,
              productoAdicionalId: item.id,
              materiaPrimaVarianteId: material.materiaPrimaVarianteId,
              tipoConsumo: this.toTipoConsumoAdicionalMaterial(material.tipoConsumo),
              factorConsumo: material.factorConsumo,
              mermaPct: material.mermaPct ?? null,
              activo: material.activo,
              detalleJson: this.toNullableJson(material.detalle),
            })),
          });
        }

        return item.id;
      });

      return this.getAdicionalCatalogoByIdOrThrow(auth, savedId);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async toggleAdicionalCatalogo(auth: CurrentAuth, adicionalId: string) {
    const item = await this.findAdicionalCatalogoOrThrow(auth, adicionalId, this.prisma);
    const updated = await this.prisma.productoAdicionalCatalogo.update({
      where: { id: item.id },
      data: {
        activo: !item.activo,
      },
    });

    return this.getAdicionalCatalogoByIdOrThrow(auth, updated.id);
  }

  async getAdicionalServicioPricing(auth: CurrentAuth, adicionalId: string) {
    const adicional = await this.findAdicionalCatalogoOrThrow(auth, adicionalId, this.prisma);
    return this.parseServicioPricing(adicional.metadataJson);
  }

  async upsertAdicionalServicioPricing(
    auth: CurrentAuth,
    adicionalId: string,
    payload: UpsertProductoAdicionalServicioPricingDto,
  ) {
    const adicional = await this.findAdicionalCatalogoOrThrow(auth, adicionalId, this.prisma);
    if (adicional.tipo !== TipoProductoAdicional.SERVICIO) {
      throw new BadRequestException('La configuración de niveles/costos aplica solo a adicionales de tipo servicio.');
    }
    const normalized = this.normalizeServicioPricingPayload(payload);
    const metadataBase =
      adicional.metadataJson && typeof adicional.metadataJson === 'object' && !Array.isArray(adicional.metadataJson)
        ? ({ ...(adicional.metadataJson as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    metadataBase.servicePricing = normalized as unknown as Prisma.InputJsonValue;
    await this.prisma.productoAdicionalCatalogo.update({
      where: { id: adicional.id },
      data: {
        metadataJson: metadataBase as Prisma.InputJsonValue,
      },
    });
    return normalized;
  }

  async findProductoAdicionales(auth: CurrentAuth, productoId: string) {
    await this.findProductoOrThrow(auth, productoId, this.prisma);
    const rows = await this.prisma.productoServicioAdicional.findMany({
      where: {
        tenantId: auth.tenantId,
        productoServicioId: productoId,
      },
      include: {
        productoAdicional: {
          include: {
            centroCosto: true,
            materiales: {
              include: {
                materiaPrimaVariante: {
                  include: {
                    materiaPrima: true,
                  },
                },
              },
              orderBy: [{ createdAt: 'asc' }],
            },
            efectos: {
              where: { activo: true },
              select: {
                id: true,
                tipo: true,
                activo: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    return rows.map((item) => ({
      id: item.id,
      productoServicioId: item.productoServicioId,
      adicionalId: item.productoAdicionalId,
      activo: item.activo,
      adicional: this.toAdicionalCatalogoResponse(item.productoAdicional),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  async assignProductoAdicional(
    auth: CurrentAuth,
    productoId: string,
    payload: AssignProductoAdicionalDto,
  ) {
    await this.findProductoOrThrow(auth, productoId, this.prisma);
    await this.findAdicionalCatalogoOrThrow(auth, payload.adicionalId, this.prisma);

    const saved = await this.prisma.productoServicioAdicional.upsert({
      where: {
        tenantId_productoServicioId_productoAdicionalId: {
          tenantId: auth.tenantId,
          productoServicioId: productoId,
          productoAdicionalId: payload.adicionalId,
        },
      },
      create: {
        tenantId: auth.tenantId,
        productoServicioId: productoId,
        productoAdicionalId: payload.adicionalId,
        activo: payload.activo ?? true,
      },
      update: {
        activo: payload.activo ?? true,
      },
      include: {
        productoAdicional: {
          include: {
            centroCosto: true,
            materiales: {
              include: {
                materiaPrimaVariante: {
                  include: {
                    materiaPrima: true,
                  },
                },
              },
              orderBy: [{ createdAt: 'asc' }],
            },
            efectos: {
              where: { activo: true },
              select: {
                id: true,
                tipo: true,
                activo: true,
              },
            },
          },
        },
      },
    });

    return {
      id: saved.id,
      productoServicioId: saved.productoServicioId,
      adicionalId: saved.productoAdicionalId,
      activo: saved.activo,
      adicional: this.toAdicionalCatalogoResponse(saved.productoAdicional),
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  async removeProductoAdicional(
    auth: CurrentAuth,
    productoId: string,
    adicionalId: string,
  ) {
    await this.findProductoOrThrow(auth, productoId, this.prisma);
    await this.findAdicionalCatalogoOrThrow(auth, adicionalId, this.prisma);

    await this.prisma.$transaction(async (tx) => {
      await tx.productoServicioAdicional.deleteMany({
        where: {
          tenantId: auth.tenantId,
          productoServicioId: productoId,
          productoAdicionalId: adicionalId,
        },
      });

      const variantes = await tx.productoVariante.findMany({
        where: {
          tenantId: auth.tenantId,
          productoServicioId: productoId,
        },
        select: { id: true },
      });
      if (variantes.length) {
        await tx.productoVarianteAdicionalRestriction.deleteMany({
          where: {
            tenantId: auth.tenantId,
            productoAdicionalId: adicionalId,
            productoVarianteId: { in: variantes.map((item) => item.id) },
          },
        });
      }
    });

    return {
      productoServicioId: productoId,
      adicionalId,
      removed: true,
    };
  }

  async findVarianteAdicionalesRestricciones(
    auth: CurrentAuth,
    varianteId: string,
  ) {
    const variante = await this.findVarianteOrThrow(auth, varianteId, this.prisma);
    const rows = await this.prisma.productoVarianteAdicionalRestriction.findMany({
      where: {
        tenantId: auth.tenantId,
        productoVarianteId: variante.id,
      },
      include: {
        productoAdicional: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    return rows.map((item) => ({
      id: item.id,
      varianteId: item.productoVarianteId,
      adicionalId: item.productoAdicionalId,
      adicionalNombre: item.productoAdicional.nombre,
      permitido: item.permitido,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  async setVarianteAdicionalRestriccion(
    auth: CurrentAuth,
    varianteId: string,
    payload: SetVarianteAdicionalRestrictionDto,
  ) {
    const variante = await this.findVarianteOrThrow(auth, varianteId, this.prisma);
    const asignado = await this.prisma.productoServicioAdicional.findFirst({
      where: {
        tenantId: auth.tenantId,
        productoServicioId: variante.productoServicioId,
        productoAdicionalId: payload.adicionalId,
        activo: true,
      },
    });
    if (!asignado) {
      throw new BadRequestException('El adicional no está asignado al producto.');
    }

    const saved = await this.prisma.productoVarianteAdicionalRestriction.upsert({
      where: {
        tenantId_productoVarianteId_productoAdicionalId: {
          tenantId: auth.tenantId,
          productoVarianteId: variante.id,
          productoAdicionalId: payload.adicionalId,
        },
      },
      create: {
        tenantId: auth.tenantId,
        productoVarianteId: variante.id,
        productoAdicionalId: payload.adicionalId,
        permitido: payload.permitido,
      },
      update: {
        permitido: payload.permitido,
      },
    });

    return {
      id: saved.id,
      varianteId: saved.productoVarianteId,
      adicionalId: saved.productoAdicionalId,
      permitido: saved.permitido,
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  async findFamilias(auth: CurrentAuth) {
    await this.ensureCatalogoInicialImprentaDigital(auth);

    const rows = await this.prisma.familiaProducto.findMany({
      where: { tenantId: auth.tenantId },
      include: {
        subfamilias: {
          orderBy: [{ nombre: 'asc' }],
        },
      },
      orderBy: [{ nombre: 'asc' }],
    });

    return rows.map((item) => ({
      id: item.id,
      codigo: item.codigo,
      nombre: item.nombre,
      activo: item.activo,
      subfamiliasCount: item.subfamilias.length,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  async createFamilia(auth: CurrentAuth, payload: UpsertFamiliaProductoDto) {
    try {
      const created = await this.prisma.familiaProducto.create({
        data: {
          tenantId: auth.tenantId,
          codigo: payload.codigo.trim().toUpperCase(),
          nombre: payload.nombre.trim(),
          activo: payload.activo,
        },
      });

      return this.toFamiliaResponse(created);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async updateFamilia(
    auth: CurrentAuth,
    id: string,
    payload: UpsertFamiliaProductoDto,
  ) {
    await this.findFamiliaOrThrow(auth, id, this.prisma);

    try {
      const updated = await this.prisma.familiaProducto.update({
        where: { id },
        data: {
          codigo: payload.codigo.trim().toUpperCase(),
          nombre: payload.nombre.trim(),
          activo: payload.activo,
        },
      });

      return this.toFamiliaResponse(updated);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async findSubfamilias(auth: CurrentAuth, familiaId?: string) {
    await this.ensureCatalogoInicialImprentaDigital(auth);

    const rows = await this.prisma.subfamiliaProducto.findMany({
      where: {
        tenantId: auth.tenantId,
        familiaProductoId: familiaId,
      },
      include: {
        familiaProducto: true,
      },
      orderBy: [{ nombre: 'asc' }],
    });

    return rows.map((item) => this.toSubfamiliaResponse(item));
  }

  async createSubfamilia(
    auth: CurrentAuth,
    payload: UpsertSubfamiliaProductoDto,
  ) {
    await this.findFamiliaOrThrow(auth, payload.familiaProductoId, this.prisma);

    try {
      const created = await this.prisma.subfamiliaProducto.create({
        data: {
          tenantId: auth.tenantId,
          familiaProductoId: payload.familiaProductoId,
          codigo: payload.codigo.trim().toUpperCase(),
          nombre: payload.nombre.trim(),
          unidadComercial: payload.unidadComercial?.trim() || null,
          activo: payload.activo,
        },
        include: {
          familiaProducto: true,
        },
      });

      return this.toSubfamiliaResponse(created);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async updateSubfamilia(
    auth: CurrentAuth,
    id: string,
    payload: UpsertSubfamiliaProductoDto,
  ) {
    await this.findSubfamiliaOrThrow(auth, id, this.prisma);
    await this.findFamiliaOrThrow(auth, payload.familiaProductoId, this.prisma);

    try {
      const updated = await this.prisma.subfamiliaProducto.update({
        where: { id },
        data: {
          familiaProductoId: payload.familiaProductoId,
          codigo: payload.codigo.trim().toUpperCase(),
          nombre: payload.nombre.trim(),
          unidadComercial: payload.unidadComercial?.trim() || null,
          activo: payload.activo,
        },
        include: {
          familiaProducto: true,
        },
      });

      return this.toSubfamiliaResponse(updated);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async findProductos(auth: CurrentAuth) {
    const rows = await this.prisma.productoServicio.findMany({
      where: {
        tenantId: auth.tenantId,
      },
      include: {
        familiaProducto: true,
        subfamiliaProducto: true,
        procesoDefinicionDefault: true,
      },
      orderBy: [{ nombre: 'asc' }],
    });

    return rows.map((item) => ({
      ...this.toProductoResponseBase(item),
      matchingBasePorVariante: [],
      pasosFijosPorVariante: [],
    }));
  }

  async findProducto(auth: CurrentAuth, id: string) {
    const item = await this.findProductoOrThrow(auth, id, this.prisma);

    return {
      ...this.toProductoResponseBase(item),
      matchingBasePorVariante: await this.toRutaBaseMatchingResponse(item.detalleJson ?? null),
      pasosFijosPorVariante: await this.toRutaBasePasosFijosResponse(item.detalleJson ?? null),
    };
  }

  async createProducto(auth: CurrentAuth, payload: UpsertProductoServicioDto) {
    await this.validateProductoRelations(auth, payload, this.prisma);

    try {
      const codigo = payload.codigo?.trim()
        ? payload.codigo.trim().toUpperCase()
        : await this.generateProductoCodigo(auth, this.prisma);
      const motor = this.resolveMotorOrThrow(
        payload.motorCodigo ?? ProductosServiciosService.MOTOR_DEFAULT.code,
        payload.motorVersion ?? ProductosServiciosService.MOTOR_DEFAULT.version,
      );

      const created = await this.prisma.productoServicio.create({
        data: {
          tenantId: auth.tenantId,
          tipo: TipoProductoServicio.PRODUCTO,
          codigo,
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion?.trim() || null,
          motorCodigo: motor.code,
          motorVersion: motor.version,
          usarRutaComunVariantes: true,
          procesoDefinicionDefaultId: null,
          familiaProductoId: payload.familiaProductoId,
          subfamiliaProductoId: payload.subfamiliaProductoId || null,
          estado: this.toEstadoProducto(payload.estado),
          activo: payload.activo,
        },
      });

      return this.findProducto(auth, created.id);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async updateProducto(
    auth: CurrentAuth,
    id: string,
    payload: UpsertProductoServicioDto,
  ) {
    const current = await this.findProductoOrThrow(auth, id, this.prisma);
    await this.validateProductoRelations(auth, payload, this.prisma);
    const motor = this.resolveMotorOrThrow(
      payload.motorCodigo ?? current.motorCodigo,
      payload.motorVersion ?? current.motorVersion,
    );

    try {
      await this.prisma.productoServicio.update({
        where: { id },
        data: {
          tipo: TipoProductoServicio.PRODUCTO,
          codigo: payload.codigo?.trim()
            ? payload.codigo.trim().toUpperCase()
            : undefined,
          nombre: payload.nombre.trim(),
          descripcion: payload.descripcion?.trim() || null,
          motorCodigo: motor.code,
          motorVersion: motor.version,
          familiaProductoId: payload.familiaProductoId,
          subfamiliaProductoId: payload.subfamiliaProductoId || null,
          estado: this.toEstadoProducto(payload.estado),
          activo: payload.activo,
        },
      });

      return this.findProducto(auth, id);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async assignProductoMotor(
    auth: CurrentAuth,
    productoId: string,
    payload: AssignProductoMotorDto,
  ) {
    await this.findProductoOrThrow(auth, productoId, this.prisma);
    const motor = this.resolveMotorOrThrow(payload.motorCodigo, payload.motorVersion);
    await this.prisma.productoServicio.update({
      where: { id: productoId },
      data: {
        motorCodigo: motor.code,
        motorVersion: motor.version,
      },
    });
    return this.findProducto(auth, productoId);
  }

  async getProductoMotorConfig(auth: CurrentAuth, productoId: string) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    const motor = this.resolveMotorOrThrow(producto.motorCodigo, producto.motorVersion);
    const config = await this.prisma.productoMotorConfig.findFirst({
      where: {
        tenantId: auth.tenantId,
        productoServicioId: producto.id,
        motorCodigo: motor.code,
        motorVersion: motor.version,
        activo: true,
      },
      orderBy: [{ versionConfig: 'desc' }],
    });

    return {
      productoId: producto.id,
      motorCodigo: motor.code,
      motorVersion: motor.version,
      parametros: config?.parametrosJson ?? this.getDefaultMotorConfig(),
      versionConfig: config?.versionConfig ?? 1,
      activo: config?.activo ?? true,
      updatedAt: config?.updatedAt?.toISOString() ?? null,
    };
  }

  async upsertProductoMotorConfig(
    auth: CurrentAuth,
    productoId: string,
    payload: UpsertProductoMotorConfigDto,
  ) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    const motor = this.resolveMotorOrThrow(producto.motorCodigo, producto.motorVersion);
    const current = await this.prisma.productoMotorConfig.findFirst({
      where: {
        tenantId: auth.tenantId,
        productoServicioId: producto.id,
        motorCodigo: motor.code,
        motorVersion: motor.version,
        activo: true,
      },
      orderBy: [{ versionConfig: 'desc' }],
    });
    const nextVersion = (current?.versionConfig ?? 0) + 1;
    const merged = this.mergeMotorConfig(current?.parametrosJson, payload.parametros);
    const created = await this.prisma.productoMotorConfig.create({
      data: {
        tenantId: auth.tenantId,
        productoServicioId: producto.id,
        motorCodigo: motor.code,
        motorVersion: motor.version,
        parametrosJson: merged,
        versionConfig: nextVersion,
        activo: true,
      },
    });
    return {
      productoId: producto.id,
      motorCodigo: motor.code,
      motorVersion: motor.version,
      parametros: created.parametrosJson,
      versionConfig: created.versionConfig,
      activo: created.activo,
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateProductoRutaPolicy(
    auth: CurrentAuth,
    productoId: string,
    payload: UpdateProductoRutaPolicyDto,
  ) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    const procesoDefaultId = payload.procesoDefinicionDefaultId ?? null;
    if (procesoDefaultId) {
      await this.findProcesoOrThrow(auth, procesoDefaultId, this.prisma);
    }
    const dimensionesBaseConsumidas =
      payload.dimensionesBaseConsumidas === undefined
        ? this.getProductoDimensionesBaseConsumidas(producto.detalleJson)
        : Array.from(
            new Set(payload.dimensionesBaseConsumidas.map((item) => this.toDimensionOpcionProductiva(item))),
          );
    const matchingBasePorVariante =
      payload.matchingBasePorVariante === undefined
        ? this.getProductoMatchingBaseByVariante(producto.detalleJson)
        : await this.validateAndNormalizeMatchingBase(
            auth,
            producto.id,
            dimensionesBaseConsumidas,
            payload.matchingBasePorVariante,
            this.prisma,
          );
    const pasosFijosPorVariante =
      payload.pasosFijosPorVariante === undefined
        ? this.getProductoPasosFijosByVariante(producto.detalleJson)
        : await this.validateAndNormalizePasosFijosRutaBase(
            auth,
            producto.id,
            dimensionesBaseConsumidas,
            payload.pasosFijosPorVariante,
            this.prisma,
          );
    const nextDetalle = this.mergeProductoDetalle(producto.detalleJson, {
      dimensionesBaseConsumidas: dimensionesBaseConsumidas.map((item) =>
        this.fromDimensionOpcionProductiva(item),
      ),
      matchingBasePorVariante,
      pasosFijosPorVariante,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.productoServicio.update({
        where: { id: producto.id },
        data: {
          usarRutaComunVariantes: payload.usarRutaComunVariantes,
          procesoDefinicionDefaultId: procesoDefaultId,
          detalleJson: this.toNullableJson(nextDetalle),
        },
      });

      if (payload.usarRutaComunVariantes) {
        await tx.productoVariante.updateMany({
          where: {
            tenantId: auth.tenantId,
            productoServicioId: producto.id,
            procesoDefinicionId: { not: null },
          },
          data: {
            procesoDefinicionId: null,
          },
        });
      }
    });

    return this.findProducto(auth, producto.id);
  }

  async assignProductoVariantesRutaMasiva(
    auth: CurrentAuth,
    productoId: string,
    payload: AssignProductoVariantesRutaMasivaDto,
  ) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    await this.findProcesoOrThrow(auth, payload.procesoDefinicionId, this.prisma);

    const where: Prisma.ProductoVarianteWhereInput = {
      tenantId: auth.tenantId,
      productoServicioId: producto.id,
    };
    if (!payload.incluirInactivas) {
      where.activo = true;
    }

    const updated = await this.prisma.productoVariante.updateMany({
      where,
      data: {
        procesoDefinicionId: payload.procesoDefinicionId,
      },
    });

    return {
      productoId: producto.id,
      updatedCount: updated.count,
      procesoDefinicionId: payload.procesoDefinicionId,
      incluirInactivas: Boolean(payload.incluirInactivas),
    };
  }

  async findVariantes(auth: CurrentAuth, productoId: string) {
    await this.findProductoOrThrow(auth, productoId, this.prisma);

    const rows = await this.prisma.productoVariante.findMany({
      where: {
        tenantId: auth.tenantId,
        productoServicioId: productoId,
      },
      include: {
        papelVariante: {
          include: {
            materiaPrima: true,
          },
        },
        procesoDefinicion: true,
        opcionesProductivasSet: {
          include: {
            valores: {
              where: { activo: true },
              orderBy: [{ dimension: 'asc' }, { orden: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
      orderBy: [{ nombre: 'asc' }],
    });

    return rows.map((item) => this.toVarianteResponse(item));
  }

  async createVariante(
    auth: CurrentAuth,
    productoId: string,
    payload: CreateProductoVarianteDto,
  ) {
    await this.findProductoOrThrow(auth, productoId, this.prisma);
    await this.validateVarianteRelations(auth, payload.papelVarianteId, payload.procesoDefinicionId, this.prisma);

    try {
      const created = await this.prisma.productoVariante.create({
        data: {
          tenantId: auth.tenantId,
          productoServicioId: productoId,
          nombre: payload.nombre.trim(),
          anchoMm: payload.anchoMm,
          altoMm: payload.altoMm,
          papelVarianteId: payload.papelVarianteId || null,
          tipoImpresion: this.toTipoImpresion(payload.tipoImpresion),
          caras: this.toCaras(payload.caras),
          procesoDefinicionId: payload.procesoDefinicionId || null,
          activo: payload.activo ?? true,
        },
        include: {
          papelVariante: {
            include: {
              materiaPrima: true,
            },
          },
          procesoDefinicion: true,
          opcionesProductivasSet: {
            include: {
              valores: {
                where: { activo: true },
                orderBy: [{ dimension: 'asc' }, { orden: 'asc' }, { createdAt: 'asc' }],
              },
            },
          },
        },
      });

      return this.toVarianteResponse(created);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async updateVariante(
    auth: CurrentAuth,
    varianteId: string,
    payload: UpdateProductoVarianteDto,
  ) {
    await this.findVarianteOrThrow(auth, varianteId, this.prisma);
    await this.validateVarianteRelations(auth, payload.papelVarianteId, payload.procesoDefinicionId, this.prisma);

    try {
      const updated = await this.prisma.productoVariante.update({
        where: { id: varianteId },
        data: {
          nombre: payload.nombre?.trim(),
          anchoMm: payload.anchoMm,
          altoMm: payload.altoMm,
          papelVarianteId: payload.papelVarianteId ?? undefined,
          tipoImpresion: payload.tipoImpresion
            ? this.toTipoImpresion(payload.tipoImpresion)
            : undefined,
          caras: payload.caras ? this.toCaras(payload.caras) : undefined,
          procesoDefinicionId: payload.procesoDefinicionId ?? undefined,
          activo: payload.activo,
        },
        include: {
          papelVariante: {
            include: {
              materiaPrima: true,
            },
          },
          procesoDefinicion: true,
          opcionesProductivasSet: {
            include: {
              valores: {
                where: { activo: true },
                orderBy: [{ dimension: 'asc' }, { orden: 'asc' }, { createdAt: 'asc' }],
              },
            },
          },
        },
      });

      return this.toVarianteResponse(updated);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async getVarianteOpcionesProductivas(auth: CurrentAuth, varianteId: string) {
    const variante = await this.findVarianteOrThrow(auth, varianteId, this.prisma);
    const set = await this.prisma.productoVarianteOpcionProductivaSet.findFirst({
      where: {
        tenantId: auth.tenantId,
        productoVarianteId: variante.id,
      },
      include: {
        valores: {
          where: { activo: true },
          orderBy: [{ dimension: 'asc' }, { orden: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    return this.toVarianteOpcionesProductivasResponse(variante.id, variante, set);
  }

  async upsertVarianteOpcionesProductivas(
    auth: CurrentAuth,
    varianteId: string,
    payload: UpsertVarianteOpcionesProductivasDto,
  ) {
    const variante = await this.findVarianteOrThrow(auth, varianteId, this.prisma);
    this.validateOpcionesProductivasPayload(payload);
    const normalized = this.normalizeOpcionesProductivasPayload(payload);
    const saved = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.productoVarianteOpcionProductivaSet.findFirst({
        where: {
          tenantId: auth.tenantId,
          productoVarianteId: variante.id,
        },
      });
      const set =
        existing ??
        (await tx.productoVarianteOpcionProductivaSet.create({
          data: {
            tenantId: auth.tenantId,
            productoVarianteId: variante.id,
          },
        }));
      await tx.productoVarianteOpcionProductivaValue.deleteMany({
        where: {
          tenantId: auth.tenantId,
          opcionSetId: set.id,
        },
      });
      if (normalized.length > 0) {
        await tx.productoVarianteOpcionProductivaValue.createMany({
          data: normalized.flatMap((dimension) =>
            dimension.valores.map((valor, index) => ({
              tenantId: auth.tenantId,
              opcionSetId: set.id,
              dimension: this.toDimensionOpcionProductiva(dimension.dimension),
              valor: this.toValorOpcionProductiva(valor),
              orden: index + 1,
              activo: true,
            })),
          ),
        });
      }
      return tx.productoVarianteOpcionProductivaSet.findUniqueOrThrow({
        where: { id: set.id },
        include: {
          valores: {
            where: { activo: true },
            orderBy: [{ dimension: 'asc' }, { orden: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
    });
    return this.toVarianteOpcionesProductivasResponse(variante.id, variante, saved);
  }

  async getProductoChecklist(auth: CurrentAuth, productoId: string) {
    await this.findProductoOrThrow(auth, productoId, this.prisma);
    const checklist = await this.prisma.productoChecklist.findFirst({
      where: {
        tenantId: auth.tenantId,
        productoServicioId: productoId,
      },
      include: {
        preguntas: {
          orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
          include: {
            respuestas: {
              orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
              include: {
                reglas: {
                  orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
                  include: {
                    procesoOperacion: {
                      include: {
                        centroCosto: true,
                        maquina: true,
                        perfilOperativo: true,
                      },
                    },
                    costoCentroCosto: true,
                    materiaPrimaVariante: {
                      include: {
                        materiaPrima: true,
                      },
                    },
                    niveles: {
                      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!checklist) {
      return {
        productoId,
        activo: true,
        preguntas: [],
        createdAt: null,
        updatedAt: null,
      };
    }
    const plantillasById = await this.getChecklistPasoPlantillasMap(auth, checklist);
    return this.toProductoChecklistResponse(checklist, plantillasById);
  }

  async upsertProductoChecklist(
    auth: CurrentAuth,
    productoId: string,
    payload: UpsertProductoChecklistDto,
  ) {
    await this.findProductoOrThrow(auth, productoId, this.prisma);
    this.validateProductoChecklistPayload(payload);

    const checklistId = await this.prisma.$transaction(async (tx) => {
      const checklist =
        (await tx.productoChecklist.findFirst({
          where: {
            tenantId: auth.tenantId,
            productoServicioId: productoId,
          },
          select: { id: true },
        })) ??
        (await tx.productoChecklist.create({
          data: {
            tenantId: auth.tenantId,
            productoServicioId: productoId,
            activo: payload.activo ?? true,
          },
          select: { id: true },
        }));

      await tx.productoChecklist.update({
        where: { id: checklist.id },
        data: {
          activo: payload.activo ?? true,
        },
      });

      const preguntasPrevias = await tx.productoChecklistPregunta.findMany({
        where: {
          tenantId: auth.tenantId,
          productoChecklistId: checklist.id,
        },
        select: { id: true },
      });

      if (preguntasPrevias.length > 0) {
        const preguntaIds = preguntasPrevias.map((item) => item.id);
        const respuestasPrevias = await tx.productoChecklistRespuesta.findMany({
          where: {
            tenantId: auth.tenantId,
            productoChecklistPreguntaId: { in: preguntaIds },
          },
          select: { id: true },
        });
        if (respuestasPrevias.length > 0) {
          const respuestaIds = respuestasPrevias.map((item) => item.id);
          const reglasPrevias = await tx.productoChecklistRegla.findMany({
            where: {
              tenantId: auth.tenantId,
              productoChecklistRespuestaId: { in: respuestaIds },
            },
            select: { id: true },
          });
          if (reglasPrevias.length > 0) {
            await tx.productoChecklistReglaNivel.deleteMany({
              where: {
                tenantId: auth.tenantId,
                productoChecklistReglaId: { in: reglasPrevias.map((item) => item.id) },
              },
            });
          }
          await tx.productoChecklistRegla.deleteMany({
            where: {
              tenantId: auth.tenantId,
              productoChecklistRespuestaId: { in: respuestaIds },
            },
          });
        }
        await tx.productoChecklistRespuesta.deleteMany({
          where: {
            tenantId: auth.tenantId,
            productoChecklistPreguntaId: { in: preguntaIds },
          },
        });
        await tx.productoChecklistPregunta.deleteMany({
          where: {
            tenantId: auth.tenantId,
            id: { in: preguntaIds },
          },
        });
      }

      for (let indexPregunta = 0; indexPregunta < payload.preguntas.length; indexPregunta += 1) {
        const pregunta = payload.preguntas[indexPregunta];
        const preguntaRow = await tx.productoChecklistPregunta.create({
          data: {
            tenantId: auth.tenantId,
            productoChecklistId: checklist.id,
            texto: pregunta.texto.trim(),
            tipoPregunta: this.toTipoChecklistPregunta(pregunta.tipoPregunta ?? TipoChecklistPreguntaDto.binaria),
            orden: pregunta.orden ?? indexPregunta + 1,
            activo: pregunta.activo ?? true,
          },
        });

        for (let indexRespuesta = 0; indexRespuesta < pregunta.respuestas.length; indexRespuesta += 1) {
          const respuesta = pregunta.respuestas[indexRespuesta];
          const respuestaRow = await tx.productoChecklistRespuesta.create({
            data: {
              tenantId: auth.tenantId,
              productoChecklistPreguntaId: preguntaRow.id,
              texto: respuesta.texto.trim(),
              codigo: respuesta.codigo?.trim() || null,
              orden: respuesta.orden ?? indexRespuesta + 1,
              activo: respuesta.activo ?? true,
            },
          });

          const reglas = respuesta.reglas ?? [];
          for (let indexRegla = 0; indexRegla < reglas.length; indexRegla += 1) {
            const regla = reglas[indexRegla];
            let pasoPlantilla:
              | Awaited<ReturnType<ProductosServiciosService['findBibliotecaOperacionOrThrow']>>
              | null = null;
            if (regla.pasoPlantillaId) {
              pasoPlantilla = await this.findBibliotecaOperacionOrThrow(auth, regla.pasoPlantillaId, tx);
            }
            if (regla.costoCentroCostoId) {
              await this.findCentroCostoOrThrow(auth, regla.costoCentroCostoId, tx);
            }
            if (regla.materiaPrimaVarianteId) {
              await this.findPapelVarianteOrThrow(auth, regla.materiaPrimaVarianteId, tx);
            }
            const detalleReglaBase =
              regla.detalle && typeof regla.detalle === 'object' && !Array.isArray(regla.detalle)
                ? { ...regla.detalle }
                : {};
            if (
              (regla.accion === TipoChecklistAccionReglaDto.activar_paso ||
                regla.accion === TipoChecklistAccionReglaDto.seleccionar_variante_paso) &&
              pasoPlantilla
            ) {
              const variantesPaso = this.getProcesoOperacionNiveles(pasoPlantilla.detalleJson);
              if (
                pregunta.tipoPregunta === TipoChecklistPreguntaDto.binaria &&
                variantesPaso.filter((item) => item.activo).length > 2
              ) {
                throw new BadRequestException(
                  'Las preguntas binarias no pueden usar pasos con 3 o más variantes.',
                );
              }
              if (regla.accion === TipoChecklistAccionReglaDto.activar_paso && variantesPaso.length > 0) {
                throw new BadRequestException(
                  'Usa SELECCIONAR_VARIANTE_PASO para pasos con variantes.',
                );
              }
              if (regla.accion === TipoChecklistAccionReglaDto.seleccionar_variante_paso) {
                if (!regla.variantePasoId) {
                  throw new BadRequestException(
                    'La regla SELECCIONAR_VARIANTE_PASO requiere variante.',
                  );
                }
                const variante = variantesPaso.find((item) => item.id === regla.variantePasoId);
                if (!variante) {
                  throw new BadRequestException('La variante seleccionada no pertenece al paso configurado.');
                }
                detalleReglaBase.variantePasoId = variante.id;
              } else {
                delete detalleReglaBase.variantePasoId;
              }
              detalleReglaBase.pasoPlantillaId = pasoPlantilla.id;
            }
            if (regla.accion === TipoChecklistAccionReglaDto.set_atributo_tecnico) {
              throw new BadRequestException(
                'SET_ATRIBUTO_TECNICO ya no se admite en Ruta de opcionales.',
              );
            }
            const reglaRow = await tx.productoChecklistRegla.create({
              data: {
                tenantId: auth.tenantId,
                productoChecklistRespuestaId: respuestaRow.id,
                accion: this.toTipoChecklistAccion(regla.accion),
                orden: regla.orden ?? indexRegla + 1,
                activo: regla.activo ?? true,
                procesoOperacionId: null,
                usaNiveles: false,
                costoRegla: regla.costoRegla ? this.toReglaCostoChecklist(regla.costoRegla) : null,
                costoValor: regla.costoValor ?? null,
                costoCentroCostoId: regla.costoCentroCostoId ?? null,
                materiaPrimaVarianteId: regla.materiaPrimaVarianteId ?? null,
                tipoConsumo: regla.tipoConsumo
                  ? this.toTipoConsumoAdicionalMaterial(regla.tipoConsumo)
                  : null,
                factorConsumo: regla.factorConsumo ?? null,
                mermaPct: regla.mermaPct ?? null,
                detalleJson: this.toNullableJson(detalleReglaBase),
              },
            });
          }
        }
      }

      return checklist.id;
    });

    const row = await this.prisma.productoChecklist.findUniqueOrThrow({
      where: { id: checklistId },
      include: {
        preguntas: {
          orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
          include: {
            respuestas: {
              orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
              include: {
                reglas: {
                  orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
                  include: {
                    procesoOperacion: {
                      include: {
                        centroCosto: true,
                        maquina: true,
                        perfilOperativo: true,
                      },
                    },
                    costoCentroCosto: true,
                    materiaPrimaVariante: {
                      include: { materiaPrima: true },
                    },
                    niveles: {
                      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const plantillasById = await this.getChecklistPasoPlantillasMap(auth, row);
    return this.toProductoChecklistResponse(row, plantillasById);
  }

  async findAdicionalEfectos(auth: CurrentAuth, adicionalId: string) {
    await this.findAdicionalCatalogoOrThrow(auth, adicionalId, this.prisma);
    const rows = await this.prisma.productoAdicionalEfecto.findMany({
      where: {
        tenantId: auth.tenantId,
        productoAdicionalId: adicionalId,
      },
      include: this.getAdicionalEfectoInclude(),
      orderBy: [{ createdAt: 'asc' }],
    });
    return rows.map((item) => this.toAdicionalEfectoResponse(item));
  }

  async createAdicionalEfecto(
    auth: CurrentAuth,
    adicionalId: string,
    payload: UpsertProductoAdicionalEfectoDto,
  ) {
    const adicional = await this.findAdicionalCatalogoOrThrow(auth, adicionalId, this.prisma);
    if (
      adicional.tipo === TipoProductoAdicional.SERVICIO &&
      payload.tipo !== TipoProductoAdicionalEfectoDto.cost_effect
    ) {
      throw new BadRequestException('Los adicionales de tipo servicio solo permiten reglas de costo.');
    }
    await this.validateAdicionalEfectoPayload(auth, payload, adicional.tipo, this.prisma);
    await this.assertSingleAddonEffectTypeConstraint(
      auth,
      adicionalId,
      payload.tipo,
      undefined,
      this.prisma,
    );
    const createdId = await this.prisma.$transaction(async (tx) => {
      const effect = await tx.productoAdicionalEfecto.create({
        data: {
          tenantId: auth.tenantId,
          productoAdicionalId: adicionalId,
          tipo: this.toTipoAdicionalEfecto(payload.tipo),
          nombre: this.resolveAdicionalEfectoNombre(payload),
          prioridad: 100,
          activo: payload.activo ?? true,
        },
      });
      await this.replaceAdicionalEfectoDetail(auth, tx, effect.id, payload);
      return effect.id;
    });
    return this.getAdicionalEfectoByIdOrThrow(auth, adicionalId, createdId);
  }

  async updateAdicionalEfecto(
    auth: CurrentAuth,
    adicionalId: string,
    efectoId: string,
    payload: UpsertProductoAdicionalEfectoDto,
  ) {
    const adicional = await this.findAdicionalCatalogoOrThrow(auth, adicionalId, this.prisma);
    if (
      adicional.tipo === TipoProductoAdicional.SERVICIO &&
      payload.tipo !== TipoProductoAdicionalEfectoDto.cost_effect
    ) {
      throw new BadRequestException('Los adicionales de tipo servicio solo permiten reglas de costo.');
    }
    const effect = await this.findAdicionalEfectoOrThrow(auth, adicionalId, efectoId, this.prisma);
    await this.validateAdicionalEfectoPayload(auth, payload, adicional.tipo, this.prisma);
    await this.assertSingleAddonEffectTypeConstraint(
      auth,
      adicionalId,
      payload.tipo,
      effect.id,
      this.prisma,
    );
    const savedId = await this.prisma.$transaction(async (tx) => {
      await tx.productoAdicionalEfecto.update({
        where: { id: effect.id },
        data: {
          tipo: this.toTipoAdicionalEfecto(payload.tipo),
          nombre: this.resolveAdicionalEfectoNombre(payload),
          activo: payload.activo ?? effect.activo,
        },
      });
      await this.replaceAdicionalEfectoDetail(auth, tx, effect.id, payload);
      return effect.id;
    });
    return this.getAdicionalEfectoByIdOrThrow(auth, adicionalId, savedId);
  }

  async toggleAdicionalEfecto(auth: CurrentAuth, adicionalId: string, efectoId: string) {
    const effect = await this.findAdicionalEfectoOrThrow(auth, adicionalId, efectoId, this.prisma);
    await this.prisma.productoAdicionalEfecto.update({
      where: { id: effect.id },
      data: {
        activo: !effect.activo,
      },
    });
    return this.getAdicionalEfectoByIdOrThrow(auth, adicionalId, effect.id);
  }

  async deleteAdicionalEfecto(auth: CurrentAuth, adicionalId: string, efectoId: string) {
    const effect = await this.findAdicionalEfectoOrThrow(auth, adicionalId, efectoId, this.prisma);
    await this.prisma.productoAdicionalEfecto.delete({
      where: { id: effect.id },
    });
    return {
      adicionalId,
      efectoId,
      deleted: true,
    };
  }

  async deleteVariante(auth: CurrentAuth, varianteId: string) {
    const variante = await this.findVarianteOrThrow(auth, varianteId, this.prisma);

    await this.prisma.productoVariante.delete({
      where: {
        id: variante.id,
      },
    });

    return {
      id: variante.id,
      deleted: true,
    };
  }

  async assignVarianteRuta(
    auth: CurrentAuth,
    varianteId: string,
    payload: AssignVarianteRutaDto,
  ) {
    const variante = await this.findVarianteOrThrow(auth, varianteId, this.prisma);
    const producto = await this.findProductoOrThrow(auth, variante.productoServicioId, this.prisma);
    if (producto.usarRutaComunVariantes) {
      throw new BadRequestException(
        'El producto usa una ruta común. Desactiva "misma ruta para variantes" para asignar rutas por variante.',
      );
    }
    if (payload.procesoDefinicionId) {
      await this.findProcesoOrThrow(auth, payload.procesoDefinicionId, this.prisma);
    }

    const updated = await this.prisma.productoVariante.update({
      where: { id: varianteId },
      data: {
        procesoDefinicionId: payload.procesoDefinicionId ?? null,
      },
      include: {
        papelVariante: {
          include: {
            materiaPrima: true,
          },
        },
        procesoDefinicion: true,
        opcionesProductivasSet: {
          include: {
            valores: {
              where: { activo: true },
              orderBy: [{ dimension: 'asc' }, { orden: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });

    return this.toVarianteResponse(updated);
  }

  async getVarianteMotorOverride(auth: CurrentAuth, varianteId: string) {
    const variante = await this.findVarianteOrThrow(auth, varianteId, this.prisma);
    const producto = await this.findProductoOrThrow(auth, variante.productoServicioId, this.prisma);
    const motor = this.resolveMotorOrThrow(producto.motorCodigo, producto.motorVersion);
    const config = await this.prisma.productoVarianteMotorOverride.findFirst({
      where: {
        tenantId: auth.tenantId,
        productoVarianteId: variante.id,
        motorCodigo: motor.code,
        motorVersion: motor.version,
        activo: true,
      },
      orderBy: [{ versionConfig: 'desc' }],
    });

    return {
      varianteId: variante.id,
      motorCodigo: motor.code,
      motorVersion: motor.version,
      parametros: config?.parametrosJson ?? {},
      versionConfig: config?.versionConfig ?? 1,
      activo: config?.activo ?? true,
      updatedAt: config?.updatedAt.toISOString() ?? null,
    };
  }

  async upsertVarianteMotorOverride(
    auth: CurrentAuth,
    varianteId: string,
    payload: UpsertVarianteMotorOverrideDto,
  ) {
    const variante = await this.findVarianteOrThrow(auth, varianteId, this.prisma);
    const producto = await this.findProductoOrThrow(auth, variante.productoServicioId, this.prisma);
    const motor = this.resolveMotorOrThrow(producto.motorCodigo, producto.motorVersion);
    const current = await this.prisma.productoVarianteMotorOverride.findFirst({
      where: {
        tenantId: auth.tenantId,
        productoVarianteId: variante.id,
        motorCodigo: motor.code,
        motorVersion: motor.version,
        activo: true,
      },
      orderBy: [{ versionConfig: 'desc' }],
    });

    const nextVersion = (current?.versionConfig ?? 0) + 1;
    const merged = this.mergeMotorConfig(current?.parametrosJson, payload.parametros);

    const created = await this.prisma.productoVarianteMotorOverride.create({
      data: {
        tenantId: auth.tenantId,
        productoVarianteId: variante.id,
        motorCodigo: motor.code,
        motorVersion: motor.version,
        parametrosJson: merged,
        versionConfig: nextVersion,
        activo: true,
      },
    });

    return {
      varianteId: variante.id,
      motorCodigo: motor.code,
      motorVersion: motor.version,
      parametros: created.parametrosJson,
      versionConfig: created.versionConfig,
      activo: created.activo,
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async cotizarVariante(
    auth: CurrentAuth,
    varianteId: string,
    payload: CotizarProductoVarianteDto,
  ) {
    const cantidad = Math.floor(Number(payload.cantidad));
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new BadRequestException('La cantidad debe ser mayor a 0.');
    }
    const periodo = this.normalizePeriodo(payload.periodo);

    const variante = await this.findVarianteCompletaOrThrow(auth, varianteId, this.prisma);
    if (!variante.papelVariante) {
      throw new BadRequestException('La variante no tiene papel/sustrato asignado.');
    }
    const procesoDefinicionId = this.resolveRutaEfectivaId(variante);
    if (!procesoDefinicionId) {
      throw new BadRequestException('No hay ruta de producción efectiva para la variante seleccionada.');
    }

    const motor = this.resolveMotorOrThrow(
      variante.productoServicio.motorCodigo,
      variante.productoServicio.motorVersion,
    );
    const { config, configVersionBase, configVersionOverride } =
      await this.getEffectiveMotorConfig(auth, variante.productoServicio.id, variante.id, motor);
    const proceso = await this.findProcesoConOperacionesOrThrow(auth, procesoDefinicionId, this.prisma);
    if (proceso.operaciones.length === 0) {
      throw new BadRequestException('La ruta seleccionada no tiene pasos operativos.');
    }
    const checklistRespuestasInput = Array.from(
      new Map((payload.checklistRespuestas ?? []).map((item) => [item.preguntaId, item])).values(),
    );
    const checklist = await this.prisma.productoChecklist.findFirst({
      where: {
        tenantId: auth.tenantId,
        productoServicioId: variante.productoServicio.id,
        activo: true,
      },
      include: {
        preguntas: {
          where: { activo: true },
          include: {
            respuestas: {
              where: { activo: true },
              include: {
                reglas: {
                  where: { activo: true },
                  include: {
                    procesoOperacion: {
                      include: {
                        centroCosto: true,
                        maquina: true,
                        perfilOperativo: true,
                      },
                    },
                    costoCentroCosto: true,
                    materiaPrimaVariante: {
                      include: { materiaPrima: true },
                    },
                    niveles: {
                      where: { activo: true },
                      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
                    },
                  },
                  orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
                },
              },
              orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
            },
          },
          orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    const checklistPasoPlantillaById = await this.getChecklistPasoPlantillasMap(auth, checklist);
    const checklistPreguntaById = new Map(
      (checklist?.preguntas ?? []).map((pregunta) => [pregunta.id, pregunta]),
    );
    const checklistAplicadoTrace: Array<Record<string, unknown>> = [];
    const checklistReglasActivas: Array<{
      regla: any;
      respuestaId: string;
      preguntaId: string;
      pasoPlantilla: any | null;
    }> = [];
    const opcionesProductivasPermitidas = this.resolveEffectiveOptionValues(variante);
    const dimensionesBaseConsumidas = this.getProductoDimensionesBaseConsumidas(
      variante.productoServicio.detalleJson,
    );
    const matchingBaseVarianteRaw =
      this.getProductoMatchingBaseByVariante(variante.productoServicio.detalleJson).find(
        (item) => item.varianteId === variante.id,
      )?.matching ?? [];
    const pasosFijosVarianteRaw =
      this.getProductoPasosFijosByVariante(variante.productoServicio.detalleJson).find(
        (item) => item.varianteId === variante.id,
      )?.pasos ?? [];
    const seleccionesBaseInput = new Map(
      Array.from(
        new Map((payload.seleccionesBase ?? []).map((item) => [item.dimension, item])).values(),
      ).map((item) => [this.toDimensionOpcionProductiva(item.dimension), this.toValorOpcionProductiva(item.valor)]),
    );
    const atributosTecnicosSeleccionados = new Map<DimensionOpcionProductiva, ValorOpcionProductiva>();
    for (const dimension of dimensionesBaseConsumidas) {
      const valoresMatching = Array.from(
        new Set(
          matchingBaseVarianteRaw
            .map((item) =>
              dimension === DimensionOpcionProductiva.TIPO_IMPRESION
                ? item.tipoImpresion
                : item.caras,
            )
            .filter((value): value is TipoImpresionProductoVarianteDto | CarasProductoVarianteDto => Boolean(value))
            .map((value) =>
              dimension === DimensionOpcionProductiva.TIPO_IMPRESION
                ? this.toValorFromTipoImpresion(this.toTipoImpresion(value as TipoImpresionProductoVarianteDto))
                : this.toValorFromCaras(this.toCaras(value as CarasProductoVarianteDto)),
            ),
        ),
      );
      const permitidosVariante = opcionesProductivasPermitidas.get(dimension);
      const allowedValues = valoresMatching.filter((value) => !permitidosVariante || permitidosVariante.has(value));
      if (!allowedValues.length) {
        throw new BadRequestException(
          `Ruta base: no hay matching configurado para ${this.fromDimensionOpcionProductiva(dimension)} en la variante ${variante.nombre}.`,
        );
      }
      if (allowedValues.length === 1) {
        atributosTecnicosSeleccionados.set(dimension, allowedValues[0]);
        continue;
      }
      const selectedValue = seleccionesBaseInput.get(dimension);
      if (!selectedValue) {
        throw new BadRequestException(
          `Falta seleccionar una opción base para ${this.fromDimensionOpcionProductiva(dimension)}.`,
        );
      }
      if (permitidosVariante && !permitidosVariante.has(selectedValue)) {
        throw new BadRequestException(
          `La variante seleccionada no soporta ${this.fromDimensionOpcionProductiva(dimension)}=${this.fromValorOpcionProductiva(selectedValue)}.`,
        );
      }
      atributosTecnicosSeleccionados.set(dimension, selectedValue);
    }
    const matchingSeleccionado = matchingBaseVarianteRaw.filter((item) => {
      return dimensionesBaseConsumidas.every((dimension) => {
        const selectedValue = atributosTecnicosSeleccionados.get(dimension);
        if (!selectedValue) return false;
        if (dimension === DimensionOpcionProductiva.TIPO_IMPRESION) {
          return item.tipoImpresion
            ? this.toValorFromTipoImpresion(this.toTipoImpresion(item.tipoImpresion)) === selectedValue
            : false;
        }
        return item.caras ? this.toValorFromCaras(this.toCaras(item.caras)) === selectedValue : false;
      });
    });
    if (dimensionesBaseConsumidas.length > 0 && matchingSeleccionado.length === 0) {
      throw new BadRequestException(
        `Ruta base: no existe un matching para la combinación seleccionada en ${variante.nombre}.`,
      );
    }
    const matchingPlantillaIds = Array.from(new Set(matchingSeleccionado.map((item) => item.pasoPlantillaId)));
    const matchingPerfilIds = Array.from(new Set(matchingSeleccionado.map((item) => item.perfilOperativoId)));
    const pasosFijosPerfilIds = Array.from(new Set(pasosFijosVarianteRaw.map((item) => item.perfilOperativoId)));
    const [matchingPlantillas, matchingPerfiles, pasosFijosPerfiles] = await Promise.all([
      matchingPlantillaIds.length
        ? await this.prisma.procesoOperacionPlantilla.findMany({
            where: { tenantId: auth.tenantId, id: { in: matchingPlantillaIds } },
            include: {
              centroCosto: true,
              maquina: true,
              perfilOperativo: true,
            },
          })
        : Promise.resolve([]),
      matchingPerfilIds.length
        ? await this.prisma.maquinaPerfilOperativo.findMany({
            where: { tenantId: auth.tenantId, id: { in: matchingPerfilIds } },
          })
        : Promise.resolve([]),
      pasosFijosPerfilIds.length
        ? await this.prisma.maquinaPerfilOperativo.findMany({
            where: { tenantId: auth.tenantId, id: { in: pasosFijosPerfilIds } },
          })
        : Promise.resolve([]),
    ]);
    const matchingPlantillaById = new Map(matchingPlantillas.map((item) => [item.id, item]));
    const matchingPerfilById = new Map(matchingPerfiles.map((item) => [item.id, item]));
    const pasosFijosPerfilByPasoPlantillaId = new Map(
      pasosFijosVarianteRaw
        .map((item) => {
          const perfilOperativo = pasosFijosPerfiles.find((perfil) => perfil.id === item.perfilOperativoId) ?? null;
          if (!perfilOperativo) return null;
          return [item.pasoPlantillaId, perfilOperativo] as const;
        })
        .filter((item): item is readonly [string, any] => Boolean(item)),
    );
    const matchingBaseAplicado: Array<{
      pasoPlantilla: any;
      perfilOperativo: any;
      tipoImpresion: TipoImpresionProductoVariante | null;
      caras: CarasProductoVariante | null;
    }> = [];
    const matchingSeen = new Set<string>();
    for (const item of matchingSeleccionado) {
      const pasoPlantilla = matchingPlantillaById.get(item.pasoPlantillaId) ?? null;
      const perfilOperativo = matchingPerfilById.get(item.perfilOperativoId) ?? null;
      if (!pasoPlantilla || !perfilOperativo) {
        throw new BadRequestException('Ruta base: el matching referencia un paso o perfil inválido.');
      }
      const key = `${pasoPlantilla.id}:${perfilOperativo.id}`;
      if (matchingSeen.has(key)) {
        throw new BadRequestException('Ruta base: el matching seleccionado contiene filas duplicadas.');
      }
      matchingSeen.add(key);
      matchingBaseAplicado.push({
        pasoPlantilla,
        perfilOperativo,
        tipoImpresion: item.tipoImpresion ? this.toTipoImpresion(item.tipoImpresion) : null,
        caras: item.caras ? this.toCaras(item.caras) : null,
      });
    }
    for (const selected of checklistRespuestasInput) {
      const pregunta = checklistPreguntaById.get(selected.preguntaId);
      if (!pregunta) {
        throw new BadRequestException('Una respuesta del configurador referencia una pregunta inválida.');
      }
      const respuesta = pregunta.respuestas.find((item) => item.id === selected.respuestaId);
      if (!respuesta) {
        throw new BadRequestException('Una respuesta del configurador no pertenece a la pregunta indicada.');
      }
      for (const regla of respuesta.reglas) {
        const pasoPlantilla = this.resolveChecklistPasoPlantilla(
          regla.detalleJson,
          checklistPasoPlantillaById,
          regla.procesoOperacion ?? null,
        );
        const nivelesPaso = this.getProcesoOperacionNiveles(
          pasoPlantilla?.detalleJson ?? regla.procesoOperacion?.detalleJson ?? null,
        );
        const variantePasoId = this.getChecklistVariantePasoId(regla.detalleJson);
        if (
          regla.accion === TipoProductoChecklistReglaAccion.ACTIVAR_PASO &&
          !pasoPlantilla
        ) {
          throw new BadRequestException('La regla del configurador referencia un paso de biblioteca inválido.');
        }
        if (
          regla.accion === TipoProductoChecklistReglaAccion.SELECCIONAR_VARIANTE_PASO &&
          !pasoPlantilla
        ) {
          throw new BadRequestException(
            'La regla de configurador referencia un paso de biblioteca inválido.',
          );
        }
        if (
          regla.accion === TipoProductoChecklistReglaAccion.SELECCIONAR_VARIANTE_PASO &&
          nivelesPaso.length > 0 &&
          !variantePasoId
        ) {
          throw new BadRequestException(
            'Falta seleccionar variante para un paso del configurador con variantes.',
          );
        }
        if (regla.accion === TipoProductoChecklistReglaAccion.ACTIVAR_PASO && nivelesPaso.length > 0) {
          throw new BadRequestException(
            'Usa SELECCIONAR_VARIANTE_PASO para pasos del configurador con variantes.',
          );
        }
        checklistReglasActivas.push({
          regla,
          respuestaId: respuesta.id,
          preguntaId: pregunta.id,
          pasoPlantilla,
        });
      }
      checklistAplicadoTrace.push({
        preguntaId: pregunta.id,
        pregunta: pregunta.texto,
        respuestaId: respuesta.id,
        respuesta: respuesta.texto,
      });
    }
    const tipoImpresionSeleccionado = this.toTipoImpresionFromValor(
      atributosTecnicosSeleccionados.get(DimensionOpcionProductiva.TIPO_IMPRESION) ??
        this.toValorFromTipoImpresion(variante.tipoImpresion),
    );
    const carasSeleccionadas = this.toCarasFromValor(
      atributosTecnicosSeleccionados.get(DimensionOpcionProductiva.CARAS) ??
        this.toValorFromCaras(variante.caras),
    );
    const addonSelectionInput: string[] = [];
    const addonConfigInput: Array<{ addonId: string; nivelId?: string | null }> = [];
    const addonById = new Map<
      string,
      {
        productoAdicional: {
          id: string;
          nombre: string;
          tipo: TipoProductoAdicional;
          centroCostoId: string | null;
          centroCosto: { nombre: string } | null;
          metadataJson: Prisma.JsonValue | null;
        };
      }
    >();
    const addonConfigById = new Map<string, { addonId: string; nivelId?: string | null }>();
    const addonConfigTrace: Array<{ addonId: string; nivelId: string | null }> = [];
    const opcionProductivaEfectiva = new Map<DimensionOpcionProductiva, Set<ValorOpcionProductiva>>(
      Array.from(atributosTecnicosSeleccionados.entries()).map(([dimension, value]) => [
        dimension,
        new Set([value]),
      ]),
    );
    const efectosAplicados: any[] = [];
    const routeEffectsAplicados: any[] = [];
    const costEffectsAplicados: any[] = [];
    const materialEffectsAplicados: any[] = [];
    const servicePricingByAddon = new Map<string, ServicioPricingConfig>();
    const checklistNivelesActivos = checklistReglasActivas.filter(
      (item) =>
        item.regla.accion === TipoProductoChecklistReglaAccion.SELECCIONAR_VARIANTE_PASO &&
        item.pasoPlantilla &&
        this.getProcesoOperacionNiveles(item.pasoPlantilla.detalleJson).length > 0,
    );
    const checklistNivelMachineIds = Array.from(
      new Set(
        [...checklistNivelesActivos]
          .flatMap((item) =>
            this.getProcesoOperacionNiveles(item.pasoPlantilla?.detalleJson ?? null)
              .map((nivel) => nivel.maquinaId)
              .filter((value): value is string => Boolean(value)),
          ),
      ),
    );
    const checklistNivelPerfilIds = Array.from(
      new Set(
        [...checklistNivelesActivos]
          .flatMap((item) =>
            this.getProcesoOperacionNiveles(item.pasoPlantilla?.detalleJson ?? null)
              .map((nivel) => nivel.perfilOperativoId)
              .filter((value): value is string => Boolean(value)),
          ),
      ),
    );
    const [checklistNivelMaquinas, checklistNivelPerfiles] = await Promise.all([
      checklistNivelMachineIds.length
        ? this.prisma.maquina.findMany({
            where: { tenantId: auth.tenantId, id: { in: checklistNivelMachineIds } },
            include: { centroCostoPrincipal: true },
          })
        : Promise.resolve([]),
      checklistNivelPerfilIds.length
        ? this.prisma.maquinaPerfilOperativo.findMany({
            where: { tenantId: auth.tenantId, id: { in: checklistNivelPerfilIds } },
          })
        : Promise.resolve([]),
    ]);
    const checklistNivelMaquinaById = new Map(checklistNivelMaquinas.map((item) => [item.id, item]));
    const checklistNivelPerfilById = new Map(checklistNivelPerfiles.map((item) => [item.id, item]));
    const checklistOperacionesActivadas = checklistReglasActivas
      .filter(
        (item) =>
          item.regla.accion === TipoProductoChecklistReglaAccion.ACTIVAR_PASO &&
          item.pasoPlantilla &&
          this.getProcesoOperacionNiveles(item.pasoPlantilla.detalleJson).length === 0,
      )
      .map((item) => ({
        operacion: {
          ...this.buildChecklistOperacionFromPlantilla(item.pasoPlantilla!),
          orden: this.getChecklistRouteOrden(item.regla.detalleJson),
        },
        insertion: this.parseChecklistRouteInsertion(item.regla.detalleJson),
      }))
      .filter((item) => item.operacion.activo);
    const checklistPasoPlantillaIds = new Set(
      checklistReglasActivas
        .map((item) => item.pasoPlantilla?.id ?? null)
        .filter((value): value is string => Boolean(value)),
    );
    const checklistPasoSignatures = new Set(
      checklistReglasActivas
        .map((item) => this.buildChecklistPasoSignature(item.pasoPlantilla))
        .filter((value): value is string => Boolean(value)),
    );
    const operacionesBaseCotizadas = proceso.operaciones
      .filter((op) => op.activo)
      .map((op) => {
        const pasoPlantillaId =
          this.getPasoPlantillaIdFromDetalle(op.detalleJson) ??
          this.resolvePasoPlantillaIdFromOperacionRuta(op, matchingPlantillas);
        const matchingSeleccion = pasoPlantillaId
          ? matchingBaseAplicado.find((item) => item.pasoPlantilla.id === pasoPlantillaId) ?? null
          : null;
        if (matchingSeleccion) {
          return {
            ...this.buildChecklistOperacionFromPlantillaConPerfil(
              matchingSeleccion.pasoPlantilla,
              matchingSeleccion.perfilOperativo,
            ),
            orden: op.orden,
            codigo: op.codigo,
            detalleJson: {
              ...this.asObject(op.detalleJson),
              ...this.asObject(
                this.buildChecklistOperacionFromPlantillaConPerfil(
                  matchingSeleccion.pasoPlantilla,
                  matchingSeleccion.perfilOperativo,
                ).detalleJson,
              ),
              pasoPlantillaId: matchingSeleccion.pasoPlantilla.id,
              perfilOperativoId: matchingSeleccion.perfilOperativo.id,
              matchingBase: true,
              matchingBaseOrdenOriginal: op.orden,
            } as Prisma.JsonObject,
          };
        }
        if (!pasoPlantillaId) {
          return op;
        }
        const perfilOverride = pasosFijosPerfilByPasoPlantillaId.get(pasoPlantillaId) ?? null;
        if (!perfilOverride) {
          return op;
        }
        return {
          ...op,
          perfilOperativoId: perfilOverride.id,
          perfilOperativo: perfilOverride,
          setupMin:
            perfilOverride.setupMin !== null && perfilOverride.setupMin !== undefined
              ? perfilOverride.setupMin
              : op.setupMin,
          cleanupMin:
            perfilOverride.cleanupMin !== null && perfilOverride.cleanupMin !== undefined
              ? perfilOverride.cleanupMin
              : op.cleanupMin,
          productividadBase:
            perfilOverride.productivityValue !== null && perfilOverride.productivityValue !== undefined
              ? perfilOverride.productivityValue
              : op.productividadBase,
          detalleJson: {
            ...this.asObject(op.detalleJson),
            perfilOperativoId: perfilOverride.id,
            pasoFijoPerfilOverride: true,
          } as Prisma.JsonObject,
        };
      });
    const conflictosChecklistRuta = operacionesBaseCotizadas
      .filter((op) => {
        const pasoPlantillaId = this.getPasoPlantillaIdFromDetalle(op.detalleJson);
        if (pasoPlantillaId && checklistPasoPlantillaIds.has(pasoPlantillaId)) {
          return true;
        }
        const signature = this.buildChecklistPasoSignature(op);
        return Boolean(signature && checklistPasoSignatures.has(signature));
      })
      .map((op) => op.nombre);
    const conflictosChecklistRutaWarnings = Array.from(new Set(conflictosChecklistRuta)).map(
      (nombrePaso) =>
        `Conflicto de configuración: el paso "${nombrePaso}" está en la ruta base y también se activa desde Configurador.`,
    );
    const conflictosMatchingRutaWarnings: string[] = [];
    const operacionesRouteEffect = routeEffectsAplicados.map((effect) => ({
      effect,
      insertion: this.parseRouteEffectInsertion(effect.routeEffect?.detalleJson ?? null),
      pasos: (effect.routeEffect?.pasos ?? []).map((paso: any) => ({
        id: paso.id,
        orden: paso.orden,
        codigo: `ADON-${effect.id.slice(0, 6).toUpperCase()}-${paso.orden}`,
        nombre: paso.nombre,
        centroCostoId: paso.centroCostoId,
        centroCosto: paso.centroCosto,
        maquinaId: paso.maquinaId,
        maquina: paso.maquina,
        perfilOperativo: paso.perfilOperativo,
        perfilOperativoId: paso.perfilOperativoId,
        setupMin: paso.setupMin,
        runMin: paso.runMin,
        cleanupMin: paso.cleanupMin,
        tiempoFijoMin: paso.tiempoFijoMin,
        detalleJson: {
          ...this.asObject(paso.detalleJson),
          routeEffectId: effect.id,
          routeEffectNombre: effect.nombre,
          routeEffectInsertion: this.parseRouteEffectInsertion(effect.routeEffect?.detalleJson ?? null),
        } as Prisma.JsonObject,
        unidadEntrada: UnidadProceso.NINGUNA,
        unidadSalida: UnidadProceso.NINGUNA,
        unidadTiempo: UnidadProceso.MINUTO,
        productividadBase: null,
        mermaSetup: null,
        mermaRunPct: null,
        reglaMermaJson: null,
      })),
    }));
    const operacionesCotizadas = this.buildOperacionesCotizadasOrdenadas(
      operacionesBaseCotizadas,
      operacionesRouteEffect,
      checklistOperacionesActivadas,
      conflictosMatchingRutaWarnings,
    );
    if (operacionesCotizadas.length === 0) {
      throw new BadRequestException('La ruta no tiene pasos activos para la selección actual.');
    }

    const centrosCostEffect = costEffectsAplicados
      .map((item) => item.costEffect?.centroCostoId)
      .filter((value): value is string => Boolean(value));
    const centrosServicePricing = checklistNivelesActivos
      .map((item) => item.pasoPlantilla?.centroCostoId ?? null)
      .filter((value): value is string => Boolean(value));
    const centrosChecklistCosto = checklistReglasActivas
      .map((item) => {
        if (item.regla.accion !== TipoProductoChecklistReglaAccion.COSTO_EXTRA) return null;
        if (item.regla.costoRegla !== ReglaCostoChecklist.TIEMPO_MIN) return null;
        return item.regla.costoCentroCostoId ?? item.pasoPlantilla?.centroCostoId ?? null;
      })
      .filter((value): value is string => Boolean(value));
    const centroIds = Array.from(
      new Set([
        ...operacionesCotizadas.map((item) => item.centroCostoId),
        ...centrosCostEffect,
        ...centrosServicePricing,
        ...centrosChecklistCosto,
      ]),
    );
    const tarifas = await this.prisma.centroCostoTarifaPeriodo.findMany({
      where: {
        tenantId: auth.tenantId,
        periodo,
        estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
        centroCostoId: { in: centroIds },
      },
      select: {
        centroCostoId: true,
        tarifaCalculada: true,
      },
    });
    const tarifaByCentro = new Map(tarifas.map((item) => [item.centroCostoId, item.tarifaCalculada]));
    for (const op of operacionesCotizadas) {
      if (!tarifaByCentro.has(op.centroCostoId)) {
        throw new BadRequestException(
          `No hay tarifa PUBLICADA para ${op.centroCosto.nombre} en ${periodo}.`,
        );
      }
    }

    const sustratoDims = this.resolvePapelDimensionesMm(variante.papelVariante.atributosVarianteJson);
    const pliegoImpresion = this.resolvePliegoImpresion(config, sustratoDims);
    const machineMargins = this.resolveImposicionMachineMargins(
      proceso.operaciones,
      operacionesCotizadas,
    );
    const imposicion = this.calculateImposicion({
      varianteAnchoMm: Number(variante.anchoMm),
      varianteAltoMm: Number(variante.altoMm),
      sheetAnchoMm: pliegoImpresion.anchoMm,
      sheetAltoMm: pliegoImpresion.altoMm,
      machineMargins,
      config,
    });
    if (imposicion.piezasPorPliego <= 0) {
      throw new BadRequestException('No entran piezas en el pliego con la configuracion actual.');
    }

    const mermaPct = Number(config.mermaAdicionalPct ?? 0);
    const cantidadConMerma = Math.ceil(cantidad * (1 + mermaPct / 100));
    const pliegos = Math.ceil(cantidadConMerma / imposicion.piezasPorPliego);

    const precioPapelBase = Number(variante.papelVariante.precioReferencia ?? 0);
    const conversionPapel = this.calculateSustratoToPliegoConversion({
      sustrato: sustratoDims,
      pliegoImpresion,
    });
    const costoPapelUnit =
      conversionPapel.pliegosPorSustrato > 0
        ? precioPapelBase / conversionPapel.pliegosPorSustrato
        : 0;
    const costoPapel = costoPapelUnit * pliegos;
    const warnings: string[] = [...conflictosChecklistRutaWarnings, ...conflictosMatchingRutaWarnings];
    if (!variante.papelVariante.precioReferencia) {
      warnings.push('El papel asignado no tiene precio de referencia. Se uso 0 para costo de papel.');
    }

    const materiales: Array<Record<string, unknown>> = [];
    let costoToner = 0;
    let costoDesgaste = 0;
    let costoConsumiblesTerminacion = 0;

    const areaPliegoM2 = (pliegoImpresion.anchoMm / 1000) * (pliegoImpresion.altoMm / 1000);
    const a4EqFactor = areaPliegoM2 / ProductosServiciosService.DEFAULT_A4_AREA_M2;
    const carasFactor = carasSeleccionadas === CarasProductoVariante.DOBLE_FAZ ? 2 : 1;
    const machineIds = Array.from(
      new Set(
        operacionesCotizadas
          .map((op) => op.maquinaId)
          .filter((item): item is string => Boolean(item)),
      ),
    );
    const [consumibles, consumiblesFilm, desgastes] = await Promise.all([
      this.prisma.maquinaConsumible.findMany({
        where: {
          tenantId: auth.tenantId,
          activo: true,
          tipo: TipoConsumibleMaquina.TONER,
          maquinaId: {
            in: machineIds,
          },
        },
        include: {
          perfilOperativo: true,
          materiaPrimaVariante: {
            include: {
              materiaPrima: true,
            },
          },
        },
      }),
      this.prisma.maquinaConsumible.findMany({
        where: {
          tenantId: auth.tenantId,
          activo: true,
          tipo: TipoConsumibleMaquina.FILM,
          maquinaId: {
            in: machineIds,
          },
        },
        include: {
          perfilOperativo: true,
          materiaPrimaVariante: {
            include: {
              materiaPrima: true,
            },
          },
        },
      }),
      this.prisma.maquinaComponenteDesgaste.findMany({
        where: {
          tenantId: auth.tenantId,
          activo: true,
          maquinaId: {
            in: machineIds,
          },
        },
        include: {
          materiaPrimaVariante: {
            include: {
              materiaPrima: true,
            },
          },
        },
      }),
    ]);

    type PasoCotizado = {
      orden: number;
      codigo: string;
      nombre: string;
      centroCostoId: string;
      centroCostoNombre: string;
      origen: string;
      addonId: string | null;
      setupMin: number;
      runMin: number;
      cleanupMin: number;
      tiempoFijoMin: number;
      totalMin: number;
      tarifaHora: number;
      costo: number;
      detalleTecnico: Record<string, unknown> | null;
    };

    let pliegosMermaOperativaImpresion = 0;
    const pasos: PasoCotizado[] = operacionesCotizadas.map((op) => {
      const setupMinBase = Number(op.setupMin ?? this.getSetupFromPerfilOperativo(op.perfilOperativo) ?? 0);
      const cleanupMinBase = Number(op.cleanupMin ?? 0);
      const pasoDetalle = this.asObject(op.detalleJson);
      const tiempoFijoMinFallbackDetalle = this.toSafeNumber(
        pasoDetalle.tiempoFijoMinFallback,
        Number(op.tiempoFijoMin ?? 0),
      );
      const tiempoFijoMinBase = Number(
        op.tiempoFijoMin ??
          (Number.isFinite(tiempoFijoMinFallbackDetalle) && tiempoFijoMinFallbackDetalle > 0
            ? tiempoFijoMinFallbackDetalle
            : 0),
      );
      const usarTiempoFijoManual = tiempoFijoMinBase > 0;
      const cantidadObjetivoSalida =
        op.unidadEntrada === UnidadProceso.HOJA ||
        op.unidadSalida === UnidadProceso.HOJA
          ? pliegos
          : cantidad;
      const timingOverride = this.calculateTerminatingOperationTiming({
        operacion: op,
        cantidad,
        pliegos,
        setupMinBase,
        cleanupMinBase,
        tiempoFijoMinBase,
        cantidadObjetivoSalida,
        imposicion: {
          cols: imposicion.cols,
          rows: imposicion.rows,
          tipoCorte: imposicion.tipoCorte,
        },
        varianteAnchoMm: Number(variante.anchoMm),
        varianteAltoMm: Number(variante.altoMm),
        overridesProductividad: this.asObject(
          pasoDetalle.overridesProductividad as Prisma.JsonValue | undefined,
        ),
      });
      let setupMin = timingOverride?.setupMin ?? setupMinBase;
      let cleanupMin = timingOverride?.cleanupMin ?? cleanupMinBase;
      let tiempoFijoMin = timingOverride?.tiempoFijoMin ?? tiempoFijoMinBase;
      let runMin = timingOverride?.runMin ?? Number(op.runMin ?? 0);
      let cantidadRunOperativa = cantidadObjetivoSalida;
      let sourceProductividad: 'perfil' | 'override' | 'fijo' =
        timingOverride?.sourceProductividad ?? (usarTiempoFijoManual ? 'fijo' : 'perfil');
      if (timingOverride?.warnings?.length) {
        warnings.push(...timingOverride.warnings.map((item) => `Paso ${op.codigo} (${op.nombre}): ${item}`));
      }
      if (!usarTiempoFijoManual) {
        if (!timingOverride) {
          const productividad = evaluateProductividad({
            modoProductividad: ModoProductividadProceso.FIJA,
            productividadBase: op.productividadBase,
            reglaVelocidadJson: null,
            reglaMermaJson: op.reglaMermaJson,
            runMin: op.runMin,
            unidadTiempo: op.unidadTiempo,
            mermaRunPct: op.mermaRunPct,
            mermaSetup: op.mermaSetup,
            cantidadObjetivoSalida,
            contexto: {
              cantidad,
              pliegos,
              piezasPorPliego: imposicion.piezasPorPliego,
              areaPliegoM2,
              a4EqFactor,
              carasFactor,
            },
          });
          runMin = productividad.runMin;
          cantidadRunOperativa = productividad.cantidadRun;
          sourceProductividad = 'fijo';
          for (const warning of productividad.warnings) {
            warnings.push(`Paso ${op.codigo} (${op.nombre}): ${warning}`);
          }
        }
      }

      const isLaserMachine = op.maquina?.plantilla === PlantillaMaquinaria.IMPRESORA_LASER;
      const pliegosEfectivosOperacion =
        isLaserMachine &&
        (op.unidadEntrada === UnidadProceso.HOJA || op.unidadSalida === UnidadProceso.HOJA)
          ? Math.max(pliegos, cantidadRunOperativa)
          : pliegos;
      if (isLaserMachine) {
        pliegosMermaOperativaImpresion += Math.max(0, pliegosEfectivosOperacion - pliegos);
      }

      if (op.maquinaId) {
        const tonerAndWear = this.calculateMachineConsumables({
          operation: op,
          tipoImpresion: tipoImpresionSeleccionado,
          carasFactor,
          pliegos,
          pliegosEfectivos: pliegosEfectivosOperacion,
          areaPliegoM2,
          a4EqFactor,
          warnings,
          consumibles,
          desgastes,
        });
        costoToner += tonerAndWear.costoToner;
        costoDesgaste += tonerAndWear.costoDesgaste;
        materiales.push(...tonerAndWear.materiales);
        const laminadoFilm = this.calculateLaminadoraFilmConsumables({
          operation: op,
          consumiblesFilm,
          timingOverride,
          warnings,
        });
        materiales.push(...laminadoFilm.materiales);
        costoConsumiblesTerminacion += laminadoFilm.costo;
      }

      const totalMin = setupMin + runMin + cleanupMin + tiempoFijoMin;
      const tarifa = tarifaByCentro.get(op.centroCostoId)!;
      const costoPaso = Number(tarifa.mul(totalMin / 60).toFixed(6));
      const esChecklist = checklistOperacionesActivadas.some((item) => item.operacion.id === op.id);
      const esRouteEffect = Boolean(this.asObject(op.detalleJson).routeEffectId);
      return {
        orden: op.orden,
        codigo: op.codigo,
        nombre: op.nombre,
        centroCostoId: op.centroCostoId,
        centroCostoNombre: op.centroCosto.nombre,
        origen: esChecklist ? 'Configurador' : esRouteEffect ? 'Acabado adicional' : 'Producto base',
        addonId: null,
        setupMin,
        runMin,
        cleanupMin,
        tiempoFijoMin,
        totalMin: Number(totalMin.toFixed(4)),
        tarifaHora: Number(tarifa),
        costo: costoPaso,
        detalleTecnico: {
          ...(timingOverride?.trace ?? {}),
          sourceProductividad,
          maquina: op.maquina?.nombre ?? null,
          perfilOperativo: op.perfilOperativo?.nombre ?? null,
        } as Record<string, unknown>,
      };
    });

    const costoProcesos = pasos.reduce((acc, item) => acc + item.costo, 0);
    let costoAdicionalesCostEffects = 0;
    let costoAdicionalesMateriales = 0;
    materiales.unshift({
      tipo: 'PAPEL',
      nombre: variante.papelVariante.materiaPrima.nombre,
      sku: variante.papelVariante.sku,
      cantidad: pliegos,
      costoUnitario: costoPapelUnit,
      costo: costoPapel,
      esCostoDerivado: conversionPapel.esDerivado,
      pliegosPorSustrato: conversionPapel.pliegosPorSustrato,
      orientacionConversion: conversionPapel.orientacion,
      sustratoAnchoMm: sustratoDims.anchoMm,
      sustratoAltoMm: sustratoDims.altoMm,
      pliegoImpresionAnchoMm: pliegoImpresion.anchoMm,
      pliegoImpresionAltoMm: pliegoImpresion.altoMm,
      origen: 'Base',
    });
    if (pliegosMermaOperativaImpresion > 0) {
      const costoPapelMerma = pliegosMermaOperativaImpresion * costoPapelUnit;
      materiales.splice(1, 0, {
        tipo: 'PAPEL',
        nombre: `${variante.papelVariante.materiaPrima.nombre} · Merma operativa`,
        sku: variante.papelVariante.sku,
        cantidad: Number(pliegosMermaOperativaImpresion.toFixed(6)),
        costoUnitario: costoPapelUnit,
        costo: Number(costoPapelMerma.toFixed(6)),
        esCostoDerivado: conversionPapel.esDerivado,
        pliegosPorSustrato: conversionPapel.pliegosPorSustrato,
        orientacionConversion: conversionPapel.orientacion,
        sustratoAnchoMm: sustratoDims.anchoMm,
        sustratoAltoMm: sustratoDims.altoMm,
        pliegoImpresionAnchoMm: pliegoImpresion.anchoMm,
        pliegoImpresionAltoMm: pliegoImpresion.altoMm,
        origen: 'Merma operativa',
      });
    }

    if (addonSelectionInput.length) {
      const addonsMateriales = await this.prisma.productoAdicionalMaterial.findMany({
        where: {
          tenantId: auth.tenantId,
          activo: true,
          productoAdicionalId: {
            in: addonSelectionInput,
          },
        },
        include: {
          productoAdicional: true,
          materiaPrimaVariante: {
            include: {
              materiaPrima: true,
            },
          },
        },
      });

      for (const material of addonsMateriales) {
        const baseQty =
          material.tipoConsumo === TipoConsumoAdicionalMaterial.POR_PLIEGO
            ? pliegos
            : material.tipoConsumo === TipoConsumoAdicionalMaterial.POR_M2
              ? areaPliegoM2 * pliegos
              : cantidad;
        const mermaFactor = 1 + Number(material.mermaPct ?? 0) / 100;
        const consumo = Number(material.factorConsumo) * baseQty * mermaFactor;
        const costoUnit = Number(material.materiaPrimaVariante.precioReferencia ?? 0);
        const costo = consumo * costoUnit;
        costoAdicionalesMateriales += costo;
        materiales.push({
          tipo: 'ADICIONAL_MATERIAL',
          nombre: material.materiaPrimaVariante.materiaPrima.nombre,
          sku: material.materiaPrimaVariante.sku,
          cantidad: Number(consumo.toFixed(6)),
          costoUnitario: Number(costoUnit.toFixed(6)),
          costo: Number(costo.toFixed(6)),
          adicionalId: material.productoAdicionalId,
          adicionalNombre: material.productoAdicional.nombre,
          origen: `Adicional:${material.productoAdicional.nombre}`,
        });
      }
    }

    const ordenLegacyServicioByAddon = new Map<string, number>();
    for (const op of proceso.operaciones) {
      if (!op.requiresProductoAdicionalId) continue;
      if (!servicePricingByAddon.has(op.requiresProductoAdicionalId)) continue;
      const current = ordenLegacyServicioByAddon.get(op.requiresProductoAdicionalId);
      if (current === undefined || op.orden < current) {
        ordenLegacyServicioByAddon.set(op.requiresProductoAdicionalId, op.orden);
      }
    }

    const costosPorEfecto: Array<Record<string, unknown>> = [];
    for (const addonId of addonSelectionInput) {
      const addon = addonById.get(addonId)?.productoAdicional;
      const pricing = servicePricingByAddon.get(addonId);
      if (!addon || !pricing) continue;
      const selectedNivelId =
        addonConfigById.get(addonId)?.nivelId ??
        pricing.niveles.find((nivel) => nivel.activo)?.id ??
        pricing.niveles[0]?.id ??
        '';
      const regla = pricing.reglas.find((item) => item.nivelId === selectedNivelId);
      if (!regla) {
        warnings.push(`Adicional ${addon.nombre}: no se encontró regla para el nivel seleccionado.`);
        continue;
      }
      const centroId = addon.centroCostoId;
      if (!centroId) {
        warnings.push(`Adicional ${addon.nombre}: falta centro de costo para regla por tiempo.`);
        continue;
      }
      const tarifa = tarifaByCentro.get(centroId);
      if (!tarifa) {
        warnings.push(`Adicional ${addon.nombre}: falta tarifa publicada para centro de costo.`);
        continue;
      }
      const minutosServicio = Number(regla.tiempoMin);
      const montoBase = Number(tarifa.mul(minutosServicio / 60).toFixed(6));
      const montoTotal = montoBase;
      if (montoTotal === 0) continue;
      costoAdicionalesCostEffects += montoTotal;
      const nivelNombre = pricing.niveles.find((item) => item.id === selectedNivelId)?.nombre ?? selectedNivelId;
      costosPorEfecto.push({
        addonId: addonId,
        adicionalNombre: addon.nombre,
        origen: 'ServicioNivel',
        nivelId: selectedNivelId,
        nivelNombre,
        regla: ReglaCostoAdicionalEfectoDto.tiempo_extra_min,
        tiempoMin: minutosServicio,
        montoBase: Number(montoBase.toFixed(6)),
        monto: montoTotal,
      });
      pasos.push({
        orden:
          ordenLegacyServicioByAddon.get(addon.id) ??
          pasos.reduce((max, step) => Math.max(max, step.orden), 0) + 1,
        codigo: `SRV-${addon.id.slice(0, 6).toUpperCase()}`,
        nombre: `Servicio: ${addon.nombre}${nivelNombre ? ` (${nivelNombre})` : ''}`,
        centroCostoId: addon.centroCostoId ?? 'N/A',
        centroCostoNombre: addon.centroCosto?.nombre ?? 'Servicio',
        origen: `Adicional:${addon.nombre}`,
        addonId: addon.id,
        setupMin: 0,
        runMin: 0,
        cleanupMin: 0,
        tiempoFijoMin: Number(minutosServicio.toFixed(4)),
        totalMin: Number(minutosServicio.toFixed(4)),
        tarifaHora: Number(tarifa),
        costo: montoTotal,
        detalleTecnico: null,
      });
    }
    for (const effect of costEffectsAplicados) {
      const cost = effect.costEffect;
      if (!cost) continue;
      let monto = 0;
      if (cost.regla === ReglaCostoAdicionalEfecto.FLAT) {
        monto = Number(cost.valor);
      } else if (cost.regla === ReglaCostoAdicionalEfecto.POR_UNIDAD) {
        monto = Number(cost.valor) * cantidad;
      } else if (cost.regla === ReglaCostoAdicionalEfecto.POR_PLIEGO) {
        monto = Number(cost.valor) * pliegos;
      } else if (cost.regla === ReglaCostoAdicionalEfecto.PORCENTAJE_SOBRE_TOTAL) {
        const base =
          costoPapel +
          costoToner +
          costoDesgaste +
          costoConsumiblesTerminacion +
          costoProcesos +
          costoAdicionalesMateriales +
          costoAdicionalesCostEffects;
        monto = base * (Number(cost.valor) / 100);
      } else if (cost.regla === ReglaCostoAdicionalEfecto.TIEMPO_EXTRA_MIN) {
        const centroId =
          cost.centroCostoId ??
          addonById.get(effect.productoAdicionalId)?.productoAdicional?.centroCostoId ??
          null;
        if (!centroId) {
          warnings.push(`Efecto ${effect.nombre}: tiempo_extra_min sin centro de costo. Se omitió.`);
          continue;
        }
        const tarifaCentro = tarifaByCentro.get(centroId);
        if (!tarifaCentro) {
          warnings.push(`Efecto ${effect.nombre}: sin tarifa publicada para centro de costo.`);
          continue;
        }
        monto = Number(tarifaCentro.mul(Number(cost.valor) / 60).toFixed(6));
      }
      const montoRounded = Number(monto.toFixed(6));
      if (montoRounded === 0) continue;
      costoAdicionalesCostEffects += montoRounded;
      costosPorEfecto.push({
        efectoId: effect.id,
        nombre: effect.nombre,
        tipo: this.fromTipoAdicionalEfecto(effect.tipo),
        regla: this.fromReglaCostoAdicionalEfecto(cost.regla),
        monto: montoRounded,
        adicionalId: effect.productoAdicionalId,
        adicionalNombre: addonById.get(effect.productoAdicionalId)?.productoAdicional?.nombre ?? '',
      });
      pasos.push({
        orden: pasos.length + 1,
        codigo: `COST-EFFECT-${effect.id.slice(0, 6).toUpperCase()}`,
        nombre: `Ajuste costo: ${effect.nombre}`,
        centroCostoId:
          cost.centroCostoId ??
          addonById.get(effect.productoAdicionalId)?.productoAdicional?.centroCostoId ??
          'N/A',
        centroCostoNombre:
          cost.centroCosto?.nombre ??
          'Ajuste adicional',
        origen: `Adicional:${addonById.get(effect.productoAdicionalId)?.productoAdicional?.nombre ?? effect.productoAdicionalId}`,
        addonId: effect.productoAdicionalId,
        setupMin: 0,
        runMin: 0,
        cleanupMin: 0,
        tiempoFijoMin: 0,
        totalMin: 0,
        tarifaHora: 0,
        costo: montoRounded,
        detalleTecnico: null,
      });
    }

    for (const effect of materialEffectsAplicados) {
      const material = effect.materialEffect;
      if (!material) continue;
      const baseQty =
        material.tipoConsumo === TipoConsumoAdicionalMaterial.POR_PLIEGO
          ? pliegos
          : material.tipoConsumo === TipoConsumoAdicionalMaterial.POR_M2
            ? areaPliegoM2 * pliegos
            : cantidad;
      const mermaFactor = 1 + Number(material.mermaPct ?? 0) / 100;
      const consumo = Number(material.factorConsumo) * baseQty * mermaFactor;
      const costoUnit = Number(material.materiaPrimaVariante.precioReferencia ?? 0);
      const costo = consumo * costoUnit;
      const costoRounded = Number(costo.toFixed(6));
      costoAdicionalesMateriales += costoRounded;
      materiales.push({
        tipo: 'ADDITIONAL_MATERIAL_EFFECT',
        nombre: material.materiaPrimaVariante.materiaPrima.nombre,
        sku: material.materiaPrimaVariante.sku,
        cantidad: Number(consumo.toFixed(6)),
        costoUnitario: Number(costoUnit.toFixed(6)),
        costo: costoRounded,
        adicionalId: effect.productoAdicionalId,
        adicionalNombre: addonById.get(effect.productoAdicionalId)?.productoAdicional?.nombre ?? '',
        efectoId: effect.id,
        efectoNombre: effect.nombre,
        origen: `Adicional:${addonById.get(effect.productoAdicionalId)?.productoAdicional?.nombre ?? effect.productoAdicionalId}`,
      });
    }

    const ordenRutaBaseByPasoPlantillaId = new Map<string, number>();
    for (const operacion of operacionesCotizadas) {
      const pasoPlantillaId = this.getPasoPlantillaIdFromDetalle(operacion.detalleJson ?? null);
      if (!pasoPlantillaId || ordenRutaBaseByPasoPlantillaId.has(pasoPlantillaId)) continue;
      ordenRutaBaseByPasoPlantillaId.set(pasoPlantillaId, operacion.orden);
    }
    const checklistInsertionCounts = new Map<string, number>();

    const pasosConVariantesActivos = [
      ...checklistReglasActivas
        .filter((item) => item.regla.accion === TipoProductoChecklistReglaAccion.SELECCIONAR_VARIANTE_PASO)
        .map((item) => ({
          source: 'checklist' as const,
          pasoPlantilla: item.pasoPlantilla,
          variantePasoId: this.getChecklistVariantePasoId(item.regla.detalleJson),
          insertion: this.parseChecklistRouteInsertion(item.regla.detalleJson),
          routeOrden: this.getChecklistRouteOrden(item.regla.detalleJson),
          reglaId: item.regla.id,
          label: 'Configurador',
        })),
    ];

    for (const item of [...pasosConVariantesActivos].sort((a, b) => a.routeOrden - b.routeOrden)) {
      const nivelesPaso = this.getProcesoOperacionNiveles(item.pasoPlantilla?.detalleJson ?? null);
      if (!nivelesPaso.length) {
        continue;
      }
      const nivel =
        nivelesPaso.find((nivelItem: any) => nivelItem.id === item.variantePasoId) ?? nivelesPaso[0] ?? null;
      if (!nivel) {
        warnings.push(`${item.label}: paso con variantes sin variante disponible. Se omitió.`);
        continue;
      }
      const centroId = item.pasoPlantilla?.centroCostoId ?? null;
      if (!centroId) {
        warnings.push(`${item.label}: ${item.reglaId} sin centro de costo para costeo por tiempo.`);
        continue;
      }
      const tarifa = tarifaByCentro.get(centroId);
      if (!tarifa) {
        warnings.push(`${item.label}: falta tarifa publicada para centro de costo en regla con variantes.`);
        continue;
      }
      const areaPiezaM2 = (Number(variante.anchoMm) * Number(variante.altoMm)) / 1_000_000;
      const quantityByUnidad = this.resolveChecklistCantidadObjetivo({
        unidadSalida: nivel.unidadSalida ?? item.pasoPlantilla?.unidadSalida ?? null,
        cantidad,
        pliegos,
        areaPiezaM2,
        areaPliegoM2,
        a4EqFactor,
        anchoMm: Number(variante.anchoMm),
        altoMm: Number(variante.altoMm),
      });
      let setupMin = Number(nivel.setupMin ?? 0);
      let cleanupMin = Number(nivel.cleanupMin ?? 0);
      let tiempoFijoMin = 0;
      let runMin = 0;
      let sourceProductividad = 'nivel_fijo';
      let detalleTecnico: Record<string, unknown> = {
        sourceProductividad,
        variantePasoId: nivel.id,
        variantePasoNombre: nivel.nombre,
        modoProductividadNivel: nivel.modoProductividadNivel,
      };

      if (nivel.modoProductividadNivel === 'fija') {
        tiempoFijoMin = Number(nivel.tiempoFijoMin ?? 0);
      } else if (nivel.modoProductividadNivel === 'variable_manual') {
        const productividad = evaluateProductividad({
          modoProductividad: ModoProductividadProceso.FIJA,
          productividadBase:
            nivel.productividadBase === null ? null : new Prisma.Decimal(nivel.productividadBase),
          reglaVelocidadJson: null,
          reglaMermaJson: null,
          runMin: null,
          unidadTiempo: this.toPrismaUnidadProceso(
            nivel.unidadTiempo ?? item.pasoPlantilla?.unidadTiempo ?? UnidadProceso.MINUTO,
          ),
          mermaRunPct: null,
          mermaSetup: null,
          cantidadObjetivoSalida: quantityByUnidad,
          contexto: {
            cantidad,
            pliegos,
            areaPiezaM2,
            areaPliegoM2,
            a4EqFactor,
          },
        });
        runMin = productividad.runMin;
        sourceProductividad = 'nivel_variable_manual';
        detalleTecnico = {
          ...detalleTecnico,
          sourceProductividad,
          cantidadObjetivoSalida: quantityByUnidad,
          productividadAplicada: productividad.productividadAplicada,
          unidadSalida: nivel.unidadSalida,
          unidadTiempo: nivel.unidadTiempo,
        };
        warnings.push(
          ...productividad.warnings.map(
            (warning) => `${item.label} ${item.pasoPlantilla?.nombre ?? item.reglaId} (${nivel.nombre}): ${warning}`,
          ),
        );
      } else {
        const maquina = nivel.maquinaId ? checklistNivelMaquinaById.get(nivel.maquinaId) ?? null : null;
        const perfil = nivel.perfilOperativoId ? checklistNivelPerfilById.get(nivel.perfilOperativoId) ?? null : null;
        const setupBase = Number(nivel.setupMin ?? this.getSetupFromPerfilOperativo(perfil) ?? 0);
        const cleanupBase = Number(nivel.cleanupMin ?? 0);
        const timingOverride = this.calculateTerminatingOperationTiming({
          operacion: {
            maquina,
            perfilOperativo: perfil,
          },
          cantidad,
          pliegos,
          setupMinBase: setupBase,
          cleanupMinBase: cleanupBase,
          tiempoFijoMinBase: 0,
          cantidadObjetivoSalida: quantityByUnidad,
          varianteAnchoMm: Number(variante.anchoMm),
          varianteAltoMm: Number(variante.altoMm),
        });
        if (timingOverride) {
          setupMin = timingOverride.setupMin;
          cleanupMin = timingOverride.cleanupMin;
          tiempoFijoMin = timingOverride.tiempoFijoMin;
          runMin = timingOverride.runMin;
          sourceProductividad = 'nivel_variable_perfil';
          detalleTecnico = {
            ...detalleTecnico,
            sourceProductividad,
            maquina: maquina?.nombre ?? null,
            perfilOperativo: perfil?.nombre ?? null,
            ...(timingOverride.trace ?? {}),
          };
          if (timingOverride.warnings?.length) {
            warnings.push(
              ...timingOverride.warnings.map(
                (warning) => `${item.label} ${item.pasoPlantilla?.nombre ?? item.reglaId} (${nivel.nombre}): ${warning}`,
              ),
            );
          }
        } else {
          const productividadBase =
            perfil?.productivityValue
              ? Number(perfil.productivityValue)
              : item.pasoPlantilla?.productividadBase
                ? Number(item.pasoPlantilla.productividadBase)
                : 0;
          if (productividadBase > 0) {
            const productividad = evaluateProductividad({
              modoProductividad: ModoProductividadProceso.FIJA,
              productividadBase: new Prisma.Decimal(productividadBase),
              reglaVelocidadJson: null,
              reglaMermaJson: null,
              runMin: null,
              unidadTiempo: item.pasoPlantilla?.unidadTiempo ?? UnidadProceso.MINUTO,
              mermaRunPct: null,
              mermaSetup: null,
              cantidadObjetivoSalida: quantityByUnidad,
              contexto: {
                cantidad,
                pliegos,
                areaPiezaM2,
                areaPliegoM2,
                a4EqFactor,
              },
            });
            setupMin = setupBase;
            cleanupMin = cleanupBase;
            runMin = productividad.runMin;
            sourceProductividad = 'nivel_variable_perfil';
            detalleTecnico = {
              ...detalleTecnico,
              sourceProductividad,
              maquina: maquina?.nombre ?? null,
              perfilOperativo: perfil?.nombre ?? null,
              cantidadObjetivoSalida: quantityByUnidad,
              productividadAplicada: productividad.productividadAplicada,
            };
          }
        }
      }

      const totalMin = Number((setupMin + runMin + cleanupMin + tiempoFijoMin).toFixed(4));
      if (totalMin <= 0) {
        continue;
      }
      const costoNivel = Number(tarifa.mul(totalMin / 60).toFixed(6));
      costoAdicionalesCostEffects += costoNivel;
      costosPorEfecto.push({
        origen: 'ConfiguradorVariante',
        reglaId: item.reglaId,
        variantePasoId: nivel.id,
        variantePasoNombre: nivel.nombre,
        tiempoMin: totalMin,
        monto: costoNivel,
      });
      const insertionKey = `${item.insertion.modo}:${item.insertion.pasoPlantillaId ?? 'append'}`;
      const insertionCount = checklistInsertionCounts.get(insertionKey) ?? 0;
      checklistInsertionCounts.set(insertionKey, insertionCount + 1);
      const anchorOrder = item.insertion.pasoPlantillaId
        ? ordenRutaBaseByPasoPlantillaId.get(item.insertion.pasoPlantillaId) ?? null
        : null;
      let ordenPaso = pasos.length + 1;
      if (
        item.insertion.modo === TipoInsercionRouteEffectDto.before_step &&
        anchorOrder !== null
      ) {
        ordenPaso = anchorOrder - 0.49 + insertionCount * 0.01;
      } else if (
        item.insertion.modo === TipoInsercionRouteEffectDto.after_step &&
        anchorOrder !== null
      ) {
        ordenPaso = anchorOrder + 0.49 + insertionCount * 0.01;
      } else if (
        (item.insertion.modo === TipoInsercionRouteEffectDto.before_step ||
          item.insertion.modo === TipoInsercionRouteEffectDto.after_step) &&
        anchorOrder === null
      ) {
        warnings.push(
          `${item.label}: no se encontró el paso de referencia para "${item.pasoPlantilla?.nombre ?? item.reglaId}". Se insertó al final.`,
        );
      }
      pasos.push({
        orden: ordenPaso,
        codigo: `CHK-LVL-${item.reglaId.slice(0, 6).toUpperCase()}`,
        nombre: `${item.pasoPlantilla?.nombre ?? 'Paso configurador'} (${nivel.nombre})`,
        centroCostoId: centroId,
        centroCostoNombre: item.pasoPlantilla?.centroCosto?.nombre ?? 'Configurador',
        origen: 'Configurador',
        addonId: null,
        setupMin: Number(setupMin.toFixed(4)),
        runMin: Number(runMin.toFixed(4)),
        cleanupMin: Number(cleanupMin.toFixed(4)),
        tiempoFijoMin: Number(tiempoFijoMin.toFixed(4)),
        totalMin,
        tarifaHora: Number(tarifa),
        costo: costoNivel,
        detalleTecnico,
      });
      if (item.pasoPlantilla?.id) {
        ordenRutaBaseByPasoPlantillaId.set(item.pasoPlantilla.id, ordenPaso);
      }
    }

    for (const item of checklistReglasActivas) {
      if (item.regla.accion !== TipoProductoChecklistReglaAccion.COSTO_EXTRA) {
        continue;
      }
      const regla = item.regla.costoRegla;
      const valor = Number(item.regla.costoValor ?? 0);
      if (!regla || !Number.isFinite(valor) || valor === 0) {
        continue;
      }
      let monto = 0;
      if (regla === ReglaCostoChecklist.FLAT) {
        monto = valor;
      } else if (regla === ReglaCostoChecklist.POR_UNIDAD) {
        monto = valor * cantidad;
      } else if (regla === ReglaCostoChecklist.POR_PLIEGO) {
        monto = valor * pliegos;
      } else if (regla === ReglaCostoChecklist.PORCENTAJE_SOBRE_TOTAL) {
        const base =
          costoPapel +
          costoToner +
          costoDesgaste +
          costoConsumiblesTerminacion +
          costoProcesos +
          costoAdicionalesMateriales +
          costoAdicionalesCostEffects;
        monto = base * (valor / 100);
      } else if (regla === ReglaCostoChecklist.TIEMPO_MIN) {
        const centroId = item.regla.costoCentroCostoId ?? item.pasoPlantilla?.centroCostoId ?? null;
        if (!centroId) {
          warnings.push('Configurador: COSTO_EXTRA TIEMPO_MIN sin centro de costo.');
          continue;
        }
        const tarifa = tarifaByCentro.get(centroId);
        if (!tarifa) {
          warnings.push('Configurador: sin tarifa publicada para COSTO_EXTRA TIEMPO_MIN.');
          continue;
        }
        monto = Number(tarifa.mul(valor / 60).toFixed(6));
      }
      const montoRounded = Number(monto.toFixed(6));
      if (montoRounded === 0) continue;
      costoAdicionalesCostEffects += montoRounded;
      costosPorEfecto.push({
        origen: 'ConfiguradorCosto',
        reglaId: item.regla.id,
        regla: regla.toLowerCase(),
        monto: montoRounded,
      });
      pasos.push({
        orden: pasos.length + 1,
        codigo: `CHK-COST-${item.regla.id.slice(0, 6).toUpperCase()}`,
        nombre: 'Ajuste costo configurador',
        centroCostoId: item.regla.costoCentroCostoId ?? item.pasoPlantilla?.centroCostoId ?? 'N/A',
        centroCostoNombre:
          item.regla.costoCentroCosto?.nombre ??
          item.pasoPlantilla?.centroCosto?.nombre ??
          'Configurador',
        origen: 'Configurador',
        addonId: null,
        setupMin: 0,
        runMin: 0,
        cleanupMin: 0,
        tiempoFijoMin: 0,
        totalMin: 0,
        tarifaHora: 0,
        costo: montoRounded,
        detalleTecnico: {
          sourceProductividad: 'checklist',
          reglaId: item.regla.id,
        },
      });
    }

    for (const item of checklistReglasActivas) {
      if (item.regla.accion !== TipoProductoChecklistReglaAccion.MATERIAL_EXTRA) {
        continue;
      }
      if (!item.regla.materiaPrimaVariante || !item.regla.tipoConsumo || !item.regla.factorConsumo) {
        continue;
      }
      const baseQty =
        item.regla.tipoConsumo === TipoConsumoAdicionalMaterial.POR_PLIEGO
          ? pliegos
          : item.regla.tipoConsumo === TipoConsumoAdicionalMaterial.POR_M2
            ? areaPliegoM2 * pliegos
            : cantidad;
      const factorConsumo = Number(item.regla.factorConsumo);
      const mermaFactor = 1 + Number(item.regla.mermaPct ?? 0) / 100;
      const consumo = factorConsumo * baseQty * mermaFactor;
      const costoUnit = Number(item.regla.materiaPrimaVariante.precioReferencia ?? 0);
      const costo = Number((consumo * costoUnit).toFixed(6));
      costoAdicionalesMateriales += costo;
      materiales.push({
        tipo: 'CHECKLIST_MATERIAL',
        nombre: item.regla.materiaPrimaVariante.materiaPrima.nombre,
        sku: item.regla.materiaPrimaVariante.sku,
        cantidad: Number(consumo.toFixed(6)),
        costoUnitario: Number(costoUnit.toFixed(6)),
        costo,
        origen: 'Configurador',
      });
    }

    const pasosNormalizados = [...pasos]
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
      .map((paso, index) => ({
        ...paso,
        orden: index + 1,
      }));

    const total = Number(
      (
        costoPapel +
        costoToner +
        costoDesgaste +
        costoConsumiblesTerminacion +
        costoProcesos +
        costoAdicionalesCostEffects +
        costoAdicionalesMateriales
      ).toFixed(6),
    );
    const unitario = Number((total / cantidad).toFixed(6));

    const result = {
      varianteId: variante.id,
      productoServicioId: variante.productoServicioId,
      productoNombre: variante.productoServicio.nombre,
      varianteNombre: variante.nombre,
      motorCodigo: motor.code,
      motorVersion: motor.version,
      periodo,
      cantidad,
      piezasPorPliego: imposicion.piezasPorPliego,
      pliegos,
      warnings,
      bloques: {
        procesos: pasosNormalizados,
        materiales,
      },
      subtotales: {
        procesos: Number(costoProcesos.toFixed(6)),
        papel: Number(costoPapel.toFixed(6)),
        toner: Number(costoToner.toFixed(6)),
        desgaste: Number(costoDesgaste.toFixed(6)),
        consumiblesTerminacion: Number(costoConsumiblesTerminacion.toFixed(6)),
        adicionalesMateriales: Number(costoAdicionalesMateriales.toFixed(6)),
        adicionalesCostEffects: Number(costoAdicionalesCostEffects.toFixed(6)),
      },
      total,
      unitario,
      trazabilidad: {
        imposicion,
        conversionPapel,
        matchingBaseAplicado: matchingBaseAplicado.map((item) => ({
          pasoPlantillaId: item.pasoPlantilla.id,
          pasoPlantillaNombre: item.pasoPlantilla.nombre,
          perfilOperativoId: item.perfilOperativo.id,
          perfilOperativoNombre: item.perfilOperativo.nombre,
          tipoImpresion: item.tipoImpresion ? this.fromTipoImpresion(item.tipoImpresion) : null,
          caras: item.caras ? this.fromCaras(item.caras) : null,
        })),
        checklistAplicado: checklistAplicadoTrace,
        checklistRespuestasSeleccionadas: checklistRespuestasInput,
        atributosTecnicosConfigurados: Array.from(atributosTecnicosSeleccionados.entries()).map(
          ([dimension, value]) => ({
            dimension: this.fromDimensionOpcionProductiva(dimension),
            valor: this.fromValorOpcionProductiva(value),
          }),
        ),
        opcionProductivaEfectiva: Array.from(opcionProductivaEfectiva.entries()).map(([dimension, values]) => ({
          dimension: this.fromDimensionOpcionProductiva(dimension),
          valores: Array.from(values).map((value) => this.fromValorOpcionProductiva(value)),
        })),
        efectosAplicados: efectosAplicados.map((item) => ({
          id: item.id,
          addonId: item.productoAdicionalId,
          addonNombre: addonById.get(item.productoAdicionalId)?.productoAdicional?.nombre ?? '',
          tipo: this.fromTipoAdicionalEfecto(item.tipo),
          nombre: item.nombre,
        })),
        routeEffectsAplicados: routeEffectsAplicados.map((item) => ({
          id: item.id,
          addonId: item.productoAdicionalId,
          nombre: item.nombre,
          pasos: item.routeEffect?.pasos.length ?? 0,
          insertion: this.parseRouteEffectInsertion(item.routeEffect?.detalleJson ?? null),
        })),
        costEffectsAplicados: costEffectsAplicados.map((item) => ({
          id: item.id,
          addonId: item.productoAdicionalId,
          nombre: item.nombre,
          regla: item.costEffect ? this.fromReglaCostoAdicionalEfecto(item.costEffect.regla) : null,
        })),
        materialEffectsAplicados: materialEffectsAplicados.map((item) => ({
          id: item.id,
          addonId: item.productoAdicionalId,
          nombre: item.nombre,
          material: item.materialEffect?.materiaPrimaVariante.materiaPrima.nombre ?? '',
        })),
        costosPorEfecto,
        pasosCondicionalesActivos: pasosNormalizados
          .filter((item) => item.addonId)
          .map((item) => ({
            pasoCodigo: item.codigo,
            addonId: item.addonId,
          })),
        config,
        configVersionBase,
        configVersionOverride,
      },
    };

    const snapshot = await this.prisma.cotizacionProductoSnapshot.create({
      data: {
        tenantId: auth.tenantId,
        productoVarianteId: variante.id,
        motorCodigo: motor.code,
        motorVersion: motor.version,
        configVersionBase,
        configVersionOverride,
        cantidad,
        periodoTarifa: periodo,
        inputJson: ({
          cantidad,
          periodo,
          config,
          checklistRespuestas: checklistRespuestasInput,
        } as unknown) as Prisma.InputJsonValue,
        resultadoJson: (result as unknown) as Prisma.InputJsonValue,
        total: new Prisma.Decimal(total),
        checklistRespuestas: checklistRespuestasInput.length
          ? {
              create: checklistRespuestasInput.map((item) => ({
                tenantId: auth.tenantId,
                productoVarianteId: variante.id,
                preguntaId: item.preguntaId,
                respuestaId: item.respuestaId,
                nivelId: null,
              })),
            }
          : undefined,
      },
    });

    return {
      snapshotId: snapshot.id,
      ...result,
      createdAt: snapshot.createdAt.toISOString(),
    };
  }

  async previewVarianteImposicion(
    auth: CurrentAuth,
    varianteId: string,
    payload: PreviewImposicionProductoVarianteDto,
  ) {
    const variante = await this.findVarianteCompletaOrThrow(auth, varianteId, this.prisma);
    if (!variante.papelVariante) {
      throw new BadRequestException('La variante no tiene papel/sustrato asignado.');
    }
    const procesoDefinicionId = this.resolveRutaEfectivaId(variante);
    if (!procesoDefinicionId) {
      throw new BadRequestException('No hay ruta de producción efectiva para la variante seleccionada.');
    }

    const motor = this.resolveMotorOrThrow(
      variante.productoServicio.motorCodigo,
      variante.productoServicio.motorVersion,
    );
    const { config: persisted } = await this.getEffectiveMotorConfig(
      auth,
      variante.productoServicio.id,
      variante.id,
      motor,
    );
    const config = this.mergeMotorConfig(persisted as Prisma.JsonValue, payload.parametros ?? {});
    const proceso = await this.findProcesoConOperacionesOrThrow(auth, procesoDefinicionId, this.prisma);
    const sustratoDims = this.resolvePapelDimensionesMm(variante.papelVariante.atributosVarianteJson);
    const pliegoImpresion = this.resolvePliegoImpresion(config, sustratoDims);
    const machineMargins = this.resolveMachineMarginsMm(proceso.operaciones);
    const imposicion = this.calculateImposicion({
      varianteAnchoMm: Number(variante.anchoMm),
      varianteAltoMm: Number(variante.altoMm),
      sheetAnchoMm: pliegoImpresion.anchoMm,
      sheetAltoMm: pliegoImpresion.altoMm,
      machineMargins,
      config,
    });
    const conversionPapel = this.calculateSustratoToPliegoConversion({
      sustrato: sustratoDims,
      pliegoImpresion,
    });

    return {
      varianteId: variante.id,
      varianteNombre: variante.nombre,
      pliegoImpresion,
      sustrato: sustratoDims,
      machineMargins,
      imposicion,
      conversionPapel,
      config,
    };
  }

  async getVarianteCotizaciones(auth: CurrentAuth, varianteId: string) {
    await this.findVarianteOrThrow(auth, varianteId, this.prisma);

    const rows = await this.prisma.cotizacionProductoSnapshot.findMany({
      where: {
        tenantId: auth.tenantId,
        productoVarianteId: varianteId,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return rows.map((item) => ({
      id: item.id,
      cantidad: item.cantidad,
      periodoTarifa: item.periodoTarifa,
      motorCodigo: item.motorCodigo,
      motorVersion: item.motorVersion,
      configVersionBase: item.configVersionBase,
      configVersionOverride: item.configVersionOverride,
      total: Number(item.total),
      unitario: Number(item.total.div(item.cantidad)),
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async getCotizacionById(auth: CurrentAuth, snapshotId: string) {
    const item = await this.prisma.cotizacionProductoSnapshot.findFirst({
      where: {
        tenantId: auth.tenantId,
        id: snapshotId,
      },
    });

    if (!item) {
      throw new NotFoundException('Snapshot de cotizacion no encontrado.');
    }

    return {
      id: item.id,
      cantidad: item.cantidad,
      periodoTarifa: item.periodoTarifa,
      motorCodigo: item.motorCodigo,
      motorVersion: item.motorVersion,
      configVersionBase: item.configVersionBase,
      configVersionOverride: item.configVersionOverride,
      total: Number(item.total),
      resultado: item.resultadoJson,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private async validateProductoRelations(
    auth: CurrentAuth,
    payload: UpsertProductoServicioDto,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    await this.findFamiliaOrThrow(auth, payload.familiaProductoId, tx);
    if (payload.subfamiliaProductoId) {
      const sub = await this.findSubfamiliaOrThrow(auth, payload.subfamiliaProductoId, tx);
      if (sub.familiaProductoId !== payload.familiaProductoId) {
        throw new BadRequestException('La subfamilia no pertenece a la familia seleccionada.');
      }
    }
  }

  private async findFamiliaOrThrow(
    auth: CurrentAuth,
    id: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const familia = await tx.familiaProducto.findFirst({
      where: {
        tenantId: auth.tenantId,
        id,
      },
    });

    if (!familia) {
      throw new NotFoundException('Familia de producto no encontrada.');
    }

    return familia;
  }

  private async findSubfamiliaOrThrow(
    auth: CurrentAuth,
    id: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await tx.subfamiliaProducto.findFirst({
      where: {
        tenantId: auth.tenantId,
        id,
      },
      include: {
        familiaProducto: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Subfamilia de producto no encontrada.');
    }

    return item;
  }

  private async findProductoOrThrow(
    auth: CurrentAuth,
    id: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await tx.productoServicio.findFirst({
      where: {
        tenantId: auth.tenantId,
        id,
      },
      include: {
        familiaProducto: true,
        subfamiliaProducto: true,
        procesoDefinicionDefault: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Producto/servicio no encontrado.');
    }

    return item;
  }

  private async findVarianteOrThrow(
    auth: CurrentAuth,
    id: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await tx.productoVariante.findFirst({
      where: {
        tenantId: auth.tenantId,
        id,
      },
      include: {
        papelVariante: {
          include: {
            materiaPrima: true,
          },
        },
        procesoDefinicion: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Variante de producto no encontrada.');
    }

    return item;
  }

  private async findPapelVarianteOrThrow(
    auth: CurrentAuth,
    id: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await tx.materiaPrimaVariante.findFirst({
      where: {
        tenantId: auth.tenantId,
        id,
      },
      include: {
        materiaPrima: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Variante de materia prima no encontrada.');
    }

    return item;
  }

  private async findProcesoOrThrow(
    auth: CurrentAuth,
    id: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await tx.procesoDefinicion.findFirst({
      where: {
        tenantId: auth.tenantId,
        id,
      },
    });

    if (!item) {
      throw new NotFoundException('Ruta de produccion no encontrada.');
    }

    return item;
  }

  private async findProcesoOperacionOrThrow(
    auth: CurrentAuth,
    id: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await tx.procesoOperacion.findFirst({
      where: {
        tenantId: auth.tenantId,
        id,
      },
    });
    if (!item) {
      throw new NotFoundException('Paso de ruta no encontrado.');
    }
    return item;
  }

  private async findBibliotecaOperacionOrThrow(
    auth: CurrentAuth,
    id: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await tx.procesoOperacionPlantilla.findFirst({
      where: {
        tenantId: auth.tenantId,
        id,
      },
      include: {
        centroCosto: true,
        maquina: true,
        perfilOperativo: true,
      },
    });
    if (!item) {
      throw new NotFoundException('Paso de biblioteca no encontrado.');
    }
    return item;
  }

  private async findCentroCostoOrThrow(
    auth: CurrentAuth,
    id: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await tx.centroCosto.findFirst({
      where: {
        tenantId: auth.tenantId,
        id,
      },
    });
    if (!item) {
      throw new NotFoundException('Centro de costo no encontrado.');
    }
    return item;
  }

  private async findAdicionalCatalogoOrThrow(
    auth: CurrentAuth,
    id: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await tx.productoAdicionalCatalogo.findFirst({
      where: {
        tenantId: auth.tenantId,
        id,
      },
      include: {
        centroCosto: true,
        materiales: {
          include: {
            materiaPrimaVariante: {
              include: {
                materiaPrima: true,
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
        efectos: {
          include: this.getAdicionalEfectoInclude(),
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });
    if (!item) {
      throw new NotFoundException('Adicional no encontrado.');
    }
    return item;
  }

  private async getAdicionalCatalogoByIdOrThrow(
    auth: CurrentAuth,
    adicionalId: string,
  ) {
    const item = await this.findAdicionalCatalogoOrThrow(auth, adicionalId, this.prisma);
    return this.toAdicionalCatalogoResponse(item);
  }

  private async validateAdicionalPayload(
    auth: CurrentAuth,
    payload: UpsertProductoAdicionalDto,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    if (!payload.nombre.trim()) {
      throw new BadRequestException('El nombre del adicional es obligatorio.');
    }
    if (
      payload.tipo === TipoProductoAdicionalDto.servicio &&
      payload.metodoCosto !== MetodoCostoProductoAdicionalDto.time_only
    ) {
      throw new BadRequestException('Los adicionales de tipo servicio solo admiten productividad por tiempo.');
    }
    if (payload.tipo === TipoProductoAdicionalDto.servicio && payload.materiales.length > 0) {
      throw new BadRequestException('Los adicionales de tipo servicio no admiten materiales.');
    }
    if (!payload.materiales.length && payload.metodoCosto === MetodoCostoProductoAdicionalDto.time_plus_material) {
      throw new BadRequestException('El método TIME_PLUS_MATERIAL requiere al menos un material activo.');
    }
    if (payload.centroCostoId) {
      await this.findCentroCostoOrThrow(auth, payload.centroCostoId, tx);
    }
    const materialIds = new Set<string>();
    for (const material of payload.materiales) {
      if (material.factorConsumo < 0) {
        throw new BadRequestException('El factor de consumo no puede ser negativo.');
      }
      if (material.mermaPct !== undefined && (material.mermaPct < 0 || material.mermaPct > 100)) {
        throw new BadRequestException('La merma del material debe estar entre 0 y 100.');
      }
      if (materialIds.has(material.materiaPrimaVarianteId)) {
        throw new BadRequestException('No se permiten materiales duplicados en un adicional.');
      }
      materialIds.add(material.materiaPrimaVarianteId);
      await this.findPapelVarianteOrThrow(auth, material.materiaPrimaVarianteId, tx);
    }
  }

  private getAdicionalEfectoInclude() {
    return {
      scopes: {
        orderBy: [{ createdAt: 'asc' }],
      },
      routeEffect: {
        include: {
          pasos: {
            include: {
              centroCosto: true,
              maquina: true,
              perfilOperativo: true,
            },
            orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
      costEffect: {
        include: {
          centroCosto: true,
        },
      },
      materialEffect: {
        include: {
          materiaPrimaVariante: {
            include: {
              materiaPrima: true,
            },
          },
        },
      },
    } satisfies Prisma.ProductoAdicionalEfectoInclude;
  }

  private parseServicioPricing(metadata: Prisma.JsonValue | null | undefined): ServicioPricingConfig {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return { niveles: [], reglas: [] };
    }
    const servicePricing = (metadata as Record<string, unknown>).servicePricing;
    if (!servicePricing || typeof servicePricing !== 'object' || Array.isArray(servicePricing)) {
      return { niveles: [], reglas: [] };
    }
    const raw = servicePricing as Record<string, unknown>;
    const nivelesRaw = Array.isArray(raw.niveles) ? raw.niveles : [];
    const reglasRaw = Array.isArray(raw.reglas) ? raw.reglas : [];
    const niveles: ServicioPricingNivel[] = nivelesRaw
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      .map((item, index) => ({
        id: String(item.id ?? randomUUID()),
        nombre: String(item.nombre ?? `Nivel ${index + 1}`).trim() || `Nivel ${index + 1}`,
        orden: Number(item.orden ?? index + 1),
        activo: item.activo !== false,
      }))
      .sort((a, b) => a.orden - b.orden);
    const reglas: ServicioPricingRegla[] = reglasRaw
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      .map((item) => ({
        id: String(item.id ?? randomUUID()),
        nivelId: String(item.nivelId ?? ''),
        tiempoMin: Number(item.tiempoMin ?? item.valor ?? 0),
      }))
      .filter((item) => item.nivelId.length > 0);
    return { niveles, reglas };
  }

  private normalizeRouteEffectInsertionPayload(
    insertion: { modo?: TipoInsercionRouteEffectDto; pasoPlantillaId?: string } | null | undefined,
  ): RouteEffectInsertionConfig {
    const modo =
      insertion?.modo === TipoInsercionRouteEffectDto.before_step ||
      insertion?.modo === TipoInsercionRouteEffectDto.after_step
        ? insertion.modo
        : TipoInsercionRouteEffectDto.append;
    const pasoPlantillaId =
      typeof insertion?.pasoPlantillaId === 'string' && insertion.pasoPlantillaId.trim().length
        ? insertion.pasoPlantillaId.trim()
        : null;
    return { modo, pasoPlantillaId };
  }

  private parseRouteEffectInsertion(detalleJson: Prisma.JsonValue | null | undefined): RouteEffectInsertionConfig {
    const detalle = this.asObject(detalleJson);
    const insertionRaw =
      detalle.insertion && typeof detalle.insertion === 'object' && !Array.isArray(detalle.insertion)
        ? (detalle.insertion as Record<string, unknown>)
        : {};
    const modo =
      insertionRaw.modo === TipoInsercionRouteEffectDto.before_step ||
      insertionRaw.modo === TipoInsercionRouteEffectDto.after_step
        ? insertionRaw.modo
        : TipoInsercionRouteEffectDto.append;
    const pasoPlantillaId =
      typeof insertionRaw.pasoPlantillaId === 'string' && insertionRaw.pasoPlantillaId.trim().length
        ? insertionRaw.pasoPlantillaId.trim()
        : null;
    return { modo, pasoPlantillaId };
  }

  private parseChecklistRouteInsertion(
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ): RouteEffectInsertionConfig {
    const detalle = this.asObject(detalleJson);
    const raw =
      detalle.routeInsertion && typeof detalle.routeInsertion === 'object' && !Array.isArray(detalle.routeInsertion)
        ? (detalle.routeInsertion as Record<string, unknown>)
        : {};
    const modo =
      raw.modo === TipoInsercionRouteEffectDto.before_step ||
      raw.modo === TipoInsercionRouteEffectDto.after_step
        ? raw.modo
        : TipoInsercionRouteEffectDto.append;
    const pasoPlantillaId =
      typeof raw.pasoPlantillaId === 'string' && raw.pasoPlantillaId.trim().length
        ? raw.pasoPlantillaId.trim()
        : null;
    return {
      modo,
      pasoPlantillaId,
    };
  }

  private getChecklistRouteOrden(
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ) {
    const detalle = this.asObject(detalleJson);
    const raw =
      detalle.routeInsertion && typeof detalle.routeInsertion === 'object' && !Array.isArray(detalle.routeInsertion)
        ? (detalle.routeInsertion as Record<string, unknown>)
        : {};
    return typeof raw.orden === 'number' && Number.isFinite(raw.orden) ? raw.orden : 0;
  }

  private normalizeServicioPricingPayload(payload: UpsertProductoAdicionalServicioPricingDto): ServicioPricingConfig {
    if (!payload.niveles.length) {
      throw new BadRequestException('Debes configurar al menos un nivel.');
    }
    const niveles: ServicioPricingNivel[] = payload.niveles.map((item, index) => ({
      id: item.id?.trim() || randomUUID(),
      nombre: item.nombre.trim(),
      orden: item.orden ?? index + 1,
      activo: item.activo ?? true,
    }));
    const nivelIds = new Set(niveles.map((item) => item.id));
    const reglas: ServicioPricingRegla[] = payload.reglas.map((item) => {
      if (!nivelIds.has(item.nivelId)) {
        throw new BadRequestException('Una regla de costo referencia un nivel inexistente.');
      }
      return {
        id: randomUUID(),
        nivelId: item.nivelId,
        tiempoMin: Number(item.tiempoMin),
      };
    });
    const reglasByNivel = new Map<string, number>();
    for (const regla of reglas) {
      reglasByNivel.set(regla.nivelId, (reglasByNivel.get(regla.nivelId) ?? 0) + 1);
    }
    for (const [nivelId, count] of reglasByNivel.entries()) {
      if (count > 1) {
        throw new BadRequestException(`El nivel ${nivelId} tiene más de una regla de costo.`);
      }
    }
    return {
      niveles: niveles.sort((a, b) => a.orden - b.orden),
      reglas,
    };
  }

  private async findAdicionalEfectoOrThrow(
    auth: CurrentAuth,
    adicionalId: string,
    efectoId: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await tx.productoAdicionalEfecto.findFirst({
      where: {
        tenantId: auth.tenantId,
        id: efectoId,
        productoAdicionalId: adicionalId,
      },
      include: this.getAdicionalEfectoInclude(),
    });
    if (!item) {
      throw new NotFoundException('Efecto de adicional no encontrado.');
    }
    return item;
  }

  private async getAdicionalEfectoByIdOrThrow(
    auth: CurrentAuth,
    adicionalId: string,
    efectoId: string,
  ) {
    const item = await this.findAdicionalEfectoOrThrow(auth, adicionalId, efectoId, this.prisma);
    return this.toAdicionalEfectoResponse(item);
  }

  private async validateAdicionalEfectoPayload(
    auth: CurrentAuth,
    payload: UpsertProductoAdicionalEfectoDto,
    adicionalTipo: TipoProductoAdicional,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    if (payload.tipo === TipoProductoAdicionalEfectoDto.route_effect && !payload.routeEffect) {
      throw new BadRequestException('El tipo route_effect requiere definir pasos.');
    }
    if (payload.tipo === TipoProductoAdicionalEfectoDto.cost_effect && !payload.costEffect) {
      throw new BadRequestException('El tipo cost_effect requiere una regla de costo.');
    }
    if (payload.tipo === TipoProductoAdicionalEfectoDto.material_effect && !payload.materialEffect) {
      throw new BadRequestException('El tipo material_effect requiere consumo de material.');
    }
    if (payload.scopes?.length) {
      for (const scope of payload.scopes) {
        if (scope.varianteId) {
          await this.findVarianteOrThrow(auth, scope.varianteId, tx);
        }
        if ((scope.dimension && !scope.valor) || (!scope.dimension && scope.valor)) {
          throw new BadRequestException('Scope inválido: dimension y valor deben informarse juntos.');
        }
        if (scope.dimension && scope.valor) {
          this.assertScopeDimensionMatchesValue(scope.dimension, scope.valor);
        }
      }
    }
    if (payload.routeEffect?.pasos?.length) {
      const insertion = this.normalizeRouteEffectInsertionPayload(payload.routeEffect.insertion);
      if (
        insertion.modo !== TipoInsercionRouteEffectDto.append &&
        !insertion.pasoPlantillaId
      ) {
        throw new BadRequestException(
          'La inserción de Regla de pasos requiere indicar un paso de referencia.',
        );
      }
      for (const paso of payload.routeEffect.pasos) {
        await this.findCentroCostoOrThrow(auth, paso.centroCostoId, tx);
        const usarMaquinariaTerminacion =
          paso.usarMaquinariaTerminacion ?? Boolean(paso.maquinaId || paso.perfilOperativoId);

        if (adicionalTipo === TipoProductoAdicional.SERVICIO && usarMaquinariaTerminacion) {
          throw new BadRequestException(
            'Un adicional de tipo servicio no puede usar maquinaria de terminación en la Regla de pasos.',
          );
        }
        if (!usarMaquinariaTerminacion) {
          continue;
        }

        if (!paso.maquinaId || !paso.perfilOperativoId) {
          throw new BadRequestException(
            'Cuando "usarMaquinariaTerminacion" está activo, maquinaId y perfilOperativoId son obligatorios.',
          );
        }

        const maquina = await tx.maquina.findFirst({
          where: { tenantId: auth.tenantId, id: paso.maquinaId },
          select: { id: true, plantilla: true },
        });
        if (!maquina) {
          throw new NotFoundException('Máquina no encontrada para un paso del route_effect.');
        }
        if (!this.isPlantillaTerminacionSoportada(maquina.plantilla)) {
          throw new BadRequestException(
            'La máquina seleccionada no corresponde a una plantilla de terminación soportada.',
          );
        }

        const perfil = await tx.maquinaPerfilOperativo.findFirst({
          where: {
            tenantId: auth.tenantId,
            id: paso.perfilOperativoId,
            maquinaId: maquina.id,
          },
          select: { id: true },
        });
        if (!perfil) {
          throw new BadRequestException(
            'El perfil operativo seleccionado no pertenece a la máquina indicada.',
          );
        }
      }
    }
    if (payload.costEffect) {
      if (
        payload.costEffect.regla === ReglaCostoAdicionalEfectoDto.porcentaje_sobre_total &&
        (payload.costEffect.valor < 0 || payload.costEffect.valor > 100)
      ) {
        throw new BadRequestException('La regla porcentaje_sobre_total debe estar entre 0 y 100.');
      }
      if (payload.costEffect.regla === ReglaCostoAdicionalEfectoDto.tiempo_extra_min && payload.costEffect.valor < 0) {
        throw new BadRequestException('tiempo_extra_min no puede ser negativo.');
      }
      if (payload.costEffect.centroCostoId) {
        await this.findCentroCostoOrThrow(auth, payload.costEffect.centroCostoId, tx);
      }
    }
    if (payload.materialEffect) {
      await this.findPapelVarianteOrThrow(auth, payload.materialEffect.materiaPrimaVarianteId, tx);
      if (payload.materialEffect.factorConsumo < 0) {
        throw new BadRequestException('factorConsumo no puede ser negativo.');
      }
      if (
        payload.materialEffect.mermaPct !== undefined &&
        (payload.materialEffect.mermaPct < 0 || payload.materialEffect.mermaPct > 100)
      ) {
        throw new BadRequestException('La merma del material debe estar entre 0 y 100.');
      }
    }
  }

  private resolveAdicionalEfectoNombre(payload: UpsertProductoAdicionalEfectoDto) {
    const provided = payload.nombre?.trim();
    if (provided) return provided;
    if (payload.tipo === TipoProductoAdicionalEfectoDto.route_effect) return 'Regla de pasos';
    if (payload.tipo === TipoProductoAdicionalEfectoDto.cost_effect) return 'Regla de costo';
    return 'Consumo de materiales';
  }

  private async assertSingleAddonEffectTypeConstraint(
    auth: CurrentAuth,
    adicionalId: string,
    tipo: TipoProductoAdicionalEfectoDto,
    excludeEffectId: string | undefined,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const isSingleType =
      tipo === TipoProductoAdicionalEfectoDto.route_effect ||
      tipo === TipoProductoAdicionalEfectoDto.cost_effect;
    if (!isSingleType) {
      return;
    }
    const existing = await tx.productoAdicionalEfecto.findFirst({
      where: {
        tenantId: auth.tenantId,
        productoAdicionalId: adicionalId,
        tipo: this.toTipoAdicionalEfecto(tipo),
        ...(excludeEffectId ? { id: { not: excludeEffectId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        tipo === TipoProductoAdicionalEfectoDto.route_effect
          ? 'Solo se permite una Regla de pasos por adicional.'
          : 'Solo se permite una Regla de costo por adicional.',
      );
    }
  }

  private async replaceAdicionalEfectoDetail(
    auth: CurrentAuth,
    tx: Prisma.TransactionClient,
    efectoId: string,
    payload: UpsertProductoAdicionalEfectoDto,
  ) {
    await tx.productoAdicionalEfectoScope.deleteMany({
      where: {
        tenantId: auth.tenantId,
        productoAdicionalEfectoId: efectoId,
      },
    });
    await tx.productoAdicionalRouteEffectPaso.deleteMany({
      where: {
        tenantId: auth.tenantId,
        productoAdicionalRouteEffect: {
          productoAdicionalEfectoId: efectoId,
        },
      },
    });
    await tx.productoAdicionalRouteEffect.deleteMany({
      where: {
        tenantId: auth.tenantId,
        productoAdicionalEfectoId: efectoId,
      },
    });
    await tx.productoAdicionalCostEffect.deleteMany({
      where: {
        tenantId: auth.tenantId,
        productoAdicionalEfectoId: efectoId,
      },
    });
    await tx.productoAdicionalMaterialEffect.deleteMany({
      where: {
        tenantId: auth.tenantId,
        productoAdicionalEfectoId: efectoId,
      },
    });
    if (payload.scopes?.length) {
      await tx.productoAdicionalEfectoScope.createMany({
        data: payload.scopes.map((scope) => ({
          tenantId: auth.tenantId,
          productoAdicionalEfectoId: efectoId,
          productoVarianteId: scope.varianteId ?? null,
          dimension: scope.dimension ? this.toDimensionOpcionProductiva(scope.dimension) : null,
          valor: scope.valor ? this.toValorOpcionProductiva(scope.valor) : null,
        })),
      });
    }
    if (payload.tipo === TipoProductoAdicionalEfectoDto.route_effect && payload.routeEffect) {
      const insertion = this.normalizeRouteEffectInsertionPayload(payload.routeEffect.insertion);
      const route = await tx.productoAdicionalRouteEffect.create({
        data: {
          tenantId: auth.tenantId,
          productoAdicionalEfectoId: efectoId,
          detalleJson: {
            insertion,
          } as Prisma.InputJsonValue,
        },
      });
      await tx.productoAdicionalRouteEffectPaso.createMany({
        data: payload.routeEffect.pasos.map((paso, index) => ({
          ...(paso.usarMaquinariaTerminacion ?? Boolean(paso.maquinaId || paso.perfilOperativoId)
            ? {
                maquinaId: paso.maquinaId ?? null,
                perfilOperativoId: paso.perfilOperativoId ?? null,
              }
            : {
                maquinaId: null,
                perfilOperativoId: null,
              }),
          tenantId: auth.tenantId,
          productoAdicionalRouteEffectId: route.id,
          orden: paso.orden ?? index + 1,
          nombre: paso.nombre.trim(),
          tipoOperacion: TipoOperacionProceso.OTRO,
          centroCostoId: paso.centroCostoId,
          setupMin: paso.setupMin ?? null,
          runMin: paso.runMin ?? null,
          cleanupMin: paso.cleanupMin ?? null,
          tiempoFijoMin: paso.tiempoFijoMin ?? null,
          detalleJson: {
            usarMaquinariaTerminacion:
              paso.usarMaquinariaTerminacion ?? Boolean(paso.maquinaId || paso.perfilOperativoId),
            tiempoFijoMinFallback:
              paso.tiempoFijoMinFallback ?? paso.tiempoFijoMin ?? null,
            overridesProductividad: paso.overridesProductividad ?? null,
          } as Prisma.InputJsonValue,
        })),
      });
    }
    if (payload.tipo === TipoProductoAdicionalEfectoDto.cost_effect && payload.costEffect) {
      await tx.productoAdicionalCostEffect.create({
        data: {
          tenantId: auth.tenantId,
          productoAdicionalEfectoId: efectoId,
          regla: this.toReglaCostoAdicionalEfecto(payload.costEffect.regla),
          valor: payload.costEffect.valor,
          centroCostoId: payload.costEffect.centroCostoId ?? null,
          detalleJson: this.toNullableJson(payload.costEffect.detalle),
        },
      });
    }
    if (payload.tipo === TipoProductoAdicionalEfectoDto.material_effect && payload.materialEffect) {
      await tx.productoAdicionalMaterialEffect.create({
        data: {
          tenantId: auth.tenantId,
          productoAdicionalEfectoId: efectoId,
          materiaPrimaVarianteId: payload.materialEffect.materiaPrimaVarianteId,
          tipoConsumo: this.toTipoConsumoAdicionalMaterial(payload.materialEffect.tipoConsumo),
          factorConsumo: payload.materialEffect.factorConsumo,
          mermaPct: payload.materialEffect.mermaPct ?? null,
          detalleJson: this.toNullableJson(payload.materialEffect.detalle),
        },
      });
    }
  }

  private toAdicionalEfectoResponse(item: {
    id: string;
    productoAdicionalId: string;
    tipo: TipoProductoAdicionalEfecto;
    nombre: string;
    activo: boolean;
    createdAt: Date;
    updatedAt: Date;
    scopes: Array<{
      id: string;
      productoVarianteId: string | null;
      dimension: DimensionOpcionProductiva | null;
      valor: ValorOpcionProductiva | null;
    }>;
    routeEffect: {
      id: string;
      detalleJson: Prisma.JsonValue | null;
      pasos: Array<{
        id: string;
        orden: number;
        nombre: string;
        centroCostoId: string;
        centroCosto: { nombre: string };
        maquinaId: string | null;
        maquina: { nombre: string } | null;
        perfilOperativoId: string | null;
        perfilOperativo: { nombre: string } | null;
        setupMin: Prisma.Decimal | null;
        runMin: Prisma.Decimal | null;
        cleanupMin: Prisma.Decimal | null;
        tiempoFijoMin: Prisma.Decimal | null;
        detalleJson: Prisma.JsonValue | null;
      }>;
    } | null;
    costEffect: {
      id: string;
      regla: ReglaCostoAdicionalEfecto;
      valor: Prisma.Decimal;
      centroCostoId: string | null;
      centroCosto: { nombre: string } | null;
      detalleJson: Prisma.JsonValue | null;
    } | null;
    materialEffect: {
      id: string;
      materiaPrimaVarianteId: string;
      materiaPrimaVariante: {
        sku: string;
        materiaPrima: { nombre: string };
      };
      tipoConsumo: TipoConsumoAdicionalMaterial;
      factorConsumo: Prisma.Decimal;
      mermaPct: Prisma.Decimal | null;
      detalleJson: Prisma.JsonValue | null;
    } | null;
  }) {
    return {
      id: item.id,
      adicionalId: item.productoAdicionalId,
      tipo: this.fromTipoAdicionalEfecto(item.tipo),
      nombre: item.nombre,
      activo: item.activo,
      scopes: item.scopes.map((scope) => ({
        id: scope.id,
        varianteId: scope.productoVarianteId,
        dimension: scope.dimension ? this.fromDimensionOpcionProductiva(scope.dimension) : null,
        valor: scope.valor ? this.fromValorOpcionProductiva(scope.valor) : null,
      })),
      routeEffect: item.routeEffect
        ? {
            id: item.routeEffect.id,
            insertion: this.parseRouteEffectInsertion(item.routeEffect.detalleJson),
            pasos: item.routeEffect.pasos.map((paso) => ({
              ...(this.asObject(paso.detalleJson).usarMaquinariaTerminacion === true
                ? { usarMaquinariaTerminacion: true }
                : { usarMaquinariaTerminacion: false }),
              id: paso.id,
              orden: paso.orden,
              nombre: paso.nombre,
              centroCostoId: paso.centroCostoId,
              centroCostoNombre: paso.centroCosto.nombre,
              maquinaId: paso.maquinaId,
              maquinaNombre: paso.maquina?.nombre ?? '',
              perfilOperativoId: paso.perfilOperativoId,
              perfilOperativoNombre: paso.perfilOperativo?.nombre ?? '',
              setupMin: paso.setupMin === null ? null : Number(paso.setupMin),
              runMin: paso.runMin === null ? null : Number(paso.runMin),
              cleanupMin: paso.cleanupMin === null ? null : Number(paso.cleanupMin),
              tiempoFijoMin: paso.tiempoFijoMin === null ? null : Number(paso.tiempoFijoMin),
              tiempoFijoMinFallback:
                this.toSafeNumber(this.asObject(paso.detalleJson).tiempoFijoMinFallback, NaN) >= 0
                  ? this.toSafeNumber(this.asObject(paso.detalleJson).tiempoFijoMinFallback, 0)
                  : paso.tiempoFijoMin === null
                    ? null
                    : Number(paso.tiempoFijoMin),
              overridesProductividad: (() => {
                const overrides = this.asObject(this.asObject(paso.detalleJson).overridesProductividad);
                return Object.keys(overrides).length > 0 ? overrides : null;
              })(),
            })),
          }
        : null,
      costEffect: item.costEffect
        ? {
            id: item.costEffect.id,
            regla: this.fromReglaCostoAdicionalEfecto(item.costEffect.regla),
            valor: Number(item.costEffect.valor),
            centroCostoId: item.costEffect.centroCostoId,
            centroCostoNombre: item.costEffect.centroCosto?.nombre ?? '',
            detalle: (item.costEffect.detalleJson as Record<string, unknown> | null) ?? null,
          }
        : null,
      materialEffect: item.materialEffect
        ? {
            id: item.materialEffect.id,
            materiaPrimaVarianteId: item.materialEffect.materiaPrimaVarianteId,
            materiaPrimaNombre: item.materialEffect.materiaPrimaVariante.materiaPrima.nombre,
            materiaPrimaSku: item.materialEffect.materiaPrimaVariante.sku,
            tipoConsumo: this.fromTipoConsumoAdicionalMaterial(item.materialEffect.tipoConsumo),
            factorConsumo: Number(item.materialEffect.factorConsumo),
            mermaPct: item.materialEffect.mermaPct === null ? null : Number(item.materialEffect.mermaPct),
            detalle: (item.materialEffect.detalleJson as Record<string, unknown> | null) ?? null,
          }
        : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private isPlantillaTerminacionSoportada(plantilla: PlantillaMaquinaria) {
    return ProductosServiciosService.TERMINACION_PLANTILLAS_SOPORTADAS.has(plantilla);
  }

  private validateProductoChecklistPayload(payload: UpsertProductoChecklistDto) {
    const preguntaOrdenes = new Set<number>();
    for (const [preguntaIndex, pregunta] of payload.preguntas.entries()) {
      const ordenPregunta = pregunta.orden ?? preguntaIndex + 1;
      if (preguntaOrdenes.has(ordenPregunta)) {
        throw new BadRequestException('Hay preguntas con orden duplicado en el checklist.');
      }
      preguntaOrdenes.add(ordenPregunta);
      if (!pregunta.texto.trim()) {
        throw new BadRequestException('El texto de cada pregunta es obligatorio.');
      }
      if (pregunta.tipoPregunta === TipoChecklistPreguntaDto.binaria && pregunta.respuestas.length !== 2) {
        throw new BadRequestException('Las preguntas binarias deben tener exactamente dos respuestas.');
      }
      const respuestaOrdenes = new Set<number>();
      for (const [respuestaIndex, respuesta] of pregunta.respuestas.entries()) {
        const ordenRespuesta = respuesta.orden ?? respuestaIndex + 1;
        if (respuestaOrdenes.has(ordenRespuesta)) {
          throw new BadRequestException('Hay respuestas con orden duplicado dentro de una pregunta.');
        }
        respuestaOrdenes.add(ordenRespuesta);
        if (!respuesta.texto.trim()) {
          throw new BadRequestException('El texto de cada respuesta es obligatorio.');
        }
        const reglas = respuesta.reglas ?? [];
        const reglaOrdenes = new Set<number>();
        for (const [reglaIndex, regla] of reglas.entries()) {
          const ordenRegla = regla.orden ?? reglaIndex + 1;
          if (reglaOrdenes.has(ordenRegla)) {
            throw new BadRequestException('Hay reglas con orden duplicado dentro de una respuesta.');
          }
          reglaOrdenes.add(ordenRegla);
          if (regla.accion === TipoChecklistAccionReglaDto.activar_paso && !regla.pasoPlantillaId) {
            throw new BadRequestException('La regla ACTIVAR_PASO requiere pasoPlantillaId.');
          }
          if (
            regla.accion === TipoChecklistAccionReglaDto.seleccionar_variante_paso &&
            (!regla.pasoPlantillaId || !regla.variantePasoId)
          ) {
            throw new BadRequestException(
              'La regla SELECCIONAR_VARIANTE_PASO requiere pasoPlantillaId y variantePasoId.',
            );
          }
          if (regla.accion === TipoChecklistAccionReglaDto.costo_extra && !regla.costoRegla) {
            throw new BadRequestException('La regla COSTO_EXTRA requiere costoRegla.');
          }
          if (regla.accion === TipoChecklistAccionReglaDto.material_extra && !regla.materiaPrimaVarianteId) {
            throw new BadRequestException('La regla MATERIAL_EXTRA requiere materiaPrimaVarianteId.');
          }
          if (
            (regla.accion === TipoChecklistAccionReglaDto.activar_paso ||
              regla.accion === TipoChecklistAccionReglaDto.seleccionar_variante_paso)
          ) {
            const insertion = this.parseChecklistRouteInsertion(regla.detalle);
            if (
              (insertion.modo === TipoInsercionRouteEffectDto.before_step ||
                insertion.modo === TipoInsercionRouteEffectDto.after_step) &&
              !insertion.pasoPlantillaId
            ) {
              throw new BadRequestException(
                'Las reglas de paso con inserción antes/después requieren un paso de referencia.',
              );
            }
          }
          if (regla.accion === TipoChecklistAccionReglaDto.set_atributo_tecnico) {
            throw new BadRequestException(
              'SET_ATRIBUTO_TECNICO ya no se admite en Ruta de opcionales.',
            );
          }
        }
      }
    }
  }

  private toProductoChecklistResponse(
    item: {
    id: string;
    productoServicioId: string;
    activo: boolean;
    createdAt: Date;
    updatedAt: Date;
    preguntas: Array<{
      id: string;
      texto: string;
      tipoPregunta: TipoProductoChecklistPregunta;
      orden: number;
      activo: boolean;
      respuestas: Array<{
        id: string;
        texto: string;
        codigo: string | null;
        orden: number;
        activo: boolean;
        reglas: Array<{
          id: string;
          accion: TipoProductoChecklistReglaAccion;
          orden: number;
          activo: boolean;
          procesoOperacionId: string | null;
          procesoOperacion: {
            id: string;
            nombre: string;
            codigo: string;
            centroCosto: { id: string; nombre: string };
            maquina: { id: string; nombre: string } | null;
            perfilOperativo: { id: string; nombre: string } | null;
            setupMin: Prisma.Decimal | null;
            runMin: Prisma.Decimal | null;
            cleanupMin: Prisma.Decimal | null;
            tiempoFijoMin: Prisma.Decimal | null;
            detalleJson: Prisma.JsonValue | null;
          } | null;
          costoRegla: ReglaCostoChecklist | null;
          costoValor: Prisma.Decimal | null;
          costoCentroCostoId: string | null;
          costoCentroCosto: { nombre: string } | null;
          materiaPrimaVarianteId: string | null;
          materiaPrimaVariante: {
            id: string;
            sku: string;
            materiaPrima: { nombre: string };
          } | null;
          tipoConsumo: TipoConsumoAdicionalMaterial | null;
          factorConsumo: Prisma.Decimal | null;
          mermaPct: Prisma.Decimal | null;
          detalleJson: Prisma.JsonValue | null;
        }>;
      }>;
    }>;
    },
    plantillasById: Map<string, any> = new Map(),
  ) {
    return {
      id: item.id,
      productoId: item.productoServicioId,
      activo: item.activo,
      preguntas: item.preguntas.map((pregunta) => ({
        id: pregunta.id,
        texto: pregunta.texto,
        tipoPregunta: this.fromTipoChecklistPregunta(pregunta.tipoPregunta),
        orden: pregunta.orden,
        activo: pregunta.activo,
        respuestas: pregunta.respuestas.map((respuesta) => ({
          id: respuesta.id,
          texto: respuesta.texto,
          codigo: respuesta.codigo,
          orden: respuesta.orden,
          activo: respuesta.activo,
          reglas: respuesta.reglas
            .filter((regla) => regla.accion !== TipoProductoChecklistReglaAccion.SET_ATRIBUTO_TECNICO)
            .map((regla) => {
              const pasoPlantillaId = this.getChecklistPasoPlantillaId(regla.detalleJson);
              const pasoPlantilla = pasoPlantillaId ? plantillasById.get(pasoPlantillaId) ?? null : null;
              const pasoDetalleJson =
                pasoPlantilla?.detalleJson ?? regla.procesoOperacion?.detalleJson ?? null;

              return {
                id: regla.id,
                accion: this.fromTipoChecklistAccion(regla.accion),
                orden: regla.orden,
                activo: regla.activo,
                pasoPlantillaId,
                pasoPlantillaNombre: pasoPlantilla?.nombre ?? regla.procesoOperacion?.nombre ?? '',
                centroCostoId:
                  pasoPlantilla?.centroCostoId ?? regla.procesoOperacion?.centroCosto.id ?? null,
                centroCostoNombre:
                  pasoPlantilla?.centroCosto?.nombre ?? regla.procesoOperacion?.centroCosto.nombre ?? '',
                maquinaNombre:
                  pasoPlantilla?.maquina?.nombre ?? regla.procesoOperacion?.maquina?.nombre ?? '',
                perfilOperativoNombre:
                  pasoPlantilla?.perfilOperativo?.nombre ??
                  regla.procesoOperacion?.perfilOperativo?.nombre ??
                  '',
                setupMin:
                  pasoPlantilla?.setupMin === null || pasoPlantilla?.setupMin === undefined
                    ? regla.procesoOperacion?.setupMin
                      ? Number(regla.procesoOperacion.setupMin)
                      : null
                    : Number(pasoPlantilla.setupMin),
                runMin: regla.procesoOperacion?.runMin ? Number(regla.procesoOperacion.runMin) : null,
                cleanupMin:
                  pasoPlantilla?.cleanupMin === null || pasoPlantilla?.cleanupMin === undefined
                    ? regla.procesoOperacion?.cleanupMin
                      ? Number(regla.procesoOperacion.cleanupMin)
                      : null
                    : Number(pasoPlantilla.cleanupMin),
                tiempoFijoMin:
                  pasoPlantilla?.tiempoFijoMin === null || pasoPlantilla?.tiempoFijoMin === undefined
                    ? regla.procesoOperacion?.tiempoFijoMin
                      ? Number(regla.procesoOperacion.tiempoFijoMin)
                      : null
                    : Number(pasoPlantilla.tiempoFijoMin),
                variantePasoId: this.getChecklistVariantePasoId(regla.detalleJson),
                variantePasoNombre: this.getChecklistVariantePasoNombre(
                  this.getChecklistVariantePasoId(regla.detalleJson),
                  pasoDetalleJson,
                ),
                variantePasoResumen: this.getChecklistVariantePasoResumen(
                  this.getChecklistVariantePasoId(regla.detalleJson),
                  pasoDetalleJson,
                ),
                nivelesDisponibles: this.getProcesoOperacionNiveles(pasoDetalleJson),
                costoRegla: regla.costoRegla ? this.fromReglaCostoChecklist(regla.costoRegla) : null,
                costoValor: regla.costoValor === null ? null : Number(regla.costoValor),
                costoCentroCostoId: regla.costoCentroCostoId,
                costoCentroCostoNombre: regla.costoCentroCosto?.nombre ?? '',
                materiaPrimaVarianteId: regla.materiaPrimaVarianteId,
                materiaPrimaNombre: regla.materiaPrimaVariante?.materiaPrima.nombre ?? '',
                materiaPrimaSku: regla.materiaPrimaVariante?.sku ?? '',
                tipoConsumo: regla.tipoConsumo
                  ? this.fromTipoConsumoAdicionalMaterial(regla.tipoConsumo)
                  : null,
                factorConsumo: regla.factorConsumo === null ? null : Number(regla.factorConsumo),
                mermaPct: regla.mermaPct === null ? null : Number(regla.mermaPct),
                detalle: (regla.detalleJson as Record<string, unknown> | null) ?? null,
              };
            }),
        })),
      })),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private validateOpcionesProductivasPayload(payload: UpsertVarianteOpcionesProductivasDto) {
    const seen = new Set<DimensionOpcionProductivaDto>();
    for (const dimension of payload.dimensiones) {
      if (seen.has(dimension.dimension)) {
        throw new BadRequestException(`La dimensión ${dimension.dimension} está duplicada.`);
      }
      seen.add(dimension.dimension);
      const values = new Set<ValorOpcionProductivaDto>();
      for (const value of dimension.valores) {
        this.assertScopeDimensionMatchesValue(dimension.dimension, value);
        if (values.has(value)) {
          throw new BadRequestException(
            `Hay valores duplicados para ${dimension.dimension}.`,
          );
        }
        values.add(value);
      }
    }
  }

  private normalizeOpcionesProductivasPayload(payload: UpsertVarianteOpcionesProductivasDto) {
    return payload.dimensiones.map((dimension) => ({
      dimension: dimension.dimension,
      valores: Array.from(new Set(dimension.valores)),
    }));
  }

  private async validateAndNormalizeMatchingBase(
    auth: CurrentAuth,
    productoId: string,
    dimensionesConsumidas: DimensionOpcionProductiva[],
    matchingPorVariante: UpdateProductoRutaPolicyDto['matchingBasePorVariante'],
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const producto = await tx.productoServicio.findFirst({
      where: {
        tenantId: auth.tenantId,
        id: productoId,
      },
      select: {
        id: true,
        usarRutaComunVariantes: true,
        procesoDefinicionDefaultId: true,
      },
    });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado.');
    }
    const varianteRows = await tx.productoVariante.findMany({
      where: {
        tenantId: auth.tenantId,
        productoServicioId: productoId,
      },
      include: {
        opcionesProductivasSet: {
          include: {
            valores: {
              where: { activo: true },
              orderBy: [{ dimension: 'asc' }, { orden: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });
    const variantesById = new Map(varianteRows.map((item) => [item.id, item]));
    const plantillaIds = Array.from(
      new Set((matchingPorVariante ?? []).flatMap((item) => item.matching.map((row) => row.pasoPlantillaId))),
    );
    const procesoIds = Array.from(
      new Set(
        (matchingPorVariante ?? [])
          .map((item) => {
            const variante = variantesById.get(item.varianteId);
            if (!variante) return null;
            return producto.usarRutaComunVariantes
              ? producto.procesoDefinicionDefaultId
              : variante.procesoDefinicionId;
          })
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const [plantillas, procesos] = await Promise.all([
      plantillaIds.length
        ? tx.procesoOperacionPlantilla.findMany({
            where: { tenantId: auth.tenantId, id: { in: plantillaIds } },
          })
        : Promise.resolve([]),
      procesoIds.length
        ? tx.procesoDefinicion.findMany({
            where: { tenantId: auth.tenantId, id: { in: procesoIds } },
            include: {
              operaciones: true,
            },
          })
        : Promise.resolve([]),
    ]);
    const plantillasById = new Map(plantillas.map((item) => [item.id, item]));
    const procesoById = new Map(procesos.map((item) => [item.id, item]));
    const maquinaIds = Array.from(
      new Set(
        plantillas
          .map((item) => item.maquinaId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const maquinas = maquinaIds.length
      ? await tx.maquina.findMany({
          where: { tenantId: auth.tenantId, id: { in: maquinaIds } },
          select: { id: true, plantilla: true },
        })
      : [];
    const maquinasById = new Map(maquinas.map((item) => [item.id, item]));
    const perfiles = maquinaIds.length
      ? await tx.maquinaPerfilOperativo.findMany({
          where: { tenantId: auth.tenantId, maquinaId: { in: maquinaIds } },
        })
      : [];
    const perfilesById = new Map(perfiles.map((item) => [item.id, item]));
    const perfilesByMaquinaId = new Map<string, typeof perfiles>();
    for (const perfil of perfiles) {
      const current = perfilesByMaquinaId.get(perfil.maquinaId) ?? [];
      current.push(perfil);
      perfilesByMaquinaId.set(perfil.maquinaId, current);
    }

    return (matchingPorVariante ?? []).map((item) => {
      const variante = variantesById.get(item.varianteId);
      if (!variante) {
        throw new BadRequestException('Matching base: variante inválida para este producto.');
      }
      const permitidos = this.resolveEffectiveOptionValues(variante as any);
      const seen = new Set<string>();
      const procesoId = producto.usarRutaComunVariantes
        ? producto.procesoDefinicionDefaultId
        : variante.procesoDefinicionId;
      const proceso = procesoId ? procesoById.get(procesoId) ?? null : null;
      const pasoPlantillaIdsRuta = new Set(
        (proceso?.operaciones ?? [])
          .map((op) => ({
            op,
            pasoPlantillaId: this.resolvePasoPlantillaIdFromOperacionRuta(op, plantillas) ?? '',
          }))
          .filter((value) => Boolean(value.pasoPlantillaId))
          .filter(({ pasoPlantillaId }) =>
            this.isPasoPlantillaEligibleForMatchingBase(
              plantillasById.get(pasoPlantillaId) ?? null,
              maquinasById,
              dimensionesConsumidas,
            ),
          )
          .map((value) => value.pasoPlantillaId),
      );
      const normalizedMatching = item.matching.map((row) => {
        const plantilla = plantillasById.get(row.pasoPlantillaId);
        if (!plantilla) {
          throw new BadRequestException('Matching base: paso de biblioteca inválido.');
        }
        if (!pasoPlantillaIdsRuta.has(row.pasoPlantillaId)) {
          throw new BadRequestException(
            'Matching base: el paso elegido no pertenece a la ruta base efectiva de la variante.',
          );
        }
        if (!plantilla.maquinaId) {
          throw new BadRequestException('Matching base: el paso elegido no tiene máquina asignada.');
        }
        const tipoImpresion = row.tipoImpresion ? this.toTipoImpresion(row.tipoImpresion) : null;
        const caras = row.caras ? this.toCaras(row.caras) : null;
        let perfil = perfilesById.get(row.perfilOperativoId) ?? null;
        if (!perfil) {
          perfil =
            perfilesByMaquinaId
              .get(plantilla.maquinaId)
              ?.find(
                (item) =>
                  (!tipoImpresion || item.printMode === tipoImpresion) &&
                  (!caras || item.printSides === caras),
              ) ?? null;
        }
        if (!perfil) {
          const partes: string[] = [];
          if (tipoImpresion) {
            partes.push(`tipo_impresion=${row.tipoImpresion}`);
          }
          if (caras) {
            partes.push(`caras=${row.caras}`);
          }
          const contexto = partes.length ? ` para ${partes.join(', ')}` : '';
          throw new BadRequestException(
            `Matching base: no existe perfil operativo compatible${contexto} en la máquina del paso.`,
          );
        }
        if (perfil.maquinaId !== plantilla.maquinaId) {
          throw new BadRequestException(
            'Matching base: el perfil operativo no pertenece a la misma máquina del paso.',
          );
        }
        if (dimensionesConsumidas.includes(DimensionOpcionProductiva.TIPO_IMPRESION)) {
          if (!tipoImpresion) {
            throw new BadRequestException('Matching base: falta tipo de impresión en una combinación.');
          }
          const permitidosTipo = permitidos.get(DimensionOpcionProductiva.TIPO_IMPRESION);
          if (!permitidosTipo?.has(this.toValorFromTipoImpresion(tipoImpresion))) {
            throw new BadRequestException(
              `Matching base: tipo_impresion=${row.tipoImpresion} no está permitido para la variante.`,
            );
          }
        }
        if (dimensionesConsumidas.includes(DimensionOpcionProductiva.CARAS)) {
          if (!caras) {
            throw new BadRequestException('Matching base: falta caras en una combinación.');
          }
          const permitidosCaras = permitidos.get(DimensionOpcionProductiva.CARAS);
          if (!permitidosCaras?.has(this.toValorFromCaras(caras))) {
            throw new BadRequestException(
              `Matching base: caras=${row.caras} no está permitido para la variante.`,
            );
          }
        }
        const key = `${row.pasoPlantillaId}:${tipoImpresion ?? 'na'}:${caras ?? 'na'}`;
        if (seen.has(key)) {
          throw new BadRequestException(
            'Matching base: hay combinaciones duplicadas para el mismo paso dentro de una variante.',
          );
        }
        seen.add(key);
        return {
          tipoImpresion: tipoImpresion ? this.fromTipoImpresion(tipoImpresion) : null,
          caras: caras ? this.fromCaras(caras) : null,
          pasoPlantillaId: row.pasoPlantillaId,
          perfilOperativoId: perfil.id,
        };
      });
      return {
        varianteId: item.varianteId,
        matching: normalizedMatching,
      };
    });
  }

  private async validateAndNormalizePasosFijosRutaBase(
    auth: CurrentAuth,
    productoId: string,
    dimensionesConsumidas: DimensionOpcionProductiva[],
    pasosFijosPorVariante: UpdateProductoRutaPolicyDto['pasosFijosPorVariante'],
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const producto = await tx.productoServicio.findFirst({
      where: {
        tenantId: auth.tenantId,
        id: productoId,
      },
      select: {
        id: true,
        usarRutaComunVariantes: true,
        procesoDefinicionDefaultId: true,
      },
    });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado.');
    }
    const varianteRows = await tx.productoVariante.findMany({
      where: {
        tenantId: auth.tenantId,
        productoServicioId: productoId,
      },
    });
    const variantesById = new Map(varianteRows.map((item) => [item.id, item]));
    const procesoIds = Array.from(
      new Set(
        (pasosFijosPorVariante ?? [])
          .map((item) => {
            const variante = variantesById.get(item.varianteId);
            if (!variante) return null;
            return producto.usarRutaComunVariantes
              ? producto.procesoDefinicionDefaultId
              : variante.procesoDefinicionId;
          })
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const procesos = procesoIds.length
      ? await tx.procesoDefinicion.findMany({
          where: { tenantId: auth.tenantId, id: { in: procesoIds } },
          include: { operaciones: true },
        })
      : [];
    const procesoById = new Map(procesos.map((item) => [item.id, item]));
    const plantillas = await tx.procesoOperacionPlantilla.findMany({
      where: { tenantId: auth.tenantId, activo: true },
    });
    const plantillasById = new Map(plantillas.map((item) => [item.id, item]));
    const maquinas = await tx.maquina.findMany({
      where: { tenantId: auth.tenantId },
      select: { id: true, plantilla: true },
    });
    const maquinasById = new Map(maquinas.map((item) => [item.id, item]));
    const perfiles = await tx.maquinaPerfilOperativo.findMany({
      where: { tenantId: auth.tenantId },
    });
    const perfilesById = new Map(perfiles.map((item) => [item.id, item]));

    return (pasosFijosPorVariante ?? []).map((item) => {
      const variante = variantesById.get(item.varianteId);
      if (!variante) {
        throw new BadRequestException('Pasos fijos: variante inválida para este producto.');
      }
      const procesoId = producto.usarRutaComunVariantes
        ? producto.procesoDefinicionDefaultId
        : variante.procesoDefinicionId;
      const proceso = procesoId ? procesoById.get(procesoId) ?? null : null;
      const pasoPlantillaIdsRuta = new Set(
        (proceso?.operaciones ?? [])
          .map((op) => this.resolvePasoPlantillaIdFromOperacionRuta(op, plantillas) ?? '')
          .filter(Boolean)
          .filter((pasoPlantillaId) => {
            const plantilla = plantillasById.get(pasoPlantillaId) ?? null;
            return !this.isPasoPlantillaEligibleForMatchingBase(
              plantilla,
              maquinasById,
              dimensionesConsumidas,
            );
          }),
      );
      const seen = new Set<string>();
      const pasos = (item.pasos ?? []).map((row) => {
        const plantilla = plantillasById.get(row.pasoPlantillaId) ?? null;
        if (!plantilla) {
          throw new BadRequestException('Pasos fijos: paso de biblioteca inválido.');
        }
        if (!pasoPlantillaIdsRuta.has(row.pasoPlantillaId)) {
          throw new BadRequestException(
            'Pasos fijos: el paso elegido no pertenece a los pasos fijos de la ruta efectiva de la variante.',
          );
        }
        if (!plantilla.maquinaId) {
          throw new BadRequestException('Pasos fijos: el paso elegido no tiene máquina asignada.');
        }
        const perfil = perfilesById.get(row.perfilOperativoId) ?? null;
        if (!perfil) {
          throw new BadRequestException('Pasos fijos: perfil operativo inválido.');
        }
        if (perfil.maquinaId !== plantilla.maquinaId) {
          throw new BadRequestException(
            'Pasos fijos: el perfil operativo no pertenece a la misma máquina del paso.',
          );
        }
        const key = `${row.pasoPlantillaId}:${perfil.id}`;
        if (seen.has(key)) {
          throw new BadRequestException(
            'Pasos fijos: hay configuraciones duplicadas para el mismo paso dentro de una variante.',
          );
        }
        seen.add(key);
        return {
          pasoPlantillaId: row.pasoPlantillaId,
          perfilOperativoId: perfil.id,
        };
      });
      return {
        varianteId: item.varianteId,
        pasos,
      };
    });
  }

  private toVarianteOpcionesProductivasResponse(
    varianteId: string,
    variante: {
      tipoImpresion: TipoImpresionProductoVariante;
      caras: CarasProductoVariante;
    },
    set:
      | {
          id: string;
          valores: Array<{
            dimension: DimensionOpcionProductiva;
            valor: ValorOpcionProductiva;
            orden: number;
          }>;
          createdAt: Date;
          updatedAt: Date;
        }
      | null,
  ) {
    const legacy = [
      {
        dimension: DimensionOpcionProductivaDto.tipo_impresion,
        valores: [this.fromValorOpcionProductiva(this.toValorFromTipoImpresion(variante.tipoImpresion))],
      },
      {
        dimension: DimensionOpcionProductivaDto.caras,
        valores: [this.fromValorOpcionProductiva(this.toValorFromCaras(variante.caras))],
      },
    ];
    if (!set || !set.valores.length) {
      return {
        varianteId,
        source: 'legacy',
        dimensiones: legacy,
      };
    }
    return {
      varianteId,
      source: 'v2',
      dimensiones: this.groupOpcionesProductivas(set.valores),
      createdAt: set.createdAt.toISOString(),
      updatedAt: set.updatedAt.toISOString(),
    };
  }

  private toAdicionalCatalogoResponse(item: {
    id: string;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    tipo: TipoProductoAdicional;
    metodoCosto: MetodoCostoProductoAdicional;
    centroCostoId: string | null;
    activo: boolean;
    metadataJson: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    centroCosto?: { nombre: string } | null;
    materiales?: Array<{
      id: string;
      tipoConsumo: TipoConsumoAdicionalMaterial;
      factorConsumo: Prisma.Decimal;
      mermaPct: Prisma.Decimal | null;
      activo: boolean;
      detalleJson: Prisma.JsonValue | null;
      materiaPrimaVarianteId: string;
      materiaPrimaVariante: {
        sku: string;
        materiaPrima: {
          nombre: string;
        };
      };
    }>;
    efectos?: Array<{
      id: string;
      tipo: TipoProductoAdicionalEfecto;
      activo: boolean;
    }>;
  }) {
    return {
      id: item.id,
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      tipo: this.fromTipoAdicional(item.tipo),
      metodoCosto: this.fromMetodoCostoAdicional(item.metodoCosto),
      centroCostoId: item.centroCostoId,
      centroCostoNombre: item.centroCosto?.nombre ?? '',
      activo: item.activo,
      metadata: (item.metadataJson as Record<string, unknown> | null) ?? null,
      servicioPricing: this.parseServicioPricing(item.metadataJson),
      efectos: (item.efectos ?? []).map((efecto) => ({
        id: efecto.id,
        tipo: this.fromTipoAdicionalEfecto(efecto.tipo),
        activo: efecto.activo,
      })),
      materiales: (item.materiales ?? []).map((material) => ({
        id: material.id,
        materiaPrimaVarianteId: material.materiaPrimaVarianteId,
        materiaPrimaNombre: material.materiaPrimaVariante.materiaPrima.nombre,
        materiaPrimaSku: material.materiaPrimaVariante.sku,
        tipoConsumo: this.fromTipoConsumoAdicionalMaterial(material.tipoConsumo),
        factorConsumo: Number(material.factorConsumo),
        mermaPct: material.mermaPct === null ? null : Number(material.mermaPct),
        activo: material.activo,
        detalle: (material.detalleJson as Record<string, unknown> | null) ?? null,
      })),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private toFamiliaResponse(item: {
    id: string;
    codigo: string;
    nombre: string;
    activo: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      codigo: item.codigo,
      nombre: item.nombre,
      activo: item.activo,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private toSubfamiliaResponse(item: {
    id: string;
    codigo: string;
    nombre: string;
    unidadComercial: string | null;
    activo: boolean;
    familiaProductoId: string;
    familiaProducto: {
      nombre: string;
    };
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      codigo: item.codigo,
      nombre: item.nombre,
      unidadComercial: item.unidadComercial ?? '',
      activo: item.activo,
      familiaProductoId: item.familiaProductoId,
      familiaProductoNombre: item.familiaProducto.nombre,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private toProductoResponseBase(item: {
    id: string;
    tipo: TipoProductoServicio;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    motorCodigo: string;
    motorVersion: number;
    usarRutaComunVariantes: boolean;
    procesoDefinicionDefaultId: string | null;
    detalleJson?: Prisma.JsonValue | null;
    estado: EstadoProductoServicio;
    activo: boolean;
    familiaProductoId: string;
    familiaProducto: { nombre: string };
    subfamiliaProductoId: string | null;
    subfamiliaProducto?: { nombre: string } | null;
    procesoDefinicionDefault?: { nombre: string } | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      tipo: this.fromTipoProducto(item.tipo),
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      motorCodigo: item.motorCodigo,
      motorVersion: item.motorVersion,
      usarRutaComunVariantes: item.usarRutaComunVariantes,
      procesoDefinicionDefaultId: item.procesoDefinicionDefaultId,
      procesoDefinicionDefaultNombre: item.procesoDefinicionDefault?.nombre ?? '',
      estado: this.fromEstadoProducto(item.estado),
      activo: item.activo,
      familiaProductoId: item.familiaProductoId,
      familiaProductoNombre: item.familiaProducto.nombre,
      subfamiliaProductoId: item.subfamiliaProductoId,
      subfamiliaProductoNombre: item.subfamiliaProducto?.nombre ?? '',
      dimensionesBaseConsumidas: this.getProductoDimensionesBaseConsumidas(item.detalleJson).map((dimension) =>
        this.fromDimensionOpcionProductiva(dimension),
      ),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private mergeProductoDetalle(
    detalleJson: Prisma.JsonValue | null | undefined,
    patch: Record<string, unknown>,
  ) {
    const current = this.asObject(detalleJson);
    return {
      ...current,
      ...patch,
    };
  }

  private getProductoDimensionesBaseConsumidas(
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ) {
    const detalle = this.asObject(detalleJson);
    const raw = detalle.dimensionesBaseConsumidas;
    if (!Array.isArray(raw)) {
      return [] as DimensionOpcionProductiva[];
    }
    return Array.from(
      new Set(
        raw
          .map((item) => this.normalizeDimensionOpcionProductivaValue(item))
          .filter((item): item is DimensionOpcionProductivaDto => Boolean(item))
          .map((item) => this.toDimensionOpcionProductiva(item)),
      ),
    );
  }

  private getProductoMatchingBaseByVariante(
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ) {
    const detalle = this.asObject(detalleJson);
    const raw = detalle.matchingBasePorVariante;
    if (!Array.isArray(raw)) {
      return [] as Array<{
        varianteId: string;
        matching: Array<{
          tipoImpresion: TipoImpresionProductoVarianteDto | null;
          caras: CarasProductoVarianteDto | null;
          pasoPlantillaId: string;
          perfilOperativoId: string;
        }>;
      }>;
    }
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const record = item as Record<string, unknown>;
        const varianteId = typeof record.varianteId === 'string' ? record.varianteId.trim() : '';
        if (!varianteId) return null;
        const matching = Array.isArray(record.matching)
          ? record.matching
              .map((matchItem) => {
                if (!matchItem || typeof matchItem !== 'object' || Array.isArray(matchItem)) return null;
                const matchRecord = matchItem as Record<string, unknown>;
                const tipoImpresion =
                  matchRecord.tipoImpresion === null
                    ? null
                    : this.normalizeTipoImpresionProductoVarianteValue(matchRecord.tipoImpresion);
                const caras =
                  matchRecord.caras === null
                    ? null
                    : this.normalizeCarasProductoVarianteValue(matchRecord.caras);
                const pasoPlantillaId =
                  typeof matchRecord.pasoPlantillaId === 'string'
                    ? matchRecord.pasoPlantillaId.trim()
                    : '';
                const perfilOperativoId =
                  typeof matchRecord.perfilOperativoId === 'string'
                    ? matchRecord.perfilOperativoId.trim()
                    : '';
                if (!pasoPlantillaId || !perfilOperativoId) return null;
                return {
                  tipoImpresion,
                  caras,
                  pasoPlantillaId,
                  perfilOperativoId,
                };
              })
              .filter(
                (
                  row,
                ): row is {
                  tipoImpresion: TipoImpresionProductoVarianteDto | null;
                  caras: CarasProductoVarianteDto | null;
                  pasoPlantillaId: string;
                  perfilOperativoId: string;
                } => Boolean(row),
              )
          : [];
        return {
          varianteId,
          matching,
        };
      })
      .filter((item): item is { varianteId: string; matching: any[] } => Boolean(item));
  }

  private getProductoPasosFijosByVariante(
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ) {
    const detalle = this.asObject(detalleJson);
    const raw = detalle.pasosFijosPorVariante;
    if (!Array.isArray(raw)) {
      return [] as Array<{
        varianteId: string;
        pasos: Array<{
          pasoPlantillaId: string;
          perfilOperativoId: string;
        }>;
      }>;
    }
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const record = item as Record<string, unknown>;
        const varianteId = typeof record.varianteId === 'string' ? record.varianteId.trim() : '';
        if (!varianteId) return null;
        const pasos = Array.isArray(record.pasos)
          ? record.pasos
              .map((pasoItem) => {
                if (!pasoItem || typeof pasoItem !== 'object' || Array.isArray(pasoItem)) return null;
                const pasoRecord = pasoItem as Record<string, unknown>;
                const pasoPlantillaId =
                  typeof pasoRecord.pasoPlantillaId === 'string' ? pasoRecord.pasoPlantillaId.trim() : '';
                const perfilOperativoId =
                  typeof pasoRecord.perfilOperativoId === 'string'
                    ? pasoRecord.perfilOperativoId.trim()
                    : '';
                if (!pasoPlantillaId || !perfilOperativoId) return null;
                return {
                  pasoPlantillaId,
                  perfilOperativoId,
                };
              })
              .filter(
                (
                  row,
                ): row is {
                  pasoPlantillaId: string;
                  perfilOperativoId: string;
                } => Boolean(row),
              )
          : [];
        return {
          varianteId,
          pasos,
        };
      })
      .filter((item): item is { varianteId: string; pasos: any[] } => Boolean(item));
  }

  private async toRutaBaseMatchingResponse(detalleJson: Prisma.JsonValue | null) {
    const matchingByVariante = this.getProductoMatchingBaseByVariante(detalleJson);
    if (!matchingByVariante.length) return [];
    const plantillaIds = Array.from(
      new Set(matchingByVariante.flatMap((item) => item.matching.map((row) => row.pasoPlantillaId))),
    );
    const perfilIds = Array.from(
      new Set(matchingByVariante.flatMap((item) => item.matching.map((row) => row.perfilOperativoId))),
    );
    const [plantillas, perfiles] = await Promise.all([
      plantillaIds.length
        ? this.prisma.procesoOperacionPlantilla.findMany({
            where: { id: { in: plantillaIds } },
          })
        : Promise.resolve([]),
      perfilIds.length
        ? this.prisma.maquinaPerfilOperativo.findMany({
            where: { id: { in: perfilIds } },
          })
        : Promise.resolve([]),
    ]);
    const plantillasById = new Map(plantillas.map((item) => [item.id, item]));
    const perfilesById = new Map(perfiles.map((item) => [item.id, item]));
    return matchingByVariante.map((item) => ({
      varianteId: item.varianteId,
      matching: item.matching.map((row) => ({
        tipoImpresion: row.tipoImpresion,
        caras: row.caras,
        pasoPlantillaId: row.pasoPlantillaId,
        pasoPlantillaNombre: plantillasById.get(row.pasoPlantillaId)?.nombre ?? '',
        perfilOperativoId: row.perfilOperativoId,
        perfilOperativoNombre: perfilesById.get(row.perfilOperativoId)?.nombre ?? '',
      })),
    }));
  }

  private async toRutaBasePasosFijosResponse(detalleJson: Prisma.JsonValue | null) {
    const pasosFijosByVariante = this.getProductoPasosFijosByVariante(detalleJson);
    if (!pasosFijosByVariante.length) return [];
    const plantillaIds = Array.from(
      new Set(pasosFijosByVariante.flatMap((item) => item.pasos.map((row) => row.pasoPlantillaId))),
    );
    const perfilIds = Array.from(
      new Set(pasosFijosByVariante.flatMap((item) => item.pasos.map((row) => row.perfilOperativoId))),
    );
    const [plantillas, perfiles] = await Promise.all([
      plantillaIds.length
        ? this.prisma.procesoOperacionPlantilla.findMany({
            where: { id: { in: plantillaIds } },
          })
        : Promise.resolve([]),
      perfilIds.length
        ? this.prisma.maquinaPerfilOperativo.findMany({
            where: { id: { in: perfilIds } },
          })
        : Promise.resolve([]),
    ]);
    const plantillasById = new Map(plantillas.map((item) => [item.id, item]));
    const perfilesById = new Map(perfiles.map((item) => [item.id, item]));
    return pasosFijosByVariante.map((item) => ({
      varianteId: item.varianteId,
      pasos: item.pasos.map((row) => ({
        pasoPlantillaId: row.pasoPlantillaId,
        pasoPlantillaNombre: plantillasById.get(row.pasoPlantillaId)?.nombre ?? '',
        perfilOperativoId: row.perfilOperativoId,
        perfilOperativoNombre: perfilesById.get(row.perfilOperativoId)?.nombre ?? '',
      })),
    }));
  }

  private normalizeDimensionOpcionProductivaValue(value: unknown) {
    return value === 'tipo_impresion' || value === 'caras' ? value : null;
  }

  private normalizeTipoImpresionProductoVarianteValue(value: unknown) {
    return value === 'bn' || value === 'cmyk'
      ? value
      : null;
  }

  private normalizeCarasProductoVarianteValue(value: unknown) {
    return value === 'simple_faz' || value === 'doble_faz' ? value : null;
  }

  private async validateVarianteRelations(
    auth: CurrentAuth,
    papelVarianteId: string | undefined,
    procesoDefinicionId: string | undefined,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    if (papelVarianteId) {
      await this.findPapelVarianteOrThrow(auth, papelVarianteId, tx);
    }
    if (procesoDefinicionId) {
      await this.findProcesoOrThrow(auth, procesoDefinicionId, tx);
    }
  }

  private toVarianteResponse(item: {
    id: string;
    productoServicioId: string;
    nombre: string;
    anchoMm: Prisma.Decimal;
    altoMm: Prisma.Decimal;
    papelVarianteId: string | null;
    tipoImpresion: TipoImpresionProductoVariante;
    caras: CarasProductoVariante;
    procesoDefinicionId: string | null;
    activo: boolean;
    createdAt: Date;
    updatedAt: Date;
    papelVariante: {
      sku: string;
      materiaPrimaId: string;
      materiaPrima: {
        nombre: string;
      };
    } | null;
    procesoDefinicion: {
      codigo: string;
      nombre: string;
    } | null;
    opcionesProductivasSet?: {
      valores: Array<{
        dimension: DimensionOpcionProductiva;
        valor: ValorOpcionProductiva;
        orden: number;
      }>;
    } | null;
  }) {
    const opcionesProductivas =
      item.opcionesProductivasSet?.valores?.length
        ? this.groupOpcionesProductivas(item.opcionesProductivasSet.valores)
        : null;
    return {
      id: item.id,
      productoServicioId: item.productoServicioId,
      nombre: item.nombre,
      anchoMm: Number(item.anchoMm),
      altoMm: Number(item.altoMm),
      papelVarianteId: item.papelVarianteId,
      papelVarianteSku: item.papelVariante?.sku ?? '',
      papelNombre: item.papelVariante?.materiaPrima.nombre ?? '',
      tipoImpresion: this.fromTipoImpresion(item.tipoImpresion),
      caras: this.fromCaras(item.caras),
      opcionesProductivas,
      procesoDefinicionId: item.procesoDefinicionId,
      procesoDefinicionCodigo: item.procesoDefinicion?.codigo ?? '',
      procesoDefinicionNombre: item.procesoDefinicion?.nombre ?? '',
      activo: item.activo,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private async generateProductoCodigo(
    auth: CurrentAuth,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    for (let attempt = 0; attempt < ProductosServiciosService.CODIGO_MAX_RETRIES; attempt += 1) {
      const count = await tx.productoServicio.count({
        where: {
          tenantId: auth.tenantId,
        },
      });
      const code = `${ProductosServiciosService.CODIGO_PREFIX}-${String(count + attempt + 1).padStart(4, '0')}`;
      const exists = await tx.productoServicio.findFirst({
        where: {
          tenantId: auth.tenantId,
          codigo: code,
        },
        select: {
          id: true,
        },
      });
      if (!exists) {
        return code;
      }
    }

    return `${ProductosServiciosService.CODIGO_PREFIX}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private async generateAdicionalCodigo(
    auth: CurrentAuth,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    for (let attempt = 0; attempt < ProductosServiciosService.ADICIONAL_CODIGO_MAX_RETRIES; attempt += 1) {
      const count = await tx.productoAdicionalCatalogo.count({
        where: {
          tenantId: auth.tenantId,
        },
      });
      const code = `${ProductosServiciosService.ADICIONAL_CODIGO_PREFIX}-${String(count + attempt + 1).padStart(4, '0')}`;
      const exists = await tx.productoAdicionalCatalogo.findFirst({
        where: {
          tenantId: auth.tenantId,
          codigo: code,
        },
        select: { id: true },
      });
      if (!exists) {
        return code;
      }
    }
    return `${ProductosServiciosService.ADICIONAL_CODIGO_PREFIX}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private async ensureCatalogoInicialImprentaDigital(auth: CurrentAuth) {
    await this.prisma.$transaction(async (tx) => {
      let familia = await tx.familiaProducto.findFirst({
        where: {
          tenantId: auth.tenantId,
          codigo: ProductosServiciosService.FAMILIA_BASE_CODIGO,
        },
      });

      if (!familia) {
        const legacy = await tx.familiaProducto.findFirst({
          where: {
            tenantId: auth.tenantId,
            codigo: ProductosServiciosService.FAMILIA_BASE_CODIGO_LEGACY,
          },
        });
        if (legacy) {
          familia = await tx.familiaProducto.update({
            where: { id: legacy.id },
            data: { codigo: ProductosServiciosService.FAMILIA_BASE_CODIGO },
          });
        }
      }

      if (!familia) {
        familia = await tx.familiaProducto.create({
          data: {
            tenantId: auth.tenantId,
            codigo: ProductosServiciosService.FAMILIA_BASE_CODIGO,
            nombre: 'Imprenta digital hoja',
            activo: true,
          },
        });
      }

      let subfamilia = await tx.subfamiliaProducto.findFirst({
        where: {
          tenantId: auth.tenantId,
          familiaProductoId: familia.id,
          codigo: ProductosServiciosService.SUBFAMILIA_BASE_CODIGO,
        },
      });

      if (!subfamilia) {
        const legacySub = await tx.subfamiliaProducto.findFirst({
          where: {
            tenantId: auth.tenantId,
            familiaProductoId: familia.id,
            codigo: ProductosServiciosService.SUBFAMILIA_BASE_CODIGO_LEGACY,
          },
        });
        if (legacySub) {
          subfamilia = await tx.subfamiliaProducto.update({
            where: { id: legacySub.id },
            data: { codigo: ProductosServiciosService.SUBFAMILIA_BASE_CODIGO },
          });
        }
      }

      if (!subfamilia) {
        await tx.subfamiliaProducto.create({
          data: {
            tenantId: auth.tenantId,
            familiaProductoId: familia.id,
            codigo: ProductosServiciosService.SUBFAMILIA_BASE_CODIGO,
            nombre: 'Tarjetas personales',
            unidadComercial: 'unidad',
            activo: true,
          },
        });
      }
    });
  }

  private resolveMotorOrThrow(code: string, version: number) {
    if (
      code === ProductosServiciosService.MOTOR_DEFAULT.code &&
      version === ProductosServiciosService.MOTOR_DEFAULT.version
    ) {
      return {
        code,
        version,
        label: ProductosServiciosService.MOTOR_DEFAULT.label,
      };
    }
    throw new BadRequestException(`Motor no soportado: ${code}@${version}.`);
  }

  private getDefaultMotorConfig() {
    return {
      tipoCorte: 'sin_demasia',
      demasiaCorteMm: 0,
      lineaCorteMm: 3,
      tamanoPliegoImpresion: {
        codigo: 'A4',
        nombre: 'A4',
        anchoMm: 210,
        altoMm: 297,
      },
      mermaAdicionalPct: 0,
    };
  }

  private mergeMotorConfig(
    existing: Prisma.JsonValue | null | undefined,
    incoming: Record<string, unknown>,
  ) {
    const base = this.getDefaultMotorConfig();
    const current = (existing && typeof existing === 'object' ? existing : {}) as Record<string, unknown>;
    return {
      ...base,
      ...current,
      ...incoming,
    };
  }

  private async getEffectiveMotorConfig(
    auth: CurrentAuth,
    productoId: string,
    varianteId: string,
    motor: { code: string; version: number },
  ) {
    const [baseConfig, overrideConfig] = await Promise.all([
      this.prisma.productoMotorConfig.findFirst({
        where: {
          tenantId: auth.tenantId,
          productoServicioId: productoId,
          motorCodigo: motor.code,
          motorVersion: motor.version,
          activo: true,
        },
        orderBy: [{ versionConfig: 'desc' }],
      }),
      this.prisma.productoVarianteMotorOverride.findFirst({
        where: {
          tenantId: auth.tenantId,
          productoVarianteId: varianteId,
          motorCodigo: motor.code,
          motorVersion: motor.version,
          activo: true,
        },
        orderBy: [{ versionConfig: 'desc' }],
      }),
    ]);

    const mergedBase = this.mergeMotorConfig(baseConfig?.parametrosJson, {});
    const merged = this.mergeMotorConfig(mergedBase as Prisma.JsonValue, (overrideConfig?.parametrosJson ?? {}) as Record<string, unknown>);
    return {
      config: merged,
      configVersionBase: baseConfig?.versionConfig ?? null,
      configVersionOverride: overrideConfig?.versionConfig ?? null,
    };
  }

  private resolveRutaEfectivaId(variante: {
    procesoDefinicionId: string | null;
    productoServicio: {
      usarRutaComunVariantes: boolean;
      procesoDefinicionDefaultId: string | null;
    };
  }) {
    if (variante.productoServicio.usarRutaComunVariantes) {
      return variante.productoServicio.procesoDefinicionDefaultId;
    }
    return variante.procesoDefinicionId;
  }

  private normalizePeriodo(periodo?: string) {
    if (!periodo) {
      const now = new Date();
      return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    if (!DEFAULT_PERIOD_REGEX.test(periodo)) {
      throw new BadRequestException('El periodo debe tener formato YYYY-MM.');
    }
    return periodo;
  }

  private async findVarianteCompletaOrThrow(
    auth: CurrentAuth,
    varianteId: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const variante = await tx.productoVariante.findFirst({
      where: {
        tenantId: auth.tenantId,
        id: varianteId,
      },
      include: {
        productoServicio: {
          include: {
            adicionalesAsignados: {
              where: {
                activo: true,
              },
              include: {
                productoAdicional: {
                  include: {
                    centroCosto: true,
                  },
                },
              },
            },
          },
        },
        papelVariante: {
          include: {
            materiaPrima: true,
          },
        },
        adicionalesRestricciones: true,
        opcionesProductivasSet: {
          include: {
            valores: {
              where: { activo: true },
              orderBy: [{ dimension: 'asc' }, { orden: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });
    if (!variante) {
      throw new NotFoundException('Variante de producto no encontrada.');
    }
    return variante;
  }

  private async findProcesoConOperacionesOrThrow(
    auth: CurrentAuth,
    procesoId: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const proceso = await tx.procesoDefinicion.findFirst({
      where: {
        tenantId: auth.tenantId,
        id: procesoId,
      },
      include: {
        operaciones: {
          include: {
            centroCosto: true,
            maquina: true,
            perfilOperativo: true,
            requiresProductoAdicional: true,
          },
          orderBy: [{ orden: 'asc' }],
        },
      },
    });
    if (!proceso) {
      throw new NotFoundException('Ruta de produccion no encontrada.');
    }
    return proceso;
  }

  private resolvePapelDimensionesMm(atributos: Prisma.JsonValue) {
    if (!atributos || typeof atributos !== 'object') {
      throw new BadRequestException('El papel asignado no tiene dimensiones configuradas.');
    }
    const obj = atributos as Record<string, unknown>;
    const anchoRaw = Number(obj.ancho);
    const altoRaw = Number(obj.alto);
    if (!Number.isFinite(anchoRaw) || !Number.isFinite(altoRaw) || anchoRaw <= 0 || altoRaw <= 0) {
      throw new BadRequestException('El papel asignado no tiene ancho/alto validos.');
    }
    return {
      anchoMm: this.normalizeToMm(anchoRaw),
      altoMm: this.normalizeToMm(altoRaw),
    };
  }

  private normalizeToMm(value: number) {
    if (value <= 100) {
      return value * 10;
    }
    return value;
  }

  private resolveMachineMarginsMm(
    operations: Array<{
      maquina: {
        parametrosTecnicosJson: Prisma.JsonValue;
      } | null;
    }>,
  ) {
    const machineOp = operations.find((item) => item.maquina?.parametrosTecnicosJson);
    if (!machineOp?.maquina?.parametrosTecnicosJson || typeof machineOp.maquina.parametrosTecnicosJson !== 'object') {
      return { leftMm: 0, rightMm: 0, topMm: 0, bottomMm: 0 };
    }
    const p = machineOp.maquina.parametrosTecnicosJson as Record<string, unknown>;
    return {
      leftMm: this.normalizeToMm(Number(p.margenIzquierdo ?? 0)),
      rightMm: this.normalizeToMm(Number(p.margenDerecho ?? 0)),
      topMm: this.normalizeToMm(Number(p.margenSuperior ?? 0)),
      bottomMm: this.normalizeToMm(Number(p.margenInferior ?? 0)),
    };
  }

  private resolveImposicionMachineMargins(
    allOperations: Array<{
      maquina: {
        parametrosTecnicosJson: Prisma.JsonValue;
      } | null;
    }>,
    operacionesCotizadas: Array<{
      maquina: {
        parametrosTecnicosJson: Prisma.JsonValue;
      } | null;
    }>,
  ) {
    // V1: la imposicion se calcula con la ruta completa (base), no con filtros por addon.
    if (allOperations.length > 0) {
      return this.resolveMachineMarginsMm(allOperations);
    }
    return this.resolveMachineMarginsMm(operacionesCotizadas);
  }

  private calculateImposicion(input: {
    varianteAnchoMm: number;
    varianteAltoMm: number;
    sheetAnchoMm: number;
    sheetAltoMm: number;
    machineMargins: { leftMm: number; rightMm: number; topMm: number; bottomMm: number };
    config: Record<string, unknown>;
  }) {
    const tipoCorte = String(input.config.tipoCorte ?? 'sin_demasia');
    const demasiaRaw = Number(input.config.demasiaCorteMm ?? 0);
    const demasiaCorteMm = tipoCorte === 'con_demasia' && Number.isFinite(demasiaRaw) ? Math.max(0, demasiaRaw) : 0;
    const lineaCorteRaw = Number(input.config.lineaCorteMm ?? 3);
    const lineaCorteMm = Number.isFinite(lineaCorteRaw) ? Math.max(0, lineaCorteRaw) : 3;
    const piezaAnchoEfectivoMm = input.varianteAnchoMm + 2 * demasiaCorteMm;
    const piezaAltoEfectivoMm = input.varianteAltoMm + 2 * demasiaCorteMm;

    const anchoImprimible = input.sheetAnchoMm - input.machineMargins.leftMm - input.machineMargins.rightMm;
    const altoImprimible = input.sheetAltoMm - input.machineMargins.topMm - input.machineMargins.bottomMm;
    const anchoDisponible = anchoImprimible - 2 * lineaCorteMm;
    const altoDisponible = altoImprimible - 2 * lineaCorteMm;

    const normalCols = Math.floor(anchoDisponible / piezaAnchoEfectivoMm);
    const normalRows = Math.floor(altoDisponible / piezaAltoEfectivoMm);
    const normal = Math.max(0, normalCols) * Math.max(0, normalRows);

    const rotCols = Math.floor(anchoDisponible / piezaAltoEfectivoMm);
    const rotRows = Math.floor(altoDisponible / piezaAnchoEfectivoMm);
    const rotada = Math.max(0, rotCols) * Math.max(0, rotRows);

    const piezasPorPliego = Math.max(normal, rotada);
    const orientacion = rotada > normal ? 'rotada' : 'normal';
    const cols = orientacion === 'rotada' ? Math.max(0, rotCols) : Math.max(0, normalCols);
    const rows = orientacion === 'rotada' ? Math.max(0, rotRows) : Math.max(0, normalRows);
    return {
      tipoCorte,
      piezasPorPliego,
      orientacion,
      anchoImprimibleMm: Number(anchoImprimible.toFixed(2)),
      altoImprimibleMm: Number(altoImprimible.toFixed(2)),
      anchoDisponibleMm: Number(anchoDisponible.toFixed(2)),
      altoDisponibleMm: Number(altoDisponible.toFixed(2)),
      normal,
      rotada,
      demasiaCorteMm: Number(demasiaCorteMm.toFixed(2)),
      lineaCorteMm: Number(lineaCorteMm.toFixed(2)),
      piezaAnchoMm: input.varianteAnchoMm,
      piezaAltoMm: input.varianteAltoMm,
      piezaAnchoEfectivoMm: Number(piezaAnchoEfectivoMm.toFixed(2)),
      piezaAltoEfectivoMm: Number(piezaAltoEfectivoMm.toFixed(2)),
      cols,
      rows,
      sheetAnchoMm: input.sheetAnchoMm,
      sheetAltoMm: input.sheetAltoMm,
      machineMargins: input.machineMargins,
    };
  }

  private resolvePliegoImpresion(
    config: Record<string, unknown>,
    fallback: { anchoMm: number; altoMm: number },
  ) {
    const raw = config.tamanoPliegoImpresion;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {
        codigo: 'CUSTOM',
        nombre: 'Personalizado',
        anchoMm: fallback.anchoMm,
        altoMm: fallback.altoMm,
      };
    }
    const item = raw as Record<string, unknown>;
    const anchoMm = Number(item.anchoMm ?? fallback.anchoMm);
    const altoMm = Number(item.altoMm ?? fallback.altoMm);
    if (!Number.isFinite(anchoMm) || !Number.isFinite(altoMm) || anchoMm <= 0 || altoMm <= 0) {
      return {
        codigo: 'CUSTOM',
        nombre: 'Personalizado',
        anchoMm: fallback.anchoMm,
        altoMm: fallback.altoMm,
      };
    }
    return {
      codigo: String(item.codigo ?? 'CUSTOM'),
      nombre: String(item.nombre ?? 'Personalizado'),
      anchoMm: this.normalizeToMm(anchoMm),
      altoMm: this.normalizeToMm(altoMm),
    };
  }

  private calculateSustratoToPliegoConversion(input: {
    sustrato: { anchoMm: number; altoMm: number };
    pliegoImpresion: { anchoMm: number; altoMm: number };
  }) {
    const direct =
      this.approxEqualMm(input.sustrato.anchoMm, input.pliegoImpresion.anchoMm) &&
      this.approxEqualMm(input.sustrato.altoMm, input.pliegoImpresion.altoMm);
    const rotatedDirect =
      this.approxEqualMm(input.sustrato.anchoMm, input.pliegoImpresion.altoMm) &&
      this.approxEqualMm(input.sustrato.altoMm, input.pliegoImpresion.anchoMm);
    if (direct || rotatedDirect) {
      return {
        esDerivado: false,
        pliegosPorSustrato: 1,
        orientacion: direct ? 'normal' : 'rotada',
      };
    }

    const normalCols = Math.floor(input.sustrato.anchoMm / input.pliegoImpresion.anchoMm);
    const normalRows = Math.floor(input.sustrato.altoMm / input.pliegoImpresion.altoMm);
    const normal = Math.max(0, normalCols) * Math.max(0, normalRows);

    const rotCols = Math.floor(input.sustrato.anchoMm / input.pliegoImpresion.altoMm);
    const rotRows = Math.floor(input.sustrato.altoMm / input.pliegoImpresion.anchoMm);
    const rotada = Math.max(0, rotCols) * Math.max(0, rotRows);

    const pliegosPorSustrato = Math.max(normal, rotada);
    return {
      esDerivado: true,
      pliegosPorSustrato: Math.max(1, pliegosPorSustrato),
      orientacion: rotada > normal ? 'rotada' : 'normal',
    };
  }

  private approxEqualMm(a: number, b: number) {
    return Math.abs(a - b) <= 0.01;
  }

  private calculateGuillotinaCutsFromImposicion(input: {
    cols: number;
    rows: number;
    tipoCorte?: string;
  }) {
    const cols = Math.max(0, Math.floor(input.cols));
    const rows = Math.max(0, Math.floor(input.rows));
    if (cols <= 0 || rows <= 0) {
      return 0;
    }
    const tipoCorte = String(input.tipoCorte ?? 'sin_demasia').trim().toLowerCase();
    if (tipoCorte === 'con_demasia') {
      return cols * 2 + rows * 2;
    }
    return cols + rows + 2;
  }

  private calculateTerminatingOperationTiming(input: {
    operacion: {
      maquina: {
        plantilla: PlantillaMaquinaria;
        parametrosTecnicosJson: Prisma.JsonValue;
      } | null;
      perfilOperativo: {
        detalleJson: Prisma.JsonValue;
        productivityValue?: Prisma.Decimal | null;
        feedReloadMin?: Prisma.Decimal | null;
        sheetThicknessMm?: Prisma.Decimal | null;
        maxBatchHeightMm?: Prisma.Decimal | null;
      } | null;
    };
    cantidad: number;
    pliegos: number;
    setupMinBase: number;
    cleanupMinBase: number;
    tiempoFijoMinBase: number;
    cantidadObjetivoSalida: number;
    imposicion?: {
      cols: number;
      rows: number;
      tipoCorte?: string;
    };
    varianteAnchoMm: number;
    varianteAltoMm: number;
    overridesProductividad?: Record<string, unknown>;
  }) {
    const plantilla = input.operacion.maquina?.plantilla ?? null;
    const machineParams = this.asObject(input.operacion.maquina?.parametrosTecnicosJson);
    const profileDetail = this.asObject(input.operacion.perfilOperativo?.detalleJson);
    const overrides = this.asObject(input.overridesProductividad);
    const hasPerfil = Object.keys(profileDetail).length > 0;
    const hasOverrides = Object.keys(overrides).length > 0;
    const factorVelocidad = Math.max(
      0.01,
      hasPerfil
        ? this.toSafeNumber(profileDetail.factorVelocidad, 1)
        : this.toSafeNumber(overrides.factorVelocidad, 1),
    );
    const sourceProductividad: 'perfil' | 'override' = hasPerfil ? 'perfil' : 'override';

    const resolveOverrideNumber = (key: string, fallback: number) => {
      const value = hasPerfil
        ? this.toSafeNumber(profileDetail[key], fallback)
        : this.toSafeNumber(overrides[key], fallback);
      return value;
    };

    const resolveProfileNumber = (
      directValue: Prisma.Decimal | null | undefined,
      detailKey: string,
      fallback: number,
    ) => {
      if (input.operacion.perfilOperativo && directValue !== undefined && directValue !== null) {
        return this.toSafeNumber(directValue, fallback);
      }
      return resolveOverrideNumber(detailKey, fallback);
    };

    if (plantilla === PlantillaMaquinaria.GUILLOTINA) {
      const altoBocaMm = Math.max(0, this.toSafeNumber(machineParams.altoBocaMm, 0));
      const sheetThicknessMm = Math.max(
        0.001,
        resolveProfileNumber(input.operacion.perfilOperativo?.sheetThicknessMm, 'sheetThicknessMm', 0.1),
      );
      const maxBatchHeightMm = Math.max(
        0,
        resolveProfileNumber(input.operacion.perfilOperativo?.maxBatchHeightMm, 'maxBatchHeightMm', 0),
      );
      const alturaTandaEfectiva =
        maxBatchHeightMm > 0 ? Math.min(altoBocaMm, maxBatchHeightMm) : altoBocaMm;
      const productivityValue = Math.max(
        0,
        resolveProfileNumber(input.operacion.perfilOperativo?.productivityValue, 'productivityValue', 0),
      );
      if (productivityValue <= 0) {
        throw new BadRequestException(
          'La guillotina requiere que el perfil operativo defina Cortes por minuto.',
        );
      }
      const feedReloadMin = Math.max(
        0,
        resolveProfileNumber(input.operacion.perfilOperativo?.feedReloadMin, 'feedReloadMin', 0),
      );
      const cortesPorImposicion = this.calculateGuillotinaCutsFromImposicion({
        cols: input.imposicion?.cols ?? 0,
        rows: input.imposicion?.rows ?? 0,
        tipoCorte: input.imposicion?.tipoCorte,
      });
      if (cortesPorImposicion <= 0) {
        throw new BadRequestException(
          'No se pudo derivar la cantidad de cortes de guillotina desde la imposición.',
        );
      }
      const pliegosTotales = Math.max(1, input.pliegos);
      const capacidadTanda = Math.max(1, Math.floor(alturaTandaEfectiva / sheetThicknessMm));
      const tandas = Math.max(1, Math.ceil(pliegosTotales / capacidadTanda));
      const cortesTotales = tandas * cortesPorImposicion;
      const runMin = Number((cortesTotales / productivityValue).toFixed(4));
      const setupMin = Number((input.setupMinBase + Math.max(0, tandas - 1) * feedReloadMin).toFixed(4));
      const cleanupMin = Number(input.cleanupMinBase.toFixed(4));
      return {
        setupMin,
        cleanupMin,
        tiempoFijoMin: Number(input.tiempoFijoMinBase.toFixed(4)),
        runMin,
        trace: {
          tipo: 'guillotina',
          pliegosTotales,
          alturaTandaEfectivaMm: Number(alturaTandaEfectiva.toFixed(4)),
          capacidadTanda,
          tandas,
          cortesPorImposicion,
          cortesTotales,
          productivityValue: Number(productivityValue.toFixed(4)),
        },
        sourceProductividad,
        warnings: [],
      };
    }

    if (plantilla === PlantillaMaquinaria.LAMINADORA_BOPP_ROLLO) {
      const anchoRolloMm = Math.max(1, this.toSafeNumber(machineParams.anchoRolloMm, 0));
      const velocidadMMin = Math.max(0, this.toSafeNumber(machineParams.velocidadMMin, 0));
      const mermaArranqueMm = Math.max(0, this.toSafeNumber(machineParams.mermaArranqueMm, 0));
      const mermaCierreMm = Math.max(0, this.toSafeNumber(machineParams.mermaCierreMm, 0));
      const gapEntreHojasMm = Math.max(0, resolveOverrideNumber('gapEntreHojasMm', 0));
      const margenLatIzqMm = Math.max(0, resolveOverrideNumber('margenLatIzqMm', 0));
      const margenLatDerMm = Math.max(0, resolveOverrideNumber('margenLatDerMm', 0));
      const colaCorteMm = Math.max(0, resolveOverrideNumber('colaCorteMm', 0));
      const warmupMin = Math.max(0, resolveOverrideNumber('warmupMin', 0));
      const anchoHojaMm = Math.max(1, input.varianteAnchoMm);
      const altoHojaMm = Math.max(1, input.varianteAltoMm);
      const hojasTotales = Math.max(1, input.cantidadObjetivoSalida);
      const anchoConsumidoMm = Math.min(anchoRolloMm, anchoHojaMm + margenLatIzqMm + margenLatDerMm);
      const pasoLinealMm = altoHojaMm + gapEntreHojasMm + colaCorteMm;
      const largoConsumidoMm = hojasTotales * pasoLinealMm + mermaArranqueMm + mermaCierreMm;
      const velocidadMMinEfectiva = Math.max(0.01, velocidadMMin * factorVelocidad);
      const runMin = Number(((largoConsumidoMm / 1000) / velocidadMMinEfectiva).toFixed(4));
      const areaConsumidaM2 = Number(
        ((anchoConsumidoMm / 1000) * (Math.max(0, largoConsumidoMm) / 1000)).toFixed(6),
      );
      const setupMin = Number((input.setupMinBase + warmupMin).toFixed(4));
      const cleanupMin = Number(input.cleanupMinBase.toFixed(4));
      return {
        setupMin,
        cleanupMin,
        tiempoFijoMin: Number(input.tiempoFijoMinBase.toFixed(4)),
        runMin,
        trace: {
          tipo: 'laminadora_bopp_rollo',
          hojasTotales,
          anchoConsumidoMm: Number(anchoConsumidoMm.toFixed(2)),
          largoConsumidoMm: Number(largoConsumidoMm.toFixed(2)),
          areaConsumidaM2,
          velocidadMMinEfectiva: Number(velocidadMMinEfectiva.toFixed(4)),
        },
        sourceProductividad,
        warnings: velocidadMMin <= 0 ? ['velocidadMMin debe ser mayor a 0.'] : [],
      };
    }

    if (plantilla === PlantillaMaquinaria.REDONDEADORA_PUNTAS) {
      const golpesMinNominal = Math.max(0, this.toSafeNumber(machineParams.golpesMinNominal, 0));
      const esquinasPorPieza = Math.max(1, Math.floor(resolveOverrideNumber('esquinasPorPieza', 1)));
      const piezas = Math.max(1, input.cantidad);
      const golpesTotales = piezas * esquinasPorPieza;
      const golpesMinEfectivos = Math.max(0.01, golpesMinNominal * factorVelocidad);
      return {
        setupMin: Number(input.setupMinBase.toFixed(4)),
        cleanupMin: Number(input.cleanupMinBase.toFixed(4)),
        tiempoFijoMin: Number(input.tiempoFijoMinBase.toFixed(4)),
        runMin: Number((golpesTotales / golpesMinEfectivos).toFixed(4)),
        trace: {
          tipo: 'redondeadora_puntas',
          piezas,
          esquinasPorPieza,
          golpesTotales,
          golpesMinEfectivos: Number(golpesMinEfectivos.toFixed(4)),
        },
        sourceProductividad,
        warnings: golpesMinNominal <= 0 ? ['golpesMinNominal debe ser mayor a 0.'] : [],
      };
    }

    if (plantilla === PlantillaMaquinaria.PERFORADORA) {
      const pliegosMinNominal = Math.max(0, this.toSafeNumber(machineParams.pliegosMinNominal, 0));
      const lineasPorPasadaMax = Math.max(1, Math.floor(this.toSafeNumber(machineParams.lineasPorPasadaMax, 1)));
      const lineasPerforado = Math.max(1, Math.floor(resolveOverrideNumber('lineasPerforado', 1)));
      const hojas = Math.max(1, input.cantidadObjetivoSalida);
      const pasadasPorPliego = Math.max(1, Math.ceil(lineasPerforado / lineasPorPasadaMax));
      const pliegosMinEfectivos = Math.max(0.01, pliegosMinNominal * factorVelocidad);
      return {
        setupMin: Number(input.setupMinBase.toFixed(4)),
        cleanupMin: Number(input.cleanupMinBase.toFixed(4)),
        tiempoFijoMin: Number(input.tiempoFijoMinBase.toFixed(4)),
        runMin: Number(((hojas * pasadasPorPliego) / pliegosMinEfectivos).toFixed(4)),
        trace: {
          tipo: 'perforadora',
          hojas,
          lineasPerforado,
          lineasPorPasadaMax,
          pasadasPorPliego,
          pliegosMinEfectivos: Number(pliegosMinEfectivos.toFixed(4)),
        },
        sourceProductividad,
        warnings: pliegosMinNominal <= 0 ? ['pliegosMinNominal debe ser mayor a 0.'] : [],
      };
    }

    if (!hasPerfil && !hasOverrides) {
      return null;
    }

    return null;
  }

  private calculateLaminadoraFilmConsumables(input: {
    operation: {
      maquinaId: string | null;
      perfilOperativoId: string | null;
      maquina: {
        plantilla: PlantillaMaquinaria;
      } | null;
    };
    consumiblesFilm: Array<{
      maquinaId: string;
      perfilOperativoId: string | null;
      unidad: UnidadConsumoMaquina;
      consumoBase: Prisma.Decimal | null;
      materiaPrimaVariante: {
        sku: string;
        precioReferencia: Prisma.Decimal | null;
        materiaPrima: {
          nombre: string;
        };
      };
    }>;
    timingOverride: { trace?: Record<string, unknown> | null } | null;
    warnings: string[];
  }) {
    if (!input.operation.maquinaId || input.operation.maquina?.plantilla !== PlantillaMaquinaria.LAMINADORA_BOPP_ROLLO) {
      return { materiales: [] as Array<Record<string, unknown>>, costo: 0 };
    }
    const trace = input.timingOverride?.trace ?? null;
    const areaConsumidaM2 = this.toSafeNumber((trace as Record<string, unknown> | null)?.areaConsumidaM2, 0);
    const largoConsumidoMm = this.toSafeNumber((trace as Record<string, unknown> | null)?.largoConsumidoMm, 0);
    if (areaConsumidaM2 <= 0 && largoConsumidoMm <= 0) {
      return { materiales: [] as Array<Record<string, unknown>>, costo: 0 };
    }
    const all = input.consumiblesFilm.filter((item) => item.maquinaId === input.operation.maquinaId);
    const consumibles = input.operation.perfilOperativoId
      ? all.filter((item) => item.perfilOperativoId === input.operation.perfilOperativoId)
      : all;
    if (!consumibles.length) {
      input.warnings.push('Laminadora: no hay consumible FILM configurado para costeo.');
      return { materiales: [] as Array<Record<string, unknown>>, costo: 0 };
    }
    const materiales: Array<Record<string, unknown>> = [];
    let costo = 0;
    for (const item of consumibles) {
      const consumoBase = Number(item.consumoBase ?? 1);
      const factor = consumoBase > 0 ? consumoBase : 1;
      let cantidad = 0;
      let unidad = '';
      if (item.unidad === UnidadConsumoMaquina.M2) {
        cantidad = areaConsumidaM2 * factor;
        unidad = 'm2';
      } else if (item.unidad === UnidadConsumoMaquina.METRO_LINEAL) {
        cantidad = (largoConsumidoMm / 1000) * factor;
        unidad = 'm';
      } else {
        input.warnings.push(
          `Consumible de film ${item.materiaPrimaVariante.sku} con unidad ${item.unidad}: solo M2 o METRO_LINEAL soportado en v1.`,
        );
        continue;
      }
      const costoUnit = Number(item.materiaPrimaVariante.precioReferencia ?? 0);
      const costoLinea = Number((cantidad * costoUnit).toFixed(6));
      costo += costoLinea;
      materiales.push({
        tipo: 'FILM',
        nombre: item.materiaPrimaVariante.materiaPrima.nombre,
        sku: item.materiaPrimaVariante.sku,
        unidad,
        cantidad: Number(cantidad.toFixed(6)),
        costoUnitario: Number(costoUnit.toFixed(6)),
        costo: costoLinea,
      });
    }
    return { materiales, costo: Number(costo.toFixed(6)) };
  }

  private asObject(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {} as Record<string, unknown>;
    }
    return value as Record<string, unknown>;
  }

  private getProcesoOperacionNiveles(value: unknown) {
    const detalle = this.asObject(value);
    const raw = Array.isArray(detalle.niveles) ? detalle.niveles : [];
    return raw
      .map((item, index) => {
        const nivel = this.asObject(item);
        const nombre = String(nivel.nombre ?? '').trim();
        if (!nombre) {
          return null;
        }
        return {
          id: String(nivel.id ?? randomUUID()),
          nombre,
          orden: this.toSafeNumber(nivel.orden, index + 1),
          activo: nivel.activo !== false,
          modoProductividadNivel:
            nivel.modoProductividadNivel === 'variable_manual' ||
            nivel.modoProductividadNivel === 'variable_perfil'
              ? nivel.modoProductividadNivel
              : 'fija',
          tiempoFijoMin:
            nivel.tiempoFijoMin === undefined || nivel.tiempoFijoMin === null
              ? null
              : this.toSafeNumber(nivel.tiempoFijoMin, 0),
          productividadBase:
            nivel.productividadBase === undefined || nivel.productividadBase === null
              ? null
              : this.toSafeNumber(nivel.productividadBase, 0),
          unidadSalida:
            typeof nivel.unidadSalida === 'string' && nivel.unidadSalida.trim().length
              ? nivel.unidadSalida.trim()
              : null,
          unidadTiempo:
            typeof nivel.unidadTiempo === 'string' && nivel.unidadTiempo.trim().length
              ? nivel.unidadTiempo.trim()
              : null,
          maquinaId:
            typeof nivel.maquinaId === 'string' && nivel.maquinaId.trim().length
              ? nivel.maquinaId.trim()
              : null,
          maquinaNombre:
            typeof nivel.maquinaNombre === 'string' && nivel.maquinaNombre.trim().length
              ? nivel.maquinaNombre.trim()
              : '',
          perfilOperativoId:
            typeof nivel.perfilOperativoId === 'string' && nivel.perfilOperativoId.trim().length
              ? nivel.perfilOperativoId.trim()
              : null,
          perfilOperativoNombre:
            typeof nivel.perfilOperativoNombre === 'string' && nivel.perfilOperativoNombre.trim().length
              ? nivel.perfilOperativoNombre.trim()
              : '',
          setupMin:
            nivel.setupMin === undefined || nivel.setupMin === null
              ? null
              : this.toSafeNumber(nivel.setupMin, 0),
          cleanupMin:
            nivel.cleanupMin === undefined || nivel.cleanupMin === null
              ? null
              : this.toSafeNumber(nivel.cleanupMin, 0),
          resumen:
            typeof nivel.resumen === 'string' && nivel.resumen.trim().length
              ? nivel.resumen.trim()
              : this.buildChecklistNivelResumen({
                  nombre,
                  modoProductividadNivel:
                    nivel.modoProductividadNivel === 'variable_manual' ||
                    nivel.modoProductividadNivel === 'variable_perfil'
                      ? nivel.modoProductividadNivel
                      : 'fija',
                  tiempoFijoMin:
                    nivel.tiempoFijoMin === undefined || nivel.tiempoFijoMin === null
                      ? null
                      : this.toSafeNumber(nivel.tiempoFijoMin, 0),
                  productividadBase:
                    nivel.productividadBase === undefined || nivel.productividadBase === null
                      ? null
                      : this.toSafeNumber(nivel.productividadBase, 0),
                  unidadSalida:
                    typeof nivel.unidadSalida === 'string' ? nivel.unidadSalida : null,
                  unidadTiempo:
                    typeof nivel.unidadTiempo === 'string' ? nivel.unidadTiempo : null,
                  perfilOperativoNombre:
                    typeof nivel.perfilOperativoNombre === 'string'
                      ? nivel.perfilOperativoNombre
                      : '',
                }),
          detalle: this.asObject(nivel.detalle),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.orden - b.orden);
  }

  private toSafeNumber(value: unknown, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  private resolveChecklistCantidadObjetivo(input: {
    unidadSalida: string | null;
    cantidad: number;
    pliegos: number;
    areaPiezaM2: number;
    areaPliegoM2: number;
    a4EqFactor: number;
    anchoMm: number;
    altoMm: number;
  }) {
    switch (input.unidadSalida) {
      case 'hoja':
        return input.pliegos;
      case 'm2':
        return Number((input.areaPiezaM2 * input.cantidad).toFixed(6));
      case 'a4_equiv':
        return Number((input.a4EqFactor * input.pliegos).toFixed(6));
      case 'metro_lineal':
        return Number(((Math.max(input.anchoMm, input.altoMm) / 1000) * input.cantidad).toFixed(6));
      case 'pieza':
      case 'corte':
      case 'unidad':
      case 'copia':
      case 'ciclo':
      case 'lote':
      case 'kg':
      case 'litro':
      case 'minuto':
      case 'hora':
      case 'ninguna':
      default:
        return input.cantidad;
    }
  }

  private buildChecklistNivelResumen(input: {
    nombre: string;
    modoProductividadNivel: 'fija' | 'variable_manual' | 'variable_perfil';
    tiempoFijoMin: number | null;
    productividadBase: number | null;
    unidadSalida: string | null;
    unidadTiempo: string | null;
    perfilOperativoNombre: string;
  }) {
    if (input.modoProductividadNivel === 'fija') {
      return `${input.nombre} · ${input.tiempoFijoMin ?? 0} min`;
    }
    if (input.modoProductividadNivel === 'variable_manual') {
      const unidad = [input.unidadSalida, input.unidadTiempo].filter(Boolean).join('/');
      return `${input.nombre} · ${input.productividadBase ?? 0} ${unidad}`.trim();
    }
    return `${input.nombre} · Perfil${input.perfilOperativoNombre ? ` · ${input.perfilOperativoNombre}` : ''}`;
  }

  private async getChecklistPasoPlantillasMap(
    auth: CurrentAuth,
    checklist:
      | {
          preguntas?: Array<{
            respuestas?: Array<{
              reglas?: Array<{
                detalleJson?: Prisma.JsonValue | null;
              }>;
            }>;
          }>;
        }
      | null
      | undefined,
  ) {
    const ids = Array.from(
      new Set(
        (checklist?.preguntas ?? [])
          .flatMap((pregunta) => pregunta.respuestas ?? [])
          .flatMap((respuesta) => respuesta.reglas ?? [])
          .map((regla) => this.getChecklistPasoPlantillaId(regla.detalleJson))
          .filter((value): value is string => Boolean(value)),
      ),
    );
    if (!ids.length) {
      return new Map<string, any>();
    }
    const rows = await this.prisma.procesoOperacionPlantilla.findMany({
      where: {
        tenantId: auth.tenantId,
        id: { in: ids },
      },
      include: {
        centroCosto: true,
        maquina: true,
        perfilOperativo: true,
      },
    });
    return new Map(rows.map((item) => [item.id, item]));
  }

  private getChecklistPasoPlantillaId(value: Prisma.JsonValue | Record<string, unknown> | null | undefined) {
    const detalle = this.asObject(value);
    const pasoPlantillaId = detalle.pasoPlantillaId;
    return typeof pasoPlantillaId === 'string' && pasoPlantillaId.trim().length
      ? pasoPlantillaId.trim()
      : null;
  }

  private resolveChecklistPasoPlantilla(
    value: Prisma.JsonValue | Record<string, unknown> | null | undefined,
    plantillasById: Map<string, any>,
    fallbackProcesoOperacion: any | null,
  ) {
    const pasoPlantillaId = this.getChecklistPasoPlantillaId(value);
    if (pasoPlantillaId) {
      return plantillasById.get(pasoPlantillaId) ?? null;
    }
    return fallbackProcesoOperacion;
  }

  private buildChecklistOperacionFromPlantilla(template: any) {
    const detalleBase = this.asObject(template.detalleJson);
    return {
      id: template.id,
      orden: 0,
      codigo: `CHK-${template.id.slice(0, 6).toUpperCase()}`,
      nombre: template.nombre,
      centroCostoId: template.centroCostoId,
      centroCosto: template.centroCosto,
      maquinaId: template.maquinaId,
      maquina: template.maquina,
      perfilOperativoId: template.perfilOperativoId,
      perfilOperativo: template.perfilOperativo,
      setupMin: template.setupMin,
      runMin: null,
      cleanupMin: template.cleanupMin,
      tiempoFijoMin: template.tiempoFijoMin,
      detalleJson: {
        ...detalleBase,
        pasoPlantillaId: this.getPasoPlantillaIdFromDetalle(template.detalleJson) ?? template.id,
      } as Prisma.JsonObject,
      unidadEntrada: template.unidadEntrada,
      unidadSalida: template.unidadSalida,
      unidadTiempo: template.unidadTiempo,
      productividadBase: template.productividadBase,
      mermaSetup: null,
      mermaRunPct: template.mermaRunPct,
      reglaMermaJson: template.reglaMermaJson,
      reglaVelocidadJson: template.reglaVelocidadJson,
      modoProductividad: template.modoProductividad,
      activo: template.activo,
    };
  }

  private buildChecklistOperacionFromPlantillaConPerfil(template: any, perfilOperativo: any) {
    const detalleBase = this.asObject(template.detalleJson);
    return {
      ...this.buildChecklistOperacionFromPlantilla(template),
      perfilOperativoId: perfilOperativo.id,
      perfilOperativo,
      setupMin:
        perfilOperativo.setupMin !== null && perfilOperativo.setupMin !== undefined
          ? perfilOperativo.setupMin
          : template.setupMin,
      cleanupMin:
        perfilOperativo.cleanupMin !== null && perfilOperativo.cleanupMin !== undefined
          ? perfilOperativo.cleanupMin
          : template.cleanupMin,
      productividadBase:
        perfilOperativo.productivityValue !== null &&
        perfilOperativo.productivityValue !== undefined
          ? perfilOperativo.productivityValue
          : template.productividadBase,
      detalleJson: {
        ...detalleBase,
        pasoPlantillaId: this.getPasoPlantillaIdFromDetalle(template.detalleJson) ?? template.id,
        perfilOperativoId: perfilOperativo.id,
        matchingBase: true,
      },
    };
  }

  private getPasoPlantillaIdFromDetalle(value: Prisma.JsonValue | Record<string, unknown> | null | undefined) {
    const detalle = this.asObject(value);
    const pasoPlantillaId = detalle.pasoPlantillaId;
    return typeof pasoPlantillaId === 'string' && pasoPlantillaId.trim().length
      ? pasoPlantillaId.trim()
      : null;
  }

  private resolvePasoPlantillaIdFromOperacionRuta(
    operacion: {
      nombre?: string | null;
      maquinaId?: string | null;
      perfilOperativoId?: string | null;
      detalleJson?: Prisma.JsonValue | null;
    },
    plantillas: Array<{
      id: string;
      nombre: string;
      maquinaId: string | null;
      perfilOperativoId?: string | null;
      activo?: boolean;
    }>,
  ) {
    const directId = this.getPasoPlantillaIdFromDetalle(operacion.detalleJson ?? null);
    if (directId) {
      return directId;
    }
    const nombre = typeof operacion.nombre === 'string' ? operacion.nombre.trim().toLowerCase() : '';
    const nombreBase = this.normalizePasoNombreBase(operacion.nombre ?? null);
    if (!nombre) return null;
    const exactWithMachine =
      plantillas.find(
        (item) =>
          item.nombre.trim().toLowerCase() === nombre &&
          (item.maquinaId ?? '') === (operacion.maquinaId ?? ''),
      ) ?? null;
    if (exactWithMachine) {
      return exactWithMachine.id;
    }
    const exactWithProfile =
      plantillas.find(
        (item) =>
          Boolean(item.perfilOperativoId) &&
          item.perfilOperativoId === (operacion.perfilOperativoId ?? '') &&
          (item.maquinaId ?? '') === (operacion.maquinaId ?? ''),
      ) ?? null;
    if (exactWithProfile) {
      return exactWithProfile.id;
    }
    const baseWithMachine =
      plantillas.find(
        (item) =>
          this.normalizePasoNombreBase(item.nombre) === nombreBase &&
          (item.maquinaId ?? '') === (operacion.maquinaId ?? ''),
      ) ?? null;
    if (baseWithMachine) {
      return baseWithMachine.id;
    }
    const exact = plantillas.find((item) => item.nombre.trim().toLowerCase() === nombre) ?? null;
    if (exact) {
      return exact.id;
    }
    const base =
      plantillas.find((item) => this.normalizePasoNombreBase(item.nombre) === nombreBase) ?? null;
    return base?.id ?? null;
  }

  private normalizePasoNombreBase(value: string | null | undefined) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!normalized) {
      return '';
    }
    const colonIndex = normalized.indexOf(':');
    if (colonIndex <= 0) {
      return normalized;
    }
    return normalized.slice(0, colonIndex).trim();
  }

  private buildOperacionesCotizadasOrdenadas(
    operacionesBase: any[],
    routeEffects: Array<{
      effect: { id: string; nombre: string };
      insertion: RouteEffectInsertionConfig;
      pasos: any[];
    }>,
    checklistOperaciones: Array<{
      operacion: any;
      insertion: RouteEffectInsertionConfig;
    }>,
    warnings: string[],
  ): any[] {
    const ordered = [...operacionesBase].sort((a, b) => a.orden - b.orden);
    for (const routeEffect of routeEffects) {
      if (!routeEffect.pasos.length) {
        continue;
      }
      const pasosOrdenados = [...routeEffect.pasos].sort((a, b) => a.orden - b.orden);
      let insertIndex = ordered.length;
      if (
        routeEffect.insertion.modo === TipoInsercionRouteEffectDto.before_step ||
        routeEffect.insertion.modo === TipoInsercionRouteEffectDto.after_step
      ) {
        const pasoPlantillaId = routeEffect.insertion.pasoPlantillaId;
        const anchorIndex =
          pasoPlantillaId
            ? ordered.findIndex(
                (item) => this.getPasoPlantillaIdFromDetalle(item.detalleJson ?? null) === pasoPlantillaId,
              )
            : -1;
        if (anchorIndex === -1) {
          warnings.push(
            `Regla de pasos "${routeEffect.effect.nombre}": no se encontró el paso de referencia en la ruta efectiva. Se insertó al final.`,
          );
        } else {
          insertIndex =
            routeEffect.insertion.modo === TipoInsercionRouteEffectDto.before_step
              ? anchorIndex
              : anchorIndex + 1;
        }
      }
      ordered.splice(insertIndex, 0, ...pasosOrdenados);
    }

    for (const checklistItem of [...checklistOperaciones].sort(
      (a, b) => a.operacion.orden - b.operacion.orden,
    )) {
      let insertIndex = ordered.length;
      if (
        checklistItem.insertion.modo === TipoInsercionRouteEffectDto.before_step ||
        checklistItem.insertion.modo === TipoInsercionRouteEffectDto.after_step
      ) {
        const pasoPlantillaId = checklistItem.insertion.pasoPlantillaId;
        const anchorIndex =
          pasoPlantillaId
            ? ordered.findIndex(
                (item) => this.getPasoPlantillaIdFromDetalle(item.detalleJson ?? null) === pasoPlantillaId,
              )
            : -1;
        if (anchorIndex === -1) {
          warnings.push(
            `Configurador "${checklistItem.operacion.nombre}": no se encontró el paso de referencia en la ruta efectiva. Se insertó al final.`,
          );
        } else {
          insertIndex =
            checklistItem.insertion.modo === TipoInsercionRouteEffectDto.before_step
              ? anchorIndex
              : anchorIndex + 1;
        }
      }
      ordered.splice(insertIndex, 0, checklistItem.operacion);
    }

    return ordered.map((item, index) => ({
      ...item,
      orden: index + 1,
    }));
  }

  private buildChecklistPasoSignature(
    item:
      | {
          nombre?: string | null;
          centroCostoId?: string | null;
        }
      | null
      | undefined,
  ) {
    const nombre = typeof item?.nombre === 'string' ? item.nombre.trim().toLowerCase() : '';
    const centroCostoId =
      typeof item?.centroCostoId === 'string' && item.centroCostoId.trim().length
        ? item.centroCostoId.trim()
        : '';
    if (!nombre || !centroCostoId) {
      return null;
    }
    return `${nombre}::${centroCostoId}`;
  }

  private isPasoPlantillaEligibleForMatchingBase(
    pasoPlantilla: { maquinaId?: string | null } | null | undefined,
    maquinasById: Map<string, { plantilla: string }>,
    dimensionesConsumidas: DimensionOpcionProductiva[],
  ) {
    if (!dimensionesConsumidas.length) {
      return true;
    }
    if (!pasoPlantilla?.maquinaId) {
      return false;
    }
    const maquina = maquinasById.get(pasoPlantilla.maquinaId);
    if (!maquina) {
      return false;
    }
    const requiresBasePrintMatching =
      dimensionesConsumidas.includes(DimensionOpcionProductiva.TIPO_IMPRESION) ||
      dimensionesConsumidas.includes(DimensionOpcionProductiva.CARAS);
    if (!requiresBasePrintMatching) {
      return true;
    }
    return maquina.plantilla === PlantillaMaquinaria.IMPRESORA_LASER;
  }

  private getChecklistVariantePasoId(value: Prisma.JsonValue | Record<string, unknown> | null | undefined) {
    const detalle = this.asObject(value);
    const variantePasoId = detalle.variantePasoId;
    return typeof variantePasoId === 'string' && variantePasoId.trim().length
      ? variantePasoId.trim()
      : null;
  }

  private getChecklistVariantePasoNombre(variantePasoId: string | null, detalleJson: Prisma.JsonValue | null) {
    if (!variantePasoId) {
      return '';
    }
    return (
      this.getProcesoOperacionNiveles(detalleJson).find((item) => item.id === variantePasoId)?.nombre ?? ''
    );
  }

  private getChecklistVariantePasoResumen(variantePasoId: string | null, detalleJson: Prisma.JsonValue | null) {
    if (!variantePasoId) {
      return '';
    }
    return (
      this.getProcesoOperacionNiveles(detalleJson).find((item) => item.id === variantePasoId)?.resumen ?? ''
    );
  }

  private getChecklistAtributoTecnicoDimension(
    value: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ) {
    const detalle = this.asObject(value);
    const dimension = detalle.atributoTecnicoDimension;
    return dimension === 'tipo_impresion' || dimension === 'caras' ? dimension : null;
  }

  private getChecklistAtributoTecnicoValor(
    value: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ) {
    const detalle = this.asObject(value);
    const optionValue = detalle.atributoTecnicoValor;
    return optionValue === 'bn' ||
      optionValue === 'cmyk' ||
      optionValue === 'simple_faz' ||
      optionValue === 'doble_faz'
      ? optionValue
      : null;
  }

  private toPrismaUnidadProceso(value: string | UnidadProceso | null) {
    switch (value) {
      case 'hora':
      case UnidadProceso.HORA:
        return UnidadProceso.HORA;
      case 'hoja':
      case UnidadProceso.HOJA:
        return UnidadProceso.HOJA;
      case 'copia':
      case UnidadProceso.COPIA:
        return UnidadProceso.COPIA;
      case 'a4_equiv':
      case UnidadProceso.A4_EQUIV:
        return UnidadProceso.A4_EQUIV;
      case 'm2':
      case UnidadProceso.M2:
        return UnidadProceso.M2;
      case 'metro_lineal':
      case UnidadProceso.METRO_LINEAL:
        return UnidadProceso.METRO_LINEAL;
      case 'pieza':
      case UnidadProceso.PIEZA:
        return UnidadProceso.PIEZA;
      case 'corte':
      case UnidadProceso.CORTE:
        return UnidadProceso.CORTE;
      case 'ciclo':
      case UnidadProceso.CICLO:
        return UnidadProceso.CICLO;
      case 'unidad':
      case UnidadProceso.UNIDAD:
        return UnidadProceso.UNIDAD;
      case 'kg':
      case UnidadProceso.KG:
        return UnidadProceso.KG;
      case 'litro':
      case UnidadProceso.LITRO:
        return UnidadProceso.LITRO;
      case 'lote':
      case UnidadProceso.LOTE:
        return UnidadProceso.LOTE;
      case 'ninguna':
      case UnidadProceso.NINGUNA:
        return UnidadProceso.NINGUNA;
      case 'minuto':
      case UnidadProceso.MINUTO:
      default:
        return UnidadProceso.MINUTO;
    }
  }

  private calculateMachineConsumables(input: {
    operation: {
      maquinaId: string | null;
      perfilOperativoId: string | null;
      productividadBase: Prisma.Decimal | null;
    };
    tipoImpresion: TipoImpresionProductoVariante;
    carasFactor: number;
    pliegos: number;
    pliegosEfectivos?: number;
    areaPliegoM2: number;
    a4EqFactor: number;
    warnings: string[];
    consumibles: Array<{
      maquinaId: string;
      perfilOperativoId: string | null;
      unidad: UnidadConsumoMaquina;
      consumoBase: Prisma.Decimal | null;
      detalleJson: Prisma.JsonValue;
      materiaPrimaVariante: {
        sku: string;
        precioReferencia: Prisma.Decimal | null;
        materiaPrima: {
          nombre: string;
        };
      };
      perfilOperativo: {
        productivityValue: Prisma.Decimal | null;
      } | null;
    }>;
    desgastes: Array<{
      maquinaId: string;
      unidadDesgaste: UnidadDesgasteMaquina;
      vidaUtilEstimada: Prisma.Decimal | null;
      materiaPrimaVariante: {
        sku: string;
        precioReferencia: Prisma.Decimal | null;
        materiaPrima: {
          nombre: string;
        };
      };
    }>;
  }) {
    if (!input.operation.maquinaId) {
      return { costoToner: 0, costoDesgaste: 0, materiales: [] as Array<Record<string, unknown>> };
    }

    const materiales: Array<Record<string, unknown>> = [];
    let costoToner = 0;
    let costoDesgaste = 0;
    const operationProductividad = Number(input.operation.productividadBase ?? 0);
    const machineConsumibles = input.consumibles.filter((item) => item.maquinaId === input.operation.maquinaId);
    const machineDesgastes = input.desgastes.filter((item) => item.maquinaId === input.operation.maquinaId);

    const selectedPerfilId =
      input.operation.perfilOperativoId ??
      machineConsumibles.find(
        (item) =>
          item.perfilOperativo?.productivityValue &&
          Number(item.perfilOperativo.productivityValue) === operationProductividad,
      )?.perfilOperativoId ??
      machineConsumibles[0]?.perfilOperativoId ??
      null;

    const consumibles = selectedPerfilId
      ? machineConsumibles.filter((item) => item.perfilOperativoId === selectedPerfilId)
      : machineConsumibles;
    const tonerConsumibles = consumibles.filter((item) => {
      const detalle = item.detalleJson;
      if (!detalle || typeof detalle !== 'object') {
        return true;
      }
      const tipo = String((detalle as Record<string, unknown>).tipo ?? '').trim().toLowerCase();
      return !tipo || tipo === 'toner';
    });

    const consumiblesByColor = new Map<string, (typeof tonerConsumibles)[number]>();
    for (const item of tonerConsumibles) {
      const color = this.normalizeColor(item.detalleJson);
      if (!consumiblesByColor.has(color)) {
        consumiblesByColor.set(color, item);
      }
    }

    if (tonerConsumibles.length > 0) {
      const selectedColors = input.tipoImpresion === TipoImpresionProductoVariante.BN
        ? ['negro']
        : ['cian', 'magenta', 'amarillo', 'negro'];

      for (const color of selectedColors) {
        const item = consumiblesByColor.get(color);
        if (!item) {
          input.warnings.push(`No se encontró consumible de tóner para el canal ${color}.`);
          continue;
        }
        if (item.unidad !== UnidadConsumoMaquina.GRAMO) {
          input.warnings.push(
            `Consumible ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) con unidad ${item.unidad}: v1 solo soporta GRAMO.`,
          );
          continue;
        }
      const consumoBase = Number(item.consumoBase ?? 0);
      if (consumoBase <= 0) {
          input.warnings.push(
            `Consumible ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) sin consumoBase válido.`,
          );
          continue;
        }
        const costoGramo = Number(item.materiaPrimaVariante.precioReferencia ?? 0);
        if (!item.materiaPrimaVariante.precioReferencia) {
          input.warnings.push(
            `Consumible ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) sin precio de referencia. Se usa 0.`,
          );
        }
      const pliegosBase = Math.max(0, input.pliegos);
      const pliegosEfectivos = Math.max(pliegosBase, input.pliegosEfectivos ?? pliegosBase);
      const pliegosMermaOperativa = Math.max(0, pliegosEfectivos - pliegosBase);
      const gramosBase = consumoBase * input.areaPliegoM2 * input.carasFactor * pliegosBase;
      const costoBase = gramosBase * costoGramo;
      costoToner += costoBase;
      materiales.push({
        tipo: 'TONER',
        canal: color,
        nombre: item.materiaPrimaVariante.materiaPrima.nombre,
        sku: item.materiaPrimaVariante.sku,
        unidad: 'g',
        cantidad: Number(gramosBase.toFixed(6)),
        costoUnitario: costoGramo,
        costo: Number(costoBase.toFixed(6)),
        origen: 'Base',
      });
      if (pliegosMermaOperativa > 0) {
        const gramosMerma = consumoBase * input.areaPliegoM2 * input.carasFactor * pliegosMermaOperativa;
        const costoMerma = gramosMerma * costoGramo;
        costoToner += costoMerma;
        materiales.push({
          tipo: 'TONER',
          canal: color,
          nombre: item.materiaPrimaVariante.materiaPrima.nombre,
          sku: item.materiaPrimaVariante.sku,
          unidad: 'g',
          cantidad: Number(gramosMerma.toFixed(6)),
          costoUnitario: costoGramo,
          costo: Number(costoMerma.toFixed(6)),
          origen: 'Merma operativa',
        });
      }
    }
    }

    for (const item of machineDesgastes) {
      if (item.unidadDesgaste !== UnidadDesgasteMaquina.COPIAS_A4_EQUIV) {
        input.warnings.push(
          `Componente de desgaste ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) con unidad ${item.unidadDesgaste}: v1 solo soporta COPIAS_A4_EQUIV.`,
        );
        continue;
      }
      const vidaUtil = Number(item.vidaUtilEstimada ?? 0);
      if (vidaUtil <= 0) {
        input.warnings.push(
          `Componente de desgaste ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) sin vida útil estimada válida.`,
        );
        continue;
      }
      const precio = Number(item.materiaPrimaVariante.precioReferencia ?? 0);
      if (!item.materiaPrimaVariante.precioReferencia) {
        input.warnings.push(
          `Componente de desgaste ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) sin precio de referencia. Se usa 0.`,
        );
      }
      const pliegosBase = Math.max(0, input.pliegos);
      const pliegosEfectivos = Math.max(pliegosBase, input.pliegosEfectivos ?? pliegosBase);
      const pliegosMermaOperativa = Math.max(0, pliegosEfectivos - pliegosBase);
      const cantidadA4EqBase = pliegosBase * input.a4EqFactor * input.carasFactor;
      const costoUnitario = precio / vidaUtil;
      const costoBase = cantidadA4EqBase * costoUnitario;
      costoDesgaste += costoBase;
      materiales.push({
        tipo: 'DESGASTE',
        nombre: item.materiaPrimaVariante.materiaPrima.nombre,
        sku: item.materiaPrimaVariante.sku,
        unidad: 'a4_eq',
        cantidad: Number(cantidadA4EqBase.toFixed(6)),
        costoUnitario: Number(costoUnitario.toFixed(6)),
        costo: Number(costoBase.toFixed(6)),
        origen: 'Base',
      });
      if (pliegosMermaOperativa > 0) {
        const cantidadA4EqMerma = pliegosMermaOperativa * input.a4EqFactor * input.carasFactor;
        const costoMerma = cantidadA4EqMerma * costoUnitario;
        costoDesgaste += costoMerma;
        materiales.push({
          tipo: 'DESGASTE',
          nombre: item.materiaPrimaVariante.materiaPrima.nombre,
          sku: item.materiaPrimaVariante.sku,
          unidad: 'a4_eq',
          cantidad: Number(cantidadA4EqMerma.toFixed(6)),
          costoUnitario: Number(costoUnitario.toFixed(6)),
          costo: Number(costoMerma.toFixed(6)),
          origen: 'Merma operativa',
        });
      }
    }

    return { costoToner, costoDesgaste, materiales };
  }

  private normalizeColor(detalleJson: Prisma.JsonValue) {
    if (!detalleJson || typeof detalleJson !== 'object') {
      return 'desconocido';
    }
    const color = String((detalleJson as Record<string, unknown>).color ?? '').trim().toLowerCase();
    if (!color) {
      return 'desconocido';
    }
    if (color === 'black' || color === 'k') {
      return 'negro';
    }
    return color;
  }

  private getSetupFromPerfilOperativo(
    perfil:
      | {
          setupMin: Prisma.Decimal | null;
          cleanupMin: Prisma.Decimal | null;
          detalleJson: Prisma.JsonValue;
        }
      | null
      | undefined,
  ) {
    if (!perfil) {
      return null;
    }

    const detalle =
      perfil.detalleJson &&
      typeof perfil.detalleJson === 'object' &&
      !Array.isArray(perfil.detalleJson)
        ? (perfil.detalleJson as Record<string, unknown>)
        : {};

    const values: number[] = [];
    const pushIfFinite = (value: unknown) => {
      const numeric = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        values.push(numeric);
      }
    };

    pushIfFinite(perfil.setupMin ? Number(perfil.setupMin) : null);

    const objectCandidates = [
      detalle.setupComponentesMin,
      detalle.setupExtraComponentesMin,
      detalle.tiemposSetupExtraMin,
    ];
    for (const candidate of objectCandidates) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        continue;
      }
      for (const value of Object.values(candidate as Record<string, unknown>)) {
        pushIfFinite(value);
      }
    }

    const arrayCandidates = [detalle.setupExtrasMin, detalle.tiemposExtraSetupMin];
    for (const candidate of arrayCandidates) {
      if (!Array.isArray(candidate)) {
        continue;
      }
      for (const value of candidate) {
        pushIfFinite(value);
      }
    }

    if (!values.length) {
      return null;
    }
    return Number(values.reduce((acc, item) => acc + item, 0).toFixed(4));
  }

  private groupOpcionesProductivas(
    values: Array<{
      dimension: DimensionOpcionProductiva;
      valor: ValorOpcionProductiva;
      orden: number;
    }>,
  ) {
    const map = new Map<DimensionOpcionProductivaDto, Array<{ value: ValorOpcionProductivaDto; order: number }>>();
    for (const item of values) {
      const dimension = this.fromDimensionOpcionProductiva(item.dimension);
      const value = this.fromValorOpcionProductiva(item.valor);
      const arr = map.get(dimension) ?? [];
      arr.push({ value, order: item.orden });
      map.set(dimension, arr);
    }
    return Array.from(map.entries()).map(([dimension, items]) => ({
      dimension,
      valores: items
        .sort((a, b) => a.order - b.order)
        .map((item) => item.value),
    }));
  }

  private resolveEffectiveOptionValues(variante: {
    tipoImpresion: TipoImpresionProductoVariante;
    caras: CarasProductoVariante;
    opcionesProductivasSet?: {
      valores: Array<{
        dimension: DimensionOpcionProductiva;
        valor: ValorOpcionProductiva;
      }>;
    } | null;
  }) {
    const fromSet = variante.opcionesProductivasSet?.valores ?? [];
    const grouped = new Map<DimensionOpcionProductiva, Set<ValorOpcionProductiva>>();
    for (const value of fromSet) {
      const set = grouped.get(value.dimension) ?? new Set<ValorOpcionProductiva>();
      set.add(value.valor);
      grouped.set(value.dimension, set);
    }
    if (grouped.size === 0) {
      grouped.set(
        DimensionOpcionProductiva.TIPO_IMPRESION,
        new Set([this.toValorFromTipoImpresion(variante.tipoImpresion)]),
      );
      grouped.set(
        DimensionOpcionProductiva.CARAS,
        new Set([this.toValorFromCaras(variante.caras)]),
      );
    }
    return grouped;
  }

  private isAddonEffectScopeMatch(params: {
    effect: {
      scopes: Array<{
        productoVarianteId: string | null;
        dimension: DimensionOpcionProductiva | null;
        valor: ValorOpcionProductiva | null;
      }>;
    };
    varianteId: string;
    opcionesProductivas: Map<DimensionOpcionProductiva, Set<ValorOpcionProductiva>>;
  }) {
    if (!params.effect.scopes.length) {
      return true;
    }
    return params.effect.scopes.some((scope) => {
      if (scope.productoVarianteId && scope.productoVarianteId !== params.varianteId) {
        return false;
      }
      if (scope.dimension && scope.valor) {
        const values = params.opcionesProductivas.get(scope.dimension);
        if (!values?.has(scope.valor)) {
          return false;
        }
      }
      return true;
    });
  }

  private assertScopeDimensionMatchesValue(
    dimension: DimensionOpcionProductivaDto,
    value: ValorOpcionProductivaDto,
  ) {
    if (
      dimension === DimensionOpcionProductivaDto.tipo_impresion &&
      value !== ValorOpcionProductivaDto.bn &&
      value !== ValorOpcionProductivaDto.cmyk
    ) {
      throw new BadRequestException('Valor inválido para dimensión tipo_impresion.');
    }
    if (
      dimension === DimensionOpcionProductivaDto.caras &&
      value !== ValorOpcionProductivaDto.simple_faz &&
      value !== ValorOpcionProductivaDto.doble_faz
    ) {
      throw new BadRequestException('Valor inválido para dimensión caras.');
    }
  }

  private toDimensionOpcionProductiva(value: DimensionOpcionProductivaDto) {
    if (value === DimensionOpcionProductivaDto.caras) {
      return DimensionOpcionProductiva.CARAS;
    }
    return DimensionOpcionProductiva.TIPO_IMPRESION;
  }

  private fromDimensionOpcionProductiva(value: DimensionOpcionProductiva) {
    if (value === DimensionOpcionProductiva.CARAS) {
      return DimensionOpcionProductivaDto.caras;
    }
    return DimensionOpcionProductivaDto.tipo_impresion;
  }

  private toValorOpcionProductiva(value: ValorOpcionProductivaDto) {
    if (value === ValorOpcionProductivaDto.bn) {
      return ValorOpcionProductiva.BN;
    }
    if (value === ValorOpcionProductivaDto.simple_faz) {
      return ValorOpcionProductiva.SIMPLE_FAZ;
    }
    if (value === ValorOpcionProductivaDto.doble_faz) {
      return ValorOpcionProductiva.DOBLE_FAZ;
    }
    return ValorOpcionProductiva.CMYK;
  }

  private fromValorOpcionProductiva(value: ValorOpcionProductiva) {
    if (value === ValorOpcionProductiva.BN) {
      return ValorOpcionProductivaDto.bn;
    }
    if (value === ValorOpcionProductiva.SIMPLE_FAZ) {
      return ValorOpcionProductivaDto.simple_faz;
    }
    if (value === ValorOpcionProductiva.DOBLE_FAZ) {
      return ValorOpcionProductivaDto.doble_faz;
    }
    return ValorOpcionProductivaDto.cmyk;
  }

  private toValorFromTipoImpresion(value: TipoImpresionProductoVariante) {
    if (value === TipoImpresionProductoVariante.BN) {
      return ValorOpcionProductiva.BN;
    }
    return ValorOpcionProductiva.CMYK;
  }

  private toValorFromCaras(value: CarasProductoVariante) {
    if (value === CarasProductoVariante.DOBLE_FAZ) {
      return ValorOpcionProductiva.DOBLE_FAZ;
    }
    return ValorOpcionProductiva.SIMPLE_FAZ;
  }

  private toTipoImpresionFromValor(value: ValorOpcionProductiva) {
    if (value === ValorOpcionProductiva.BN) {
      return TipoImpresionProductoVariante.BN;
    }
    return TipoImpresionProductoVariante.CMYK;
  }

  private toCarasFromValor(value: ValorOpcionProductiva) {
    if (value === ValorOpcionProductiva.DOBLE_FAZ) {
      return CarasProductoVariante.DOBLE_FAZ;
    }
    return CarasProductoVariante.SIMPLE_FAZ;
  }

  private toTipoAdicionalEfecto(value: TipoProductoAdicionalEfectoDto) {
    if (value === TipoProductoAdicionalEfectoDto.cost_effect) {
      return TipoProductoAdicionalEfecto.COST_EFFECT;
    }
    if (value === TipoProductoAdicionalEfectoDto.material_effect) {
      return TipoProductoAdicionalEfecto.MATERIAL_EFFECT;
    }
    return TipoProductoAdicionalEfecto.ROUTE_EFFECT;
  }

  private fromTipoAdicionalEfecto(value: TipoProductoAdicionalEfecto) {
    if (value === TipoProductoAdicionalEfecto.COST_EFFECT) {
      return TipoProductoAdicionalEfectoDto.cost_effect;
    }
    if (value === TipoProductoAdicionalEfecto.MATERIAL_EFFECT) {
      return TipoProductoAdicionalEfectoDto.material_effect;
    }
    return TipoProductoAdicionalEfectoDto.route_effect;
  }

  private toReglaCostoAdicionalEfecto(value: ReglaCostoAdicionalEfectoDto) {
    if (value === ReglaCostoAdicionalEfectoDto.por_unidad) {
      return ReglaCostoAdicionalEfecto.POR_UNIDAD;
    }
    if (value === ReglaCostoAdicionalEfectoDto.por_pliego) {
      return ReglaCostoAdicionalEfecto.POR_PLIEGO;
    }
    if (value === ReglaCostoAdicionalEfectoDto.porcentaje_sobre_total) {
      return ReglaCostoAdicionalEfecto.PORCENTAJE_SOBRE_TOTAL;
    }
    if (value === ReglaCostoAdicionalEfectoDto.tiempo_extra_min) {
      return ReglaCostoAdicionalEfecto.TIEMPO_EXTRA_MIN;
    }
    return ReglaCostoAdicionalEfecto.FLAT;
  }

  private fromReglaCostoAdicionalEfecto(value: ReglaCostoAdicionalEfecto) {
    if (value === ReglaCostoAdicionalEfecto.POR_UNIDAD) {
      return ReglaCostoAdicionalEfectoDto.por_unidad;
    }
    if (value === ReglaCostoAdicionalEfecto.POR_PLIEGO) {
      return ReglaCostoAdicionalEfectoDto.por_pliego;
    }
    if (value === ReglaCostoAdicionalEfecto.PORCENTAJE_SOBRE_TOTAL) {
      return ReglaCostoAdicionalEfectoDto.porcentaje_sobre_total;
    }
    if (value === ReglaCostoAdicionalEfecto.TIEMPO_EXTRA_MIN) {
      return ReglaCostoAdicionalEfectoDto.tiempo_extra_min;
    }
    return ReglaCostoAdicionalEfectoDto.flat;
  }

  private toTipoChecklistPregunta(value: TipoChecklistPreguntaDto) {
    if (value === TipoChecklistPreguntaDto.single_select) {
      return TipoProductoChecklistPregunta.SINGLE_SELECT;
    }
    return TipoProductoChecklistPregunta.BINARIA;
  }

  private fromTipoChecklistPregunta(value: TipoProductoChecklistPregunta) {
    if (value === TipoProductoChecklistPregunta.SINGLE_SELECT) {
      return TipoChecklistPreguntaDto.single_select;
    }
    return TipoChecklistPreguntaDto.binaria;
  }

  private toTipoChecklistAccion(value: TipoChecklistAccionReglaDto) {
    if (value === TipoChecklistAccionReglaDto.seleccionar_variante_paso) {
      return TipoProductoChecklistReglaAccion.SELECCIONAR_VARIANTE_PASO;
    }
    if (value === TipoChecklistAccionReglaDto.costo_extra) {
      return TipoProductoChecklistReglaAccion.COSTO_EXTRA;
    }
    if (value === TipoChecklistAccionReglaDto.material_extra) {
      return TipoProductoChecklistReglaAccion.MATERIAL_EXTRA;
    }
    if (value === TipoChecklistAccionReglaDto.set_atributo_tecnico) {
      return TipoProductoChecklistReglaAccion.SET_ATRIBUTO_TECNICO;
    }
    return TipoProductoChecklistReglaAccion.ACTIVAR_PASO;
  }

  private fromTipoChecklistAccion(value: TipoProductoChecklistReglaAccion) {
    if (value === TipoProductoChecklistReglaAccion.SELECCIONAR_VARIANTE_PASO) {
      return TipoChecklistAccionReglaDto.seleccionar_variante_paso;
    }
    if (value === TipoProductoChecklistReglaAccion.COSTO_EXTRA) {
      return TipoChecklistAccionReglaDto.costo_extra;
    }
    if (value === TipoProductoChecklistReglaAccion.MATERIAL_EXTRA) {
      return TipoChecklistAccionReglaDto.material_extra;
    }
    if (value === TipoProductoChecklistReglaAccion.SET_ATRIBUTO_TECNICO) {
      return TipoChecklistAccionReglaDto.set_atributo_tecnico;
    }
    return TipoChecklistAccionReglaDto.activar_paso;
  }

  private toReglaCostoChecklist(value: ReglaCostoChecklistDto) {
    if (value === ReglaCostoChecklistDto.tiempo_min) {
      return ReglaCostoChecklist.TIEMPO_MIN;
    }
    if (value === ReglaCostoChecklistDto.por_unidad) {
      return ReglaCostoChecklist.POR_UNIDAD;
    }
    if (value === ReglaCostoChecklistDto.por_pliego) {
      return ReglaCostoChecklist.POR_PLIEGO;
    }
    if (value === ReglaCostoChecklistDto.porcentaje_sobre_total) {
      return ReglaCostoChecklist.PORCENTAJE_SOBRE_TOTAL;
    }
    return ReglaCostoChecklist.FLAT;
  }

  private fromReglaCostoChecklist(value: ReglaCostoChecklist) {
    if (value === ReglaCostoChecklist.TIEMPO_MIN) {
      return ReglaCostoChecklistDto.tiempo_min;
    }
    if (value === ReglaCostoChecklist.POR_UNIDAD) {
      return ReglaCostoChecklistDto.por_unidad;
    }
    if (value === ReglaCostoChecklist.POR_PLIEGO) {
      return ReglaCostoChecklistDto.por_pliego;
    }
    if (value === ReglaCostoChecklist.PORCENTAJE_SOBRE_TOTAL) {
      return ReglaCostoChecklistDto.porcentaje_sobre_total;
    }
    return ReglaCostoChecklistDto.flat;
  }

  private toTipoImpresion(value: TipoImpresionProductoVarianteDto) {
    if (value === TipoImpresionProductoVarianteDto.bn) {
      return TipoImpresionProductoVariante.BN;
    }
    return TipoImpresionProductoVariante.CMYK;
  }

  private fromTipoImpresion(value: TipoImpresionProductoVariante) {
    if (value === TipoImpresionProductoVariante.BN) {
      return TipoImpresionProductoVarianteDto.bn;
    }
    return TipoImpresionProductoVarianteDto.cmyk;
  }

  private toCaras(value: CarasProductoVarianteDto) {
    if (value === CarasProductoVarianteDto.doble_faz) {
      return CarasProductoVariante.DOBLE_FAZ;
    }
    return CarasProductoVariante.SIMPLE_FAZ;
  }

  private fromCaras(value: CarasProductoVariante) {
    if (value === CarasProductoVariante.DOBLE_FAZ) {
      return CarasProductoVarianteDto.doble_faz;
    }
    return CarasProductoVarianteDto.simple_faz;
  }

  private toTipoProducto(value: TipoProductoServicioDto) {
    if (value === TipoProductoServicioDto.servicio) {
      return TipoProductoServicio.SERVICIO;
    }
    return TipoProductoServicio.PRODUCTO;
  }

  private fromTipoProducto(value: TipoProductoServicio) {
    void value;
    return TipoProductoServicioDto.producto;
  }

  private toEstadoProducto(value: EstadoProductoServicioDto) {
    if (value === EstadoProductoServicioDto.inactivo) {
      return EstadoProductoServicio.INACTIVO;
    }
    return EstadoProductoServicio.ACTIVO;
  }

  private fromEstadoProducto(value: EstadoProductoServicio) {
    if (value === EstadoProductoServicio.INACTIVO) {
      return EstadoProductoServicioDto.inactivo;
    }
    return EstadoProductoServicioDto.activo;
  }

  private toNullableJson(value: Record<string, unknown> | undefined) {
    if (!value) {
      return Prisma.JsonNull;
    }
    return value as Prisma.InputJsonValue;
  }

  private toTipoAdicional(value: TipoProductoAdicionalDto) {
    if (value === TipoProductoAdicionalDto.acabado) {
      return TipoProductoAdicional.ACABADO;
    }
    return TipoProductoAdicional.SERVICIO;
  }

  private fromTipoAdicional(value: TipoProductoAdicional) {
    if (value === TipoProductoAdicional.ACABADO) {
      return TipoProductoAdicionalDto.acabado;
    }
    return TipoProductoAdicionalDto.servicio;
  }

  private toMetodoCostoAdicional(value: MetodoCostoProductoAdicionalDto) {
    if (value === MetodoCostoProductoAdicionalDto.time_plus_material) {
      return MetodoCostoProductoAdicional.TIME_PLUS_MATERIAL;
    }
    return MetodoCostoProductoAdicional.TIME_ONLY;
  }

  private fromMetodoCostoAdicional(value: MetodoCostoProductoAdicional) {
    if (value === MetodoCostoProductoAdicional.TIME_PLUS_MATERIAL) {
      return MetodoCostoProductoAdicionalDto.time_plus_material;
    }
    return MetodoCostoProductoAdicionalDto.time_only;
  }

  private toTipoConsumoAdicionalMaterial(value: TipoConsumoAdicionalMaterialDto) {
    if (value === TipoConsumoAdicionalMaterialDto.por_pliego) {
      return TipoConsumoAdicionalMaterial.POR_PLIEGO;
    }
    if (value === TipoConsumoAdicionalMaterialDto.por_m2) {
      return TipoConsumoAdicionalMaterial.POR_M2;
    }
    return TipoConsumoAdicionalMaterial.POR_UNIDAD;
  }

  private fromTipoConsumoAdicionalMaterial(value: TipoConsumoAdicionalMaterial) {
    if (value === TipoConsumoAdicionalMaterial.POR_PLIEGO) {
      return TipoConsumoAdicionalMaterialDto.por_pliego;
    }
    if (value === TipoConsumoAdicionalMaterial.POR_M2) {
      return TipoConsumoAdicionalMaterialDto.por_m2;
    }
    return TipoConsumoAdicionalMaterialDto.por_unidad;
  }

  private handleWriteError(error: unknown): never {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Ya existe un registro con esa clave unica.');
      }
      if (error.code === 'P2003') {
        throw new BadRequestException('Referencia invalida para la operacion solicitada.');
      }
    }

    throw error;
  }
}
