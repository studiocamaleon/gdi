/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Seed de Máquinas, Perfiles Operativos y Consumibles para Corporearte.
 *
 * Modelo v3.0 (2026-04-26) — alineado a doc §5–§13:
 * - 7 máquinas mínimas que cubren los 4 productos validados de Fase E.
 * - Plantillas finales (12): IMPRESORA_LASER, IMPRESORA_GRAN_FORMATO_POR_AREA,
 *   GUILLOTINA, PLOTTER_DE_CORTE, PLOTTER_CAD, LAMINADORA_BOPP_ROLLO,
 *   CORTE_LASER, ROUTER_CNC, ANILLADORA, SOLDADORA, CABINA_PINTURA,
 *   MESA_DE_CORTE.
 * - Perfiles operativos: solo columnas universales + discriminantes en
 *   `detalleJson` (sin columnas legacy printMode/printSides/dobleFaz).
 * - Máquinas con `parametrosTecnicosJson` que incluye `margenesNoImprimiblesMm`
 *   donde aplica (impresoras, plotters).
 *
 * Roland (antes IMPRESORA_LATEX) → IMPRESORA_GRAN_FORMATO_POR_AREA con
 * tecnologia=LATEX + geometria=ROLLO.
 * Mimaki (antes IMPRESORA_UV_FLATBED) → IMPRESORA_GRAN_FORMATO_POR_AREA con
 * tecnologia=UV + geometria=MESA_EXTENSORA.
 */

const {
  EstadoMaquina,
  EstadoConfiguracionMaquina,
  GeometriaTrabajoMaquina,
  UnidadProduccionMaquina,
  TipoPerfilOperativoMaquina,
  TipoConsumibleMaquina,
  UnidadConsumoMaquina,
} = require("@prisma/client");

const CHANNEL_LABELS = {
  cian: "Cian",
  magenta: "Magenta",
  amarillo: "Amarillo",
  negro: "Negro",
  blanco: "Blanco",
  barniz: "Barniz",
};

async function createPrinterConsumibles(prisma, tenantId, maquinaId, perfiles, config) {
  const skus = Object.values(config.skuByChannel);
  const variantes = await prisma.materiaPrimaVariante.findMany({
    where: { tenantId, sku: { in: skus } },
    select: { id: true, sku: true },
  });
  const varianteBySku = new Map(variantes.map((variante) => [variante.sku, variante]));
  const data = [];

  for (const perfil of perfiles) {
    for (const channel of config.channels) {
      const sku = config.skuByChannel[channel];
      const variante = varianteBySku.get(sku);
      if (!variante) continue;
      data.push({
        tenantId,
        maquinaId,
        perfilOperativoId: perfil.id,
        materiaPrimaVarianteId: variante.id,
        nombre: `${CHANNEL_LABELS[channel]} · ${perfil.nombre}`,
        tipo: config.tipo,
        unidad: config.unidad,
        rendimientoEstimado: config.rendimientoEstimado,
        consumoBase: config.consumoBaseByChannel?.[channel] ?? config.consumoBase,
        activo: true,
        detalleJson: { color: channel },
      });
    }
  }

  if (data.length > 0) {
    await prisma.maquinaConsumible.createMany({ data });
  }
}

async function seedMaquinas(prisma, tenantId, plantaId) {
  const ccImpresion = await prisma.centroCosto.findFirstOrThrow({
    where: { tenantId, codigo: "IMP-001" },
  });
  const ccImpresionId = ccImpresion.id;

  // ============================================================================
  // 1. IMPRESORA_LASER (Ricoh PRO C5100) — Tarjetas, Talonarios
  //    Doc §5: gramajeMaxGr (columna), margenesNoImprimiblesMm (paramsTecnicos),
  //    soporteDobleFaz, coloresSoportados.
  // ============================================================================
  const ricoh = await prisma.maquina.create({
    data: {
      tenantId,
      plantaId,
      centroCostoPrincipalId: ccImpresionId,
      codigo: "RICOH-PRO-C5100",
      nombre: "Ricoh PRO C5100",
      plantilla: "IMPRESORA_LASER",
      plantillaVersion: 1,
      fabricante: "Ricoh",
      modelo: "PRO C5100s",
      estado: EstadoMaquina.ACTIVA,
      estadoConfiguracion: EstadoConfiguracionMaquina.LISTA,
      geometriaTrabajo: GeometriaTrabajoMaquina.PLIEGO,
      unidadProduccionPrincipal: UnidadProduccionMaquina.PPM,
      anchoUtil: "330",
      largoUtil: "700",
      espesorMaximo: "0.4",
      gramajeMaxGr: "350",
      activo: true,
      parametrosTecnicosJson: {
        margenesNoImprimiblesMm: { sup: 5, inf: 5, izq: 5, der: 5 },
        soporteDobleFaz: true,
        coloresSoportados: ["BN", "CMYK"],
      },
    },
  });

  const ricohSimple = await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: ricoh.id,
      nombre: "Papel grueso simple faz",
      tipoPerfil: TipoPerfilOperativoMaquina.IMPRESION,
      activo: true,
      productivityValue: "40",
      productivityUnit: UnidadProduccionMaquina.PPM,
      setupMin: "5",
      cleanupMin: "2",
      // Discriminantes según doc §5: caras + colores + gramajeRango.
      detalleJson: {
        caras: "SIMPLE_FAZ",
        colores: ["CMYK", "BN"],
        gramajeMinGr: 200,
        gramajeMaxGr: 350,
      },
    },
  });

  const ricohDoble = await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: ricoh.id,
      nombre: "Papel grueso doble faz",
      tipoPerfil: TipoPerfilOperativoMaquina.IMPRESION,
      activo: true,
      // PPM son caras A4 equivalentes/min; el paso ya multiplica por caras.
      productivityValue: "40",
      productivityUnit: UnidadProduccionMaquina.PPM,
      setupMin: "8",
      cleanupMin: "2",
      detalleJson: {
        caras: "DOBLE_FAZ",
        colores: ["CMYK", "BN"],
        gramajeMinGr: 200,
        gramajeMaxGr: 350,
      },
    },
  });

  await createPrinterConsumibles(prisma, tenantId, ricoh.id, [ricohSimple, ricohDoble], {
    tipo: TipoConsumibleMaquina.TONER,
    unidad: UnidadConsumoMaquina.GRAMO,
    channels: ["cian", "magenta", "amarillo", "negro"],
    skuByChannel: {
      cian: "TONER-RICOH-C5100-C",
      magenta: "TONER-RICOH-C5100-M",
      amarillo: "TONER-RICOH-C5100-Y",
      negro: "TONER-RICOH-C5100-K",
    },
    consumoBase: "1.73",
    rendimientoEstimado: "500",
  });

  // ============================================================================
  // 2. IMPRESORA_GRAN_FORMATO_POR_AREA (Roland VG3-540) — Vinilo gran formato
  //    Doc §6: tecnologia=LATEX + geometria=ROLLO + margenesNoImprimibles.
  //    Columnas: anchoUtil + espesorMaximo (rollos finos).
  // ============================================================================
  const roland = await prisma.maquina.create({
    data: {
      tenantId,
      plantaId,
      centroCostoPrincipalId: ccImpresionId,
      codigo: "ROLAND-VG3-540",
      nombre: "Roland TrueVIS VG3-540",
      plantilla: "IMPRESORA_GRAN_FORMATO_POR_AREA",
      plantillaVersion: 1,
      fabricante: "Roland DG",
      modelo: "VG3-540",
      estado: EstadoMaquina.ACTIVA,
      estadoConfiguracion: EstadoConfiguracionMaquina.LISTA,
      geometriaTrabajo: GeometriaTrabajoMaquina.ROLLO,
      unidadProduccionPrincipal: UnidadProduccionMaquina.M2_H,
      anchoUtil: "1370",
      espesorMaximo: "1000",
      activo: true,
      parametrosTecnicosJson: {
        tecnologia: "LATEX",
        geometria: "ROLLO",
        anchoMinRolloMm: 200,
        anchoMaxRolloMm: 1370,
        margenesNoImprimiblesMm: { sup: 10, inf: 10, izq: 5, der: 5 },
        coloresSoportados: ["CMYK"],
        soportaCorteIntegrado: true,
      },
    },
  });

  const rolandNormal = await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: roland.id,
      nombre: "Latex CMYK normal 6 pasadas",
      tipoPerfil: TipoPerfilOperativoMaquina.IMPRESION,
      activo: true,
      productivityValue: "6.0",
      productivityUnit: UnidadProduccionMaquina.M2_H,
      setupMin: "10",
      cleanupMin: "5",
      // Discriminantes doc §6: numeroPasadas + colores + modoCalidad.
      detalleJson: {
        numeroPasadas: 6,
        colores: "CMYK",
        modoCalidad: "NORMAL",
      },
    },
  });

  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: roland.id,
      nombre: "Corte integrado kiss-cut rollo",
      tipoPerfil: TipoPerfilOperativoMaquina.CORTE,
      activo: true,
      productivityValue: "8.0",
      productivityUnit: UnidadProduccionMaquina.M2_H,
      setupMin: "8",
      cleanupMin: "2",
      feedReloadMin: "5",
      detalleJson: {
        modoOperacion: "ROLLO",
        factorComplejidad: { SIMPLE: 1.0, INTERMEDIO: 1.5, COMPLEJO: 3.0 },
      },
    },
  });

  await createPrinterConsumibles(prisma, tenantId, roland.id, [rolandNormal], {
    tipo: TipoConsumibleMaquina.TINTA,
    unidad: UnidadConsumoMaquina.ML,
    channels: ["cian", "magenta", "amarillo", "negro"],
    skuByChannel: {
      cian: "TINTA-LATEX-ROLAND-C",
      magenta: "TINTA-LATEX-ROLAND-M",
      amarillo: "TINTA-LATEX-ROLAND-Y",
      negro: "TINTA-LATEX-ROLAND-K",
    },
    consumoBase: "8",
    rendimientoEstimado: "500",
  });

  // ============================================================================
  // 3. IMPRESORA_GRAN_FORMATO_POR_AREA (Mimaki UJF-7151) — Rígidos
  //    Doc §6: tecnologia=UV + geometria=MESA_EXTENSORA.
  // ============================================================================
  const mimaki = await prisma.maquina.create({
    data: {
      tenantId,
      plantaId,
      centroCostoPrincipalId: ccImpresionId,
      codigo: "MIMAKI-UJF-7151",
      nombre: "Mimaki UJF-7151plus",
      plantilla: "IMPRESORA_GRAN_FORMATO_POR_AREA",
      plantillaVersion: 1,
      fabricante: "Mimaki",
      modelo: "UJF-7151plus",
      estado: EstadoMaquina.ACTIVA,
      estadoConfiguracion: EstadoConfiguracionMaquina.LISTA,
      geometriaTrabajo: GeometriaTrabajoMaquina.PLANO,
      unidadProduccionPrincipal: UnidadProduccionMaquina.M2_H,
      anchoUtil: "710",
      largoUtil: "510",
      altoUtil: "153",
      espesorMaximo: "153",
      activo: true,
      parametrosTecnicosJson: {
        tecnologia: "UV",
        geometria: "MESA_EXTENSORA",
        anchoMesaMm: 710,
        largoMesaMm: 510,
        alturaMaxCabezalMm: 153,
        margenesNoImprimiblesMm: { sup: 5, inf: 5, izq: 5, der: 5 },
        coloresSoportados: ["CMYK", "CMYK+blanco", "CMYK+blanco+barniz"],
      },
    },
  });

  const mimakiCmyk = await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: mimaki.id,
      nombre: "UV CMYK rígido normal",
      tipoPerfil: TipoPerfilOperativoMaquina.IMPRESION,
      activo: true,
      productivityValue: "2.0",
      productivityUnit: UnidadProduccionMaquina.M2_H,
      setupMin: "8",
      cleanupMin: "3",
      detalleJson: {
        numeroPasadas: 4,
        colores: "CMYK",
        modoCalidad: "NORMAL",
        modoOperacion: "RIGIDO",
      },
    },
  });

  const mimakiCmykBlanco = await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: mimaki.id,
      nombre: "UV CMYK + blanco alta",
      tipoPerfil: TipoPerfilOperativoMaquina.IMPRESION,
      activo: true,
      productivityValue: "1.5",
      productivityUnit: UnidadProduccionMaquina.M2_H,
      setupMin: "12",
      cleanupMin: "5",
      detalleJson: {
        numeroPasadas: 8,
        colores: "CMYK+blanco",
        modoCalidad: "ALTA",
        modoOperacion: "RIGIDO",
      },
    },
  });

  await createPrinterConsumibles(prisma, tenantId, mimaki.id, [mimakiCmyk], {
    tipo: TipoConsumibleMaquina.TINTA,
    unidad: UnidadConsumoMaquina.ML,
    channels: ["cian", "magenta", "amarillo", "negro"],
    skuByChannel: {
      cian: "TINTA-UV-MIMAKI-C",
      magenta: "TINTA-UV-MIMAKI-M",
      amarillo: "TINTA-UV-MIMAKI-Y",
      negro: "TINTA-UV-MIMAKI-K",
    },
    consumoBase: "8",
    rendimientoEstimado: "600",
  });

  await createPrinterConsumibles(prisma, tenantId, mimaki.id, [mimakiCmykBlanco], {
    tipo: TipoConsumibleMaquina.TINTA,
    unidad: UnidadConsumoMaquina.ML,
    channels: ["cian", "magenta", "amarillo", "negro", "blanco"],
    skuByChannel: {
      cian: "TINTA-UV-MIMAKI-C",
      magenta: "TINTA-UV-MIMAKI-M",
      amarillo: "TINTA-UV-MIMAKI-Y",
      negro: "TINTA-UV-MIMAKI-K",
      blanco: "TINTA-UV-MIMAKI-W",
    },
    consumoBase: "8",
    consumoBaseByChannel: { blanco: "5" },
    rendimientoEstimado: "600",
  });

  // ============================================================================
  // 4. GUILLOTINA (Polar 92) — corte de pliegos
  //    Doc §7: anchoUtil = largo cuchilla. paramsTecnicos: tiempoPorCorteSeg.
  //    Perfiles por rango de gramaje. paramsPerfilJson: pliegosMaxPorTanda.
  //    Productividad NULL (fórmula no lineal).
  // ============================================================================
  const polar = await prisma.maquina.create({
    data: {
      tenantId,
      plantaId,
      centroCostoPrincipalId: ccImpresionId,
      codigo: "POLAR-92",
      nombre: "Polar 92 ED",
      plantilla: "GUILLOTINA",
      plantillaVersion: 1,
      fabricante: "Polar",
      modelo: "92 ED",
      estado: EstadoMaquina.ACTIVA,
      estadoConfiguracion: EstadoConfiguracionMaquina.LISTA,
      geometriaTrabajo: GeometriaTrabajoMaquina.PLIEGO,
      unidadProduccionPrincipal: UnidadProduccionMaquina.CORTES_MIN,
      anchoUtil: "920",
      largoUtil: "1100",
      altoUtil: "165",
      activo: true,
      parametrosTecnicosJson: {
        tiempoPorCorteSeg: 8,
      },
    },
  });

  // Perfil 1: papel obra hasta 100gr (capacidad 500 pliegos).
  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: polar.id,
      nombre: "Papel obra hasta 100gr",
      tipoPerfil: TipoPerfilOperativoMaquina.CORTE,
      activo: true,
      productivityValue: null, // fórmula no lineal
      productivityUnit: null,
      setupMin: "3",
      cleanupMin: "1",
      feedReloadMin: "2",
      detalleJson: {
        gramajeMinGr: 0,
        gramajeMaxGr: 100,
        pliegosMaxPorTanda: 500,
      },
    },
  });

  // Perfil 2: papel grueso 100-250gr (capacidad 250 pliegos).
  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: polar.id,
      nombre: "Papel grueso 100-250gr",
      tipoPerfil: TipoPerfilOperativoMaquina.CORTE,
      activo: true,
      productivityValue: null,
      productivityUnit: null,
      setupMin: "3",
      cleanupMin: "1",
      feedReloadMin: "2",
      detalleJson: {
        gramajeMinGr: 100,
        gramajeMaxGr: 250,
        pliegosMaxPorTanda: 250,
      },
    },
  });

  // Perfil 3: cartón 250-400gr (capacidad 100 pliegos).
  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: polar.id,
      nombre: "Cartón fino 250-400gr",
      tipoPerfil: TipoPerfilOperativoMaquina.CORTE,
      activo: true,
      productivityValue: null,
      productivityUnit: null,
      setupMin: "3",
      cleanupMin: "1",
      feedReloadMin: "2",
      detalleJson: {
        gramajeMinGr: 250,
        gramajeMaxGr: 400,
        pliegosMaxPorTanda: 100,
      },
    },
  });

  // ============================================================================
  // 5. PLOTTER_DE_CORTE (Skycut C24) — vinilo
  //    Doc §8: anchoUtil + paramsTecnicos.modosOperacionSoportados.
  //    Un perfil por nivel de complejidad (Corte fácil/complejo). El formato
  //    rollo/hoja lo decide el material cargado, no el perfil.
  // ============================================================================
  const skycut = await prisma.maquina.create({
    data: {
      tenantId,
      plantaId,
      centroCostoPrincipalId: ccImpresionId,
      codigo: "SKYCUT-C24",
      nombre: "Skycut C24",
      plantilla: "PLOTTER_DE_CORTE",
      plantillaVersion: 1,
      fabricante: "Skycut",
      modelo: "C24",
      estado: EstadoMaquina.ACTIVA,
      estadoConfiguracion: EstadoConfiguracionMaquina.LISTA,
      geometriaTrabajo: GeometriaTrabajoMaquina.ROLLO,
      unidadProduccionPrincipal: UnidadProduccionMaquina.M2_H,
      anchoUtil: "610",
      espesorMaximo: "1",
      activo: true,
      parametrosTecnicosJson: {
        modosOperacionSoportados: ["ROLLO", "HOJAS"],
      },
    },
  });

  // Complejidad del corte = un perfil por nivel (ritmo m²/h distinto), como en
  // Holdprint ("corte simple 8 · corte complejo 4"). El comercial elige uno.
  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: skycut.id,
      nombre: "Corte fácil",
      tipoPerfil: TipoPerfilOperativoMaquina.CORTE,
      activo: true,
      productivityValue: "8",
      productivityUnit: UnidadProduccionMaquina.M2_H,
      setupMin: "8",
      cleanupMin: "2",
      detalleJson: {},
    },
  });

  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: skycut.id,
      nombre: "Corte complejo",
      tipoPerfil: TipoPerfilOperativoMaquina.CORTE,
      activo: true,
      productivityValue: "4",
      productivityUnit: UnidadProduccionMaquina.M2_H,
      setupMin: "8",
      cleanupMin: "2",
      detalleJson: {},
    },
  });

  // ============================================================================
  // 6. LAMINADORA_BOPP_ROLLO — laminado de tarjetas
  //    Doc §9: márgenes en máquina; pasadas de doble faz en el perfil.
  // ============================================================================
  const laminadora = await prisma.maquina.create({
    data: {
      tenantId,
      plantaId,
      centroCostoPrincipalId: ccImpresionId,
      codigo: "LAM-BOPP-001",
      nombre: "Laminadora BOPP rollo",
      plantilla: "LAMINADORA_BOPP_ROLLO",
      plantillaVersion: 1,
      fabricante: "GMP",
      modelo: "Excelam-II",
      estado: EstadoMaquina.ACTIVA,
      estadoConfiguracion: EstadoConfiguracionMaquina.LISTA,
      geometriaTrabajo: GeometriaTrabajoMaquina.ROLLO,
      unidadProduccionPrincipal: UnidadProduccionMaquina.M_MIN,
      anchoUtil: "760",
      espesorMaximo: "1",
      activo: true,
      parametrosTecnicosJson: {
        margenesDesperdicioMm: { inicio: 50, fin: 50, izquierdo: 10, derecho: 10 },
        margenEntrePliegosMm: 5,
      },
    },
  });

  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: laminadora.id,
      nombre: "Estándar",
      tipoPerfil: TipoPerfilOperativoMaquina.LAMINADO,
      activo: true,
      productivityValue: "8",
      productivityUnit: UnidadProduccionMaquina.M_MIN,
      setupMin: "8",
      cleanupMin: "2",
      detalleJson: { pasadasDobleFaz: 2 },
    },
  });

  // ============================================================================
  // 7. ROUTER_CNC (Felder F500) — rígidos cortes complejos
  //    Doc §12: paramsTecnicos.potenciaHusilloKw, velocidadMaxRPM,
  //    operacionesSoportadas, tieneAspiracionViruta.
  //    Perfil único "Estándar" T-3 (productividad nominal).
  // ============================================================================
  const cnc = await prisma.maquina.create({
    data: {
      tenantId,
      plantaId,
      centroCostoPrincipalId: ccImpresionId,
      codigo: "FELDER-F500",
      nombre: "Felder F500 CNC",
      plantilla: "ROUTER_CNC",
      plantillaVersion: 1,
      fabricante: "Felder",
      modelo: "F500",
      estado: EstadoMaquina.ACTIVA,
      estadoConfiguracion: EstadoConfiguracionMaquina.LISTA,
      geometriaTrabajo: GeometriaTrabajoMaquina.VOLUMEN,
      unidadProduccionPrincipal: UnidadProduccionMaquina.M2_H,
      anchoUtil: "1500",
      largoUtil: "3000",
      altoUtil: "200",
      espesorMaximo: "200",
      activo: true,
      parametrosTecnicosJson: {
        potenciaHusilloKw: 5.5,
        velocidadMaxRPM: 24000,
        operacionesSoportadas: ["CORTE_PASANTE", "FRESADO", "PERFORADO"],
        tieneAspiracionViruta: true,
      },
    },
  });

  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: cnc.id,
      nombre: "Estándar",
      tipoPerfil: TipoPerfilOperativoMaquina.MECANIZADO,
      activo: true,
      productivityValue: "5",
      productivityUnit: UnidadProduccionMaquina.M2_H,
      setupMin: "12",
      cleanupMin: "8",
      detalleJson: {},
    },
  });

  // Duplicadora de un color. El motor duplica la corrida, la tinta y el máster
  // por caras; el perfil doble sólo duplica el setup de creación de máster.
  const duplicadora = await prisma.maquina.create({
    data: {
      tenantId,
      plantaId,
      centroCostoPrincipalId: ccImpresionId,
      codigo: "RICOH-DX2430",
      nombre: "Ricoh DX 2430",
      plantilla: "DUPLICADORA_DIGITAL",
      plantillaVersion: 1,
      fabricante: "Ricoh",
      modelo: "DX 2430",
      estado: EstadoMaquina.ACTIVA,
      estadoConfiguracion: EstadoConfiguracionMaquina.LISTA,
      geometriaTrabajo: GeometriaTrabajoMaquina.PLIEGO,
      unidadProduccionPrincipal: UnidadProduccionMaquina.PPM,
      anchoUtil: "275",
      largoUtil: "395",
      gramajeMaxGr: "127.9",
      activo: true,
      parametrosTecnicosJson: {
        tecnologia: "fotoduplicacion",
        margenesNoImprimiblesMm: { sup: 20, inf: 20, izq: 12.5, der: 12.5 },
        soporteDobleFaz: true,
        coloresSoportados: ["BN"],
        tamborInstalado: "negro",
      },
      observaciones:
        "Configuración de referencia. Precios de tinta y máster revisables según proveedor.",
    },
  });

  const duplicadoraSimple = await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: duplicadora.id,
      nombre: "Negro simple faz",
      tipoPerfil: TipoPerfilOperativoMaquina.IMPRESION,
      activo: true,
      productivityValue: "90",
      productivityUnit: UnidadProduccionMaquina.PPM,
      setupMin: "0.75",
      cleanupMin: "0",
      feedReloadMin: "0",
      detalleJson: {
        caras: "SIMPLE_FAZ",
        colores: ["BN"],
        gramajeMaxGr: 127.9,
      },
    },
  });

  const duplicadoraDoble = await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: duplicadora.id,
      nombre: "Negro doble faz",
      tipoPerfil: TipoPerfilOperativoMaquina.IMPRESION,
      activo: true,
      productivityValue: "90",
      productivityUnit: UnidadProduccionMaquina.PPM,
      setupMin: "1.5",
      cleanupMin: "0",
      feedReloadMin: "0",
      detalleJson: {
        caras: "DOBLE_FAZ",
        colores: ["BN"],
        gramajeMaxGr: 127.9,
      },
    },
  });

  await createPrinterConsumibles(
    prisma,
    tenantId,
    duplicadora.id,
    [duplicadoraSimple, duplicadoraDoble],
    {
      channels: ["negro"],
      skuByChannel: { negro: "TINTA-RICOH-DX2430-K-500ML" },
      tipo: TipoConsumibleMaquina.TINTA,
      unidad: UnidadConsumoMaquina.ML,
      consumoBase: "1.603",
    },
  );

  const masterVariante = await prisma.materiaPrimaVariante.findFirst({
    where: { tenantId, sku: "MASTER-RICOH-DX2430-280X50" },
  });
  if (masterVariante) {
    await prisma.maquinaConsumible.create({
      data: {
        tenantId,
        maquinaId: duplicadora.id,
        materiaPrimaVarianteId: masterVariante.id,
        nombre: "Máster B4 Ricoh DX 2430",
        tipo: TipoConsumibleMaquina.OTRO,
        unidad: UnidadConsumoMaquina.UNIDAD,
        rendimientoEstimado: "100",
        activo: true,
        detalleJson: { rol: "master" },
      },
    });
  }

  console.info(
    `✅ Máquinas v3.0: 8 máquinas creadas (incluye duplicadora Ricoh DX 2430).`,
  );

  return {
    ricoh,
    roland,
    mimaki,
    polar,
    skycut,
    laminadora,
    cnc,
    duplicadora,
  };
}

module.exports = { seedMaquinas };
