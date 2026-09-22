import type { ClaveCapacidad } from './evaluador-capacidades';

const registro = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function requiereTerminaciones(doc: Record<string, unknown>) {
  return Boolean(
    doc.grupoId ||
    doc.grupoTomoId ||
    doc.esTomo ||
    (Array.isArray(doc.terminaciones) && doc.terminaciones.length) ||
    (typeof doc.terminacion === 'string' &&
      doc.terminacion !== 'Ninguna' &&
      doc.terminacion.trim()),
  );
}

/** La autorización se decide con el contenido completo, antes de calcular o
 * persistir. Un lote mixto se rechaza entero si incluye una función excluida. */
export function capacidadesCargaCopiado(carga: {
  documentos: readonly unknown[];
  grupos?: readonly unknown[];
}): ClaveCapacidad[] {
  const claves = new Set<ClaveCapacidad>(['centro_copiado']);
  for (const value of carga.documentos) {
    const doc = registro(value);
    if (doc.modo === 'CAD' || doc.tamano === 'CAD' || doc.cad)
      claves.add('cotizacion_cad');
    if (requiereTerminaciones(doc)) claves.add('terminaciones_copiado');
  }
  if (carga.grupos?.length) claves.add('terminaciones_copiado');
  return [...claves];
}

/** Cubre el guardado y la recotización por el motor general, incluidos los
 * metadatos históricos de tomos y documentos sueltos. */
export function capacidadesJobCopiado(job: unknown): ClaveCapacidad[] {
  const value = registro(job)._centroCopiado;
  if (value === undefined || value === null) return [];
  return capacidadesCargaCopiado({ documentos: [value] });
}

/** La plantilla reservada sigue siendo Copiado aunque el cliente omita su
 * metadata. Los productos comerciales generales no heredan esta restricción. */
export function capacidadesProductoCopiado(
  producto: { codigo: string; sistemaCodigo?: string | null },
  job: unknown,
): ClaveCapacidad[] {
  if (
    producto.sistemaCodigo !== 'centro_copiado' &&
    producto.codigo !== 'SYS-IMPRESION-DOC'
  )
    return [];
  const opcionales = registro(registro(job).opcionalesActivos);
  return [
    'centro_copiado',
    ...(Object.values(opcionales).some((v) => v === true)
      ? (['terminaciones_copiado'] as const)
      : []),
  ];
}
