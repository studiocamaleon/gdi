/**
 * Costeo de un paso TERCERIZADO: el costo lo pone un proveedor, no el motor.
 * Puro y testeable (sin DB ni jobContext). Lo consume `ejecutarPasoTercerizado`
 * en motor.service. docs/productos-tercerizados-diseno.md §5.
 *
 * Cuatro fuentes:
 *  - `tarifa_magnitud`: costo = max(tarifa × max(magnitud, mínMag), mínCosto).
 *  - `matriz`:          lookup EXACTO por la clave de los valores de eje.
 *  - `fijo`:            costo fijo por trabajo o por unidad.
 *  - `manual`:          el proveedor cotiza CADA trabajo — el comercial carga
 *                       el monto al cotizar (`costoManual`); sin él vale el
 *                       `costoEstimado` de referencia de la config, marcado
 *                       como estimado para que la UI avise "confirmá con el
 *                       proveedor".
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
  /**
   * Sólo fuente `manual`: si el monto es la cotización REAL del proveedor
   * (`cotizado`) o el costo de referencia de la config (`estimado`). La UI
   * avisa cuando el precio salió de un estimado.
   */
  origen?: 'cotizado' | 'estimado';
};

export type ResultadoTercerizado =
  | { ok: true; costo: number; detalle: DetalleTercerizado }
  | {
      ok: false;
      error: string;
      /** Código específico del error (default del caller: tercerizado_no_resoluble). */
      codigo?: string;
      sugerencia?: string;
    };

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
  /** Fuente `manual`: lo que el proveedor cotizó para ESTE trabajo (neto). */
  costoManual?: number | null;
}): ResultadoTercerizado {
  const { fuente, config, magnitudes, seleccionMatriz, entradas } = args;

  if (fuente === 'manual') {
    const cotizado = Number(args.costoManual);
    if (Number.isFinite(cotizado) && cotizado > 0) {
      return {
        ok: true,
        costo: r2(cotizado),
        detalle: { fuente, origen: 'cotizado' },
      };
    }
    const estimado = Number(config.costoEstimado);
    if (Number.isFinite(estimado) && estimado > 0) {
      return {
        ok: true,
        costo: r2(estimado),
        detalle: { fuente, origen: 'estimado' },
      };
    }
    return {
      ok: false,
      error:
        'El proveedor cotiza este paso por trabajo y no se cargó su costo.',
      codigo: 'tercerizado_costo_manual_requerido',
      sugerencia:
        'Ingresá el costo que te cotizó el proveedor (o cargá un costo estimado de referencia en el paso del producto).',
    };
  }

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
