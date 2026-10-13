import { expect, it } from "vitest";
import { resumirCostosRango } from "./centro-copiado-costos-rango";
import type {
  ResultadoCeldaSimulacion,
  EscenarioSimulado,
} from "../../apps/api/src/centro-copiado/tarifarios/simulacion-tarifario.types";

function ejemplo(): ResultadoCeldaSimulacion {
  return {
    celda: { seccion: "hojas", fila: 0, tramo: 0 },
    escenarios: [],
    rangoCostos: {
      abierto: false,
      puntos: (
        [
          ["INICIO", "1", ["30", "60", "90"]],
          ["FIN", "50", ["10", "20", "40"]],
        ] as const
      ).map(([extremo, cantidadObjetivo, costos]) => ({
        extremo,
        cantidadObjetivo,
        escenarios: costos.map(
          (costoUnitario, i) =>
            ({
              estado: "CALCULADO",
              cobertura: ["borrador", "normal", "alta"][i],
              costoUnitario,
            }) as EscenarioSimulado,
        ),
      })),
    },
  };
}
it("compara cantidades usando la cobertura más costosa en cada extremo y promedia los dos costos", () => {
  const r = resumirCostosRango(ejemplo(), ["borrador", "normal", "alta"]);
  expect(r).toMatchObject({
    minimo: "40",
    maximo: "90",
    promedio: "65",
    desde: "1",
    hasta: "50",
    abierto: false,
  });
});
it("no presupone que a mayor cantidad el costo unitario sea menor", () => {
  const r = ejemplo();
  r.rangoCostos!.puntos[1].escenarios[2] = {
    estado: "CALCULADO",
    cobertura: "alta",
    costoUnitario: "110",
  } as EscenarioSimulado;
  expect(resumirCostosRango(r, ["borrador", "normal", "alta"])).toMatchObject({
    minimo: "90",
    maximo: "110",
    promedio: "100",
  });
});
it("con cobertura diferenciada compara únicamente esa cobertura y conserva costo cero", () => {
  const r = ejemplo();
  for (const p of r.rangoCostos!.puntos)
    p.escenarios = [
      {
        estado: "CALCULADO",
        cobertura: "normal",
        costoUnitario: "0",
      } as EscenarioSimulado,
    ];
  expect(resumirCostosRango(r, ["normal"])).toMatchObject({
    minimo: "0",
    maximo: "0",
    promedio: "0",
  });
});
it("no muestra extremos ni promedio si falta cobertura o falla una referencia", () => {
  const r = ejemplo();
  r.rangoCostos!.puntos[1].escenarios[0] = {
    estado: "ERROR",
    cobertura: "borrador",
    motivo: "Falta insumo",
    calculadoEl: "",
  };
  expect(resumirCostosRango(r, ["borrador", "normal", "alta"])).toEqual({
    motivo: "Hay un extremo o cobertura sin costo verificable.",
  });
  delete r.rangoCostos;
  expect(resumirCostosRango(r, ["normal"]).motivo).toContain(
    "Volvé a calcular",
  );
});
