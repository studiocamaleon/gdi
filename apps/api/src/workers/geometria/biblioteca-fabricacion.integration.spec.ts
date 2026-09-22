import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { BibliotecaPatronesService } from './biblioteca-patrones.service';
import { materializarPatrones, type Patron } from './cartera-patrones';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';
import { inspeccionarDxfNativo } from '../../productos-servicios/geometrias/dxf-nativo';
import { interpretarVector } from '../../productos-servicios/geometrias/interpretar-vector';
import { analizarSvgFabricacion } from '../../motor-universal/geometria-vectorial/svg-parser';
import {
  adjuntarOperacionesGuardadas,
  longitudOperacion,
} from '../../motor-universal/geometria-vectorial/operaciones-vectoriales';
import {
  crearDemandasDesdeGeometriaVectorial,
  crearProblemaNestingIrregular,
} from '../../motor-universal/geometria-vectorial/contrato-nesting';
import {
  prepararProblemaOpenNest,
  finalizarProblemaOpenNest,
} from '../../motor-universal/geometria-vectorial/opennest-adapter';
import { ExportarFabricacionController } from '../../productos-servicios/geometrias/exportar-fabricacion.controller';
import { convertirPackingSolver } from './packingsolver';
import { NestingsGuardadosService } from './nestings-guardados.service';
import { VERSION_POLITICA_ORIENTACION_GRAFONEST } from '../colas';

describe('biblioteca → cantidad nueva → fabricación con capas originales', () => {
  const db = new PrismaClient();
  const tenantId = randomUUID();
  beforeAll(async () => {
    await db.tenant.create({
      data: { id: tenantId, nombre: 'Fabricación reutilizada', slug: tenantId },
    });
  });
  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.$disconnect();
  });

  it.each(['patrones', 'packingsolver'])(
    'duplica la tirada desde %s, conserva hendido y referencias giradas y exporta un patrón',
    async (motor) => {
      const bytes = readFileSync(
        join(
          __dirname,
          '../../productos-servicios/geometrias/fixtures/capas-visibles.dxf',
        ),
      );
      const inspeccion = await inspeccionarDxfNativo(bytes.toString('utf8'));
      const origen = {
        geometriaId: randomUUID(),
        archivoId: randomUUID(),
        nombreArchivo: 'capas.dxf',
        hash: createHash('sha256').update(bytes).digest('hex'),
      };
      const hendido = inspeccion.entidades.find((e) => e.capa === 'DOBLEZ')!;
      const fuente = interpretarVector(
        inspeccion,
        {
          exteriorId: inspeccion.sugeridaId,
          unidad: 'cm',
          cerrarExterior: false,
          operaciones: [{ entidadId: hendido.id, tipo: 'HENDIDO' }],
        },
        origen,
      );
      const original = JSON.stringify(fuente);
      const geometria = adjuntarOperacionesGuardadas(
        analizarSvgFabricacion({
          svg: fuente.svg,
          anchoFinalMm: fuente.anchoFinalMm,
        }).geometria,
        fuente,
      );
      const preparar = (cantidad: number) =>
        prepararProblemaOpenNest({
          claveSemilla: 'fabricacion-biblioteca',
          problema: crearProblemaNestingIrregular({
            anchoPlacaMm: 3000,
            altoPlacaMm: 3000,
            margenMm: 20,
            separacionMm: 10,
            demandas: crearDemandasDesdeGeometriaVectorial({
              geometria,
              cantidad,
            }),
          }),
        });
      const contextoA = preparar(4),
        contextoB = preparar(8);
      const entrada = (contexto: typeof contextoA) => ({
        ...contexto.trabajo!,
        tenantId,
        correlationId: randomUUID(),
        solicitadoEl: new Date().toISOString(),
      });
      const a = entrada(contextoA),
        b = entrada(contextoB);
      const patron: Patron = {
        counts: [2],
        origen: 'prueba-fabricacion',
        placements: [
          {
            pieceId: a.piezas[0].id,
            xMm: 50,
            yMm: 50,
            widthMm: 1000,
            heightMm: 600,
            rotated: false,
          },
          {
            pieceId: a.piezas[0].id,
            xMm: 1500,
            yMm: 50,
            widthMm: 600,
            heightMm: 1000,
            rotated: true,
          },
        ],
      };
      let r = validarResultadoNestingOpenNest(
        a,
        materializarPatrones(a, [patron], {
          seleccion: [{ patron: 0, repeticiones: 2 }],
          optimoPlacasDentroCartera: false,
          optimoPatronesDentroCartera: false,
        }),
      );
      if (motor === 'packingsolver') {
        r = validarResultadoNestingOpenNest(
          a,
          convertirPackingSolver(
            a,
            {
              duracionMs: 10,
              certificado: {
                bins: [0, 1].map((placa) => ({
                  copies: 1,
                  items: r.placements
                    .filter((p) => p.placa === placa)
                    .map((p) => ({
                      id: a.piezas.findIndex((tipo) => tipo.id === p.piezaId),
                      x: p.traslacion.x,
                      y: p.traslacion.y,
                      angle: p.rotacionGrados,
                    })),
                })),
              },
            },
            'packingsolver:certificado-de-integracion',
          ),
        );
        r.versionPoliticaOrientacion = VERSION_POLITICA_ORIENTACION_GRAFONEST;
        const guardados = new NestingsGuardadosService(db as PrismaService);
        await guardados.guardarCheckpoint(a, r);
        expect((await guardados.obtenerCheckpoint(a))?.motorEjecutor).toBe(
          'packingsolver',
        );
        await guardados.guardar(a, r);
        expect((await guardados.obtener(a))?.algoritmo).toBe(
          'grafonest-packingsolver-v1',
        );
        expect(await guardados.obtenerCheckpoint(a)).toBeNull();
      }
      const biblioteca = new BibliotecaPatronesService(db as PrismaService);
      await biblioteca.aprender(a, r);
      const familia = await biblioteca.obtenerFamilia(b);
      expect(familia.planes).toHaveLength(1);
      expect(familia.planes[0].seleccion).toEqual([
        { patron: 0, repeticiones: 4 },
      ]);
      const repetido = validarResultadoNestingOpenNest(
        b,
        materializarPatrones(b, familia.patrones, familia.planes[0]),
      );
      const antes = finalizarProblemaOpenNest({
        contexto: contextoA,
        resultado: r,
      }).resultado;
      if (motor === 'packingsolver')
        expect(antes.motorNesting).toBe('grafonest-packingsolver-v1');
      const despues = finalizarProblemaOpenNest({
        contexto: contextoB,
        resultado: repetido,
      }).resultado;
      expect(despues.placements).toHaveLength(8);
      expect(despues.placas).toBe(4);
      expect(despues.perimetroCorteMm).toBeCloseTo(
        antes.perimetroCorteMm * 2,
        6,
      );
      const operaciones = despues.placements.flatMap(
        (p) => p.operaciones ?? [],
      );
      expect(operaciones).toHaveLength(8);
      expect(operaciones.every((o) => o.tipo === 'HENDIDO')).toBe(true);
      expect(
        operaciones.reduce((s, o) => s + longitudOperacion(o), 0),
      ).toBeCloseTo(2400, 6);
      expect(
        despues.placements.every((p) => p.fabricacion?.entidades.length === 6),
      ).toBe(true);
      const primera = despues.placements.filter((p) => p.substrateIndex === 0);
      expect(primera.map((p) => p.rotacion)).toEqual([0, 90]);
      const controlador = new ExportarFabricacionController(
        {
          geometriaProducto: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: origen.geometriaId,
                hash: origen.hash,
                fuenteJson: fuente,
                archivo: {
                  tenantId,
                  bytes: BigInt(bytes.length),
                  key: 'original',
                },
              },
            ]),
          },
        } as never,
        { leer: jest.fn().mockResolvedValue(bytes) } as never,
        {
          exigirTodas: jest.fn().mockResolvedValue(undefined),
          exigir: jest.fn().mockResolvedValue(undefined),
          puedeOperar: jest.fn().mockResolvedValue(true),
        } as never,
      );
      const exportado = await controlador.exportar({ tenantId } as never, {
        altoMm: 3000,
        baseDxf:
          '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1024\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n',
        instancias: primera.map((p) => ({
          geometriaId: origen.geometriaId,
          archivoHash: origen.hash,
          soloComplementos: false,
          transformacion: p.fabricacion!.transformacion,
        })),
      });
      const releido = await inspeccionarDxfNativo(exportado.dxf);
      const dobleces = releido.entidades.filter((e) => e.capa === 'DOBLEZ');
      expect(dobleces).toHaveLength(2);
      expect(exportado.dxf).toContain('ARC');
      expect(exportado.dxf).toContain('CIRCLE');
      expect(exportado.dxf).toContain('Doblar aquí');
      expect(JSON.stringify(fuente)).toBe(original);
    },
  );
});
