import { ForbiddenException } from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';

export const PERMISO_TRABAJO_MEDIDA = 'comercial.trabajos_medida' as const;
export function exigirTrabajoMedida(auth: CurrentAuth) {
  if (!auth.permisos?.has(PERMISO_TRABAJO_MEDIDA))
    throw new ForbiddenException(
      'No tenés permiso para crear o configurar trabajos a medida.',
    );
}

/** Sólo se usa con snapshots leídos de la base, nunca con JSON del navegador. */
export function esSnapshotTrabajoMedida(snapshot: unknown): boolean {
  return (
    !!snapshot &&
    typeof snapshot === 'object' &&
    (snapshot as { origen?: string }).origen === 'TRABAJO_MEDIDA'
  );
}

export function autorizarSnapshotsMedida(
  auth: CurrentAuth,
  snapshots: Array<{ id: string; snapshotJson: unknown }>,
  conservados = new Set<string>(),
) {
  if (
    snapshots.some(
      (s) => esSnapshotTrabajoMedida(s.snapshotJson) && !conservados.has(s.id),
    )
  )
    exigirTrabajoMedida(auth);
}
