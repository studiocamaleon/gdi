/**
 * Etapa C.5 — RigidPrintedMotorModuleV2
 *
 * Motor rigidos_impresos@2 del modelo universal. Cotiza impresión UV
 * directa sobre placas rígidas (MDF, acrílico, PVC, etc.).
 *
 * Pipeline: pre_prensa → impresion_por_pieza (con nesting-placa-rigida) →
 * corte_volumetrico → embalaje.
 *
 * Piloto MVP: maneja impresión directa sobre placa rígida. Selecciona la
 * placa ganadora entre variantesCompatibles por criterio (menor_costo_total).
 * Las extensiones (flexible_montado, perfiles operativos, checklist,
 * dos caras con duplicado de sustrato) se agregan en iteraciones posteriores.
 *
 * A diferencia de gran_formato/vinyl_cut, acá el motor no requiere
 * ProductoVariante — opera sobre payload.medidas + placa elegida.
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
  nestRectangularGrid,
  type NestingPlacaResult,
} from '../nesting/nesting-placa-rigida';

type ParametrosRigidV2 = {
  anchoMm?: number;
  altoMm?: number;
  medidas?: Array<{ anchoMm: number; altoMm: number; cantidad: number }>;
  /** ID específico de variante de placa a usar; si no, gana por criterio. */
  placaVarianteId?: string | null;
};

type RigidConfigParametros = {
  variantesCompatibles?: string[];
  criterioSeleccionMaterial?: 'menor_costo_total' | 'menor_largo_consumido' | 'mayor_aprovechamiento';
  imposicion?: {
    margenPlacaMm?: number;
    separacionHorizontalMm?: number;
    separacionVerticalMm?: number;
    permitirRotacion?: boolean;
  };
  prePrensaSetupMin?: number;
  prePrensaTarifaHora?: number;
  impresionSetupMin?: number;
  impresionTiempoPorPiezaMin?: number;
  impresionTarifaHora?: number;
  tintaMlPorM2?: number;
  tintaPrecioMl?: number;
  corteSetupMin?: number;
  cortePorPiezaMin?: number;
  corteTarifaHora?: number;
  embalajePorPiezaMin?: number;
  embalajePrecioBolsa?: number;
  embalajeTarifaHora?: number;
};

const CONFIG_DEFAULTS = {
  margenPlacaMm: 10,
  separacionHorizontalMm: 5,
  separacionVerticalMm: 5,
  permitirRotacion: true,
  criterioSeleccionMaterial: 'menor_costo_total' as const,
  prePrensaSetupMin: 10,
  prePrensaTarifaHora: 3500,
  impresionSetupMin: 10,
  impresionTiempoPorPiezaMin: 2,
  impresionTarifaHora: 12000,
  tintaMlPorM2: 25,
  tintaPrecioMl: 3.5,
  corteSetupMin: 5,
  cortePorPiezaMin: 1,
  corteTarifaHora: 8000,
  embalajePorPiezaMin: 1,
  embalajePrecioBolsa: 80,
  embalajeTarifaHora: 2500,
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function costoTiempo(min: number, tarifaHora: number): number {
  return roundMoney((min / 60) * tarifaHora);
}

function placaDimensionesDeVariante(material: {
  atributosVarianteJson: unknown;
}): { anchoMm: number; altoMm: number } | null {
  const attrs = material.atributosVarianteJson as Record<string, unknown> | null;
  if (!attrs) return null;
  const anchoM = Number(attrs.ancho);
  const altoM = Number(attrs.alto);
  if (!Number.isFinite(anchoM) || !Number.isFinite(altoM) || anchoM <= 0 || altoM <= 0) {
    return null;
  }
  return { anchoMm: Math.round(anchoM * 1000), altoMm: Math.round(altoM * 1000) };
}

type PlacaEvaluada = {
  placaId: string;
  sku: string;
  nombre: string;
  placaAnchoMm: number;
  placaAltoMm: number;
  espesor: number | null;
  precioPorPlaca: number;
  nesting: NestingPlacaResult;
  placasNecesarias: number;
  sustratoCosto: number;
  aprovechamientoPct: number;
};

export class RigidPrintedMotorModuleV2 implements ProductMotorModule {
  constructor(private readonly service: ProductosServiciosService) {}

  getDefinition(): ProductMotorDefinition {
    return {
      code: 'rigidos_impresos',
      version: 2,
      label: 'Rígidos impresos (modelo universal) · v2',
      category: 'rigid_printed',
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
    throw new BadRequestException('rigidos_impresos@2 no usa overrides por variante en piloto.');
  }

  async upsertVariantOverride(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: UpsertVarianteMotorOverrideDto,
  ) {
    throw new BadRequestException('rigidos_impresos@2 no usa overrides por variante en piloto.');
  }

  async previewVariant(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: PreviewImposicionProductoVarianteDto,
  ) {
    throw new BadRequestException('rigidos_impresos@2 preview no implementado en piloto.');
  }

  async quoteVariant(
    auth: CurrentAuth,
    varianteId: string,
    payload: CotizarProductoVarianteDto,
  ): Promise<CotizacionCanonica> {
    const periodo = String(payload.periodo ?? '2026-04');
    const params = (payload.parametros ?? {}) as ParametrosRigidV2;
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
          'rigidos_impresos@2: falta parametros.anchoMm y parametros.altoMm (o parametros.medidas[]).',
        );
      }
      medidas = [{ anchoMm, altoMm, cantidad: cantidadPayload }];
    }
    if (medidas.length === 0) {
      throw new BadRequestException('rigidos_impresos@2: no se especificaron medidas válidas.');
    }
    const cantidadTotal = medidas.reduce((a, m) => a + m.cantidad, 0);
    // Piloto MVP: tomamos la primera medida como pieza representativa.
    const pieza = medidas[0];

    // Rígidos impresos no requiere ProductoVariante (muchos productos cotizan
    // "medida libre" a partir del payload). Se intenta resolver como variante;
    // si no existe, se interpreta varianteId como productoId.
    let productoId: string;
    try {
      const variante = await this.service.findVarianteCompletaOrThrowPublic(auth, varianteId);
      productoId = variante.productoServicioId;
    } catch {
      productoId = varianteId;
    }
    const runtime = await this.service.loadRigidPrintedV2Runtime(auth, productoId);
    const config = runtime.config as RigidConfigParametros;

    const imposicion = config.imposicion ?? {};
    const margen = Number(imposicion.margenPlacaMm ?? CONFIG_DEFAULTS.margenPlacaMm);
    const sepH = Number(imposicion.separacionHorizontalMm ?? CONFIG_DEFAULTS.separacionHorizontalMm);
    const sepV = Number(imposicion.separacionVerticalMm ?? CONFIG_DEFAULTS.separacionVerticalMm);
    const permitirRotacion = Boolean(imposicion.permitirRotacion ?? CONFIG_DEFAULTS.permitirRotacion);
    const criterio = config.criterioSeleccionMaterial ?? CONFIG_DEFAULTS.criterioSeleccionMaterial;

    const warnings: string[] = [];
    const evaluadas: PlacaEvaluada[] = [];
    const descartadas: Array<{ sku: string; motivo: string }> = [];

    const placasAEvaluar = params.placaVarianteId
      ? runtime.placas.filter((p) => p.id === params.placaVarianteId)
      : runtime.placas;
    if (placasAEvaluar.length === 0) {
      throw new BadRequestException(
        `placaVarianteId=${params.placaVarianteId} no existe en variantesCompatibles.`,
      );
    }

    for (const placa of placasAEvaluar) {
      const dims = placaDimensionesDeVariante(placa);
      const precioPlaca = Number(placa.precioReferencia ?? 0);
      if (!dims) {
        descartadas.push({ sku: placa.sku, motivo: 'Placa sin atributos ancho/alto.' });
        continue;
      }
      if (precioPlaca <= 0) {
        descartadas.push({ sku: placa.sku, motivo: 'Placa sin precio de referencia.' });
        continue;
      }

      const nesting = nestRectangularGrid({
        piezaAnchoMm: pieza.anchoMm,
        piezaAltoMm: pieza.altoMm,
        placaAnchoMm: dims.anchoMm,
        placaAltoMm: dims.altoMm,
        separacionHMm: sepH,
        separacionVMm: sepV,
        margenMm: margen,
        permitirRotacion,
      });

      if (nesting.piezasPorPlaca === 0) {
        descartadas.push({
          sku: placa.sku,
          motivo: `Placa ${dims.anchoMm}×${dims.altoMm}mm: no entra pieza ${pieza.anchoMm}×${pieza.altoMm}mm con margen ${margen}mm.`,
        });
        continue;
      }

      const placasNecesarias = Math.ceil(cantidadTotal / nesting.piezasPorPlaca);
      const sustratoCosto = roundMoney(placasNecesarias * precioPlaca);
      const areaTotalPlacasM2 = placasNecesarias * (dims.anchoMm / 1000) * (dims.altoMm / 1000);
      const areaUtilM2 = (cantidadTotal * pieza.anchoMm * pieza.altoMm) / 1_000_000;
      const aprovechamientoPct =
        areaTotalPlacasM2 > 0 ? Math.round((areaUtilM2 / areaTotalPlacasM2) * 10000) / 100 : 0;

      const attrs = (placa.atributosVarianteJson ?? {}) as Record<string, unknown>;
      const espesor = Number(attrs.espesor);

      evaluadas.push({
        placaId: placa.id,
        sku: placa.sku,
        nombre: placa.materiaPrima?.nombre ?? placa.sku,
        placaAnchoMm: dims.anchoMm,
        placaAltoMm: dims.altoMm,
        espesor: Number.isFinite(espesor) ? espesor : null,
        precioPorPlaca: precioPlaca,
        nesting,
        placasNecesarias,
        sustratoCosto,
        aprovechamientoPct,
      });
    }

    if (evaluadas.length === 0) {
      const detalle = descartadas.map((d) => `${d.sku}: ${d.motivo}`).join(' | ');
      throw new BadRequestException(
        `rigidos_impresos@2: ninguna placa compatible puede procesar el trabajo. ${detalle}`,
      );
    }

    const ganadora = elegirPlaca(evaluadas, criterio);
    if (evaluadas.length > 1) {
      warnings.push(
        `Se evaluaron ${evaluadas.length} placas; ganó ${ganadora.sku} (${ganadora.placaAnchoMm}×${ganadora.placaAltoMm}mm) por criterio ${criterio}.`,
      );
    }

    // ──────────────── Pasos ────────────────

    const prePrensaMin = Number(config.prePrensaSetupMin ?? CONFIG_DEFAULTS.prePrensaSetupMin);
    const prePrensaTarifa = Number(config.prePrensaTarifaHora ?? CONFIG_DEFAULTS.prePrensaTarifaHora);
    const pasoPrePrensa: PasoCotizado = {
      id: 'P01-pre_prensa',
      tipo: 'pre_prensa',
      nombre: 'Pre-prensa UV',
      costoCentroCosto: costoTiempo(prePrensaMin, prePrensaTarifa),
      costoMateriasPrimas: 0,
      cargosFlat: 0,
      trazabilidad: { setupMin: prePrensaMin, tarifaHora: prePrensaTarifa },
    };

    const impSetup = Number(config.impresionSetupMin ?? CONFIG_DEFAULTS.impresionSetupMin);
    const impMinPorPieza = Number(
      config.impresionTiempoPorPiezaMin ?? CONFIG_DEFAULTS.impresionTiempoPorPiezaMin,
    );
    const impTarifa = Number(config.impresionTarifaHora ?? CONFIG_DEFAULTS.impresionTarifaHora);
    const impProdMin = cantidadTotal * impMinPorPieza;
    const impMin = impSetup + impProdMin;
    const tintaMlPorM2 = Number(config.tintaMlPorM2 ?? CONFIG_DEFAULTS.tintaMlPorM2);
    const tintaPrecioMl = Number(config.tintaPrecioMl ?? CONFIG_DEFAULTS.tintaPrecioMl);
    const areaUtilM2 = (cantidadTotal * pieza.anchoMm * pieza.altoMm) / 1_000_000;
    const tintaMl = areaUtilM2 * tintaMlPorM2;
    const tintaCosto = roundMoney(tintaMl * tintaPrecioMl);

    const pasoImpresion: PasoCotizado = {
      id: 'P02-impresion_por_pieza',
      tipo: 'impresion_por_pieza',
      nombre: `Impresión UV directa (${ganadora.nombre} ${ganadora.espesor ?? '?'}mm)`,
      costoCentroCosto: costoTiempo(impMin, impTarifa),
      costoMateriasPrimas: roundMoney(ganadora.sustratoCosto + tintaCosto),
      cargosFlat: 0,
      trazabilidad: {
        placaElegida: {
          id: ganadora.placaId,
          sku: ganadora.sku,
          nombre: ganadora.nombre,
          dimensionesMm: { anchoMm: ganadora.placaAnchoMm, altoMm: ganadora.placaAltoMm },
          espesor: ganadora.espesor,
          precioPorPlaca: ganadora.precioPorPlaca,
        },
        criterioAplicado: criterio,
        placasEvaluadas: evaluadas.map((e) => ({
          sku: e.sku,
          dimensionesMm: { anchoMm: e.placaAnchoMm, altoMm: e.placaAltoMm },
          espesor: e.espesor,
          piezasPorPlaca: e.nesting.piezasPorPlaca,
          placasNecesarias: e.placasNecesarias,
          sustratoCosto: e.sustratoCosto,
          aprovechamientoPct: e.aprovechamientoPct,
          esGanadora: e.placaId === ganadora.placaId,
        })),
        placasDescartadas: descartadas,
        nesting: {
          algoritmo: 'nesting-placa-rigida',
          piezasPorPlaca: ganadora.nesting.piezasPorPlaca,
          placasNecesarias: ganadora.placasNecesarias,
          columnas: ganadora.nesting.columnas,
          filas: ganadora.nesting.filas,
          rotada: ganadora.nesting.rotada,
          aprovechamientoPct: ganadora.aprovechamientoPct,
          placements: ganadora.nesting.placements,
        },
        setupMin: impSetup,
        productivoMin: roundMoney(impProdMin),
        minPorPieza: impMinPorPieza,
        sustrato: { placas: ganadora.placasNecesarias, precioPorPlaca: ganadora.precioPorPlaca, costo: ganadora.sustratoCosto },
        tinta: { ml: roundMoney(tintaMl), precioMl: tintaPrecioMl, costo: tintaCosto },
      },
    };

    const corteSetup = Number(config.corteSetupMin ?? CONFIG_DEFAULTS.corteSetupMin);
    const corteMinPorPieza = Number(config.cortePorPiezaMin ?? CONFIG_DEFAULTS.cortePorPiezaMin);
    const corteTarifa = Number(config.corteTarifaHora ?? CONFIG_DEFAULTS.corteTarifaHora);
    const corteMin = corteSetup + cantidadTotal * corteMinPorPieza;
    const pasoCorte: PasoCotizado = {
      id: 'P03-corte_volumetrico',
      tipo: 'corte_volumetrico',
      nombre: 'Corte CNC/router',
      costoCentroCosto: costoTiempo(corteMin, corteTarifa),
      costoMateriasPrimas: 0,
      cargosFlat: 0,
      trazabilidad: {
        setupMin: corteSetup,
        minPorPieza: corteMinPorPieza,
        cantidad: cantidadTotal,
        totalMin: corteMin,
      },
    };

    const embMinPorPieza = Number(config.embalajePorPiezaMin ?? CONFIG_DEFAULTS.embalajePorPiezaMin);
    const embTarifa = Number(config.embalajeTarifaHora ?? CONFIG_DEFAULTS.embalajeTarifaHora);
    const embPrecioBolsa = Number(config.embalajePrecioBolsa ?? CONFIG_DEFAULTS.embalajePrecioBolsa);
    const embMin = cantidadTotal * embMinPorPieza;
    const pasoEmbalaje: PasoCotizado = {
      id: 'P04-embalaje',
      tipo: 'operacion_manual',
      nombre: 'Embalaje rígido',
      costoCentroCosto: costoTiempo(embMin, embTarifa),
      costoMateriasPrimas: roundMoney(cantidadTotal * embPrecioBolsa),
      cargosFlat: 0,
      trazabilidad: { cantidad: cantidadTotal, precioBolsa: embPrecioBolsa },
    };

    const pasos = [pasoPrePrensa, pasoImpresion, pasoCorte, pasoEmbalaje];
    const centroCosto = roundMoney(pasos.reduce((a, p) => a + p.costoCentroCosto, 0));
    const materiasPrimas = roundMoney(pasos.reduce((a, p) => a + p.costoMateriasPrimas, 0));
    const cargosFlat = roundMoney(pasos.reduce((a, p) => a + p.cargosFlat, 0));
    const total = roundMoney(centroCosto + materiasPrimas + cargosFlat);
    const unitario = cantidadTotal > 0 ? roundMoney(total / cantidadTotal) : 0;

    return {
      motorCodigo: 'rigidos_impresos',
      motorVersion: 2,
      periodo,
      cantidad: cantidadTotal,
      total,
      unitario,
      subtotales: { centroCosto, materiasPrimas, cargosFlat },
      pasos,
      subProductos: [],
      warnings,
      trazabilidad: { varianteId, medidas, placaOverride: params.placaVarianteId ?? null },
    };
  }
}

function elegirPlaca(
  evaluadas: PlacaEvaluada[],
  criterio: 'menor_costo_total' | 'menor_largo_consumido' | 'mayor_aprovechamiento',
): PlacaEvaluada {
  if (criterio === 'mayor_aprovechamiento') {
    return [...evaluadas].sort((a, b) => b.aprovechamientoPct - a.aprovechamientoPct)[0];
  }
  if (criterio === 'menor_largo_consumido') {
    return [...evaluadas].sort((a, b) => a.placasNecesarias - b.placasNecesarias)[0];
  }
  return [...evaluadas].sort((a, b) => a.sustratoCosto - b.sustratoCosto)[0];
}
