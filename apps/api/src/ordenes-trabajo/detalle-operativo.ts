/** Contrato cerrado: no transportar snapshots ni campos comerciales al taller. */
export type DetalleOperativoItem = {
  notaProduccion: string | null;
  materiales: Array<{ nombre: string; cantidad: number; unidad: string }>;
  eventos: Array<{
    fecha: string;
    tipo: string;
    descripcion: string;
    usuarioNombre: string;
  }>;
};

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}
function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

export function materialesYNotaOperativos(
  jobContext: unknown,
  trazabilidad: unknown,
): Omit<DetalleOperativoItem, 'eventos'> {
  const materiales: DetalleOperativoItem['materiales'] = [];
  const pasos = objeto(trazabilidad).pasos;
  for (const entrada of Array.isArray(pasos) ? pasos : []) {
    const paso = objeto(entrada);
    if (!paso.activado || !Array.isArray(paso.materiales)) continue;
    for (const entradaMaterial of paso.materiales) {
      const material = objeto(entradaMaterial);
      const cantidad = Number(material.cantidad ?? 0);
      materiales.push({
        nombre:
          texto(material.materialDisplayName) ||
          texto(material.materialNombre) ||
          'Material',
        cantidad: Number.isFinite(cantidad) ? cantidad : 0,
        unidad: texto(material.unidad),
      });
    }
  }
  return {
    notaProduccion: texto(objeto(jobContext).notasProduccion) || null,
    materiales,
  };
}
