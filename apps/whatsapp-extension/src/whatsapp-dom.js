/* Adaptador aislado: sólo encabezado del chat.
 * También se importa desde Node para verificarlo con DOM de prueba. */
(() => {
  const clean = (value) =>
    String(value || "")
      .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
      .trim();
  function phoneFromText(value) {
    const text = clean(value);
    if (!/^\+[\d\s().-]+$/.test(text)) return null;
    const digits = text.replace(/\D/g, "");
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  const visible = (element) =>
    element &&
    element.getClientRects().length > 0 &&
    element.getAttribute("aria-hidden") !== "true";
  function readHeader(doc) {
    const header = doc.querySelector("#main header");
    if (!visible(header)) return null;
    const identity = header.querySelector(
      '[data-testid="conversation-info-header"]',
    );
    const title =
      header.querySelector(
        '[data-testid="conversation-info-header-chat-title"]',
      ) || identity?.querySelector("span[title]");
    if (!visible(title)) return null;
    const name = clean(title.innerText || title.getAttribute("title")).slice(
      0,
      160,
    );
    if (!name) return null;
    const group =
      !!header.querySelector(
        '[data-icon="default-group"], [data-testid="conversation-info-header-group-subtitle"], [aria-label="Información del grupo"], [aria-label="Info. del grupo"], [aria-label="Group info"]',
      ) ||
      /(?:info.*grupo|group info)/i.test(
        identity?.getAttribute("aria-label") || "",
      );
    const avatar =
      header.querySelector("img")?.getAttribute("src")?.split("?")[0] || "";
    const selected = doc.querySelector(
      '#pane-side [role="row"][aria-selected="true"], #side [role="row"][aria-selected="true"]',
    );
    return {
      header,
      identity,
      title,
      name,
      group,
      avatar,
      selected,
      phone: group ? null : phoneFromText(name),
    };
  }
  globalThis.GrafoWhatsAppDOM = Object.freeze({
    clean,
    phoneFromText,
    readHeader,
  });
})();
