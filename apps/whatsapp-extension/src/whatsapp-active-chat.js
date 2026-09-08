/* MAIN: sólo consulta identidad y teléfono del chat activo.
 * No serializa modelos, lee mensajes ni realiza consultas de red.
 * Contratos de compatibilidad documentados en README.md. */
export function readWhatsAppActiveChat() {
  if (window.location.origin !== "https://web.whatsapp.com")
    return { status: "unavailable", reason: "origin" };
  function wid(value) {
    if (!value) return null;
    const serialized = typeof value === "string" ? value : value._serialized;
    if (typeof serialized === "string") {
      const match =
        /^([\d-]+)(?::\d+)?@(c\.us|s\.whatsapp\.net|lid|g\.us|newsletter|broadcast)$/.exec(
          serialized,
        );
      if (match)
        return {
          id: `${match[1]}@${match[2]}`,
          user: match[1],
          server: match[2],
        };
    }
    if (typeof value.user === "string" && typeof value.server === "string")
      return wid(`${value.user}@${value.server}`);
    return null;
  }
  function phone(value) {
    const id = wid(value);
    if (!id || !["c.us", "s.whatsapp.net"].includes(id.server)) return null;
    return /^[1-9]\d{7,14}$/.test(id.user) ? `+${id.user}` : null;
  }
  function readActive() {
    if (typeof window.require !== "function")
      return { status: "unavailable", reason: "loader" };
    let module;
    try {
      module = window.require("WAWebChatCollection");
    } catch {
      return { status: "unavailable", reason: "module" };
    }
    const chats = module?.ChatCollection || module?.default;
    if (typeof chats?.findFirst !== "function")
      return { status: "unavailable", reason: "collection" };
    const chat = chats.findFirst((candidate) => Boolean(candidate.active));
    if (!chat) return { status: "ready", chat: null };
    const id = wid(chat.id);
    if (!id) return { status: "unavailable", reason: "identity" };
    const group = !["c.us", "s.whatsapp.net", "lid"].includes(id.server);
    let number = group ? null : phone(chat.id);
    if (!group && !number && id.server === "lid") {
      // Los dígitos de un LID NO son un teléfono. Sólo usamos su equivalencia.
      try {
        const cache = window.require("WAWebApiContact")?.lidPnCache;
        number = phone(cache?.getPhoneNumber(chat.id));
      } catch {
        /* Puede no estar cargado todavía; se reintenta automáticamente. */
      }
      if (!number)
        number = phone(chat.contact?.id) || phone(chat.contact?.pnForLid);
    }
    const name =
      typeof chat.formattedTitle === "string"
        ? chat.formattedTitle
        : typeof chat.name === "string"
          ? chat.name
          : "";
    return {
      status: "ready",
      chat: { id: id.id, name: name.slice(0, 160), phone: number, group },
    };
  }
  try {
    return readActive();
  } catch {
    return { status: "unavailable", reason: "adapter" };
  }
}
