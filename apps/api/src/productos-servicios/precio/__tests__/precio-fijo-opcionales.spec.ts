import { AplicarPrecioService } from '../aplicar-precio.service';
import { AplicarPrecioInput, PrecioConfig } from '../aplicar-precio.types';
import { costosPasosPrecio, escalarCostosPasos } from '../costos-pasos-precio';
import { validarMargenOpcionales } from '../margen-opcionales';

const fijo: PrecioConfig = {
  metodoCalculo: 'precio_fijo',
  detalle: { price: 1000, margenOpcionalesPct: 25 },
};
const iva = {
  catalogoId: 'iva',
  codigo: 'iva',
  nombre: 'IVA',
  porcentaje: 21,
  orden: 0,
  traslado: 'POR_FUERA' as const,
};
const service = new AplicarPrecioService();
const base = (
  overrides: Partial<AplicarPrecioInput> = {},
): AplicarPrecioInput => ({
  costoUnitario: 500,
  cantidad: 1,
  impuestos: [],
  comisiones: [],
  precioConfig: fijo,
  costosPasosUnitarios: {
    opcionales: 150,
    opcionalesSinMargen: 0,
    incluidosSinMargen: 0,
  },
  ...overrides,
});

describe('Precios fijos con opcionales adicionales', () => {
  it.each<PrecioConfig>([
    fijo,
    {
      metodoCalculo: 'precio_fijo_para_margen_minimo',
      detalle: { price: 1000, minimumMarginPct: 25, margenOpcionalesPct: 25 },
    },
    {
      metodoCalculo: 'fijado_por_cantidad',
      detalle: {
        tiers: [{ quantity: 1, price: 1000 }],
        margenOpcionalesPct: 25,
      },
    },
    {
      metodoCalculo: 'variable_por_cantidad',
      detalle: {
        tiers: [{ quantityUntil: 100, price: 1000 }],
        margenOpcionalesPct: 25,
      },
    },
  ])('suma el opcional sobre la base de $metodoCalculo', (precioConfig) => {
    expect(service.aplicar(base({ precioConfig })).precioNetoTotal).toBe(1200);
  });
  it('sin opcionales mantiene el precio fijo aunque aumente el costo obligatorio', () => {
    for (const costo of [200, 500, 1400]) {
      expect(
        service.aplicar(
          base({
            costoUnitario: costo,
            costosPasosUnitarios: {
              opcionales: 0,
              opcionalesSinMargen: 0,
              incluidosSinMargen: 0,
            },
          }),
        ).precioNetoTotal,
      ).toBe(1000);
    }
  });
  it('un producto anterior sin margen de opcionales recupera su costo', () => {
    expect(
      service.aplicar(
        base({
          precioConfig: {
            metodoCalculo: 'precio_fijo',
            detalle: { price: 1000 },
          },
        }),
      ).precioNetoTotal,
    ).toBe(1150);
  });
  it('el piso del fijo con margen mínimo se calcula sobre los obligatorios', () => {
    // Base: 750 / 0,75 = 1000. Opcional: 750 / 0,75 = 1000.
    expect(
      service.aplicar(
        base({
          costoUnitario: 1500,
          costosPasosUnitarios: {
            opcionales: 750,
            opcionalesSinMargen: 0,
            incluidosSinMargen: 0,
          },
          precioConfig: {
            metodoCalculo: 'precio_fijo_para_margen_minimo',
            detalle: {
              price: 1000,
              minimumMarginPct: 25,
              margenOpcionalesPct: 25,
            },
          },
        }),
      ).precioNetoTotal,
    ).toBe(2000);
  });
  it.each([0.5, 1, 10])(
    'cobra la preparación opcional una sola vez para %s unidades comerciales',
    (cantidad) => {
      const costos = costosPasosPrecio([
        { activado: true, costoTotal: 100 * cantidad },
        { activado: true, esOpcional: true, costoTotal: 150 },
      ]);
      expect(
        service.aplicar(
          base({
            cantidad,
            costoUnitario: (100 * cantidad + 150) / cantidad,
            costosPasosUnitarios: escalarCostosPasos(costos, 1 / cantidad),
          }),
        ).precioNetoTotal,
      ).toBe(1000 * cantidad + 200);
    },
  );
  it('mantiene IVA incluido en la base y agrega IVA al opcional una vez', () => {
    expect(
      service.aplicar(
        base({
          precioConfig: { ...fijo, detalle: { ...fijo.detalle, price: 1210 } },
          impuestos: [iva],
        }),
      ).precioBrutoTotal,
    ).toBe(1452);
  });
  it('consolida descuento, IVA, IIBB y comisión una sola vez', () => {
    const r = service.aplicar(
      base({
        costoUnitario: 400,
        costosPasosUnitarios: {
          opcionales: 160,
          opcionalesSinMargen: 0,
          incluidosSinMargen: 0,
        },
        precioConfig: {
          ...fijo,
          detalle: {
            price: 1000,
            precioIncluyeIva: false,
            margenOpcionalesPct: 10,
          },
        },
        impuestos: [
          iva,
          {
            ...iva,
            catalogoId: 'iibb',
            codigo: 'iibb',
            porcentaje: 3,
            traslado: 'POR_DENTRO',
          },
        ],
        comisiones: [
          {
            catalogoId: 'com',
            codigo: 'com',
            nombre: 'Comisión',
            porcentaje: 7,
            orden: 0,
          },
        ],
        descuento: { tipo: 'PORCENTAJE', valor: 10 },
      }),
    );
    // Opcional = 160 / (1 - 0,10 - 0,03 - 0,07) = 200.
    expect(r.descuento.netoListaTotal).toBe(1200);
    expect(r.precioNetoTotal).toBe(1080);
    expect(r.precioBrutoTotal).toBe(1306.8);
    expect(r.desglose.totalComisiones).toBe(75.6);
  });
  it('incluye cargos obligatorios; respeta los cargos opcionales sin margen y los globales', () => {
    const r = service.aplicar(
      base({
        costoUnitario: 500,
        costoSinMargenUnitario: 150,
        costosPasosUnitarios: {
          opcionales: 200,
          opcionalesSinMargen: 50,
          incluidosSinMargen: 60,
        },
      }),
    );
    // Fijo 1000 + opcional margenable 150/0,75 + opcional sin margen 50 + global 40.
    expect(r.precioNetoTotal).toBe(1290);
    expect(r.desglose.trasladoSinMargenUnitario).toBe(90);
  });
  it.each<PrecioConfig>([
    { metodoCalculo: 'por_margen', detalle: { marginPct: 25 } },
    {
      metodoCalculo: 'margen_variable',
      detalle: { tiers: [{ quantityUntil: 100, marginPct: 25 }] },
    },
    {
      metodoCalculo: 'fijo_con_margen_variable',
      detalle: { tiers: [{ quantity: 1, marginPct: 25 }] },
    },
  ])('no duplica opcionales en $metodoCalculo', (precioConfig) => {
    const input = base({ costoUnitario: 300, precioConfig });
    expect(service.aplicar(input)).toEqual(
      service.aplicar({ ...input, costosPasosUnitarios: undefined }),
    );
    expect(service.aplicar(input).precioNetoTotal).toBe(400);
  });
  it('aplica el margen propio de cada bloque compuesto y un único descuento', () => {
    const r = service.aplicarCompuesto({
      costoTotal: 700,
      cantidad: 1,
      precioConfigPadre: fijo,
      impuestos: [iva],
      comisiones: [],
      descuento: { tipo: 'PORCENTAJE', valor: 10 },
      bloques: [
        {
          codigo: 'GENERAL',
          nombre: 'Base',
          costoTotal: 500,
          cantidad: 1,
          costosPasosTotales: {
            opcionales: 150,
            opcionalesSinMargen: 0,
            incluidosSinMargen: 0,
          },
          precioConfig: {
            ...fijo,
            detalle: { ...fijo.detalle, precioIncluyeIva: false },
          },
        },
        {
          codigo: 'hijo',
          nombre: 'Componente',
          costoTotal: 200,
          cantidad: 10,
          costosPasosTotales: {
            opcionales: 50,
            opcionalesSinMargen: 0,
            incluidosSinMargen: 0,
          },
          precioConfig: {
            metodoCalculo: 'precio_fijo',
            detalle: {
              price: 100,
              precioIncluyeIva: false,
              margenOpcionalesPct: 50,
            },
          },
        },
      ],
    });
    expect(r.bloques.map((b) => b.netoListaTotal)).toEqual([1200, 1100]);
    expect(r.precioNetoTotal).toBe(2070);
    expect(r.precioBrutoTotal).toBe(2504.7);
  });
  it('rechaza una suma de margen y cargas que hace imposible cotizar', () => {
    expect(() =>
      service.aplicar(
        base({
          precioConfig: {
            ...fijo,
            detalle: { price: 1000, margenOpcionalesPct: 99 },
          },
          comisiones: [
            {
              catalogoId: 'com',
              codigo: 'com',
              nombre: 'Comisión',
              porcentaje: 5,
              orden: 0,
            },
          ],
        }),
      ),
    ).toThrow('menor al 100%');
  });
  it.each([-1, 100, Infinity, NaN, '25', null])(
    'rechaza el margen inválido %s al guardar y al cotizar',
    (margenOpcionalesPct) => {
      const precioConfig = {
        ...fijo,
        detalle: { price: 1000, margenOpcionalesPct },
      };
      expect(() => validarMargenOpcionales(precioConfig)).toThrow(
        'margen de los opcionales',
      );
      expect(() => service.aplicar(base({ precioConfig }))).toThrow(
        'margen de los opcionales',
      );
    },
  );
});

describe('Clasificación del costo de pasos', () => {
  it('ignora inactivos y no cuenta dos veces etapas ni componentes anidados', () => {
    const r = costosPasosPrecio(
      [
        { activado: false, esOpcional: true, costoTotal: 900 },
        {
          activado: true,
          costoTotal: 200,
          cargosDirectosPaso: [{ aplicaMargen: false, monto: 20 }],
        },
        {
          activado: true,
          costoTotal: 300,
          operacionesInternas: [
            { activada: true, costoTotal: 100 },
            {
              activada: true,
              esOpcional: true,
              costoTotal: 200,
              cargosDirectosPaso: [{ aplicaMargen: false, monto: 40 }],
            },
          ],
        },
      ],
      [
        {
          pasos: [{ activado: true, esOpcional: true, costoTotal: 100 }],
          componentes: [
            { pasos: [{ activado: true, esOpcional: true, costoTotal: 50 }] },
          ],
        },
      ],
    );
    expect(r).toEqual({
      opcionales: 350,
      opcionalesSinMargen: 40,
      incluidosSinMargen: 20,
    });
  });
});
