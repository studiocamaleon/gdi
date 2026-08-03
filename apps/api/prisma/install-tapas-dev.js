/**
 * Setup IDEMPOTENTE de TAPAS de encuadernación para el tenant demo de DEV:
 * instala una tapa frontal transparente (PP) y una contratapa plástica de color
 * (PP negro), cada una con variantes por tamaño (A4 / Oficio / A3) y precio de
 * referencia. El anillado con espiral las incluye (1 tapa + 1 contratapa por
 * libro); el Wire-O NO. El provisionador crea los 2 slots en el próximo cotizar,
 * y esta instalación apunta la Config del centro de copiado a las 2 materias.
 *
 * NO es el seed destructivo. Re-correrlo no rompe nada (upsert por SKU).
 *   DATABASE_URL=... node prisma/install-tapas-dev.js
 */
const { PrismaClient } = require('@prisma/client');

// Tamaños comunes en un centro de copiado (mm). La tapa se elige por el tamaño
// del documento (la menor que lo cubre), como el papel.
const TAMANOS = [
  { nombre: 'A4', ancho: 210, alto: 297 },
  { nombre: 'Oficio', ancho: 216, alto: 330 },
  { nombre: 'A3', ancho: 297, alto: 420 },
];

// Precio de referencia por (rol, tamaño) en ARS (editable por el tenant).
const PRECIO = {
  frontal: { A4: 150, Oficio: 180, A3: 280 },
  contratapa: { A4: 120, Oficio: 150, A3: 230 },
};

async function upsertTapa(prisma, tenantId, { codigo, nombre, atributos, rol, material }) {
  const mp = await prisma.materiaPrima.upsert({
    where: { tenantId_codigo: { tenantId, codigo } },
    create: {
      tenantId,
      codigo,
      nombre,
      familia: 'TERMINACION_EDITORIAL',
      subfamilia: 'TAPA_ENCUADERNACION',
      tipoTecnico: 'tapa_encuadernacion',
      templateId: 'tapa_encuadernacion_v1',
      unidadStock: 'UNIDAD',
      unidadCompra: 'CAJA',
      atributosTecnicosJson: atributos,
    },
    update: { atributosTecnicosJson: atributos },
    select: { id: true },
  });
  for (const t of TAMANOS) {
    const sku = `${codigo}-${t.nombre}`;
    await prisma.materiaPrimaVariante.upsert({
      where: { tenantId_sku: { tenantId, sku } },
      create: {
        tenantId,
        materiaPrimaId: mp.id,
        sku,
        precioReferencia: PRECIO[rol][t.nombre],
        moneda: 'ARS',
        atributosVarianteJson: {
          ancho: t.ancho,
          alto: t.alto,
          material,
        },
      },
      update: { precioReferencia: PRECIO[rol][t.nombre] },
    });
  }
  return mp.id;
}

async function main() {
  const prisma = new PrismaClient();
  const tenant = await prisma.tenant.findFirstOrThrow({
    select: { id: true, slug: true },
  });
  const tenantId = tenant.id;

  // Limpieza de la versión vieja (contratapa de cartón) si quedó de una corrida
  // anterior: la contratapa ahora es plástica de color.
  const vieja = await prisma.materiaPrima.findUnique({
    where: { tenantId_codigo: { tenantId, codigo: 'CONTRATAPA-CARTON' } },
    select: { id: true },
  });
  if (vieja) {
    await prisma.productoConfigPasoSlotMaterialCandidato.deleteMany({
      where: { tenantId, materiaPrimaId: vieja.id },
    });
    await prisma.materiaPrima
      .delete({ where: { id: vieja.id } })
      .catch(() => undefined);
  }

  const frontalId = await upsertTapa(prisma, tenantId, {
    codigo: 'TAPA-FRONTAL-PP',
    nombre: 'Tapa transparente (polipropileno)',
    atributos: { colorBase: 'transparente', material: 'polipropileno' },
    rol: 'frontal',
    material: 'polipropileno',
  });
  const contratapaId = await upsertTapa(prisma, tenantId, {
    codigo: 'CONTRATAPA-PP-COLOR',
    nombre: 'Contratapa opaca (polipropileno negro)',
    atributos: { colorBase: 'negro', material: 'polipropileno' },
    rol: 'contratapa',
    material: 'polipropileno',
  });

  const nVar = await prisma.materiaPrimaVariante.count({
    where: { materiaPrimaId: { in: [frontalId, contratapaId] } },
  });

  // Materializar los 2 slots de tapa en el paso de anillado (si ya existe), sin
  // esperar al heal perezoso de la próxima cotización. Mismo efecto que
  // asegurarSlotsTapaCC del provisionador, pero standalone (idempotente).
  const configPaso = await prisma.productoConfigPaso.findFirst({
    where: {
      tenantId,
      productoRutaAlternativa: { producto: { tenantId, codigo: 'SYS-IMPRESION-DOC' } },
      rutaPaso: { familiaCodigo: 'encuadernado_anillado' },
    },
    select: { id: true },
  });
  let slotsMsg = 'paso de anillado aún no existe (se cablea al cotizar)';
  if (configPaso) {
    for (const slotCodigo of ['tapa_frontal', 'tapa_posterior']) {
      let slot = await prisma.productoConfigPasoSlotMaterial.findFirst({
        where: { productoConfigPasoId: configPaso.id, slotCodigo },
        select: { id: true, candidatos: { select: { materiaPrimaId: true } } },
      });
      if (!slot) {
        const created = await prisma.productoConfigPasoSlotMaterial.create({
          data: {
            tenantId,
            productoConfigPasoId: configPaso.id,
            slotCodigo,
            slotRol: 'CONSUMIBLE',
            modoSeleccion: 'COMERCIAL_ELIGE',
            estrategiaCosto: 'simple',
            formula: 'por_unidad_productiva',
            aplicaMultiCaras: false,
            activo: true,
          },
          select: { id: true },
        });
        slot = { id: created.id, candidatos: [] };
      }
      const existentes = new Set(slot.candidatos.map((c) => c.materiaPrimaId));
      let orden = slot.candidatos.length;
      for (const mpId of [frontalId, contratapaId]) {
        if (existentes.has(mpId)) continue;
        const v = await prisma.materiaPrimaVariante.findFirst({
          where: { tenantId, materiaPrimaId: mpId },
          orderBy: { sku: 'asc' },
          select: { id: true },
        });
        if (!v) continue;
        await prisma.productoConfigPasoSlotMaterialCandidato.create({
          data: {
            tenantId,
            slotMaterialId: slot.id,
            materiaPrimaId: mpId,
            defaultVarianteId: v.id,
            orden: orden++,
            todasLasVariantes: true,
          },
        });
      }
    }
    slotsMsg = 'slots tapa_frontal + tapa_posterior con candidatos';
  }

  // Apuntar la Config del centro de copiado a las 2 materias (lo que el tenant
  // elegiría en Configuración). Así el motor pinnea el rol correcto sin heurística.
  await prisma.centroCopiadoConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      tapaFrontalMateriaPrimaId: frontalId,
      tapaContratapaMateriaPrimaId: contratapaId,
    },
    update: {
      tapaFrontalMateriaPrimaId: frontalId,
      tapaContratapaMateriaPrimaId: contratapaId,
    },
  });

  console.log(
    `OK · tenant ${tenant.slug} · tapas instaladas (frontal + contratapa) · ${nVar} variantes · ${slotsMsg}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
