/**
 * Setup IDEMPOTENTE de anillado para el tenant demo de DEV: instala unos
 * espirales (materia prima con variantes y precio) desde la tabla de la
 * biblioteca, apunta la config del Centro de copiado a la anilladora y deja que
 * el provisionador cablee el paso opcional en la próxima cotización.
 *
 * NO es el seed destructivo. Re-correrlo no rompe nada.
 *   DATABASE_URL=... node prisma/install-anilladora-dev.js
 */
const { PrismaClient } = require('@prisma/client');
const { materialPresets } = require('./seed-modulos/material-presets');

// Precio de referencia por Ø (ARS, editable por el tenant después).
const PRECIO_POR_DIAMETRO = {
  6: 60, 8: 80, 10: 100, 12: 130, 14: 160, 16: 190,
  18: 230, 20: 270, 25: 340, 32: 430, 40: 560, 50: 720,
};

async function main() {
  const prisma = new PrismaClient();
  const tenant = await prisma.tenant.findFirstOrThrow({ select: { id: true, slug: true } });
  const tenantId = tenant.id;

  // Anilladora: la de la config, o la única ANILLADORA activa.
  const cfg = await prisma.centroCopiadoConfig.findUnique({
    where: { tenantId },
    select: { maquinaAnilladoraId: true },
  });
  const anilladoras = await prisma.maquina.findMany({
    where: { tenantId, plantilla: 'ANILLADORA', activo: true },
    select: { id: true, nombre: true, centroCostoPrincipalId: true },
  });
  const anilladora =
    (cfg?.maquinaAnilladoraId &&
      anilladoras.find((m) => m.id === cfg.maquinaAnilladoraId)) ||
    anilladoras[0];
  if (!anilladora) throw new Error('No hay ANILLADORA cargada en el tenant.');

  // Que tenga un centro de costo (para el tiempo). Si no, hereda el de una láser.
  if (!anilladora.centroCostoPrincipalId) {
    const laser = await prisma.maquina.findFirst({
      where: { tenantId, centroCostoPrincipalId: { not: null } },
      select: { centroCostoPrincipalId: true },
    });
    if (laser?.centroCostoPrincipalId) {
      await prisma.maquina.update({
        where: { id: anilladora.id },
        data: { centroCostoPrincipalId: laser.centroCostoPrincipalId },
      });
    }
  }

  // Perfil operativo (aporta el TIEMPO: productividad + setup/cleanup). Sin
  // perfil, el anillado se cobra sin tiempo de máquina. Productividad = hojas/h.
  await prisma.maquinaPerfilOperativo.upsert({
    where: {
      tenantId_maquinaId_nombre: {
        tenantId,
        maquinaId: anilladora.id,
        nombre: 'Espiral plástico',
      },
    },
    create: {
      tenantId,
      maquinaId: anilladora.id,
      nombre: 'Espiral plástico',
      tipoPerfil: 'FABRICACION',
      productivityValue: 1200,
      productivityUnit: 'PIEZAS_H',
      setupMin: 1,
      cleanupMin: 1,
      detalleJson: { tipoAnillo: 'ESPIRAL_PLASTICO' },
    },
    update: {
      productivityValue: 1200,
      productivityUnit: 'PIEZAS_H',
      detalleJson: { tipoAnillo: 'ESPIRAL_PLASTICO' },
    },
  });

  // Espirales: materia prima + variantes (upsert por SKU) desde la biblioteca.
  const preset = materialPresets.find((p) => p.key === 'ESPIRAL_PLASTICO');
  const anillo = await prisma.materiaPrima.upsert({
    where: { tenantId_codigo: { tenantId, codigo: 'ESPIRAL-PVC' } },
    create: {
      tenantId,
      codigo: 'ESPIRAL-PVC',
      nombre: 'Espiral plástico (PVC)',
      familia: preset.familia,
      subfamilia: preset.subfamilia,
      tipoTecnico: preset.tipoTecnico,
      templateId: preset.templateId,
      unidadStock: 'UNIDAD',
      unidadCompra: 'CAJA',
      atributosTecnicosJson: {},
    },
    update: {},
    select: { id: true },
  });

  for (const v of preset.variantes) {
    const d = Number(v.atributosVarianteJson.diametro);
    await prisma.materiaPrimaVariante.upsert({
      where: { tenantId_sku: { tenantId, sku: v.skuSugerido } },
      create: {
        tenantId,
        materiaPrimaId: anillo.id,
        sku: v.skuSugerido,
        precioReferencia: PRECIO_POR_DIAMETRO[d] ?? 100,
        moneda: 'ARS',
        atributosVarianteJson: v.atributosVarianteJson,
      },
      update: { precioReferencia: PRECIO_POR_DIAMETRO[d] ?? 100 },
    });
  }

  // Wire-O: segundo TIPO de anillo (así aparece el selector de tipo en el TPV).
  // Capacidades 3:1 aproximadas (hojas a 80g). Editable por el tenant.
  const wireo = await prisma.materiaPrima.upsert({
    where: { tenantId_codigo: { tenantId, codigo: 'WIRE-O' } },
    create: {
      tenantId,
      codigo: 'WIRE-O',
      nombre: 'Wire-O (anillo metálico)',
      familia: preset.familia,
      subfamilia: preset.subfamilia,
      tipoTecnico: preset.tipoTecnico,
      templateId: preset.templateId,
      unidadStock: 'UNIDAD',
      unidadCompra: 'CAJA',
      atributosTecnicosJson: {},
    },
    update: {},
    select: { id: true },
  });
  const wireoTabla = [
    [6.9, 45], [7.9, 60], [9.5, 75], [11, 90], [12.7, 105],
    [14.3, 120], [15.9, 135], [19, 165], [22, 190], [25.4, 220],
  ];
  for (const [diametro, capacidadMaxHojas] of wireoTabla) {
    await prisma.materiaPrimaVariante.upsert({
      where: { tenantId_sku: { tenantId, sku: `WIREO-${diametro}MM-NEGRO` } },
      create: {
        tenantId,
        materiaPrimaId: wireo.id,
        sku: `WIREO-${diametro}MM-NEGRO`,
        precioReferencia: Math.round(diametro * 12),
        moneda: 'ARS',
        atributosVarianteJson: {
          tipoAnillo: 'WIRE_O',
          diametro,
          capacidadMaxHojas,
          color: 'negro',
          material: 'metal',
          pasoPerforacion: '3:1',
        },
      },
      update: { precioReferencia: Math.round(diametro * 12) },
    });
  }

  // Apuntar la config a la anilladora (dispara el cableado del paso).
  await prisma.centroCopiadoConfig.update({
    where: { tenantId },
    data: { maquinaAnilladoraId: anilladora.id },
  });

  const nVar = await prisma.materiaPrimaVariante.count({ where: { materiaPrimaId: anillo.id } });
  console.log(
    `OK · tenant ${tenant.slug} · anilladora "${anilladora.nombre}" · ${nVar} espirales instalados`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
