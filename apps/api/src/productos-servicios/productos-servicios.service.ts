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
  GeometriaTrabajoMaquina,
  ReglaCostoChecklist,
  ReglaCostoAdicionalEfecto,
  MetodoCostoProductoAdicional,
  PlantillaMaquinaria,
  Prisma,
  SubfamiliaMateriaPrima,
  TipoProductoAdicionalEfecto,
  TipoConsumoAdicionalMaterial,
  TipoConsumibleMaquina,
  TipoProductoAdicional,
  TipoProductoChecklistPregunta,
  TipoProductoChecklistReglaAccion,
  TipoImpresionProductoVariante,
  TipoOperacionProceso,
  TipoProductoServicio,
  UnidadProduccionMaquina,
  ValorOpcionProductiva,
  UnidadConsumoMaquina,
  UnidadDesgasteMaquina,
  UnidadProceso,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { randomUUID } from 'node:crypto';
import type { CurrentAuth } from '../auth/auth.types';
import {
  convertUnitPrice,
  unitsAreCompatible,
  type UnitCode,
} from '../inventario/unidades-canonicas';
import { convertFlexibleRollUnitPrice } from '../inventario/unidades-derivadas';
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
  UpsertChecklistRespuestaDto,
  PreviewGranFormatoCostosDto,
  PreviewImposicionProductoVarianteDto,
  MetodoCalculoPrecioProductoDto,
  ReglaCostoChecklistDto,
  TipoChecklistPreguntaDto,
  TipoChecklistAccionReglaDto,
  GranFormatoImposicionCriterioOptimizacionDto,
  GranFormatoPanelizadoInterpretacionAnchoMaximoDto,
  GranFormatoPanelizadoModoDto,
  GranFormatoPanelizadoDireccionDto,
  GranFormatoPanelizadoDistribucionDto,
  UpdateProductoPrecioDto,
  UpdateProductoPrecioEspecialClientesDto,
  UpdateGranFormatoConfigDto,
  UpdateGranFormatoChecklistDto,
  UpdateGranFormatoRutaBaseDto,
  UpdateProductoRutaPolicyDto,
  EstadoProductoServicioDto,
  TipoVentaGranFormatoDto,
  TipoImpresionProductoVarianteDto,
  TipoProductoServicioDto,
  ValorOpcionProductivaDto,
  UpsertProductoMotorConfigDto,
  UpsertVarianteMotorOverrideDto,
  CreateGranFormatoVarianteDto,
  UpdateGranFormatoVarianteDto,
  UpdateProductoVarianteDto,
  UpsertFamiliaProductoDto,
  UpsertProductoComisionDto,
  UpsertProductoImpuestoDto,
  UpsertProductoServicioDto,
  UpsertSubfamiliaProductoDto,
} from './dto/productos-servicios.dto';
import { DigitalSheetMotorModule } from './motors/digital-sheet.motor';
import type { ProductMotorDefinition } from './motors/product-motor.contract';
import { ProductMotorRegistry } from './motors/product-motor.registry';
import { VinylCutMotorModule } from './motors/vinyl-cut.motor';
import { WideFormatMotorModule } from './motors/wide-format.motor';

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
type ProductoPrecioConfig = {
  metodoCalculo: MetodoCalculoPrecioProductoDto;
  measurementUnit: string | null;
  impuestos: {
    esquemaId: string | null;
    esquemaNombre: string;
    items: Array<{ nombre: string; porcentaje: number }>;
    porcentajeTotal: number;
  };
  comisiones: {
    esquemaId: string | null;
    esquemaNombre: string;
    items: Array<{
      id: string;
      nombre: string;
      tipo: 'financiera' | 'vendedor';
      porcentaje: number;
      activo: boolean;
    }>;
    porcentajeTotal: number;
  };
  detalle: Record<string, unknown>;
};
type ProductoPrecioEspecialClienteConfig = ProductoPrecioConfig & {
  id: string;
  clienteId: string;
  clienteNombre: string;
  descripcion: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};
type RouteEffectInsertionMode = 'append' | 'before_step' | 'after_step';
type RouteEffectInsertionConfig = {
  modo: RouteEffectInsertionMode;
  pasoPlantillaId: string | null;
};
type GranFormatoRutaBaseReglaImpresionStored = {
  tecnologia: string;
  maquinaId: string | null;
  pasoPlantillaId: string;
  perfilOperativoDefaultId: string | null;
};
type GranFormatoChecklistStored = {
  activo?: boolean;
  preguntas: Array<{
    id?: string;
    texto: string;
    tipoPregunta?: 'binaria' | 'single_select';
    orden?: number;
    activo?: boolean;
    respuestas: Array<{
      id?: string;
      texto: string;
      codigo?: string;
      preguntaSiguienteId?: string;
      orden?: number;
      activo?: boolean;
      reglas?: Array<{
        id?: string;
        accion:
          | 'activar_paso'
          | 'seleccionar_variante_paso'
          | 'costo_extra'
          | 'material_extra'
          | 'mutar_producto_base';
        orden?: number;
        activo?: boolean;
        pasoPlantillaId?: string;
        variantePasoId?: string;
        costoRegla?: 'tiempo_min' | 'flat' | 'por_unidad' | 'por_pliego' | 'porcentaje_sobre_total';
        costoValor?: number;
        costoCentroCostoId?: string;
        materiaPrimaVarianteId?: string;
        tipoConsumo?: 'por_unidad' | 'por_pliego' | 'por_m2';
        factorConsumo?: number;
        mermaPct?: number;
        detalle?:
          | Record<string, unknown>
          | {
              tipo: 'agregar_demasia_por_lado';
              ejes: 'ancho' | 'alto' | 'ambos';
              valorMmPorLado: number;
            };
      }>;
    }>;
  }>;
};
type ChecklistProductoMutacionDetalle = {
  tipo: 'agregar_demasia_por_lado';
  ejes: 'ancho' | 'alto' | 'ambos';
  valorMmPorLado: number;
};
type GranFormatoChecklistMutationTrace = {
  tipo: ChecklistProductoMutacionDetalle['tipo'];
  ejes: ChecklistProductoMutacionDetalle['ejes'];
  valorMmPorLado: number;
  deltaAnchoMm: number;
  deltaAltoMm: number;
  preguntaId: string;
  pregunta: string;
  respuestaId: string;
  respuesta: string;
  reglaId: string;
};
type GranFormatoCostosPreviewPlacement = {
  id: string;
  widthMm: number;
  heightMm: number;
  usefulWidthMm: number;
  usefulHeightMm: number;
  overlapStartMm: number;
  overlapEndMm: number;
  centerXMm: number;
  centerYMm: number;
  label: string;
  rotated: boolean;
  originalWidthMm: number;
  originalHeightMm: number;
  panelIndex: number | null;
  panelCount: number | null;
  panelAxis: 'vertical' | 'horizontal' | null;
  sourcePieceId: string | null;
};
type GranFormatoNestingOrientation = 'normal' | 'rotada' | 'mixta';
type GranFormatoCostosPreviewCandidate = {
  variant: any;
  rollWidthMm: number;
  printableWidthMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  marginStartMm: number;
  marginEndMm: number;
  orientacion: GranFormatoNestingOrientation;
  panelizado: boolean;
  panelAxis: 'vertical' | 'horizontal' | null;
  panelCount: number;
  panelOverlapMm: number | null;
  panelMaxWidthMm: number | null;
  panelDistribution: 'equilibrada' | 'libre' | null;
  panelWidthInterpretation: 'total' | 'util' | null;
  panelMode: 'automatico' | 'manual' | null;
  piecesPerRow: number;
  rows: number;
  consumedLengthMm: number;
  usefulAreaM2: number;
  consumedAreaM2: number;
  wasteAreaM2: number;
  wastePct: number;
  placements: GranFormatoCostosPreviewPlacement[];
  substrateCost: number;
  inkCost: number;
  timeCost: number;
  totalCost: number;
};

type GranFormatoHybridPieceAssignment = {
  sourcePieceId: string;
  anchoMm: number;
  altoMm: number;
  candidate: GranFormatoCostosPreviewCandidate;
};

type GranFormatoHybridGroupCandidate = {
  groupKey: string;
  variant: any;
  panelizado: boolean;
  panelAxis: 'vertical' | 'horizontal' | null;
  panelMode: 'automatico' | 'manual' | null;
  pieces: Array<{
    sourcePieceId: string;
    anchoMm: number;
    altoMm: number;
  }>;
  candidate: GranFormatoCostosPreviewCandidate;
};

type GranFormatoPreparedLayoutPiece = {
  id: string;
  sourcePieceId: string;
  widthMm: number;
  heightMm: number;
  usefulWidthMm: number;
  usefulHeightMm: number;
  overlapStartMm: number;
  overlapEndMm: number;
  originalWidthMm: number;
  originalHeightMm: number;
  panelIndex: number | null;
  panelCount: number | null;
  panelAxis: 'vertical' | 'horizontal' | null;
  label: string;
  rotated: boolean;
};

type GranFormatoHybridPhysicalRun = {
  corridaId: string;
  variant: any;
  groups: GranFormatoHybridGroupCandidate[];
  candidate: GranFormatoCostosPreviewCandidate;
  piecesCount: number;
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
  private static readonly DIGITAL_SHEET_MOTOR_DEFINITION: ProductMotorDefinition = {
    code: 'impresion_digital_laser',
    version: 1,
    label: 'Impresión digital laser · v1',
    category: 'digital_sheet',
    capabilities: {
      hasProductConfig: true,
      hasVariantOverride: true,
      hasPreview: true,
      hasQuote: true,
    },
    schema: {
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
    },
    exposedInCatalog: true,
  };
  private static readonly WIDE_FORMAT_MOTOR_DEFINITION: ProductMotorDefinition = {
    code: 'gran_formato',
    version: 1,
    label: 'Gran formato · v1',
    category: 'wide_format',
    capabilities: {
      hasProductConfig: true,
      hasVariantOverride: false,
      hasPreview: false,
      hasQuote: false,
    },
    schema: {
      mode: 'plantilla_trabajo',
      domain: 'vinilos_lonas',
      supportsVariantOverrides: false,
      pricingFocus: ['m2', 'material_en_rollo', 'desperdicio'],
    },
    exposedInCatalog: true,
  };
  private static readonly VINYL_CUT_MOTOR_DEFINITION: ProductMotorDefinition = {
    code: 'vinilo_de_corte',
    version: 1,
    label: 'Vinilo de corte · v1',
    category: 'vinyl_cut',
    capabilities: {
      hasProductConfig: true,
      hasVariantOverride: false,
      hasPreview: true,
      hasQuote: true,
    },
    schema: {
      tipoPlantilla: 'vinilo_de_corte',
      criterioSeleccionMaterial: 'menor_costo_total',
      permitirRotacion: true,
      separacionHorizontalMm: 10,
      separacionVerticalMm: 10,
      materialBaseId: null,
      plottersCompatibles: [],
      perfilesCompatibles: [],
      materialesCompatibles: [],
      medidas: [{ anchoMm: 1000, altoMm: 300, cantidad: 1, rotacionPermitida: true }],
      materialOverrideId: null,
      maquinaDefaultId: null,
      perfilDefaultId: null,
    },
    exposedInCatalog: true,
  };
  private static readonly DEFAULT_A4_AREA_M2 = 0.06237;
  private static readonly TERMINACION_PLANTILLAS_SOPORTADAS = new Set<PlantillaMaquinaria>([
    PlantillaMaquinaria.GUILLOTINA,
    PlantillaMaquinaria.LAMINADORA_BOPP_ROLLO,
    PlantillaMaquinaria.REDONDEADORA_PUNTAS,
    PlantillaMaquinaria.PERFORADORA,
  ]);
  private static readonly WIDE_FORMAT_MACHINE_TEMPLATES = new Set<PlantillaMaquinaria>([
    PlantillaMaquinaria.IMPRESORA_UV_MESA_EXTENSORA,
    PlantillaMaquinaria.IMPRESORA_UV_ROLLO,
    PlantillaMaquinaria.IMPRESORA_SOLVENTE,
    PlantillaMaquinaria.IMPRESORA_LATEX,
    PlantillaMaquinaria.IMPRESORA_INYECCION_TINTA,
    PlantillaMaquinaria.IMPRESORA_SUBLIMACION_GRAN_FORMATO,
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

  private readonly motorRegistry: ProductMotorRegistry;

  constructor(private readonly prisma: PrismaService) {
    this.motorRegistry = new ProductMotorRegistry([
      new DigitalSheetMotorModule(this),
      new WideFormatMotorModule(this),
      new VinylCutMotorModule(this),
    ]);
  }

  getCatalogoPliegosImpresion() {
    return ProductosServiciosService.CANONICAL_PLIEGOS_MM.map((item) => ({
      ...item,
      label: `${item.nombre} (${item.anchoMm} x ${item.altoMm} mm)`,
    }));
  }

  getMotoresCosto() {
    return this.motorRegistry.getCatalogDefinitions().map((definition) => ({
      code: definition.code,
      version: definition.version,
      label: definition.label,
      category: definition.category,
      capabilities: definition.capabilities,
      schema: definition.schema,
    }));
  }

  getDigitalMotorDefinition() {
    return {
      ...ProductosServiciosService.DIGITAL_SHEET_MOTOR_DEFINITION,
      schema: this.getDefaultMotorConfig(),
    };
  }

  getWideFormatMotorDefinition() {
    return ProductosServiciosService.WIDE_FORMAT_MOTOR_DEFINITION;
  }

  getVinylCutMotorDefinition() {
    return ProductosServiciosService.VINYL_CUT_MOTOR_DEFINITION;
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

  async findImpuestos(auth: CurrentAuth) {
    await this.ensureCatalogoInicialImpuestos(auth);
    const rows = await this.prisma.productoImpuestoCatalogo.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: [{ nombre: 'asc' }],
    });
    return rows.map((item) => this.toImpuestoResponse(item));
  }

  async findComisiones(auth: CurrentAuth) {
    await this.ensureCatalogoInicialComisiones(auth);
    const rows = await this.prisma.productoComisionCatalogo.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: [{ nombre: 'asc' }],
    });
    return rows.map((item) => this.toComisionResponse(item));
  }

  async createImpuesto(auth: CurrentAuth, payload: UpsertProductoImpuestoDto) {
    try {
      const created = await this.prisma.productoImpuestoCatalogo.create({
        data: {
          tenantId: auth.tenantId,
          codigo: payload.codigo.trim().toUpperCase(),
          nombre: payload.nombre.trim(),
          porcentaje: Number(payload.porcentaje),
          detalleJson: this.toNullableJson(
            payload.detalle && typeof payload.detalle === 'object' && !Array.isArray(payload.detalle)
              ? payload.detalle
              : undefined,
          ),
          activo: payload.activo,
        },
      });
      return this.toImpuestoResponse(created);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async updateImpuesto(
    auth: CurrentAuth,
    id: string,
    payload: UpsertProductoImpuestoDto,
  ) {
    await this.findImpuestoOrThrow(auth, id, this.prisma);
    try {
      const updated = await this.prisma.productoImpuestoCatalogo.update({
        where: { id },
        data: {
          codigo: payload.codigo.trim().toUpperCase(),
          nombre: payload.nombre.trim(),
          porcentaje: Number(payload.porcentaje),
          detalleJson: this.toNullableJson(
            payload.detalle && typeof payload.detalle === 'object' && !Array.isArray(payload.detalle)
              ? payload.detalle
              : undefined,
          ),
          activo: payload.activo,
        },
      });
      return this.toImpuestoResponse(updated);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async createComision(auth: CurrentAuth, payload: UpsertProductoComisionDto) {
    try {
      const created = await this.prisma.productoComisionCatalogo.create({
        data: {
          tenantId: auth.tenantId,
          codigo: payload.codigo.trim().toUpperCase(),
          nombre: payload.nombre.trim(),
          porcentaje: Number(payload.porcentaje),
          detalleJson: this.toNullableJson(
            payload.detalle && typeof payload.detalle === 'object' && !Array.isArray(payload.detalle)
              ? payload.detalle
              : undefined,
          ),
          activo: payload.activo,
        },
      });
      return this.toComisionResponse(created);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async updateComision(
    auth: CurrentAuth,
    id: string,
    payload: UpsertProductoComisionDto,
  ) {
    await this.findComisionOrThrow(auth, id, this.prisma);
    try {
      const updated = await this.prisma.productoComisionCatalogo.update({
        where: { id },
        data: {
          codigo: payload.codigo.trim().toUpperCase(),
          nombre: payload.nombre.trim(),
          porcentaje: Number(payload.porcentaje),
          detalleJson: this.toNullableJson(
            payload.detalle && typeof payload.detalle === 'object' && !Array.isArray(payload.detalle)
              ? payload.detalle
              : undefined,
          ),
          activo: payload.activo,
        },
      });
      return this.toComisionResponse(updated);
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

  async deleteFamilia(auth: CurrentAuth, id: string) {
    await this.findFamiliaOrThrow(auth, id, this.prisma);

    const [subfamiliasCount, productosDirectosCount] = await Promise.all([
      this.prisma.subfamiliaProducto.count({
        where: {
          tenantId: auth.tenantId,
          familiaProductoId: id,
        },
      }),
      this.prisma.productoServicio.count({
        where: {
          tenantId: auth.tenantId,
          familiaProductoId: id,
        },
      }),
    ]);

    if (subfamiliasCount > 0 || productosDirectosCount > 0) {
      throw new BadRequestException(
        'No se puede borrar la familia porque tiene subfamilias o productos asociados.',
      );
    }

    await this.prisma.familiaProducto.delete({
      where: { id },
    });

    return { id, deleted: true };
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
          unidadComercial: this.normalizeUnidadComercialProductoValue(payload.unidadComercial),
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
          unidadComercial: this.normalizeUnidadComercialProductoValue(payload.unidadComercial),
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

  async deleteSubfamilia(auth: CurrentAuth, id: string) {
    await this.findSubfamiliaOrThrow(auth, id, this.prisma);

    const productosCount = await this.prisma.productoServicio.count({
      where: {
        tenantId: auth.tenantId,
        subfamiliaProductoId: id,
      },
    });

    if (productosCount > 0) {
      throw new BadRequestException(
        'No se puede borrar la subfamilia porque tiene productos asociados.',
      );
    }

    await this.prisma.subfamiliaProducto.delete({
      where: { id },
    });

    return { id, deleted: true };
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
        payload.motorCodigo ?? ProductosServiciosService.DIGITAL_SHEET_MOTOR_DEFINITION.code,
        payload.motorVersion ?? ProductosServiciosService.DIGITAL_SHEET_MOTOR_DEFINITION.version,
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
          unidadComercial: payload.unidadComercial,
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
          unidadComercial: payload.unidadComercial,
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

  async updateProductoPrecio(
    auth: CurrentAuth,
    productoId: string,
    payload: UpdateProductoPrecioDto,
  ) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    const currentPrecio = this.getProductoPrecioConfig(producto.detalleJson);
    const measurementUnit = this.normalizeUnidadComercialProductoValue(
      payload.measurementUnit ?? currentPrecio?.measurementUnit ?? null,
    );
    const impuestos = await this.resolveProductoPrecioImpuestos(
      auth,
      payload.impuestos ?? currentPrecio?.impuestos ?? null,
    );
    const comisiones = await this.resolveProductoPrecioComisiones(
      auth,
      payload.comisiones ?? currentPrecio?.comisiones ?? null,
    );
    const detalle = this.normalizeProductoPrecioDetalle(payload.metodoCalculo, payload.detalle ?? null, false);
    const nextDetalle = this.mergeProductoDetalle(producto.detalleJson, {
      precio: {
        metodoCalculo: payload.metodoCalculo,
        measurementUnit,
        impuestos,
        comisiones,
        detalle,
      },
    });

    await this.prisma.productoServicio.update({
      where: { id: producto.id },
      data: {
        detalleJson: this.toNullableJson(nextDetalle),
      },
    });

    return this.findProducto(auth, producto.id);
  }

  async updateProductoPrecioEspecialClientes(
    auth: CurrentAuth,
    productoId: string,
    payload: UpdateProductoPrecioEspecialClientesDto,
  ) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    const items = await this.resolveProductoPrecioEspecialClientes(auth, payload.items ?? []);
    const nextDetalle = this.mergeProductoDetalle(producto.detalleJson, {
      precioEspecialClientes: items,
    });

    await this.prisma.productoServicio.update({
      where: { id: producto.id },
      data: {
        detalleJson: this.toNullableJson(nextDetalle),
      },
    });

    return this.findProducto(auth, producto.id);
  }

  async getProductoMotorConfig(auth: CurrentAuth, productoId: string) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    return this.resolveProductMotorModule(producto.motorCodigo, producto.motorVersion).getProductConfig(
      auth,
      producto.id,
    );
  }

  async getDigitalProductMotorConfig(auth: CurrentAuth, productoId: string) {
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
      parametros:
        config?.parametrosJson ??
        this.resolveDefaultMotorConfig(ProductosServiciosService.DIGITAL_SHEET_MOTOR_DEFINITION.code),
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
    return this.resolveProductMotorModule(producto.motorCodigo, producto.motorVersion).upsertProductConfig(
      auth,
      producto.id,
      payload,
    );
  }

  async upsertDigitalProductMotorConfig(
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
    const merged = this.mergeMotorConfig(motor.code, current?.parametrosJson, payload.parametros);
    const created = await this.prisma.productoMotorConfig.create({
      data: {
        tenantId: auth.tenantId,
        productoServicioId: producto.id,
        motorCodigo: motor.code,
        motorVersion: motor.version,
        parametrosJson: merged as Prisma.InputJsonValue,
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

  async getWideFormatProductMotorConfig(auth: CurrentAuth, productoId: string) {
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
      parametros: config?.parametrosJson ?? this.resolveDefaultMotorConfig(motor.code),
      versionConfig: config?.versionConfig ?? 1,
      activo: config?.activo ?? true,
      updatedAt: config?.updatedAt?.toISOString() ?? null,
    };
  }

  async upsertWideFormatProductMotorConfig(
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
    const merged = this.mergeMotorConfig(motor.code, current?.parametrosJson, payload.parametros ?? {});
    const created = await this.prisma.productoMotorConfig.create({
      data: {
        tenantId: auth.tenantId,
        productoServicioId: producto.id,
        motorCodigo: motor.code,
        motorVersion: motor.version,
        parametrosJson: merged as Prisma.InputJsonValue,
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

  async getVinylCutProductMotorConfig(auth: CurrentAuth, productoId: string) {
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
      parametros: config?.parametrosJson ?? this.resolveDefaultMotorConfig(motor.code),
      versionConfig: config?.versionConfig ?? 1,
      activo: config?.activo ?? true,
      updatedAt: config?.updatedAt?.toISOString() ?? null,
    };
  }

  async upsertVinylCutProductMotorConfig(
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
    const merged = this.mergeMotorConfig(motor.code, current?.parametrosJson, payload.parametros ?? {});
    const created = await this.prisma.productoMotorConfig.create({
      data: {
        tenantId: auth.tenantId,
        productoServicioId: producto.id,
        motorCodigo: motor.code,
        motorVersion: motor.version,
        parametrosJson: merged as Prisma.InputJsonValue,
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

  async getGranFormatoConfig(auth: CurrentAuth, productoId: string) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    this.ensureWideFormatProducto(producto);
    const detalle = this.getGranFormatoDetalle(producto.detalleJson);

    return {
      productoId: producto.id,
      tecnologiasCompatibles: this.normalizeGranFormatoTecnologias(
        this.getGranFormatoStringArray(detalle.tecnologiasCompatibles),
      ),
      maquinasCompatibles: this.getGranFormatoStringArray(detalle.maquinasCompatibles),
      perfilesCompatibles: this.getGranFormatoStringArray(detalle.perfilesCompatibles),
      materialBaseId: this.getGranFormatoNullableString(detalle.materialBaseId),
      materialesCompatibles: this.getGranFormatoStringArray(detalle.materialesCompatibles),
      imposicion: this.getGranFormatoImposicionConfig(detalle),
      updatedAt: producto.updatedAt.toISOString(),
    };
  }

  async updateGranFormatoConfig(
    auth: CurrentAuth,
    productoId: string,
    payload: UpdateGranFormatoConfigDto,
  ) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    this.ensureWideFormatProducto(producto);
    const normalized = await this.validateGranFormatoConfigPayload(auth, payload);
    const nextDetalle = this.mergeProductoDetalle(producto.detalleJson, {
      granFormato: {
        ...this.getGranFormatoDetalle(producto.detalleJson),
        ...normalized,
      },
    });

    const updated = await this.prisma.productoServicio.update({
      where: { id: producto.id },
      data: {
        detalleJson: this.toNullableJson(nextDetalle),
      },
    });

    return {
      productoId: updated.id,
      tecnologiasCompatibles: this.normalizeGranFormatoTecnologias(
        this.getGranFormatoStringArray(normalized.tecnologiasCompatibles),
      ),
      maquinasCompatibles: this.getGranFormatoStringArray(normalized.maquinasCompatibles),
      perfilesCompatibles: this.getGranFormatoStringArray(normalized.perfilesCompatibles),
      materialBaseId: normalized.materialBaseId,
      materialesCompatibles: this.getGranFormatoStringArray(normalized.materialesCompatibles),
      imposicion: this.getGranFormatoImposicionConfig(normalized),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async getGranFormatoRutaBase(auth: CurrentAuth, productoId: string) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    this.ensureWideFormatProducto(producto);
    return this.buildGranFormatoRutaBaseResponse(auth, producto);
  }

  async updateGranFormatoRutaBase(
    auth: CurrentAuth,
    productoId: string,
    payload: UpdateGranFormatoRutaBaseDto,
  ) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    this.ensureWideFormatProducto(producto);
    const normalized = await this.validateGranFormatoRutaBasePayload(
      auth,
      producto.detalleJson,
      payload,
    );
    const nextDetalle = this.mergeProductoDetalle(producto.detalleJson, {
      granFormatoRutaBase: normalized,
    });

    const updated = await this.prisma.productoServicio.update({
      where: { id: producto.id },
      data: {
        detalleJson: this.toNullableJson(nextDetalle),
      },
    });

    return this.buildGranFormatoRutaBaseResponse(auth, updated);
  }

  async getGranFormatoChecklist(auth: CurrentAuth, productoId: string) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    this.ensureWideFormatProducto(producto);
    return this.buildGranFormatoChecklistResponse(auth, producto);
  }

  async updateGranFormatoChecklist(
    auth: CurrentAuth,
    productoId: string,
    payload: UpdateGranFormatoChecklistDto,
  ) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    this.ensureWideFormatProducto(producto);
    const normalized = await this.validateGranFormatoChecklistPayload(
      auth,
      producto.detalleJson,
      payload,
    );
    const nextDetalle = this.mergeProductoDetalle(producto.detalleJson, {
      granFormatoChecklist: normalized,
    });

    const updated = await this.prisma.productoServicio.update({
      where: { id: producto.id },
      data: {
        detalleJson: this.toNullableJson(nextDetalle),
      },
    });

    return this.buildGranFormatoChecklistResponse(auth, updated);
  }

  async previewGranFormatoCostos(
    auth: CurrentAuth,
    productoId: string,
    payload: PreviewGranFormatoCostosDto,
  ) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    this.ensureWideFormatProducto(producto);
    const detalleGranFormato = this.getGranFormatoDetalle(producto.detalleJson);
    const tecnologiasCompatibles = this.normalizeGranFormatoTecnologias(
      this.getGranFormatoStringArray(detalleGranFormato.tecnologiasCompatibles),
    );
    const tecnologiaSolicitada = this.normalizeGranFormatoTecnologia(payload.tecnologia ?? null);
    const tecnologia =
      (tecnologiaSolicitada && tecnologiasCompatibles.includes(tecnologiaSolicitada)
        ? tecnologiaSolicitada
        : null) ??
      this.normalizeGranFormatoTecnologia(
        this.getGranFormatoImposicionConfig(detalleGranFormato).tecnologiaDefault,
      ) ??
      tecnologiasCompatibles[0] ??
      null;
    if (!tecnologia) {
      throw new BadRequestException('No hay una tecnología válida configurada para simular costos.');
    }

    const medidas = payload.medidas
      .map((item) => ({
        anchoMm: Number(item.anchoMm),
        altoMm: Number(item.altoMm),
        cantidad: Number(item.cantidad),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.anchoMm) &&
          item.anchoMm > 0 &&
          Number.isFinite(item.altoMm) &&
          item.altoMm > 0 &&
          Number.isFinite(item.cantidad) &&
          item.cantidad > 0,
      );
    if (!medidas.length) {
      throw new BadRequestException('Debes ingresar al menos una medida válida para calcular costos.');
    }
    const cantidadTotal = medidas.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
    const persistirSnapshot = payload.persistirSnapshot !== false;
    const incluirCandidatos = payload.incluirCandidatos === true;

    const periodo = payload.periodo?.trim() || this.getDefaultTarifaPeriodo();
    if (!DEFAULT_PERIOD_REGEX.test(periodo)) {
      throw new BadRequestException('El período tarifa debe tener formato YYYY-MM.');
    }

    const maquinaIdsCompatibles = this.getGranFormatoStringArray(detalleGranFormato.maquinasCompatibles);
    const perfilIdsCompatibles = this.getGranFormatoStringArray(detalleGranFormato.perfilesCompatibles);
    const materialBaseId = this.getGranFormatoNullableString(detalleGranFormato.materialBaseId);
    if (!materialBaseId) {
      throw new BadRequestException('El producto no tiene material base configurado en Tecnologías.');
    }

    const materialIdsCompatibles = this.getGranFormatoStringArray(detalleGranFormato.materialesCompatibles);
    const [maquinasCompatibles, perfilesCompatibles, materialBase, materialVariantes] = await Promise.all([
      maquinaIdsCompatibles.length
        ? this.prisma.maquina.findMany({
            where: {
              tenantId: auth.tenantId,
              id: { in: maquinaIdsCompatibles },
              activo: true,
            },
          })
        : Promise.resolve<any[]>([]),
      perfilIdsCompatibles.length
        ? this.prisma.maquinaPerfilOperativo.findMany({
            where: {
              tenantId: auth.tenantId,
              id: { in: perfilIdsCompatibles },
              activo: true,
            },
          })
        : Promise.resolve<any[]>([]),
      this.prisma.materiaPrima.findFirst({
        where: {
          tenantId: auth.tenantId,
          id: materialBaseId,
        },
      }),
      this.prisma.materiaPrimaVariante.findMany({
        where: {
          tenantId: auth.tenantId,
          materiaPrimaId: materialBaseId,
          activo: true,
          ...(materialIdsCompatibles.length ? { id: { in: materialIdsCompatibles } } : {}),
        },
        include: {
          materiaPrima: true,
        },
      }),
    ]);

    if (!materialBase || !materialBase.activo) {
      throw new BadRequestException('El material base configurado no existe o está inactivo.');
    }
    if (!materialVariantes.length) {
      throw new BadRequestException('No hay variantes activas de material para calcular costos.');
    }

    const maquinasTecnologia = maquinasCompatibles.filter(
      (item) =>
        this.isGranFormatoMachineCompatible(item) &&
        this.deriveGranFormatoTecnologia(item.plantilla, item.capacidadesAvanzadasJson) === tecnologia,
    );
    if (!maquinasTecnologia.length) {
      throw new BadRequestException('No hay máquinas compatibles para la tecnología seleccionada.');
    }

    const rutaBase = await this.buildGranFormatoRutaBaseResponse(auth, producto);
    if (!rutaBase.procesoDefinicionId) {
      throw new BadRequestException('Debes configurar una ruta base antes de calcular costos.');
    }

    const plantillaIdsRutaBase = Array.from(
      new Set(rutaBase.reglasImpresion.map((item) => item.pasoPlantillaId)),
    );
    const plantillasRutaBase = plantillaIdsRutaBase.length
      ? await this.prisma.procesoOperacionPlantilla.findMany({
          where: {
            tenantId: auth.tenantId,
            id: { in: plantillaIdsRutaBase },
          },
          include: {
            centroCosto: true,
            maquina: true,
            perfilOperativo: true,
          },
        })
      : [];
    const plantillasRutaBaseById = new Map(plantillasRutaBase.map((item) => [item.id, item]));

    const imposicionGuardada = this.getGranFormatoImposicionConfig(detalleGranFormato);
    const perfilOverrideId = this.getGranFormatoNullableString(payload.perfilOverrideId);
    const panelizadoPayload =
      payload.panelizado && typeof payload.panelizado === 'object'
        ? this.asObject(payload.panelizado)
        : {};
    const perfilOverride =
      perfilOverrideId
        ? perfilesCompatibles.find((item) => item.id === perfilOverrideId) ?? null
        : null;
    if (perfilOverrideId && !perfilOverride) {
      throw new BadRequestException('El perfil override no pertenece a los perfiles compatibles del producto.');
    }

    let maquinaSeleccionada =
      perfilOverride
        ? maquinasTecnologia.find((item) => item.id === perfilOverride.maquinaId) ?? null
        : null;
    let perfilSeleccionado = perfilOverride;
    if (!maquinaSeleccionada) {
      maquinaSeleccionada =
        (imposicionGuardada.maquinaDefaultId
          ? maquinasTecnologia.find((item) => item.id === imposicionGuardada.maquinaDefaultId) ?? null
          : null) ??
        maquinasTecnologia[0] ??
        null;
    }
    if (!maquinaSeleccionada) {
      throw new BadRequestException('No se pudo resolver una máquina válida para calcular costos.');
    }

    const reglaImpresionSeleccionada =
      this.resolveGranFormatoRutaBaseReglaImpresion(producto.detalleJson, tecnologia, maquinaSeleccionada.id) ??
      this.resolveGranFormatoRutaBaseReglaImpresion(producto.detalleJson, tecnologia, null);
    if (!reglaImpresionSeleccionada) {
      throw new BadRequestException('No hay una regla de impresión configurada para la tecnología seleccionada.');
    }
    const plantillaImpresionSeleccionada =
      plantillasRutaBaseById.get(reglaImpresionSeleccionada.pasoPlantillaId) ?? null;
    if (!plantillaImpresionSeleccionada) {
      throw new BadRequestException('La regla de impresión referencia un paso inválido.');
    }
    if (plantillaImpresionSeleccionada.maquinaId) {
      maquinaSeleccionada =
        maquinasCompatibles.find((item) => item.id === plantillaImpresionSeleccionada.maquinaId) ??
        maquinaSeleccionada;
    }
    if (!perfilSeleccionado) {
      perfilSeleccionado =
        (reglaImpresionSeleccionada.perfilOperativoDefaultId
          ? perfilesCompatibles.find(
              (item) => item.id === reglaImpresionSeleccionada.perfilOperativoDefaultId,
            ) ?? null
          : null) ??
        (imposicionGuardada.perfilDefaultId
          ? perfilesCompatibles.find((item) => item.id === imposicionGuardada.perfilDefaultId) ?? null
          : null) ??
        perfilesCompatibles.find((item) => item.maquinaId === maquinaSeleccionada?.id) ??
        null;
    }

    const effectiveImposicionConfig = {
      ...imposicionGuardada,
      criterioOptimizacion: GranFormatoImposicionCriterioOptimizacionDto.menor_costo_total,
      panelizadoActivo:
        'activo' in panelizadoPayload
          ? panelizadoPayload.activo === true
          : imposicionGuardada.panelizadoActivo,
      panelizadoDireccion:
        'direccion' in panelizadoPayload &&
        (panelizadoPayload.direccion === GranFormatoPanelizadoDireccionDto.vertical ||
          panelizadoPayload.direccion === GranFormatoPanelizadoDireccionDto.horizontal ||
          panelizadoPayload.direccion === GranFormatoPanelizadoDireccionDto.automatica)
          ? panelizadoPayload.direccion
          : imposicionGuardada.panelizadoDireccion,
      panelizadoSolapeMm:
        'solapeMm' in panelizadoPayload
          ? this.getGranFormatoNullableNumber(panelizadoPayload.solapeMm)
          : imposicionGuardada.panelizadoSolapeMm,
      panelizadoAnchoMaxPanelMm:
        'anchoMaxPanelMm' in panelizadoPayload
          ? this.getGranFormatoNullableNumber(panelizadoPayload.anchoMaxPanelMm)
          : imposicionGuardada.panelizadoAnchoMaxPanelMm,
      panelizadoDistribucion:
        'distribucion' in panelizadoPayload &&
        (panelizadoPayload.distribucion === GranFormatoPanelizadoDistribucionDto.libre ||
          panelizadoPayload.distribucion === GranFormatoPanelizadoDistribucionDto.equilibrada)
          ? panelizadoPayload.distribucion
          : imposicionGuardada.panelizadoDistribucion,
      panelizadoInterpretacionAnchoMaximo:
        'interpretacionAnchoMaximo' in panelizadoPayload &&
        (panelizadoPayload.interpretacionAnchoMaximo === GranFormatoPanelizadoInterpretacionAnchoMaximoDto.util ||
          panelizadoPayload.interpretacionAnchoMaximo === GranFormatoPanelizadoInterpretacionAnchoMaximoDto.total)
          ? panelizadoPayload.interpretacionAnchoMaximo
          : imposicionGuardada.panelizadoInterpretacionAnchoMaximo,
      panelizadoModo:
        'modo' in panelizadoPayload && panelizadoPayload.modo === GranFormatoPanelizadoModoDto.manual
          ? GranFormatoPanelizadoModoDto.manual
          : 'modo' in panelizadoPayload && panelizadoPayload.modo === GranFormatoPanelizadoModoDto.automatico
            ? GranFormatoPanelizadoModoDto.automatico
            : imposicionGuardada.panelizadoModo,
      panelizadoManualLayout:
        'manualLayout' in panelizadoPayload
          ? ((panelizadoPayload.manualLayout as unknown as Record<string, unknown> | null) ?? null)
          : imposicionGuardada.panelizadoManualLayout,
    };

    const checklistConfig = await this.buildGranFormatoChecklistResponse(auth, producto);
    const checklistTecnologia =
      checklistConfig.checklistsPorTecnologia.find(
        (item: any) => item?.tecnologia === tecnologia,
      ) ?? null;
    const checklistActivo = checklistConfig.aplicaATodasLasTecnologias
      ? checklistConfig.checklistComun
      : checklistTecnologia?.checklist ?? checklistConfig.checklistComun;
    const checklistSelectedByPreguntaId = new Map(
      Array.from(
        new Map((payload.checklistRespuestas ?? []).map((item) => [item.preguntaId, item])).values(),
      ).map((item) => [item.preguntaId, item.respuestaId]),
    );
    const checklistPreguntaIdsActivas = this.resolveChecklistPreguntaIdsActivas(
      checklistActivo.preguntas.map((pregunta) => ({
        ...pregunta,
        respuestas: pregunta.respuestas.map((respuesta) => ({
          id: respuesta.id,
          activo: respuesta.activo,
          preguntaSiguienteId: respuesta.preguntaSiguienteId ?? null,
        })),
      })),
      checklistSelectedByPreguntaId,
    );
    const activeChecklistRules: Array<{
      preguntaId: string;
      pregunta: string;
      respuestaId: string;
      respuesta: string;
      regla: any;
    }> = [];
    for (const pregunta of checklistActivo.preguntas) {
      if (!pregunta.activo || !checklistPreguntaIdsActivas.has(pregunta.id)) continue;
      const respuestaId = checklistSelectedByPreguntaId.get(pregunta.id);
      if (!respuestaId) continue;
      const respuesta = pregunta.respuestas.find((item) => item.id === respuestaId && item.activo);
      if (!respuesta) continue;
      for (const regla of respuesta.reglas.filter((item) => item.activo)) {
        activeChecklistRules.push({
          preguntaId: pregunta.id,
          pregunta: pregunta.texto,
          respuestaId: respuesta.id,
          respuesta: respuesta.texto,
          regla,
        });
      }
    }
    const { medidasOriginales, medidasEfectivas, mutacionesAplicadas, traceChecklist } =
      this.applyGranFormatoChecklistProductMutations({
        medidas,
        activeChecklistRules,
      });

    const candidatos = this.evaluateGranFormatoImposicionCandidates({
      maquina: maquinaSeleccionada,
      medidas: medidasEfectivas,
      config: effectiveImposicionConfig,
      variants: materialVariantes,
    });
    if (!candidatos.length) {
      throw new BadRequestException(
        'No se pudo resolver la imposición con la configuración actual para calcular costos.',
      );
    }

    const checklistTemplateIds = Array.from(
      new Set(
        activeChecklistRules
          .map((item) => item.regla.pasoPlantillaId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const checklistPlantillas = checklistTemplateIds.length
      ? await this.prisma.procesoOperacionPlantilla.findMany({
          where: {
            tenantId: auth.tenantId,
            id: { in: checklistTemplateIds },
          },
          include: {
            centroCosto: true,
            maquina: true,
            perfilOperativo: true,
          },
        })
      : [];
    const checklistPlantillaById = new Map(checklistPlantillas.map((item) => [item.id, item]));
    const checklistNivelPerfilIds = Array.from(
      new Set(
        activeChecklistRules
          .map((item) => item.regla.variantePasoId)
          .filter(Boolean)
          .flatMap((variantePasoId) => {
            const template = checklistPlantillaById.get(
              activeChecklistRules.find((row) => row.regla.variantePasoId === variantePasoId)?.regla
                .pasoPlantillaId ?? '',
            );
            return this.getProcesoOperacionNiveles(template?.detalleJson ?? null)
              .filter((nivel) => nivel.id === variantePasoId)
              .map((nivel) => nivel.perfilOperativoId)
              .filter((value): value is string => Boolean(value));
          }),
      ),
    );
    const checklistNivelPerfiles = checklistNivelPerfilIds.length
      ? await this.prisma.maquinaPerfilOperativo.findMany({
          where: {
            tenantId: auth.tenantId,
            id: { in: checklistNivelPerfilIds },
          },
        })
      : ([] as any[]);
    const checklistNivelPerfilById = new Map(checklistNivelPerfiles.map((item) => [item.id, item]));

    const proceso = await this.findProcesoConOperacionesOrThrow(
      auth,
      rutaBase.procesoDefinicionId,
      this.prisma,
    );
    const templatesForRouteResolution = [...plantillasRutaBase];
    const allPrintTemplateIds = new Set(rutaBase.reglasImpresion.map((item) => item.pasoPlantillaId));
    const operacionesBase = proceso.operaciones
      .filter((item) => item.activo)
      .map((item) => {
        const pasoPlantillaId =
          this.resolvePasoPlantillaIdFromOperacionRuta(item, templatesForRouteResolution) ?? null;
        return { item, pasoPlantillaId };
      })
      .filter(({ pasoPlantillaId }) => {
        if (!pasoPlantillaId || !allPrintTemplateIds.has(pasoPlantillaId)) {
          return true;
        }
        return pasoPlantillaId === reglaImpresionSeleccionada.pasoPlantillaId;
      })
      .map(({ item, pasoPlantillaId }) => {
        if (pasoPlantillaId === reglaImpresionSeleccionada.pasoPlantillaId) {
          if (perfilSeleccionado) {
            return {
              ...this.buildChecklistOperacionFromPlantillaConPerfil(
                plantillaImpresionSeleccionada,
                perfilSeleccionado,
              ),
              orden: item.orden,
              codigo: item.codigo,
            };
          }
          return {
            ...this.buildChecklistOperacionFromPlantilla(plantillaImpresionSeleccionada),
            orden: item.orden,
            codigo: item.codigo,
          };
        }
        return item;
      });

    const checklistOps = activeChecklistRules
      .filter(
        (item) =>
          (item.regla.accion === 'activar_paso' || item.regla.accion === 'seleccionar_variante_paso') &&
          item.regla.pasoPlantillaId,
      )
      .map((item) => {
        const plantilla = checklistPlantillaById.get(item.regla.pasoPlantillaId as string);
        if (!plantilla) {
          return null;
        }
        if (item.regla.accion === 'seleccionar_variante_paso' && item.regla.variantePasoId) {
          const nivel = this.getProcesoOperacionNiveles(plantilla.detalleJson).find(
            (row) => row.id === item.regla.variantePasoId,
          );
          if (!nivel) {
            return {
              ...this.buildChecklistOperacionFromPlantilla(plantilla),
              orden: 10_000 + activeChecklistRules.indexOf(item),
            };
          }
          const perfilNivel =
            (nivel?.perfilOperativoId
              ? checklistNivelPerfilById.get(nivel.perfilOperativoId) ?? null
              : null) ??
            plantilla.perfilOperativo;
          return {
            operacion: {
              ...this.buildChecklistOperacionFromPlantillaConNivel(plantilla, nivel, perfilNivel),
              orden: 10_000 + activeChecklistRules.indexOf(item),
            },
            insertion: this.parseChecklistRouteInsertion(item.regla.detalleJson),
          };
        }
        return {
          operacion: {
            ...this.buildChecklistOperacionFromPlantilla(plantilla),
            orden: 10_000 + activeChecklistRules.indexOf(item),
          },
          insertion: this.parseChecklistRouteInsertion(item.regla.detalleJson),
        };
      })
      .filter((item): item is any => Boolean(item));

    const warnings: string[] = [];
    const operacionesCotizadas = this.buildOperacionesCotizadasOrdenadas(
      operacionesBase,
      [],
      checklistOps,
      warnings,
    );
    const centroIds = Array.from(
      new Set(
        operacionesCotizadas
          .map((item) => item.centroCostoId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const tarifas = centroIds.length
      ? await this.prisma.centroCostoTarifaPeriodo.findMany({
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
        })
      : [];
    const tarifaByCentro = new Map(tarifas.map((item) => [item.centroCostoId, item.tarifaCalculada]));
    const totalPiezas = medidasEfectivas.reduce((acc, item) => acc + item.cantidad, 0);
    const perimetroTotalMl = this.roundProductNumber(
      medidasEfectivas.reduce(
        (acc, item) => acc + (((item.anchoMm + item.altoMm) * 2) / 1000) * item.cantidad,
        0,
      ) / 1000,
    );

    const normalizedCandidates = candidatos.map((candidate) =>
      this.applyGranFormatoOriginalMeasuresToCandidatePlacements({
        candidate,
        medidasOriginales,
      }),
    );

    const costGranFormatoCandidate = async (input: {
      candidate: GranFormatoCostosPreviewCandidate;
      medidasParaCosto: Array<{ anchoMm: number; altoMm: number; cantidad: number }>;
      groupLabel?: string | null;
    }) => {
      const candidate = input.candidate;
      const groupLabel = input.groupLabel?.trim() ? input.groupLabel.trim() : null;
      const totalPiezasGrupo = input.medidasParaCosto.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
      const perimetroTotalMlGrupo = this.roundProductNumber(
        input.medidasParaCosto.reduce(
          (acc, item) => acc + (((item.anchoMm + item.altoMm) * 2) / 1000) * Number(item.cantidad || 0),
          0,
        ) / 1000,
      );
      const candidateWarnings: string[] = [];
      const largoConsumidoMl = this.roundProductNumber(candidate.consumedLengthMm / 1000);
      const centrosCosto: Array<{
        orden: number;
        codigo: string;
        paso: string;
        centroCostoId: string;
        centroCostoNombre: string;
        origen: string;
        minutos: number;
        tarifaHora: number;
        costo: number;
        detalleTecnico: Record<string, unknown> | null;
      }> = operacionesCotizadas.map((op, index) => {
        const setupMin = Number(op.setupMin ?? 0);
        const cleanupMin = Number(op.cleanupMin ?? 0);
        const tiempoFijoMin = Number(op.tiempoFijoMin ?? 0);
        const cantidadObjetivoSalida = this.resolveGranFormatoCantidadObjetivoSalida({
          operacion: op,
          totalPiezas: totalPiezasGrupo,
          areaUtilM2: candidate.usefulAreaM2,
          largoConsumidoMl,
          perimetroTotalMl: perimetroTotalMlGrupo,
        });
        const usaSoloTiempoFijo =
          (op.modoProductividad ?? ModoProductividadProceso.FIJA) === ModoProductividadProceso.FIJA &&
          Number(op.tiempoFijoMin ?? 0) > 0 &&
          Number(op.productividadBase ?? 0) <= 0 &&
          Number(op.runMin ?? 0) <= 0;
        const productividad = usaSoloTiempoFijo
          ? {
              runMin: 0,
              cantidadRun: cantidadObjetivoSalida,
              productividadAplicada: null,
              mermaRunPctAplicada: 0,
              mermaSetupAplicada: 0,
              warnings: [],
            }
          : evaluateProductividad({
              modoProductividad: op.modoProductividad ?? ModoProductividadProceso.FIJA,
              productividadBase: op.productividadBase,
              reglaVelocidadJson: op.reglaVelocidadJson ?? null,
              reglaMermaJson: op.reglaMermaJson ?? null,
              runMin: op.runMin,
              unidadTiempo: op.unidadTiempo,
              mermaRunPct: op.mermaRunPct,
              mermaSetup: op.mermaSetup,
              cantidadObjetivoSalida,
              contexto: {
                cantidad: totalPiezasGrupo,
                areaTotalM2: candidate.usefulAreaM2,
                largoTotalMl: largoConsumidoMl,
                perimetroTotalMl: perimetroTotalMlGrupo,
              },
            });
        candidateWarnings.push(
          ...productividad.warnings.map((warning) => `Paso ${op.nombre}: ${warning}`),
        );
        const minutos = this.roundProductNumber(
          setupMin + cleanupMin + tiempoFijoMin + productividad.runMin,
        );
        const tarifa = op.centroCostoId ? tarifaByCentro.get(op.centroCostoId) ?? null : null;
        if (op.centroCostoId && !tarifa) {
          candidateWarnings.push(
            `No hay tarifa PUBLICADA para ${op.centroCosto?.nombre ?? op.nombre} en ${periodo}.`,
          );
        }
        const costo = tarifa ? this.roundProductNumber(Number(tarifa.mul(minutos / 60))) : 0;
        return {
          orden: index + 1,
          codigo: op.codigo,
          paso: op.nombre,
          centroCostoId: op.centroCostoId,
          centroCostoNombre: op.centroCosto?.nombre ?? '',
          origen: Number(op.orden) >= 10_000 ? 'Configurador' : 'Producto base',
          minutos,
          tarifaHora: tarifa ? Number(tarifa) : 0,
          costo,
          detalleTecnico: {
            maquina: op.maquina?.nombre ?? null,
            perfilOperativo: op.perfilOperativo?.nombre ?? null,
            cantidadObjetivoSalida,
            grupoTrabajo: groupLabel,
          },
        };
      });

      const materiasPrimas: Array<Record<string, unknown>> = [];
      const substrateTotalCost = this.calculateGranFormatoSustratoCost({
        variant: candidate.variant,
        consumedAreaM2: candidate.consumedAreaM2,
        consumedLengthMl: largoConsumidoMl,
        warnings: candidateWarnings,
      });
      const usefulFactor =
        candidate.consumedAreaM2 > 0 ? candidate.usefulAreaM2 / candidate.consumedAreaM2 : 0;
      const usefulCost = this.roundProductNumber(substrateTotalCost * usefulFactor);
      const wasteCost = this.roundProductNumber(substrateTotalCost - usefulCost);
      materiasPrimas.push({
        tipo: 'SUSTRATO',
        nombre: candidate.variant.materiaPrima.nombre,
        sku: candidate.variant.sku,
        variantChips: this.buildMateriaPrimaVariantDisplayChips(candidate.variant),
        cantidad: this.roundProductNumber(candidate.usefulAreaM2),
        costoUnitario:
          candidate.usefulAreaM2 > 0 ? this.roundProductNumber(usefulCost / candidate.usefulAreaM2) : 0,
        costo: usefulCost,
        origen: groupLabel ? `Base · ${groupLabel}` : 'Base',
        unidad: 'm2',
        detalle: {
          scope: 'util',
          nestingPreview: true,
          grupoTrabajo: groupLabel,
        },
      });
      materiasPrimas.push({
        tipo: 'SUSTRATO',
        nombre: `${candidate.variant.materiaPrima.nombre} · Desperdicio`,
        sku: candidate.variant.sku,
        variantChips: this.buildMateriaPrimaVariantDisplayChips(candidate.variant),
        cantidad: this.roundProductNumber(candidate.wasteAreaM2),
        costoUnitario:
          candidate.wasteAreaM2 > 0 ? this.roundProductNumber(wasteCost / candidate.wasteAreaM2) : 0,
        costo: wasteCost,
        origen: groupLabel ? `Desperdicio · ${groupLabel}` : 'Desperdicio',
        unidad: 'm2',
        detalle: {
          scope: 'desperdicio',
          nestingPreview: true,
          grupoTrabajo: groupLabel,
        },
      });

      const inkPreview = await this.calculateGranFormatoInkConsumables({
        auth,
        maquinaId: maquinaSeleccionada.id,
        perfilId: perfilSeleccionado?.id ?? null,
        areaUtilM2: candidate.usefulAreaM2,
        warnings: candidateWarnings,
      });
      materiasPrimas.push(
        ...inkPreview.materiales.map((item) => ({
          ...item,
          origen: groupLabel ? `${String(item.origen ?? 'Base')} · ${groupLabel}` : item.origen,
          detalle: {
            ...(typeof item.detalle === 'object' && item.detalle ? item.detalle : {}),
            grupoTrabajo: groupLabel,
          },
        })),
      );

      for (const item of activeChecklistRules) {
        if (item.regla.accion === 'material_extra' && item.regla.materiaPrimaVarianteId) {
          const material = await this.prisma.materiaPrimaVariante.findFirst({
            where: {
              tenantId: auth.tenantId,
              id: item.regla.materiaPrimaVarianteId,
            },
            include: { materiaPrima: true },
          });
          if (!material) {
            candidateWarnings.push('Configurador: material adicional no encontrado.');
            continue;
          }
          const factorConsumo = Number(item.regla.factorConsumo ?? 0);
          if (factorConsumo <= 0) {
            continue;
          }
          let cantidadBase = totalPiezasGrupo;
          if (item.regla.tipoConsumo === 'por_m2') {
            cantidadBase = candidate.usefulAreaM2;
          } else if (item.regla.tipoConsumo === 'por_pliego') {
            cantidadBase = 1;
            candidateWarnings.push(
              'Configurador: tipo de consumo POR_PLIEGO se interpretó como 1 trabajo en gran formato.',
            );
          }
          const cantidad = this.roundProductNumber(
            cantidadBase * factorConsumo * (1 + Number(item.regla.mermaPct ?? 0) / 100),
          );
          const costoUnitario = this.resolveMateriaPrimaVariantUnitCost({
            materiaPrimaVariante: material,
            warnings: candidateWarnings,
            contextLabel: 'Configurador',
          });
          materiasPrimas.push({
            tipo: 'CHECKLIST_MATERIAL',
            nombre: material.materiaPrima.nombre,
            sku: material.sku,
            variantChips: this.buildMateriaPrimaVariantDisplayChips(material),
            cantidad,
            costoUnitario,
            costo: this.roundProductNumber(cantidad * costoUnitario),
            origen: groupLabel ? `Configurador · ${groupLabel}` : 'Configurador',
            detalle: {
              grupoTrabajo: groupLabel,
            },
          });
        }
        if (item.regla.accion === 'costo_extra' && item.regla.costoRegla) {
          const costoValor = Number(item.regla.costoValor ?? 0);
          if (item.regla.costoRegla === 'tiempo_min') {
            const centroId = item.regla.costoCentroCostoId;
            const tarifa = centroId ? tarifaByCentro.get(centroId) ?? null : null;
            if (!tarifa) {
              candidateWarnings.push('Configurador: costo extra sin tarifa publicada para centro de costo.');
              continue;
            }
            centrosCosto.push({
              orden: centrosCosto.length + 1,
              codigo: `CFG-${String(item.regla.id).slice(0, 6).toUpperCase()}`,
              paso: 'Costo extra',
              centroCostoId: centroId ?? '',
              centroCostoNombre: '',
              origen: groupLabel ? `Configurador · ${groupLabel}` : 'Configurador',
              minutos: costoValor,
              tarifaHora: Number(tarifa),
              costo: this.roundProductNumber(Number(tarifa.mul(costoValor / 60))),
              detalleTecnico: { reglaId: item.regla.id, grupoTrabajo: groupLabel },
            });
            continue;
          }
          const multiplicador =
            item.regla.costoRegla === 'por_unidad'
              ? totalPiezasGrupo
              : item.regla.costoRegla === 'por_pliego'
                ? 1
                : 1;
          centrosCosto.push({
            orden: centrosCosto.length + 1,
            codigo: `CFG-${String(item.regla.id).slice(0, 6).toUpperCase()}`,
            paso: 'Costo extra',
            centroCostoId: item.regla.costoCentroCostoId ?? '',
            centroCostoNombre: '',
            origen: groupLabel ? `Configurador · ${groupLabel}` : 'Configurador',
            minutos: 0,
            tarifaHora: 0,
            costo: this.roundProductNumber(costoValor * multiplicador),
            detalleTecnico: {
              reglaId: item.regla.id,
              costoRegla: item.regla.costoRegla,
              grupoTrabajo: groupLabel,
            },
          });
        }
      }

      const totalMateriales = this.roundProductNumber(
        materiasPrimas.reduce((acc, item) => acc + Number(item.costo ?? 0), 0),
      );
      const totalCentrosCosto = this.roundProductNumber(
        centrosCosto.reduce((acc, item) => acc + Number(item.costo ?? 0), 0),
      );
      const totalTecnico = this.roundProductNumber(totalMateriales + totalCentrosCosto);

      const candidateWithCosts: GranFormatoCostosPreviewCandidate = {
        ...candidate,
        substrateCost: substrateTotalCost,
        inkCost: this.roundProductNumber(inkPreview.costo),
        timeCost: totalCentrosCosto,
        totalCost: totalTecnico,
      };
      const nestingPreview = this.buildGranFormatoNestingPreview(candidateWithCosts);

      return {
        candidate: candidateWithCosts,
        warnings: Array.from(new Set(candidateWarnings)),
        materiasPrimas,
        centrosCosto,
        nestingPreview,
        totalMateriales,
        totalCentrosCosto,
        totalTecnico,
      };
    };

    const buildGranFormatoResponse = (input: {
      baseWarnings?: string[];
      resumenTecnico: Record<string, unknown>;
      materiasPrimas: Array<Record<string, unknown>>;
      centrosCosto: Array<Record<string, unknown>>;
      totales: { materiales: number; centrosCosto: number; tecnico: number };
      nestingPreview: Record<string, unknown> | null;
      gruposTrabajo?: Array<Record<string, unknown>>;
      corridasTrabajo?: Array<Record<string, unknown>>;
      simulacionHibrida?: boolean;
    }) => ({
      productoId: producto.id,
      cantidadTotal,
      periodo,
      tecnologia,
      simulacionHibrida: input.simulacionHibrida === true,
      medidasOriginales,
      medidasEfectivas,
      mutacionesAplicadas,
      traceChecklist,
      maquinaId: maquinaSeleccionada.id,
      maquinaNombre: maquinaSeleccionada.nombre,
      perfilId: perfilSeleccionado?.id ?? null,
      perfilNombre: perfilSeleccionado?.nombre ?? '',
      warnings: Array.from(new Set(input.baseWarnings ?? [])),
      resumenTecnico: input.resumenTecnico,
      gruposTrabajo: input.gruposTrabajo,
      corridasTrabajo: input.corridasTrabajo,
      materiasPrimas: input.materiasPrimas,
      centrosCosto: input.centrosCosto,
      totales: input.totales,
      nestingPreview: input.nestingPreview,
    });

    const costedCandidates = await Promise.all(
      normalizedCandidates.map(async (candidate) => {
        const costed = await costGranFormatoCandidate({
          candidate,
          medidasParaCosto: medidasEfectivas,
        });
        return {
          candidate: costed.candidate,
          response: buildGranFormatoResponse({
            baseWarnings: costed.warnings,
            resumenTecnico: {
              varianteId: candidate.variant.id,
              varianteNombre: candidate.variant.sku,
              varianteChips: this.buildGranFormatoVariantChips(candidate.variant),
              anchoRolloMm: candidate.rollWidthMm,
              anchoImprimibleMm: candidate.printableWidthMm,
              orientacion: candidate.orientacion,
              panelizado: candidate.panelizado,
              panelAxis: candidate.panelAxis,
              panelCount: candidate.panelCount,
              panelOverlapMm: candidate.panelOverlapMm,
              panelMaxWidthMm: candidate.panelMaxWidthMm,
              panelDistribution: candidate.panelDistribution,
              panelWidthInterpretation: candidate.panelWidthInterpretation,
              panelMode: candidate.panelMode,
              piezasPorFila: candidate.piecesPerRow,
              filas: candidate.rows,
              largoConsumidoMm: candidate.consumedLengthMm,
              areaUtilM2: this.roundProductNumber(candidate.usefulAreaM2),
              areaConsumidaM2: this.roundProductNumber(candidate.consumedAreaM2),
              areaDesperdicioM2: this.roundProductNumber(candidate.wasteAreaM2),
              desperdicioPct: this.roundProductNumber(candidate.wastePct),
              costoSustrato: this.roundProductNumber(costed.candidate.substrateCost),
              costoTinta: this.roundProductNumber(costed.candidate.inkCost),
              costoTiempo: costed.totalCentrosCosto,
              costoTotal: costed.totalTecnico,
            },
            materiasPrimas: costed.materiasPrimas,
            centrosCosto: costed.centrosCosto,
            totales: {
              materiales: costed.totalMateriales,
              centrosCosto: costed.totalCentrosCosto,
              tecnico: costed.totalTecnico,
            },
            nestingPreview: costed.nestingPreview,
          }),
        };
      }),
    );

    const winner = [...costedCandidates].sort(
      (a, b) =>
        this.compareGranFormatoPreviewCandidates(
          a.candidate,
          b.candidate,
          effectiveImposicionConfig.criterioOptimizacion,
        ) ||
        a.candidate.totalCost - b.candidate.totalCost ||
        a.candidate.wasteAreaM2 - b.candidate.wasteAreaM2 ||
        a.candidate.consumedLengthMm - b.candidate.consumedLengthMm,
    )[0];

    let hybridResponse:
      | {
          response: ReturnType<typeof buildGranFormatoResponse>;
          totalCost: number;
          totalWasteAreaM2: number;
          groupCount: number;
          panelizedPieceCount: number;
        }
      | null = null;

    if (effectiveImposicionConfig.panelizadoActivo) {
      const hybridGroups = this.buildGranFormatoHybridCandidates({
        maquina: maquinaSeleccionada,
        medidas: medidasEfectivas,
        config: effectiveImposicionConfig,
        variants: materialVariantes,
      });
      const hybridNeedsMix =
        hybridGroups.length > 1 &&
        (new Set(hybridGroups.map((item) => item.variant.id)).size > 1 ||
          hybridGroups.some((item) => item.panelizado) && hybridGroups.some((item) => !item.panelizado));

      if (hybridNeedsMix) {
        const costedGroups = await Promise.all(
          hybridGroups.map(async (group, index) => {
            const costed = await costGranFormatoCandidate({
              candidate: group.candidate,
              medidasParaCosto: group.pieces.map((piece) => ({
                anchoMm: piece.anchoMm,
                altoMm: piece.altoMm,
                cantidad: 1,
              })),
              groupLabel: `Rollo ${index + 1}`,
            });
            return {
              ...group,
              ...costed,
              piecesCount: group.pieces.length,
            };
          }),
        );

        const physicalRuns = this.buildGranFormatoHybridPhysicalRuns({
          groups: hybridGroups,
          config: effectiveImposicionConfig,
        });
        const costedRuns = await Promise.all(
          physicalRuns.map(async (run, index) => {
            const costed = await costGranFormatoCandidate({
              candidate: run.candidate,
              medidasParaCosto: run.groups.flatMap((group) =>
                group.pieces.map((piece) => ({
                  anchoMm: piece.anchoMm,
                  altoMm: piece.altoMm,
                  cantidad: 1,
                })),
              ),
              groupLabel: `Corrida ${index + 1}`,
            });
            return {
              ...run,
              ...costed,
            };
          }),
        );

        const corridaIdByGroupKey = new Map<string, string>();
        costedRuns.forEach((run) => {
          run.groups.forEach((group) => {
            corridaIdByGroupKey.set(group.groupKey, run.corridaId);
          });
        });

        const hybridWarnings = Array.from(
          new Set([
            'Simulación híbrida: el trabajo combina más de un grupo de rollo para evitar panelizar piezas que sí entran enteras.',
            ...costedRuns.flatMap((run) => run.warnings),
          ]),
        );
        const hybridMateriasPrimas = costedRuns.flatMap((run) => run.materiasPrimas);
        const hybridCentrosCosto = costedRuns
          .flatMap((run) => run.centrosCosto)
          .map((item, index) => ({
            ...item,
            orden: index + 1,
          }));
        const hybridTotales = {
          materiales: this.roundProductNumber(
            costedRuns.reduce((acc, run) => acc + run.totalMateriales, 0),
          ),
          centrosCosto: this.roundProductNumber(
            costedRuns.reduce((acc, run) => acc + run.totalCentrosCosto, 0),
          ),
          tecnico: this.roundProductNumber(
            costedRuns.reduce((acc, run) => acc + run.totalTecnico, 0),
          ),
        };
        const totalWasteAreaM2 = this.roundProductNumber(
          costedRuns.reduce((acc, run) => acc + run.candidate.wasteAreaM2, 0),
        );
        const totalConsumedLengthMm = this.roundProductNumber(
          costedRuns.reduce((acc, run) => acc + run.candidate.consumedLengthMm, 0),
        );
        const totalUsefulAreaM2 = this.roundProductNumber(
          costedRuns.reduce((acc, run) => acc + run.candidate.usefulAreaM2, 0),
        );
        const totalConsumedAreaM2 = this.roundProductNumber(
          costedRuns.reduce((acc, run) => acc + run.candidate.consumedAreaM2, 0),
        );
        const primaryGroup =
          [...costedRuns].sort(
            (a, b) =>
              b.totalTecnico - a.totalTecnico ||
              b.candidate.consumedAreaM2 - a.candidate.consumedAreaM2,
          )[0] ?? costedRuns[0];

        const gruposTrabajo = costedGroups.map((group, index) => ({
          grupoId: group.groupKey,
          corridaId: corridaIdByGroupKey.get(group.groupKey) ?? null,
          variantId: group.variant.id,
          varianteNombre: group.variant.sku,
          varianteChips: this.buildGranFormatoVariantChips(group.variant),
          panelizado: group.panelizado,
          panelAxis: group.candidate.panelAxis,
          panelCount: group.candidate.panelCount,
          piecesCount: group.piecesCount,
          orientacion: group.candidate.orientacion,
          anchoRolloMm: group.candidate.rollWidthMm,
          anchoImprimibleMm: group.candidate.printableWidthMm,
          largoConsumidoMm: this.roundProductNumber(group.candidate.consumedLengthMm),
          areaUtilM2: this.roundProductNumber(group.candidate.usefulAreaM2),
          areaConsumidaM2: this.roundProductNumber(group.candidate.consumedAreaM2),
          areaDesperdicioM2: this.roundProductNumber(group.candidate.wasteAreaM2),
          desperdicioPct: this.roundProductNumber(group.candidate.wastePct),
          costoSustrato: this.roundProductNumber(group.candidate.substrateCost),
          costoTinta: this.roundProductNumber(group.candidate.inkCost),
          costoTiempo: this.roundProductNumber(group.candidate.timeCost),
          costoTotal: this.roundProductNumber(group.candidate.totalCost),
          materiasPrimas: group.materiasPrimas,
          centrosCosto: group.centrosCosto,
          nestingPreview: group.nestingPreview,
          orden: index + 1,
        }));
        const corridasTrabajo = costedRuns.map((run, index) => ({
          corridaId: run.corridaId,
          variantId: run.variant.id,
          varianteNombre: run.variant.sku,
          varianteChips: this.buildGranFormatoVariantChips(run.variant),
          piecesCount: run.piecesCount,
          groupCount: run.groups.length,
          gruposCompletos: run.groups.filter((group) => !group.panelizado).length,
          gruposPanelizados: run.groups.filter((group) => group.panelizado).length,
          anchoRolloMm: run.candidate.rollWidthMm,
          anchoImprimibleMm: run.candidate.printableWidthMm,
          largoConsumidoMm: this.roundProductNumber(run.candidate.consumedLengthMm),
          areaUtilM2: this.roundProductNumber(run.candidate.usefulAreaM2),
          areaConsumidaM2: this.roundProductNumber(run.candidate.consumedAreaM2),
          areaDesperdicioM2: this.roundProductNumber(run.candidate.wasteAreaM2),
          desperdicioPct: this.roundProductNumber(run.candidate.wastePct),
          costoSustrato: this.roundProductNumber(run.candidate.substrateCost),
          costoTinta: this.roundProductNumber(run.candidate.inkCost),
          costoTiempo: this.roundProductNumber(run.candidate.timeCost),
          costoTotal: this.roundProductNumber(run.candidate.totalCost),
          nestingPreview: run.nestingPreview,
          orden: index + 1,
        }));

        hybridResponse = {
          totalCost: hybridTotales.tecnico,
          totalWasteAreaM2,
          groupCount: costedRuns.length,
          panelizedPieceCount: costedGroups
            .filter((group) => group.panelizado)
            .reduce((acc, group) => acc + group.piecesCount, 0),
          response: buildGranFormatoResponse({
            simulacionHibrida: true,
            baseWarnings: hybridWarnings,
            resumenTecnico: {
              varianteId: 'multiple',
              varianteNombre: 'Combinación de rollos',
              varianteChips: [
                { label: 'Corridas', value: String(costedRuns.length) },
                { label: 'Grupos', value: String(costedGroups.length) },
                { label: 'Piezas panelizadas', value: String(costedGroups.filter((group) => group.panelizado).reduce((acc, group) => acc + group.piecesCount, 0)) },
              ],
              anchoRolloMm: primaryGroup?.candidate.rollWidthMm ?? 0,
              anchoImprimibleMm: primaryGroup?.candidate.printableWidthMm ?? 0,
              orientacion: 'mixta',
              panelizado: costedGroups.some((group) => group.panelizado),
              panelAxis: null,
              panelCount: Math.max(...costedGroups.map((group) => group.candidate.panelCount), 1),
              panelOverlapMm: null,
              panelMaxWidthMm: null,
              panelDistribution: null,
              panelWidthInterpretation: null,
              panelMode: null,
              piezasPorFila: 0,
              filas: 0,
              largoConsumidoMm: totalConsumedLengthMm,
              areaUtilM2: totalUsefulAreaM2,
              areaConsumidaM2: totalConsumedAreaM2,
              areaDesperdicioM2: totalWasteAreaM2,
              desperdicioPct: totalConsumedAreaM2 > 0 ? this.roundProductNumber((totalWasteAreaM2 / totalConsumedAreaM2) * 100) : 0,
              costoSustrato: this.roundProductNumber(costedRuns.reduce((acc, run) => acc + run.candidate.substrateCost, 0)),
              costoTinta: this.roundProductNumber(costedRuns.reduce((acc, run) => acc + run.candidate.inkCost, 0)),
              costoTiempo: hybridTotales.centrosCosto,
              costoTotal: hybridTotales.tecnico,
            },
            gruposTrabajo,
            corridasTrabajo,
            materiasPrimas: hybridMateriasPrimas,
            centrosCosto: hybridCentrosCosto,
            totales: hybridTotales,
            nestingPreview: null,
          }),
        };
      }
    }

    const winnerComparison = {
      totalCost: winner.candidate.totalCost,
      totalWasteAreaM2: winner.candidate.wasteAreaM2,
      groupCount: 1,
      panelizedPieceCount: winner.candidate.panelizado ? cantidadTotal : 0,
    };

    const shouldUseHybrid =
      hybridResponse != null &&
      (hybridResponse.panelizedPieceCount < winnerComparison.panelizedPieceCount ||
        (hybridResponse.panelizedPieceCount === winnerComparison.panelizedPieceCount &&
          (hybridResponse.totalCost < winnerComparison.totalCost ||
            (hybridResponse.totalCost === winnerComparison.totalCost &&
              (hybridResponse.totalWasteAreaM2 < winnerComparison.totalWasteAreaM2 ||
                (hybridResponse.totalWasteAreaM2 === winnerComparison.totalWasteAreaM2 &&
                  hybridResponse.groupCount < winnerComparison.groupCount))))));

    const candidatosResumen = incluirCandidatos
      ? Array.from(
          costedCandidates.reduce((map, row) => {
            const current = map.get(row.candidate.variant.id);
            if (
              !current ||
              this.compareGranFormatoPreviewCandidates(
                row.candidate,
                current.candidate,
                effectiveImposicionConfig.criterioOptimizacion,
              ) < 0 ||
              (this.compareGranFormatoPreviewCandidates(
                row.candidate,
                current.candidate,
                effectiveImposicionConfig.criterioOptimizacion,
              ) === 0 &&
                (row.candidate.totalCost < current.candidate.totalCost ||
                  (row.candidate.totalCost === current.candidate.totalCost &&
                    (row.candidate.wasteAreaM2 < current.candidate.wasteAreaM2 ||
                      (row.candidate.wasteAreaM2 === current.candidate.wasteAreaM2 &&
                        row.candidate.consumedLengthMm < current.candidate.consumedLengthMm)))))
            ) {
              map.set(row.candidate.variant.id, row);
            }
            return map;
          }, new Map<string, (typeof costedCandidates)[number]>()),
        )
          .map(([, row]) => this.buildGranFormatoCostosCandidateResumen(row.candidate))
          .sort(
            (a, b) =>
              (a.panelizado && b.panelizado
                ? a.panelCount - b.panelCount ||
                  (this.getGranFormatoCandidateResumenAveragePanelUsefulSpanMm(b) -
                    this.getGranFormatoCandidateResumenAveragePanelUsefulSpanMm(a))
                : 0) ||
              a.totalCost - b.totalCost ||
              a.wasteAreaM2 - b.wasteAreaM2 ||
              a.consumedLengthMm - b.consumedLengthMm,
          )
      : undefined;

    const selectedResponse = shouldUseHybrid ? hybridResponse!.response : winner.response;

    if (!persistirSnapshot) {
      const previewResponse = this.normalizeProductNumericPrecision({
        ...selectedResponse,
        candidatos: candidatosResumen,
      });
      return {
        ...previewResponse,
      };
    }

    const roundedWinnerResponse = this.normalizeProductNumericPrecision(selectedResponse);

    const snapshot = await this.prisma.cotizacionProductoSnapshot.create({
      data: {
        tenantId: auth.tenantId,
        productoServicioId: producto.id,
        productoVarianteId: null,
        motorCodigo: producto.motorCodigo,
        motorVersion: producto.motorVersion,
        configVersionBase: null,
        configVersionOverride: null,
        cantidad: cantidadTotal,
        periodoTarifa: periodo,
        inputJson: ({
          cantidadTotal,
          periodo,
          tecnologia,
          perfilOverrideId: payload.perfilOverrideId ?? null,
          panelizado: {
            activo: effectiveImposicionConfig.panelizadoActivo,
            modo: effectiveImposicionConfig.panelizadoModo,
            direccion: effectiveImposicionConfig.panelizadoDireccion,
            solapeMm: effectiveImposicionConfig.panelizadoSolapeMm,
            anchoMaxPanelMm: effectiveImposicionConfig.panelizadoAnchoMaxPanelMm,
            distribucion: effectiveImposicionConfig.panelizadoDistribucion,
            interpretacionAnchoMaximo: effectiveImposicionConfig.panelizadoInterpretacionAnchoMaximo,
            manualLayout: effectiveImposicionConfig.panelizadoManualLayout,
          },
          medidasOriginales,
          medidasEfectivas,
          mutacionesAplicadas,
          traceChecklist,
          checklistRespuestas: payload.checklistRespuestas ?? [],
        } as unknown) as Prisma.InputJsonValue,
        resultadoJson: (roundedWinnerResponse as unknown) as Prisma.InputJsonValue,
        total: new Prisma.Decimal(Number((roundedWinnerResponse as any).totales.tecnico ?? 0)),
      },
    });

    return {
      ...roundedWinnerResponse,
      candidatos: candidatosResumen,
      snapshotId: snapshot.id,
      createdAt: snapshot.createdAt.toISOString(),
    };
  }

  async findGranFormatoVariantes(auth: CurrentAuth, productoId: string) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    this.ensureWideFormatProducto(producto);
    const rows = await this.prisma.granFormatoVariante.findMany({
      where: {
        tenantId: auth.tenantId,
        productoServicioId: producto.id,
      },
      include: {
        maquina: true,
        perfilOperativo: true,
        materiaPrimaVariante: {
          include: {
            materiaPrima: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    return rows.map((item) => this.toGranFormatoVarianteResponse(item));
  }

  async createGranFormatoVariante(
    auth: CurrentAuth,
    productoId: string,
    payload: CreateGranFormatoVarianteDto,
  ) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    this.ensureWideFormatProducto(producto);
    const { maquina, perfil, materiaPrimaVariante } = await this.validateGranFormatoVarianteRelations(auth, payload);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        if (payload.esDefault) {
          await tx.granFormatoVariante.updateMany({
            where: {
              tenantId: auth.tenantId,
              productoServicioId: producto.id,
            },
            data: {
              esDefault: false,
            },
          });
        }

        return tx.granFormatoVariante.create({
          data: {
            tenantId: auth.tenantId,
            productoServicioId: producto.id,
            nombre: payload.nombre.trim(),
            maquinaId: maquina.id,
            perfilOperativoId: perfil.id,
            materiaPrimaVarianteId: materiaPrimaVariante.id,
            esDefault: payload.esDefault ?? false,
            permiteOverrideEnCotizacion: payload.permiteOverrideEnCotizacion ?? true,
            activo: payload.activo ?? true,
            observaciones: payload.observaciones?.trim() || null,
            detalleJson: this.buildGranFormatoVarianteDetalle(maquina, perfil),
          },
          include: {
            maquina: true,
            perfilOperativo: true,
            materiaPrimaVariante: {
              include: {
                materiaPrima: true,
              },
            },
          },
        });
      });

      return this.toGranFormatoVarianteResponse(created);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async updateGranFormatoVariante(
    auth: CurrentAuth,
    varianteId: string,
    payload: UpdateGranFormatoVarianteDto,
  ) {
    const current = await this.findGranFormatoVarianteOrThrow(auth, varianteId, this.prisma);
    const producto = await this.findProductoOrThrow(auth, current.productoServicioId, this.prisma);
    this.ensureWideFormatProducto(producto);
    const relationInput = {
      nombre: payload.nombre ?? current.nombre,
      maquinaId: payload.maquinaId ?? current.maquinaId,
      perfilOperativoId: payload.perfilOperativoId ?? current.perfilOperativoId,
      materiaPrimaVarianteId: payload.materiaPrimaVarianteId ?? current.materiaPrimaVarianteId,
      esDefault: payload.esDefault ?? current.esDefault,
      permiteOverrideEnCotizacion:
        payload.permiteOverrideEnCotizacion ?? current.permiteOverrideEnCotizacion,
      activo: payload.activo ?? current.activo,
      observaciones: payload.observaciones ?? current.observaciones ?? '',
    };
    const { maquina, perfil, materiaPrimaVariante } = await this.validateGranFormatoVarianteRelations(
      auth,
      relationInput,
    );

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (relationInput.esDefault) {
          await tx.granFormatoVariante.updateMany({
            where: {
              tenantId: auth.tenantId,
              productoServicioId: current.productoServicioId,
              NOT: { id: current.id },
            },
            data: {
              esDefault: false,
            },
          });
        }

        return tx.granFormatoVariante.update({
          where: { id: current.id },
          data: {
            nombre: relationInput.nombre.trim(),
            maquinaId: maquina.id,
            perfilOperativoId: perfil.id,
            materiaPrimaVarianteId: materiaPrimaVariante.id,
            esDefault: relationInput.esDefault,
            permiteOverrideEnCotizacion: relationInput.permiteOverrideEnCotizacion,
            activo: relationInput.activo,
            observaciones: relationInput.observaciones.trim() || null,
            detalleJson: this.buildGranFormatoVarianteDetalle(maquina, perfil),
          },
          include: {
            maquina: true,
            perfilOperativo: true,
            materiaPrimaVariante: {
              include: {
                materiaPrima: true,
              },
            },
          },
        });
      });

      return this.toGranFormatoVarianteResponse(updated);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async deleteGranFormatoVariante(auth: CurrentAuth, varianteId: string) {
    const variante = await this.findGranFormatoVarianteOrThrow(auth, varianteId, this.prisma);
    await this.prisma.granFormatoVariante.delete({
      where: { id: variante.id },
    });

    return {
      id: variante.id,
      deleted: true,
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

      const preguntasNormalizadas = payload.preguntas.map((pregunta, indexPregunta) => ({
        payload: pregunta,
        id: pregunta.id?.trim() || randomUUID(),
        orden: pregunta.orden ?? indexPregunta + 1,
      }));
      const preguntaRows = new Map<string, { id: string }>();

      for (const preguntaNormalizada of preguntasNormalizadas) {
        const pregunta = preguntaNormalizada.payload;
        const preguntaRow = await tx.productoChecklistPregunta.create({
          data: {
            id: preguntaNormalizada.id,
            tenantId: auth.tenantId,
            productoChecklistId: checklist.id,
            texto: pregunta.texto.trim(),
            tipoPregunta: this.toTipoChecklistPregunta(pregunta.tipoPregunta ?? TipoChecklistPreguntaDto.binaria),
            orden: preguntaNormalizada.orden,
            activo: pregunta.activo ?? true,
          },
        });
        preguntaRows.set(preguntaNormalizada.id, { id: preguntaRow.id });
      }

      for (const preguntaNormalizada of preguntasNormalizadas) {
        const pregunta = preguntaNormalizada.payload;
        const preguntaRow = preguntaRows.get(preguntaNormalizada.id);
        if (!preguntaRow) {
          throw new BadRequestException('No se pudo reconstruir el configurador de preguntas.');
        }

        for (let indexRespuesta = 0; indexRespuesta < pregunta.respuestas.length; indexRespuesta += 1) {
          const respuesta = pregunta.respuestas[indexRespuesta];
          const respuestaId = respuesta.id?.trim() || randomUUID();
          const preguntaSiguienteId = respuesta.preguntaSiguienteId?.trim() || null;
          const respuestaRow = await tx.productoChecklistRespuesta.create({
            data: {
              id: respuestaId,
              tenantId: auth.tenantId,
              productoChecklistPreguntaId: preguntaRow.id,
              preguntaSiguienteId,
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
            if (regla.accion === TipoChecklistAccionReglaDto.mutar_producto_base) {
              const detalleMutacion = this.parseChecklistProductoMutacionDetalle(regla.detalle, true);
              Object.assign(detalleReglaBase, detalleMutacion);
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
    return this.resolveProductMotorModule(producto.motorCodigo, producto.motorVersion).getVariantOverride(
      auth,
      variante.id,
    );
  }

  async getDigitalVariantMotorOverride(auth: CurrentAuth, varianteId: string) {
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
    return this.resolveProductMotorModule(producto.motorCodigo, producto.motorVersion).upsertVariantOverride(
      auth,
      variante.id,
      payload,
    );
  }

  async upsertDigitalVariantMotorOverride(
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
    const merged = this.mergeMotorConfig(motor.code, current?.parametrosJson, payload.parametros);

    const created = await this.prisma.productoVarianteMotorOverride.create({
      data: {
        tenantId: auth.tenantId,
        productoVarianteId: variante.id,
        motorCodigo: motor.code,
        motorVersion: motor.version,
        parametrosJson: merged as Prisma.InputJsonValue,
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
    const variante = await this.findVarianteCompletaOrThrow(auth, varianteId, this.prisma);
    return this.resolveProductMotorModule(
      variante.productoServicio.motorCodigo,
      variante.productoServicio.motorVersion,
    ).quoteVariant(auth, variante.id, payload);
  }

  async quoteDigitalVariant(
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
    const checklistSelectedByPreguntaId = new Map(
      checklistRespuestasInput.map((item) => [item.preguntaId, item.respuestaId]),
    );
    const checklistPreguntaIdsActivas = this.resolveChecklistPreguntaIdsActivas(
      checklist?.preguntas ?? [],
      checklistSelectedByPreguntaId,
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
        : Promise.resolve<any[]>([]),
      pasosFijosPerfilIds.length
        ? await this.prisma.maquinaPerfilOperativo.findMany({
            where: { tenantId: auth.tenantId, id: { in: pasosFijosPerfilIds } },
          })
        : Promise.resolve<any[]>([]),
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
      if (!checklistPreguntaIdsActivas.has(pregunta.id)) {
        continue;
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
        [
          ...operacionesCotizadas
            .map((op) => op.maquinaId)
            .filter((item): item is string => Boolean(item)),
          ...checklistNivelMachineIds,
        ],
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
        pliegoAnchoMm: pliegoImpresion.anchoMm,
        pliegoAltoMm: pliegoImpresion.altoMm,
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
      const costoPaso = this.roundProductNumber(Number(tarifa.mul(totalMin / 60)));
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
        totalMin: this.roundProductNumber(totalMin),
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
        cantidad: this.roundProductNumber(pliegosMermaOperativaImpresion),
        costoUnitario: costoPapelUnit,
        costo: this.roundProductNumber(costoPapelMerma),
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
          cantidad: this.roundProductNumber(consumo),
          costoUnitario: this.roundProductNumber(costoUnit),
          costo: this.roundProductNumber(costo),
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
      const montoBase = this.roundProductNumber(Number(tarifa.mul(minutosServicio / 60)));
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
        montoBase: this.roundProductNumber(montoBase),
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
        tiempoFijoMin: this.roundProductNumber(minutosServicio),
        totalMin: this.roundProductNumber(minutosServicio),
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
        monto = this.roundProductNumber(Number(tarifaCentro.mul(Number(cost.valor) / 60)));
      }
      const montoRounded = this.roundProductNumber(monto);
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
      const costoRounded = this.roundProductNumber(costo);
      costoAdicionalesMateriales += costoRounded;
      materiales.push({
        tipo: 'ADDITIONAL_MATERIAL_EFFECT',
        nombre: material.materiaPrimaVariante.materiaPrima.nombre,
        sku: material.materiaPrimaVariante.sku,
        cantidad: this.roundProductNumber(consumo),
        costoUnitario: this.roundProductNumber(costoUnit),
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
      let maquinaNivel: (typeof checklistNivelMaquinaById extends Map<string, infer T> ? T : never) | null =
        null;
      let perfilNivel: (typeof checklistNivelPerfilById extends Map<string, infer T> ? T : never) | null =
        null;
      let timingOverrideNivel:
        | ReturnType<ProductosServiciosService['calculateTerminatingOperationTiming']>
        | null = null;
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
        maquinaNivel = nivel.maquinaId ? checklistNivelMaquinaById.get(nivel.maquinaId) ?? null : null;
        perfilNivel =
          nivel.perfilOperativoId ? checklistNivelPerfilById.get(nivel.perfilOperativoId) ?? null : null;
        const setupBase = Number(nivel.setupMin ?? this.getSetupFromPerfilOperativo(perfilNivel) ?? 0);
        const cleanupBase = Number(nivel.cleanupMin ?? 0);
        timingOverrideNivel = this.calculateTerminatingOperationTiming({
          operacion: {
            maquina: maquinaNivel,
            perfilOperativo: perfilNivel,
          },
          cantidad,
          pliegos,
          setupMinBase: setupBase,
          cleanupMinBase: cleanupBase,
          tiempoFijoMinBase: 0,
          cantidadObjetivoSalida: quantityByUnidad,
          pliegoAnchoMm: pliegoImpresion.anchoMm,
          pliegoAltoMm: pliegoImpresion.altoMm,
          varianteAnchoMm: Number(variante.anchoMm),
          varianteAltoMm: Number(variante.altoMm),
        });
        if (timingOverrideNivel) {
          setupMin = timingOverrideNivel.setupMin;
          cleanupMin = timingOverrideNivel.cleanupMin;
          tiempoFijoMin = timingOverrideNivel.tiempoFijoMin;
          runMin = timingOverrideNivel.runMin;
          sourceProductividad = 'nivel_variable_perfil';
          detalleTecnico = {
            ...detalleTecnico,
            sourceProductividad,
            maquina: maquinaNivel?.nombre ?? null,
            perfilOperativo: perfilNivel?.nombre ?? null,
            ...(timingOverrideNivel.trace ?? {}),
          };
          if (timingOverrideNivel.warnings?.length) {
            warnings.push(
              ...timingOverrideNivel.warnings.map(
                (warning) => `${item.label} ${item.pasoPlantilla?.nombre ?? item.reglaId} (${nivel.nombre}): ${warning}`,
              ),
            );
          }
        } else {
          const productividadBase =
            perfilNivel?.productivityValue
              ? Number(perfilNivel.productivityValue)
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
              maquina: maquinaNivel?.nombre ?? null,
              perfilOperativo: perfilNivel?.nombre ?? null,
              cantidadObjetivoSalida: quantityByUnidad,
              productividadAplicada: productividad.productividadAplicada,
            };
          }
        }
      }

      if (maquinaNivel?.id) {
        const tonerAndWear = this.calculateMachineConsumables({
          operation: {
            maquinaId: maquinaNivel.id,
            perfilOperativoId: perfilNivel?.id ?? null,
            maquina: maquinaNivel,
            productividadBase:
              perfilNivel?.productivityValue ??
              (nivel.productividadBase === null || nivel.productividadBase === undefined
                ? null
                : new Prisma.Decimal(nivel.productividadBase)),
          } as any,
          tipoImpresion: tipoImpresionSeleccionado,
          carasFactor,
          pliegos,
          pliegosEfectivos: pliegos,
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
          operation: {
            maquinaId: maquinaNivel.id,
            perfilOperativoId: perfilNivel?.id ?? null,
            maquina: maquinaNivel,
          },
          consumiblesFilm,
          timingOverride: timingOverrideNivel,
          warnings,
        });
        materiales.push(...laminadoFilm.materiales);
        costoConsumiblesTerminacion += laminadoFilm.costo;
      }

      const totalMin = this.roundProductNumber(setupMin + runMin + cleanupMin + tiempoFijoMin);
      if (totalMin <= 0) {
        continue;
      }
      const costoNivel = this.roundProductNumber(Number(tarifa.mul(totalMin / 60)));
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
        setupMin: this.roundProductNumber(setupMin),
        runMin: this.roundProductNumber(runMin),
        cleanupMin: this.roundProductNumber(cleanupMin),
        tiempoFijoMin: this.roundProductNumber(tiempoFijoMin),
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
        monto = this.roundProductNumber(Number(tarifa.mul(valor / 60)));
      }
      const montoRounded = this.roundProductNumber(monto);
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
      const costo = this.roundProductNumber(consumo * costoUnit);
      costoAdicionalesMateriales += costo;
      materiales.push({
        tipo: 'CHECKLIST_MATERIAL',
        nombre: item.regla.materiaPrimaVariante.materiaPrima.nombre,
        sku: item.regla.materiaPrimaVariante.sku,
        cantidad: this.roundProductNumber(consumo),
        costoUnitario: this.roundProductNumber(costoUnit),
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

    const total = this.roundProductNumber(
      costoPapel +
        costoToner +
        costoDesgaste +
        costoConsumiblesTerminacion +
        costoProcesos +
        costoAdicionalesCostEffects +
        costoAdicionalesMateriales,
    );
    const unitario = this.roundProductNumber(total / cantidad);

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
        procesos: this.roundProductNumber(costoProcesos),
        papel: this.roundProductNumber(costoPapel),
        toner: this.roundProductNumber(costoToner),
        desgaste: this.roundProductNumber(costoDesgaste),
        consumiblesTerminacion: this.roundProductNumber(costoConsumiblesTerminacion),
        adicionalesMateriales: this.roundProductNumber(costoAdicionalesMateriales),
        adicionalesCostEffects: this.roundProductNumber(costoAdicionalesCostEffects),
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

    const roundedResult = this.normalizeProductNumericPrecision(result);

    const snapshot = await this.prisma.cotizacionProductoSnapshot.create({
      data: {
        tenantId: auth.tenantId,
        productoServicioId: variante.productoServicioId,
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
        resultadoJson: (roundedResult as unknown) as Prisma.InputJsonValue,
        total: new Prisma.Decimal(Number((roundedResult as any).total ?? 0)),
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
      ...roundedResult,
      createdAt: snapshot.createdAt.toISOString(),
    };
  }

  async quoteVinylCutVariant(
    auth: CurrentAuth,
    varianteId: string,
    payload: CotizarProductoVarianteDto,
  ) {
    const cantidadTrabajos = Math.max(1, Math.floor(Number(payload.cantidad ?? 1)));
    const periodo = this.normalizePeriodo(payload.periodo);
    const variante = await this.findVarianteCompletaOrThrow(auth, varianteId, this.prisma);
    const motor = this.resolveMotorOrThrow(
      variante.productoServicio.motorCodigo,
      variante.productoServicio.motorVersion,
    );
    const { config, configVersionBase, configVersionOverride } = await this.getEffectiveMotorConfig(
      auth,
      variante.productoServicio.id,
      variante.id,
      motor,
    );
    const effectiveConfig = this.mergeMotorConfig(
      motor.code,
      config as Prisma.JsonValue,
      (payload.parametros ?? {}) as Record<string, unknown>,
    );
    const simulation = await this.buildVinylCutSimulation(
      auth,
      variante,
      effectiveConfig,
      periodo,
      cantidadTrabajos,
    );
    const winner = simulation.items[0] as Record<string, unknown> | undefined;
    if (!winner) {
      throw new BadRequestException('No se encontró una combinación válida de material y plotter para el trabajo.');
    }

    const winnerTotales = this.asObject(winner.totales);
    const winnerResumenTecnico = this.asObject(winner.resumenTecnico);
    const winnerWarnings = Array.isArray(winner.warnings) ? winner.warnings.map((item) => String(item)) : [];
    const winnerCentrosCosto = Array.isArray(winner.centrosCosto) ? winner.centrosCosto : [];
    const winnerMateriasPrimas = Array.isArray(winner.materiasPrimas) ? winner.materiasPrimas : [];

    const total = Number(winnerTotales.tecnico ?? 0);
    const largoConsumidoMl = this.roundProductNumber(
      Number(winnerResumenTecnico.largoConsumidoMm ?? 0) / 1000,
    );
    const unitario = largoConsumidoMl > 0 ? this.roundProductNumber(total / largoConsumidoMl) : total;

    const result = {
      varianteId: variante.id,
      productoServicioId: variante.productoServicioId,
      productoNombre: variante.productoServicio.nombre,
      varianteNombre: variante.nombre,
      motorCodigo: motor.code,
      motorVersion: motor.version,
      periodo,
      cantidad: cantidadTrabajos,
      piezasPorPliego: Number(winnerResumenTecnico.totalPiezas ?? 0),
      pliegos: 1,
      warnings: winnerWarnings,
      bloques: {
        procesos: winnerCentrosCosto.map((item: any) => ({
          orden: item.orden,
          codigo: item.codigo,
          nombre: item.paso,
          centroCostoId: item.centroCostoId,
          centroCostoNombre: item.centroCostoNombre,
          origen: item.origen,
          addonId: null,
          detalleTecnico: item.detalleTecnico ?? null,
          setupMin: 0,
          runMin: Number(item.minutos ?? 0),
          cleanupMin: 0,
          tiempoFijoMin: 0,
          totalMin: Number(item.minutos ?? 0),
          tarifaHora: Number(item.tarifaHora ?? 0),
          costo: Number(item.costo ?? 0),
        })),
        materiales: winnerMateriasPrimas,
      },
      subtotales: {
        procesos: Number(winnerTotales.centrosCosto ?? 0),
        papel: Number(winnerTotales.materiales ?? 0),
        toner: 0,
        desgaste: 0,
        consumiblesTerminacion: 0,
        adicionalesMateriales: 0,
        adicionalesCostEffects: 0,
      },
      total,
      unitario,
      trazabilidad: {
        config: effectiveConfig,
        configVersionBase,
        configVersionOverride,
        resumenTecnico: winnerResumenTecnico,
        nestingPreview: winner.nestingPreview ?? null,
      },
    };

    const roundedResult = this.normalizeProductNumericPrecision(result);

    const snapshot = await this.prisma.cotizacionProductoSnapshot.create({
      data: {
        tenantId: auth.tenantId,
        productoServicioId: variante.productoServicioId,
        productoVarianteId: variante.id,
        motorCodigo: motor.code,
        motorVersion: motor.version,
        configVersionBase,
        configVersionOverride,
        cantidad: cantidadTrabajos,
        periodoTarifa: periodo,
        inputJson: ({
          cantidad: cantidadTrabajos,
          periodo,
          config: effectiveConfig,
        } as unknown) as Prisma.InputJsonValue,
        resultadoJson: (roundedResult as unknown) as Prisma.InputJsonValue,
        total: new Prisma.Decimal(Number((roundedResult as any).total ?? 0)),
      },
    });

    return {
      snapshotId: snapshot.id,
      ...roundedResult,
      createdAt: snapshot.createdAt.toISOString(),
    };
  }

  async previewVarianteImposicion(
    auth: CurrentAuth,
    varianteId: string,
    payload: PreviewImposicionProductoVarianteDto,
  ) {
    const variante = await this.findVarianteCompletaOrThrow(auth, varianteId, this.prisma);
    return this.resolveProductMotorModule(
      variante.productoServicio.motorCodigo,
      variante.productoServicio.motorVersion,
    ).previewVariant(auth, variante.id, payload);
  }

  async previewDigitalVariant(
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
    const config = this.mergeMotorConfig(
      motor.code,
      persisted as Prisma.JsonValue,
      payload.parametros ?? {},
    );
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
    return this.getVarianteCotizacionesBase(auth, varianteId);
  }

  async previewVinylCutVariant(
    auth: CurrentAuth,
    varianteId: string,
    payload: PreviewImposicionProductoVarianteDto,
  ) {
    const variante = await this.findVarianteCompletaOrThrow(auth, varianteId, this.prisma);
    const motor = this.resolveMotorOrThrow(
      variante.productoServicio.motorCodigo,
      variante.productoServicio.motorVersion,
    );
    const { config } = await this.getEffectiveMotorConfig(
      auth,
      variante.productoServicio.id,
      variante.id,
      motor,
    );
    const effectiveConfig = this.mergeMotorConfig(
      motor.code,
      config as Prisma.JsonValue,
      payload.parametros ?? {},
    );
    return this.buildVinylCutSimulation(
      auth,
      variante,
      effectiveConfig,
      this.normalizePeriodo(undefined),
      1,
    );
  }

  private async getVarianteCotizacionesBase(auth: CurrentAuth, varianteId: string) {
    await this.findVarianteOrThrow(auth, varianteId, this.prisma);

    const rows = await this.prisma.cotizacionProductoSnapshot.findMany({
      where: {
        tenantId: auth.tenantId,
        productoVarianteId: varianteId,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return rows.map((item) => this.mapCotizacionSnapshotResumen(item));
  }

  async getProductoCotizaciones(auth: CurrentAuth, productoId: string) {
    const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
    this.ensureWideFormatProducto(producto);

    const rows = await this.prisma.cotizacionProductoSnapshot.findMany({
      where: {
        tenantId: auth.tenantId,
        productoServicioId: productoId,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return rows.map((item) => this.mapCotizacionSnapshotResumen(item));
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
      total: this.roundProductNumber(Number(item.total)),
      resultado: this.normalizeProductNumericPrecision(item.resultadoJson),
      createdAt: item.createdAt.toISOString(),
    };
  }

  private mapCotizacionSnapshotResumen(item: {
    id: string;
    cantidad: number;
    periodoTarifa: string;
    motorCodigo: string;
    motorVersion: number;
    configVersionBase: number | null;
    configVersionOverride: number | null;
    total: Prisma.Decimal;
    createdAt: Date;
  }) {
    return {
      id: item.id,
      cantidad: this.roundProductNumber(item.cantidad),
      periodoTarifa: item.periodoTarifa,
      motorCodigo: item.motorCodigo,
      motorVersion: item.motorVersion,
      configVersionBase: item.configVersionBase,
      configVersionOverride: item.configVersionOverride,
      total: this.roundProductNumber(Number(item.total)),
      unitario: this.roundProductNumber(item.cantidad > 0 ? Number(item.total.div(item.cantidad)) : Number(item.total)),
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

  private async findImpuestoOrThrow(
    auth: CurrentAuth,
    id: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await tx.productoImpuestoCatalogo.findFirst({
      where: {
        tenantId: auth.tenantId,
        id,
      },
    });

    if (!item) {
      throw new NotFoundException('Impuesto no encontrado.');
    }

    return item;
  }

  private async findComisionOrThrow(
    auth: CurrentAuth,
    id: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await tx.productoComisionCatalogo.findFirst({
      where: {
        tenantId: auth.tenantId,
        id,
      },
    });

    if (!item) {
      throw new NotFoundException('Esquema de comisiones no encontrado.');
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

  private async findGranFormatoVarianteOrThrow(
    auth: CurrentAuth,
    id: string,
    tx: PrismaService | Prisma.TransactionClient,
  ) {
    const item = await tx.granFormatoVariante.findFirst({
      where: {
        tenantId: auth.tenantId,
        id,
      },
      include: {
        maquina: true,
        perfilOperativo: true,
        materiaPrimaVariante: {
          include: {
            materiaPrima: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Variante de gran formato no encontrada.');
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
    const preguntaRefById = new Map<string, { texto: string; orden: number }>();
    const respuestaRefs: Array<{ preguntaId: string; preguntaTexto: string; respuesta: UpsertChecklistRespuestaDto }> =
      [];

    const preguntaOrdenes = new Set<number>();
    for (const [preguntaIndex, pregunta] of payload.preguntas.entries()) {
      const ordenPregunta = pregunta.orden ?? preguntaIndex + 1;
      const preguntaId = pregunta.id?.trim() || `pregunta-${preguntaIndex + 1}`;
      if (preguntaOrdenes.has(ordenPregunta)) {
        throw new BadRequestException('Hay preguntas con orden duplicado en el checklist.');
      }
      preguntaOrdenes.add(ordenPregunta);
      if (!pregunta.texto.trim()) {
        throw new BadRequestException('El texto de cada pregunta es obligatorio.');
      }
      preguntaRefById.set(preguntaId, { texto: pregunta.texto.trim(), orden: ordenPregunta });
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
        respuestaRefs.push({ preguntaId, preguntaTexto: pregunta.texto.trim(), respuesta });
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
          if (regla.accion === TipoChecklistAccionReglaDto.mutar_producto_base) {
            this.parseChecklistProductoMutacionDetalle(regla.detalle, true);
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

    const questionGraph = new Map<string, Set<string>>();
    for (const { preguntaId, preguntaTexto, respuesta } of respuestaRefs) {
      const preguntaSiguienteId = respuesta.preguntaSiguienteId?.trim() || null;
      if (!preguntaSiguienteId) continue;
      if (!preguntaRefById.has(preguntaSiguienteId)) {
        throw new BadRequestException(
          `La respuesta "${respuesta.texto.trim()}" de "${preguntaTexto}" referencia una pregunta inexistente.`,
        );
      }
      if (preguntaSiguienteId === preguntaId) {
        throw new BadRequestException('Una respuesta no puede activar la misma pregunta.');
      }
      const set = questionGraph.get(preguntaId) ?? new Set<string>();
      set.add(preguntaSiguienteId);
      questionGraph.set(preguntaId, set);
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (preguntaId: string) => {
      if (visiting.has(preguntaId)) {
        throw new BadRequestException('El configurador no puede contener ciclos entre preguntas.');
      }
      if (visited.has(preguntaId)) return;
      visiting.add(preguntaId);
      for (const nextId of questionGraph.get(preguntaId) ?? []) {
        visit(nextId);
      }
      visiting.delete(preguntaId);
      visited.add(preguntaId);
    };

    for (const preguntaId of questionGraph.keys()) {
      visit(preguntaId);
    }
  }

  private parseChecklistProductoMutacionDetalle(
    value: unknown,
    throwOnError = false,
  ): ChecklistProductoMutacionDetalle | null {
    const detalle = this.asObject(value);
    const fail = (message: string) => {
      if (throwOnError) {
        throw new BadRequestException(message);
      }
      return null;
    };
    const tipo = typeof detalle.tipo === 'string' ? detalle.tipo.trim() : '';
    if (!tipo) {
      return fail('La regla MUTAR_PRODUCTO_BASE requiere un tipo de mutación.');
    }
    if (tipo !== 'agregar_demasia_por_lado') {
      return fail('La mutación configurada no está soportada todavía.');
    }
    const ejes = typeof detalle.ejes === 'string' ? detalle.ejes.trim() : '';
    if (ejes !== 'ancho' && ejes !== 'alto' && ejes !== 'ambos') {
      return fail('La mutación AGREGAR_DEMASIA_POR_LADO requiere ejes válidos.');
    }
    const valorMmPorLado = Number(detalle.valorMmPorLado);
    if (!Number.isFinite(valorMmPorLado) || valorMmPorLado <= 0) {
      return fail('La mutación AGREGAR_DEMASIA_POR_LADO requiere valorMmPorLado mayor a 0.');
    }
    return {
      tipo: 'agregar_demasia_por_lado',
      ejes,
      valorMmPorLado,
    };
  }

  private applyGranFormatoChecklistProductMutations(input: {
    medidas: Array<{ anchoMm: number; altoMm: number; cantidad: number }>;
    activeChecklistRules: Array<{
      preguntaId: string;
      pregunta: string;
      respuestaId: string;
      respuesta: string;
      regla: { id: string; accion: string; detalle?: unknown };
    }>;
  }) {
    const medidasOriginales = input.medidas.map((item) => ({
      anchoMm: item.anchoMm,
      altoMm: item.altoMm,
      cantidad: item.cantidad,
    }));
    const medidasEfectivas = input.medidas.map((item) => ({
      anchoMm: item.anchoMm,
      altoMm: item.altoMm,
      cantidad: item.cantidad,
    }));
    const traceChecklist = Array.from(
      new Map(
        input.activeChecklistRules.map((item) => [
          `${item.preguntaId}:${item.respuestaId}`,
          {
            preguntaId: item.preguntaId,
            pregunta: item.pregunta,
            respuestaId: item.respuestaId,
            respuesta: item.respuesta,
          },
        ]),
      ).values(),
    );
    const mutacionesAplicadas: GranFormatoChecklistMutationTrace[] = [];

    for (const item of input.activeChecklistRules) {
      if (item.regla.accion !== 'mutar_producto_base') continue;
      const detalle = this.parseChecklistProductoMutacionDetalle(item.regla.detalle, true);
      if (!detalle) continue;

      let deltaAnchoMm = 0;
      let deltaAltoMm = 0;
      if (detalle.ejes === 'ancho' || detalle.ejes === 'ambos') {
        deltaAnchoMm += detalle.valorMmPorLado * 2;
      }
      if (detalle.ejes === 'alto' || detalle.ejes === 'ambos') {
        deltaAltoMm += detalle.valorMmPorLado * 2;
      }
      for (const medida of medidasEfectivas) {
        medida.anchoMm += deltaAnchoMm;
        medida.altoMm += deltaAltoMm;
      }
      mutacionesAplicadas.push({
        tipo: detalle.tipo,
        ejes: detalle.ejes,
        valorMmPorLado: detalle.valorMmPorLado,
        deltaAnchoMm,
        deltaAltoMm,
        preguntaId: item.preguntaId,
        pregunta: item.pregunta,
        respuestaId: item.respuestaId,
        respuesta: item.respuesta,
        reglaId: item.regla.id,
      });
    }

    return {
      medidasOriginales,
      medidasEfectivas,
      mutacionesAplicadas,
      traceChecklist,
    };
  }

  private applyGranFormatoOriginalMeasuresToCandidatePlacements(input: {
    candidate: GranFormatoCostosPreviewCandidate;
    medidasOriginales: Array<{ anchoMm: number; altoMm: number; cantidad: number }>;
  }): GranFormatoCostosPreviewCandidate {
    const originalesBySourcePieceId = new Map<
      string,
      { anchoMm: number; altoMm: number }
    >();
    for (const [medidaIndex, medida] of input.medidasOriginales.entries()) {
      for (let copyIndex = 0; copyIndex < Math.max(1, medida.cantidad); copyIndex += 1) {
        originalesBySourcePieceId.set(`piece-${medidaIndex}-${copyIndex}`, {
          anchoMm: medida.anchoMm,
          altoMm: medida.altoMm,
        });
      }
    }

    return {
      ...input.candidate,
      placements: input.candidate.placements.map((placement) => {
        const original =
          (placement.sourcePieceId
            ? originalesBySourcePieceId.get(placement.sourcePieceId) ?? null
            : null) ?? null;
        if (!original) {
          return placement;
        }
        return {
          ...placement,
          originalWidthMm: original.anchoMm,
          originalHeightMm: original.altoMm,
        };
      }),
    };
  }

  private resolveChecklistPreguntaIdsActivas(
    preguntas: Array<{
      id: string;
      activo: boolean;
      respuestas: Array<{ id: string; activo: boolean; preguntaSiguienteId: string | null }>;
    }>,
    selectedByPreguntaId: Map<string, string>,
  ) {
    const referencedQuestionIds = new Set<string>();
    for (const pregunta of preguntas) {
      for (const respuesta of pregunta.respuestas) {
        if (!respuesta.activo || !respuesta.preguntaSiguienteId) continue;
        referencedQuestionIds.add(respuesta.preguntaSiguienteId);
      }
    }

    const preguntasRaiz = preguntas
      .filter((pregunta) => pregunta.activo && !referencedQuestionIds.has(pregunta.id))
      .sort((a, b) => 0);
    const activeQuestionIds = new Set<string>();
    const queue = [...preguntasRaiz];

    while (queue.length > 0) {
      const pregunta = queue.shift();
      if (!pregunta || activeQuestionIds.has(pregunta.id)) continue;
      activeQuestionIds.add(pregunta.id);
      const selectedRespuestaId = selectedByPreguntaId.get(pregunta.id);
      if (!selectedRespuestaId) continue;
      const respuesta = pregunta.respuestas.find(
        (item) => item.id === selectedRespuestaId && item.activo,
      );
      if (!respuesta?.preguntaSiguienteId) continue;
      const preguntaHija = preguntas.find(
        (item) => item.id === respuesta.preguntaSiguienteId && item.activo,
      );
      if (preguntaHija) {
        queue.push(preguntaHija);
      }
    }

    return activeQuestionIds;
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
        preguntaSiguienteId: string | null;
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
          preguntaSiguienteId: respuesta.preguntaSiguienteId,
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

  private toGranFormatoVarianteResponse(item: {
    id: string;
    productoServicioId: string;
    nombre: string;
    esDefault: boolean;
    permiteOverrideEnCotizacion: boolean;
    activo: boolean;
    observaciones: string | null;
    detalleJson: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    maquina: {
      id: string;
      nombre: string;
      plantilla: PlantillaMaquinaria;
      geometriaTrabajo: GeometriaTrabajoMaquina;
      anchoUtil: Prisma.Decimal | null;
      capacidadesAvanzadasJson: Prisma.JsonValue | null;
    };
    perfilOperativo: {
      id: string;
      nombre: string;
      printMode: TipoImpresionProductoVariante | null;
      productivityValue: Prisma.Decimal | null;
      productivityUnit: UnidadProduccionMaquina | null;
      materialPreset: string | null;
      cantidadPasadas: number | null;
      detalleJson: Prisma.JsonValue | null;
    };
    materiaPrimaVariante: {
      id: string;
      sku: string;
      materiaPrima: {
        nombre: string;
      };
    };
  }) {
    const detalle = this.asObject(item.detalleJson);
    return {
      id: item.id,
      productoServicioId: item.productoServicioId,
      nombre: item.nombre,
      maquinaId: item.maquina.id,
      maquinaNombre: item.maquina.nombre,
      plantillaMaquina: this.enumToApiValue(item.maquina.plantilla),
      tecnologia: this.deriveGranFormatoTecnologia(
        item.maquina.plantilla,
        item.maquina.capacidadesAvanzadasJson,
      ),
      geometriaTrabajo: this.enumToApiValue(item.maquina.geometriaTrabajo),
      anchoUtilMaquina: this.decimalToNumber(item.maquina.anchoUtil),
      perfilOperativoId: item.perfilOperativo.id,
      perfilOperativoNombre: item.perfilOperativo.nombre,
      productivityValue: this.decimalToNumber(item.perfilOperativo.productivityValue),
      productivityUnit: item.perfilOperativo.productivityUnit
        ? this.enumToApiValue(item.perfilOperativo.productivityUnit)
        : '',
      cantidadPasadas: item.perfilOperativo.cantidadPasadas ?? null,
      materialPreset: item.perfilOperativo.materialPreset ?? '',
      configuracionTintas: this.deriveGranFormatoConfiguracionTintas(
        item.perfilOperativo.detalleJson,
        item.perfilOperativo.printMode,
      ),
      materiaPrimaVarianteId: item.materiaPrimaVariante.id,
      materiaPrimaNombre: item.materiaPrimaVariante.materiaPrima.nombre,
      materiaPrimaSku: item.materiaPrimaVariante.sku,
      esDefault: item.esDefault,
      permiteOverrideEnCotizacion: item.permiteOverrideEnCotizacion,
      activo: item.activo,
      observaciones: item.observaciones ?? '',
      detalle,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private async buildGranFormatoRutaBaseResponse(
    auth: CurrentAuth,
    producto: {
      id: string;
      detalleJson?: Prisma.JsonValue | null;
      updatedAt: Date;
    },
  ) {
    const procesoDefinicionId = this.getGranFormatoRutaBaseProcesoDefinicionId(producto.detalleJson);
    const reglasStored = this.getGranFormatoRutaBaseReglasImpresion(producto.detalleJson);
    const plantillaIds = Array.from(new Set(reglasStored.map((item) => item.pasoPlantillaId)));
    const maquinaIds = Array.from(
      new Set(reglasStored.map((item) => item.maquinaId).filter((value): value is string => Boolean(value))),
    );
    const perfilIds = Array.from(
      new Set(
        reglasStored.map((item) => item.perfilOperativoDefaultId).filter((value): value is string => Boolean(value)),
      ),
    );

    const [plantillas, maquinas, perfiles, proceso] = await Promise.all([
      plantillaIds.length
        ? this.prisma.procesoOperacionPlantilla.findMany({
            where: { tenantId: auth.tenantId, id: { in: plantillaIds } },
            select: { id: true, nombre: true },
          })
        : Promise.resolve([]),
      maquinaIds.length
        ? this.prisma.maquina.findMany({
            where: { tenantId: auth.tenantId, id: { in: maquinaIds } },
            select: { id: true, nombre: true },
          })
        : Promise.resolve([]),
      perfilIds.length
        ? this.prisma.maquinaPerfilOperativo.findMany({
            where: { tenantId: auth.tenantId, id: { in: perfilIds } },
            select: { id: true, nombre: true },
          })
        : Promise.resolve([]),
      procesoDefinicionId
        ? this.prisma.procesoDefinicion.findFirst({
            where: { tenantId: auth.tenantId, id: procesoDefinicionId },
            select: { id: true, nombre: true },
          })
        : Promise.resolve(null),
    ]);

    const plantillaById = new Map(plantillas.map((item) => [item.id, item]));
    const maquinaById = new Map(maquinas.map((item) => [item.id, item]));
    const perfilById = new Map(perfiles.map((item) => [item.id, item]));

    return {
      productoId: producto.id,
      procesoDefinicionId: proceso?.id ?? procesoDefinicionId ?? null,
      procesoDefinicionNombre: proceso?.nombre ?? '',
      reglasImpresion: reglasStored.map((item) => ({
        id: `${item.tecnologia}:${item.maquinaId ?? 'default'}:${item.pasoPlantillaId}`,
        tecnologia: item.tecnologia,
        maquinaId: item.maquinaId,
        maquinaNombre: item.maquinaId ? maquinaById.get(item.maquinaId)?.nombre ?? '' : '',
        pasoPlantillaId: item.pasoPlantillaId,
        pasoPlantillaNombre: plantillaById.get(item.pasoPlantillaId)?.nombre ?? '',
        perfilOperativoDefaultId: item.perfilOperativoDefaultId,
        perfilOperativoDefaultNombre: item.perfilOperativoDefaultId
          ? perfilById.get(item.perfilOperativoDefaultId)?.nombre ?? ''
          : '',
      })),
      updatedAt: producto.updatedAt.toISOString(),
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

  private toImpuestoResponse(item: {
    id: string;
    codigo: string;
    nombre: string;
    porcentaje: number;
    detalleJson?: Prisma.JsonValue | null;
    activo: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      codigo: item.codigo,
      nombre: item.nombre,
      porcentaje: Number(item.porcentaje),
      detalle: this.parseImpuestoDetalle(item.detalleJson ?? null),
      activo: item.activo,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private toComisionResponse(item: {
    id: string;
    codigo: string;
    nombre: string;
    porcentaje: number;
    detalleJson?: Prisma.JsonValue | null;
    activo: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: item.id,
      codigo: item.codigo,
      nombre: item.nombre,
      porcentaje: Number(item.porcentaje),
      detalle: this.parseComisionDetalle(item.detalleJson ?? null),
      activo: item.activo,
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
    subfamiliaProducto?: { nombre: string; unidadComercial?: string | null } | null;
    unidadComercial?: string | null;
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
      unidadComercial: this.normalizeUnidadComercialProductoValue(item.unidadComercial) || 'unidad',
      precio: this.getProductoPrecioConfig(item.detalleJson),
      precioEspecialClientes: this.getProductoPrecioEspecialClientes(item.detalleJson),
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

  private ensureWideFormatProducto(producto: {
    motorCodigo: string;
    motorVersion: number;
  }) {
    if (producto.motorCodigo !== 'gran_formato' || Number(producto.motorVersion) !== 1) {
      throw new BadRequestException('El producto no pertenece al motor gran formato v1.');
    }
  }

  private getGranFormatoDetalle(
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ) {
    const detalle = this.asObject(detalleJson);
    const raw = detalle.granFormato;
    return this.asObject(raw);
  }

  private getGranFormatoRutaBaseDetalle(
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ) {
    const detalle = this.asObject(detalleJson);
    const raw = detalle.granFormatoRutaBase;
    return this.asObject(raw);
  }

  private getGranFormatoStringArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [] as string[];
    }
    return Array.from(
      new Set(
        value
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0),
      ),
    );
  }

  private getGranFormatoNullableString(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    return normalized.length ? normalized : null;
  }

  private getGranFormatoNullableNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private getGranFormatoImposicionConfig(
    value: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ) {
    const detalle = this.asObject(value);
    const imposicion = this.asObject(detalle.imposicion);
    const criterio = this.getGranFormatoNullableString(imposicion.criterioOptimizacion);
    const medidas = Array.isArray(imposicion.medidas)
      ? imposicion.medidas
          .map((item) => {
            const row = this.asObject(item);
            return {
              anchoMm: this.getGranFormatoNullableNumber(row.anchoMm),
              altoMm: this.getGranFormatoNullableNumber(row.altoMm),
              cantidad: Math.max(
                1,
                Math.trunc(this.getGranFormatoNullableNumber(row.cantidad) ?? 1),
              ),
            };
          })
          .filter((item) => item.anchoMm || item.altoMm)
      : [];
    const piezaAnchoMm = this.getGranFormatoNullableNumber(imposicion.piezaAnchoMm);
    const piezaAltoMm = this.getGranFormatoNullableNumber(imposicion.piezaAltoMm);
    const cantidadReferencia = Math.max(
      1,
      Math.trunc(this.getGranFormatoNullableNumber(imposicion.cantidadReferencia) ?? 1),
    );
    const medidasNormalizadas =
      medidas.length > 0
        ? medidas
        : piezaAnchoMm || piezaAltoMm
          ? [
              {
                anchoMm: piezaAnchoMm,
                altoMm: piezaAltoMm,
                cantidad: cantidadReferencia,
              },
            ]
          : [];

    return {
      medidas: medidasNormalizadas,
      piezaAnchoMm,
      piezaAltoMm,
      cantidadReferencia,
      tecnologiaDefault: this.getGranFormatoNullableString(imposicion.tecnologiaDefault),
      maquinaDefaultId: this.getGranFormatoNullableString(imposicion.maquinaDefaultId),
      perfilDefaultId: this.getGranFormatoNullableString(imposicion.perfilDefaultId),
      permitirRotacion: imposicion.permitirRotacion !== false,
      separacionHorizontalMm: Math.max(
        0,
        this.getGranFormatoNullableNumber(imposicion.separacionHorizontalMm) ?? 0,
      ),
      separacionVerticalMm: Math.max(
        0,
        this.getGranFormatoNullableNumber(imposicion.separacionVerticalMm) ?? 0,
      ),
      margenLateralIzquierdoMmOverride: this.getGranFormatoNullableNumber(
        imposicion.margenLateralIzquierdoMmOverride,
      ),
      margenLateralDerechoMmOverride: this.getGranFormatoNullableNumber(
        imposicion.margenLateralDerechoMmOverride,
      ),
      margenInicioMmOverride: this.getGranFormatoNullableNumber(imposicion.margenInicioMmOverride),
      margenFinalMmOverride: this.getGranFormatoNullableNumber(imposicion.margenFinalMmOverride),
      panelizadoActivo: imposicion.panelizadoActivo === true,
      panelizadoDireccion:
        imposicion.panelizadoDireccion === GranFormatoPanelizadoDireccionDto.vertical ||
        imposicion.panelizadoDireccion === GranFormatoPanelizadoDireccionDto.horizontal
          ? imposicion.panelizadoDireccion
          : GranFormatoPanelizadoDireccionDto.automatica,
      panelizadoSolapeMm: this.getGranFormatoNullableNumber(imposicion.panelizadoSolapeMm),
      panelizadoAnchoMaxPanelMm: this.getGranFormatoNullableNumber(imposicion.panelizadoAnchoMaxPanelMm),
      panelizadoDistribucion:
        imposicion.panelizadoDistribucion === GranFormatoPanelizadoDistribucionDto.libre
          ? GranFormatoPanelizadoDistribucionDto.libre
          : GranFormatoPanelizadoDistribucionDto.equilibrada,
      panelizadoInterpretacionAnchoMaximo:
        imposicion.panelizadoInterpretacionAnchoMaximo === GranFormatoPanelizadoInterpretacionAnchoMaximoDto.util
          ? GranFormatoPanelizadoInterpretacionAnchoMaximoDto.util
          : GranFormatoPanelizadoInterpretacionAnchoMaximoDto.total,
      panelizadoModo:
        imposicion.panelizadoModo === GranFormatoPanelizadoModoDto.manual
          ? GranFormatoPanelizadoModoDto.manual
          : GranFormatoPanelizadoModoDto.automatico,
      panelizadoManualLayout:
        imposicion.panelizadoManualLayout && typeof imposicion.panelizadoManualLayout === 'object'
          ? (imposicion.panelizadoManualLayout as Record<string, unknown>)
          : null,
      criterioOptimizacion:
        criterio === GranFormatoImposicionCriterioOptimizacionDto.menor_costo_total
          ? GranFormatoImposicionCriterioOptimizacionDto.menor_costo_total
          : criterio === GranFormatoImposicionCriterioOptimizacionDto.menor_largo_consumido
          ? GranFormatoImposicionCriterioOptimizacionDto.menor_largo_consumido
          : GranFormatoImposicionCriterioOptimizacionDto.menor_costo_total,
    };
  }

  private getGranFormatoRutaBaseProcesoDefinicionId(
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ) {
    const detalle = this.getGranFormatoRutaBaseDetalle(detalleJson);
    return this.getGranFormatoNullableString(detalle.procesoDefinicionId);
  }

  private getGranFormatoRutaBaseReglasImpresion(
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ): GranFormatoRutaBaseReglaImpresionStored[] {
    const detalle = this.getGranFormatoRutaBaseDetalle(detalleJson);
    if (!Array.isArray(detalle.reglasImpresion)) {
      return [];
    }
    return detalle.reglasImpresion
      .map((item) => {
        const row = this.asObject(item);
        const tecnologia = this.normalizeGranFormatoTecnologia(
          typeof row.tecnologia === 'string' ? row.tecnologia : null,
        );
        const pasoPlantillaId = this.getGranFormatoNullableString(row.pasoPlantillaId);
        if (!tecnologia || !pasoPlantillaId) {
          return null;
        }
        return {
          tecnologia,
          maquinaId: this.getGranFormatoNullableString(row.maquinaId),
          pasoPlantillaId,
          perfilOperativoDefaultId: this.getGranFormatoNullableString(row.perfilOperativoDefaultId),
        };
      })
      .filter((item): item is GranFormatoRutaBaseReglaImpresionStored => Boolean(item));
  }

  private getGranFormatoChecklistDetalle(
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ) {
    const detalle = this.asObject(detalleJson);
    return this.asObject(detalle.granFormatoChecklist);
  }

  private getGranFormatoChecklistStored(
    value: unknown,
  ): GranFormatoChecklistStored {
    const raw = this.asObject(value);
    return {
      activo: raw.activo !== false,
      preguntas: Array.isArray(raw.preguntas) ? (raw.preguntas as GranFormatoChecklistStored["preguntas"]) : [],
    };
  }

  private async validateGranFormatoChecklistPayload(
    auth: CurrentAuth,
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
    payload: UpdateGranFormatoChecklistDto,
  ) {
    const granFormato = this.getGranFormatoDetalle(detalleJson);
    const tecnologiasCompatibles = new Set(
      this.normalizeGranFormatoTecnologias(
        this.getGranFormatoStringArray(granFormato.tecnologiasCompatibles),
      ),
    );

    const checklistComun = this.getGranFormatoChecklistStored(payload.checklistComun ?? { preguntas: [] });
    const checklistsPorTecnologia = (payload.checklistsPorTecnologia ?? []).map((item) => ({
      tecnologia: this.normalizeGranFormatoTecnologia(item.tecnologia),
      checklist: this.getGranFormatoChecklistStored(item.checklist),
    }));

    this.validateProductoChecklistPayload(checklistComun as UpsertProductoChecklistDto);
    for (const item of checklistsPorTecnologia) {
      if (!item.tecnologia || !tecnologiasCompatibles.has(item.tecnologia)) {
        throw new BadRequestException(
          `La tecnología ${String(item.tecnologia ?? '')} no está dentro de las tecnologías compatibles.`,
        );
      }
      this.validateProductoChecklistPayload(item.checklist as UpsertProductoChecklistDto);
    }

    const seenTecnologias = new Set<string>();
    for (const item of checklistsPorTecnologia) {
      if (seenTecnologias.has(item.tecnologia as string)) {
        throw new BadRequestException('No puede haber más de un checklist por tecnología.');
      }
      seenTecnologias.add(item.tecnologia as string);
    }

    return {
      aplicaATodasLasTecnologias: payload.aplicaATodasLasTecnologias !== false,
      checklistComun,
      checklistsPorTecnologia: checklistsPorTecnologia
        .filter((item): item is { tecnologia: string; checklist: GranFormatoChecklistStored } => Boolean(item.tecnologia))
        .map((item) => ({
          tecnologia: item.tecnologia,
          checklist: item.checklist,
        })),
    };
  }

  private async buildGranFormatoChecklistResponse(
    auth: CurrentAuth,
    producto: { id: string; detalleJson: Prisma.JsonValue | null; updatedAt: Date },
  ) {
    const detalle = this.getGranFormatoChecklistDetalle(producto.detalleJson);
    const aplicaATodasLasTecnologias = detalle.aplicaATodasLasTecnologias !== false;
    const checklistComun = this.getGranFormatoChecklistStored(detalle.checklistComun ?? { preguntas: [] });
    const checklistsPorTecnologia = Array.isArray(detalle.checklistsPorTecnologia)
      ? detalle.checklistsPorTecnologia
      : [];

    const idsPasoPlantilla = new Set<string>();
    const idsCentroCosto = new Set<string>();
    const idsMateriaPrimaVariante = new Set<string>();
    const collectIds = (checklist: GranFormatoChecklistStored) => {
      for (const pregunta of checklist.preguntas ?? []) {
        for (const respuesta of pregunta.respuestas ?? []) {
          for (const regla of respuesta.reglas ?? []) {
            if (regla.pasoPlantillaId) idsPasoPlantilla.add(regla.pasoPlantillaId);
            if (regla.costoCentroCostoId) idsCentroCosto.add(regla.costoCentroCostoId);
            if (regla.materiaPrimaVarianteId) idsMateriaPrimaVariante.add(regla.materiaPrimaVarianteId);
          }
        }
      }
    };
    collectIds(checklistComun);
    for (const item of checklistsPorTecnologia) {
      const row = this.asObject(item);
      collectIds(this.getGranFormatoChecklistStored(row.checklist));
    }

    const [plantillas, centrosCosto, materiasPrimasVariantes] = await Promise.all([
      idsPasoPlantilla.size
        ? this.prisma.procesoOperacionPlantilla.findMany({
            where: { tenantId: auth.tenantId, id: { in: Array.from(idsPasoPlantilla) } },
            include: { centroCosto: true, maquina: true, perfilOperativo: true },
          })
        : Promise.resolve([]),
      idsCentroCosto.size
        ? this.prisma.centroCosto.findMany({
            where: { tenantId: auth.tenantId, id: { in: Array.from(idsCentroCosto) } },
            select: { id: true, nombre: true },
          })
        : Promise.resolve([]),
      idsMateriaPrimaVariante.size
        ? this.prisma.materiaPrimaVariante.findMany({
            where: { tenantId: auth.tenantId, id: { in: Array.from(idsMateriaPrimaVariante) } },
            include: { materiaPrima: true },
          })
        : Promise.resolve([]),
    ]);

    const plantillasById = new Map(plantillas.map((item) => [item.id, item]));
    const centrosById = new Map(centrosCosto.map((item) => [item.id, item]));
    const materiasById = new Map(materiasPrimasVariantes.map((item) => [item.id, item]));

    return {
      productoId: producto.id,
      aplicaATodasLasTecnologias,
      checklistComun: this.buildGranFormatoChecklistItemResponse(
        producto.id,
        checklistComun,
        plantillasById,
        centrosById,
        materiasById,
        producto.updatedAt,
      ),
      checklistsPorTecnologia: checklistsPorTecnologia
        .map((item) => {
          const row = this.asObject(item);
          const tecnologia = this.normalizeGranFormatoTecnologia(
            typeof row.tecnologia === 'string' ? row.tecnologia : null,
          );
          if (!tecnologia) {
            return null;
          }
          return {
            tecnologia,
            checklist: this.buildGranFormatoChecklistItemResponse(
              producto.id,
              this.getGranFormatoChecklistStored(row.checklist),
              plantillasById,
              centrosById,
              materiasById,
              producto.updatedAt,
            ),
          };
        })
        .filter(Boolean),
      updatedAt: producto.updatedAt.toISOString(),
    };
  }

  private buildGranFormatoChecklistItemResponse(
    productoId: string,
    checklist: GranFormatoChecklistStored,
    plantillasById: Map<string, any>,
    centrosById: Map<string, { id: string; nombre: string }>,
    materiasById: Map<string, any>,
    updatedAt: Date,
  ) {
    return {
      productoId,
      activo: checklist.activo !== false,
      preguntas: (checklist.preguntas ?? []).map((pregunta, preguntaIndex) => ({
        id: pregunta.id?.trim() || randomUUID(),
        texto: pregunta.texto,
        tipoPregunta:
          pregunta.tipoPregunta === TipoChecklistPreguntaDto.single_select
            ? TipoChecklistPreguntaDto.single_select
            : TipoChecklistPreguntaDto.binaria,
        orden: pregunta.orden ?? preguntaIndex + 1,
        activo: pregunta.activo ?? true,
        respuestas: (pregunta.respuestas ?? []).map((respuesta, respuestaIndex) => ({
          id: respuesta.id?.trim() || randomUUID(),
          texto: respuesta.texto,
          codigo: respuesta.codigo?.trim() || null,
          preguntaSiguienteId: respuesta.preguntaSiguienteId?.trim() || null,
          orden: respuesta.orden ?? respuestaIndex + 1,
          activo: respuesta.activo ?? true,
          reglas: (respuesta.reglas ?? []).map((regla, reglaIndex) => {
            const plantilla = regla.pasoPlantillaId ? plantillasById.get(regla.pasoPlantillaId) ?? null : null;
            const nivelesDisponibles = plantilla ? this.getProcesoOperacionNiveles(plantilla.detalleJson) : [];
            const varianteSeleccionada = regla.variantePasoId
              ? nivelesDisponibles.find((item) => item.id === regla.variantePasoId) ?? null
              : null;
            const centroCosto = regla.costoCentroCostoId
              ? centrosById.get(regla.costoCentroCostoId) ?? null
              : null;
            const materiaPrima = regla.materiaPrimaVarianteId
              ? materiasById.get(regla.materiaPrimaVarianteId) ?? null
              : null;
            return {
              id: regla.id?.trim() || randomUUID(),
              accion: regla.accion,
              orden: regla.orden ?? reglaIndex + 1,
              activo: regla.activo ?? true,
              pasoPlantillaId: regla.pasoPlantillaId?.trim() || null,
              pasoPlantillaNombre: plantilla?.nombre ?? '',
              centroCostoId: plantilla?.centroCostoId ?? null,
              centroCostoNombre: plantilla?.centroCosto?.nombre ?? '',
              maquinaNombre: plantilla?.maquina?.nombre ?? '',
              perfilOperativoNombre: plantilla?.perfilOperativo?.nombre ?? '',
              setupMin: plantilla ? this.decimalToNumber(plantilla.setupMin) : null,
              runMin: null,
              cleanupMin: plantilla ? this.decimalToNumber(plantilla.cleanupMin) : null,
              tiempoFijoMin: plantilla ? this.decimalToNumber(plantilla.tiempoFijoMin) : null,
              variantePasoId: regla.variantePasoId?.trim() || null,
              variantePasoNombre: varianteSeleccionada?.nombre ?? '',
              variantePasoResumen: varianteSeleccionada?.resumen ?? '',
              nivelesDisponibles,
              costoRegla: regla.costoRegla ?? null,
              costoValor: regla.costoValor ?? null,
              costoCentroCostoId: regla.costoCentroCostoId?.trim() || null,
              costoCentroCostoNombre: centroCosto?.nombre ?? '',
              materiaPrimaVarianteId: regla.materiaPrimaVarianteId?.trim() || null,
              materiaPrimaNombre: materiaPrima?.materiaPrima?.nombre ?? '',
              materiaPrimaSku: materiaPrima?.sku ?? '',
              tipoConsumo: regla.tipoConsumo ?? null,
              factorConsumo: regla.factorConsumo ?? null,
              mermaPct: regla.mermaPct ?? null,
              detalle:
                regla.detalle && typeof regla.detalle === 'object' && !Array.isArray(regla.detalle)
                  ? regla.detalle
                  : null,
            };
          }),
        })),
      })),
      createdAt: null,
      updatedAt: updatedAt.toISOString(),
    };
  }

  private getProductoPrecioConfig(
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ): ProductoPrecioConfig | null {
    const detalle = this.asObject(detalleJson);
    const raw =
      detalle.precio && typeof detalle.precio === 'object' && !Array.isArray(detalle.precio)
        ? (detalle.precio as Record<string, unknown>)
        : null;
    if (!raw) {
      return null;
    }
    const metodoCalculo = this.normalizeMetodoCalculoPrecioProducto(raw.metodoCalculo);
    if (!metodoCalculo) {
      return null;
    }
    const measurementUnit = this.normalizeUnidadComercialProductoValue(
      typeof raw.measurementUnit === 'string' && raw.measurementUnit.trim().length
        ? raw.measurementUnit.trim()
        : null,
    );
    const impuestos = this.normalizeProductoPrecioImpuestos(
      raw.impuestos && typeof raw.impuestos === 'object' && !Array.isArray(raw.impuestos)
        ? (raw.impuestos as Record<string, unknown>)
        : null,
    );
    const comisiones = this.normalizeProductoPrecioComisiones(
      raw.comisiones && typeof raw.comisiones === 'object' && !Array.isArray(raw.comisiones)
        ? (raw.comisiones as Record<string, unknown>)
        : null,
    );
    const detallePrecio = this.normalizeProductoPrecioDetalle(
      metodoCalculo,
      raw.detalle && typeof raw.detalle === 'object' && !Array.isArray(raw.detalle)
        ? (raw.detalle as Record<string, unknown>)
        : null,
      true,
    );
    return { metodoCalculo, measurementUnit, impuestos, comisiones, detalle: detallePrecio };
  }

  private getProductoPrecioEspecialClientes(
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ): ProductoPrecioEspecialClienteConfig[] {
    const detalle = this.asObject(detalleJson);
    const rawItems = Array.isArray(detalle.precioEspecialClientes) ? detalle.precioEspecialClientes : [];
    return rawItems
      .map((item) => this.normalizeProductoPrecioEspecialClienteStored(item))
      .filter((item): item is ProductoPrecioEspecialClienteConfig => Boolean(item));
  }

  private normalizeProductoPrecioImpuestos(value: Record<string, unknown> | null) {
    const raw =
      value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
    const esquemaId = typeof raw.esquemaId === 'string' && raw.esquemaId.trim().length ? raw.esquemaId : null;
    const esquemaNombre = typeof raw.esquemaNombre === 'string' ? raw.esquemaNombre : '';
    const items = Array.isArray(raw.items)
      ? raw.items
          .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
              return null;
            }
            const row = item as Record<string, unknown>;
            if (typeof row.nombre !== 'string') {
              return null;
            }
            return {
              nombre: row.nombre,
              porcentaje: this.toSafeNumber(row.porcentaje, 0),
            };
          })
          .filter(
            (
              item,
            ): item is { impuestoId: string; codigo: string; nombre: string; porcentaje: number } => Boolean(item),
          )
      : [];
    return {
      esquemaId,
      esquemaNombre,
      items,
      porcentajeTotal: items.length
        ? Number(items.reduce((sum, item) => sum + item.porcentaje, 0).toFixed(2))
        : 0,
    };
  }

  private normalizeProductoPrecioComisiones(value: Record<string, unknown> | null) {
    const raw =
      value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
    const items = Array.isArray(raw.items)
      ? raw.items
          .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
              return null;
            }
            const row = item as Record<string, unknown>;
            if (typeof row.nombre !== 'string' || !row.nombre.trim().length) {
              return null;
            }
            const tipo = row.tipo === 'vendedor' ? 'vendedor' : row.tipo === 'financiera' ? 'financiera' : null;
            if (!tipo) {
              return null;
            }
            return {
              id:
                typeof row.id === 'string' && row.id.trim().length
                  ? row.id.trim()
                  : randomUUID(),
              nombre: row.nombre.trim(),
              tipo,
              porcentaje: this.toSafeNumber(row.porcentaje, 0),
              activo: row.activo !== false,
            };
          })
          .filter(
            (
              item,
            ): item is {
              id: string;
              nombre: string;
              tipo: 'financiera' | 'vendedor';
              porcentaje: number;
              activo: boolean;
            } => Boolean(item),
          )
      : [];
    return {
      esquemaId:
        typeof raw.esquemaId === 'string' && raw.esquemaId.trim().length ? raw.esquemaId.trim() : null,
      esquemaNombre: typeof raw.esquemaNombre === 'string' ? raw.esquemaNombre : '',
      items,
      porcentajeTotal: Number(
        items
          .filter((item) => item.activo)
          .reduce((sum, item) => sum + item.porcentaje, 0)
          .toFixed(2),
      ),
    };
  }

  private async resolveProductoPrecioComisiones(auth: CurrentAuth, value: unknown) {
    const normalized = this.normalizeProductoPrecioComisiones(
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null,
    );
    if (!normalized.esquemaId) {
      return normalized;
    }
    const row = await this.prisma.productoComisionCatalogo.findFirst({
      where: { tenantId: auth.tenantId, id: normalized.esquemaId, activo: true },
    });
    if (!row) {
      throw new BadRequestException('El esquema de comisiones seleccionado es inválido o está inactivo.');
    }
    const detalle = this.parseComisionDetalle(row.detalleJson);
    return {
      esquemaId: row.id,
      esquemaNombre: row.nombre,
      items: detalle.items.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        tipo: item.tipo,
        porcentaje: item.porcentaje,
        activo: item.activo,
      })),
      porcentajeTotal: Number(row.porcentaje),
    };
  }

  private normalizeProductoPrecioEspecialClienteStored(value: unknown): ProductoPrecioEspecialClienteConfig | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const raw = value as Record<string, unknown>;
    if (
      typeof raw.id !== 'string' ||
      typeof raw.clienteId !== 'string' ||
      typeof raw.clienteNombre !== 'string'
    ) {
      return null;
    }
    const metodoCalculo = this.normalizeMetodoCalculoPrecioProducto(raw.metodoCalculo);
    if (!metodoCalculo) {
      return null;
    }
    const measurementUnit = this.normalizeUnidadComercialProductoValue(
      typeof raw.measurementUnit === 'string' && raw.measurementUnit.trim().length
        ? raw.measurementUnit.trim()
        : null,
    );
    const detalle = this.normalizeProductoPrecioDetalle(
      metodoCalculo,
      raw.detalle && typeof raw.detalle === 'object' && !Array.isArray(raw.detalle)
        ? (raw.detalle as Record<string, unknown>)
        : null,
      true,
    );
    return {
      id: raw.id,
      clienteId: raw.clienteId,
      clienteNombre: raw.clienteNombre,
      descripcion: typeof raw.descripcion === 'string' ? raw.descripcion : '',
      activo: raw.activo !== false,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
      metodoCalculo,
      measurementUnit,
      impuestos: this.normalizeProductoPrecioImpuestos(null),
      comisiones: this.normalizeProductoPrecioComisiones(null),
      detalle,
    };
  }

  private async resolveProductoPrecioEspecialClientes(
    auth: CurrentAuth,
    items: Record<string, unknown>[],
  ): Promise<ProductoPrecioEspecialClienteConfig[]> {
    const rows = Array.isArray(items) ? items : [];
    const clienteIds = Array.from(
      new Set(
        rows
          .map((item) =>
            item && typeof item === 'object' && !Array.isArray(item) && typeof item.clienteId === 'string'
              ? item.clienteId
              : null,
          )
          .filter((item): item is string => Boolean(item)),
      ),
    );
    const clientes = clienteIds.length
      ? await this.prisma.cliente.findMany({
          where: {
            tenantId: auth.tenantId,
            id: { in: clienteIds },
          },
          select: {
            id: true,
            nombre: true,
          },
        })
      : [];
    const clienteMap = new Map(clientes.map((item) => [item.id, item]));
    const activosByCliente = new Set<string>();

    return rows.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new BadRequestException(`La regla especial #${index + 1} es inválida.`);
      }
      const raw = item as Record<string, unknown>;
      const id = typeof raw.id === 'string' && raw.id.trim().length ? raw.id : randomUUID();
      const clienteId = typeof raw.clienteId === 'string' ? raw.clienteId : '';
      const cliente = clienteMap.get(clienteId);
      if (!cliente) {
        throw new BadRequestException(`La regla especial #${index + 1} referencia un cliente inexistente.`);
      }
      const activo = raw.activo !== false;
      if (activo) {
        if (activosByCliente.has(clienteId)) {
          throw new BadRequestException('No puede haber más de un precio especial activo para el mismo cliente.');
        }
        activosByCliente.add(clienteId);
      }
      const metodoCalculo = this.normalizeMetodoCalculoPrecioProducto(raw.metodoCalculo);
      if (!metodoCalculo) {
        throw new BadRequestException(`La regla especial de "${cliente.nombre}" tiene un método inválido.`);
      }
      const measurementUnit = this.normalizeUnidadComercialProductoValue(
        typeof raw.measurementUnit === 'string' && raw.measurementUnit.trim().length
          ? raw.measurementUnit.trim()
          : null,
      );
      const detalle = this.normalizeProductoPrecioDetalle(
        metodoCalculo,
        raw.detalle && typeof raw.detalle === 'object' && !Array.isArray(raw.detalle)
          ? (raw.detalle as Record<string, unknown>)
          : null,
        false,
      );
      const createdAt =
        typeof raw.createdAt === 'string' && raw.createdAt.trim().length ? raw.createdAt : new Date().toISOString();
      return {
        id,
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        descripcion: typeof raw.descripcion === 'string' ? raw.descripcion.trim() : '',
        activo,
        createdAt,
        updatedAt: new Date().toISOString(),
        metodoCalculo,
        measurementUnit,
        impuestos: this.normalizeProductoPrecioImpuestos(null),
        comisiones: this.normalizeProductoPrecioComisiones(null),
        detalle,
      };
    });
  }

  private async resolveProductoPrecioImpuestos(auth: CurrentAuth, value: unknown) {
    const normalized = this.normalizeProductoPrecioImpuestos(
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null,
    );
    if (!normalized.esquemaId) {
      return {
        esquemaId: null,
        esquemaNombre: '',
        items: [],
        porcentajeTotal: 0,
      };
    }
    const row = await this.prisma.productoImpuestoCatalogo.findFirst({
      where: { tenantId: auth.tenantId, id: normalized.esquemaId, activo: true },
    });
    if (!row) {
      throw new BadRequestException('El esquema impositivo seleccionado es inválido o está inactivo.');
    }
    const detalle = this.parseImpuestoDetalle(row.detalleJson);
    const items = detalle.items;
    return {
      esquemaId: row.id,
      esquemaNombre: row.nombre,
      items,
      porcentajeTotal: Number(row.porcentaje),
    };
  }

  private parseImpuestoDetalle(value: Prisma.JsonValue | null | undefined) {
    const raw =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const items = Array.isArray(raw.items)
      ? raw.items
          .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
              return null;
            }
            const row = item as Record<string, unknown>;
            if (typeof row.nombre !== 'string') {
              return null;
            }
            return {
              nombre: row.nombre,
              porcentaje: this.toSafeNumber(row.porcentaje, 0),
            };
          })
          .filter((item): item is { nombre: string; porcentaje: number } => Boolean(item))
      : [];
    return { items };
  }

  private parseComisionDetalle(value: Prisma.JsonValue | null | undefined) {
    const raw =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const items = Array.isArray(raw.items)
      ? raw.items
          .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
            const row = item as Record<string, unknown>;
            if (typeof row.nombre !== 'string' || !row.nombre.trim().length) return null;
            const tipo =
              row.tipo === 'vendedor' ? 'vendedor' : row.tipo === 'financiera' ? 'financiera' : null;
            if (!tipo) return null;
            return {
              id:
                typeof row.id === 'string' && row.id.trim().length
                  ? row.id.trim()
                  : randomUUID(),
              nombre: row.nombre.trim(),
              tipo,
              porcentaje: this.toSafeNumber(row.porcentaje, 0),
              activo: row.activo !== false,
            };
          })
          .filter(
            (
              item,
            ): item is {
              id: string;
              nombre: string;
              tipo: 'financiera' | 'vendedor';
              porcentaje: number;
              activo: boolean;
            } => Boolean(item),
          )
      : [];
    return { items };
  }

  private normalizeMetodoCalculoPrecioProducto(value: unknown): MetodoCalculoPrecioProductoDto | null {
    return value === MetodoCalculoPrecioProductoDto.margen_variable ||
      value === MetodoCalculoPrecioProductoDto.por_margen ||
      value === MetodoCalculoPrecioProductoDto.precio_fijo ||
      value === MetodoCalculoPrecioProductoDto.fijado_por_cantidad ||
      value === MetodoCalculoPrecioProductoDto.fijo_con_margen_variable ||
      value === MetodoCalculoPrecioProductoDto.variable_por_cantidad ||
      value === MetodoCalculoPrecioProductoDto.precio_fijo_para_margen_minimo
      ? value
      : null;
  }

  private normalizeUnidadComercialProductoValue(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'unidad' || normalized === 'unidades') return 'unidad';
    if (normalized === 'm2' || normalized === 'm²' || normalized === 'metro cuadrado' || normalized === 'metros cuadrados') {
      return 'm2';
    }
    if (
      normalized === 'metro_lineal' ||
      normalized === 'ml' ||
      normalized === 'metro lineal' ||
      normalized === 'metros lineales'
    ) {
      return 'metro_lineal';
    }
    return value.trim();
  }

  private normalizeProductoPrecioDetalle(
    metodoCalculo: MetodoCalculoPrecioProductoDto,
    value: Record<string, unknown> | null,
    allowEmpty: boolean,
  ) {
    const detalle = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    if (metodoCalculo === MetodoCalculoPrecioProductoDto.por_margen) {
      return {
        marginPct: this.toSafeNumber(detalle.marginPct, 0),
        minimumMarginPct: this.toSafeNumber(detalle.minimumMarginPct, 0),
      };
    }
    if (metodoCalculo === MetodoCalculoPrecioProductoDto.precio_fijo) {
      return {
        price: this.toSafeNumber(detalle.price, 0),
        minimumPrice: this.toSafeNumber(detalle.minimumPrice, 0),
      };
    }
    if (metodoCalculo === MetodoCalculoPrecioProductoDto.precio_fijo_para_margen_minimo) {
      return {
        price: this.toSafeNumber(detalle.price, 0),
        minimumPrice: this.toSafeNumber(detalle.minimumPrice, 0),
        minimumMarginPct: this.toSafeNumber(detalle.minimumMarginPct, 0),
      };
    }
    if (metodoCalculo === MetodoCalculoPrecioProductoDto.fijado_por_cantidad) {
      return {
        tiers: this.normalizeProductoPrecioTierRows(detalle.tiers, 'exact', allowEmpty),
      };
    }
    if (metodoCalculo === MetodoCalculoPrecioProductoDto.fijo_con_margen_variable) {
      return {
        tiers: this.normalizeProductoPrecioTierRows(detalle.tiers, 'exact_margin', allowEmpty),
      };
    }
    if (metodoCalculo === MetodoCalculoPrecioProductoDto.variable_por_cantidad) {
      return {
        tiers: this.normalizeProductoPrecioTierRows(detalle.tiers, 'until', allowEmpty),
      };
    }
    return {
      tiers: this.normalizeProductoPrecioTierRows(detalle.tiers, 'margin', allowEmpty),
    };
  }

  private normalizeProductoPrecioTierRows(
    value: unknown,
    mode: 'exact' | 'exact_margin' | 'until' | 'margin',
    allowEmpty: boolean,
  ) {
    type PrecioTierRow =
      | { quantity: number; price: number }
      | { quantity: number; marginPct: number }
      | { quantityUntil: number; price: number }
      | { quantityUntil: number; marginPct: number };
    const rows = Array.isArray(value) ? value : [];
    const normalized = rows
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null;
        }
        const row = item as Record<string, unknown>;
        if (mode === 'exact' || mode === 'exact_margin') {
          const quantity = Math.trunc(this.toSafeNumber(row.quantity, NaN));
          const valueKey = mode === 'exact_margin' ? 'marginPct' : 'price';
          const amount = this.toSafeNumber(row[valueKey], NaN);
          if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(amount) || amount < 0) {
            return null;
          }
          return mode === 'exact_margin' ? { quantity, marginPct: amount } : { quantity, price: amount };
        }
        const quantityUntil = Math.trunc(this.toSafeNumber(row.quantityUntil, NaN));
        const valueKey = mode === 'margin' ? 'marginPct' : 'price';
        const amount = this.toSafeNumber(row[valueKey], NaN);
        if (!Number.isFinite(quantityUntil) || quantityUntil <= 0 || !Number.isFinite(amount) || amount < 0) {
          return null;
        }
        return mode === 'margin'
          ? { quantityUntil, marginPct: amount }
          : { quantityUntil, price: amount };
      })
      .filter((item): item is PrecioTierRow => item !== null)
      .sort((a, b) => Number(('quantity' in a ? a.quantity : a.quantityUntil) ?? 0) - Number(('quantity' in b ? b.quantity : b.quantityUntil) ?? 0));

    const seen = new Set<number>();
    for (const row of normalized) {
      const key = Number(('quantity' in row ? row.quantity : row.quantityUntil) ?? 0);
      if (seen.has(key)) {
        throw new BadRequestException('La configuración de precio contiene cantidades duplicadas.');
      }
      seen.add(key);
    }
    if (normalized.length === 0) {
      if (allowEmpty) {
        if (mode === 'exact') {
          return [{ quantity: 1, price: 0 }];
        }
        if (mode === 'exact_margin') {
          return [{ quantity: 1, marginPct: 0 }];
        }
        if (mode === 'until') {
          return [{ quantityUntil: 1, price: 0 }];
        }
        return [{ quantityUntil: 1, marginPct: 0 }];
      }
      if (mode === 'exact') {
        throw new BadRequestException('Debes definir al menos una cantidad para precio fijado por cantidad.');
      }
      if (mode === 'exact_margin') {
        throw new BadRequestException('Debes definir al menos una cantidad para fijo con margen variable.');
      }
      if (mode === 'until') {
        throw new BadRequestException('Debes definir al menos un rango para precio variable por cantidad.');
      }
      throw new BadRequestException('Debes definir al menos un rango para margen variable.');
    }
    return normalized;
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

  private async ensureCatalogoInicialImpuestos(auth: CurrentAuth) {
    const rows = await this.prisma.productoImpuestoCatalogo.findMany({
      where: { tenantId: auth.tenantId },
    });
    const hasProfiles = rows.some((item) => item.codigo === 'SERVICIOS' || item.codigo === 'PRODUCTO');
    if (hasProfiles) {
      return;
    }
    if (rows.length > 0) {
      await this.prisma.productoImpuestoCatalogo.deleteMany({
        where: { tenantId: auth.tenantId },
      });
    }
    await this.prisma.productoImpuestoCatalogo.createMany({
      data: [
        {
          tenantId: auth.tenantId,
          codigo: 'SERVICIOS',
          nombre: 'Prestación de servicios',
          porcentaje: 25.7,
          detalleJson: {
            items: [
              { nombre: 'IVA', porcentaje: 21 },
              { nombre: 'IIBB', porcentaje: 3.5 },
              { nombre: 'Cred/Deb', porcentaje: 1.2 },
            ],
          },
          activo: true,
        },
        {
          tenantId: auth.tenantId,
          codigo: 'PRODUCTO',
          nombre: 'Venta de producto',
          porcentaje: 22.7,
          detalleJson: {
            items: [
              { nombre: 'IVA', porcentaje: 21 },
              { nombre: 'IIBB', porcentaje: 1.2 },
              { nombre: 'Cred/Deb', porcentaje: 0.5 },
            ],
          },
          activo: true,
        },
      ],
    });
  }

  private async ensureCatalogoInicialComisiones(auth: CurrentAuth) {
    const rows = await this.prisma.productoComisionCatalogo.findMany({
      where: { tenantId: auth.tenantId },
    });
    const hasProfiles = rows.some((item) => item.codigo === 'PASARELA' || item.codigo === 'VENDEDOR');
    if (hasProfiles) {
      return;
    }
    if (rows.length > 0) {
      await this.prisma.productoComisionCatalogo.deleteMany({
        where: { tenantId: auth.tenantId },
      });
    }
    await this.prisma.productoComisionCatalogo.createMany({
      data: [
        {
          tenantId: auth.tenantId,
          codigo: 'PASARELA',
          nombre: 'Pasarela de pago',
          porcentaje: 6,
          detalleJson: {
            items: [
              { nombre: 'Comisión pasarela', tipo: 'financiera', porcentaje: 6, activo: true },
            ],
          },
          activo: true,
        },
        {
          tenantId: auth.tenantId,
          codigo: 'VENDEDOR',
          nombre: 'Comisión vendedor',
          porcentaje: 5,
          detalleJson: {
            items: [
              { nombre: 'Comisión vendedor', tipo: 'vendedor', porcentaje: 5, activo: true },
            ],
          },
          activo: true,
        },
      ],
    });
  }

  private resolveMotorOrThrow(code: string, version: number) {
    const module = this.motorRegistry.getModule(code, version);
    const definition = module.getDefinition();
    return {
      code: definition.code,
      version: definition.version,
      label: definition.label,
    };
  }

  private resolveProductMotorModule(code: string, version: number) {
    return this.motorRegistry.getModule(code, version);
  }

  private getDefaultMotorConfig(): Record<string, unknown> {
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

  private getDefaultWideFormatMotorConfig(): Record<string, unknown> {
    return {
      tipoPlantilla: 'gran_formato',
      dominioInicial: 'vinilos_lonas',
      notas: 'Motor en análisis. Este producto funciona como plantilla de trabajo.',
    };
  }

  private getDefaultVinylCutMotorConfig(): Record<string, unknown> {
    return {
      tipoPlantilla: 'vinilo_de_corte',
      criterioSeleccionMaterial: 'menor_costo_total',
      plottersCompatibles: [],
      perfilesCompatibles: [],
      materialesCompatibles: [],
      materialBaseId: null,
      maquinaDefaultId: null,
      perfilDefaultId: null,
      permitirRotacion: true,
      separacionHorizontalMm: 10,
      separacionVerticalMm: 10,
      materialOverrideId: null,
      medidas: [{ anchoMm: 1000, altoMm: 300, cantidad: 1, rotacionPermitida: true }],
    };
  }

  private resolveDefaultMotorConfig(code: string): Record<string, unknown> {
    if (code === ProductosServiciosService.DIGITAL_SHEET_MOTOR_DEFINITION.code) {
      return this.getDefaultMotorConfig();
    }
    if (code === ProductosServiciosService.WIDE_FORMAT_MOTOR_DEFINITION.code) {
      return this.getDefaultWideFormatMotorConfig();
    }
    if (code === ProductosServiciosService.VINYL_CUT_MOTOR_DEFINITION.code) {
      return this.getDefaultVinylCutMotorConfig();
    }
    return {};
  }

  private mergeMotorConfig(
    motorCode: string,
    existing: Prisma.JsonValue | null | undefined,
    incoming: Record<string, unknown>,
  ) {
    const base = this.resolveDefaultMotorConfig(motorCode);
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

    const mergedBase = this.mergeMotorConfig(motor.code, baseConfig?.parametrosJson, {});
    const merged = this.mergeMotorConfig(
      motor.code,
      mergedBase as Prisma.JsonValue,
      (overrideConfig?.parametrosJson ?? {}) as Record<string, unknown>,
    );
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
    pliegoAnchoMm?: number;
    pliegoAltoMm?: number;
    overridesProductividad?: Record<string, unknown>;
  }) {
    type LaminadoMode = 'una_cara' | 'dos_caras_simultaneo' | 'dos_caras_dos_pasadas';
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

    const resolveOverrideString = (key: string, fallback: string) => {
      const source = hasPerfil ? profileDetail : overrides;
      const raw = source[key];
      return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : fallback;
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
      const runMin = this.roundProductNumber(cortesTotales / productivityValue);
      const setupMin = this.roundProductNumber(input.setupMinBase + Math.max(0, tandas - 1) * feedReloadMin);
      const cleanupMin = this.roundProductNumber(input.cleanupMinBase);
      return {
        setupMin,
        cleanupMin,
        tiempoFijoMin: this.roundProductNumber(input.tiempoFijoMinBase),
        runMin,
        trace: {
          tipo: 'guillotina',
          pliegosTotales,
          alturaTandaEfectivaMm: this.roundProductNumber(alturaTandaEfectiva),
          capacidadTanda,
          tandas,
          cortesPorImposicion,
          cortesTotales,
          productivityValue: this.roundProductNumber(productivityValue),
        },
        sourceProductividad,
        warnings: [],
      };
    }

    if (plantilla === PlantillaMaquinaria.LAMINADORA_BOPP_ROLLO) {
      const anchoRolloMm = Math.max(1, this.toSafeNumber(machineParams.anchoRolloMm, 0));
      const velocidadMmSegMaquina = Math.max(0, this.toSafeNumber(machineParams.velocidadMmSeg, 0));
      const velocidadTrabajoMmSeg = Math.max(
        0,
        resolveOverrideNumber('velocidadTrabajoMmSeg', velocidadMmSegMaquina),
      );
      const velocidadDobleRolloMmSegMaquina = Math.max(
        0,
        this.toSafeNumber(machineParams.velocidadDobleRolloMmSeg, velocidadTrabajoMmSeg),
      );
      const velocidadDobleRolloTrabajoMmSeg = Math.max(
        0,
        resolveOverrideNumber('velocidadDobleRolloTrabajoMmSeg', velocidadDobleRolloMmSegMaquina),
      );
      const soportaDobleRollo = Boolean(machineParams.soportaDobleRollo);
      const mermaArranqueMm = Math.max(0, this.toSafeNumber(machineParams.mermaArranqueMm, 0));
      const mermaCierreMm = Math.max(0, this.toSafeNumber(machineParams.mermaCierreMm, 0));
      const modoLaminadoRaw = resolveOverrideString('modoLaminado', 'una_cara');
      const modoLaminado: LaminadoMode =
        modoLaminadoRaw === 'dos_caras_simultaneo' || modoLaminadoRaw === 'dos_caras_dos_pasadas'
          ? modoLaminadoRaw
          : 'una_cara';
      const gapEntreHojasMm = Math.max(0, resolveOverrideNumber('gapEntreHojasMm', 0));
      const warmupMin = Math.max(0, resolveOverrideNumber('warmupMin', 0));
      const pliegoAnchoMm = Math.max(1, input.pliegoAnchoMm ?? input.varianteAnchoMm);
      const pliegoAltoMm = Math.max(1, input.pliegoAltoMm ?? input.varianteAltoMm);
      const pliegosTotales = Math.max(1, input.pliegos);
      const hojasTotales = pliegosTotales;
      if (modoLaminado === 'dos_caras_simultaneo' && !soportaDobleRollo) {
        throw new BadRequestException(
          'La laminadora no soporta doble rollo y el perfil exige laminado de dos caras simultaneo.',
        );
      }
      const orientaciones = [
        {
          orientacionEntrada: 'normal',
          anchoEntradaMm: pliegoAnchoMm,
          largoEntradaMm: pliegoAltoMm,
        },
        {
          orientacionEntrada: 'rotada',
          anchoEntradaMm: pliegoAltoMm,
          largoEntradaMm: pliegoAnchoMm,
        },
      ].filter((item) => item.anchoEntradaMm <= anchoRolloMm);
      if (!orientaciones.length) {
        throw new BadRequestException(
          'La laminadora no puede costear el trabajo porque el pliego supera el ancho del rollo en cualquier orientación.',
        );
      }
      orientaciones.sort((a, b) => {
        if (a.largoEntradaMm !== b.largoEntradaMm) {
          return a.largoEntradaMm - b.largoEntradaMm;
        }
        return b.anchoEntradaMm - a.anchoEntradaMm;
      });
      const orientacionSeleccionada = orientaciones[0];
      const anchoHojaMm = orientacionSeleccionada.anchoEntradaMm;
      const altoHojaMm = orientacionSeleccionada.largoEntradaMm;
      const anchoConsumidoMm = anchoRolloMm;
      const pasoLinealMm = altoHojaMm + gapEntreHojasMm;
      const largoPliegosMm =
        pliegosTotales * altoHojaMm + Math.max(0, pliegosTotales - 1) * gapEntreHojasMm;
      const largoConsumidoMm = largoPliegosMm + mermaArranqueMm + mermaCierreMm;
      const pasadasLaminado = modoLaminado === 'dos_caras_dos_pasadas' ? 2 : 1;
      const filmFactor = modoLaminado === 'una_cara' ? 1 : 2;
      const velocidadModoMmSeg =
        modoLaminado === 'dos_caras_simultaneo' ? velocidadDobleRolloTrabajoMmSeg : velocidadTrabajoMmSeg;
      const velocidadMmSegEfectiva = Math.max(0.01, velocidadModoMmSeg);
      const runMin = this.roundProductNumber((largoConsumidoMm * pasadasLaminado) / velocidadMmSegEfectiva / 60);
      const areaConsumidaM2 = this.roundProductNumber(
        (anchoConsumidoMm / 1000) * (Math.max(0, largoConsumidoMm) / 1000),
      );
      const setupMin = this.roundProductNumber(input.setupMinBase + warmupMin);
      const cleanupMin = this.roundProductNumber(input.cleanupMinBase);
      return {
        setupMin,
        cleanupMin,
        tiempoFijoMin: this.roundProductNumber(input.tiempoFijoMinBase),
        runMin,
        trace: {
          tipo: 'laminadora_bopp_rollo',
          modoLaminado,
          pasadasLaminado,
          filmFactor,
          soportaDobleRollo,
          pliegosTotales,
          hojasTotales,
          orientacionEntrada: orientacionSeleccionada.orientacionEntrada,
          pliegoOriginalAnchoMm: Number(pliegoAnchoMm.toFixed(2)),
          pliegoOriginalAltoMm: Number(pliegoAltoMm.toFixed(2)),
          anchoRolloMm: Number(anchoRolloMm.toFixed(2)),
          anchoHojaMm: Number(anchoHojaMm.toFixed(2)),
          altoHojaMm: Number(altoHojaMm.toFixed(2)),
          gapEntreHojasMm: Number(gapEntreHojasMm.toFixed(2)),
          mermaArranqueMm: Number(mermaArranqueMm.toFixed(2)),
          mermaCierreMm: Number(mermaCierreMm.toFixed(2)),
          pasoLinealMm: Number(pasoLinealMm.toFixed(2)),
          largoPliegosMm: Number(largoPliegosMm.toFixed(2)),
          anchoConsumidoMm: Number(anchoConsumidoMm.toFixed(2)),
          largoConsumidoMm: Number(largoConsumidoMm.toFixed(2)),
          areaConsumidaM2,
          velocidadTrabajoMmSeg: this.roundProductNumber(velocidadTrabajoMmSeg),
          velocidadDobleRolloTrabajoMmSeg: this.roundProductNumber(velocidadDobleRolloTrabajoMmSeg),
          velocidadMmSegEfectiva: this.roundProductNumber(velocidadMmSegEfectiva),
        },
        sourceProductividad,
        warnings: velocidadModoMmSeg <= 0 ? ['La velocidad de la laminadora debe ser mayor a 0.'] : [],
      };
    }

    if (plantilla === PlantillaMaquinaria.REDONDEADORA_PUNTAS) {
      const golpesMinNominal = Math.max(0, this.toSafeNumber(machineParams.golpesMinNominal, 0));
      const esquinasPorPieza = Math.max(1, Math.floor(resolveOverrideNumber('esquinasPorPieza', 1)));
      const piezas = Math.max(1, input.cantidad);
      const golpesTotales = piezas * esquinasPorPieza;
      const golpesMinEfectivos = Math.max(0.01, golpesMinNominal * factorVelocidad);
      return {
        setupMin: this.roundProductNumber(input.setupMinBase),
        cleanupMin: this.roundProductNumber(input.cleanupMinBase),
        tiempoFijoMin: this.roundProductNumber(input.tiempoFijoMinBase),
        runMin: this.roundProductNumber(golpesTotales / golpesMinEfectivos),
        trace: {
          tipo: 'redondeadora_puntas',
          piezas,
          esquinasPorPieza,
          golpesTotales,
          golpesMinEfectivos: this.roundProductNumber(golpesMinEfectivos),
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
        setupMin: this.roundProductNumber(input.setupMinBase),
        cleanupMin: this.roundProductNumber(input.cleanupMinBase),
        tiempoFijoMin: this.roundProductNumber(input.tiempoFijoMinBase),
        runMin: this.roundProductNumber((hojas * pasadasPorPliego) / pliegosMinEfectivos),
        trace: {
          tipo: 'perforadora',
          hojas,
          lineasPerforado,
          lineasPorPasadaMax,
          pasadasPorPliego,
          pliegosMinEfectivos: this.roundProductNumber(pliegosMinEfectivos),
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
        unidadStock?: string | null;
        unidadCompra?: string | null;
        materiaPrima: {
          nombre: string;
          unidadStock?: string | null;
          unidadCompra?: string | null;
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
    const filmFactor = Math.max(1, this.toSafeNumber((trace as Record<string, unknown> | null)?.filmFactor, 1));
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
        cantidad = areaConsumidaM2 * factor * filmFactor;
        unidad = 'm2';
      } else if (item.unidad === UnidadConsumoMaquina.METRO_LINEAL) {
        cantidad = (largoConsumidoMm / 1000) * factor * filmFactor;
        unidad = 'm';
      } else {
        input.warnings.push(
          `Consumible de film ${item.materiaPrimaVariante.sku} con unidad ${item.unidad}: solo M2 o METRO_LINEAL soportado en v1.`,
        );
        continue;
      }
      const costoUnit = this.resolveMateriaPrimaVariantUnitCost({
        materiaPrimaVariante: item.materiaPrimaVariante,
        targetUnit: item.unidad,
        warnings: input.warnings,
        contextLabel: 'Consumible de film',
      });
      const costoLinea = this.roundProductNumber(cantidad * costoUnit);
      costo += costoLinea;
      materiales.push({
        tipo: 'FILM',
        nombre: item.materiaPrimaVariante.materiaPrima.nombre,
        sku: item.materiaPrimaVariante.sku,
        unidad,
        cantidad: this.roundProductNumber(cantidad),
        costoUnitario: this.roundProductNumber(costoUnit),
        costo: costoLinea,
      });
    }
    return { materiales, costo: this.roundProductNumber(costo) };
  }

  private asObject(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {} as Record<string, unknown>;
    }
    return value as Record<string, unknown>;
  }

  private decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private roundProductNumber(value: number, decimals = 2) {
    if (!Number.isFinite(value)) return value;
    return Number(value.toFixed(decimals));
  }

  private normalizeProductNumericPrecision<T>(value: T, decimals = 2): T {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeProductNumericPrecision(item, decimals)) as T;
    }
    if (typeof value === 'number') {
      return this.roundProductNumber(value, decimals) as T;
    }
    if (!value || typeof value !== 'object') {
      return value;
    }
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      this.normalizeProductNumericPrecision(item, decimals),
    ]);
    return Object.fromEntries(entries) as T;
  }

  private toCanonicalUnitCode(value: unknown): UnitCode | null {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    const supported: UnitCode[] = [
      'unidad',
      'pack',
      'caja',
      'kit',
      'hoja',
      'pliego',
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
    return supported.includes(normalized as UnitCode) ? (normalized as UnitCode) : null;
  }

  private resolveMateriaPrimaVariantUnitCost(input: {
    materiaPrimaVariante: {
      sku: string;
      precioReferencia: Prisma.Decimal | null;
      atributosVarianteJson?: Prisma.JsonValue | null;
      unidadStock?: string | null;
      unidadCompra?: string | null;
      materiaPrima: {
        nombre: string;
        subfamilia?: string | null;
        templateId?: string | null;
        unidadStock?: string | null;
        unidadCompra?: string | null;
      };
    };
    targetUnit?: string | null;
    warnings?: string[];
    contextLabel?: string;
  }) {
    const precio = Number(input.materiaPrimaVariante.precioReferencia ?? 0);
    if (!input.materiaPrimaVariante.precioReferencia || precio <= 0) {
      return 0;
    }

    const sourceUnit =
      this.toCanonicalUnitCode(input.materiaPrimaVariante.unidadCompra) ??
      this.toCanonicalUnitCode(input.materiaPrimaVariante.unidadStock) ??
      this.toCanonicalUnitCode(input.materiaPrimaVariante.materiaPrima.unidadCompra) ??
      this.toCanonicalUnitCode(input.materiaPrimaVariante.materiaPrima.unidadStock);
    const targetUnit = this.toCanonicalUnitCode(input.targetUnit);

    if (!sourceUnit || !targetUnit) {
      return precio;
    }

    if (unitsAreCompatible(sourceUnit, targetUnit)) {
      return convertUnitPrice(precio, sourceUnit, targetUnit);
    }

    const derived = convertFlexibleRollUnitPrice({
      pricePerFromUnit: precio,
      from: sourceUnit,
      to: targetUnit,
      subfamilia: input.materiaPrimaVariante.materiaPrima.subfamilia ?? null,
      attributes: input.materiaPrimaVariante.atributosVarianteJson,
    });
    if (derived != null) {
      return derived;
    }

    input.warnings?.push(
      `${input.contextLabel ?? 'Materia prima'} ${input.materiaPrimaVariante.materiaPrima.nombre} (${input.materiaPrimaVariante.sku}) tiene precio en ${sourceUnit} y se usa en ${targetUnit}; se usa precio sin convertir.`,
    );
    return precio;
  }

  private enumToApiValue(value: string) {
    return String(value).toLowerCase();
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
        return this.roundProductNumber(input.areaPiezaM2 * input.cantidad);
      case 'a4_equiv':
        return this.roundProductNumber(input.a4EqFactor * input.pliegos);
      case 'metro_lineal':
        return this.roundProductNumber((Math.max(input.anchoMm, input.altoMm) / 1000) * input.cantidad);
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

  private buildChecklistOperacionFromPlantillaConNivel(
    template: any,
    nivel: {
      id: string;
      nombre: string;
      modoProductividadNivel: string;
      tiempoFijoMin: number | null;
      productividadBase: number | null;
      unidadSalida: string | null;
      unidadTiempo: string | null;
      maquinaId: string | null;
      maquinaNombre: string;
      perfilOperativoId: string | null;
      perfilOperativoNombre: string;
      setupMin: number | null;
      cleanupMin: number | null;
      resumen: string;
    },
    perfilOperativo: any | null,
  ) {
    const detalleBase = this.asObject(template.detalleJson);
    const baseOperacion =
      perfilOperativo && nivel.modoProductividadNivel === 'variable_perfil'
        ? this.buildChecklistOperacionFromPlantillaConPerfil(template, perfilOperativo)
        : this.buildChecklistOperacionFromPlantilla(template);

    return {
      ...baseOperacion,
      nombre: template.nombre,
      maquinaId: nivel.maquinaId ?? baseOperacion.maquinaId,
      perfilOperativoId:
        nivel.modoProductividadNivel === 'variable_perfil'
          ? perfilOperativo?.id ?? nivel.perfilOperativoId ?? baseOperacion.perfilOperativoId
          : nivel.perfilOperativoId ?? baseOperacion.perfilOperativoId,
      perfilOperativo:
        nivel.modoProductividadNivel === 'variable_perfil'
          ? perfilOperativo ?? baseOperacion.perfilOperativo
          : baseOperacion.perfilOperativo,
      setupMin: nivel.setupMin ?? baseOperacion.setupMin,
      cleanupMin: nivel.cleanupMin ?? baseOperacion.cleanupMin,
      tiempoFijoMin:
        nivel.modoProductividadNivel === 'fija'
          ? nivel.tiempoFijoMin ?? baseOperacion.tiempoFijoMin
          : baseOperacion.tiempoFijoMin,
      runMin: nivel.modoProductividadNivel === 'fija' ? new Prisma.Decimal(0) : baseOperacion.runMin,
      unidadSalida: nivel.unidadSalida ?? baseOperacion.unidadSalida,
      unidadTiempo: nivel.unidadTiempo ?? baseOperacion.unidadTiempo,
      productividadBase:
        nivel.modoProductividadNivel === 'variable_manual'
          ? nivel.productividadBase === null || nivel.productividadBase === undefined
            ? null
            : new Prisma.Decimal(nivel.productividadBase)
          : baseOperacion.productividadBase,
      modoProductividad:
        nivel.modoProductividadNivel === 'fija'
          ? ModoProductividadProceso.FIJA
          : ModoProductividadProceso.FIJA,
      detalleJson: {
        ...detalleBase,
        ...this.asObject(baseOperacion.detalleJson),
        pasoPlantillaId: this.getPasoPlantillaIdFromDetalle(template.detalleJson) ?? template.id,
        variantePasoId: nivel.id,
        variantePasoNombre: nivel.nombre,
        variantePasoResumen: nivel.resumen,
        perfilOperativoId:
          nivel.modoProductividadNivel === 'variable_perfil'
            ? perfilOperativo?.id ?? nivel.perfilOperativoId ?? null
            : nivel.perfilOperativoId ?? null,
      } as Prisma.JsonObject,
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
      maquina?: {
        plantilla?: PlantillaMaquinaria | null;
        parametrosTecnicosJson?: Prisma.JsonValue | null;
      } | null;
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
        unidadStock?: string | null;
        unidadCompra?: string | null;
        materiaPrima: {
          nombre: string;
          unidadStock?: string | null;
          unidadCompra?: string | null;
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
        unidadStock?: string | null;
        unidadCompra?: string | null;
        materiaPrima: {
          nombre: string;
          unidadStock?: string | null;
          unidadCompra?: string | null;
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
    const shouldApplyCarasFactor = this.shouldApplyCarasFactorToDigitalLaserConsumables(
      input.operation.maquina ?? null,
    );
    const effectiveCarasFactor = shouldApplyCarasFactor ? input.carasFactor : 1;
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
        const costoGramo = this.resolveMateriaPrimaVariantUnitCost({
          materiaPrimaVariante: item.materiaPrimaVariante,
          targetUnit: item.unidad,
          warnings: input.warnings,
          contextLabel: 'Consumible',
        });
        if (!item.materiaPrimaVariante.precioReferencia) {
          input.warnings.push(
            `Consumible ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) sin precio de referencia. Se usa 0.`,
          );
        }
      const pliegosBase = Math.max(0, input.pliegos);
      const pliegosEfectivos = Math.max(pliegosBase, input.pliegosEfectivos ?? pliegosBase);
      const pliegosMermaOperativa = Math.max(0, pliegosEfectivos - pliegosBase);
      const gramosBase = consumoBase * input.areaPliegoM2 * effectiveCarasFactor * pliegosBase;
      const costoBase = gramosBase * costoGramo;
      costoToner += costoBase;
      materiales.push({
        tipo: 'TONER',
        canal: color,
        nombre: item.materiaPrimaVariante.materiaPrima.nombre,
        sku: item.materiaPrimaVariante.sku,
        unidad: 'g',
        cantidad: this.roundProductNumber(gramosBase),
        costoUnitario: costoGramo,
        costo: this.roundProductNumber(costoBase),
        origen: 'Base',
      });
      if (pliegosMermaOperativa > 0) {
        const gramosMerma =
          consumoBase * input.areaPliegoM2 * effectiveCarasFactor * pliegosMermaOperativa;
        const costoMerma = gramosMerma * costoGramo;
        costoToner += costoMerma;
        materiales.push({
          tipo: 'TONER',
          canal: color,
          nombre: item.materiaPrimaVariante.materiaPrima.nombre,
          sku: item.materiaPrimaVariante.sku,
          unidad: 'g',
          cantidad: this.roundProductNumber(gramosMerma),
          costoUnitario: costoGramo,
          costo: this.roundProductNumber(costoMerma),
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
      const cantidadA4EqBase = pliegosBase * input.a4EqFactor * effectiveCarasFactor;
      const costoUnitario = precio / vidaUtil;
      const costoBase = cantidadA4EqBase * costoUnitario;
      costoDesgaste += costoBase;
      materiales.push({
        tipo: 'DESGASTE',
        nombre: item.materiaPrimaVariante.materiaPrima.nombre,
        sku: item.materiaPrimaVariante.sku,
        unidad: 'a4_eq',
        cantidad: this.roundProductNumber(cantidadA4EqBase),
        costoUnitario: this.roundProductNumber(costoUnitario),
        costo: this.roundProductNumber(costoBase),
        origen: 'Base',
      });
      if (pliegosMermaOperativa > 0) {
        const cantidadA4EqMerma = pliegosMermaOperativa * input.a4EqFactor * effectiveCarasFactor;
        const costoMerma = cantidadA4EqMerma * costoUnitario;
        costoDesgaste += costoMerma;
        materiales.push({
          tipo: 'DESGASTE',
          nombre: item.materiaPrimaVariante.materiaPrima.nombre,
          sku: item.materiaPrimaVariante.sku,
          unidad: 'a4_eq',
          cantidad: this.roundProductNumber(cantidadA4EqMerma),
          costoUnitario: this.roundProductNumber(costoUnitario),
          costo: this.roundProductNumber(costoMerma),
          origen: 'Merma operativa',
        });
      }
    }

    return { costoToner, costoDesgaste, materiales };
  }

  private shouldApplyCarasFactorToDigitalLaserConsumables(
    maquina:
      | {
          plantilla?: PlantillaMaquinaria | null;
          parametrosTecnicosJson?: Prisma.JsonValue | null;
        }
      | null
      | undefined,
  ) {
    if (!maquina || maquina.plantilla !== PlantillaMaquinaria.IMPRESORA_LASER) {
      return true;
    }
    const parametrosTecnicos = this.asObject(maquina.parametrosTecnicosJson);
    const sameConsumptionAllProfiles = parametrosTecnicos.laserSameConsumptionAllProfiles;
    return typeof sameConsumptionAllProfiles === 'boolean' ? sameConsumptionAllProfiles : true;
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

  private async validateGranFormatoVarianteRelations(
    auth: CurrentAuth,
    payload: {
      maquinaId: string;
      perfilOperativoId: string;
      materiaPrimaVarianteId: string;
    },
  ) {
    const maquina = await this.prisma.maquina.findFirst({
      where: {
        tenantId: auth.tenantId,
        id: payload.maquinaId,
      },
    });

    if (!maquina) {
      throw new NotFoundException('Máquina no encontrada.');
    }
    if (!maquina.activo) {
      throw new BadRequestException('La máquina seleccionada está inactiva.');
    }
    if (!this.isGranFormatoMachineCompatible(maquina)) {
      throw new BadRequestException('La máquina seleccionada no es compatible con gran formato flexible.');
    }

    const perfil = await this.prisma.maquinaPerfilOperativo.findFirst({
      where: {
        tenantId: auth.tenantId,
        id: payload.perfilOperativoId,
      },
    });

    if (!perfil) {
      throw new NotFoundException('Perfil operativo no encontrado.');
    }
    if (perfil.maquinaId !== maquina.id) {
      throw new BadRequestException('El perfil operativo no pertenece a la máquina seleccionada.');
    }
    if (!perfil.activo) {
      throw new BadRequestException('El perfil operativo seleccionado está inactivo.');
    }

    const materiaPrimaVariante = await this.prisma.materiaPrimaVariante.findFirst({
      where: {
        tenantId: auth.tenantId,
        id: payload.materiaPrimaVarianteId,
      },
      include: {
        materiaPrima: true,
      },
    });

    if (!materiaPrimaVariante) {
      throw new NotFoundException('Variante de materia prima no encontrada.');
    }
    if (!materiaPrimaVariante.activo || !materiaPrimaVariante.materiaPrima.activo) {
      throw new BadRequestException('La materia prima base seleccionada está inactiva.');
    }
    if (materiaPrimaVariante.materiaPrima.subfamilia !== SubfamiliaMateriaPrima.SUSTRATO_ROLLO_FLEXIBLE) {
      throw new BadRequestException(
        'La materia prima base debe pertenecer a sustratos de rollo flexible para gran formato v1.',
      );
    }

    return {
      maquina,
      perfil,
      materiaPrimaVariante,
    };
  }

  private async validateGranFormatoConfigPayload(
    auth: CurrentAuth,
    payload: UpdateGranFormatoConfigDto,
  ) {
    const tecnologiasCompatibles = this.normalizeGranFormatoTecnologias(
      this.getGranFormatoStringArray(payload.tecnologiasCompatibles),
    );
    const maquinasCompatibles = this.getGranFormatoStringArray(payload.maquinasCompatibles);
    const perfilesCompatibles = this.getGranFormatoStringArray(payload.perfilesCompatibles);
    const materialesCompatibles = this.getGranFormatoStringArray(payload.materialesCompatibles);
    const materialBaseId = this.getGranFormatoNullableString(payload.materialBaseId);
    const imposicionActual = this.getGranFormatoImposicionConfig(
      payload as unknown as Record<string, unknown>,
    );
    const imposicionPayload = payload.imposicion ? this.asObject(payload.imposicion) : {};
    const medidasPayload = Array.isArray(imposicionPayload.medidas)
      ? imposicionPayload.medidas
          .map((item) => {
            const row = this.asObject(item);
            return {
              anchoMm: this.getGranFormatoNullableNumber(row.anchoMm),
              altoMm: this.getGranFormatoNullableNumber(row.altoMm),
              cantidad: Math.max(
                1,
                Math.trunc(this.getGranFormatoNullableNumber(row.cantidad) ?? 1),
              ),
            };
          })
          .filter((item) => item.anchoMm && item.altoMm)
      : imposicionActual.medidas;
    const medidaBase = medidasPayload[0] ?? {
      anchoMm:
        'piezaAnchoMm' in imposicionPayload
          ? this.getGranFormatoNullableNumber(imposicionPayload.piezaAnchoMm)
          : imposicionActual.piezaAnchoMm,
      altoMm:
        'piezaAltoMm' in imposicionPayload
          ? this.getGranFormatoNullableNumber(imposicionPayload.piezaAltoMm)
          : imposicionActual.piezaAltoMm,
      cantidad:
        'cantidadReferencia' in imposicionPayload
          ? Math.max(
              1,
              Math.trunc(this.getGranFormatoNullableNumber(imposicionPayload.cantidadReferencia) ?? 1),
            )
          : imposicionActual.cantidadReferencia,
    };

    const tecnologiasSet = new Set<string>(tecnologiasCompatibles);
    if (tecnologiasSet.size !== tecnologiasCompatibles.length) {
      throw new BadRequestException('Hay tecnologías compatibles duplicadas.');
    }

    const maquinas = maquinasCompatibles.length
      ? await this.prisma.maquina.findMany({
          where: {
            tenantId: auth.tenantId,
            id: { in: maquinasCompatibles },
          },
        })
      : [];
    if (maquinas.length !== maquinasCompatibles.length) {
      throw new BadRequestException('Alguna máquina compatible no existe.');
    }
    for (const maquina of maquinas) {
      if (!maquina.activo || !this.isGranFormatoMachineCompatible(maquina)) {
        throw new BadRequestException(
          `La máquina ${maquina.nombre} no es compatible con gran formato flexible.`,
        );
      }
      const tecnologia = this.deriveGranFormatoTecnologia(
        maquina.plantilla,
        maquina.capacidadesAvanzadasJson,
      );
      if (!tecnologiasSet.has(tecnologia)) {
        throw new BadRequestException(
          `La máquina ${maquina.nombre} no pertenece a una tecnología seleccionada.`,
        );
      }
    }

    const maquinasSet = new Set(maquinasCompatibles);
    const perfiles = perfilesCompatibles.length
      ? await this.prisma.maquinaPerfilOperativo.findMany({
          where: {
            tenantId: auth.tenantId,
            id: { in: perfilesCompatibles },
          },
        })
      : [];
    if (perfiles.length !== perfilesCompatibles.length) {
      throw new BadRequestException('Algún perfil compatible no existe.');
    }
    for (const perfil of perfiles) {
      if (!perfil.activo) {
        throw new BadRequestException(`El perfil operativo ${perfil.nombre} está inactivo.`);
      }
      if (!maquinasSet.has(perfil.maquinaId)) {
        throw new BadRequestException(
          `El perfil operativo ${perfil.nombre} no pertenece a una máquina compatible seleccionada.`,
        );
      }
    }

    let materialBase: { id: string } | null = null;
    if (materialBaseId) {
      materialBase = await this.prisma.materiaPrima.findFirst({
        where: {
          tenantId: auth.tenantId,
          id: materialBaseId,
        },
      });
      if (!materialBase) {
        throw new BadRequestException('El material base seleccionado no existe.');
      }
      const materialBaseRow = await this.prisma.materiaPrima.findFirst({
        where: {
          tenantId: auth.tenantId,
          id: materialBaseId,
        },
      });
      if (!materialBaseRow || !materialBaseRow.activo) {
        throw new BadRequestException('El material base seleccionado está inactivo.');
      }
      if (materialBaseRow.subfamilia !== SubfamiliaMateriaPrima.SUSTRATO_ROLLO_FLEXIBLE) {
        throw new BadRequestException(
          'El material base debe pertenecer a sustrato de rollo flexible en gran formato v1.',
        );
      }
    } else if (materialesCompatibles.length) {
      throw new BadRequestException(
        'No se pueden guardar variantes de material compatibles sin seleccionar un material base.',
      );
    }

    const variantes = materialesCompatibles.length
      ? await this.prisma.materiaPrimaVariante.findMany({
          where: {
            tenantId: auth.tenantId,
            id: { in: materialesCompatibles },
          },
          include: {
            materiaPrima: true,
          },
        })
      : [];
    if (variantes.length !== materialesCompatibles.length) {
      throw new BadRequestException('Alguna variante de material compatible no existe.');
    }
    for (const variante of variantes) {
      if (!variante.activo || !variante.materiaPrima.activo) {
        throw new BadRequestException(`La variante de material ${variante.sku} está inactiva.`);
      }
      if (!materialBase || variante.materiaPrimaId !== materialBase.id) {
        throw new BadRequestException(
          `La variante de material ${variante.sku} no pertenece al material base seleccionado.`,
        );
      }
    }

    const tecnologiaDefault =
      'tecnologiaDefault' in imposicionPayload
        ? this.getGranFormatoNullableString(imposicionPayload.tecnologiaDefault)
        : imposicionActual.tecnologiaDefault;
    if (tecnologiaDefault && !tecnologiasSet.has(tecnologiaDefault)) {
      throw new BadRequestException('La tecnología default de imposición no pertenece a las tecnologías compatibles.');
    }

    const maquinaDefaultId =
      'maquinaDefaultId' in imposicionPayload
        ? this.getGranFormatoNullableString(imposicionPayload.maquinaDefaultId)
        : imposicionActual.maquinaDefaultId;
    if (maquinaDefaultId && !maquinasSet.has(maquinaDefaultId)) {
      throw new BadRequestException('La máquina default de imposición no pertenece a las máquinas compatibles.');
    }

    const perfilDefaultId =
      'perfilDefaultId' in imposicionPayload
        ? this.getGranFormatoNullableString(imposicionPayload.perfilDefaultId)
        : imposicionActual.perfilDefaultId;
    if (perfilDefaultId && !perfilesCompatibles.includes(perfilDefaultId)) {
      throw new BadRequestException('El perfil default de imposición no pertenece a los perfiles compatibles.');
    }

    const maquinaDefault = maquinaDefaultId
      ? maquinas.find((item) => item.id === maquinaDefaultId) ?? null
      : null;
    const perfilDefault = perfilDefaultId
      ? perfiles.find((item) => item.id === perfilDefaultId) ?? null
      : null;

    if (perfilDefault && maquinaDefault && perfilDefault.maquinaId !== maquinaDefault.id) {
      throw new BadRequestException('El perfil default de imposición no pertenece a la máquina default seleccionada.');
    }

    if (maquinaDefault && tecnologiaDefault) {
      const tecnologiaMaquinaDefault = this.deriveGranFormatoTecnologia(
        maquinaDefault.plantilla,
        maquinaDefault.capacidadesAvanzadasJson,
      );
      if (tecnologiaMaquinaDefault !== tecnologiaDefault) {
        throw new BadRequestException('La máquina default de imposición no coincide con la tecnología default.');
      }
    }

    return {
      tecnologiasCompatibles,
      maquinasCompatibles,
      perfilesCompatibles,
      materialBaseId,
      materialesCompatibles,
      imposicion: {
        medidas: medidasPayload,
        piezaAnchoMm: medidaBase.anchoMm,
        piezaAltoMm: medidaBase.altoMm,
        cantidadReferencia: medidaBase.cantidad,
        tecnologiaDefault,
        maquinaDefaultId,
        perfilDefaultId,
        permitirRotacion:
          'permitirRotacion' in imposicionPayload
            ? imposicionPayload.permitirRotacion !== false
            : imposicionActual.permitirRotacion,
        separacionHorizontalMm:
          'separacionHorizontalMm' in imposicionPayload
            ? Math.max(
                0,
                this.getGranFormatoNullableNumber(imposicionPayload.separacionHorizontalMm) ?? 0,
              )
            : imposicionActual.separacionHorizontalMm,
        separacionVerticalMm:
          'separacionVerticalMm' in imposicionPayload
            ? Math.max(
                0,
                this.getGranFormatoNullableNumber(imposicionPayload.separacionVerticalMm) ?? 0,
              )
            : imposicionActual.separacionVerticalMm,
        margenLateralIzquierdoMmOverride:
          'margenLateralIzquierdoMmOverride' in imposicionPayload
            ? this.getGranFormatoNullableNumber(imposicionPayload.margenLateralIzquierdoMmOverride)
            : imposicionActual.margenLateralIzquierdoMmOverride,
        margenLateralDerechoMmOverride:
          'margenLateralDerechoMmOverride' in imposicionPayload
            ? this.getGranFormatoNullableNumber(imposicionPayload.margenLateralDerechoMmOverride)
            : imposicionActual.margenLateralDerechoMmOverride,
        margenInicioMmOverride:
          'margenInicioMmOverride' in imposicionPayload
            ? this.getGranFormatoNullableNumber(imposicionPayload.margenInicioMmOverride)
            : imposicionActual.margenInicioMmOverride,
        margenFinalMmOverride:
          'margenFinalMmOverride' in imposicionPayload
            ? this.getGranFormatoNullableNumber(imposicionPayload.margenFinalMmOverride)
            : imposicionActual.margenFinalMmOverride,
        panelizadoActivo:
          'panelizadoActivo' in imposicionPayload
            ? imposicionPayload.panelizadoActivo === true
            : imposicionActual.panelizadoActivo,
        panelizadoDireccion:
          'panelizadoDireccion' in imposicionPayload && imposicionPayload.panelizadoDireccion
            ? imposicionPayload.panelizadoDireccion
            : imposicionActual.panelizadoDireccion,
        panelizadoSolapeMm:
          'panelizadoSolapeMm' in imposicionPayload
            ? this.getGranFormatoNullableNumber(imposicionPayload.panelizadoSolapeMm)
            : imposicionActual.panelizadoSolapeMm,
        panelizadoAnchoMaxPanelMm:
          'panelizadoAnchoMaxPanelMm' in imposicionPayload
            ? this.getGranFormatoNullableNumber(imposicionPayload.panelizadoAnchoMaxPanelMm)
            : imposicionActual.panelizadoAnchoMaxPanelMm,
        panelizadoDistribucion:
          'panelizadoDistribucion' in imposicionPayload && imposicionPayload.panelizadoDistribucion
            ? imposicionPayload.panelizadoDistribucion
            : imposicionActual.panelizadoDistribucion,
        panelizadoInterpretacionAnchoMaximo:
          'panelizadoInterpretacionAnchoMaximo' in imposicionPayload &&
          imposicionPayload.panelizadoInterpretacionAnchoMaximo
            ? imposicionPayload.panelizadoInterpretacionAnchoMaximo
            : imposicionActual.panelizadoInterpretacionAnchoMaximo,
        panelizadoModo:
          'panelizadoModo' in imposicionPayload && imposicionPayload.panelizadoModo
            ? imposicionPayload.panelizadoModo
            : imposicionActual.panelizadoModo,
        panelizadoManualLayout:
          'panelizadoManualLayout' in imposicionPayload
            ? ((imposicionPayload.panelizadoManualLayout as Record<string, unknown> | null) ?? null)
            : imposicionActual.panelizadoManualLayout,
        criterioOptimizacion:
          'criterioOptimizacion' in imposicionPayload &&
          [
            GranFormatoImposicionCriterioOptimizacionDto.menor_costo_total,
            GranFormatoImposicionCriterioOptimizacionDto.menor_desperdicio,
            GranFormatoImposicionCriterioOptimizacionDto.menor_largo_consumido,
          ].includes(
            this.getGranFormatoNullableString(imposicionPayload.criterioOptimizacion) as GranFormatoImposicionCriterioOptimizacionDto,
          )
            ? (this.getGranFormatoNullableString(
                imposicionPayload.criterioOptimizacion,
              ) as GranFormatoImposicionCriterioOptimizacionDto)
            : imposicionActual.criterioOptimizacion,
      },
    };
  }

  private async validateGranFormatoRutaBasePayload(
    auth: CurrentAuth,
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
    payload: UpdateGranFormatoRutaBaseDto,
  ) {
    const granFormato = this.getGranFormatoDetalle(detalleJson);
    const tecnologiasCompatibles = new Set(
      this.normalizeGranFormatoTecnologias(this.getGranFormatoStringArray(granFormato.tecnologiasCompatibles)),
    );
    const maquinasCompatibles = this.getGranFormatoStringArray(granFormato.maquinasCompatibles);
    const maquinasCompatiblesSet = new Set(maquinasCompatibles);
    const perfilesCompatiblesSet = new Set(this.getGranFormatoStringArray(granFormato.perfilesCompatibles));
    const procesoDefinicionId = this.getGranFormatoNullableString(payload.procesoDefinicionId);
    const plantillaIds = Array.from(new Set(payload.reglasImpresion.map((item) => item.pasoPlantillaId)));
    const reglaMachineIds = Array.from(
      new Set(
        payload.reglasImpresion
          .map((item) => this.getGranFormatoNullableString(item.maquinaId))
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const perfilIds = Array.from(
      new Set(
        payload.reglasImpresion.map((item) =>
          this.getGranFormatoNullableString(item.perfilOperativoDefaultId),
        ).filter((value): value is string => Boolean(value)),
      ),
    );

    const proceso = procesoDefinicionId
      ? await this.prisma.procesoDefinicion.findFirst({
          where: { tenantId: auth.tenantId, id: procesoDefinicionId },
          include: { operaciones: true },
        })
      : null;
    if (procesoDefinicionId && !proceso) {
      throw new BadRequestException('La ruta de producción seleccionada no existe.');
    }

    const [plantillas, maquinasRegla, perfiles] = await Promise.all([
      plantillaIds.length
        ? this.prisma.procesoOperacionPlantilla.findMany({
            where: { tenantId: auth.tenantId, id: { in: plantillaIds } },
          })
        : Promise.resolve([]),
      reglaMachineIds.length
        ? this.prisma.maquina.findMany({
            where: { tenantId: auth.tenantId, id: { in: reglaMachineIds } },
          })
        : Promise.resolve([]),
      perfilIds.length
        ? this.prisma.maquinaPerfilOperativo.findMany({
            where: { tenantId: auth.tenantId, id: { in: perfilIds } },
          })
        : Promise.resolve([]),
    ]);

    if (plantillas.length !== plantillaIds.length) {
      throw new BadRequestException('Algún paso de ruta base no existe.');
    }
    if (maquinasRegla.length !== reglaMachineIds.length) {
      throw new BadRequestException('Alguna máquina de regla de impresión no existe.');
    }
    if (perfiles.length !== perfilIds.length) {
      throw new BadRequestException('Algún perfil operativo de ruta base no existe.');
    }

    const plantillasById = new Map(plantillas.map((item) => [item.id, item]));
    const perfilesById = new Map(perfiles.map((item) => [item.id, item]));
    const maquinasReglaById = new Map(maquinasRegla.map((item) => [item.id, item]));
    const maquinaIdsPlantilla = Array.from(
      new Set(
        plantillas
          .map((item) => item.maquinaId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const maquinasPlantilla = maquinaIdsPlantilla.length
      ? await this.prisma.maquina.findMany({
          where: { tenantId: auth.tenantId, id: { in: maquinaIdsPlantilla } },
        })
      : [];
    const maquinasPlantillaById = new Map(maquinasPlantilla.map((item) => [item.id, item]));

    const pasoPlantillaIdsRuta = new Set(
      (proceso?.operaciones ?? [])
        .map((op) => this.resolvePasoPlantillaIdFromOperacionRuta(op, plantillas) ?? '')
        .filter(Boolean),
    );

    const seenReglas = new Set<string>();
    const reglasImpresion = payload.reglasImpresion.map((item) => {
      const tecnologia = this.normalizeGranFormatoTecnologia(item.tecnologia);
      if (!tecnologia || !tecnologiasCompatibles.has(tecnologia)) {
        throw new BadRequestException(
          `La tecnología ${String(item.tecnologia ?? '')} no está dentro de las tecnologías compatibles.`,
        );
      }
      const plantilla = plantillasById.get(item.pasoPlantillaId);
      if (!plantilla || !plantilla.activo) {
        throw new BadRequestException('Algún paso de impresión no existe o está inactivo.');
      }
      if (!procesoDefinicionId) {
        throw new BadRequestException('Primero debes seleccionar una ruta de producción base.');
      }
      if (!pasoPlantillaIdsRuta.has(item.pasoPlantillaId)) {
        throw new BadRequestException(
          `El paso "${plantilla.nombre}" no pertenece a la ruta de producción seleccionada.`,
        );
      }
      if (!plantilla.maquinaId) {
        throw new BadRequestException(
          `El paso "${plantilla.nombre}" debe tener máquina asociada para usarse en reglas de impresión.`,
        );
      }
      const maquinaPaso = maquinasPlantillaById.get(plantilla.maquinaId);
      if (!maquinaPaso || !maquinaPaso.activo || !this.isGranFormatoMachineCompatible(maquinaPaso)) {
        throw new BadRequestException(
          `La máquina del paso "${plantilla.nombre}" no es compatible con gran formato.`,
        );
      }
      const tecnologiaPaso = this.deriveGranFormatoTecnologia(
        maquinaPaso.plantilla,
        maquinaPaso.capacidadesAvanzadasJson,
      );
      if (tecnologiaPaso !== tecnologia) {
        throw new BadRequestException(
          `El paso "${plantilla.nombre}" no pertenece a la tecnología ${tecnologia}.`,
        );
      }

      const maquinaId = this.getGranFormatoNullableString(item.maquinaId);
      if (maquinaId) {
        const maquinaRegla = maquinasReglaById.get(maquinaId);
        if (!maquinaRegla || !maquinaRegla.activo) {
          throw new BadRequestException('Alguna máquina de regla de impresión no existe o está inactiva.');
        }
        if (!maquinasCompatiblesSet.has(maquinaId)) {
          throw new BadRequestException(
            `La máquina ${maquinaRegla.nombre} no está dentro de las máquinas compatibles.`,
          );
        }
        if (maquinaId !== plantilla.maquinaId) {
          throw new BadRequestException(
            `El paso "${plantilla.nombre}" no pertenece a la máquina seleccionada para la regla.`,
          );
        }
      }

      const perfilOperativoDefaultId = this.getGranFormatoNullableString(item.perfilOperativoDefaultId);
      if (perfilOperativoDefaultId) {
        const perfil = perfilesById.get(perfilOperativoDefaultId);
        if (!perfil || !perfil.activo) {
          throw new BadRequestException(
            'Algún perfil operativo default de regla de impresión no existe o está inactivo.',
          );
        }
        if (perfil.maquinaId !== plantilla.maquinaId) {
          throw new BadRequestException(
            `El perfil operativo default de "${plantilla.nombre}" no pertenece a la misma máquina del paso.`,
          );
        }
        if (perfilesCompatiblesSet.size > 0 && !perfilesCompatiblesSet.has(perfil.id)) {
          throw new BadRequestException(
            `El perfil operativo ${perfil.nombre} no está dentro de los perfiles compatibles.`,
          );
        }
      }

      const key = `${tecnologia}:${maquinaId ?? 'default'}`;
      if (seenReglas.has(key)) {
        throw new BadRequestException(
          `Hay reglas de impresión duplicadas para la combinación ${tecnologia}${maquinaId ? ` / ${maquinaId}` : ''}.`,
        );
      }
      seenReglas.add(key);

      return {
        tecnologia,
        maquinaId,
        pasoPlantillaId: item.pasoPlantillaId,
        perfilOperativoDefaultId,
      };
    });

    reglasImpresion.sort((a, b) => {
      if (a.tecnologia !== b.tecnologia) {
        return a.tecnologia.localeCompare(b.tecnologia);
      }
      if (a.maquinaId && !b.maquinaId) return -1;
      if (!a.maquinaId && b.maquinaId) return 1;
      return (a.maquinaId ?? '').localeCompare(b.maquinaId ?? '');
    });

    return {
      procesoDefinicionId,
      reglasImpresion,
    };
  }

  private resolveGranFormatoRutaBaseReglaImpresion(
    detalleJson: Prisma.JsonValue | Record<string, unknown> | null | undefined,
    tecnologia: string,
    maquinaId?: string | null,
  ) {
    const normalizedTecnologia = this.normalizeGranFormatoTecnologia(tecnologia);
    if (!normalizedTecnologia) {
      return null;
    }
    const normalizedMachineId = this.getGranFormatoNullableString(maquinaId);
    const reglas = this.getGranFormatoRutaBaseReglasImpresion(detalleJson);
    return (
      reglas.find(
        (item) => item.tecnologia === normalizedTecnologia && item.maquinaId === normalizedMachineId,
      ) ??
      reglas.find((item) => item.tecnologia === normalizedTecnologia && item.maquinaId === null) ??
      null
    );
  }

  private isGranFormatoMachineCompatible(maquina: {
    plantilla: PlantillaMaquinaria;
    geometriaTrabajo: GeometriaTrabajoMaquina;
    capacidadesAvanzadasJson?: Prisma.JsonValue | null;
  }) {
    const capacidades =
      maquina.capacidadesAvanzadasJson &&
      typeof maquina.capacidadesAvanzadasJson === 'object' &&
      !Array.isArray(maquina.capacidadesAvanzadasJson)
        ? (maquina.capacidadesAvanzadasJson as Record<string, unknown>)
        : {};
    const raw = Array.isArray(capacidades.geometriasCompatibles)
      ? capacidades.geometriasCompatibles
      : [];
    const geometriasCompatibles = raw
      .map((item) => String(item ?? '').trim().toLowerCase())
      .filter(Boolean);
    const soportaRollo =
      geometriasCompatibles.includes('rollo') ||
      maquina.geometriaTrabajo === GeometriaTrabajoMaquina.ROLLO ||
      maquina.plantilla === PlantillaMaquinaria.IMPRESORA_UV_MESA_EXTENSORA;
    return (
      soportaRollo &&
      ProductosServiciosService.WIDE_FORMAT_MACHINE_TEMPLATES.has(maquina.plantilla)
    );
  }

  private buildGranFormatoVarianteDetalle(
    maquina: {
      plantilla: PlantillaMaquinaria;
      geometriaTrabajo: GeometriaTrabajoMaquina;
      anchoUtil: Prisma.Decimal | null;
      capacidadesAvanzadasJson?: Prisma.JsonValue | null;
    },
    perfil: {
      printMode: TipoImpresionProductoVariante | null;
      cantidadPasadas: number | null;
      productivityValue: Prisma.Decimal | null;
      productivityUnit: UnidadProduccionMaquina | null;
      materialPreset: string | null;
      detalleJson: Prisma.JsonValue | null;
    },
  ) {
    return {
      tecnologia: this.deriveGranFormatoTecnologia(
        maquina.plantilla,
        maquina.capacidadesAvanzadasJson ?? null,
      ),
      configuracionTintas: this.deriveGranFormatoConfiguracionTintas(perfil.detalleJson, perfil.printMode),
      plantillaMaquina: this.enumToApiValue(maquina.plantilla),
      geometriaTrabajo: this.enumToApiValue(maquina.geometriaTrabajo),
      anchoUtilMaquina: this.decimalToNumber(maquina.anchoUtil),
      cantidadPasadas: perfil.cantidadPasadas ?? null,
      productivityValue: this.decimalToNumber(perfil.productivityValue),
      productivityUnit: perfil.productivityUnit ? this.enumToApiValue(perfil.productivityUnit) : '',
      materialPreset: perfil.materialPreset ?? '',
    };
  }

  private getDefaultTarifaPeriodo() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private buildGranFormatoVariantChips(variant: {
    atributosVarianteJson?: Prisma.JsonValue | null;
  }) {
    const attrs = this.asObject(variant.atributosVarianteJson);
    const chips: Array<{ label: string; value: string }> = [];
    const width = this.readMaterialVariantWidthMmFromRecord(attrs);
    const length = this.readNumericValue(
      attrs.largo ?? attrs.largoRollo ?? attrs.longitud ?? attrs.longitudRollo,
    );
    const acabado = typeof attrs.acabado === 'string' ? attrs.acabado.trim() : '';
    if (width && width > 0) {
      chips.push({ label: 'Ancho de rollo', value: `${Number((width / 1000).toFixed(2))} m` });
    }
    if (length && length > 0) {
      chips.push({ label: 'Largo de rollo', value: `${length} m` });
    }
    if (acabado) {
      chips.push({ label: 'Acabado', value: acabado });
    }
    return chips;
  }

  private buildMateriaPrimaVariantDisplayChips(variant: {
    atributosVarianteJson?: Prisma.JsonValue | null;
  }) {
    const attrs = this.asObject(variant.atributosVarianteJson);
    const chips = this.buildGranFormatoVariantChips(variant);
    const color = typeof attrs.color === 'string' ? attrs.color.trim() : '';
    const presentacion = this.readNumericValue(
      attrs.volumenPresentacion ?? attrs.presentacionMl,
    );
    const tecnologiaCompatible =
      typeof attrs.tecnologiaCompatible === 'string' ? attrs.tecnologiaCompatible.trim() : '';

    if (color) {
      chips.push({ label: 'Color', value: color.toUpperCase() });
    }
    if (presentacion && presentacion > 0) {
      chips.push({ label: 'Presentación', value: `${presentacion} ml` });
    }
    if (tecnologiaCompatible) {
      chips.push({ label: 'Tecnología', value: tecnologiaCompatible });
    }

    return chips.filter(
      (chip, index, list) =>
        list.findIndex((item) => item.label === chip.label && item.value === chip.value) === index,
    );
  }

  private buildGranFormatoPieceLabel(index: number) {
    let current = index;
    let label = '';
    do {
      label = String.fromCharCode(65 + (current % 26)) + label;
      current = Math.floor(current / 26) - 1;
    } while (current >= 0);
    return `Pieza ${label}`;
  }

  private buildGranFormatoNestingOrientacion(
    placements: Array<{ rotated: boolean }>,
  ): GranFormatoNestingOrientation {
    if (!placements.length) {
      return 'normal';
    }
    const hasRotated = placements.some((item) => item.rotated);
    const hasNormal = placements.some((item) => !item.rotated);
    if (hasRotated && hasNormal) {
      return 'mixta';
    }
    return hasRotated ? 'rotada' : 'normal';
  }

  private countGranFormatoRowsAndPiecesPerRow(
    placements: GranFormatoCostosPreviewPlacement[],
    toleranceMm: number,
  ) {
    if (!placements.length) {
      return { rows: 0, piecesPerRow: 0 };
    }
    const rows: Array<{ topMm: number; bottomMm: number; count: number }> = [];
    const sorted = [...placements].sort((a, b) => {
      const topDiff = a.centerYMm - a.heightMm / 2 - (b.centerYMm - b.heightMm / 2);
      if (Math.abs(topDiff) > toleranceMm) {
        return topDiff;
      }
      return a.centerXMm - b.centerXMm;
    });
    for (const placement of sorted) {
      const topMm = placement.centerYMm - placement.heightMm / 2;
      const bottomMm = placement.centerYMm + placement.heightMm / 2;
      const existing = rows.find(
        (row) =>
          Math.abs(row.topMm - topMm) <= toleranceMm ||
          (topMm <= row.bottomMm - toleranceMm && bottomMm >= row.topMm + toleranceMm),
      );
      if (existing) {
        existing.topMm = Math.min(existing.topMm, topMm);
        existing.bottomMm = Math.max(existing.bottomMm, bottomMm);
        existing.count += 1;
        continue;
      }
      rows.push({ topMm, bottomMm, count: 1 });
    }
    return {
      rows: rows.length,
      piecesPerRow: rows.reduce((max, row) => Math.max(max, row.count), 0),
    };
  }

  private buildGranFormatoPieceInstances(
    medidas: Array<{
      anchoMm: number;
      altoMm: number;
      cantidad: number;
    }>,
  ) {
    return medidas
      .flatMap((medida, medidaIndex) =>
        Array.from({ length: Math.max(1, medida.cantidad) }, (_, copyIndex) => ({
          id: `piece-${medidaIndex}-${copyIndex}`,
          sourcePieceId: `piece-${medidaIndex}-${copyIndex}`,
          originalWidthMm: medida.anchoMm,
          originalHeightMm: medida.altoMm,
          widthMm: medida.anchoMm,
          heightMm: medida.altoMm,
          usefulWidthMm: medida.anchoMm,
          usefulHeightMm: medida.altoMm,
          overlapStartMm: 0,
          overlapEndMm: 0,
          area: medida.anchoMm * medida.altoMm,
          longestSide: Math.max(medida.anchoMm, medida.altoMm),
          shortestSide: Math.min(medida.anchoMm, medida.altoMm),
          panelIndex: null as number | null,
          panelCount: null as number | null,
          panelAxis: null as 'vertical' | 'horizontal' | null,
        })),
      )
      .sort(
        (a, b) =>
          b.longestSide - a.longestSide ||
          b.area - a.area ||
          b.shortestSide - a.shortestSide,
      );
  }

  private buildGranFormatoPanelizedPieces(input: {
    medidas: Array<{
      anchoMm: number;
      altoMm: number;
      cantidad: number;
    }>;
    printableWidthMm: number;
    panelAxis: 'vertical' | 'horizontal';
    overlapMm: number;
    maxPanelWidthMm: number;
    distribution: 'equilibrada' | 'libre';
    widthInterpretation: 'total' | 'util';
  }) {
    const pieces: Array<{
      id: string;
      sourcePieceId: string;
      originalWidthMm: number;
      originalHeightMm: number;
      widthMm: number;
      heightMm: number;
      usefulWidthMm: number;
      usefulHeightMm: number;
      overlapStartMm: number;
      overlapEndMm: number;
      panelIndex: number;
      panelCount: number;
      panelAxis: 'vertical' | 'horizontal';
      area: number;
      longestSide: number;
      shortestSide: number;
    }> = [];

    const buildSplitSizes = (totalMm: number, panelCount: number, maxUsefulWidthMm: number) => {
      if (input.distribution === 'libre') {
        const sizes: number[] = [];
        let remaining = totalMm;
        for (let index = 0; index < panelCount; index += 1) {
          const segmentsLeft = panelCount - index;
          if (segmentsLeft === 1) {
            sizes.push(remaining);
            break;
          }
          const next = Math.min(maxUsefulWidthMm, remaining - (segmentsLeft - 1));
          sizes.push(next);
          remaining -= next;
        }
        return sizes;
      }

      const base = Math.floor(totalMm / panelCount);
      const remainder = totalMm % panelCount;
      return Array.from({ length: panelCount }, (_, index) => base + (index < remainder ? 1 : 0));
    };

    for (const [medidaIndex, medida] of input.medidas.entries()) {
      for (let copyIndex = 0; copyIndex < Math.max(1, medida.cantidad); copyIndex += 1) {
        const sourcePieceId = `piece-${medidaIndex}-${copyIndex}`;
      const splitDimension = input.panelAxis === 'vertical' ? medida.anchoMm : medida.altoMm;
        const effectivePhysicalLimitMm = Math.min(input.maxPanelWidthMm, input.printableWidthMm);
        const maxOverlapPerPanelMm = input.overlapMm * 2;
        const effectiveUsefulLimitMm =
          input.widthInterpretation === 'total'
            ? effectivePhysicalLimitMm - maxOverlapPerPanelMm
            : effectivePhysicalLimitMm;
        if (effectiveUsefulLimitMm <= 0) {
          return null;
        }
        if (splitDimension <= effectiveUsefulLimitMm) {
          return null;
        }
        const panelCountResolved = Math.max(2, Math.ceil(splitDimension / effectiveUsefulLimitMm));
        const panelSizes = buildSplitSizes(splitDimension, panelCountResolved, effectiveUsefulLimitMm);
        const fits = panelSizes.every((segment, index) => {
          const extraStart = index === 0 ? 0 : input.overlapMm;
          const extraEnd = index === panelCountResolved - 1 ? 0 : input.overlapMm;
          const physicalSize = segment + extraStart + extraEnd;
          const withinConfiguredLimit =
            input.widthInterpretation === 'total'
              ? physicalSize <= effectivePhysicalLimitMm
              : segment <= effectivePhysicalLimitMm;
          return withinConfiguredLimit && physicalSize <= input.printableWidthMm;
        });

        if (!fits) {
          return null;
        }

        panelSizes.forEach((segment, index) => {
          const extraStart = index === 0 ? 0 : input.overlapMm;
          const extraEnd = index === panelCountResolved - 1 ? 0 : input.overlapMm;
          const widthMm =
            input.panelAxis === 'vertical' ? segment + extraStart + extraEnd : medida.anchoMm;
          const heightMm =
            input.panelAxis === 'horizontal' ? segment + extraStart + extraEnd : medida.altoMm;
          pieces.push({
            id: `${sourcePieceId}-panel-${index + 1}`,
            sourcePieceId,
            originalWidthMm: medida.anchoMm,
            originalHeightMm: medida.altoMm,
            widthMm,
            heightMm,
            usefulWidthMm: input.panelAxis === 'vertical' ? segment : medida.anchoMm,
            usefulHeightMm: input.panelAxis === 'horizontal' ? segment : medida.altoMm,
            overlapStartMm: extraStart,
            overlapEndMm: extraEnd,
            panelIndex: index + 1,
            panelCount: panelCountResolved,
            panelAxis: input.panelAxis,
            area: medida.anchoMm * medida.altoMm,
            longestSide: Math.max(widthMm, heightMm),
            shortestSide: Math.min(widthMm, heightMm),
          });
        });
      }
    }

    return pieces.sort(
      (a, b) =>
        b.longestSide - a.longestSide ||
        b.area - a.area ||
        b.shortestSide - a.shortestSide,
    );
  }

  private normalizeGranFormatoPanelManualLayout(
    value: Record<string, unknown> | null | undefined,
  ): {
    items: Array<{
      sourcePieceId: string;
      pieceWidthMm: number;
      pieceHeightMm: number;
      axis: 'vertical' | 'horizontal';
      panels: Array<{
        panelIndex: number;
        usefulWidthMm: number;
        usefulHeightMm: number;
        overlapStartMm: number;
        overlapEndMm: number;
        finalWidthMm: number;
        finalHeightMm: number;
      }>;
    }>;
  } | null {
    const itemsRaw = Array.isArray(value?.items) ? value.items : null;
    if (!itemsRaw?.length) {
      return null;
    }
    const items = itemsRaw
      .map((item) => {
        const current = item as Record<string, unknown>;
        const panelsRaw = Array.isArray(current.panels) ? current.panels : [];
        const sourcePieceId =
          typeof current.sourcePieceId === 'string' ? current.sourcePieceId.trim() : '';
        const axis =
          current.axis === 'horizontal' ? 'horizontal' : current.axis === 'vertical' ? 'vertical' : null;
        const pieceWidthMm = this.getGranFormatoNullableNumber(current.pieceWidthMm);
        const pieceHeightMm = this.getGranFormatoNullableNumber(current.pieceHeightMm);
        const panels = panelsRaw
          .map((panel) => {
            const currentPanel = panel as Record<string, unknown>;
            return {
              panelIndex: Math.max(1, Number(currentPanel.panelIndex ?? 1)),
              usefulWidthMm: this.getGranFormatoNullableNumber(currentPanel.usefulWidthMm) ?? 0,
              usefulHeightMm: this.getGranFormatoNullableNumber(currentPanel.usefulHeightMm) ?? 0,
              overlapStartMm: this.getGranFormatoNullableNumber(currentPanel.overlapStartMm) ?? 0,
              overlapEndMm: this.getGranFormatoNullableNumber(currentPanel.overlapEndMm) ?? 0,
              finalWidthMm: this.getGranFormatoNullableNumber(currentPanel.finalWidthMm) ?? 0,
              finalHeightMm: this.getGranFormatoNullableNumber(currentPanel.finalHeightMm) ?? 0,
            };
          })
          .filter((panel) => panel.finalWidthMm > 0 && panel.finalHeightMm > 0)
          .sort((a, b) => a.panelIndex - b.panelIndex);
        if (!sourcePieceId || !axis || !pieceWidthMm || !pieceHeightMm || !panels.length) {
          return null;
        }
        return {
          sourcePieceId,
          pieceWidthMm,
          pieceHeightMm,
          axis: axis as 'vertical' | 'horizontal',
          panels,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);

    return items.length ? { items } : null;
  }

  private buildGranFormatoManualPieces(input: {
    medidas: Array<{
      anchoMm: number;
      altoMm: number;
      cantidad: number;
    }>;
    printableWidthMm: number;
    maxPanelWidthMm: number;
    widthInterpretation: 'total' | 'util';
    manualLayout: {
      items: Array<{
        sourcePieceId: string;
        pieceWidthMm: number;
        pieceHeightMm: number;
        axis: 'vertical' | 'horizontal';
        panels: Array<{
          panelIndex: number;
          usefulWidthMm: number;
          usefulHeightMm: number;
          overlapStartMm: number;
          overlapEndMm: number;
          finalWidthMm: number;
          finalHeightMm: number;
        }>;
      }>;
    };
  }) {
    const expectedPieces = this.buildGranFormatoPieceInstances(input.medidas);
    if (expectedPieces.length !== input.manualLayout.items.length) {
      return null;
    }
    const byId = new Map(input.manualLayout.items.map((item) => [item.sourcePieceId, item]));
    const pieces: Array<{
      id: string;
      sourcePieceId: string;
      originalWidthMm: number;
      originalHeightMm: number;
      widthMm: number;
      heightMm: number;
      usefulWidthMm: number;
      usefulHeightMm: number;
      overlapStartMm: number;
      overlapEndMm: number;
      panelIndex: number;
      panelCount: number;
      panelAxis: 'vertical' | 'horizontal';
      area: number;
      longestSide: number;
      shortestSide: number;
    }> = [];

    for (const sourcePiece of expectedPieces) {
      const layout = byId.get(sourcePiece.sourcePieceId);
      if (!layout) {
        return null;
      }
      const expectedTotal =
        layout.axis === 'vertical' ? sourcePiece.originalWidthMm : sourcePiece.originalHeightMm;
      const usefulTotal = layout.panels.reduce(
        (acc, panel) => acc + (layout.axis === 'vertical' ? panel.usefulWidthMm : panel.usefulHeightMm),
        0,
      );
      if (Math.abs(usefulTotal - expectedTotal) > 1) {
        return null;
      }

      for (const panel of layout.panels) {
        const physicalLimitOk =
          input.widthInterpretation === 'total'
            ? (layout.axis === 'vertical' ? panel.finalWidthMm : panel.finalHeightMm) <= input.maxPanelWidthMm
            : (layout.axis === 'vertical' ? panel.usefulWidthMm : panel.usefulHeightMm) <= input.maxPanelWidthMm;
        const printableFit =
          (layout.axis === 'vertical' ? panel.finalWidthMm : panel.finalHeightMm) <= input.printableWidthMm;
        if (
          panel.usefulWidthMm <= 0 ||
          panel.usefulHeightMm <= 0 ||
          panel.finalWidthMm <= 0 ||
          panel.finalHeightMm <= 0 ||
          !physicalLimitOk ||
          !printableFit
        ) {
          return null;
        }
        pieces.push({
          id: `${layout.sourcePieceId}-panel-${panel.panelIndex}`,
          sourcePieceId: layout.sourcePieceId,
          originalWidthMm: layout.pieceWidthMm,
          originalHeightMm: layout.pieceHeightMm,
          widthMm: panel.finalWidthMm,
          heightMm: panel.finalHeightMm,
          usefulWidthMm: panel.usefulWidthMm,
          usefulHeightMm: panel.usefulHeightMm,
          overlapStartMm: panel.overlapStartMm,
          overlapEndMm: panel.overlapEndMm,
          panelIndex: panel.panelIndex,
          panelCount: layout.panels.length,
          panelAxis: layout.axis,
          area: layout.pieceWidthMm * layout.pieceHeightMm,
          longestSide: Math.max(panel.finalWidthMm, panel.finalHeightMm),
          shortestSide: Math.min(panel.finalWidthMm, panel.finalHeightMm),
        });
      }
    }

    return pieces.sort(
      (a, b) =>
        b.longestSide - a.longestSide ||
        b.area - a.area ||
        b.shortestSide - a.shortestSide,
    );
  }

  private evaluateGranFormatoMixedShelfLayout(input: {
    printableWidthMm: number;
    marginLeftMm: number;
    marginStartMm: number;
    marginEndMm: number;
    separacionHorizontalMm: number;
    separacionVerticalMm: number;
    permitirRotacion: boolean;
    medidas: Array<{
      anchoMm: number;
      altoMm: number;
      cantidad: number;
    }>;
    panelizado?: {
      activo: boolean;
      mode: 'automatico' | 'manual';
      axis: 'vertical' | 'horizontal';
      overlapMm: number;
      maxPanelWidthMm: number;
      distribution: 'equilibrada' | 'libre';
      widthInterpretation: 'total' | 'util';
      manualLayout?: Record<string, unknown> | null;
    };
  }) {
    const manualLayout = this.normalizeGranFormatoPanelManualLayout(
      (input.panelizado?.manualLayout as Record<string, unknown> | null | undefined) ?? null,
    );
    const pieces = input.panelizado?.activo
      ? input.panelizado.mode === 'manual' && manualLayout
        ? this.buildGranFormatoManualPieces({
            medidas: input.medidas,
            printableWidthMm: input.printableWidthMm,
            maxPanelWidthMm: input.panelizado.maxPanelWidthMm,
            widthInterpretation: input.panelizado.widthInterpretation,
            manualLayout,
          })
        : this.buildGranFormatoPanelizedPieces({
          medidas: input.medidas,
          printableWidthMm: input.printableWidthMm,
          panelAxis: input.panelizado.axis,
          overlapMm: input.panelizado.overlapMm,
          maxPanelWidthMm: input.panelizado.maxPanelWidthMm,
          distribution: input.panelizado.distribution,
          widthInterpretation: input.panelizado.widthInterpretation,
        })
      : this.buildGranFormatoPieceInstances(input.medidas);
    if (!pieces || !pieces.length) {
      return null;
    }
    type Row = {
      yMm: number;
      usedWidthMm: number;
      heightMm: number;
      count: number;
    };
    type State = {
      rows: Row[];
      placements: GranFormatoCostosPreviewPlacement[];
    };

    const resolveNextRowY = (rows: Row[]) => {
      if (!rows.length) {
        return input.marginStartMm;
      }
      const last = rows[rows.length - 1];
      return last.yMm + last.heightMm + input.separacionVerticalMm;
    };

    const measureState = (state: State) => {
      const contentHeightMm = state.rows.reduce((acc, row) => acc + row.heightMm, 0);
      const verticalGapsMm =
        state.rows.length > 1 ? (state.rows.length - 1) * input.separacionVerticalMm : 0;
      const consumedContentLengthMm = contentHeightMm + verticalGapsMm;
      const placedAreaMm2 = state.placements.reduce(
        (acc, placement) => acc + placement.originalWidthMm * placement.originalHeightMm,
        0,
      );
      const wasteProxyMm2 = input.printableWidthMm * consumedContentLengthMm - placedAreaMm2;
      return { consumedContentLengthMm, wasteProxyMm2 };
    };

    let states: State[] = [{ rows: [], placements: [] }];

    for (const piece of pieces) {
      const orientations = [
        {
          widthMm: piece.widthMm,
          heightMm: piece.heightMm,
          rotated: false,
        },
        ...(input.permitirRotacion && piece.widthMm !== piece.heightMm
          ? [
              {
                widthMm: piece.heightMm,
                heightMm: piece.widthMm,
                rotated: true,
              },
            ]
          : []),
      ];
      const nextStates: State[] = [];

      for (const state of states) {
        for (const option of orientations) {
          if (option.widthMm > input.printableWidthMm) {
            continue;
          }

          for (const [rowIndex, row] of state.rows.entries()) {
            const nextWidth =
              row.usedWidthMm === 0
                ? option.widthMm
                : row.usedWidthMm + input.separacionHorizontalMm + option.widthMm;
            if (nextWidth > input.printableWidthMm) {
              continue;
            }
            const rows = state.rows.map((item) => ({ ...item }));
            const targetRow = rows[rowIndex];
            const xMm =
              targetRow.usedWidthMm === 0
                ? input.marginLeftMm
                : input.marginLeftMm + targetRow.usedWidthMm + input.separacionHorizontalMm;
            targetRow.usedWidthMm = nextWidth;
            targetRow.heightMm = Math.max(targetRow.heightMm, option.heightMm);
            targetRow.count += 1;
            nextStates.push({
              rows,
              placements: [
                ...state.placements,
                {
                  id: piece.id,
                  widthMm: option.widthMm,
                  heightMm: option.heightMm,
                  centerXMm: xMm + option.widthMm / 2,
                  centerYMm: targetRow.yMm + option.heightMm / 2,
                  label: `${Math.round(piece.originalWidthMm / 10)}x${Math.round(
                    piece.originalHeightMm / 10,
                  )} cm`,
                  rotated: option.rotated,
                  originalWidthMm: piece.originalWidthMm,
                  originalHeightMm: piece.originalHeightMm,
                  panelIndex: piece.panelIndex,
                  panelCount: piece.panelCount,
                  panelAxis: piece.panelAxis,
                  sourcePieceId: piece.sourcePieceId,
                  usefulWidthMm: piece.usefulWidthMm ?? piece.widthMm,
                  usefulHeightMm: piece.usefulHeightMm ?? piece.heightMm,
                  overlapStartMm: piece.overlapStartMm ?? 0,
                  overlapEndMm: piece.overlapEndMm ?? 0,
                },
              ],
            });
          }

          const rows = state.rows.map((item) => ({ ...item }));
          const newRow: Row = {
            yMm: resolveNextRowY(rows),
            usedWidthMm: option.widthMm,
            heightMm: option.heightMm,
            count: 1,
          };
          rows.push(newRow);
          nextStates.push({
            rows,
            placements: [
              ...state.placements,
              {
                id: piece.id,
                widthMm: option.widthMm,
                heightMm: option.heightMm,
                centerXMm: input.marginLeftMm + option.widthMm / 2,
                centerYMm: newRow.yMm + option.heightMm / 2,
                label: `${Math.round(piece.originalWidthMm / 10)}x${Math.round(
                  piece.originalHeightMm / 10,
                )} cm`,
                rotated: option.rotated,
                originalWidthMm: piece.originalWidthMm,
                originalHeightMm: piece.originalHeightMm,
                panelIndex: piece.panelIndex,
                panelCount: piece.panelCount,
                panelAxis: piece.panelAxis,
                sourcePieceId: piece.sourcePieceId,
                usefulWidthMm: piece.usefulWidthMm ?? piece.widthMm,
                usefulHeightMm: piece.usefulHeightMm ?? piece.heightMm,
                overlapStartMm: piece.overlapStartMm ?? 0,
                overlapEndMm: piece.overlapEndMm ?? 0,
              },
            ],
          });
        }
      }

      if (!nextStates.length) {
        return null;
      }

      states = nextStates
        .sort((a, b) => {
          const left = measureState(a);
          const right = measureState(b);
          return (
            left.consumedContentLengthMm - right.consumedContentLengthMm ||
            left.wasteProxyMm2 - right.wasteProxyMm2 ||
            a.rows.length - b.rows.length
          );
        })
        .slice(0, 12);
    }

    const bestState = [...states].sort((a, b) => {
      const left = measureState(a);
      const right = measureState(b);
      return (
        left.consumedContentLengthMm - right.consumedContentLengthMm ||
        left.wasteProxyMm2 - right.wasteProxyMm2 ||
        a.rows.length - b.rows.length
      );
    })[0];

    const contentHeightMm = bestState.rows.reduce((acc, row) => acc + row.heightMm, 0);
    const verticalGapsMm =
      bestState.rows.length > 1 ? (bestState.rows.length - 1) * input.separacionVerticalMm : 0;
    const consumedLengthMm = input.marginStartMm + input.marginEndMm + contentHeightMm + verticalGapsMm;
    const usefulAreaM2 = input.medidas.reduce(
      (acc, item) => acc + ((item.anchoMm * item.altoMm) / 1_000_000) * item.cantidad,
      0,
    );
    const { rows: rowCount, piecesPerRow } = this.countGranFormatoRowsAndPiecesPerRow(
      bestState.placements,
      Math.max(1, input.separacionVerticalMm / 2),
    );

    return {
      orientacion: this.buildGranFormatoNestingOrientacion(bestState.placements),
      panelizado: input.panelizado?.activo === true,
      panelAxis: input.panelizado?.activo ? input.panelizado.axis : null,
      panelCount:
        bestState.placements.reduce((max, item) => Math.max(max, item.panelCount ?? 1), 1),
      panelOverlapMm: input.panelizado?.activo ? input.panelizado.overlapMm : null,
      panelMaxWidthMm: input.panelizado?.activo ? input.panelizado.maxPanelWidthMm : null,
      panelDistribution: input.panelizado?.activo ? input.panelizado.distribution : null,
      panelWidthInterpretation: input.panelizado?.activo ? input.panelizado.widthInterpretation : null,
      panelMode: input.panelizado?.activo ? input.panelizado.mode : null,
      piecesPerRow,
      rows: rowCount,
      consumedLengthMm,
      usefulAreaM2,
      placements: bestState.placements,
    };
  }

  private buildGranFormatoNestingPreview(candidate: GranFormatoCostosPreviewCandidate) {
    const palette = ['#ff9f43', '#0abde3', '#1dd1a1', '#ff6b6b', '#f97316', '#22c55e'];
    return {
      rollWidth: Number((candidate.rollWidthMm / 10).toFixed(2)),
      rollLength: Number((candidate.consumedLengthMm / 10).toFixed(2)),
      marginLeft: Number((candidate.marginLeftMm / 10).toFixed(2)),
      marginRight: Number((candidate.marginRightMm / 10).toFixed(2)),
      marginStart: Number((candidate.marginStartMm / 10).toFixed(2)),
      marginEnd: Number((candidate.marginEndMm / 10).toFixed(2)),
      panelizado: candidate.panelizado,
      panelAxis: candidate.panelAxis,
      panelCount: candidate.panelCount,
      panelOverlap: candidate.panelOverlapMm != null ? Number((candidate.panelOverlapMm / 10).toFixed(2)) : null,
      panelMaxWidth: candidate.panelMaxWidthMm != null ? Number((candidate.panelMaxWidthMm / 10).toFixed(2)) : null,
      panelDistribution: candidate.panelDistribution,
      panelWidthInterpretation: candidate.panelWidthInterpretation,
      panelMode: candidate.panelMode,
      pieces: candidate.placements.map((item, index) => ({
        id: item.id,
        w: Number((item.widthMm / 10).toFixed(2)),
        h: Number((item.heightMm / 10).toFixed(2)),
        originalW: Number((item.originalWidthMm / 10).toFixed(2)),
        originalH: Number((item.originalHeightMm / 10).toFixed(2)),
        usefulW: Number((item.usefulWidthMm / 10).toFixed(2)),
        usefulH: Number((item.usefulHeightMm / 10).toFixed(2)),
        cx: Number((((item.centerXMm - candidate.rollWidthMm / 2) / 10)).toFixed(2)),
        cy: Number((item.centerYMm / 10).toFixed(2)),
        color: palette[index % palette.length],
        label: this.buildGranFormatoPieceLabel(index),
        textColor: '#111111',
        rotated: item.rotated,
        panelIndex: item.panelIndex,
        panelCount: item.panelCount,
        panelAxis: item.panelAxis,
        sourcePieceId: item.sourcePieceId,
        overlapStart: Number((item.overlapStartMm / 10).toFixed(2)),
        overlapEnd: Number((item.overlapEndMm / 10).toFixed(2)),
      })),
    };
  }

  private expandGranFormatoMeasuresToSinglePieces(
    medidas: Array<{ anchoMm: number; altoMm: number; cantidad: number }>,
  ) {
    const pieces: Array<{ sourcePieceId: string; anchoMm: number; altoMm: number }> = [];
    for (const [medidaIndex, medida] of medidas.entries()) {
      for (let copyIndex = 0; copyIndex < Math.max(1, medida.cantidad); copyIndex += 1) {
        pieces.push({
          sourcePieceId: `piece-${medidaIndex}-${copyIndex}`,
          anchoMm: medida.anchoMm,
          altoMm: medida.altoMm,
        });
      }
    }
    return pieces;
  }

  private buildGranFormatoHybridGroupKey(candidate: GranFormatoCostosPreviewCandidate) {
    return [
      candidate.variant.id,
      candidate.panelizado ? 'panelizado' : 'normal',
      candidate.panelAxis ?? 'none',
      candidate.panelMode ?? 'none',
    ].join('|');
  }

  private buildGranFormatoHybridCandidates(input: Parameters<ProductosServiciosService['evaluateGranFormatoImposicionCandidates']>[0]) {
    const pieces = this.expandGranFormatoMeasuresToSinglePieces(input.medidas);
    if (!pieces.length) {
      return [] as GranFormatoHybridGroupCandidate[];
    }

    const assignments: GranFormatoHybridPieceAssignment[] = [];
    for (const piece of pieces) {
      const pieceCandidates = this.evaluateGranFormatoImposicionCandidates({
        ...input,
        medidas: [
          {
            anchoMm: piece.anchoMm,
            altoMm: piece.altoMm,
            cantidad: 1,
          },
        ],
      });
      if (!pieceCandidates.length) {
        return [] as GranFormatoHybridGroupCandidate[];
      }
      assignments.push({
        ...piece,
        candidate: pieceCandidates[0],
      });
    }

    const grouped = new Map<
      string,
      {
        variant: any;
        panelizado: boolean;
        panelAxis: 'vertical' | 'horizontal' | null;
        panelMode: 'automatico' | 'manual' | null;
        pieces: Array<{ sourcePieceId: string; anchoMm: number; altoMm: number }>;
      }
    >();

    for (const assignment of assignments) {
      const groupKey = this.buildGranFormatoHybridGroupKey(assignment.candidate);
      const current = grouped.get(groupKey) ?? {
        variant: assignment.candidate.variant,
        panelizado: assignment.candidate.panelizado,
        panelAxis: assignment.candidate.panelAxis,
        panelMode: assignment.candidate.panelMode,
        pieces: [],
      };
      current.pieces.push({
        sourcePieceId: assignment.sourcePieceId,
        anchoMm: assignment.anchoMm,
        altoMm: assignment.altoMm,
      });
      grouped.set(groupKey, current);
    }

    const groups: GranFormatoHybridGroupCandidate[] = [];
    for (const [groupKey, group] of grouped.entries()) {
      const groupMeasures = group.pieces.map((piece) => ({
        anchoMm: piece.anchoMm,
        altoMm: piece.altoMm,
        cantidad: 1,
      }));
      const sourcePieceIds = new Set(group.pieces.map((piece) => piece.sourcePieceId));
      const filteredManualLayout =
        input.config.panelizadoManualLayout &&
        Array.isArray((input.config.panelizadoManualLayout as { items?: unknown[] }).items)
          ? {
              items: ((input.config.panelizadoManualLayout as { items: Array<Record<string, unknown>> }).items ?? []).filter(
                (item) =>
                  typeof item?.sourcePieceId === 'string' &&
                  sourcePieceIds.has(item.sourcePieceId),
              ),
            }
          : null;
      const groupConfig = {
        ...input.config,
        panelizadoActivo: group.panelizado,
        panelizadoDireccion:
          group.panelizado && group.panelAxis
            ? (group.panelAxis === 'vertical'
              ? GranFormatoPanelizadoDireccionDto.vertical
              : GranFormatoPanelizadoDireccionDto.horizontal)
            : input.config.panelizadoDireccion,
        panelizadoModo:
          group.panelizado && group.panelMode === GranFormatoPanelizadoModoDto.manual
            ? GranFormatoPanelizadoModoDto.manual
            : group.panelizado
              ? GranFormatoPanelizadoModoDto.automatico
              : input.config.panelizadoModo,
        panelizadoManualLayout: group.panelizado && group.panelMode === GranFormatoPanelizadoModoDto.manual
          ? filteredManualLayout
          : null,
      };
      const groupCandidates = this.evaluateGranFormatoImposicionCandidates({
        ...input,
        medidas: groupMeasures,
        config: groupConfig,
        variants: [group.variant],
      });
      const resolvedCandidate =
        groupCandidates.find(
          (candidate) =>
            candidate.variant.id === group.variant.id &&
            candidate.panelizado === group.panelizado &&
            (group.panelizado ? candidate.panelAxis === group.panelAxis : true),
        ) ?? groupCandidates[0];
      if (!resolvedCandidate) {
        return [] as GranFormatoHybridGroupCandidate[];
      }
      groups.push({
        groupKey,
        variant: group.variant,
        panelizado: group.panelizado,
        panelAxis: group.panelAxis,
        panelMode: group.panelMode,
        pieces: group.pieces,
        candidate: resolvedCandidate,
      });
    }

    return groups.sort((a, b) => {
      if (a.panelizado !== b.panelizado) {
        return Number(a.panelizado) - Number(b.panelizado);
      }
      return a.groupKey.localeCompare(b.groupKey);
    });
  }

  private buildGranFormatoPreparedPiecesFromCandidatePlacements(
    candidate: GranFormatoCostosPreviewCandidate,
  ): GranFormatoPreparedLayoutPiece[] {
    return candidate.placements.map((placement) => ({
      id: placement.id,
      sourcePieceId: placement.sourcePieceId ?? placement.id,
      widthMm: placement.widthMm,
      heightMm: placement.heightMm,
      usefulWidthMm: placement.usefulWidthMm,
      usefulHeightMm: placement.usefulHeightMm,
      overlapStartMm: placement.overlapStartMm,
      overlapEndMm: placement.overlapEndMm,
      originalWidthMm: placement.originalWidthMm,
      originalHeightMm: placement.originalHeightMm,
      panelIndex: placement.panelIndex,
      panelCount: placement.panelCount,
      panelAxis: placement.panelAxis,
      label: placement.label,
      rotated: placement.rotated,
    }));
  }

  private evaluateGranFormatoPreparedShelfLayout(input: {
    printableWidthMm: number;
    marginLeftMm: number;
    marginStartMm: number;
    marginEndMm: number;
    separacionHorizontalMm: number;
    separacionVerticalMm: number;
    pieces: GranFormatoPreparedLayoutPiece[];
  }) {
    if (!input.pieces.length) {
      return null;
    }
    type Row = {
      yMm: number;
      usedWidthMm: number;
      heightMm: number;
      count: number;
    };

    const rows: Row[] = [];
    const placements: GranFormatoCostosPreviewPlacement[] = [];

    const sortedPieces = [...input.pieces].sort(
      (a, b) =>
        Math.max(b.widthMm, b.heightMm) - Math.max(a.widthMm, a.heightMm) ||
        b.originalWidthMm * b.originalHeightMm - a.originalWidthMm * a.originalHeightMm ||
        Math.min(b.widthMm, b.heightMm) - Math.min(a.widthMm, a.heightMm),
    );

    const resolveNextRowY = () => {
      if (!rows.length) {
        return input.marginStartMm;
      }
      const last = rows[rows.length - 1];
      return last.yMm + last.heightMm + input.separacionVerticalMm;
    };

    for (const piece of sortedPieces) {
      if (piece.widthMm > input.printableWidthMm) {
        return null;
      }

      let rowIndex = rows.findIndex((row) => {
        const nextWidth =
          row.usedWidthMm === 0
            ? piece.widthMm
            : row.usedWidthMm + input.separacionHorizontalMm + piece.widthMm;
        return nextWidth <= input.printableWidthMm;
      });

      if (rowIndex === -1) {
        rows.push({
          yMm: resolveNextRowY(),
          usedWidthMm: 0,
          heightMm: 0,
          count: 0,
        });
        rowIndex = rows.length - 1;
      }

      const row = rows[rowIndex];
      const xMm =
        row.usedWidthMm === 0
          ? input.marginLeftMm
          : input.marginLeftMm + row.usedWidthMm + input.separacionHorizontalMm;
      row.usedWidthMm =
        row.usedWidthMm === 0
          ? piece.widthMm
          : row.usedWidthMm + input.separacionHorizontalMm + piece.widthMm;
      row.heightMm = Math.max(row.heightMm, piece.heightMm);
      row.count += 1;

      placements.push({
        id: piece.id,
        widthMm: piece.widthMm,
        heightMm: piece.heightMm,
        usefulWidthMm: piece.usefulWidthMm,
        usefulHeightMm: piece.usefulHeightMm,
        overlapStartMm: piece.overlapStartMm,
        overlapEndMm: piece.overlapEndMm,
        centerXMm: xMm + piece.widthMm / 2,
        centerYMm: row.yMm + piece.heightMm / 2,
        label: piece.label,
        rotated: piece.rotated,
        originalWidthMm: piece.originalWidthMm,
        originalHeightMm: piece.originalHeightMm,
        panelIndex: piece.panelIndex,
        panelCount: piece.panelCount,
        panelAxis: piece.panelAxis,
        sourcePieceId: piece.sourcePieceId,
      });
    }

    const contentHeightMm = rows.reduce((acc, row) => acc + row.heightMm, 0);
    const verticalGapsMm =
      rows.length > 1 ? (rows.length - 1) * input.separacionVerticalMm : 0;
    const consumedLengthMm =
      input.marginStartMm + input.marginEndMm + contentHeightMm + verticalGapsMm;
    const { rows: rowCount, piecesPerRow } = this.countGranFormatoRowsAndPiecesPerRow(
      placements,
      Math.max(1, input.separacionVerticalMm / 2),
    );

    return {
      orientacion: this.buildGranFormatoNestingOrientacion(placements),
      piecesPerRow,
      rows: rowCount,
      consumedLengthMm,
      placements,
    };
  }

  private buildGranFormatoHybridPhysicalRuns(input: {
    groups: GranFormatoHybridGroupCandidate[];
    config: Parameters<ProductosServiciosService['evaluateGranFormatoImposicionCandidates']>[0]['config'];
  }) {
    const groupedByVariant = new Map<string, GranFormatoHybridGroupCandidate[]>();
    for (const group of input.groups) {
      const current = groupedByVariant.get(group.variant.id) ?? [];
      current.push(group);
      groupedByVariant.set(group.variant.id, current);
    }

    const runs: GranFormatoHybridPhysicalRun[] = [];
    for (const [variantId, groups] of groupedByVariant.entries()) {
      const baseCandidate = groups[0]?.candidate;
      if (!baseCandidate) {
        continue;
      }

      const preparedPieces = groups.flatMap((group) =>
        this.buildGranFormatoPreparedPiecesFromCandidatePlacements(group.candidate),
      );
      const layout = this.evaluateGranFormatoPreparedShelfLayout({
        printableWidthMm: baseCandidate.printableWidthMm,
        marginLeftMm: baseCandidate.marginLeftMm,
        marginStartMm: baseCandidate.marginStartMm,
        marginEndMm: baseCandidate.marginEndMm,
        separacionHorizontalMm: input.config.separacionHorizontalMm,
        separacionVerticalMm: input.config.separacionVerticalMm,
        pieces: preparedPieces,
      });
      if (!layout) {
        groups.forEach((group) => {
          runs.push({
            corridaId: `corrida-${group.groupKey}`,
            variant: group.variant,
            groups: [group],
            candidate: group.candidate,
            piecesCount: group.pieces.length,
          });
        });
        continue;
      }

      const usefulAreaM2 = this.roundProductNumber(
        groups.reduce((acc, group) => acc + group.candidate.usefulAreaM2, 0),
      );
      const consumedAreaM2 = this.roundProductNumber(
        (baseCandidate.rollWidthMm * layout.consumedLengthMm) / 1_000_000,
      );
      const wasteAreaM2 = this.roundProductNumber(
        Math.max(0, consumedAreaM2 - usefulAreaM2),
      );
      const piecesCount = groups.reduce((acc, group) => acc + group.pieces.length, 0);
      runs.push({
        corridaId: `corrida-${variantId}`,
        variant: baseCandidate.variant,
        groups,
        piecesCount,
        candidate: {
          ...baseCandidate,
          orientacion: layout.orientacion,
          panelizado: groups.some((group) => group.panelizado),
          panelAxis: null,
          panelCount: Math.max(
            ...groups.map((group) => group.candidate.panelCount ?? 1),
            1,
          ),
          panelOverlapMm: null,
          panelMaxWidthMm: null,
          panelDistribution: null,
          panelWidthInterpretation: null,
          panelMode: null,
          piecesPerRow: layout.piecesPerRow,
          rows: layout.rows,
          consumedLengthMm: layout.consumedLengthMm,
          usefulAreaM2,
          consumedAreaM2,
          wasteAreaM2,
          wastePct:
            consumedAreaM2 > 0
              ? this.roundProductNumber((wasteAreaM2 / consumedAreaM2) * 100)
              : 0,
          placements: layout.placements,
          substrateCost: 0,
          inkCost: 0,
          timeCost: 0,
          totalCost: 0,
        },
      });
    }

    return runs;
  }

  private getGranFormatoCandidateAveragePanelUsefulSpanMm(
    candidate: GranFormatoCostosPreviewCandidate,
  ) {
    if (!candidate.panelizado || !candidate.panelAxis || candidate.placements.length === 0) {
      return 0;
    }
    const total = candidate.placements.reduce(
      (acc, placement) =>
        acc +
        (candidate.panelAxis === 'vertical'
          ? placement.usefulWidthMm
          : placement.usefulHeightMm),
      0,
    );
    return total / candidate.placements.length;
  }

  private compareGranFormatoPreviewCandidates(
    left: GranFormatoCostosPreviewCandidate,
    right: GranFormatoCostosPreviewCandidate,
    criterio: GranFormatoImposicionCriterioOptimizacionDto,
  ) {
    if (left.panelizado && right.panelizado) {
      if (left.panelCount !== right.panelCount) {
        return left.panelCount - right.panelCount;
      }
      const leftAveragePanelMm = this.getGranFormatoCandidateAveragePanelUsefulSpanMm(left);
      const rightAveragePanelMm = this.getGranFormatoCandidateAveragePanelUsefulSpanMm(right);
      if (leftAveragePanelMm !== rightAveragePanelMm) {
        return rightAveragePanelMm - leftAveragePanelMm;
      }
    }
    if (criterio === GranFormatoImposicionCriterioOptimizacionDto.menor_costo_total) {
      return left.consumedAreaM2 - right.consumedAreaM2 || left.wasteAreaM2 - right.wasteAreaM2;
    }
    if (criterio === GranFormatoImposicionCriterioOptimizacionDto.menor_largo_consumido) {
      return left.consumedLengthMm - right.consumedLengthMm || left.wasteAreaM2 - right.wasteAreaM2;
    }
    return left.wasteAreaM2 - right.wasteAreaM2 || left.consumedLengthMm - right.consumedLengthMm;
  }

  private getGranFormatoCandidateResumenAveragePanelUsefulSpanMm(candidate: {
    panelizado: boolean;
    panelAxis: 'vertical' | 'horizontal' | null;
    placements: Array<{
      usefulWidthMm: number;
      usefulHeightMm: number;
    }>;
  }) {
    if (!candidate.panelizado || !candidate.panelAxis || candidate.placements.length === 0) {
      return 0;
    }
    const total = candidate.placements.reduce(
      (acc, placement) =>
        acc +
        (candidate.panelAxis === 'vertical'
          ? placement.usefulWidthMm
          : placement.usefulHeightMm),
      0,
    );
    return total / candidate.placements.length;
  }

  private buildGranFormatoCostosCandidateResumen(candidate: GranFormatoCostosPreviewCandidate) {
    return {
      variantId: candidate.variant.id,
      rollWidthMm: candidate.rollWidthMm,
      printableWidthMm: candidate.printableWidthMm,
      marginLeftMm: candidate.marginLeftMm,
      marginRightMm: candidate.marginRightMm,
      marginStartMm: candidate.marginStartMm,
      marginEndMm: candidate.marginEndMm,
      orientacion: candidate.orientacion,
      panelizado: candidate.panelizado,
      panelAxis: candidate.panelAxis,
      panelCount: candidate.panelCount,
      panelOverlapMm: candidate.panelOverlapMm,
      panelMaxWidthMm: candidate.panelMaxWidthMm,
      panelDistribution: candidate.panelDistribution,
      panelWidthInterpretation: candidate.panelWidthInterpretation,
      panelMode: candidate.panelMode,
      piecesPerRow: candidate.piecesPerRow,
      rows: candidate.rows,
      consumedLengthMm: candidate.consumedLengthMm,
      usefulAreaM2: this.roundProductNumber(candidate.usefulAreaM2),
      consumedAreaM2: this.roundProductNumber(candidate.consumedAreaM2),
      wasteAreaM2: this.roundProductNumber(candidate.wasteAreaM2),
      wastePct: this.roundProductNumber(candidate.wastePct),
      substrateCost: this.roundProductNumber(candidate.substrateCost),
      inkCost: this.roundProductNumber(candidate.inkCost),
      timeCost: this.roundProductNumber(candidate.timeCost),
      totalCost: this.roundProductNumber(candidate.totalCost),
      placements: this.buildGranFormatoNestingPreview(candidate).pieces.map((item, index) => ({
        id: candidate.placements[index]?.id ?? item.id,
        widthMm: candidate.placements[index]?.widthMm ?? Math.round((item.w ?? 0) * 10),
        heightMm: candidate.placements[index]?.heightMm ?? Math.round((item.h ?? 0) * 10),
        usefulWidthMm: candidate.placements[index]?.usefulWidthMm ?? Math.round((item.usefulW ?? 0) * 10),
        usefulHeightMm: candidate.placements[index]?.usefulHeightMm ?? Math.round((item.usefulH ?? 0) * 10),
        overlapStartMm: candidate.placements[index]?.overlapStartMm ?? Math.round((item.overlapStart ?? 0) * 10),
        overlapEndMm: candidate.placements[index]?.overlapEndMm ?? Math.round((item.overlapEnd ?? 0) * 10),
        centerXMm: candidate.placements[index]?.centerXMm ?? 0,
        centerYMm: candidate.placements[index]?.centerYMm ?? 0,
        label: candidate.placements[index]?.label ?? item.label,
        rotated: candidate.placements[index]?.rotated ?? Boolean(item.rotated),
        originalWidthMm: candidate.placements[index]?.originalWidthMm ?? Math.round((item.usefulW ?? item.w ?? 0) * 10),
        originalHeightMm: candidate.placements[index]?.originalHeightMm ?? Math.round((item.usefulH ?? item.h ?? 0) * 10),
        panelIndex: candidate.placements[index]?.panelIndex ?? item.panelIndex ?? null,
        panelCount: candidate.placements[index]?.panelCount ?? item.panelCount ?? null,
        panelAxis: candidate.placements[index]?.panelAxis ?? item.panelAxis ?? null,
        sourcePieceId: candidate.placements[index]?.sourcePieceId ?? item.sourcePieceId ?? null,
      })),
    };
  }

  private normalizeVinylCutMeasures(raw: unknown, cantidadTrabajos: number) {
    const measuresRaw = Array.isArray(raw) ? raw : [];
    const normalized = measuresRaw
      .map((item) => {
        const record = this.asObject(item);
        const anchoMm = this.getGranFormatoNullableNumber(record.anchoMm);
        const altoMm = this.getGranFormatoNullableNumber(record.altoMm);
        const cantidad = Math.max(1, Math.floor(Number(record.cantidad ?? 1)));
        const rotacionPermitida =
          typeof record.rotacionPermitida === 'boolean' ? record.rotacionPermitida : true;
        if (!anchoMm || !altoMm || anchoMm <= 0 || altoMm <= 0) {
          return null;
        }
        return {
          anchoMm,
          altoMm,
          cantidad: cantidad * Math.max(1, cantidadTrabajos),
          rotacionPermitida,
        };
      })
      .filter((item): item is { anchoMm: number; altoMm: number; cantidad: number; rotacionPermitida: boolean } => Boolean(item));

    return normalized.length
      ? normalized
      : [{ anchoMm: 1000, altoMm: 300, cantidad: Math.max(1, cantidadTrabajos), rotacionPermitida: true }];
  }

  private buildVinylCutMaterialsCompatibilitySet(maquina: {
    parametrosTecnicosJson?: Prisma.JsonValue | null;
  }) {
    const raw = this.asObject(maquina.parametrosTecnicosJson).materialesCompatibles;
    if (!Array.isArray(raw)) {
      return new Set<string>();
    }
    return new Set(raw.map((item) => String(item ?? '').trim().toLowerCase()).filter(Boolean));
  }

  private async buildVinylCutSimulation(
    auth: CurrentAuth,
    variante: any,
    effectiveConfig: Record<string, unknown>,
    periodo: string,
    cantidadTrabajos: number,
  ) {
    const procesoDefinicionId = this.resolveRutaEfectivaId(variante);
    if (!procesoDefinicionId) {
      throw new BadRequestException('No hay ruta de producción efectiva para la variante seleccionada.');
    }

    const medidas = this.normalizeVinylCutMeasures(effectiveConfig.medidas, cantidadTrabajos);
    const plotterIds = this.getGranFormatoStringArray(effectiveConfig.plottersCompatibles);
    const perfilIds = new Set(this.getGranFormatoStringArray(effectiveConfig.perfilesCompatibles));
    const materialIds = new Set(this.getGranFormatoStringArray(effectiveConfig.materialesCompatibles));
    const materialBaseId = this.getGranFormatoNullableString(effectiveConfig.materialBaseId);
    const materialOverrideId = this.getGranFormatoNullableString(effectiveConfig.materialOverrideId);
    const maquinaOverrideId = this.getGranFormatoNullableString(effectiveConfig.maquinaDefaultId);
    const perfilOverrideId = this.getGranFormatoNullableString(effectiveConfig.perfilDefaultId);
    const permitirRotacion = effectiveConfig.permitirRotacion !== false;
    const separacionHorizontalMm = Math.max(0, Number(effectiveConfig.separacionHorizontalMm ?? 10));
    const separacionVerticalMm = Math.max(0, Number(effectiveConfig.separacionVerticalMm ?? 10));
    const criterio =
      this.getGranFormatoNullableString(effectiveConfig.criterioSeleccionMaterial) ===
      GranFormatoImposicionCriterioOptimizacionDto.menor_largo_consumido
        ? GranFormatoImposicionCriterioOptimizacionDto.menor_largo_consumido
        : this.getGranFormatoNullableString(effectiveConfig.criterioSeleccionMaterial) ===
            GranFormatoImposicionCriterioOptimizacionDto.menor_desperdicio
          ? GranFormatoImposicionCriterioOptimizacionDto.menor_desperdicio
          : GranFormatoImposicionCriterioOptimizacionDto.menor_costo_total;

    const machines = await this.prisma.maquina.findMany({
      where: {
        tenantId: auth.tenantId,
        activo: true,
        plantilla: PlantillaMaquinaria.PLOTTER_DE_CORTE,
        ...(plotterIds.length ? { id: { in: plotterIds } } : {}),
      },
      include: {
        perfilesOperativos: {
          where: { activo: true },
          orderBy: [{ nombre: 'asc' }],
        },
      },
      orderBy: [{ nombre: 'asc' }],
    });
    if (!machines.length) {
      return {
        config: effectiveConfig,
        items: [] as Array<Record<string, unknown>>,
        rejected: [] as Array<Record<string, unknown>>,
        warnings: ['No hay plotters de corte compatibles configurados.'],
      };
    }

    const materials = await this.prisma.materiaPrima.findMany({
      where: {
        tenantId: auth.tenantId,
        activo: true,
        subfamilia: SubfamiliaMateriaPrima.SUSTRATO_ROLLO_FLEXIBLE,
        ...(materialBaseId ? { id: materialBaseId } : {}),
        ...(materialIds.size ? { id: { in: Array.from(materialIds) } } : {}),
      },
      include: {
        variantes: {
          where: {
            activo: true,
            ...(materialOverrideId ? { id: materialOverrideId } : {}),
          },
          include: {
            materiaPrima: true,
          },
        },
      },
      orderBy: [{ nombre: 'asc' }],
    });
    const materialVariants = materials.flatMap((item) =>
      item.variantes.map((variant) => ({
        ...variant,
        materiaPrima: item,
      })),
    );
    if (!materialVariants.length) {
      return {
        config: effectiveConfig,
        items: [] as Array<Record<string, unknown>>,
        rejected: [] as Array<Record<string, unknown>>,
        warnings: ['No hay variantes activas de vinilo compatibles configuradas.'],
      };
    }

    const proceso = await this.findProcesoConOperacionesOrThrow(auth, procesoDefinicionId, this.prisma);
    const tarifas = await this.prisma.centroCostoTarifaPeriodo.findMany({
      where: {
        tenantId: auth.tenantId,
        periodo,
        estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
      },
      select: {
        centroCostoId: true,
        tarifaCalculada: true,
      },
    });
    const tarifaByCentro = new Map(tarifas.map((item) => [item.centroCostoId, item.tarifaCalculada]));

    const totalPiezas = medidas.reduce((acc, item) => acc + item.cantidad, 0);
    const perimetroTotalMl = this.roundProductNumber(
      medidas.reduce((acc, item) => acc + (((item.anchoMm + item.altoMm) * 2) / 1000) * item.cantidad, 0) /
        1000,
    );

    const resultItems: Array<Record<string, unknown>> = [];
    const rejected: Array<Record<string, unknown>> = [];

    for (const machine of machines) {
      if (maquinaOverrideId && machine.id !== maquinaOverrideId) {
        continue;
      }
      const machineMaterials = this.buildVinylCutMaterialsCompatibilitySet(machine);
      if (machineMaterials.size > 0 && !machineMaterials.has('vinilo')) {
        rejected.push({
          maquinaId: machine.id,
          maquinaNombre: machine.nombre,
          reason: 'La máquina no admite vinilo en sus materiales compatibles.',
        });
        continue;
      }
      const compatibleProfiles = machine.perfilesOperativos.filter((profile) => {
        if (perfilOverrideId && profile.id !== perfilOverrideId) return false;
        if (perfilIds.size > 0 && !perfilIds.has(profile.id)) return false;
        return true;
      });
      const profilesToEvaluate = compatibleProfiles.length ? compatibleProfiles : [null];

      const candidates = this.evaluateGranFormatoImposicionCandidates({
        maquina: machine,
        medidas,
        config: {
          permitirRotacion,
          separacionHorizontalMm,
          separacionVerticalMm,
          margenLateralIzquierdoMmOverride: null,
          margenLateralDerechoMmOverride: null,
          margenInicioMmOverride: null,
          margenFinalMmOverride: null,
          criterioOptimizacion: criterio,
          panelizadoActivo: false,
          panelizadoDireccion: GranFormatoPanelizadoDireccionDto.automatica,
          panelizadoSolapeMm: null,
          panelizadoAnchoMaxPanelMm: null,
          panelizadoDistribucion: GranFormatoPanelizadoDistribucionDto.equilibrada,
          panelizadoInterpretacionAnchoMaximo: GranFormatoPanelizadoInterpretacionAnchoMaximoDto.total,
          panelizadoModo: GranFormatoPanelizadoModoDto.automatico,
          panelizadoManualLayout: null,
        },
        variants: materialVariants,
      });

      for (const profile of profilesToEvaluate) {
        for (const candidate of candidates) {
          const warnings: string[] = [];
          const largoConsumidoMl = this.roundProductNumber(candidate.consumedLengthMm / 1000);
          const substrateTotalCost = this.calculateGranFormatoSustratoCost({
            variant: candidate.variant,
            consumedAreaM2: candidate.consumedAreaM2,
            consumedLengthMl: largoConsumidoMl,
            warnings,
          });
          const usefulFactor =
            candidate.consumedAreaM2 > 0 ? candidate.usefulAreaM2 / candidate.consumedAreaM2 : 0;
          const usefulCost = this.roundProductNumber(substrateTotalCost * usefulFactor);
          const wasteCost = this.roundProductNumber(substrateTotalCost - usefulCost);
          const usefulLengthMl =
            candidate.rollWidthMm > 0
              ? this.roundProductNumber(candidate.usefulAreaM2 / (candidate.rollWidthMm / 1000))
              : 0;
          const wasteLengthMl = this.roundProductNumber(Math.max(0, largoConsumidoMl - usefulLengthMl));

          const centrosCosto = proceso.operaciones.map((op, index) => {
            const cantidadObjetivoSalida = this.resolveGranFormatoCantidadObjetivoSalida({
              operacion: op,
              totalPiezas,
              areaUtilM2: candidate.usefulAreaM2,
              largoConsumidoMl,
              perimetroTotalMl,
            });
            const productividad = evaluateProductividad({
              modoProductividad: op.modoProductividad ?? ModoProductividadProceso.FIJA,
              productividadBase: op.productividadBase,
              reglaVelocidadJson: op.reglaVelocidadJson ?? null,
              reglaMermaJson: op.reglaMermaJson ?? null,
              runMin: op.runMin,
              unidadTiempo: op.unidadTiempo,
              mermaRunPct: op.mermaRunPct,
              mermaSetup: op.mermaSetup,
              cantidadObjetivoSalida,
              contexto: {
                cantidad: totalPiezas,
                areaTotalM2: candidate.usefulAreaM2,
                largoTotalMl: largoConsumidoMl,
                perimetroTotalMl,
              },
            });
            warnings.push(...productividad.warnings.map((item) => `Paso ${op.nombre}: ${item}`));
            const minutos = this.roundProductNumber(
              Number(op.setupMin ?? 0) +
                Number(op.cleanupMin ?? 0) +
                Number(op.tiempoFijoMin ?? 0) +
                productividad.runMin,
            );
            const tarifa = op.centroCostoId ? tarifaByCentro.get(op.centroCostoId) ?? null : null;
            const costo = tarifa ? this.roundProductNumber(Number(tarifa.mul(minutos / 60))) : 0;
            return {
              orden: index + 1,
              codigo: op.codigo,
              paso: op.nombre,
              centroCostoId: op.centroCostoId ?? '',
              centroCostoNombre: op.centroCosto?.nombre ?? '',
              origen: 'Producto base',
              minutos,
              tarifaHora: tarifa ? Number(tarifa) : 0,
              costo,
              detalleTecnico: {
                maquina: machine.nombre,
                perfilOperativo: profile?.nombre ?? null,
                cantidadObjetivoSalida,
              },
            };
          });

          const totalCentrosCosto = this.roundProductNumber(
            centrosCosto.reduce((acc, item) => acc + Number(item.costo ?? 0), 0),
          );
          const totalMateriales = this.roundProductNumber(usefulCost + wasteCost);
          const totalTecnico = this.roundProductNumber(totalMateriales + totalCentrosCosto);
          const candidateWithCosts: GranFormatoCostosPreviewCandidate = {
            ...candidate,
            substrateCost: substrateTotalCost,
            inkCost: 0,
            timeCost: totalCentrosCosto,
            totalCost: totalTecnico,
          };

          resultItems.push({
            maquinaId: machine.id,
            maquinaNombre: machine.nombre,
            perfilId: profile?.id ?? null,
            perfilNombre: profile?.nombre ?? '',
            warnings: Array.from(new Set(warnings)),
            resumenTecnico: {
              ...this.buildGranFormatoCostosCandidateResumen(candidateWithCosts),
              cantidadTrabajos,
              totalPiezas,
              unidadComercial: 'metro_lineal',
              largoConsumidoMl,
            },
            materiasPrimas: [
              {
                tipo: 'VINILO',
                nombre: candidate.variant.materiaPrima.nombre,
                sku: candidate.variant.sku,
                variantChips: this.buildMateriaPrimaVariantDisplayChips(candidate.variant),
                cantidad: usefulLengthMl,
                costoUnitario: usefulLengthMl > 0 ? this.roundProductNumber(usefulCost / usefulLengthMl) : 0,
                costo: usefulCost,
                origen: 'Base',
                unidad: 'metro_lineal',
              },
              {
                tipo: 'VINILO',
                nombre: `${candidate.variant.materiaPrima.nombre} · Desperdicio`,
                sku: candidate.variant.sku,
                variantChips: this.buildMateriaPrimaVariantDisplayChips(candidate.variant),
                cantidad: wasteLengthMl,
                costoUnitario: wasteLengthMl > 0 ? this.roundProductNumber(wasteCost / wasteLengthMl) : 0,
                costo: wasteCost,
                origen: 'Desperdicio',
                unidad: 'metro_lineal',
              },
            ],
            centrosCosto,
            totales: {
              materiales: totalMateriales,
              centrosCosto: totalCentrosCosto,
              tecnico: totalTecnico,
            },
            nestingPreview: this.buildGranFormatoNestingPreview(candidateWithCosts),
          });
        }
      }
    }

    resultItems.sort((left, right) => {
      const leftCandidate = {
        totalCost: Number(this.asObject(left.totales).tecnico ?? 0),
        consumedLengthMm: Number(this.asObject(left.resumenTecnico).consumedLengthMm ?? this.asObject(left.resumenTecnico).largoConsumidoMm ?? 0),
        wasteAreaM2: Number(this.asObject(left.resumenTecnico).wasteAreaM2 ?? this.asObject(left.resumenTecnico).areaDesperdicioM2 ?? 0),
      };
      const rightCandidate = {
        totalCost: Number(this.asObject(right.totales).tecnico ?? 0),
        consumedLengthMm: Number(this.asObject(right.resumenTecnico).consumedLengthMm ?? this.asObject(right.resumenTecnico).largoConsumidoMm ?? 0),
        wasteAreaM2: Number(this.asObject(right.resumenTecnico).wasteAreaM2 ?? this.asObject(right.resumenTecnico).areaDesperdicioM2 ?? 0),
      };
      if (criterio === GranFormatoImposicionCriterioOptimizacionDto.menor_largo_consumido) {
        return leftCandidate.consumedLengthMm - rightCandidate.consumedLengthMm;
      }
      if (criterio === GranFormatoImposicionCriterioOptimizacionDto.menor_desperdicio) {
        return leftCandidate.wasteAreaM2 - rightCandidate.wasteAreaM2;
      }
      return (
        leftCandidate.totalCost - rightCandidate.totalCost ||
        leftCandidate.consumedLengthMm - rightCandidate.consumedLengthMm ||
        leftCandidate.wasteAreaM2 - rightCandidate.wasteAreaM2
      );
    });

    return {
      config: effectiveConfig,
      periodo,
      items: resultItems,
      rejected,
      warnings: resultItems[0] ? (resultItems[0].warnings as string[]) : [],
    };
  }

  private resolveGranFormatoCantidadObjetivoSalida(input: {
    operacion: {
      unidadEntrada?: UnidadProceso | null;
      unidadSalida?: UnidadProceso | null;
      detalleJson?: Prisma.JsonValue | null;
    };
    totalPiezas: number;
    areaUtilM2: number;
    largoConsumidoMl: number;
    perimetroTotalMl: number;
  }) {
    const detalle = this.asObject(input.operacion.detalleJson);
    const baseCalculo =
      typeof detalle.baseCalculoProductividad === 'string'
        ? detalle.baseCalculoProductividad.trim().toLowerCase()
        : '';
    if (baseCalculo === 'perimetro_total_ml') {
      return input.perimetroTotalMl;
    }
    if (baseCalculo === 'area_total_m2') {
      return input.areaUtilM2;
    }
    if (baseCalculo === 'metro_lineal_total') {
      return input.largoConsumidoMl;
    }

    const unidad = input.operacion.unidadSalida ?? input.operacion.unidadEntrada ?? null;
    if (unidad === UnidadProceso.M2) {
      return input.areaUtilM2;
    }
    if (unidad === UnidadProceso.METRO_LINEAL) {
      return input.largoConsumidoMl;
    }
    if (unidad === UnidadProceso.PIEZA || unidad === UnidadProceso.UNIDAD) {
      return input.totalPiezas;
    }
    return input.totalPiezas;
  }

  private calculateGranFormatoSustratoCost(input: {
    variant: {
      precioReferencia: Prisma.Decimal | null;
      sku: string;
      atributosVarianteJson?: Prisma.JsonValue | null;
      unidadStock?: string | null;
      unidadCompra?: string | null;
      materiaPrima: {
        nombre: string;
        subfamilia?: string | null;
        templateId?: string | null;
        unidadStock?: string | null;
        unidadCompra?: string | null;
      };
    };
    consumedAreaM2: number;
    consumedLengthMl: number;
    warnings: string[];
  }) {
    const sourceUnit =
      this.toCanonicalUnitCode(input.variant.unidadCompra) ??
      this.toCanonicalUnitCode(input.variant.unidadStock) ??
      this.toCanonicalUnitCode(input.variant.materiaPrima.unidadCompra) ??
      this.toCanonicalUnitCode(input.variant.materiaPrima.unidadStock);

    if (sourceUnit) {
      const targetUnit =
        sourceUnit === 'metro_lineal'
          ? 'metro_lineal'
          : sourceUnit === 'm2'
            ? 'm2'
            : 'm2';
      const costoUnitario = this.resolveMateriaPrimaVariantUnitCost({
        materiaPrimaVariante: input.variant,
        targetUnit,
        warnings: input.warnings,
        contextLabel: 'Sustrato',
      });

      if (targetUnit === 'metro_lineal') {
        return this.roundProductNumber(costoUnitario * input.consumedLengthMl);
      }
      return this.roundProductNumber(costoUnitario * input.consumedAreaM2);
    }

    const fallback = this.resolveMateriaPrimaVariantUnitCost({
      materiaPrimaVariante: input.variant,
      warnings: input.warnings,
      contextLabel: 'Sustrato',
    });
    input.warnings.push(
      `Sustrato ${input.variant.materiaPrima.nombre} (${input.variant.sku}): no se pudo resolver unidad de costo; se usó el precio sin convertir como referencia por m2.`,
    );
    return this.roundProductNumber(fallback * input.consumedAreaM2);
  }

  private async calculateGranFormatoInkConsumables(input: {
    auth: CurrentAuth;
    maquinaId: string;
    perfilId: string | null;
    areaUtilM2: number;
    warnings: string[];
  }) {
    const consumibles = await this.prisma.maquinaConsumible.findMany({
      where: {
        tenantId: input.auth.tenantId,
        activo: true,
        tipo: TipoConsumibleMaquina.TINTA,
        maquinaId: input.maquinaId,
      },
      include: {
        perfilOperativo: true,
        materiaPrimaVariante: {
          include: {
            materiaPrima: true,
          },
        },
      },
    });
    const consumiblesPerfil = input.perfilId
      ? consumibles.filter((item) => item.perfilOperativoId === input.perfilId)
      : consumibles;
    if (!consumiblesPerfil.length) {
      input.warnings.push('El perfil operativo seleccionado no tiene consumibles de tinta configurados.');
      return { materiales: [] as Array<Record<string, unknown>>, costo: 0 };
    }

    const materiales: Array<Record<string, unknown>> = [];
    let costo = 0;
    for (const item of consumiblesPerfil) {
      const consumoBase = Number(item.consumoBase ?? 0);
      if (consumoBase <= 0) {
        input.warnings.push(
          `Consumible de tinta ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) sin consumoBase válido.`,
        );
        continue;
      }
      if (item.unidad !== UnidadConsumoMaquina.ML && item.unidad !== UnidadConsumoMaquina.LITRO) {
        input.warnings.push(
          `Consumible de tinta ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) con unidad no soportada en v1.`,
        );
        continue;
      }
      const cantidadBase = this.roundProductNumber(consumoBase * input.areaUtilM2);
      const targetUnit = item.unidad === UnidadConsumoMaquina.LITRO ? 'l' : 'ml';
      const costoUnitario = this.resolveMateriaPrimaVariantUnitCost({
        materiaPrimaVariante: item.materiaPrimaVariante,
        targetUnit,
        warnings: input.warnings,
        contextLabel: 'Tinta',
      });
      const costoItem = this.roundProductNumber(cantidadBase * costoUnitario);
      costo += costoItem;
      materiales.push({
        tipo: 'TINTA',
        nombre: item.materiaPrimaVariante.materiaPrima.nombre,
        sku: item.materiaPrimaVariante.sku,
        variantChips: this.buildMateriaPrimaVariantDisplayChips(item.materiaPrimaVariante),
        cantidad: cantidadBase,
        costoUnitario,
        costo: costoItem,
        origen: 'Base',
        unidad: item.unidad === UnidadConsumoMaquina.LITRO ? 'l' : 'ml',
      });
    }
    return { materiales, costo: this.roundProductNumber(costo) };
  }

  private evaluateGranFormatoImposicionCandidates(input: {
    maquina: {
      anchoUtil: Prisma.Decimal | null;
      parametrosTecnicosJson?: Prisma.JsonValue | null;
      plantilla: PlantillaMaquinaria;
      capacidadesAvanzadasJson?: Prisma.JsonValue | null;
    } | null;
    medidas: Array<{
      anchoMm: number;
      altoMm: number;
      cantidad: number;
    }>;
    config: {
      permitirRotacion: boolean;
      separacionHorizontalMm: number;
      separacionVerticalMm: number;
      margenLateralIzquierdoMmOverride: number | null;
      margenLateralDerechoMmOverride: number | null;
      margenInicioMmOverride: number | null;
      margenFinalMmOverride: number | null;
      criterioOptimizacion: GranFormatoImposicionCriterioOptimizacionDto;
      panelizadoActivo: boolean;
      panelizadoDireccion: GranFormatoPanelizadoDireccionDto;
      panelizadoSolapeMm: number | null;
      panelizadoAnchoMaxPanelMm: number | null;
      panelizadoDistribucion: GranFormatoPanelizadoDistribucionDto;
      panelizadoInterpretacionAnchoMaximo: GranFormatoPanelizadoInterpretacionAnchoMaximoDto;
      panelizadoModo: GranFormatoPanelizadoModoDto;
      panelizadoManualLayout: Record<string, unknown> | null;
    };
    variants: Array<any>;
  }) {
    if (!input.maquina) {
      return [] as GranFormatoCostosPreviewCandidate[];
    }
    const printableWidthMmMax = this.readMachinePrintableWidthMmFromRecord(input.maquina);
    if (!printableWidthMmMax || printableWidthMmMax <= 0) {
      return [] as GranFormatoCostosPreviewCandidate[];
    }
    const marginLeftMm =
      input.config.margenLateralIzquierdoMmOverride ??
      this.readMachineMarginMmFromRecord(input.maquina, 'margenLateralIzquierdoNoImprimible') ??
      this.readMachineMarginMmFromRecord(input.maquina, 'margenIzquierdo') ??
      0;
    const marginRightMm =
      input.config.margenLateralDerechoMmOverride ??
      this.readMachineMarginMmFromRecord(input.maquina, 'margenLateralDerechoNoImprimible') ??
      this.readMachineMarginMmFromRecord(input.maquina, 'margenDerecho') ??
      0;
    const marginStartMm =
      input.config.margenInicioMmOverride ??
      this.readMachineMarginMmFromRecord(input.maquina, 'margenInicioNoImprimible') ??
      this.readMachineMarginMmFromRecord(input.maquina, 'margenSuperior') ??
      0;
    const marginEndMm =
      input.config.margenFinalMmOverride ??
      this.readMachineMarginMmFromRecord(input.maquina, 'margenFinalNoImprimible') ??
      this.readMachineMarginMmFromRecord(input.maquina, 'margenInferior') ??
      0;

    const acceptedNormal: GranFormatoCostosPreviewCandidate[] = [];
    const acceptedPanelizados: GranFormatoCostosPreviewCandidate[] = [];

    for (const variant of input.variants) {
      const rollWidthMm = this.readMaterialVariantWidthMmFromRecord(
        this.asObject(variant.atributosVarianteJson),
      );
      if (!rollWidthMm || rollWidthMm <= 0) {
        continue;
      }
      const machineLimitedWidthMm = Math.min(rollWidthMm, printableWidthMmMax);
      const printableWidthMm = machineLimitedWidthMm - marginLeftMm - marginRightMm;
      if (printableWidthMm <= 0) {
        continue;
      }
      const baseInput = {
        printableWidthMm,
        marginLeftMm,
        marginStartMm,
        marginEndMm,
        separacionHorizontalMm: input.config.separacionHorizontalMm,
        separacionVerticalMm: input.config.separacionVerticalMm,
        permitirRotacion: input.config.permitirRotacion,
        medidas: input.medidas,
      };
      const layout = this.evaluateGranFormatoMixedShelfLayout(baseInput);
      if (!layout) {
        if (input.config.panelizadoActivo) {
          const overlapMm = Math.max(0, input.config.panelizadoSolapeMm ?? 0);
          const maxPanelWidthMm = Math.max(0, input.config.panelizadoAnchoMaxPanelMm ?? 0);
          const directions =
            input.config.panelizadoModo === GranFormatoPanelizadoModoDto.manual
              ? (['vertical'] as const)
              : input.config.panelizadoDireccion === GranFormatoPanelizadoDireccionDto.automatica
                ? (['vertical', 'horizontal'] as const)
                : [input.config.panelizadoDireccion];
          for (const axis of directions) {
            if (maxPanelWidthMm <= 0) {
              continue;
            }
            const panelizedLayout = this.evaluateGranFormatoMixedShelfLayout({
              ...baseInput,
              panelizado: {
                activo: true,
                mode: input.config.panelizadoModo,
                axis,
                overlapMm,
                maxPanelWidthMm,
                distribution: input.config.panelizadoDistribucion,
                widthInterpretation: input.config.panelizadoInterpretacionAnchoMaximo,
                manualLayout: input.config.panelizadoManualLayout,
              },
            });
            if (!panelizedLayout) {
              continue;
            }
            const consumedAreaM2 = (rollWidthMm * panelizedLayout.consumedLengthMm) / 1_000_000;
            const wasteAreaM2 = Math.max(0, consumedAreaM2 - panelizedLayout.usefulAreaM2);
            acceptedPanelizados.push({
              variant,
              rollWidthMm,
              printableWidthMm,
              marginLeftMm,
              marginRightMm,
              marginStartMm,
              marginEndMm,
              orientacion: panelizedLayout.orientacion,
              panelizado: true,
              panelAxis: panelizedLayout.panelAxis,
              panelCount: panelizedLayout.panelCount,
              panelOverlapMm: panelizedLayout.panelOverlapMm,
              panelMaxWidthMm: panelizedLayout.panelMaxWidthMm,
              panelDistribution: panelizedLayout.panelDistribution,
              panelWidthInterpretation: panelizedLayout.panelWidthInterpretation,
              panelMode: panelizedLayout.panelMode,
              piecesPerRow: panelizedLayout.piecesPerRow,
              rows: panelizedLayout.rows,
              consumedLengthMm: panelizedLayout.consumedLengthMm,
              usefulAreaM2: panelizedLayout.usefulAreaM2,
              consumedAreaM2,
              wasteAreaM2,
              wastePct: consumedAreaM2 > 0 ? (wasteAreaM2 / consumedAreaM2) * 100 : 0,
              placements: panelizedLayout.placements,
              substrateCost: 0,
              inkCost: 0,
              timeCost: 0,
              totalCost: 0,
            });
          }
        }
        continue;
      }
      const consumedAreaM2 = (rollWidthMm * layout.consumedLengthMm) / 1_000_000;
      const wasteAreaM2 = Math.max(0, consumedAreaM2 - layout.usefulAreaM2);
      acceptedNormal.push({
        variant,
        rollWidthMm,
        printableWidthMm,
        marginLeftMm,
        marginRightMm,
        marginStartMm,
        marginEndMm,
        orientacion: layout.orientacion,
        panelizado: false,
        panelAxis: null,
        panelCount: 1,
        panelOverlapMm: null,
        panelMaxWidthMm: null,
        panelDistribution: null,
        panelWidthInterpretation: null,
        panelMode: null,
        piecesPerRow: layout.piecesPerRow,
        rows: layout.rows,
        consumedLengthMm: layout.consumedLengthMm,
        usefulAreaM2: layout.usefulAreaM2,
        consumedAreaM2,
        wasteAreaM2,
        wastePct: consumedAreaM2 > 0 ? (wasteAreaM2 / consumedAreaM2) * 100 : 0,
        placements: layout.placements,
        substrateCost: 0,
        inkCost: 0,
        timeCost: 0,
        totalCost: 0,
      });
    }

    const accepted = acceptedNormal.length > 0 ? acceptedNormal : acceptedPanelizados;

    return accepted.sort((a, b) =>
      this.compareGranFormatoPreviewCandidates(a, b, input.config.criterioOptimizacion),
    );
  }

  private readNumericValue(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (value instanceof Prisma.Decimal) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private readMachineMarginMmFromRecord(
    maquina: { parametrosTecnicosJson?: Prisma.JsonValue | null } | null,
    key: string,
  ) {
    const raw = this.asObject(maquina?.parametrosTecnicosJson)[key];
    const cm = this.readNumericValue(raw);
    return cm == null ? null : cm * 10;
  }

  private readMachinePrintableWidthMmFromRecord(
    maquina: {
      parametrosTecnicosJson?: Prisma.JsonValue | null;
      anchoUtil?: Prisma.Decimal | null;
    } | null,
  ) {
    if (!maquina) {
      return null;
    }
    const params = this.asObject(maquina.parametrosTecnicosJson);
    const direct = this.readNumericValue(params.anchoImprimibleMaximo);
    if (direct != null) {
      return direct * 10;
    }
    const anchoBoca = this.readNumericValue(params.anchoBoca);
    if (anchoBoca != null) {
      return anchoBoca * 10;
    }
    const anchoCama = this.readNumericValue(params.anchoCama);
    if (anchoCama != null) {
      return anchoCama * 10;
    }
    const fallback = this.readNumericValue(maquina.anchoUtil ?? null);
    return fallback == null ? null : fallback * 10;
  }

  private readMaterialVariantWidthMmFromRecord(
    attributes: Record<string, unknown> | null | undefined,
  ) {
    const meters = this.readNumericValue(attributes?.ancho);
    return meters == null ? null : meters * 1000;
  }

  private deriveGranFormatoTecnologia(
    plantilla: PlantillaMaquinaria,
    capacidadesAvanzadasJson?: Prisma.JsonValue | null,
  ) {
    const capacidades = this.asObject(capacidadesAvanzadasJson);
    const explicit = this.normalizeGranFormatoTecnologia(
      typeof capacidades.tecnologiaMaquina === 'string' ? capacidades.tecnologiaMaquina : null,
    );
    if (explicit) {
      return explicit;
    }

    switch (plantilla) {
      case PlantillaMaquinaria.IMPRESORA_UV_MESA_EXTENSORA:
      case PlantillaMaquinaria.IMPRESORA_UV_FLATBED:
      case PlantillaMaquinaria.IMPRESORA_UV_ROLLO:
        return 'uv';
      case PlantillaMaquinaria.IMPRESORA_SOLVENTE:
        return 'eco_solvente';
      case PlantillaMaquinaria.IMPRESORA_LATEX:
        return 'latex';
      case PlantillaMaquinaria.IMPRESORA_SUBLIMACION_GRAN_FORMATO:
        return 'sublimacion';
      case PlantillaMaquinaria.IMPRESORA_DTF:
        return 'dtf_textil';
      case PlantillaMaquinaria.IMPRESORA_DTF_UV:
        return 'dtf_uv';
      case PlantillaMaquinaria.IMPRESORA_INYECCION_TINTA:
        return 'inkjet';
      default:
        return 'otro';
    }
  }

  private normalizeGranFormatoTecnologias(values: string[]) {
    const normalizedValues: string[] = [];
    for (const value of values) {
      const normalized = this.normalizeGranFormatoTecnologia(value);
      if (normalized) {
        normalizedValues.push(normalized);
      }
    }
    return Array.from(new Set<string>(normalizedValues));
  }

  private normalizeGranFormatoTecnologia(value: unknown) {
    const normalized =
      typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, '_') : '';
    switch (normalized) {
      case 'solvente':
      case 'eco_solvente':
        return 'eco_solvente';
      case 'uv':
      case 'latex':
      case 'sublimacion':
      case 'dtf_textil':
      case 'dtf_uv':
      case 'inkjet':
        return normalized;
      default:
        return null;
    }
  }

  private deriveGranFormatoConfiguracionTintas(
    detalleJson: Prisma.JsonValue | null | undefined,
    printMode: TipoImpresionProductoVariante | null | undefined,
  ) {
    const detalle = this.asObject(detalleJson);
    const directCandidates = [
      detalle.configuracionTintas,
      detalle.configuracionCanales,
      detalle.tintas,
      detalle.canales,
      detalle.inkConfiguration,
      detalle.inkConfig,
    ];
    for (const candidate of directCandidates) {
      const normalized = this.normalizeGranFormatoTintas(candidate);
      if (normalized) {
        return normalized;
      }
    }
    if (printMode === TipoImpresionProductoVariante.CMYK) {
      return 'CMYK';
    }
    if (printMode === TipoImpresionProductoVariante.BN) {
      return 'K';
    }
    return '';
  }

  private normalizeGranFormatoTintas(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => this.normalizeGranFormatoTintas(item))
        .filter(Boolean)
        .join(' + ');
    }
    if (!value || typeof value !== 'object') {
      return '';
    }
    const object = value as Record<string, unknown>;
    const labelCandidates = [object.label, object.nombre, object.name, object.value];
    for (const candidate of labelCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    const channels = Array.isArray(object.channels) ? object.channels : Array.isArray(object.canales) ? object.canales : [];
    if (channels.length) {
      return channels
        .map((item) => this.normalizeGranFormatoTintas(item))
        .filter(Boolean)
        .join(' + ');
    }
    return '';
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
    return this.roundProductNumber(values.reduce((acc, item) => acc + item, 0));
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
    if (value === TipoChecklistAccionReglaDto.mutar_producto_base) {
      return TipoProductoChecklistReglaAccion.MUTAR_PRODUCTO_BASE;
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
    if (value === TipoProductoChecklistReglaAccion.MUTAR_PRODUCTO_BASE) {
      return TipoChecklistAccionReglaDto.mutar_producto_base;
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
