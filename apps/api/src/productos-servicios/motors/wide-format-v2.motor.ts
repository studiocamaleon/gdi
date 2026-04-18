/**
 * Etapa B — WideFormatMotorModuleV2
 *
 * Primer motor productivo sobre el modelo universal de costeo.
 * Cotiza vinilo adhesivo impreso UV (piloto) siguiendo la ruta de 5 pasos
 * definida en docs/etapa-B-ruta-gran-formato.md:
 *
 *   pre_prensa → impresion_por_area → laminado(opcional) → corte → embalaje
 *
 * El motor arma la shape canónica directamente (sin pasar por adapter v1).
 * Los pasos se construyen con fórmulas simples y parámetros en su mayoría
 * hardcoded en esta etapa piloto; en etapas posteriores se parametrizan
 * desde ProductoMotorConfig.
 *
 * NO reemplaza al motor v1 stub (`wide-format.motor.ts`). Se registra como
 * `gran_formato@2` en paralelo. El feature flag `ENABLE_WIDE_FORMAT_V2`
 * decide cuándo el dispatcher rutea a v2.
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

type ParametrosWideFormatV2 = {
  anchoMm?: number;
  altoMm?: number;
  conLaminado?: boolean;
};

/**
 * Parámetros default del piloto. En producción vendrán de ProductoMotorConfig;
 * hoy son literales para que el motor sea testeable y auto-contenido.
 */
const DEFAULTS = {
  prePrensaSetupMin: 15,
  prePrensaTarifaHora: 3500, // placeholder — en prod sale del centro de costo
  impresionSetupMin: 5,
  impresionProductividadM2h: 4,
  impresionTarifaHora: 8000,
  impresionMermaPct: 0.05,
  sustratoPrecioM2: 4800,
  tintaMlPorM2: 15,
  tintaPrecioMl: 2.5,
  laminadoSetupMin: 3,
  laminadoProductividadM2h: 20,
  laminadoTarifaHora: 6000,
  laminadoMermaPct: 0.05,
  laminadoFilmPrecioM2: 1800,
  cortePorPiezaMin: 2,
  // Corte perimetral manual/cutter — no es guillotina. Tarifa de operario con herramienta.
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

  // Los métodos de config delegan al v1 por ahora — durante el piloto
  // no construimos un configurador nuevo; eso viene en etapa posterior.
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
    _auth: CurrentAuth,
    varianteId: string,
    payload: CotizarProductoVarianteDto,
  ): Promise<CotizacionCanonica> {
    const cantidad = Math.max(1, Math.floor(Number(payload.cantidad ?? 1)));
    const periodo = String(payload.periodo ?? '2026-04');
    const params = (payload.parametros ?? {}) as ParametrosWideFormatV2;
    const anchoMm = Number(params.anchoMm ?? 0);
    const altoMm = Number(params.altoMm ?? 0);
    const conLaminado = Boolean(params.conLaminado ?? false);

    if (anchoMm <= 0 || altoMm <= 0) {
      throw new BadRequestException(
        'gran_formato@2: debe especificar parametros.anchoMm y parametros.altoMm mayores a 0.',
      );
    }

    // ──────────────── Cálculo por paso ────────────────
    const areaPiezaM2 = (anchoMm * altoMm) / 1_000_000;
    const areaTotalM2 = areaPiezaM2 * cantidad;
    const warnings: string[] = [];

    // Paso 1: pre_prensa
    const prePrensaMin = DEFAULTS.prePrensaSetupMin;
    const prePrensaCentro = costoTiempo(prePrensaMin, DEFAULTS.prePrensaTarifaHora);
    const pasoPrePrensa: PasoCotizado = {
      id: 'P01-pre_prensa',
      tipo: 'pre_prensa',
      nombre: 'Pre-prensa',
      costoCentroCosto: prePrensaCentro,
      costoMateriasPrimas: 0,
      cargosFlat: 0,
      trazabilidad: { setupMin: prePrensaMin, tarifaHora: DEFAULTS.prePrensaTarifaHora },
    };

    // Paso 2: impresion_por_area
    const impresionProductivoMin = (areaTotalM2 / DEFAULTS.impresionProductividadM2h) * 60;
    const impresionMin = DEFAULTS.impresionSetupMin + impresionProductivoMin;
    const impresionCentro = costoTiempo(impresionMin, DEFAULTS.impresionTarifaHora);
    const sustratoM2Consumidos = areaTotalM2 * (1 + DEFAULTS.impresionMermaPct);
    const sustratoCosto = roundMoney(sustratoM2Consumidos * DEFAULTS.sustratoPrecioM2);
    const tintaMl = areaTotalM2 * DEFAULTS.tintaMlPorM2;
    const tintaCosto = roundMoney(tintaMl * DEFAULTS.tintaPrecioMl);
    const pasoImpresion: PasoCotizado = {
      id: 'P02-impresion_por_area',
      tipo: 'impresion_por_area',
      nombre: 'Impresión UV por área',
      costoCentroCosto: impresionCentro,
      costoMateriasPrimas: roundMoney(sustratoCosto + tintaCosto),
      cargosFlat: 0,
      trazabilidad: {
        areaTotalM2: roundMoney(areaTotalM2),
        productividadM2h: DEFAULTS.impresionProductividadM2h,
        setupMin: DEFAULTS.impresionSetupMin,
        productivoMin: roundMoney(impresionProductivoMin),
        sustrato: { m2Consumidos: roundMoney(sustratoM2Consumidos), precioM2: DEFAULTS.sustratoPrecioM2, costo: sustratoCosto },
        tinta: { ml: roundMoney(tintaMl), precioMl: DEFAULTS.tintaPrecioMl, costo: tintaCosto },
      },
    };

    // Paso 3: laminado (opcional)
    let pasoLaminado: PasoCotizado | null = null;
    if (conLaminado) {
      const laminadoProductivoMin = (areaTotalM2 / DEFAULTS.laminadoProductividadM2h) * 60;
      const laminadoMin = DEFAULTS.laminadoSetupMin + laminadoProductivoMin;
      const laminadoCentro = costoTiempo(laminadoMin, DEFAULTS.laminadoTarifaHora);
      const filmM2 = areaTotalM2 * (1 + DEFAULTS.laminadoMermaPct);
      const filmCosto = roundMoney(filmM2 * DEFAULTS.laminadoFilmPrecioM2);
      pasoLaminado = {
        id: 'P03-laminado',
        tipo: 'laminado',
        nombre: 'Laminado UV',
        costoCentroCosto: laminadoCentro,
        costoMateriasPrimas: filmCosto,
        cargosFlat: 0,
        trazabilidad: {
          setupMin: DEFAULTS.laminadoSetupMin,
          productivoMin: roundMoney(laminadoProductivoMin),
          film: { m2: roundMoney(filmM2), precioM2: DEFAULTS.laminadoFilmPrecioM2, costo: filmCosto },
        },
      };
    }

    // Paso 4: corte perimetral
    const corteMin = cantidad * DEFAULTS.cortePorPiezaMin;
    const corteCentro = costoTiempo(corteMin, DEFAULTS.corteTarifaHora);
    const pasoCorte: PasoCotizado = {
      id: 'P04-corte',
      tipo: 'corte',
      nombre: 'Corte perimetral',
      costoCentroCosto: corteCentro,
      costoMateriasPrimas: 0,
      cargosFlat: 0,
      trazabilidad: { cantidad, minPorPieza: DEFAULTS.cortePorPiezaMin, totalMin: corteMin },
    };

    // Paso 5: embalaje
    const embalajeMin = cantidad * DEFAULTS.embalajePorPiezaMin;
    const embalajeCentro = costoTiempo(embalajeMin, DEFAULTS.embalajeTarifaHora);
    const bolsasCosto = roundMoney(cantidad * DEFAULTS.embalajePrecioBolsa);
    const pasoEmbalaje: PasoCotizado = {
      id: 'P05-embalaje',
      tipo: 'operacion_manual',
      nombre: 'Embalaje individual',
      costoCentroCosto: embalajeCentro,
      costoMateriasPrimas: bolsasCosto,
      cargosFlat: 0,
      trazabilidad: { cantidad, bolsas: cantidad, precioBolsa: DEFAULTS.embalajePrecioBolsa },
    };

    // ────────────── Agregación ──────────────
    const pasos: PasoCotizado[] = [
      pasoPrePrensa,
      pasoImpresion,
      ...(pasoLaminado ? [pasoLaminado] : []),
      pasoCorte,
      pasoEmbalaje,
    ];

    const centroCosto = roundMoney(
      pasos.reduce((acc, p) => acc + p.costoCentroCosto, 0),
    );
    const materiasPrimas = roundMoney(
      pasos.reduce((acc, p) => acc + p.costoMateriasPrimas, 0),
    );
    const cargosFlat = roundMoney(
      pasos.reduce((acc, p) => acc + p.cargosFlat, 0),
    );
    const total = roundMoney(centroCosto + materiasPrimas + cargosFlat);
    const unitario = cantidad > 0 ? roundMoney(total / cantidad) : 0;

    return {
      motorCodigo: 'gran_formato',
      motorVersion: 2,
      periodo,
      cantidad,
      total,
      unitario,
      subtotales: { centroCosto, materiasPrimas, cargosFlat },
      pasos,
      subProductos: [],
      warnings,
      trazabilidad: {
        varianteId,
        anchoMm,
        altoMm,
        areaPiezaM2: roundMoney(areaPiezaM2),
        areaTotalM2: roundMoney(areaTotalM2),
        conLaminado,
        defaultsUsados: DEFAULTS,
      },
    };
  }
}
