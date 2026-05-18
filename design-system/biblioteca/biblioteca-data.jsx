// Biblioteca de materias primas — catálogo canónico + estado de instalación del tenant.

const FAMILIES = {
  sustrato_rigido:   { nm: "Sustrato rígido",   key: "sustrato_rigido",   parent: "sustrato" },
  sustrato_flexible: { nm: "Sustrato flexible", key: "sustrato_flexible", parent: "sustrato" },
  vinilo:            { nm: "Vinilo autoadhesivo", key: "vinilo",          parent: "vinilo" },
  laminado:          { nm: "Laminado",          key: "laminado",          parent: "terminacion" },
  tinta:             { nm: "Tinta",             key: "tinta",             parent: "tinta" },
};

const USES = {
  impresion_directa_uv: { nm: "Impresión UV",          code: "UV" },
  ploteo_vinilo:        { nm: "Aplicación de vinilo",  code: "Vinilo" },
  router_cnc:           { nm: "Router CNC",            code: "CNC" },
  corte_laser:          { nm: "Corte láser",           code: "Láser" },
  corte_digital:        { nm: "Corte digital",         code: "Corte" },
  letras_corporeas:     { nm: "Letras corpóreas",      code: "Corpóreas" },
  pop_signage:          { nm: "POP / Señalética",      code: "Señalética" },
  cajas_luz:            { nm: "Cajas de luz",          code: "Cajas luz" },
};

const CATALOG = [
  {
    canonicalKey: "PVC_ESPUMADO",
    nombreCanonico: "PVC espumado",
    descripcionCorta: "Placa rígida liviana para señalética, POP, letras corpóreas y comunicación visual.",
    familia: "sustrato",
    subfamilia: "sustrato_rigido",
    templateId: "sustrato_rigido_v1",
    iconKind: "foam",
    aliasDisponibles: ["PVC espumado", "Trovicel", "Sintra", "Forex", "PVC expandido", "Foam PVC"],
    usosRecomendados: ["impresion_directa_uv", "ploteo_vinilo", "router_cnc", "letras_corporeas", "pop_signage"],
    procesosCompatibles: ["impresion_directa_uv", "ploteo_vinilo", "router_cnc", "corte_digital"],
    advertencias: ["No recomendado para corte láser por gases tóxicos."],
    variantes: [
      { sku: "PVC-1220-3-B",  formato: "1220 × 2440 mm", espesor: 3,  color: "Blanco", recomendada: true,  instalada: true  },
      { sku: "PVC-1220-5-B",  formato: "1220 × 2440 mm", espesor: 5,  color: "Blanco", recomendada: true,  instalada: true  },
      { sku: "PVC-1220-10-B", formato: "1220 × 2440 mm", espesor: 10, color: "Blanco", recomendada: true,  instalada: true  },
      { sku: "PVC-1220-15-B", formato: "1220 × 2440 mm", espesor: 15, color: "Blanco", recomendada: false, instalada: false },
      { sku: "PVC-1220-3-N",  formato: "1220 × 2440 mm", espesor: 3,  color: "Negro",  recomendada: true,  instalada: false },
      { sku: "PVC-1220-5-N",  formato: "1220 × 2440 mm", espesor: 5,  color: "Negro",  recomendada: false, instalada: false },
      { sku: "PVC-1500-5-B",  formato: "1500 × 3000 mm", espesor: 5,  color: "Blanco", recomendada: false, instalada: false },
      { sku: "PVC-1500-10-B", formato: "1500 × 3000 mm", espesor: 10, color: "Blanco", recomendada: false, instalada: false },
    ],
    installState: { status: "partial", visibleName: "Trovicel", installedCount: 3, totalSuggested: 8 }
  },
  {
    canonicalKey: "MDF",
    nombreCanonico: "MDF",
    descripcionCorta: "Tablero de fibras de densidad media, ideal para corpóreas con cuerpo, pintado y aplicaciones de mayor espesor.",
    familia: "sustrato",
    subfamilia: "sustrato_rigido",
    templateId: "sustrato_rigido_v1",
    iconKind: "wood",
    aliasDisponibles: ["MDF", "Fibrofácil", "Tablero MDF"],
    usosRecomendados: ["router_cnc", "corte_laser", "letras_corporeas"],
    procesosCompatibles: ["router_cnc", "corte_laser"],
    advertencias: [],
    variantes: [
      { sku: "MDF-1830-3",   formato: "1830 × 2600 mm", espesor: 3,   color: "Natural", recomendada: true,  instalada: false },
      { sku: "MDF-1830-5.5", formato: "1830 × 2600 mm", espesor: 5.5, color: "Natural", recomendada: true,  instalada: false },
      { sku: "MDF-1830-9",   formato: "1830 × 2600 mm", espesor: 9,   color: "Natural", recomendada: true,  instalada: false },
      { sku: "MDF-1830-12",  formato: "1830 × 2600 mm", espesor: 12,  color: "Natural", recomendada: true,  instalada: false },
      { sku: "MDF-1830-18",  formato: "1830 × 2600 mm", espesor: 18,  color: "Natural", recomendada: false, instalada: false },
      { sku: "MDF-1830-25",  formato: "1830 × 2600 mm", espesor: 25,  color: "Natural", recomendada: false, instalada: false },
    ],
    installState: { status: "not-installed" }
  },
  {
    canonicalKey: "ACM",
    nombreCanonico: "Aluminio compuesto (ACM)",
    descripcionCorta: "Panel sándwich con núcleo de polietileno entre dos láminas de aluminio. Rigidez y peso óptimos para exterior.",
    familia: "sustrato",
    subfamilia: "sustrato_rigido",
    templateId: "sustrato_rigido_v1",
    iconKind: "layered",
    aliasDisponibles: ["ACM", "Aluminio compuesto", "Alucobond", "Dibond", "Reynobond"],
    usosRecomendados: ["impresion_directa_uv", "ploteo_vinilo", "router_cnc", "pop_signage"],
    procesosCompatibles: ["impresion_directa_uv", "ploteo_vinilo", "router_cnc", "corte_digital"],
    advertencias: ["No recomendado para corte láser."],
    variantes: [
      { sku: "ACM-1220-3-B", formato: "1220 × 2440 mm", espesor: 3, color: "Blanco", recomendada: true,  instalada: true  },
      { sku: "ACM-1220-4-B", formato: "1220 × 2440 mm", espesor: 4, color: "Blanco", recomendada: true,  instalada: true  },
      { sku: "ACM-1500-4-B", formato: "1500 × 3000 mm", espesor: 4, color: "Blanco", recomendada: false, instalada: false },
      { sku: "ACM-1220-4-N", formato: "1220 × 2440 mm", espesor: 4, color: "Negro",  recomendada: false, instalada: false },
      { sku: "ACM-1220-4-S", formato: "1220 × 2440 mm", espesor: 4, color: "Plata cepillado", recomendada: false, instalada: false },
    ],
    installState: { status: "partial", visibleName: "Dibond", installedCount: 2, totalSuggested: 5 }
  },
  {
    canonicalKey: "ACRILICO",
    nombreCanonico: "Acrílico (PMMA)",
    descripcionCorta: "Polimetilmetacrilato. Cristal y opal para frentes de letras, cajas de luz y display premium.",
    familia: "sustrato",
    subfamilia: "sustrato_rigido",
    templateId: "sustrato_rigido_v1",
    iconKind: "transparent",
    aliasDisponibles: ["Acrílico", "PMMA", "Plexiglas", "Perspex", "Metacrilato"],
    usosRecomendados: ["corte_laser", "router_cnc", "letras_corporeas", "cajas_luz", "pop_signage"],
    procesosCompatibles: ["corte_laser", "router_cnc", "corte_digital"],
    advertencias: [],
    variantes: [
      { sku: "ACR-CR-3",  formato: "2050 × 3050 mm", espesor: 3,  color: "Cristal", recomendada: true,  instalada: true  },
      { sku: "ACR-CR-5",  formato: "2050 × 3050 mm", espesor: 5,  color: "Cristal", recomendada: true,  instalada: false },
      { sku: "ACR-CR-10", formato: "2050 × 3050 mm", espesor: 10, color: "Cristal", recomendada: false, instalada: false },
      { sku: "ACR-OP-3",  formato: "2050 × 3050 mm", espesor: 3,  color: "Opal",    recomendada: true,  instalada: false },
      { sku: "ACR-OP-5",  formato: "2050 × 3050 mm", espesor: 5,  color: "Opal",    recomendada: true,  instalada: false },
      { sku: "ACR-NG-3",  formato: "2050 × 3050 mm", espesor: 3,  color: "Negro",   recomendada: false, instalada: false },
    ],
    installState: { status: "partial", visibleName: "Plexiglas", installedCount: 1, totalSuggested: 6 }
  },
  {
    canonicalKey: "PP_CORRUGADO",
    nombreCanonico: "Polipropileno corrugado",
    descripcionCorta: "Plancha plástica con estructura corrugada interior. Económica, resistente al agua, ideal para POP temporal.",
    familia: "sustrato",
    subfamilia: "sustrato_rigido",
    templateId: "sustrato_rigido_v1",
    iconKind: "corrugated",
    aliasDisponibles: ["Polipropileno corrugado", "Coroplast", "PP alveolar", "Correx"],
    usosRecomendados: ["impresion_directa_uv", "ploteo_vinilo", "corte_digital", "pop_signage"],
    procesosCompatibles: ["impresion_directa_uv", "ploteo_vinilo", "corte_digital"],
    advertencias: [],
    variantes: [
      { sku: "PP-1200-4-B",  formato: "1200 × 2400 mm", espesor: 4,  color: "Blanco", recomendada: true,  instalada: false },
      { sku: "PP-1200-6-B",  formato: "1200 × 2400 mm", espesor: 6,  color: "Blanco", recomendada: true,  instalada: false },
      { sku: "PP-1200-10-B", formato: "1200 × 2400 mm", espesor: 10, color: "Blanco", recomendada: false, instalada: false },
    ],
    installState: { status: "not-installed" }
  },
  {
    canonicalKey: "FOAMBOARD",
    nombreCanonico: "Foamboard",
    descripcionCorta: "Sándwich de espuma con cartón en ambas caras. Liviano, ideal para fotos montadas, kakemonos y POP de corta duración.",
    familia: "sustrato",
    subfamilia: "sustrato_rigido",
    templateId: "sustrato_rigido_v1",
    iconKind: "sandwich",
    aliasDisponibles: ["Foamboard", "Foam-X", "Kapa", "Cartón pluma denso"],
    usosRecomendados: ["impresion_directa_uv", "ploteo_vinilo", "corte_digital", "pop_signage"],
    procesosCompatibles: ["impresion_directa_uv", "ploteo_vinilo", "corte_digital"],
    advertencias: ["No apto para exterior prolongado."],
    variantes: [
      { sku: "FB-1000-3-B", formato: "1000 × 1400 mm", espesor: 3, color: "Blanco", recomendada: true,  instalada: false },
      { sku: "FB-1000-5-B", formato: "1000 × 1400 mm", espesor: 5, color: "Blanco", recomendada: true,  instalada: false },
      { sku: "FB-1500-5-B", formato: "1500 × 3050 mm", espesor: 5, color: "Blanco", recomendada: false, instalada: false },
    ],
    installState: { status: "not-installed" }
  },
  {
    canonicalKey: "CARTON_PLUMA",
    nombreCanonico: "Cartón pluma",
    descripcionCorta: "Cartón con núcleo de poliestireno expandido. Súper liviano para maquetas, paneles de presentación y display interno.",
    familia: "sustrato",
    subfamilia: "sustrato_rigido",
    templateId: "sustrato_rigido_v1",
    iconKind: "sandwich",
    aliasDisponibles: ["Cartón pluma", "Espumadex", "Espuma poliestireno", "Gatorboard"],
    usosRecomendados: ["impresion_directa_uv", "corte_digital", "pop_signage"],
    procesosCompatibles: ["impresion_directa_uv", "corte_digital"],
    advertencias: ["Frágil al canto. Manipular con cuidado."],
    variantes: [
      { sku: "CP-700-5",  formato: "700 × 1000 mm",  espesor: 5,  color: "Blanco", recomendada: true,  instalada: false },
      { sku: "CP-700-10", formato: "700 × 1000 mm",  espesor: 10, color: "Blanco", recomendada: true,  instalada: false },
      { sku: "CP-1000-5", formato: "1000 × 1400 mm", espesor: 5,  color: "Blanco", recomendada: false, instalada: false },
    ],
    installState: { status: "not-installed" }
  },
  {
    canonicalKey: "COMP_FENOLICO",
    nombreCanonico: "Compensado fenólico",
    descripcionCorta: "Multilaminado de madera con cola fenólica resistente a la intemperie. Estructural para señalética exterior pesada.",
    familia: "sustrato",
    subfamilia: "sustrato_rigido",
    templateId: "sustrato_rigido_v1",
    iconKind: "layered",
    aliasDisponibles: ["Compensado fenólico", "Multilaminado fenólico", "Plywood marino"],
    usosRecomendados: ["router_cnc", "letras_corporeas"],
    procesosCompatibles: ["router_cnc"],
    advertencias: [],
    variantes: [
      { sku: "CF-1830-9",  formato: "1830 × 2600 mm", espesor: 9,  color: "Natural", recomendada: true,  instalada: false },
      { sku: "CF-1830-12", formato: "1830 × 2600 mm", espesor: 12, color: "Natural", recomendada: true,  instalada: false },
      { sku: "CF-1830-18", formato: "1830 × 2600 mm", espesor: 18, color: "Natural", recomendada: false, instalada: false },
    ],
    installState: { status: "not-installed" }
  },
];

// Helpers
function getCatalogItem(key) { return CATALOG.find(c => c.canonicalKey === key); }
function installedCountFor(item) {
  if (!item.installState || item.installState.status === "not-installed") return 0;
  return item.installState.installedCount || 0;
}
function statusLabel(state) {
  if (!state || state.status === "not-installed") return "No instalado";
  if (state.status === "installed") return "Instalado";
  if (state.status === "partial") return `Parcial · ${state.installedCount}/${state.totalSuggested}`;
  return "—";
}

Object.assign(window, { CATALOG, FAMILIES, USES, getCatalogItem, installedCountFor, statusLabel });
