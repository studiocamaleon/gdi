import { resolverJobContextComponente } from '../../productos-servicios/componentes-configuracion';
import { geometriaDeColeccion } from '../geometria-vectorial/geometria-coleccion';
import { crearDemandasDesdeGeometriaVectorial } from '../geometria-vectorial/contrato-nesting';
import { runNestingForPaso } from '../nesting-dispatcher';
import type { JobContext } from '../tipos';

const piezas = [1, 2].map((cantidadPorUnidad, i) => ({
  id: `letras${i + 1}`,
  nombre: `Letras${i + 1}`,
  cantidadPorUnidad,
  fuente: {
    schemaVersion: 1 as const,
    nombreArchivo: `letras${i + 1}.svg`,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><path d="M0 0H100V60H0Z"/></svg>',
    anchoFinalMm: 100,
    altoFinalMm: 60,
  },
}));
const configuracion = {
  version: 1,
  bindings: [
    { clave: 'cantidad', origen: 'PADRE', padreClave: 'cantidad' },
    { clave: 'medidaCustomMm.anchoMm', origen: 'COTIZACION', requerido: true },
    { clave: 'medidaCustomMm.altoMm', origen: 'COTIZACION', requerido: true },
    {
      clave: 'disenoVectorialFuente',
      origen: 'PADRE',
      requerido: true,
      regla: {
        operador: 'COPIAR',
        campoPadre: 'geometriasVectoriales.principal',
        fuente: { tipo: 'PADRE', campo: 'geometriasVectoriales.principal' },
      },
    },
  ],
};
const resolver = (
  cantidad = 1,
  config: unknown = configuracion,
  contexto: Record<string, unknown> = {},
) =>
  resolverJobContextComponente({
    configuracion: config,
    codigoComponente: 'FRENTE',
    cantidadLegacy: 1,
    contextoPadre: {
      cantidad,
      geometriasVectoriales: { principal: piezas[0].fuente },
      coleccionesVectoriales: { principal: piezas },
      ...contexto,
    },
  }) as unknown as JobContext;

describe('diseños del padre heredados como colección', () => {
  it.each([1, 10])(
    'entrega los dos archivos a Polyfan y acrílico para %i productos',
    async (cantidad) => {
      const resultados = [];
      for (const [familiaCodigo, ancho, alto] of [
        ['corte_hilo_caliente', 1200, 600],
        ['corte_laser', 1220, 1220],
      ] as const) {
        const ctx = resolver(cantidad);
        expect(ctx.cantidad).toBe(cantidad);
        expect(ctx.disenosVectoriales).toEqual(piezas);
        expect(ctx.disenoVectorialFuente).toBeUndefined();
        expect(ctx.medidaCustomMm).toEqual({ anchoMm: 100, altoMm: 60 });
        ctx.geometriaVectorial = geometriaDeColeccion(ctx);
        const demandas = crearDemandasDesdeGeometriaVectorial({
          geometria: ctx.geometriaVectorial,
          cantidad,
        });
        expect(demandas.map((d) => d.cantidad)).toEqual([
          cantidad,
          cantidad * 2,
        ]);
        const n = await runNestingForPaso(
          {
            familiaCodigo,
            paramsPasoJson: {
              usarDisenoVectorial: true,
              nestingConfig: {
                allowRotation: true,
                separationHMm: 2,
                separationVMm: 2,
              },
            },
            slots: [],
            maquina: { anchoUtil: ancho, largoUtil: alto },
          } as never,
          ctx,
          {
            id: familiaCodigo,
            subfamilia: 'SUSTRATO_RIGIDO',
            atributosVarianteJson: { anchoMm: ancho, altoMm: alto },
          } as never,
        );
        expect(n?.piezasAcomodadas).toBe(cantidad * 3);
        expect(new Set(n?.placements.map((p) => p.pieceId)).size).toBe(2);
        resultados.push(n);
      }
      expect(resultados[0]?.substrates[0]).toMatchObject({
        widthMm: 1200,
        heightMm: 600,
      });
      expect(resultados[1]?.substrates[0]).toMatchObject({
        widthMm: 1220,
        heightMm: 1220,
      });
    },
  );
  it('respeta el multiplicador del componente sin multiplicar de nuevo las copias por archivo', () => {
    const config = structuredClone(configuracion);
    config.bindings[0] = {
      clave: 'cantidad',
      origen: 'FORMULA',
      regla: { operador: 'MULTIPLICAR', campoPadre: 'cantidad', valor: 2 },
    } as never;
    const ctx = resolver(10, config);
    expect(ctx.cantidad).toBe(20);
    expect(ctx.piezas?.map((p) => p.cantidad)).toEqual([20, 40]);
  });
  it('no cambia archivos nombrados distintos, bindings particulares ni piezas de receta', () => {
    const otra = resolver(1, configuracion, {
      coleccionesVectoriales: { soporte: piezas },
    });
    expect(otra.disenosVectoriales).toBeUndefined();
    expect(otra.disenoVectorialFuente).toEqual(piezas[0].fuente);
    const fijas = piezas.map((p) => ({
      ...p,
      fuente: {
        ...p.fuente,
        schemaVersion: 2,
        procedencia: { geometriaId: 'guardada' },
      },
    }));
    const ctx = resolver(10, { ...configuracion, piezas: fijas });
    expect(ctx.disenosVectoriales).toEqual(fijas);
    const particular = {
      ...configuracion,
      bindings: configuracion.bindings.map((b) =>
        b.clave === 'disenoVectorialFuente'
          ? { clave: b.clave, origen: 'COTIZACION' }
          : b,
      ),
    };
    expect(
      resolver(1, particular, {
        componentesConfiguracion: {
          FRENTE: { disenoVectorialFuente: piezas[1].fuente },
        },
      }).disenoVectorialFuente,
    ).toEqual(piezas[1].fuente);
  });
  it('mantiene el archivo individual de las cotizaciones anteriores y aísla los hijos', () => {
    expect(
      resolver(1, configuracion, { coleccionesVectoriales: undefined })
        .disenoVectorialFuente,
    ).toEqual(piezas[0].fuente);
    const a = resolver(),
      b = resolver();
    a.disenosVectoriales![0].fuente.anchoFinalMm = 999;
    expect(b.disenosVectoriales![0].fuente.anchoFinalMm).toBe(100);
    expect(piezas[0].fuente.anchoFinalMm).toBe(100);
  });
  it.each(
    [[], [{ ...piezas[0], cantidadPorUnidad: 0 }], [piezas[0], piezas[0]]].map(
      (coleccion) => ({ coleccion }),
    ),
  )(
    'rechaza una colección inválida sin caer silenciosamente al primer archivo',
    ({ coleccion }) => {
      expect(() =>
        resolver(1, configuracion, {
          coleccionesVectoriales: { principal: coleccion },
        }),
      ).toThrow('Revisá los archivos');
    },
  );
});
