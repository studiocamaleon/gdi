import type {
  MedirPoligonoData,
  MedirPoligonoResult,
  PuntoTrabajoGeometria,
} from '../colas';

const MAX_VERTICES_SMOKE = 10_000;

/**
 * Primer contrato ejecutable de la cola geometry. Es deliberadamente chico:
 * prueba transporte, aislamiento, tipos y retorno sin mezclar todavía el POC
 * de OpenNest con la infraestructura que debe sostenerlo.
 */
export function medirPoligono(input: MedirPoligonoData): MedirPoligonoResult {
  validar(input);
  const puntos = sinCierreDuplicado(input.puntos);
  let dobleArea = 0;
  let perimetroMm = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < puntos.length; index += 1) {
    const actual = puntos[index];
    const siguiente = puntos[(index + 1) % puntos.length];
    dobleArea += actual.x * siguiente.y - siguiente.x * actual.y;
    perimetroMm += Math.hypot(siguiente.x - actual.x, siguiente.y - actual.y);
    minX = Math.min(minX, actual.x);
    minY = Math.min(minY, actual.y);
    maxX = Math.max(maxX, actual.x);
    maxY = Math.max(maxY, actual.y);
  }

  const areaMm2 = Math.abs(dobleArea) / 2;
  if (areaMm2 <= 0) throw new Error('El polígono no tiene área positiva.');

  return {
    schemaVersion: 1,
    algoritmo: 'shoelace-v1',
    cantidadVertices: puntos.length,
    areaMm2: redondear(areaMm2),
    perimetroMm: redondear(perimetroMm),
    limites: {
      minX,
      minY,
      maxX,
      maxY,
      anchoMm: redondear(maxX - minX),
      altoMm: redondear(maxY - minY),
    },
  };
}

function validar(input: MedirPoligonoData): void {
  if (input.schemaVersion !== 1) {
    throw new Error('Versión de contrato geométrico no soportada.');
  }
  if (!input.tenantId.trim() || !input.correlationId.trim()) {
    throw new Error('El trabajo necesita tenant y correlación.');
  }
  if (!Array.isArray(input.puntos) || input.puntos.length < 3) {
    throw new Error('El polígono necesita al menos tres vértices.');
  }
  if (input.puntos.length > MAX_VERTICES_SMOKE) {
    throw new Error(
      `El trabajo de prueba admite hasta ${MAX_VERTICES_SMOKE} vértices.`,
    );
  }
  if (
    input.puntos.some(
      (punto) => !Number.isFinite(punto.x) || !Number.isFinite(punto.y),
    )
  ) {
    throw new Error('Todos los vértices deben tener coordenadas finitas.');
  }
}

function sinCierreDuplicado(
  puntos: PuntoTrabajoGeometria[],
): PuntoTrabajoGeometria[] {
  const primero = puntos[0];
  const ultimo = puntos.at(-1);
  if (puntos.length > 3 && primero.x === ultimo?.x && primero.y === ultimo.y) {
    return puntos.slice(0, -1);
  }
  return puntos;
}

function redondear(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
