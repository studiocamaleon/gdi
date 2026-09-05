import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";

const settle = async () => {
  for (let n = 0; n < 6; n += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
};
test("el panel real limpia el cliente al cambiar de chat y no acepta la respuesta anterior", async () => {
  const { document, window } = parseHTML(
    await readFile(new URL("../sidepanel.html", import.meta.url), "utf8"),
  );
  const saved = {
    document: globalThis.document,
    window: globalThis.window,
    chrome: globalThis.chrome,
    fetch: globalThis.fetch,
  };
  let active = {
    tabId: 42,
    chat: {
      key: "chat-a",
      name: "Chat A",
      phone: null,
      group: false,
      detection: "detecting",
    },
  };
  const listeners = [];
  const pending = new Map();
  const session = {
    empresa: { id: "empresa", nombre: "Empresa de prueba" },
    permisos: { clientes: true, ordenes: true },
  };
  const noopListener = { addListener() {} };
  Object.assign(globalThis, {
    document,
    window,
    chrome: {
      runtime: {
        id: "extension",
        onMessage: { addListener: (listener) => listeners.push(listener) },
        sendMessage: async () => active,
      },
      windows: { getCurrent: async () => ({ id: 1 }) },
      permissions: { contains: async () => true, onRemoved: noopListener },
      storage: {
        local: { get: async () => ({ grafoOrigin: "https://grafo.example" }) },
        onChanged: noopListener,
      },
    },
    fetch: async (url) => {
      if (url.endsWith("/sesion")) return Response.json(session);
      const phone = new URL(url).searchParams.get("telefono");
      // Intencionalmente ignora AbortSignal para probar la defensa adicional.
      return new Promise((resolve) => pending.set(phone, resolve));
    },
  });
  const result = (name, phone) =>
    Response.json({
      ...session,
      estado: "encontrado",
      telefono: phone,
      cliente: { id: name, nombre: name, activo: true, contactos: [] },
      ordenes: [],
    });
  try {
    await import(`../src/panel.js?test=${Date.now()}`);
    await settle();
    assert.equal(pending.size, 0);
    assert.equal(document.getElementById("show-contact"), null);
    assert.match(
      document.getElementById("notice").textContent,
      /automáticamente/,
    );
    active.chat = {
      ...active.chat,
      phone: "+5492966123456",
      detection: "resolved",
    };
    listeners[0](
      { type: "grafo:context-invalidated", windowId: 1 },
      { id: "extension" },
    );
    await settle();
    assert.ok(pending.has("+5492966123456"));
    active = {
      tabId: 42,
      chat: {
        key: "chat-b",
        name: "Chat B",
        phone: "+5492966654321",
        group: false,
      },
    };
    listeners[0](
      { type: "grafo:context-invalidated", windowId: 1 },
      { id: "extension" },
    );
    assert.equal(document.getElementById("results").textContent, "");
    await settle();
    pending.get("+5492966654321")(result("Cliente B", "+5492966654321"));
    await settle();
    assert.match(document.getElementById("results").textContent, /Cliente B/);
    pending.get("+5492966123456")(result("Cliente A", "+5492966123456"));
    await settle();
    assert.doesNotMatch(
      document.getElementById("results").textContent,
      /Cliente A/,
    );
    active = { tabId: null, chat: null };
    listeners[0](
      { type: "grafo:context-invalidated", windowId: 1 },
      { id: "extension" },
    );
    await settle();
    assert.equal(document.getElementById("results").textContent, "");
    assert.match(
      document.getElementById("notice").textContent,
      /Abrí WhatsApp/,
    );
  } finally {
    window.dispatchEvent(new window.Event("pagehide"));
    Object.assign(globalThis, saved);
  }
});
