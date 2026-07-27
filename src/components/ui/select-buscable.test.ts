import { describe, expect, it } from "vitest";

import {
  agruparOpciones,
  filtrarOpciones,
  normalizarBusqueda,
  type OpcionSelect,
} from "./select-buscable";

/**
 * La búsqueda y el agrupado de la lista.
 *
 * Es lo único del componente que se puede romper en silencio: si el filtro
 * deja de encontrar "energia" sin tilde nadie ve un error, sólo una lista
 * vacía y a alguien convencido de que la categoría no existe.
 */

const OPCIONES: OpcionSelect[] = [
  { value: "1", label: "Papel obra", grupo: "Costo de producción" },
  { value: "2", label: "Tintas", grupo: "Costo de producción" },
  { value: "3", label: "Energía eléctrica", grupo: "Gasto de estructura" },
  { value: "4", label: "Alquiler de oficina", grupo: "Gasto de estructura" },
  { value: "5", label: "Combustible", grupo: "Gasto de estructura" },
  { value: "6", label: "Retiro de socios", grupo: "Retiro de socios" },
];

const etiquetas = (opciones: OpcionSelect[]) => opciones.map((o) => o.label);

describe("normalizar lo que se tipea", () => {
  it("saca acentos y mayúsculas", () => {
    expect(normalizarBusqueda("  ENERGÍA Eléctrica ")).toBe(
      "energia electrica",
    );
  });

  /**
   * La ñ queda en "n", igual que en el resto del repo. Para BUSCAR está bien
   * —y es lo que se quiere—: el texto tipeado y la opción pasan por la misma
   * función, así que "diseno" encuentra "Diseño". Sería un problema si esto
   * generara identificadores, que no es el caso.
   */
  it("la ñ queda en n, así que se encuentra escrita de las dos formas", () => {
    expect(normalizarBusqueda("Diseño")).toBe("diseno");
    expect(
      filtrarOpciones([{ value: "1", label: "Diseño gráfico" }], "diseno"),
    ).toHaveLength(1);
  });
});

describe("filtrar la lista", () => {
  it("sin texto devuelve todo, en el orden en que llegó", () => {
    expect(filtrarOpciones(OPCIONES, "")).toEqual(OPCIONES);
    expect(filtrarOpciones(OPCIONES, "   ")).toEqual(OPCIONES);
  });

  /** Lo que motivó todo: nadie pone la tilde cuando busca rápido. */
  it("encuentra sin acentos", () => {
    expect(etiquetas(filtrarOpciones(OPCIONES, "energia"))).toEqual([
      "Energía eléctrica",
    ]);
  });

  it("busca en cualquier parte de la palabra, no sólo al principio", () => {
    expect(etiquetas(filtrarOpciones(OPCIONES, "obra"))).toEqual([
      "Papel obra",
    ]);
  });

  /** Escribir dos pedazos sueltos tiene que alcanzar. */
  it("cada palabra filtra por separado", () => {
    expect(etiquetas(filtrarOpciones(OPCIONES, "alq ofi"))).toEqual([
      "Alquiler de oficina",
    ]);
  });

  /**
   * Buscar por el título del grupo: quien escribe "estructura" quiere las de
   * esa naturaleza, aunque ninguna categoría se llame así.
   */
  it("el título del grupo también encuentra", () => {
    expect(etiquetas(filtrarOpciones(OPCIONES, "estructura"))).toEqual([
      "Energía eléctrica",
      "Alquiler de oficina",
      "Combustible",
    ]);
  });

  it("el detalle también encuentra", () => {
    const cuentas: OpcionSelect[] = [
      { value: "a", label: "Caja chica", detalle: "ARS" },
      { value: "b", label: "Banco Nación", detalle: "USD" },
    ];
    expect(etiquetas(filtrarOpciones(cuentas, "usd"))).toEqual([
      "Banco Nación",
    ]);
  });

  it("sin coincidencias devuelve vacío", () => {
    expect(filtrarOpciones(OPCIONES, "helicóptero")).toEqual([]);
  });
});

describe("agrupar la lista", () => {
  it("un grupo por título, en el orden en que llegaron", () => {
    const grupos = agruparOpciones(OPCIONES);
    expect(grupos.map((g) => g.titulo)).toEqual([
      "Costo de producción",
      "Gasto de estructura",
      "Retiro de socios",
    ]);
    expect(grupos[0].opciones).toHaveLength(2);
    expect(grupos[1].opciones).toHaveLength(3);
  });

  /** Las que no declaran grupo no inventan un encabezado vacío. */
  it("las sueltas van juntas y sin título", () => {
    const grupos = agruparOpciones([
      { value: "", label: "Sin proveedor" },
      { value: "1", label: "Papelera SA" },
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].titulo).toBeNull();
  });

  /** Filtrar primero y agrupar después no puede dejar grupos fantasma. */
  it("un grupo que se quedó sin opciones no aparece", () => {
    const grupos = agruparOpciones(filtrarOpciones(OPCIONES, "tinta"));
    expect(grupos.map((g) => g.titulo)).toEqual(["Costo de producción"]);
  });
});
