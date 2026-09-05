import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { readWhatsAppActiveChat } from "../src/whatsapp-active-chat.js";

const source = (
  await readFile(new URL("../src/background.js", import.meta.url), "utf8")
).replace(/^import .*;\n/gm, "");

function background(execute) {
  let listener;
  const calls = [];
  const ignoredEvent = { addListener() {} };
  vm.runInNewContext(source, {
    URL,
    readWhatsAppActiveChat,
    installAutomaticos() {},
    chrome: {
      sidePanel: { setPanelBehavior() {} },
      tabs: {
        onUpdated: ignoredEvent,
        onActivated: ignoredEvent,
        onRemoved: ignoredEvent,
      },
      runtime: {
        id: "grafo",
        getURL: (path) => `chrome-extension://grafo/${path}`,
        onInstalled: ignoredEvent,
        onMessage: {
          addListener: (callback) => {
            listener = callback;
          },
        },
      },
      scripting: {
        executeScript(options) {
          calls.push(options);
          return execute(options);
        },
      },
    },
  });
  return { calls, send: (...args) => listener(...args) };
}
const request = { type: "grafo:read-active-chat", requestId: "request-1" };
const sender = {
  id: "grafo",
  url: "https://web.whatsapp.com/",
  frameId: 0,
  documentId: "documento-original",
  tab: { id: 17 },
};
test("devuelve el resultado por Chrome desde el documento original sin eventos de página", async () => {
  const bg = background(async (options) => [
    {
      result: vm.runInNewContext(`(${options.func.toString()})()`, {
        window: {
          location: { origin: "https://web.whatsapp.com" },
          require: () => ({
            ChatCollection: {
              findFirst: () => ({
                id: "5492966123456@c.us",
                formattedTitle: "Lucas",
                active: true,
              }),
            },
          }),
          postMessage: () => assert.fail("No depender de eventos de WhatsApp"),
        },
      }),
    },
  ]);
  const reply = await new Promise((resolve) =>
    assert.equal(bg.send(request, sender, resolve), true),
  );
  assert.equal(reply.requestId, request.requestId);
  assert.equal(reply.result.chat.phone, "+5492966123456");
  assert.deepEqual(JSON.parse(JSON.stringify(bg.calls[0].target)), {
    tabId: 17,
    documentIds: ["documento-original"],
  });
  assert.equal(bg.calls[0].world, "MAIN");
});
test("rechaza otros marcos, páginas y extensiones antes de ejecutar el lector", () => {
  const bg = background(() => assert.fail("No ejecutar"));
  for (const change of [
    { id: "otra" },
    { frameId: 1 },
    { documentId: undefined },
    { url: "https://otro.example/" },
    { tab: undefined },
  ])
    assert.equal(
      bg.send(request, { ...sender, ...change }, assert.fail),
      undefined,
    );
  assert.equal(
    bg.send({ ...request, requestId: "x".repeat(101) }, sender, assert.fail),
    undefined,
  );
  assert.equal(bg.calls.length, 0);
});
test("informa el fallo si el documento se cerró o Chrome rechaza la ejecución", async () => {
  const bg = background(async () => {
    throw new Error("No document with id");
  });
  const reply = await new Promise((resolve) =>
    bg.send(request, sender, resolve),
  );
  assert.equal(reply.result.status, "unavailable");
  assert.equal(reply.result.reason, "injection");
});
