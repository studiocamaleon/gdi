import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import {
  detectarPiezasArchivo,
  compactarPiezaArchivo,
  separarPiezasArchivo,
  sugerirPiezasArchivo,
} from './piezas-archivo';
import { inspeccionarDxfNativo, ejecutarDxfNativo } from './dxf-nativo';
import {
  interpretarVector,
  type InspeccionVector,
  type SeleccionVector,
} from './interpretar-vector';
import { geometriaDeColeccion } from '../../motor-universal/geometria-vectorial/geometria-coleccion';
import {
  crearDemandasDesdeGeometriaVectorial,
  crearProblemaNestingIrregular,
  resolverProblemaNestingIrregular,
} from '../../motor-universal/geometria-vectorial/contrato-nesting';
import type { JobContext } from '../../motor-universal/tipos';

const contenido = readFileSync(
  join(__dirname, 'fixtures/multipieza-capas.dxf'),
  'utf8',
);
const hash = createHash('sha256').update(contenido).digest('hex');
const baseDxf =
  '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1024\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n';

describe('DXF con varias piezas hasta el nesting y la exportación', () => {
  let inspeccion: InspeccionVector;
  let seleccion: SeleccionVector & { exteriorIds: string[] };
  beforeAll(async () => {
    inspeccion = await inspeccionarDxfNativo(contenido);
    const exteriorIds = sugerirPiezasArchivo(inspeccion);
    seleccion = {
      exteriorId: exteriorIds[0],
      exteriorIds,
      unidad: 'mm',
      cerrarExterior: false,
      operaciones: inspeccion.entidades.flatMap((e) =>
        e.capa === 'HENDIDO'
          ? [{ entidadId: e.id, tipo: 'HENDIDO' as const }]
          : [],
      ),
      excluidas: [],
    };
  });
  const interpretarTodas = () =>
    separarPiezasArchivo(inspeccion, seleccion).map((p) =>
      compactarPiezaArchivo(
        interpretarVector(p.inspeccion, p.seleccion, {
          geometriaId: randomUUID(),
          archivoId: randomUUID(),
          nombreArchivo: 'multipieza.dxf',
          hash,
        }),
      ),
    );

  it('detecta dos letras, un símbolo exterior y su isla, sin importar los huecos como piezas', () => {
    const piezas = detectarPiezasArchivo(inspeccion);
    expect(piezas).toHaveLength(4);
    expect(piezas.reduce((n, p) => n + p.interioresIds.length, 0)).toBe(3);
    expect(seleccion.exteriorIds).toHaveLength(4);
    expect(
      new Set(
        piezas.map(
          (p) => inspeccion.entidades.find((e) => e.id === p.exteriorId)!.capa,
        ),
      ),
    ).toEqual(new Set(['CORTE', 'SIMBOLO']));
  });

  it('conserva cada entidad en una sola pieza y mantiene sus capas, colores y cortes internos', () => {
    const fuentes = interpretarTodas();
    const conservadas = fuentes.flatMap((f) =>
      f.fabricacion!.entidades.filter((e) => e.conservar),
    );
    expect(conservadas).toHaveLength(inspeccion.entidades.length);
    expect(new Set(conservadas.map((e) => e.entidadId)).size).toBe(
      conservadas.length,
    );
    for (const e of inspeccion.entidades)
      expect(conservadas.find((v) => v.entidadId === e.id)).toMatchObject({
        capa: e.capa,
        color: e.color,
      });
    expect(
      fuentes.flatMap((f) =>
        f.operaciones.filter((o) => o.tipo === 'CORTE_INTERIOR'),
      ),
    ).toHaveLength(3);
    expect(
      fuentes.flatMap((f) => f.operaciones.filter((o) => o.tipo === 'HENDIDO')),
    ).toHaveLength(2);
    for (const f of fuentes) {
      expect(
        f.procedencia.entidadesExcluidas!.length +
          f.fabricacion!.entidades.length,
      ).toBe(inspeccion.entidades.length);
      const ops = new Set(f.operaciones.map((o) => o.entidadId));
      expect(
        f
          .fabricacion!.entidades.filter((e) => !e.conservar)
          .some((e) => ops.has(e.entidadId)),
      ).toBe(false);
    }
  });

  it('envía todas las piezas y sus copias al nesting de ambos componentes', () => {
    const fuentes = interpretarTodas();
    for (const material of ['polyfan', 'acrilico']) {
      const ctx: JobContext = {
        cantidad: 2,
        disenosVectoriales: fuentes.map((fuente, i) => ({
          id: `pieza-${i}`,
          nombre: `${material} ${i}`,
          cantidadPorUnidad: 3,
          fuente,
        })),
      };
      const g = geometriaDeColeccion(ctx);
      expect(g.piezas).toHaveLength(4);
      expect(ctx.piezaHendidoTotalM).toBeCloseTo(0.96);
      const demandas = crearDemandasDesdeGeometriaVectorial({
        geometria: g,
        cantidad: ctx.cantidad,
      });
      expect(demandas.map((d) => d.cantidad)).toEqual([6, 6, 6, 6]);
      const solucion = resolverProblemaNestingIrregular(
        crearProblemaNestingIrregular({
          anchoPlacaMm: 1000,
          altoPlacaMm: 1000,
          demandas,
        }),
      );
      expect(solucion.resultado.placements).toHaveLength(24);
      expect(
        new Set(solucion.resultado.placements.map((p) => p.pieceId)).size,
      ).toBe(4);
      expect(solucion.resultado.placements.every((p) => !!p.fabricacion)).toBe(
        true,
      );
    }
  });

  it('exporta las piezas separadas sin repetir el archivo completo en cada posición', async () => {
    const fuentes = interpretarTodas();
    const exportado = await ejecutarDxfNativo<{ dxf: string }>({
      accion: 'exportar',
      baseDxf,
      altoMm: 1000,
      fuentes: fuentes.map((f, i) => ({
        id: f.procedencia.geometriaId,
        contenido,
        fabricacion: f.fabricacion,
        instancias: [
          {
            transformacion: [1, 0, 0, 1, 200 * i + 10, 10],
            soloComplementos: false,
          },
        ],
      })),
    });
    const inventario = await inspeccionarDxfNativo(exportado.dxf);
    expect(inventario.entidades).toHaveLength(inspeccion.entidades.length);
    for (const capa of [
      'CORTE',
      'SIMBOLO',
      'HENDIDO',
      'CORTE_PARCIAL',
      'REFERENCIA',
    ])
      expect(inventario.entidades.filter((e) => e.capa === capa)).toHaveLength(
        inspeccion.entidades.filter((e) => e.capa === capa).length,
      );
    const exteriores = inventario.entidades.filter((e) => e.area >= 10000);
    expect(exteriores).toHaveLength(2);
    expect(
      exteriores.map((e) => Math.min(...e.puntos.map((p) => p.x))),
    ).toEqual([10, 210]);
  });

  it('conserva las exclusiones al volver a revisar una de las piezas importadas', () => {
    const parte = separarPiezasArchivo(inspeccion, seleccion)[0];
    const original = interpretarTodas()[0];
    const revisada = interpretarVector(inspeccion, parte.seleccion, {
      ...original.procedencia,
      nombreArchivo: original.nombreArchivo,
    });
    expect(revisada.svg).toBe(original.svg);
    expect(
      revisada
        .fabricacion!.entidades.filter((e) => e.conservar)
        .map((e) => e.entidadId),
    ).toEqual(
      original
        .fabricacion!.entidades.filter((e) => e.conservar)
        .map((e) => e.entidadId),
    );
  });

  it('rechaza huecos como piezas, duplicados y trazos sin una pieza propietaria', () => {
    const hueco = detectarPiezasArchivo(inspeccion).flatMap(
      (p) => p.interioresIds,
    )[0];
    expect(() =>
      separarPiezasArchivo(inspeccion, { ...seleccion, exteriorIds: [hueco] }),
    ).toThrow(/interior/);
    expect(() =>
      separarPiezasArchivo(inspeccion, {
        ...seleccion,
        exteriorIds: [seleccion.exteriorId, seleccion.exteriorId],
      }),
    ).toThrow(/distintas/);
    const externa = {
      ...inspeccion.entidades.find((e) => e.capa === 'HENDIDO')!,
      id: 'externa',
      puntos: [
        { x: 1000, y: 1000 },
        { x: 1050, y: 1000 },
      ],
    };
    const conExterna = {
      ...inspeccion,
      entidades: [...inspeccion.entidades, externa],
    };
    expect(() => separarPiezasArchivo(conExterna, seleccion)).toThrow(
      /fuera de las piezas/,
    );
    expect(
      separarPiezasArchivo(conExterna, {
        ...seleccion,
        excluidas: ['externa'],
      }),
    ).toHaveLength(4);
  });
});
