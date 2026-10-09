/** Sección exterior, en mm. No confundir con el espesor de pared. */
export function seccionPerfil(attrs: Record<string, unknown>) {
  const n = (v: unknown) =>
    Number(typeof v === 'string' ? v.replace(',', '.') : v);
  if ('seccionAnchoMm' in attrs || 'seccionAltoMm' in attrs) {
    const ancho = n(attrs.seccionAnchoMm),
      alto = n(attrs.seccionAltoMm);
    return Number.isFinite(ancho) &&
      ancho > 0 &&
      Number.isFinite(alto) &&
      alto > 0
      ? { ancho, alto }
      : null;
  }
  // Compatibilidad con las variantes existentes, sin suponer cuadrado ni unidad.
  const match = String(attrs.seccion ?? '')
    .trim()
    .match(/^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm)?$/i);
  if (!match) return null;
  const factor = match[3]?.toLowerCase() === 'cm' ? 10 : 1;
  const ancho = n(match[1]) * factor,
    alto = n(match[2]) * factor;
  return ancho > 0 && alto > 0 ? { ancho, alto } : null;
}

export function normalizarPerfilEstructural(
  attrs: Record<string, unknown>,
): Record<string, unknown> {
  const seccion = seccionPerfil(attrs);
  if (!seccion) return { ...attrs }; // Otros perfiles/anclajes comparten la plantilla histórica.
  return {
    ...attrs,
    seccionAnchoMm: seccion.ancho,
    seccionAltoMm: seccion.alto,
    seccion: `${seccion.ancho}×${seccion.alto} mm`,
    desarrolloSeccion: (2 * (seccion.ancho + seccion.alto)) / 1000,
  };
}

export function errorPerfilEstructural(
  attrs: Record<string, unknown>,
  requerido = false,
): string | null {
  const seccion = seccionPerfil(attrs);
  if (!seccion)
    return requerido || 'seccionAnchoMm' in attrs || 'seccionAltoMm' in attrs
      ? 'Indicá el ancho y el alto exterior del perfil en milímetros.'
      : null;
  if (
    attrs.espesor !== undefined &&
    attrs.espesor !== null &&
    attrs.espesor !== ''
  ) {
    const pared = Number(String(attrs.espesor).replace(',', '.'));
    if (
      !Number.isFinite(pared) ||
      pared <= 0 ||
      pared * 2 >= Math.min(seccion.ancho, seccion.alto)
    )
      return 'El espesor de pared debe ser positivo y menor que la mitad del lado más pequeño.';
  }
  return null;
}
