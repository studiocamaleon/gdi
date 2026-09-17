import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import {
  grafoOrigin,
  permissionPattern,
  phoneInput,
  deliveryDate,
  LatestRequest,
} from "../src/model.js";
import { renderResults } from "../src/render.js";
import "../src/whatsapp-dom.js";
const { phoneFromText, readHeader } = globalThis.GrafoWhatsAppDOM;

function dom(html) {
  const { document, window } = parseHTML(html);
  window.HTMLElement.prototype.getClientRects = function () {
    return this.hidden ? [] : [{ width: 100 }];
  };
  return document;
}
test("sólo interpreta teléfonos completos, nunca cifras de un texto o un grupo", () => {
  assert.equal(
    phoneFromText("\u200e+54 9 2966 12-3456\u200e"),
    "+5492966123456",
  );
  for (const value of [
    "Pedido +54 9 2966 123456",
    "123456",
    "+12",
    "+5492966123456, +5492966654321",
    "+54929661234567890",
  ]) {
    assert.equal(phoneFromText(value), null);
  }
  assert.throws(() => phoneInput("2966123456"));
});
test("lee sólo el encabezado, ignora teléfonos dentro de mensajes y detecta grupos", () => {
  const document = dom(
    '<div id="main"><header><div data-testid="conversation-info-header"><span data-testid="conversation-info-header-chat-title">María</span></div></header><article>+5492966123456</article></div>',
  );
  assert.equal(readHeader(document).name, "María");
  assert.equal(readHeader(document).phone, null);
  document
    .querySelector("header")
    .insertAdjacentHTML("beforeend", '<span data-icon="default-group"></span>');
  assert.equal(readHeader(document).group, true);
  document.querySelector("header").hidden = true;
  assert.equal(readHeader(document), null);
});

test("restringe la conexión a orígenes HTTPS o localhost sin rutas ni credenciales", () => {
  assert.equal(grafoOrigin("http://localhost:3000/"), "http://localhost:3000");
  assert.equal(
    permissionPattern("http://localhost:3000"),
    "http://localhost/*",
  );
  assert.equal(grafoOrigin("https://grafo.example/"), "https://grafo.example");
  for (const url of [
    "https://a:b@grafo.example",
    "https://grafo.example/otra",
    "https://grafo.example?x=1",
    "http://grafo.example",
    "file:///tmp/a",
    "javascript:alert(1)",
    "https://web.whatsapp.com/",
  ]) {
    assert.throws(() => grafoOrigin(url));
  }
});
test("descarta resultados y errores viejos incluso si el transporte ignora el aborto", async () => {
  const requests = new LatestRequest();
  const committed = [];
  let finishOld, failOld, oldSignal;
  const old = requests.run(
    (signal) => {
      oldSignal = signal;
      return new Promise((resolve) => {
        finishOld = resolve;
      });
    },
    (value) => committed.push(value),
    assert.fail,
  );
  await requests.run(
    async () => "nuevo cliente",
    (value) => committed.push(value),
    assert.fail,
  );
  assert.equal(oldSignal.aborted, true);
  finishOld("cliente anterior");
  await old;
  const error = requests.run(
    () =>
      new Promise((_, reject) => {
        failOld = reject;
      }),
    assert.fail,
    assert.fail,
  );
  requests.invalidate();
  failOld(new Error("sesión anterior"));
  await error;
  assert.deepEqual(committed, ["nuevo cliente"]);
});
test("mantiene el día de entrega sin depender de la zona horaria local", () => {
  assert.match(deliveryDate("2026-09-08"), /^8 /);
  assert.equal(deliveryDate(null), "Sin fecha acordada");
});
test("renderiza datos como texto, respeta permisos y no muestra importes", () => {
  globalThis.document = dom("<main></main>");
  const root = document.querySelector("main");
  const data = {
    estado: "encontrado",
    telefono: "+5492966123456",
    cliente: {
      id: "cliente",
      nombre: "<img src=x onerror=alert(1)>",
      razonSocial: null,
      activo: true,
      contactos: [],
    },
    permisos: { clientes: true, ordenes: true },
    ordenes: [
      {
        id: "orden",
        numero: "OT-2026-0012",
        estado: "produccion",
        fechaEntrega: "2026-09-08",
        total: 999999,
        items: [
          { nombre: "Cartel Polyfan", cantidad: 2, cantidadUnidad: "u." },
        ],
      },
    ],
  };
  renderResults(root, data, "https://grafo.example", {
    selectClient() {},
    refresh() {},
  });
  assert.equal(root.querySelector("img"), null);
  assert.match(root.textContent, /En producción/);
  assert.match(root.textContent, /Cartel Polyfan/);
  assert.doesNotMatch(root.textContent, /999999/);
  assert.equal(
    root.querySelector(".order-number").href,
    "https://grafo.example/produccion/ordenes/orden",
  );
  renderResults(
    root,
    { ...data, permisos: { ordenes: false } },
    "https://grafo.example",
    { selectClient() {}, refresh() {} },
  );
  assert.equal(root.querySelector(".order"), null);
  assert.match(root.textContent, /no tiene permiso/);
  delete globalThis.document;
});
test("el manifiesto no expone datos a páginas ni pide cookies, historial o todos los sitios al instalar", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../manifest.json", import.meta.url)),
  );
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, [
    "sidePanel",
    "storage",
    "scripting",
    "alarms",
  ]);
  assert.deepEqual(manifest.host_permissions, ["https://web.whatsapp.com/*"]);
  assert.equal(manifest.externally_connectable, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
  for (const file of [
    manifest.side_panel.default_path,
    manifest.background.service_worker,
    ...manifest.content_scripts.flatMap((script) => script.js),
  ]) {
    assert.ok((await readFile(new URL(`../${file}`, import.meta.url))).length);
  }
});
