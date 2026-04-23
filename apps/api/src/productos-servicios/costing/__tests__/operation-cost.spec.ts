import { calculateOperationCost } from '../operation-cost';
import { Prisma } from '@prisma/client';

describe('calculateOperationCost', () => {
  it('costo básico con number: 7.35 min × $4084.97/h ≈ $500.41', () => {
    expect(calculateOperationCost(7.35, 4084.97)).toMatchInlineSnapshot(
      `500.408825`,
    );
  });

  it('costo con Decimal: 7.35 min × Decimal(4084.97) ≈ $500.41', () => {
    expect(
      calculateOperationCost(7.35, new Prisma.Decimal('4084.97')),
    ).toMatchInlineSnapshot(`500.408825`);
  });

  it('tiempo cero → costo cero', () => {
    expect(calculateOperationCost(0, 4084.97)).toMatchInlineSnapshot(`0`);
  });

  it('tarifa cero → costo cero', () => {
    expect(calculateOperationCost(60, 0)).toMatchInlineSnapshot(`0`);
  });

  it('tarifa null → costo cero (preserva patrón ?? 0 del legacy)', () => {
    expect(calculateOperationCost(60, null)).toMatchInlineSnapshot(`0`);
  });

  it('tarifa undefined → costo cero', () => {
    expect(calculateOperationCost(60, undefined)).toMatchInlineSnapshot(`0`);
  });

  it('exactamente 60 min × $1000/h = $1000', () => {
    expect(calculateOperationCost(60, 1000)).toMatchInlineSnapshot(`1000`);
  });

  it('30 min × $2000/h = $1000', () => {
    expect(calculateOperationCost(30, 2000)).toMatchInlineSnapshot(`1000`);
  });

  it('número negativo (tiempo): pasa tal cual (no validamos signos)', () => {
    expect(calculateOperationCost(-30, 1000)).toMatchInlineSnapshot(`-500`);
  });

  it('Decimal con muchos decimales: 8.135 min × Decimal(3500.50)', () => {
    expect(
      calculateOperationCost(8.135, new Prisma.Decimal('3500.50')),
    ).toMatchInlineSnapshot(`474.60945833333335`);
  });
});
