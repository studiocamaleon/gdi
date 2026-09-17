import { grafoOrigin, permissionPattern } from "./model.js";
import { readWhatsAppSender, sendWhatsAppOrder } from "./whatsapp-send.js";
const ALARM = "grafo-avisos-ordenes";
const unavailable = {
  cerrado: "Abrí WhatsApp Web en este perfil de Chrome.",
  desconectado: "Esperando que WhatsApp termine de conectar.",
  incompatible: "Hay otro lector de WhatsApp incompatible en esta pestaña.",
  sin_numero: "No se pudo confirmar el número emisor de WhatsApp.",
  sin_lector: "Preparando el emisor de WhatsApp.",
};
export function installAutomaticos() {
  let busy = false;
  const status = (text) => chrome.storage.local.set({ autoStatus: text });
  async function api(origin, path, data, method = "POST") {
    const base = grafoOrigin(origin);
    if (
      !(await chrome.permissions.contains({
        origins: [permissionPattern(base)],
      }))
    )
      throw new Error("Volvé a conectar la dirección de Grafo.");
    const response = await fetch(
      `${base}/api/backend/chrome-whatsapp/automaticos/${path}`,
      {
        method,
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          Accept: "application/json",
          ...(data ? { "Content-Type": "application/json" } : {}),
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      },
    );
    if (response.status === 401)
      throw new Error("Iniciá sesión en Grafo para continuar los avisos.");
    if (response.status === 403)
      throw new Error(
        "Los avisos automáticos necesitan una sesión de administrador.",
      );
    if (!response.ok)
      throw new Error(
        "Grafo no autorizó la operación. Revisá la empresa y el equipo emisor.",
      );
    return response.json();
  }
  async function sender() {
    const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    if (!tabs.length) throw new Error(unavailable.cerrado);
    for (const tab of tabs) {
      let frames = await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        world: "MAIN",
        func: readWhatsAppSender,
      });
      if (frames[0]?.result?.estado === "sin_lector") {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, documentIds: [frames[0].documentId] },
          world: "MAIN",
          files: ["vendor/wppconnect-wa.js"],
        });
        frames = await chrome.scripting.executeScript({
          target: { tabId: tab.id, documentIds: [frames[0].documentId] },
          world: "MAIN",
          func: readWhatsAppSender,
          args: [true],
        });
      }
      if (frames[0]?.result?.estado === "listo")
        return {
          tabId: tab.id,
          documentId: frames[0].documentId,
          numero: frames[0].result.numero,
        };
      if (tabs.length === 1)
        throw new Error(
          unavailable[frames[0]?.result?.estado] ||
            "WhatsApp todavía no está listo.",
        );
    }
    throw new Error("No encontramos una sesión de WhatsApp lista para enviar.");
  }
  async function receipt(saved) {
    if (!saved.autoReceipt) return;
    const { origin, id, body } = saved.autoReceipt;
    await api(origin, `${id}/resultado`, body);
    await chrome.storage.local.remove("autoReceipt");
  }
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const saved = await chrome.storage.local.get([
        "autoConfig",
        "autoReceipt",
        "grafoOrigin",
      ]);
      // Confirmar no es volver a enviar; se reintenta aunque los avisos se pausaran.
      await receipt(saved);
      const config = saved.autoConfig;
      if (!config?.enabled || config.origin !== saved.grafoOrigin) return;
      const state = await api(config.origin, "estado", null, "GET");
      if (state.tenantId !== config.tenantId)
        throw new Error("La sesión cambió de empresa. Reconectá los avisos.");
      if (state.pausado)
        throw new Error("Los avisos de la empresa están pausados en Grafo.");
      if (
        state.modo !== "WHATSAPP_WEB" ||
        state.dispositivoId !== config.dispositivoId ||
        state.numero !== config.numero
      ) {
        await status("Los avisos están pausados o asignados a otro equipo.");
        return;
      }
      const wa = await sender();
      if (wa.numero !== config.numero)
        throw new Error(
          "La cuenta de WhatsApp cambió. Los envíos están detenidos.",
        );
      const identity = {
        tenantId: config.tenantId,
        dispositivoId: config.dispositivoId,
        numero: wa.numero,
      };
      for (let i = 0; i < 3; i++) {
        const { trabajo: reserved } = await api(
          config.origin,
          "reservar",
          identity,
        );
        if (!reserved) {
          await status("Automático activo · esperando avisos de órdenes.");
          break;
        }
        const claim = { ...identity, token: reserved.token };
        const { trabajo: job } = await api(
          config.origin,
          `${reserved.id}/iniciar`,
          claim,
        );
        if (!job) continue;
        // El servidor ya registró que este intento empezó. Desde acá cualquier
        // corte se considera incierto y jamás dispara un segundo envío.
        let result;
        try {
          const frames = await chrome.scripting.executeScript({
            target: { tabId: wa.tabId, documentIds: [wa.documentId] },
            world: "MAIN",
            func: sendWhatsAppOrder,
            args: [job],
          });
          result = frames[0]?.result || {
            estado: "incierta",
            motivo: "Chrome no devolvió el resultado del envío.",
          };
        } catch {
          result = {
            estado: "incierta",
            motivo: "Se cerró la página durante el intento de envío.",
          };
        }
        const pending = {
          origin: config.origin,
          id: reserved.id,
          body: { ...claim, ...result },
        };
        await chrome.storage.local.set({ autoReceipt: pending });
        await receipt({ autoReceipt: pending });
        await status(
          result.estado === "enviada"
            ? "Último aviso enviado por WhatsApp Web."
            : result.motivo,
        );
        if (result.estado !== "enviada") break;
      }
    } catch (error) {
      await status(
        error.message || "No se pudo completar el envío automático.",
      );
    } finally {
      busy = false;
    }
  }
  async function configure(mode) {
    if (!["WHATSAPP_WEB", "PAUSADO", "WATI"].includes(mode))
      throw new Error("Modo inválido.");
    const saved = await chrome.storage.local.get([
      "grafoOrigin",
      "autoConfig",
      "autoDeviceId",
    ]);
    const origin = grafoOrigin(saved.grafoOrigin);
    const state = await api(origin, "estado", null, "GET");
    const deviceId = saved.autoDeviceId || crypto.randomUUID();
    const numero =
      mode === "WHATSAPP_WEB"
        ? (await sender()).numero
        : saved.autoConfig?.numero || state.numero;
    if (!numero) throw new Error("Primero conectá WhatsApp Web.");
    const body = {
      tenantId: state.tenantId,
      dispositivoId: deviceId,
      numero,
      modo: mode,
    };
    await api(origin, "configuracion", body, "PUT");
    await chrome.storage.local.set({
      autoDeviceId: deviceId,
      autoConfig: { origin, ...body, enabled: mode === "WHATSAPP_WEB" },
    });
    await status(
      mode === "WHATSAPP_WEB"
        ? "Automático activado para avisos nuevos de órdenes."
        : mode === "PAUSADO"
          ? "Envíos por la extensión pausados."
          : "Los próximos avisos vuelven a WATI.",
    );
    void tick();
    return { ok: true };
  }
  chrome.runtime.onMessage.addListener((message, from, respond) => {
    if (
      from.id !== chrome.runtime.id ||
      from.tab ||
      from.url !== chrome.runtime.getURL("sidepanel.html")
    )
      return;
    if (message.type === "grafo:auto-configurar") {
      configure(message.modo).then(respond, (error) =>
        respond({ error: error.message }),
      );
      return true;
    }
    if (message.type === "grafo:auto-prueba") {
      (async () => {
        const { autoConfig: c } = await chrome.storage.local.get("autoConfig");
        if (!c?.enabled) throw new Error("Primero activá este equipo.");
        await api(c.origin, "prueba", {
          tenantId: c.tenantId,
          dispositivoId: c.dispositivoId,
          numero: c.numero,
        });
        await status("Prueba encolada para el propio número emisor.");
        void tick();
        return { ok: true };
      })().then(respond, (error) => respond({ error: error.message }));
      return true;
    }
    if (message.type === "grafo:auto-estado") {
      (async () => {
        const saved = await chrome.storage.local.get([
          "grafoOrigin",
          "autoConfig",
          "autoStatus",
        ]);
        const state = saved.grafoOrigin
          ? await api(saved.grafoOrigin, "estado", null, "GET")
          : null;
        return { state, config: saved.autoConfig, status: saved.autoStatus };
      })().then(respond, (error) => respond({ error: error.message }));
      return true;
    }
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) void tick();
  });
  chrome.runtime.onStartup.addListener(() => {
    void chrome.alarms.create(ALARM, { periodInMinutes: 1 });
    void tick();
  });
  chrome.runtime.onInstalled.addListener(() => {
    void chrome.alarms.create(ALARM, { periodInMinutes: 1 });
  });
  chrome.tabs.onUpdated.addListener((_, change, tab) => {
    if (
      change.status === "complete" &&
      tab.url?.startsWith("https://web.whatsapp.com/")
    )
      void tick();
  });
  void chrome.alarms.create(ALARM, { periodInMinutes: 1 });
}
