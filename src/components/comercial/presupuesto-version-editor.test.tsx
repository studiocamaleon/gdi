// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { NotificacionesProvider } from "@/components/notificaciones/notificaciones-provider";
import type { PropuestaItem } from "@/lib/propuestas";
import type { PresupuestoEdicion } from "@/lib/presupuestos-api";
import { PropuestaFicha } from "./propuesta-ficha";

const mocks = vi.hoisted(() => ({
  guardar: vi.fn(),
  version: vi.fn(),
  push: vi.fn(),
  capturado: null as PropuestaItem | null,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  apiRequest: vi.fn(async () => {
    throw new Error("Sin conexiones externas en esta prueba");
  }),
}));
vi.mock("@/lib/presupuestos-api", async (original) => ({
  ...(await original<typeof import("@/lib/presupuestos-api")>()),
  crearVersionPresupuesto: mocks.version,
}));
vi.mock("./tipo-cambio-documento", () => ({
  TipoCambioDocumentoProvider: ({ children }: { children: ReactNode }) =>
    children,
  useTipoCambioDocumento: () => null,
  useMotorConTipoCambio: () => ({ cotizarYGuardar: mocks.guardar }),
}));
vi.mock("./agregar-producto-sheet", () => ({
  AgregarProductoSheet: ({
    editingItem,
    onSaveItem,
  }: {
    editingItem?: PropuestaItem;
    onSaveItem: (p: PropuestaItem) => void;
  }) => {
    if (!editingItem) return null;
    mocks.capturado = editingItem;
    return (
      <button
        onClick={() =>
          onSaveItem({
            ...editingItem,
            cantidad: 300,
            jobContext: { ...editingItem.jobContext, cantidad: 300 },
            subtotal: 30000,
            total: 30000,
            precioUnitario: 100,
          })
        }
      >
        Cambiar a 300 tarjetas
      </button>
    );
  },
}));

it("edita 500 → 300 y guarda una versión nueva sin modificar el snapshot anterior ni perder el cliente", async () => {
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
  const base: PresupuestoEdicion = {
    id: "pres-v1",
    numero: "PRES-QA-0001",
    version: 1,
    actualizadaEl: "2026-10-08T12:00:00.000Z",
    clienteId: "cliente-fuera-del-listado",
    cliente: {
      id: "cliente-fuera-del-listado",
      nombre: "Cliente de la versión original",
      razonSocial: "",
      email: "",
      telefonoCodigo: "+54",
      telefonoNumero: "00000000",
    },
    proyectoCampanaId: null,
    vendedorEmpleadoId: null,
    canalVenta: "mostrador",
    fechaEntrega: "2099-01-10",
    cargos: [],
    productos: [
      {
        id: "snapshot-v1",
        cotizacionItemId: "snapshot-v1",
        codigo: "QA",
        nombre: "Tarjetas ficticias",
        familia: "Tarjetas",
        cantidad: 500,
        cantidadUnidad: "u.",
        subtotal: 50000,
        impuestos: 0,
        total: 50000,
        specs: [],
        adicionales: [],
        snapshot: {
          productoId: "producto-qa",
          rutaAlternativaId: null,
          jobContext: { cantidad: 500 },
          resumen: {},
          trazabilidad: {},
          precioTotal: 50000,
          precioUnitario: 100,
          costoTotal: null,
          costoUnitario: null,
          precioSnapshots: {
            impuestos: [],
            comisiones: [],
            precioConfig: null,
            precioEspecialCliente: null,
          },
        },
      },
    ],
  };
  mocks.guardar.mockResolvedValue({
    result: { exitoso: true },
    cotizacionId: "cotizacion-v2",
    cotizacionItemId: "snapshot-v2",
  });
  mocks.version.mockResolvedValue({
    id: "pres-v2",
    numero: "PRES-QA-0001",
    estado: "borrador",
  });
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  const click = async (text: string) =>
    act(async () => {
      const b = [
        ...el.querySelectorAll<HTMLElement>('button,[role="tab"]'),
      ].find((e) => e.textContent?.includes(text));
      expect(b, text).toBeTruthy();
      b!.click();
    });
  try {
    await act(async () =>
      root.render(
        <PermisosProvider
          permisos={["acceso.por_vista", "comercial.presupuestos.gestionar"]}
        >
          <NotificacionesProvider>
            <PropuestaFicha presupuestoBase={base} initialClientes={[]} />
          </NotificacionesProvider>
        </PermisosProvider>,
      ),
    );
    expect(el.textContent).toContain("Cliente de la versión original");
    expect(el.textContent).toContain("Nueva versión 2");
    await click("Productos");
    await act(async () =>
      el
        .querySelector<HTMLButtonElement>(
          '[aria-label="Ver detalle de Tarjetas ficticias"]',
        )!
        .click(),
    );
    await click("Editar especificaciones");
    expect(mocks.capturado?.cotizacionItemId).toBeUndefined();
    await click("Cambiar a 300 tarjetas");
    await click("Guardar borrador");
    expect(mocks.guardar).toHaveBeenCalledWith(
      expect.objectContaining({
        productoId: "producto-qa",
        jobContext: { cantidad: 300 },
        cotizacionId: undefined,
      }),
    );
    expect(mocks.version).toHaveBeenCalledWith(
      "pres-v1",
      expect.objectContaining({
        cotizacionId: "cotizacion-v2",
        revisionBaseActualizadaEl: base.actualizadaEl,
        clienteId: base.clienteId,
        items: [
          expect.objectContaining({
            cantidad: 300,
            cotizacionItemId: "snapshot-v2",
          }),
        ],
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith("/comercial/presupuestos/pres-v2");
    expect(base.productos[0].cantidad).toBe(500);
  } finally {
    await act(async () => root.unmount());
    el.remove();
    vi.unstubAllGlobals();
  }
});
