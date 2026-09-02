import { describe, expect, it } from "vitest";
import { construirEspecificacionesComponentes } from "./especificaciones-componentes";

describe("especificaciones de componentes compuestos", () => {
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
