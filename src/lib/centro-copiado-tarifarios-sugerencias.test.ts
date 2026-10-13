import { expect, it } from "vitest";
import {
  contenidoInicial,
  filasOferta,
} from "./centro-copiado-tarifarios-editor";
import { configTarifarios } from "./__fixtures__/tarifarios";
import {
  sugerirCelda,
  sugerirPorVolumen,
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
it("el objetivo usa costo variable y conserva el costo productivo completo como referencia", () => {
  const { c, r } = ejemplo();
  for (const e of r.escenarios) {
    if (e.estado !== "CALCULADO") continue;
    e.costoVariableTotal = "3000";
    e.costoEstructuraTotal = "3000";
  }
  const propuesta = sugerirCelda(c, r, undefined, "40");
  expect(propuesta.nuevo).toBe("60.5");
  expect(
    propuesta.controles.every(
      (c) => c.metrica === "CONTRIBUCION" && c.porcentaje === "40.00",
    ),
  ).toBe(true);
  expect(r.escenarios[0]).toMatchObject({ costoTotal: "6000" });
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
  if (r.escenarios[0].estado === "CALCULADO")
    r.escenarios[0].costoTotal = "105";
  expect(sugerirCelda(c, r, "10", "20").nuevo).toBe("110");
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

it("el margen objetivo es sobre venta neta, no un recargo, y convierte IVA una sola vez", () => {
  const { c, r } = ejemplo();
  c.composicion.iva = "MAS_IVA";
  for (const e of r.escenarios)
    if (e.estado === "CALCULADO") e.costoTotal = "7000";
  expect(sugerirCelda(c, r, undefined, "30").nuevo).toBe("100");
  c.composicion.iva = "INCLUIDO";
  expect(sugerirCelda(c, r, undefined, "30").nuevo).toBe("121");
  expect(sugerirCelda(c, r, "50", "30").nuevo).toBe("150");
});
it("calcula el objetivo con cargas sobre neto y bruto aun sin precio sugerido del motor", () => {
  const { c, r } = ejemplo();
  for (const e of r.escenarios)
    if (e.estado === "CALCULADO")
      e.comercial = {
        ...e.comercial!,
        ventaMotorNeta: null,
        cargas: [
          {
            clave: "comision",
            nombre: "Comisión ficticia",
            tipo: "COMISION",
            base: "BRUTO_COBRADO",
            porcentaje: "5",
          },
          {
            clave: "impuesto",
            nombre: "Impuesto ficticio",
            tipo: "IMPUESTO_INTERNO",
            base: "NETO",
            porcentaje: "3",
          },
        ],
      };
  const propuesta = sugerirCelda(c, r, "10", "30");
  expect(propuesta.nuevo).toBe("120");
  expect(propuesta.controles.every((c) => Number(c.porcentaje) >= 30)).toBe(
    true,
  );
});
it("el objetivo conserva preparación separada y no usa el mínimo para rebajar la matriz", () => {
  const { c, r } = ejemplo();
  c.composicion.preparacion = { modalidad: "FIJA_PEDIDO", importe: "1210" };
  c.composicion.minimo = { modalidad: "IMPORTE_PEDIDO", importe: "1000000" };
  expect(sugerirCelda(c, r, undefined, "25").nuevo).toBe("84.7");
});
it("usa la mayor cobertura y omite objetivos imposibles, inválidos y errores parciales", () => {
  const { c, r } = ejemplo();
  c.composicion.iva = "MAS_IVA";
  if (r.escenarios[2].estado === "CALCULADO")
    r.escenarios[2].costoTotal = "14000";
  expect(sugerirCelda(c, r, undefined, "30").nuevo).toBe("200");
  expect(() => sugerirCelda(c, r, undefined, "100")).toThrow("menor que 100");
  expect(() => sugerirCelda(c, r, undefined, "-1")).toThrow(
    "contribución objetivo",
  );
  if (r.escenarios[0].estado === "CALCULADO")
    r.escenarios[0].comercial!.cargas = [
      {
        clave: "c",
        nombre: "Comisión",
        tipo: "COMISION",
        base: "NETO",
        porcentaje: "80",
      },
    ];
  expect(() => sugerirCelda(c, r, undefined, "30")).toThrow("no permiten");
  r.escenarios[0] = {
    estado: "ERROR",
    cobertura: "borrador",
    calculadoEl: "2026-10-11T15:00:00Z",
    motivo: "Referencia inválida",
  };
  expect(() => sugerirCelda(c, r, undefined, "30")).toThrow(
    "sin costo verificable",
  );
});
it("corrige el efecto del redondeo fiscal en referencias pequeñas", () => {
  const { c, r } = ejemplo();
  for (const e of r.escenarios)
    if (e.estado === "CALCULADO") {
      e.costoTotal = "0.0437";
      e.comercial!.cargas = [
        {
          clave: "c",
          nombre: "Comisión",
          tipo: "COMISION",
          base: "BRUTO_COBRADO",
          porcentaje: "7",
        },
      ];
    }
  const p = sugerirCelda(c, r, undefined, "37.5");
  expect(p.controles.every((c) => Number(c.porcentaje) >= 37.5)).toBe(true);
});

it("ordena por volumen sin bajar precios bajo el objetivo ni modificar los costos reales", () => {
  const { c, r } = ejemplo();
  c.composicion.iva = "MAS_IVA";
  c.hojas!.rangosGenerales = [1, 2, 3, 4, 5, 10];
  c.hojas!.filas[0].precios = c.hojas!.rangosGenerales.map((n) => ({
    desdeCantidad: n,
    precioUnitario: null,
  }));
  const resultados: Record<string, ResultadoCeldaSimulacion> = {};
  c.hojas!.rangosGenerales.forEach((n, tramo) => {
    const total = 39 * Math.ceil(n / 2) + 6 * n;
    resultados[`hojas:0:${tramo}`] = {
      ...r,
      celda: { seccion: "hojas", fila: 0, tramo },
      escenarios: r.escenarios.map((e) => {
        if (e.estado !== "CALCULADO") throw Error("fixture");
        return {
          ...e,
          costoTotal: String(total),
          costoUnitario: String(total / n),
          cantidadReferencia: String(n),
          cantidadFacturable: String(n),
          grupos: [
            {
              fila: 0,
              desdeCantidad: String(n),
              cantidadFacturable: String(n),
            },
          ],
        };
      }),
    };
  });
  const originales = structuredClone(resultados);
  const propuestas = sugerirPorVolumen(c, resultados, "hojas", "1", "40");
  const precios = c.hojas!.rangosGenerales.map((_, i) =>
    Number(propuestas.get(`hojas:0:${i}`)!.sugerencia!.nuevo),
  );
  expect(precios).toEqual([75, 54, 54, 49, 49, 43]);
  expect(propuestas.get("hojas:0:1")!.sugerencia!.ajustadaPorVolumen).toBe(
    true,
  );
  expect(
    [...propuestas.values()].every((p) =>
      p.sugerencia!.controles.every((c) => Number(c.porcentaje) >= 40),
    ),
  ).toBe(true);
  expect(resultados).toEqual(originales);
  expect(
    c.hojas!.filas[0].precios.every((p) => p.precioUnitario === null),
  ).toBe(true);
  delete resultados["hojas:0:2"];
  const incompletas = sugerirPorVolumen(
    c,
    resultados,
    "hojas",
    undefined,
    "40",
  );
  expect(
    [...incompletas.values()].every((p) => !p.sugerencia && !!p.error),
  ).toBe(true);
});
it("ordena cada combinación con sus rangos propios sin cruzar filas", () => {
  const { c, r } = ejemplo();
  c.composicion.iva = "MAS_IVA";
  c.hojas!.rangosGenerales = [1];
  const fila = structuredClone(c.hojas!.filas[0]);
  c.hojas!.filas.push({ ...fila, rangosPropios: [10] });
  const resultados: Record<string, ResultadoCeldaSimulacion> = {};
  for (const [fila, n, costo] of [
    [0, 1, 30],
    [1, 10, 600],
  ]) {
    resultados[`hojas:${fila}:0`] = {
      ...r,
      celda: { seccion: "hojas", fila, tramo: 0 },
      escenarios: r.escenarios.map((e) => {
        if (e.estado !== "CALCULADO") throw Error("fixture");
        return {
          ...e,
          costoTotal: String(costo),
          cantidadReferencia: String(n),
          cantidadFacturable: String(n),
          grupos: [
            { fila, desdeCantidad: String(n), cantidadFacturable: String(n) },
          ],
        };
      }),
    };
  }
  const propuestas = sugerirPorVolumen(c, resultados, "hojas", undefined, "40");
  expect(propuestas.get("hojas:0:0")!.sugerencia!.nuevo).toBe("50");
  expect(propuestas.get("hojas:1:0")!.sugerencia!.nuevo).toBe("100");
});
