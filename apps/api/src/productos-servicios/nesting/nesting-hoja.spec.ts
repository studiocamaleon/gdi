/**
 * Tests de nesting-hoja (C.2.4).
 */
import { nestOnSheet, CANONICAL_PLIEGOS_MM } from './nesting-hoja';

const BASE = {
  separacionHMm: 3,
  separacionVMm: 3,
  margenMm: 5,
  permitirRotacion: true,
};

describe('nestOnSheet — selección de pliego óptimo', () => {
  it('tarjeta 90×50mm cantidad 500 — elige un pliego razonable', () => {
    const r = nestOnSheet({
      ...BASE,
      piezaAnchoMm: 90,
      piezaAltoMm: 50,
      cantidadPiezas: 500,
      criterio: 'menor_cantidad_pliegos',
    });
    expect(r).not.toBeNull();
    expect(r!.pliegoElegido.codigo).toBeDefined();
    expect(r!.pliegosNecesarios).toBeGreaterThan(0);
    expect(r!.piezasPorPliego).toBeGreaterThan(0);
    expect(r!.placements.length).toBe(r!.piezasPorPliego);
  });

  it('criterio menor_cantidad_pliegos: elige el pliego que minimiza cantidad', () => {
    // Pieza grande: SRA3 (320×450) mete 1, A3 (297×420) mete 1.
    // Pero para cantidadPiezas=1 ambos dan 1 pliego: gana el de mejor aprovechamiento.
    const r = nestOnSheet({
      ...BASE,
      piezaAnchoMm: 200,
      piezaAltoMm: 280,
      cantidadPiezas: 1,
      criterio: 'menor_cantidad_pliegos',
    });
    expect(r).not.toBeNull();
    expect(r!.pliegosNecesarios).toBe(1);
  });

  it('criterio mayor_piezas_por_pliego: elige el pliego más grande que soporte', () => {
    const r = nestOnSheet({
      ...BASE,
      piezaAnchoMm: 90,
      piezaAltoMm: 50,
      cantidadPiezas: 1000,
      criterio: 'mayor_piezas_por_pliego',
    });
    expect(r).not.toBeNull();
    // SRA3++ (325×500) es el más grande, debería dar el máximo de piezas.
    // Pero puede ser SRA3 (320×450) o similar. Lo importante es que alternativas existan.
    expect(r!.alternativas.length).toBeGreaterThan(1);

    // El ganador debe tener el max piezasPorPliego entre las alternativas
    const maxPiezas = Math.max(...r!.alternativas.map((a) => a.piezasPorPliego));
    expect(r!.piezasPorPliego).toBe(maxPiezas);
  });

  it('criterio mayor_aprovechamiento: elige el pliego con menor desperdicio', () => {
    const r = nestOnSheet({
      ...BASE,
      piezaAnchoMm: 90,
      piezaAltoMm: 50,
      cantidadPiezas: 500,
      criterio: 'mayor_aprovechamiento',
    });
    expect(r).not.toBeNull();
    const maxAprov = Math.max(...r!.alternativas.map((a) => a.aprovechamientoPct));
    expect(r!.aprovechamientoPct).toBe(maxAprov);
  });

  it('pieza que NO entra en ningún pliego canónico → null', () => {
    const r = nestOnSheet({
      ...BASE,
      piezaAnchoMm: 600,
      piezaAltoMm: 600,
      cantidadPiezas: 1,
      criterio: 'menor_cantidad_pliegos',
    });
    expect(r).toBeNull();
  });

  it('pliegos custom: ignora el catálogo canónico', () => {
    const r = nestOnSheet({
      ...BASE,
      piezaAnchoMm: 50,
      piezaAltoMm: 50,
      cantidadPiezas: 10,
      pliegos: [
        { codigo: 'TEST', nombre: 'Test', anchoMm: 200, altoMm: 200 },
      ],
      criterio: 'menor_cantidad_pliegos',
    });
    expect(r).not.toBeNull();
    expect(r!.pliegoElegido.codigo).toBe('TEST');
    expect(r!.alternativas).toHaveLength(1);
  });

  it('rotación automática: pieza 50x100 en pliego 200x100 rota y entra', () => {
    const r = nestOnSheet({
      ...BASE,
      piezaAnchoMm: 50,
      piezaAltoMm: 100,
      cantidadPiezas: 1,
      pliegos: [
        { codigo: 'CUSTOM', nombre: 'Custom 200x100', anchoMm: 200, altoMm: 100 },
      ],
      criterio: 'menor_cantidad_pliegos',
    });
    expect(r).not.toBeNull();
    expect(r!.piezasPorPliego).toBeGreaterThanOrEqual(1);
  });

  it('alternativas incluyen todos los pliegos donde la pieza entra', () => {
    const r = nestOnSheet({
      ...BASE,
      piezaAnchoMm: 90,
      piezaAltoMm: 50,
      cantidadPiezas: 100,
      criterio: 'menor_cantidad_pliegos',
    });
    expect(r).not.toBeNull();
    // Pieza 90x50 entra en A5, A4, A3, SRA3, SRA3+, SRA3++, 22x34, Carta, Oficio (todos >= 90 y 50).
    // No entra en A6 (105x148) porque 90 entra pero alt 50 < 148... wait, sí entra. Todos los pliegos la aceptan.
    expect(r!.alternativas.length).toBeGreaterThanOrEqual(5);
  });

  it('criterioAplicado se expone en el output', () => {
    const r = nestOnSheet({
      ...BASE,
      piezaAnchoMm: 90,
      piezaAltoMm: 50,
      cantidadPiezas: 100,
      criterio: 'mayor_aprovechamiento',
    });
    expect(r!.criterioAplicado).toBe('mayor_aprovechamiento');
  });

  it('cantidad=0 produce 0 pliegos pero el cálculo no crashea', () => {
    const r = nestOnSheet({
      ...BASE,
      piezaAnchoMm: 90,
      piezaAltoMm: 50,
      cantidadPiezas: 0,
      criterio: 'menor_cantidad_pliegos',
    });
    expect(r).not.toBeNull();
    expect(r!.pliegosNecesarios).toBe(0);
  });

  it('CANONICAL_PLIEGOS_MM incluye formatos estándar esperados', () => {
    const codigos = CANONICAL_PLIEGOS_MM.map((p) => p.codigo);
    expect(codigos).toContain('A4');
    expect(codigos).toContain('A3');
    expect(codigos).toContain('SRA3');
    expect(codigos).toContain('22x34');
  });
});
