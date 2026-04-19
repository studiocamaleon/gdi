/**
 * Etapa C.4 — DigitalSheetMotorModuleV2
 *
 * Motor impresion_digital_laser@2 del modelo universal. Cotiza tarjetas /
 * volantes / folletería sobre pliegos de papel con imposición grid simple.
 *
 * Pipeline: pre_prensa → impresion_por_hoja (con nesting-hoja) → corte →
 * embalaje.
 *
 * Piloto MVP: maneja el caso simple — una máquina, sin tira+retira, sin
 * checklist, sin perfiles. Usa `nestOnSheet` con un solo pliego candidato
 * (el tamanoPliegoImpresion de la config). Las extensiones (tira+retira,
 * configuracionesImpresion, checklist, pasos fijos, laminado por cara,
 * troquelado, demasía) se agregan en iteraciones posteriores.
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
import { nestOnSheet, type NestingHojaResult } from '../nesting/nesting-hoja';

type DigitalConfigParametros = {
  tamanoPliegoImpresion?: { anchoMm: number; altoMm: number; codigo?: string; nombre?: string };
  demasiaCorteMm?: number;
  lineaCorteMm?: number;
  margenPerimetralCorteMm?: number;
  gapHorizontalMm?: number;
  gapVerticalMm?: number;
  mermaAdicionalPct?: number;
  permitirRotacion?: boolean;
  /** Valor por defecto si la variante no soporta múltiples opciones. */
  carasDefault?: 'simple_faz' | 'doble_faz';
  tipoImpresionDefault?: 'CMYK' | 'BN';
  prePrensaSetupMin?: number;
  prePrensaTarifaHora?: number;
  impresionSetupMin?: number;
  impresionClicsPorPliego?: number;
  impresionCostoClic?: number;
  /** Costo de clic en BN (si BN no está seteado, se usa impresionCostoClic). */
  impresionCostoClicBN?: number;
  impresionTarifaHora?: number;
  impresionPliegosPorHora?: number;
  papelPrecioPorPliego?: number;
  corteMinPorPliego?: number;
  corteTarifaHora?: number;
  embalajePorPiezaMin?: number;
  embalajeTarifaHora?: number;
  embalajePrecioBolsa?: number;
};

const CONFIG_DEFAULTS = {
  demasiaCorteMm: 2,
  lineaCorteMm: 3,
  margenPerimetralCorteMm: 3,
  gapHorizontalMm: 0,
  gapVerticalMm: 0,
  permitirRotacion: true,
  carasDefault: 'simple_faz' as const,
  tipoImpresionDefault: 'CMYK' as const,
  prePrensaSetupMin: 10,
  prePrensaTarifaHora: 3500,
  impresionSetupMin: 5,
  impresionClicsPorPliego: 1,
  impresionCostoClic: 30,
  impresionCostoClicBN: 10,
  impresionTarifaHora: 4500,
  impresionPliegosPorHora: 1200,
  papelPrecioPorPliego: 40,
  corteMinPorPliego: 0.5,
  corteTarifaHora: 6000,
  embalajePorPiezaMin: 0.1,
  embalajeTarifaHora: 2500,
  embalajePrecioBolsa: 15,
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function costoTiempo(min: number, tarifaHora: number): number {
  return roundMoney((min / 60) * tarifaHora);
}

export class DigitalSheetMotorModuleV2 implements ProductMotorModule {
  constructor(private readonly service: ProductosServiciosService) {}

  getDefinition(): ProductMotorDefinition {
    return {
      code: 'impresion_digital_laser',
      version: 2,
      label: 'Impresión digital láser (modelo universal) · v2',
      category: 'digital_sheet',
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
    return this.service.getDigitalProductMotorConfig(auth, productoId);
  }

  upsertProductConfig(auth: CurrentAuth, productoId: string, payload: UpsertProductoMotorConfigDto) {
    return this.service.upsertDigitalProductMotorConfig(auth, productoId, payload);
  }

  async getVariantOverride(_auth: CurrentAuth, _varianteId: string) {
    throw new BadRequestException('impresion_digital_laser@2 no usa overrides por variante en piloto.');
  }

  async upsertVariantOverride(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: UpsertVarianteMotorOverrideDto,
  ) {
    throw new BadRequestException('impresion_digital_laser@2 no usa overrides por variante en piloto.');
  }

  async previewVariant(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: PreviewImposicionProductoVarianteDto,
  ) {
    throw new BadRequestException('impresion_digital_laser@2 preview no implementado en piloto.');
  }

  async quoteVariant(
    auth: CurrentAuth,
    varianteId: string,
    payload: CotizarProductoVarianteDto,
  ): Promise<CotizacionCanonica> {
    const periodo = String(payload.periodo ?? '2026-04');
    const cantidad = Math.max(1, Math.floor(Number(payload.cantidad ?? 1)));

    const runtime = await this.service.loadDigitalV2Runtime(auth, varianteId, periodo);
    const config = runtime.config as DigitalConfigParametros;
    const variante = runtime.variante;

    // Resolver selecciones técnicas (caras + tipoImpresion) desde seleccionesBase
    // o defaults del producto/variante/config.
    const selecciones = new Map(
      (payload.seleccionesBase ?? []).map((s) => [String(s.dimension), String(s.valor)]),
    );
    const carasRaw =
      selecciones.get('caras') ??
      (String(variante.caras ?? '').toLowerCase() ||
        config.carasDefault ||
        CONFIG_DEFAULTS.carasDefault);
    const caras = carasRaw.toLowerCase() as 'simple_faz' | 'doble_faz';
    const tipoImpresionRaw =
      selecciones.get('tipo_impresion') ??
      selecciones.get('tipoImpresion') ??
      (String(variante.tipoImpresion ?? '') ||
        config.tipoImpresionDefault ||
        CONFIG_DEFAULTS.tipoImpresionDefault);
    const tipoImpresion = tipoImpresionRaw.toUpperCase() as 'CMYK' | 'BN';
    const esDobleFaz = caras === 'doble_faz';
    const multiplicadorCaras = esDobleFaz ? 2 : 1;

    const varianteAnchoMm = Number(variante.anchoMm);
    const varianteAltoMm = Number(variante.altoMm);
    if (!Number.isFinite(varianteAnchoMm) || !Number.isFinite(varianteAltoMm) || varianteAnchoMm <= 0 || varianteAltoMm <= 0) {
      throw new BadRequestException('La variante no tiene anchoMm/altoMm válidos.');
    }

    const pliego = config.tamanoPliegoImpresion;
    if (!pliego || !Number.isFinite(Number(pliego.anchoMm)) || !Number.isFinite(Number(pliego.altoMm))) {
      throw new BadRequestException(
        'La config v2 no declara tamanoPliegoImpresion (anchoMm/altoMm requeridos).',
      );
    }

    const demasia = Number(config.demasiaCorteMm ?? CONFIG_DEFAULTS.demasiaCorteMm);
    const lineaCorte = Number(config.lineaCorteMm ?? CONFIG_DEFAULTS.lineaCorteMm);
    const margenPerimetral = Number(
      config.margenPerimetralCorteMm ?? CONFIG_DEFAULTS.margenPerimetralCorteMm,
    );
    const gapH = Number(config.gapHorizontalMm ?? CONFIG_DEFAULTS.gapHorizontalMm);
    const gapV = Number(config.gapVerticalMm ?? CONFIG_DEFAULTS.gapVerticalMm);
    const permitirRotacion = Boolean(config.permitirRotacion ?? CONFIG_DEFAULTS.permitirRotacion);

    // La pieza en el pliego ocupa medida + demasía + línea de corte en cada lado.
    const piezaEfectivaAncho = varianteAnchoMm + 2 * (demasia + lineaCorte);
    const piezaEfectivaAlto = varianteAltoMm + 2 * (demasia + lineaCorte);
    const pliegoAncho = Number(pliego.anchoMm);
    const pliegoAlto = Number(pliego.altoMm);

    const nesting = nestOnSheet({
      piezaAnchoMm: piezaEfectivaAncho,
      piezaAltoMm: piezaEfectivaAlto,
      cantidadPiezas: cantidad,
      pliegos: [
        {
          codigo: pliego.codigo ?? 'CUSTOM',
          nombre: pliego.nombre ?? `${pliegoAncho}×${pliegoAlto}mm`,
          anchoMm: pliegoAncho,
          altoMm: pliegoAlto,
        },
      ],
      separacionHMm: gapH,
      separacionVMm: gapV,
      margenMm: margenPerimetral,
      permitirRotacion,
      criterio: 'menor_cantidad_pliegos',
    });

    if (!nesting) {
      throw new BadRequestException(
        `La pieza ${varianteAnchoMm}×${varianteAltoMm}mm (efectiva ${piezaEfectivaAncho}×${piezaEfectivaAlto}mm) no entra en el pliego ${pliegoAncho}×${pliegoAlto}mm con los márgenes configurados.`,
      );
    }

    const pliegosNecesarios = nesting.pliegosNecesarios;
    const piezasPorPliego = nesting.piezasPorPliego;

    // Paso 1: pre-prensa
    const prePrensaMin = Number(config.prePrensaSetupMin ?? CONFIG_DEFAULTS.prePrensaSetupMin);
    const prePrensaTarifa = Number(config.prePrensaTarifaHora ?? CONFIG_DEFAULTS.prePrensaTarifaHora);
    const pasoPrePrensa: PasoCotizado = {
      id: 'P01-pre_prensa',
      tipo: 'pre_prensa',
      nombre: 'Pre-prensa digital',
      costoCentroCosto: costoTiempo(prePrensaMin, prePrensaTarifa),
      costoMateriasPrimas: 0,
      cargosFlat: 0,
      trazabilidad: { setupMin: prePrensaMin, tarifaHora: prePrensaTarifa },
    };

    // Paso 2: impresión por hoja
    // D.1a.2: resolver máquina + perfil real desde configuracionesImpresion[{caras, tipo}]
    const configMatch = (runtime.configuracionesImpresion ?? []).find(
      (c: Record<string, unknown>) => {
        const tipoOk =
          !c.tipoImpresion ||
          String(c.tipoImpresion).toUpperCase() === tipoImpresion;
        const carasOk = !c.caras || String(c.caras).toLowerCase() === caras;
        return tipoOk && carasOk;
      },
    );
    const maquinaReal = configMatch ? runtime.maquinaById.get(String(configMatch.maquinaId)) : null;
    const perfilReal = configMatch ? runtime.perfilById.get(String(configMatch.perfilOperativoId)) : null;

    const impresionSetup =
      perfilReal?.setupMin != null
        ? Number(perfilReal.setupMin)
        : Number(config.impresionSetupMin ?? CONFIG_DEFAULTS.impresionSetupMin);
    // Productividad del perfil real (pliegos/hora), fallback al config/default.
    const pliegosPorHora =
      perfilReal?.productivityValue != null && Number(perfilReal.productivityValue) > 0
        ? Number(perfilReal.productivityValue)
        : Number(config.impresionPliegosPorHora ?? CONFIG_DEFAULTS.impresionPliegosPorHora);
    // Tarifa del centro de costo de la máquina en el período (si no, fallback al config/default).
    const centroCostoId = maquinaReal?.centroCostoPrincipal?.id ?? null;
    const tarifaReal = centroCostoId ? runtime.tarifaByCentro.get(centroCostoId) : undefined;
    const impresionTarifa =
      tarifaReal != null && tarifaReal > 0
        ? tarifaReal
        : Number(config.impresionTarifaHora ?? CONFIG_DEFAULTS.impresionTarifaHora);

    const clicsPorPliego = Number(config.impresionClicsPorPliego ?? CONFIG_DEFAULTS.impresionClicsPorPliego);
    const costoClic = tipoImpresion === 'BN'
      ? Number(config.impresionCostoClicBN ?? CONFIG_DEFAULTS.impresionCostoClicBN)
      : Number(config.impresionCostoClic ?? CONFIG_DEFAULTS.impresionCostoClic);
    const clicsTotales = pliegosNecesarios * clicsPorPliego * multiplicadorCaras;
    const impresionProductivoMin =
      pliegosPorHora > 0 ? ((pliegosNecesarios * multiplicadorCaras) / pliegosPorHora) * 60 : 0;
    const impresionMin = impresionSetup + impresionProductivoMin;
    const clicsCosto = roundMoney(clicsTotales * costoClic);

    // Precio del papel: prioridad (a) precioReferencia de la variante,
    // (b) config.papelPrecioPorPliego, (c) default del motor.
    const papelPrecio =
      Number(variante.papelVariante?.precioReferencia ?? 0) > 0
        ? Number(variante.papelVariante!.precioReferencia)
        : Number(config.papelPrecioPorPliego ?? CONFIG_DEFAULTS.papelPrecioPorPliego);
    const papelCosto = roundMoney(pliegosNecesarios * papelPrecio);

    const cararLabel = esDobleFaz ? 'doble faz' : 'simple faz';
    const maquinaLabel = maquinaReal?.nombre ?? '—';
    const pasoImpresion: PasoCotizado = {
      id: 'P02-impresion_por_hoja',
      tipo: 'impresion_por_hoja',
      nombre: `Impresión digital (${pliego.nombre ?? `${pliegoAncho}×${pliegoAlto}`} · ${tipoImpresion} · ${cararLabel} · ${maquinaLabel})`,
      costoCentroCosto: costoTiempo(impresionMin, impresionTarifa),
      costoMateriasPrimas: roundMoney(clicsCosto + papelCosto),
      cargosFlat: 0,
      trazabilidad: {
        caras,
        tipoImpresion,
        multiplicadorCaras,
        maquina: maquinaReal
          ? { id: maquinaReal.id, nombre: maquinaReal.nombre, fuente: 'configuracionesImpresion' }
          : { fuente: 'default' },
        perfilOperativo: perfilReal
          ? { id: perfilReal.id, nombre: perfilReal.nombre, productivityValue: Number(perfilReal.productivityValue ?? 0), setupMin: Number(perfilReal.setupMin ?? 0), fuente: 'configuracionesImpresion' }
          : { fuente: 'default' },
        tarifaHora: { valor: impresionTarifa, fuente: tarifaReal != null ? 'centroCostoTarifaPeriodo' : 'default' },
        papel: { pliegos: pliegosNecesarios, precioPorPliego: papelPrecio, costo: papelCosto, fuente: Number(variante.papelVariante?.precioReferencia ?? 0) > 0 ? 'papelVariante.precioReferencia' : 'default' },
        nesting: {
          algoritmo: 'nesting-hoja',
          pliegoElegido: nesting.pliegoElegido,
          piezasPorPliego,
          pliegosNecesarios,
          columnas: nesting.columnas,
          filas: nesting.filas,
          aprovechamientoPct: Math.round(nesting.aprovechamientoPct * 100) / 100,
          piezaEfectivaMm: { ancho: piezaEfectivaAncho, alto: piezaEfectivaAlto },
          placements: nesting.placements,
          rotada: nesting.rotada,
          alternativas: nesting.alternativas,
        },
        setupMin: impresionSetup,
        productivoMin: roundMoney(impresionProductivoMin),
        pliegosPorHora,
        clicsPorPliego,
        clicsTotales,
        costoClic,
        clicsCosto,
      },
    };

    // Paso 3: corte (por pliego, tiempo proporcional)
    const corteMinPorPliego = Number(config.corteMinPorPliego ?? CONFIG_DEFAULTS.corteMinPorPliego);
    const corteTarifa = Number(config.corteTarifaHora ?? CONFIG_DEFAULTS.corteTarifaHora);
    const corteMin = pliegosNecesarios * corteMinPorPliego;
    const pasoCorte: PasoCotizado = {
      id: 'P03-corte',
      tipo: 'corte',
      nombre: 'Corte (guillotina)',
      costoCentroCosto: costoTiempo(corteMin, corteTarifa),
      costoMateriasPrimas: 0,
      cargosFlat: 0,
      trazabilidad: { pliegos: pliegosNecesarios, minPorPliego: corteMinPorPliego, totalMin: corteMin },
    };

    // Paso 4: embalaje
    const embMinPorPieza = Number(config.embalajePorPiezaMin ?? CONFIG_DEFAULTS.embalajePorPiezaMin);
    const embTarifa = Number(config.embalajeTarifaHora ?? CONFIG_DEFAULTS.embalajeTarifaHora);
    const embPrecioBolsa = Number(config.embalajePrecioBolsa ?? CONFIG_DEFAULTS.embalajePrecioBolsa);
    const embMin = cantidad * embMinPorPieza;
    const pasoEmbalaje: PasoCotizado = {
      id: 'P04-embalaje',
      tipo: 'operacion_manual',
      nombre: 'Embalaje',
      costoCentroCosto: costoTiempo(embMin, embTarifa),
      costoMateriasPrimas: roundMoney(cantidad * embPrecioBolsa),
      cargosFlat: 0,
      trazabilidad: { cantidad, precioBolsa: embPrecioBolsa },
    };

    const pasos = [pasoPrePrensa, pasoImpresion, pasoCorte, pasoEmbalaje];
    const centroCosto = roundMoney(pasos.reduce((a, p) => a + p.costoCentroCosto, 0));
    const materiasPrimas = roundMoney(pasos.reduce((a, p) => a + p.costoMateriasPrimas, 0));
    const cargosFlat = roundMoney(pasos.reduce((a, p) => a + p.cargosFlat, 0));
    const total = roundMoney(centroCosto + materiasPrimas + cargosFlat);
    const unitario = cantidad > 0 ? roundMoney(total / cantidad) : 0;

    return {
      motorCodigo: 'impresion_digital_laser',
      motorVersion: 2,
      periodo,
      cantidad,
      total,
      unitario,
      subtotales: { centroCosto, materiasPrimas, cargosFlat },
      pasos,
      subProductos: [],
      warnings: [],
      trazabilidad: {
        varianteId,
        caras,
        tipoImpresion,
        papelVariante: {
          id: variante.papelVariante?.id ?? null,
          sku: variante.papelVariante?.sku ?? null,
        },
        pliegoImpresion: { anchoMm: pliegoAncho, altoMm: pliegoAlto, codigo: pliego.codigo ?? null },
      },
    };
  }
}

// Re-export para que tests puedan importar el tipo del resultado si lo necesitan.
export type { NestingHojaResult };
