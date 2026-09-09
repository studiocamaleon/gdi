import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NestingIrregularOpenNestData } from '../colas';
import {
  BibliotecaPatronesService,
  firmaFamiliaPatrones,
  patronesDeResultado,
} from './biblioteca-patrones.service';
import { resolverNestingBaseSeguro } from './nesting-base-seguro';
import {
  generarCarteraPatrones,
  materializarPatrones,
} from './cartera-patrones';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';
import { optimizarCommonLines } from './common-line';
import { contarPatronesResultado } from './calidad-nesting';

function entrada(tenantId = 'test'): NestingIrregularOpenNestData {
  return {
    schemaVersion: 1,
    tenantId,
    correlationId: randomUUID(),
    solicitadoEl: new Date().toISOString(),
    motor: 'collision',
    semilla: 7,
    timeoutMs: 10000,
    placa: { anchoMm: 100, altoMm: 60, margenMm: 0, maxPlacas: 20 },
    separacionMm: 5,
    piezas: [
      {
        id: 'a',
        cantidad: 4,
        rotaciones: 1,
        contorno: [
          { x: 0, y: 0 },
          { x: 45, y: 0 },
          { x: 45, y: 50 },
          { x: 0, y: 50 },
        ],
      },
      {
        id: 'b',
        cantidad: 4,
        rotaciones: 1,
        contorno: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 50 },
          { x: 0, y: 50 },
        ],
      },
    ],
  };
}

describe('identidad de familias geométricas', () => {
  it('reutiliza al cambiar cantidad, IDs, orden, motor, semilla y máximo de placas', () => {
    const a = entrada(),
      b = entrada();
    b.piezas.reverse();
    b.piezas.forEach((p, i) => {
      p.id = `nuevo-${i}`;
      p.cantidad *= 17;
    });
    b.motor = 'nfp';
    b.semilla = 88;
    b.placa.maxPlacas = 1000;
    expect(firmaFamiliaPatrones(a).clave).toBe(firmaFamiliaPatrones(b).clave);
  });
  it.each(['giro', 'margen', 'medida', 'hueco', 'separacion', 'commonLine'])(
    'no reutiliza al cambiar %s',
    (caso) => {
      const a = entrada(),
        b = entrada();
      if (caso === 'giro') b.piezas[0].rotaciones = 4;
      if (caso === 'margen') b.placa.margenMm = 1;
      if (caso === 'medida') b.piezas[0].contorno[1].x++;
      if (caso === 'hueco')
        b.piezas[0].huecos = [
          [
            { x: 1, y: 1 },
            { x: 2, y: 1 },
            { x: 1, y: 2 },
          ],
        ];
      if (caso === 'separacion') b.separacionMm++;
      if (caso === 'commonLine')
        b.commonLine = {
          habilitado: true,
          anchoCorteMm: 1,
          longitudMinimaMm: 10,
          toleranciaMm: 0.01,
        };
      expect(firmaFamiliaPatrones(a).clave).not.toBe(
        firmaFamiliaPatrones(b).clave,
      );
    },
  );
  it('extrae patrones en lugar de almacenar todas las copias', () => {
    const a = entrada();
    a.piezas = [a.piezas[0]];
    a.piezas[0].cantidad = 40;
    const r = validarResultadoNestingOpenNest(a, resolverNestingBaseSeguro(a));
    const ps = patronesDeResultado(a, r);
    expect(ps).toHaveLength(1);
    expect(ps[0].placements).toHaveLength(2);
  });
});

describe('biblioteca persistida entre cantidades', () => {
  const db = new PrismaClient(),
    tenantId = randomUUID();
  const service = new BibliotecaPatronesService(db as PrismaService);
  beforeAll(async () => {
    await db.tenant.create({
      data: {
        id: tenantId,
        nombre: 'Test biblioteca',
        slug: `patrones-${tenantId}`,
      },
    });
  });
  afterAll(async () => {
    await db.tenant.delete({ where: { id: tenantId } });
    await db.$disconnect();
  });

  it('persiste, recupera con otros IDs y permite repetir sin compartir datos entre fábricas', async () => {
    const a = entrada(tenantId);
    const r = validarResultadoNestingOpenNest(a, resolverNestingBaseSeguro(a));
    await service.aprender(a, r);
    const b = entrada(tenantId);
    b.piezas.forEach((p) => {
      p.id = `renombrada-${p.id}`;
      p.cantidad *= 2;
    });
    b.motor = 'nfp';
    b.piezas.reverse();
    const ps = await new BibliotecaPatronesService(db as PrismaService).obtener(
      b,
    );
    expect(ps.length).toBeGreaterThan(0);
    // Replicar los patrones del resultado original el doble de veces.
    const originales = patronesDeResultado(a, r);
    const seleccion = ps.map((p, patron) => ({
      patron,
      repeticiones: (r.placasUsadas / originales.length) * 2,
    }));
    const doblado = materializarPatrones(b, ps, {
      seleccion,
      optimoPlacasDentroCartera: false,
      optimoPatronesDentroCartera: false,
    });
    expect(validarResultadoNestingOpenNest(b, doblado).cantidadColocada).toBe(
      16,
    );
    expect(await service.obtener({ ...b, tenantId: randomUUID() })).toEqual([]);
    const familia = await service.obtenerFamilia(b);
    expect(familia.planes).toHaveLength(1);
    const completo = validarResultadoNestingOpenNest(
      b,
      materializarPatrones(b, familia.patrones, familia.planes[0]),
    );
    expect(completo.placasUsadas).toBe(r.placasUsadas * 2);
    expect(contarPatronesResultado(completo)).toBe(contarPatronesResultado(r));
    expect(familia.planes[0].optimoPlacasDentroCartera).toBe(false);
    expect(
      (await service.obtenerFamilia({ ...b, tenantId: randomUUID() })).planes,
    ).toEqual([]);
    const fila = await db.carteraNestingGuardada.findUniqueOrThrow({
      where: {
        tenantId_clave: { tenantId, clave: firmaFamiliaPatrones(a).clave },
      },
    });
    expect(JSON.stringify(fila.patronesJson)).not.toContain('contorno');
    expect(Buffer.byteLength(JSON.stringify(fila.patronesJson))).toBeLessThan(
      3000,
    );
  });

  it('mantiene el recorrido Common Line al reutilizar un patrón y renumerar las copias', async () => {
    const a = entrada(tenantId);
    a.piezas = [{ ...a.piezas[0], cantidad: 2 }];
    a.commonLine = {
      habilitado: true,
      anchoCorteMm: 1,
      longitudMinimaMm: 10,
      toleranciaMm: 0.01,
    };
    const r = validarResultadoNestingOpenNest(
      a,
      optimizarCommonLines(a, resolverNestingBaseSeguro(a)),
    );
    expect(r.commonLine?.tramos).toHaveLength(1);
    await service.aprender(a, r);
    const b = structuredClone(a);
    b.piezas[0].cantidad = 6;
    b.piezas[0].id = 'otro';
    const ps = await service.obtener(b);
    expect(ps).toHaveLength(1);
    const cartera = await generarCarteraPatrones(b, {
      plazo: Date.now(),
      semillas: ps,
    });
    const index = cartera.findIndex((p) => p.counts[0] === 2);
    const repetido = validarResultadoNestingOpenNest(
      b,
      materializarPatrones(b, cartera, {
        seleccion: [{ patron: index, repeticiones: 3 }],
        optimoPlacasDentroCartera: false,
        optimoPatronesDentroCartera: false,
      }),
    );
    expect(repetido.commonLine?.tramos).toHaveLength(3);
    expect(repetido.commonLine?.longitudCompartidaMm).toBe(150);
    expect(
      repetido.commonLine?.tramos[2].segmentosOrigen.map((s) => s.copia).sort(),
    ).toEqual([4, 5]);
    const familia = await service.obtenerFamilia(b);
    const completo = validarResultadoNestingOpenNest(
      b,
      materializarPatrones(b, familia.patrones, familia.planes[0]),
    );
    expect(completo.commonLine?.tramos).toEqual(repetido.commonLine?.tramos);
    expect(completo.commonLine?.longitudCompartidaMm).toBe(150);
  });

  it('escala hacia abajo sólo si cada repetición sigue siendo entera', async () => {
    const a = entrada(tenantId);
    a.piezas = [{ ...a.piezas[0], cantidad: 40 }];
    await service.aprender(
      a,
      validarResultadoNestingOpenNest(a, resolverNestingBaseSeguro(a)),
    );
    const b = { ...a, piezas: [{ ...a.piezas[0], cantidad: 20 }] };
    const familia = await service.obtenerFamilia(b);
    expect(familia.planes).toHaveLength(1);
    expect(familia.planes[0].seleccion).toEqual([
      { patron: 0, repeticiones: 10 },
    ]);
    expect(
      (
        await service.obtenerFamilia({
          ...b,
          piezas: [{ ...b.piezas[0], cantidad: 21 }],
        })
      ).planes,
    ).toEqual([]);
    expect(
      (
        await service.obtenerFamilia({
          ...b,
          placa: { ...b.placa, maxPlacas: 9 },
        })
      ).planes,
    ).toEqual([]);
    // La receta de 40 y la de 20 se normalizan a la misma combinación.
    await service.aprender(
      b,
      materializarPatrones(b, familia.patrones, familia.planes[0]),
    );
    expect((await service.obtenerFamilia(b)).planes).toHaveLength(1);
  });

  it('no aplica el plan si cambia la proporción entre tipos de pieza', async () => {
    const a = entrada(tenantId);
    a.piezas[0].cantidad++;
    const familia = await service.obtenerFamilia(a);
    expect(familia.patrones.length).toBeGreaterThan(0);
    expect(familia.planes).toEqual([]);
  });

  it('conserva las referencias tras persistir residuos trigonométricos del caso real', async () => {
    const a = entrada(tenantId);
    a.piezas = [{ ...a.piezas[0], cantidad: 2 }];
    const r = resolverNestingBaseSeguro(a);
    const delta = 1.0658141036401503e-14;
    r.placements[0].traslacion.x += delta;
    r.placements[0].contorno.forEach((p) => (p.x += delta));
    await service.aprender(a, validarResultadoNestingOpenNest(a, r));
    const familia = await service.obtenerFamilia(a);
    expect(familia.planes).toHaveLength(1);
    expect(() =>
      validarResultadoNestingOpenNest(
        a,
        materializarPatrones(a, familia.patrones, familia.planes[0]),
      ),
    ).not.toThrow();
  });

  it('descarta combinaciones incompletas o corruptas conservando sus patrones válidos', async () => {
    const a = entrada(tenantId);
    const where = {
      tenantId_clave: { tenantId, clave: firmaFamiliaPatrones(a).clave },
    };
    const row = await db.carteraNestingGuardada.findUniqueOrThrow({ where });
    const data = row.patronesJson as unknown as {
      version: 2;
      patrones: object[];
      planes: Array<{
        demanda: Record<string, number>;
        seleccion: Array<{ firma: string; repeticiones: number }>;
      }>;
    };
    const original = structuredClone(data.planes[0]);
    const ausente = structuredClone(original);
    ausente.seleccion[0].firma = 'no-existe';
    const repetida = structuredClone(original);
    repetida.seleccion.push(repetida.seleccion[0]);
    const sobran = structuredClone(original);
    sobran.seleccion[0].repeticiones++;
    const fraccion = structuredClone(original);
    fraccion.seleccion[0].repeticiones = 1.5;
    const planes = [null, {}, ausente, repetida, sobran, fraccion, original];
    await db.carteraNestingGuardada.update({
      where,
      data: { patronesJson: JSON.parse(JSON.stringify({ ...data, planes })) },
    });
    expect((await service.obtenerFamilia(a)).planes).toHaveLength(1);
  });

  it('descarta una plantilla corrupta sin invalidar las demás', async () => {
    const a = entrada(tenantId);
    const clave = firmaFamiliaPatrones(a).clave;
    const where = { tenantId_clave: { tenantId, clave } };
    const row = await db.carteraNestingGuardada.findUniqueOrThrow({ where });
    const { patrones: ps } = row.patronesJson as unknown as {
      patrones: Array<{
        poses: Array<{ x: number }>;
      }>;
    };
    const corrupta = structuredClone(ps[0]);
    corrupta.poses[0].x = 100000;
    await db.carteraNestingGuardada.update({
      where,
      data: { patronesJson: JSON.parse(JSON.stringify([corrupta, ...ps])) },
    });
    expect((await service.obtener(a)).length).toBe(ps.length);
    // La versión anterior (array) sigue legible y se actualiza al aprender.
    expect((await service.obtenerFamilia(a)).planes).toEqual([]);
    await service.aprender(
      a,
      validarResultadoNestingOpenNest(a, resolverNestingBaseSeguro(a)),
    );
    expect((await service.obtenerFamilia(a)).planes).toHaveLength(1);
  });
});
