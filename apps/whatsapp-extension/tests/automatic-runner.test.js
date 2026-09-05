import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { grafoOrigin, permissionPattern } from "../src/model.js";
import { readWhatsAppSender, sendWhatsAppOrder } from "../src/whatsapp-send.js";
const source = (
  await readFile(new URL("../src/automaticos.js", import.meta.url), "utf8")
)
  .replace(/^import .*;\n/gm, "")
  .replace("export function installAutomaticos", "function installAutomaticos");
const conf = {
  origin: "http://localhost:3000",
  tenantId: "tenant",
  dispositivoId: "device",
  numero: "5491112345678",
  enabled: true,
};
function runner({
  company = "tenant",
  sender = conf.numero,
  receiptFailure = false,
} = {}) {
  const saved = { autoConfig: conf, grafoOrigin: conf.origin };
  let alarm,
    reserved = false,
    sends = 0,
    receiptCalls = 0,
    fail = receiptFailure;
  const calls = [];
  const ignore = { addListener() {} };
  const page = {
    location: { origin: "https://web.whatsapp.com" },
    WPP: {
      version: "4.6.0",
      isReady: true,
      conn: {
        isAuthenticated: () => true,
        getMyUserId: () => ({ _serialized: `${sender}@c.us` }),
      },
      chat: {
        sendTextMessage: async () => {
          sends++;
          return { id: "sent-id", ack: 1 };
        },
      },
    },
  };
  const scope = vm.createContext({
    URL,
    AbortSignal,
    setTimeout,
    clearTimeout,
    grafoOrigin,
    permissionPattern,
    readWhatsAppSender,
    sendWhatsAppOrder,
    fetch: async (url, options) => {
      const path = url.split("/automaticos/")[1];
      calls.push(path);
      if (path.endsWith("/resultado")) {
        receiptCalls++;
        if (fail) {
          fail = false;
          throw new Error("HTTP response lost");
        }
      }
      const value =
        path === "estado"
          ? {
              tenantId: company,
              modo: "WHATSAPP_WEB",
              dispositivoId: "device",
              numero: conf.numero,
            }
          : path === "reservar"
            ? {
                trabajo: reserved
                  ? null
                  : ((reserved = true), { id: "id", token: "token" }),
              }
            : path.endsWith("/iniciar")
              ? {
                  trabajo: {
                    id: "caa3a7f1-87eb-4b6c-8f42-097ad9b2e193",
                    telefono: "5492966123456",
                    texto: "Orden lista",
                    numeroEmisor: conf.numero,
                  },
                }
              : { ok: true };
      return { ok: true, status: 200, json: async () => value };
    },
    chrome: {
      permissions: { contains: async () => true },
      storage: {
        local: {
          get: async () => ({ ...saved }),
          set: async (data) => Object.assign(saved, data),
          remove: async (key) => {
            delete saved[key];
          },
        },
      },
      tabs: { query: async () => [{ id: 1 }], onUpdated: ignore },
      runtime: { onMessage: ignore, onStartup: ignore, onInstalled: ignore },
      alarms: {
        create() {},
        onAlarm: {
          addListener(fn) {
            alarm = fn;
          },
        },
      },
      scripting: {
        executeScript: async (options) => {
          assert.equal(options.world, "MAIN");
          if (options.func === sendWhatsAppOrder)
            assert.equal(options.target.documentIds[0], "document-1");
          return [
            {
              documentId: "document-1",
              result: await vm.runInNewContext(
                `(${options.func.toString()})(job)`,
                {
                  window: page,
                  job: options.args?.[0],
                  setTimeout,
                  clearTimeout,
                },
              ),
            },
          ];
        },
      },
    },
  });
  vm.runInContext(source + "\ninstallAutomaticos();", scope);
  return {
    calls,
    saved,
    get sends() {
      return sends;
    },
    get receipts() {
      return receiptCalls;
    },
    async tick() {
      alarm({ name: "grafo-avisos-ordenes" });
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}
test("la alarma despacha y confirma una orden sin abrir sidebar ni pedir contexto del chat", async () => {
  const r = runner();
  await r.tick();
  assert.equal(r.sends, 1);
  assert.equal(r.receipts, 1);
  assert.deepEqual(r.calls.slice(0, 4), [
    "estado",
    "reservar",
    "id/iniciar",
    "id/resultado",
  ]);
});
test("si se pierde la confirmación HTTP, se repite sólo el recibo y nunca el mensaje", async () => {
  const r = runner({ receiptFailure: true });
  await r.tick();
  assert.equal(r.sends, 1);
  assert.ok(r.saved.autoReceipt);
  await r.tick();
  assert.equal(r.sends, 1);
  assert.equal(r.receipts, 2);
  assert.equal(r.saved.autoReceipt, undefined);
});
test("un cambio de empresa o de número emisor detiene la cola antes de reservar", async () => {
  for (const options of [{ company: "otra" }, { sender: "5499999999999" }]) {
    const r = runner(options);
    await r.tick();
    assert.equal(r.sends, 0);
    assert.ok(!r.calls.includes("reservar"));
  }
});
