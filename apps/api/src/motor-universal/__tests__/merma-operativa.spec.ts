import {
  areaImpresaTrabajoDesdeNestingM2,
  desglosarMermaOperativa,
  porcentajeMermaOperativaImpresion,
} from '../merma-operativa';
import type { NestingDispatchResult } from '../nesting-dispatcher';
import type { PasoCargado } from '../tipos';

describe('plan de consumo y merma operativa', () => {
  it('toma la merma sólo del sustrato principal', () => {
    const paso = {
      slots: [
        { slotCodigo: 'tinta_auxiliar', mermaAdicionalPct: 40 },
        { slotCodigo: 'sustrato_principal', mermaAdicionalPct: 12 },
      ],
    } as unknown as PasoCargado;

    expect(porcentajeMermaOperativaImpresion(paso)).toBe(12);
  });

  it('separa trabajo, pérdida operativa y total sin redondear la magnitud', () => {
    expect(desglosarMermaOperativa(25, 12)).toEqual({
      porcentaje: 12,
      cantidadTrabajo: 25,
      cantidadMerma: 3,
      cantidadTotal: 28,
    });
  });

  it('en grid simple usa piezas pedidas y no toda la superficie de los pliegos', () => {
    const nesting = {
      algorithm: 'grid-2d-single',
      piezasPorPliego: 4,
      metricasRaw: {
        areaUtilMm2: 400_000,
        areaTotalMm2: 1_000_000,
        piezasPorSustrato: 4,
        aprovechamientoPct: 40,
      },
    } as unknown as NestingDispatchResult;

    expect(areaImpresaTrabajoDesdeNestingM2(nesting, 10)).toBeCloseTo(1);
  });

  it('en un nesting multi usa el área acumulada de placements reales', () => {
    const nesting = {
      algorithm: 'grid-2d-multi',
      metricasRaw: {
        areaUtilMm2: 725_000,
        areaTotalMm2: 2_000_000,
        aprovechamientoPct: 36.25,
      },
    } as unknown as NestingDispatchResult;

    expect(areaImpresaTrabajoDesdeNestingM2(nesting, 999)).toBeCloseTo(0.725);
  });
});
