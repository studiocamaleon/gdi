// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ContratacionesPanel,
  RecuperarContratacionDialog,
} from "./contrataciones-panel";
import type { ContratacionPlataforma } from "@/lib/plataforma-suscripciones-api";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  recuperar: vi.fn(),
  cerrar: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.api }));
vi.mock("@/lib/plataforma-suscripciones-api", () => ({
  recuperarContratacionPlataforma: mocks.recuperar,
}));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({ children }: { children: ReactNode }) => (
    <section role="dialog">{children}</section>
  ),
}));
const op: ContratacionPlataforma = {
  id: "op-1",
  tipo: "checkout",
  estado: "verificar",
  entorno: "sandbox",
  plan: "Grafo Pro",
  ciclo: "mensual",
  adicionales: 2,
  creadaEl: "2026-09-22T00:00:00Z",
  enviadaEl: "2026-09-22T00:01:00Z",
  finalizadaEl: null,
  transaccionId: null,
  referencia: null,
  detalle: null,
};
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("PointerEvent", MouseEvent);
  mocks.api.mockResolvedValue({ eventos: [], total: 0, pagina: 1, limite: 10 });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const boton = (texto: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === texto,
  )!;
const escribir = async (id: string, value: string) =>
  act(async () => {
    const el = container.querySelector<HTMLInputElement>(`#${id}`)!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
const render = async (admin = true, fila = op) =>
  act(async () =>
    root.render(
      <RecuperarContratacionDialog
        id="sub-1"
        op={fila}
        esAdmin={admin}
        cerrar={mocks.cerrar}
      />,
    ),
  );
const enviar = async () =>
  act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );

it("abrir el historial no consulta Paddle; soporte no recibe controles para recuperar", async () => {
  await render(false);
  expect(mocks.api).toHaveBeenCalledWith(
    "/plataforma/suscripciones/sub-1/contrataciones/op-1/historial?pagina=1&limite=10",
    { cache: "no-store" },
  );
  expect(mocks.recuperar).not.toHaveBeenCalled();
  expect(container.querySelector("input")).toBeNull();
  expect(boton("Consultar y recuperar")).toBeUndefined();
  expect(boton("Cerrar")).toBeDefined();
});

it("exige motivo y una referencia válida antes de consultar", async () => {
  await render();
  expect(boton("Consultar y recuperar").disabled).toBe(true);
  await escribir("motivo-recuperacion", "El cliente informó el pago");
  await escribir("transaccion-recuperacion", "sub_incorrecta");
  expect(boton("Consultar y recuperar").disabled).toBe(true);
  await enviar();
  expect(mocks.recuperar).not.toHaveBeenCalled();
  const transaccionId = `txn_${"a".repeat(26)}`;
  await escribir("transaccion-recuperacion", transaccionId);
  mocks.recuperar.mockResolvedValue({
    resultado: "aplicada",
    estado: "aplicada",
    detalle: "Contrato recuperado",
    transaccionId,
  });
  await enviar();
  expect(mocks.recuperar).toHaveBeenCalledWith(
    "sub-1",
    "op-1",
    expect.objectContaining({
      motivo: "El cliente informó el pago",
      transaccionId,
    }),
  );
  expect(container.textContent).toContain("Contrato recuperado");
  expect(boton("Nueva consulta")).toBeUndefined();
});

it("una respuesta perdida conserva la solicitud y no permite cambiar los datos del reintento", async () => {
  await render();
  await escribir("motivo-recuperacion", "Verificación del checkout");
  mocks.recuperar.mockRejectedValue(new Error("Respuesta perdida"));
  await enviar();
  await enviar();
  expect(mocks.recuperar.mock.calls[0]).toEqual(mocks.recuperar.mock.calls[1]);
  expect(
    container.querySelector<HTMLInputElement>("#motivo-recuperacion")!.disabled,
  ).toBe(true);
  expect(mocks.cerrar).not.toHaveBeenCalled();
});

it("un resultado incierto ofrece otra lectura con nueva solicitud, nunca un botón de cobro", async () => {
  await render();
  await escribir("motivo-recuperacion", "Verificación del checkout");
  mocks.recuperar.mockResolvedValue({
    resultado: "sin_resultado",
    estado: "verificar",
    detalle: "Falta evidencia",
    transaccionId: null,
  });
  await enviar();
  expect(container.textContent).toContain("Falta evidencia");
  await act(async () => boton("Nueva consulta").click());
  await enviar();
  expect(mocks.recuperar.mock.calls[1][2].solicitudId).not.toBe(
    mocks.recuperar.mock.calls[0][2].solicitudId,
  );
  expect(container.textContent).not.toContain("Cobrar nuevamente");
});

it("una contratación aplicada sólo ofrece historial", async () => {
  await render(true, { ...op, estado: "aplicada" });
  expect(container.querySelector("input")).toBeNull();
  expect(boton("Consultar y recuperar")).toBeUndefined();
  await enviar();
  expect(mocks.recuperar).not.toHaveBeenCalled();
});

it("pagina las contrataciones y descarta resultados anteriores cuando falla otra página", async () => {
  mocks.api.mockResolvedValue({
    total: 16,
    pagina: 1,
    limite: 15,
    contrataciones: [op],
  });
  await act(async () =>
    root.render(
      <ContratacionesPanel
        id="sub-1"
        esAdmin
        version={0}
        actualizado={vi.fn()}
      />,
    ),
  );
  expect(container.textContent).toContain("Grafo Pro");
  expect(mocks.recuperar).not.toHaveBeenCalled();
  mocks.api.mockRejectedValue(new Error("Sin conexión"));
  await act(async () => boton("Siguiente").click());
  expect(mocks.api.mock.calls.at(-1)![0]).toContain("pagina=2");
  expect(container.textContent).toContain("Sin conexión");
  expect(container.textContent).not.toContain("Grafo Pro");
});
