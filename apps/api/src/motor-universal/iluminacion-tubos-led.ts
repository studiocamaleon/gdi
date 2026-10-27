import type { JobContext } from './tipos';
import type { ResultadoDerivador } from './derivadores/tipos';

export interface IluminacionTubosEjecutada {
  unidades: number;
  anchoMm: number;
  altoMm: number;
  orientacion: 'horizontal' | 'vertical';
  filas: number;
  tubosPorFila: number;
  tubosPorCartel: number;
  largoTuboMm: number;
  retiroMm: number;
  separacionFilasMm: number;
  separacionExtremosMm: number;
  wattsPorCartel: number;
  tensionV: 220;
}

const numero = (v: unknown) => typeof v === 'number' || typeof v === 'string'
  ? Number(String(v).trim().replace(',', '.')) : Number.NaN;
const invalido = (mensaje: string): ResultadoDerivador => ({
  magnitudes: {},
  diagnostico: {
    codigo: 'tubos_led_sin_distribucion', mensaje,
    sugerencia: 'Revisá el largo de los tubos, tensión de 220 V, separación, holgura y medidas interiores del bastidor.',
  },
});

/** Tubos enteros de una misma variante por cartel. Se evalúan ambas
 * orientaciones, sin cortar tubos ni suponer que el largo nominal del cartel
 * es su espacio interior. El paso es un criterio óptico del taller. */
export function calcularTubosLed(
  ctx: JobContext, params: Record<string, unknown>, attrs?: Record<string, unknown> | null,
): ResultadoDerivador {
  const largo = numero(attrs?.largo ?? attrs?.largoMm);
  const watts = numero(attrs?.potencia);
  const paso = numero(params.separacionCm == null || params.separacionCm === '' ? attrs?.paso : numero(params.separacionCm) * 10);
  const retiro = numero(params.retiroBordeCm ?? 2) * 10;
  const factorCable = numero(params.factorCablePerimetro ?? 1.4);
  const cablePorTubo = numero(params.cablePorTuboCm ?? 20) / 100;
  if (!/^220\s*(?:v(?:\s*ac)?)?$/i.test(String(attrs?.tension ?? '').trim()) ||
      ![largo, watts, paso, retiro, factorCable, cablePorTubo].every(Number.isFinite) ||
      Math.min(largo, watts, paso) <= 0 || Math.min(retiro, factorCable, cablePorTubo) < 0) {
    return invalido('Faltan datos válidos de los tubos LED a 220 V.');
  }
  const piezas = ctx.piezasVisibles ?? ctx.piezas ?? [];
  if (new Set(piezas.map(p => `${p.anchoMm}:${p.altoMm}`)).size > 1)
    return invalido('Cotizá las medidas diferentes como ítems separados para distribuir sus tubos.');
  const medida = ctx.interiorMm ?? ctx.medidaVisibleMm ?? ctx.piezasVisibles?.[0] ?? ctx.medidaCustomMm ?? ctx.piezas?.[0];
  const anchoMm = numero(medida?.anchoMm), altoMm = numero(medida?.altoMm);
  const unidades = numero(ctx.cantidad ?? 1);
  if (![anchoMm, altoMm, unidades].every(Number.isFinite) || !Number.isSafeInteger(unidades) || unidades < 1 || Math.min(anchoMm, altoMm) <= 2 * retiro)
    return invalido('Las medidas interiores o la cantidad de carteles no son válidas.');
  const opciones: IluminacionTubosEjecutada[] = [];
  for (const orientacion of ['horizontal', 'vertical'] as const) {
    if (params.orientacion && params.orientacion !== 'automatico' && params.orientacion !== orientacion) continue;
    const longitudinal = (orientacion === 'horizontal' ? anchoMm : altoMm) - 2 * retiro;
    const transversal = (orientacion === 'horizontal' ? altoMm : anchoMm) - 2 * retiro;
    // El sobrante se reparte entre tubos y medio espacio en cada extremo.
    // Así ningún hueco supera el paso, ni un borde supera medio paso.
    const tubosPorFila = Math.ceil(longitudinal / (largo + paso) - 1e-9);
    if (tubosPorFila * largo > longitudinal + 1e-7) continue;
    const filas = Math.ceil(transversal / paso);
    const tubosPorCartel = filas * tubosPorFila;
    if (!Number.isSafeInteger(tubosPorCartel * unidades) || tubosPorCartel * unidades > 100000) continue;
    opciones.push({ unidades, anchoMm, altoMm, orientacion, filas, tubosPorFila, tubosPorCartel,
      largoTuboMm: largo, retiroMm: retiro, separacionFilasMm: transversal / filas,
      separacionExtremosMm: (longitudinal - tubosPorFila * largo) / tubosPorFila,
      wattsPorCartel: tubosPorCartel * watts, tensionV: 220 });
  }
  opciones.sort((a,b) => a.tubosPorCartel - b.tubosPorCartel || a.filas - b.filas);
  const plan = opciones[0];
  if (!plan) return invalido('Estos tubos no entran o dejan huecos mayores que la separación admitida.');
  return {
    magnitudes: {
      tubos: plan.tubosPorCartel * unidades,
      watts: plan.wattsPorCartel * unidades,
      cableMl: (2 * (anchoMm + altoMm) / 1000 * factorCable + plan.tubosPorCartel * cablePorTubo) * unidades,
    },
    traza: { iluminacionTubos: plan },
  };
}

export function seleccionarTubosLed<T extends { id: string; precioReferencia: number | null; atributosVarianteJson?: Record<string, unknown> | null }>(
  candidatos: T[], ctx: JobContext, params: Record<string, unknown>,
): T | null {
  const planes = candidatos.flatMap(variante => {
    if (!Number.isFinite(variante.precioReferencia) || Number(variante.precioReferencia) <= 0) return [];
    const plan = calcularTubosLed(ctx, params, variante.atributosVarianteJson);
    return plan.diagnostico ? [] : [{ variante, cantidad: plan.magnitudes.tubos, costo: plan.magnitudes.tubos * variante.precioReferencia! }];
  });
  planes.sort((a,b) => a.costo - b.costo || a.cantidad - b.cantidad || a.variante.id.localeCompare(b.variante.id));
  return planes[0]?.variante ?? null;
}
