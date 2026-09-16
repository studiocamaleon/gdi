import { describe, expect, it } from "vitest";
import {
  buildStationsModel,
  computeStationStats,
} from "./estaciones-operacion";
import { buildItemView } from "./produccion-item-view";
import { modoTableroGuardado } from "./tablero-modos";
import type { TableroItemData, TableroPasoData } from "./tablero-produccion";
import { calendarioDefault, type Estacion } from "./estaciones";

export const estacionQA: Estacion = {
  id: "impresion",
  nombre: "Impresión QA",
  descripcion: "",
  activo: true,
  etapa: "impresion",
  icono: "Printer",
  capacidadConcurrente: 2,
  tiempoPreparacionMin: null,
  calendario: calendarioDefault(),
  familias: ["manual"],
  empleados: [],
  maquinas: [
    { id: "maq", codigo: "M1", nombre: "Máquina QA", centroCostoId: null },
  ],
  createdAt: "",
  updatedAt: "",
};
export function pasoQA(
  id: string,
  patch: Partial<TableroPasoData> = {},
): TableroPasoData {
  return {
    id,
    indice: 0,
    nombre: id,
    familiaCodigo: "manual",
    estado: "pendiente",
    tipoEjecucion: "interno",
    duracionEstimadaMin: 20,
    mesaEsMia: false,
    mesaUsuarioNombre: null,
    ...patch,
  } as TableroPasoData;
}
export function itemQA(pasos: TableroPasoData[]): TableroItemData {
  return {
    id: "item",
    ordenId: "ot",
    ordenNumero: "OT-2026-0001",
    ordenEstado: "PENDIENTE",
    archivosCount: 0,
    itemIndice: 0,
    nombre: "Producto QA",
    codigo: "P1",
    clienteNombre: "Cliente QA",
    vendedorNombre: "Vendedor QA",
    cantidad: 1,
    cantidadUnidad: "u.",
    fechaEntrega: "2026-09-24",
    specs: [],
    pasos,
    sinRuta: false,
  } as TableroItemData;
}
const view = (pasos: TableroPasoData[], estaciones = [estacionQA]) =>
  buildItemView(
    itemQA(pasos),
    estaciones,
    "America/Argentina/Buenos_Aires",
    new Date("2026-09-14T12:00:00Z"),
  );

describe("operación unificada de estaciones", () => {
  it("conserva estaciones activas sin tareas para permitir configurarlas", () => {
    const model = buildStationsModel(
      [],
      [estacionQA, { ...estacionQA, id: "inactiva", activo: false }],
    );
    expect(model.stations.map((e) => e.key)).toEqual(["impresion"]);
    expect(model.tareas.size).toBe(0);
  });
  it("separa la cola actual del trabajo futuro sin duplicar duración", () => {
    const v = view([
      pasoQA("actual", { maquinaId: "maq" }),
      pasoQA("futuro", { indice: 1, duracionEstimadaMin: 40 }),
    ]);
    const model = buildStationsModel([v], [estacionQA]);
    expect(model.tareas.get("impresion")?.map((t) => t.step.paso.id)).toEqual([
      "actual",
    ]);
    expect(
      model.entrantes.get("impresion")?.map((t) => t.step.paso.id),
    ).toEqual(["futuro"]);
    const stats = computeStationStats(
      model.tareas.get("impresion")!,
      model.entrantes.get("impresion")!,
      new Map(),
    );
    expect(stats).toMatchObject({
      total: 1,
      colaMin: 20,
      entranteMin: 40,
      entranteCount: 1,
    });
  });
  it("reubica el trabajo al cambiar la máquina de estación sin modificar la OT", () => {
    const v = view([pasoQA("actual", { maquinaId: "maq" })]);
    const before = JSON.stringify(v.data);
    const destino = { ...estacionQA, id: "destino" };
    const model = buildStationsModel(
      [v],
      [{ ...estacionQA, maquinas: [] }, destino],
    );
    expect(model.tareas.get("destino")?.length).toBe(1);
    expect(model.tareas.has("impresion")).toBe(false);
    expect(JSON.stringify(v.data)).toBe(before);
  });
  it("mantiene los trabajos sin asignación y tercerizados visibles", () => {
    const model = buildStationsModel(
      [
        view([pasoQA("sin", { maquinaId: "desconocida" })]),
        view([pasoQA("tercero", { tipoEjecucion: "tercerizado" })]),
      ],
      [estacionQA],
    );
    expect(model.tareas.get("sin-estacion")?.length).toBe(1);
    expect(model.tareas.get("proveedor-tercerizado")?.length).toBe(1);
  });
  it("conserva quién tiene la tarea en su mesa al construir el modelo", () => {
    const model = buildStationsModel(
      [view([pasoQA("mio", { mesaEsMia: true, mesaUsuarioNombre: "QA" })])],
      [estacionQA],
    );
    expect(model.tareas.get("impresion")?.[0].step.paso).toMatchObject({
      mesaEsMia: true,
      mesaUsuarioNombre: "QA",
    });
  });
  it("considera 0 minutos conocidos y conserva las medianas como fallback", () => {
    const tasks = buildStationsModel(
      [
        view([pasoQA("cero", { duracionEstimadaMin: 0 })]),
        view([pasoQA("mediana", { duracionEstimadaMin: null })]),
      ],
      [estacionQA],
    ).tareas.get("impresion")!;
    expect(
      computeStationStats(tasks, [], new Map([["manual", 15]])),
    ).toMatchObject({ colaMin: 15, sinEstimar: 0 });
  });
  it("migra la preferencia retirada y mantiene Kanban como elección válida", () => {
    expect(modoTableroGuardado("estacion")).toBe("items");
    expect(modoTableroGuardado("simulacion")).toBe("items");
    expect(modoTableroGuardado(null)).toBe("items");
    expect(modoTableroGuardado("kanban")).toBe("kanban");
  });
});
