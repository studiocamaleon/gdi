import { MotorUniversalService } from '../motor.service';

function createServiceForPrivateMethods() {
  return Object.create(MotorUniversalService.prototype) as MotorUniversalService & {
    resolverCantidadComercialPricing: (...args: unknown[]) => number;
    resolverCantidadComercialBase: (...args: unknown[]) => number;
    resolverCostoUnitarioComercial: (...args: unknown[]) => number;
    resolverMinimoComercialContext: (...args: unknown[]) => unknown;
    crearJobContextReferenciaMinimoComercial: (...args: unknown[]) => Record<string, unknown>;
    validarMinimoComercial: (...args: unknown[]) => unknown;
  };
}

describe('MotorUniversalService — mínimos comerciales', () => {
  it('ADVERTIR_FACTURAR_MINIMO ajusta solo la cantidad comercial de pricing', () => {
    const service = createServiceForPrivateMethods();
    const producto = {
      unidadComercial: 'm2',
      minimoComercialPolitica: 'ADVERTIR_FACTURAR_MINIMO',
      minimoComercialCantidad: 1,
      minimoComercialBase: 'cantidad_comercial',
    };
    const jobContext = {
      cantidad: 10,
      piezaAreaTotalM2: 0.5,
    };

    expect(service.resolverCantidadComercialBase(producto, jobContext, [])).toBe(0.5);
    expect(service.resolverCantidadComercialPricing(producto, jobContext, [])).toBe(1);
  });

  it('calcula costo unitario con la cantidad real aunque el pricing cobre mínimo', () => {
    const service = createServiceForPrivateMethods();

    expect(service.resolverCostoUnitarioComercial(1200, 1, 3)).toBe(1200);
  });

  it('distingue cantidad real y cantidad facturada por mínimo', () => {
    const service = createServiceForPrivateMethods();
    const producto = {
      unidadComercial: 'unidad',
      minimoComercialPolitica: 'ADVERTIR_FACTURAR_MINIMO',
      minimoComercialCantidad: 3,
      minimoComercialBase: 'cantidad_comercial',
    };
    const jobContext = { cantidad: 1 };

    expect(service.resolverCantidadComercialBase(producto, jobContext, [])).toBe(1);
    expect(service.resolverCantidadComercialPricing(producto, jobContext, [])).toBe(3);
  });

  it('BLOQUEAR devuelve error cuando la cantidad real está debajo del mínimo', () => {
    const service = createServiceForPrivateMethods();
    const producto = {
      unidadComercial: 'unidad',
      minimoComercialPolitica: 'BLOQUEAR',
      minimoComercialCantidad: 100,
      minimoComercialBase: 'cantidad_comercial',
    };
    const minimoContext = service.resolverMinimoComercialContext(
      producto,
      50,
      [],
    );

    const error = service.validarMinimoComercial(producto, minimoContext) as {
      codigo?: string;
      contexto?: Record<string, unknown>;
    } | null;

    expect(error?.codigo).toBe('minimo_comercial_no_alcanzado');
    expect(error?.contexto?.cantidadComercialReal).toBe(50);
    expect(error?.contexto?.minimoComercialCantidad).toBe(100);
  });

  it('NONE conserva la cantidad comercial real', () => {
    const service = createServiceForPrivateMethods();
    const producto = {
      unidadComercial: 'metro_lineal',
      minimoComercialPolitica: 'NONE',
      minimoComercialCantidad: null,
      minimoComercialBase: 'cantidad_comercial',
    };
    const jobContext = {
      cantidad: 1,
      metrosLineales: 0.75,
    };

    expect(service.resolverCantidadComercialPricing(producto, jobContext, [])).toBe(0.75);
  });

  it('mínimo por pliegos impresos usa pliegos como cantidad de pricing', () => {
    const service = createServiceForPrivateMethods();
    const producto = {
      unidadComercial: 'unidad',
      minimoComercialPolitica: 'ADVERTIR_FACTURAR_MINIMO',
      minimoComercialCantidad: 3,
      minimoComercialBase: 'pliegos_impresos',
    };
    const jobContext = { cantidad: 100 };
    const pasos = [
      {
        outputsCanonicos: { pliegos_impresos: 1 },
      },
    ];

    expect(service.resolverCantidadComercialBase(producto, jobContext, pasos)).toBe(100);
    expect(service.resolverCantidadComercialPricing(producto, jobContext, pasos)).toBe(3);
  });

  it('referencia por mínimo de pliegos cotiza hojas completas del mínimo', () => {
    const service = createServiceForPrivateMethods();
    const producto = {
      unidadComercial: 'unidad',
      minimoComercialPolitica: 'ADVERTIR_FACTURAR_MINIMO',
      minimoComercialCantidad: 3,
      minimoComercialBase: 'pliegos_impresos',
    };
    const jobContext = {
      cantidad: 100,
      piezas: [{ cantidad: 100, anchoMm: 25, altoMm: 25 }],
    };
    const minimoContext = {
      base: 'pliegos_impresos',
      cantidadReal: 1,
      unidadLabel: 'pliegos',
    };

    const referencia = service.crearJobContextReferenciaMinimoComercial(
      jobContext,
      producto,
      100,
      3,
      minimoContext,
    ) as { cantidad: number; piezas?: unknown; medidaCustomMm?: unknown };

    expect(referencia.cantidad).toBe(3);
    expect(referencia.piezas).toBeUndefined();
    expect(referencia.medidaCustomMm).toBeUndefined();
  });

  it('BLOQUEAR por pliegos impresos valida contra el output canonico', () => {
    const service = createServiceForPrivateMethods();
    const producto = {
      unidadComercial: 'unidad',
      minimoComercialPolitica: 'BLOQUEAR',
      minimoComercialCantidad: 3,
      minimoComercialBase: 'pliegos_impresos',
    };
    const minimoContext = service.resolverMinimoComercialContext(producto, 100, [
      { outputsCanonicos: { pliegos_impresos: 1 } },
    ]);

    const error = service.validarMinimoComercial(producto, minimoContext) as {
      codigo?: string;
      contexto?: Record<string, unknown>;
    } | null;

    expect(error?.codigo).toBe('minimo_comercial_no_alcanzado');
    expect(error?.contexto?.cantidadComercialReal).toBe(1);
    expect(error?.contexto?.minimoComercialBase).toBe('pliegos_impresos');
  });
});
