/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Seed de Máquinas, Perfiles Operativos y Consumibles para Corporearte.
 *
 * Crea las 7 máquinas mínimas que cubren los 4 productos validados de Fase E:
 * - IMPRESORA_LASER: Tarjetas, Talonarios
 * - IMPRESORA_LATEX: Vinilo gran formato
 * - IMPRESORA_UV_FLATBED: Rígidos
 * - GUILLOTINA: corte de pliegos
 * - PLOTTER_DE_CORTE: corte de stickers
 * - LAMINADORA_BOPP_ROLLO: laminado
 * - ROUTER_CNC: corte rígidos complejos
 *
 * Cada máquina con 1-2 perfiles operativos básicos.
 */

const {
  EstadoMaquina,
  EstadoConfiguracionMaquina,
  GeometriaTrabajoMaquina,
  UnidadProduccionMaquina,
  TipoPerfilOperativoMaquina,
} = require("@prisma/client");

async function seedMaquinas(prisma, tenantId, plantaId) {
  // Centro de costo principal único para todas las máquinas (tarifa publicada).
  // En el modelo real cada máquina iría a su CC propio, pero para el seed inicial
  // todas comparten "Offset 4 colores" que tiene tarifa calculada.
  const ccImpresion = await prisma.centroCosto.findFirstOrThrow({
    where: { tenantId, codigo: "IMP-001" },
  });
  const ccImpresionId = ccImpresion.id;
  // ============================================================================
  // 1. IMPRESORA_LASER (Ricoh PRO C5100) — Tarjetas, Talonarios
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
      pesoMaximo: "350",
      activo: true,
      parametrosTecnicosJson: {
        gramajeMaxGr: 350,
        formatoMaxAncho: 330,
        formatoMaxLargo: 700,
        soportaDobleFaz: true,
      },
    },
  });

  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: ricoh.id,
      nombre: "Papel grueso simple faz",
      tipoPerfil: TipoPerfilOperativoMaquina.IMPRESION,
      activo: true,
      productivityValue: "2400",
      productivityUnit: UnidadProduccionMaquina.PPM,
      setupMin: "5",
      cleanupMin: "2",
      sheetThicknessMm: "0.3",
      cantidadPasadas: 1,
      dobleFaz: false,
      detalleJson: {
        gramajeRangoGr: { min: 200, max: 350 },
      },
    },
  });

  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: ricoh.id,
      nombre: "Papel grueso doble faz",
      tipoPerfil: TipoPerfilOperativoMaquina.IMPRESION,
      activo: true,
      productivityValue: "1200",
      productivityUnit: UnidadProduccionMaquina.PPM,
      setupMin: "8",
      cleanupMin: "2",
      sheetThicknessMm: "0.3",
      cantidadPasadas: 2,
      dobleFaz: true,
      detalleJson: {
        gramajeRangoGr: { min: 200, max: 350 },
      },
    },
  });

  // ============================================================================
  // 2. IMPRESORA_LATEX (Roland VG3-540) — Vinilo gran formato
  // ============================================================================
  const roland = await prisma.maquina.create({
    data: {
      tenantId,
      plantaId,
      centroCostoPrincipalId: ccImpresionId,
      codigo: "ROLAND-VG3-540",
      nombre: "Roland TrueVIS VG3-540",
      plantilla: "IMPRESORA_LATEX",
      plantillaVersion: 1,
      fabricante: "Roland DG",
      modelo: "VG3-540",
      estado: EstadoMaquina.ACTIVA,
      estadoConfiguracion: EstadoConfiguracionMaquina.LISTA,
      geometriaTrabajo: GeometriaTrabajoMaquina.ROLLO,
      unidadProduccionPrincipal: UnidadProduccionMaquina.M2_H,
      anchoUtil: "1370",
      activo: true,
      parametrosTecnicosJson: {
        anchoMaxMm: 1370,
        soportaCorteIntegrado: true,
        tintas: ["CMYK", "Light_CMYK"],
      },
    },
  });

  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: roland.id,
      nombre: "Latex CMYK estándar",
      tipoPerfil: TipoPerfilOperativoMaquina.IMPRESION,
      activo: true,
      productivityValue: "6.0",
      productivityUnit: UnidadProduccionMaquina.M2_H,
      setupMin: "10",
      cleanupMin: "5",
      cantidadPasadas: 1,
      detalleJson: {
        modoColor: "CMYK",
        tipoSustrato: ["vinilo", "lona", "papel_blueback"],
      },
    },
  });

  // ============================================================================
  // 3. IMPRESORA_UV_FLATBED (Mimaki UJF-7151) — Rígidos
  // ============================================================================
  const mimaki = await prisma.maquina.create({
    data: {
      tenantId,
      plantaId,
      centroCostoPrincipalId: ccImpresionId,
      codigo: "MIMAKI-UJF-7151",
      nombre: "Mimaki UJF-7151plus",
      plantilla: "IMPRESORA_UV_FLATBED",
      plantillaVersion: 1,
      fabricante: "Mimaki",
      modelo: "UJF-7151plus",
      estado: EstadoMaquina.ACTIVA,
      estadoConfiguracion: EstadoConfiguracionMaquina.LISTA,
      geometriaTrabajo: GeometriaTrabajoMaquina.PLIEGO,
      unidadProduccionPrincipal: UnidadProduccionMaquina.M2_H,
      anchoUtil: "710",
      largoUtil: "510",
      altoUtil: "153",
      activo: true,
      parametrosTecnicosJson: {
        espesorMaxMm: 153,
        formatoMaxMm: { ancho: 710, largo: 510 },
        soportaTintaBlanca: true,
        soportaTintaBarniz: true,
      },
    },
  });

  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: mimaki.id,
      nombre: "UV CMYK rígido",
      tipoPerfil: TipoPerfilOperativoMaquina.IMPRESION,
      activo: true,
      productivityValue: "2.0",
      productivityUnit: UnidadProduccionMaquina.M2_H,
      setupMin: "8",
      cleanupMin: "3",
      cantidadPasadas: 1,
      detalleJson: { modoColor: "CMYK" },
    },
  });

  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: mimaki.id,
      nombre: "UV CMYK + blanco",
      tipoPerfil: TipoPerfilOperativoMaquina.IMPRESION,
      activo: true,
      productivityValue: "1.5",
      productivityUnit: UnidadProduccionMaquina.M2_H,
      setupMin: "12",
      cleanupMin: "5",
      cantidadPasadas: 2,
      detalleJson: { modoColor: "CMYK+W", incluyeBlanco: true },
    },
  });

  // ============================================================================
  // 4. GUILLOTINA (Polar 92) — corte de pliegos
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
      activo: true,
      parametrosTecnicosJson: {
        anchoMaxMm: 920,
        alturaTandaMaxMm: 165,
        cortesPorMin: 1,
      },
    },
  });

  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: polar.id,
      nombre: "Corte estándar",
      tipoPerfil: TipoPerfilOperativoMaquina.CORTE,
      activo: true,
      productivityValue: "60",
      productivityUnit: UnidadProduccionMaquina.CORTES_MIN,
      setupMin: "3",
      cleanupMin: "0",
      detalleJson: {
        cortesPorTanda: 5,
        tiempoPorCorteSeg: 15,
      },
    },
  });

  // ============================================================================
  // 5. PLOTTER_DE_CORTE (Skycut C24) — vinilo
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
      activo: true,
      parametrosTecnicosJson: {
        anchoMaxMm: 610,
        soportaTipoCorte: ["MEDIO", "PROFUNDO", "COMPLETO"],
      },
    },
  });

  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: skycut.id,
      nombre: "Corte estándar",
      tipoPerfil: TipoPerfilOperativoMaquina.CORTE,
      activo: true,
      productivityValue: "4.0",
      productivityUnit: UnidadProduccionMaquina.M2_H,
      setupMin: "5",
      cleanupMin: "2",
      detalleJson: {},
    },
  });

  // ============================================================================
  // 6. LAMINADORA_BOPP_ROLLO — laminado de tarjetas
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
      estado: EstadoMaquina.ACTIVA,
      estadoConfiguracion: EstadoConfiguracionMaquina.LISTA,
      geometriaTrabajo: GeometriaTrabajoMaquina.ROLLO,
      unidadProduccionPrincipal: UnidadProduccionMaquina.M_MIN,
      anchoUtil: "650",
      activo: true,
      parametrosTecnicosJson: {
        anchoMaxMm: 650,
        velocidadMtsMin: 10,
      },
    },
  });

  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: laminadora.id,
      nombre: "BOPP mate/brillo simple faz",
      tipoPerfil: TipoPerfilOperativoMaquina.LAMINADO,
      activo: true,
      productivityValue: "600",
      productivityUnit: UnidadProduccionMaquina.M_MIN,
      setupMin: "5",
      cleanupMin: "2",
      detalleJson: {},
    },
  });

  // ============================================================================
  // 7. ROUTER_CNC (Felder F500) — rígidos cortes complejos
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
      geometriaTrabajo: GeometriaTrabajoMaquina.PLIEGO,
      unidadProduccionPrincipal: UnidadProduccionMaquina.M2_H,
      anchoUtil: "1830",
      largoUtil: "2750",
      altoUtil: "120",
      activo: true,
      parametrosTecnicosJson: {
        espesorMaxMm: 120,
        materialesCompatibles: ["MDF", "PVC", "FOAM", "Acrilico"],
      },
    },
  });

  await prisma.maquinaPerfilOperativo.create({
    data: {
      tenantId,
      maquinaId: cnc.id,
      nombre: "Corte CNC estándar",
      tipoPerfil: TipoPerfilOperativoMaquina.MECANIZADO,
      activo: true,
      productivityValue: "0.5",
      productivityUnit: UnidadProduccionMaquina.M2_H,
      setupMin: "15",
      cleanupMin: "5",
      detalleJson: {
        velocidadCorteMmMin: 3000,
      },
    },
  });

  console.info(`✅ Máquinas: 7 plantillas creadas (Ricoh, Roland, Mimaki, Polar, Skycut, Laminadora, Felder).`);

  return {
    ricoh,
    roland,
    mimaki,
    polar,
    skycut,
    laminadora,
    cnc,
  };
}

module.exports = { seedMaquinas };
