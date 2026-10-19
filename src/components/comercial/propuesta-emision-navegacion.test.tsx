// @vitest-environment jsdom
import { act, type ReactNode, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CapacidadesProvider } from "@/components/navigation/capacidades-provider";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { CLIENTE_ESCANEADO_EVENT } from "@/lib/clientes-api";
import type { PropuestaItem } from "@/lib/propuestas";
import { productoDiseno } from "./__fixtures__/orden-diseno";
import type { CanalPresupuesto } from "./presupuesto-correo-dialog";
import { PropuestaFicha } from "./propuesta-ficha";
import { offsetDate } from "@/lib/propuestas";
import { getMockOrdenDetalle } from "@/lib/ordenes-trabajo";

const mocks = vi.hoisted(() => ({
  guardar: vi.fn(),
  cambiarTipo: vi.fn(),
  editarOrden: vi.fn(),
  revisarCopiado: vi.fn(),
  copiado: false,
  eta: false,
  cotizar: vi.fn(),
  recotizar: vi.fn(),
  finalizado: false,
  puedeEntregar: true,
  crearOrden: vi.fn(),
  cambiarEstado: vi.fn(),
  cobrar: vi.fn(),
  entregar: vi.fn(),
  error: vi.fn(),
  emitir: vi.fn(),
  replace: vi.fn(),
  confirmar: null as null | ((canal: CanalPresupuesto) => void),
}));
vi.mock("@/lib/centro-copiado-pedidos-api", async (original) => ({
  ...(await original<typeof import("@/lib/centro-copiado-pedidos-api")>()),
  revisarPedidoCopiado: mocks.revisarCopiado,
  estadoPedidoCopiado: vi.fn(async () => null),
}));
vi.mock("@/lib/ordenes-trabajo-api", async (original) => ({
  ...(await original<typeof import("@/lib/ordenes-trabajo-api")>()),
  editarOrdenTrabajoLote: mocks.editarOrden,
  crearOrdenTrabajo: mocks.crearOrden,
  cambiarEstadoOrdenTrabajo: mocks.cambiarEstado,
}));
vi.mock("@/lib/administracion-api", async (original) => ({
  ...(await original<typeof import("@/lib/administracion-api")>()),
  crearCobro: mocks.cobrar,
}));
vi.mock("@/lib/entrega-api", async (original) => ({
  ...(await original<typeof import("@/lib/entrega-api")>()),
  entregarItems: mocks.entregar,
}));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: mocks.error,
  },
}));
vi.mock("./pagos-staging-tab", () => ({
  PagosStagingTab: ({
    onAgregar,
    total,
  }: {
    onAgregar: (d: unknown) => void;
    total: number;
  }) => (
    <>
      <button
        onClick={() =>
          onAgregar({
            payload: { montoBruto: total, idempotencyKey: "pago-ficticio" },
            metodoNombre: "Efectivo",
          })
        }
      >
        Pago completo ficticio
      </button>
      <button
        onClick={() =>
          onAgregar({
            payload: {
              montoBruto: total - 0.01,
              idempotencyKey: "pago-parcial",
            },
            metodoNombre: "Efectivo",
          })
        }
      >
        Pago parcial ficticio
      </button>
    </>
  ),
}));
vi.mock("@/lib/productos-servicios-api", async (original) => ({
  ...(await original<typeof import("@/lib/productos-servicios-api")>()),
  recotizarCotizacionItem: mocks.recotizar,
}));
vi.mock("@/lib/eta-api", async (original) => ({
  ...(await original<typeof import("@/lib/eta-api")>()),
  getContextoPrevision: async () => ({
    enCola: [],
    estaciones: [],
    medianas: new Map(),
    noLaborables: new Set(),
    ahora: new Date("2026-10-14T15:00:00Z"),
    zona: "America/Argentina/Buenos_Aires",
    tiempoEntrePasosMin: 0,
    margenEtaDias: 0,
  }),
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
  apiRequest: vi.fn(async (path: string, opciones: unknown) => {
    if (path.startsWith("/borradores/")) return mocks.cambiarTipo(path, opciones);
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
  useMotorConTipoCambio: () => ({
    cotizarYGuardar: mocks.guardar,
    cotizar: mocks.cotizar,
    recotizarCotizacionItem: mocks.recotizar,
  }),
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
            listoEnMostrador: mocks.finalizado,
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
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.clearAllMocks();
  mocks.confirmar = null;
  mocks.cambiarTipo.mockReset();
  mocks.copiado = false;
  mocks.eta = false;
  mocks.finalizado = false;
  mocks.puedeEntregar = true;
  mocks.cobrar.mockResolvedValue({ id: "cobro-ficticio" });
  mocks.entregar.mockResolvedValue({ ordenCerrada: true, entregados: 1 });
  mocks.crearOrden.mockResolvedValue({
    ...getMockOrdenDetalle("mock-0184")!,
    id: "orden-emitida",
    numero: "OT-FICTICIA",
    estado: "finalizada",
    total: 121,
    productos: [{ id: "item-emitido" }],
  });
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
async function montar(orden?: ComponentProps<typeof PropuestaFicha>["orden"]) {
  await act(async () =>
    root.render(
      <CapacidadesProvider
        capacidades={{
          funciones: {
            cotizacion: true,
            ordenes: true,
            presupuestos: true,
            cobros: true,
            eta_capacidad: mocks.eta,
          },
        }}
      >
        <PermisosProvider
          permisos={[
            "comercial.gestionar",
            "finanzas.ver_margenes",
            "administracion.cobrar",
            ...(mocks.puedeEntregar ? ["produccion.tablero.gestionar"] : []),
          ]}
        >
          <PropuestaFicha orden={orden} />
        </PermisosProvider>
      </CapacidadesProvider>,
    ),
  );
}

it("al reabrir una tanda conserva materiales y producción en el detalle de costos", async () => {
  const base = getMockOrdenDetalle("mock-0184")!;
  await montar({
    ...base,
    cargos: [],
    cargosDirectos: 0,
    productos: [
      {
        ...base.productos[0],
        id: "item-ficticio",
        cantidad: 1,
        subtotal: 200,
        impuestos: 42,
        total: 242,
        snapshot: {
          productoId: "producto-ficticio",
          rutaAlternativaId: null,
          costoTotal: 120,
          costoUnitario: 120,
          precioTotal: 242,
          precioUnitario: 242,
          jobContext: {
            _centroCopiado: {
              paginas: 1,
              copias: 1,
              faz: 1,
              tandaImpresion: {
                version: 1,
                id: "tanda-ficticia",
                documentos: 1,
                paginas: 1,
                prepara: true,
              },
            },
          },
          resumen: {
            copiadoComercial: { calculoId: "calculo-ficticio" },
            ejecucion: {
              costos: {
                total: 120,
                unitario: 120,
                materialesTotal: 80,
                tiempoTotal: 40,
                cargosDirectosTotal: 0,
              },
            },
          },
          trazabilidad: { pasos: [] },
          precioSnapshots: {
            precioConfig: null,
            impuestos: [],
            comisiones: [],
            precioEspecialCliente: null,
          },
        },
      },
    ],
  });
  const tab = container.querySelector<HTMLElement>(
    '[role="tab"][aria-label="Costos"]',
  )!;
  await act(async () => tab.click());
  expect(
    container.querySelector('[title^="Materiales:"]')?.getAttribute("title"),
  ).toContain("80");
  expect(
    container
      .querySelector('[title^="Centro de costo:"]')
      ?.getAttribute("title"),
  ).toContain("40");
  expect(container.querySelector('[title^="Sin desglosar:"]')).toBeNull();
});
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

it("permite descargar el PDF sin salir ni perder la protección de cambios", async () => {
  await montar();
  await click("Agregar producto ficticio");
  expect(avisoDeSalida()).toBe(true);
  const enlace = document.createElement("a");
  enlace.href = "blob:http://localhost/tanda-ficticia";
  enlace.download = "Tanda.pdf";
  container.append(enlace);
  let descargaPermitida = false;
  enlace.addEventListener("click", (event) => {
    descargaPermitida = !event.defaultPrevented;
    // JSDOM no descarga: detener únicamente la acción nativa de la prueba.
    event.preventDefault();
  });
  await act(async () => enlace.click());
  expect(descargaPermitida).toBe(true);
  expect(document.body.textContent).not.toContain("Descartar y salir");
  expect(avisoDeSalida()).toBe(true);

  enlace.removeAttribute("download");
  enlace.href = "/produccion/ordenes";
  await act(async () => enlace.click());
  expect(document.body.textContent).toContain("Descartar y salir");
});

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
  expect(container.textContent).not.toContain("Actualizar precios");
  expect(mocks.revisarCopiado).toHaveBeenCalledOnce();
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
  expect(container.textContent).not.toContain("Actualizar precios");
  expect(container.textContent).not.toContain("Reintentar cálculo");
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
  expect(container.textContent).toContain(
    "Elegí un canal de venta para cotizar las impresiones.",
  );
  await verDatos();
  await click("Canal de prueba");
  expect(mocks.revisarCopiado).toHaveBeenCalledOnce();
  expect(container.textContent).not.toContain("Actualizar precios");
  expect(container.textContent).not.toContain("Reintentar cálculo");
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
  expect(container.textContent).toContain("Actualizando precios de copiado…");
  await verDatos();
  await click("Canal Web de prueba");
  expect(mocks.revisarCopiado).toHaveBeenCalledOnce();
  await act(async () => terminar(revisionTarifario()));
  expect(mocks.revisarCopiado).toHaveBeenCalledTimes(2);
  expect(mocks.revisarCopiado).toHaveBeenLastCalledWith(
    expect.objectContaining({ canalVenta: "web" }),
  );
  expect(container.textContent).not.toContain(
    "Actualizando precios de copiado…",
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
  expect(container.textContent).toContain("Falta un precio en el tarifario");
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
  await click("Reintentar cálculo");
  expect(mocks.revisarCopiado).toHaveBeenCalledTimes(2);
  expect(container.textContent).not.toContain("Falló la revisión ficticia");
  expect(container.textContent).not.toContain("Actualizar precios");
  expect(container.textContent).not.toContain("Reintentar cálculo");
});

it("guarda una fecha manual sin recalcular ni reemplazar el precio acordado", async () => {
  const base = getMockOrdenDetalle("mock-0184")!;
  const producto = {
    ...base.productos[0],
    id: "item-fecha-ficticio",
    cotizacionItemId: "precio-acordado-ficticio",
    fechaEntrega: null,
  };
  const orden = {
    ...base,
    estado: "borrador" as const,
    fechaEntrega: null,
    canalVenta: "mostrador",
    productos: [producto],
  };
  mocks.editarOrden.mockResolvedValue({
    ...orden,
    fechaEntrega: "2099-10-15",
    productos: [{ ...producto, fechaEntrega: "2099-10-15" }],
  });
  await montar(orden);
  await click("Editar orden");
  const expandir = container.querySelector<HTMLButtonElement>(
    `[aria-label="Ver detalle de ${producto.nombre}"]`,
  )!;
  await act(async () => expandir.click());
  const fecha = container.querySelector<HTMLInputElement>(
    `[aria-label="Entrega prevista de ${producto.nombre}"]`,
  )!;
  expect(fecha).not.toBeNull();
  // El evento nativo de date debe registrar también el valor al elegir día en Chrome.
  await act(async () => {
    fecha.value = "2099-10-15";
    fecha.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.textContent).toContain("15/10/2099");
  const guardar = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.textContent?.includes("Guardar cambios"))!;
  expect(guardar).toBeDefined();
  await act(async () => guardar.click());
  expect(mocks.guardar).not.toHaveBeenCalled();
  expect(mocks.editarOrden).toHaveBeenCalledWith(
    orden.id,
    expect.objectContaining({
      fechaEntrega: "2099-10-15",
      items: [
        expect.objectContaining({
          id: producto.id,
          cotizacionItemId: producto.cotizacionItemId,
          fechaEntrega: "2099-10-15",
        }),
      ],
    }),
  );
});

it("marca listo en el borrador conservando el snapshot y el precio", async () => {
  const base = getMockOrdenDetalle("mock-0184")!;
  const producto = {
    ...base.productos[0],
    id: "item-listo-ficticio",
    codigo: "SYS-IMPRESION-DOC",
    cotizacionItemId: "precio-acordado-ficticio",
  };
  const orden = {
    ...base,
    estado: "borrador" as const,
    canalVenta: "mostrador",
    productos: [producto],
  };
  mocks.editarOrden.mockResolvedValue({
    ...orden,
    productos: [{ ...producto, listoEnMostrador: true }],
  });
  await montar(orden);
  await click("Editar orden");
  const listo = container.querySelector<HTMLButtonElement>(
    `[aria-label="Marcar producción finalizada: ${producto.nombre}"]`,
  )!;
  expect(listo).not.toBeNull();
  await act(async () => listo.click());
  expect(listo.getAttribute("aria-checked")).toBe("true");
  const guardar = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.textContent?.includes("Guardar cambios"))!;
  expect(guardar).toBeDefined();
  await act(async () => guardar.click());
  expect(mocks.guardar).not.toHaveBeenCalled();
  expect(mocks.editarOrden).toHaveBeenCalledWith(
    orden.id,
    expect.objectContaining({
      items: [
        expect.objectContaining({
          id: producto.id,
          cotizacionItemId: producto.cotizacionItemId,
          listoEnMostrador: true,
          total: producto.total,
        }),
      ],
    }),
  );
});

async function seleccionarCliente(id: string) {
  await act(async () =>
    window.dispatchEvent(
      new CustomEvent(CLIENTE_ESCANEADO_EVENT, {
        detail: {
          id,
          nombre: "Cliente ficticio",
          razonSocial: "",
          email: "",
          telefonoCodigo: "",
          telefonoNumero: "",
        },
      }),
    ),
  );
}
it("al elegir cliente después de copiado vuelve al tarifario automáticamente, sin motor genérico", async () => {
  mocks.revisarCopiado.mockImplementation(async ({ items }) =>
    revisionTarifario(items),
  );
  await montar();
  await click("Canal de prueba");
  await click("Agregar carga de copiado ficticia");
  await seleccionarCliente("cliente-nuevo");
  expect(mocks.cotizar).not.toHaveBeenCalled();
  expect(mocks.recotizar).not.toHaveBeenCalled();
  expect(mocks.revisarCopiado).toHaveBeenCalledTimes(2);
  expect(mocks.revisarCopiado).toHaveBeenLastCalledWith(
    expect.objectContaining({ clienteId: "cliente-nuevo" }),
  );
  expect(container.textContent).toContain("121,00");
});
it("conserva la fecha elegida mientras llega la revisión de copiado", async () => {
  let resolver!: (v: unknown) => void;
  mocks.revisarCopiado.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolver = r;
      }),
  );
  await montar();
  await click("Canal de prueba");
  await click("Agregar carga de copiado ficticia");
  const expandir = container.querySelector<HTMLButtonElement>(
    '[aria-label="Ver detalle de Copias ficticias"]',
  )!;
  await act(async () => expandir.click());
  const fecha = container.querySelector<HTMLInputElement>(
    '[aria-label="Entrega prevista de Copias ficticias"]',
  )!;
  await act(async () => {
    fecha.value = "2099-12-20";
    fecha.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => resolver(revisionTarifario()));
  expect(fecha.value).toBe("2099-12-20");
});
it("si cambia el cliente durante la revisión descarta el cálculo anterior y aplica el último cliente", async () => {
  let resolver!: (v: unknown) => void;
  mocks.revisarCopiado.mockImplementation(async ({ items }) =>
    revisionTarifario(items),
  );
  mocks.revisarCopiado.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolver = r;
      }),
  );
  await montar();
  await click("Canal de prueba");
  await click("Agregar carga de copiado ficticia");
  await seleccionarCliente("cliente-nuevo");
  await seleccionarCliente("cliente-definitivo");
  await act(async () => resolver(revisionTarifario()));
  expect(mocks.revisarCopiado).toHaveBeenCalledTimes(2);
  expect(mocks.revisarCopiado).toHaveBeenLastCalledWith(
    expect.objectContaining({ clienteId: "cliente-definitivo" }),
  );
  expect(mocks.cotizar).not.toHaveBeenCalled();
  expect(mocks.recotizar).not.toHaveBeenCalled();
  expect(container.textContent).toContain("121,00");
});
it("no borra la fecha de copiado cuando ETA todavía no puede estimar el trabajo", async () => {
  mocks.eta = true;
  mocks.revisarCopiado.mockImplementation(async ({ items }) =>
    revisionTarifario(items),
  );
  await montar();
  await click("Canal de prueba");
  await click("Agregar carga de copiado ficticia");
  const expandir = container.querySelector<HTMLButtonElement>(
    '[aria-label="Ver detalle de Copias ficticias"]',
  )!;
  await act(async () => expandir.click());
  const fecha = container.querySelector<HTMLInputElement>(
    '[aria-label="Entrega prevista de Copias ficticias"]',
  )!;
  expect(fecha.value).toBe("2099-01-10");
});

async function verPagos() {
  const tab = [...container.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (t) => t.getAttribute("aria-label")?.startsWith("Pagos"),
  )!;
  expect(tab).toBeDefined();
  await act(async () => tab.click());
}
async function prepararCopiadoFinalizado() {
  mocks.finalizado = true;
  mocks.revisarCopiado.mockImplementation(async ({ items }) =>
    revisionTarifario(items),
  );
  await montar();
  await click("Canal de prueba");
  await seleccionarCliente("cliente-ficticio");
  await click("Agregar carga de copiado ficticia");
}
it("exige el 100% antes de emitir y entregar; un centavo pendiente también bloquea", async () => {
  await prepararCopiadoFinalizado();
  const boton = () =>
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent === "Emitir y entregar",
    )!;
  expect(boton()).toBeDefined();
  expect(boton().disabled).toBe(true);
  await verPagos();
  await click("Pago parcial ficticio");
  expect(boton().disabled).toBe(true);
  expect(mocks.crearOrden).not.toHaveBeenCalled();
});
it("emite, registra pago y entrega en ese orden; evita doble clic", async () => {
  await prepararCopiadoFinalizado();
  await verPagos();
  await click("Pago completo ficticio");
  const boton = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.textContent === "Emitir y entregar")!;
  expect(boton.disabled).toBe(false);
  await act(async () => {
    boton.click();
    boton.click();
  });
  expect(mocks.crearOrden).toHaveBeenCalledOnce();
  expect(mocks.crearOrden).toHaveBeenCalledWith(
    expect.objectContaining({
      items: [
        expect.objectContaining({
          listoEnMostrador: true,
          total: 121,
          fechaEntrega: offsetDate(0),
        }),
      ],
    }),
  );
  expect(mocks.cobrar).toHaveBeenCalledOnce();
  expect(mocks.cobrar).toHaveBeenCalledWith(
    expect.objectContaining({
      ordenId: "orden-emitida",
      montoBruto: 121,
      idempotencyKey: "pago-ficticio",
    }),
  );
  expect(mocks.entregar).toHaveBeenCalledWith("orden-emitida", {
    itemIds: ["item-emitido"],
    exigirPagoCompleto: true,
  });
  expect(mocks.crearOrden.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.cobrar.mock.invocationCallOrder[0],
  );
  expect(mocks.cobrar.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.entregar.mock.invocationCallOrder[0],
  );
});
it("si falla un pago deja la OT emitida pendiente de entrega, sin reemitir ni entregar", async () => {
  mocks.cobrar.mockRejectedValueOnce(new Error("Cobro rechazado ficticio"));
  await prepararCopiadoFinalizado();
  await verPagos();
  await click("Pago completo ficticio");
  await click("Emitir y entregar");
  expect(mocks.crearOrden).toHaveBeenCalledOnce();
  expect(mocks.entregar).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith(
    expect.stringContaining("No se registró la entrega"),
    expect.anything(),
  );
});
it("conserva Emitir OT en una orden mixta aunque copiado esté terminado", async () => {
  await prepararCopiadoFinalizado();
  mocks.finalizado = false;
  await click("Agregar producto ficticio");
  expect(container.textContent).toContain("Emitir OT");
  expect(container.textContent).not.toContain("Emitir y entregar");
});
it("Emitir y entregar muestra hoy sin pedir fecha y reemplaza una fecha anterior o futura", async () => {
  await prepararCopiadoFinalizado();
  const expandir = container.querySelector<HTMLButtonElement>(
    '[aria-label="Ver detalle de Copias ficticias"]',
  )!;
  await act(async () => expandir.click());
  expect(
    container.querySelector(
      '[aria-label="Entrega prevista de Copias ficticias"]',
    ),
  ).toBeNull();
  expect(container.textContent).toContain("Hoy");
  await verDatos();
  expect(
    container.querySelector('input[aria-label="Entrega prevista"]'),
  ).toBeNull();
  await verPagos();
  await click("Pago completo ficticio");
  await click("Emitir y entregar");
  expect(mocks.crearOrden).toHaveBeenCalledWith(
    expect.objectContaining({
      fechaEntrega: offsetDate(0),
      items: [expect.objectContaining({ fechaEntrega: offsetDate(0) })],
    }),
  );
});
it("emite y entrega un borrador de copiado finalizado sin exigir su fecha vieja", async () => {
  const base = getMockOrdenDetalle("mock-0184")!;
  const producto = {
    ...base.productos[0],
    id: "item-borrador",
    codigo: "SYS-IMPRESION-DOC",
    cotizacionItemId: "snapshot-ficticio",
    listoEnMostrador: true,
    fechaEntrega: "2000-01-01",
  };
  const orden = {
    ...base,
    clienteId: "cliente-ficticio",
    estado: "borrador" as const,
    canalVenta: "mostrador",
    fechaEntrega: "2000-01-01",
    productos: [producto],
  };
  mocks.editarOrden.mockResolvedValue(orden);
  mocks.cambiarEstado.mockResolvedValue({ ...orden, estado: "finalizada" });
  await montar(orden);
  await click("Editar orden");
  await verPagos();
  await click("Pago completo ficticio");
  const emitir = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.textContent?.trim() === "Emitir y entregar")!;
  expect(emitir.disabled, `${emitir.title} ${container.textContent}`).toBe(
    false,
  );
  await click("Emitir y entregar");
  expect(mocks.editarOrden).toHaveBeenCalledWith(
    orden.id,
    expect.objectContaining({
      expectedVersion: orden.version,
      fechaEntrega: offsetDate(0),
      items: [
        expect.objectContaining({
          id: "item-borrador",
          fechaEntrega: offsetDate(0),
        }),
      ],
    }),
  );
  expect(mocks.cambiarEstado).toHaveBeenCalledOnce();
  expect(mocks.entregar).toHaveBeenCalledWith(orden.id, {
    itemIds: ["item-borrador"],
    exigirPagoCompleto: true,
  });
});
it("con todo pagado, gestionar la OT permite emitir y entregar sin gestionar Producción", async () => {
  mocks.puedeEntregar = false;
  await prepararCopiadoFinalizado();
  await verPagos();
  await click("Pago completo ficticio");
  const boton = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.textContent === "Emitir y entregar")!;
  expect(boton.disabled).toBe(false);
  expect(container.textContent).not.toContain(
    "Tu rol no permite registrar la entrega",
  );
  expect(mocks.crearOrden).not.toHaveBeenCalled();
});


function borradorParaCambiarTipo() {
  const base = getMockOrdenDetalle("mock-0184")!;
  return {
    ...base,
    id: "borrador-ficticio",
    estado: "borrador" as const,
    canalVenta: "mostrador",
    fechaEntrega: "2099-01-10",
    version: "2030-01-01T00:00:00.000Z",
    productos: base.productos.map((producto, indice) => ({ ...producto, id: `item-ficticio-${indice}`, cotizacionItemId: `cotizacion-ficticia-${indice}`, fechaEntrega: "2099-01-10" })),
  };
}
function botonCambiarTipo() {
  return [...container.querySelectorAll<HTMLButtonElement>("button")]
    .find((boton) => boton.textContent?.trim() === "Cambiar a presupuesto")!;
}
it("un borrador guardado permite cambiar de tipo al entrar a editar sin modificar datos", async () => {
  mocks.cambiarTipo.mockResolvedValue({ id: "presupuesto-ficticio", tipo: "presupuesto" });
  const orden = borradorParaCambiarTipo();
  await montar(orden);
  await click("Editar orden");
  expect(container.textContent).toContain("Finalizar edición");
  expect(botonCambiarTipo().disabled).toBe(false);
  await click("Cambiar a presupuesto");
  expect(mocks.cambiarTipo).toHaveBeenCalledExactlyOnceWith(`/borradores/orden/${orden.id}/a-presupuesto`, {
    method: "POST", body: JSON.stringify({ version: orden.version }),
  });
  expect(mocks.replace).toHaveBeenCalledWith("/comercial/presupuestos/presupuesto-ficticio");
  expect(mocks.editarOrden).not.toHaveBeenCalled();
  expect(mocks.recotizar).not.toHaveBeenCalled();
  expect(avisoAlNavegar).toEqual([false]);
});
it("el cambio de tipo sigue bloqueado si el borrador tiene datos comerciales sin guardar", async () => {
  await montar(borradorParaCambiarTipo());
  await click("Editar orden");
  await verDatos();
  await click("Canal Web de prueba");
  expect(container.textContent).toContain("Guardar cambios");
  expect(botonCambiarTipo().disabled).toBe(true);
  await click("Cambiar a presupuesto");
  expect(mocks.cambiarTipo).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
});
it("no permite convertir un borrador con un pago pendiente de registrar", async () => {
  await montar(borradorParaCambiarTipo());
  await verPagos();
  await click("Pago completo ficticio");
  expect(botonCambiarTipo().disabled).toBe(true);
  await click("Cambiar a presupuesto");
  expect(mocks.cambiarTipo).not.toHaveBeenCalled();
});
it("bloquea edición y pagos durante la conversión y los recupera si falla", async () => {
  let rechazar!: (error: Error) => void;
  mocks.cambiarTipo.mockImplementation(() => new Promise((_resolve, reject) => { rechazar = reject; }));
  await montar(borradorParaCambiarTipo());
  await click("Editar orden");
  await verPagos();
  await click("Cambiar a presupuesto");
  expect(container.textContent).toContain("Cambiando tipo de borrador…");
  expect(container.textContent).not.toContain("Pago completo ficticio");
  const botonFinalizar = [...container.querySelectorAll<HTMLButtonElement>("button")]
    .find((boton) => boton.textContent?.trim() === "Finalizar edición")!;
  expect(botonFinalizar.disabled).toBe(true);
  await act(async () => rechazar(new Error("No se pudo guardar el cambio.")));
  expect(container.textContent).toContain("Pago completo ficticio");
  expect(botonFinalizar.disabled).toBe(false);
  expect(botonCambiarTipo().disabled).toBe(false);
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(mocks.editarOrden).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalledWith("No se pudo guardar el cambio.");
});
