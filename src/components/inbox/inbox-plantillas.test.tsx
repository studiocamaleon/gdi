// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InboxPlantillas, type BorradoresPlantilla } from "./inbox-plantillas";
import type { PlantillaInbox, PlantillasInboxApi } from "@/lib/meta-inbox-api";
import { ApiError } from "@/lib/api";
const plantilla: PlantillaInbox = {
  id: "123",
  nombre: "pedido_listo",
  idioma: "es_AR",
  categoria: "UTILITY",
  estado: "APPROVED",
  formato: "NAMED",
  encabezado: "Trabajo listo",
  cuerpo: "Hola {{nombre}}.",
  pie: "Equipo ficticio",
  botones: [],
  variables: [{ componente: "body", nombre: "nombre" }],
  motivo: null,
  version: "a".repeat(64),
  pagina: null,
};
const aceptado = {
  id: "envio",
  clave: "clave",
  estado: "ACEPTADO",
  texto: null,
  codigo: null,
  creadoEl: new Date().toISOString(),
  mensajeId: "mensaje",
};
let root: Root,
  container: HTMLDivElement,
  api: PlantillasInboxApi,
  borradores: BorradoresPlantilla,
  actualizar: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("PointerEvent", MouseEvent);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  borradores = new Map();
  actualizar = vi.fn().mockResolvedValue(true);
  api = {
    listar: vi
      .fn()
      .mockResolvedValue({
        canalId: "canal",
        plantillas: [plantilla],
        siguiente: null,
      }),
    enviar: vi.fn().mockResolvedValue(aceptado),
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const render = (scope = "uno") =>
  act(async () =>
    root.render(
      <InboxPlantillas
        key={scope}
        canalId="canal"
        conversacionId={scope}
        destino={scope}
        api={api}
        borradores={borradores}
        scope={scope}
        actualizar={actualizar}
      />,
    ),
  );
const btn = (texto: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
    b.textContent?.includes(texto),
  )!;
const click = (texto: string) => act(async () => btn(texto).click());
async function escribir(valor: string) {
  const input = [...document.querySelectorAll<HTMLInputElement>("input")].find(
    (i) => !i.placeholder,
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function preparar() {
  await click("Usar plantilla");
  await click("pedido listo");
  await escribir("Alma");
  await act(async () =>
    document.querySelector<HTMLElement>('[role="checkbox"]')!.click(),
  );
}
it("no consulta ni envía hasta abrir; valida datos y consentimiento y muestra vista previa", async () => {
  await render();
  expect(api.listar).not.toHaveBeenCalled();
  await click("Usar plantilla");
  expect(api.listar).toHaveBeenCalledOnce();
  expect(api.enviar).not.toHaveBeenCalled();
  await click("pedido listo");
  expect(btn("Enviar plantilla").disabled).toBe(true);
  await escribir("Alma");
  expect(document.body.textContent).toContain("Hola Alma.");
  expect(btn("Enviar plantilla").disabled).toBe(true);
  await act(async () =>
    document.querySelector<HTMLElement>('[role="checkbox"]')!.click(),
  );
  await click("Enviar plantilla");
  expect(api.enviar).toHaveBeenCalledOnce();
  expect(api.enviar).toHaveBeenCalledWith(
    "uno",
    expect.objectContaining({
      plantillaId: "123",
      valores: ["Alma"],
      consentimientoConfirmado: true,
    }),
    expect.any(AbortSignal),
  );
  expect(actualizar).toHaveBeenCalledOnce();
  expect(borradores.size).toBe(0);
});
it("error de red conserva la clave incluso al cerrar y volver a abrir", async () => {
  vi.mocked(api.enviar).mockRejectedValueOnce(new Error("corte"));
  await render();
  await preparar();
  await click("Enviar plantilla");
  const clave = vi.mocked(api.enviar).mock.calls[0][1].clave;
  expect(btn("Comprobar envío")).toBeTruthy();
  await click("Cerrar");
  await click("Comprobar plantilla");
  await click("Comprobar envío");
  expect(vi.mocked(api.enviar).mock.calls[1][1].clave).toBe(clave);
  expect(api.enviar).toHaveBeenCalledTimes(2);
});
it("no duplica el envío si se pulsa dos veces mientras espera", async () => {
  let resolver!: (v: typeof aceptado) => void;
  vi.mocked(api.enviar).mockImplementation(
    () =>
      new Promise((r) => {
        resolver = r;
      }),
  );
  await render();
  await preparar();
  await act(async () => {
    btn("Enviar plantilla").click();
    btn("Enviar plantilla").click();
  });
  expect(api.enviar).toHaveBeenCalledOnce();
  await act(async () => resolver(aceptado));
});
it("un cambio de conversación oculta el borrador anterior y no mezcla el destinatario", async () => {
  await render();
  await preparar();
  await render("dos");
  await click("Usar plantilla");
  expect(document.body.textContent).not.toContain("Hola Alma.");
  expect(api.enviar).not.toHaveBeenCalled();
  await render("uno");
  await click("Usar plantilla");
  expect(document.body.textContent).toContain("Hola Alma.");
});
it("rechazo previo 409 permite revisar sin bloquear los datos; un 403 conserva la clave", async () => {
  vi.mocked(api.enviar).mockRejectedValueOnce(new ApiError("cambió", 409));
  await render();
  await preparar();
  await click("Enviar plantilla");
  expect(borradores.get("uno")?.clave).toBeUndefined();
  vi.mocked(api.enviar).mockRejectedValueOnce(new ApiError("acceso", 403));
  await click("Enviar plantilla");
  expect(borradores.get("uno")?.clave).toBeTruthy();
  expect(btn("Comprobar envío")).toBeTruthy();
});
it("descarta catálogo de otro canal y no habilita plantillas incompatibles", async () => {
  vi.mocked(api.listar).mockResolvedValueOnce({
    canalId: "ajeno",
    plantillas: [plantilla],
    siguiente: null,
  });
  await render();
  await click("Usar plantilla");
  expect(document.body.textContent).toContain("No pudimos cargar");
  expect(btn("pedido listo")).toBeUndefined();
  vi.mocked(api.listar).mockResolvedValue({
    canalId: "canal",
    plantillas: [{ ...plantilla, motivo: "Necesita archivo" }],
    siguiente: null,
  });
  await click("Actualizar catálogo");
  expect(btn("pedido listo").disabled).toBe(true);
});
