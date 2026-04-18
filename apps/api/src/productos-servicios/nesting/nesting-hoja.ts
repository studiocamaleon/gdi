/**
 * Nesting en hoja / pliego finito — función pura.
 *
 * Usa-casos: impresión láser y offset en formatos de pliego (A3, SRA3, 22x34,
 * etc.). Diferencia clave con placa rígida: hay múltiples candidatos de pliego
 * y hay que **elegir** el óptimo por criterio.
 *
 * Internamente reutiliza `nestRectangularGrid` de `nesting-placa-rigida` para
 * cada candidato (mismo algoritmo geométrico: grid regular con rotación).
 *
 * Criterios de selección:
 * - `menor_cantidad_pliegos`: minimiza el número de pliegos necesarios
 *   (ante empate, gana mejor aprovechamiento).
 * - `mayor_aprovechamiento`: maximiza el % de uso del pliego
 *   (puede implicar más pliegos pero menos desperdicio por pliego).
 * - `mayor_piezas_por_pliego`: maximiza piezas por pliego
 *   (típicamente equivalente a usar el pliego más grande).
 *
 * Origen: nuevo archivo creado en C.2.4. La lógica anterior de "elegir pliego"
 * estaba embebida en `quoteDigitalVariant` y `quoteTalonarioVariant`;
 * acá se extrae a una utility compartida.
 */

import {
  nestRectangularGrid,
  type NestingPlacaPlacement,
} from './nesting-placa-rigida';

// ─── Catálogo de pliegos canónicos ──────────────────────────────

/**
 * Formatos estándar de pliego usados en impresión comercial.
 * Mismo listado que `productos-servicios.service.CANONICAL_PLIEGOS_MM`.
 * Los motores pueden usar este catálogo o pasar su propio subset.
 */
export const CANONICAL_PLIEGOS_MM: NestingHojaPliego[] = [
  { codigo: 'A6', nombre: 'A6', anchoMm: 105, altoMm: 148 },
  { codigo: 'A5', nombre: 'A5', anchoMm: 148, altoMm: 210 },
  { codigo: 'A4', nombre: 'A4', anchoMm: 210, altoMm: 297 },
  { codigo: 'A3', nombre: 'A3', anchoMm: 297, altoMm: 420 },
  { codigo: 'SRA3', nombre: 'SRA3', anchoMm: 320, altoMm: 450 },
  { codigo: 'SRA3+', nombre: 'SRA3+', anchoMm: 330, altoMm: 480 },
  { codigo: 'SRA3++', nombre: 'SRA3++', anchoMm: 325, altoMm: 500 },
  { codigo: '22x34', nombre: '22x34', anchoMm: 220, altoMm: 340 },
  { codigo: 'CARTA', nombre: 'Carta', anchoMm: 216, altoMm: 279 },
  { codigo: 'OFICIO', nombre: 'Oficio', anchoMm: 216, altoMm: 356 },
];

// ─── Tipos públicos ─────────────────────────────────────────────

export type NestingHojaPliego = {
  codigo: string;
  nombre: string;
  anchoMm: number;
  altoMm: number;
};

export type NestingHojaCriterio =
  | 'menor_cantidad_pliegos'
  | 'mayor_aprovechamiento'
  | 'mayor_piezas_por_pliego';

export type NestingHojaInput = {
  /** Medidas de la pieza final. */
  piezaAnchoMm: number;
  piezaAltoMm: number;
  /** Total de piezas pedidas. */
  cantidadPiezas: number;
  /** Candidatos de pliego donde intentar imponer. Si vacío, usa CANONICAL_PLIEGOS_MM. */
  pliegos?: NestingHojaPliego[];
  /** Separación entre piezas. */
  separacionHMm: number;
  separacionVMm: number;
  /** Margen del pliego (no imprimible). */
  margenMm: number;
  /** Permitir rotar piezas. */
  permitirRotacion: boolean;
  /** Cómo elegir el pliego óptimo entre candidatos. */
  criterio: NestingHojaCriterio;
};

export type NestingHojaAlternativa = {
  pliego: NestingHojaPliego;
  piezasPorPliego: number;
  pliegosNecesarios: number;
  aprovechamientoPct: number;
  rotada: boolean;
};

export type NestingHojaResult = {
  /** Pliego elegido según el criterio. */
  pliegoElegido: NestingHojaPliego;
  piezasPorPliego: number;
  pliegosNecesarios: number;
  aprovechamientoPct: number;
  columnas: number;
  filas: number;
  rotada: boolean;
  /** Placements dentro del pliego elegido — la UI puede dibujar preview. */
  placements: NestingPlacaPlacement[];
  /** Alternativas evaluadas (para trazabilidad: ver qué descartó y por qué). */
  alternativas: NestingHojaAlternativa[];
  /** Criterio que se aplicó. */
  criterioAplicado: NestingHojaCriterio;
};

// ─── Función pública ────────────────────────────────────────────

export function nestOnSheet(input: NestingHojaInput): NestingHojaResult | null {
  const pliegos = input.pliegos && input.pliegos.length > 0
    ? input.pliegos
    : CANONICAL_PLIEGOS_MM;

  type Candidato = {
    pliego: NestingHojaPliego;
    piezasPorPliego: number;
    pliegosNecesarios: number;
    aprovechamientoPct: number;
    columnas: number;
    filas: number;
    rotada: boolean;
    placements: NestingPlacaPlacement[];
  };

  const candidatos: Candidato[] = [];

  for (const pliego of pliegos) {
    const nesting = nestRectangularGrid({
      piezaAnchoMm: input.piezaAnchoMm,
      piezaAltoMm: input.piezaAltoMm,
      placaAnchoMm: pliego.anchoMm,
      placaAltoMm: pliego.altoMm,
      separacionHMm: input.separacionHMm,
      separacionVMm: input.separacionVMm,
      margenMm: input.margenMm,
      permitirRotacion: input.permitirRotacion,
    });
    if (nesting.piezasPorPlaca === 0) continue; // no entra en este pliego

    const pliegosNecesarios = Math.ceil(input.cantidadPiezas / nesting.piezasPorPlaca);
    candidatos.push({
      pliego,
      piezasPorPliego: nesting.piezasPorPlaca,
      pliegosNecesarios,
      aprovechamientoPct: nesting.aprovechamientoPct,
      columnas: nesting.columnas,
      filas: nesting.filas,
      rotada: nesting.rotada,
      placements: nesting.placements,
    });
  }

  if (candidatos.length === 0) return null;

  // Elegir ganador por criterio
  const ganador = candidatos.reduce((best, current) => {
    if (input.criterio === 'menor_cantidad_pliegos') {
      if (current.pliegosNecesarios < best.pliegosNecesarios) return current;
      if (
        current.pliegosNecesarios === best.pliegosNecesarios &&
        current.aprovechamientoPct > best.aprovechamientoPct
      ) {
        return current;
      }
      return best;
    }
    if (input.criterio === 'mayor_aprovechamiento') {
      if (current.aprovechamientoPct > best.aprovechamientoPct) return current;
      return best;
    }
    if (input.criterio === 'mayor_piezas_por_pliego') {
      if (current.piezasPorPliego > best.piezasPorPliego) return current;
      return best;
    }
    return best;
  });

  const alternativas: NestingHojaAlternativa[] = candidatos.map((c) => ({
    pliego: c.pliego,
    piezasPorPliego: c.piezasPorPliego,
    pliegosNecesarios: c.pliegosNecesarios,
    aprovechamientoPct: c.aprovechamientoPct,
    rotada: c.rotada,
  }));

  return {
    pliegoElegido: ganador.pliego,
    piezasPorPliego: ganador.piezasPorPliego,
    pliegosNecesarios: ganador.pliegosNecesarios,
    aprovechamientoPct: ganador.aprovechamientoPct,
    columnas: ganador.columnas,
    filas: ganador.filas,
    rotada: ganador.rotada,
    placements: ganador.placements,
    alternativas,
    criterioAplicado: input.criterio,
  };
}
