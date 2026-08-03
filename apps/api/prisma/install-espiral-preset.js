/**
 * Instalador IDEMPOTENTE de un solo preset de biblioteca: ESPIRAL_PLASTICO.
 *
 * NO es el seed destructivo (`seed.js` hace deleteMany — jamás correrlo contra
 * dev). Esto sólo upsertea la fila MaterialPreset `ESPIRAL_PLASTICO` y sus
 * variantes por (presetId, skuSugerido). Re-correrlo no rompe nada.
 *
 *   DATABASE_URL=... node prisma/install-espiral-preset.js
 */
const { PrismaClient } = require('@prisma/client');
const { materialPresets } = require('./seed-modulos/material-presets');

async function main() {
  const prisma = new PrismaClient();
  const preset = materialPresets.find((p) => p.key === 'ESPIRAL_PLASTICO');
  if (!preset) throw new Error('No se encontró el preset ESPIRAL_PLASTICO');

  const data = {
    nombreCanonico: preset.nombreCanonico,
    descripcionCorta: preset.descripcionCorta,
    familia: preset.familia,
    subfamilia: preset.subfamilia,
    tipoTecnico: preset.tipoTecnico,
    templateId: preset.templateId,
    iconKind: preset.iconKind,
    aliasDisponiblesJson: preset.aliasDisponibles,
    usosRecomendadosJson: preset.usosRecomendados,
    procesosCompatiblesJson: preset.procesosCompatibles,
    advertenciasJson: preset.advertencias,
    activo: true,
  };

  const row = await prisma.materialPreset.upsert({
    where: { key: preset.key },
    create: { key: preset.key, ...data },
    update: data,
  });

  let orden = 0;
  for (const v of preset.variantes) {
    await prisma.materialPresetVariante.upsert({
      where: { presetId_skuSugerido: { presetId: row.id, skuSugerido: v.skuSugerido } },
      create: { presetId: row.id, ...v, orden: orden++ },
      update: { ...v, orden: orden++ },
    });
  }

  const n = await prisma.materialPresetVariante.count({ where: { presetId: row.id } });
  console.log(`OK · preset ${row.key} (${row.id}) con ${n} variantes`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
