/**
 * Instalador idempotente del preset global VINILO_ESMERILADO.
 * Agrega o actualiza el catálogo y sus cuatro variantes sin tocar materiales
 * ni precios que los tenants ya hayan instalado.
 *
 *   node prisma/install-vinilo-esmerilado-preset.js
 */
const { PrismaClient } = require('@prisma/client');
const { materialPresets } = require('./seed-modulos/material-presets');

async function main() {
  const prisma = new PrismaClient();
  const preset = materialPresets.find(
    (item) => item.key === 'VINILO_ESMERILADO',
  );
  if (!preset) throw new Error('No se encontró el preset VINILO_ESMERILADO');

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

  for (const [orden, variante] of preset.variantes.entries()) {
    await prisma.materialPresetVariante.upsert({
      where: {
        presetId_skuSugerido: {
          presetId: row.id,
          skuSugerido: variante.skuSugerido,
        },
      },
      create: { presetId: row.id, ...variante, orden },
      update: { ...variante, orden, activo: true },
    });
  }

  const variantes = await prisma.materialPresetVariante.count({
    where: { presetId: row.id, activo: true },
  });
  console.log(`OK · preset ${row.key} con ${variantes} variantes activas`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
