// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConsultarPaddleDialog, SuscripcionesView } from "./suscripciones-view";
import type {
  DetalleSuscripcion,
  OperacionPaddle,
} from "@/lib/plataforma-suscripciones-api";

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  push: vi.fn(),
  api: vi.fn(),
  consultar: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.params,
}));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.api }));
vi.mock("@/lib/plataforma-suscripciones-api", () => ({
  consultarPaddlePlataforma: mocks.consultar,
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({
    title,
    description,
    children,
  }: {
    title: ReactNode;
    description: ReactNode;
    children: ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  ),
}));
const suscripcion: DetalleSuscripcion = {
  id: "subs-1",
  empresa: { id: "empresa-1", nombre: "Gráfica prueba", slug: "prueba" },
  plan: { id: "plan-1", nombre: "Producción", codigo: "produccion" },
  proveedor: "paddle",
  referencia: "sub_prueba",
  estado: "activa",
  estadoProveedor: "active",
  acceso: {
    modo: "bloqueado",
    codigo: "bloqueo_administrativo",
    descripcion: "Revisión administrativa",
  },
  senales: [
    {
      codigo: "bloqueo",
      titulo: "Bloqueo administrativo",
      detalle: "Revisión administrativa",
    },
  ],
  trialHasta: null,
  graciaHasta: null,
  moraDesde: null,
  proximoCobro: null,
  periodoDesde: null,
  cambioProgramado: null,
  cambioProgramadoEl: null,
  ultimaConsulta: null,
  ultimoEvento: null,
  actualizadoProveedorEl: null,
  puedeConsultar: true,
  integracion: {
    apiConfigurada: true,
    firmaConfigurada: true,
    entorno: "sandbox",
    consultaAntiguaMinutos: 30,
  },
};
const operacion: OperacionPaddle = {
  id: "op-1",
  motivo: "Revisión del pago",
  estado: "completada",
  detalle: "Estado actualizado en Grafo",
  creadaEl: "2026-09-20T12:00:00Z",
  finalizadaEl: "2026-09-20T12:01:00Z",
  antesJson: null,
  despuesJson: null,
};
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.params = new URLSearchParams("vista=suscripciones");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const button = (name: string) =>
  Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === name,
  )!;
const submit = async () =>
  act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
const escribirMotivo = async () =>
  act(async () => {
    const input = container.querySelector<HTMLInputElement>(
      "#motivo-consulta-paddle",
    )!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "Revisión del pago");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

it("pagina en servidor conservando filtros y distingue pago activo de bloqueo", async () => {
  mocks.params = new URLSearchParams(
    "vista=suscripciones&pagina=2&q=prueba&caso=bloqueada&proveedor=paddle",
  );
  mocks.api.mockResolvedValue({
    total: 60,
    pagina: 2,
    limite: 25,
    suscripciones: [suscripcion],
    integracion: suscripcion.integracion,
    consultadoEl: "2026-09-20T12:00:00Z",
  });
  await act(async () => root.render(<SuscripcionesView esAdmin={false} />));
  expect(mocks.api).toHaveBeenCalledWith(
    "/plataforma/suscripciones?pagina=2&limite=25&q=prueba&caso=bloqueada&proveedor=paddle",
    { cache: "no-store" },
  );
  expect(container.textContent).toContain("Activa");
  expect(container.textContent).toContain("Bloqueada");
  await act(async () => button("Siguiente").click());
  const url = new URL(mocks.push.mock.calls[0][0], "http://localhost");
  expect(url.searchParams.get("pagina")).toBe("3");
  expect(url.searchParams.get("caso")).toBe("bloqueada");
  expect(url.searchParams.get("q")).toBe("prueba");
  expect(mocks.consultar).not.toHaveBeenCalled();
});

it("descarta respuestas demoradas de otra ficha y soporte sólo tiene lectura", async () => {
  let resolver!: (value: DetalleSuscripcion) => void;
  mocks.params = new URLSearchParams(
    "vista=suscripciones&suscripcion=anterior",
  );
  mocks.api.mockImplementation((url: string) => {
    if (url.endsWith("/anterior"))
      return new Promise((r) => {
        resolver = r;
      });
    if (url.includes("/eventos"))
      return Promise.resolve({ total: 0, pagina: 1, limite: 15, eventos: [] });
    if (url.includes("/historial"))
      return Promise.resolve({
        total: 0,
        pagina: 1,
        limite: 10,
        operaciones: [],
      });
    return Promise.resolve(suscripcion);
  });
  await act(async () => root.render(<SuscripcionesView esAdmin={false} />));
  mocks.params = new URLSearchParams("vista=suscripciones&suscripcion=subs-1");
  await act(async () => root.render(<SuscripcionesView esAdmin={false} />));
  await act(async () =>
    resolver({
      ...suscripcion,
      empresa: { ...suscripcion.empresa, nombre: "Empresa anterior" },
    }),
  );
  expect(container.textContent).toContain("Gráfica prueba");
  expect(container.textContent).not.toContain("Empresa anterior");
  expect(button("Consultar Paddle")).toBeUndefined();
  expect(container.textContent).toContain("conserva este bloqueo");
});

it("consulta los historiales al abrir su pestaña sin iniciar una sincronización", async () => {
  mocks.params = new URLSearchParams("vista=suscripciones&suscripcion=subs-1");
  mocks.api.mockImplementation((url: string) => {
    if (url.includes("/eventos"))
      return Promise.resolve({ total: 0, pagina: 1, limite: 15, eventos: [] });
    if (url.includes("/historial"))
      return Promise.resolve({
        total: 0,
        pagina: 1,
        limite: 10,
        operaciones: [],
      });
    return Promise.resolve(suscripcion);
  });
  await act(async () => root.render(<SuscripcionesView esAdmin />));
  const consulto = (ruta: string) =>
    mocks.api.mock.calls.some(([url]) => String(url).includes(ruta));
  expect(consulto("/eventos")).toBe(false);
  expect(consulto("/historial")).toBe(false);
  const abrir = async (nombre: string) => {
    const tab = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).find((el) => el.textContent === nombre)!;
    await act(async () => tab.click());
    expect(tab.getAttribute("aria-selected")).toBe("true");
  };
  await abrir("Eventos de Paddle");
  expect(consulto("/eventos")).toBe(true);
  expect(consulto("/historial")).toBe(false);
  await abrir("Historial de consultas");
  expect(consulto("/historial")).toBe(true);
  expect(mocks.consultar).not.toHaveBeenCalled();
});

it("exige motivo, evita duplicados y conserva el resultado hasta que el operador lo cierre", async () => {
  let resolver!: (value: OperacionPaddle) => void;
  mocks.consultar.mockReturnValue(
    new Promise((r) => {
      resolver = r;
    }),
  );
  const cerrar = vi.fn(),
    actualizar = vi.fn();
  await act(async () =>
    root.render(
      <ConsultarPaddleDialog
        suscripcion={suscripcion}
        onClose={cerrar}
        onActualizado={actualizar}
      />,
    ),
  );
  await submit();
  expect(mocks.consultar).not.toHaveBeenCalled();
  await escribirMotivo();
  await submit();
  await submit();
  expect(mocks.consultar).toHaveBeenCalledOnce();
  expect(button("Volver").disabled).toBe(true);
  await act(async () => resolver(operacion));
  expect(container.textContent).toContain("Estado actualizado en Grafo");
  expect(actualizar).not.toHaveBeenCalled();
  expect(cerrar).not.toHaveBeenCalled();
  await act(async () => button("Cerrar").click());
  expect(actualizar).toHaveBeenCalledOnce();
  expect(cerrar).toHaveBeenCalledOnce();
});

it("reintenta con la misma solicitud tras una respuesta de red incierta", async () => {
  mocks.consultar
    .mockRejectedValueOnce(new Error("No se recibió la respuesta"))
    .mockResolvedValueOnce(operacion);
  await act(async () =>
    root.render(
      <ConsultarPaddleDialog
        suscripcion={suscripcion}
        onClose={vi.fn()}
        onActualizado={vi.fn()}
      />,
    ),
  );
  await escribirMotivo();
  await submit();
  expect(container.textContent).toContain("No se confirmó el resultado");
  expect(
    container.querySelector<HTMLInputElement>("#motivo-consulta-paddle")!
      .disabled,
  ).toBe(true);
  await submit();
  expect(mocks.consultar).toHaveBeenCalledTimes(2);
  expect(mocks.consultar.mock.calls[1]).toEqual(mocks.consultar.mock.calls[0]);
  expect(container.textContent).toContain("Estado actualizado en Grafo");
});

it("muestra una consulta fallida sin presentarla como actualización exitosa", async () => {
  mocks.consultar.mockResolvedValue({
    ...operacion,
    estado: "fallida",
    detalle: "No se aplicó la respuesta",
  });
  await act(async () =>
    root.render(
      <ConsultarPaddleDialog
        suscripcion={suscripcion}
        onClose={vi.fn()}
        onActualizado={vi.fn()}
      />,
    ),
  );
  await escribirMotivo();
  await submit();
  expect(container.textContent).toContain("Consulta fallida");
  expect(container.textContent).not.toContain("Actualizada");
  expect(button("Consultar y actualizar")).toBeUndefined();
  expect(button("Cerrar")).toBeDefined();
});
