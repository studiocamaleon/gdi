import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { guardarConfigPouch, leerConfigPouch } from '../pouch-copiado';

const db = new PrismaClient();
const tenantId = randomUUID(),
  categoriaId = randomUUID(),
  subId = randomUUID();
let rutaId: string, centroCostoId: string, varianteId: string;
beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test'))
    throw new Error('Requiere base aislada');
  await db.tenant.create({
    data: {
      id: tenantId,
      slug: `pouch-${tenantId}`,
      nombre: 'Empresa ficticia pouch',
    },
  });
  const planta = await db.planta.create({
    data: { tenantId, codigo: 'TALLER', nombre: 'Taller ficticio' },
  });
  centroCostoId = (
    await db.centroCosto.create({
      data: {
        tenantId,
        plantaId: planta.id,
        codigo: 'POUCH',
        nombre: 'Centro ficticio',
        tipoCentro: 'PRODUCTIVO',
      },
    })
  ).id;
  await db.productoCategoriaComercial.create({
    data: {
      id: categoriaId,
      codigo: categoriaId,
      nombre: 'Categoría ficticia',
    },
  });
  await db.productoSubcategoriaComercial.create({
    data: {
      id: subId,
      categoriaId,
      codigo: subId,
      nombre: 'Subcategoría ficticia',
      atributosSchemaJson: {},
    },
  });
  const producto = await db.producto.create({
    data: {
      tenantId,
      codigo: 'SYS-IMPRESION-DOC',
      nombre: 'Impresión ficticia',
      subcategoriaComercialId: subId,
    },
  });
  rutaId = (
    await db.ruta.create({
      data: { tenantId, codigo: 'CC', nombre: 'Ruta ficticia' },
    })
  ).id;
  const alternativaId = (
    await db.productoRutaAlternativa.create({
      data: {
        tenantId,
        productoId: producto.id,
        rutaId,
        rutaVersion: 1,
        nombre: 'Impresión y anillado',
      },
    })
  ).id;
  const pasos = [];
  for (const [orden, familiaCodigo] of [
    'impresion_laser',
    'encuadernado_anillado',
  ].entries()) {
    const p = await db.rutaPaso.create({
      data: { tenantId, rutaId, version: 1, orden, familiaCodigo },
    });
    await db.productoConfigPaso.create({
      data: {
        tenantId,
        productoRutaAlternativaId: alternativaId,
        rutaPasoId: p.id,
      },
    });
    pasos.push({ id: p.id, orden, familia: familiaCodigo });
  }
  await db.rutaVersion.create({
    data: { tenantId, rutaId, version: 1, snapshotJson: { pasos } },
  });
  const mp = await db.materiaPrima.create({
    data: {
      tenantId,
      codigo: 'POUCH',
      nombre: 'Sobre ficticio',
      familia: 'TRANSFERENCIA_LAMINACION',
      subfamilia: 'LAMINADO_POUCH',
      tipoTecnico: 'laminado_pouch',
      templateId: 'laminado_pouch_v1',
      unidadStock: 'UNIDAD',
      unidadCompra: 'PACK',
      atributosTecnicosJson: { margenNoUsableMm: 3 },
    },
  });
  varianteId = (
    await db.materiaPrimaVariante.create({
      data: {
        tenantId,
        materiaPrimaId: mp.id,
        sku: 'A4',
        atributosVarianteJson: {
          anchoMm: 216,
          altoMm: 303,
          unidadesPorPack: 100,
        },
        precioReferencia: 10000,
        unidadPrecio: 'PACK',
        equivalenciaCompra: 100,
        moneda: 'ARS',
      },
    })
  ).id;
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { id: tenantId } });
  await db.productoSubcategoriaComercial.deleteMany({ where: { id: subId } });
  await db.productoCategoriaComercial.deleteMany({
    where: { id: categoriaId },
  });
  await db.$disconnect();
});
it('inserta el pouch antes del anillado y guarda sin duplicar pasos ni candidatos', async () => {
  const config = {
    centroCostoId,
    minutosPorHoja: 0.5,
    formatos: [{ tamano: 'A4', varianteId }],
  };
  for (let i = 0; i < 2; i++)
    await db.$transaction((tx) =>
      guardarConfigPouch(tx, tenantId, config, true),
    );
  const pasos = await db.rutaPaso.findMany({
    where: { tenantId, rutaId },
    orderBy: { orden: 'asc' },
  });
  expect(pasos.map((p) => p.familiaCodigo)).toEqual([
    'impresion_laser',
    'plastificado_pouch',
    'encuadernado_anillado',
  ]);
  expect(pasos.map((p) => p.orden)).toEqual([0, 1, 2]);
  const cp = await db.productoConfigPaso.findFirstOrThrow({
    where: { tenantId, rutaPasoId: pasos[1].id },
    include: { slotsMateriales: { include: { candidatos: true } } },
  });
  expect(leerConfigPouch(cp.paramsPasoJson)).toEqual(config);
  expect(cp.modoActivacion).toBe('OPCIONAL');
  expect(cp.slotsMateriales).toHaveLength(1);
  expect(cp.slotsMateriales[0].candidatos).toHaveLength(1);
  const version = await db.rutaVersion.findFirstOrThrow({
    where: { tenantId, rutaId },
  });
  const snapshot = version.snapshotJson as {
    pasos: { orden: number; familia: string }[];
  };
  expect(
    snapshot.pasos.sort((a, b) => a.orden - b.orden).map((p) => p.familia),
  ).toEqual(pasos.map((p) => p.familiaCodigo));
  await db.$transaction((tx) =>
    guardarConfigPouch(tx, tenantId, { ...config, minutosPorHoja: 1 }, false),
  );
  const actualizado = await db.productoConfigPaso.findUniqueOrThrow({
    where: { id: cp.id },
  });
  expect(leerConfigPouch(actualizado.paramsPasoJson).minutosPorHoja).toBe(1);
});
