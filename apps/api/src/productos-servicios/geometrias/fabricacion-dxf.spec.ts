import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { inspeccionarDxfNativo } from './dxf-nativo';
import { inspeccionarVector, interpretarVector } from './interpretar-vector';
import { recuperarCapasGuardadas } from './recuperar-capas';
import { adjuntarOperacionesGuardadas } from '../../motor-universal/geometria-vectorial/operaciones-vectoriales';
import { analizarSvgFabricacion } from '../../motor-universal/geometria-vectorial/svg-parser';
import {
  crearDemandasDesdeGeometriaVectorial,
  crearProblemaNestingIrregular,
  crearSolucionNestingIrregular,
} from '../../motor-universal/geometria-vectorial/contrato-nesting';
import { transformarFabricacion } from '../../motor-universal/geometria-vectorial/fabricacion-vectorial';
import {
  ExportarFabricacionController,
  type ExportarFabricacionDto,
} from './exportar-fabricacion.controller';
import type { PrismaService } from '../../prisma/prisma.service';
import type { StorageDriver } from '../../archivos/storage/storage.driver';
import type { CurrentAuth } from '../../auth/auth.types';
import type { NestingIrregularResult } from '../../motor-universal/geometria-vectorial/tipos';

const bytes = readFileSync(join(__dirname, 'fixtures/capas-visibles.dxf'));
const origen = {
  geometriaId: '25c86745-18f3-47fa-a39b-d2779dc8bc39',
  archivoId: '32c86745-18f3-47fa-a39b-d2779dc8bc39',
  nombreArchivo: 'capas.dxf',
  hash: createHash('sha256').update(bytes).digest('hex'),
};

describe('DXF conservado desde el original hasta fabricación', () => {
  let inspeccion: Awaited<ReturnType<typeof inspeccionarDxfNativo>>;
  beforeAll(async () => {
    inspeccion = await inspeccionarDxfNativo(bytes.toString('utf8'));
  });
  const seleccion = () => ({
    exteriorId: inspeccion.sugeridaId,
    unidad: 'cm',
    cerrarExterior: false,
    operaciones: [],
  });
  const fuente = () => interpretarVector(inspeccion, seleccion(), origen);

  it('recupera un DXF histórico sin cambiar silueta, operaciones ni procedencia', async () => {
    const anterior = inspeccionarVector(bytes.toString('utf8'), origen.nombreArchivo);
    const vieja = interpretarVector(anterior, { ...seleccion(), exteriorId: anterior.sugeridaId }, origen);
    delete vieja.fabricacion;
    const completa = await recuperarCapasGuardadas(vieja, bytes.toString('utf8'));
    expect({ ...completa, fabricacion: undefined }).toEqual(vieja);
    expect(completa.fabricacion?.dxfNativo).toBe(true);
    expect(completa.fabricacion?.entidades.some(e => e.capa === 'DOBLEZ' && e.conservar && e.rol === null)).toBe(true);
    expect(vieja.fabricacion).toBeUndefined();
    await expect(recuperarCapasGuardadas({ ...vieja, altoFinalMm: vieja.altoFinalMm + 5 }, bytes.toString('utf8'))).rejects.toThrow(/certeza/);
  });

  it('conserva las referencias y sus medidas sin clasificarlas ni alterar la silueta o el costo', () => {
    const f = fuente();
    expect(f.operaciones).toEqual([]);
    expect(f.fabricacion?.entidades).toHaveLength(6);
    expect(f.fabricacion?.entidades.every((e) => e.conservar)).toBe(true);
    expect(
      f.fabricacion?.entidades.find((e) => e.capa === 'DOBLEZ'),
    ).toMatchObject({
      rol: null,
      longitudMm: 300,
      precisionLongitud: 'EXACTA',
      puntos: [
        { x: 100, y: 500 },
        { x: 400, y: 500 },
      ],
    });
    const g = analizarSvgFabricacion({
      svg: f.svg,
      anchoFinalMm: f.anchoFinalMm,
    }).geometria;
    const nueva = adjuntarOperacionesGuardadas(g, f);
    expect(nueva.perimetroTotalMm).toBe(g.perimetroTotalMm);
    expect(nueva.areaTotalMm2).toBe(g.areaTotalMm2);
    expect(nueva.hashFuente).not.toBe(g.hashFuente);
    const excluida = interpretarVector(
      inspeccion,
      {
        ...seleccion(),
        excluidas: [inspeccion.entidades.find((e) => e.capa === 'DOBLEZ')!.id],
      },
      origen,
    );
    expect(adjuntarOperacionesGuardadas(g, excluida).hashFuente).not.toBe(
      nueva.hashFuente,
    );
  });

  it('valida exclusiones y conserva la distinción entre operación y referencia', () => {
    const entidadId = inspeccion.entidades.find((e) => e.capa === 'DOBLEZ')!.id;
    const f = interpretarVector(
      inspeccion,
      { ...seleccion(), operaciones: [{ entidadId, tipo: 'HENDIDO' }] },
      origen,
    );
    expect(f.operaciones).toHaveLength(1);
    expect(
      f.fabricacion?.entidades.find((e) => e.entidadId === entidadId)?.rol,
    ).toBe('HENDIDO');
    expect(() =>
      interpretarVector(
        inspeccion,
        { ...seleccion(), excluidas: [inspeccion.sugeridaId] },
        origen,
      ),
    ).toThrow(/exclusión/);
    expect(() =>
      interpretarVector(
        inspeccion,
        {
          ...seleccion(),
          excluidas: [entidadId],
          operaciones: [{ entidadId, tipo: 'HENDIDO' }],
        },
        origen,
      ),
    ).toThrow(/operaciones/);
    expect(() =>
      interpretarVector(
        inspeccion,
        { ...seleccion(), excluidas: ['inexistente'] },
        origen,
      ),
    ).toThrow(/exclusión/);
  });

  it.each([0, 90, 180, 270])(
    'propaga todas las referencias con giro %s sin doble transformación',
    (angulo) => {
      const f = fuente();
      const g = adjuntarOperacionesGuardadas(
        analizarSvgFabricacion({ svg: f.svg, anchoFinalMm: f.anchoFinalMm })
          .geometria,
        f,
      );
      const problema = crearProblemaNestingIrregular({
        anchoPlacaMm: 3000,
        altoPlacaMm: 3000,
        demandas: crearDemandasDesdeGeometriaVectorial({
          geometria: g,
          cantidad: 2,
        }),
      });
      const resultado = {
        algorithm: 'irregular-2d-bottom-left-v1',
        perimetroCorteMm: 6400,
        placements: [
          {
            pieceId: g.piezas[0].id,
            copyIndex: 0,
            substrateIndex: 0,
            xMm: 10,
            yMm: 20,
            rotacion: angulo,
            anchoMm: 1000,
            altoMm: 600,
            contornos: [],
          },
        ],
      } as unknown as NestingIrregularResult;
      const s = crearSolucionNestingIrregular(problema, resultado);
      expect(s.resultado.placements[0].fabricacion?.entidades).toHaveLength(6);
      expect(
        crearSolucionNestingIrregular(problema, s.resultado).resultado,
      ).toEqual(s.resultado);
      expect(s.resultado.perimetroCorteMm).toBe(6400);
      expect(f.fabricacion?.transformacion).toEqual([1, 0, 0, 1, 0, 0]);
    },
  );

  it('exporta por tenant, relee el original y rechaza un archivo alterado', async () => {
    const f = fuente();
    const db = {
      geometriaProducto: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: origen.geometriaId,
            hash: origen.hash,
            fuenteJson: f,
            archivo: {
              tenantId: 'tenant',
              bytes: BigInt(bytes.length),
              key: 'original',
            },
          },
        ]),
      },
    };
    const storage = { leer: jest.fn().mockResolvedValue(bytes) };
    const c = new ExportarFabricacionController(
      db as unknown as PrismaService,
      storage as unknown as StorageDriver,
      {
        exigirTodas: jest.fn().mockResolvedValue(undefined),
        exigir: jest.fn().mockResolvedValue(undefined),
        puedeOperar: jest.fn().mockResolvedValue(true),
      } as never,
    );
    const request: ExportarFabricacionDto = {
      altoMm: 2000,
      baseDxf:
        '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1024\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n',
      instancias: [
        {
          geometriaId: origen.geometriaId,
          archivoHash: origen.hash,
          soloComplementos: false,
          transformacion: transformarFabricacion(f.fabricacion, 90, {
            x: 1500,
            y: 20,
          })!.transformacion,
        },
      ],
    };
    const r = await c.exportar({ tenantId: 'tenant' } as CurrentAuth, request);
    expect(r.dxf).toContain('DOBLEZ');
    expect(r.dxf).toContain('ARC');
    expect(r.dxf).toContain('CIRCLE');
    expect(r.dxf).toContain('Doblar aquí');
    expect(db.geometriaProducto.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant', id: { in: [origen.geometriaId] } },
      include: { archivo: true },
    });
    storage.leer.mockResolvedValue(Buffer.from('alterado'));
    await expect(
      c.exportar({ tenantId: 'tenant' } as CurrentAuth, request),
    ).rejects.toThrow(/original cambió/);
    db.geometriaProducto.findMany.mockResolvedValue([]);
    await expect(
      c.exportar({ tenantId: 'otro' } as CurrentAuth, request),
    ).rejects.toThrow(/esta cuenta/);
  });
});
