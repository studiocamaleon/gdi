/** Nombre comercial congelado en la compra; nunca muestra claves internas ni duplica medidas. */
export function nombreMaterialCompra(v: {
  nombreVariante: string | null;
  atributosVarianteJson: unknown;
  materiaPrima: { nombre: string };
}) {
  const material = v.materiaPrima.nombre;
  if (v.nombreVariante?.trim())
    return v.nombreVariante.trim() === material
      ? material
      : `${material} · ${v.nombreVariante.trim()}`;
  const a = (v.atributosVarianteJson ?? {}) as Record<string, unknown>;
  const text = (key: string) =>
    typeof a[key] === 'string' ? (a[key] as string).trim() : '';
  const number = (key: string) =>
    typeof a[key] === 'number' && Number.isFinite(a[key]) && Number(a[key]) > 0
      ? Number(a[key])
      : null;
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 }).format(n);
  const parts: string[] = [];
  if (text('formatoComercial')) parts.push(text('formatoComercial'));
  else {
    const ancho = number('anchoMm'),
      alto = number('altoMm'),
      largo = number('largoRolloMm') ?? number('largoMm');
    if (ancho && alto) parts.push(`${fmt(ancho)} × ${fmt(alto)} mm`);
    else if (ancho && largo)
      parts.push(`${fmt(ancho)} mm × ${fmt(largo / 1000)} m`);
    else if (ancho) parts.push(`${fmt(ancho)} mm`);
  }
  const gramaje = number('gramajeGr') ?? number('gramaje');
  if (gramaje) parts.push(`${fmt(gramaje)} g/m²`);
  const espesor = number('espesorMm') ?? number('espesor');
  if (espesor) parts.push(`${fmt(espesor)} mm`);
  const volumen = number('volumenMl');
  if (volumen) parts.push(`${fmt(volumen)} ml`);
  const diametro = number('diametroMm') ?? number('diametro');
  if (diametro) parts.push(`Ø ${fmt(diametro)} mm`);
  for (const value of [
    text('color') || text('colorBase') || text('canal'),
    text('acabado'),
    text('modelo'),
    text('talle'),
    text('medidaNominal'),
  ])
    if (value && !parts.includes(value)) parts.push(value);
  return [material, ...parts].join(' · ');
}
