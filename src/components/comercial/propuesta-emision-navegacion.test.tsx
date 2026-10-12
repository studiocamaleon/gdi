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
  revisarCopiado: vi.fn(),
  copiado: false,
  emitir: vi.fn(),
  replace: vi.fn(),
  confirmar: null as null | ((canal: CanalPresupuesto) => void),
}));
vi.mock("@/lib/centro-copiado-pedidos-api", async (original) => ({
  ...(await original<typeof import("@/lib/centro-copiado-pedidos-api")>()),
  revisarPedidoCopiado: mocks.revisarCopiado,
  estadoPedidoCopiado: vi.fn(async () => null),
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
          jobContext: {
            cantidad: 500,
            ...(mocks.copiado
              ? { _centroCopiado: { paginas: 500, copias: 1, faz: 1 } }
              : {}),
          },
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
    <>
      <button onClick={() => onChange("mostrador")}>Canal de prueba</button>
      <button onClick={() => onChange("web")}>Canal Web de prueba</button>
    </>
  ),
}));
vi.mock("./centro-copiado-sheet", () => ({
  default: ({ onAgregar }: { onAgregar: (items: PropuestaItem[]) => void }) => (
    <button
      onClick={() =>
        onAgregar([
          {
            ...productoDiseno(
              crypto.randomUUID(),
              "Copias ficticias",
              100,
              15000,
            ),
            motorCodigo: "producto-qa",
            jobContext: {
              cantidad: 100,
              _centroCopiado: {
                paginas: 100,
                copias: 1,
                faz: 1,
                grupoCargaId: crypto.randomUUID(),
              },
            },
            fechaEntrega: "2099-01-10",
          },
        ])
      }
    >
      Agregar carga de copiado ficticia
    </button>
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
  mocks.copiado = false;
  mocks.revisarCopiado.mockResolvedValue({ modalidad: "MOTOR" });
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
async function verDatos() {
  const tab = [...container.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (t) => t.getAttribute("aria-label")?.startsWith("Datos"),
  )!;
  expect(tab).toBeDefined();
  await act(async () => tab.click());
}
async function montar() {
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
}
async function preparar() {
  await montar();
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

it("revisa copiado completo y emite con los mismos precios y snapshots revisados", async () => {
  mocks.copiado = true;
  mocks.revisarCopiado.mockResolvedValue({
    modalidad: "TARIFARIO",
    id: "calculo-qa",
    huella: "a".repeat(64),
    cotizacionId: "cotizacion-revisada",
    nombre: "Mostrador ficticio",
    numero: 1,
    calculado: {
      estado: "CALCULADO",
      grupos: [],
      control: { estado: "CUMPLE" },
      terminaciones: [],
    },
    items: [
      {
        anteriorId: "snapshot-qa",
        id: "snapshot-revisado",
        subtotal: 100,
        iva: 21,
        total: 121,
        descuentoMonto: 0,
      },
    ],
  });
  mocks.emitir.mockResolvedValue({
    id: "presupuesto-qa",
    numero: "PRES-QA",
    estado: "enviado",
  });
  await preparar();
  await click("Actualizar precios de copiado");
  expect(mocks.revisarCopiado).toHaveBeenCalledWith(
    expect.objectContaining({
      items: ["snapshot-qa"],
      canalVenta: "mostrador",
    }),
  );
  await click("Confirmar emisión de prueba");
  expect(mocks.guardar).toHaveBeenCalledOnce();
  expect(mocks.emitir).toHaveBeenCalledWith(
    expect.objectContaining({
      cotizacionId: "cotizacion-revisada",
      items: [
        expect.objectContaining({
          cotizacionItemId: "snapshot-revisado",
          subtotal: 100,
          total: 121,
        }),
      ],
    }),
  );
});

function revisionTarifario(items = ["snapshot-qa"]) {
  return {
    modalidad: "TARIFARIO",
    id: "calculo-qa",
    huella: "a".repeat(64),
    cotizacionId: "cotizacion-revisada",
    nombre: "Mostrador ficticio",
    numero: 1,
    calculado: {
      estado: "CALCULADO",
      grupos: [],
      control: { estado: "CUMPLE" },
      terminaciones: [],
    },
    items: items.map((id) => ({
      anteriorId: id,
      id: `${id}-revisado`,
      subtotal: 100,
      iva: 21,
      total: 121,
      descuentoMonto: 0,
    })),
  };
}
it("espera la revisión automática antes de emitir y conserva los precios revisados", async () => {
  let terminar!: (r: unknown) => void;
  let n = 0;
  mocks.guardar.mockImplementation(async () => ({
    result: { exitoso: true },
    cotizacionId: "cotizacion-qa",
    cotizacionItemId: `snapshot-${++n}`,
  }));
  mocks.revisarCopiado.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        terminar = resolve;
      }),
  );
  mocks.emitir.mockResolvedValue({
    id: "presupuesto-qa",
    numero: "PRES-QA",
    estado: "enviado",
  });
  await preparar();
  await click("Agregar carga de copiado ficticia");
  await click("Confirmar emisión de prueba");
  expect(mocks.emitir).not.toHaveBeenCalled();
  await act(async () =>
    terminar(revisionTarifario(["snapshot-1", "snapshot-2"])),
  );
  await click("Confirmar emisión de prueba");
  expect(mocks.guardar).toHaveBeenCalledTimes(2);
  expect(mocks.emitir).toHaveBeenCalledWith(
    expect.objectContaining({
      cotizacionId: "cotizacion-revisada",
      items: expect.arrayContaining([
        expect.objectContaining({
          cotizacionItemId: "snapshot-2-revisado",
          subtotal: 100,
          total: 121,
        }),
      ]),
    }),
  );
});
it("al agregar una carga aplica automáticamente el tarifario y al agregar otra revisa el pedido completo", async () => {
  let n = 0;
  mocks.guardar.mockImplementation(async () => ({
    result: { exitoso: true },
    cotizacionId: "cotizacion-qa",
    cotizacionItemId: `snapshot-${++n}`,
  }));
  mocks.revisarCopiado.mockImplementation(async ({ items }) =>
    revisionTarifario(items),
  );
  await montar();
  await click("Canal de prueba");
  await click("Agregar carga de copiado ficticia");
  expect(mocks.revisarCopiado).toHaveBeenCalledOnce();
  expect(container.textContent).toContain("Mostrador ficticio · v1");
  expect(container.textContent).toContain("121,00");
  await click("Agregar carga de copiado ficticia");
  expect(mocks.revisarCopiado).toHaveBeenCalledTimes(2);
  expect(mocks.revisarCopiado).toHaveBeenLastCalledWith(
    expect.objectContaining({
      items: ["snapshot-2", "snapshot-3"],
      canalVenta: "mostrador",
    }),
  );
  expect(container.textContent).toContain("242,00");
  const quitar = container.querySelector<HTMLButtonElement>(
    '[aria-label="Quitar Copias ficticias"]',
  )!;
  expect(quitar).not.toBeNull();
  await act(async () => quitar.click());
  expect(mocks.revisarCopiado).toHaveBeenCalledTimes(3);
  expect(mocks.revisarCopiado).toHaveBeenLastCalledWith(
    expect.objectContaining({ items: ["snapshot-4"] }),
  );
  expect(container.textContent).toContain("121,00");
});
it("espera el canal y recalcula cuando se elige, sin dar por revisado el precio del motor", async () => {
  mocks.revisarCopiado.mockResolvedValue(revisionTarifario());
  await montar();
  await click("Agregar carga de copiado ficticia");
  expect(mocks.guardar).not.toHaveBeenCalled();
  expect(mocks.revisarCopiado).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Elegí el canal de venta de la OT");
  await verDatos();
  await click("Canal de prueba");
  expect(mocks.revisarCopiado).toHaveBeenCalledOnce();
  expect(container.textContent).toContain("Mostrador ficticio · v1");
});
it("si cambia el canal durante la revisión descarta la respuesta vieja y procesa el canal nuevo", async () => {
  let terminar!: (r: unknown) => void;
  mocks.revisarCopiado
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          terminar = resolve;
        }),
    )
    .mockResolvedValue({ modalidad: "MOTOR" });
  await montar();
  await click("Canal de prueba");
  await click("Agregar carga de copiado ficticia");
  expect(container.textContent).toContain("Calculando precios del pedido");
  await verDatos();
  await click("Canal Web de prueba");
  expect(mocks.revisarCopiado).toHaveBeenCalledOnce();
  await act(async () => terminar(revisionTarifario()));
  expect(mocks.revisarCopiado).toHaveBeenCalledTimes(2);
  expect(mocks.revisarCopiado).toHaveBeenLastCalledWith(
    expect.objectContaining({ canalVenta: "web" }),
  );
  expect(container.textContent).toContain(
    "Este canal utiliza los precios del motor",
  );
  expect(container.textContent).not.toContain("Mostrador ficticio · v1");
});
it("un precio faltante se muestra bloqueado sin reintentar automáticamente ni inventar un precio", async () => {
  mocks.revisarCopiado.mockResolvedValue({
    ...revisionTarifario(),
    id: null,
    items: [],
    calculado: {
      estado: "PRECIO_PENDIENTE",
      grupos: [],
      control: { estado: "NO_VERIFICABLE" },
      terminaciones: [],
    },
  });
  await montar();
  await click("Canal de prueba");
  await click("Agregar carga de copiado ficticia");
  expect(mocks.revisarCopiado).toHaveBeenCalledOnce();
  expect(container.textContent).toContain("Emisión bloqueada");
  expect(container.textContent).toContain("Falta un precio en la matriz");
});
it("un fallo mantiene un aviso visible y permite reintentar explícitamente", async () => {
  mocks.revisarCopiado.mockRejectedValueOnce(
    new Error("Falló la revisión ficticia"),
  );
  await montar();
  await click("Canal de prueba");
  await click("Agregar carga de copiado ficticia");
  expect(mocks.revisarCopiado).toHaveBeenCalledOnce();
  expect(container.textContent).toContain("Falló la revisión ficticia");
  mocks.revisarCopiado.mockResolvedValue(revisionTarifario());
  await click("Actualizar precios de copiado");
  expect(mocks.revisarCopiado).toHaveBeenCalledTimes(2);
  expect(container.textContent).not.toContain("Falló la revisión ficticia");
  expect(container.textContent).toContain("Mostrador ficticio · v1");
});
