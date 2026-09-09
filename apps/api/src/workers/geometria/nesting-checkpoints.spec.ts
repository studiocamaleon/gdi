import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  VERSION_POLITICA_ORIENTACION_GRAFONEST,
  type NestingIrregularOpenNestData,
} from '../colas';
import {
  NestingsGuardadosService,
  firmaNesting,
} from './nestings-guardados.service';
import { resolverNestingBaseSeguro } from './nesting-base-seguro';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';
import { OpenNestService, OpenNestSubprocessError } from './opennest.service';

describe('durabilidad de candidatos sin publicar una búsqueda incompleta', () => {
  const db = new PrismaClient(),
    tenantId = randomUUID();
  const service = new NestingsGuardadosService(db as PrismaService);
  const input = (): NestingIrregularOpenNestData => ({
    schemaVersion: 1,
    tenantId,
    correlationId: randomUUID(),
    solicitadoEl: new Date().toISOString(),
    motor: 'collision',
    semilla: 7,
    timeoutMs: 1000,
    separacionMm: 0,
    placa: { anchoMm: 100, altoMm: 100, margenMm: 0, maxPlacas: 3 },
    piezas: ['a', 'b'].map((id) => ({
      id,
      cantidad: 1,
      rotaciones: 4,
      contorno: [
        { x: 0, y: 0 },
        { x: 70, y: 0 },
        { x: 0, y: 70 },
      ],
    })),
  });
  const encaje = (a: NestingIrregularOpenNestData) =>
    validarResultadoNestingOpenNest(a, {
      ...resolverNestingBaseSeguro(a),
      placasUsadas: 1,
      calidadSolucion: 'OPTIMIZADA',
      versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
      placements: a.piezas.map((p, i) => ({
        piezaId: p.id,
        copia: 0,
        placa: 0,
        rotacionGrados: i * 180,
        traslacion: { x: i * 70, y: i * 70 },
        contorno: i
          ? p.contorno.map((q) => ({ x: 70 - q.x, y: 70 - q.y }))
          : p.contorno,
        huecos: [],
      })),
    });
  beforeAll(async () => {
    await db.tenant.create({
      data: { id: tenantId, nombre: 'Test recuperación', slug: tenantId },
    });
  });
  beforeEach(async () => {
    await db.nestingGuardado.deleteMany({ where: { tenantId } });
    await db.nestingCheckpoint.deleteMany({ where: { tenantId } });
  });
  afterAll(async () => {
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.$disconnect();
  });

  it('recupera con otro proceso lógico e IDs nuevos, aislado por tenant y sin publicarse en el caché', async () => {
    const a = input(),
      r = encaje(a);
    await service.guardarCheckpoint(a, {
      ...r,
      presupuestoExploradoMs: 300000,
    });
    expect(await service.obtener(a)).toBeNull();
    const b = {
      ...a,
      piezas: a.piezas.map((p) => ({ ...p, id: `nueva-${p.id}` })).reverse(),
    };
    const recuperado = await new NestingsGuardadosService(
      db as PrismaService,
    ).obtenerCheckpoint(b);
    expect(recuperado?.presupuestoExploradoMs).toBe(0);
    expect(recuperado?.busqueda).toBeUndefined();
    expect(recuperado?.placements.map((p) => p.piezaId)).toEqual([
      'nueva-a',
      'nueva-b',
    ]);
    expect(
      await service.obtenerCheckpoint({ ...b, tenantId: randomUUID() }),
    ).toBeNull();
    expect(
      await service.obtenerCheckpoint({ ...b, separacionMm: 5 }),
    ).toBeNull();
  });

  it('no degrada avances concurrentes y no borra un checkpoint mejor al finalizar un trabajo anterior', async () => {
    const a = input(),
      mejor = encaje(a),
      base = {
        ...resolverNestingBaseSeguro(a),
        versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
      };
    await Promise.all([
      service.guardarCheckpoint(a, mejor),
      service.guardarCheckpoint(a, base),
    ]);
    expect((await service.obtenerCheckpoint(a))?.placasUsadas).toBe(1);
    await service.guardar(a, base);
    expect((await service.obtenerCheckpoint(a))?.placasUsadas).toBe(1);
    await service.guardar(a, mejor);
    expect(await service.obtenerCheckpoint(a)).toBeNull();
    // Una escritura tardía tampoco vuelve a sembrar el candidato peor.
    await service.guardarCheckpoint(a, base);
    expect(await service.obtenerCheckpoint(a)).toBeNull();
    expect((await service.obtener(a))?.placasUsadas).toBe(1);
  });

  it('descarta geometría corrupta y limpia sólo esa revisión', async () => {
    const a = input();
    await service.guardarCheckpoint(a, encaje(a));
    const where = {
      tenantId_clave: { tenantId, clave: firmaNesting(a).clave },
    };
    const row = await db.nestingCheckpoint.findUniqueOrThrow({ where });
    const corrupto = row.resultadoJson as unknown as { poses: unknown[] };
    corrupto.poses.pop();
    await db.nestingCheckpoint.update({
      where,
      data: { resultadoJson: JSON.parse(JSON.stringify(corrupto)) },
    });
    expect(await service.obtenerCheckpoint(a)).toBeNull();
    expect(await db.nestingCheckpoint.count({ where: { tenantId } })).toBe(0);
  });

  it('preserva un candidato al cancelar y lo usa en la siguiente búsqueda', async () => {
    const a = input(),
      controller = new AbortController();
    class Cancelado extends OpenNestService {
      protected override async ejecutarRunner(): Promise<never> {
        expect(await service.obtenerCheckpoint(a)).not.toBeNull();
        controller.abort();
        throw new OpenNestSubprocessError('Cancelado', 'CANCELLED');
      }
    }
    await expect(
      new Cancelado(service).resolver(a, { signal: controller.signal }),
    ).rejects.toThrow('Cancelado');
    expect(await service.obtener(a)).toBeNull();
    expect((await service.obtenerCheckpoint(a))?.placasUsadas).toBe(2);
    await service.guardarCheckpoint(a, encaje(a));
    class Recuperado extends OpenNestService {
      protected override async ejecutarRunner(): Promise<never> {
        throw new Error('Ya se alcanzaron ambas cotas');
      }
    }
    const terminado = await new Recuperado(service).resolver(a);
    expect(terminado.placasUsadas).toBe(1);
    expect(terminado.busqueda?.intentos).toBe(0);
    expect(await service.obtenerCheckpoint(a)).toBeNull();
    expect((await service.obtener(a))?.placasUsadas).toBe(1);
  });

  it('un checkpoint ilegible no bloquea un avance nuevo ni la publicación válida', async () => {
    const a = input(),
      r = encaje(a);
    const where = {
      tenantId_clave: { tenantId, clave: firmaNesting(a).clave },
    };
    const invalidar = () =>
      db.nestingCheckpoint.update({
        where,
        data: {
          resultadoJson: { versionCheckpoint: 1, resultado: {}, poses: [] },
        },
      });
    await service.guardarCheckpoint(a, r);
    await invalidar();
    await service.guardarCheckpoint(a, r);
    expect((await service.obtenerCheckpoint(a))?.placasUsadas).toBe(1);
    await invalidar();
    await service.guardar(a, r);
    expect((await service.obtener(a))?.placasUsadas).toBe(1);
    expect(await service.obtenerCheckpoint(a)).toBeNull();
  });
});
