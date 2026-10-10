import type { ContenidoTarifario } from "./centro-copiado-tarifarios-api";
import type { CentroCopiadoConfig } from "./centro-copiado-api";
import type { PerfilCadCopiado } from "./centro-copiado-cad";
import { esFechaCalendario, instanteDe, partesEnZona } from "./zona";

export type MatrizHojas = NonNullable<ContenidoTarifario["hojas"]>;
export type MatrizCad = NonNullable<ContenidoTarifario["cad"]>;
export type FilaMatriz =
  | MatrizHojas["filas"][number]
  | MatrizCad["filas"][number];
export const coberturas = ["borrador", "normal", "alta"] as const;
export function contenidoInicial(monedaCodigo: string): ContenidoTarifario {
  return {
    esquema: 1,
    monedaCodigo,
    hojas: {
      reglas: {
        unidad: "HOJA",
        acumulacion: "COMBINACION",
        cobertura: "UNICA",
        ultimaHojaImpar: "MANTENER_DOBLE",
      },
      rangosGenerales: [1, 100, 500],
      filas: [],
    },
    cad: null,
    composicion: {
      iva: "INCLUIDO",
      preparacion: { modalidad: "INCLUIDA" },
      minimo: { modalidad: "SIN_MINIMO" },
    },
  };
}
export function cadInicial(cobertura: "UNICA" | "DIFERENCIADA"): MatrizCad {
  return {
    reglas: {
      unidad: "ML",
      acumulacion: "COMBINACION",
      cobertura,
      redondeo: { modalidad: "SIN_REDONDEO" },
    },
    rangosGenerales: ["0", "10", "50"],
    filas: [],
  };
}
/** Nunca pasar importes por Number: conserva todos los decimales aceptados. */
export function decimalEditor(
  texto: string,
  decimales = 8,
  enteros = 18,
): string | null {
  if (!texto.trim()) return null;
  const limpio = texto.trim().replace(",", ".");
  if (
    !new RegExp(
      `^\\d{1,${enteros}}${decimales ? `(\\.\\d{1,${decimales}})?` : ""}$`,
    ).test(limpio)
  )
    throw new Error(
      `Usá un importe positivo o cero, sin separadores de miles y con hasta ${decimales} decimales.`,
    );
  const [entero, fraccion] = limpio.split(".");
  const f = fraccion?.replace(/0+$/, "");
  return `${entero.replace(/^0+(?=\d)/, "")}${f ? `.${f}` : ""}`;
}
const escala = (n: string) => {
  const [e, f = ""] = n.split(".");
  return BigInt(e) * BigInt(10) ** BigInt(12) + BigInt(f.padEnd(12, "0"));
};
export function leerRangos(texto: string, cad: boolean): (string | number)[] {
  const partes = texto.split(";");
  if (partes.length > 100) throw new Error("Usá hasta 100 tramos.");
  const valores = partes.map((p) => {
    const d = decimalEditor(p, cad ? 12 : 0, 16);
    if (
      d === null ||
      escala(d) > BigInt(Number.MAX_SAFE_INTEGER) * BigInt(10) ** BigInt(12)
    )
      throw new Error("Revisá las cantidades de los tramos.");
    return d;
  });
  if (valores[0] !== (cad ? "0" : "1"))
    throw new Error(
      `El primer tramo debe comenzar en ${cad ? "0 ML" : "1 unidad"}.`,
    );
  if (valores.some((v, i) => i > 0 && escala(v) <= escala(valores[i - 1])))
    throw new Error("Los tramos deben crecer, sin repetirse.");
  return cad ? valores : valores.map(Number);
}
export function claveCombinacion(c: FilaMatriz["combinacion"]): string {
  return JSON.stringify([
    c.papelMateriaPrimaId,
    c.gramaje,
    "tamano" in c ? c.tamano : c.anchoRolloMm,
    c.color,
    "faz" in c ? c.faz : null,
    c.cobertura,
  ]);
}
export function filasOferta(
  cfg: CentroCopiadoConfig,
  matriz: MatrizHojas,
): MatrizHojas["filas"] {
  const filas: MatrizHojas["filas"] = [];
  for (const papel of cfg.disponibles.papeles) {
    const elegido = cfg.papeles?.find(
      (p) => p.materiaPrimaId === papel.materiaPrimaId,
    );
    if (cfg.papeles !== null && !elegido) continue;
    const gramajes: (number | null)[] = papel.gramajes.length
      ? papel.gramajes
      : [null];
    for (const gramaje of gramajes) {
      if (
        elegido?.gramajes?.length &&
        (gramaje === null || !elegido.gramajes.includes(gramaje))
      )
        continue;
      const producibles = papel.formatosPorGramaje
        ? (papel.formatosPorGramaje.find((r) => r.gramaje === gramaje)
            ?.tamanos ?? [])
        : papel.formatosProducibles;
      const particulares =
        elegido?.formatosPorGramaje == null
          ? null
          : (elegido.formatosPorGramaje.find((r) => r.gramaje === gramaje)
              ?.tamanos ?? []);
      const tamanos = producibles.filter(
        (t) =>
          (cfg.tamanos === null || cfg.tamanos.includes(t)) &&
          (particulares === null || particulares.includes(t)),
      );
      for (const tamano of tamanos)
        for (const color of ["BN", "COLOR"] as const)
          for (const faz of [1, 2] as const) {
            for (const cobertura of matriz.reglas.cobertura === "UNICA"
              ? [null]
              : coberturas) {
              filas.push({
                combinacion: {
                  papelMateriaPrimaId: papel.materiaPrimaId,
                  gramaje,
                  tamano,
                  color,
                  faz,
                  cobertura,
                },
                precios: matriz.rangosGenerales.map((desdeCantidad) => ({
                  desdeCantidad,
                  precioUnitario: null,
                })),
              });
            }
          }
    }
  }
  return filas;
}
export function filasCad(
  perfiles: PerfilCadCopiado[],
  matriz: MatrizCad,
): MatrizCad["filas"] {
  const filas = new Map<string, MatrizCad["filas"][number]>();
  for (const perfil of perfiles)
    for (const cobertura of matriz.reglas.cobertura === "UNICA"
      ? [null]
      : coberturas) {
      const combinacion = {
        papelMateriaPrimaId: perfil.papelMateriaPrimaId,
        gramaje: perfil.gramaje,
        anchoRolloMm: perfil.rollo.anchoRolloMm,
        color: perfil.color,
        cobertura,
      };
      filas.set(claveCombinacion(combinacion), {
        combinacion,
        precios: matriz.rangosGenerales.map((desdeCantidad) => ({
          desdeCantidad,
          precioUnitario: null,
        })),
      });
    }
  return [...filas.values()];
}
export function sumarFilas<T extends FilaMatriz>(
  actuales: T[],
  nuevas: T[],
): T[] {
  const mapa = new Map(
    actuales.map((f) => [claveCombinacion(f.combinacion), f]),
  );
  for (const fila of nuevas)
    if (!mapa.has(claveCombinacion(fila.combinacion)))
      mapa.set(claveCombinacion(fila.combinacion), fila);
  if (mapa.size > 5000)
    throw new Error("La matriz admite hasta 5.000 combinaciones.");
  return [...mapa.values()];
}
export function cambiarCobertura(
  contenido: ContenidoTarifario,
  cobertura: "UNICA" | "DIFERENCIADA",
) {
  const copia = structuredClone(contenido);
  for (const matriz of [copia.hojas, copia.cad]) {
    if (!matriz) continue;
    matriz.reglas.cobertura = cobertura;
    // Ni los precios ni las excepciones se trasladan entre modalidades.
    const filas = new Map<string, FilaMatriz>();
    for (const fila of matriz.filas)
      for (const c of cobertura === "UNICA" ? [null] : coberturas) {
        const nueva = {
          combinacion: { ...fila.combinacion, cobertura: c },
          precios: matriz.rangosGenerales.map((desdeCantidad) => ({
            desdeCantidad,
            precioUnitario: null,
          })),
        } as FilaMatriz;
        filas.set(claveCombinacion(nueva.combinacion), nueva);
      }
    if (filas.size > 5000)
      throw new Error(
        "La cobertura diferenciada supera las 5.000 combinaciones. Reducí las filas primero.",
      );
    // Cada sección mantiene su dimensión original; sólo varía cobertura.
    matriz.filas = [...filas.values()] as typeof matriz.filas;
  }
  return copia;
}
export function normalizarContenido(
  contenido: ContenidoTarifario,
): ContenidoTarifario {
  const c = structuredClone(contenido);
  for (const matriz of [c.hojas, c.cad])
    if (matriz)
      for (const fila of matriz.filas)
        for (const precio of fila.precios)
          precio.precioUnitario = decimalEditor(precio.precioUnitario ?? "");
  for (const cargo of [c.composicion.preparacion, c.composicion.minimo])
    if ("importe" in cargo) {
      const importe = decimalEditor(cargo.importe, 12);
      if (importe === null)
        throw new Error(
          "Completá el importe de preparación y del mínimo configurados.",
        );
      cargo.importe = importe;
    }
  if (c.cad?.reglas.redondeo.modalidad === "HACIA_ARRIBA") {
    const incremento = decimalEditor(
      c.cad.reglas.redondeo.incrementoMl,
      12,
      16,
    );
    if (
      !incremento ||
      escala(incremento) === BigInt(0) ||
      escala(incremento) >
        BigInt(Number.MAX_SAFE_INTEGER) * BigInt(10) ** BigInt(12)
    )
      throw new Error(
        "El incremento de redondeo debe ser mayor que cero y estar dentro del límite admitido.",
      );
    c.cad.reglas.redondeo.incrementoMl = incremento;
  }
  return c;
}
export function resumenCeldas(c: ContenidoTarifario) {
  let total = 0,
    pendientes = 0;
  for (const matriz of [c.hojas, c.cad])
    if (matriz)
      for (const fila of matriz.filas) {
        for (const rango of fila.rangosPropios ?? matriz.rangosGenerales) {
          total++;
          const precio = fila.precios.find(
            (p) => claveRango(p.desdeCantidad) === claveRango(rango),
          )?.precioUnitario;
          if (precio == null || precio.trim() === "") pendientes++;
        }
      }
  return { total, pendientes };
}
export function fechaProgramada(
  texto: string,
  zona: string,
  ahora = new Date(),
): string {
  const [fecha, hora] = texto.split("T");
  if (
    !esFechaCalendario(fecha ?? "") ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora ?? "")
  )
    throw new Error("Elegí una fecha y hora válidas.");
  const instante = instanteDe(fecha, hora, zona);
  const igual = (d: Date) => {
    const p = partesEnZona(d, zona);
    return (
      `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}T${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}` ===
      texto
    );
  };
  if (!igual(instante))
    throw new Error(
      "Esa hora no existe por el cambio horario. Elegí otra hora.",
    );
  if (
    [-120, -60, -30, 30, 60, 120].some((m) =>
      igual(new Date(instante.getTime() + m * 60000)),
    )
  )
    throw new Error(
      "Esa hora se repite por el cambio horario. Elegí otra hora inequívoca.",
    );
  if (instante <= ahora)
    throw new Error("La vigencia programada debe comenzar en el futuro.");
  return instante.toISOString();
}

const escalaPrecio = BigInt(100000000);
function precioEntero(v: string) {
  const [e, f = ""] = v.split(".");
  return BigInt(e) * escalaPrecio + BigInt(f.padEnd(8, "0"));
}
function desdePrecioEntero(v: bigint) {
  return decimalEditor(
    `${v / escalaPrecio}.${String(v % escalaPrecio).padStart(8, "0")}`,
  )!;
}
export function ajustarPrecio(
  precio: string,
  modo: "PORCENTAJE" | "IMPORTE",
  ajuste: string,
  redondeo: string,
): string {
  const negativo = ajuste.trim().startsWith("-");
  const magnitud = decimalEditor(negativo ? ajuste.trim().slice(1) : ajuste);
  if (magnitud === null) throw new Error("Completá el ajuste.");
  const a = precioEntero(magnitud) * (negativo ? -BigInt(1) : BigInt(1));
  const base = decimalEditor(precio);
  if (base === null) throw new Error("El ajuste necesita un precio cargado.");
  const p = precioEntero(base);
  // Redondeo aritmético a ocho decimales; el incremento comercial es opcional y hacia arriba.
  const numerador =
    modo === "PORCENTAJE"
      ? p * (BigInt(100) * escalaPrecio + a)
      : (p + a) * (BigInt(100) * escalaPrecio);
  if (numerador < BigInt(0))
    throw new Error(
      "El ajuste produciría un precio negativo. Ninguna celda fue modificada.",
    );
  let valor =
    (numerador + BigInt(50) * escalaPrecio) / (BigInt(100) * escalaPrecio);
  const incremento = decimalEditor(redondeo);
  if (incremento !== null) {
    const i = precioEntero(incremento);
    if (i === BigInt(0))
      throw new Error("El incremento de redondeo debe ser mayor que cero.");
    valor = ((valor + i - BigInt(1)) / i) * i;
  }
  return desdePrecioEntero(valor);
}
export function preciosConRangos(
  fila: FilaMatriz,
  rangos: (string | number)[],
) {
  return rangos.map((desdeCantidad) => ({
    desdeCantidad,
    precioUnitario:
      fila.precios.find(
        (p) => claveRango(p.desdeCantidad) === claveRango(desdeCantidad),
      )?.precioUnitario ?? null,
  }));
}
export type CambioPrecio = {
  fila: number;
  tramo: number;
  antes: string | null;
  despues: string | null;
};
export function pegarPrecios(
  texto: string,
  filas: FilaMatriz[],
  indices: number[],
  inicio: number,
  columna: number,
  generales: (string | number)[],
): CambioPrecio[] {
  const lineas = texto.replace(/\r/g, "").replace(/\n$/, "").split("\n");
  if (inicio + lineas.length > indices.length)
    throw new Error(
      "El pegado supera las filas de esta página. Pegá un bloque más pequeño.",
    );
  return lineas.flatMap((linea, j) => {
    const indice = indices[inicio + j];
    const fila = filas[indice];
    const rangos = fila.rangosPropios ?? generales;
    const celdas = linea.split("\t");
    if (columna + celdas.length > rangos.length)
      throw new Error(
        "El pegado supera los tramos de una combinación. Revisá sus rangos.",
      );
    return celdas.map((celda, k) => ({
      fila: indice,
      tramo: columna + k,
      antes: preciosConRangos(fila, rangos)[columna + k].precioUnitario,
      despues: decimalEditor(celda),
    }));
  });
}

export function claveRango(rango: string | number) {
  return typeof rango === "number"
    ? String(rango)
    : decimalEditor(rango, 12, 16)!;
}
