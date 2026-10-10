import { expect, it } from "vitest";
import {
  contenidoInicial,
  filasOferta,
} from "./centro-copiado-tarifarios-editor";
import { configTarifarios } from "./__fixtures__/tarifarios";
import {
  sugerirCelda,
  caidasEntreTramos,
  canalesDelTarifario,
} from "./centro-copiado-tarifarios-sugerencias";
import type { ResultadoCeldaSimulacion } from "../../apps/api/src/centro-copiado/tarifarios/simulacion-tarifario.types";
function ejemplo() {
  const c = contenidoInicial("ARS");
  c.margen = { minimoPorcentaje: "20", anteInsuficiente: "AUTORIZACION" };
  c.hojas!.filas = filasOferta(configTarifarios, c.hojas!).slice(0, 1);
  c.hojas!.filas[0].precios = [
    { desdeCantidad: 1, precioUnitario: "100" },
    { desdeCantidad: 100, precioUnitario: "100" },
    { desdeCantidad: 500, precioUnitario: "100" },
  ];
  const r: ResultadoCeldaSimulacion = {
    celda: { seccion: "hojas", fila: 0, tramo: 1 },
    escenarios: ["borrador", "normal", "alta"].map((cobertura, i) => ({
      estado: "CALCULADO",
      cobertura: cobertura as "normal",
      calculadoEl: "2026-10-10T15:00:00Z",
      costoTotal: "6000",
      costoUnitario: "60",
      cantidadReferencia: "100",
      cantidadFacturable: "100",
      unidad: "HOJA",
      referencia: "Pedido ficticio",
      grupos: [{ fila: 0, desdeCantidad: "100", cantidadFacturable: "100" }],
      ivaPorcentaje: "21",
      decimalesPrecio: 2,
      trazas: [],
      avisos: [],
      comercial: {
        cargas: [],
        ventaMotorNeta: String(10000 + i * 5000),
        metodosMotor: ["por_margen"],
        motivo: null,
      },
    })),
  };
  return { c, r };
}
it("precio único toma la mayor sugerencia, editable y con IVA una sola vez", () => {
  const { c, r } = ejemplo();
  expect(sugerirCelda(c, r)).toMatchObject({ anterior: "100", nuevo: "242" });
  expect(c.hojas!.filas[0].precios[1].precioUnitario).toBe("100");
  c.composicion.iva = "MAS_IVA";
  expect(sugerirCelda(c, r).nuevo).toBe("200");
});
it("resta preparación una vez y no usa el mínimo para vaciar el precio unitario", () => {
  const { c, r } = ejemplo();
  c.composicion.preparacion = { modalidad: "FIJA_PEDIDO", importe: "1210" };
  c.composicion.minimo = { modalidad: "IMPORTE_PEDIDO", importe: "100000" };
  expect(sugerirCelda(c, r).nuevo).toBe("229.9");
  expect(sugerirCelda(c, r, "10").nuevo).toBe("230");
});
it("cobertura diferenciada usa sólo su propia referencia", () => {
  const { c, r } = ejemplo();
  c.hojas!.reglas.cobertura = "DIFERENCIADA";
  c.hojas!.filas[0].combinacion.cobertura = "normal";
  r.escenarios = [r.escenarios[1]];
  expect(sugerirCelda(c, r).nuevo).toBe("181.5");
});
it("no aplica sugerencias incompletas, fallidas o sin desglose; requiere nueva simulación", () => {
  const { c, r } = ejemplo();
  r.escenarios.pop();
  expect(() => sugerirCelda(c, r)).toThrow("todas las coberturas");
  const e = ejemplo();
  if (e.r.escenarios[0].estado === "CALCULADO")
    e.r.escenarios[0].comercial = undefined;
  expect(() => sugerirCelda(e.c, e.r)).toThrow("Volvé a simular");
});
it("referencia CAD divide por ML facturables después del redondeo de consumo", () => {
  const { c, r } = ejemplo();
  c.hojas = null;
  c.cad = {
    reglas: {
      unidad: "ML",
      cobertura: "DIFERENCIADA",
      acumulacion: "COMBINACION",
      redondeo: { modalidad: "HACIA_ARRIBA", incrementoMl: "0.5" },
    },
    rangosGenerales: ["0"],
    filas: [
      {
        combinacion: {
          papelMateriaPrimaId: "papel-ficticio",
          gramaje: 80,
          color: "BN",
          anchoRolloMm: 914,
          cobertura: "normal",
        },
        precios: [{ desdeCantidad: "0", precioUnitario: null }],
      },
    ],
  };
  const e = r.escenarios[0];
  if (e.estado !== "CALCULADO") throw new Error("fixture");
  r.celda = { seccion: "cad", fila: 0, tramo: 0 };
  r.escenarios = [
    {
      ...e,
      cobertura: "normal",
      unidad: "ML",
      cantidadReferencia: "1.208",
      cantidadFacturable: "1.5",
      grupos: [{ fila: 0, desdeCantidad: "0", cantidadFacturable: "1.5" }],
      comercial: { ...e.comercial!, ventaMotorNeta: "150" },
    },
  ];
  expect(sugerirCelda(c, r).nuevo).toBe("121");
});
it("conserva cero explícito y advierte si preparación cubre toda la referencia", () => {
  const { c, r } = ejemplo();
  c.composicion.preparacion = { modalidad: "FIJA_PEDIDO", importe: "99999" };
  expect(sugerirCelda(c, r)).toMatchObject({ nuevo: "0" });
  expect(sugerirCelda(c, r).avisos.join(" ")).toContain("precio cero");
});
it("detecta caída total entre tramos y respeta el mínimo del pedido", () => {
  const { c } = ejemplo();
  c.hojas!.filas[0].precios[1].precioUnitario = "50";
  expect(caidasEntreTramos(c)).toEqual([
    { seccion: "hojas", fila: 0, desde: "100" },
  ]);
  c.composicion.minimo = { modalidad: "IMPORTE_PEDIDO", importe: "20000" };
  expect(caidasEntreTramos(c)).toEqual([]);
});
it("incluye canales heredados y excepciones que comparten el tarifario", () => {
  expect(
    canalesDelTarifario(
      {
        esquema: 1,
        general: { modalidad: "TARIFARIO", tarifarioId: "tarifa-ficticia" },
        canales: {
          mostrador: { modalidad: "HEREDAR" },
          web: { modalidad: "MOTOR" },
          email: { modalidad: "TARIFARIO", tarifarioId: "tarifa-ficticia" },
          whatsapp: { modalidad: "TARIFARIO", tarifarioId: "otra-ficticia" },
          app_movil: { modalidad: "HEREDAR" },
        },
      },
      "tarifa-ficticia",
    ),
  ).toEqual(["mostrador", "email", "app_movil"]);
});

it("la alerta de carillas dobles a simple considera sólo cantidades pares representables", () => {
  const { c } = ejemplo();
  c.hojas!.reglas.unidad = "CARILLA";
  c.hojas!.reglas.ultimaHojaImpar = "COBRAR_SIMPLE";
  c.hojas!.filas[0].combinacion.faz = 2;
  c.hojas!.filas[0].precios[1].precioUnitario = "98.5";
  // 98 carillas × 100 < 100 × 98,5. Usar 99 produciría un falso salto.
  expect(caidasEntreTramos(c)).toEqual([]);
});
