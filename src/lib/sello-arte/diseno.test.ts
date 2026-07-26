import { describe, expect, it } from "vitest";

import {
  esDisenoCompleto,
  itemsConSelloDe,
  leerDisenoSello,
  nombreArteSello,
} from "./diseno";

/**
 * El diseño del sello sale del `jobContext`, que es JSON opaco: nadie lo valida
 * al persistirlo y ahí adentro puede haber cualquier cosa —un ítem viejo, un
 * diseño a medio guardar, un campo que cambió de forma—. Si este parseo se
 * relaja, el guardado de la orden se cae al intentar dibujar un sello que no
 * está, y lo que se pierde es la orden entera.
 */

const DISENO = {
  lineas: [
    { text: "Juan Pérez", bold: true, italic: false },
    { text: "Contador", bold: false, italic: false },
  ],
  align: "center",
  fontKey: "playfair",
  modelo: { nombre: "Trodat 4911", widthMm: 38, heightMm: 14, lineasMax: 4 },
};

describe("leer el diseño del jobContext", () => {
  it("lee un diseño completo", () => {
    const diseno = leerDisenoSello({ disenoSello: DISENO });
    expect(diseno?.lineas).toHaveLength(2);
    expect(diseno?.fontKey).toBe("playfair");
    expect(diseno?.modelo?.widthMm).toBe(38);
    expect(esDisenoCompleto(diseno)).toBe(true);
  });

  it("un ítem sin sello no devuelve nada", () => {
    expect(leerDisenoSello({ cantidad: 100 })).toBeNull();
    expect(leerDisenoSello(null)).toBeNull();
    expect(leerDisenoSello(undefined)).toBeNull();
    expect(leerDisenoSello("no soy un objeto")).toBeNull();
  });

  /** El editor guarda una fila por línea del modelo, en blanco las que sobran. */
  it("un diseño sin texto no es un sello", () => {
    expect(
      leerDisenoSello({
        disenoSello: { ...DISENO, lineas: [{ text: "  ", bold: false, italic: false }] },
      }),
    ).toBeNull();
  });

  it("descarta las líneas que no tienen forma de línea", () => {
    const diseno = leerDisenoSello({
      disenoSello: { ...DISENO, lineas: [{ text: "Ok" }, null, 42, { bold: true }] },
    });
    expect(diseno?.lineas).toEqual([{ text: "Ok", bold: false, italic: false }]);
  });

  it("una alineación que no existe cae en centrado", () => {
    expect(leerDisenoSello({ disenoSello: { ...DISENO, align: "justify" } })?.align)
      .toBe("center");
  });

  /**
   * Los sellos diseñados antes de que el arte se guardara solo no tienen las
   * medidas: se leen igual —el diseño existe— pero no se pueden dibujar.
   */
  it("un diseño viejo se lee pero no está completo", () => {
    const { modelo: _, ...sinModelo } = DISENO;
    const diseno = leerDisenoSello({ disenoSello: sinModelo });
    expect(diseno).not.toBeNull();
    expect(esDisenoCompleto(diseno)).toBe(false);
  });

  it("un modelo sin medidas usables no cuenta como modelo", () => {
    const conCero = { ...DISENO, modelo: { ...DISENO.modelo, widthMm: 0 } };
    expect(esDisenoCompleto(leerDisenoSello({ disenoSello: conCero }))).toBe(false);
  });
});

describe("nombre del archivo de arte", () => {
  const completo = leerDisenoSello({ disenoSello: DISENO })!;

  it("sale de la primera línea y la medida", () => {
    expect(esDisenoCompleto(completo)).toBe(true);
    if (!esDisenoCompleto(completo)) return;
    expect(nombreArteSello(completo, false)).toBe("Juan-P-rez-38x14mm.eps");
    expect(nombreArteSello(completo, true)).toBe("Juan-P-rez-38x14mm-negativo.eps");
  });
});

describe("qué ítems de la orden tienen sello", () => {
  const productos = [
    { id: "item-1", nombre: "Sello automático", snapshot: { jobContext: { disenoSello: DISENO } } },
    { id: "item-2", nombre: "Lona", snapshot: { jobContext: { cantidad: 2 } } },
    { nombre: "Sello sin persistir", snapshot: { jobContext: { disenoSello: DISENO } } },
    { id: "item-4", nombre: "Sin snapshot", snapshot: null },
  ];

  it("devuelve sólo los que tienen sello Y ya existen en la base", () => {
    const conSello = itemsConSelloDe(productos);
    expect(conSello).toHaveLength(1);
    expect(conSello[0].ordenItemId).toBe("item-1");
    expect(conSello[0].productoNombre).toBe("Sello automático");
  });

  /** Sin id no hay a qué colgar el archivo: se ignora en vez de romper. */
  it("un ítem sin id no se publica", () => {
    expect(itemsConSelloDe(productos).map((i) => i.productoNombre)).not.toContain(
      "Sello sin persistir",
    );
  });

  it("una orden sin sellos no da trabajo", () => {
    expect(itemsConSelloDe([productos[1]])).toEqual([]);
  });
});
