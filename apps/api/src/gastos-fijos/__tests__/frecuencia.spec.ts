import { FrecuenciaGastoFijo, Prisma } from '@prisma/client';

import { GastosFijosService } from '../gastos-fijos.service';
import type { UpsertGastoFijoDto } from '../dto/upsert-gasto-fijo.dto';

/**
 * El valor que se carga es el de UNA cuota; el punto de equilibrio necesita el
 * mensual. Sin prorratear, un seguro anual haría saltar el equilibrio en el mes
 * que toca pagarlo y lo dejaría en cero los otros once.
 */
describe('gastos fijos · valor por frecuencia', () => {
  const service = new GastosFijosService({} as never);
  const derivar = (valor: number, frecuencia: FrecuenciaGastoFijo) =>
    Number(
      (
        service as unknown as {
          datosDesdeDto: (dto: UpsertGastoFijoDto) => { importeMensual: Prisma.Decimal };
        }
      )
        .datosDesdeDto({
          nombre: 'x',
          categoriaEgresoId: '00000000-0000-0000-0000-000000000001',
          valor,
          frecuencia,
          vigenteDesde: '2026-07',
        } as UpsertGastoFijoDto)
        .importeMensual.toFixed(2),
    );

  it('un gasto mensual vale lo que dice', () => {
    expect(derivar(100_000, FrecuenciaGastoFijo.MENSUAL)).toBe(100_000);
  });

  it('uno anual prorratea a doceavos', () => {
    expect(derivar(1_200_000, FrecuenciaGastoFijo.ANUAL)).toBe(100_000);
  });

  it('los intermedios también', () => {
    expect(derivar(600_000, FrecuenciaGastoFijo.SEMESTRAL)).toBe(100_000);
    expect(derivar(300_000, FrecuenciaGastoFijo.TRIMESTRAL)).toBe(100_000);
    expect(derivar(200_000, FrecuenciaGastoFijo.BIMESTRAL)).toBe(100_000);
  });

  /** La misma plata al año pesa lo mismo por mes, se pague como se pague. */
  it('la frecuencia no cambia el total anual', () => {
    const anual = derivar(1_200_000, FrecuenciaGastoFijo.ANUAL) * 12;
    const mensual = derivar(100_000, FrecuenciaGastoFijo.MENSUAL) * 12;
    expect(anual).toBe(mensual);
  });
});
