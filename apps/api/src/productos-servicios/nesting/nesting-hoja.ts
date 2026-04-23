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
  /**
   * Fase A — Pliego de impresión (formato útil de la prensa).
   *
   * Cuando se setea, el flujo cambia:
   *  1. Las piezas finales se nesting **sobre este pliego de impresión**
   *     (no sobre el sustrato comprado).
   *  2. Cada candidato de `pliegos` (= sustrato comprado, p.ej. SRA3) se
   *     evalúa por cuántos pliegos de impresión entran en él
   *     (`pliegosPorSustrato`).
   *  3. `sustratosNecesarios = ceil(pliegosNecesarios / pliegosPorSustrato)`.
   *
   * El costeo entonces multiplica `sustratosNecesarios × precioSustrato`,
   * derivando "pago el sustrato comprado, no un pliego de impresión
   * que el proveedor no me vende suelto". Misma lógica histórica de
   * los motores v1 (commit c05aa8c0..58454c0d).
   *
   * Cuando es null, comportamiento original: el "pliego" del nesting es
   * directamente el sustrato comprado y se costea como tal.
   */
  pliegoImpresion?: NestingHojaPliego | null;
};

export type NestingHojaAlternativa = {
  pliego: NestingHojaPliego;
  piezasPorPliego: number;
  pliegosNecesarios: number;
  aprovechamientoPct: number;
  rotada: boolean;
};

export type NestingHojaResult = {
  /**
   * Pliego elegido según el criterio.
   *
   * Cuando hay `pliegoImpresion` en el input, este `pliegoElegido` ES el
   * pliego de impresión (donde se hace el nesting de piezas). Cuando no
   * hay pliego de impresión, es directamente el sustrato comprado.
   */
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
  /**
   * Fase A — Sustrato comprado y conversión sustrato→pliego de impresión.
   *
   * Solo se emite cuando el input tenía `pliegoImpresion`. Encapsula:
   *  - `sustratoElegido`: el formato del sustrato (p.ej. SRA3 320×450)
   *    que cubre la cantidad de pliegos de impresión necesarios.
   *  - `pliegosPorSustrato`: cuántos pliegos de impresión entran en
   *    1 sustrato (con rotación considerada).
   *  - `sustratosNecesarios`: ceil(pliegosNecesarios / pliegosPorSustrato).
   *  - `orientacionConversion`: si los pliegos van rotados dentro del
   *    sustrato para maximizar el rinde.
   *
   * El costeo derivado debe usar `sustratosNecesarios × precioSustrato`,
   * NO `pliegosNecesarios × precioPliegoImpresion` (porque no compramos
   * pliegos de impresión sueltos al proveedor).
   */
  sustratoElegido?: NestingHojaPliego;
  pliegosPorSustrato?: number;
  sustratosNecesarios?: number;
  orientacionConversion?: 'normal' | 'rotada';
};

// ─── Función pública ────────────────────────────────────────────

export function nestOnSheet(input: NestingHojaInput): NestingHojaResult | null {
  // Fase A — si hay pliego de impresión, ese es el "lienzo" del nesting de
  // piezas. Si no, los candidatos de `pliegos` son el lienzo directo (modo
  // legacy).
  const sustratosCandidatos = input.pliegos && input.pliegos.length > 0
    ? input.pliegos
    : CANONICAL_PLIEGOS_MM;
  const lienzosNesting: NestingHojaPliego[] = input.pliegoImpresion
    ? [input.pliegoImpresion]
    : sustratosCandidatos;

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

  for (const pliego of lienzosNesting) {
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

  // Elegir ganador por criterio. Cuando hay pliegoImpresion, hay un solo
  // candidato (= ese pliego de impresión) y la elección es trivial.
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

  // Fase A — conversión sustrato→pliego de impresión.
  //
  // Si hay pliegoImpresion, evaluamos cada sustrato candidato por cuántos
  // pliegos de impresión entran (con rotación si conviene) y elegimos el
  // sustrato que minimiza la cantidad necesaria. El costeo aguas abajo se
  // hace sobre el sustrato comprado.
  let sustratoElegido: NestingHojaPliego | undefined;
  let pliegosPorSustratoElegido: number | undefined;
  let sustratosNecesarios: number | undefined;
  let orientacionConversion: 'normal' | 'rotada' | undefined;

  if (input.pliegoImpresion) {
    type ConvCandidato = {
      sustrato: NestingHojaPliego;
      pliegosPorSustrato: number;
      sustratosNecesarios: number;
      rotada: boolean;
    };
    const convCandidatos: ConvCandidato[] = [];
    const pi = input.pliegoImpresion;
    for (const sustrato of sustratosCandidatos) {
      const calc = (anchoPliego: number, altoPliego: number) => {
        const cols = Math.floor(sustrato.anchoMm / anchoPliego);
        const filas = Math.floor(sustrato.altoMm / altoPliego);
        return cols > 0 && filas > 0 ? cols * filas : 0;
      };
      const normal = calc(pi.anchoMm, pi.altoMm);
      const rotada = input.permitirRotacion ? calc(pi.altoMm, pi.anchoMm) : 0;
      const pliegosPorSustrato = Math.max(normal, rotada);
      if (pliegosPorSustrato === 0) continue; // pliego no entra en este sustrato

      const sustratosNec = Math.ceil(ganador.pliegosNecesarios / pliegosPorSustrato);
      convCandidatos.push({
        sustrato,
        pliegosPorSustrato,
        sustratosNecesarios: sustratosNec,
        rotada: rotada > normal,
      });
    }

    if (convCandidatos.length > 0) {
      // Elegimos el sustrato que minimiza la cantidad necesaria (= menor
      // costo). Ante empate, gana el de mayor pliegos-por-sustrato (= menor
      // desperdicio relativo por sustrato).
      const ganadorSustrato = convCandidatos.reduce((best, current) => {
        if (current.sustratosNecesarios < best.sustratosNecesarios) return current;
        if (
          current.sustratosNecesarios === best.sustratosNecesarios &&
          current.pliegosPorSustrato > best.pliegosPorSustrato
        ) {
          return current;
        }
        return best;
      });
      sustratoElegido = ganadorSustrato.sustrato;
      pliegosPorSustratoElegido = ganadorSustrato.pliegosPorSustrato;
      sustratosNecesarios = ganadorSustrato.sustratosNecesarios;
      orientacionConversion = ganadorSustrato.rotada ? 'rotada' : 'normal';
    }
  }

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
    sustratoElegido,
    pliegosPorSustrato: pliegosPorSustratoElegido,
    sustratosNecesarios,
    orientacionConversion,
  };
}
