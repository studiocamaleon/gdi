import { BadRequestException } from '@nestjs/common';
import type { PrecioConfig } from './aplicar-precio.types';

const METODOS_PRECIO = [
  'por_margen',
  'precio_fijo',
  'precio_fijo_para_margen_minimo',
  'margen_variable',
  'fijado_por_cantidad',
  'fijo_con_margen_variable',
  'variable_por_cantidad',
] as const;

export const ESTRATEGIAS_PRICING_COMPUESTO = [
  'GENERAL',
  'POR_COMPONENTE',
  'MIXTO',
] as const;

export type EstrategiaPricingCompuesto =
  (typeof ESTRATEGIAS_PRICING_COMPUESTO)[number];

export const MODOS_PRICING_COMPONENTE = [
  'HEREDAR_PADRE',
  'USAR_PRODUCTO_HIJO',
  'OVERRIDE',
] as const;

export type ModoPricingComponente = (typeof MODOS_PRICING_COMPONENTE)[number];

export type ConfiguracionPricingCompuesto = {
  version: 1;
  estrategia: EstrategiaPricingCompuesto;
};

/**
 * Configuración editable de una ocurrencia BOM. Vive dentro de
 * `ProductoRecetaComponente.configuracionJson.pricing` y, al publicar, el
 * servicio reemplazará la referencia mutable por su snapshot efectivo.
 */
export type PoliticaPricingComponente = {
  version: 1;
  modo: ModoPricingComponente;
  precioConfigOverride?: PrecioConfig;
  precioConfigSnapshot?: PrecioConfig;
};

export type DesgloseCostosPricingCompuesto = {
  version: 1;
  estrategia: EstrategiaPricingCompuesto;
  bloqueGeneral: { costoTotal: number };
  componentes: Array<{
    productoId: string;
    codigo: string;
    nombre: string;
    costoTotal: number;
    politica: PoliticaPricingComponente;
    incluidoEnBloqueGeneral: boolean;
  }>;
  costoTotalAsignado: number;
};

const CONFIG_GENERAL: ConfiguracionPricingCompuesto = {
  version: 1,
  estrategia: 'GENERAL',
};

const POLITICA_HEREDADA: PoliticaPricingComponente = {
  version: 1,
  modo: 'HEREDAR_PADRE',
};

function esRegistro(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function esPrecioConfig(value: unknown): value is PrecioConfig {
  return (
    esRegistro(value) &&
    METODOS_PRECIO.includes(
      value.metodoCalculo as (typeof METODOS_PRECIO)[number],
    ) &&
    esRegistro(value.detalle)
  );
}

function copiarRegistro(value: unknown): Record<string, unknown> {
  return esRegistro(value) ? { ...value } : {};
}

/** Lectura tolerante: todo producto previo a F4.3 conserva modo GENERAL. */
export function leerConfiguracionPricingCompuesto(
  precioConfigJson: unknown,
): ConfiguracionPricingCompuesto {
  if (!esRegistro(precioConfigJson) || precioConfigJson.compuesto == null) {
    return CONFIG_GENERAL;
  }
  const compuesto = precioConfigJson.compuesto;
  if (
    !esRegistro(compuesto) ||
    compuesto.version !== 1 ||
    !ESTRATEGIAS_PRICING_COMPUESTO.includes(
      compuesto.estrategia as EstrategiaPricingCompuesto,
    )
  ) {
    return CONFIG_GENERAL;
  }
  return {
    version: 1,
    estrategia: compuesto.estrategia as EstrategiaPricingCompuesto,
  };
}

export function validarConfiguracionPricingCompuesto(
  precioConfigJson: unknown,
): void {
  if (!esRegistro(precioConfigJson) || precioConfigJson.compuesto == null) {
    return;
  }
  const compuesto = precioConfigJson.compuesto;
  if (
    !esRegistro(compuesto) ||
    compuesto.version !== 1 ||
    !ESTRATEGIAS_PRICING_COMPUESTO.includes(
      compuesto.estrategia as EstrategiaPricingCompuesto,
    )
  ) {
    throw new BadRequestException(
      'La estrategia de pricing compuesto no tiene un formato válido.',
    );
  }
}

/** Lectura tolerante: toda relación BOM histórica hereda del padre. */
export function leerPoliticaPricingComponente(
  configuracionJson: unknown,
): PoliticaPricingComponente {
  if (!esRegistro(configuracionJson) || configuracionJson.pricing == null) {
    return POLITICA_HEREDADA;
  }
  const pricing = configuracionJson.pricing;
  if (
    !esRegistro(pricing) ||
    pricing.version !== 1 ||
    !MODOS_PRICING_COMPONENTE.includes(pricing.modo as ModoPricingComponente)
  ) {
    return POLITICA_HEREDADA;
  }
  return {
    version: 1,
    modo: pricing.modo as ModoPricingComponente,
    ...(esPrecioConfig(pricing.precioConfigOverride)
      ? { precioConfigOverride: pricing.precioConfigOverride }
      : {}),
    ...(esPrecioConfig(pricing.precioConfigSnapshot)
      ? { precioConfigSnapshot: pricing.precioConfigSnapshot }
      : {}),
  };
}

/** Valida sólo decisiones explícitas; ausencia equivale a compatibilidad. */
export function validarPoliticaPricingComponente(
  configuracionJson: unknown,
  componenteNombre: string,
): void {
  if (!esRegistro(configuracionJson) || configuracionJson.pricing == null) {
    return;
  }
  const pricing = configuracionJson.pricing;
  if (
    !esRegistro(pricing) ||
    pricing.version !== 1 ||
    !MODOS_PRICING_COMPONENTE.includes(pricing.modo as ModoPricingComponente)
  ) {
    throw new BadRequestException(
      `La política de pricing de "${componenteNombre}" no tiene un formato válido.`,
    );
  }
  if (
    pricing.modo === 'OVERRIDE' &&
    !esPrecioConfig(pricing.precioConfigOverride)
  ) {
    throw new BadRequestException(
      `El componente "${componenteNombre}" requiere una configuración de precio para usar override.`,
    );
  }
}

/**
 * Materializa la regla mutable elegida por la relación BOM en un snapshot.
 * Al releer una revisión publicada se conserva el snapshot existente; durante
 * la edición/publicación de un borrador puede pedirse su actualización.
 */
export function congelarPoliticaPricingComponente(args: {
  configuracionJson: unknown;
  precioConfigHijo: unknown;
  actualizarSnapshot: boolean;
  componenteNombre: string;
}): unknown {
  const configuracion = copiarRegistro(args.configuracionJson);
  const politica = leerPoliticaPricingComponente(configuracion);
  if (politica.modo === 'HEREDAR_PADRE') return args.configuracionJson;

  if (
    !args.actualizarSnapshot &&
    esPrecioConfig(politica.precioConfigSnapshot)
  ) {
    return args.configuracionJson;
  }

  const precioConfigSnapshot =
    politica.modo === 'OVERRIDE'
      ? politica.precioConfigOverride
      : args.precioConfigHijo;
  if (!esPrecioConfig(precioConfigSnapshot)) {
    throw new BadRequestException(
      politica.modo === 'USAR_PRODUCTO_HIJO'
        ? `El componente "${args.componenteNombre}" no tiene una regla de precio vigente para congelar.`
        : `El override de "${args.componenteNombre}" no tiene una regla de precio válida.`,
    );
  }

  return {
    ...configuracion,
    pricing: {
      version: 1,
      modo: politica.modo,
      ...(politica.modo === 'OVERRIDE'
        ? { precioConfigOverride: politica.precioConfigOverride }
        : {}),
      precioConfigSnapshot,
    },
  };
}

/** Separa costos sin aplicar aún margen, impuestos, comisión ni descuento. */
export function asignarCostosPricingCompuesto(args: {
  precioConfigPadre: unknown;
  costoTotal: number;
  componentes: Array<{
    productoId: string;
    codigo: string;
    nombre: string;
    costoTotal: number;
    politica: PoliticaPricingComponente;
  }>;
}): DesgloseCostosPricingCompuesto {
  const { estrategia } = leerConfiguracionPricingCompuesto(
    args.precioConfigPadre,
  );
  const componentes = args.componentes.map((componente) => ({
    ...componente,
    incluidoEnBloqueGeneral:
      estrategia === 'GENERAL' || componente.politica.modo === 'HEREDAR_PADRE',
  }));
  const costoBloquesPropios = componentes.reduce(
    (total, componente) =>
      total + (componente.incluidoEnBloqueGeneral ? 0 : componente.costoTotal),
    0,
  );
  const costoBloqueGeneral = Math.max(0, args.costoTotal - costoBloquesPropios);

  return {
    version: 1,
    estrategia,
    bloqueGeneral: { costoTotal: costoBloqueGeneral },
    componentes,
    costoTotalAsignado: costoBloqueGeneral + costoBloquesPropios,
  };
}
