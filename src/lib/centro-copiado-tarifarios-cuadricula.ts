import {
  claveRango,
  decimalEditor,
  preciosConRangos,
  type CambioPrecio,
  type MatrizCad,
  type MatrizHojas,
} from "./centro-copiado-tarifarios-editor";

export type Matriz = MatrizHojas | MatrizCad;
export type CeldaCuadricula = { fila: number; tramo: number };
export type PapelCuadricula = {
  clave: string;
  papelId: string;
  gramaje: number | null;
  indices: number[];
  celdas: (CeldaCuadricula | null)[];
};
export type GrupoCuadricula = {
  clave: string;
  formato: string;
  propios: boolean;
  rangos: (number | string)[];
  papeles: PapelCuadricula[];
};

/** La vista conserva los índices originales: ordenar o filtrar nunca cambia
 * la combinación a la que pertenece un precio. Las excepciones no se mezclan
 * con los encabezados generales, incluso si sus inicios coinciden. */
export function agruparCuadricula(matriz: Matriz, indices: number[]) {
  const cad = matriz.reglas.unidad === "ML";
  const grupos = new Map<string, GrupoCuadricula>();
  const papeles = new Map<string, PapelCuadricula>();
  for (const indice of indices) {
    const fila = matriz.filas[indice];
    const c = fila.combinacion;
    const formato = "tamano" in c ? c.tamano : `Rollo ${c.anchoRolloMm} mm`;
    const rangos = fila.rangosPropios ?? matriz.rangosGenerales;
    const propios = !!fila.rangosPropios;
    const clave = JSON.stringify([
      formato,
      c.color,
      c.cobertura,
      propios,
      rangos.map(claveRango),
    ]);
    let grupo = grupos.get(clave);
    if (!grupo) {
      grupo = { clave, formato, propios, rangos, papeles: [] };
      grupos.set(clave, grupo);
    }
    const clavePapel = JSON.stringify([
      clave,
      c.papelMateriaPrimaId,
      c.gramaje,
    ]);
    let papel = papeles.get(clavePapel);
    if (!papel) {
      papel = {
        clave: clavePapel,
        papelId: c.papelMateriaPrimaId,
        gramaje: c.gramaje,
        indices: [],
        celdas: Array.from(
          { length: rangos.length * (cad ? 1 : 2) },
          () => null,
        ),
      };
      papeles.set(clavePapel, papel);
      grupo.papeles.push(papel);
    }
    papel.indices.push(indice);
    rangos.forEach((_, tramo) => {
      const columna = cad ? tramo : tramo * 2 + ("faz" in c ? c.faz - 1 : 0);
      papel.celdas[columna] = { fila: indice, tramo };
    });
  }
  return [...grupos.values()].sort(
    (a, b) =>
      a.formato.localeCompare(b.formato, "es", { numeric: true }) ||
      Number(a.propios) - Number(b.propios),
  );
}

export function etiquetaTramo(
  rangos: (number | string)[],
  tramo: number,
  unidad: Matriz["reglas"]["unidad"],
) {
  const desde = claveRango(rangos[tramo]).replace(".", ",");
  const siguiente = rangos[tramo + 1];
  const sufijo =
    unidad === "ML" ? "ML" : unidad === "HOJA" ? "hojas" : "carillas";
  if (siguiente === undefined) return `${desde}+ ${sufijo}`;
  // ML es continuo: no restar una unidad ni redondear sus límites decimales.
  if (unidad === "ML")
    return `${desde} a <${claveRango(siguiente).replace(".", ",")} ML`;
  return `${desde}–${Number(siguiente) - 1} ${sufijo}`;
}

export function pegarCuadricula(
  texto: string,
  matriz: Matriz,
  papeles: PapelCuadricula[],
  inicio: number,
  columna: number,
): CambioPrecio[] {
  const lineas = texto.replace(/\r/g, "").replace(/\n$/, "").split("\n");
  if (inicio + lineas.length > papeles.length)
    throw new Error(
      "El pegado supera los papeles de esta tabla y página. Pegá un bloque más pequeño.",
    );
  return lineas.flatMap((linea, j) => {
    const celdas = papeles[inicio + j].celdas;
    const valores = linea.split("\t");
    if (columna + valores.length > celdas.length)
      throw new Error(
        "El pegado supera las columnas de esta tabla. Revisá los tramos y las caras.",
      );
    return valores.flatMap((valor, k) => {
      const celda = celdas[columna + k];
      if (!celda) {
        if (valor.trim())
          throw new Error(
            "El bloque contiene un precio para una combinación que no pertenece a esta tabla. No se aplicó ningún cambio.",
          );
        return [];
      }
      const fila = matriz.filas[celda.fila];
      return [
        {
          ...celda,
          antes: preciosConRangos(
            fila,
            fila.rangosPropios ?? matriz.rangosGenerales,
          )[celda.tramo].precioUnitario,
          despues: decimalEditor(valor),
        },
      ];
    });
  });
}
