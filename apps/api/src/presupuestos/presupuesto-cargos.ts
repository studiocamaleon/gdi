export type PresupuestoCargoVisible = {
  nombre: string;
  descripcion: string | null;
  total: number;
};

/** Sólo datos comerciales de la emisión; nunca notas o configuración interna. */
export function cargosVisiblesDe(emision: unknown): PresupuestoCargoVisible[] {
  const datos = emision as {
    cargos?: Array<{
      nombreSnapshot: string;
      descripcionSnapshot?: string | null;
      total: number;
    }>;
  } | null;
  return (datos?.cargos ?? []).map((cargo) => ({
    nombre: cargo.nombreSnapshot,
    descripcion: cargo.descripcionSnapshot ?? null,
    total: Number(cargo.total),
  }));
}
