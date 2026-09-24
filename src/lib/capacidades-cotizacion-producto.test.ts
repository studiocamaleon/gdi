import { describe, expect, it } from "vitest";
import {
  permiteImportarMedidasPdf,
  resolverEditorSello,
  type MaterialEditorSello,
} from "./capacidades-cotizacion-producto";
import type { ConfigPasoDetalle, ProductoDetalle } from "./productos-servicios";
const paso = (familiaCodigo: string, patch = {}) =>
  ({
    rutaPaso: { activo: true, familiaCodigo },
    modoActivacion: "OBLIGATORIO",
    multiplicadoresActivos: [],
    paramsPasoJson: {},
    ...patch,
  }) as unknown as ConfigPasoDetalle;
const producto = (patch = {}) =>
  ({
    modoMedidas: "LIBRE",
    dimensionesRequeridas: ["ANCHO", "ALTO"],
    estructuraProducto: "SIMPLE",
    ...patch,
  }) as unknown as ProductoDetalle;
const cuerpo: MaterialEditorSello = {
  nombre: "Modelo tenant",
  subfamilia: "SELLOS_AUTOMATICOS",
  atributos: { anchoPolimero: 47, altoPolimero: 18, lineasTexto: 5 },
};
const fabrica = [
  paso("pre_prensa"),
  paso("trabajo_manual"),
  paso("ensamble_estructural"),
];
describe("importación de medidas por contexto", () => {
  it.each(["impresion_por_area", "impresion_laser", "corte_laser", "cnc"])(
    "ofrece PDF para piezas 2D a medida en %s sin flags",
    (familia) => {
      expect(
        permiteImportarMedidasPdf(producto(), [paso(familia)], "medidas"),
      ).toBe(true);
      expect(
        permiteImportarMedidasPdf(
          producto({ modoMedidas: "MIXTA" }),
          [paso(familia)],
          "medidas",
        ),
      ).toBe(true);
    },
  );
  it("excluye modalidades incompatibles aunque se hubiera activado la herramienta antigua", () => {
    const p = producto({
      atributosComercialesJson: {
        herramientas: { medidasDesdeArchivo: { enabled: true } },
      },
    });
    for (const modo of ["svg", "placas"] as const)
      expect(permiteImportarMedidasPdf(p, fabrica, modo)).toBe(false);
    for (const patch of [
      { modoMedidas: "FIJA" },
      { dimensionesRequeridas: [] },
      { dimensionesRequeridas: ["ANCHO", "ALTO", "PROFUNDIDAD"] },
      { estructuraProducto: "COMPUESTO" },
    ])
      expect(
        permiteImportarMedidasPdf(producto(patch), fabrica, "medidas"),
      ).toBe(false);
  });
  it("no convierte páginas de libros/cuadernillos en piezas; ignora pasos inactivos", () => {
    const impresion = paso("impresion_por_hoja");
    for (const extra of [
      paso("encuadernado_anillado"),
      paso("abrochado_caballete"),
      paso("impresion_por_hoja", {
        paramsPasoJson: {
          nestingConfig: { imposicion: { esquema: "caballete" } },
        },
      }),
    ])
      expect(
        permiteImportarMedidasPdf(producto(), [impresion, extra], "medidas"),
      ).toBe(false);
    expect(
      permiteImportarMedidasPdf(
        producto(),
        [
          impresion,
          paso("encuadernado_anillado", { modoActivacion: "NO_EJECUTAR" }),
        ],
        "medidas",
      ),
    ).toBe(true);
  });
});
describe("editor contextual de sello", () => {
  it("habilita sellos fabricados con preprensa y trabajo manual sin depender del nombre ni flags", () => {
    expect(
      resolverEditorSello({ pasos: fabrica, materiales: [cuerpo] }),
    ).toMatchObject({
      visible: true,
      modelo: { widthMm: 47, heightMm: 18, lineasMax: 5 },
    });
  });
  it("no habilita venta de cuerpo vacío ni tinta/almohadillas aunque haya procesos", () => {
    expect(
      resolverEditorSello({
        pasos: [paso("ensamble_estructural")],
        materiales: [cuerpo],
      }).visible,
    ).toBe(false);
    expect(
      resolverEditorSello({
        pasos: fabrica,
        materiales: [{ ...cuerpo, subfamilia: "ALMOHADILLA_TINTA" }],
      }).visible,
    ).toBe(false);
    expect(
      resolverEditorSello({
        pasos: [paso("grabado_laser")],
        materiales: [{ ...cuerpo, subfamilia: "SUSTRATO_RIGIDO" }],
      }).visible,
    ).toBe(false);
  });
  it("no usa pasos que no se ejecutan y explica datos faltantes", () => {
    expect(
      resolverEditorSello({
        pasos: [paso("grabado_laser", { modoActivacion: "NO_EJECUTAR" })],
        materiales: [cuerpo],
      }).visible,
    ).toBe(false);
    const r = resolverEditorSello({
      pasos: fabrica,
      materiales: [{ ...cuerpo, atributos: {} }],
    });
    expect(r.visible).toBe(true);
    expect(r.modelo).toBeNull();
    expect(r.motivo).toContain("ancho y alto");
  });
  it("no toma arbitrariamente un área cuando hay dos cuerpos distintos", () => {
    const r = resolverEditorSello({
      pasos: fabrica,
      materiales: [
        cuerpo,
        { ...cuerpo, atributos: { ...cuerpo.atributos, anchoPolimero: 70 } },
      ],
    });
    expect(r.modelo).toBeNull();
    expect(r.motivo).toContain("ítems separados");
  });
  it("usa medidas finales para goma grabada, nunca el tamaño de la placa de materia prima", () => {
    const materiales = [
      {
        nombre: "Goma",
        templateId: "goma_laserable_v1",
        atributos: { ancho: 30, alto: 60 },
      },
    ];
    expect(
      resolverEditorSello({ pasos: [paso("grabado_laser")], materiales })
        .modelo,
    ).toBeNull();
    expect(
      resolverEditorSello({
        pasos: [paso("grabado_laser")],
        materiales,
        medida: { anchoMm: 38, altoMm: 14 },
        lineasGoma: 3,
      }),
    ).toMatchObject({
      visible: true,
      esGoma: true,
      modelo: { widthMm: 38, heightMm: 14, lineasMax: 3 },
    });
  });
});
