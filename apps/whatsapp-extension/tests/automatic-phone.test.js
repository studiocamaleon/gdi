import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { parseHTML } from "linkedom";
import "../src/whatsapp-dom.js";
import { readWhatsAppActiveChat } from "../src/whatsapp-active-chat.js";

const contentSource = await readFile(
  new URL("../src/content.js", import.meta.url),
  "utf8",
);
const ORIGIN = "https://web.whatsapp.com";
function bridge(chat, cache = () => undefined) {
  const outputs = [],
    modules = [];
  const window = {
    location: { origin: ORIGIN },
    require(name) {
      modules.push(name);
      if (name === "WAWebChatCollection")
        return {
          ChatCollection: {
            findFirst: (predicate) => [chat].filter(Boolean).find(predicate),
          },
        };
      if (name === "WAWebApiContact")
        return { lidPnCache: { getPhoneNumber: cache } };
      throw new Error(`Módulo no autorizado: ${name}`);
    },
  };

  return {
    window,
    outputs,
    modules,
    request() {
      // Chrome serializa la función; no conserva imports ni closures.
      const result = vm.runInNewContext(
        `(${readWhatsAppActiveChat.toString()})()`,
        { window },
      );
      outputs.push(JSON.parse(JSON.stringify(result)));
      return outputs.at(-1);
    },
  };
}
test("lee el teléfono de un chat guardado por nombre sin acceder a mensajes", () => {
  const b = bridge({
    active: true,
    id: { user: "5492966123456", server: "c.us" },
    formattedTitle: "Lucas",
    get msgs() {
      throw new Error("No leer mensajes");
    },
  });
  assert.deepEqual(b.request(), {
    status: "ready",
    chat: {
      id: "5492966123456@c.us",
      name: "Lucas",
      phone: "+5492966123456",
      group: false,
    },
  });
  assert.deepEqual(b.modules, ["WAWebChatCollection"]);
  assert.doesNotMatch(
    JSON.stringify(b.outputs),
    /msgs|messages|body|orders|token/,
  );
});
test("resuelve LID con la equivalencia local y nunca trata sus dígitos como teléfono", () => {
  const chat = { active: true, id: "123456789012345@lid", name: "Lucas" };
  assert.equal(bridge(chat).request().chat.phone, null);
  const found = bridge(chat, () => ({ _serialized: "5492966123456@c.us" }));
  assert.equal(found.request().chat.phone, "+5492966123456");
  assert.deepEqual(found.modules, ["WAWebChatCollection", "WAWebApiContact"]);
});
test("puede resolver la equivalencia del contacto cargado si no está en la caché", () => {
  const chat = {
    active: true,
    id: "123456789012345@lid",
    contact: { pnForLid: "34612345678@c.us" },
  };
  assert.equal(bridge(chat).request().chat.phone, "+34612345678");
});
test("no vincula grupos aunque su título o contacto incluya un teléfono", () => {
  const chat = {
    active: true,
    id: "123456789-123456@g.us",
    formattedTitle: "+5492966123456",
    contact: { id: "5492966123456@c.us" },
  };
  assert.equal(bridge(chat).request().chat.phone, null);
  assert.equal(bridge(chat).request().chat.group, true);
});
test("tolera WhatsApp cargando y no consulta módulos fuera de su origen", () => {
  const b = bridge(null);
  assert.deepEqual(b.request(), { status: "ready", chat: null });
  b.window.location.origin = "https://otro.example";
  assert.deepEqual(b.request(), { status: "unavailable", reason: "origin" });
  assert.equal(b.modules.length, 1);
  b.window.location.origin = ORIGIN;
  b.window.require = () => {
    throw new Error("Todavía no cargó");
  };
  assert.deepEqual(b.request(), { status: "unavailable", reason: "module" });
});

function content() {
  const { document, window: domWindow } = parseHTML(
    '<div id="main"><header><div data-testid="conversation-info-header"><span data-testid="conversation-info-header-chat-title">Lucas</span></div></header></div>',
  );
  domWindow.HTMLElement.prototype.getClientRects = () => [{}];
  let now = 100000,
    poll,
    receiver,
    clicks = 0;
  const listeners = new Map(),
    sent = [],
    scheduled = [];
  document.querySelector('[data-testid="conversation-info-header"]').click =
    () => {
      clicks += 1;
    };
  const window = {
    addEventListener: (type, callback) => {
      listeners.set(type, [...(listeners.get(type) || []), callback]);
    },
  };
  vm.runInNewContext(contentSource, {
    window,
    document,
    crypto: { randomUUID },
    GrafoWhatsAppDOM: globalThis.GrafoWhatsAppDOM,
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    setInterval(callback) {
      poll = callback;
      return 1;
    },
    clearInterval() {},
    clearTimeout() {},
    setTimeout(callback, delay) {
      scheduled.push({ callback, at: now + delay });
      return scheduled.length;
    },
    chrome: {
      runtime: {
        id: "extension",
        sendMessage: (message) => {
          if (message.type !== "grafo:read-active-chat")
            return Promise.resolve();
          return new Promise((resolve) => sent.push({ ...message, resolve }));
        },
        onMessage: {
          addListener: (callback) => {
            receiver = callback;
          },
        },
      },
    },
  });
  return {
    sent,
    document,
    get clicks() {
      return clicks;
    },
    read() {
      let state;
      receiver({ type: "grafo:read-chat" }, { id: "extension" }, (value) => {
        state = value;
      });
      return state;
    },
    async reply(chat, request = sent.at(-1)) {
      const result =
        chat === "unavailable"
          ? { status: "unavailable" }
          : { status: "ready", chat };
      request.resolve({ requestId: request.requestId, result });
      await Promise.resolve();
    },
    step(ms = 500) {
      now += ms;
      const due = scheduled.splice(0).filter((entry) => entry.at <= now);
      due.forEach((entry) => entry.callback());
      poll();
    },
    rename(name) {
      document.querySelector(
        '[data-testid="conversation-info-header-chat-title"]',
      ).textContent = name;
    },
  };
}
const lucas = {
  id: "5492966123456@c.us",
  name: "Lucas",
  phone: "+5492966123456",
  group: false,
};
test("detecta automáticamente sin clics y sin abrir información del contacto", async () => {
  const c = content();
  assert.equal(c.read().detection, "detecting");
  await c.reply(lucas);
  c.step();
  await c.reply(lucas);
  assert.equal(c.read().phone, lucas.phone);
  assert.equal(c.read().detection, "resolved");
  assert.equal(c.clicks, 0);
  assert.equal(c.document.querySelector('[data-testid="drawer-right"]'), null);
});
test("descarta el teléfono de la conversación anterior al cambiar rápido de chat", async () => {
  const c = content();
  c.read();
  const previousRequest = c.sent.at(-1);
  c.rename("María");
  const nextKey = c.read().key;
  await c.reply(lucas, previousRequest);
  assert.equal(c.read().phone, null);
  const maria = {
    ...lucas,
    name: "María",
    id: "34612345678@c.us",
    phone: "+34612345678",
  };
  await c.reply(maria);
  c.step();
  await c.reply(maria);
  assert.equal(c.read().phone, maria.phone);
  assert.equal(c.read().key, nextKey);
});
test("distingue chats homónimos por identificador y limpia la asociación manual", async () => {
  const c = content();
  c.read();
  await c.reply(lucas);
  c.step();
  await c.reply(lucas);
  const first = c.read();
  const other = { ...lucas, id: "34612345678@c.us", phone: "+34612345678" };
  await c.reply(other);
  assert.notEqual(c.read().key, first.key);
  assert.equal(c.read().phone, null);
  c.step();
  await c.reply(other);
  assert.equal(c.read().phone, other.phone);
});
test("se recupera solo cuando WhatsApp termina de exponer el teléfono", async () => {
  const c = content();
  c.read();
  await c.reply("unavailable");
  c.step(8500);
  await c.reply("unavailable");
  assert.equal(c.read().detection, "unavailable");
  await c.reply(lucas);
  c.step();
  await c.reply(lucas);
  assert.equal(c.read().detection, "resolved");
  assert.equal(c.read().phone, lucas.phone);
});
