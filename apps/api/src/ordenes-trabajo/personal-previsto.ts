import { BadRequestException } from '@nestjs/common';
import type { Estacion } from '../eta/motor/estaciones-tipos';
import {
  resolverEstacionDePaso,
  type TableroPasoData,
} from '../eta/motor/tablero-tipos';
import {
  aplicarOperacionMaquina,
  leerDemandaHumana,
} from '../eta/motor/demanda-humana';
import type { AsignacionManualPersonal } from '../produccion/asignacion-manual';
import { leerAsignacionManual } from '../produccion/asignacion-manual';

import type {
  EleccionPersonal,
  PasoPersonalPrevisto,
} from './personal-previsto.contrato';
export type PersonalPrevisto = {
  version: 1;
  cotizacionItemId: string;
  pasos: Array<{ nodoClave: string; asignacion: AsignacionManualPersonal }>;
};

export function leerPersonalPrevisto(value: unknown): PersonalPrevisto | null {
  const v = value as PersonalPrevisto | null;
  if (
    !v ||
    v.version !== 1 ||
    typeof v.cotizacionItemId !== 'string' ||
    !Array.isArray(v.pasos)
  )
    return null;
  if (
    v.pasos.some(
      (p) =>
        !p ||
        typeof p.nodoClave !== 'string' ||
        !leerAsignacionManual(p.asignacion),
    )
  )
    return null;
  if (new Set(v.pasos.map((p) => p.nodoClave)).size !== v.pasos.length)
    return null;
  return v;
}

export function eleccionesDePersonal(value: unknown): EleccionPersonal[] {
  return (
    leerPersonalPrevisto(value)?.pasos.map((p) => ({
      nodoClave: p.nodoClave,
      empleadoIds: p.asignacion.empleadoIds,
    })) ?? []
  );
}

export function eleccionesCanonicas(value: EleccionPersonal[]) {
  return JSON.stringify(
    value
      .map((p) => ({
        nodoClave: p.nodoClave,
        empleadoIds: [...p.empleadoIds].sort(),
      }))
      .sort((a, b) => a.nodoClave.localeCompare(b.nodoClave)),
  );
}

export function contextoPersonalDePasos(
  pasos: TableroPasoData[],
  estaciones: Estacion[],
  preparacionMin: number,
  nombres: Map<string, string>,
  maquinas: Map<string, string>,
): PasoPersonalPrevisto[] {
  return pasos.map((paso) => {
    const estacion = resolverEstacionDePaso(estaciones, paso);
    const demanda = aplicarOperacionMaquina(
      leerDemandaHumana(paso.demandaHumana, paso.duracionEstimadaMin ?? 0),
      estacion?.maquinas.find((m) => m.id === paso.maquinaId)
        ?.operacionMaquina ?? null,
    );
    const personasNecesarias = Math.max(
      0,
      ...(demanda
        ? demanda.fases.filter((f) => f.minutos > 0).map((f) => f.personas)
        : [paso.duracionEstimadaMin ? 1 : 0]),
      (estacion?.tiempoPreparacionMin ?? preparacionMin) > 0 ? 1 : 0,
    );
    const motivo =
      paso.tipoEjecucion !== 'interno'
        ? 'Se realiza con un proveedor.'
        : !estacion?.activo || !estacion.planificacionPorEmpleados
          ? 'Configurá el personal de esta estación.'
          : paso.duracionEstimadaMin == null
            ? 'Falta la duración del paso.'
            : !personasNecesarias
              ? 'Este paso no requiere atención de personal.'
              : null;
    return {
      nodoClave: paso.nodoClave!,
      nombre: paso.nombre,
      estacion: estacion?.nombre ?? 'Sin estación',
      maquina: paso.maquinaId
        ? (maquinas.get(paso.maquinaId) ?? 'Máquina del trabajo')
        : null,
      personasNecesarias,
      motivo,
      candidatos: (estacion?.empleados ?? [])
        .filter((e) => e.activo !== false)
        .map((e) => ({
          id: e.id,
          nombre: nombres.get(e.id) ?? 'Personal',
          tieneHorario:
            !!e.calendario &&
            Object.values(e.calendario.dias).some((f) => f?.length),
          asignacionAutomatica: e.asignacionAutomatica !== false,
        }))
        .sort(
          (a, b) =>
            Number(b.asignacionAutomatica) - Number(a.asignacionAutomatica) ||
            a.nombre.localeCompare(b.nombre, 'es'),
        ),
    };
  });
}

export function validarEleccionesPersonal(
  contexto: PasoPersonalPrevisto[],
  elecciones: EleccionPersonal[],
) {
  if (new Set(elecciones.map((e) => e.nodoClave)).size !== elecciones.length)
    throw new BadRequestException(
      'Un paso tiene más de una elección de personal.',
    );
  for (const e of elecciones) {
    const paso = contexto.find((p) => p.nodoClave === e.nodoClave);
    if (!paso || paso.motivo)
      throw new BadRequestException(
        paso?.motivo ??
          'La elección corresponde a un paso que ya no existe. Revisá los operadores.',
      );
    if (
      e.empleadoIds.length !== paso.personasNecesarias ||
      new Set(e.empleadoIds).size !== e.empleadoIds.length
    )
      throw new BadRequestException(
        `Elegí exactamente ${paso.personasNecesarias} persona(s) para ${paso.nombre}.`,
      );
    if (
      e.empleadoIds.some(
        (id) => !paso.candidatos.some((c) => c.id === id && c.tieneHorario),
      )
    )
      throw new BadRequestException(
        `Revisá el personal de ${paso.nombre}: debe estar activo, habilitado en la estación y tener horario.`,
      );
  }
}
