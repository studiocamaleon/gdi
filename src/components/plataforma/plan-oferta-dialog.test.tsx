// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlanOfertaDialog } from "./plan-oferta-dialog";
import type { VersionPlan } from "@/lib/plataforma-planes-api";
import {
  PROPUESTA_PLANES,
  CATALOGO_PLANES,
  GRUPOS_PLANES,
} from "../../../apps/api/src/plataforma/planes/catalogo-planes";
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.request }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/components/design-system/form-dialog", () => ({
  FormDialog: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));
const version: VersionPlan = {
  id: "version-1",
  borradorId: "borrador-1",
  codigo: "esencial",
  numero: 2,
  revisionBorrador: 3,
  catalogoVersion: 1,
  publicadoEl: "2026-09-21T12:00:00Z",
  publicadoPorNombre: "Administrador",
  motivo: "Condiciones comerciales",
  contenido: {
    comercial: { acceso: "publico", trialDias: 14, implementacion: 199 },
    ...PROPUESTA_PLANES[0].contenido,
    precios: {
      moneda: "USD",
      mensual: 190,
      usuarioMensual: 15,
      anual: null,
      usuarioAnual: null,
    },
  },
  catalogoSnapshot: { capacidades: CATALOGO_PLANES, grupos: GRUPOS_PLANES },
};
const estado = {
  entorno: "sandbox",
  paddleHabilitado: true,
  revision: 0,
  actual: null,
};
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("PointerEvent", MouseEvent);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.request.mockResolvedValue(estado);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const button = (text: string) =>
  Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === text,
  )!;
const render = async (esAdmin = true, v = version) =>
  act(async () =>
    root.render(
      <PlanOfertaDialog version={v} esAdmin={esAdmin} cerrar={vi.fn()} />,
    ),
  );
async function escribir(id: string, value: string) {
  const input = document.getElementById(id)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("no permite ofrecer el anual pendiente ni activar sin precios válidos", async () => {
  await render();
  expect(container.textContent).toContain(
    "Implementación · una vez por empresa",
  );
  expect(container.querySelector('input[placeholder="pri_…"]')).toBeNull();
  expect(button("Revisar activación").disabled).toBe(true);
  expect(mocks.request).toHaveBeenCalledTimes(1);
});
it("presenta las condiciones antes de activar y envía los precios exactos con revisión", async () => {
  await render();
  await escribir("oferta-motivo", "Oferta mensual acordada");
  await act(async () => button("Revisar activación").click());
  expect(container.textContent).toContain("Confirmar la oferta comercial");
  expect(mocks.request).toHaveBeenCalledTimes(1);
  await act(async () => button("Sincronizar y activar oferta").click());
  expect(mocks.request).toHaveBeenLastCalledWith(
    "/plataforma/planes-ofertas/sincronizar",
    {
      method: "POST",
      body: JSON.stringify({
        versionId: "version-1",
        entorno: "sandbox",
        revision: 0,
        recomendado: false,
        motivo: "Oferta mensual acordada",
      }),
    },
  );
});
it("soporte puede consultar pero no activar ni retirar ofertas", async () => {
  await render(false);
  expect(button("Revisar activación")).toBeUndefined();
  expect(button("Revisar retiro")).toBeUndefined();
  expect(container.querySelectorAll("input").length).toBe(0);
});
it("una versión anterior sin precios exige publicar otra versión", async () => {
  await render(true, {
    ...version,
    contenido: { ...version.contenido, precios: undefined },
  });
  expect(container.textContent).toContain("Faltan condiciones en esta versión");
  expect(button("Revisar activación").disabled).toBe(true);
});
it("retira sólo tras revisar el motivo y recarga la oferta después del retiro", async () => {
  mocks.request.mockResolvedValue({
    ...estado,
    revision: 2,
    actual: {
      ofertaId: "oferta-1",
      versionId: version.id,
      numeroVersion: 2,
      nombre: "Grafo Esencial",
      precioMensual: 190,
      registroPublico: true,
      trialDias: 14,
    },
  });
  await render();
  await escribir("oferta-motivo", "Retirada de la oferta mensual");
  await act(async () => button("Revisar retiro").click());
  expect(mocks.request).toHaveBeenCalledTimes(1);
  mocks.request.mockImplementation(async (path) =>
    path.endsWith("retirar") ? { ok: true } : { ...estado, revision: 3 },
  );
  await act(async () => button("Retirar oferta").click());
  expect(mocks.request).toHaveBeenCalledWith(
    "/plataforma/planes-ofertas/retirar",
    expect.objectContaining({
      body: JSON.stringify({
        ofertaId: "oferta-1",
        revision: 2,
        motivo: "Retirada de la oferta mensual",
      }),
    }),
  );
  expect(container.textContent).toContain("Todavía no hay una oferta activa");
});
