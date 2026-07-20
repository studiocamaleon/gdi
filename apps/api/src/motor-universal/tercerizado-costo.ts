/**
 * Costeo de un paso TERCERIZADO: el costo lo pone un proveedor, no el motor.
 * Puro y testeable (sin DB ni jobContext). Lo consume `ejecutarPasoTercerizado`
 * en motor.service. docs/productos-tercerizados-diseno.md §5.
 *
 * Tres fuentes:
 *  - `tarifa_magnitud`: costo = max(tarifa × max(magnitud, mínMag), mínCosto).
 *  - `matriz`:          lookup EXACTO por la clave de los valores de eje.
 *  - `fijo`:            costo fijo por trabajo o por unidad.
 */

export type EntradaMatriz = {
  claveMatch: string;
  cantidad: number;
  costo: number;
};

/** Magnitudes del trabajo ya resueltas desde el jobContext. */
export type MagnitudesJob = {
  area_m2?: number | null;
  perimetro_ml?: number | null;
  ml?: number | null;
  cantidad?: number | null;
};

export type DetalleTercerizado = {
  fuente: string;
  magnitud?: string;
  valorMagnitud?: number;
  tarifa?: number;
  entradaClave?: string;
};

export type ResultadoTercerizado =
  | { ok: true; costo: number; detalle: DetalleTercerizado }
  | { ok: false; error: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Cantidad comercial saneada (mínimo 1). */
function cantidadDe(m: MagnitudesJob): number {
  const n = m.cantidad ?? 0;
  return n > 0 ? n : 1;
}

/** Magnitud pedida por `tarifa_magnitud`. Null = no resoluble. */
export function resolverMagnitud(
  magnitud: string,
  m: MagnitudesJob,
): number | null {
  switch (magnitud) {
    case 'area_m2':
      return m.area_m2 ?? null;
    case 'perimetro_ml':
      return m.perimetro_ml ?? null;
    case 'ml':
      return m.ml ?? null;
    case 'cantidad':
      return cantidadDe(m);
    default:
      return null;
  }
}

/** Clave canónica de la matriz: valores de eje en orden, unidos por '|'. */
export function construirClaveMatch(
  ejes: Array<{ clave: string; orden?: number }>,
  seleccion: Record<string, unknown>,
): string | null {
  const ordenados = [...ejes].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const partes: string[] = [];
  for (const eje of ordenados) {
    const v = seleccion[eje.clave];
    if (v == null || v === '') return null;
    partes.push(String(v));
  }
  return partes.length > 0 ? partes.join('|') : null;
}

export function resolverCostoTercerizado(args: {
  fuente: string;
  config: Record<string, unknown>;
  magnitudes: MagnitudesJob;
  seleccionMatriz: Record<string, unknown>;
  entradas: EntradaMatriz[];
}): ResultadoTercerizado {
  const { fuente, config, magnitudes, seleccionMatriz, entradas } = args;

  if (fuente === 'fijo') {
    const costoBase = Number(config.costo ?? 0);
    const cantidad = config.por === 'unidad' ? cantidadDe(magnitudes) : 1;
    return { ok: true, costo: r2(costoBase * cantidad), detalle: { fuente } };
  }

  if (fuente === 'tarifa_magnitud') {
    const magnitud = String(config.magnitud ?? '');
    const tarifa = Number(config.tarifa ?? 0);
    const minMag = config.minimoMagnitud != null ? Number(config.minimoMagnitud) : 0;
    const minCosto = config.minimoCosto != null ? Number(config.minimoCosto) : 0;
    const bruto = resolverMagnitud(magnitud, magnitudes);
    if (bruto == null) {
      return { ok: false, error: `No se pudo resolver la magnitud "${magnitud}".` };
    }
    const valor = Math.max(bruto, minMag);
    return {
      ok: true,
      costo: r2(Math.max(tarifa * valor, minCosto)),
      detalle: { fuente, magnitud, valorMagnitud: r2(valor), tarifa },
    };
  }

  if (fuente === 'matriz') {
    const ejes = (config.ejes as Array<{ clave: string; orden?: number }>) ?? [];
    const claveMatch = construirClaveMatch(ejes, seleccionMatriz);
    if (claveMatch == null) {
      return {
        ok: false,
        error: 'Faltan valores para la combinación del producto tercerizado.',
      };
    }
    const entrada = entradas.find((e) => e.claveMatch === claveMatch);
    if (!entrada) {
      return {
        ok: false,
        error: 'La combinación elegida no está en la lista del proveedor.',
      };
    }
    return { ok: true, costo: r2(entrada.costo), detalle: { fuente, entradaClave: claveMatch } };
  }

  return { ok: false, error: `Fuente de costo tercerizado no soportada: "${fuente}".` };
}
