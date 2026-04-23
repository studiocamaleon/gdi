"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNivelesFromDetalleJson = parseNivelesFromDetalleJson;
exports.getNivelesActivos = getNivelesActivos;
exports.operacionTieneNiveles = operacionTieneNiveles;
exports.resolveOperacionForNivel = resolveOperacionForNivel;
exports.todosLosNivelesCompletos = todosLosNivelesCompletos;
exports.getMaquinaIdsDeNiveles = getMaquinaIdsDeNiveles;
const client_1 = require("@prisma/client");
function toNumberOrNull(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function trimmedOrNull(value) {
    if (typeof value !== 'string')
        return null;
    const t = value.trim();
    return t.length > 0 ? t : null;
}
function trimmedOrEmpty(value) {
    if (typeof value !== 'string')
        return '';
    return value.trim();
}
function parseNivelesFromDetalleJson(detalleJson) {
    if (!detalleJson ||
        typeof detalleJson !== 'object' ||
        Array.isArray(detalleJson)) {
        return [];
    }
    const raw = detalleJson.niveles;
    if (!Array.isArray(raw))
        return [];
    const parsed = [];
    raw.forEach((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            return;
        const nivel = item;
        const nombre = trimmedOrEmpty(nivel.nombre);
        if (!nombre)
            return;
        const modoRaw = nivel.modoProductividadNivel;
        const modoProductividadNivel = modoRaw === 'variable_manual' || modoRaw === 'variable_perfil'
            ? modoRaw
            : 'fija';
        parsed.push({
            id: typeof nivel.id === 'string' && nivel.id ? nivel.id : `nivel-${index}`,
            nombre,
            orden: toNumberOrNull(nivel.orden) ?? index + 1,
            activo: nivel.activo !== false,
            modoProductividadNivel,
            tiempoFijoMin: toNumberOrNull(nivel.tiempoFijoMin),
            productividadBase: toNumberOrNull(nivel.productividadBase),
            unidadSalida: trimmedOrNull(nivel.unidadSalida),
            unidadTiempo: trimmedOrNull(nivel.unidadTiempo),
            maquinaId: trimmedOrNull(nivel.maquinaId),
            maquinaNombre: trimmedOrEmpty(nivel.maquinaNombre),
            perfilOperativoId: trimmedOrNull(nivel.perfilOperativoId),
            perfilOperativoNombre: trimmedOrEmpty(nivel.perfilOperativoNombre),
            setupMin: toNumberOrNull(nivel.setupMin),
            cleanupMin: toNumberOrNull(nivel.cleanupMin),
        });
    });
    return parsed.sort((a, b) => a.orden - b.orden);
}
function getNivelesActivos(detalleJson) {
    return parseNivelesFromDetalleJson(detalleJson).filter((n) => n.activo);
}
function operacionTieneNiveles(op) {
    return getNivelesActivos(op.detalleJson).length > 0;
}
function decimalOrNull(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function unidadFromString(value, fallback) {
    if (!value)
        return fallback;
    const upper = value.toUpperCase();
    if (client_1.UnidadProceso[upper] !== undefined) {
        return client_1.UnidadProceso[upper];
    }
    if (Object.values(client_1.UnidadProceso).includes(upper)) {
        return upper;
    }
    return fallback;
}
function modoProductividadFromNivel(modo) {
    return modo === 'fija'
        ? client_1.ModoProductividadProceso.FIJA
        : client_1.ModoProductividadProceso.FORMULA;
}
function resolveOperacionForNivel(op, nivelId) {
    const niveles = getNivelesActivos(op.detalleJson);
    const tieneNiveles = niveles.length > 0;
    if (!tieneNiveles) {
        return {
            maquinaId: op.maquinaId || null,
            perfilOperativoId: op.perfilOperativoId || null,
            modoProductividad: op.modoProductividad,
            productividadBase: decimalOrNull(op.productividadBase),
            tiempoFijoMin: decimalOrNull(op.tiempoFijoMin),
            setupMin: decimalOrNull(op.setupMin),
            cleanupMin: decimalOrNull(op.cleanupMin),
            runMin: decimalOrNull(op.runMin),
            unidadSalida: op.unidadSalida,
            unidadTiempo: op.unidadTiempo,
            nivelId: null,
            nivelNombre: null,
        };
    }
    if (!nivelId)
        return null;
    const nivel = niveles.find((n) => n.id === nivelId);
    if (!nivel)
        return null;
    return {
        maquinaId: nivel.maquinaId,
        perfilOperativoId: nivel.perfilOperativoId,
        modoProductividad: modoProductividadFromNivel(nivel.modoProductividadNivel),
        productividadBase: nivel.productividadBase !== null
            ? nivel.productividadBase
            : decimalOrNull(op.productividadBase),
        tiempoFijoMin: nivel.tiempoFijoMin !== null
            ? nivel.tiempoFijoMin
            : decimalOrNull(op.tiempoFijoMin),
        setupMin: nivel.setupMin !== null ? nivel.setupMin : decimalOrNull(op.setupMin),
        cleanupMin: nivel.cleanupMin !== null
            ? nivel.cleanupMin
            : decimalOrNull(op.cleanupMin),
        runMin: decimalOrNull(op.runMin),
        unidadSalida: unidadFromString(nivel.unidadSalida, op.unidadSalida),
        unidadTiempo: unidadFromString(nivel.unidadTiempo, op.unidadTiempo),
        nivelId: nivel.id,
        nivelNombre: nivel.nombre,
    };
}
function todosLosNivelesCompletos(detalleJson) {
    const niveles = getNivelesActivos(detalleJson);
    if (niveles.length === 0)
        return true;
    return niveles.every((nivel) => {
        if (nivel.modoProductividadNivel === 'fija') {
            return (nivel.tiempoFijoMin ?? 0) > 0;
        }
        return (nivel.productividadBase ?? 0) > 0;
    });
}
function getMaquinaIdsDeNiveles(detalleJson) {
    const niveles = getNivelesActivos(detalleJson);
    const out = new Set();
    for (const n of niveles) {
        if (n.maquinaId)
            out.add(n.maquinaId);
    }
    return Array.from(out);
}
//# sourceMappingURL=operacion-values.js.map