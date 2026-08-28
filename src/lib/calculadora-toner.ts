/** Superficie de una hoja A4 (210 x 297 mm), expresada en m². */
export const SUPERFICIE_A4_M2 = 0.21 * 0.297;

export type DatosCalculoToner = {
  gramosNetos: number;
  rendimientoPaginasA4: number;
  coberturaIsoPorcentaje: number;
  coberturaObjetivoPorcentaje: number;
};

export type ResultadoCalculoToner = {
  consumoGm2: number;
  consumoGm2Redondeado: number;
  rendimientoEsperadoPaginasA4: number;
  formulaVersion: "toner-lineal-a4-v1";
};

/**
 * Convierte el rendimiento ISO informado por el fabricante a consumo de tóner
 * por m². Es una aproximación lineal y determinística basada en los datos
 * técnicos que carga el usuario.
 */
export function calcularConsumoTonerGm2(
  datos: DatosCalculoToner,
): ResultadoCalculoToner | null {
  const valores = [
    datos.gramosNetos,
    datos.rendimientoPaginasA4,
    datos.coberturaIsoPorcentaje,
    datos.coberturaObjetivoPorcentaje,
  ];

  if (valores.some((valor) => !Number.isFinite(valor) || valor <= 0)) {
    return null;
  }

  const relacionCobertura =
    datos.coberturaObjetivoPorcentaje / datos.coberturaIsoPorcentaje;
  const consumoGm2 =
    ((datos.gramosNetos / datos.rendimientoPaginasA4) * relacionCobertura) /
    SUPERFICIE_A4_M2;

  return {
    consumoGm2,
    consumoGm2Redondeado: Number(consumoGm2.toFixed(2)),
    rendimientoEsperadoPaginasA4:
      datos.rendimientoPaginasA4 / relacionCobertura,
    formulaVersion: "toner-lineal-a4-v1",
  };
}
