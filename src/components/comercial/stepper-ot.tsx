"use client";

/**
 * Stepper compacto del estado de la OT, para el header del detalle. Reemplaza
 * al grande para ganar alto en pantallas chicas. Al pasar el mouse por un
 * estado ya alcanzado muestra la fecha en que la orden llegó a ese estado
 * (`fechasEstado`, que calcula el backend desde el timeline de eventos).
 */

import * as React from "react";

import {
  ORDEN_TRABAJO_ESTADOS,
  ORDEN_TRABAJO_FLOW,
  type OrdenTrabajoEstado,
} from "@/lib/ordenes-trabajo";
import { fechaHoraCorta } from "@/lib/fecha";
import s from "./stepper-ot.module.css";

export function StepperOt({
  estado,
  fechasEstado,
}: {
  estado: OrdenTrabajoEstado;
  /** Fecha (ISO) por estado alcanzado. Los futuros no están. */
  fechasEstado?: Partial<Record<OrdenTrabajoEstado, string>>;
}) {
  const curIdx = ORDEN_TRABAJO_FLOW.indexOf(estado);
  const ultimo = ORDEN_TRABAJO_FLOW.length - 1;

  return (
    <div className={s.flow}>
      {ORDEN_TRABAJO_FLOW.map((k, i) => {
        const e = ORDEN_TRABAJO_ESTADOS[k];
        const st = i < curIdx ? "past" : i === curIdx ? "cur" : "future";
        const fecha = fechasEstado?.[k] ?? null;
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
                <span
                  className={`${s.tip}${i >= ultimo - 1 ? ` ${s.tipEnd}` : ""}`}
                  role="tooltip"
                >
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
