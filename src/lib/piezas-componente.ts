import type {
  PiezaComponenteFabricado,
  PiezaRectangularComponente,
  PiezaVectorialComponente,
} from "./productos-servicios-api";

export const esPiezaRectangular = (
  pieza: PiezaComponenteFabricado,
): pieza is PiezaRectangularComponente => pieza.tipo === "RECTANGULAR";
export const esPiezaVectorial = (
  pieza: PiezaComponenteFabricado,
): pieza is PiezaVectorialComponente => pieza.tipo !== "RECTANGULAR";

export function piezasComponenteValidas(
  piezas: PiezaComponenteFabricado[],
): boolean {
  return (
    piezas.length > 0 &&
    piezas.length <= 30 &&
    new Set(piezas.map((p) => p.id)).size === piezas.length &&
    piezas.every(
      (p) =>
        /^[a-zA-Z0-9_-]{1,80}$/.test(p.id) &&
        p.nombre.trim().length > 0 &&
        p.nombre.length <= 120 &&
        Number.isSafeInteger(p.cantidadPorUnidad) &&
        p.cantidadPorUnidad > 0 &&
        p.cantidadPorUnidad <= 10000 &&
        (!esPiezaRectangular(p) ||
          [p.medidas.anchoMm, p.medidas.altoMm].every(
            (n) => Number.isFinite(n) && n > 0 && n <= 1000000,
          )),
    )
  );
}

export function nuevaPiezaRectangular(
  numero: number,
  medidas = { anchoMm: 100, altoMm: 100 },
): PiezaRectangularComponente {
  return {
    id: crypto.randomUUID(),
    tipo: "RECTANGULAR",
    nombre: `Pieza ${numero}`,
    cantidadPorUnidad: 1,
    medidas,
  };
}
