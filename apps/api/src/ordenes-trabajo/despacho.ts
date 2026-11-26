/** Destino acordado para una OT. Se conserva aunque cambie la ficha del cliente. */
export type DespachoOrden = {
  localidad: string;
  direccion: string;
  transporte: string;
};

export function leerDespacho(valor: unknown): DespachoOrden | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const d = valor as Partial<DespachoOrden>;
  if (
    typeof d.localidad !== 'string' ||
    !d.localidad.trim() ||
    typeof d.direccion !== 'string' ||
    !d.direccion.trim()
  )
    return null;
  return {
    localidad: d.localidad.trim(),
    direccion: d.direccion.trim(),
    transporte: typeof d.transporte === 'string' ? d.transporte.trim() : '',
  };
}
