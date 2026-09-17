"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { useDesignScope } from "@/components/design-system/appearance";
import theme from "@/components/design-system/brand-theme.module.css";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import {
  getPanelGeneral,
  type PanelGeneralData,
} from "@/lib/panel-general-api";
import { PanelAdminView } from "./panel-admin-view";
import s from "./panel-admin-view.module.css";

const POLL_MS = 30_000;

function primeraPalabra(nombre: string) {
  return nombre.trim().split(/\s+/)[0] || "";
}

function fechaHumana(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(y, m - 1, d));
}

function haceCuanto(iso: string, ahora: number) {
  const segundos = Math.max(0, Math.floor((ahora - Date.parse(iso)) / 1000));
  if (segundos < 15) return "ahora";
  if (segundos < 60) return `hace ${segundos} s`;
  return `hace ${Math.floor(segundos / 60)} min`;
}

export function saludoSegunMomento(iso: string, zonaHoraria: string) {
  const hora = Number(
    new Intl.DateTimeFormat("es-AR", {
      timeZone: zonaHoraria,
      hour: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .find((parte) => parte.type === "hour")?.value,
  );

  if (!Number.isFinite(hora) || hora < 12) return "Buen día";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

/** Único Panel general. La API resuelve el alcance de datos y acciones. */
export function PanelGeneralView({
  initialData,
  nombreUsuario,
}: {
  initialData: PanelGeneralData | null;
  nombreUsuario: string;
}) {
  const router = useRouter();
  const scope = useDesignScope();
  const { zonaHoraria } = useConfigRegional();
  const [data, setData] = React.useState(initialData);
  const [cargando, setCargando] = React.useState(initialData == null);
  const [error, setError] = React.useState<string | null>(null);
  // El servidor y la primera renderización del cliente comparten el reloj.
  const [ahora, setAhora] = React.useState(() =>
    initialData ? Date.parse(initialData.generadoEl) : 0,
  );

  const ultimaConsulta = React.useRef(0);
  const refrescar = React.useCallback(async () => {
    const consulta = ++ultimaConsulta.current;
    setCargando(true);
    try {
      const siguiente = await getPanelGeneral();
      if (consulta !== ultimaConsulta.current) return;
      setData(siguiente);
      setError(null);
    } catch (e) {
      if (consulta !== ultimaConsulta.current) return;
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos actualizar la información del Panel.",
      );
    } finally {
      if (consulta === ultimaConsulta.current) {
        setCargando(false);
        setAhora(Date.now());
      }
    }
  }, []);

  React.useEffect(() => {
    const relojInicial = window.setTimeout(() => setAhora(Date.now()), 0);
    if (!initialData) void refrescar();
    const tick = window.setInterval(() => {
      setAhora(Date.now());
      if (document.visibilityState === "visible") void refrescar();
    }, POLL_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") void refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearTimeout(relojInicial);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [initialData, refrescar]);

  if (!data) {
    return (
      <div {...scope} className={`${theme.theme} ${s.page}`}>
        <header className={s.head}>
          <div>
            <h1>
              Panel general<span className={s.period}>.</span>
            </h1>
            <p className={s.sub}>Tu industria gráfica, en movimiento.</p>
          </div>
        </header>
        {error ? (
          <p className={s.error} role="alert">
            No pudimos cargar el panel. Volveremos a intentarlo automáticamente.
          </p>
        ) : (
          <div className={s.loading} role="status">
            <GdiSpinner /> Cargando Panel general…
          </div>
        )}
      </div>
    );
  }

  return (
    <PanelAdminView
      data={data}
      nombre={primeraPalabra(nombreUsuario)}
      fecha={fechaHumana(data.fechaLocal)}
      saludo={saludoSegunMomento(data.generadoEl, zonaHoraria)}
      actualizado={haceCuanto(data.generadoEl, ahora)}
      ahora={ahora}
      cargando={cargando}
      error={error}
      abrir={router.push}
    />
  );
}
