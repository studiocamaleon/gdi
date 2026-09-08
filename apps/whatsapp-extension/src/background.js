import { installAutomaticos } from "./automaticos.js";
import { readWhatsAppActiveChat } from "./whatsapp-active-chat.js";

const isWhatsApp = (url) => {
  try {
    return new URL(url).origin === "https://web.whatsapp.com";
  } catch {
    return false;
  }
};
const notify = (tabId, windowId) =>
  chrome.runtime
    .sendMessage({ type: "grafo:context-invalidated", tabId, windowId })
    .catch(() => {});
async function configure(tabId, url) {
  await chrome.sidePanel.setOptions({
    tabId,
    path: "sidepanel.html",
    enabled: isWhatsApp(url),
  });
}
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url || change.status === "complete")
    configure(tabId, tab.url).catch(() => {});
  if (tab.active && (change.url || change.status === "loading"))
    notify(tabId, tab.windowId);
});
chrome.tabs.onActivated.addListener(({ tabId, windowId }) =>
  notify(tabId, windowId),
);
chrome.tabs.onRemoved.addListener((tabId, info) =>
  notify(tabId, info.windowId),
);
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => configure(tab.id, tab.url)));
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message.type === "grafo:read-active-chat") {
    if (
      sender.frameId !== 0 ||
      !isWhatsApp(sender.url) ||
      !sender.tab ||
      typeof sender.documentId !== "string" ||
      typeof message.requestId !== "string" ||
      !/^[a-zA-Z0-9:-]{1,100}$/.test(message.requestId)
    )
      return;
    // Chrome devuelve el resultado directamente al contexto de la extensión.
    // Fijar documentId impide leer otra página si hubo una navegación.
    chrome.scripting
      .executeScript({
        target: { tabId: sender.tab.id, documentIds: [sender.documentId] },
        world: "MAIN",
        func: readWhatsAppActiveChat,
      })
      .then(
        (results) =>
          respond({
            requestId: message.requestId,
            result: results[0]?.result || {
              status: "unavailable",
              reason: "injection",
            },
          }),
        () =>
          respond({
            requestId: message.requestId,
            result: { status: "unavailable", reason: "injection" },
          }),
      );
    return true;
  }
  if (
    message.type === "grafo:chat-changed" &&
    sender.frameId === 0 &&
    isWhatsApp(sender.url) &&
    sender.tab
  ) {
    if (sender.tab.active) notify(sender.tab.id, sender.tab.windowId);
    return;
  }
  if (sender.url !== chrome.runtime.getURL("sidepanel.html") || sender.tab)
    return;
  if (message.type !== "grafo:context" || !Number.isInteger(message.windowId))
    return;
  (async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      windowId: message.windowId,
    });
    if (!tab || !isWhatsApp(tab.url)) return { tabId: null, chat: null };
    try {
      const chat = await chrome.tabs.sendMessage(
        tab.id,
        { type: "grafo:read-chat" },
        { frameId: 0 },
      );
      return { tabId: tab.id, chat };
    } catch {
      return { tabId: tab.id, chat: null, reload: true };
    }
  })().then(respond, () => respond({ tabId: null, chat: null }));
  return true;
});

installAutomaticos();
