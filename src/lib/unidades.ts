export type UnitDimension =
  | "count"
  | "length"
  | "area"
  | "volume"
  | "mass"
  | "electric"
  | "power"
  | "power_density"
  | "color_temperature"
  | "luminous_flux";

export type UnitCode =
  | "unidad"
  | "pack"
  | "caja"
  | "kit"
  | "hoja"
  | "pliego"
  | "resma"
  | "rollo"
  | "pieza"
  | "par"
  | "m"
  | "metro_lineal"
  | "mm"
  | "cm"
  | "m2"
  | "m3"
  | "litro"
  | "ml"
  | "kg"
  | "gramo"
  | "g_m2"
  | "v"
  | "a"
  | "w"
  | "w_m"
  | "k"
  | "lm"
  | "mm2";

export type UnitDefinition = {
  code: UnitCode;
  label: string;
  symbol: string;
  dimension: UnitDimension;
  factorToBase: number;
  baseCode: UnitCode;
};

export const UNIT_DEFINITIONS: Record<UnitCode, UnitDefinition> = {
  unidad: { code: "unidad", label: "Unidad", symbol: "u", dimension: "count", factorToBase: 1, baseCode: "unidad" },
  pack: { code: "pack", label: "Pack", symbol: "pack", dimension: "count", factorToBase: 1, baseCode: "unidad" },
  caja: { code: "caja", label: "Caja", symbol: "caja", dimension: "count", factorToBase: 1, baseCode: "unidad" },
  kit: { code: "kit", label: "Kit", symbol: "kit", dimension: "count", factorToBase: 1, baseCode: "unidad" },
  hoja: { code: "hoja", label: "Hoja", symbol: "hoja", dimension: "count", factorToBase: 1, baseCode: "unidad" },
  pliego: { code: "pliego", label: "Pliego", symbol: "pliego", dimension: "count", factorToBase: 1, baseCode: "unidad" },
  resma: { code: "resma", label: "Resma", symbol: "resma", dimension: "count", factorToBase: 500, baseCode: "unidad" },
  rollo: { code: "rollo", label: "Rollo", symbol: "rollo", dimension: "count", factorToBase: 1, baseCode: "unidad" },
  pieza: { code: "pieza", label: "Pieza", symbol: "pz", dimension: "count", factorToBase: 1, baseCode: "unidad" },
  par: { code: "par", label: "Par", symbol: "par", dimension: "count", factorToBase: 1, baseCode: "unidad" },
  m: { code: "m", label: "Metro", symbol: "m", dimension: "length", factorToBase: 1, baseCode: "m" },
  metro_lineal: { code: "metro_lineal", label: "Metro lineal", symbol: "m", dimension: "length", factorToBase: 1, baseCode: "m" },
  mm: { code: "mm", label: "Milímetro", symbol: "mm", dimension: "length", factorToBase: 0.001, baseCode: "m" },
  cm: { code: "cm", label: "Centímetro", symbol: "cm", dimension: "length", factorToBase: 0.01, baseCode: "m" },
  m2: { code: "m2", label: "Metro cuadrado", symbol: "m2", dimension: "area", factorToBase: 1, baseCode: "m2" },
  m3: { code: "m3", label: "Metro cúbico", symbol: "m3", dimension: "volume", factorToBase: 1000, baseCode: "litro" },
  litro: { code: "litro", label: "Litro", symbol: "L", dimension: "volume", factorToBase: 1, baseCode: "litro" },
  ml: { code: "ml", label: "Mililitro", symbol: "ml", dimension: "volume", factorToBase: 0.001, baseCode: "litro" },
  kg: { code: "kg", label: "Kilogramo", symbol: "kg", dimension: "mass", factorToBase: 1, baseCode: "kg" },
  gramo: { code: "gramo", label: "Gramo", symbol: "g", dimension: "mass", factorToBase: 0.001, baseCode: "kg" },
  g_m2: { code: "g_m2", label: "Gramos por metro cuadrado", symbol: "g/m2", dimension: "area", factorToBase: 1, baseCode: "g_m2" },
  v: { code: "v", label: "Volt", symbol: "V", dimension: "electric", factorToBase: 1, baseCode: "v" },
  a: { code: "a", label: "Ampere", symbol: "A", dimension: "electric", factorToBase: 1, baseCode: "a" },
  w: { code: "w", label: "Watt", symbol: "W", dimension: "power", factorToBase: 1, baseCode: "w" },
  w_m: { code: "w_m", label: "Watt por metro", symbol: "W/m", dimension: "power_density", factorToBase: 1, baseCode: "w_m" },
  k: { code: "k", label: "Kelvin", symbol: "K", dimension: "color_temperature", factorToBase: 1, baseCode: "k" },
  lm: { code: "lm", label: "Lumen", symbol: "lm", dimension: "luminous_flux", factorToBase: 1, baseCode: "lm" },
  mm2: { code: "mm2", label: "Milimetro cuadrado", symbol: "mm2", dimension: "area", factorToBase: 0.000001, baseCode: "m2" },
};

export function getUnitDefinition(code: UnitCode | null | undefined) {
  if (!code) return null;
  return UNIT_DEFINITIONS[code] ?? null;
}

export function areUnitsCompatible(from: UnitCode, to: UnitCode) {
  const left = UNIT_DEFINITIONS[from];
  const right = UNIT_DEFINITIONS[to];
  if (!left || !right) return false;
  return left.dimension === right.dimension && left.baseCode === right.baseCode;
}

export function convertUnitValue(value: number, from: UnitCode, to: UnitCode) {
  if (!areUnitsCompatible(from, to)) {
    throw new Error(`Unidades incompatibles: ${from} -> ${to}`);
  }
  const fromDef = UNIT_DEFINITIONS[from];
  const toDef = UNIT_DEFINITIONS[to];
  const valueInBase = value * fromDef.factorToBase;
  return valueInBase / toDef.factorToBase;
}

export function convertUnitPrice(pricePerFromUnit: number, from: UnitCode, to: UnitCode) {
  if (!areUnitsCompatible(from, to)) {
    throw new Error(`Unidades incompatibles: ${from} -> ${to}`);
  }
  const fromDef = UNIT_DEFINITIONS[from];
  const toDef = UNIT_DEFINITIONS[to];
  return pricePerFromUnit * (toDef.factorToBase / fromDef.factorToBase);
}
