// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { PlanAsignacionDialog } from "./plan-asignacion-dialog";
import type { VistaAsignacionPlan } from "@/lib/plataforma-planes-api";

const mock = vi.hoisted(() => ({
  api: vi.fn(),
  cerrar: vi.fn(),
  completada: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiRequest: mock.api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({ children, title }: { children: ReactNode; title: string }) => (
    <section role="dialog" aria-label={title}>
      {children}
    </section>
  ),
}));
let root: Root, container: HTMLDivElement, informe: VistaAsignacionPlan;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  informe = {
    empresa: { id: "empresa", nombre: "Imprenta de prueba" },
    actual: { nombre: "Anterior", versionId: null, numero: null, revision: 0 },
    destino: { nombre: "Esencial", versionId: "version", numero: 1 },
    uso: {
      usuarios: {
        activos: 2,
        invitacionesPendientes: 0,
        adicionalesVigentes: 0,
      },
      archivos: {
        guardadosBytes: "0",
        reservadosBytes: "0",
        cargasPendientes: 0,
      },
    },
    diferencias: [],
    bloqueos: [],
    revisiones: ["almacenamiento_ajustado"],
    huella: "a".repeat(64),
    diagnostico: {
      estado: "revisar",
      usuariosCupoResultante: 3,
      usuariosExcedidos: 0,
      almacenamientoCupoBytes: "1000",
      almacenamientoExcedidoBytes: "0",
      funcionesAgregadas: 0,
      funcionesRetiradas: 0,
      hallazgos: [
        {
          codigo: "almacenamiento_ajustado",
          nivel: "revisar",
          titulo: "Cuota personalizada",
          detalle: "Confirmá su continuidad.",
        },
      ],
    },
  };
  mock.api.mockResolvedValue(informe);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const boton = (name: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === name,
  )!;
async function click(el: HTMLElement) {
  expect(el).toBeTruthy();
  await act(async () => el.click());
}
async function render(admin = true, restaurar = false) {
  await act(async () =>
    root.render(
      <PlanAsignacionDialog
        version={
          restaurar ? null : { id: "version", nombre: "Esencial", numero: 1 }
        }
        empresaInicial={{ id: "empresa", nombre: "Imprenta de prueba" }}
        esAdmin={admin}
        cerrar={mock.cerrar}
        completada={mock.completada}
      />,
    ),
  );
}
async function motivo(value = "Contrato acordado para pruebas") {
  await act(async () => {
    const el = container.querySelector<HTMLInputElement>("#motivo-asignacion")!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function preparar() {
  await click(boton("Evaluar cambio"));
  await motivo();
  await click(container.querySelector<HTMLElement>('[role="checkbox"]')!);
}

it("consulta sólo a pedido y exige motivo y revisiones antes de asignar", async () => {
  await render();
  expect(mock.api).not.toHaveBeenCalled();
  await click(boton("Evaluar cambio"));
  expect(boton("Asignar versión").disabled).toBe(true);
  await motivo();
  expect(boton("Asignar versión").disabled).toBe(true);
  await click(container.querySelector<HTMLElement>('[role="checkbox"]')!);
  expect(boton("Asignar versión").disabled).toBe(false);
});
it("confirma exactamente la versión y la huella revisadas; doble clic no duplica", async () => {
  await render();
  await preparar();
  mock.api.mockResolvedValue({ revision: 1 });
  const btn = boton("Asignar versión");
  await act(async () => {
    btn.click();
    btn.click();
  });
  const envios = mock.api.mock.calls.filter(
    ([path]) => path === "/plataforma/planes-asignacion",
  );
  expect(envios).toHaveLength(1);
  expect(JSON.parse(envios[0][1].body)).toMatchObject({
    tenantId: "empresa",
    versionId: "version",
    revision: 0,
    huella: informe.huella,
    revisionesAceptadas: ["almacenamiento_ajustado"],
  });
  expect(mock.completada).toHaveBeenCalledOnce();
  expect(mock.cerrar).toHaveBeenCalledOnce();
});
it("los bloqueos impiden asignar aunque se complete la revisión", async () => {
  informe.bloqueos = ["Hay compras abiertas."];
  await render();
  await preparar();
  expect(container.textContent).toContain("Hay compras abiertas");
  expect(boton("Asignar versión").disabled).toBe(true);
});
it("muestra los dos pendientes de impresión y exige aceptar cada continuidad", async () => {
  informe.revisiones = ["impresion_sin_envio", "impresion_sin_verificar"];
  informe.diagnostico.hallazgos = [
    {
      codigo: "impresion_sin_envio",
      nivel: "revisar",
      cantidad: 2,
      titulo: "Trabajos sin enviar",
      detalle: "Continuarán por la vía manual.",
    },
    {
      codigo: "impresion_sin_verificar",
      nivel: "revisar",
      cantidad: 1,
      titulo: "Salidas sin verificar",
      detalle: "Conservan la verificación desde la OT.",
    },
  ];
  await render();
  await click(boton("Evaluar cambio"));
  await motivo();
  expect(container.textContent).toContain("Trabajos sin enviar · 2");
  expect(container.textContent).toContain("Salidas sin verificar · 1");
  const revisiones =
    container.querySelectorAll<HTMLElement>('[role="checkbox"]');
  expect(revisiones).toHaveLength(2);
  await click(revisiones[0]);
  expect(boton("Asignar versión").disabled).toBe(true);
  await click(revisiones[1]);
  expect(boton("Asignar versión").disabled).toBe(false);
  mock.api.mockResolvedValue({ revision: 1 });
  await click(boton("Asignar versión"));
  expect(
    JSON.parse(mock.api.mock.calls.at(-1)![1].body).revisionesAceptadas,
  ).toEqual(informe.revisiones);
});
it("un reintento conserva el identificador; actualizar diagnóstico invalida aceptaciones", async () => {
  await render();
  await preparar();
  mock.api.mockRejectedValue(new Error("No se pudo confirmar la respuesta"));
  await click(boton("Asignar versión"));
  await click(boton("Asignar versión"));
  const envios = mock.api.mock.calls.filter(
    ([path]) => path === "/plataforma/planes-asignacion",
  );
  expect(JSON.parse(envios[0][1].body).operacionId).toBe(
    JSON.parse(envios[1][1].body).operacionId,
  );
  expect(mock.cerrar).not.toHaveBeenCalled();
  mock.api.mockResolvedValue({ ...informe, huella: "b".repeat(64) });
  await click(boton("Actualizar diagnóstico"));
  expect(boton("Asignar versión").disabled).toBe(true);
});
it("soporte ve el diagnóstico sin acciones de escritura", async () => {
  await render(false);
  await click(boton("Evaluar cambio"));
  expect(container.textContent).toContain("Cuota personalizada");
  expect(boton("Asignar versión")).toBeUndefined();
});
it("restaurar usa un destino explícitamente nulo y también exige diagnóstico", async () => {
  informe.destino = { versionId: null, numero: null, nombre: "Anterior" };
  await render(true, true);
  await preparar();
  mock.api.mockResolvedValue({ revision: 2 });
  await click(boton("Restaurar contrato"));
  expect(JSON.parse(mock.api.mock.calls.at(-1)![1].body).versionId).toBeNull();
});
