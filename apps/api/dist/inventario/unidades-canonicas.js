"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CANONICAL_UNITS = void 0;
exports.unitsAreCompatible = unitsAreCompatible;
exports.convertUnitValue = convertUnitValue;
exports.convertUnitPrice = convertUnitPrice;
exports.CANONICAL_UNITS = {
    unidad: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
    pack: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
    caja: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
    kit: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
    hoja: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
    pliego: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
    resma: { dimension: 'count', baseCode: 'unidad', factorToBase: 500 },
    rollo: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
    pieza: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
    par: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
    metro_lineal: { dimension: 'length', baseCode: 'metro_lineal', factorToBase: 1 },
    mm: { dimension: 'length', baseCode: 'metro_lineal', factorToBase: 0.001 },
    cm: { dimension: 'length', baseCode: 'metro_lineal', factorToBase: 0.01 },
    m2: { dimension: 'area', baseCode: 'm2', factorToBase: 1 },
    m3: { dimension: 'volume', baseCode: 'litro', factorToBase: 1000 },
    litro: { dimension: 'volume', baseCode: 'litro', factorToBase: 1 },
    ml: { dimension: 'volume', baseCode: 'litro', factorToBase: 0.001 },
    kg: { dimension: 'mass', baseCode: 'kg', factorToBase: 1 },
    gramo: { dimension: 'mass', baseCode: 'kg', factorToBase: 0.001 },
};
function unitsAreCompatible(from, to) {
    const left = exports.CANONICAL_UNITS[from];
    const right = exports.CANONICAL_UNITS[to];
    return left.dimension === right.dimension && left.baseCode === right.baseCode;
}
function convertUnitValue(value, from, to) {
    if (!unitsAreCompatible(from, to)) {
        throw new Error(`Units ${from} and ${to} are not compatible.`);
    }
    const fromFactor = exports.CANONICAL_UNITS[from].factorToBase;
    const toFactor = exports.CANONICAL_UNITS[to].factorToBase;
    return (value * fromFactor) / toFactor;
}
function convertUnitPrice(pricePerFromUnit, from, to) {
    if (!unitsAreCompatible(from, to)) {
        throw new Error(`Units ${from} and ${to} are not compatible.`);
    }
    const fromFactor = exports.CANONICAL_UNITS[from].factorToBase;
    const toFactor = exports.CANONICAL_UNITS[to].factorToBase;
    return pricePerFromUnit * (toFactor / fromFactor);
}
//# sourceMappingURL=unidades-canonicas.js.map