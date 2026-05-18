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
    variantes: [
      v("ACR-CR-3", "2050 × 3050 mm", 2.05, 3.05, 3, "Cristal", true),
      v("ACR-CR-5", "2050 × 3050 mm", 2.05, 3.05, 5, "Cristal", true),
      v("ACR-CR-10", "2050 × 3050 mm", 2.05, 3.05, 10, "Cristal", false),
      v("ACR-OP-3", "2050 × 3050 mm", 2.05, 3.05, 3, "Opal", true),
      v("ACR-OP-5", "2050 × 3050 mm", 2.05, 3.05, 5, "Opal", true),
      v("ACR-NG-3", "2050 × 3050 mm", 2.05, 3.05, 3, "Negro", false),
    ],
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
];

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

async function seedMaterialPresets(prisma) {
  for (const [presetIndex, preset] of presets.entries()) {
    await prisma.materialPreset.create({
      data: {
        key: preset.key,
        nombreCanonico: preset.nombreCanonico,
        descripcionCorta: preset.descripcionCorta,
        familia: FamiliaMateriaPrima.SUSTRATO,
        subfamilia: SubfamiliaMateriaPrima.SUSTRATO_RIGIDO,
        tipoTecnico: "sustrato_rigido",
        templateId: "sustrato_rigido_v1",
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
