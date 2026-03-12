export type UnitDimension = 'count' | 'length' | 'area' | 'volume' | 'mass';

export type UnitCode =
  | 'unidad'
  | 'pack'
  | 'caja'
  | 'kit'
  | 'hoja'
  | 'pliego'
  | 'resma'
  | 'rollo'
  | 'pieza'
  | 'par'
  | 'metro_lineal'
  | 'mm'
  | 'cm'
  | 'm2'
  | 'm3'
  | 'litro'
  | 'ml'
  | 'kg'
  | 'gramo';

export const CANONICAL_UNITS: Record<
  UnitCode,
  { dimension: UnitDimension; baseCode: UnitCode; factorToBase: number }
> = {
  unidad: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
  pack: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
  caja: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
  kit: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
  hoja: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
  pliego: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
  resma: { dimension: 'count', baseCode: 'unidad', factorToBase: 1 },
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

export function unitsAreCompatible(from: UnitCode, to: UnitCode) {
  const left = CANONICAL_UNITS[from];
  const right = CANONICAL_UNITS[to];
  return left.dimension === right.dimension && left.baseCode === right.baseCode;
}
