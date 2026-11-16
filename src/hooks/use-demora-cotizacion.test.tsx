// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDemoraCotizacion, type EntradaDemora, type RespuestaDemora } from "./use-demora-cotizacion";
import { estimarDemoraNuevos, type ItemHipotetico } from "@/lib/flujo-produccion";
vi.mock("@/lib/flujo-produccion", () => ({ estimarDemoraNuevos: vi.fn(() => { throw new Error("Motor en pantalla"); }) }));

class WorkerDoble {
  static todos: WorkerDoble[] = [];
  onmessage?: (evento: { data: RespuestaDemora }) => void;
  onerror?: () => void;
  onmessageerror?: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { WorkerDoble.todos.push(this); }
  responder(resultado = resultadoA) { this.onmessage?.({ data: { resultado } }); }
}
const contexto = { enCola: [], estaciones: [], medianas: new Map(), ahora: new Date("2026-11-16T12:00:00Z"), noLaborables: new Set(["2026-11-20"]) };
const receta: ItemHipotetico[] = [{ id: "a", pasos: [{ familiaCodigo: "corte", centroCostoId: null, duracionMin: 60 }] }];
const resultadoA = new Map([["a", { finEstimado: new Date("2026-11-16T14:00:00Z"), sinEstimar: false, parcial: false, asumeDesbloqueo: false }]]);
let root: ReturnType<typeof createRoot>;
let vista: ReturnType<typeof useDemoraCotizacion>;
function Panel({ nuevos = receta, ctx = contexto, activo = true }: { nuevos?: ItemHipotetico[]; ctx?: Omit<EntradaDemora, "nuevos"> | null; activo?: boolean }) {
  const actual = useDemoraCotizacion(nuevos, ctx, activo);
  useEffect(() => { vista = actual; }, [actual]);
  return <span>{actual.calculando ? "Calculando" : "Listo"}</span>;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  WorkerDoble.todos = [];
  vi.stubGlobal("Worker", WorkerDoble);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  root = createRoot(document.createElement("div"));
});
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("ni el render ni las actualizaciones ejecutan el motor en la pantalla", async () => {
  expect(renderToStaticMarkup(<Panel />)).toContain("Calculando");
  expect(WorkerDoble.todos).toHaveLength(0);
  await act(async () => root.render(<Panel />));
  expect(vista.porItem).toBeNull();
  const worker = WorkerDoble.todos[0];
  expect(worker.postMessage).toHaveBeenCalledWith({ ...contexto, nuevos: receta });
  await act(async () => worker.responder());
  expect(vista.porItem).toEqual(resultadoA);
  expect(vista.calculando).toBe(false);
  expect(estimarDemoraNuevos).not.toHaveBeenCalled();
});
it("completar una fecha o volver a proyectar la misma receta no repite la simulación", async () => {
  await act(async () => root.render(<Panel />));
  await act(async () => WorkerDoble.todos[0].responder());
  await act(async () => root.render(<Panel nuevos={JSON.parse(JSON.stringify(receta))} />));
  expect(WorkerDoble.todos).toHaveLength(1);
  expect(vista.porItem).toEqual(resultadoA);
  expect(vista.calculando).toBe(false);
});
it("cancela y descarta respuestas de una cantidad anterior aunque lleguen después", async () => {
  await act(async () => root.render(<Panel />));
  const vieja = WorkerDoble.todos[0];
  const nuevos = [{ ...receta[0], pasos: [{ ...receta[0].pasos[0], duracionMin: 180 }] }];
  await act(async () => root.render(<Panel nuevos={nuevos} />));
  expect(vieja.terminate).toHaveBeenCalled();
  await act(async () => vieja.responder());
  expect(vista.porItem).toBeNull();
  expect(vista.calculando).toBe(true);
  const actual = new Map([["a", { ...resultadoA.get("a")!, finEstimado: new Date("2026-11-16T16:00:00Z") }]]);
  await act(async () => WorkerDoble.todos[1].responder(actual));
  expect(vista.porItem).toEqual(actual);
});
it("una nueva carga del taller renueva la entrega sin publicar la estimación anterior", async () => {
  await act(async () => root.render(<Panel />));
  await act(async () => WorkerDoble.todos[0].responder());
  await act(async () => root.render(<Panel ctx={{ ...contexto, ahora: new Date("2026-11-17T12:00:00Z") }} />));
  expect(WorkerDoble.todos).toHaveLength(2);
  expect(vista.porItem).toBeNull();
  expect(vista.calculando).toBe(true);
});
it.each(["error", "mensaje", "timeout", "constructor"])("un fallo de %s no deja una fecha vieja ni vuelve a bloquear la pantalla", async (modo) => {
  if (modo === "constructor") vi.stubGlobal("Worker", class { constructor() { throw new Error("No disponible"); } });
  await act(async () => root.render(<Panel />));
  await act(async () => {
    if (modo === "error") WorkerDoble.todos[0].onerror?.();
    if (modo === "mensaje") WorkerDoble.todos[0].onmessage?.({ data: { error: "falló" } });
    if (modo === "timeout") vi.advanceTimersByTime(30_000);
  });
  expect(vista.calculando).toBe(false);
  expect(vista.porItem?.get("a")).toMatchObject({ finEstimado: null, sinEstimar: true, motivoSinEstimar: expect.stringContaining("No se pudo") });
  expect(estimarDemoraNuevos).not.toHaveBeenCalled();
});
it("no calcula fichas sin productos, sin contexto o ya emitidas y cancela al salir", async () => {
  await act(async () => root.render(<Panel nuevos={[]} />));
  await act(async () => root.render(<Panel ctx={null} />));
  await act(async () => root.render(<Panel activo={false} />));
  expect(WorkerDoble.todos).toHaveLength(0);
  await act(async () => root.render(<Panel />));
  const worker = WorkerDoble.todos[0];
  await act(async () => root.render(<Panel activo={false} />));
  await act(async () => worker.responder());
  expect(worker.terminate).toHaveBeenCalled();
  expect(vista.porItem).toBeNull();
  expect(vista.calculando).toBe(false);
});
