import type { ContenidoTarifario } from './contenido-tarifario';
import type {
  CeldaSimulacion,
  ResultadoEscenarioSimulacion,
} from './simulacion-tarifario.types';
import { DecimalComercial as D } from '../comercial/validaciones';

/** Dos muestras del tramo, no una búsqueda exhaustiva de extremos del motor. */
export function referenciasRangoSimulacion(
  contenido: ContenidoTarifario,
  celda: CeldaSimulacion,
  escenarios: ResultadoEscenarioSimulacion[],
) {
  const matriz = contenido[celda.seccion]!;
  const fila = matriz.filas[celda.fila];
  const rangos = fila.rangosPropios ?? matriz.rangosGenerales;
  const desde = new D(rangos[celda.tramo]);
  const siguiente = rangos[celda.tramo + 1];
  const abierto = siguiente == null;
  const base = escenarios[0];
  if (
    !base ||
    escenarios.some((e) => e.estado !== 'CALCULADO') ||
    base.estado !== 'CALCULADO'
  )
    throw new Error(
      'Completá el cálculo de referencia antes de comparar el rango.',
    );
  if (!abierto && celda.hastaReferencia != null)
    throw new Error(
      'El tope de simulación sólo se usa en el último tramo abierto.',
    );
  let inicio = desde.gt(0) ? desde : new D(base.cantidadReferencia);
  // Un tramo abierto no tiene mínimo de costo global. Mostrar la muestra elegida.
  let fin = abierto
    ? new D(
        celda.hastaReferencia ??
          D.min(
            1000000,
            D.max(inicio, base.cantidadReferencia).times(2),
          ).toFixed(),
      )
    : new D(siguiente).minus(
        celda.seccion === 'hojas'
          ? 1
          : D.min('0.001', new D(siguiente).minus(desde).div(1000)),
      );
  if (inicio.gt(1000000) || fin.gt(1000000) || fin.lt(inicio))
    throw new Error(
      'El tope de simulación debe estar dentro del tramo y no superar 1.000.000.',
    );
  let crear = (n: InstanceType<typeof D>): CeldaSimulacion => ({
    ...celda,
    cantidadReferencia: n.toFixed(),
  });
  if (celda.seccion === 'hojas') {
    if (!inicio.isInteger() || !fin.isInteger())
      throw new Error('Para hojas o carillas usá cantidades enteras.');
    const hojas = contenido.hojas!;
    if (
      hojas.reglas.unidad === 'CARILLA' &&
      hojas.filas[celda.fila].combinacion.faz === 2 &&
      hojas.reglas.ultimaHojaImpar === 'COBRAR_SIMPLE'
    ) {
      inicio = inicio.div(2).ceil().times(2);
      fin = fin.div(2).floor().times(2);
    }
  } else if (celda.geometriaCad) {
    // Con medidas propias sólo varía el número de copias: se conserva el plano.
    const porCopia = new D(base.cantidadReferencia).div(
      celda.geometriaCad.copias,
    );
    const primera = inicio.div(porCopia).ceil();
    const ultima = fin.div(porCopia).floor();
    if (primera.lt(1) || ultima.gt(10000))
      throw new Error(
        'La muestra CAD debe admitir entre 1 y 10.000 copias del plano. Ajustá el tope o las medidas.',
      );
    inicio = primera.times(porCopia);
    fin = ultima.times(porCopia);
    crear = (n) => ({
      ...celda,
      cantidadReferencia: undefined,
      geometriaCad: {
        ...celda.geometriaCad!,
        copias: n.div(porCopia).round().toNumber(),
      },
    });
  } else {
    // El motor expresa el largo a seis decimales de mm (nueve de ML).
    inicio = inicio.toDecimalPlaces(9, D.ROUND_CEIL);
    fin = fin.toDecimalPlaces(9, D.ROUND_DOWN);
  }
  if (!inicio.gt(0) || fin.lt(inicio))
    throw new Error(
      'El tramo no contiene dos extremos representables para esta referencia.',
    );
  return {
    abierto,
    puntos: (
      [
        ['INICIO', inicio],
        ['FIN', fin],
      ] as const
    ).map(([extremo, n]) => ({
      extremo,
      cantidadObjetivo: n.toFixed(),
      celda: crear(n),
    })),
  };
}
