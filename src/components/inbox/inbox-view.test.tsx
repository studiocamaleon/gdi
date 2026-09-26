// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InboxView } from "./inbox-view";
import type { CargarInbox, MetaInbox } from "@/lib/meta-inbox-api";

const identidad = {
  empresaId: "empresa-1",
  usuarioId: "user-1",
  empresa: "Gráfica de prueba",
  operador: "Operadora de prueba",
};
const cliente = {
  id: "cliente-1",
  nombre: "Estudio Oliva",
  razonSocial: null,
  activo: true,
  contactos: [],
};
const mensaje = {
  id: "m2",
  nombreContacto: "Alma",
  tipo: "text",
  texto: "<img src=x onerror=alert(1)>\nHola 👋",
  enviadoEl: "2026-09-25T12:00:00.000Z",
};
const base: MetaInbox = {
  empresaId: identidad.empresaId,
  usuarioId: identidad.usuarioId,
  contacto: { telefono: "+16505550123" },
  mensajes: [mensaje],
  anterior: null,
  contexto: {
    estado: "encontrado",
    telefono: "+16505550123",
    cliente,
    coincidencias: [cliente],
    permisos: { clientes: true, ordenes: true },
    ordenes: [],
  },
};
let container: HTMLDivElement, root: Root;
let cargar: ReturnType<typeof vi.fn<CargarInbox>>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  cargar = vi.fn<CargarInbox>().mockResolvedValue(structuredClone(base));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const render = () =>
  act(async () =>
    root.render(<InboxView identidad={identidad} cargar={cargar} />),
  );
async function click(label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  )!;
  expect(button).toBeTruthy();
  await act(async () => button.click());
}
it("lee datos del API, reconoce el cliente, escapa texto y no ofrece acciones simuladas", async () => {
  await render();
  expect(container.textContent).toContain("Estudio Oliva");
  expect(container.querySelector("[role=log]")?.textContent).toContain(
    mensaje.texto,
  );
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("textarea")).toBeNull();
  expect(
    [...container.querySelectorAll("button")].map((b) => b.textContent),
  ).not.toContain("Resolver");
  const ficha = container.querySelector<HTMLAnchorElement>(
    'a[href="/clientes/cliente-1"]',
  );
  expect(ficha?.target).toBe("_blank");
  expect(ficha?.rel).toContain("noopener");
});
it("no inventa saldos ni órdenes y distingue falta de permiso de ausencia de cliente", async () => {
  cargar.mockResolvedValue({ ...base, contexto: null });
  await render();
  expect(container.textContent).toContain("Contexto restringido");
  expect(container.textContent).not.toContain("Saldo");
  expect(container.querySelector('a[href^="/clientes/"]')).toBeNull();
});
it("presenta adjuntos por su tipo sin descargar ni renderizar URLs", async () => {
  cargar.mockResolvedValue({
    ...base,
    mensajes: [{ ...mensaje, tipo: "image", texto: null }],
  });
  await render();
  expect(container.querySelector("[role=log]")?.textContent).toContain(
    "Imagen",
  );
  expect(container.querySelector("img, video, audio")).toBeNull();
});
it("muestra la bienvenida sin conexión y no confunde un piloto vacío con uno desconectado", async () => {
  cargar.mockResolvedValueOnce(null);
  await render();
  expect(container.textContent).toContain("Tu WhatsApp, dentro de Grafo");
  const conectar = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Conectar WhatsApp"),
  );
  expect(conectar?.disabled).toBe(true);
  expect(container.textContent).toContain("disponible próximamente");
  expect(container.querySelector("[role=log]")).toBeNull();
  cargar.mockResolvedValue({ ...base, mensajes: [] });
  await click("Actualizar");
  expect(container.textContent).toContain("Todavía no hay mensajes");
  expect(container.textContent).not.toContain("Conectar WhatsApp");
});
it("el error de actualización retira mensajes y contexto, luego permite recuperarlos", async () => {
  await render();
  cargar.mockRejectedValueOnce(new Error("403"));
  await click("Actualizar");
  expect(container.textContent).toContain("No pudimos cargar");
  expect(container.textContent).not.toContain("Conectar WhatsApp");
  expect(container.textContent).not.toContain("Estudio Oliva");
  expect(container.querySelector("[role=log]")).toBeNull();
  await click("Actualizar");
  expect(container.textContent).toContain("Estudio Oliva");
});
it.each(["empresaId", "usuarioId"] as const)(
  "retira toda la vista si cambia %s en otra pestaña",
  async (field) => {
    await render();
    cargar.mockResolvedValue({ ...base, [field]: "otra-identidad" });
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(container.textContent).toContain("Cambió tu sesión");
    expect(container.querySelector("[role=log]")).toBeNull();
    expect(container.textContent).not.toContain("Estudio Oliva");
  },
);
it("al paginar agrega anteriores, deduplica y conserva orden cronológico", async () => {
  cargar.mockResolvedValueOnce({ ...base, anterior: "m2" });
  await render();
  cargar.mockResolvedValueOnce({
    ...base,
    mensajes: [
      {
        ...mensaje,
        id: "m1",
        texto: "Mensaje anterior",
        enviadoEl: "2026-09-24T12:00:00.000Z",
      },
      mensaje,
    ],
  });
  await click("Cargar mensajes anteriores");
  expect(cargar.mock.calls[1][0]).toEqual({
    antesDe: "m2",
    clienteId: undefined,
  });
  const textos = [...container.querySelectorAll("[role=log] p")].map(
    (p) => p.textContent,
  );
  expect(textos).toEqual(["Mensaje anterior", mensaje.texto]);
});
it("retira también datos anteriores cuando falla la paginación", async () => {
  cargar.mockResolvedValueOnce({ ...base, anterior: "m2" });
  await render();
  cargar.mockRejectedValueOnce(new Error("403"));
  await click("Cargar mensajes anteriores");
  expect(container.querySelector("[role=log]")).toBeNull();
  expect(container.textContent).not.toContain("Estudio Oliva");
});
it("no muestra órdenes ambiguas y consulta la ficha elegida en el servidor", async () => {
  cargar.mockResolvedValueOnce({
    ...base,
    contexto: {
      ...base.contexto!,
      estado: "seleccionar_cliente",
      cliente: null,
      coincidencias: [
        cliente,
        { ...cliente, id: "cliente-2", nombre: "Otra ficha" },
      ],
    },
  });
  await render();
  expect(container.querySelector('a[href^="/clientes/"]')).toBeNull();
  await click("Estudio Oliva");
  expect(cargar.mock.calls[1][0]).toEqual({ clienteId: "cliente-1" });
  expect(
    container.querySelector('a[href="/clientes/cliente-1"]'),
  ).not.toBeNull();
});
it("ignora una respuesta tardía después de un refresco que denegó el acceso", async () => {
  let resolver!: (value: MetaInbox | null) => void;
  cargar.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolver = resolve;
      }),
  );
  await render();
  cargar.mockResolvedValueOnce(null);
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.textContent).toContain("Tu WhatsApp, dentro de Grafo");
  await act(async () => resolver(base));
  expect(container.textContent).not.toContain("Estudio Oliva");
  expect(cargar.mock.calls[0][1]?.aborted).toBe(true);
});
