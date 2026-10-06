// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { buildItemView } from "@/lib/produccion-item-view";
import type { TableroItemData } from "@/lib/tablero-produccion";
vi.mock("@/lib/fuentes-simulacion", () => ({ fuentesSimulacion: "" }));
vi.mock("@/lib/ordenes-trabajo-api", () => ({
  getDetalleItemTablero: vi.fn(),
  getOrdenTrabajo: vi.fn(),
  getItemTablero: vi.fn(),
}));
vi.mock("@/lib/archivos-api", () => ({
  listarArchivos: vi.fn(async () => []),
}));
import {
  getDetalleItemTablero,
  getOrdenTrabajo,
} from "@/lib/ordenes-trabajo-api";
import { listarArchivos } from "@/lib/archivos-api";
import { ItemDetailSheet } from "./tablero-produccion";

const trabajo = (id = "trabajo-1") =>
  buildItemView(
    {
      id,
      ordenId: "ot-ficticia",
      ordenNumero: "OT-QA",
      ordenEstado: "produccion",
      itemIndice: 0,
      codigo: "PAPEL",
      nombre: "Impresión ficticia",
      clienteNombre: "Cliente ficticio",
      vendedorNombre: "Vendedora ficticia",
      cantidad: 2,
      cantidadUnidad: "u",
      specs: [],
      fechaEntrega: "2026-10-10",
      archivosCount: 1,
      sinRuta: true,
      pasos: [],
    } as TableroItemData,
    [],
    "UTC",
    new Date("2026-10-06T12:00:00Z"),
  );
let contenedor: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  vi.mocked(getDetalleItemTablero).mockImplementation(async (id) => ({
    materiales: [{ nombre: `Papel de ${id}`, cantidad: 2, unidad: "hojas" }],
    notaProduccion: "Imprimir a dos caras",
    eventos: [
      {
        fecha: "2026-10-06T12:00:00Z",
        tipo: "paso",
        descripcion: "Impresión iniciada",
        usuarioNombre: "Operadora ficticia",
      },
    ],
  }));
  contenedor = document.createElement("div");
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});
afterEach(async () => {
  await act(async () => root.unmount());
  contenedor.remove();
});
async function montar(permisos: string[], id?: string) {
  await act(async () =>
    root.render(
      <PermisosProvider permisos={["acceso.por_vista", ...permisos]}>
        <ItemDetailSheet
          item={trabajo(id)}
          alcance="completo"
          busy={false}
          canManage
          canSupervise={false}
          estaciones={[]}
          estacionIdsEjecutables={null}
          onAccion={vi.fn()}
          onGate={vi.fn()}
          onClose={vi.fn()}
        />
      </PermisosProvider>,
    ),
  );
}
async function tab(nombre: string) {
  const boton = Array.from(
    contenedor.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  ).find((b) => b.textContent?.startsWith(nombre));
  expect(boton).toBeDefined();
  await act(async () => boton!.click());
}
it("alcance completo del taller no autoriza Ver OT ni descarga su ficha comercial", async () => {
  await montar(["produccion.tablero.ver", "produccion.ejecutar"]);
  expect(
    contenedor.querySelector('a[href^="/produccion/ordenes/"]'),
  ).toBeNull();
  expect(getOrdenTrabajo).not.toHaveBeenCalled();
  expect(getDetalleItemTablero).toHaveBeenCalledWith("trabajo-1");
  await tab("Materiales");
  expect(contenedor.textContent).toContain("Papel de trabajo-1");
  await tab("Actividad");
  expect(contenedor.textContent).toContain("Impresión iniciada");
  await tab("Archivos");
  expect(listarArchivos).toHaveBeenCalled();
});
it("comercial sí puede abrir la OT, pero el sheet usa igualmente sólo datos operativos", async () => {
  await montar(["produccion.tablero.ver", "comercial.ordenes.ver"]);
  expect(
    contenedor.querySelector('a[href="/produccion/ordenes/ot-ficticia"]'),
  ).not.toBeNull();
  expect(getOrdenTrabajo).not.toHaveBeenCalled();
});
it("cambiar de producto dentro de la misma orden actualiza sus materiales", async () => {
  await montar(["produccion.tablero.ver"]);
  await tab("Materiales");
  await montar(["produccion.tablero.ver"], "trabajo-2");
  expect(contenedor.textContent).toContain("Papel de trabajo-2");
  expect(contenedor.textContent).not.toContain("Papel de trabajo-1");
});
it("un fallo al cargar el detalle no se presenta como una lista vacía", async () => {
  vi.mocked(getDetalleItemTablero).mockRejectedValue(new Error("Sin conexión"));
  await montar(["produccion.tablero.ver"]);
  await tab("Materiales");
  expect(contenedor.querySelector('[role="alert"]')?.textContent).toContain(
    "No se pudo cargar",
  );
});
