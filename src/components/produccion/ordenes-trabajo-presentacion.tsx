"use client";

import { Chip } from "@heroui/react";
import {
  ORDEN_TRABAJO_ESTADOS,
  type OrdenTrabajoEstado,
} from "@/lib/ordenes-trabajo";
import type { ProgresoProduccion } from "@/lib/progreso-produccion";
import { ProgresoValor } from "./progreso-produccion";
import s from "./ordenes-trabajo-view.module.css";

/** Presentación del listado. No altera el badge que aún usan las fichas heredadas. */
export function EstadoListado({ estado }: { estado: OrdenTrabajoEstado }) {
  return (
    <Chip size="sm" variant="soft" className={s.state} data-estado={estado}>
      <span className={s.stateDot} aria-hidden />
      {ORDEN_TRABAJO_ESTADOS[estado].label}
    </Chip>
  );
}

export function ProgresoListado({
  valor,
  estado,
  progreso,
}: {
  valor: number | null;
  estado: OrdenTrabajoEstado;
  progreso?: ProgresoProduccion;
}) {
  if (valor === null)
    return <ProgresoValor progreso={progreso} valor={valor} />;
  return (
    <span className={s.progress} data-estado={estado}>
      <span className={s.progressTrack} aria-hidden>
        <span style={{ width: `${valor}%` }} />
      </span>
      <span className={s.progressValue}>
        <ProgresoValor progreso={progreso} valor={valor} />
      </span>
    </span>
  );
}
