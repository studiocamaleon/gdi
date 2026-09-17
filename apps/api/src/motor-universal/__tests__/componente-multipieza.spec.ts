import {
  resolverJobContextComponente,
  leerConfiguracionComponente,
} from '../../productos-servicios/componentes-configuracion';
import { geometriaDeColeccion } from '../geometria-vectorial/geometria-coleccion';
import { crearDemandasDesdeGeometriaVectorial } from '../geometria-vectorial/contrato-nesting';
import { resolverFuentesProducto } from '../../productos-servicios/geometrias/resolver-fuentes';
import type { JobContext } from '../tipos';
import { runNestingForPaso } from '../nesting-dispatcher';
import { resolverProblemaNestingIrregular } from '../geometria-vectorial/contrato-nesting';

const piezas = [
  'Cuerpo',
  'Soporte',
  'Faldon',
  'Estante',
  'Costilla',
  'Header',
].map((nombre, i) => ({
  id: nombre,
  nombre,
  cantidadPorUnidad: i === 3 ? 4 : 1,
  fuente: {
    schemaVersion: 2,
    nombreArchivo: `${nombre}.dxf`,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><path d="M0 0H10V20H0Z"/></svg>',
    anchoFinalMm: 10,
    altoFinalMm: 20,
    operaciones: [],
    procedencia: {
      version: 1,
      geometriaId: `22222222-2222-4222-8222-${String(i).padStart(12, '0')}`,
      archivoId: '33333333-3333-4333-8333-333333333333',
      hash: 'a'.repeat(64),
      capa: 'CORTE_3',
    },
  },
}));
const config = {
  version: 1,
  piezas,
  bindings: [
    { clave: 'cantidad', origen: 'PADRE', padreClave: 'cantidad' },
    { clave: 'disenoVectorialFuente', origen: 'COTIZACION', requerido: true },
    { clave: 'medidaCustomMm.anchoMm', origen: 'COTIZACION', requerido: true },
  ],
};

describe('un componente con varias piezas', () => {
  it('optimiza la colección una sola vez y conserva los contornos exactos al cortar', async () => {
    const ctx = resolverJobContextComponente({
      configuracion: config,
      contextoPadre: { cantidad: 1 },
      codigoComponente: 'CORRUGADO',
      cantidadLegacy: 1,
    }) as unknown as JobContext;
    ctx.geometriaVectorial = geometriaDeColeccion(ctx);
    const material = {
      id: 'placa',
      subfamilia: 'SUSTRATO_RIGIDO',
      atributosVarianteJson: { anchoMm: 100, altoMm: 100 },
    };
    const params = {
      usarDisenoVectorial: true,
      nestingConfig: {
        allowRotation: true,
        separationHMm: 0,
        separationVMm: 0,
      },
    };
    const imprimir = {
      familiaCodigo: 'impresion_por_area',
      paramsPasoJson: params,
      slots: [],
      maquina: {
        parametrosTecnicosJson: { geometria: 'MESA_EXTENSORA' },
        anchoUtil: 100,
        largoUtil: 100,
      },
    };
    const resolver = jest.fn(async ({ problema, coleccion }) => {
      expect(coleccion).toBe(true);
      return resolverProblemaNestingIrregular(problema);
    });
    const imp = await runNestingForPaso(
      imprimir as never,
      ctx,
      material as never,
      { resolveIrregularNesting: resolver },
    );
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(imp?.algorithm).toBe('irregular-2d-bottom-left-v1');
    expect(imp?.placements).toHaveLength(9);
    ctx.layout_produccion = {
      schemaVersion: 1,
      sourceRutaPasoId: 'imp',
      sourceConfigPasoId: 'imp',
      sourceFamiliaCodigo: 'impresion_por_area',
      materialVarianteId: 'placa',
      algorithm: imp!.algorithm,
      substrates: imp!.substrates,
      placements: imp!.placements,
      visualConfig: imp!.visualConfig,
    };
    const corte = await runNestingForPaso(
      { ...imprimir, familiaCodigo: 'corte_laser' } as never,
      ctx,
      material as never,
      { resolveIrregularNesting: resolver },
    );
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(corte?.placements).toHaveLength(9);
    expect(
      corte?.placements.map(
        (p) => (p.meta as { contornos: unknown }).contornos,
      ),
    ).toEqual(
      imp!.placements.map((p) => (p.meta as { contornos: unknown }).contornos),
    );
    expect(corte?.cantidadCalculada).toBe(imp?.cantidadCalculada);
  });
  it.each([1, 10, 50, 51])(
    'multiplica cada diseño una sola vez para %i productos, sin pedir el vector individual',
    (cantidad) => {
      const ctx = resolverJobContextComponente({
        configuracion: config,
        contextoPadre: { cantidad },
        codigoComponente: 'CORRUGADO',
        cantidadLegacy: 1,
      }) as unknown as JobContext;
      expect(ctx.cantidad).toBe(cantidad);
      const geometria = geometriaDeColeccion(ctx);
      const demandas = crearDemandasDesdeGeometriaVectorial({
        geometria,
        cantidad,
      });
      expect(demandas.map((d) => d.cantidad)).toEqual([
        cantidad,
        cantidad,
        cantidad,
        4 * cantidad,
        cantidad,
        cantidad,
      ]);
      expect(new Set(demandas.map((d) => d.id)).size).toBe(6);
      expect(demandas[3].propietario).toMatchObject({
        piezaNombre: 'Estante',
        archivoFuente: 'Estante.dxf',
        interpretacion: { capa: 'CORTE_3' },
      });
      expect(geometria.areaTotalMm2 * cantidad).toBeCloseTo(200 * 9 * cantidad);
      expect(geometria.perimetroTotalMm * cantidad).toBeCloseTo(
        60 * 9 * cantidad,
      );
    },
  );
  it.each([0, -1, 1.5, 10001, Number.NaN])(
    'rechaza cantidad por pieza inválida %s',
    (cantidadPorUnidad) => {
      expect(
        leerConfiguracionComponente({
          ...config,
          piezas: [{ ...piezas[0], cantidadPorUnidad }],
        }),
      ).toBeNull();
    },
  );
  it('no acepta identidades duplicadas ni una colección vacía', () => {
    expect(
      leerConfiguracionComponente({
        ...config,
        piezas: [piezas[0], piezas[0]],
      }),
    ).toBeNull();
    expect(leerConfiguracionComponente({ ...config, piezas: [] })).toBeNull();
  });
  it('rehidrata los archivos del componente y rechaza referencias de otra cuenta', async () => {
    const db = {
      geometriaProducto: {
        findMany: jest.fn().mockResolvedValue(
          piezas.map((p) => ({
            id: p.fuente.procedencia.geometriaId,
            archivoId: p.fuente.procedencia.archivoId,
            hash: p.fuente.procedencia.hash,
            fuenteJson: p.fuente,
          })),
        ),
      },
    };
    const ctx = {
      cantidad: 50,
      disenosVectoriales: piezas.map((p) => ({
        ...p,
        fuente: { ...p.fuente, svg: 'adulterado' },
      })),
    } as unknown as JobContext;
    const result = await resolverFuentesProducto(
      db as never,
      'tenant',
      {},
      ctx,
    );
    expect(result.disenosVectoriales?.[0].fuente.svg).toBe(
      piezas[0].fuente.svg,
    );
    expect(db.geometriaProducto.findMany.mock.calls[0][0].where.tenantId).toBe(
      'tenant',
    );
    db.geometriaProducto.findMany.mockResolvedValue([]);
    await expect(
      resolverFuentesProducto(db as never, 'otro', {}, ctx),
    ).rejects.toThrow('esta cuenta');
  });
});
