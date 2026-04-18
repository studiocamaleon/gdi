/**
 * Etapa C.6 — TalonarioMotorModuleV2
 *
 * Motor talonario@2 del modelo universal. Cotiza talonarios numerados
 * (recibos, remitos, órdenes) con impresión en pliego + encuadernación.
 *
 * Pipeline: pre_prensa → impresion_por_hoja (con nesting-hoja) →
 * encuadernado → embalaje.
 *
 * Piloto MVP: maneja COPIA_SIMPLE (1 capa / hoja por formulario). Multi-copia
 * (duplicado/triplicado con papel autocopiativo) se agrega en iteraciones
 * posteriores.
 *
 * El input clave es:
 *   payload.cantidad        → cantidad de talonarios a producir
 *   params.numerosXTalonario → cuántos formularios numerados por talonario
 *     (si no se pasa, usa numerosXTalonarioDefault de la config)
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
import { nestOnSheet } from '../nesting/nesting-hoja';

type ParametrosTalonarioV2 = {
  numerosXTalonario?: number;
};

type TalonarioConfigParametros = {
  tamanoPliegoImpresion?: { anchoMm: number; altoMm: number; codigo?: string; nombre?: string };
  demasiaCorteMm?: number;
  lineaCorteMm?: number;
  margenPerimetralCorteMm?: number;
  gapHorizontalMm?: number;
  gapVerticalMm?: number;
  permitirRotacion?: boolean;
  numerosXTalonarioDefault?: number;
  tipoCopiaDefiniciones?: Array<{ valor: string; capas: number }>;
  encuadernacion?: { tipo?: string; cantidadGrapas?: number; bordeEncolar?: string | null };
  mermaAdicionalPct?: number;
  prePrensaSetupMin?: number;
  prePrensaTarifaHora?: number;
  impresionSetupMin?: number;
  impresionPliegosPorHora?: number;
  impresionTarifaHora?: number;
  impresionClicsPorPliego?: number;
  impresionCostoClic?: number;
  papelPrecioPorPliego?: number;
  encuadernacionMinPorTalonario?: number;
  encuadernacionTarifaHora?: number;
  encuadernacionInsumosPorTalonario?: number;
  embalajePorTalonarioMin?: number;
  embalajeTarifaHora?: number;
  embalajePrecioBolsa?: number;
};

const CONFIG_DEFAULTS = {
  demasiaCorteMm: 0,
  lineaCorteMm: 3,
  margenPerimetralCorteMm: 3,
  gapHorizontalMm: 0,
  gapVerticalMm: 0,
  permitirRotacion: true,
  numerosXTalonarioDefault: 50,
  prePrensaSetupMin: 15,
  prePrensaTarifaHora: 3500,
  impresionSetupMin: 5,
  impresionPliegosPorHora: 1500,
  impresionTarifaHora: 4500,
  impresionClicsPorPliego: 1,
  impresionCostoClic: 25,
  papelPrecioPorPliego: 25,
  encuadernacionMinPorTalonario: 2,
  encuadernacionTarifaHora: 2500,
  encuadernacionInsumosPorTalonario: 30, // carton base + grapas/engomado
  embalajePorTalonarioMin: 0.5,
  embalajeTarifaHora: 2500,
  embalajePrecioBolsa: 20,
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function costoTiempo(min: number, tarifaHora: number): number {
  return roundMoney((min / 60) * tarifaHora);
}

export class TalonarioMotorModuleV2 implements ProductMotorModule {
  constructor(private readonly service: ProductosServiciosService) {}

  getDefinition(): ProductMotorDefinition {
    return {
      code: 'talonario',
      version: 2,
      label: 'Talonario (modelo universal) · v2',
      category: 'talonario',
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
    throw new BadRequestException('talonario@2 no usa overrides por variante en piloto.');
  }

  async upsertVariantOverride(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: UpsertVarianteMotorOverrideDto,
  ) {
    throw new BadRequestException('talonario@2 no usa overrides por variante en piloto.');
  }

  async previewVariant(
    _auth: CurrentAuth,
    _varianteId: string,
    _payload: PreviewImposicionProductoVarianteDto,
  ) {
    throw new BadRequestException('talonario@2 preview no implementado en piloto.');
  }

  async quoteVariant(
    auth: CurrentAuth,
    varianteId: string,
    payload: CotizarProductoVarianteDto,
  ): Promise<CotizacionCanonica> {
    const periodo = String(payload.periodo ?? '2026-04');
    const cantidadTalonarios = Math.max(1, Math.floor(Number(payload.cantidad ?? 1)));
    const params = (payload.parametros ?? {}) as ParametrosTalonarioV2;

    const runtime = await this.service.loadTalonarioV2Runtime(auth, varianteId);
    const variante = runtime.variante;
    const config = runtime.config as TalonarioConfigParametros;

    const varianteAnchoMm = Number(variante.anchoMm);
    const varianteAltoMm = Number(variante.altoMm);
    if (!Number.isFinite(varianteAnchoMm) || !Number.isFinite(varianteAltoMm) || varianteAnchoMm <= 0 || varianteAltoMm <= 0) {
      throw new BadRequestException('La variante no tiene anchoMm/altoMm válidos.');
    }

    const numerosXTalonario = Math.max(
      1,
      Math.floor(
        Number(
          params.numerosXTalonario ??
            config.numerosXTalonarioDefault ??
            CONFIG_DEFAULTS.numerosXTalonarioDefault,
        ),
      ),
    );

    // Piloto MVP: COPIA_SIMPLE (1 capa). Multi-copia se agrega en iteración.
    const tipoCopiaDef = Array.isArray(config.tipoCopiaDefiniciones)
      ? config.tipoCopiaDefiniciones.find((t) => t.valor === 'COPIA_SIMPLE') ?? config.tipoCopiaDefiniciones[0]
      : null;
    const capas = Number(tipoCopiaDef?.capas ?? 1);
    const warnings: string[] = [];
    if (capas > 1) {
      warnings.push(
        `Piloto MVP solo maneja COPIA_SIMPLE; se detectó ${capas} capas — se asume 1 capa para el cálculo.`,
      );
    }
    const capasEfectivas = 1;

    const pliego = config.tamanoPliegoImpresion;
    if (!pliego || !Number.isFinite(Number(pliego.anchoMm)) || !Number.isFinite(Number(pliego.altoMm))) {
      throw new BadRequestException(
        'La config v2 no declara tamanoPliegoImpresion (anchoMm/altoMm requeridos).',
      );
    }

    // Cada talonario tiene numerosXTalonario formularios. Cada formulario es
    // una pieza del tamaño de la variante. Total de piezas (formularios) a
    // imprimir = cantidad talonarios × números por talonario × capas.
    const totalFormularios = cantidadTalonarios * numerosXTalonario * capasEfectivas;

    const demasia = Number(config.demasiaCorteMm ?? CONFIG_DEFAULTS.demasiaCorteMm);
    const lineaCorte = Number(config.lineaCorteMm ?? CONFIG_DEFAULTS.lineaCorteMm);
    const margenPerimetral = Number(
      config.margenPerimetralCorteMm ?? CONFIG_DEFAULTS.margenPerimetralCorteMm,
    );
    const gapH = Number(config.gapHorizontalMm ?? CONFIG_DEFAULTS.gapHorizontalMm);
    const gapV = Number(config.gapVerticalMm ?? CONFIG_DEFAULTS.gapVerticalMm);
    const permitirRotacion = Boolean(config.permitirRotacion ?? CONFIG_DEFAULTS.permitirRotacion);

    const piezaEfectivaAncho = varianteAnchoMm + 2 * (demasia + lineaCorte);
    const piezaEfectivaAlto = varianteAltoMm + 2 * (demasia + lineaCorte);
    const pliegoAncho = Number(pliego.anchoMm);
    const pliegoAlto = Number(pliego.altoMm);

    const nesting = nestOnSheet({
      piezaAnchoMm: piezaEfectivaAncho,
      piezaAltoMm: piezaEfectivaAlto,
      cantidadPiezas: totalFormularios,
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
        `La pieza ${varianteAnchoMm}×${varianteAltoMm}mm no entra en pliego ${pliegoAncho}×${pliegoAlto}mm con los márgenes configurados.`,
      );
    }

    const pliegosNecesarios = nesting.pliegosNecesarios;
    const piezasPorPliego = nesting.piezasPorPliego;

    // Paso 1: pre-prensa (incluye preparación de numeración)
    const prePrensaMin = Number(config.prePrensaSetupMin ?? CONFIG_DEFAULTS.prePrensaSetupMin);
    const prePrensaTarifa = Number(config.prePrensaTarifaHora ?? CONFIG_DEFAULTS.prePrensaTarifaHora);
    const pasoPrePrensa: PasoCotizado = {
      id: 'P01-pre_prensa',
      tipo: 'pre_prensa',
      nombre: 'Pre-prensa (con numeración)',
      costoCentroCosto: costoTiempo(prePrensaMin, prePrensaTarifa),
      costoMateriasPrimas: 0,
      cargosFlat: 0,
      trazabilidad: { setupMin: prePrensaMin, tarifaHora: prePrensaTarifa },
    };

    // Paso 2: impresión
    const impSetup = Number(config.impresionSetupMin ?? CONFIG_DEFAULTS.impresionSetupMin);
    const pliegosPorHora = Number(
      config.impresionPliegosPorHora ?? CONFIG_DEFAULTS.impresionPliegosPorHora,
    );
    const impTarifa = Number(config.impresionTarifaHora ?? CONFIG_DEFAULTS.impresionTarifaHora);
    const clicsPorPliego = Number(config.impresionClicsPorPliego ?? CONFIG_DEFAULTS.impresionClicsPorPliego);
    const costoClic = Number(config.impresionCostoClic ?? CONFIG_DEFAULTS.impresionCostoClic);
    const impProductivoMin = pliegosPorHora > 0 ? (pliegosNecesarios / pliegosPorHora) * 60 : 0;
    const impMin = impSetup + impProductivoMin;
    const clicsCosto = roundMoney(pliegosNecesarios * clicsPorPliego * costoClic);
    const papelPrecio = Number(config.papelPrecioPorPliego ?? CONFIG_DEFAULTS.papelPrecioPorPliego);
    const papelCosto = roundMoney(pliegosNecesarios * papelPrecio);

    const pasoImpresion: PasoCotizado = {
      id: 'P02-impresion_por_hoja',
      tipo: 'impresion_por_hoja',
      nombre: `Impresión (${pliego.nombre ?? `${pliegoAncho}×${pliegoAlto}`})`,
      costoCentroCosto: costoTiempo(impMin, impTarifa),
      costoMateriasPrimas: roundMoney(clicsCosto + papelCosto),
      cargosFlat: 0,
      trazabilidad: {
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
        },
        talonarios: {
          cantidad: cantidadTalonarios,
          numerosXTalonario,
          capas: capasEfectivas,
          totalFormularios,
        },
        setupMin: impSetup,
        productivoMin: roundMoney(impProductivoMin),
        pliegosPorHora,
        clicsCosto,
        papel: { pliegos: pliegosNecesarios, precioPorPliego: papelPrecio, costo: papelCosto },
      },
    };

    // Paso 3: encuadernación
    const encMin = Number(
      config.encuadernacionMinPorTalonario ?? CONFIG_DEFAULTS.encuadernacionMinPorTalonario,
    );
    const encTarifa = Number(config.encuadernacionTarifaHora ?? CONFIG_DEFAULTS.encuadernacionTarifaHora);
    const encInsumos = Number(
      config.encuadernacionInsumosPorTalonario ?? CONFIG_DEFAULTS.encuadernacionInsumosPorTalonario,
    );
    const encTotalMin = cantidadTalonarios * encMin;
    const encTipo = config.encuadernacion?.tipo ?? 'emblocado';
    const pasoEncuadernacion: PasoCotizado = {
      id: 'P03-encuadernado',
      tipo: 'encuadernado',
      nombre: `Encuadernado (${encTipo})`,
      costoCentroCosto: costoTiempo(encTotalMin, encTarifa),
      costoMateriasPrimas: roundMoney(cantidadTalonarios * encInsumos),
      cargosFlat: 0,
      trazabilidad: {
        tipo: encTipo,
        minPorTalonario: encMin,
        cantidadTalonarios,
        insumosPorTalonario: encInsumos,
      },
    };

    // Paso 4: embalaje
    const embMin = Number(config.embalajePorTalonarioMin ?? CONFIG_DEFAULTS.embalajePorTalonarioMin);
    const embTarifa = Number(config.embalajeTarifaHora ?? CONFIG_DEFAULTS.embalajeTarifaHora);
    const embPrecioBolsa = Number(config.embalajePrecioBolsa ?? CONFIG_DEFAULTS.embalajePrecioBolsa);
    const embTotalMin = cantidadTalonarios * embMin;
    const pasoEmbalaje: PasoCotizado = {
      id: 'P04-embalaje',
      tipo: 'operacion_manual',
      nombre: 'Embalaje',
      costoCentroCosto: costoTiempo(embTotalMin, embTarifa),
      costoMateriasPrimas: roundMoney(cantidadTalonarios * embPrecioBolsa),
      cargosFlat: 0,
      trazabilidad: { cantidadTalonarios, precioBolsa: embPrecioBolsa },
    };

    const pasos = [pasoPrePrensa, pasoImpresion, pasoEncuadernacion, pasoEmbalaje];
    const centroCosto = roundMoney(pasos.reduce((a, p) => a + p.costoCentroCosto, 0));
    const materiasPrimas = roundMoney(pasos.reduce((a, p) => a + p.costoMateriasPrimas, 0));
    const cargosFlat = roundMoney(pasos.reduce((a, p) => a + p.cargosFlat, 0));
    const total = roundMoney(centroCosto + materiasPrimas + cargosFlat);
    const unitario = cantidadTalonarios > 0 ? roundMoney(total / cantidadTalonarios) : 0;

    return {
      motorCodigo: 'talonario',
      motorVersion: 2,
      periodo,
      cantidad: cantidadTalonarios,
      total,
      unitario,
      subtotales: { centroCosto, materiasPrimas, cargosFlat },
      pasos,
      subProductos: [],
      warnings,
      trazabilidad: {
        varianteId,
        numerosXTalonario,
        tipoCopia: tipoCopiaDef?.valor ?? 'COPIA_SIMPLE',
        capas: capasEfectivas,
        totalFormularios,
        pliegoImpresion: { anchoMm: pliegoAncho, altoMm: pliegoAlto, codigo: pliego.codigo ?? null },
      },
    };
  }
}
