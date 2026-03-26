"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFlexibleRollMetrics = resolveFlexibleRollMetrics;
exports.canUseFlexibleRollDerivedUnits = canUseFlexibleRollDerivedUnits;
exports.convertFlexibleRollUnitPrice = convertFlexibleRollUnitPrice;
const FLEXIBLE_ROLL_SUBFAMILY = 'sustrato_rollo_flexible';
const FLEXIBLE_ROLL_SUPPORTED_UNITS = new Set(['rollo', 'm2', 'metro_lineal']);
function asRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value;
}
function readNumber(value) {
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
function normalizeWidthMeters(raw) {
    if (raw == null || raw <= 0) {
        return null;
    }
    return raw > 20 ? raw / 1000 : raw;
}
function normalizeLengthMeters(raw) {
    if (raw == null || raw <= 0) {
        return null;
    }
    return raw > 500 ? raw / 1000 : raw;
}
function resolveFlexibleRollMetrics(attributes) {
    const attrs = asRecord(attributes);
    if (!attrs) {
        return null;
    }
    const widthRaw = readNumber(attrs.ancho ?? attrs.anchoRollo ?? attrs.anchoRolloM ?? attrs.anchoMm ?? attrs.anchoRolloMm);
    const lengthRaw = readNumber(attrs.largo ??
        attrs.largoRollo ??
        attrs.largoRolloM ??
        attrs.longitud ??
        attrs.longitudRollo ??
        attrs.largoMm);
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
function canUseFlexibleRollDerivedUnits(input) {
    if (String(input.subfamilia ?? '').trim().toLowerCase() !== FLEXIBLE_ROLL_SUBFAMILY) {
        return false;
    }
    if (!input.from || !input.to) {
        return false;
    }
    if (!FLEXIBLE_ROLL_SUPPORTED_UNITS.has(input.from) ||
        !FLEXIBLE_ROLL_SUPPORTED_UNITS.has(input.to)) {
        return false;
    }
    return resolveFlexibleRollMetrics(input.attributes) !== null;
}
function convertFlexibleRollUnitPrice(input) {
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
//# sourceMappingURL=unidades-derivadas.js.map