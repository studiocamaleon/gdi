import type { InboxIdentidad } from "./meta-inbox-api";

export type EstadoInboxVivo =
  | "conectando"
  | "en_vivo"
  | "reconectando"
  | "sin_conexion"
  | "pausado";
export type EscucharInbox = (opciones: {
  identidad: Pick<InboxIdentidad, "empresaId" | "usuarioId">;
  actualizar: (signal: AbortSignal) => Promise<boolean>;
  estado: (estado: EstadoInboxVivo) => void;
  accesoCerrado: () => void;
}) => () => void;

/** SSE sólo invalida una lectura: nunca guarda mensajes ni credenciales.
 * ready fuerza un snapshot, incluso tras perder avisos o reiniciar el API. */
export const escucharInbox: EscucharInbox = ({
  identidad,
  actualizar,
  estado,
  accesoCerrado,
}) => {
  let fuente: EventSource | null = null;
  let cerrado = false,
    ocupado = false,
    pendiente = false,
    listo = false,
    lecturaOk = false;
  let intento = 0,
    ultimoLatido = Date.now();
  let reagendar: ReturnType<typeof setTimeout> | undefined;
  let agrupar: ReturnType<typeof setTimeout> | undefined;
  const control = new AbortController();
  const visible = () =>
    document.visibilityState !== "hidden" && navigator.onLine !== false;
  const desconectar = () => {
    fuente?.close();
    fuente = null;
    listo = false;
  };
  const recargar = async () => {
    if (cerrado || !visible()) return;
    if (ocupado) {
      pendiente = true;
      return;
    }
    ocupado = true;
    try {
      const ok = await actualizar(control.signal);
      lecturaOk = ok;
      if (!cerrado && visible())
        estado(ok && listo ? "en_vivo" : "reconectando");
    } catch {
      lecturaOk = false;
      if (!cerrado) estado("reconectando");
    } finally {
      ocupado = false;
      if (pendiente && !cerrado) {
        pendiente = false;
        solicitar();
      }
    }
  };
  const solicitar = () => {
    if (cerrado || agrupar) return;
    agrupar = setTimeout(() => {
      agrupar = undefined;
      void recargar();
    }, 250);
  };
  const denegar = () => {
    terminar();
    accesoCerrado();
  };
  const validar = (event: MessageEvent): boolean => {
    try {
      const data = JSON.parse(event.data);
      if (
        data.empresaId !== identidad.empresaId ||
        data.usuarioId !== identidad.usuarioId
      ) {
        denegar();
        return false;
      }
      if (!/^\d+$/.test(data.revision)) return false;
      ultimoLatido = Date.now();
      return true;
    } catch {
      return false;
    }
  };
  const reconectar = () => {
    desconectar();
    if (cerrado || !visible()) return;
    estado("reconectando");
    solicitar();
    clearTimeout(reagendar);
    reagendar = setTimeout(
      conectar,
      Math.min(15000, 1000 * 2 ** Math.min(intento++, 4)),
    );
  };
  const conectar = () => {
    clearTimeout(reagendar);
    if (cerrado || !visible()) return;
    desconectar();
    ultimoLatido = Date.now();
    if (typeof EventSource === "undefined") {
      estado("reconectando");
      return;
    }
    const stream = new EventSource(
      "/api/backend/integraciones/meta/inbox/stream",
    );
    fuente = stream;
    const vigente = () => !cerrado && fuente === stream;
    stream.addEventListener("ready", (event) => {
      if (!vigente() || !validar(event as MessageEvent)) return;
      listo = true;
      intento = 0;
      solicitar();
    });
    stream.addEventListener("cambio", (event) => {
      if (vigente() && validar(event as MessageEvent)) solicitar();
    });
    stream.addEventListener("heartbeat", (event) => {
      if (vigente()) validar(event as MessageEvent);
    });
    stream.addEventListener("acceso_cerrado", () => {
      if (vigente()) denegar();
    });
    stream.addEventListener("reintentar", () => {
      if (vigente()) reconectar();
    });
    stream.onerror = () => {
      if (vigente()) reconectar();
    };
  };
  const volver = () => {
    if (cerrado) return;
    if (!visible()) {
      desconectar();
      clearTimeout(reagendar);
      estado(navigator.onLine === false ? "sin_conexion" : "pausado");
      return;
    }
    solicitar();
    if (!fuente) {
      estado("conectando");
      conectar();
    }
  };
  const respaldo = setInterval(() => {
    if (cerrado || !visible()) return;
    if (fuente && Date.now() - ultimoLatido > 45000) reconectar();
    else if (!listo || !lecturaOk) solicitar();
  }, 15000);
  function terminar() {
    cerrado = true;
    control.abort();
    desconectar();
    clearInterval(respaldo);
    clearTimeout(reagendar);
    clearTimeout(agrupar);
    window.removeEventListener("online", volver);
    window.removeEventListener("offline", volver);
    window.removeEventListener("focus", volver);
    document.removeEventListener("visibilitychange", volver);
  }
  window.addEventListener("online", volver);
  window.addEventListener("offline", volver);
  window.addEventListener("focus", volver);
  document.addEventListener("visibilitychange", volver);
  estado("conectando");
  volver();
  return terminar;
};
