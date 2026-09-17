import { installAutomaticosPanel } from "./automaticos-panel.js";
import {
  grafoOrigin,
  permissionPattern,
  phoneInput,
  LatestRequest,
} from "./model.js";
import { element, link, renderResults } from "./render.js";

const $ = (id) => document.getElementById(id);
const requests = new LatestRequest();
let origin = "",
  context = null,
  contextIdentity = "",
  manualPhone = "",
  selectedClient = "";
let windowId,
  syncVersion = 0,
  connecting = false,
  poll,
  lastCompany = null,
  sessionVersion = 0;

function notice(text = "", error = false) {
  $("notice").textContent = text;
  $("notice").className = `notice${error ? " error" : ""}`;
}
function clearResults() {
  sessionVersion += 1;
  requests.invalidate();
  $("results").replaceChildren();
  $("actions").replaceChildren();
  $("company").hidden = true;
}
function settings(open) {
  $("settings").hidden = !open;
  $("settings-toggle").setAttribute("aria-expanded", String(open));
}
function button(text, callback) {
  const node = element("button", text, "secondary");
  node.addEventListener("click", callback);
  return node;
}
function handleError(error) {
  clearResults();
  notice(error.message, true);
  if (origin) {
    $("actions").append(
      link(origin, "/", "Abrir Grafo e iniciar sesión ↗"),
      button("Reintentar", () => syncContext(true)),
    );
  }
}
async function api(path, signal) {
  const base = origin;
  if (
    !(await chrome.permissions.contains({ origins: [permissionPattern(base)] }))
  ) {
    throw new Error(
      "Falta autorizar esta dirección. Abrí la configuración del panel y presioná Conectar.",
    );
  }
  signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(
    () =>
      controller.abort(
        new Error("Grafo tardó demasiado en responder. Volvé a intentar."),
      ),
    15000,
  );
  let response;
  try {
    response = await fetch(`${base}/api/backend/chrome-whatsapp/${path}`, {
      credentials: "include",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      controller.signal.aborted
        ? "Grafo tardó demasiado en responder. Volvé a intentar."
        : "No se pudo conectar con Grafo. Revisá la dirección y que la app esté funcionando.",
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
  if (response.status === 401)
    throw new Error(
      "Iniciá sesión en Grafo desde este perfil de Chrome y volvé a intentar.",
    );
  if (response.status === 403)
    throw new Error(
      "Tu usuario no tiene permiso para consultar estos datos de Grafo.",
    );
  if (response.status === 429)
    throw new Error(
      "Grafo recibió demasiadas consultas. Esperá un minuto y volvé a intentar.",
    );
  if (response.status === 404 && selectedClient) selectedClient = "";
  if (!response.ok)
    throw new Error(
      response.status === 400
        ? "El teléfono no es válido. Revisá el código de país y de área."
        : "No pudimos consultar Grafo. Comprobá que la app y su API estén disponibles.",
    );
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("La dirección no responde como Grafo. Revisá la conexión.");
  return response.json();
}
function company(data) {
  lastCompany = data.empresa.id;
  $("company").textContent = data.empresa.nombre;
  $("company").hidden = false;
}
async function load() {
  clearResults();
  if (!origin) {
    settings(true);
    notice("Conectá Grafo para consultar tus clientes.");
    return;
  }
  const phone = manualPhone || context?.chat?.phone;
  if (!phone || context?.chat?.group) {
    await requests.run(
      (signal) => api("sesion", signal),
      (data) => {
        company(data);
        if (!data.permisos.clientes) {
          notice("Tu usuario no tiene permiso para consultar clientes.", true);
          return;
        }
        if (!context?.tabId)
          notice(
            "Abrí WhatsApp Web en esta ventana para consultar el chat actual.",
          );
        else if (context.reload)
          notice("Recargá WhatsApp Web para activar la extensión.");
        else if (!context.chat)
          notice("Elegí una conversación individual en WhatsApp.");
        else if (context.chat.group)
          notice(
            "Los grupos no se vinculan con fichas de clientes. Abrí un chat individual.",
          );
        else if (context.chat.detection === "unavailable")
          notice(
            "WhatsApp todavía no expone el teléfono de este chat. Seguimos intentando detectarlo automáticamente.",
          );
        else notice("Detectando el teléfono del chat automáticamente…");
      },
      handleError,
    );
    return;
  }
  notice("Buscando contacto y órdenes…");
  const params = new URLSearchParams({ telefono: phone });
  if (selectedClient) params.set("clienteId", selectedClient);
  await requests.run(
    (signal) => api(`contexto?${params}`, signal),
    (data) => {
      company(data);
      notice();
      renderResults($("results"), data, origin, {
        selectClient: (id) => {
          selectedClient = id;
          load();
        },
        refresh: () => syncContext(true),
      });
    },
    handleError,
  );
}
async function syncContext(force = false) {
  if (connecting || document.hidden) return;
  const version = ++syncVersion;
  const next = await chrome.runtime.sendMessage({
    type: "grafo:context",
    windowId,
  });
  if (version !== syncVersion) return;
  const identity = `${next?.tabId || ""}:${next?.chat?.key || ""}`;
  const changed = identity !== contextIdentity;
  const phoneChanged =
    next?.chat?.phone !== context?.chat?.phone ||
    next?.chat?.group !== context?.chat?.group;
  const detectionChanged = next?.chat?.detection !== context?.chat?.detection;
  context = next;
  $("detection-diagnostic").textContent =
    next?.chat?.diagnostic || "Esperando un chat.";
  if (changed) {
    clearResults();
    contextIdentity = identity;
    manualPhone = "";
    selectedClient = "";
    lastCompany = null;
    $("phone").value = "";
    $("manual-details").open = false;
  }
  if (phoneChanged) {
    selectedClient = "";
    manualPhone = "";
  }
  $("chat").hidden = !next?.chat;
  $("chat-name").textContent = next?.chat?.name || "";
  $("chat-phone").textContent = manualPhone
    ? `${manualPhone} · Ingresado manualmente`
    : next?.chat?.phone ||
      (next?.chat?.group
        ? "Conversación grupal"
        : next?.chat?.detection === "unavailable"
          ? "Teléfono no disponible"
          : "Detectando teléfono…");
  $("manual-details").hidden =
    !next?.chat || next.chat.group || next.chat.detection !== "unavailable";
  if (changed || phoneChanged || detectionChanged || force) await load();
}
$("settings-toggle").addEventListener("click", () =>
  settings($("settings").hidden),
);
$("connection-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  let next;
  try {
    next = grafoOrigin($("origin").value);
  } catch (error) {
    notice(error.message, true);
    return;
  }
  // Solicitar el host debe ocurrir dentro del gesto del usuario.
  const permission = chrome.permissions.request({
    origins: [permissionPattern(next)],
  });
  connecting = true;
  syncVersion += 1;
  clearResults();
  $("connect").disabled = true;
  let connected = false;
  try {
    if (!(await permission))
      throw new Error(
        "Chrome necesita acceso a esa dirección para conectar Grafo.",
      );
    const previousOrigin = origin;
    origin = next;
    selectedClient = "";
    lastCompany = null;
    await chrome.storage.local.set({ grafoOrigin: origin });
    if (
      previousOrigin &&
      permissionPattern(previousOrigin) !== permissionPattern(origin)
    ) {
      await chrome.permissions.remove({
        origins: [permissionPattern(previousOrigin)],
      });
    }
    $("disconnect").hidden = false;
    settings(false);
    connected = true;
  } catch (error) {
    handleError(error);
  } finally {
    connecting = false;
    $("connect").disabled = false;
  }
  if (connected) await syncContext(true);
});
$("disconnect").addEventListener("click", async () => {
  connecting = true;
  syncVersion += 1;
  const previousOrigin = origin;
  origin = "";
  lastCompany = null;
  selectedClient = "";
  manualPhone = "";
  clearResults();
  await chrome.storage.local.remove("grafoOrigin");
  if (previousOrigin)
    await chrome.permissions.remove({
      origins: [permissionPattern(previousOrigin)],
    });
  $("disconnect").hidden = true;
  connecting = false;
  notice("Grafo está desconectado.");
});
$("phone-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!context?.chat || context.chat.group) return;
  try {
    manualPhone = phoneInput($("phone").value);
    selectedClient = "";
    $("chat-phone").textContent = `${manualPhone} · Ingresado manualmente`;
    load();
  } catch (error) {
    notice(error.message, true);
  }
});
chrome.runtime.onMessage.addListener((message, sender) => {
  if (
    sender.id !== chrome.runtime.id ||
    message.type !== "grafo:context-invalidated" ||
    message.windowId !== windowId
  )
    return;
  // Ocultar de inmediato, antes de consultar cuál es el chat de la pestaña.
  clearResults();
  syncContext(true).catch(handleError);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.grafoOrigin || connecting) return;
  clearResults();
  origin = changes.grafoOrigin.newValue || "";
  selectedClient = "";
  lastCompany = null;
  $("origin").value = origin;
  syncContext(true).catch(handleError);
});
chrome.permissions.onRemoved.addListener(() => {
  clearResults();
  if (!connecting) syncContext(true).catch(handleError);
});
document.addEventListener("visibilitychange", () => {
  clearResults();
  syncVersion += 1;
  if (!document.hidden) syncContext(true).catch(handleError);
});
async function start() {
  windowId = (await chrome.windows.getCurrent()).id;
  const saved = await chrome.storage.local.get("grafoOrigin");
  try {
    origin = saved.grafoOrigin ? grafoOrigin(saved.grafoOrigin) : "";
  } catch {
    origin = "";
  }
  $("origin").value = origin || "http://localhost:3000";
  $("disconnect").hidden = !origin;
  await syncContext(true);
  // Revalidar sesión y empresa detecta logout, cambio de empresa o permisos.
  poll = setInterval(async () => {
    if (document.hidden || connecting || !origin) return;
    const version = sessionVersion;
    try {
      const session = await api("sesion");
      if (version !== sessionVersion) return;
      if (lastCompany && session.empresa.id !== lastCompany)
        selectedClient = "";
      await syncContext(true);
    } catch (error) {
      if (version === sessionVersion) handleError(error);
    }
  }, 30000);
}
window.addEventListener("pagehide", () => {
  clearInterval(poll);
  requests.invalidate();
});
start().catch(handleError);

installAutomaticosPanel();
