/**
 * Etapa C.3 — VinylCutMotorModuleV2
 *
 * Motor vinilo_de_corte@2 del modelo universal. Cotiza corte de pre-colored
 * vinyl sobre rollo continuo con plotter de corte.
 *
 * Pipeline: pre_prensa → corte (con nesting sobre rollo) → embalaje.
 * A diferencia de gran_formato, acá no hay paso de impresión — el plotter
 * toma un rollo de vinilo de color y corta contornos directamente.
 *
 * Piloto single-color: soporta un solo color (filtrado opcional sobre
 * atributosVarianteJson.color del material). Multi-color se agrega en C.3.x
 * iterando la cotización por color.
 */
import { BadRequestException } from '@nestjs/common';
import type { CurrentAuth } from '../../auth/auth.types';
import type {
  CotizarProductoVarianteDto,
  PreviewImposicionProductoVarianteDto,
  UpsertProductoMotorConfigDto,
  UpsertVarianteMotorOverrideDto,
} from '../dto/productos-servicios.dto';
import type { ProductosServiciosService } from '../productos-servicios.service';
import type { ProductMotorDefinition, ProductMotorModule } from './product-motor.contract';
import type {
  CotizacionCanonica,
  PasoCotizado,
} from '../dto/cotizacion-canonica.dto';
import {
  nestOnRoll,
  type NestingRolloResult,
  type NestingRolloPanelizadoConfig,
} from '../nesting/nesting-rollo';

type ParametrosVinylCutV2 = {
  anchoMm?: number;
  altoMm?: number;
  medidas?: Array<{ anchoMm: number; altoMm: number; cantidad: number }>;
  /** Filtro por color del vinilo (debe matchear atributosVarianteJson.color). */
  color?: string | null;
};

type VinylCutConfigParametros = {
  materialesCompatibles?: string[];
  plottersCompatibles?: string[];
  perfilesCompatibles?: string[];
  maquinaDefaultId?: string;
  perfilDefaultId?: string;
  separacionHorizontalMm?: number;
  separacionVerticalMm?: number;
  margenLateralMm?: number;
  permitirRotacion?: boolean;
  criterioSeleccionMaterial?: 'menor_costo_total' | 'menor_largo_consumido' | 'mayor_aprovechamiento';
  prePrensaSetupMin?: number;
  prePrensaTarifaHora?: number;
  /** Velocidad del plotter en metros lineales por hora. */
  plotterVelocidadMlh?: number;
  plotterSetupMin?: number;
  plotterTarifaHora?: number;
  embalajePorPiezaMin?: number;
  embalajePrecioBolsa?: number;
  embalajeTarifaHora?: number;
};

const CONFIG_DEFAULTS = {
  separacionHorizontalMm: 10,
  separacionVerticalMm: 10,
  margenLateralMm: 5,
  permitirRotacion: true,
  criterioSeleccionMaterial: 'menor_costo_total' as const,
  prePrensaSetupMin: 10,
  prePrensaTarifaHora: 3500,
  plotterVelocidadMlh: 60,
  plotterSetupMin: 3,
  plotterTarifaHora: 5500,
  embalajePorPiezaMin: 0.5,
  embalajePrecioBolsa: 25,
  embalajeTarifaHora: 2500,
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function costoTiempo(min: number, tarifaHora: number): number {
  return roundMoney((min / 60) * tarifaHora);
}

function rolloAnchoMmDeMaterial(material: { atributosVarianteJson: unknown }): number | null {
  const attrs = material.atributosVarianteJson as Record<string, unknown> | null;
  if (!attrs) return null;
  const anchoM = Number(attrs.ancho);
  if (!Number.isFinite(anchoM) || anchoM <= 0) return null;
  return Math.round(anchoM * 1000);
}

function rolloLargoMDeMaterial(material: { atributosVarianteJson: unknown }): number | null {
  const attrs = material.atributosVarianteJson as Record<string, unknown> | null;
  if (!attrs) return null;
  const largoM = Number(attrs.largo);
  if (!Number.isFinite(largoM) || largoM <= 0) return null;
  return largoM;
}

type MaterialEvaluado = {
  materialId: string;
  sku: string;
  nombre: string;
  color: string | null;
  rolloAnchoMm: number;
  rolloLargoM: number;
  precioRolloTotal: number;
  precioPorM2: number;
  nesting: NestingRolloResult;
  areaConsumidaM2: number;
  aprovechamientoPct: number;
  sustratoCosto: number;
};

export class VinylCutMotorModuleV2 implements ProductMotorModule {
  constructor(private readonly service: ProductosServiciosService) {}

  getDefinition(): ProductMotorDefinition {
    return {
      code: 'vinilo_de_corte',
      version: 2,
      label: 'Vinilo de corte (modelo universal) · v2',
      category: 'vinyl_cut',
      capabilities: {
        hasProductConfig: true,
        hasVariantOverride: false,
        hasPreview: false,
        hasQuote: true,
      },
      schema: {},
      exposedInCatalog: true,
    };
  }

  getProductConfig(auth: CurrentAuth, productoId: string) {
    return this.service.getVinylCutProductMotorConfig(auth, productoId);
  }

  upsertProductConfig(auth: CurrentAuth, productoId: string, payload: UpsertProductoMotorConfigDto) {
    return this.service.upsertVinylCutProductMotorConfig(auth, productoId, payload);
  }

  async getVariantOverride(_auth: CurrentAuth, _varianteId: string) {
    throw new BadRequestException('vinilo_de_corte@2 no usa overrides por variante.');
  }

  async upsertVariantOverride(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: UpsertVarianteMotorOverrideDto,
  ) {
    throw new BadRequestException('vinilo_de_corte@2 no usa overrides por variante.');
  }

  async previewVariant(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: PreviewImposicionProductoVarianteDto,
  ) {
    throw new BadRequestException('vinilo_de_corte@2 preview no implementado en piloto.');
  }

  async quoteVariant(
    auth: CurrentAuth,
    varianteId: string,
    payload: CotizarProductoVarianteDto,
  ): Promise<CotizacionCanonica> {
    const periodo = String(payload.periodo ?? '2026-04');
    const params = (payload.parametros ?? {}) as ParametrosVinylCutV2;
    const cantidadPayload = Math.max(1, Math.floor(Number(payload.cantidad ?? 1)));

    let medidas: Array<{ anchoMm: number; altoMm: number; cantidad: number }>;
    if (Array.isArray(params.medidas) && params.medidas.length > 0) {
      medidas = params.medidas
        .map((m) => ({
          anchoMm: Number(m.anchoMm ?? 0),
          altoMm: Number(m.altoMm ?? 0),
          cantidad: Math.max(1, Math.floor(Number(m.cantidad ?? 1))),
        }))
        .filter((m) => m.anchoMm > 0 && m.altoMm > 0);
    } else {
      const anchoMm = Number(params.anchoMm ?? 0);
      const altoMm = Number(params.altoMm ?? 0);
      if (anchoMm <= 0 || altoMm <= 0) {
        throw new BadRequestException(
          'vinilo_de_corte@2: falta parametros.anchoMm y parametros.altoMm (o parametros.medidas[]).',
        );
      }
      medidas = [{ anchoMm, altoMm, cantidad: cantidadPayload }];
    }
    if (medidas.length === 0) {
      throw new BadRequestException('vinilo_de_corte@2: no se especificaron medidas válidas.');
    }
    const cantidadTotal = medidas.reduce((a, m) => a + m.cantidad, 0);
    const perimetroTotalMl = medidas.reduce(
      (acc, m) => acc + (((m.anchoMm + m.altoMm) * 2) / 1000) * m.cantidad,
      0,
    );

    const variante = await this.service.findVarianteCompletaOrThrowPublic(auth, varianteId);
    const runtime = await this.service.loadVinylCutV2Runtime(
      auth,
      variante.productoServicioId,
      params.color ?? null,
    );
    const config = runtime.config as VinylCutConfigParametros;

    const sepH = Number(config.separacionHorizontalMm ?? CONFIG_DEFAULTS.separacionHorizontalMm);
    const sepV = Number(config.separacionVerticalMm ?? CONFIG_DEFAULTS.separacionVerticalMm);
    const margen = Number(config.margenLateralMm ?? CONFIG_DEFAULTS.margenLateralMm);
    const permitirRotacion = Boolean(config.permitirRotacion ?? CONFIG_DEFAULTS.permitirRotacion);
    const criterio = config.criterioSeleccionMaterial ?? CONFIG_DEFAULTS.criterioSeleccionMaterial;

    const warnings: string[] = [];
    const evaluados: MaterialEvaluado[] = [];
    const descartados: Array<{ sku: string; motivo: string }> = [];

    const panelizadoConfig: NestingRolloPanelizadoConfig | undefined =
      (config as unknown as { panelizado?: NestingRolloPanelizadoConfig }).panelizado;

    for (const material of runtime.materiales) {
      const rolloAnchoMm = rolloAnchoMmDeMaterial(material);
      const rolloLargoM = rolloLargoMDeMaterial(material);
      const precioRollo = Number(material.precioReferencia ?? 0);

      if (!rolloAnchoMm || !rolloLargoM) {
        descartados.push({
          sku: material.sku,
          motivo: 'Material sin atributos ancho/largo: no se puede calcular precio por m².',
        });
        continue;
      }
      if (precioRollo <= 0) {
        descartados.push({ sku: material.sku, motivo: 'Material sin precio de referencia.' });
        continue;
      }

      const printableWidthMm = Math.max(0, rolloAnchoMm - 2 * margen);

      const nesting = nestOnRoll({
        medidas,
        printableWidthMm,
        marginLeftMm: margen,
        marginStartMm: 0,
        marginEndMm: 0,
        separacionHorizontalMm: sepH,
        separacionVerticalMm: sepV,
        permitirRotacion,
        panelizado: panelizadoConfig,
      });

      if (!nesting) {
        descartados.push({
          sku: material.sku,
          motivo: `Rollo ${rolloAnchoMm}mm: no se pudo acomodar las piezas (ancho imprimible ${printableWidthMm}mm).`,
        });
        continue;
      }

      const areaConsumidaM2 = (printableWidthMm * nesting.consumedLengthMm) / 1_000_000;
      const aprovechamientoPct = areaConsumidaM2 > 0
        ? Math.round((nesting.usefulAreaM2 / areaConsumidaM2) * 10000) / 100
        : 0;

      const areaRolloM2 = (rolloAnchoMm / 1000) * rolloLargoM;
      const precioPorM2 = precioRollo / areaRolloM2;
      const sustratoCosto = roundMoney(areaConsumidaM2 * precioPorM2);

      const attrs = (material.atributosVarianteJson ?? {}) as Record<string, unknown>;
      const color = typeof attrs.color === 'string' ? attrs.color : null;

      evaluados.push({
        materialId: material.id,
        sku: material.sku,
        nombre: material.materiaPrima?.nombre ?? material.sku,
        color,
        rolloAnchoMm,
        rolloLargoM,
        precioRolloTotal: precioRollo,
        precioPorM2: roundMoney(precioPorM2),
        nesting,
        areaConsumidaM2,
        aprovechamientoPct,
        sustratoCosto,
      });
    }

    if (evaluados.length === 0) {
      const detalle = descartados.map((d) => `${d.sku}: ${d.motivo}`).join(' | ');
      throw new BadRequestException(
        `vinilo_de_corte@2: ninguno de los materiales compatibles puede procesar el trabajo. ${detalle}`,
      );
    }

    const ganador = elegirMaterial(evaluados, criterio);
    if (evaluados.length > 1) {
      warnings.push(
        `Se evaluaron ${evaluados.length} materiales; ganó ${ganador.sku} (${ganador.rolloAnchoMm}mm ancho) por criterio ${criterio}.`,
      );
    }
    if (ganador.aprovechamientoPct < 30) {
      warnings.push(
        `Aprovechamiento bajo: ${ganador.aprovechamientoPct}%. Considerar otras medidas o combinar con otro pedido.`,
      );
    }

    const plotter = runtime.plotters[0];
    if (runtime.plotters.length > 1) {
      warnings.push(
        `${runtime.plotters.length} plotters compatibles; se usó ${plotter.nombre} (selección por-plotter se implementa en C.3.x).`,
      );
    }

    // ──────────────── Pasos ────────────────

    const prePrensaMin = Number(config.prePrensaSetupMin ?? CONFIG_DEFAULTS.prePrensaSetupMin);
    const prePrensaTarifa = Number(config.prePrensaTarifaHora ?? CONFIG_DEFAULTS.prePrensaTarifaHora);
    const pasoPrePrensa: PasoCotizado = {
      id: 'P01-pre_prensa',
      tipo: 'pre_prensa',
      nombre: 'Pre-prensa (vectores de corte)',
      costoCentroCosto: costoTiempo(prePrensaMin, prePrensaTarifa),
      costoMateriasPrimas: 0,
      cargosFlat: 0,
      trazabilidad: { setupMin: prePrensaMin, tarifaHora: prePrensaTarifa },
    };

    const plotterSetup = Number(config.plotterSetupMin ?? CONFIG_DEFAULTS.plotterSetupMin);
    const plotterVelocidadMlh = Number(config.plotterVelocidadMlh ?? CONFIG_DEFAULTS.plotterVelocidadMlh);
    const plotterTarifa = Number(config.plotterTarifaHora ?? CONFIG_DEFAULTS.plotterTarifaHora);
    const plotterProductivoMin = (perimetroTotalMl / plotterVelocidadMlh) * 60;
    const plotterMin = plotterSetup + plotterProductivoMin;

    const pasoCorte: PasoCotizado = {
      id: 'P02-corte',
      tipo: 'corte',
      nombre: `Corte plotter (${ganador.nombre} ${ganador.rolloAnchoMm}mm${ganador.color ? ' · ' + ganador.color : ''})`,
      costoCentroCosto: costoTiempo(plotterMin, plotterTarifa),
      costoMateriasPrimas: ganador.sustratoCosto,
      cargosFlat: 0,
      trazabilidad: {
        plotter: { id: plotter.id, nombre: plotter.nombre },
        materialElegido: {
          id: ganador.materialId,
          sku: ganador.sku,
          nombre: ganador.nombre,
          color: ganador.color,
          rolloAnchoMm: ganador.rolloAnchoMm,
          rolloLargoM: ganador.rolloLargoM,
          precioRolloTotal: ganador.precioRolloTotal,
          precioPorM2: ganador.precioPorM2,
        },
        criterioAplicado: criterio,
        materialesEvaluados: evaluados.map((e) => ({
          sku: e.sku,
          color: e.color,
          rolloAnchoMm: e.rolloAnchoMm,
          aprovechamientoPct: e.aprovechamientoPct,
          largoConsumidoMm: e.nesting.consumedLengthMm,
          sustratoCosto: e.sustratoCosto,
          esGanador: e.materialId === ganador.materialId,
        })),
        materialesDescartados: descartados,
        nesting: {
          largoConsumidoMm: ganador.nesting.consumedLengthMm,
          areaUtilM2: ganador.nesting.usefulAreaM2,
          areaConsumidaM2: ganador.areaConsumidaM2,
          aprovechamientoPct: ganador.aprovechamientoPct,
          orientacion: ganador.nesting.orientacion,
          panelizado: ganador.nesting.panelizado,
          panelCount: ganador.nesting.panelCount,
          placements: ganador.nesting.placements,
        },
        setupMin: plotterSetup,
        productivoMin: roundMoney(plotterProductivoMin),
        perimetroTotalMl: roundMoney(perimetroTotalMl),
        velocidadMlh: plotterVelocidadMlh,
      },
    };

    const embMinPorPieza = Number(config.embalajePorPiezaMin ?? CONFIG_DEFAULTS.embalajePorPiezaMin);
    const embTarifa = Number(config.embalajeTarifaHora ?? CONFIG_DEFAULTS.embalajeTarifaHora);
    const embPrecioBolsa = Number(config.embalajePrecioBolsa ?? CONFIG_DEFAULTS.embalajePrecioBolsa);
    const embMin = cantidadTotal * embMinPorPieza;
    const pasoEmbalaje: PasoCotizado = {
      id: 'P03-embalaje',
      tipo: 'operacion_manual',
      nombre: 'Embalaje',
      costoCentroCosto: costoTiempo(embMin, embTarifa),
      costoMateriasPrimas: roundMoney(cantidadTotal * embPrecioBolsa),
      cargosFlat: 0,
      trazabilidad: { cantidad: cantidadTotal, bolsas: cantidadTotal, precioBolsa: embPrecioBolsa },
    };

    const pasos = [pasoPrePrensa, pasoCorte, pasoEmbalaje];
    const centroCosto = roundMoney(pasos.reduce((a, p) => a + p.costoCentroCosto, 0));
    const materiasPrimas = roundMoney(pasos.reduce((a, p) => a + p.costoMateriasPrimas, 0));
    const cargosFlat = roundMoney(pasos.reduce((a, p) => a + p.cargosFlat, 0));
    const total = roundMoney(centroCosto + materiasPrimas + cargosFlat);
    const unitario = cantidadTotal > 0 ? roundMoney(total / cantidadTotal) : 0;

    return {
      motorCodigo: 'vinilo_de_corte',
      motorVersion: 2,
      periodo,
      cantidad: cantidadTotal,
      total,
      unitario,
      subtotales: { centroCosto, materiasPrimas, cargosFlat },
      pasos,
      subProductos: [],
      warnings,
      trazabilidad: {
        varianteId,
        medidas,
        colorFiltro: params.color ?? null,
      },
    };
  }
}

function elegirMaterial(
  evaluados: MaterialEvaluado[],
  criterio: 'menor_costo_total' | 'menor_largo_consumido' | 'mayor_aprovechamiento',
): MaterialEvaluado {
  if (criterio === 'menor_largo_consumido') {
    return [...evaluados].sort((a, b) => a.nesting.consumedLengthMm - b.nesting.consumedLengthMm)[0];
  }
  if (criterio === 'mayor_aprovechamiento') {
    return [...evaluados].sort((a, b) => b.aprovechamientoPct - a.aprovechamientoPct)[0];
  }
  return [...evaluados].sort((a, b) => a.sustratoCosto - b.sustratoCosto)[0];
}
