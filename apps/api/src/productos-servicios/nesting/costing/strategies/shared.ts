/** Helpers compartidos por las estrategias de costing. */

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pricePerM2(
  unitPrice: number,
  widthMm: number,
  heightMm: number,
): number {
  const areaM2 = (widthMm * heightMm) / 1_000_000;
  return areaM2 > 0 ? unitPrice / areaM2 : 0;
}
