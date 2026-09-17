import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  extraerPiezasRollo,
  SimulacionNestingColaService,
} from './simulacion-nesting.service';
import { validate } from 'class-validator';
import { SimularNestingColaDto } from './simular-nesting.dto';
import { leerConfiguracionesCola, leerFuentesCola } from './configuracion-cola';

const db = new PrismaService(),
  service = new SimulacionNestingColaService(db);
const tenantId = randomUUID(),
  otroTenant = randomUUID(),
  maquinaId = randomUUID(),
  ordenId = randomUUID();
const materialId = randomUUID(),
  varianteA = randomUUID(),
  varianteB = randomUUID();
const pasos = [randomUUID(), randomUUID()],
  items = [randomUUID(), randomUUID()];
beforeAll(async () => {
  await db.tenant.createMany({
    data: [tenantId, otroTenant].map((id) => ({
      id,
      nombre: 'QA simulación manual',
      slug: `qa-simulacion-${id}`,
    })),
  });
  const planta = await db.planta.create({
    data: { tenantId, codigo: 'P1', nombre: 'Planta' },
  });
  await db.maquina.create({
    data: {
      id: maquinaId,
      tenantId,
      plantaId: planta.id,
      codigo: 'UV',
      nombre: 'UV',
      plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
      geometriaTrabajo: 'ROLLO',
      anchoUtil: 1600,
      parametrosTecnicosJson: {
        margenesNoImprimiblesMm: { izq: 10, der: 10, inicio: 100, fin: 100 },
      },
      unidadProduccionPrincipal: 'M2',
    },
  });
  await db.materiaPrima.create({
    data: {
      id: materialId,
      tenantId,
      codigo: 'VIN',
      nombre: 'Vinilo',
      familia: 'SUSTRATO',
      subfamilia: 'SUSTRATO_ROLLO_FLEXIBLE',
      tipoTecnico: 'vinilo',
      templateId: 'vinilo',
      unidadStock: 'ROLLO',
      unidadCompra: 'ROLLO',
      atributosTecnicosJson: {},
    },
  });
  await db.materiaPrimaVariante.createMany({
    data: [varianteA, varianteB].map((id, i) => ({
      id,
      tenantId,
      materiaPrimaId: materialId,
      sku: `VIN-${i}`,
      atributosVarianteJson: {
        anchoMm: i ? 1520 : 1370,
        acabado: 'brillante',
        largoRolloMm: 50000,
      },
    })),
  });
  await db.ordenTrabajo.create({
    data: { id: ordenId, tenantId, numero: 'OT-SIM', estado: 'produccion' },
  });
  for (const [i, id] of items.entries()) {
    await db.ordenTrabajoItem.create({
      data: {
        id,
        tenantId,
        ordenId,
        codigo: `I${i}`,
        nombre: `Vinilo ${i}`,
        familia: 'grafica',
        cantidad: 1,
        cantidadUnidad: 'u',
        subtotal: 0,
        impuestos: 0,
        total: 0,
        trazabilidadSnapshotJson: {
          pasos: [
            {
              rutaPasoId: `ruta-${i}`,
              nestingResult: {
                algorithm: 'maxrects-rollo',
                modoColor: i ? 'CMYK+W' : 'CMYK',
                tecnologia: i ? 'eco' : 'UV',
                sustrato: { materialVarianteId: i ? varianteB : varianteA },
                substrates: [{ kind: 'roll', widthMm: i ? 1520 : 1370 }],
                visualConfig: {
                  allowRotation: !i,
                  pieceBleedMm: 0,
                  panelizado: { enabled: !i, panelCount: i ? 1 : 2 },
                  margins: {
                    leftMm: 10,
                    rightMm: 10,
                    topMm: 100,
                    bottomMm: 100,
                  },
                },
                placements: i
                  ? [
                      {
                        pieceId: 'piece-0-0',
                        widthMm: 1500,
                        heightMm: 500,
                        rotated: false,
                      },
                    ]
                  : [1, 2].map((panelIndex) => ({
                      pieceId: 'piece-0-0',
                      widthMm: 1170,
                      heightMm: 1600,
                      panelIndex,
                      panelCount: 2,
                      overlapStartMm: panelIndex === 2 ? 20 : 0,
                      overlapEndMm: panelIndex === 1 ? 20 : 0,
                    })),
              },
            },
          ],
        },
      },
    });
    await db.ordenTrabajoItemPaso.create({
      data: {
        id: pasos[i],
        tenantId,
        ordenId,
        itemId: id,
        maquinaId,
        indice: 0,
        rutaPasoId: `ruta-${i}`,
        nombre: 'Impresión',
        familiaCodigo: 'impresion_por_area',
        categoriaFamilia: 'produccion_impresion',
        estado: i ? 'bloqueado' : 'pendiente',
      },
    });
  }
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: { in: [tenantId, otroTenant] } } });
  await db.$disconnect();
});

it('identifica el material común de variantes de distinto ancho sin cargar geometrías y aísla tenants', async () => {
  const configuraciones = await leerConfiguracionesCola(db, tenantId, pasos);
  const a = configuraciones.get(pasos[0])!,
    b = configuraciones.get(pasos[1])!;
  expect(a.materialId).not.toBe(b.materialId);
  expect(a.materiaPrimaId).toBe(materialId);
  expect(b.materiaPrimaId).toBe(materialId);
  expect(a.materialNombre).toBe('Vinilo');
  expect(a.materialSubfamilia).toBe('SUSTRATO_ROLLO_FLEXIBLE');
  expect(b.materialSubfamilia).toBe('SUSTRATO_ROLLO_FLEXIBLE');
  expect(a.materialNestingClave).toBeTruthy();
  expect(a.materialNestingClave).toBe(b.materialNestingClave);
  expect(a.formatos).not.toEqual(b.formatos);
  expect(JSON.stringify([...configuraciones.values()])).not.toMatch(
    /placements|atributosVarianteJson/,
  );
  expect((await leerConfiguracionesCola(db, otroTenant, pasos)).size).toBe(0);
});

it('simula anchos distintos del mismo material, sin filtrar color, tecnología, estado o mesa ni modificar OT', async () => {
  const antes = await db.ordenTrabajoItemPaso.findMany({
    where: { tenantId },
    orderBy: { id: 'asc' },
  });
  const r = await service.simular(tenantId, maquinaId, pasos);
  expect(r.piezas).toHaveLength(3);
  expect(r.piezas.filter((p) => p.panel)).toHaveLength(2);
  expect(r.alternativas[0]).toMatchObject({ anchoMm: 1520, largoMm: 3900 });
  expect(r.descartados.map((d) => d.anchoMm)).toContain(1370); // segundo producto no permite girar
  const despues = await db.ordenTrabajoItemPaso.findMany({
    where: { tenantId },
    orderBy: { id: 'asc' },
  });
  expect(despues).toEqual(antes);
  expect(JSON.stringify(r)).not.toMatch(
    /precio|costo|contorno|trazabilidad|tenantId/,
  );
  expect(Buffer.byteLength(JSON.stringify(r))).toBeLessThan(10_000);
});

it('consulta el ancho y los márgenes actuales de la máquina, conservando los paneles cotizados', async () => {
  const antes = await db.maquina.findUniqueOrThrow({
    where: { id: maquinaId },
  });
  try {
    await db.maquina.update({
      where: { id: maquinaId },
      data: {
        anchoUtil: 1400,
        parametrosTecnicosJson: {
          margenesNoImprimiblesMm: { izq: 30, der: 40, inicio: 70, fin: 80 },
        },
      },
    });
    const r = await service.simular(tenantId, maquinaId, [pasos[0]]);
    expect(r.maquina).toMatchObject({ id: maquinaId, anchoMaximoMm: 1400 });
    expect(r.margenes).toEqual({
      izquierda: 30,
      derecha: 40,
      inicio: 70,
      fin: 80,
    });
    expect(r.alternativas.map((a) => a.anchoMm)).toEqual([1370]);
    expect(r.descartados.find((d) => d.anchoMm === 1520)?.motivo).toContain(
      'máquina',
    );
    expect(r.alternativas[0].largoMm).toBe(3350);
    expect(r.alternativas[0].ubicaciones.map((p) => [p.xMm, p.yMm])).toEqual([
      [30, 70],
      [30, 1670],
    ]);
    expect(r.piezas.map((p) => [p.anchoMm, p.altoMm])).toEqual([
      [1170, 1600],
      [1170, 1600],
    ]);
    await db.maquina.update({
      where: { id: maquinaId },
      data: {
        parametrosTecnicosJson: {
          margenesNoImprimiblesMm: { izq: 150, der: 100, inicio: 70, fin: 80 },
        },
      },
    });
    const estrecha = await service.simular(tenantId, maquinaId, [pasos[0]]);
    expect(estrecha.alternativas).toHaveLength(0); // 1120 mm útiles: no se recortan los paneles
    expect(estrecha.descartados).toHaveLength(2);
  } finally {
    await db.maquina.update({
      where: { id: maquinaId },
      data: {
        anchoUtil: antes.anchoUtil,
        parametrosTecnicosJson: antes.parametrosTecnicosJson!,
      },
    });
  }
});

it('aplica los ajustes de nesting guardados en la OT con la misma precedencia y demasía del cotizador', async () => {
  const antes = await db.ordenTrabajoItem.findUniqueOrThrow({
    where: { id: items[0] },
  });
  const traza = JSON.parse(JSON.stringify(antes.trazabilidadSnapshotJson)) as {
    pasos: Prisma.JsonObject[];
  };
  const configId = randomUUID();
  traza.pasos[0].configPasoId = configId;
  try {
    await db.ordenTrabajoItem.update({
      where: { id: items[0] },
      data: {
        trazabilidadSnapshotJson: traza,
        jobContextSnapshotJson: {
          configPasoRuntime: {
            [configId]: {
              nestingConfig: {
                pieceBleedMm: 7.5,
                margins: { rightMm: 20 },
                extraMargins: { leftMm: 3, startMm: 20 },
              },
            },
          },
        },
      },
    });
    const r = await service.simular(tenantId, maquinaId, [pasos[0]]);
    expect(r.margenes).toEqual({
      izquierda: 20.5,
      derecha: 27.5,
      inicio: 127.5,
      fin: 107.5,
    });
    expect(r.separacionMm).toBe(15);
    expect(r.separacionVerticalMm).toBe(15);
    expect(r.alternativas.find((a) => a.anchoMm === 1370)?.largoMm).toBe(3450);
    expect(r.piezas.map((p) => [p.anchoMm, p.altoMm])).toEqual([
      [1170, 1600],
      [1170, 1600],
    ]);
  } finally {
    await db.ordenTrabajoItem.update({
      where: { id: items[0] },
      data: {
        trazabilidadSnapshotJson:
          antes.trazabilidadSnapshotJson ?? Prisma.DbNull,
        jobContextSnapshotJson: antes.jobContextSnapshotJson ?? Prisma.DbNull,
      },
    });
  }
});

it('aisla tenant y máquina y rechaza selección parcial o duplicada', async () => {
  await expect(
    service.simular(otroTenant, maquinaId, pasos),
  ).rejects.toBeInstanceOf(NotFoundException);
  await expect(
    service.simular(tenantId, randomUUID(), pasos),
  ).rejects.toBeInstanceOf(NotFoundException);
  await expect(
    service.simular(tenantId, maquinaId, [...pasos, randomUUID()]),
  ).rejects.toBeInstanceOf(NotFoundException);
  await expect(
    service.simular(tenantId, maquinaId, [pasos[0], pasos[0]]),
  ).rejects.toBeInstanceOf(BadRequestException);
});

it('rechaza otro material y libera el cálculo para un próximo intento', async () => {
  await db.materiaPrimaVariante.update({
    where: { id: varianteB },
    data: { atributosVarianteJson: { anchoMm: 1520, acabado: 'mate' } },
  });
  try {
    const configuraciones = await leerConfiguracionesCola(db, tenantId, pasos);
    expect(configuraciones.get(pasos[0])!.materialNestingClave).not.toBe(
      configuraciones.get(pasos[1])!.materialNestingClave,
    );
    await expect(service.simular(tenantId, maquinaId, pasos)).rejects.toThrow(
      'mismo material',
    );
  } finally {
    await db.materiaPrimaVariante.update({
      where: { id: varianteB },
      data: {
        atributosVarianteJson: {
          anchoMm: 1520,
          acabado: 'brillante',
          largoRolloMm: 50000,
        },
      },
    });
  }
  expect(
    (await service.simular(tenantId, maquinaId, pasos)).piezas,
  ).toHaveLength(3);
});

it('sólo carga geometría al solicitar la simulación, conservando liviano el listado', async () => {
  const fuentes = await leerFuentesCola(db, tenantId, pasos);
  expect(fuentes.every((f) => f.geometria === null)).toBe(true);
  expect(JSON.stringify(fuentes)).not.toMatch(/placements|allowRotation/);
});

it('valida los IDs del contrato de entrada', async () => {
  for (const ids of [
    [],
    ['incorrecto'],
    [pasos[0], pasos[0]],
    Array.from({ length: 51 }, () => randomUUID()),
  ]) {
    expect(
      (
        await validate(
          Object.assign(new SimularNestingColaDto(), { pasoIds: ids }),
        )
      ).length,
    ).toBeGreaterThan(0);
  }
  expect(
    await validate(
      Object.assign(new SimularNestingColaDto(), { pasoIds: pasos }),
    ),
  ).toHaveLength(0);
});

it('recupera piezas diferidas de un componente desde la traza de su producto padre', async () => {
  const padreId = randomUUID(),
    hijoId = randomUUID(),
    pasoId = randomUUID();
  const base = {
    tenantId,
    ordenId,
    familia: 'grafica',
    cantidad: 1,
    cantidadUnidad: 'u',
    subtotal: 0,
    impuestos: 0,
    total: 0,
  };
  const placements = Array.from({ length: 500 }, (_, i) => ({
    pieceId: `piece-${i}-0`,
    widthMm: 100,
    heightMm: 200,
    rotated: false,
    panelIndex: 1,
    panelCount: 2,
    overlapStartMm: 0,
    overlapEndMm: 20,
    usefulWidthMm: 80,
    usefulHeightMm: 200,
  }));
  await db.ordenTrabajoItem.create({
    data: {
      ...base,
      id: padreId,
      codigo: 'PADRE',
      nombre: 'Producto compuesto',
      trazabilidadSnapshotJson: {
        componentesFabricados: [
          {
            codigo: 'VIN',
            pasos: [
              {
                rutaPasoId: 'ruta-hijo',
                nestingResult: {
                  algorithm: 'maxrects-rollo',
                  visualConfig: {
                    allowRotation: true,
                    panelizado: { enabled: true, panelCount: 2 },
                  },
                  placements,
                  substrates: [{ kind: 'roll', widthMm: 1370 }],
                  sustrato: { materialVarianteId: varianteA },
                },
              },
            ],
          },
        ],
      },
    },
  });
  await db.ordenTrabajoItem.create({
    data: {
      ...base,
      id: hijoId,
      parentItemId: padreId,
      componenteCodigo: 'VIN',
      codigo: 'HIJO',
      nombre: 'Componente impreso',
    },
  });
  await db.ordenTrabajoItemPaso.create({
    data: {
      id: pasoId,
      tenantId,
      ordenId,
      itemId: hijoId,
      maquinaId,
      indice: 0,
      rutaPasoId: 'ruta-hijo',
      nombre: 'Impresión componente',
      familiaCodigo: 'impresion_por_area',
      categoriaFamilia: 'produccion_impresion',
    },
  });
  const fuentes = await leerFuentesCola(db, tenantId, [pasoId], true);
  expect(fuentes[0].geometria).toHaveProperty('__grafo_geometrias_v2');
  expect(
    extraerPiezasRollo(fuentes[0].geometria, 0, 'Componente').piezas,
  ).toHaveLength(500);
  expect(fuentes[0].productoCompuesto).toBe(true);
  const configuraciones = await leerConfiguracionesCola(db, tenantId, [pasoId]);
  expect(configuraciones.get(pasoId)).toMatchObject({
    productoCompuesto: true,
    layoutConservado: true,
    paneles: [
      { panel: 1, paneles: 2, anchoMm: 100, altoMm: 200, cantidad: 500 },
    ],
  });
  expect(JSON.stringify([...configuraciones.values()])).not.toMatch(
    /placements|__grafo_geometrias_v2|usefulWidthMm/,
  );
  // Disponer de geometría no autoriza desarmar el layout de un compuesto.
  await expect(service.simular(tenantId, maquinaId, [pasoId])).rejects.toThrow(
    'producto compuesto',
  );
  const pasoPadre = await db.ordenTrabajoItemPaso.create({
    data: {
      tenantId,
      ordenId,
      itemId: padreId,
      maquinaId,
      indice: 0,
      nombre: 'Imprimir conjunto',
      familiaCodigo: 'impresion_por_area',
      categoriaFamilia: 'produccion_impresion',
    },
  });
  await expect(
    service.simular(tenantId, maquinaId, [pasoPadre.id]),
  ).rejects.toThrow('producto compuesto');
});

it('reutiliza la misma selección simultánea, limita otras y libera la plaza al terminar', async () => {
  const primera = service.simular(tenantId, maquinaId, pasos);
  const repetida = service.simular(tenantId, maquinaId, [...pasos].reverse());
  await expect(
    service.simular(tenantId, maquinaId, [pasos[0]]),
  ).rejects.toThrow('simulación en curso');
  const [a, b] = await Promise.all([primera, repetida]);
  expect(a.piezas).toHaveLength(3);
  expect(b).toBe(a);
  expect(
    (await service.simular(tenantId, maquinaId, pasos)).piezas,
  ).toHaveLength(3);
});
