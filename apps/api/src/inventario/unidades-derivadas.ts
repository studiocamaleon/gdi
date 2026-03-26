import type { UnitCode } from './unidades-canonicas';

const FLEXIBLE_ROLL_SUBFAMILY = 'sustrato_rollo_flexible';
const FLEXIBLE_ROLL_SUPPORTED_UNITS = new Set<UnitCode>(['rollo', 'm2', 'metro_lineal']);

type FlexibleRollMetrics = {
  widthM: number;
  lengthM: number;
  areaM2: number;
};

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeWidthMeters(raw: number | null) {
  if (raw == null || raw <= 0) {
    return null;
  }
  return raw > 20 ? raw / 1000 : raw;
}

function normalizeLengthMeters(raw: number | null) {
  if (raw == null || raw <= 0) {
    return null;
  }
  return raw > 500 ? raw / 1000 : raw;
}

export function resolveFlexibleRollMetrics(attributes: unknown): FlexibleRollMetrics | null {
  const attrs = asRecord(attributes);
  if (!attrs) {
    return null;
  }

  const widthRaw = readNumber(
    attrs.ancho ?? attrs.anchoRollo ?? attrs.anchoRolloM ?? attrs.anchoMm ?? attrs.anchoRolloMm,
  );
  const lengthRaw = readNumber(
    attrs.largo ??
      attrs.largoRollo ??
      attrs.largoRolloM ??
      attrs.longitud ??
      attrs.longitudRollo ??
      attrs.largoMm,
  );

  const widthM = normalizeWidthMeters(widthRaw);
  const lengthM = normalizeLengthMeters(lengthRaw);
  if (!widthM || !lengthM) {
    return null;
  }

  return {
    widthM,
    lengthM,
    areaM2: widthM * lengthM,
  };
}

export function canUseFlexibleRollDerivedUnits(input: {
  subfamilia?: string | null;
  from?: UnitCode | null;
  to?: UnitCode | null;
  attributes?: unknown;
}) {
  if (String(input.subfamilia ?? '').trim().toLowerCase() !== FLEXIBLE_ROLL_SUBFAMILY) {
    return false;
  }
  if (!input.from || !input.to) {
    return false;
  }
  if (
    !FLEXIBLE_ROLL_SUPPORTED_UNITS.has(input.from) ||
    !FLEXIBLE_ROLL_SUPPORTED_UNITS.has(input.to)
  ) {
    return false;
  }
  return resolveFlexibleRollMetrics(input.attributes) !== null;
}

export function convertFlexibleRollUnitPrice(input: {
  pricePerFromUnit: number;
  from: UnitCode;
  to: UnitCode;
  attributes?: unknown;
  subfamilia?: string | null;
}) {
  if (!canUseFlexibleRollDerivedUnits(input)) {
    return null;
  }

  if (input.from === input.to) {
    return input.pricePerFromUnit;
  }

  const metrics = resolveFlexibleRollMetrics(input.attributes);
  if (!metrics) {
    return null;
  }

  const { widthM, lengthM, areaM2 } = metrics;
  switch (`${input.from}->${input.to}`) {
    case 'rollo->m2':
      return input.pricePerFromUnit / areaM2;
    case 'm2->rollo':
      return input.pricePerFromUnit * areaM2;
    case 'rollo->metro_lineal':
      return input.pricePerFromUnit / lengthM;
    case 'metro_lineal->rollo':
      return input.pricePerFromUnit * lengthM;
    case 'm2->metro_lineal':
      return input.pricePerFromUnit * widthM;
    case 'metro_lineal->m2':
      return input.pricePerFromUnit / widthM;
    default:
      return null;
  }
}
