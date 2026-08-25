import { MotorUniversalService } from '../motor.service';

describe('consumo de pegatinas raspadita', () => {
  const resolver = Reflect.get(
    MotorUniversalService.prototype,
    'resolverCantidadSlotPorBase',
  ) as (
    slot: { cantidadBase: string; cantidadFactor: number },
    paso: Record<string, never>,
    jobContext: { cantidad: number },
    nesting: null,
    material: null,
  ) => number;

  it('consume una raspadita por cada pieza pedida', () => {
    const cantidad = resolver.call(
      {},
      { cantidadBase: 'cantidad_pedida', cantidadFactor: 1 },
      {},
      { cantidad: 100 },
      null,
      null,
    );

    expect(cantidad).toBe(100);
  });

  it('permite configurar más de una raspadita por pieza', () => {
    const cantidad = resolver.call(
      {},
      { cantidadBase: 'cantidad_pedida', cantidadFactor: 2 },
      {},
      { cantidad: 100 },
      null,
      null,
    );

    expect(cantidad).toBe(200);
  });
});
