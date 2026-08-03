/**
 * Instalador IDEMPOTENTE de los presets de biblioteca de ENCUADERNACIÓN por
 * anillo: espiral plástico, Wire-O y las tapas (frontal transparente +
 * contratapa de color). Upsertea las filas MaterialPreset (catálogo GLOBAL, sin
 * tenant) y sus variantes por (presetId, skuSugerido). Re-correrlo no rompe nada.
 *
 * NO es el seed destructivo (`seedMaterialPresets` hace deleteMany — jamás contra
 * dev). Esto sólo agrega/actualiza estos 4 presets.
 *
 *   DATABASE_URL=... node prisma/install-anillado-presets.js
 */
const { PrismaClient } = require('@prisma/client');
const { materialPresets } = require('./seed-modulos/material-presets');

const KEYS = [
  'ESPIRAL_PLASTICO',
  'ESPIRAL_WIRE_O',
  'TAPA_ENCUADERNACION_TRANSPARENTE',
  'CONTRATAPA_ENCUADERNACION_COLOR',
];

async function main() {
  const prisma = new PrismaClient();
  for (const key of KEYS) {
    const preset = materialPresets.find((p) => p.key === key);
    if (!preset) throw new Error(`No se encontró el preset ${key}`);

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
        where: {
          presetId_skuSugerido: { presetId: row.id, skuSugerido: v.skuSugerido },
        },
        create: { presetId: row.id, ...v, orden: orden++ },
        update: { ...v, orden: orden++ },
      });
    }

    const n = await prisma.materialPresetVariante.count({
      where: { presetId: row.id },
    });
    console.log(`OK · preset ${row.key} (${row.id}) con ${n} variantes`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
