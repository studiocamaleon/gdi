import { productoParaCotizacion } from '../producto-cotizacion-publico';
import { resolverPlanchaUtil } from '../../../../../src/lib/medida-plancha';
import { resolveNestingConfig } from '../../motor-universal/nesting-config';
import { runNestingForPaso } from '../../motor-universal/nesting-dispatcher';
import type { PasoCargado } from '../../motor-universal/tipos';

const maquina = {
  id: 'impresora-demo',
  nombre: 'Impresora ficticia',
  parametrosTecnicosJson: {
    margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 5, inf: 5 },
  },
};
const params = {
  nestingConfig: {
    margins: { leftMm: 25.8, rightMm: 25.8, topMm: 43, bottomMm: 25.8 },
    pieceBleedMm: 1.5,
    allowRotation: false,
  },
};
const material = {
  id: 'papel-demo',
  atributosVarianteJson: { anchoMm: 325, altoMm: 500 },
};

it('la plancha derivada del catálogo comercial coincide con el área útil real y entra una por pliego', async () => {
  const publico = productoParaCotizacion({
    paramsPasoJson: params,
    maquinaM1: maquina,
  }) as {
    paramsPasoJson: typeof params;
    maquinaM1: typeof maquina;
  };
  const plancha = resolverPlanchaUtil({
    pliegoAnchoMm: 325,
    pliegoAltoMm: 500,
    pasoParams: publico.paramsPasoJson,
    maquinaParametrosTecnicos: publico.maquinaM1.parametrosTecnicosJson,
  })!;
  const paso = {
    configPasoId: 'impresion-demo',
    familiaCodigo: 'impresion_por_hoja',
    paramsPasoJson: params,
    maquina,
    slots: [],
  } as unknown as PasoCargado;
  const config = resolveNestingConfig(paso, { cantidad: 1 }, material);
  expect(plancha.anchoMm).toBeCloseTo(270.4);
  expect(plancha.altoMm).toBeCloseTo(428.2);
  expect(plancha.anchoMm).toBeCloseTo(
    325 - config.margins.leftMm - config.margins.rightMm,
  );
  expect(plancha.altoMm).toBeCloseTo(
    500 - config.margins.topMm - config.margins.bottomMm,
  );
  const nesting = await runNestingForPaso(
    paso,
    {
      cantidad: 3,
      piezas: [
        { cantidad: 3, anchoMm: plancha.anchoMm, altoMm: plancha.altoMm },
      ],
    },
    material,
  );
  expect(nesting).not.toBeNull();
  expect(nesting!.piezasPorPliego).toBe(1);
  expect(nesting!.cantidadCalculada).toBe(3);
  expect(nesting!.placements).toHaveLength(1); // un pliego patrón repetido tres veces
});

it('sólo conserva lados numéricos de los márgenes físicos y continúa ocultando valores económicos', () => {
  const publico = productoParaCotizacion({
    paramsPasoJson: {
      margin: 20,
      margins: { ganancia: 30 },
      marginPct: 25,
      margen: 40,
      nestingConfig: {
        margins: {
          leftMm: 0,
          rightMm: '2.5',
          topMm: 3,
          bottomMm: 4,
          price: 1200,
          cost: 900,
          profit: 50,
          left: { amount: 800 },
        },
        extraMargins: { leftMm: 2, costo: 999 },
        costing: { strategy: 'm2-exact', price: 50 },
      },
      niveles: [{ codigo: 'normal', margin: 30, margins: { ganancia: 50 } }],
    },
  }) as any;
  expect(publico.paramsPasoJson).toEqual({
    nestingConfig: {
      margins: { leftMm: 0, rightMm: '2.5', topMm: 3, bottomMm: 4 },
      extraMargins: { leftMm: 2 },
    },
    niveles: [{ codigo: 'normal' }],
  });
});
