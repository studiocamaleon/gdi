// @vitest-environment jsdom
import { act, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { podarPlata } from "../../../apps/api/src/auth/margenes";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { NotificacionesProvider } from "@/components/notificaciones/notificaciones-provider";
import type { PropuestaItem } from "@/lib/propuestas";
import { PropuestaFicha } from "./propuesta-ficha";

const estado = vi.hoisted(() => ({ item: null as unknown as PropuestaItem }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("./agregar-producto-sheet", () => ({
  AgregarProductoSheet: ({
    onAddItem,
  }: {
    onAddItem: (item: PropuestaItem) => void;
  }) => (
    <button onClick={() => onAddItem(estado.item)}>
      Incorporar cotización de prueba
    </button>
  ),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  apiRequest: vi.fn(async () => {
    throw new Error("Consulta externa desactivada en la prueba");
  }),
}));
class Limite extends Component<
  { children: ReactNode; fallo: (e: Error) => void },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(e: Error) {
    this.props.fallo(e);
  }
  render() {
    return this.state.error ? <p>Vista interrumpida</p> : this.props.children;
  }
}
const nodos: HTMLElement[] = [];
afterEach(() => {
  nodos.forEach((e) => e.remove());
  nodos.length = 0;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each(["comercial.ordenes.gestionar", "comercial.presupuestos.gestionar"])(
  "%s incorpora un producto sin recibir costos ni márgenes",
  async (permiso) => {
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
    estado.item = podarPlata({
      id: "item-ficticio",
      productoNombre: "Producto de prueba",
      productoCodigo: "PRUEBA",
      motorCodigo: "producto-ficticio",
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
        productoId: "producto-ficticio",
        cantidadEfectiva: 1,
        pasos: [],
        cargosDirectosCotizacion: [],
        costos: {
          total: 400,
          unitario: 400,
          materialesTotal: 200,
          tiempoTotal: 200,
          cargosDirectosTotal: 0,
        },
        precio: { precioTotal: 1210, precioUnitario: 1210 },
      },
    } as unknown as PropuestaItem);
    expect(estado.item.cotizacion).not.toHaveProperty("costos");
    const el = document.createElement("div");
    document.body.append(el);
    nodos.push(el);
    const root = createRoot(el);
    const fallo = vi.fn();
    try {
      await act(async () =>
        root.render(
          <Limite fallo={fallo}>
            <PermisosProvider permisos={["acceso.por_vista", permiso]}>
              <NotificacionesProvider>
                <PropuestaFicha />
              </NotificacionesProvider>
            </PermisosProvider>
          </Limite>,
        ),
      );
      await act(async () =>
        [...el.querySelectorAll("button")]
          .find((b) => b.textContent === "Incorporar cotización de prueba")!
          .click(),
      );
      expect(fallo.mock.calls.map(([e]) => e.message)).toEqual([]);
      await act(async () =>
        [...el.querySelectorAll<HTMLElement>('[role="tab"]')]
          .find((b) => b.textContent?.includes("Productos"))!
          .click(),
      );
      expect(fallo.mock.calls.map(([e]) => e.message)).toEqual([]);
      expect(el.textContent).toContain("Producto de prueba");
      await act(async () =>
        el
          .querySelector<HTMLButtonElement>(
            '[aria-label="Ver detalle de Producto de prueba"]',
          )!
          .click(),
      );
      expect(fallo.mock.calls.map(([e]) => e.message)).toEqual([]);
      expect(el.textContent).not.toContain("Vista interrumpida");
      expect(el.textContent).not.toContain("NaN");
      expect(
        [...el.querySelectorAll('[role="tab"]')].map((e) => e.textContent),
      ).not.toContain("Costos");
      expect(
        [...el.querySelectorAll('[role="tab"]')].map((e) => e.textContent),
      ).not.toContain("Pagos");
    } finally {
      await act(async () => root.unmount());
    }
  },
);
