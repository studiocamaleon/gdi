import { describe, expect, it } from "vitest";
import {
  componentesTienenMaterialEfectivo,
  construirEspecificacionesComponentes,
} from "./especificaciones-componentes";

function exhibidor(cantidad: number) {
  return {
    codigo: "CORRUGADO",
    nombre: "Piezas de corrugado",
    cantidad,
    unidad: "conjunto",
    jobContext: {
      cantidad,
      disenosVectoriales: [
        "Cuerpo",
        "Soporte",
        "Faldón",
        "Estante",
        "Costilla",
        "Header",
      ].map((nombre, i) => ({
        id: `pieza-${i}`,
        nombre,
        cantidadPorUnidad: nombre === "Estante" ? 4 : 1,
        fuente: {
          nombreArchivo: `${nombre}.dxf`,
          anchoFinalMm: 100,
          altoFinalMm: 170,
        },
      })),
    },
    especificacionesEfectivas: [
      {
        clave: "cantidad",
        etiqueta: "Cantidad de piezas",
        valor: cantidad,
        valorTexto: String(cantidad),
        unidad: "unidad",
        tipoDato: "number",
      },
    ],
  };
}

describe("especificaciones de componentes compuestos", () => {
  it.each([1, 10, 50, 51])(
    "distingue conjuntos y piezas físicas para %i exhibidores",
    (cantidad) => {
      const snapshot = exhibidor(cantidad);
      const antes = JSON.stringify(snapshot);
      const [view] = construirEspecificacionesComponentes([snapshot]);
      expect(view.piezas).toMatchObject({
        conjuntos: cantidad,
        porConjunto: 9,
        total: cantidad * 9,
      });
      expect(view.piezas?.filas).toHaveLength(6);
      expect(
        view.piezas?.filas.find((p) => p.nombre === "Estante"),
      ).toMatchObject({
        medidas: "10 × 17 cm",
        archivo: "Estante.dxf",
        porConjunto: 4,
        total: cantidad * 4,
      });
      expect(view.filas).toContainEqual(
        expect.objectContaining({
          label: "Total de piezas",
          value: String(cantidad * 9),
        }),
      );
      expect(view.filas.some((row) => row.label === "Cantidad de piezas")).toBe(
        false,
      );
      expect(view.resumen).toContain("6 tipos de pieza");
      expect(JSON.stringify(snapshot)).toBe(antes);
    },
  );

  it("respeta la cantidad efectiva de cada ocurrencia y de los subcomponentes", () => {
    const [view] = construirEspecificacionesComponentes([
      {
        nombre: "Exhibidor doble",
        cantidad: 50,
        componentes: [
          exhibidor(100),
          { ...exhibidor(3), codigo: "EXTRA", nombre: "Repuesto" },
        ],
      },
    ]);
    expect(view.hijos.map((hijo) => hijo.piezas?.total)).toEqual([900, 27]);
    expect(
      view.hijos[0].piezas?.filas.find((p) => p.nombre === "Estante")?.total,
    ).toBe(400);
  });

  it("un conjunto puede repetir un único diseño", () => {
    const componente = exhibidor(50);
    componente.jobContext.disenosVectoriales =
      componente.jobContext.disenosVectoriales.filter(
        (p) => p.nombre === "Estante",
      );
    const [view] = construirEspecificacionesComponentes([componente]);
    expect(view.resumen).toBe(
      "50 conjuntos · 1 tipo de pieza · 200 piezas en total",
    );
    expect(view.piezas?.porConjunto).toBe(4);
  });

  it("las medidas múltiples antiguas ya tienen cantidades totales y no una medida global", () => {
    const [view] = construirEspecificacionesComponentes([
      {
        nombre: "Paneles",
        cantidad: 50,
        unidad: "unidad",
        jobContext: {
          cantidad: 50,
          medidaCustomMm: { anchoMm: 200, altoMm: 300 },
          piezas: [
            { nombre: "Frente", cantidad: 3, anchoMm: 200, altoMm: 300 },
            { cantidad: 5, anchoMm: 100, altoMm: 150 },
          ],
        },
      },
    ]);
    expect(view.piezas).toMatchObject({
      esConjunto: false,
      total: 8,
      porConjunto: null,
    });
    expect(view.piezas?.filas.map((p) => p.total)).toEqual([3, 5]);
    expect(view.filas).toEqual([
      {
        key: "total-piezas",
        label: "Total de piezas",
        value: "8",
        colorMode: false,
      },
    ]);
    expect(view.resumen).toBe("2 tipos de pieza · 8 piezas en total");
  });

  it("no inventa ceros ni totales completos cuando falta información histórica", () => {
    const [view] = construirEspecificacionesComponentes([
      {
        nombre: "Componente incompleto",
        jobContext: {
          cantidad: null,
          disenosVectoriales: [
            { nombre: "Estante", cantidadPorUnidad: 4, fuente: {} },
          ],
        },
      },
    ]);
    expect(view.piezas).toMatchObject({
      conjuntos: null,
      porConjunto: 4,
      total: null,
    });
    expect(view.piezas?.filas[0]).toMatchObject({
      medidas: "Sin dato",
      total: null,
    });
    expect(view.filas.find((r) => r.key === "total-piezas")?.value).toBe(
      "Sin dato",
    );
  });

  it("busca materiales efectivos en los hijos y excluye consumibles y pasos omitidos", () => {
    const material = {
      tipoLineaCosto: "MATERIAL",
      materialNombre: "Corrugado plastico",
    };
    expect(
      componentesTienenMaterialEfectivo([
        {
          componentes: [
            { pasos: [{ activado: true, materiales: [material] }] },
          ],
        },
      ]),
    ).toBe(true);
    expect(
      componentesTienenMaterialEfectivo([
        { pasos: [{ activado: false, materiales: [material] }] },
      ]),
    ).toBe(false);
    expect(
      componentesTienenMaterialEfectivo([
        {
          pasos: [
            {
              activado: true,
              materiales: [{ ...material, tipoLineaCosto: "CONSUMIBLE" }],
            },
          ],
        },
      ]),
    ).toBe(false);
  });

  it("muestra valores efectivos, agrupa medidas y omite opcionales inactivos", () => {
    const result = construirEspecificacionesComponentes([
      {
        codigo: "VINILO-INTERNO-1",
        nombre: "Vinilo impreso blanco",
        cantidad: 1,
        unidad: "unidad",
        jobContext: {
          cantidad: 1,
          medidaCustomMm: { anchoMm: 1000, altoMm: 600 },
        },
        especificacionesEfectivas: [
          {
            clave: "cantidad",
            etiqueta: "Cantidad de piezas",
            tipoDato: "number",
            unidad: "m2",
            origen: "FORMULA",
            requerido: true,
            valor: 1,
            valorTexto: "1",
          },
          {
            clave: "medidaCustomMm.anchoMm",
            etiqueta: "Ancho",
            tipoDato: "number",
            unidad: "mm",
            origen: "FIJO",
            requerido: true,
            valor: 1000,
            valorTexto: "1.000",
          },
          {
            clave: "medidaCustomMm.altoMm",
            etiqueta: "Alto",
            tipoDato: "number",
            unidad: "mm",
            origen: "FIJO",
            requerido: true,
            valor: 600,
            valorTexto: "600",
          },
          {
            clave: "modoColor_impresion",
            etiqueta: "Impresión por área",
            tipoDato: "modo_color",
            origen: "DEFAULT_HIJO",
            requerido: false,
            valor: "CMYK+blanco",
            valorTexto: "CMYK + Blanco",
          },
          {
            clave: "opcionalesActivados.diseno",
            etiqueta: "Diseño gráfico",
            tipoDato: "boolean",
            origen: "FIJO",
            requerido: false,
            valor: false,
            valorTexto: "No",
          },
        ],
        pasos: [
          {
            activado: true,
            materiales: [
              {
                tipoLineaCosto: "MATERIAL",
                slotNombre: "Sustrato principal",
                materialDisplayName: "Vinilo Ritrama PM80 · Brillante",
              },
            ],
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].nombre).toBe("Vinilo impreso blanco");
    expect(result[0].resumen).toBe("1 u. · 100 × 60 cm");
    expect(result[0].filas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Cantidad de piezas", value: "1 u." }),
        expect.objectContaining({ label: "Medidas", value: "100 × 60 cm" }),
        expect.objectContaining({
          label: "Impresión por área",
          value: "CMYK + Blanco",
          colorMode: true,
        }),
        expect.objectContaining({
          label: "Sustrato principal",
          value: "Vinilo Ritrama PM80 · Brillante",
        }),
      ]),
    );
    expect(result[0].filas).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Diseño gráfico" }),
      ]),
    );
  });

  it("prioriza la unidad semántica del parámetro sobre la unidad de consumo", () => {
    const result = construirEspecificacionesComponentes([
      {
        nombre: "Vinilo impreso",
        cantidad: 1,
        unidad: "m2",
        especificacionesEfectivas: [
          {
            clave: "cantidad",
            etiqueta: "Cantidad de piezas",
            tipoDato: "number",
            unidad: "unidad",
            origen: "FIJO",
            requerido: true,
            valor: 1,
            valorTexto: "1",
          },
        ],
      },
    ]);

    expect(result[0].resumen).toBe("1 u.");
    expect(result[0].filas[0]).toEqual(
      expect.objectContaining({ label: "Cantidad de piezas", value: "1 u." }),
    );
  });

  it("conserva la jerarquía multinivel y no muestra códigos como nombres", () => {
    const result = construirEspecificacionesComponentes([
      {
        codigo: "INTERNO_PADRE",
        nombre: "Módulo exterior",
        cantidad: 2,
        unidad: "unidad",
        componentes: [
          {
            codigo: "INTERNO_HIJO",
            nombre: "Placa frontal",
            cantidad: 2,
            unidad: "pieza",
          },
        ],
      },
      { codigo: "SOLO-CODIGO", cantidad: 1, unidad: "unidad" },
    ]);

    expect(result[0].hijos[0].nombre).toBe("Placa frontal");
    expect(result[1].nombre).toBe("Componente");
    expect(result[1].nombre).not.toContain("SOLO-CODIGO");
  });
});
