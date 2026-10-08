// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { CapacidadesProvider } from "@/components/navigation/capacidades-provider";
import { buildItemView } from "@/lib/produccion-item-view";
import type { TableroItemData } from "@/lib/tablero-produccion";
vi.mock("@/lib/fuentes-simulacion", () => ({ fuentesSimulacion: "" }));
vi.mock("@/lib/ordenes-trabajo-api", () => ({
  getDetalleItemTablero: vi.fn(async () => ({ materiales: [], eventos: [] })),
  getOrdenTrabajo: vi.fn(),
  getItemTablero: vi.fn(),
}));
vi.mock("@/lib/impresion-api", () => ({
  getVistaEtiqueta: vi.fn(),
  getConfiguracionImpresion: vi.fn(),
}));
vi.mock("@/lib/etiqueta-pdf", () => ({ descargarEtiquetaPdf: vi.fn() }));
import { getOrdenTrabajo } from "@/lib/ordenes-trabajo-api";
import {
  getConfiguracionImpresion,
  getVistaEtiqueta,
} from "@/lib/impresion-api";
import { descargarEtiquetaPdf } from "@/lib/etiqueta-pdf";
import { ItemDetailSheet } from "./tablero-produccion";

const vista = {
  numero: "OT-QA-001",
  anchoMm: 100,
  altoMm: 150,
  paginas: ["data:image/png;base64,AA=="],
};
const trabajo = (estado = "finalizada", id = "item-a", ordenId = "ot-a") =>
  buildItemView(
    {
      id,
      ordenId,
      ordenNumero: "OT-QA-001",
      ordenEstado: estado,
      itemIndice: 0,
      codigo: "PAPEL",
      nombre: "Impresión ficticia",
      clienteNombre: "Cliente ficticio",
      cantidad: 2,
      cantidadUnidad: "u",
      specs: [],
      fechaEntrega: "2026-10-10",
      archivosCount: 0,
      sinRuta: true,
      pasos: [],
    } as TableroItemData,
    [],
    "UTC",
    new Date("2026-10-08T12:00:00Z"),
  );
let contenedor: HTMLDivElement;
let root: Root;
const cerrar = vi.fn();
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.mocked(getVistaEtiqueta).mockResolvedValue(vista);
  vi.mocked(descargarEtiquetaPdf).mockResolvedValue(undefined);
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});
afterEach(async () => {
  await act(async () => root.unmount());
  contenedor.remove();
  vi.unstubAllGlobals();
});
async function montar({
  estado = "finalizada",
  id = "item-a",
  ordenId = "ot-a",
  abierto = true,
  permisos = ["produccion.ejecutar"],
  pdf = true,
  directa = false,
} = {}) {
  await act(async () =>
    root.render(
      <PermisosProvider permisos={["acceso.por_vista", ...permisos]}>
        <CapacidadesProvider
          capacidades={{
            funciones: { etiquetas_pdf: pdf, impresion_directa: directa },
          }}
        >
          <ItemDetailSheet
            item={abierto ? trabajo(estado, id, ordenId) : undefined}
            alcance="operario"
            busy={false}
            canManage
            canSupervise={false}
            estaciones={[]}
            estacionIdsEjecutables={null}
            onAccion={vi.fn()}
            onGate={vi.fn()}
            onClose={cerrar}
          />
        </CapacidadesProvider>
      </PermisosProvider>,
    ),
  );
}
const boton = (texto: string) =>
  Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent === texto,
  );
async function pulsar(texto: string) {
  expect(boton(texto)).toBeDefined();
  await act(async () => boton(texto)!.click());
}
it("recupera la etiqueta completa desde cualquier ítem sin consultar la ficha comercial", async () => {
  for (const id of ["item-a", "item-b"]) {
    await montar({ id });
    expect(
      contenedor.querySelector('a[href^="/produccion/ordenes/"]'),
    ).toBeNull();
    await pulsar("Descargar etiqueta");
    expect(getVistaEtiqueta).toHaveBeenLastCalledWith("ot-a");
    expect(
      document.querySelector('img[alt="Etiqueta 1 de 1 para OT-QA-001"]'),
    ).not.toBeNull();
    await pulsar("Descargar PDF");
    expect(descargarEtiquetaPdf).toHaveBeenLastCalledWith(vista, "ot-a");
    await pulsar("Cerrar");
    expect(boton("Descargar etiqueta")).toBeDefined();
  }
  expect(getOrdenTrabajo).not.toHaveBeenCalled();
  expect(getConfiguracionImpresion).not.toHaveBeenCalled();
  expect(cerrar).not.toHaveBeenCalled();
});
it("Escape cierra sólo la etiqueta y permite recuperarla nuevamente", async () => {
  await montar();
  await pulsar("Descargar etiqueta");
  await act(async () =>
    boton("Cerrar")!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(cerrar).not.toHaveBeenCalled();
  expect(boton("Descargar PDF")).toBeUndefined();
  await pulsar("Descargar etiqueta");
  expect(boton("Descargar PDF")).toBeDefined();
});
it("no arrastra una etiqueta al cerrar el sheet o cambiar de orden", async () => {
  await montar();
  await pulsar("Descargar etiqueta");
  await montar({ abierto: false });
  await montar();
  expect(boton("Descargar PDF")).toBeUndefined();
  await pulsar("Descargar etiqueta");
  await montar({ id: "item-otra", ordenId: "ot-otra" });
  expect(boton("Descargar PDF")).toBeUndefined();
  expect(getVistaEtiqueta).not.toHaveBeenCalledWith("ot-otra");
  await pulsar("Descargar etiqueta");
  expect(getVistaEtiqueta).toHaveBeenLastCalledWith("ot-otra");
});
it.each(["produccion", "pendiente", "borrador", "cancelada"])(
  "no etiqueta una OT %s aunque el ítem no tenga pasos pendientes",
  async (estado) => {
    await montar({ estado });
    expect(boton("Descargar etiqueta")).toBeUndefined();
    expect(getVistaEtiqueta).not.toHaveBeenCalled();
  },
);
it("permite volver a descargar una orden ya entregada", async () => {
  await montar({ estado: "entregada" });
  await pulsar("Descargar etiqueta");
  await pulsar("Descargar PDF");
  expect(descargarEtiquetaPdf).toHaveBeenCalledWith(vista, "ot-a");
});
it("respeta permisos y capacidades, sin depender de Ver OT", async () => {
  await montar({ permisos: [] });
  expect(boton("Descargar etiqueta")).toBeUndefined();
  await montar({ pdf: false });
  expect(boton("Descargar etiqueta")).toBeUndefined();
  await montar({ pdf: false, directa: true });
  expect(boton("Imprimir etiqueta")).toBeDefined();
  await montar({ permisos: ["produccion.tablero.ver"] });
  expect(boton("Descargar etiqueta")).toBeDefined();
  expect(contenedor.querySelector("a")).toBeNull();
});
it("permite reintentar si falla la vista previa", async () => {
  vi.mocked(getVistaEtiqueta).mockRejectedValueOnce(
    new Error("Error ficticio de conexión"),
  );
  await montar();
  await pulsar("Descargar etiqueta");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "Error ficticio",
  );
  await pulsar("Reintentar carga");
  await pulsar("Descargar PDF");
  expect(descargarEtiquetaPdf).toHaveBeenCalledWith(vista, "ot-a");
});
