import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  VERSION_POLITICA_ORIENTACION_GRAFONEST,
  VERSION_POLITICA_BUSQUEDA_GRAFONEST,
  type NestingIrregularOpenNestData,
} from '../colas';
import {
  NestingsGuardadosService,
  firmaNesting,
  satisfaceBusqueda,
  presupuestoExplorado,
  remapearResultado,
} from './nestings-guardados.service';
import { resolverNestingBaseSeguro } from './nesting-base-seguro';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';
import { OpenNestService } from './opennest.service';
import { contarPatronesResultado } from './calidad-nesting';

function entrada(tenantId = 'empresa-a'): NestingIrregularOpenNestData {
  return {
    schemaVersion: 1,
    tenantId,
    solicitadoEl: new Date().toISOString(),
    correlationId: randomUUID(),
    motor: 'collision',
    semilla: 30,
    timeoutMs: 120000,
    placa: { anchoMm: 500, altoMm: 500, margenMm: 10, maxPlacas: 10 },
    separacionMm: 5,
    piezas: [
      {
        id: 'cuerpo',
        cantidad: 3,
        rotaciones: 4,
        contorno: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 80 },
          { x: 0, y: 80 },
        ],
      },
      {
        id: 'estante',
        cantidad: 2,
        rotaciones: 4,
        contorno: [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 50, y: 40 },
          { x: 0, y: 40 },
        ],
      },
    ],
  };
}

describe('identidad del nesting persistente', () => {
  it('vuelve a explorar al habilitar el motor nativo, conservando el plan anterior para cotizar', () => {
    const anterior = process.env.GRAFONEST_PACKINGSOLVER_ENABLED;
    try {
      process.env.GRAFONEST_PACKINGSOLVER_ENABLED = '1';
      const a = entrada();
      const r = {
        ...resolverNestingBaseSeguro(a),
        versionPoliticaBusqueda: VERSION_POLITICA_BUSQUEDA_GRAFONEST,
        presupuestoExploradoMs: 300000,
      };
      expect(satisfaceBusqueda(a, r)).toBe(true);
      expect(satisfaceBusqueda({ ...a, buscarMejora: true }, r)).toBe(false);
      expect(
        satisfaceBusqueda(
          { ...a, buscarMejora: true },
          {
            ...r,
            busqueda: {
              presupuestoMs: 300000,
              motivoFin: 'PRESUPUESTO_AGOTADO',
              intentos: 2,
              candidatosValidos: 1,
              minimoTeoricoPlacas: 1,
              motoresExplorados: ['packingsolver'],
            },
          },
        ),
      ).toBe(true);
    } finally {
      if (anterior === undefined)
        delete process.env.GRAFONEST_PACKINGSOLVER_ENABLED;
      else process.env.GRAFONEST_PACKINGSOLVER_ENABLED = anterior;
    }
  });
  it('no contabiliza el presupuesto solicitado como explorado al reutilizar una receta', () => {
    const a = entrada();
    const r = {
      ...resolverNestingBaseSeguro(a),
      versionPoliticaBusqueda: VERSION_POLITICA_BUSQUEDA_GRAFONEST,
      presupuestoExploradoMs: 0,
      busqueda: {
        motivoFin: 'PLAN_REUTILIZADO' as const,
        presupuestoMs: 300000,
        intentos: 0,
        candidatosValidos: 1,
        minimoTeoricoPlacas: 1,
      },
    };
    expect(presupuestoExplorado(r)).toBe(0);
    expect(satisfaceBusqueda(a, r)).toBe(true);
    expect(satisfaceBusqueda({ ...a, buscarMejora: true }, r)).toBe(false);
  });
  it('ignora nombres, IDs, orden, semilla y metadatos de la solicitud', () => {
    const a = entrada();
    const b = entrada();
    b.piezas.reverse();
    b.piezas.forEach((p, i) => (p.id = `nombre-nuevo-${i}`));
    b.semilla = 900;
    expect(firmaNesting(a).clave).toBe(firmaNesting(b).clave);
  });
  it.each([
    'cantidad',
    'medida',
    'rotacion',
    'placa',
    'margen',
    'separacion',
    'hueco',
    'corteComun',
  ])('no reutiliza al cambiar %s', (cambio) => {
    const a = entrada();
    const b = entrada();
    switch (cambio) {
      case 'cantidad':
        b.piezas[0].cantidad++;
        break;
      case 'medida':
        b.piezas[0].contorno[1].x++;
        break;
      case 'rotacion':
        b.piezas[0].rotaciones = 1;
        break;
      case 'placa':
        b.placa.altoMm++;
        break;
      case 'margen':
        b.placa.margenMm++;
        break;
      case 'separacion':
        b.separacionMm++;
        break;
      case 'hueco':
        b.piezas[0].huecos = [
          [
            { x: 10, y: 10 },
            { x: 20, y: 10 },
            { x: 20, y: 20 },
            { x: 10, y: 20 },
          ],
        ];
        break;
      case 'corteComun':
        b.commonLine = {
          habilitado: true,
          anchoCorteMm: 1,
          longitudMinimaMm: 10,
          toleranciaMm: 0.01,
        };
        break;
    }
    expect(firmaNesting(a).clave).not.toBe(firmaNesting(b).clave);
  });
  it('comparte el mejor resultado entre presupuestos distintos', () => {
    const a = entrada();
    expect(firmaNesting(a).clave).toBe(
      firmaNesting({ ...a, timeoutMs: 300000, buscarMejora: true }).clave,
    );
    const resultado = {
      ...resolverNestingBaseSeguro(a),
      versionPoliticaBusqueda: VERSION_POLITICA_BUSQUEDA_GRAFONEST,
      presupuestoExploradoMs: 120000,
    };
    expect(satisfaceBusqueda(a, resultado)).toBe(true);
    expect(
      satisfaceBusqueda(
        { ...a, timeoutMs: 300000, buscarMejora: true },
        resultado,
      ),
    ).toBe(false);
    expect(
      satisfaceBusqueda(
        { ...a, timeoutMs: 300000, buscarMejora: true },
        { ...resultado, presupuestoExploradoMs: 300000 },
      ),
    ).toBe(true);
    // Una geometría anterior sigue sirviendo para cotizar, pero su presupuesto
    // no certifica que ya se hayan usado las correcciones de la nueva búsqueda.
    const anterior = {
      ...resultado,
      versionPoliticaBusqueda: undefined,
      presupuestoExploradoMs: 300000,
    };
    expect(satisfaceBusqueda(a, anterior)).toBe(true);
    expect(satisfaceBusqueda({ ...a, buscarMejora: true }, anterior)).toBe(
      false,
    );
  });
});

describe('persistencia, recuperación e integridad', () => {
  const db = new PrismaClient();
  const tenantId = randomUUID();
  let servicio: NestingsGuardadosService;
  beforeAll(async () => {
    await db.tenant.create({
      data: {
        id: tenantId,
        nombre: 'Test nesting persistente',
        slug: `nest-${tenantId}`,
      },
    });
    servicio = new NestingsGuardadosService(db as PrismaService);
  });
  afterAll(async () => {
    await db.tenant.delete({ where: { id: tenantId } });
    await db.$disconnect();
  });

  it('recupera tras crear otro servicio, remapea las piezas y no invoca el solver', async () => {
    const a = entrada(tenantId);
    const resultado = {
      ...validarResultadoNestingOpenNest(a, resolverNestingBaseSeguro(a)),
      versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
    };
    await servicio.guardar(a, resultado);
    const b = entrada(tenantId);
    b.piezas[0].id = 'otro-cuerpo';
    b.piezas[1].id = 'otro-estante';
    b.piezas.reverse();
    const nuevaInstancia = new NestingsGuardadosService(db as PrismaService);
    const motor = new OpenNestService(nuevaInstancia);
    const runner = jest.spyOn(
      motor as never as { ejecutarRunner(): Promise<never> },
      'ejecutarRunner',
    );
    const recuperado = await motor.resolver(b);
    expect(runner).not.toHaveBeenCalled();
    expect(recuperado.placasUsadas).toBe(resultado.placasUsadas);
    expect(recuperado.placements.map((p) => p.contorno)).toEqual(
      resultado.placements.map((p) => p.contorno),
    );
    expect(new Set(recuperado.placements.map((p) => p.piezaId))).toEqual(
      new Set(['otro-cuerpo', 'otro-estante']),
    );
    expect(await servicio.obtener(entrada(randomUUID()))).toBeNull();
  });

  it('rechaza un resultado corrupto aunque la clave coincida', async () => {
    const a = entrada(tenantId);
    const { clave } = firmaNesting(a);
    const row = await db.nestingGuardado.findUniqueOrThrow({
      where: { tenantId_clave: { tenantId, clave } },
    });
    const corrupto = structuredClone(row.resultadoJson) as unknown as {
      placements: unknown[];
    };
    corrupto.placements.pop();
    await db.nestingGuardado.update({
      where: { tenantId_clave: { tenantId, clave } },
      data: {
        resultadoJson: JSON.parse(
          JSON.stringify(corrupto),
        ) as Prisma.InputJsonValue,
      },
    });
    expect(await servicio.obtener(a)).toBeNull();
    expect(await db.nestingGuardado.count({ where: { tenantId, clave } })).toBe(
      0,
    );
  });

  it('amplía la búsqueda, conserva un acomodo mejor y recuerda el esfuerzo sin repetirlo', async () => {
    const a = entrada(tenantId);
    a.placa = { anchoMm: 100, altoMm: 100, margenMm: 0, maxPlacas: 2 };
    a.separacionMm = 0;
    a.piezas = a.piezas.map((p) => ({
      ...p,
      cantidad: 1,
      rotaciones: 4,
      contorno: [
        { x: 0, y: 0 },
        { x: 70, y: 0 },
        { x: 0, y: 70 },
      ],
    }));
    const peor = {
      ...validarResultadoNestingOpenNest(a, resolverNestingBaseSeguro(a)),
      versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
      calidadSolucion: 'OPTIMIZADA' as const,
      presupuestoExploradoMs: 120000,
    };
    await servicio.guardar(a, peor);
    const largo = { ...a, timeoutMs: 300000, buscarMejora: true };
    const mejor = {
      ...peor,
      placasUsadas: 1,
      placements: peor.placements.map((p, i) =>
        i === 0
          ? p
          : {
              ...p,
              placa: 0,
              rotacionGrados: 180,
              traslacion: { x: 70, y: 70 },
              contorno: a.piezas[i].contorno.map((q) => ({
                x: 70 - q.x,
                y: 70 - q.y,
              })),
            },
      ),
    };
    const motor = new OpenNestService(servicio);
    const runner = jest
      .spyOn(
        motor as never as { ejecutarRunner(): Promise<unknown> },
        'ejecutarRunner',
      )
      .mockResolvedValue({ ok: true, result: mejor });
    const resultado = await motor.resolver(largo);
    expect(runner).toHaveBeenCalled();
    expect(resultado.placements).toEqual(mejor.placements);
    expect(resultado.presupuestoExploradoMs).toBe(300000);
    runner.mockClear();
    await motor.resolver(largo);
    expect(runner).not.toHaveBeenCalled();
    // Tampoco un worker de 2 minutos que termina más tarde pisa la mejora.
    await servicio.guardar(a, peor);
    const paraSheet = await servicio.obtener(a);
    expect(paraSheet?.placasUsadas).toBe(1);
    expect(paraSheet?.presupuestoExploradoMs).toBe(300000);
  });

  it('recupera un nesting anterior de dos minutos al preparar cinco', async () => {
    const a = entrada(tenantId);
    a.placa.anchoMm = 600;
    const { clave, ids } = firmaNesting(a, 1);
    const resultado = {
      ...resolverNestingBaseSeguro(a),
      versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
      presupuestoExploradoMs: 120000,
    };
    await db.nestingGuardado.create({
      data: {
        tenantId,
        clave,
        resultadoJson: JSON.parse(
          JSON.stringify(remapearResultado(resultado, ids)),
        ) as Prisma.InputJsonValue,
      },
    });
    const recuperado = await servicio.obtener({ ...a, timeoutMs: 300000 });
    expect(recuperado?.placements).toEqual(resultado.placements);
    expect(
      await db.nestingGuardado.count({
        where: { tenantId, clave: firmaNesting(a).clave },
      }),
    ).toBe(1);
  });

  it('conserva menos patrones, la procedencia del motor y el presupuesto de la nueva política', async () => {
    const a = entrada(tenantId);
    a.placa = { anchoMm: 180, altoMm: 100, margenMm: 0, maxPlacas: 4 };
    a.piezas = [
      {
        id: 'panel',
        cantidad: 4,
        rotaciones: 1,
        contorno: [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
          { x: 80, y: 80 },
          { x: 0, y: 80 },
        ],
      },
    ];
    const repetido = {
      ...resolverNestingBaseSeguro(a),
      versionPoliticaOrientacion: VERSION_POLITICA_ORIENTACION_GRAFONEST,
      versionPoliticaBusqueda: VERSION_POLITICA_BUSQUEDA_GRAFONEST,
      presupuestoExploradoMs: 120000,
      calidadSolucion: 'OPTIMIZADA' as const,
      motorEjecutor: 'nfp' as const,
    };
    // El mismo acomodo, algo menos compacto, en ambas placas.
    for (const p of repetido.placements) {
      if (p.traslacion.x === 0) continue;
      const dx = 95 - p.traslacion.x;
      p.traslacion.x += dx;
      p.contorno.forEach((v) => (v.x += dx));
    }
    const distinto = structuredClone(repetido);
    delete distinto.versionPoliticaBusqueda;
    distinto.presupuestoExploradoMs = 300000;
    const ultima = distinto.placements.find(
      (p) => p.placa === 1 && p.traslacion.x > 0,
    )!;
    ultima.traslacion.x -= 10;
    ultima.contorno.forEach((v) => (v.x -= 10));
    expect(contarPatronesResultado(repetido)).toBe(1);
    expect(contarPatronesResultado(distinto)).toBe(2);
    validarResultadoNestingOpenNest(a, repetido);
    validarResultadoNestingOpenNest(a, distinto);
    await servicio.guardar(a, distinto);
    await servicio.guardar(a, repetido);
    // Una escritura tardía del worker anterior tampoco revierte la política.
    await servicio.guardar(a, distinto);
    const guardado = await servicio.obtener(a);
    expect(guardado?.placements).toEqual(repetido.placements);
    expect(guardado?.motor).toBe('collision');
    expect(guardado?.motorEjecutor).toBe('nfp');
    expect(guardado?.versionPoliticaBusqueda).toBe(
      VERSION_POLITICA_BUSQUEDA_GRAFONEST,
    );
    expect(guardado?.presupuestoExploradoMs).toBe(120000);
    expect(
      satisfaceBusqueda(
        { ...a, timeoutMs: 300000, buscarMejora: true },
        guardado!,
      ),
    ).toBe(false);
  });
});
