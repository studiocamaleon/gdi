// Funciones autocontenidas: Chrome las serializa y ejecuta en MAIN.
export async function readWhatsAppSender(wait = false) {
  if (window.location.origin !== "https://web.whatsapp.com")
    return { estado: "cerrado" };
  const wpp = window.WPP;
  if (!wpp) return { estado: "sin_lector" };
  if (wpp.version !== "4.6.0") return { estado: "incompatible" };
  if (wait)
    for (let i = 0; i < 30 && !wpp.isReady; i++)
      await new Promise((resolve) => setTimeout(resolve, 250));
  if (!wpp.isReady || !wpp.conn.isAuthenticated())
    return { estado: "desconectado" };
  const me = wpp.conn.getMyUserId();
  const serialized =
    typeof me === "string" ? me : me?._serialized || me?.toString();
  const match = /^([1-9]\d{7,14})(?::\d+)?@(c\.us|s\.whatsapp\.net)$/.exec(
    serialized || "",
  );
  return match
    ? { estado: "listo", numero: match[1] }
    : { estado: "sin_numero" };
}

export async function sendWhatsAppOrder(job) {
  const no = (motivo) => ({ estado: "no_enviada", motivo });
  if (window.location.origin !== "https://web.whatsapp.com")
    return no("WhatsApp se cerró.");
  if (
    !job ||
    !/^[a-f0-9-]{36}$/i.test(job.id) ||
    !/^[1-9]\d{7,14}$/.test(job.telefono) ||
    typeof job.texto !== "string" ||
    !job.texto.trim() ||
    job.texto.length > 8192
  )
    return no("El aviso no tiene destinatario o texto válido.");
  const wpp = window.WPP;
  if (wpp?.version !== "4.6.0" || !wpp.isReady || !wpp.conn.isAuthenticated())
    return no("WhatsApp todavía no está conectado.");
  const me = wpp.conn.getMyUserId();
  const match = /^([1-9]\d{7,14})(?::\d+)?@(c\.us|s\.whatsapp\.net)$/.exec(
    me?._serialized || me?.toString() || "",
  );
  if (!match || match[1] !== job.numeroEmisor)
    return no("La cuenta de WhatsApp cambió.");
  // La cola del servidor es el candado durable. Esta memoria además evita
  // repetir una inyección en el mismo documento durante un reinicio del worker.
  const attempts = (window.__grafoOrderAttempts ||= new Map());
  if (attempts.has(job.id)) return attempts.get(job.id);
  let timer;
  const task = Promise.race([
    Promise.resolve()
      .then(async () => {
        const result = await wpp.chat.sendTextMessage(
          `${job.telefono}@c.us`,
          job.texto,
          {
            waitForAck: true,
            createChat: true,
            markIsRead: false,
            detectMentioned: false,
            linkPreview: false,
            // WA-JS genera la MsgKey con la identidad real del chat (PN o LID).
            // El UUID de la cola no es una MsgKey válida de WhatsApp.
          },
        );
        return result?.id && result.ack >= 1
          ? { estado: "enviada", mensajeId: result.id }
          : {
              estado: "incierta",
              motivo: "WhatsApp no confirmó la recepción del mensaje.",
            };
      })
      .catch((error) => {
        const code = String(error?.code || error?.name || "Error")
          .replace(/[^a-zA-Z0-9_-]/g, "")
          .slice(0, 80);
        return {
          estado: "incierta",
          motivo: `El envío se interrumpió (${code}); revisá el chat antes de volver a intentarlo.`,
        };
      }),
    new Promise((resolve) => {
      timer = setTimeout(
        () =>
          resolve({
            estado: "incierta",
            motivo: "WhatsApp no confirmó el envío a tiempo.",
          }),
        45000,
      );
    }),
  ]).finally(() => clearTimeout(timer));
  attempts.set(job.id, task);
  return task;
}
