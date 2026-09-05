import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readWhatsAppSender, sendWhatsAppOrder } from "../src/whatsapp-send.js";
const job = {
  id: "caa3a7f1-87eb-4b6c-8f42-097ad9b2e193",
  telefono: "5492966123456",
  texto: "Tu orden está lista.",
  numeroEmisor: "5491112345678",
};
function page(send = async () => ({ id: "ack-id", ack: 1 })) {
  let count = 0,
    input;
  const window = {
    location: { origin: "https://web.whatsapp.com" },
    WPP: {
      version: "4.6.0",
      isReady: true,
      conn: {
        isAuthenticated: () => true,
        getMyUserId: () => ({ _serialized: "5491112345678@c.us" }),
      },
      chat: {
        sendTextMessage: (...args) => {
          count++;
          input = args;
          return send(...args);
        },
      },
    },
  };
  const context = vm.createContext({ window, setTimeout, clearTimeout });
  return {
    window,
    get count() {
      return count;
    },
    get input() {
      return input;
    },
    read: () =>
      vm.runInContext(`(${readWhatsAppSender.toString()})()`, context),
    send: (data) => {
      context.job = data;
      return vm.runInContext(`(${sendWhatsAppOrder.toString()})(job)`, context);
    },
  };
}
test("envía solo al destinatario de la cola sin depender del chat abierto ni tocar el compositor", async () => {
  const p = page();
  assert.equal((await p.read()).numero, job.numeroEmisor);
  assert.equal((await p.send(job)).estado, "enviada");
  assert.equal(p.input[0], `${job.telefono}@c.us`);
  assert.equal(p.input[1], job.texto);
  assert.equal(p.input[2].markIsRead, false);
});
test("dos ejecuciones del mismo aviso producen un único envío", async () => {
  const p = page();
  const results = await Promise.all([p.send(job), p.send(job)]);
  assert.equal(p.count, 1);
  assert.ok(results.every((r) => r.estado === "enviada"));
});
test("deja que WA-JS genere la MsgKey; un UUID de Grafo no identifica un mensaje de WhatsApp", async () => {
  const p = page(async (_phone, _text, options) => {
    // prepareRawMessage 4.6.0 interpreta messageId como MsgKey.fromString,
    // incluyendo dirección, chat y clave; rechaza un UUID antes de enviar.
    if (options.messageId && !/^true_[^_]+@(?:c\.us|lid)_[A-F0-9]+$/.test(options.messageId))
      throw new Error("Invalid message key");
    return { id: "true_123456789@lid_WHATSAPP_GENERATED", ack: 1 };
  });
  const result = await p.send(job);
  assert.equal(result.estado, "enviada");
  assert.equal(result.mensajeId, "true_123456789@lid_WHATSAPP_GENERATED");
  assert.equal(Object.hasOwn(p.input[2], "messageId"), false);
});
test("un fallo ambiguo no provoca otro envío al reintentar la misma inyección", async () => {
  const p = page(async () => {
    throw new Error("conexión perdida");
  });
  assert.equal((await p.send(job)).estado, "incierta");
  assert.equal((await p.send(job)).estado, "incierta");
  assert.equal(p.count, 1);
});
test("no declara enviado un mensaje sin confirmación del servidor", async () => {
  const p = page(async () => ({ id: "local-only", ack: 0 }));
  assert.equal((await p.send(job)).estado, "incierta");
});
test("se detiene ante cambio de cuenta, grupo, LID o ausencia de texto", async () => {
  for (const change of [
    { numeroEmisor: "5499999999999" },
    { telefono: "12345@g.us" },
    { telefono: "123456789@lid" },
    { texto: "" },
  ]) {
    const p = page();
    assert.equal((await p.send({ ...job, ...change })).estado, "no_enviada");
    assert.equal(p.count, 0);
  }
});
