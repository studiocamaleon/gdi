"use client";

import * as React from "react";
import {
  consultarCambiosSistema,
  contarNotificacionesNoLeidas,
  listarNotificacionesInternas,
  marcarNotificacionLeida,
  marcarTodasLasNotificacionesLeidas,
  type CambioSistema,
  type NotificacionInterna,
} from "@/lib/notificaciones-internas-api";

type EstadoConexion = "conectando" | "en_vivo" | "respaldo";
type Listener = (cambio: CambioSistema) => void;

type ContextoNotificaciones = {
  notificaciones: NotificacionInterna[];
  noLeidas: number;
  estado: EstadoConexion;
  cargando: boolean;
  recargar: () => Promise<void>;
  leer: (id: string) => Promise<void>;
  leerTodas: () => Promise<void>;
  suscribir: (listener: Listener) => () => void;
};

const Context = React.createContext<ContextoNotificaciones | null>(null);

export function NotificacionesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notificaciones, setNotificaciones] = React.useState<
    NotificacionInterna[]
  >([]);
  const [noLeidas, setNoLeidas] = React.useState(0);
  const [estado, setEstado] = React.useState<EstadoConexion>("conectando");
  const [cargando, setCargando] = React.useState(true);
  const listeners = React.useRef(new Set<Listener>());
  const cursor = React.useRef<string | undefined>(undefined);

  const recargar = React.useCallback(async () => {
    const [items, conteo] = await Promise.all([
      listarNotificacionesInternas(),
      contarNotificacionesNoLeidas(),
    ]);
    setNotificaciones(items);
    setNoLeidas(conteo.cantidad);
    setCargando(false);
  }, []);

  const despachar = React.useCallback((cambio: CambioSistema) => {
    cursor.current = cambio.eventoId;
    for (const listener of listeners.current) listener(cambio);
    window.dispatchEvent(
      new CustomEvent("grafo:cambio-sistema", { detail: cambio }),
    );
  }, []);

  React.useEffect(() => {
    let activo = true;
    let fallback: number | undefined;
    void recargar().catch(() => setCargando(false));

    const iniciarFallback = () => {
      if (fallback) return;
      setEstado("respaldo");
      fallback = window.setInterval(async () => {
        if (document.hidden) return;
        try {
          const lote = await consultarCambiosSistema(cursor.current);
          cursor.current = lote.cursor;
          lote.cambios.forEach(despachar);
          await recargar();
        } catch {
          // Se conserva el último estado conocido y se reintenta.
        }
      }, 15000);
    };

    const detenerFallback = () => {
      if (fallback) window.clearInterval(fallback);
      fallback = undefined;
    };

    const source = new EventSource("/api/backend/eventos-sistema/stream");
    source.addEventListener("ready", (raw) => {
      if (!activo) return;
      const data = JSON.parse((raw as MessageEvent).data) as {
        noLeidas: number;
        ultimoId: string;
      };
      cursor.current = data.ultimoId;
      setNoLeidas(data.noLeidas);
      setEstado("en_vivo");
      detenerFallback();
    });
    source.addEventListener("cambio", (raw) => {
      if (!activo) return;
      const cambio = JSON.parse((raw as MessageEvent).data) as CambioSistema;
      setEstado("en_vivo");
      detenerFallback();
      despachar(cambio);
      void recargar();
    });
    source.onerror = iniciarFallback;

    return () => {
      activo = false;
      source.close();
      detenerFallback();
    };
  }, [despachar, recargar]);

  const leer = React.useCallback(async (id: string) => {
    await marcarNotificacionLeida(id);
    setNotificaciones((actuales) =>
      actuales.map((item) =>
        item.id === id && !item.leidaEl
          ? { ...item, leidaEl: new Date().toISOString() }
          : item,
      ),
    );
    setNoLeidas((valor) => Math.max(0, valor - 1));
  }, []);

  const leerTodas = React.useCallback(async () => {
    await marcarTodasLasNotificacionesLeidas();
    const ahora = new Date().toISOString();
    setNotificaciones((actuales) =>
      actuales.map((item) => ({ ...item, leidaEl: item.leidaEl ?? ahora })),
    );
    setNoLeidas(0);
  }, []);

  const suscribir = React.useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  return (
    <Context.Provider
      value={{
        notificaciones,
        noLeidas,
        estado,
        cargando,
        recargar,
        leer,
        leerTodas,
        suscribir,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useNotificaciones() {
  const value = React.useContext(Context);
  if (!value)
    throw new Error("useNotificaciones requiere NotificacionesProvider");
  return value;
}

export function useCambiosSistema(
  callback: Listener,
  deps: React.DependencyList = [],
) {
  const { suscribir } = useNotificaciones();
  // La identidad sólo cambia cuando cambian las dependencias elegidas por la pantalla.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const estable = React.useCallback(callback, deps);
  React.useEffect(() => suscribir(estable), [estable, suscribir]);
}
