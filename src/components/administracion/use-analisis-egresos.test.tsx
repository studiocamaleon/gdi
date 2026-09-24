// @vitest-environment jsdom
import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getPresupuestadoVsReal, getReporteEgresos } from "@/lib/egresos-api";
import type { ReporteEgresos } from "@/lib/egresos";
import {
  errorRangoAnalisis,
  mesAnalisisEgresos,
  mesCompletoAnalisis,
  type RangoAnalisisEgresos,
} from "@/lib/egresos-periodo";
import { useAnalisisEgresos } from "./use-analisis-egresos";

vi.mock("@/lib/egresos-api", () => ({
  getReporteEgresos: vi.fn(),
  getPresupuestadoVsReal: vi.fn(),
}));
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const septiembre = { desde: "2026-09-01", hasta: "2026-09-30" };
const agosto = { desde: "2026-08-01", hasta: "2026-08-31" };
const reporte = (rango: RangoAnalisisEgresos): ReporteEgresos => ({
  ...rango,
  totalSalida: 100,
  totalResultado: 100,
  egresos: 1,
  naturalezas: [],
  categorias: [],
});
let root: Root;
let actual: ReturnType<typeof useAnalisisEgresos>;
function Consulta() {
  const consulta = useAnalisisEgresos(true);
  useLayoutEffect(() => {
    actual = consulta;
  });
  return null;
}
beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(getReporteEgresos).mockImplementation(async (rango) =>
    reporte(rango as RangoAnalisisEgresos),
  );
  vi.mocked(getPresupuestadoVsReal).mockImplementation(async (periodo) => ({
    periodo: periodo!,
    lineas: [],
    presupuestado: 0,
    real: 0,
    desvio: 0,
    desvioPct: null,
    sinRegistrar: 0,
  }));
  root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Consulta />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
});

it("abre el mes de la empresa aunque UTC ya esté en el mes siguiente", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T01:00:00Z"));
  expect(getReporteEgresos).not.toHaveBeenCalled();
  await act(async () => actual.consultar());
  expect(getReporteEgresos).toHaveBeenCalledWith(septiembre);
  expect(getPresupuestadoVsReal).toHaveBeenCalledWith("2026-09");
});

it("consulta un mes anterior y conserva el rango al volver a abrir o reintentar", async () => {
  await act(async () => actual.consultar(agosto));
  expect(getPresupuestadoVsReal).toHaveBeenLastCalledWith("2026-08");
  await act(async () => actual.consultar());
  expect(getReporteEgresos).toHaveBeenLastCalledWith(agosto);
  expect(actual.rango).toEqual(agosto);
});

it("envía ambos límites exactos y no mezcla un rango parcial o de varios meses con presupuesto mensual", async () => {
  await act(async () => actual.consultar(septiembre));
  vi.mocked(getPresupuestadoVsReal).mockClear();
  for (const rango of [
    { desde: "2026-09-12", hasta: "2026-09-12" },
    { desde: "2026-08-01", hasta: "2026-09-30" },
  ]) {
    await act(async () => actual.consultar(rango));
    expect(getReporteEgresos).toHaveBeenLastCalledWith(rango);
    expect(actual.reporte?.desde).toBe(rango.desde);
    expect(actual.presu).toBeNull();
  }
  expect(getPresupuestadoVsReal).not.toHaveBeenCalled();
});

it("rechaza fechas incompletas, imposibles o invertidas antes de consultar", async () => {
  for (const rango of [
    { desde: "", hasta: "2026-09-30" },
    { desde: "2026-02-30", hasta: "2026-03-01" },
    { desde: "2026-09-30", hasta: "2026-09-01" },
  ]) {
    expect(errorRangoAnalisis(rango)).not.toBeNull();
    await act(async () => actual.consultar(rango));
  }
  expect(getReporteEgresos).not.toHaveBeenCalled();
});

it("una respuesta demorada no reemplaza los resultados de la última consulta", async () => {
  let resolver!: (reporte: ReporteEgresos) => void;
  vi.mocked(getReporteEgresos).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolver = resolve;
      }),
  );
  let primera!: Promise<void>;
  await act(async () => {
    primera = actual.consultar(agosto);
  });
  await act(async () => actual.consultar(septiembre));
  await act(async () => {
    resolver(reporte(agosto));
    await primera;
  });
  expect(actual.rango).toEqual(septiembre);
  expect(actual.reporte?.desde).toBe(septiembre.desde);
  expect(actual.presu?.periodo).toBe("2026-09");
  expect(actual.cargando).toBe(false);
});

it("permite reintentar el período que falló sin conservar cifras de otro período", async () => {
  await act(async () => actual.consultar(septiembre));
  vi.mocked(getReporteEgresos).mockRejectedValueOnce(new Error("Sin conexión"));
  await act(async () => actual.consultar(agosto));
  expect(actual.error).toBe("Sin conexión");
  expect(actual.reporte).toBeNull();
  await act(async () => actual.consultar());
  expect(actual.error).toBeNull();
  expect(actual.reporte?.desde).toBe(agosto.desde);
});

it("un fallo del presupuesto no oculta el análisis del período", async () => {
  vi.mocked(getPresupuestadoVsReal).mockRejectedValueOnce(
    new Error("Error de presupuesto"),
  );
  await act(async () => actual.consultar(agosto));
  expect(actual.reporte?.desde).toBe(agosto.desde);
  expect(actual.error).toBeNull();
  expect(actual.errorPresupuesto).toBeTruthy();
});

it("resuelve meses completos, febrero bisiesto y el cambio de año sin cambiar de día por zona", () => {
  expect(mesAnalisisEgresos("2026-01-15", -1)).toEqual({
    desde: "2025-12-01",
    hasta: "2025-12-31",
  });
  const febrero = { desde: "2024-02-01", hasta: "2024-02-29" };
  expect(mesAnalisisEgresos("2024-02-12")).toEqual(febrero);
  expect(mesCompletoAnalisis(febrero)).toBe("2024-02");
  expect(mesCompletoAnalisis({ ...febrero, hasta: "2024-02-28" })).toBeNull();
});
