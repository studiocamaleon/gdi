import { describe, expect, it } from "vitest";
import { configTarifarios } from "./__fixtures__/tarifarios";
import {
  cadInicial,
  contenidoInicial,
  filasOferta,
} from "./centro-copiado-tarifarios-editor";
import {
  agruparCuadricula,
  etiquetaTramo,
  pegarCuadricula,
} from "./centro-copiado-tarifarios-cuadricula";

function hojas() {
  const m = contenidoInicial("ARS").hojas!;
  m.filas = filasOferta(configTarifarios, m);
  m.filas.forEach((f, i) =>
    f.precios.forEach((p, t) => {
      p.precioUnitario = `${i}${t}`;
    }),
  );
  return m;
}
describe("cuadrícula comercial", () => {
  it("empareja caras por papel y tamaño sin mezclar color ni cobertura y conserva índices originales", () => {
    const m = hojas();
    m.filas.reverse();
    const indices = m.filas.flatMap((f, i) =>
      f.combinacion.color === "COLOR" ? [i] : [],
    );
    const grupos = agruparCuadricula(m, indices);
    expect(grupos).toHaveLength(2);
    const a4 = grupos.find((g) => g.formato === "A4")!;
    expect(a4.papeles).toHaveLength(2);
    for (const papel of a4.papeles) {
      expect(papel.celdas).toHaveLength(6);
      papel.celdas.forEach((c, i) => {
        const original = m.filas[c!.fila];
        expect(original.combinacion).toMatchObject({
          color: "COLOR",
          faz: (i % 2) + 1,
          tamano: "A4",
          gramaje: papel.gramaje,
        });
        expect(c!.tramo).toBe(Math.floor(i / 2));
      });
    }
    m.filas.push({
      ...structuredClone(m.filas[0]),
      combinacion: { ...m.filas[0].combinacion, cobertura: "alta" },
    });
    expect(
      agruparCuadricula(
        m,
        m.filas.map((_, i) => i),
      ),
    ).toHaveLength(5);
  });
  it("separa excepciones por cara, incluso con rangos iguales a los generales", () => {
    const m = hojas();
    m.filas[1].rangosPropios = [1, 20];
    const grupos = agruparCuadricula(m, [0, 1]);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].papeles[0].celdas).toEqual([
      { fila: 0, tramo: 0 },
      null,
      { fila: 0, tramo: 1 },
      null,
      { fila: 0, tramo: 2 },
      null,
    ]);
    expect(grupos[1]).toMatchObject({ propios: true, rangos: [1, 20] });
    m.filas[1].rangosPropios = [...m.rangosGenerales];
    expect(agruparCuadricula(m, [0, 1])).toHaveLength(2);
  });
  it("pega por papel y columnas intercaladas de caras sin perder precisión", () => {
    const m = hojas();
    const grupo = agruparCuadricula(m, [0, 1, 8, 9])[0];
    const cambios = pegarCuadricula(
      "10,12345678\t20\t30\t40\t50\t60\n0\t\t70\t80\t90\t100",
      m,
      grupo.papeles,
      0,
      0,
    );
    expect(cambios.slice(0, 4)).toEqual([
      { fila: 0, tramo: 0, antes: "00", despues: "10.12345678" },
      { fila: 1, tramo: 0, antes: "10", despues: "20" },
      { fila: 0, tramo: 1, antes: "01", despues: "30" },
      { fila: 1, tramo: 1, antes: "11", despues: "40" },
    ]);
    expect(cambios[6]).toMatchObject({ fila: 8, tramo: 0, despues: "0" });
    expect(cambios[7]).toMatchObject({ fila: 9, tramo: 0, despues: null });
    expect(m.filas[0].precios[0].precioUnitario).toBe("00");
  });
  it("rechaza bloques que cruzan tablas/páginas o llenan caras ausentes, y admite huecos vacíos", () => {
    const m = hojas();
    const grupo = agruparCuadricula(m, [0])[0];
    expect(() => pegarCuadricula("10\t20", m, grupo.papeles, 0, 0)).toThrow(
      "no pertenece",
    );
    expect(pegarCuadricula("10\t\t20", m, grupo.papeles, 0, 0)).toHaveLength(2);
    expect(() => pegarCuadricula("10\n20", m, grupo.papeles, 0, 0)).toThrow(
      "papeles",
    );
    expect(() => pegarCuadricula("10\t20", m, grupo.papeles, 0, 5)).toThrow(
      "columnas",
    );
    expect(() => pegarCuadricula("10\t\t-1", m, grupo.papeles, 0, 0)).toThrow(
      "importe",
    );
  });
  it("CAD mantiene una columna por tramo y separa anchos de rollo", () => {
    const m = cadInicial("UNICA");
    m.rangosGenerales = ["0", "10.5", "50"];
    m.filas = [610, 914].map((anchoRolloMm) => ({
      combinacion: {
        papelMateriaPrimaId: "papel-ficticio",
        gramaje: 80,
        anchoRolloMm,
        color: "BN",
        cobertura: null,
      },
      precios: [],
    }));
    const grupos = agruparCuadricula(m, [0, 1]);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].papeles[0].celdas).toEqual([
      { fila: 0, tramo: 0 },
      { fila: 0, tramo: 1 },
      { fila: 0, tramo: 2 },
    ]);
    expect(etiquetaTramo(m.rangosGenerales, 0, "ML")).toBe("0 a <10,5 ML");
    expect(etiquetaTramo(m.rangosGenerales, 1, "ML")).toBe("10,5 a <50 ML");
    expect(etiquetaTramo(m.rangosGenerales, 2, "ML")).toBe("50+ ML");
    expect(etiquetaTramo([1, 51, 101], 0, "HOJA")).toBe("1–50 hojas");
    expect(etiquetaTramo([1, 51, 101], 1, "CARILLA")).toBe("51–100 carillas");
  });
});
