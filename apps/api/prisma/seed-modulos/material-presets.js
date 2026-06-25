const {
  FamiliaMateriaPrima,
  SubfamiliaMateriaPrima,
  UnidadMateriaPrima,
} = require("@prisma/client");

const presets = [
  {
    key: "PVC_ESPUMADO",
    nombreCanonico: "PVC espumado",
    descripcionCorta:
      "Placa rígida liviana para señalética, POP, letras corpóreas y comunicación visual.",
    iconKind: "foam",
    aliasDisponibles: [
      "PVC espumado",
      "Trovicel",
      "Sintra",
      "Forex",
      "PVC expandido",
      "Foam PVC",
    ],
    usosRecomendados: [
      "impresion_directa_uv",
      "ploteo_vinilo",
      "router_cnc",
      "letras_corporeas",
      "pop_signage",
    ],
    procesosCompatibles: [
      "impresion_directa_uv",
      "ploteo_vinilo",
      "router_cnc",
      "corte_digital",
    ],
    advertencias: ["No recomendado para corte láser por gases tóxicos."],
    variantes: [
      v("PVC-1220-3-B", "1220 × 2440 mm", 1.22, 2.44, 3, "Blanco", true),
      v("PVC-1220-5-B", "1220 × 2440 mm", 1.22, 2.44, 5, "Blanco", true),
      v("PVC-1220-10-B", "1220 × 2440 mm", 1.22, 2.44, 10, "Blanco", true),
      v("PVC-1220-15-B", "1220 × 2440 mm", 1.22, 2.44, 15, "Blanco", false),
      v("PVC-1220-3-N", "1220 × 2440 mm", 1.22, 2.44, 3, "Negro", true),
      v("PVC-1220-5-N", "1220 × 2440 mm", 1.22, 2.44, 5, "Negro", false),
      v("PVC-1500-5-B", "1500 × 3000 mm", 1.5, 3, 5, "Blanco", false),
      v("PVC-1500-10-B", "1500 × 3000 mm", 1.5, 3, 10, "Blanco", false),
    ],
  },
  {
    key: "MDF",
    nombreCanonico: "MDF",
    descripcionCorta:
      "Tablero de fibras de densidad media, ideal para corpóreas con cuerpo, pintado y aplicaciones de mayor espesor.",
    iconKind: "wood",
    aliasDisponibles: ["MDF", "Fibrofácil", "Tablero MDF"],
    usosRecomendados: ["router_cnc", "corte_laser", "letras_corporeas"],
    procesosCompatibles: ["router_cnc", "corte_laser"],
    advertencias: [],
    variantes: [
      v("MDF-1830-3", "1830 × 2600 mm", 1.83, 2.6, 3, "Natural", true),
      v("MDF-1830-5.5", "1830 × 2600 mm", 1.83, 2.6, 5.5, "Natural", true),
      v("MDF-1830-9", "1830 × 2600 mm", 1.83, 2.6, 9, "Natural", true),
      v("MDF-1830-12", "1830 × 2600 mm", 1.83, 2.6, 12, "Natural", true),
      v("MDF-1830-18", "1830 × 2600 mm", 1.83, 2.6, 18, "Natural", false),
      v("MDF-1830-25", "1830 × 2600 mm", 1.83, 2.6, 25, "Natural", false),
    ],
  },
  {
    key: "ACM",
    nombreCanonico: "Aluminio compuesto (ACM)",
    descripcionCorta:
      "Panel sándwich con núcleo de polietileno entre dos láminas de aluminio. Rigidez y peso óptimos para exterior.",
    iconKind: "layered",
    aliasDisponibles: [
      "ACM",
      "Aluminio compuesto",
      "Alucobond",
      "Dibond",
      "Reynobond",
    ],
    usosRecomendados: [
      "impresion_directa_uv",
      "ploteo_vinilo",
      "router_cnc",
      "pop_signage",
    ],
    procesosCompatibles: [
      "impresion_directa_uv",
      "ploteo_vinilo",
      "router_cnc",
      "corte_digital",
    ],
    advertencias: ["No recomendado para corte láser."],
    variantes: [
      v("ACM-1220-3-B", "1220 × 2440 mm", 1.22, 2.44, 3, "Blanco", true),
      v("ACM-1220-4-B", "1220 × 2440 mm", 1.22, 2.44, 4, "Blanco", true),
      v("ACM-1500-4-B", "1500 × 3000 mm", 1.5, 3, 4, "Blanco", false),
      v("ACM-1220-4-N", "1220 × 2440 mm", 1.22, 2.44, 4, "Negro", false),
      v("ACM-1220-4-S", "1220 × 2440 mm", 1.22, 2.44, 4, "Plata cepillado", false),
    ],
  },
  {
    key: "ACRILICO",
    nombreCanonico: "Acrílico (PMMA)",
    descripcionCorta:
      "Polimetilmetacrilato. Cristal y opal para frentes de letras, cajas de luz y display premium.",
    iconKind: "transparent",
    aliasDisponibles: ["Acrílico", "PMMA", "Plexiglas", "Perspex", "Metacrilato"],
    usosRecomendados: [
      "corte_laser",
      "router_cnc",
      "letras_corporeas",
      "cajas_luz",
      "pop_signage",
    ],
    procesosCompatibles: ["corte_laser", "router_cnc", "corte_digital"],
    advertencias: [],
    variantes: acrilicoVariants(),
  },
  {
    key: "PP_CORRUGADO",
    nombreCanonico: "Polipropileno corrugado",
    descripcionCorta:
      "Plancha plástica con estructura corrugada interior. Económica, resistente al agua, ideal para POP temporal.",
    iconKind: "corrugated",
    aliasDisponibles: ["Polipropileno corrugado", "Coroplast", "PP alveolar", "Correx"],
    usosRecomendados: [
      "impresion_directa_uv",
      "ploteo_vinilo",
      "corte_digital",
      "pop_signage",
    ],
    procesosCompatibles: ["impresion_directa_uv", "ploteo_vinilo", "corte_digital"],
    advertencias: [],
    variantes: [
      v("PP-1200-4-B", "1200 × 2400 mm", 1.2, 2.4, 4, "Blanco", true),
      v("PP-1200-6-B", "1200 × 2400 mm", 1.2, 2.4, 6, "Blanco", true),
      v("PP-1200-10-B", "1200 × 2400 mm", 1.2, 2.4, 10, "Blanco", false),
    ],
  },
  {
    key: "FOAMBOARD",
    nombreCanonico: "Foamboard",
    descripcionCorta:
      "Sándwich de espuma con cartón en ambas caras. Liviano, ideal para fotos montadas y POP de corta duración.",
    iconKind: "sandwich",
    aliasDisponibles: ["Foamboard", "Foam-X", "Kapa", "Cartón pluma denso"],
    usosRecomendados: [
      "impresion_directa_uv",
      "ploteo_vinilo",
      "corte_digital",
      "pop_signage",
    ],
    procesosCompatibles: ["impresion_directa_uv", "ploteo_vinilo", "corte_digital"],
    advertencias: ["No apto para exterior prolongado."],
    variantes: [
      v("FB-1000-3-B", "1000 × 1400 mm", 1, 1.4, 3, "Blanco", true),
      v("FB-1000-5-B", "1000 × 1400 mm", 1, 1.4, 5, "Blanco", true),
      v("FB-1500-5-B", "1500 × 3050 mm", 1.5, 3.05, 5, "Blanco", false),
    ],
  },
  {
    key: "CARTON_PLUMA",
    nombreCanonico: "Cartón pluma",
    descripcionCorta:
      "Cartón con núcleo de poliestireno expandido. Súper liviano para maquetas, paneles de presentación y display interno.",
    iconKind: "sandwich",
    aliasDisponibles: ["Cartón pluma", "Espumadex", "Espuma poliestireno", "Gatorboard"],
    usosRecomendados: ["impresion_directa_uv", "corte_digital", "pop_signage"],
    procesosCompatibles: ["impresion_directa_uv", "corte_digital"],
    advertencias: ["Frágil al canto. Manipular con cuidado."],
    variantes: [
      v("CP-700-5", "700 × 1000 mm", 0.7, 1, 5, "Blanco", true),
      v("CP-700-10", "700 × 1000 mm", 0.7, 1, 10, "Blanco", true),
      v("CP-1000-5", "1000 × 1400 mm", 1, 1.4, 5, "Blanco", false),
    ],
  },
  {
    key: "COMP_FENOLICO",
    nombreCanonico: "Compensado fenólico",
    descripcionCorta:
      "Multilaminado de madera con cola fenólica resistente a la intemperie. Estructural para señalética exterior pesada.",
    iconKind: "layered",
    aliasDisponibles: ["Compensado fenólico", "Multilaminado fenólico", "Plywood marino"],
    usosRecomendados: ["router_cnc", "letras_corporeas"],
    procesosCompatibles: ["router_cnc"],
    advertencias: [],
    variantes: [
      v("CF-1830-9", "1830 × 2600 mm", 1.83, 2.6, 9, "Natural", true),
      v("CF-1830-12", "1830 × 2600 mm", 1.83, 2.6, 12, "Natural", true),
      v("CF-1830-18", "1830 × 2600 mm", 1.83, 2.6, 18, "Natural", false),
    ],
  },
  {
    key: "PAPEL_OBRA",
    nombreCanonico: "Papel obra",
    descripcionCorta:
      "Papel blanco no estucado para formularios, papelería comercial, interiores y piezas de uso general.",
    iconKind: "paper",
    aliasDisponibles: ["Papel obra", "Bond", "Offset", "Natural", "Book", "Papel blanco"],
    usosRecomendados: ["impresion_offset", "impresion_digital", "papeleria_comercial"],
    procesosCompatibles: ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
    advertencias: [],
    ...sheetPresetMeta("obra"),
    variantes: sheetVariants("OBRA", ["A4", "A3", "SRA3", "65 x 95 cm"], [75, 80, 90, 120], {
      material: "Papel obra",
      color: "Blanco",
      acabado: "Mate",
      recomendadas: new Set(["A4-80", "A3-80", "65 x 95 cm-80", "65 x 95 cm-90"]),
    }),
  },
  {
    key: "PAPEL_OBRA_AHUESADO",
    nombreCanonico: "Papel obra ahuesado",
    descripcionCorta:
      "Papel no estucado color marfil o crema, usado en editorial, libros, agendas y piezas de lectura.",
    iconKind: "paper",
    aliasDisponibles: ["Papel obra ahuesado", "Bookcel", "Bookcell", "Bond ahuesado", "Papel marfil", "Papel crema"],
    usosRecomendados: ["impresion_offset", "impresion_digital", "editorial"],
    procesosCompatibles: ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
    advertencias: [],
    ...sheetPresetMeta("obra_ahuesado"),
    variantes: sheetVariants("OBRA-AH", ["A4", "A3", "65 x 95 cm"], [80, 90], {
      material: "Papel obra ahuesado",
      color: "Marfil",
      acabado: "Mate",
      recomendadas: new Set(["A4-80", "65 x 95 cm-80"]),
    }),
  },
  {
    key: "ILUSTRACION_MATE",
    nombreCanonico: "Papel ilustración mate",
    descripcionCorta:
      "Papel estucado de acabado mate para folletería, tarjetas, catálogos y piezas comerciales.",
    iconKind: "coated",
    aliasDisponibles: ["Papel ilustración mate", "Couché mate", "Couche mate", "Cuché mate", "Estucado mate", "Encapado mate", "Propalcote mate"],
    usosRecomendados: ["impresion_offset", "impresion_digital", "folleteria"],
    procesosCompatibles: ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
    advertencias: [],
    ...sheetPresetMeta("ilustracion_mate"),
    variantes: sheetVariants("ILU-M", ["SRA3", "65 x 95 cm", "72 x 102 cm"], [90, 115, 150, 170, 200, 250, 300, 350], {
      material: "Papel ilustración",
      color: "Blanco",
      acabado: "Mate",
      recomendadas: new Set(["SRA3-150", "65 x 95 cm-115", "65 x 95 cm-150", "65 x 95 cm-300"]),
    }),
  },
  {
    key: "ILUSTRACION_BRILLANTE",
    nombreCanonico: "Papel ilustración brillante",
    descripcionCorta:
      "Papel estucado de acabado brillante para piezas con mayor viveza de color y terminación comercial.",
    iconKind: "coated",
    aliasDisponibles: ["Papel ilustración brillante", "Couché brillante", "Couche brillante", "Cuché brillante", "Estucado brillante", "Esmaltado", "Glossy"],
    usosRecomendados: ["impresion_offset", "impresion_digital", "folleteria"],
    procesosCompatibles: ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
    advertencias: [],
    ...sheetPresetMeta("ilustracion_brillante"),
    variantes: sheetVariants("ILU-B", ["SRA3", "65 x 95 cm", "72 x 102 cm"], [90, 115, 150, 170, 200, 250, 300, 350], {
      material: "Papel ilustración",
      color: "Blanco",
      acabado: "Brillo",
      recomendadas: new Set(["SRA3-150", "65 x 95 cm-115", "65 x 95 cm-150", "65 x 95 cm-300"]),
    }),
  },
  {
    key: "OPALINA",
    nombreCanonico: "Opalina",
    descripcionCorta:
      "Cartulina premium blanca o marfil para tarjetas, invitaciones, certificados y piezas de presentación.",
    iconKind: "paper",
    aliasDisponibles: ["Opalina", "Cartulina opalina", "Opalina blanca", "Opalina marfil", "Cartulina premium"],
    usosRecomendados: ["impresion_digital", "tarjeteria", "papeleria_comercial"],
    procesosCompatibles: ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
    advertencias: [],
    ...sheetPresetMeta("opalina"),
    variantes: sheetVariants("OPA", ["A4", "A3", "SRA3", "50 x 70 cm", "65 x 45 cm"], [180, 200, 220, 250, 300, 350], {
      material: "Opalina",
      color: "Blanco",
      acabado: "Mate",
      recomendadas: new Set(["A4-250", "SRA3-300", "65 x 45 cm-300"]),
    }),
  },
  {
    key: "AUTOCOPIATIVO_CB",
    nombreCanonico: "Papel autocopiativo CB",
    descripcionCorta:
      "Primera hoja de formularios autocopiativos, recubierta al dorso para transferir escritura.",
    iconKind: "copy",
    aliasDisponibles: ["Autocopiativo CB", "Papel químico CB", "NCR CB", "Carbonless CB", "Primera hoja", "Original"],
    usosRecomendados: ["formularios", "talonarios", "impresion_offset"],
    procesosCompatibles: ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
    advertencias: [],
    ...sheetPresetMeta("autocopiativo_cb"),
    variantes: sheetVariants("AUTO-CB", ["22 x 34 cm"], [56, 60], {
      material: "Autocopiativo CB",
      color: "Blanco",
      acabado: "Mate",
      recomendadas: new Set(["22 x 34 cm-56"]),
    }),
  },
  {
    key: "AUTOCOPIATIVO_CFB",
    nombreCanonico: "Papel autocopiativo CFB",
    descripcionCorta:
      "Hoja intermedia de formularios autocopiativos, recubierta en frente y dorso.",
    iconKind: "copy",
    aliasDisponibles: ["Autocopiativo CFB", "Papel químico CFB", "NCR CFB", "Carbonless CFB", "Hoja intermedia", "Duplicado"],
    usosRecomendados: ["formularios", "talonarios", "impresion_offset"],
    procesosCompatibles: ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
    advertencias: [],
    ...sheetPresetMeta("autocopiativo_cfb"),
    variantes: sheetVariants("AUTO-CFB", ["22 x 34 cm"], [56, 60], {
      material: "Autocopiativo CFB",
      color: "Rosa",
      acabado: "Mate",
      recomendadas: new Set(["22 x 34 cm-56"]),
    }),
  },
  {
    key: "AUTOCOPIATIVO_CF",
    nombreCanonico: "Papel autocopiativo CF",
    descripcionCorta:
      "Última hoja de formularios autocopiativos, recubierta en el frente para recibir la copia.",
    iconKind: "copy",
    aliasDisponibles: ["Autocopiativo CF", "Papel químico CF", "NCR CF", "Carbonless CF", "Última hoja", "Triplicado"],
    usosRecomendados: ["formularios", "talonarios", "impresion_offset"],
    procesosCompatibles: ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
    advertencias: [],
    ...sheetPresetMeta("autocopiativo_cf"),
    variantes: sheetVariants("AUTO-CF", ["22 x 34 cm"], [56, 60], {
      material: "Autocopiativo CF",
      color: "Celeste",
      acabado: "Mate",
      recomendadas: new Set(["22 x 34 cm-56"]),
    }),
  },
  {
    key: "ADHESIVO_PAPEL",
    nombreCanonico: "Papel adhesivo",
    descripcionCorta:
      "Papel autoadhesivo en hoja para etiquetas, stickers y calcomanías de uso general.",
    iconKind: "adhesive",
    aliasDisponibles: ["Papel adhesivo", "Autoadhesivo", "Stickers", "Etiquetas", "Calcomanía", "Pegatina", "Papel label"],
    usosRecomendados: ["impresion_digital", "etiquetas", "stickers"],
    procesosCompatibles: ["impresion_por_hoja", "guillotina", "plotter_de_corte"],
    advertencias: ["El gramaje es referencial: puede variar según frontal, adhesivo y liner del proveedor."],
    ...sheetPresetMeta("adhesivo_papel"),
    variantes: [
      ...sheetVariants("ADH-M", ["A4", "SRA3", "65 x 95 cm"], [80, 90], {
        material: "Papel adhesivo",
        color: "Blanco",
        acabado: "Mate",
        recomendadas: new Set(["A4-80", "SRA3-80"]),
      }),
      ...sheetVariants("ADH-B", ["A4", "SRA3", "65 x 95 cm"], [80, 90], {
        material: "Papel adhesivo",
        color: "Blanco",
        acabado: "Brillo",
        recomendadas: new Set(["A4-80", "SRA3-80"]),
      }),
    ],
  },
  {
    key: "KRAFT",
    nombreCanonico: "Papel kraft",
    descripcionCorta:
      "Papel o cartulina kraft color natural para etiquetas, packaging liviano y piezas rústicas.",
    iconKind: "kraft",
    aliasDisponibles: ["Papel kraft", "Cartulina kraft", "Kraft natural", "Kraft marrón", "Papel estraza"],
    usosRecomendados: ["packaging", "etiquetas", "papeleria_comercial"],
    procesosCompatibles: ["impresion_por_hoja", "guillotina", "terminacion_editorial"],
    advertencias: [],
    ...sheetPresetMeta("kraft"),
    variantes: sheetVariants("KRAFT", ["A4", "50 x 70 cm", "65 x 95 cm"], [120, 180, 250, 300], {
      material: "Papel kraft",
      color: "Natural",
      acabado: "Mate",
      recomendadas: new Set(["A4-180", "50 x 70 cm-250"]),
    }),
  },
];

function acrilicoVariants() {
  const formato = "2050 × 3050 mm";
  const ancho = 2.05;
  const alto = 3.05;
  const espesores = [2, 3, 4, 5, 6, 8, 10];
  return [
    ...espesores.map((espesor) =>
      v(`ACR-CR-${espesor}`, formato, ancho, alto, espesor, "Cristal", espesor === 3 || espesor === 5),
    ),
    ...espesores.map((espesor) =>
      v(`ACR-OP-${espesor}`, formato, ancho, alto, espesor, "Opal", espesor === 3 || espesor === 5),
    ),
    ...espesores.map((espesor) =>
      v(`ACR-NG-${espesor}`, formato, ancho, alto, espesor, "Negro", false),
    ),
  ];
}

function v(sku, formato, ancho, alto, espesor, colorBase, recomendada) {
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `${formato} · ${espesor} mm · ${colorBase}`,
    formato,
    espesor,
    color: colorBase,
    recomendada,
    atributosVarianteJson: {
      ancho,
      alto,
      espesor,
      colorBase,
    },
    unidadStock: UnidadMateriaPrima.UNIDAD,
    unidadCompra: UnidadMateriaPrima.UNIDAD,
    precioReferencia: null,
    moneda: "ARS",
  };
}

function sheetPresetMeta(tipoTecnico) {
  return {
    familia: FamiliaMateriaPrima.SUSTRATO,
    subfamilia: SubfamiliaMateriaPrima.SUSTRATO_HOJA,
    tipoTecnico,
    templateId: "sustrato_hoja_v1",
  };
}

function sheetVariants(prefix, formatos, gramajes, options) {
  return formatos.flatMap((formato) =>
    gramajes.map((gramaje) => vh(prefix, formato, gramaje, options)),
  );
}

function vh(prefix, formato, gramaje, options) {
  const size = sheetSizeCm(formato);
  const recomendada = Boolean(options.recomendadas?.has(`${formato}-${gramaje}`));
  const acabadoCode = options.acabado.toUpperCase().startsWith("BR") ? "B" : "M";
  const sku = `${prefix}-${sheetSkuSize(formato)}-${gramaje}-${acabadoCode}`;
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `${formato} · ${gramaje} g/m² · ${options.material} · ${options.acabado}`,
    formato,
    espesor: null,
    color: options.color,
    recomendada,
    atributosVarianteJson: {
      formatoComercial: formato,
      ancho: size.ancho,
      alto: size.alto,
      gramaje,
      material: options.material,
      color: options.color,
      acabado: options.acabado,
      anchoMm: Math.round(size.ancho * 10),
      altoMm: Math.round(size.alto * 10),
      largoMm: Math.round(size.alto * 10),
      gramajeGr: gramaje,
    },
    unidadStock: UnidadMateriaPrima.HOJA,
    unidadCompra: UnidadMateriaPrima.RESMA,
    precioReferencia: null,
    moneda: "ARS",
  };
}

function sheetSizeCm(formato) {
  const sizes = {
    A4: { ancho: 21, alto: 29.7 },
    A3: { ancho: 29.7, alto: 42 },
    SRA3: { ancho: 32, alto: 45 },
    "65 x 95 cm": { ancho: 65, alto: 95 },
    "72 x 102 cm": { ancho: 72, alto: 102 },
    "50 x 70 cm": { ancho: 50, alto: 70 },
    "65 x 45 cm": { ancho: 65, alto: 45 },
    "22 x 34 cm": { ancho: 22, alto: 34 },
  };
  return sizes[formato];
}

function sheetSkuSize(formato) {
  return formato.replaceAll(" ", "").replaceAll("x", "X").replaceAll("cm", "").replaceAll(".", "P");
}

async function seedMaterialPresets(prisma) {
  for (const [presetIndex, preset] of presets.entries()) {
    await prisma.materialPreset.create({
      data: {
        key: preset.key,
        nombreCanonico: preset.nombreCanonico,
        descripcionCorta: preset.descripcionCorta,
        familia: preset.familia ?? FamiliaMateriaPrima.SUSTRATO,
        subfamilia: preset.subfamilia ?? SubfamiliaMateriaPrima.SUSTRATO_RIGIDO,
        tipoTecnico: preset.tipoTecnico ?? "sustrato_rigido",
        templateId: preset.templateId ?? "sustrato_rigido_v1",
        iconKind: preset.iconKind,
        aliasDisponiblesJson: preset.aliasDisponibles,
        usosRecomendadosJson: preset.usosRecomendados,
        procesosCompatiblesJson: preset.procesosCompatibles,
        advertenciasJson: preset.advertencias,
        orden: presetIndex,
        variantes: {
          create: preset.variantes.map((variante, varianteIndex) => ({
            ...variante,
            orden: varianteIndex,
          })),
        },
      },
    });
  }
}

module.exports = { seedMaterialPresets };
