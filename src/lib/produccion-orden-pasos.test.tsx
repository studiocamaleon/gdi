import { ordenarPasosProduccion } from "../../apps/api/src/ordenes-trabajo/orden-pasos-produccion";
import { renderToStaticMarkup } from "react-dom/server";
import { ItemDetailSheet } from "@/components/produccion/tablero-produccion";
vi.mock("@/lib/fuentes-simulacion", () => ({ fuentesSimulacion: "" }));
import { describe, expect, it, vi } from "vitest";
import { buildItemView } from "./produccion-item-view";
import {
  pasoActivo,
  pasoReabrible,
  type TableroItemData,
  type TableroPasoData,
} from "./tablero-produccion";

function paso(
  id: string,
  indice: number,
  predecesores: string[],
  estado = "pendiente",
): TableroPasoData {
  return {
    id,
    indice,
    nodoClave: id,
    nombre: id,
    estado,
    predecesorPasoIds: predecesores,
    sucesorPasoIds:
      id === "Preprensa"
        ? ["Impresión"]
        : id === "Impresión"
          ? ["Refilado"]
          : [],
    familiaCodigo: "pre_prensa",
    categoriaFamilia: "preprensa",
    centroCostoId: null,
    centroCostoNombre: null,
    duracionEstimadaMin: 10,
    motivoBloqueo: null,
    iniciadoEl: null,
    completadoEl: null,
    modoRegistro: "cronometro",
    tiempoRealMin: null,
    tiempoFuente: null,
    iniciadoPorNombre: null,
    completadoPorNombre: null,
    tramoAbierto: null,
    tiempoAcumuladoMin: 0,
    motivoPausa: null,
    mesaEsMia: false,
    mesaUsuarioNombre: null,
    tipoEjecucion: "interno",
    proveedorNombre: null,
    plazoProveedorDias: null,
    estadoCompra: null,
  } as TableroPasoData;
}
function itemDePrueba(): TableroItemData {
  return {
    id: "item-ficticio",
    ordenId: "orden-ficticia",
    ordenNumero: "OT-PRUEBA",
    ordenEstado: "pendiente",
    itemIndice: 0,
    codigo: "PVC",
    nombre: "PVC de prueba",
    clienteNombre: "Cliente ficticio",
    vendedorNombre: "Vendedora",
    cantidad: 1,
    cantidadUnidad: "u",
    specs: [],
    fechaEntrega: null,
    archivosCount: 0,
    sinRuta: false,
    pasos: [
      paso("Impresión", 0, ["Preprensa"]),
      paso("Refilado", 1, ["Impresión"]),
      paso("Preprensa", 2, []),
    ],
  };
}
describe("orden visual del flujo de producción", () => {
  it("muestra preprensa antes de impresión y refilado aunque su índice de costeo sea posterior", () => {
    const item = itemDePrueba();
    const vista = buildItemView(item, []);
    expect(vista.steps.map((s) => s.paso.nombre)).toEqual([
      "Preprensa",
      "Impresión",
      "Refilado",
    ]);
    expect(vista.currentSteps.map((s) => s.paso.nombre)).toEqual(["Preprensa"]);
    expect(item.pasos.map((s) => s.nombre)).toEqual([
      "Impresión",
      "Refilado",
      "Preprensa",
    ]);
  });
  it("conserva la secuencia al completar y reabrir, sin habilitar pasos posteriores", () => {
    const item = itemDePrueba();
    const [impresion, refilado, preprensa] = item.pasos;
    expect(pasoActivo(item, impresion)).toBe(false);
    expect(pasoActivo(item, refilado)).toBe(false);
    preprensa.estado = "hecho";
    expect(pasoActivo(item, impresion)).toBe(true);
    expect(pasoActivo(item, refilado)).toBe(false);
    expect(pasoReabrible(item, preprensa)).toBe(true);
    impresion.estado = "en_curso";
    expect(pasoReabrible(item, preprensa)).toBe(false);
    expect(buildItemView(item, []).steps.map((s) => s.paso.nombre)).toEqual([
      "Preprensa",
      "Impresión",
      "Refilado",
    ]);
  });
});

it("el sheet dibuja y numera las tarjetas en el mismo orden que el flujo", () => {
  const vista = buildItemView(itemDePrueba(), []);
  const html = renderToStaticMarkup(
    <ItemDetailSheet
      item={vista}
      busy={false}
      canManage
      canSupervise
      estaciones={[]}
      estacionIdsEjecutables={[]}
      alcance="completo"
      onAccion={vi.fn()}
      onGate={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  const nombres = [...html.matchAll(/class="ds-tec">([^<]+)</g)].map(
    (m) => m[1],
  );
  expect(nombres).toEqual(["Preprensa", "Impresión", "Refilado"]);
  const numeros = [...html.matchAll(/class="ix">(\d+)</g)].map((m) => m[1]);
  expect(numeros).toEqual(["1", "2", "3"]);
});

it("conserva el orden enviado por la API cuando hay un paso intermedio oculto de nesting", () => {
  const item = itemDePrueba();
  const [impresion, refilado, preprensa] = item.pasos;
  const compartido = {
    ...impresion,
    id: "compartido",
    predecesorPasoIds: [preprensa.id],
  };
  impresion.predecesorPasoIds = [compartido.id];
  item.pasos = ordenarPasosProduccion(
    [impresion, refilado, preprensa, compartido],
    (p) => p.predecesorPasoIds ?? [],
  ).filter((p) => p.id !== compartido.id);
  expect(buildItemView(item, []).steps.map((s) => s.paso.id)).toEqual([
    "Preprensa",
    "Impresión",
    "Refilado",
  ]);
});
