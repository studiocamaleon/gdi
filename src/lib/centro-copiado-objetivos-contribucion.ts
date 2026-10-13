import type {
  MatrizHojas,
  MatrizCad,
} from "./centro-copiado-tarifarios-editor";
import { DecimalComercial as D } from "../../apps/api/src/centro-copiado/comercial/validaciones";

type Matriz = MatrizHojas | MatrizCad;

export function normalizarObjetivoContribucion(valor: string): string {
  const limpio = valor.trim().replace(",", ".");
  if (!/^\d{1,2}(\.\d{1,4})?$/.test(limpio))
    throw new Error(
      "Usá una contribución objetivo desde 0 y menor que 100%, con hasta 4 decimales.",
    );
  return new D(limpio).toFixed();
}

/** Conserva el objetivo histórico del asistente sin modificar borradores al abrirlos. */
export function objetivosDeMatriz(matriz: Matriz): string[] {
  return matriz.objetivosContribucion ?? matriz.rangosGenerales.map(() => "30");
}

/** Los límites nuevos heredan el objetivo del intervalo al que pertenecían. */
export function reubicarObjetivos(matriz: Matriz, nuevos: (string | number)[]) {
  if (!matriz.objetivosContribucion) return undefined;
  return nuevos.map((desde) => {
    const indice = matriz.rangosGenerales.findLastIndex((r) =>
      new D(r).lte(desde),
    );
    return matriz.objetivosContribucion![indice];
  });
}

/** Un rango propio que cruza varios generales debe cubrir todos sus objetivos. */
export function objetivoDeTramo(
  matriz: Matriz,
  fila: number,
  tramo: number,
): string {
  const rangos = matriz.filas[fila].rangosPropios ?? matriz.rangosGenerales;
  const desde = new D(rangos[tramo]);
  const hasta = rangos[tramo + 1];
  const objetivos = objetivosDeMatriz(matriz);
  const aplicables = objetivos.filter(
    (_, i) =>
      (hasta == null || new D(matriz.rangosGenerales[i]).lt(hasta)) &&
      (matriz.rangosGenerales[i + 1] == null ||
        desde.lt(matriz.rangosGenerales[i + 1])),
  );
  return D.max(...aplicables).toFixed();
}
