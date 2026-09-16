"use client";

import { Factory, RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { useDesignScope, useDesignTheme } from "@/components/design-system/appearance";
import { estadoMonitorProduccion } from "@/lib/sincronizacion-tablero";
import { useRelojProduccion } from "./use-reloj-produccion";
import s from "./tablero-monitor.module.css";

export function TableroMonitor({ zona, actualizadoEl, conexion, error, refreshing, onRefresh }: {
  zona: string;
  actualizadoEl: Date | null;
  conexion: "conectando" | "en_vivo" | "respaldo";
  error: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const scope = useDesignScope();
  const designTheme = useDesignTheme();
  const ahora = useRelojProduccion(1000, actualizadoEl?.getTime() ?? null);
  const estado = estadoMonitorProduccion(conexion, actualizadoEl?.getTime() ?? null, ahora, error);
  const fecha = ahora == null ? null : new Date(ahora);
  const formatoHora: Intl.DateTimeFormatOptions = { timeZone: zona, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" };
  return (
    <header {...scope} className={`${designTheme} ${s.header}`}>
      <div className={s.identity}>
        <span className={s.icon}><Factory aria-hidden="true" /></span>
        <div>
          <div className={s.eyebrow}>
            <span>Control de producción</span>
            <span className={s.connection} data-tone={estado.tono} role="status">
              <span className={s.signal} aria-hidden="true" />{estado.etiqueta}
            </span>
          </div>
          <h1>Tablero de producción<span className={s.titleDot} aria-hidden="true">.</span></h1>
          <p>Trabajos, personal y tiempos del taller.</p>
        </div>
      </div>
      <div className={s.telemetry}>
        <div className={s.clock}>
          <span className={s.clockLabel}>Hora del taller</span>
          <time dateTime={fecha?.toISOString()} aria-label="Hora actual del taller" aria-live="off">
            {fecha?.toLocaleTimeString("es-AR", formatoHora) ?? "—:—:—"}
          </time>
          <span className={s.date}>{fecha?.toLocaleDateString("es-AR", { timeZone: zona, weekday: "short", day: "2-digit", month: "short", year: "numeric" }) ?? "Cargando reloj"}</span>
        </div>
        <div className={s.sync}>
          <ActionButton variant="outline" isPending={refreshing} onPress={onRefresh}>
            <RefreshCw aria-hidden="true" />{refreshing ? "Actualizando" : "Actualizar"}
          </ActionButton>
          <span title="Última lectura correcta de los datos del taller">
            {actualizadoEl ? `Sincronizado ${actualizadoEl.toLocaleTimeString("es-AR", formatoHora)}` : "Sin sincronizar"}
          </span>
        </div>
      </div>
    </header>
  );
}
