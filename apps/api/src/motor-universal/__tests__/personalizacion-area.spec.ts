/**
 * Tests del área desde personalización: un paso con
 * paramsPasoJson.fuenteMedida = 'personalizacion:<codigo>' toma su área del
 * jobContext (personalizacion_<codigo>_areaM2), no del área global del producto.
 * Ver docs/personalizaciones-diseno.md
 *
 * Unitario sin DB: invoca los métodos privados directo sobre el prototype.
 */

import { MotorUniversalService } from '../motor.service';
import type { JobContext, PasoCargado } from '../tipos';

type MotorConPrivados = {
  calcularAreaImpresaConsumiblesM2: (
    paso: PasoCargado,
    jobContext: JobContext,
    nesting: unknown,
    material: unknown,
  ) => number;
  resolverCantidadProductividadPropia: (
    paso: PasoCargado,
    jobContext: JobContext,
    nesting?: unknown,
    material?: unknown,
  ) => number;
  areaPersonalizacionM2: (
    paso: PasoCargado,
    jobContext: JobContext,
  ) => number | null;
};

function createService(): MotorConPrivados {
  return Object.create(
    MotorUniversalService.prototype,
  ) as unknown as MotorConPrivados;
}

function paso(paramsPasoJson: Record<string, unknown> | null): PasoCargado {
  return {
    familiaCodigo: 'impresion_por_area',
    paramsPasoJson,
  } as unknown as PasoCargado;
}

function ctx(values: Record<string, unknown>): JobContext {
  return values as unknown as JobContext;
}

describe('Motor — área desde personalización', () => {
  it('consumibles: el paso con fuenteMedida usa el área de la personalización', () => {
    const s = createService();
    const p = paso({ fuenteMedida: 'personalizacion:dtf' });
    const area = s.calcularAreaImpresaConsumiblesM2(
      p,
      ctx({ personalizacion_dtf_areaM2: 0.05 }),
      null,
      null,
    );
    expect(area).toBeCloseTo(0.05);
  });

  it('marcado pero sin medida cargada → área 0 (no cae al global)', () => {
    const s = createService();
    const p = paso({ fuenteMedida: 'personalizacion:dtf' });
    expect(s.calcularAreaImpresaConsumiblesM2(p, ctx({}), null, null)).toBe(0);
  });

  it('sin fuenteMedida → areaPersonalizacionM2 = null (comportamiento global)', () => {
    const s = createService();
    expect(s.areaPersonalizacionM2(paso(null), ctx({}))).toBeNull();
    expect(
      s.areaPersonalizacionM2(paso({ fuenteMedida: 'producto' }), ctx({})),
    ).toBeNull();
  });

  it('multi-selección: suma las áreas de todas las personalizaciones del paso', () => {
    const s = createService();
    const p = paso({
      fuenteMedidaPersonalizaciones: ['pecho', 'espalda', 'escudo'],
    });
    const area = s.calcularAreaImpresaConsumiblesM2(
      p,
      ctx({
        personalizacion_pecho_areaM2: 0.05,
        personalizacion_espalda_areaM2: 0.08,
        personalizacion_escudo_areaM2: 0.01,
      }),
      null,
      null,
    );
    expect(area).toBeCloseTo(0.14);
  });

  it('multi-selección con una sin medida cargada → suma las que sí (no falla)', () => {
    const s = createService();
    const p = paso({ fuenteMedidaPersonalizaciones: ['pecho', 'espalda'] });
    const area = s.calcularAreaImpresaConsumiblesM2(
      p,
      ctx({ personalizacion_pecho_areaM2: 0.05 }),
      null,
      null,
    );
    expect(area).toBeCloseTo(0.05);
  });

  it('tiempo por área usa el área de la personalización, no las piezas globales', () => {
    const s = createService();
    const p = paso({
      fuenteMedida: 'personalizacion:dtf',
      productivityQuantitySource: 'area_piezas_m2',
    });
    const cantidad = s.resolverCantidadProductividadPropia(
      p,
      ctx({ personalizacion_dtf_areaM2: 0.08, piezaAreaTotalM2: 999 }),
    );
    expect(cantidad).toBeCloseTo(0.08);
  });
});
