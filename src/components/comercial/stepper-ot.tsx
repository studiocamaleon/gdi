"use client";

/**
 * Stepper compacto del estado de la OT, para el header del detalle. Reemplaza
 * al grande para ganar alto en pantallas chicas. Al pasar el mouse por un
 * estado ya alcanzado muestra la fecha en que la orden llegó a ese estado
 * (sale del timeline de eventos).
 */

import * as React from "react";

import {
  ORDEN_TRABAJO_ESTADOS,
  ORDEN_TRABAJO_FLOW,
  type OrdenTrabajoEstado,
  type OrdenTrabajoEvento,
} from "@/lib/ordenes-trabajo";
import { fechaHoraCorta } from "@/lib/fecha";
import s from "./stepper-ot.module.css";

/** Fecha en que la orden ALCANZÓ un estado, desde el timeline. `null` si no. */
function fechaDeEstado(
  estado: OrdenTrabajoEstado,
  eventos: OrdenTrabajoEvento[],
): string | null {
  if (estado === "borrador") {
    return eventos.find((e) => e.tipo === "borrador")?.fecha ?? null;
  }
  // La emisión es la que deja la orden en "pendiente".
  if (estado === "pendiente") {
    const emision = eventos.find((e) => e.tipo === "emision");
    if (emision) return emision.fecha;
  }
  // El resto salen de los cambios de estado (`estado` con `despues` = destino).
  const cambio = eventos.find((e) => {
    if (e.tipo !== "estado") return false;
    const datos = e.datosJson as { despues?: unknown } | null;
    return datos?.despues === estado;
  });
  return cambio?.fecha ?? null;
}

export function StepperOt({
  estado,
  eventos,
}: {
  estado: OrdenTrabajoEstado;
  eventos: OrdenTrabajoEvento[];
}) {
  const curIdx = ORDEN_TRABAJO_FLOW.indexOf(estado);

  return (
    <div className={s.flow}>
      {ORDEN_TRABAJO_FLOW.map((k, i) => {
        const e = ORDEN_TRABAJO_ESTADOS[k];
        const st = i < curIdx ? "past" : i === curIdx ? "cur" : "future";
        const fecha = st === "future" ? null : fechaDeEstado(k, eventos);
        return (
          <React.Fragment key={k}>
            <div
              className={`${s.stage} ${st === "cur" ? s.cur : st === "past" ? s.past : s.future}`}
            >
              <span
                className={s.dot}
                style={st !== "future" ? { background: e.dot } : undefined}
              />
              <span
                className={s.lbl}
                style={st === "cur" ? { color: e.fg } : undefined}
              >
                {e.label}
              </span>
              {fecha ? (
                <span className={s.tip} role="tooltip">
                  {e.label} · {fechaHoraCorta(fecha)}
                </span>
              ) : null}
            </div>
            {i < ORDEN_TRABAJO_FLOW.length - 1 ? (
              <span className={`${s.line} ${i < curIdx ? s.on : ""}`} />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}
