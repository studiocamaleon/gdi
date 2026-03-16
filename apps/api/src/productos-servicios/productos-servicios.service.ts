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
  ReglaCostoAdicionalEfecto,
  MetodoCostoProductoAdicional,
  Prisma,
  TipoProductoAdicionalEfecto,
  TipoConsumoAdicionalMaterial,
  TipoConsumibleMaquina,
  TipoProductoAdicional,
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
  UpsertProductoAdicionalServicioPricingDto,
  UpsertVarianteOpcionesProductivasDto,
  UpsertProductoAdicionalDto,
  PreviewImposicionProductoVarianteDto,
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
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  async findProducto(auth: CurrentAuth, id: string) {
    const item = await this.findProductoOrThrow(auth, id, this.prisma);

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
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
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

    await this.prisma.$transaction(async (tx) => {
      await tx.productoServicio.update({
        where: { id: producto.id },
        data: {
          usarRutaComunVariantes: payload.usarRutaComunVariantes,
          procesoDefinicionDefaultId: procesoDefaultId,
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
    await this.validateAdicionalEfectoPayload(auth, payload, this.prisma);
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
    await this.validateAdicionalEfectoPayload(auth, payload, this.prisma);
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
    const addonSelectionInput = Array.from(new Set(payload.addonsSeleccionados ?? []));
    const addonConfigInput = Array.from(
      new Map((payload.addonsConfig ?? []).map((item) => [item.addonId, item])).values(),
    );
    const addonById = new Map(
      variante.productoServicio.adicionalesAsignados
        .filter((item) => item.activo)
        .map((item) => [item.productoAdicionalId, item]),
    );
    const restrictionsByAddon = new Map(
      variante.adicionalesRestricciones.map((item) => [item.productoAdicionalId, item.permitido]),
    );
    for (const addonId of addonSelectionInput) {
      if (!addonById.has(addonId)) {
        throw new BadRequestException('Uno de los adicionales seleccionados no está asignado al producto.');
      }
      if (restrictionsByAddon.get(addonId) === false) {
        throw new BadRequestException('Uno de los adicionales seleccionados está restringido para la variante.');
      }
    }
    const addonConfigById = new Map(addonConfigInput.map((item) => [item.addonId, item]));
    const addonConfigTrace = addonConfigInput.map((item) => ({
      addonId: item.addonId,
      nivelId: item.nivelId ?? null,
    }));
    for (const configItem of addonConfigInput) {
      if (!addonById.has(configItem.addonId)) {
        throw new BadRequestException('Uno de los addons configurados no está asignado al producto.');
      }
      if (restrictionsByAddon.get(configItem.addonId) === false) {
        throw new BadRequestException('Uno de los addons configurados está restringido para la variante.');
      }
    }
    const opcionProductivaEfectiva = this.resolveEffectiveOptionValues(variante);
    const addonEffectsRaw =
      addonSelectionInput.length > 0
        ? await this.prisma.productoAdicionalEfecto.findMany({
            where: {
              tenantId: auth.tenantId,
              activo: true,
              productoAdicionalId: {
                in: addonSelectionInput,
              },
            },
            include: this.getAdicionalEfectoInclude(),
          })
        : [];
    const efectosAplicados = addonEffectsRaw
      .filter((effect) =>
        this.isAddonEffectScopeMatch({
          effect,
          varianteId: variante.id,
          opcionesProductivas: opcionProductivaEfectiva,
        }),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const routeEffectsAplicados = efectosAplicados.filter(
      (item) => item.tipo === TipoProductoAdicionalEfecto.ROUTE_EFFECT && item.routeEffect,
    );
    const servicePricingByAddon = new Map<string, ServicioPricingConfig>();
    for (const addonId of addonSelectionInput) {
      const addon = addonById.get(addonId)?.productoAdicional;
      if (!addon || addon.tipo !== TipoProductoAdicional.SERVICIO) continue;
      const parsedPricing = this.parseServicioPricing(addon.metadataJson);
      if (parsedPricing.niveles.length && parsedPricing.reglas.length) {
        servicePricingByAddon.set(addonId, parsedPricing);
      }
    }
    const costEffectsAplicados = efectosAplicados.filter((item) => {
      if (!(item.tipo === TipoProductoAdicionalEfecto.COST_EFFECT && item.costEffect)) {
        return false;
      }
      return !servicePricingByAddon.has(item.productoAdicionalId);
    });
    const materialEffectsAplicados = efectosAplicados.filter(
      (item) => item.tipo === TipoProductoAdicionalEfecto.MATERIAL_EFFECT && item.materialEffect,
    );
    const addonsSeleccionadosSet = new Set(addonSelectionInput);
    const operacionesBaseCotizadas = proceso.operaciones.filter((op) => {
      if (!op.requiresProductoAdicionalId) return true;
      // Evita doble costeo cuando el adicional usa pricing de servicio por nivel:
      // en ese caso el costo lo agrega servicePricing (línea sintética), no la ruta legacy.
      if (servicePricingByAddon.has(op.requiresProductoAdicionalId)) return false;
      return addonsSeleccionadosSet.has(op.requiresProductoAdicionalId);
    });
    const maxOrdenBase = operacionesBaseCotizadas.reduce((acc, item) => Math.max(acc, item.orden), 0);
    const operacionesRouteEffect = routeEffectsAplicados.flatMap((effect, effectIndex) =>
      (effect.routeEffect?.pasos ?? []).map((paso, pasoIndex) => ({
        id: paso.id,
        orden: maxOrdenBase + 1 + effectIndex * 1000 + pasoIndex,
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
        unidadEntrada: UnidadProceso.NINGUNA,
        unidadSalida: UnidadProceso.NINGUNA,
        unidadTiempo: UnidadProceso.MINUTO,
        productividadBase: null,
        mermaSetup: null,
        mermaRunPct: null,
        reglaMermaJson: null,
        requiresProductoAdicionalId: effect.productoAdicionalId,
      })),
    );
    const operacionesCotizadas = [...operacionesBaseCotizadas, ...operacionesRouteEffect].sort(
      (a, b) => a.orden - b.orden,
    );
    if (operacionesCotizadas.length === 0) {
      throw new BadRequestException('La ruta no tiene pasos activos para la selección de adicionales.');
    }

    const centrosCostEffect = costEffectsAplicados
      .map((item) => item.costEffect?.centroCostoId)
      .filter((value): value is string => Boolean(value));
    const centrosServicePricing = addonSelectionInput
      .map((addonId) => {
        if (!servicePricingByAddon.has(addonId)) return null;
        return addonById.get(addonId)?.productoAdicional?.centroCostoId ?? null;
      })
      .filter((value): value is string => Boolean(value));
    const centroIds = Array.from(
      new Set([
        ...operacionesCotizadas.map((item) => item.centroCostoId),
        ...centrosCostEffect,
        ...centrosServicePricing,
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
    const warnings: string[] = [];
    if (!variante.papelVariante.precioReferencia) {
      warnings.push('El papel asignado no tiene precio de referencia. Se uso 0 para costo de papel.');
    }

    const materiales: Array<Record<string, unknown>> = [];
    let costoToner = 0;
    let costoDesgaste = 0;

    const areaPliegoM2 = (pliegoImpresion.anchoMm / 1000) * (pliegoImpresion.altoMm / 1000);
    const a4EqFactor = areaPliegoM2 / ProductosServiciosService.DEFAULT_A4_AREA_M2;
    const carasFactor = variante.caras === CarasProductoVariante.DOBLE_FAZ ? 2 : 1;
    const machineIds = Array.from(
      new Set(
        operacionesCotizadas
          .map((op) => op.maquinaId)
          .filter((item): item is string => Boolean(item)),
      ),
    );
    const [consumibles, desgastes] = await Promise.all([
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

    const pasos = operacionesCotizadas.map((op) => {
      const setupMin = Number(op.setupMin ?? this.getSetupFromPerfilOperativo(op.perfilOperativo) ?? 0);
      const cleanupMin = Number(op.cleanupMin ?? 0);
      const tiempoFijoMin = Number(op.tiempoFijoMin ?? 0);
      const usarTiempoFijoManual = tiempoFijoMin > 0;
      const cantidadObjetivoSalida =
        op.unidadEntrada === UnidadProceso.HOJA ||
        op.unidadSalida === UnidadProceso.HOJA
          ? pliegos
          : cantidad;
      let runMin = Number(op.runMin ?? 0);
      if (!usarTiempoFijoManual) {
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
        for (const warning of productividad.warnings) {
          warnings.push(`Paso ${op.codigo} (${op.nombre}): ${warning}`);
        }
      }

      if (op.maquinaId) {
        const tonerAndWear = this.calculateMachineConsumables({
          operation: op,
          tipoImpresion: variante.tipoImpresion,
          carasFactor,
          pliegos,
          areaPliegoM2,
          a4EqFactor,
          warnings,
          consumibles,
          desgastes,
        });
        costoToner += tonerAndWear.costoToner;
        costoDesgaste += tonerAndWear.costoDesgaste;
        materiales.push(...tonerAndWear.materiales);
      }

      const totalMin = setupMin + runMin + cleanupMin + tiempoFijoMin;
      const tarifa = tarifaByCentro.get(op.centroCostoId)!;
      const costoPaso = Number(tarifa.mul(totalMin / 60).toFixed(6));
      const esAdicional = Boolean(op.requiresProductoAdicionalId);
      const addonAsociado = op.requiresProductoAdicionalId
        ? addonById.get(op.requiresProductoAdicionalId)
        : null;
      return {
        orden: op.orden,
        codigo: op.codigo,
        nombre: op.nombre,
        centroCostoId: op.centroCostoId,
        centroCostoNombre: op.centroCosto.nombre,
        origen: esAdicional
          ? `Adicional:${addonAsociado?.productoAdicional?.nombre ?? op.requiresProductoAdicionalId}`
          : 'Base',
        addonId: op.requiresProductoAdicionalId ?? null,
        setupMin,
        runMin,
        cleanupMin,
        tiempoFijoMin,
        totalMin: Number(totalMin.toFixed(4)),
        tarifaHora: Number(tarifa),
        costo: costoPaso,
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
        const base = costoPapel + costoToner + costoDesgaste + costoProcesos + costoAdicionalesMateriales + costoAdicionalesCostEffects;
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
        adicionalesMateriales: Number(costoAdicionalesMateriales.toFixed(6)),
        adicionalesCostEffects: Number(costoAdicionalesCostEffects.toFixed(6)),
      },
      total,
      unitario,
      trazabilidad: {
        imposicion,
        conversionPapel,
        addonsSeleccionados: addonSelectionInput,
        addonsConfig: addonConfigTrace,
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
        inputJson: {
          cantidad,
          periodo,
          config,
          addonsSeleccionados: addonSelectionInput,
          addonsConfig: addonConfigTrace,
        } as Prisma.InputJsonValue,
        resultadoJson: result as Prisma.InputJsonValue,
        total: new Prisma.Decimal(total),
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
      for (const paso of payload.routeEffect.pasos) {
        await this.findCentroCostoOrThrow(auth, paso.centroCostoId, tx);
        if (paso.maquinaId) {
          const maq = await tx.maquina.findFirst({
            where: { tenantId: auth.tenantId, id: paso.maquinaId },
            select: { id: true },
          });
          if (!maq) {
            throw new NotFoundException('Máquina no encontrada para un paso del route_effect.');
          }
        }
        if (paso.perfilOperativoId) {
          const perfil = await tx.maquinaPerfilOperativo.findFirst({
            where: { tenantId: auth.tenantId, id: paso.perfilOperativoId },
            select: { id: true },
          });
          if (!perfil) {
            throw new NotFoundException('Perfil operativo no encontrado para un paso del route_effect.');
          }
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
      const route = await tx.productoAdicionalRouteEffect.create({
        data: {
          tenantId: auth.tenantId,
          productoAdicionalEfectoId: efectoId,
        },
      });
      await tx.productoAdicionalRouteEffectPaso.createMany({
        data: payload.routeEffect.pasos.map((paso, index) => ({
          tenantId: auth.tenantId,
          productoAdicionalRouteEffectId: route.id,
          orden: paso.orden ?? index + 1,
          nombre: paso.nombre.trim(),
          tipoOperacion: TipoOperacionProceso.OTRO,
          centroCostoId: paso.centroCostoId,
          maquinaId: paso.maquinaId ?? null,
          perfilOperativoId: paso.perfilOperativoId ?? null,
          setupMin: paso.setupMin ?? null,
          runMin: paso.runMin ?? null,
          cleanupMin: paso.cleanupMin ?? null,
          tiempoFijoMin: paso.tiempoFijoMin ?? null,
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
            pasos: item.routeEffect.pasos.map((paso) => ({
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

  private calculateMachineConsumables(input: {
    operation: {
      maquinaId: string | null;
      perfilOperativoId: string | null;
      productividadBase: Prisma.Decimal | null;
    };
    tipoImpresion: TipoImpresionProductoVariante;
    carasFactor: number;
    pliegos: number;
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
        productividad: Prisma.Decimal | null;
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
          item.perfilOperativo?.productividad &&
          Number(item.perfilOperativo.productividad) === operationProductividad,
      )?.perfilOperativoId ??
      machineConsumibles[0]?.perfilOperativoId ??
      null;

    const consumibles = selectedPerfilId
      ? machineConsumibles.filter((item) => item.perfilOperativoId === selectedPerfilId)
      : machineConsumibles;

    const consumiblesByColor = new Map<string, (typeof consumibles)[number]>();
    for (const item of consumibles) {
      const color = this.normalizeColor(item.detalleJson);
      if (!consumiblesByColor.has(color)) {
        consumiblesByColor.set(color, item);
      }
    }

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
      const gramos = consumoBase * input.areaPliegoM2 * input.carasFactor * input.pliegos;
      const costo = gramos * costoGramo;
      costoToner += costo;
      materiales.push({
        tipo: 'TONER',
        canal: color,
        nombre: item.materiaPrimaVariante.materiaPrima.nombre,
        sku: item.materiaPrimaVariante.sku,
        unidad: 'g',
        cantidad: Number(gramos.toFixed(6)),
        costoUnitario: costoGramo,
        costo: Number(costo.toFixed(6)),
      });
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
      const cantidadA4Eq = input.pliegos * input.a4EqFactor * input.carasFactor;
      const costo = cantidadA4Eq * (precio / vidaUtil);
      costoDesgaste += costo;
      materiales.push({
        tipo: 'DESGASTE',
        nombre: item.materiaPrimaVariante.materiaPrima.nombre,
        sku: item.materiaPrimaVariante.sku,
        unidad: 'a4_eq',
        cantidad: Number(cantidadA4Eq.toFixed(6)),
        costoUnitario: Number((precio / vidaUtil).toFixed(6)),
        costo: Number(costo.toFixed(6)),
      });
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
          tiempoPreparacionMin: Prisma.Decimal | null;
          tiempoRipMin: Prisma.Decimal | null;
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

    pushIfFinite(detalle.tiempoSetupMin);
    pushIfFinite(detalle.setupMin);
    pushIfFinite(detalle.setup);
    pushIfFinite(perfil.tiempoPreparacionMin ? Number(perfil.tiempoPreparacionMin) : null);
    pushIfFinite(perfil.tiempoRipMin ? Number(perfil.tiempoRipMin) : null);
    pushIfFinite(detalle.tiempoPreparacionMin);
    pushIfFinite(detalle.tiempoRipMin);

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
