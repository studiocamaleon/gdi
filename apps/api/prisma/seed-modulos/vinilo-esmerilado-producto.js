/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Provisionador idempotente de Vinilo esmerilado troquelado.
 *
 * Instala el preset/material cuando falta y crea dos alternativas productivas:
 * - plotter de corte (preferida);
 * - corte recto manual, con el mismo nesting y consumo de rollo.
 *
 * Los precios del material pertenecen al tenant y nunca se pisan.
 */
const { materialPresets } = require('./material-presets');

const PRESET_KEY = 'VINILO_ESMERILADO';
const MATERIAL_CODE = 'VINILO_ESMERILADO';
const PRODUCT_CODE = 'VINILO-ESMERILADO-TROQUELADO';
const PLOTTER_ROUTE_CODE = 'RUTA-VINILO-ESMERILADO-PLOTTER';
const MANUAL_ROUTE_CODE = 'RUTA-VINILO-ESMERILADO-MANUAL';

function presetSource() {
  const preset = materialPresets.find((item) => item.key === PRESET_KEY);
  if (!preset) throw new Error(`No existe el preset ${PRESET_KEY}.`);
  return preset;
}

async function syncLibrary(prisma) {
  const source = presetSource();
  const data = {
    nombreCanonico: source.nombreCanonico,
    descripcionCorta: source.descripcionCorta,
    familia: source.familia,
    subfamilia: source.subfamilia,
    tipoTecnico: source.tipoTecnico,
    templateId: source.templateId,
    iconKind: source.iconKind,
    aliasDisponiblesJson: source.aliasDisponibles,
    usosRecomendadosJson: source.usosRecomendados,
    procesosCompatiblesJson: source.procesosCompatibles,
    advertenciasJson: source.advertencias,
    activo: true,
  };
  const preset = await prisma.materialPreset.upsert({
    where: { key: PRESET_KEY },
    create: { key: PRESET_KEY, ...data },
    update: data,
  });

  const variants = [];
  for (const [orden, variant] of source.variantes.entries()) {
    variants.push(
      await prisma.materialPresetVariante.upsert({
        where: {
          presetId_skuSugerido: {
            presetId: preset.id,
            skuSugerido: variant.skuSugerido,
          },
        },
        create: { presetId: preset.id, ...variant, orden, activo: true },
        update: { ...variant, orden, activo: true },
      }),
    );
  }
  return { preset, variants };
}

async function installMaterial(prisma, tenantId, library) {
  const material = await prisma.materiaPrima.upsert({
    where: { tenantId_codigo: { tenantId, codigo: MATERIAL_CODE } },
    create: {
      tenantId,
      materialPresetId: library.preset.id,
      canonicalMaterialKey: PRESET_KEY,
      canonicalMaterialName: library.preset.nombreCanonico,
      canonicalAliasUsado: 'Vinilo esmerilado',
      codigo: MATERIAL_CODE,
      nombre: 'Vinilo esmerilado',
      descripcion:
        'Vinilo esmerilado blanco o gris en rollos de 61 y 122 cm × 50 m.',
      familia: library.preset.familia,
      subfamilia: library.preset.subfamilia,
      tipoTecnico: library.preset.tipoTecnico,
      templateId: library.preset.templateId,
      unidadStock: 'METRO_LINEAL',
      unidadCompra: 'ROLLO',
      atributosTecnicosJson: {},
      activo: true,
    },
    update: {
      materialPresetId: library.preset.id,
      canonicalMaterialKey: PRESET_KEY,
      canonicalMaterialName: library.preset.nombreCanonico,
      familia: library.preset.familia,
      subfamilia: library.preset.subfamilia,
      tipoTecnico: library.preset.tipoTecnico,
      templateId: library.preset.templateId,
      activo: true,
    },
  });

  const variants = [];
  for (const source of library.variants) {
    variants.push(
      await prisma.materiaPrimaVariante.upsert({
        where: { tenantId_sku: { tenantId, sku: source.skuSugerido } },
        create: {
          tenantId,
          materiaPrimaId: material.id,
          materialPresetVarianteId: source.id,
          sku: source.skuSugerido,
          nombreVariante: source.nombreVarianteSugerido,
          atributosVarianteJson: source.atributosVarianteJson,
          unidadStock: source.unidadStock,
          unidadCompra: source.unidadCompra,
          precioReferencia: null,
          moneda: source.moneda ?? 'ARS',
          activo: true,
        },
        update: {
          materiaPrimaId: material.id,
          materialPresetVarianteId: source.id,
          atributosVarianteJson: source.atributosVarianteJson,
          unidadStock: source.unidadStock,
          unidadCompra: source.unidadCompra,
          activo: true,
        },
      }),
    );
  }
  return { material, variants };
}

async function ensureRoute(prisma, tenantId, definition) {
  const route = await prisma.ruta.upsert({
    where: { tenantId_codigo: { tenantId, codigo: definition.codigo } },
    create: {
      tenantId,
      codigo: definition.codigo,
      nombre: definition.nombre,
      descripcion: definition.descripcion,
      versionActual: 1,
      activo: true,
    },
    update: {
      nombre: definition.nombre,
      descripcion: definition.descripcion,
      activo: true,
    },
  });
  const steps = [];
  for (const [index, step] of definition.pasos.entries()) {
    steps.push(
      await prisma.rutaPaso.upsert({
        where: {
          tenantId_rutaId_version_orden: {
            tenantId,
            rutaId: route.id,
            version: 1,
            orden: index + 1,
          },
        },
        create: {
          tenantId,
          rutaId: route.id,
          version: 1,
          orden: index + 1,
          familiaCodigo: step.familiaCodigo,
          nombreVisible: step.nombreVisible,
          activo: true,
        },
        update: {
          familiaCodigo: step.familiaCodigo,
          nombreVisible: step.nombreVisible,
          activo: true,
        },
      }),
    );
  }
  await prisma.rutaPaso.updateMany({
    where: {
      tenantId,
      rutaId: route.id,
      version: 1,
      orden: { gt: definition.pasos.length },
    },
    data: { activo: false },
  });
  await prisma.rutaVersion.upsert({
    where: {
      tenantId_rutaId_version: { tenantId, rutaId: route.id, version: 1 },
    },
    create: {
      tenantId,
      rutaId: route.id,
      version: 1,
      snapshotJson: {
        pasos: steps.map(({ orden, familiaCodigo, nombreVisible }) => ({
          orden,
          familia: familiaCodigo,
          nombreVisible,
        })),
      },
      cambios: 'Versión inicial para corte de vinilo esmerilado',
    },
    update: {
      snapshotJson: {
        pasos: steps.map(({ orden, familiaCodigo, nombreVisible }) => ({
          orden,
          familia: familiaCodigo,
          nombreVisible,
        })),
      },
    },
  });
  return { route, steps };
}

async function ensureAlternative(prisma, data) {
  const existing = await prisma.productoRutaAlternativa.findFirst({
    where: {
      tenantId: data.tenantId,
      productoId: data.productoId,
      rutaId: data.rutaId,
    },
  });
  if (existing) {
    return prisma.productoRutaAlternativa.update({
      where: { id: existing.id },
      data,
    });
  }
  return prisma.productoRutaAlternativa.create({ data });
}

async function ensureStepConfig(prisma, data) {
  return prisma.productoConfigPaso.upsert({
    where: {
      tenantId_productoRutaAlternativaId_rutaPasoId: {
        tenantId: data.tenantId,
        productoRutaAlternativaId: data.productoRutaAlternativaId,
        rutaPasoId: data.rutaPasoId,
      },
    },
    create: data,
    update: data,
  });
}

async function attachMaterial(
  prisma,
  tenantId,
  config,
  installedMaterial,
  slotName,
) {
  const slot = await prisma.productoConfigPasoSlotMaterial.upsert({
    where: {
      tenantId_productoConfigPasoId_slotCodigo: {
        tenantId,
        productoConfigPasoId: config.id,
        slotCodigo: 'sustrato_corte',
      },
    },
    create: {
      tenantId,
      productoConfigPasoId: config.id,
      slotCodigo: 'sustrato_corte',
      slotNombre: slotName,
      slotRol: 'SUSTRATO',
      modoSeleccion: 'COMERCIAL_ELIGE',
      formula: 'por_metro_lineal',
      activo: true,
    },
    update: {
      slotNombre: slotName,
      slotRol: 'SUSTRATO',
      modoSeleccion: 'COMERCIAL_ELIGE',
      formula: 'por_metro_lineal',
      activo: true,
    },
  });
  const preferred =
    installedMaterial.variants.find((item) =>
      item.sku.includes('BLANCO-061CM'),
    ) ?? installedMaterial.variants[0];
  await prisma.productoConfigPasoSlotMaterialCandidato.upsert({
    where: {
      tenantId_slotMaterialId_materiaPrimaId: {
        tenantId,
        slotMaterialId: slot.id,
        materiaPrimaId: installedMaterial.material.id,
      },
    },
    create: {
      tenantId,
      slotMaterialId: slot.id,
      materiaPrimaId: installedMaterial.material.id,
      defaultVarianteId: preferred?.id,
      todasLasVariantes: true,
      orden: 0,
    },
    update: {
      defaultVarianteId: preferred?.id,
      todasLasVariantes: true,
      orden: 0,
    },
  });
}

async function provisionViniloEsmeriladoProduct(prisma, tenantId) {
  const library = await syncLibrary(prisma);
  const installedMaterial = await installMaterial(prisma, tenantId, library);
  const subcategory = await prisma.productoSubcategoriaComercial.findUnique({
    where: { codigo: 'vinilos_corte' },
  });
  if (!subcategory)
    throw new Error('Falta la subcategoría comercial vinilos_corte.');

  const plotter = await prisma.maquina.findFirst({
    where: { tenantId, plantilla: 'PLOTTER_DE_CORTE', activo: true },
    include: {
      perfilesOperativos: {
        where: { activo: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!plotter) throw new Error('Falta un plotter de corte activo.');
  const plotterProfile =
    plotter.perfilesOperativos.find((item) =>
      /corte completo|formas simples.*vinilo/i.test(item.nombre),
    ) ?? plotter.perfilesOperativos[0];
  if (!plotterProfile)
    throw new Error('El plotter de corte no tiene un perfil activo.');

  const prepressCostCenter = await prisma.centroCosto.findFirst({
    where: { tenantId, codigo: 'PRE-001', activo: true },
  });
  const workshopCostCenter = await prisma.centroCosto.findFirst({
    where: { tenantId, codigo: 'IMP-003', activo: true },
  });
  if (!prepressCostCenter || !workshopCostCenter) {
    throw new Error(
      'Faltan los centros PRE-001 o IMP-003 para configurar las rutas.',
    );
  }

  const plotterRoute = await ensureRoute(prisma, tenantId, {
    codigo: PLOTTER_ROUTE_CODE,
    nombre: 'Vinilo esmerilado por plotter',
    descripcion: 'Preparación y troquelado de piezas en plotter de corte.',
    pasos: [
      {
        familiaCodigo: 'pre_prensa',
        nombreVisible: 'Preparación de archivo de corte',
      },
      {
        familiaCodigo: 'plotter_corte',
        nombreVisible: 'Troquelado en plotter',
      },
    ],
  });
  const manualRoute = await ensureRoute(prisma, tenantId, {
    codigo: MANUAL_ROUTE_CODE,
    nombre: 'Vinilo esmerilado con corte recto manual',
    descripcion: 'Acomodado sobre rollo y corte recto con regla y trincheta.',
    pasos: [
      { familiaCodigo: 'corte_manual', nombreVisible: 'Corte recto manual' },
    ],
  });

  const product = await prisma.producto.upsert({
    where: { tenantId_codigo: { tenantId, codigo: PRODUCT_CODE } },
    create: {
      tenantId,
      codigo: PRODUCT_CODE,
      nombre: 'Vinilo esmerilado troquelado',
      descripcion:
        'Piezas de vinilo esmerilado blanco o gris, cortadas por plotter o en forma recta manual.',
      subcategoriaComercialId: subcategory.id,
      unidadComercial: 'unidad',
      modoMedidas: 'LIBRE',
      medidaDefaultAnchoMm: '300',
      medidaDefaultAltoMm: '300',
      atributosComercialesJson: {
        material: 'Vinilo esmerilado',
        colores: ['Blanco', 'Gris'],
        proceso: 'Troquelado o corte recto',
      },
      precioConfigJson: {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 40, minimumMarginPct: 25 },
      },
      activo: true,
    },
    update: {
      nombre: 'Vinilo esmerilado troquelado',
      descripcion:
        'Piezas de vinilo esmerilado blanco o gris, cortadas por plotter o en forma recta manual.',
      subcategoriaComercialId: subcategory.id,
      unidadComercial: 'unidad',
      modoMedidas: 'LIBRE',
      activo: true,
    },
  });

  const plotterAlternative = await ensureAlternative(prisma, {
    tenantId,
    productoId: product.id,
    rutaId: plotterRoute.route.id,
    rutaVersion: 1,
    nombre: 'Troquelado en plotter',
    esPreferida: true,
    orden: 0,
    activo: true,
  });
  const manualAlternative = await ensureAlternative(prisma, {
    tenantId,
    productoId: product.id,
    rutaId: manualRoute.route.id,
    rutaVersion: 1,
    nombre: 'Corte recto manual',
    esPreferida: false,
    orden: 1,
    activo: true,
  });

  await ensureStepConfig(prisma, {
    tenantId,
    productoRutaAlternativaId: plotterAlternative.id,
    rutaPasoId: plotterRoute.steps[0].id,
    modoActivacion: 'OBLIGATORIO',
    modoTiempo: 'T-1',
    mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
    centroCostoId: prepressCostCenter.id,
    tiempoFijoOverrideMin: '10',
    nombreVisible: 'Preparación de archivo de corte',
    activo: true,
  });
  const plotterConfig = await ensureStepConfig(prisma, {
    tenantId,
    productoRutaAlternativaId: plotterAlternative.id,
    rutaPasoId: plotterRoute.steps[1].id,
    modoActivacion: 'OBLIGATORIO',
    modoTiempo: 'T-3',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    maquinaM1Id: plotter.id,
    perfilM1Id: plotterProfile.id,
    paramsPasoJson: {
      tipoCorte: 'COMPLETO',
      nestingConfig: {
        algorithm: 'auto',
        allowRotation: true,
        separationHMm: 5,
        separationVMm: 5,
        costing: { strategy: 'simple' },
      },
    },
    nombreVisible: 'Troquelado en plotter',
    activo: true,
  });
  await attachMaterial(
    prisma,
    tenantId,
    plotterConfig,
    installedMaterial,
    'Vinilo esmerilado a troquelar',
  );

  const manualConfig = await ensureStepConfig(prisma, {
    tenantId,
    productoRutaAlternativaId: manualAlternative.id,
    rutaPasoId: manualRoute.steps[0].id,
    modoActivacion: 'OBLIGATORIO',
    modoTiempo: 'T-2',
    mecanismoCantidad: 'CALCULADO_POR_PASO',
    centroCostoId: workshopCostCenter.id,
    paramsPasoJson: {
      productivityValue: 30,
      productivityUnit: 'ml_h',
      productivityQuantitySource: 'metros_lineales',
      nestingConfig: {
        algorithm: 'auto',
        allowRotation: true,
        separationHMm: 2,
        separationVMm: 2,
        costing: { strategy: 'simple' },
      },
    },
    nombreVisible: 'Corte recto manual',
    activo: true,
  });
  await attachMaterial(
    prisma,
    tenantId,
    manualConfig,
    installedMaterial,
    'Vinilo esmerilado a cortar',
  );

  return { product, plotterRoute, manualRoute };
}

module.exports = {
  MANUAL_ROUTE_CODE,
  MATERIAL_CODE,
  PLOTTER_ROUTE_CODE,
  PRESET_KEY,
  PRODUCT_CODE,
  provisionViniloEsmeriladoProduct,
};
