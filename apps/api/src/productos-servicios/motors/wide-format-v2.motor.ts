/**
 * Etapa B/C — WideFormatMotorModuleV2
 *
 * Motor gran_formato@2 del modelo universal. Cotiza impresión por área sobre
 * rollo continuo respetando:
 *   - Config persistida del producto (`ProductoMotorConfig.parametrosJson`)
 *   - Ancho real de cada material compatible (MateriaPrimaVariante.atributosVarianteJson.ancho)
 *   - Regla de selección: prueba cada material, elige por criterio (menor_costo_total)
 *   - Nesting real en rollo (función pura nestOnRoll)
 *   - Rechazo de piezas que no encajan en ningún material disponible
 *
 * Ruta: pre_prensa → impresion_por_area → laminado(opcional) → corte → embalaje
 * Emite shape canónica directamente.
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
import { nestOnRoll, type NestingRolloResult } from './wide-format-v2.calculations';

type ParametrosWideFormatV2 = {
  anchoMm?: number;
  altoMm?: number;
  conLaminado?: boolean;
  medidas?: Array<{ anchoMm: number; altoMm: number; cantidad: number }>;
};

type GranFormatoConfigParametros = {
  materialesCompatibles?: string[];
  maquinasCompatibles?: string[];
  maquinaDefaultId?: string;
  separacionPiezasMm?: number;
  margenLateralMm?: number;
  permitirRotacion?: boolean;
  criterioSeleccionMaterial?: 'menor_costo_total' | 'menor_largo_consumido' | 'mayor_aprovechamiento';
  productividadM2h?: number;
  tarifaMaquinaHora?: number;
  tintaMlPorM2?: number;
  tintaPrecioMl?: number;
  prePrensaSetupMin?: number;
  prePrensaTarifaHora?: number;
  laminadoSetupMin?: number;
  laminadoProductividadM2h?: number;
  laminadoTarifaHora?: number;
  laminadoMermaPct?: number;
  laminadoFilmPrecioM2?: number;
  cortePorPiezaMin?: number;
  corteTarifaHora?: number;
  embalajePorPiezaMin?: number;
  embalajePrecioBolsa?: number;
  embalajeTarifaHora?: number;
};

/** Valores por defecto si falta alguno en la config del producto. */
const CONFIG_DEFAULTS = {
  separacionPiezasMm: 10,
  margenLateralMm: 5,
  permitirRotacion: true,
  criterioSeleccionMaterial: 'menor_costo_total' as const,
  productividadM2h: 4,
  tarifaMaquinaHora: 8000,
  tintaMlPorM2: 15,
  tintaPrecioMl: 2.5,
  prePrensaSetupMin: 15,
  prePrensaTarifaHora: 3500,
  laminadoSetupMin: 3,
  laminadoProductividadM2h: 20,
  laminadoTarifaHora: 6000,
  laminadoMermaPct: 0.05,
  laminadoFilmPrecioM2: 1800,
  cortePorPiezaMin: 2,
  corteTarifaHora: 6000,
  embalajePorPiezaMin: 1,
  embalajePrecioBolsa: 45,
  embalajeTarifaHora: 2500,
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function costoTiempo(min: number, tarifaHora: number): number {
  return roundMoney((min / 60) * tarifaHora);
}

/** Resuelve el ancho del rollo en mm a partir del material (atributosVarianteJson.ancho en metros). */
function rolloAnchoMmDeMaterial(material: { atributosVarianteJson: unknown }): number | null {
  const attrs = material.atributosVarianteJson as Record<string, unknown> | null;
  if (!attrs) return null;
  const anchoM = Number(attrs.ancho);
  if (!Number.isFinite(anchoM) || anchoM <= 0) return null;
  return Math.round(anchoM * 1000);
}

/** Largo del rollo en metros (para derivar precio por m²). */
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
  rolloAnchoMm: number;
  rolloLargoM: number;
  precioRolloTotal: number;
  precioPorM2: number;
  nesting: NestingRolloResult;
  sustratoCosto: number; // costo del sustrato para las piezas pedidas
};

export class WideFormatMotorModuleV2 implements ProductMotorModule {
  constructor(private readonly service: ProductosServiciosService) {}

  getDefinition(): ProductMotorDefinition {
    return {
      code: 'gran_formato',
      version: 2,
      label: 'Gran formato (modelo universal) · v2',
      category: 'wide_format',
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
    return this.service.getWideFormatProductMotorConfig(auth, productoId);
  }

  upsertProductConfig(auth: CurrentAuth, productoId: string, payload: UpsertProductoMotorConfigDto) {
    return this.service.upsertWideFormatProductMotorConfig(auth, productoId, payload);
  }

  async getVariantOverride(_auth: CurrentAuth, _varianteId: string) {
    throw new BadRequestException('gran_formato@2 no usa overrides por variante.');
  }

  async upsertVariantOverride(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: UpsertVarianteMotorOverrideDto,
  ) {
    throw new BadRequestException('gran_formato@2 no usa overrides por variante.');
  }

  async previewVariant(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: PreviewImposicionProductoVarianteDto,
  ) {
    throw new BadRequestException('gran_formato@2 preview no implementado en piloto.');
  }

  async quoteVariant(
    auth: CurrentAuth,
    varianteId: string,
    payload: CotizarProductoVarianteDto,
  ): Promise<CotizacionCanonica> {
    const periodo = String(payload.periodo ?? '2026-04');
    const params = (payload.parametros ?? {}) as ParametrosWideFormatV2;
    const conLaminado = Boolean(params.conLaminado ?? false);
    const cantidadPayload = Math.max(1, Math.floor(Number(payload.cantidad ?? 1)));

    // Normalizar medidas
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
          'gran_formato@2: falta parametros.anchoMm y parametros.altoMm (o parametros.medidas[]).',
        );
      }
      medidas = [{ anchoMm, altoMm, cantidad: cantidadPayload }];
    }
    if (medidas.length === 0) {
      throw new BadRequestException('gran_formato@2: no se especificaron medidas válidas.');
    }
    const cantidadTotal = medidas.reduce((a, m) => a + m.cantidad, 0);

    // Cargar variante + config + materiales desde DB
    const variante = await this.service.findVarianteCompletaOrThrowPublic(auth, varianteId);
    const runtime = await this.service.loadGranFormatoV2Runtime(auth, variante.productoServicioId);
    const config = runtime.config as GranFormatoConfigParametros;

    const sep = Number(config.separacionPiezasMm ?? CONFIG_DEFAULTS.separacionPiezasMm);
    const margen = Number(config.margenLateralMm ?? CONFIG_DEFAULTS.margenLateralMm);
    const permitirRotacion = Boolean(config.permitirRotacion ?? CONFIG_DEFAULTS.permitirRotacion);
    const criterio = config.criterioSeleccionMaterial ?? CONFIG_DEFAULTS.criterioSeleccionMaterial;

    // ──────────────── Evaluar cada material compatible ────────────────
    const warnings: string[] = [];
    const evaluados: MaterialEvaluado[] = [];
    const descartados: Array<{ sku: string; motivo: string }> = [];

    for (const material of runtime.materiales) {
      const rolloAnchoMm = rolloAnchoMmDeMaterial(material);
      const rolloLargoM = rolloLargoMDeMaterial(material);
      const precioRollo = Number(material.precioReferencia ?? 0);

      if (!rolloAnchoMm || !rolloLargoM) {
        descartados.push({
          sku: material.sku,
          motivo: `Material sin atributos ancho/largo: no se puede calcular precio por m².`,
        });
        continue;
      }
      if (precioRollo <= 0) {
        descartados.push({
          sku: material.sku,
          motivo: `Material sin precio de referencia.`,
        });
        continue;
      }

      const nesting = nestOnRoll({
        piezas: medidas,
        rolloAnchoMm,
        separacionMm: sep,
        margenLateralMm: margen,
        permitirRotacion,
      });

      if (nesting.piezasRechazadas.length > 0) {
        descartados.push({
          sku: material.sku,
          motivo: `Rollo ${rolloAnchoMm}mm: ${nesting.piezasRechazadas.map((r) => r.motivo).join('; ')}`,
        });
        continue;
      }

      // Precio por m² = precio del rollo / (ancho × largo del rollo)
      const areaRolloM2 = (rolloAnchoMm / 1000) * rolloLargoM;
      const precioPorM2 = precioRollo / areaRolloM2;
      const sustratoCosto = roundMoney(nesting.areaConsumidaM2 * precioPorM2);

      evaluados.push({
        materialId: material.id,
        sku: material.sku,
        nombre: material.materiaPrima?.nombre ?? material.sku,
        rolloAnchoMm,
        rolloLargoM,
        precioRolloTotal: precioRollo,
        precioPorM2: roundMoney(precioPorM2),
        nesting,
        sustratoCosto,
      });
    }

    if (evaluados.length === 0) {
      const detalle = descartados.map((d) => `${d.sku}: ${d.motivo}`).join(' | ');
      throw new BadRequestException(
        `gran_formato@2: ninguno de los materiales compatibles puede procesar el trabajo. ${detalle}`,
      );
    }

    // Elegir ganador por criterio
    const ganador = elegirMaterial(evaluados, criterio);
    if (evaluados.length > 1) {
      warnings.push(
        `Se evaluaron ${evaluados.length} materiales; ganó ${ganador.sku} (${ganador.rolloAnchoMm}mm ancho) por criterio ${criterio}.`,
      );
    }
    if (ganador.nesting.aprovechamientoPct < 30) {
      warnings.push(
        `Aprovechamiento bajo: ${ganador.nesting.aprovechamientoPct}%. Considerar otras medidas o combinar con otro pedido.`,
      );
    }

    // ──────────────── Construir pasos ────────────────

    // Paso 1: pre_prensa
    const prePrensaMin = Number(config.prePrensaSetupMin ?? CONFIG_DEFAULTS.prePrensaSetupMin);
    const prePrensaTarifa = Number(config.prePrensaTarifaHora ?? CONFIG_DEFAULTS.prePrensaTarifaHora);
    const pasoPrePrensa: PasoCotizado = {
      id: 'P01-pre_prensa',
      tipo: 'pre_prensa',
      nombre: 'Pre-prensa',
      costoCentroCosto: costoTiempo(prePrensaMin, prePrensaTarifa),
      costoMateriasPrimas: 0,
      cargosFlat: 0,
      trazabilidad: { setupMin: prePrensaMin, tarifaHora: prePrensaTarifa },
    };

    // Paso 2: impresion_por_area
    const areaConsumidaM2 = ganador.nesting.areaConsumidaM2;
    const areaUtilM2 = ganador.nesting.areaUtilM2;
    const productividadM2h = Number(config.productividadM2h ?? CONFIG_DEFAULTS.productividadM2h);
    const tarifaImpresion = Number(config.tarifaMaquinaHora ?? CONFIG_DEFAULTS.tarifaMaquinaHora);
    const tintaMlPorM2 = Number(config.tintaMlPorM2 ?? CONFIG_DEFAULTS.tintaMlPorM2);
    const tintaPrecioMl = Number(config.tintaPrecioMl ?? CONFIG_DEFAULTS.tintaPrecioMl);
    const impresionProductivoMin = (areaConsumidaM2 / productividadM2h) * 60;
    const impresionSetupMin = 5;
    const impresionMin = impresionSetupMin + impresionProductivoMin;
    const tintaMl = areaUtilM2 * tintaMlPorM2;
    const tintaCosto = roundMoney(tintaMl * tintaPrecioMl);

    const pasoImpresion: PasoCotizado = {
      id: 'P02-impresion_por_area',
      tipo: 'impresion_por_area',
      nombre: `Impresión UV (${ganador.nombre} ${ganador.rolloAnchoMm}mm)`,
      costoCentroCosto: costoTiempo(impresionMin, tarifaImpresion),
      costoMateriasPrimas: roundMoney(ganador.sustratoCosto + tintaCosto),
      cargosFlat: 0,
      trazabilidad: {
        materialElegido: {
          id: ganador.materialId,
          sku: ganador.sku,
          nombre: ganador.nombre,
          rolloAnchoMm: ganador.rolloAnchoMm,
          rolloLargoM: ganador.rolloLargoM,
          precioRolloTotal: ganador.precioRolloTotal,
          precioPorM2: ganador.precioPorM2,
        },
        criterioAplicado: criterio,
        materialesEvaluados: evaluados.map((e) => ({
          sku: e.sku,
          rolloAnchoMm: e.rolloAnchoMm,
          aprovechamientoPct: e.nesting.aprovechamientoPct,
          largoConsumidoMm: e.nesting.largoConsumidoMm,
          sustratoCosto: e.sustratoCosto,
          esGanador: e.materialId === ganador.materialId,
        })),
        materialesDescartados: descartados,
        nesting: {
          largoConsumidoMm: ganador.nesting.largoConsumidoMm,
          areaUtilM2: ganador.nesting.areaUtilM2,
          areaConsumidaM2: ganador.nesting.areaConsumidaM2,
          aprovechamientoPct: ganador.nesting.aprovechamientoPct,
          layoutsPorMedida: ganador.nesting.layoutsPorMedida,
        },
        productividadM2h,
        setupMin: impresionSetupMin,
        productivoMin: roundMoney(impresionProductivoMin),
        sustrato: { m2Consumidos: areaConsumidaM2, precioM2: ganador.precioPorM2, costo: ganador.sustratoCosto },
        tinta: { ml: roundMoney(tintaMl), precioMl: tintaPrecioMl, costo: tintaCosto },
      },
    };

    // Paso 3: laminado (opcional)
    let pasoLaminado: PasoCotizado | null = null;
    if (conLaminado) {
      const lamSetup = Number(config.laminadoSetupMin ?? CONFIG_DEFAULTS.laminadoSetupMin);
      const lamProd = Number(config.laminadoProductividadM2h ?? CONFIG_DEFAULTS.laminadoProductividadM2h);
      const lamTarifa = Number(config.laminadoTarifaHora ?? CONFIG_DEFAULTS.laminadoTarifaHora);
      const lamMerma = Number(config.laminadoMermaPct ?? CONFIG_DEFAULTS.laminadoMermaPct);
      const lamFilmPrecio = Number(config.laminadoFilmPrecioM2 ?? CONFIG_DEFAULTS.laminadoFilmPrecioM2);
      const lamProductivoMin = (areaConsumidaM2 / lamProd) * 60;
      const lamMin = lamSetup + lamProductivoMin;
      const lamFilmM2 = areaConsumidaM2 * (1 + lamMerma);
      const lamFilmCosto = roundMoney(lamFilmM2 * lamFilmPrecio);
      pasoLaminado = {
        id: 'P03-laminado',
        tipo: 'laminado',
        nombre: 'Laminado UV',
        costoCentroCosto: costoTiempo(lamMin, lamTarifa),
        costoMateriasPrimas: lamFilmCosto,
        cargosFlat: 0,
        trazabilidad: {
          setupMin: lamSetup,
          productivoMin: roundMoney(lamProductivoMin),
          film: { m2: roundMoney(lamFilmM2), precioM2: lamFilmPrecio, costo: lamFilmCosto },
        },
      };
    }

    // Paso 4: corte
    const corteMinPorPieza = Number(config.cortePorPiezaMin ?? CONFIG_DEFAULTS.cortePorPiezaMin);
    const corteTarifa = Number(config.corteTarifaHora ?? CONFIG_DEFAULTS.corteTarifaHora);
    const corteMin = cantidadTotal * corteMinPorPieza;
    const pasoCorte: PasoCotizado = {
      id: 'P04-corte',
      tipo: 'corte',
      nombre: 'Corte perimetral',
      costoCentroCosto: costoTiempo(corteMin, corteTarifa),
      costoMateriasPrimas: 0,
      cargosFlat: 0,
      trazabilidad: { cantidad: cantidadTotal, minPorPieza: corteMinPorPieza, totalMin: corteMin },
    };

    // Paso 5: embalaje
    const embMinPorPieza = Number(config.embalajePorPiezaMin ?? CONFIG_DEFAULTS.embalajePorPiezaMin);
    const embTarifa = Number(config.embalajeTarifaHora ?? CONFIG_DEFAULTS.embalajeTarifaHora);
    const embPrecioBolsa = Number(config.embalajePrecioBolsa ?? CONFIG_DEFAULTS.embalajePrecioBolsa);
    const embMin = cantidadTotal * embMinPorPieza;
    const pasoEmbalaje: PasoCotizado = {
      id: 'P05-embalaje',
      tipo: 'operacion_manual',
      nombre: 'Embalaje individual',
      costoCentroCosto: costoTiempo(embMin, embTarifa),
      costoMateriasPrimas: roundMoney(cantidadTotal * embPrecioBolsa),
      cargosFlat: 0,
      trazabilidad: { cantidad: cantidadTotal, bolsas: cantidadTotal, precioBolsa: embPrecioBolsa },
    };

    const pasos = [pasoPrePrensa, pasoImpresion, ...(pasoLaminado ? [pasoLaminado] : []), pasoCorte, pasoEmbalaje];
    const centroCosto = roundMoney(pasos.reduce((a, p) => a + p.costoCentroCosto, 0));
    const materiasPrimas = roundMoney(pasos.reduce((a, p) => a + p.costoMateriasPrimas, 0));
    const cargosFlat = roundMoney(pasos.reduce((a, p) => a + p.cargosFlat, 0));
    const total = roundMoney(centroCosto + materiasPrimas + cargosFlat);
    const unitario = cantidadTotal > 0 ? roundMoney(total / cantidadTotal) : 0;

    return {
      motorCodigo: 'gran_formato',
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
        conLaminado,
        configVersion: runtime.config ? 'loaded' : 'defaults',
      },
    };
  }
}

function elegirMaterial(
  evaluados: MaterialEvaluado[],
  criterio: 'menor_costo_total' | 'menor_largo_consumido' | 'mayor_aprovechamiento',
): MaterialEvaluado {
  if (criterio === 'menor_largo_consumido') {
    return [...evaluados].sort((a, b) => a.nesting.largoConsumidoMm - b.nesting.largoConsumidoMm)[0];
  }
  if (criterio === 'mayor_aprovechamiento') {
    return [...evaluados].sort((a, b) => b.nesting.aprovechamientoPct - a.nesting.aprovechamientoPct)[0];
  }
  // menor_costo_total por default
  return [...evaluados].sort((a, b) => a.sustratoCosto - b.sustratoCosto)[0];
}
