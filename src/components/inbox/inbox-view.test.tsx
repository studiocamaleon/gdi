// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InboxView } from "./inbox-view";
import type { CargarInbox, MetaInbox } from "@/lib/meta-inbox-api";
import type { EscucharInbox } from "@/lib/inbox-tiempo-real";

vi.mock("@/lib/meta-conexion-api", () => ({
  metaConexionApi: {
    estado: vi.fn().mockResolvedValue({
      empresaId: "empresa-1",
      usuarioId: "user-1",
      modo: null,
      disponible: false,
      sandboxVerificadoEl: null,
      canal: null,
    }),
  },
}));
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
  vi.useRealTimers();
});
it("una consulta sin respuesta vence y se recupera automáticamente", async () => {
  vi.useFakeTimers();
  cargar.mockImplementationOnce(
    (_query, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => reject(new Error("cancelada")),
          { once: true },
        );
      }),
  );
  await render();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15000);
  });
  expect(container.textContent).toContain("No pudimos cargar");
  expect(container.querySelector("[role=log]")).toBeNull();
  expect(container.textContent).not.toContain("Actualizar");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(container.textContent).toContain("Estudio Oliva");
});
const render = () =>
  act(async () =>
    root.render(
      <InboxView identidad={identidad} cargar={cargar} tiempoReal={null} />,
    ),
  );
it("un aviso actualiza sin desmontar el chat, conserva la lectura y elimina datos al revocar", async () => {
  let eventos!: Parameters<EscucharInbox>[0];
  const dejar = vi.fn();
  const tiempoReal: EscucharInbox = (opciones) => {
    eventos = opciones;
    return dejar;
  };
  await act(async () =>
    root.render(
      <InboxView
        identidad={identidad}
        cargar={cargar}
        tiempoReal={tiempoReal}
      />,
    ),
  );
  const log = container.querySelector<HTMLElement>("[role=log]")!;
  Object.defineProperties(log, {
    scrollHeight: { value: 1200, configurable: true },
    clientHeight: { value: 200, configurable: true },
  });
  log.scrollTop = 100;
  cargar.mockResolvedValue({
    ...base,
    mensajes: [
      ...base.mensajes,
      {
        ...mensaje,
        id: "m3",
        texto: "Llega sin recargar",
        enviadoEl: "2026-09-25T12:01:00.000Z",
      },
    ],
  });
  await act(async () => {
    await eventos.actualizar(new AbortController().signal);
  });
  expect(container.querySelector("[role=log]")).toBe(log);
  expect(log.textContent).toContain("Llega sin recargar");
  expect(log.scrollTop).toBe(100);
  await act(async () => eventos.accesoCerrado());
  expect(container.textContent).not.toContain("Estudio Oliva");
  expect(container.querySelector("[role=log]")).toBeNull();
  expect(dejar).toHaveBeenCalledOnce();
});
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
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.textContent).toContain("Todavía no hay mensajes");
  expect(container.textContent).not.toContain("Conectar WhatsApp");
});
it("el error de actualización retira mensajes y contexto, luego permite recuperarlos", async () => {
  await render();
  cargar.mockRejectedValueOnce(new Error("403"));
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(container.textContent).toContain("No pudimos cargar");
  expect(container.textContent).not.toContain("Conectar WhatsApp");
  expect(container.textContent).not.toContain("Estudio Oliva");
  expect(container.querySelector("[role=log]")).toBeNull();
  await act(async () => window.dispatchEvent(new Event("focus")));
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

const general = (conversacionId = "chat-1"): MetaInbox => ({
  ...structuredClone(base),
  origen: "GENERAL",
  canalId: "alta-1",
  conversacionId,
  contacto: {
    telefono: conversacionId === "chat-1" ? "+16505550123" : "+16505550124",
    nombre: conversacionId === "chat-1" ? "Alma" : "Bruno",
  },
  contexto: conversacionId === "chat-1" ? structuredClone(base.contexto) : null,
  mensajes: [
    {
      ...mensaje,
      id: `${conversacionId}-m1`,
      texto:
        conversacionId === "chat-1" ? "Consulta de Alma" : "Consulta de Bruno",
      direccion: "ENTRANTE",
    },
  ],
  conversaciones: [
    {
      id: "chat-1",
      nombre: "Alma",
      telefono: "+16505550123",
      ultimoMensaje: null,
    },
    {
      id: "chat-2",
      nombre: "Bruno",
      telefono: "+16505550124",
      ultimoMensaje: null,
    },
  ],
  listaAnterior: null,
});
async function abrir(nombre: string) {
  const boton = container.querySelector<HTMLButtonElement>(
    `button[aria-label="Abrir conversación con ${nombre}"]`,
  )!;
  expect(boton).toBeTruthy();
  await act(async () => boton.click());
}
it("cambia entre chats sin mezclar contexto y descarta la respuesta de una selección anterior", async () => {
  cargar.mockResolvedValue(general());
  await render();
  let resolver!: (value: MetaInbox) => void;
  cargar.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolver = resolve;
      }),
  );
  await abrir("Bruno");
  expect(container.querySelector("[role=log]")?.textContent).not.toContain(
    "Consulta de Alma",
  );
  expect(container.textContent).not.toContain("Estudio Oliva");
  expect(cargar.mock.calls[1][0]).toMatchObject({ conversacionId: "chat-2" });
  await abrir("Alma");
  await act(async () => resolver(general("chat-2")));
  expect(container.querySelector("[role=log]")?.textContent).toContain(
    "Consulta de Alma",
  );
  expect(container.querySelector("[role=log]")?.textContent).not.toContain(
    "Consulta de Bruno",
  );
  expect(container.textContent).toContain("Estudio Oliva");
});
it("la actualización viva pide toda la ventana visible y reemplaza ediciones y eliminaciones", async () => {
  cargar.mockResolvedValue({ ...general(), anterior: "chat-1-m1" });
  let eventos!: Parameters<EscucharInbox>[0];
  const tiempoReal: EscucharInbox = (o) => {
    eventos = o;
    return () => {};
  };
  await act(async () =>
    root.render(
      <InboxView
        identidad={identidad}
        cargar={cargar}
        tiempoReal={tiempoReal}
      />,
    ),
  );
  const viejo = {
    ...mensaje,
    id: "anterior",
    texto: "Texto antiguo visible",
    enviadoEl: "2026-09-24T10:00:00Z",
  };
  cargar.mockResolvedValueOnce({
    ...general(),
    mensajes: [viejo],
    anterior: null,
  });
  await click("Cargar mensajes anteriores");
  expect(cargar.mock.calls[1][0]).toMatchObject({
    conversacionId: "chat-1",
    antesDe: "chat-1-m1",
  });
  expect(container.querySelector("[role=log]")?.textContent).toContain(
    "Texto antiguo visible",
  );
  cargar.mockResolvedValueOnce({
    ...general(),
    mensajes: [
      { ...viejo, texto: null, eliminado: true },
      {
        ...general().mensajes[0],
        texto: "Texto corregido",
        direccion: "SALIENTE",
        editado: true,
        estadoEntrega: "READ",
        delCelular: true,
        delHistorial: true,
      },
    ],
  });
  await act(async () => {
    await eventos.actualizar(new AbortController().signal);
  });
  expect(cargar.mock.calls[2][0]).toMatchObject({
    conversacionId: "chat-1",
    desdeId: "anterior",
  });
  const log = container.querySelector("[role=log]")!;
  for (const texto of [
    "Mensaje eliminado",
    "Texto corregido",
    "Editado",
    "Historial",
    "Desde WhatsApp Business",
  ])
    expect(log.textContent).toContain(texto);
  expect(log.querySelector('[role="img"][aria-label="Leído"]')).not.toBeNull();
  expect(log.textContent).not.toContain("Texto antiguo visible");
  expect(log.querySelector("[data-kind=salida]")).not.toBeNull();
});
it("agrega páginas de conversaciones sin cambiar el chat y permite buscar en el servidor", async () => {
  vi.useFakeTimers();
  cargar.mockResolvedValue({ ...general(), listaAnterior: "cursor-pagina" });
  await render();
  cargar.mockResolvedValueOnce({
    ...general(),
    conversaciones: [
      {
        id: "chat-3",
        nombre: "Clara",
        telefono: "+16505550125",
        ultimoMensaje: null,
      },
    ],
  });
  await click("Más conversaciones");
  expect(cargar.mock.calls[1][0]).toMatchObject({
    conversacionId: "chat-1",
    listaAntesDe: "cursor-pagina",
  });
  expect(
    container.querySelectorAll('button[aria-label^="Abrir conversación"]'),
  ).toHaveLength(3);
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="Buscar contacto"]',
  )!;
  cargar.mockResolvedValueOnce({ ...general(), conversaciones: [] });
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "desconocido");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(cargar.mock.calls.at(-1)?.[0]).toMatchObject({
    busqueda: "desconocido",
    conversacionId: "chat-1",
  });
  expect(container.textContent).toContain("Sin coincidencias");
  expect(container.querySelector("[role=log]")?.textContent).toContain(
    "Consulta de Alma",
  );
});
it("una bandeja conectada sin mensajes no inventa un contacto ni vuelve a solicitar conexión", async () => {
  cargar.mockResolvedValue({
    ...general(),
    contacto: { telefono: "" },
    conversacionId: null,
    mensajes: [],
    conversaciones: [],
    contexto: null,
  });
  await render();
  expect(container.textContent).toContain("Tu bandeja está preparada");
  expect(container.querySelector("[role=log]")).toBeNull();
  expect(container.textContent).not.toContain("Conectar WhatsApp");
});
it("identifica que el canal de prueba envía mensajes reales a un único destinatario", async () => {
  cargar.mockResolvedValue({
    ...base,
    origen: "GENERAL",
    prueba: { numero: "+16505550100", venceEl: "2026-10-01T21:00:00Z" },
  });
  await render();
  expect(container.textContent).toContain("Canal de prueba · mensajes reales");
  expect(container.textContent).toContain(
    "No se importa el historial del celular",
  );
});

const ordenConversaciones = () =>
  [
    ...container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Abrir conversación con"]',
    ),
  ].map((b) => b.getAttribute("aria-label"));
it.each(["ENTRANTE", "SALIENTE"])(
  "un mensaje %s mueve el chat al inicio sin cambiar la conversación abierta",
  async (direccion) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T15:00:00Z"));
    let datos = general();
    datos.conversaciones = datos.conversaciones!.map((c, i) => ({
      ...c,
      ultimoMensaje: {
        ...mensaje,
        id: c.id,
        enviadoEl: i ? "2026-09-26T15:00:00Z" : "2026-09-27T15:00:00Z",
      },
    }));
    cargar.mockResolvedValue(datos);
    let eventos!: Parameters<EscucharInbox>[0];
    const tiempoReal: EscucharInbox = (o) => {
      eventos = o;
      return () => {};
    };
    await act(async () =>
      root.render(
        <InboxView
          identidad={identidad}
          cargar={cargar}
          tiempoReal={tiempoReal}
        />,
      ),
    );
    expect(container.textContent).not.toContain("Volver a Grafo");
    expect(ordenConversaciones()).toEqual([
      "Abrir conversación con Alma",
      "Abrir conversación con Bruno",
    ]);
    expect(
      container.querySelector('[aria-label="Abrir conversación con Alma"] time')
        ?.textContent,
    ).toBe("Ayer");
    datos = {
      ...datos,
      conversaciones: datos.conversaciones!.map((c) =>
        c.id === "chat-2"
          ? {
              ...c,
              ultimoMensaje: {
                ...mensaje,
                id: "nuevo-bruno",
                texto: "Última actividad",
                direccion,
                enviadoEl: "2026-09-28T15:00:00Z",
              },
            }
          : c,
      ),
    };
    cargar.mockResolvedValue(datos);
    await act(async () => {
      await eventos.actualizar(new AbortController().signal);
    });
    expect(ordenConversaciones()).toEqual([
      "Abrir conversación con Bruno",
      "Abrir conversación con Alma",
    ]);
    expect(
      container.querySelector(
        '[aria-label="Abrir conversación con Bruno"] time',
      )?.textContent,
    ).toBe("12:00");
    expect(container.querySelector("[role=log]")?.textContent).toContain(
      "Consulta de Alma",
    );
    expect(cargar.mock.calls.at(-1)?.[0].conversacionId).toBe("chat-1");
    cargar.mockResolvedValue({
      ...datos,
      conversaciones: datos.conversaciones!.map((c) => ({
        ...c,
        ultimoMensaje: { ...c.ultimoMensaje!, estadoEntrega: "READ" },
      })),
    });
    await act(async () => {
      await eventos.actualizar(new AbortController().signal);
    });
    expect(ordenConversaciones()).toEqual([
      "Abrir conversación con Bruno",
      "Abrir conversación con Alma",
    ]);
  },
);
it("actualiza la etiqueta al pasar medianoche sin necesitar otro mensaje", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T02:59:30Z"));
  const datos = general();
  datos.conversaciones![0].ultimoMensaje = {
    ...mensaje,
    enviadoEl: "2026-09-29T02:59:00Z",
  };
  cargar.mockResolvedValue(datos);
  await render();
  const etiqueta = () =>
    container.querySelector('[aria-label="Abrir conversación con Alma"] time')
      ?.textContent;
  expect(etiqueta()).toBe("23:59");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(etiqueta()).toBe("Ayer");
});
it("reordena y elimina duplicados al agregar otra página de conversaciones", async () => {
  const datos = general();
  datos.conversaciones = datos.conversaciones!.map((c, i) => ({
    ...c,
    ultimoMensaje: {
      ...mensaje,
      enviadoEl: new Date(Date.UTC(2026, 8, 26 - i)).toISOString(),
    },
  }));
  cargar.mockResolvedValue({ ...datos, listaAnterior: "pagina" });
  await render();
  cargar.mockResolvedValueOnce({
    ...datos,
    conversaciones: [
      {
        ...datos.conversaciones[1],
        ultimoMensaje: { ...mensaje, enviadoEl: "2026-09-28T12:00:00Z" },
      },
      {
        id: "chat-3",
        nombre: "Clara",
        telefono: "+16505550125",
        ultimoMensaje: null,
      },
    ],
  });
  await click("Más conversaciones");
  expect(ordenConversaciones()).toEqual([
    "Abrir conversación con Bruno",
    "Abrir conversación con Alma",
    "Abrir conversación con Clara",
  ]);
});
