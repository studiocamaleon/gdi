import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inspeccionarVector, interpretarVector } from './interpretar-vector';
import {
  resolverFuentesProducto,
  atributosDeRevision,
} from './resolver-fuentes';
import type { PrismaService } from '../../prisma/prisma.service';
import { resolverJobContextComponente } from '../componentes-configuracion';

const archivo = readFileSync(
  join(
    __dirname,
    '../../motor-universal/geometria-vectorial/fixtures/exhibidor-capa-congelada.dxf',
  ),
  'utf8',
);
const origen = {
  nombreArchivo: 'estante.dxf',
  archivoId: '33333333-3333-4333-8333-333333333333',
  geometriaId: '11111111-1111-4111-8111-111111111111',
  hash: 'a'.repeat(64),
};

describe('geometrías reutilizables del producto', () => {
  it('conserva las coordenadas de un SVG cuyo viewBox tiene espacio alrededor', () => {
    const i = inspeccionarVector(
      '<svg viewBox="0 0 200 200"><path d="M50 40 H150 V100 H50 Z"/></svg>',
      'pieza.svg',
    );
    const f = interpretarVector(
      i,
      {
        exteriorId: i.sugeridaId,
        unidad: 'mm',
        cerrarExterior: false,
        operaciones: [],
      },
      origen,
    );
    expect(f.anchoFinalMm).toBeCloseTo(100);
    expect(f.altoFinalMm).toBeCloseTo(60);
  });
  it('descarta la capa congelada y exige confirmar unidades y cierre del exterior', () => {
    const i = inspeccionarVector(archivo, 'estante.dxf');
    const e = i.entidades.find((e) => e.id === i.sugeridaId)!;
    expect(i.unidadDeclarada).toBeNull();
    expect(e.ancho).toBeCloseTo(293.06512, 3);
    const seleccion = {
      exteriorId: e.id,
      unidad: '',
      cerrarExterior: false,
      operaciones: [],
    };
    expect(() => interpretarVector(i, seleccion, origen)).toThrow(/unidad/);
    const f = interpretarVector(
      i,
      { ...seleccion, unidad: 'pt', cerrarExterior: true },
      origen,
    );
    expect(f.anchoFinalMm).toBeCloseTo(103.387, 2);
    expect(f.altoFinalMm).toBeCloseTo(176.19, 2);
    expect(f.procedencia.capa).toBeTruthy();
    expect((f.svg.match(/<path/g) ?? []).length).toBe(1);
  });
  it('no cierra silenciosamente un contorno abierto ni utiliza operaciones como huecos de nesting', () => {
    const inspeccion = {
      formato: 'DXF' as const,
      unidadDeclarada: null,
      sugeridaId: 'a',
      avisos: [],
      entidades: [
        {
          id: 'a',
          capa: 'CORTE_3',
          puntos: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
          cerrada: false,
          apertura: 100,
          area: 10000,
          ancho: 100,
          alto: 100,
        },
        {
          id: 'b',
          capa: 'CORTE_3',
          puntos: [
            { x: 50, y: 10 },
            { x: 50, y: 90 },
          ],
          cerrada: false,
          apertura: 80,
          area: 0,
          ancho: 0,
          alto: 80,
        },
      ],
    };
    const seleccion = {
      exteriorId: 'a',
      unidad: 'mm',
      cerrarExterior: false,
      operaciones: [{ entidadId: 'b', tipo: 'HENDIDO' as const }],
    };
    expect(() => interpretarVector(inspeccion, seleccion, origen)).toThrow(
      /abierto/,
    );
    const f = interpretarVector(
      inspeccion,
      { ...seleccion, cerrarExterior: true },
      origen,
    );
    expect(f.operaciones[0].puntos).toEqual(inspeccion.entidades[1].puntos);
    expect(f.svg).not.toContain('50,10');
    expect(f.procedencia.aperturaOriginalMm).toBe(100);
  });
  it('restaura la interpretación histórica, relee sus bytes canónicos y no acepta referencias de otro tenant', async () => {
    const v1 = interpretarVector(
      inspeccionarVector(archivo, 'a.dxf'),
      {
        exteriorId: inspeccionarVector(archivo, 'a.dxf').sugeridaId,
        unidad: 'pt',
        cerrarExterior: true,
        operaciones: [],
      },
      origen,
    );
    const v2 = {
      ...v1,
      anchoFinalMm: 200,
      procedencia: {
        ...v1.procedencia,
        geometriaId: '22222222-2222-4222-8222-222222222222',
      },
    };
    const db = {
      geometriaProducto: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: origen.geometriaId,
            archivoId: origen.archivoId,
            hash: origen.hash,
            fuenteJson: v1,
          },
          {
            id: v2.procedencia.geometriaId,
            archivoId: origen.archivoId,
            hash: origen.hash,
            fuenteJson: v2,
          },
        ]),
      },
    } as unknown as PrismaService;
    const attrs = {
      geometriasComerciales: {
        version: 1,
        modo: 'VECTORIAL',
        fuentes: [
          {
            id: 'principal',
            nombre: 'Estante',
            requerida: true,
            predeterminada: v2,
          },
        ],
      },
    };
    const recuperada = await resolverFuentesProducto(db, 'tenant', attrs, {
      cantidad: 50,
      geometriasVectoriales: { principal: { ...v1, svg: 'adulterado' } },
    });
    expect(
      (recuperada.geometriasVectoriales as Record<string, unknown>).principal,
    ).toEqual(v1);
    expect(recuperada.disenoVectorialFuente?.anchoFinalMm).toBeCloseTo(
      103.387,
      2,
    );
    expect(db.geometriaProducto.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant', id: { in: [origen.geometriaId] } },
    });
    (db.geometriaProducto.findMany as jest.Mock).mockResolvedValue([]);
    await expect(
      resolverFuentesProducto(db, 'otro', attrs, { cantidad: 50 }),
    ).rejects.toThrow(/esta cuenta/);
    await expect(
      resolverFuentesProducto(db, 'tenant', attrs, {
        cantidad: 1,
        disenoVectorialFuente: {
          schemaVersion: 1,
          svg: '<svg/>',
          nombreArchivo: 'reemplazo.svg',
          anchoFinalMm: 100,
        },
      }),
    ).rejects.toThrow(/medidas fijas/);
    expect(
      atributosDeRevision(
        { producto: { atributosComercialesJson: { antigua: true } } },
        attrs,
      ),
    ).toEqual({ antigua: true });
  });
  it.each([1, 10, 50, 51])(
    'multiplica piezas por producto una sola vez para %s exhibidores',
    (cantidad) => {
      const fuente = interpretarVector(
        inspeccionarVector(archivo, 'a.dxf'),
        {
          exteriorId: inspeccionarVector(archivo, 'a.dxf').sugeridaId,
          unidad: 'pt',
          cerrarExterior: true,
          operaciones: [],
        },
        origen,
      );
      const ctx = resolverJobContextComponente({
        codigoComponente: 'estante',
        cantidadLegacy: 4,
        contextoPadre: { cantidad, geometriasVectoriales: { estante: fuente } },
        configuracion: {
          version: 1,
          bindings: [
            {
              clave: 'cantidad',
              origen: 'PADRE',
              regla: {
                campoPadre: 'cantidad',
                operador: 'MULTIPLICAR',
                valor: 4,
              },
            },
            {
              clave: 'disenoVectorialFuente',
              origen: 'PADRE',
              padreClave: 'geometriasVectoriales.estante',
            },
          ],
        },
      });
      expect(ctx.cantidad).toBe(cantidad * 4);
      expect(ctx.disenoVectorialFuente).toEqual(fuente);
    },
  );
});
