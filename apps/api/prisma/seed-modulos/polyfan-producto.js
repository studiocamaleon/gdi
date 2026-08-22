/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Provisionador idempotente del primer producto vectorial sobre placa.
 *
 * Mantiene juntas las tres piezas que deben ser coherentes:
 * - preset global de biblioteca POLYFAN_XPS;
 * - materia prima instalada en el tenant;
 * - producto + ruta + slot de material para cotizar con nesting irregular.
 *
 * No asigna precios: cada tenant debe cargar el costo real de sus placas.
 */
const { materialPresets } = require('./material-presets');

const PRESET_KEY = 'POLYFAN_XPS';
const MATERIAL_CODE = 'POLYFAN-XPS';
const ROUTE_CODE = 'RUTA-POLYFAN-VECTORIAL';
const PRODUCT_CODE = 'CARTEL-POLYFAN-VECTORIAL';

function getPolyfanPreset() {
  const preset = materialPresets.find((item) => item.key === PRESET_KEY);
  if (!preset) throw new Error(`No existe el preset ${PRESET_KEY}.`);
  return preset;
}

async function syncPolyfanLibrary(prisma) {
  const presetSource = getPolyfanPreset();
  const preset = await prisma.materialPreset.upsert({
    where: { key: PRESET_KEY },
    create: {
      key: presetSource.key,
      nombreCanonico: presetSource.nombreCanonico,
      descripcionCorta: presetSource.descripcionCorta,
      familia: presetSource.familia ?? 'SUSTRATO',
      subfamilia: presetSource.subfamilia ?? 'SUSTRATO_RIGIDO',
      tipoTecnico: presetSource.tipoTecnico ?? 'polyfan_xps',
      templateId: presetSource.templateId ?? 'sustrato_rigido_v1',
      iconKind: presetSource.iconKind,
      aliasDisponiblesJson: presetSource.aliasDisponibles,
      usosRecomendadosJson: presetSource.usosRecomendados,
      procesosCompatiblesJson: presetSource.procesosCompatibles,
      advertenciasJson: presetSource.advertencias,
      orden: 1,
      activo: true,
    },
    update: {
      nombreCanonico: presetSource.nombreCanonico,
      descripcionCorta: presetSource.descripcionCorta,
      tipoTecnico: presetSource.tipoTecnico ?? 'polyfan_xps',
      iconKind: presetSource.iconKind,
      aliasDisponiblesJson: presetSource.aliasDisponibles,
      usosRecomendadosJson: presetSource.usosRecomendados,
      procesosCompatiblesJson: presetSource.procesosCompatibles,
      advertenciasJson: presetSource.advertencias,
      activo: true,
    },
  });

  const variantes = [];
  for (const [orden, source] of presetSource.variantes.entries()) {
    const variante = await prisma.materialPresetVariante.upsert({
      where: {
        presetId_skuSugerido: {
          presetId: preset.id,
          skuSugerido: source.skuSugerido,
        },
      },
      create: { presetId: preset.id, ...source, orden, activo: true },
      update: {
        nombreVarianteSugerido: source.nombreVarianteSugerido,
        formato: source.formato,
        espesor: source.espesor,
        color: source.color,
        recomendada: source.recomendada,
        atributosVarianteJson: source.atributosVarianteJson,
        unidadStock: source.unidadStock,
        unidadCompra: source.unidadCompra,
        moneda: source.moneda,
        orden,
        activo: true,
      },
    });
    variantes.push(variante);
  }

  return { preset, variantes };
}

async function installPolyfanMaterial(prisma, tenantId, library) {
  const material = await prisma.materiaPrima.upsert({
    where: { tenantId_codigo: { tenantId, codigo: MATERIAL_CODE } },
    create: {
      tenantId,
      materialPresetId: library.preset.id,
      canonicalMaterialKey: PRESET_KEY,
      canonicalMaterialName: library.preset.nombreCanonico,
      canonicalAliasUsado: 'Polyfan',
      codigo: MATERIAL_CODE,
      nombre: 'Polyfan (XPS alta densidad)',
      descripcion:
        'Placas de 1200 × 600 mm para carteles y letras corpóreas. Área útil inicial: 1180 × 580 mm.',
      familia: library.preset.familia,
      subfamilia: library.preset.subfamilia,
      tipoTecnico: library.preset.tipoTecnico,
      templateId: library.preset.templateId,
      unidadStock: 'UNIDAD',
      unidadCompra: 'UNIDAD',
      activo: true,
      atributosTecnicosJson: {
        material: 'XPS',
        anchoMm: 1200,
        altoMm: 600,
        anchoUtilMm: 1180,
        altoUtilMm: 580,
        margenNoUtilizableMm: 10,
      },
    },
    update: {
      materialPresetId: library.preset.id,
      canonicalMaterialKey: PRESET_KEY,
      canonicalMaterialName: library.preset.nombreCanonico,
      familia: library.preset.familia,
      subfamilia: library.preset.subfamilia,
      tipoTecnico: library.preset.tipoTecnico,
      templateId: library.preset.templateId,
      descripcion:
        'Placas de 1200 × 600 mm para carteles y letras corpóreas. Área útil inicial: 1180 × 580 mm.',
      atributosTecnicosJson: {
        material: 'XPS',
        anchoMm: 1200,
        altoMm: 600,
        anchoUtilMm: 1180,
        altoUtilMm: 580,
        margenNoUtilizableMm: 10,
      },
      activo: true,
    },
  });

  const installedVariants = [];
  for (const source of library.variantes) {
    const variante = await prisma.materiaPrimaVariante.upsert({
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
        nombreVariante: source.nombreVarianteSugerido,
        atributosVarianteJson: source.atributosVarianteJson,
        unidadStock: source.unidadStock,
        unidadCompra: source.unidadCompra,
        activo: true,
      },
    });
    installedVariants.push(variante);
  }

  return { material, variants: installedVariants };
}

async function upsertProductStepConfig(prisma, data) {
  const existing = await prisma.productoConfigPaso.findFirst({
    where: {
      tenantId: data.tenantId,
      productoRutaAlternativaId: data.productoRutaAlternativaId,
      rutaPasoId: data.rutaPasoId,
    },
  });
  if (existing) {
    return prisma.productoConfigPaso.update({
      where: { id: existing.id },
      data,
    });
  }
  return prisma.productoConfigPaso.create({ data });
}

async function installPolyfanProduct(prisma, tenantId, installedMaterial) {
  const subcategory = await prisma.productoSubcategoriaComercial.findUnique({
    where: { codigo: 'rigidos_impresos' },
  });
  if (!subcategory) {
    throw new Error('Falta la subcategoría comercial rigidos_impresos.');
  }

  const prepressCostCenter = await prisma.centroCosto.findFirst({
    where: { tenantId, codigo: 'PRE-001' },
  });
  if (!prepressCostCenter) {
    throw new Error('Falta el centro de costo de preprensa PRE-001.');
  }
  const hotWireCostCenter = await prisma.centroCosto.findFirst({
    where: { tenantId, codigo: 'IMP-003' },
  });
  if (!hotWireCostCenter) {
    throw new Error(
      'Falta el centro de costo productivo IMP-003 para corte con hilo caliente.',
    );
  }
  const plant = await prisma.planta.findFirst({
    where: { tenantId, activa: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!plant) {
    throw new Error('Falta una planta activa para instalar la cortadora.');
  }
  let hotWireMachine = await prisma.maquina.upsert({
    where: { tenantId_codigo: { tenantId, codigo: 'HOTWIRE-001' } },
    create: {
      tenantId,
      codigo: 'HOTWIRE-001',
      nombre: 'Cortadora de hilo caliente',
      plantilla: 'CORTE_HILO_CALIENTE',
      plantillaVersion: 1,
      plantaId: plant.id,
      centroCostoPrincipalId: hotWireCostCenter.id,
      estado: 'ACTIVA',
      estadoConfiguracion: 'LISTA',
      geometriaTrabajo: 'PLANO',
      unidadProduccionPrincipal: 'MM_MIN',
      anchoUtil: '1250',
      largoUtil: '600',
      activo: true,
      parametrosTecnicosJson: {
        postprocesadorRecorrido: 'HOTWIRE_TAP_V1',
        origenMaquina: 'bottom-left',
        estrategiaOrigen: 'geometry-bounds',
        estrategiaNestingVectorial: 'preserve-original-if-fits',
        tipoUnionVectorial: 'cola_milano',
        anchoEncastreMm: 30,
        profundidadEncastreMm: 30,
        modoCantidadEncastres: 'por_distancia',
        distanciaMaximaEncastresMm: 100,
        cantidadFijaEncastres: 1,
        cantidadMinimaEncastres: 1,
        cantidadMaximaEncastres: 100,
        kerfEncastreMm: 0.3,
        entradaMm: 8,
        decimalesTap: 6,
      },
    },
    update: {
      plantilla: 'CORTE_HILO_CALIENTE',
      centroCostoPrincipalId: hotWireCostCenter.id,
      estadoConfiguracion: 'LISTA',
      geometriaTrabajo: 'PLANO',
      unidadProduccionPrincipal: 'MM_MIN',
      activo: true,
    },
  });
  const hotWireParams =
    hotWireMachine.parametrosTecnicosJson &&
    typeof hotWireMachine.parametrosTecnicosJson === 'object' &&
    !Array.isArray(hotWireMachine.parametrosTecnicosJson)
      ? hotWireMachine.parametrosTecnicosJson
      : {};
  // Sólo completa políticas ausentes en máquinas existentes. Una preferencia
  // que el tenant cambió explícitamente nunca debe ser pisada por el instalador.
  const hotWireDefaults = {
    estrategiaNestingVectorial: 'preserve-original-if-fits',
    tipoUnionVectorial: 'cola_milano',
    anchoEncastreMm: 30,
    profundidadEncastreMm: 30,
    modoCantidadEncastres: 'por_distancia',
    distanciaMaximaEncastresMm: 100,
    cantidadFijaEncastres: 1,
    cantidadMinimaEncastres: 1,
    cantidadMaximaEncastres: 100,
    kerfEncastreMm: 0.3,
  };
  const missingHotWireDefaults = Object.fromEntries(
    Object.entries(hotWireDefaults).filter(
      ([key]) => !(key in hotWireParams),
    ),
  );
  if (Object.keys(missingHotWireDefaults).length > 0) {
    hotWireMachine = await prisma.maquina.update({
      where: { id: hotWireMachine.id },
      data: {
        parametrosTecnicosJson: {
          ...hotWireParams,
          ...missingHotWireDefaults,
        },
      },
    });
  }
  const hotWireProfile = await prisma.maquinaPerfilOperativo.upsert({
    where: {
      tenantId_maquinaId_nombre: {
        tenantId,
        maquinaId: hotWireMachine.id,
        nombre: 'Polyfan estándar',
      },
    },
    create: {
      tenantId,
      maquinaId: hotWireMachine.id,
      nombre: 'Polyfan estándar',
      tipoPerfil: 'CORTE',
      productivityValue: '350',
      productivityUnit: 'MM_MIN',
      setupMin: '5',
      detalleJson: { material: 'Polyfan' },
      activo: true,
    },
    update: {
      tipoPerfil: 'CORTE',
      productivityUnit: 'MM_MIN',
      activo: true,
    },
  });

  const route = await prisma.ruta.upsert({
    where: { tenantId_codigo: { tenantId, codigo: ROUTE_CODE } },
    create: {
      tenantId,
      codigo: ROUTE_CODE,
      nombre: 'Cartel corpóreo en Polyfan — corte vectorial',
      descripcion:
        'Preparación del SVG y corte de piezas de Polyfan con nesting irregular sobre placas.',
      versionActual: 1,
      activo: true,
    },
    update: {
      nombre: 'Cartel corpóreo en Polyfan — corte vectorial',
      descripcion:
        'Preparación del SVG y corte de piezas de Polyfan con nesting irregular sobre placas.',
      activo: true,
    },
  });

  const stepDefinitions = [
    [1, 'diseno_grafico', 'Diseño vectorial'],
    [2, 'pre_prensa', 'Revisión y preparación del vector'],
    [3, 'corte_hilo_caliente', 'Corte con hilo caliente'],
    [4, 'trabajo_manual', 'Unión, enduido y lijado'],
  ];
  const routeSteps = [];
  for (const [orden, familiaCodigo, nombreVisible] of stepDefinitions) {
    const step = await prisma.rutaPaso.upsert({
      where: {
        tenantId_rutaId_version_orden: {
          tenantId,
          rutaId: route.id,
          version: 1,
          orden,
        },
      },
      create: {
        tenantId,
        rutaId: route.id,
        version: 1,
        orden,
        familiaCodigo,
        nombreVisible,
        activo: true,
      },
      update: { familiaCodigo, nombreVisible, activo: true },
    });
    routeSteps.push(step);
  }

  await prisma.rutaVersion.upsert({
    where: {
      tenantId_rutaId_version: { tenantId, rutaId: route.id, version: 1 },
    },
    create: {
      tenantId,
      rutaId: route.id,
      version: 1,
      snapshotJson: {
        pasos: routeSteps.map(({ orden, familiaCodigo, nombreVisible }) => ({
          orden,
          familia: familiaCodigo,
          nombreVisible,
        })),
      },
      cambios: 'Versión inicial para cotización vectorial de Polyfan',
    },
    update: {
      snapshotJson: {
        pasos: routeSteps.map(({ orden, familiaCodigo, nombreVisible }) => ({
          orden,
          familia: familiaCodigo,
          nombreVisible,
        })),
      },
    },
  });

  const product = await prisma.producto.upsert({
    where: { tenantId_codigo: { tenantId, codigo: PRODUCT_CODE } },
    create: {
      tenantId,
      codigo: PRODUCT_CODE,
      nombre: 'Cartel corpóreo en Polyfan',
      descripcion:
        'Cartel o letras corpóreas cortadas desde un archivo SVG sobre placas de Polyfan.',
      subcategoriaComercialId: subcategory.id,
      unidadComercial: 'unidad',
      modoMedidas: 'LIBRE',
      atributosComercialesJson: {
        material: 'Polyfan (XPS)',
        formatoPlaca: '1200 × 600 mm',
        areaUtilInicial: '1180 × 580 mm',
        espesores: [20, 30, 40, 50],
        colores: ['Blanco', 'Negro'],
      },
      precioConfigJson: {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 45, minimumMarginPct: 30 },
      },
      activo: true,
    },
    update: {
      nombre: 'Cartel corpóreo en Polyfan',
      descripcion:
        'Cartel o letras corpóreas cortadas desde un archivo SVG sobre placas de Polyfan.',
      subcategoriaComercialId: subcategory.id,
      unidadComercial: 'unidad',
      modoMedidas: 'LIBRE',
      atributosComercialesJson: {
        material: 'Polyfan (XPS)',
        formatoPlaca: '1200 × 600 mm',
        areaUtilInicial: '1180 × 580 mm',
        espesores: [20, 30, 40, 50],
        colores: ['Blanco', 'Negro'],
      },
      activo: true,
    },
  });

  let alternative = await prisma.productoRutaAlternativa.findFirst({
    where: { tenantId, productoId: product.id, rutaId: route.id },
  });
  if (alternative) {
    alternative = await prisma.productoRutaAlternativa.update({
      where: { id: alternative.id },
      data: {
        rutaVersion: 1,
        nombre: 'Corte con hilo caliente',
        esPreferida: true,
        orden: 0,
        activo: true,
      },
    });
  } else {
    alternative = await prisma.productoRutaAlternativa.create({
      data: {
        tenantId,
        productoId: product.id,
        rutaId: route.id,
        rutaVersion: 1,
        nombre: 'Corte con hilo caliente',
        esPreferida: true,
        orden: 0,
        activo: true,
      },
    });
  }

  for (const step of routeSteps) {
    if (step.familiaCodigo === 'diseno_grafico') {
      await upsertProductStepConfig(prisma, {
        tenantId,
        productoRutaAlternativaId: alternative.id,
        rutaPasoId: step.id,
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-1',
        mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
        centroCostoId: prepressCostCenter.id,
        paramsPasoJson: { tarifaFija: 0 },
        nombreVisible: step.nombreVisible,
        activo: true,
      });
      continue;
    }
    if (step.familiaCodigo === 'pre_prensa') {
      await upsertProductStepConfig(prisma, {
        tenantId,
        productoRutaAlternativaId: alternative.id,
        rutaPasoId: step.id,
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-1',
        mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
        centroCostoId: prepressCostCenter.id,
        tiempoFijoOverrideMin: '15',
        nombreVisible: step.nombreVisible,
        activo: true,
      });
      continue;
    }

    if (step.familiaCodigo === 'trabajo_manual') {
      await upsertProductStepConfig(prisma, {
        tenantId,
        productoRutaAlternativaId: alternative.id,
        rutaPasoId: step.id,
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-2',
        mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
        centroCostoId: prepressCostCenter.id,
        paramsPasoJson: {
          tipoTrabajo:
            'Pegado de cantos, enduido frontal, secado operativo y lijado de cada unión encastrada.',
          productivityValue: 4,
          productivityUnit: 'unidades_h',
          productivityQuantitySource: 'uniones_vectoriales',
        },
        nombreVisible: step.nombreVisible,
        activo: true,
      });
      continue;
    }

    const cuttingConfig = await upsertProductStepConfig(prisma, {
      tenantId,
      productoRutaAlternativaId: alternative.id,
      rutaPasoId: step.id,
      modoActivacion: 'OBLIGATORIO',
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      centroCostoId: hotWireCostCenter.id,
      maquinaM1Id: hotWireMachine.id,
      perfilM1Id: hotWireProfile.id,
      paramsPasoJson: {
        productivityQuantitySource: 'perimetro_piezas_m',
        nestingConfig: {
          algorithm: 'irregular-2d-bottom-left-v1',
          allowRotation: true,
          separationHMm: 5,
          separationVMm: 5,
        },
      },
      nombreVisible: step.nombreVisible,
      activo: true,
    });

    const slot = await prisma.productoConfigPasoSlotMaterial.upsert({
      where: {
        tenantId_productoConfigPasoId_slotCodigo: {
          tenantId,
          productoConfigPasoId: cuttingConfig.id,
          slotCodigo: 'sustrato_corte',
        },
      },
      create: {
        tenantId,
        productoConfigPasoId: cuttingConfig.id,
        slotCodigo: 'sustrato_corte',
        slotNombre: 'Placa de Polyfan',
        slotRol: 'SUSTRATO',
        modoSeleccion: 'COMERCIAL_ELIGE',
        formula: 'por_unidad_productiva',
        activo: true,
      },
      update: {
        slotNombre: 'Placa de Polyfan',
        slotRol: 'SUSTRATO',
        modoSeleccion: 'COMERCIAL_ELIGE',
        formula: 'por_unidad_productiva',
        activo: true,
      },
    });

    const preferred =
      installedMaterial.variants.find((variant) =>
        variant.sku.endsWith('20-B'),
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

  return { product, route, alternative };
}

async function provisionPolyfanProduct(prisma, tenantId) {
  const library = await syncPolyfanLibrary(prisma);
  const material = await installPolyfanMaterial(prisma, tenantId, library);
  const product = await installPolyfanProduct(prisma, tenantId, material);
  return { library, material, ...product };
}

module.exports = {
  MATERIAL_CODE,
  PRESET_KEY,
  PRODUCT_CODE,
  ROUTE_CODE,
  provisionPolyfanProduct,
  syncPolyfanLibrary,
};
