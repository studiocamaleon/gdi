import { afterEach, expect, it, vi } from "vitest";
import { exhibidorControlado } from "../../apps/api/test/fixtures/f6-planificacion/exhibidor-controlado";
import { estimarDemoraNuevos } from "@/lib/flujo-produccion";
import { fechaRecomendadaEta } from "@/lib/eta-fechas";
import type { EntradaDemora, RespuestaDemora } from "./use-demora-cotizacion";

afterEach(() => vi.unstubAllGlobals());
it.each(["America/Argentina/Rio_Gallegos", "America/Santiago"])("conserva exactamente las entregas con colas, márgenes, feriados y calendario %s", async (zona) => {
  const taller = exhibidorControlado().taller;
  const entrada = {
    ...taller, zona, enCola: taller.items,
    ahora: new Date("2026-09-04T18:00:00Z"),
    noLaborables: new Set(["2026-09-07"]),
    nuevos: [
      { id: "nuevo-a", pasos: [
        { clave: "corte", familiaCodigo: "corte", maquinaId: "mesa-1", centroCostoId: null, duracionMin: 600 },
        { clave: "armado", predecesoras: ["corte"], familiaCodigo: "armado", centroCostoId: null, duracionMin: 120 },
      ] },
      { id: "nuevo-b", pasos: [{ familiaCodigo: "corte", centroCostoId: null, duracionMin: 60, planificadoDesde: "2026-09-09T14:00:00Z" }] },
      { id: "proveedor", pasos: [{ familiaCodigo: "externo", centroCostoId: null, duracionMin: 0, tercerizado: true, plazoProveedorDias: 3 }] },
      { id: "material-pendiente", pasos: [], motivoSinEstimar: "Falta fecha de abastecimiento" },
    ],
  } as unknown as EntradaDemora;
  const esperado = estimarDemoraNuevos(entrada);
  let respuesta: RespuestaDemora | undefined;
  const scope = { onmessage: ((evento: MessageEvent<EntradaDemora>) => { void evento; }), postMessage: (data: RespuestaDemora) => { respuesta = structuredClone(data); } };
  vi.stubGlobal("self", scope);
  vi.resetModules();
  await import("./demora-cotizacion.worker");
  scope.onmessage({ data: structuredClone(entrada) } as MessageEvent<EntradaDemora>);
  expect(respuesta).toEqual({ resultado: esperado });
  if (!respuesta || !("resultado" in respuesta)) throw new Error("Sin resultado");
  for (const [id, eta] of respuesta.resultado) {
    expect(fechaRecomendadaEta(eta, { zona, margenDias: 2, noLaborables: entrada.noLaborables }))
      .toBe(fechaRecomendadaEta(esperado.get(id), { zona, margenDias: 2, noLaborables: entrada.noLaborables }));
  }
  expect(respuesta.resultado.get("nuevo-a")?.finEstimado).toBeInstanceOf(Date);
});
it("no recorre el taller cuando todos los productos esperan materiales o no hay nuevos", () => {
  const entrada = { enCola: [{ get pasos() { throw new Error("No debe simular el taller"); } }], estaciones: [], medianas: new Map() };
  const nuevos = [{ id: "pendiente", pasos: [], motivoSinEstimar: "Consultando materiales" }];
  expect(estimarDemoraNuevos({ ...entrada, nuevos } as unknown as EntradaDemora).get("pendiente")).toMatchObject({ finEstimado: null, motivoSinEstimar: "Consultando materiales" });
  expect(estimarDemoraNuevos({ ...entrada, nuevos: [] } as unknown as EntradaDemora).size).toBe(0);
});
