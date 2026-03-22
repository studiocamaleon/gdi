export type UnitDimension = 'count' | 'length' | 'area' | 'volume' | 'mass';
export type UnitCode = 'unidad' | 'pack' | 'caja' | 'kit' | 'hoja' | 'pliego' | 'resma' | 'rollo' | 'pieza' | 'par' | 'metro_lineal' | 'mm' | 'cm' | 'm2' | 'm3' | 'litro' | 'ml' | 'kg' | 'gramo';
export declare const CANONICAL_UNITS: Record<UnitCode, {
    dimension: UnitDimension;
    baseCode: UnitCode;
    factorToBase: number;
}>;
export declare function unitsAreCompatible(from: UnitCode, to: UnitCode): boolean;
export declare function convertUnitValue(value: number, from: UnitCode, to: UnitCode): number;
export declare function convertUnitPrice(pricePerFromUnit: number, from: UnitCode, to: UnitCode): number;
