/**
 * F1 Cartelería — Iluminación LED (docs/carteleria-configurador-diseno.md §4.2).
 *
 * La cantidad de módulos NO la carga nadie: se DERIVA de la geometría del
 * cartel y de los atributos del módulo elegido en el slot:
 *
 *   por área (backlight, light box):  N = ceil(área / (cobertura ÷ densidad))
 *   por recorrido (corpóreas):        N = ceil(perímetro / paso × densidad)
 *
 * `coberturaM2` y `pasoMm` son ATRIBUTOS DE LA VARIANTE del módulo LED (cada
 * módulo ilumina distinto), no del paso — decisión del doc §9.
 *
 * La fuente se elige sola con el selector MENOR_CAPACIDAD_QUE_CUMPLA (el de
 * la anilladora): este helper publica `watts_requeridos_led` en el JobContext
 * y el slot `fuente` lo usa como criterioInputCampo contra el atributo
 * `capacidadW` de cada fuente candidata.
 */
import type { JobContext } from './tipos';

/** Margen de seguridad sobre los watts cargados (fórmula del rubro: ×1,3). */
export const MARGEN_FUENTE = 0.3;
/** Mínimo físico de módulos: menos de 2 no ilumina parejo nada. */
export const MODULOS_MINIMOS = 2;

export interface ParamsIluminacionLed {
  /** area = sembrado en grilla por m² · recorrido = siguiendo el trazo. */
  modoSembrado: 'area' | 'recorrido';
  /** Multiplicador sobre la densidad recomendada del módulo (1 = normal). */
  densidad: number;
}

export interface AtributosModuloLed {
  /** m² que cubre un módulo (sembrado por área). */
  coberturaM2: number;
  /** mm entre módulos siguiendo el trazo (sembrado por recorrido). */
  pasoMm: number;
  /** Watts por módulo, para dimensionar la fuente. */
  wattsModulo: number;
}

export interface ResultadoIluminacionLed {
  modulos: number;
  watts: number;
  /** Watts × (1 + margen): lo que la fuente tiene que cumplir. */
  wattsRequeridos: number;
  /** Cable estimado: perímetro × 1,4 + 12 cm por módulo. */
  cableMl: number;
}

export function parsearParamsIluminacionLed(
  params: Record<string, unknown>,
): ParamsIluminacionLed {
  const modo = String(params.modoSembrado ?? 'area').toLowerCase();
  const densidad = Number(params.densidad);
  return {
    modoSembrado: modo === 'recorrido' ? 'recorrido' : 'area',
    densidad: Number.isFinite(densidad) && densidad > 0 ? densidad : 1,
  };
}

export function parsearAtributosModuloLed(
  atributos: Record<string, unknown> | null | undefined,
): AtributosModuloLed | null {
  const attrs = atributos ?? {};
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  // Claves canónicas de la plantilla (la unidad va en `unit`, no en la clave);
  // se aceptan las variantes con sufijo por datos cargados a mano.
  const coberturaM2 = num(attrs.cobertura ?? attrs.coberturaM2);
  const pasoMm = num(attrs.paso ?? attrs.pasoMm);
  const wattsModulo = num(attrs.potencia ?? attrs.wattsModulo ?? attrs.watts);
  if (!coberturaM2 && !pasoMm) return null;
  return { coberturaM2, pasoMm, wattsModulo };
}

/**
 * Área y perímetro del cartel: overrides del configurador primero, y después
 * la medida VISIBLE (los LEDs se siembran sobre el cartel terminado — la
 * demasía de tensado de la lona no suma módulos).
 */
function geometriaCartel(
  jobContext: JobContext,
): { areaM2: number; perimetroM: number } | null {
  // `piezaAreaTotalM2`/`piezaPerimetroTotalM` describen el MATERIAL y el motor
  // los recalcula cuando un paso PRE muta las piezas (demasía de tensado):
  // ahí dejan de servir como geometría del cartel y se cae a la visible.
  const huboMutacion = (jobContext.mutacionesAplicadas?.length ?? 0) > 0;
  const areaOverride = huboMutacion
    ? 0
    : Number(jobContext.piezaAreaTotalM2 ?? 0);
  const perimetroOverride = huboMutacion
    ? 0
    : Number(jobContext.piezaPerimetroTotalM ?? 0);
  const pieza =
    jobContext.medidaVisibleMm ??
    jobContext.piezasVisibles?.[0] ??
    jobContext.medidaCustomMm ??
    jobContext.piezas?.[0] ??
    null;
  const anchoM = Number(pieza?.anchoMm ?? 0) / 1000;
  const altoM = Number(pieza?.altoMm ?? 0) / 1000;
  const areaM2 = areaOverride > 0 ? areaOverride : anchoM * altoM;
  const perimetroM =
    perimetroOverride > 0 ? perimetroOverride : 2 * (anchoM + altoM);
  if (areaM2 <= 0 && perimetroM <= 0) return null;
  return { areaM2, perimetroM };
}

export function calcularIluminacionLed(
  jobContext: JobContext,
  params: ParamsIluminacionLed,
  modulo: AtributosModuloLed,
): ResultadoIluminacionLed | null {
  const geo = geometriaCartel(jobContext);
  if (!geo) return null;

  let modulos = 0;
  if (params.modoSembrado === 'recorrido') {
    if (!modulo.pasoMm) return null;
    modulos = Math.ceil(
      ((geo.perimetroM * 1000) / modulo.pasoMm) * params.densidad,
    );
  } else {
    if (!modulo.coberturaM2) return null;
    modulos = Math.ceil(geo.areaM2 / (modulo.coberturaM2 / params.densidad));
  }
  modulos = Math.max(MODULOS_MINIMOS, modulos);

  const watts = modulos * modulo.wattsModulo;
  return {
    modulos,
    watts,
    wattsRequeridos: watts * (1 + MARGEN_FUENTE),
    cableMl: geo.perimetroM * 1.4 + modulos * 0.12,
  };
}
