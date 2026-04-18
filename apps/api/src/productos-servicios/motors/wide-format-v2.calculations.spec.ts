/**
 * Tests de las funciones de nesting en rollo (C.2).
 */
import { nestOnRoll } from './wide-format-v2.calculations';

// Rollo estándar vinilo adhesivo: 63cm ancho, 5mm de margen lateral,
// 10mm de separación entre piezas.
const ROLLO_VINILO = {
  rolloAnchoMm: 630,
  separacionMm: 10,
  margenLateralMm: 5,
  permitirRotacion: true,
};

describe('nestOnRoll — nesting en rollo continuo (C.2)', () => {
  it('1 pieza 1000×500mm en rollo 630mm: rota y cabe', () => {
    // Sin rotación: ancho 1000 > 620 ancho útil → no entra.
    // Con rotación: 500 de alto < 620 útil → entra. 1 pieza por fila.
    const r = nestOnRoll({
      ...ROLLO_VINILO,
      piezas: [{ anchoMm: 1000, altoMm: 500, cantidad: 1 }],
    });
    expect(r.piezasRechazadas).toHaveLength(0);
    expect(r.layoutsPorMedida).toHaveLength(1);
    expect(r.layoutsPorMedida[0].rotada).toBe(true);
    expect(r.layoutsPorMedida[0].piezasPorFila).toBe(1);
    expect(r.layoutsPorMedida[0].filas).toBe(1);
    // Largo requerido = 1 fila × 1000mm (el alto de la fila al rotar es el ancho original)
    expect(r.layoutsPorMedida[0].largoRequeridoMm).toBe(1000);
    expect(r.largoConsumidoMm).toBe(1000);
    expect(r.areaUtilM2).toBe(0.5);
  });

  it('10 stickers 80×50mm: calcula piezas por fila y filas', () => {
    // Ancho útil = 620mm. Con separación 10mm:
    //   - Orientación A (80 ancho): (620+10)/(80+10) = 7 piezas por fila
    //   - Orientación B (50 ancho rotado): (620+10)/(50+10) = 10.5 → 10 piezas
    // Gana B con 10 piezas por fila. 10 piezas → 1 fila.
    const r = nestOnRoll({
      ...ROLLO_VINILO,
      piezas: [{ anchoMm: 80, altoMm: 50, cantidad: 10 }],
    });
    expect(r.layoutsPorMedida[0].rotada).toBe(true);
    expect(r.layoutsPorMedida[0].piezasPorFila).toBe(10);
    expect(r.layoutsPorMedida[0].filas).toBe(1);
  });

  it('rechaza pieza que no entra ni rotada', () => {
    // Pieza 700×700: ancho 700 > 620. Rotada también 700 > 620. Rechazada.
    const r = nestOnRoll({
      ...ROLLO_VINILO,
      piezas: [{ anchoMm: 700, altoMm: 700, cantidad: 1 }],
    });
    expect(r.piezasRechazadas).toHaveLength(1);
    expect(r.piezasRechazadas[0].motivo).toMatch(/No encaja/);
    expect(r.largoConsumidoMm).toBe(0);
  });

  it('cantidad alta: calcula filas necesarias correctamente', () => {
    // 50 stickers 80×50 → 10 por fila (rotada) → 5 filas
    const r = nestOnRoll({
      ...ROLLO_VINILO,
      piezas: [{ anchoMm: 80, altoMm: 50, cantidad: 50 }],
    });
    expect(r.layoutsPorMedida[0].piezasPorFila).toBe(10);
    expect(r.layoutsPorMedida[0].filas).toBe(5);
    // 5 filas × 80mm (alto al rotar) + 4 separaciones × 10mm = 440mm
    expect(r.layoutsPorMedida[0].largoRequeridoMm).toBe(440);
  });

  it('aprovechamiento ~100% para pieza full-width', () => {
    // Pieza 620×500 (sin rotación, justo ancho útil): 1 por fila, 1 fila → 500mm largo.
    // Área útil: 620×500 = 310000 mm² = 0.31 m²
    // Área consumida: 620×500 = 310000 mm² = 0.31 m² → 100%
    const r = nestOnRoll({
      ...ROLLO_VINILO,
      piezas: [{ anchoMm: 620, altoMm: 500, cantidad: 1 }],
    });
    expect(r.aprovechamientoPct).toBeCloseTo(100, 0);
    expect(r.layoutsPorMedida[0].rotada).toBe(false);
    expect(r.layoutsPorMedida[0].piezasPorFila).toBe(1);
  });

  it('aprovechamiento bajo para pieza angosta', () => {
    // Pieza 100×500, 1 sola → aproveh = (100×500) / (620×500) = 16%
    const r = nestOnRoll({
      ...ROLLO_VINILO,
      piezas: [{ anchoMm: 100, altoMm: 500, cantidad: 1 }],
    });
    expect(r.aprovechamientoPct).toBeCloseTo(16.13, 1);
  });

  it('múltiples medidas: suma largos + separación entre grupos', () => {
    const r = nestOnRoll({
      ...ROLLO_VINILO,
      piezas: [
        { anchoMm: 200, altoMm: 100, cantidad: 2 },
        { anchoMm: 300, altoMm: 200, cantidad: 1 },
      ],
    });
    expect(r.layoutsPorMedida).toHaveLength(2);
    expect(r.piezasRechazadas).toHaveLength(0);
    expect(r.largoConsumidoMm).toBeGreaterThan(0);
  });

  it('no rotación: pieza se mide en orientación natural', () => {
    // Sin permitir rotación, una pieza 50×80 se mide como 50 ancho.
    // 50 en 620 útil: (620+10)/(50+10) = 10.5 → 10 por fila.
    const r = nestOnRoll({
      ...ROLLO_VINILO,
      permitirRotacion: false,
      piezas: [{ anchoMm: 50, altoMm: 80, cantidad: 10 }],
    });
    expect(r.layoutsPorMedida[0].rotada).toBe(false);
    expect(r.layoutsPorMedida[0].piezasPorFila).toBe(10);
    expect(r.layoutsPorMedida[0].filas).toBe(1);
  });
});
