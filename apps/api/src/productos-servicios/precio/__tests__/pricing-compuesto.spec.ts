import { BadRequestException } from '@nestjs/common';
import {
  asignarCostosPricingCompuesto,
  congelarPoliticaPricingComponente,
  leerConfiguracionPricingCompuesto,
  leerPoliticaPricingComponente,
  validarConfiguracionPricingCompuesto,
  validarPoliticaPricingComponente,
} from '../pricing-compuesto';

describe('contrato de pricing compuesto', () => {
  it('interpreta productos y relaciones históricas como GENERAL/heredar', () => {
    expect(
      leerConfiguracionPricingCompuesto({
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 25 },
      }),
    ).toEqual({ version: 1, estrategia: 'GENERAL' });
    expect(leerPoliticaPricingComponente(null)).toEqual({
      version: 1,
      modo: 'HEREDAR_PADRE',
    });
  });

  it('lee una estrategia explícita sin alterar el resto del precioConfig', () => {
    expect(
      leerConfiguracionPricingCompuesto({
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 25 },
        compuesto: { version: 1, estrategia: 'MIXTO' },
      }),
    ).toEqual({ version: 1, estrategia: 'MIXTO' });
  });

  it('lee una política BOM con override versionado', () => {
    expect(
      leerPoliticaPricingComponente({
        version: 2,
        bindings: [],
        pricing: {
          version: 1,
          modo: 'OVERRIDE',
          precioConfigOverride: {
            metodoCalculo: 'por_margen',
            detalle: { marginPct: 35 },
          },
        },
      }),
    ).toEqual({
      version: 1,
      modo: 'OVERRIDE',
      precioConfigOverride: {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 35 },
      },
    });
  });

  it('rechaza un override explícito sin regla de precio', () => {
    expect(() =>
      validarPoliticaPricingComponente(
        { pricing: { version: 1, modo: 'OVERRIDE' } },
        'Estructura',
      ),
    ).toThrow(BadRequestException);
  });

  it('congela la regla vigente del producto hijo', () => {
    const configuracion = congelarPoliticaPricingComponente({
      configuracionJson: {
        version: 2,
        bindings: [{ clave: 'cantidad', origen: 'FIJO', valor: 1 }],
        pricing: { version: 1, modo: 'USAR_PRODUCTO_HIJO' },
      },
      precioConfigHijo: {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 42 },
      },
      actualizarSnapshot: true,
      componenteNombre: 'Impresión',
    });

    expect(configuracion).toEqual(
      expect.objectContaining({
        pricing: {
          version: 1,
          modo: 'USAR_PRODUCTO_HIJO',
          precioConfigSnapshot: {
            metodoCalculo: 'por_margen',
            detalle: { marginPct: 42 },
          },
        },
      }),
    );
  });

  it('conserva el snapshot publicado aunque cambie el precio del hijo', () => {
    const publicado = {
      version: 2,
      bindings: [{ clave: 'cantidad', origen: 'FIJO', valor: 1 }],
      pricing: {
        version: 1,
        modo: 'USAR_PRODUCTO_HIJO',
        precioConfigSnapshot: {
          metodoCalculo: 'por_margen',
          detalle: { marginPct: 25 },
        },
      },
    };

    expect(
      congelarPoliticaPricingComponente({
        configuracionJson: publicado,
        precioConfigHijo: {
          metodoCalculo: 'por_margen',
          detalle: { marginPct: 70 },
        },
        actualizarSnapshot: false,
        componenteNombre: 'Impresión',
      }),
    ).toBe(publicado);
  });

  it('tolera metadata futura inválida como GENERAL al leer históricos', () => {
    expect(
      leerConfiguracionPricingCompuesto({
        compuesto: { version: 99, estrategia: 'DESCONOCIDA' },
      }),
    ).toEqual({ version: 1, estrategia: 'GENERAL' });
    expect(
      leerPoliticaPricingComponente({
        pricing: { version: 99, modo: 'DESCONOCIDO' },
      }),
    ).toEqual({ version: 1, modo: 'HEREDAR_PADRE' });
  });

  it('rechaza una estrategia explícita desconocida al escribir', () => {
    expect(() =>
      validarConfiguracionPricingCompuesto({
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 25 },
        compuesto: { version: 1, estrategia: 'DESCONOCIDA' },
      }),
    ).toThrow(BadRequestException);
  });

  it('mantiene todos los costos en el bloque general en modo GENERAL', () => {
    const desglose = asignarCostosPricingCompuesto({
      precioConfigPadre: {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 25 },
      },
      costoTotal: 1_000,
      componentes: [
        {
          productoId: 'hijo-1',
          codigo: 'impresion',
          nombre: 'Impresión',
          costoTotal: 400,
          politica: { version: 1, modo: 'USAR_PRODUCTO_HIJO' },
        },
      ],
    });

    expect(desglose.bloqueGeneral.costoTotal).toBe(1_000);
    expect(desglose.componentes[0].incluidoEnBloqueGeneral).toBe(true);
    expect(desglose.costoTotalAsignado).toBe(1_000);
  });

  it('separa sólo los componentes con regla propia y reconcilia el costo', () => {
    const desglose = asignarCostosPricingCompuesto({
      precioConfigPadre: {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 25 },
        compuesto: { version: 1, estrategia: 'MIXTO' },
      },
      costoTotal: 1_000,
      componentes: [
        {
          productoId: 'hijo-1',
          codigo: 'impresion',
          nombre: 'Impresión',
          costoTotal: 400,
          politica: {
            version: 1,
            modo: 'USAR_PRODUCTO_HIJO',
            precioConfigSnapshot: {
              metodoCalculo: 'por_margen',
              detalle: { marginPct: 40 },
            },
          },
        },
        {
          productoId: 'hijo-2',
          codigo: 'armado',
          nombre: 'Armado',
          costoTotal: 100,
          politica: { version: 1, modo: 'HEREDAR_PADRE' },
        },
      ],
    });

    expect(desglose.bloqueGeneral.costoTotal).toBe(600);
    expect(
      desglose.componentes.map((item) => item.incluidoEnBloqueGeneral),
    ).toEqual([false, true]);
    expect(desglose.costoTotalAsignado).toBe(1_000);
  });
});
