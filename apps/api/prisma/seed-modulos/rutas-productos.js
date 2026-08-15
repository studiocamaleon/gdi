/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Seed de Rutas + Productos del modelo universal.
 *
 * Crea las 5 rutas (incluye 2 alternativas para Talonario) + 4 productos
 * validados en Fase E:
 * - Tarjetas de Visita Premium 300gr
 * - Vinilo blanco impreso
 * - Talonario duplicado A4 (con 2 rutas alternativas: emblocado y abrochado)
 * - Rígido impreso custom (señalética/letras)
 */

async function fetchVarianteId(prisma, tenantId, sku) {
  const v = await prisma.materiaPrimaVariante.findFirstOrThrow({
    where: { tenantId, sku },
  });
  return v.id;
}

async function fetchVariante(prisma, tenantId, sku) {
  return prisma.materiaPrimaVariante.findFirstOrThrow({
    where: { tenantId, sku },
    select: { id: true, materiaPrimaId: true },
  });
}

async function seedRutasYProductos(
  prisma,
  tenantId,
  maquinas,
  materiales,
  catalogoComercial,
) {
  const subcategoriaId = (codigo) => {
    const subcategoria = catalogoComercial?.subcategoriasPorCodigo?.get(codigo);
    if (!subcategoria) {
      throw new Error(`Subcategoría comercial no encontrada: ${codigo}`);
    }
    return subcategoria.id;
  };

  const centroTrabajoManual = await prisma.centroCosto.findFirstOrThrow({
    where: { tenantId, codigo: 'PRE-001' },
  });

  // ============================================================================
  // Variantes que vamos a usar (lookup por SKU)
  // ============================================================================
  const opalinaVarId = await fetchVarianteId(
    prisma,
    tenantId,
    'OPALINA-300-65X45',
  );
  const papelCBVarId = await fetchVarianteId(
    prisma,
    tenantId,
    'AUTOCOP-CB-22X34',
  );
  const papelCFBVarId = await fetchVarianteId(
    prisma,
    tenantId,
    'AUTOCOP-CFB-22X34',
  );
  const viniloBlanco137 = await fetchVariante(
    prisma,
    tenantId,
    'VINILO-BLANCO-1370',
  );
  const viniloBlanco152 = await fetchVariante(
    prisma,
    tenantId,
    'VINILO-BLANCO-1520',
  );
  const viniloBlanco137VarId = viniloBlanco137.id;
  const viniloBlanco152VarId = viniloBlanco152.id;
  const mdf9 = await fetchVariante(prisma, tenantId, 'MDF-9MM-183X275');
  const mdf9VarId = mdf9.id;
  const filmMate = await fetchVariante(
    prisma,
    tenantId,
    'BOPP-MATE-650',
  );
  const filmBrillo = await fetchVariante(
    prisma,
    tenantId,
    'BOPP-BRILLO-650',
  );
  const filmMateVarId = filmMate.id;
  const filmBrilloVarId = filmBrillo.id;
  const bolsaVarId = await fetchVarianteId(prisma, tenantId, 'BOLSA-100');

  // Perfiles M-1 que vamos a usar
  const ricohSimpleFazPerfil =
    await prisma.maquinaPerfilOperativo.findFirstOrThrow({
      where: {
        tenantId,
        maquinaId: maquinas.ricoh.id,
        nombre: 'Papel grueso simple faz',
      },
    });
  const ricohDobleFazPerfil =
    await prisma.maquinaPerfilOperativo.findFirstOrThrow({
      where: {
        tenantId,
        maquinaId: maquinas.ricoh.id,
        nombre: 'Papel grueso doble faz',
      },
    });
  // Polar: usa perfil de "Papel grueso 100-250gr" (rango común para tarjetas).
  const polarPerfil = await prisma.maquinaPerfilOperativo.findFirstOrThrow({
    where: {
      tenantId,
      maquinaId: maquinas.polar.id,
      nombre: 'Papel grueso 100-250gr',
    },
  });
  const laminadoraPerfil = await prisma.maquinaPerfilOperativo.findFirstOrThrow(
    {
      where: { tenantId, maquinaId: maquinas.laminadora.id },
    },
  );
  const rolandPerfil = await prisma.maquinaPerfilOperativo.findFirstOrThrow({
    where: {
      tenantId,
      maquinaId: maquinas.roland.id,
      nombre: 'Latex CMYK normal 6 pasadas',
    },
  });
  const skycutPerfil = await prisma.maquinaPerfilOperativo.findFirstOrThrow({
    where: {
      tenantId,
      maquinaId: maquinas.skycut.id,
      nombre: 'Corte completo - rollo',
    },
  });
  const mimakiCMYKPerfil = await prisma.maquinaPerfilOperativo.findFirstOrThrow(
    {
      where: {
        tenantId,
        maquinaId: maquinas.mimaki.id,
        nombre: 'UV CMYK rígido normal',
      },
    },
  );
  const cncPerfil = await prisma.maquinaPerfilOperativo.findFirstOrThrow({
    where: { tenantId, maquinaId: maquinas.cnc.id, nombre: 'Estándar' },
  });

  // ============================================================================
  // RUTA 1: "Tarjeta digital standard" (7 pasos)
  // ============================================================================
  const rutaTarjetas = await prisma.ruta.create({
    data: {
      tenantId,
      codigo: 'RUTA-TARJETA-DIGITAL-STD',
      nombre: 'Tarjeta digital standard',
      descripcion: 'Ruta para tarjetas de visita digitales en papel cortado',
      versionActual: 1,
      activo: true,
      pasos: {
        create: [
          { tenantId, orden: 1, familiaCodigo: 'diseno_grafico', activo: true },
          { tenantId, orden: 2, familiaCodigo: 'pre_prensa', activo: true },
          {
            tenantId,
            orden: 3,
            familiaCodigo: 'impresion_por_hoja',
            activo: true,
          },
          { tenantId, orden: 4, familiaCodigo: 'laminado', activo: true },
          {
            tenantId,
            orden: 5,
            familiaCodigo: 'corte_guillotina',
            activo: true,
          },
          {
            tenantId,
            orden: 6,
            familiaCodigo: 'modificacion_post',
            activo: true,
          },
          { tenantId, orden: 7, familiaCodigo: 'embalaje', activo: true },
        ],
      },
    },
    include: { pasos: true },
  });
  await prisma.rutaVersion.create({
    data: {
      tenantId,
      rutaId: rutaTarjetas.id,
      version: 1,
      snapshotJson: {
        pasos: rutaTarjetas.pasos.map((p) => ({
          orden: p.orden,
          familia: p.familiaCodigo,
        })),
      },
      cambios: 'Versión inicial',
    },
  });

  // ============================================================================
  // RUTA 2: "Vinilo gran formato" (6 pasos)
  // ============================================================================
  const rutaVinilo = await prisma.ruta.create({
    data: {
      tenantId,
      codigo: 'RUTA-VINILO-GRAN-FORMATO',
      nombre: 'Vinilo gran formato',
      descripcion: 'Ruta para vinilo adhesivo impreso en gran formato',
      versionActual: 1,
      activo: true,
      pasos: {
        create: [
          { tenantId, orden: 1, familiaCodigo: 'diseno_grafico', activo: true },
          { tenantId, orden: 2, familiaCodigo: 'pre_prensa', activo: true },
          {
            tenantId,
            orden: 3,
            familiaCodigo: 'impresion_por_area',
            activo: true,
          },
          { tenantId, orden: 4, familiaCodigo: 'laminado', activo: true },
          { tenantId, orden: 5, familiaCodigo: 'plotter_corte', activo: true },
          {
            tenantId,
            orden: 6,
            familiaCodigo: 'instalacion_in_situ',
            activo: true,
          },
        ],
      },
    },
    include: { pasos: true },
  });
  await prisma.rutaVersion.create({
    data: {
      tenantId,
      rutaId: rutaVinilo.id,
      version: 1,
      snapshotJson: {
        pasos: rutaVinilo.pasos.map((p) => ({
          orden: p.orden,
          familia: p.familiaCodigo,
        })),
      },
      cambios: 'Versión inicial',
    },
  });

  // ============================================================================
  // RUTA 3: "Talonario emblocado" (9 pasos)
  // ============================================================================
  const rutaTalonarioEmb = await prisma.ruta.create({
    data: {
      tenantId,
      codigo: 'RUTA-TALONARIO-EMBLOCADO',
      nombre: 'Talonario emblocado',
      descripcion: 'Talonario con encuadernación por engomado/emblocado',
      versionActual: 1,
      activo: true,
      pasos: {
        create: [
          { tenantId, orden: 1, familiaCodigo: 'diseno_grafico', activo: true },
          { tenantId, orden: 2, familiaCodigo: 'pre_prensa', activo: true },
          {
            tenantId,
            orden: 3,
            familiaCodigo: 'impresion_por_hoja',
            activo: true,
          },
          {
            tenantId,
            orden: 4,
            familiaCodigo: 'impresion_por_hoja',
            activo: true,
          },
          {
            tenantId,
            orden: 5,
            familiaCodigo: 'impresion_por_hoja',
            activo: true,
          },
          {
            tenantId,
            orden: 6,
            familiaCodigo: 'modificacion_post',
            activo: true,
          },
          { tenantId, orden: 7, familiaCodigo: 'conteo_manual', activo: true },
          {
            tenantId,
            orden: 8,
            familiaCodigo: 'engomado_emblocado',
            activo: true,
          },
          {
            tenantId,
            orden: 9,
            familiaCodigo: 'corte_guillotina',
            activo: true,
          },
          { tenantId, orden: 10, familiaCodigo: 'embalaje', activo: true },
        ],
      },
    },
    include: { pasos: true },
  });
  await prisma.rutaVersion.create({
    data: {
      tenantId,
      rutaId: rutaTalonarioEmb.id,
      version: 1,
      snapshotJson: {
        pasos: rutaTalonarioEmb.pasos.map((p) => ({
          orden: p.orden,
          familia: p.familiaCodigo,
        })),
      },
      cambios: 'Versión inicial',
    },
  });

  // ============================================================================
  // RUTA 4: "Talonario abrochado" (alternativa)
  // ============================================================================
  const rutaTalonarioAbr = await prisma.ruta.create({
    data: {
      tenantId,
      codigo: 'RUTA-TALONARIO-ABROCHADO',
      nombre: 'Talonario abrochado',
      descripcion: 'Talonario con encuadernación por engrapado lateral',
      versionActual: 1,
      activo: true,
      pasos: {
        create: [
          { tenantId, orden: 1, familiaCodigo: 'diseno_grafico', activo: true },
          { tenantId, orden: 2, familiaCodigo: 'pre_prensa', activo: true },
          {
            tenantId,
            orden: 3,
            familiaCodigo: 'impresion_por_hoja',
            activo: true,
          },
          {
            tenantId,
            orden: 4,
            familiaCodigo: 'impresion_por_hoja',
            activo: true,
          },
          {
            tenantId,
            orden: 5,
            familiaCodigo: 'impresion_por_hoja',
            activo: true,
          },
          {
            tenantId,
            orden: 6,
            familiaCodigo: 'modificacion_post',
            activo: true,
          },
          { tenantId, orden: 7, familiaCodigo: 'conteo_manual', activo: true },
          {
            tenantId,
            orden: 8,
            familiaCodigo: 'encuadernado_engrapado',
            activo: true,
          },
          {
            tenantId,
            orden: 9,
            familiaCodigo: 'corte_guillotina',
            activo: true,
          },
          { tenantId, orden: 10, familiaCodigo: 'embalaje', activo: true },
        ],
      },
    },
    include: { pasos: true },
  });
  await prisma.rutaVersion.create({
    data: {
      tenantId,
      rutaId: rutaTalonarioAbr.id,
      version: 1,
      snapshotJson: {
        pasos: rutaTalonarioAbr.pasos.map((p) => ({
          orden: p.orden,
          familia: p.familiaCodigo,
        })),
      },
      cambios: 'Versión inicial',
    },
  });

  // ============================================================================
  // RUTA 5: "Rígido impreso custom"
  // ============================================================================
  const rutaRigido = await prisma.ruta.create({
    data: {
      tenantId,
      codigo: 'RUTA-RIGIDO-CUSTOM',
      nombre: 'Rígido impreso custom',
      descripcion:
        'Rutas para rígidos impresos en MDF/PVC con corte CNC/manual/láser',
      versionActual: 1,
      activo: true,
      pasos: {
        create: [
          { tenantId, orden: 1, familiaCodigo: 'diseno_grafico', activo: true },
          { tenantId, orden: 2, familiaCodigo: 'pre_prensa', activo: true },
          {
            tenantId,
            orden: 3,
            familiaCodigo: 'impresion_por_area',
            activo: true,
          },
          { tenantId, orden: 4, familiaCodigo: 'cnc', activo: true },
          {
            tenantId,
            orden: 5,
            familiaCodigo: 'lijado_canteado',
            activo: true,
          },
          {
            tenantId,
            orden: 6,
            familiaCodigo: 'pintura_superficial',
            activo: true,
          },
          { tenantId, orden: 7, familiaCodigo: 'embalaje', activo: true },
          {
            tenantId,
            orden: 8,
            familiaCodigo: 'instalacion_in_situ',
            activo: true,
          },
        ],
      },
    },
    include: { pasos: true },
  });
  await prisma.rutaVersion.create({
    data: {
      tenantId,
      rutaId: rutaRigido.id,
      version: 1,
      snapshotJson: {
        pasos: rutaRigido.pasos.map((p) => ({
          orden: p.orden,
          familia: p.familiaCodigo,
        })),
      },
      cambios: 'Versión inicial',
    },
  });

  console.info(
    `✅ Rutas: 5 rutas creadas (Tarjetas, Vinilo, Talonario Embloc/Abroch, Rígido).`,
  );

  // ============================================================================
  // PRODUCTOS
  // ============================================================================

  // ----------------------------------------------------------------------------
  // PRODUCTO 1: Tarjetas de Visita Premium 300gr
  // ----------------------------------------------------------------------------
  const tarjetas = await prisma.producto.create({
    data: {
      tenantId,
      codigo: 'TARJ-PREMIUM-300',
      nombre: 'Tarjetas de Visita Premium 300gr',
      descripcion: 'Tarjetas de visita en papel opalina 300gr, 9x5cm',
      subcategoriaComercialId: subcategoriaId('tarjetas'),
      unidadComercial: 'unidad',
      modoMedidas: 'FIJA',
      medidaDefaultAnchoMm: '90',
      medidaDefaultAltoMm: '50',
      atributosComercialesJson: {
        material: 'Opalina 300gr',
        medidas: '90 x 50 mm',
        impresion: 'CMYK',
        caras: 'Simple faz',
      },
      precioConfigJson: {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 40, minimumMarginPct: 25 },
      },
      activo: true,
    },
  });

  const tarjetasRutaAlt = await prisma.productoRutaAlternativa.create({
    data: {
      tenantId,
      productoId: tarjetas.id,
      rutaId: rutaTarjetas.id,
      rutaVersion: 1,
      nombre: 'Standard',
      esPreferida: true,
      orden: 0,
      activo: true,
    },
  });

  // Configuración de cada paso de la ruta (7 pasos)
  for (const paso of rutaTarjetas.pasos) {
    let config = {
      tenantId,
      productoRutaAlternativaId: tarjetasRutaAlt.id,
      rutaPasoId: paso.id,
      activo: true,
    };
    if (paso.familiaCodigo === 'diseno_grafico') {
      Object.assign(config, {
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-1',
        centroCostoId: centroTrabajoManual.id,
        paramsPasoJson: { tarifaFija: 5000 },
      });
    } else if (paso.familiaCodigo === 'pre_prensa') {
      Object.assign(config, {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-1',
        centroCostoId: centroTrabajoManual.id,
        tiempoFijoOverrideMin: '10',
      });
    } else if (paso.familiaCodigo === 'impresion_por_hoja') {
      Object.assign(config, {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-3',
        mecanismoCantidad: 'HEREDAR_DEL_OUTPUT_CANONICO',
        multiplicadoresActivos: ['caras'],
        maquinaM1Id: maquinas.ricoh.id,
        perfilM1Id: ricohSimpleFazPerfil.id,
      });
    } else if (paso.familiaCodigo === 'laminado') {
      Object.assign(config, {
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-3',
        mecanismoCantidad: 'HEREDAR_DEL_OUTPUT_CANONICO',
        multiplicadoresActivos: ['caras'],
        maquinaM1Id: maquinas.laminadora.id,
        perfilM1Id: laminadoraPerfil.id,
      });
    } else if (paso.familiaCodigo === 'corte_guillotina') {
      Object.assign(config, {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-3',
        mecanismoCantidad: 'HEREDAR_DEL_OUTPUT_CANONICO',
        maquinaM1Id: maquinas.polar.id,
        perfilM1Id: polarPerfil.id,
      });
    } else if (paso.familiaCodigo === 'modificacion_post') {
      Object.assign(config, {
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-2',
        mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
        multiplicadoresActivos: ['cantidadModificacionesPorPieza'],
        centroCostoId: centroTrabajoManual.id,
        paramsPasoJson: { subTipo: 'redondeo_puntas' },
      });
    } else if (paso.familiaCodigo === 'embalaje') {
      Object.assign(config, {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-2',
        mecanismoCantidad: 'CONVERSION',
        mecanismoCantidadConfigJson: { piezasPorCaja: 100 },
        centroCostoId: centroTrabajoManual.id,
        paramsPasoJson: { piezasPorCaja: 100 },
      });
    }
    const configPaso = await prisma.productoConfigPaso.create({ data: config });

    // Slots de materiales para impresión y laminado
    if (paso.familiaCodigo === 'impresion_por_hoja') {
      await prisma.productoConfigPasoSlotMaterial.create({
        data: {
          tenantId,
          productoConfigPasoId: configPaso.id,
          slotCodigo: 'sustrato_principal',
          modoSeleccion: 'HARDCODED',
          materialVarianteId: opalinaVarId,
          formula: 'por_unidad_productiva',
          activo: true,
        },
      });
    } else if (paso.familiaCodigo === 'laminado') {
      await prisma.productoConfigPasoSlotMaterial.create({
        data: {
          tenantId,
          productoConfigPasoId: configPaso.id,
          slotCodigo: 'film',
          modoSeleccion: 'COMERCIAL_ELIGE',
          formula: 'por_metro_lineal',
          aplicaMultiCaras: true,
          candidatos: {
            create: [
              {
                tenantId,
                materiaPrimaId: filmMate.materiaPrimaId,
                defaultVarianteId: filmMateVarId,
                orden: 0,
                variantes: {
                  create: [{ tenantId, varianteId: filmMateVarId, orden: 0 }],
                },
              },
              {
                tenantId,
                materiaPrimaId: filmBrillo.materiaPrimaId,
                orden: 1,
                variantes: {
                  create: [{ tenantId, varianteId: filmBrilloVarId, orden: 0 }],
                },
              },
            ],
          },
          activo: true,
        },
      });
    } else if (paso.familiaCodigo === 'embalaje') {
      await prisma.productoConfigPasoSlotMaterial.create({
        data: {
          tenantId,
          productoConfigPasoId: configPaso.id,
          slotCodigo: 'caja',
          modoSeleccion: 'HARDCODED',
          materialVarianteId: bolsaVarId,
          formula: 'por_unidad_productiva',
          activo: true,
        },
      });
    }
  }

  // ----------------------------------------------------------------------------
  // PRODUCTO 2: Vinilo blanco impreso
  // ----------------------------------------------------------------------------
  const vinilo = await prisma.producto.create({
    data: {
      tenantId,
      codigo: 'VINILO-BLANCO-IMP',
      nombre: 'Vinilo blanco impreso',
      descripcion:
        'Vinilo adhesivo blanco impreso, gran formato, medidas libres',
      subcategoriaComercialId: subcategoriaId('vinilos_impresos'),
      unidadComercial: 'm2',
      modoMedidas: 'LIBRE',
      atributosComercialesJson: {
        material: 'Vinilo blanco brillante',
        medidas: 'Medidas libres',
        tecnologia: 'Látex',
      },
      precioConfigJson: {
        metodoCalculo: 'margen_variable',
        detalle: {
          tiers: [
            { quantityUntil: 5, marginPct: 50 },
            { quantityUntil: 20, marginPct: 40 },
            { quantityUntil: 999, marginPct: 30 },
          ],
        },
      },
      activo: true,
    },
  });

  const viniloRutaAlt = await prisma.productoRutaAlternativa.create({
    data: {
      tenantId,
      productoId: vinilo.id,
      rutaId: rutaVinilo.id,
      rutaVersion: 1,
      nombre: 'Standard',
      esPreferida: true,
      orden: 0,
      activo: true,
    },
  });

  for (const paso of rutaVinilo.pasos) {
    let config = {
      tenantId,
      productoRutaAlternativaId: viniloRutaAlt.id,
      rutaPasoId: paso.id,
      activo: true,
    };
    if (paso.familiaCodigo === 'diseno_grafico') {
      Object.assign(config, {
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-1',
        centroCostoId: centroTrabajoManual.id,
        paramsPasoJson: { tarifaFija: 8000 },
      });
    } else if (paso.familiaCodigo === 'pre_prensa') {
      Object.assign(config, {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-1',
        centroCostoId: centroTrabajoManual.id,
        tiempoFijoOverrideMin: '15',
      });
    } else if (paso.familiaCodigo === 'impresion_por_area') {
      Object.assign(config, {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-3',
        mecanismoCantidad: 'CALCULADO_POR_PASO',
        maquinaM1Id: maquinas.roland.id,
        perfilM1Id: rolandPerfil.id,
        paramsPasoJson: {
          nestingConfig: {
            algorithm: 'auto',
            allowRotation: true,
            separationHMm: 5,
            separationVMm: 5,
            panelizado: {
              enabled: false,
              mode: 'automatic',
              axis: 'vertical',
              overlapMm: 20,
              maxPanelWidthMm: 0,
              distribution: 'equilibrada',
              widthInterpretation: 'total',
            },
            costing: { strategy: 'simple' },
          },
        },
      });
    } else if (paso.familiaCodigo === 'laminado') {
      Object.assign(config, {
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-3',
        maquinaM1Id: maquinas.laminadora.id,
        perfilM1Id: laminadoraPerfil.id,
      });
    } else if (paso.familiaCodigo === 'plotter_corte') {
      Object.assign(config, {
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-3',
        mecanismoCantidad: 'CALCULADO_POR_PASO',
        maquinaM1Id: maquinas.skycut.id,
        perfilM1Id: skycutPerfil.id,
        paramsPasoJson: {
          tipoCorte: 'MEDIO',
          nestingConfig: {
            algorithm: 'shelf-rollo',
            allowRotation: true,
            separationHMm: 5,
            separationVMm: 5,
            costing: { strategy: 'simple' },
          },
        },
      });
    } else if (paso.familiaCodigo === 'instalacion_in_situ') {
      Object.assign(config, {
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-2',
        mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
        centroCostoId: centroTrabajoManual.id,
      });
    }
    const configPaso = await prisma.productoConfigPaso.create({ data: config });

    if (paso.familiaCodigo === 'impresion_por_area') {
      await prisma.productoConfigPasoSlotMaterial.create({
        data: {
          tenantId,
          productoConfigPasoId: configPaso.id,
          slotCodigo: 'sustrato_principal',
          modoSeleccion: 'MOTOR_ELIGE_AUTO',
          criterioMotorAuto: 'MAYOR_APROVECHAMIENTO',
          formula: 'por_metro_lineal',
          activo: true,
          candidatos: {
            create: [
              {
                tenantId,
                materiaPrimaId: viniloBlanco137.materiaPrimaId,
                defaultVarianteId: viniloBlanco137VarId,
                orden: 0,
                variantes: {
                  create: [
                    { tenantId, varianteId: viniloBlanco137VarId, orden: 0 },
                    { tenantId, varianteId: viniloBlanco152VarId, orden: 1 },
                  ],
                },
              },
            ],
          },
        },
      });
    }
  }

  // Cargo directo cotización: viático para instalación
  const cargoViatico = await prisma.cargoDirectoCatalogo.findFirstOrThrow({
    where: { tenantId, codigo: 'viatico' },
  });
  await prisma.productoCargoDirectoCotizacion.create({
    data: {
      tenantId,
      productoId: vinilo.id,
      cargoDirectoCatalogoId: cargoViatico.id,
      modoActivacion: 'OPCIONAL',
      activo: true,
    },
  });

  // ----------------------------------------------------------------------------
  // PRODUCTO 3: Talonario duplicado A4 (con 2 rutas alternativas)
  // ----------------------------------------------------------------------------
  const talonario = await prisma.producto.create({
    data: {
      tenantId,
      codigo: 'TALON-DUPL-A4',
      nombre: 'Talonario duplicado A4',
      descripcion: 'Talonario A4 duplicado en papel autocopiativo (CB+CFB)',
      subcategoriaComercialId: subcategoriaId('talonarios'),
      unidadComercial: 'unidad',
      modoMedidas: 'FIJA',
      medidaDefaultAnchoMm: '210',
      medidaDefaultAltoMm: '297',
      atributosComercialesJson: {
        formato_medidas: 'A4',
        tipo_copia: 'Duplicado',
        hojas_por_talonario: '50 hojas',
        encuadernacion_base: 'Emblocado',
      },
      precioConfigJson: {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 40, minimumMarginPct: 25 },
      },
      activo: true,
    },
  });

  // Ruta alternativa 1: Emblocado (preferida)
  const talonRutaEmb = await prisma.productoRutaAlternativa.create({
    data: {
      tenantId,
      productoId: talonario.id,
      rutaId: rutaTalonarioEmb.id,
      rutaVersion: 1,
      nombre: 'Emblocado',
      esPreferida: true,
      orden: 0,
      activo: true,
    },
  });

  // Ruta alternativa 2: Abrochado
  await prisma.productoRutaAlternativa.create({
    data: {
      tenantId,
      productoId: talonario.id,
      rutaId: rutaTalonarioAbr.id,
      rutaVersion: 1,
      nombre: 'Abrochado',
      esPreferida: false,
      orden: 1,
      activo: true,
    },
  });

  // Configuración solo de la ruta preferida (Emblocado) — la abrochada queda
  // pendiente de configurar (modelador puede llenar después con UI de F.3)
  for (const paso of rutaTalonarioEmb.pasos) {
    let config = {
      tenantId,
      productoRutaAlternativaId: talonRutaEmb.id,
      rutaPasoId: paso.id,
      activo: true,
    };
    if (paso.familiaCodigo === 'diseno_grafico') {
      Object.assign(config, {
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-1',
        centroCostoId: centroTrabajoManual.id,
        paramsPasoJson: { tarifaFija: 6000 },
      });
    } else if (paso.familiaCodigo === 'pre_prensa') {
      Object.assign(config, {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-1',
        centroCostoId: centroTrabajoManual.id,
        tiempoFijoOverrideMin: '12',
        paramsPasoJson: { modoTalonarioIncompleto: 'aprovechar_pliego' },
      });
    } else if (paso.familiaCodigo === 'impresion_por_hoja') {
      // 3 pasos de impresión: capa 1 (obligatorio), capa 2 (CONDICIONAL >=2), capa 3 (CONDICIONAL ==3)
      const config1 =
        paso.orden === 3
          ? { modoActivacion: 'OBLIGATORIO' }
          : paso.orden === 4
            ? {
                modoActivacion: 'CONDICIONAL',
                condicionActivacionJson: { '>=': [{ var: 'tipoCopia' }, 2] },
              }
            : {
                modoActivacion: 'CONDICIONAL',
                condicionActivacionJson: { '>=': [{ var: 'tipoCopia' }, 3] },
              };
      Object.assign(config, {
        ...config1,
        modoTiempo: 'T-3',
        mecanismoCantidad: 'HEREDAR_DEL_OUTPUT_CANONICO',
        maquinaM1Id: maquinas.ricoh.id,
        perfilM1Id: ricohSimpleFazPerfil.id,
      });
    } else if (paso.familiaCodigo === 'modificacion_post') {
      Object.assign(config, {
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-2',
        mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
        centroCostoId: centroTrabajoManual.id,
        paramsPasoJson: {
          subTipo: 'numeracion',
          formato: 'numerico',
          digitos: 6,
          inicioEn: 1,
        },
      });
    } else if (paso.familiaCodigo === 'conteo_manual') {
      Object.assign(config, {
        modoActivacion: 'CONDICIONAL',
        condicionActivacionJson: { '>': [{ var: 'tipoCopia' }, 1] },
        modoTiempo: 'T-2',
        mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
        centroCostoId: centroTrabajoManual.id,
      });
    } else if (paso.familiaCodigo === 'engomado_emblocado') {
      Object.assign(config, {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-2',
        mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
        centroCostoId: centroTrabajoManual.id,
      });
    } else if (paso.familiaCodigo === 'corte_guillotina') {
      Object.assign(config, {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-3',
        maquinaM1Id: maquinas.polar.id,
        perfilM1Id: polarPerfil.id,
      });
    } else if (paso.familiaCodigo === 'embalaje') {
      Object.assign(config, {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-2',
        mecanismoCantidad: 'CONVERSION',
        mecanismoCantidadConfigJson: { talonariosPorCaja: 50 },
        centroCostoId: centroTrabajoManual.id,
      });
    }
    const configPaso = await prisma.productoConfigPaso.create({ data: config });

    // Materiales por capa
    if (paso.familiaCodigo === 'impresion_por_hoja') {
      const materialId =
        paso.orden === 3
          ? papelCBVarId
          : paso.orden === 4
            ? papelCFBVarId
            : papelCFBVarId;
      const slotName =
        paso.orden === 3
          ? 'sustrato_principal'
          : paso.orden === 4
            ? 'sustrato_principal'
            : 'sustrato_principal';
      await prisma.productoConfigPasoSlotMaterial.create({
        data: {
          tenantId,
          productoConfigPasoId: configPaso.id,
          slotCodigo: slotName,
          modoSeleccion: 'HARDCODED',
          materialVarianteId: materialId,
          formula: 'por_unidad_productiva',
          activo: true,
        },
      });
    }
  }

  // ----------------------------------------------------------------------------
  // PRODUCTO 4: Rígido impreso custom
  // ----------------------------------------------------------------------------
  const rigido = await prisma.producto.create({
    data: {
      tenantId,
      codigo: 'RIGIDO-CUSTOM',
      nombre: 'Rígido impreso custom (señalética/letras)',
      descripcion:
        'Producto genérico para señalética y letras corpóreas en rígidos impresos',
      subcategoriaComercialId: subcategoriaId('rigidos_impresos'),
      unidadComercial: 'unidad',
      modoMedidas: 'LIBRE',
      atributosComercialesJson: {
        material: 'Rígido a definir',
        espesor: 'Según material',
        medidas: 'Medidas libres',
        tecnologia: 'UV rígido / CNC',
        tipo_pieza: 'Cartel / letra / placa',
      },
      precioConfigJson: {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 45, minimumMarginPct: 30 },
      },
      activo: true,
    },
  });

  const rigidoRutaAlt = await prisma.productoRutaAlternativa.create({
    data: {
      tenantId,
      productoId: rigido.id,
      rutaId: rutaRigido.id,
      rutaVersion: 1,
      nombre: 'Standard',
      esPreferida: true,
      orden: 0,
      activo: true,
    },
  });

  for (const paso of rutaRigido.pasos) {
    let config = {
      tenantId,
      productoRutaAlternativaId: rigidoRutaAlt.id,
      rutaPasoId: paso.id,
      activo: true,
    };
    if (paso.familiaCodigo === 'diseno_grafico') {
      Object.assign(config, {
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-1',
        centroCostoId: centroTrabajoManual.id,
        paramsPasoJson: { tarifaFija: 10000 },
      });
    } else if (paso.familiaCodigo === 'pre_prensa') {
      Object.assign(config, {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-1',
        centroCostoId: centroTrabajoManual.id,
        tiempoFijoOverrideMin: '20',
      });
    } else if (paso.familiaCodigo === 'impresion_por_area') {
      Object.assign(config, {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-3',
        mecanismoCantidad: 'CALCULADO_POR_PASO',
        maquinaM1Id: maquinas.mimaki.id,
        perfilM1Id: mimakiCMYKPerfil.id,
        paramsPasoJson: {
          nestingConfig: {
            algorithm: 'packingsolver-rectangle',
            allowRotation: true,
            separationHMm: 5,
            separationVMm: 5,
            costing: {
              strategy: 'plate-segments',
              segmentSteps: [25, 50, 75, 100],
            },
          },
        },
      });
    } else if (paso.familiaCodigo === 'cnc') {
      Object.assign(config, {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-3',
        mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
        maquinaM1Id: maquinas.cnc.id,
        perfilM1Id: cncPerfil.id,
      });
    } else if (paso.familiaCodigo === 'lijado_canteado') {
      Object.assign(config, {
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-2',
        mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
        centroCostoId: centroTrabajoManual.id,
      });
    } else if (paso.familiaCodigo === 'pintura_superficial') {
      Object.assign(config, {
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-2',
        mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
        centroCostoId: centroTrabajoManual.id,
        paramsPasoJson: { variante: 'mate' },
      });
    } else if (paso.familiaCodigo === 'embalaje') {
      Object.assign(config, {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-2',
        mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
        centroCostoId: centroTrabajoManual.id,
      });
    } else if (paso.familiaCodigo === 'instalacion_in_situ') {
      Object.assign(config, {
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-2',
        mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
        centroCostoId: centroTrabajoManual.id,
      });
    }
    const configPaso = await prisma.productoConfigPaso.create({ data: config });

    if (paso.familiaCodigo === 'impresion_por_area') {
      await prisma.productoConfigPasoSlotMaterial.create({
        data: {
          tenantId,
          productoConfigPasoId: configPaso.id,
          slotCodigo: 'sustrato_principal',
          modoSeleccion: 'COMERCIAL_ELIGE',
          formula: 'por_unidad_productiva',
          activo: true,
          candidatos: {
            create: [
              {
                tenantId,
                materiaPrimaId: mdf9.materiaPrimaId,
                defaultVarianteId: mdf9VarId,
                orden: 0,
                variantes: {
                  create: [{ tenantId, varianteId: mdf9VarId, orden: 0 }],
                },
              },
            ],
          },
        },
      });
    }
  }

  console.info(
    `✅ Productos: 4 productos creados con sus rutas y configuraciones.`,
  );

  return { tarjetas, vinilo, talonario, rigido };
}

module.exports = { seedRutasYProductos };
