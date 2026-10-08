// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CapacidadesProvider } from "@/components/navigation/capacidades-provider";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { CLIENTE_ESCANEADO_EVENT } from "@/lib/clientes-api";
import type { PropuestaItem } from "@/lib/propuestas";
import { productoDiseno } from "./__fixtures__/orden-diseno";
import type { CanalPresupuesto } from "./presupuesto-correo-dialog";
import { PropuestaFicha } from "./propuesta-ficha";

const mocks = vi.hoisted(() => ({
  guardar: vi.fn(),
  emitir: vi.fn(),
  replace: vi.fn(),
  confirmar: null as null | ((canal: CanalPresupuesto) => void),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  apiRequest: vi.fn(async () => {
    throw new Error("Sin conexiones externas en esta prueba");
  }),
}));
vi.mock("@/lib/presupuestos-api", async (original) => ({
  ...(await original<typeof import("@/lib/presupuestos-api")>()),
  emitirPresupuesto: mocks.emitir,
}));
vi.mock("@/components/notificaciones/notificaciones-provider", () => ({
  useCambiosSistema: vi.fn(),
}));
vi.mock("./tipo-cambio-documento", () => ({
  TipoCambioDocumentoProvider: ({ children }: { children: ReactNode }) =>
    children,
  useTipoCambioDocumento: () => null,
  useMotorConTipoCambio: () => ({ cotizarYGuardar: mocks.guardar }),
}));
vi.mock("./agregar-producto-sheet", () => ({
  AgregarProductoSheet: ({
    onAddItem,
  }: {
    onAddItem: (item: PropuestaItem) => void;
  }) => (
    <button
      onClick={() =>
        onAddItem({
          ...productoDiseno(
            crypto.randomUUID(),
            "Tarjetas ficticias",
            500,
            50000,
          ),
          motorCodigo: "producto-qa",
          jobContext: { cantidad: 500 },
          fechaEntrega: "2099-01-10",
        })
      }
    >
      Agregar producto ficticio
    </button>
  ),
}));
vi.mock("./canal-venta-selector", () => ({
  CanalVentaSelector: ({ onChange }: { onChange: (canal: string) => void }) => (
    <button onClick={() => onChange("mostrador")}>Canal de prueba</button>
  ),
}));
vi.mock("./presupuesto-correo-dialog", () => ({
  ElegirCanalPresupuesto: ({
    onEmitir,
  }: {
    onEmitir: (canal: CanalPresupuesto) => void;
  }) => {
    mocks.confirmar = onEmitir;
    return (
      <button onClick={() => onEmitir("whatsapp")}>
        Confirmar emisión de prueba
      </button>
    );
  },
}));

let container: HTMLDivElement, root: Root;
let avisoAlNavegar: boolean[];
function avisoDeSalida() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.confirmar = null;
  avisoAlNavegar = [];
  mocks.replace.mockImplementation(() => {
    avisoAlNavegar.push(avisoDeSalida());
  });
  mocks.guardar.mockResolvedValue({
    result: { exitoso: true },
    cotizacionId: "cotizacion-qa",
    cotizacionItemId: "snapshot-qa",
  });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function click(texto: string) {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.textContent?.trim() === texto);
  expect(button, texto).toBeDefined();
  await act(async () => button!.click());
}
async function preparar() {
  await act(async () =>
    root.render(
      <CapacidadesProvider
        capacidades={{
          funciones: { cotizacion: true, ordenes: true, presupuestos: true },
        }}
      >
        <PermisosProvider permisos={["comercial.gestionar"]}>
          <PropuestaFicha />
        </PermisosProvider>
      </CapacidadesProvider>,
    ),
  );
  await click("Presupuesto");
  await click("Canal de prueba");
  await act(async () =>
    window.dispatchEvent(
      new CustomEvent(CLIENTE_ESCANEADO_EVENT, {
        detail: {
          id: "cliente-qa",
          nombre: "Cliente ficticio",
          razonSocial: "",
          email: "",
          telefonoCodigo: "",
          telefonoNumero: "",
        },
      }),
    ),
  );
  await click("Agregar producto ficticio");
  expect(avisoDeSalida()).toBe(true);
  await click("Emitir presupuesto");
  expect(mocks.confirmar).not.toBeNull();
}

it.each(["whatsapp", "correo", "ambos"] as const)(
  "espera la persistencia y abre el detalle sin aviso nativo (%s)",
  async (canal) => {
    let resolver!: (value: unknown) => void;
    mocks.emitir.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    );
    await preparar();
    await act(async () => mocks.confirmar!(canal));
    expect(mocks.emitir).toHaveBeenCalledOnce();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(avisoDeSalida()).toBe(true);
    await act(async () =>
      resolver({ id: "pres-emitido", numero: "PRES-QA", estado: "enviado" }),
    );
    expect(mocks.replace).toHaveBeenCalledWith(
      `/comercial/presupuestos/pres-emitido${canal === "whatsapp" ? "" : `?correo=${canal}`}`,
    );
    expect(avisoAlNavegar).toEqual([false]);
    expect(avisoDeSalida()).toBe(false);
  },
);

it("si falla, conserva productos, protección y posibilidad de reintentar", async () => {
  mocks.emitir.mockRejectedValueOnce(new Error("Fallo simulado"));
  await preparar();
  await click("Confirmar emisión de prueba");
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(avisoDeSalida()).toBe(true);
  expect(container.textContent).toContain("50.000,00");
  mocks.emitir.mockResolvedValue({
    id: "pres-reintento",
    numero: "PRES-QA",
    estado: "enviado",
  });
  await click("Confirmar emisión de prueba");
  expect(mocks.replace).toHaveBeenCalledWith(
    "/comercial/presupuestos/pres-reintento",
  );
  expect(mocks.emitir.mock.calls[1][0].items).toEqual(
    mocks.emitir.mock.calls[0][0].items,
  );
  expect(avisoAlNavegar).toEqual([false]);
});

it.each([
  { estado: "borrador", advertenciaEnvio: "Canal no disponible" },
  { estado: "pendiente_aprobacion" },
])(
  "un presupuesto persistido $estado abre su detalle sin bloquear la salida",
  async (respuesta) => {
    mocks.emitir.mockResolvedValue({
      id: "pres-guardado",
      numero: "PRES-QA",
      ...respuesta,
    });
    await preparar();
    await click("Confirmar emisión de prueba");
    expect(mocks.replace).toHaveBeenCalledWith(
      "/comercial/presupuestos/pres-guardado",
    );
    expect(avisoAlNavegar).toEqual([false]);
  },
);

it("evita doble emisión y vuelve a proteger si se modifica el formulario tras guardar", async () => {
  let resolver!: (value: unknown) => void;
  mocks.emitir.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolver = resolve;
      }),
  );
  await preparar();
  const confirmar = mocks.confirmar!;
  await act(async () => {
    confirmar("whatsapp");
    confirmar("whatsapp");
  });
  expect(mocks.emitir).toHaveBeenCalledOnce();
  await act(async () =>
    resolver({ id: "pres-unico", numero: "PRES-QA", estado: "enviado" }),
  );
  await act(async () => confirmar("whatsapp"));
  expect(mocks.emitir).toHaveBeenCalledOnce();
  expect(avisoDeSalida()).toBe(false);
  // Cambiar cliente no cambia el contador de cambios sin guardar: sigue
  // habiendo un cliente y un producto, pero es otra revisión del formulario.
  await act(async () =>
    window.dispatchEvent(
      new CustomEvent(CLIENTE_ESCANEADO_EVENT, {
        detail: {
          id: "otro-cliente-qa",
          nombre: "Otro cliente ficticio",
          razonSocial: "",
          email: "",
          telefonoCodigo: "",
          telefonoNumero: "",
        },
      }),
    ),
  );
  expect(avisoDeSalida()).toBe(true);
});

it("no marca guardado si falla la cotización previa y mantiene el aviso de salida", async () => {
  mocks.guardar.mockRejectedValueOnce(
    new Error("No se pudo persistir el producto"),
  );
  await preparar();
  await click("Confirmar emisión de prueba");
  expect(mocks.emitir).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(avisoDeSalida()).toBe(true);
});
