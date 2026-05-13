/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Seed de Materias Primas + Variantes para los 4 productos validados.
 *
 * Materiales mínimos:
 * - Papel Opalina 300gr (Tarjetas)
 * - Papel obra autocopiativo CB / CFB (Talonarios duplicado)
 * - Vinilo blanco rollo 1.37m (Vinilo)
 * - MDF 9mm placa 1.83x2.75m (Rígidos)
 * - Film BOPP mate / brillo (laminado opcional Tarjetas)
 * - Bolsa celofán + Caja embalaje (insumos embalaje)
 * - Tinta CMYK Ricoh + Tinta Latex Roland + Tinta UV Mimaki (consumibles máquinas)
 */

const {
  FamiliaMateriaPrima,
  SubfamiliaMateriaPrima,
  UnidadMateriaPrima,
} = require("@prisma/client");

async function seedMateriales(prisma, tenantId) {
  // ============================================================================
  // 1. Papel Opalina 300gr (Tarjetas)
  // ============================================================================
  const opalina = await prisma.materiaPrima.create({
    data: {
      tenantId,
      codigo: "PAPEL-OPALINA-300",
      nombre: "Papel Opalina 300gr",
      descripcion: "Papel opalina premium 300gr para tarjetas de visita",
      familia: FamiliaMateriaPrima.SUSTRATO,
      subfamilia: SubfamiliaMateriaPrima.SUSTRATO_HOJA,
      tipoTecnico: "papel_premium",
      templateId: "sustrato_hoja_v1",
      unidadStock: UnidadMateriaPrima.PLIEGO,
      unidadCompra: UnidadMateriaPrima.RESMA,
      esConsumible: false,
      esRepuesto: false,
      activo: true,
      atributosTecnicosJson: {
        gramajeGr: 300,
        color: "blanco",
        acabadoSuperficie: "opalina",
      },
      variantes: {
        create: [
          {
            tenantId,
            sku: "OPALINA-300-65X45",
            nombreVariante: "Opalina 300gr 65x45cm",
            activo: true,
            precioReferencia: "150",
            moneda: "ARS",
            atributosVarianteJson: {
              formatoComercial: "65 x 45 cm",
              ancho: 65,
              alto: 45,
              gramaje: 300,
              material: "Opalina",
              color: "Blanco",
              acabado: "Mate",
              anchoMm: 650,
              largoMm: 450,
              altoMm: 450,
              gramajeGr: 300,
            },
          },
        ],
      },
    },
  });

  // ============================================================================
  // 2. Papel autocopiativo CB / CFB (Talonarios)
  // ============================================================================
  const papelCB = await prisma.materiaPrima.create({
    data: {
      tenantId,
      codigo: "PAPEL-AUTOCOP-CB",
      nombre: "Papel autocopiativo CB (capa 1 - blanco)",
      descripcion: "Papel químico autocopiativo, capa 1 (blanco superior)",
      familia: FamiliaMateriaPrima.SUSTRATO,
      subfamilia: SubfamiliaMateriaPrima.SUSTRATO_HOJA,
      tipoTecnico: "autocopiativo_cb",
      templateId: "sustrato_hoja_v1",
      unidadStock: UnidadMateriaPrima.PLIEGO,
      unidadCompra: UnidadMateriaPrima.RESMA,
      activo: true,
      atributosTecnicosJson: { gramajeGr: 56, color: "blanco", capa: "CB" },
      variantes: {
        create: [
          {
            tenantId,
            sku: "AUTOCOP-CB-22X34",
            nombreVariante: "Autocopiativo CB 22x34cm",
            activo: true,
            precioReferencia: "45",
            moneda: "ARS",
            atributosVarianteJson: {
              formatoComercial: "22 x 34 cm",
              ancho: 22,
              alto: 34,
              gramaje: 56,
              material: "Autocopiativo CB",
              color: "Blanco",
              acabado: "Mate",
              anchoMm: 220,
              largoMm: 340,
              altoMm: 340,
              gramajeGr: 56,
            },
          },
        ],
      },
    },
  });

  const papelCFB = await prisma.materiaPrima.create({
    data: {
      tenantId,
      codigo: "PAPEL-AUTOCOP-CFB",
      nombre: "Papel autocopiativo CFB (capa 2 - rosa)",
      descripcion: "Papel químico autocopiativo, capa 2 (rosa intermedia)",
      familia: FamiliaMateriaPrima.SUSTRATO,
      subfamilia: SubfamiliaMateriaPrima.SUSTRATO_HOJA,
      tipoTecnico: "autocopiativo_cfb",
      templateId: "sustrato_hoja_v1",
      unidadStock: UnidadMateriaPrima.PLIEGO,
      unidadCompra: UnidadMateriaPrima.RESMA,
      activo: true,
      atributosTecnicosJson: { gramajeGr: 56, color: "rosa", capa: "CFB" },
      variantes: {
        create: [
          {
            tenantId,
            sku: "AUTOCOP-CFB-22X34",
            nombreVariante: "Autocopiativo CFB 22x34cm",
            activo: true,
            precioReferencia: "48",
            moneda: "ARS",
            atributosVarianteJson: {
              formatoComercial: "22 x 34 cm",
              ancho: 22,
              alto: 34,
              gramaje: 56,
              material: "Autocopiativo CFB",
              color: "Rosa",
              acabado: "Mate",
              anchoMm: 220,
              largoMm: 340,
              altoMm: 340,
              gramajeGr: 56,
            },
          },
        ],
      },
    },
  });

  // ============================================================================
  // 3. Vinilo blanco rollo (Vinilo gran formato)
  // ============================================================================
  const viniloBlanco = await prisma.materiaPrima.create({
    data: {
      tenantId,
      codigo: "VINILO-BLANCO-MONO",
      nombre: "Vinilo adhesivo blanco monomérico",
      descripcion: "Vinilo blanco adhesivo de calidad media para gran formato",
      familia: FamiliaMateriaPrima.SUSTRATO,
      subfamilia: SubfamiliaMateriaPrima.SUSTRATO_ROLLO_FLEXIBLE,
      tipoTecnico: "vinilo_monomerico",
      templateId: "sustrato_rollo_flexible_v1",
      unidadStock: UnidadMateriaPrima.METRO_LINEAL,
      unidadCompra: UnidadMateriaPrima.ROLLO,
      activo: true,
      atributosTecnicosJson: {
        color: "blanco",
        tipoAdhesivo: "permanente",
        durabilidadAniosExterior: 3,
      },
      variantes: {
        create: [
          {
            tenantId,
            sku: "VINILO-BLANCO-1370",
            nombreVariante: "Vinilo blanco rollo 1.37m",
            activo: true,
            precioReferencia: "850",
            moneda: "ARS",
            atributosVarianteJson: {
              ancho: 1.37,
              largo: 50,
              acabado: "Brillante",
              anchoMm: 1370,
              largoMm: 50000,
              largoRolloMm: 50000,
            },
          },
          {
            tenantId,
            sku: "VINILO-BLANCO-1520",
            nombreVariante: "Vinilo blanco rollo 1.52m",
            activo: true,
            precioReferencia: "950",
            moneda: "ARS",
            atributosVarianteJson: {
              ancho: 1.52,
              largo: 50,
              acabado: "Brillante",
              anchoMm: 1520,
              largoMm: 50000,
              largoRolloMm: 50000,
            },
          },
        ],
      },
    },
  });

  // ============================================================================
  // 4. MDF 9mm (Rígidos)
  // ============================================================================
  const mdf = await prisma.materiaPrima.create({
    data: {
      tenantId,
      codigo: "MDF-9MM",
      nombre: "MDF 9mm placa madre",
      descripcion: "Placa de MDF 9mm para cartelería y letras corpóreas",
      familia: FamiliaMateriaPrima.SUSTRATO,
      subfamilia: SubfamiliaMateriaPrima.SUSTRATO_RIGIDO,
      tipoTecnico: "mdf_estandar",
      templateId: "sustrato_rigido_v1",
      unidadStock: UnidadMateriaPrima.UNIDAD,
      unidadCompra: UnidadMateriaPrima.UNIDAD,
      activo: true,
      atributosTecnicosJson: {
        espesorMm: 9,
        densidadKgM3: 720,
      },
      variantes: {
        create: [
          {
            tenantId,
            sku: "MDF-9MM-183X275",
            nombreVariante: "MDF 9mm placa 1.83x2.75m",
            activo: true,
            precioReferencia: "12500",
            moneda: "ARS",
            atributosVarianteJson: {
              ancho: 1.83,
              alto: 2.75,
              espesor: 9,
              colorBase: "Natural",
              anchoMm: 1830,
              largoMm: 2750,
              altoMm: 2750,
              espesorMm: 9,
            },
          },
        ],
      },
    },
  });

  // ============================================================================
  // 5. Film BOPP (laminado tarjetas)
  // ============================================================================
  const filmBoppMate = await prisma.materiaPrima.create({
    data: {
      tenantId,
      codigo: "FILM-BOPP-MATE",
      nombre: "Film BOPP mate",
      descripcion: "Film polipropileno mate para laminado",
      familia: FamiliaMateriaPrima.TRANSFERENCIA_LAMINACION,
      subfamilia: SubfamiliaMateriaPrima.LAMINADO_FILM,
      tipoTecnico: "bopp_mate",
      templateId: "laminado_film_v1",
      unidadStock: UnidadMateriaPrima.METRO_LINEAL,
      unidadCompra: UnidadMateriaPrima.ROLLO,
      activo: true,
      atributosTecnicosJson: {
        acabado: "mate",
        gramajeMicrones: 27,
      },
      variantes: {
        create: [
          {
            tenantId,
            sku: "BOPP-MATE-650",
            nombreVariante: "BOPP mate rollo 650mm",
            activo: true,
            precioReferencia: "320",
            moneda: "ARS",
            atributosVarianteJson: {
              ancho: 650,
              largo: 1000,
              acabado: "Mate",
              espesor: 0.027,
              anchoMm: 650,
              largoMm: 1000000,
              largoRolloMm: 1000000,
            },
          },
        ],
      },
    },
  });

  const filmBoppBrillo = await prisma.materiaPrima.create({
    data: {
      tenantId,
      codigo: "FILM-BOPP-BRILLO",
      nombre: "Film BOPP brillo",
      descripcion: "Film polipropileno brillo para laminado",
      familia: FamiliaMateriaPrima.TRANSFERENCIA_LAMINACION,
      subfamilia: SubfamiliaMateriaPrima.LAMINADO_FILM,
      tipoTecnico: "bopp_brillo",
      templateId: "laminado_film_v1",
      unidadStock: UnidadMateriaPrima.METRO_LINEAL,
      unidadCompra: UnidadMateriaPrima.ROLLO,
      activo: true,
      atributosTecnicosJson: { acabado: "brillo", gramajeMicrones: 27 },
      variantes: {
        create: [
          {
            tenantId,
            sku: "BOPP-BRILLO-650",
            nombreVariante: "BOPP brillo rollo 650mm",
            activo: true,
            precioReferencia: "320",
            moneda: "ARS",
            atributosVarianteJson: {
              ancho: 650,
              largo: 1000,
              acabado: "Brillo",
              espesor: 0.027,
              anchoMm: 650,
              largoMm: 1000000,
              largoRolloMm: 1000000,
            },
          },
        ],
      },
    },
  });

  // ============================================================================
  // 6. Bolsa celofán + Caja embalaje
  // ============================================================================
  const bolsa = await prisma.materiaPrima.create({
    data: {
      tenantId,
      codigo: "BOLSA-CELOFAN-100",
      nombre: "Bolsa celofán para 100 tarjetas",
      descripcion: "Bolsa de celofán para empaquetado de 100 tarjetas",
      familia: FamiliaMateriaPrima.TERMINACION_EDITORIAL,
      subfamilia: SubfamiliaMateriaPrima.EMBALAJE_PROTECCION,
      tipoTecnico: "bolsa_celofan",
      templateId: "embalaje_proteccion_v1",
      unidadStock: UnidadMateriaPrima.UNIDAD,
      unidadCompra: UnidadMateriaPrima.PACK,
      activo: true,
      atributosTecnicosJson: {},
      variantes: {
        create: [
          {
            tenantId,
            sku: "BOLSA-100",
            nombreVariante: "Bolsa standard",
            activo: true,
            precioReferencia: "15",
            moneda: "ARS",
            atributosVarianteJson: {
              tipoEmbalaje: "Bolsa",
              capacidadUnidades: 100,
              ancho: 9,
              alto: 6,
              material: "Celofán",
              anchoMm: 90,
              altoMm: 60,
              largoMm: 60,
              piezasPorCaja: 100,
            },
          },
        ],
      },
    },
  });

  // ============================================================================
  // 7. Tintas (consumibles de las máquinas)
  // ============================================================================
  const tintaCMYKRicoh = await prisma.materiaPrima.create({
    data: {
      tenantId,
      codigo: "TONER-CMYK-RICOH",
      nombre: "Tóner CMYK Ricoh PRO C5100",
      descripcion: "Tóner para Ricoh PRO C5100",
      familia: FamiliaMateriaPrima.TINTA_COLORANTE,
      subfamilia: SubfamiliaMateriaPrima.TONER,
      tipoTecnico: "toner_laser",
      templateId: "toner_v1",
      unidadStock: UnidadMateriaPrima.UNIDAD,
      unidadCompra: UnidadMateriaPrima.UNIDAD,
      esConsumible: true,
      activo: true,
      atributosTecnicosJson: { tecnologia: "laser", colores: "CMYK" },
      variantes: {
        create: [
          {
            tenantId,
            sku: "TONER-RICOH-C5100-C",
            nombreVariante: "Tóner cian",
            activo: true,
            precioReferencia: "21250",
            moneda: "ARS",
            atributosVarianteJson: {
              color: "Cian",
              canal: "cian",
              rendimientoPaginasIso: 16000,
              equipoCompatible: "Ricoh PRO C5100",
              presentacion: "Cartucho",
              oemOAlternativo: "OEM",
            },
          },
          {
            tenantId,
            sku: "TONER-RICOH-C5100-M",
            nombreVariante: "Tóner magenta",
            activo: true,
            precioReferencia: "21250",
            moneda: "ARS",
            atributosVarianteJson: {
              color: "Magenta",
              canal: "magenta",
              rendimientoPaginasIso: 16000,
              equipoCompatible: "Ricoh PRO C5100",
              presentacion: "Cartucho",
              oemOAlternativo: "OEM",
            },
          },
          {
            tenantId,
            sku: "TONER-RICOH-C5100-Y",
            nombreVariante: "Tóner amarillo",
            activo: true,
            precioReferencia: "21250",
            moneda: "ARS",
            atributosVarianteJson: {
              color: "Amarillo",
              canal: "amarillo",
              rendimientoPaginasIso: 16000,
              equipoCompatible: "Ricoh PRO C5100",
              presentacion: "Cartucho",
              oemOAlternativo: "OEM",
            },
          },
          {
            tenantId,
            sku: "TONER-RICOH-C5100-K",
            nombreVariante: "Tóner negro",
            activo: true,
            precioReferencia: "21250",
            moneda: "ARS",
            atributosVarianteJson: {
              color: "Negro",
              canal: "negro",
              rendimientoPaginasIso: 16000,
              equipoCompatible: "Ricoh PRO C5100",
              presentacion: "Cartucho",
              oemOAlternativo: "OEM",
            },
          },
        ],
      },
    },
  });

  const tintaLatexRoland = await prisma.materiaPrima.create({
    data: {
      tenantId,
      codigo: "TINTA-LATEX-ROLAND",
      nombre: "Tinta látex Roland VG3",
      descripcion: "Tinta látex para Roland TrueVIS VG3",
      familia: FamiliaMateriaPrima.TINTA_COLORANTE,
      subfamilia: SubfamiliaMateriaPrima.TINTA_IMPRESION,
      tipoTecnico: "tinta_latex",
      templateId: "tinta_impresion_v1",
      unidadStock: UnidadMateriaPrima.UNIDAD,
      unidadCompra: UnidadMateriaPrima.UNIDAD,
      esConsumible: true,
      activo: true,
      atributosTecnicosJson: { tecnologia: "latex", colores: "CMYK" },
      variantes: {
        create: [
          {
            tenantId,
            sku: "TINTA-LATEX-ROLAND-C",
            nombreVariante: "Tinta látex cian 500ml",
            activo: true,
            precioReferencia: "45000",
            moneda: "ARS",
            atributosVarianteJson: {
              tecnologiaCompatible: "impresora_gran_formato_por_area",
              color: "Cian",
              canal: "cian",
              volumenPresentacion: 500,
              volumenMl: 500,
              equipoCompatible: "Roland TrueVIS VG3",
            },
          },
          {
            tenantId,
            sku: "TINTA-LATEX-ROLAND-M",
            nombreVariante: "Tinta látex magenta 500ml",
            activo: true,
            precioReferencia: "45000",
            moneda: "ARS",
            atributosVarianteJson: {
              tecnologiaCompatible: "impresora_gran_formato_por_area",
              color: "Magenta",
              canal: "magenta",
              volumenPresentacion: 500,
              volumenMl: 500,
              equipoCompatible: "Roland TrueVIS VG3",
            },
          },
          {
            tenantId,
            sku: "TINTA-LATEX-ROLAND-Y",
            nombreVariante: "Tinta látex amarillo 500ml",
            activo: true,
            precioReferencia: "45000",
            moneda: "ARS",
            atributosVarianteJson: {
              tecnologiaCompatible: "impresora_gran_formato_por_area",
              color: "Amarillo",
              canal: "amarillo",
              volumenPresentacion: 500,
              volumenMl: 500,
              equipoCompatible: "Roland TrueVIS VG3",
            },
          },
          {
            tenantId,
            sku: "TINTA-LATEX-ROLAND-K",
            nombreVariante: "Tinta látex negro 500ml",
            activo: true,
            precioReferencia: "45000",
            moneda: "ARS",
            atributosVarianteJson: {
              tecnologiaCompatible: "impresora_gran_formato_por_area",
              color: "Negro",
              canal: "negro",
              volumenPresentacion: 500,
              volumenMl: 500,
              equipoCompatible: "Roland TrueVIS VG3",
            },
          },
        ],
      },
    },
  });

  const tintaUVMimaki = await prisma.materiaPrima.create({
    data: {
      tenantId,
      codigo: "TINTA-UV-MIMAKI",
      nombre: "Tinta UV Mimaki UJF",
      descripcion: "Tinta UV para Mimaki UJF-7151",
      familia: FamiliaMateriaPrima.TINTA_COLORANTE,
      subfamilia: SubfamiliaMateriaPrima.TINTA_IMPRESION,
      tipoTecnico: "tinta_uv",
      templateId: "tinta_impresion_v1",
      unidadStock: UnidadMateriaPrima.UNIDAD,
      unidadCompra: UnidadMateriaPrima.UNIDAD,
      esConsumible: true,
      activo: true,
      atributosTecnicosJson: { tecnologia: "uv", colores: "CMYK+W+Barniz" },
      variantes: {
        create: [
          {
            tenantId,
            sku: "TINTA-UV-MIMAKI-C",
            nombreVariante: "Tinta UV cian 600ml",
            activo: true,
            precioReferencia: "65000",
            moneda: "ARS",
            atributosVarianteJson: {
              tecnologiaCompatible: "impresora_gran_formato_por_area",
              color: "Cian",
              canal: "cian",
              volumenPresentacion: 600,
              volumenMl: 600,
              equipoCompatible: "Mimaki UJF-7151",
            },
          },
          {
            tenantId,
            sku: "TINTA-UV-MIMAKI-M",
            nombreVariante: "Tinta UV magenta 600ml",
            activo: true,
            precioReferencia: "65000",
            moneda: "ARS",
            atributosVarianteJson: {
              tecnologiaCompatible: "impresora_gran_formato_por_area",
              color: "Magenta",
              canal: "magenta",
              volumenPresentacion: 600,
              volumenMl: 600,
              equipoCompatible: "Mimaki UJF-7151",
            },
          },
          {
            tenantId,
            sku: "TINTA-UV-MIMAKI-Y",
            nombreVariante: "Tinta UV amarillo 600ml",
            activo: true,
            precioReferencia: "65000",
            moneda: "ARS",
            atributosVarianteJson: {
              tecnologiaCompatible: "impresora_gran_formato_por_area",
              color: "Amarillo",
              canal: "amarillo",
              volumenPresentacion: 600,
              volumenMl: 600,
              equipoCompatible: "Mimaki UJF-7151",
            },
          },
          {
            tenantId,
            sku: "TINTA-UV-MIMAKI-K",
            nombreVariante: "Tinta UV negro 600ml",
            activo: true,
            precioReferencia: "65000",
            moneda: "ARS",
            atributosVarianteJson: {
              tecnologiaCompatible: "impresora_gran_formato_por_area",
              color: "Negro",
              canal: "negro",
              volumenPresentacion: 600,
              volumenMl: 600,
              equipoCompatible: "Mimaki UJF-7151",
            },
          },
          {
            tenantId,
            sku: "TINTA-UV-MIMAKI-W",
            nombreVariante: "Tinta UV blanco 600ml",
            activo: true,
            precioReferencia: "65000",
            moneda: "ARS",
            atributosVarianteJson: {
              tecnologiaCompatible: "impresora_gran_formato_por_area",
              color: "Blanco",
              canal: "blanco",
              volumenPresentacion: 600,
              volumenMl: 600,
              equipoCompatible: "Mimaki UJF-7151",
            },
          },
          {
            tenantId,
            sku: "TINTA-UV-MIMAKI-V",
            nombreVariante: "Barniz UV 600ml",
            activo: true,
            precioReferencia: "65000",
            moneda: "ARS",
            atributosVarianteJson: {
              tecnologiaCompatible: "impresora_gran_formato_por_area",
              color: "Barniz",
              canal: "barniz",
              volumenPresentacion: 600,
              volumenMl: 600,
              equipoCompatible: "Mimaki UJF-7151",
            },
          },
        ],
      },
    },
  });

  console.info(`✅ Materiales: 11 materias primas + variantes creadas.`);

  return {
    opalina,
    papelCB,
    papelCFB,
    viniloBlanco,
    mdf,
    filmBoppMate,
    filmBoppBrillo,
    bolsa,
    tintaCMYKRicoh,
    tintaLatexRoland,
    tintaUVMimaki,
  };
}

module.exports = { seedMateriales };
