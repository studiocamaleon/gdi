export type PresupuestoCargoVisible = {
  nombre: string;
  descripcion: string | null;
  total: number;
};

/** Sólo datos comerciales de la emisión; nunca notas o configuración interna. */
export function cargosVisiblesDe(emision: unknown): PresupuestoCargoVisible[] {
  const datos = emision as {
    tratamientoFiscal?: string;
    cargos?: Array<{
      nombreSnapshot: string;
      descripcionSnapshot?: string | null;
      total: number;
      montoNeto?: number;
    }>;
  } | null;
  return (datos?.cargos ?? []).map((cargo) => ({
    nombre: cargo.nombreSnapshot,
    descripcion: cargo.descripcionSnapshot ?? null,
    total: Number(
      datos?.tratamientoFiscal === 'SIN_COMPROBANTE'
        ? (cargo.montoNeto ?? cargo.total)
        : cargo.total,
    ),
  }));
}
