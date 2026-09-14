import type { TableroPasoAccion, TableroPasoData } from "./tablero-produccion";
import { tiempoMedidoValido } from "../../apps/api/src/ordenes-trabajo/ordenes-trabajo.types";

export type PasoControlProduccion = Pick<
  TableroPasoData,
  | "id"
  | "nombre"
  | "estado"
  | "tipoEjecucion"
  | "modoRegistro"
  | "duracionEstimadaMin"
  | "tiempoAcumuladoMin"
  | "tramoAbierto"
> & {
  gatesOperativos?: Array<{ estado: string }>;
};
export type OpcionesAccionProduccion = {
  motivo?: string;
  motivoDetalle?: string;
  tiempoDeclaradoMin?: number;
  sinTiempoConfirmado?: boolean;
};
export type ControlAccionesProduccion = {
  paso: PasoControlProduccion;
  esActual: boolean;
  canManage: boolean;
  canSupervise: boolean;
  reabrible?: boolean;
};

/** Una sola política de controles para Kanban y Colas. El servidor revalida al guardar. */
export function accionesDisponiblesProduccion({
  paso,
  esActual,
  canManage,
  canSupervise,
  reabrible,
}: ControlAccionesProduccion): TableroPasoAccion[] {
  if (!canManage || paso.tipoEjecucion === "tercerizado") return [];
  if (
    paso.estado === "pendiente" &&
    (paso.gatesOperativos ?? []).some((g) => g.estado !== "CUMPLIDO")
  )
    return [];
  if (paso.estado === "hecho")
    return canSupervise && reabrible ? ["reabrir"] : [];
  if (paso.estado === "bloqueado") return canSupervise ? ["desbloquear"] : [];
  if (paso.estado === "pendiente" && !esActual) return [];
  const acciones: TableroPasoAccion[] = [];
  if (paso.modoRegistro === "cronometro") {
    if (paso.estado === "pendiente") acciones.push("iniciar");
    if (paso.estado === "en_curso") acciones.push("pausar");
    if (paso.estado === "pausado") acciones.push("continuar");
  }
  return [...acciones, "completar", "bloquear"];
}

/** Mismo umbral que el comando canónico; nunca se interpreta ausencia de datos como tiempo válido. */
export function completarSeriaInstantaneo(
  paso: PasoControlProduccion,
  ahora = Date.now(),
): boolean {
  if (
    paso.modoRegistro !== "cronometro" ||
    !["pendiente", "en_curso", "pausado"].includes(paso.estado)
  )
    return false;
  const abierto = paso.tramoAbierto
    ? (ahora - new Date(paso.tramoAbierto.inicioEl).getTime()) / 60_000
    : 0;
  return !tiempoMedidoValido(
    paso.tiempoAcumuladoMin + abierto,
    paso.duracionEstimadaMin,
  );
}
export function chipsDeclarar(estimado: number | null): number[] {
  if (estimado == null || estimado <= 0) return [];
  return [
    ...new Set(
      [estimado / 2, estimado, estimado * 2].map((n) =>
        Math.max(1, Math.round(n)),
      ),
    ),
  ];
}

/** La elegibilidad de estación y los permisos se comprueban por separado. */
export function asignacionPermiteEjecutar(paso: Pick<TableroPasoData, "mesaEsMia" | "tramoAbierto" | "asignacionPersonal">) {
  return paso.mesaEsMia || !!paso.tramoAbierto?.esMio || !!(paso.asignacionPersonal?.esMia && !paso.asignacionPersonal.conflicto);
}
