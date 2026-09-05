(() => {
  const { readHeader, clean, phoneFromText } = globalThis.GrafoWhatsAppDOM;
  const session = crypto.randomUUID();
  let revision = 0,
    previous = null,
    current = null,
    timer,
    suspendedUntil = 0;
  let pending = null,
    sample = null,
    chatId = null,
    startedAt = 0,
    activeUntil = 0;
  const key = () => `${session}:${revision}`;
  const notify = () =>
    chrome.runtime.sendMessage({ type: "grafo:chat-changed" }).catch(() => {});
  function invalidate() {
    revision += 1;
    previous = null;
    current = null;
    pending = null;
    sample = null;
    chatId = null;
    notify();
  }
  function update(values) {
    if (!current) return;
    const next = { ...current, ...values };
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    current = next;
    notify();
  }
  function requestPhone() {
    if (!current || document.hidden || Date.now() > activeUntil) return;
    if (pending && Date.now() - pending.sentAt < 1000) return;
    if (pending)
      update({ diagnostic: "Sin respuesta del lector de WhatsApp." });
    pending = {
      requestId: crypto.randomUUID(),
      key: key(),
      sentAt: Date.now(),
    };
    const requestId = pending.requestId;
    chrome.runtime
      .sendMessage({ type: "grafo:read-active-chat", requestId })
      .then(receivePhone, () =>
        receivePhone({
          requestId,
          result: { status: "unavailable", reason: "transport" },
        }),
      );
  }
  function scan() {
    if (Date.now() < suspendedUntil) return null;
    const header = readHeader(document);
    if (!header) {
      if (current) invalidate();
      return null;
    }
    if (
      !previous ||
      previous.name !== header.name ||
      previous.title !== header.title ||
      previous.group !== header.group ||
      previous.avatar !== header.avatar ||
      previous.selected !== header.selected
    ) {
      revision += 1;
      pending = null;
      sample = null;
      chatId = null;
      startedAt = Date.now();
      current = {
        key: key(),
        name: header.name,
        phone: null,
        group: header.group,
        detection: header.group ? "resolved" : "detecting",
        diagnostic: "Esperando al lector de WhatsApp.",
      };
      notify();
    }
    previous = header;
    if (!current.phone && !current.group && Date.now() - startedAt > 8000)
      update({ detection: "unavailable" });
    return current;
  }
  function receivePhone(message) {
    if (!message) return;
    if (
      !pending ||
      pending.requestId !== message.requestId ||
      pending.key !== key()
    )
      return;
    const expectedKey = pending.key;
    pending = null;
    if (!scan() || expectedKey !== key()) return;
    const result = message.result;
    if (result?.status !== "ready") {
      const reasons = {
        loader: "WhatsApp no expone su cargador de módulos.",
        module: "El módulo de chats todavía no está disponible.",
        collection: "La colección de chats usa una interfaz diferente.",
        identity: "El chat activo usa un identificador no reconocido.",
        adapter: "El lector encontró una incompatibilidad con WhatsApp.",
        injection: "Chrome no pudo ejecutar el lector. Recargá WhatsApp Web.",
        transport:
          "La conexión con la extensión se interrumpió. Recargá WhatsApp Web.",
        origin: "La pestaña ya no está en WhatsApp Web.",
      };
      update({
        diagnostic:
          reasons[result?.reason] ||
          "Esperando que WhatsApp termine de cargar.",
      });
      return;
    }
    const active = result.chat;
    if (!active) {
      update({
        diagnostic: "WhatsApp no informa un chat activo en su colección.",
      });
      sample = null;
      if (chatId) {
        chatId = null;
        revision += 1;
        update({ key: key(), phone: null, detection: "detecting" });
      }
      return;
    }
    if (
      typeof active.id !== "string" ||
      !/^[\d-]+@(c\.us|s\.whatsapp\.net|lid|g\.us|newsletter|broadcast)$/.test(
        active.id,
      )
    )
      return;
    // Esperar a que el modelo y el encabezado terminen de cambiar de chat.
    if (active.name && clean(active.name) !== previous.name) {
      update({
        diagnostic:
          "El título del chat y el del encabezado no coinciden todavía.",
      });
      return;
    }
    const group = !/@(?:c\.us|s\.whatsapp\.net|lid)$/.test(active.id);
    const number = group ? null : phoneFromText(active.phone) || previous.phone;
    const signature = JSON.stringify([active.id, number, group]);
    if (sample?.signature !== signature) {
      sample = { signature, at: Date.now() };
      update({ diagnostic: "Confirmando el cambio de chat." });
      if (
        chatId &&
        (chatId !== active.id ||
          number !== current.phone ||
          group !== current.group)
      ) {
        revision += 1;
        chatId = null;
        startedAt = Date.now();
        update({ key: key(), phone: null, group, detection: "detecting" });
      }
      return;
    }
    if (Date.now() - sample.at < 150) return;
    chatId = active.id;
    update({
      phone: number,
      group,
      diagnostic: number
        ? "Teléfono detectado automáticamente."
        : group
          ? "Conversación grupal."
          : "Chat detectado; falta la equivalencia entre su identificador y el teléfono.",
      detection:
        number || group
          ? "resolved"
          : Date.now() - startedAt > 8000
            ? "unavailable"
            : "detecting",
    });
  }
  function changingChat() {
    suspendedUntil = Date.now() + 250;
    invalidate();
    setTimeout(() => {
      scan();
      requestPhone();
    }, 300);
  }
  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target.closest?.(
          '#pane-side [role="row"], #side [role="row"], #side [role="listitem"]',
        )
      )
        changingChat();
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        ["Enter", "ArrowUp", "ArrowDown"].includes(event.key) &&
        event.target.closest?.("#pane-side, #side")
      )
        changingChat();
    },
    true,
  );
  window.addEventListener("popstate", changingChat);
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      scan();
      requestPhone();
    }, 150);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["title", "src", "aria-selected", "data-testid"],
  });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message.type !== "grafo:read-chat")
      return;
    activeUntil = Date.now() + 35000;
    respond(scan());
    requestPhone();
  });
  // Sólo consulta mientras el panel pide contexto y la pestaña está visible.
  const polling = setInterval(() => {
    if (document.hidden || Date.now() > activeUntil) return;
    scan();
    requestPhone();
  }, 500);
  window.addEventListener("pagehide", () => {
    clearInterval(polling);
    observer.disconnect();
  });
  scan();
})();
