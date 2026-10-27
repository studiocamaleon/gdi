import type { JobContext } from './tipos';
import type { ResultadoDerivador } from './derivadores/tipos';

const numero = (valor: unknown): number =>
  typeof valor === 'number' || typeof valor === 'string'
    ? Number(String(valor).trim().replace(',', '.'))
    : Number.NaN;

export function tensionLed(valor: unknown): number {
  const texto = String(valor ?? '').trim();
  if (!/^\d+(?:[.,]\d+)?\s*(?:v(?:\s*dc)?)?$/i.test(texto)) return 0;
  const n = numero(texto.replace(/\s*v(?:\s*dc)?$/i, ''));
  return n === 12 || n === 24 ? n : 0;
}

const error = (mensaje: string, sugerencia: string): ResultadoDerivador => ({
  magnitudes: {},
  diagnostico: { codigo: 'tira_led_datos_invalidos', mensaje, sugerencia },
});

/** Filas rectas de tira flexible. La forma zigzag del circuito no agrega
 * vueltas al recorrido. La separación es una regla del taller, no una
 * promesa de uniformidad óptica a cualquier profundidad. */
export function calcularTiraLed(
  ctx: JobContext,
  params: Record<string, unknown>,
  atributos: Record<string, unknown> | null | undefined,
): ResultadoDerivador {
  const attrs = atributos ?? {};
  const wattsMetro = numero(attrs.potencia ?? attrs.wattsMetro);
  const tensionV = tensionLed(attrs.tension);
  const corteMm = numero(attrs.corte ?? attrs.corteMm);
  if (
    !(wattsMetro > 0) ||
    !Number.isFinite(wattsMetro) ||
    !tensionV ||
    !(corteMm > 0) ||
    !Number.isFinite(corteMm)
  ) {
    return error(
      'Faltan los datos eléctricos de la tira LED.',
      'Completá consumo en W/m, tensión de 12 o 24 V y distancia entre cortes en mm en la variante.',
    );
  }
  const separacionMm = numero(params.separacionCm) * 10;
  const retiroMm = numero(params.retiroBordeCm ?? 2.5) * 10;
  const margenPct = numero(params.margenFuentePct ?? 30);
  const factorCable = numero(params.factorCablePerimetro ?? 1.4);
  const chicoteM = numero(params.cablePorFilaCm ?? 12) / 100;
  if (
    ![separacionMm, retiroMm, margenPct, factorCable, chicoteM].every(
      Number.isFinite,
    ) ||
    separacionMm <= 0 ||
    Math.min(retiroMm, margenPct, factorCable, chicoteM) < 0
  ) {
    return error(
      'Revisá la separación, el retiro y los parámetros de la tira LED.',
      'La separación debe ser positiva; el retiro, el margen de potencia y el cable no pueden ser negativos.',
    );
  }
  const piezas = ctx.piezasVisibles ?? ctx.piezas ?? [];
  if (new Set(piezas.map((p) => `${p.anchoMm}:${p.altoMm}`)).size > 1) {
    return error(
      'La iluminación con tira requiere carteles de una misma medida por ítem.',
      'Cotizá las medidas diferentes como ítems separados para dimensionar la fuente de cada cartel.',
    );
  }
  const medida =
    ctx.interiorMm ?? ctx.medidaVisibleMm ?? ctx.piezasVisibles?.[0] ?? ctx.medidaCustomMm ?? ctx.piezas?.[0];
  const anchoMm = numero(medida?.anchoMm);
  const altoMm = numero(medida?.altoMm);
  const vertical = params.orientacion === 'vertical';
  const largoUtil = (vertical ? altoMm : anchoMm) - 2 * retiroMm;
  const transversal = (vertical ? anchoMm : altoMm) - 2 * retiroMm;
  const unidades = numero(ctx.cantidad ?? 1);
  if (
    ![largoUtil, transversal, unidades].every(Number.isFinite) ||
    largoUtil < corteMm ||
    transversal <= 0 ||
    !Number.isInteger(unidades) ||
    unidades < 1
  ) {
    return error(
      'La tira LED no entra en la medida útil del cartel.',
      'Revisá ancho, alto, cantidad, retiro de los bordes y distancia entre cortes.',
    );
  }
  const filas = Math.ceil(transversal / separacionMm);
  const cortesPorFila = Math.floor(largoUtil / corteMm + 1e-9);
  if (filas > 10000 || filas * cortesPorFila > 1e8) {
    return error(
      'La distribución de tira LED excede el tamaño admitido.',
      'Revisá las unidades de medida y la separación entre filas.',
    );
  }
  const largoFilaMm = cortesPorFila * corteMm;
  const metrosPorCartel = (filas * largoFilaMm) / 1000;
  const wattsPorCartel = metrosPorCartel * wattsMetro;
  const maxAlimentacionM = numero(
    attrs.maxAlimentacion ?? attrs.maxAlimentacionM,
  );
  const maxDeclarado = attrs.maxAlimentacion ?? attrs.maxAlimentacionM;
  if (maxDeclarado != null && maxDeclarado !== '' && (!Number.isFinite(maxAlimentacionM) || maxAlimentacionM <= 0)) {
    return error('El largo máximo por alimentación no es válido.', 'Completá un largo positivo según el fabricante o dejalo pendiente.');
  }
  const cortesPorAlimentacion =
    Number.isFinite(maxAlimentacionM) && maxAlimentacionM > 0
      ? Math.floor((maxAlimentacionM * 1000) / corteMm + 1e-9)
      : null;
  if (cortesPorAlimentacion !== null && cortesPorAlimentacion < 1) {
    return error(
      'La longitud máxima por alimentación es menor que un tramo de corte.',
      'Revisá ese dato en la ficha del fabricante.',
    );
  }
  return {
    magnitudes: {
      metrosTira: metrosPorCartel * unidades,
      watts: wattsPorCartel * unidades,
      wattsPorCartel,
      wattsPorCorte: (corteMm / 1000) * wattsMetro,
      tensionV,
      margenFuentePct: margenPct,
      cableMl:
        (((2 * (anchoMm + altoMm)) / 1000) * factorCable + filas * chicoteM) *
        unidades,
    },
    traza: {
      iluminacionTira: {
        unidades,
        anchoMm,
        altoMm,
        profundidadMm: ctx.profundidadMm ?? null,
        orientacion: vertical ? 'vertical' : 'horizontal',
        filas,
        largoFilaMm,
        separacionRealMm: transversal / filas,
        retiroMm,
        metrosPorCartel,
        wattsMetro,
        wattsPorCartel,
        tensionV,
        margenPct,
        alimentacionesMinimas:
          cortesPorAlimentacion === null
            ? null
            : filas * Math.ceil(cortesPorFila / cortesPorAlimentacion),
        maxAlimentacionM:
          cortesPorAlimentacion === null ? null : maxAlimentacionM,
      },
    },
  };
}

export interface FuenteLedCandidata {
  id: string;
  precioReferencia: number | null;
  atributosVarianteJson?: Record<string, unknown> | null;
}

/** Reparte unidades de corte completas entre fuentes iguales. El margen es
 * adicional al consumo (30% = W × 1,3), no un porcentaje de carga máxima.
 * Esto dimensiona materiales; no define el cableado de la instalación. */
export function seleccionarFuentesTira<T extends FuenteLedCandidata>(
  candidatas: T[],
  magnitudes: Record<string, number>,
): {
  variante: T;
  cantidad: number;
  capacidadW: number;
  consumoMaximoPorFuenteW: number;
} | null {
  const { wattsPorCartel, wattsPorCorte, tensionV, margenFuentePct } =
    magnitudes;
  if (
    ![wattsPorCartel, wattsPorCorte, tensionV, margenFuentePct].every(
      Number.isFinite,
    ) ||
    wattsPorCartel <= 0 ||
    wattsPorCorte <= 0 ||
    margenFuentePct < 0
  )
    return null;
  const cortes = Math.round(wattsPorCartel / wattsPorCorte);
  const planes = candidatas.flatMap((variante) => {
    const attrs = variante.atributosVarianteJson ?? {};
    if (
      tensionLed(attrs.tension) !== tensionV ||
      !(Number(variante.precioReferencia) > 0) ||
      !Number.isFinite(Number(variante.precioReferencia))
    )
      return [];
    const capacidadW = numero(attrs.capacidad);
    if (!Number.isFinite(capacidadW) || capacidadW <= 0) return [];
    const cortesPorFuente = Math.floor(
      capacidadW / (1 + margenFuentePct / 100) / wattsPorCorte + 1e-9,
    );
    if (cortesPorFuente < 1) return [];
    const cantidad = Math.ceil(cortes / cortesPorFuente);
    return [
      {
        variante,
        cantidad,
        capacidadW,
        consumoMaximoPorFuenteW: Math.ceil(cortes / cantidad) * wattsPorCorte,
      },
    ];
  });
  // Menos fuentes; luego menor capacidad total y costo, con desempate estable.
  planes.sort(
    (a, b) =>
      a.cantidad - b.cantidad ||
      a.capacidadW - b.capacidadW ||
      Number(a.variante.precioReferencia) -
        Number(b.variante.precioReferencia) ||
      a.variante.id.localeCompare(b.variante.id),
  );
  return planes[0] ?? null;
}
