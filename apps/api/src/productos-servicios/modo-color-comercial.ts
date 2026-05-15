export const MODO_COLOR_LABELS: Record<string, string> = {
  BN: 'Blanco y negro',
  CMYK: 'CMYK',
  'CMYK+blanco': 'CMYK + Blanco',
  'CMYK+blanco+barniz': 'CMYK + Blanco + Barniz',
};

export interface ModoColorOption {
  value: string;
  label: string;
  perfilIds: string[];
}

export function normalizeModoColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/WHITE/g, 'BLANCO')
    .replace(/W/g, 'BLANCO')
    .replace(/BARNIZ|VARNISH|VERNIS/g, 'BARNIZ');
  if (!normalized) return null;
  if (['BN', 'B/N', 'NEGRO', 'K'].includes(normalized)) return 'BN';
  if (normalized === 'CMYK') return 'CMYK';
  if (['CMYK+BLANCO', 'CMYKBLANCO'].includes(normalized)) {
    return 'CMYK+blanco';
  }
  if (
    [
      'CMYK+BLANCO+BARNIZ',
      'CMYK+BARNIZ+BLANCO',
      'CMYKBLANCOBARNIZ',
      'CMYKBARNIZBLANCO',
    ].includes(normalized)
  ) {
    return 'CMYK+blanco+barniz';
  }
  return value.trim();
}

export function getModoColorsFromPerfil(
  perfil: { detalleJson?: unknown } | null | undefined,
) {
  const detalle =
    perfil?.detalleJson && typeof perfil.detalleJson === 'object'
      ? (perfil.detalleJson as Record<string, unknown>)
      : {};
  const raw = detalle.colores ?? detalle.modoColor;
  const values = Array.isArray(raw) ? raw : [raw];
  return Array.from(
    new Set(
      values
        .map((value) => normalizeModoColor(value))
        .filter((value): value is string => value !== null),
    ),
  );
}

export function getModoColorFromPerfil(
  perfil: { detalleJson?: unknown } | null | undefined,
) {
  return getModoColorsFromPerfil(perfil)[0] ?? null;
}

export function buildModoColorOptionsFromProfiles(
  perfiles: Array<{
    id: string;
    activo?: boolean;
    tipoPerfil?: string | null;
    detalleJson?: unknown;
  }>,
  allowedModes?: unknown,
) {
  const allowed = Array.isArray(allowedModes)
    ? new Set(
        allowedModes
          .map((item) => normalizeModoColor(item))
          .filter((item): item is string => item !== null),
      )
    : null;
  const map = new Map<string, Set<string>>();
  for (const perfil of perfiles) {
    if (perfil.activo === false) continue;
    const modes = getModoColorsFromPerfil(perfil);
    for (const mode of modes) {
      if (allowed && !allowed.has(mode)) continue;
      const current = map.get(mode) ?? new Set<string>();
      current.add(perfil.id);
      map.set(mode, current);
    }
  }
  return Array.from(map.entries()).map<ModoColorOption>(([value, perfilIds]) => ({
    value,
    label: MODO_COLOR_LABELS[value] ?? value,
    perfilIds: Array.from(perfilIds),
  }));
}

export function modoColorMatchesPerfil(
  perfil: { detalleJson?: unknown } | null | undefined,
  modoColor: unknown,
) {
  const selected = normalizeModoColor(modoColor);
  if (!selected) return false;
  return getModoColorsFromPerfil(perfil).includes(selected);
}
