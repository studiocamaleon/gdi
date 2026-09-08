import {
  leerConfiguracionComponente,
  resolverJobContextComponente,
  resolverOcurrenciasCotizadasComponente,
} from '../../productos-servicios/componentes-configuracion';
import type { JobContext } from '../tipos';
import { runNestingForPaso } from '../nesting-dispatcher';

const piezas = [
  {
    id: 'frente',
    tipo: 'RECTANGULAR',
    nombre: 'Frente',
    cantidadPorUnidad: 2,
    medidas: { anchoMm: 300, altoMm: 400 },
  },
  {
    id: 'lateral',
    tipo: 'RECTANGULAR',
    nombre: 'Lateral',
    cantidadPorUnidad: 1,
    medidas: { anchoMm: 600, altoMm: 200 },
  },
];
const configuracion = {
  version: 2,
  piezas,
  piezasEditables: true,
  bindings: [
    { clave: 'cantidad', origen: 'PADRE', padreClave: 'cantidad' },
    { clave: 'medidaCustomMm.anchoMm', origen: 'COTIZACION', requerido: true },
    {
      clave: 'medidaCustomMm.altoMm',
      origen: 'FIJO',
      valor: 999,
      requerido: true,
    },
    { clave: 'modoColor_impresion', origen: 'FIJO', valor: 'CMYK' },
  ],
};
const resolver = (
  cantidad: number,
  overrides?: Record<string, unknown>,
  config: unknown = configuracion,
) =>
  resolverJobContextComponente({
    configuracion: config,
    contextoPadre: { cantidad },
    codigoComponente: 'VINILO',
    cantidadLegacy: 1,
    overrideCotizacion: overrides,
  }) as unknown as JobContext;

describe('piezas rectangulares de un componente', () => {
  it.each([1, 10, 50])(
    'calcula las medidas independientes y cantidades de %i kits una sola vez',
    (cantidad) => {
      const ctx = resolver(cantidad);
      expect(ctx.cantidad).toBe(cantidad);
      expect(ctx.piezas).toMatchObject([
        {
          sourcePieceId: 'frente',
          nombre: 'Frente',
          cantidad: cantidad * 2,
          cantidadPorUnidad: 2,
          anchoMm: 300,
          altoMm: 400,
        },
        {
          sourcePieceId: 'lateral',
          nombre: 'Lateral',
          cantidad,
          cantidadPorUnidad: 1,
          anchoMm: 600,
          altoMm: 200,
        },
      ]);
      expect(ctx.piezaAreaTotalM2).toBeCloseTo(0.36 * cantidad);
      expect(ctx.piezaPerimetroTotalM).toBeCloseTo(4.4 * cantidad);
      expect(ctx.disenosVectoriales).toBeUndefined();
      expect(ctx.modoCotizacionVectorial).toBe('medidas');
      expect(ctx.modoColor_impresion).toBe('CMYK');
    },
  );
  it('aplica los cambios al cotizar sin mutar las piezas del producto', () => {
    const antes = structuredClone(configuracion);
    const ctx = resolver(3, {
      piezas: [
        {
          ...piezas[0],
          cantidadPorUnidad: 5,
          medidas: { anchoMm: 250, altoMm: 100 },
        },
      ],
    });
    expect(ctx.piezas).toHaveLength(1);
    expect(ctx.piezas![0]).toMatchObject({
      cantidad: 15,
      anchoMm: 250,
      altoMm: 100,
    });
    expect(ctx.piezaAreaTotalM2).toBeCloseTo(0.375);
    expect(configuracion).toEqual(antes);
    expect(() =>
      resolver(3, { piezas }, { ...configuracion, piezasEditables: false }),
    ).toThrow('definidas por el producto');
  });
  it.each([0, -1, Infinity, NaN, 1000001, '300'])(
    'rechaza ancho inválido %s tanto en la receta como al cotizar',
    (anchoMm) => {
      const invalidas = [{ ...piezas[0], medidas: { anchoMm, altoMm: 200 } }];
      expect(
        leerConfiguracionComponente({ ...configuracion, piezas: invalidas }),
      ).toBeNull();
      expect(() => resolver(1, { piezas: invalidas })).toThrow(
        'Revisá las piezas',
      );
    },
  );
  it.each([0, -1, 1.5, 10001, NaN])(
    'rechaza cantidades por producto inválidas %s',
    (cantidadPorUnidad) => {
      expect(
        leerConfiguracionComponente({
          ...configuracion,
          piezas: [{ ...piezas[0], cantidadPorUnidad }],
        }),
      ).toBeNull();
    },
  );
  it('rechaza una lista vacía, identidades repetidas, fuentes vectoriales y exceso de filas', () => {
    for (const invalidas of [
      [],
      [piezas[0], piezas[0]],
      Array.from({ length: 31 }, (_, i) => ({ ...piezas[0], id: `p${i}` })),
      [{ ...piezas[0], fuente: { procedencia: { geometriaId: 'otro' } } }],
    ]) {
      expect(
        leerConfiguracionComponente({ ...configuracion, piezas: invalidas }),
      ).toBeNull();
    }
  });
  it('conserva colecciones distintas dentro de grupos adicionales', () => {
    const config = {
      ...configuracion,
      repeticion: { version: 1, permitida: true, minimo: 0, maximo: 20 },
    };
    const contextoPadre = {
      cantidad: 2,
      componentesConfiguracion: {
        VINILO: {
          __ocurrenciasAdicionales: [
            {
              id: 'sucursal-a',
              nombre: 'Sucursal A',
              valores: { piezas: [piezas[0]] },
            },
            {
              id: 'sucursal-b',
              nombre: 'Sucursal B',
              valores: { piezas: [piezas[1]] },
            },
          ],
        },
      },
    };
    const ocurrencias = resolverOcurrenciasCotizadasComponente({
      configuracion: config,
      contextoPadre,
      codigoComponente: 'VINILO',
      nombreComponente: 'Vinilos',
    });
    expect(
      ocurrencias.map(
        (o) => resolver(2, o.overrideCotizacion, config).piezaAreaTotalM2,
      ),
    ).toEqual([0.48, 0.24]);
  });
  it.each(['ROLLO', 'MESA_EXTENSORA'])(
    'anida todas las piezas juntas en %s sin pedir archivos vectoriales',
    async (geometria) => {
      const ctx = resolver(3);
      const resultado = await runNestingForPaso(
        {
          familiaCodigo: 'impresion_por_area',
          paramsPasoJson: {
            nestingConfig: {
              allowRotation: true,
              separationHMm: 0,
              separationVMm: 0,
            },
          },
          slots: [],
          maquina: {
            parametrosTecnicosJson: {
              geometria,
              anchoMaxRolloMm: 1370,
              anchoMesaMm: 1370,
              largoMesaMm: 2000,
            },
            anchoUtil: 1370,
            largoUtil: 2000,
          },
        } as never,
        ctx,
        {
          id: 'vinilo',
          unidadStock: geometria === 'ROLLO' ? 'METRO_LINEAL' : 'UNIDAD',
          subfamilia:
            geometria === 'ROLLO' ? 'SUSTRATO_ROLLO' : 'SUSTRATO_HOJA',
          atributosVarianteJson: {
            anchoMm: 1370,
            ...(geometria === 'ROLLO'
              ? { largoRolloMm: 50000 }
              : { altoMm: 2000 }),
          },
        } as never,
      );
      expect(resultado).not.toBeNull();
      expect(resultado!.placements).toHaveLength(9);
      expect(
        resultado!.placements.filter((p) => p.pieceId === 'frente'),
      ).toHaveLength(6);
      expect(
        resultado!.placements.filter((p) => p.pieceId === 'lateral'),
      ).toHaveLength(3);
      expect(
        new Set(
          resultado!.placements.map(
            (p) => (p.meta as { label?: string })?.label,
          ),
        ),
      ).toEqual(new Set(['Frente', 'Lateral']));
    },
  );
});
