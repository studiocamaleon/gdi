"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLongitudMm = getLongitudMm;
exports.getLongitudCm = getLongitudCm;
exports.setLongitud = setLongitud;
exports.getLongitudMmOrDefault = getLongitudMmOrDefault;
function getLongitudMm(attrs, baseKey) {
    if (!attrs || typeof attrs !== 'object')
        return null;
    const probe = (key, factor) => {
        const v = attrs[key];
        if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0)
            return null;
        return v * factor;
    };
    return (probe(`${baseKey}Mm`, 1) ??
        probe(`${baseKey}Cm`, 10) ??
        probe(`${baseKey}M`, 1000) ??
        probe(baseKey, 1000) ??
        null);
}
function getLongitudCm(attrs, baseKey) {
    const mm = getLongitudMm(attrs, baseKey);
    return mm == null ? null : mm / 10;
}
function setLongitud(attrs, baseKey, valor, unidad) {
    const next = { ...(attrs ?? {}) };
    delete next[`${baseKey}Mm`];
    delete next[`${baseKey}Cm`];
    delete next[`${baseKey}M`];
    delete next[baseKey];
    const suffix = unidad === 'mm' ? 'Mm' : unidad === 'cm' ? 'Cm' : 'M';
    next[`${baseKey}${suffix}`] = valor;
    return next;
}
function getLongitudMmOrDefault(attrs, baseKey, defaultMm) {
    return getLongitudMm(attrs, baseKey) ?? defaultMm;
}
//# sourceMappingURL=units.js.map