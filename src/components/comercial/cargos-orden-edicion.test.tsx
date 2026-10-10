// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { PropuestaFicha } from "./propuesta-ficha";
import { getMockOrdenDetalle } from "@/lib/ordenes-trabajo";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { CLIENTE_ESCANEADO_EVENT } from "@/lib/clientes-api";
import type { PropuestaItem } from "@/lib/propuestas";
import { NotificacionesProvider } from "@/components/notificaciones/notificaciones-provider";

const mocks = vi.hoisted(() => ({
  guardar: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  presupuesto: vi.fn(),
  emitir: vi.fn(),
  cotizar: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: vi.fn(),
    refresh: mocks.refresh,
  }),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  apiRequest: vi.fn(async () => {
    throw new Error("Sin servicios externos en este ensayo");
  }),
}));
vi.mock("@/lib/ordenes-trabajo-api", async (original) => ({
  ...(await original<typeof import("@/lib/ordenes-trabajo-api")>()),
  editarOrdenTrabajoLote: mocks.guardar,
}));
vi.mock("@/lib/presupuestos-api", async (original) => ({
  ...(await original<typeof import("@/lib/presupuestos-api")>()),
  guardarBorradorPresupuesto: mocks.presupuesto,
  emitirPresupuesto: mocks.emitir,
}));
vi.mock("./tipo-cambio-documento", async (original) => ({
  ...(await original<typeof import("./tipo-cambio-documento")>()),
  useMotorConTipoCambio: () => ({
    cotizarYGuardar: mocks.cotizar,
    cotizar: mocks.cotizar,
  }),
}));
const itemPresupuesto = {
  id: "linea",
  productoNombre: "Producto de prueba",
  productoCodigo: "PRUEBA",
  motorCodigo: "producto-prueba",
  jobContext: {},
  cotizacionItemId: "snapshot-anterior",
  categoriaComercialCodigo: "",
  categoriaComercialNombre: "",
  subcategoriaComercialCodigo: "",
  subcategoriaComercialNombre: "",
  unidadMedida: "unidad",
  cantidad: 1,
  precioUnitario: 1210,
  subtotal: 1000,
  impuestoPorcentaje: 21,
  impuestoMonto: 210,
  total: 1210,
  especificaciones: {},
  atributosSchema: [],
  adicionales: [],
  pasos: [],
  cotizacion: {
    productoId: "producto-prueba",
    cantidadEfectiva: 1,
    pasos: [],
    cargosDirectosCotizacion: [],
    precio: { precioTotal: 1210, precioUnitario: 1210 },
  },
} as unknown as PropuestaItem;
vi.mock("./agregar-producto-sheet", () => ({
  AgregarProductoSheet: ({ onAddItem }: any) => (
    <button onClick={() => onAddItem(itemPresupuesto)}>
      Producto de ensayo
    </button>
  ),
}));
vi.mock("./canal-venta-selector", () => ({
  CanalVentaSelector: ({ onChange }: any) => (
    <button onClick={() => onChange("mostrador")}>Canal de ensayo</button>
  ),
}));
const cargo = {
  id: "cargo-local",
  cargoDirectoCatalogoId: "catalogo-prueba",
  codigoSnapshot: "VIATICO",
  nombreSnapshot: "Viático",
  modoCalculoSnapshot: "MONTO_FIJO_PLANO",
  configSnapshot: { zonaAplicada: { codigo: "centro" } },
  montoNeto: 100,
  impuestoPorcentaje: 21,
  impuestoMonto: 21,
  total: 121,
};
vi.mock("./cargo-orden-dialog", () => ({
  CargoOrdenDialog: ({ open, onAdd }: any) =>
    open ? (
      <button onClick={() => onAdd(cargo)}>Confirmar cargo de prueba</button>
    ) : null,
}));

let el: HTMLDivElement;
let root: Root;
const orden = {
  ...getMockOrdenDetalle("mock-0184")!,
  estado: "borrador" as const,
  cargosDirectos: 0,
  cargos: [],
  productos: getMockOrdenDetalle("mock-0184")!.productos.map((p, i) => ({
    ...p,
    id: `item-${i}`,
    cotizacionItemId: `cot-${i}`,
  })),
  version: "2026-10-08T12:00:00Z",
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal(
    "EventSource",
    class {
      addEventListener() {}
      removeEventListener() {}
      close() {}
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  HTMLElement.prototype.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  mocks.guardar.mockReset().mockResolvedValue(orden);
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
  vi.unstubAllGlobals();
});
const boton = (texto: string) =>
  [...el.querySelectorAll("button")].find(
    (b) =>
      b.textContent?.includes(texto) || b.getAttribute("aria-label") === texto,
  );
async function click(texto: string) {
  expect(boton(texto), texto).toBeDefined();
  await act(async () => boton(texto)!.click());
}
async function render(facturada = false, permiso = true) {
  await act(async () =>
    root.render(
      <PermisosProvider
        permisos={[
          "acceso.por_vista",
          "comercial.ordenes.ver",
          ...(permiso ? ["comercial.ordenes.gestionar"] : []),
        ]}
      >
        <NotificacionesProvider>
          <PropuestaFicha
            orden={{ ...orden, facturadoTotal: facturada ? 100 : 0 }}
          />
        </NotificacionesProvider>
      </PermisosProvider>,
    ),
  );
}

it("agrega un cargo desde Editar orden y lo incluye al guardar sin tocar productos", async () => {
  await render();
  expect(boton("Agregar cargo")).toBeUndefined();
  await click("Editar orden");
  await click("Agregar cargo");
  await click("Confirmar cargo de prueba");
  await click("Guardar cambios");
  expect(mocks.guardar).toHaveBeenCalledWith(
    orden.id,
    expect.objectContaining({
      expectedVersion: orden.version,
      items: undefined,
      cargos: [
        expect.objectContaining({
          cargoDirectoCatalogoId: cargo.cargoDirectoCatalogoId,
          montoNeto: 100,
        }),
      ],
    }),
  );
  expect(mocks.guardar.mock.calls[0][1].cargos[0]).not.toHaveProperty("id");
});

it("cancelar la edición descarta los cargos sin llamar a la API", async () => {
  await render();
  await click("Editar orden");
  await click("Agregar cargo");
  await click("Confirmar cargo de prueba");
  await click("Cancelar");
  expect(mocks.guardar).not.toHaveBeenCalled();
  await click("Editar orden");
  expect(boton("Guardar cambios")).toBeUndefined();
  expect(boton("Finalizar edición")).toBeDefined();
});

it("no ofrece cargos con factura ni permite entrar a edición sin permiso", async () => {
  await render(true);
  await click("Editar orden");
  expect(boton("Agregar cargo")).toBeUndefined();
});

it("un usuario de consulta no tiene edición de cargos", async () => {
  await render(false, false);
  expect(boton("Editar orden")).toBeUndefined();
  expect(boton("Agregar cargo")).toBeUndefined();
});

it("Guardar borrador de presupuesto usa su endpoint y agrupa snapshots previos, sin emitir OT ni enviar", async () => {
  mocks.presupuesto
    .mockReset()
    .mockResolvedValue({
      id: "presupuesto-prueba",
      numero: "PRES-PRUEBA",
      estado: "borrador",
    });
  mocks.emitir.mockReset();
  mocks.push.mockReset();
  mocks.cotizar
    .mockReset()
    .mockResolvedValue({
      cotizacionId: "cotizacion-nueva",
      cotizacionItemId: "snapshot-nuevo",
      result: { exitoso: true },
    });
  await act(async () =>
    root.render(
      <PermisosProvider
        permisos={[
          "acceso.por_vista",
          "comercial.presupuestos.ver",
          "comercial.presupuestos.gestionar",
        ]}
      >
        <NotificacionesProvider>
          <PropuestaFicha />
        </NotificacionesProvider>
      </PermisosProvider>,
    ),
  );
  await act(async () =>
    window.dispatchEvent(
      new CustomEvent(CLIENTE_ESCANEADO_EVENT, {
        detail: {
          id: "cliente-prueba",
          nombre: "Cliente de ensayo",
          contactos: [],
        },
      }),
    ),
  );
  await click("Canal de ensayo");
  await click("Producto de ensayo");
  await click("Guardar borrador");
  expect(mocks.presupuesto).toHaveBeenCalledWith(
    expect.objectContaining({
      cotizacionId: "cotizacion-nueva",
      clienteId: "cliente-prueba",
      canalVenta: "mostrador",
      items: [
        expect.objectContaining({
          cotizacionItemId: "snapshot-nuevo",
          nombre: "Producto de prueba",
        }),
      ],
    }),
  );
  expect(mocks.emitir).not.toHaveBeenCalled();
  expect(mocks.guardar).not.toHaveBeenCalled();
  expect(mocks.push).toHaveBeenCalledWith(
    "/comercial/presupuestos/presupuesto-prueba",
  );
});
