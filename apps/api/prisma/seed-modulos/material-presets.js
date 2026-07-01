const {
  FamiliaMateriaPrima,
  SubfamiliaMateriaPrima,
  UnidadMateriaPrima,
} = require('@prisma/client');

const presets = [
  {
    key: 'PVC_ESPUMADO',
    nombreCanonico: 'PVC espumado',
    descripcionCorta:
      'Placa rígida liviana para señalética, POP, letras corpóreas y comunicación visual.',
    iconKind: 'foam',
    aliasDisponibles: [
      'PVC espumado',
      'Trovicel',
      'Sintra',
      'Forex',
      'PVC expandido',
      'Foam PVC',
    ],
    usosRecomendados: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'router_cnc',
      'letras_corporeas',
      'pop_signage',
    ],
    procesosCompatibles: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'router_cnc',
      'corte_digital',
    ],
    advertencias: ['No recomendado para corte láser por gases tóxicos.'],
    variantes: [
      v('PVC-1220-3-B', '1220 × 2440 mm', 1.22, 2.44, 3, 'Blanco', true),
      v('PVC-1220-5-B', '1220 × 2440 mm', 1.22, 2.44, 5, 'Blanco', true),
      v('PVC-1220-10-B', '1220 × 2440 mm', 1.22, 2.44, 10, 'Blanco', true),
      v('PVC-1220-15-B', '1220 × 2440 mm', 1.22, 2.44, 15, 'Blanco', false),
      v('PVC-1220-3-N', '1220 × 2440 mm', 1.22, 2.44, 3, 'Negro', true),
      v('PVC-1220-5-N', '1220 × 2440 mm', 1.22, 2.44, 5, 'Negro', false),
      v('PVC-1500-5-B', '1500 × 3000 mm', 1.5, 3, 5, 'Blanco', false),
      v('PVC-1500-10-B', '1500 × 3000 mm', 1.5, 3, 10, 'Blanco', false),
    ],
  },
  {
    key: 'MDF',
    nombreCanonico: 'MDF',
    descripcionCorta:
      'Tablero de fibras de densidad media, ideal para corpóreas con cuerpo, pintado y aplicaciones de mayor espesor.',
    iconKind: 'wood',
    aliasDisponibles: ['MDF', 'Fibrofácil', 'Tablero MDF'],
    usosRecomendados: ['router_cnc', 'corte_laser', 'letras_corporeas'],
    procesosCompatibles: ['router_cnc', 'corte_laser'],
    advertencias: [],
    variantes: [
      v('MDF-1830-3', '1830 × 2600 mm', 1.83, 2.6, 3, 'Natural', true),
      v('MDF-1830-5.5', '1830 × 2600 mm', 1.83, 2.6, 5.5, 'Natural', true),
      v('MDF-1830-9', '1830 × 2600 mm', 1.83, 2.6, 9, 'Natural', true),
      v('MDF-1830-12', '1830 × 2600 mm', 1.83, 2.6, 12, 'Natural', true),
      v('MDF-1830-18', '1830 × 2600 mm', 1.83, 2.6, 18, 'Natural', false),
      v('MDF-1830-25', '1830 × 2600 mm', 1.83, 2.6, 25, 'Natural', false),
    ],
  },
  {
    key: 'ACM',
    nombreCanonico: 'Aluminio compuesto (ACM)',
    descripcionCorta:
      'Panel sándwich con núcleo de polietileno entre dos láminas de aluminio. Rigidez y peso óptimos para exterior.',
    iconKind: 'layered',
    aliasDisponibles: [
      'ACM',
      'Aluminio compuesto',
      'Alucobond',
      'Dibond',
      'Reynobond',
    ],
    usosRecomendados: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'router_cnc',
      'pop_signage',
    ],
    procesosCompatibles: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'router_cnc',
      'corte_digital',
    ],
    advertencias: ['No recomendado para corte láser.'],
    variantes: [
      v('ACM-1220-3-B', '1220 × 2440 mm', 1.22, 2.44, 3, 'Blanco', true),
      v('ACM-1220-4-B', '1220 × 2440 mm', 1.22, 2.44, 4, 'Blanco', true),
      v('ACM-1500-4-B', '1500 × 3000 mm', 1.5, 3, 4, 'Blanco', false),
      v('ACM-1220-4-N', '1220 × 2440 mm', 1.22, 2.44, 4, 'Negro', false),
      v(
        'ACM-1220-4-S',
        '1220 × 2440 mm',
        1.22,
        2.44,
        4,
        'Plata cepillado',
        false,
      ),
    ],
  },
  {
    key: 'ACRILICO',
    nombreCanonico: 'Acrílico (PMMA)',
    descripcionCorta:
      'Polimetilmetacrilato. Cristal y opal para frentes de letras, cajas de luz y display premium.',
    iconKind: 'transparent',
    aliasDisponibles: [
      'Acrílico',
      'PMMA',
      'Plexiglas',
      'Perspex',
      'Metacrilato',
    ],
    usosRecomendados: [
      'corte_laser',
      'router_cnc',
      'letras_corporeas',
      'cajas_luz',
      'pop_signage',
    ],
    procesosCompatibles: ['corte_laser', 'router_cnc', 'corte_digital'],
    advertencias: [],
    variantes: acrilicoVariants(),
  },
  {
    key: 'PP_CORRUGADO',
    nombreCanonico: 'Polipropileno corrugado',
    descripcionCorta:
      'Plancha plástica con estructura corrugada interior. Económica, resistente al agua, ideal para POP temporal.',
    iconKind: 'corrugated',
    aliasDisponibles: [
      'Polipropileno corrugado',
      'Coroplast',
      'PP alveolar',
      'Correx',
    ],
    usosRecomendados: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'corte_digital',
      'pop_signage',
    ],
    procesosCompatibles: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'corte_digital',
    ],
    advertencias: [],
    variantes: [
      v('PP-1200-4-B', '1200 × 2400 mm', 1.2, 2.4, 4, 'Blanco', true),
      v('PP-1200-6-B', '1200 × 2400 mm', 1.2, 2.4, 6, 'Blanco', true),
      v('PP-1200-10-B', '1200 × 2400 mm', 1.2, 2.4, 10, 'Blanco', false),
    ],
  },
  {
    key: 'FOAMBOARD',
    nombreCanonico: 'Foamboard',
    descripcionCorta:
      'Sándwich de espuma con cartón en ambas caras. Liviano, ideal para fotos montadas y POP de corta duración.',
    iconKind: 'sandwich',
    aliasDisponibles: ['Foamboard', 'Foam-X', 'Kapa', 'Cartón pluma denso'],
    usosRecomendados: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'corte_digital',
      'pop_signage',
    ],
    procesosCompatibles: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'corte_digital',
    ],
    advertencias: ['No apto para exterior prolongado.'],
    variantes: [
      v('FB-1000-3-B', '1000 × 1400 mm', 1, 1.4, 3, 'Blanco', true),
      v('FB-1000-5-B', '1000 × 1400 mm', 1, 1.4, 5, 'Blanco', true),
      v('FB-1500-5-B', '1500 × 3050 mm', 1.5, 3.05, 5, 'Blanco', false),
    ],
  },
  {
    key: 'CARTON_PLUMA',
    nombreCanonico: 'Cartón pluma',
    descripcionCorta:
      'Cartón con núcleo de poliestireno expandido. Súper liviano para maquetas, paneles de presentación y display interno.',
    iconKind: 'sandwich',
    aliasDisponibles: [
      'Cartón pluma',
      'Espumadex',
      'Espuma poliestireno',
      'Gatorboard',
    ],
    usosRecomendados: ['impresion_directa_uv', 'corte_digital', 'pop_signage'],
    procesosCompatibles: ['impresion_directa_uv', 'corte_digital'],
    advertencias: ['Frágil al canto. Manipular con cuidado.'],
    variantes: [
      v('CP-700-5', '700 × 1000 mm', 0.7, 1, 5, 'Blanco', true),
      v('CP-700-10', '700 × 1000 mm', 0.7, 1, 10, 'Blanco', true),
      v('CP-1000-5', '1000 × 1400 mm', 1, 1.4, 5, 'Blanco', false),
    ],
  },
  {
    key: 'ALTO_IMPACTO_PAI',
    nombreCanonico: 'Alto Impacto (PAI)',
    descripcionCorta:
      'Placa de poliestireno de alto impacto para POP, señalética, exhibidores, termoformado y soporte de gráfica.',
    iconKind: 'plastic',
    aliasDisponibles: [
      'Alto Impacto',
      'PAI',
      'PSAI',
      'HIPS',
      'High Impact Polystyrene',
      'Poliestireno de alto impacto',
      'Poliestireno alto impacto',
      'Placa alto impacto',
      'Plancha PAI',
      'Lámina PAI',
      'Placa PAI',
      'Plástico alto impacto',
    ],
    usosRecomendados: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'corte_digital',
      'pop_signage',
    ],
    procesosCompatibles: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'corte_digital',
      'router_cnc',
    ],
    advertencias: [
      'Validar corte láser con extracción y ficha del proveedor; puede fundir o emitir humos no deseados.',
      'Los colores y acabados disponibles varían mucho por proveedor.',
    ],
    variantes: [
      v('PAI-1000-0.5-B', '1000 × 2000 mm', 1, 2, 0.5, 'Blanco', false),
      v('PAI-1000-1-B', '1000 × 2000 mm', 1, 2, 1, 'Blanco', true),
      v('PAI-1000-1.5-B', '1000 × 2000 mm', 1, 2, 1.5, 'Blanco', true),
      v('PAI-1000-2-B', '1000 × 2000 mm', 1, 2, 2, 'Blanco', true),
      v('PAI-1000-3-B', '1000 × 2000 mm', 1, 2, 3, 'Blanco', false),
      v('PAI-1220-1-B', '1220 × 2440 mm', 1.22, 2.44, 1, 'Blanco', false),
      v('PAI-1220-2-B', '1220 × 2440 mm', 1.22, 2.44, 2, 'Blanco', true),
      v('PAI-1220-3-B', '1220 × 2440 mm', 1.22, 2.44, 3, 'Blanco', true),
    ],
  },
  {
    key: 'COMP_FENOLICO',
    nombreCanonico: 'Compensado fenólico',
    descripcionCorta:
      'Multilaminado de madera con cola fenólica resistente a la intemperie. Estructural para señalética exterior pesada.',
    iconKind: 'layered',
    aliasDisponibles: [
      'Compensado fenólico',
      'Multilaminado fenólico',
      'Plywood marino',
    ],
    usosRecomendados: ['router_cnc', 'letras_corporeas'],
    procesosCompatibles: ['router_cnc'],
    advertencias: [],
    variantes: [
      v('CF-1830-9', '1830 × 2600 mm', 1.83, 2.6, 9, 'Natural', true),
      v('CF-1830-12', '1830 × 2600 mm', 1.83, 2.6, 12, 'Natural', true),
      v('CF-1830-18', '1830 × 2600 mm', 1.83, 2.6, 18, 'Natural', false),
    ],
  },
  {
    key: 'PAPEL_OBRA',
    nombreCanonico: 'Papel obra',
    descripcionCorta:
      'Papel blanco no estucado para formularios, papelería comercial, interiores y piezas de uso general.',
    iconKind: 'paper',
    aliasDisponibles: [
      'Papel obra',
      'Bond',
      'Offset',
      'Natural',
      'Book',
      'Papel blanco',
    ],
    usosRecomendados: [
      'impresion_offset',
      'impresion_digital',
      'papeleria_comercial',
    ],
    procesosCompatibles: [
      'impresion_por_hoja',
      'guillotina',
      'terminacion_editorial',
    ],
    advertencias: [],
    ...sheetPresetMeta('obra'),
    variantes: sheetVariants(
      'OBRA',
      ['A4', 'A3', 'SRA3', '65 x 95 cm'],
      [75, 80, 90, 120],
      {
        material: 'Papel obra',
        color: 'Blanco',
        acabado: 'Mate',
        recomendadas: new Set([
          'A4-80',
          'A3-80',
          '65 x 95 cm-80',
          '65 x 95 cm-90',
        ]),
      },
    ),
  },
  {
    key: 'PAPEL_OBRA_AHUESADO',
    nombreCanonico: 'Papel obra ahuesado',
    descripcionCorta:
      'Papel no estucado color marfil o crema, usado en editorial, libros, agendas y piezas de lectura.',
    iconKind: 'paper',
    aliasDisponibles: [
      'Papel obra ahuesado',
      'Bookcel',
      'Bookcell',
      'Bond ahuesado',
      'Papel marfil',
      'Papel crema',
    ],
    usosRecomendados: ['impresion_offset', 'impresion_digital', 'editorial'],
    procesosCompatibles: [
      'impresion_por_hoja',
      'guillotina',
      'terminacion_editorial',
    ],
    advertencias: [],
    ...sheetPresetMeta('obra_ahuesado'),
    variantes: sheetVariants('OBRA-AH', ['A4', 'A3', '65 x 95 cm'], [80, 90], {
      material: 'Papel obra ahuesado',
      color: 'Marfil',
      acabado: 'Mate',
      recomendadas: new Set(['A4-80', '65 x 95 cm-80']),
    }),
  },
  {
    key: 'ILUSTRACION_MATE',
    nombreCanonico: 'Papel ilustración mate',
    descripcionCorta:
      'Papel estucado de acabado mate para folletería, tarjetas, catálogos y piezas comerciales.',
    iconKind: 'coated',
    aliasDisponibles: [
      'Papel ilustración mate',
      'Couché mate',
      'Couche mate',
      'Cuché mate',
      'Estucado mate',
      'Encapado mate',
      'Propalcote mate',
    ],
    usosRecomendados: ['impresion_offset', 'impresion_digital', 'folleteria'],
    procesosCompatibles: [
      'impresion_por_hoja',
      'guillotina',
      'terminacion_editorial',
    ],
    advertencias: [],
    ...sheetPresetMeta('ilustracion_mate'),
    variantes: sheetVariants(
      'ILU-M',
      ['SRA3', '65 x 95 cm', '72 x 102 cm'],
      [90, 115, 150, 170, 200, 250, 300, 350],
      {
        material: 'Papel ilustración',
        color: 'Blanco',
        acabado: 'Mate',
        recomendadas: new Set([
          'SRA3-150',
          '65 x 95 cm-115',
          '65 x 95 cm-150',
          '65 x 95 cm-300',
        ]),
      },
    ),
  },
  {
    key: 'ILUSTRACION_BRILLANTE',
    nombreCanonico: 'Papel ilustración brillante',
    descripcionCorta:
      'Papel estucado de acabado brillante para piezas con mayor viveza de color y terminación comercial.',
    iconKind: 'coated',
    aliasDisponibles: [
      'Papel ilustración brillante',
      'Couché brillante',
      'Couche brillante',
      'Cuché brillante',
      'Estucado brillante',
      'Esmaltado',
      'Glossy',
    ],
    usosRecomendados: ['impresion_offset', 'impresion_digital', 'folleteria'],
    procesosCompatibles: [
      'impresion_por_hoja',
      'guillotina',
      'terminacion_editorial',
    ],
    advertencias: [],
    ...sheetPresetMeta('ilustracion_brillante'),
    variantes: sheetVariants(
      'ILU-B',
      ['SRA3', '65 x 95 cm', '72 x 102 cm'],
      [90, 115, 150, 170, 200, 250, 300, 350],
      {
        material: 'Papel ilustración',
        color: 'Blanco',
        acabado: 'Brillo',
        recomendadas: new Set([
          'SRA3-150',
          '65 x 95 cm-115',
          '65 x 95 cm-150',
          '65 x 95 cm-300',
        ]),
      },
    ),
  },
  {
    key: 'OPALINA',
    nombreCanonico: 'Opalina',
    descripcionCorta:
      'Cartulina premium blanca o marfil para tarjetas, invitaciones, certificados y piezas de presentación.',
    iconKind: 'paper',
    aliasDisponibles: [
      'Opalina',
      'Cartulina opalina',
      'Opalina blanca',
      'Opalina marfil',
      'Cartulina premium',
    ],
    usosRecomendados: [
      'impresion_digital',
      'tarjeteria',
      'papeleria_comercial',
    ],
    procesosCompatibles: [
      'impresion_por_hoja',
      'guillotina',
      'terminacion_editorial',
    ],
    advertencias: [],
    ...sheetPresetMeta('opalina'),
    variantes: sheetVariants(
      'OPA',
      ['A4', 'A3', 'SRA3', '50 x 70 cm', '65 x 45 cm'],
      [180, 200, 220, 250, 300, 350],
      {
        material: 'Opalina',
        color: 'Blanco',
        acabado: 'Mate',
        recomendadas: new Set(['A4-250', 'SRA3-300', '65 x 45 cm-300']),
      },
    ),
  },
  {
    key: 'AUTOCOPIATIVO_CB',
    nombreCanonico: 'Papel autocopiativo CB',
    descripcionCorta:
      'Primera hoja de formularios autocopiativos, recubierta al dorso para transferir escritura.',
    iconKind: 'copy',
    aliasDisponibles: [
      'Autocopiativo CB',
      'Papel químico CB',
      'NCR CB',
      'Carbonless CB',
      'Primera hoja',
      'Original',
    ],
    usosRecomendados: ['formularios', 'talonarios', 'impresion_offset'],
    procesosCompatibles: [
      'impresion_por_hoja',
      'guillotina',
      'terminacion_editorial',
    ],
    advertencias: [],
    ...sheetPresetMeta('autocopiativo_cb'),
    variantes: sheetVariants('AUTO-CB', ['22 x 34 cm'], [56, 60], {
      material: 'Autocopiativo CB',
      color: 'Blanco',
      acabado: 'Mate',
      recomendadas: new Set(['22 x 34 cm-56']),
    }),
  },
  {
    key: 'AUTOCOPIATIVO_CFB',
    nombreCanonico: 'Papel autocopiativo CFB',
    descripcionCorta:
      'Hoja intermedia de formularios autocopiativos, recubierta en frente y dorso.',
    iconKind: 'copy',
    aliasDisponibles: [
      'Autocopiativo CFB',
      'Papel químico CFB',
      'NCR CFB',
      'Carbonless CFB',
      'Hoja intermedia',
      'Duplicado',
    ],
    usosRecomendados: ['formularios', 'talonarios', 'impresion_offset'],
    procesosCompatibles: [
      'impresion_por_hoja',
      'guillotina',
      'terminacion_editorial',
    ],
    advertencias: [],
    ...sheetPresetMeta('autocopiativo_cfb'),
    variantes: sheetVariants('AUTO-CFB', ['22 x 34 cm'], [56, 60], {
      material: 'Autocopiativo CFB',
      color: 'Rosa',
      acabado: 'Mate',
      recomendadas: new Set(['22 x 34 cm-56']),
    }),
  },
  {
    key: 'AUTOCOPIATIVO_CF',
    nombreCanonico: 'Papel autocopiativo CF',
    descripcionCorta:
      'Última hoja de formularios autocopiativos, recubierta en el frente para recibir la copia.',
    iconKind: 'copy',
    aliasDisponibles: [
      'Autocopiativo CF',
      'Papel químico CF',
      'NCR CF',
      'Carbonless CF',
      'Última hoja',
      'Triplicado',
    ],
    usosRecomendados: ['formularios', 'talonarios', 'impresion_offset'],
    procesosCompatibles: [
      'impresion_por_hoja',
      'guillotina',
      'terminacion_editorial',
    ],
    advertencias: [],
    ...sheetPresetMeta('autocopiativo_cf'),
    variantes: sheetVariants('AUTO-CF', ['22 x 34 cm'], [56, 60], {
      material: 'Autocopiativo CF',
      color: 'Celeste',
      acabado: 'Mate',
      recomendadas: new Set(['22 x 34 cm-56']),
    }),
  },
  {
    key: 'ADHESIVO_PAPEL',
    nombreCanonico: 'Papel adhesivo',
    descripcionCorta:
      'Papel autoadhesivo en hoja para etiquetas, stickers y calcomanías de uso general.',
    iconKind: 'adhesive',
    aliasDisponibles: [
      'Papel adhesivo',
      'Autoadhesivo',
      'Stickers',
      'Etiquetas',
      'Calcomanía',
      'Pegatina',
      'Papel label',
    ],
    usosRecomendados: ['impresion_digital', 'etiquetas', 'stickers'],
    procesosCompatibles: [
      'impresion_por_hoja',
      'guillotina',
      'plotter_de_corte',
    ],
    advertencias: [
      'El gramaje es referencial: puede variar según frontal, adhesivo y liner del proveedor.',
    ],
    ...sheetPresetMeta('adhesivo_papel'),
    variantes: [
      ...sheetVariants('ADH-M', ['A4', 'SRA3', '65 x 95 cm'], [80, 90], {
        material: 'Papel adhesivo',
        color: 'Blanco',
        acabado: 'Mate',
        recomendadas: new Set(['A4-80', 'SRA3-80']),
      }),
      ...sheetVariants('ADH-B', ['A4', 'SRA3', '65 x 95 cm'], [80, 90], {
        material: 'Papel adhesivo',
        color: 'Blanco',
        acabado: 'Brillo',
        recomendadas: new Set(['A4-80', 'SRA3-80']),
      }),
    ],
  },
  {
    key: 'KRAFT',
    nombreCanonico: 'Papel kraft',
    descripcionCorta:
      'Papel o cartulina kraft color natural para etiquetas, packaging liviano y piezas rústicas.',
    iconKind: 'kraft',
    aliasDisponibles: [
      'Papel kraft',
      'Cartulina kraft',
      'Kraft natural',
      'Kraft marrón',
      'Papel estraza',
    ],
    usosRecomendados: ['packaging', 'etiquetas', 'papeleria_comercial'],
    procesosCompatibles: [
      'impresion_por_hoja',
      'guillotina',
      'terminacion_editorial',
    ],
    advertencias: [],
    ...sheetPresetMeta('kraft'),
    variantes: sheetVariants(
      'KRAFT',
      ['A4', '50 x 70 cm', '65 x 95 cm'],
      [120, 180, 250, 300],
      {
        material: 'Papel kraft',
        color: 'Natural',
        acabado: 'Mate',
        recomendadas: new Set(['A4-180', '50 x 70 cm-250']),
      },
    ),
  },
  {
    key: 'VINILO_ADHESIVO_IMPRIMIBLE_BLANCO',
    nombreCanonico: 'Vinilo adhesivo imprimible blanco',
    descripcionCorta:
      'Vinilo blanco autoadhesivo imprimible para gráfica vehicular liviana, vidrieras, calcos, etiquetas y señalética.',
    iconKind: 'roll',
    aliasDisponibles: [
      'Vinilo adhesivo imprimible blanco',
      'Vinil adhesivo imprimible blanco',
      'Vinilo imprimible',
      'Vinil de impresión',
      'Vinilo autoadhesivo',
      'Vinil autoadhesivo',
      'Vinilo blanco',
      'Sticker vinil',
      'Calcomanía vinílica',
      'Vinilo monomérico',
      'Vinilo calandrado',
    ],
    usosRecomendados: ['stickers', 'etiquetas', 'ploteo_vinilo', 'pop_signage'],
    procesosCompatibles: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'corte_digital',
    ],
    advertencias: ['Validar durabilidad exterior y adhesivo según proveedor.'],
    ...rollPresetMeta('vinilo_adhesivo_imprimible_blanco'),
    variantes: rollVariants('VIN-IMP-BLANCO', [1.06, 1.27, 1.37, 1.52], {
      largo: 50,
      acabado: 'Brillante',
      color: 'Blanco',
      recomendadas: new Set([1.37, 1.52]),
    }),
  },
  {
    key: 'VINILO_ADHESIVO_TRANSPARENTE',
    nombreCanonico: 'Vinilo adhesivo transparente',
    descripcionCorta:
      'Vinilo transparente autoadhesivo para vidrieras, etiquetas transparentes, calcos y aplicaciones decorativas.',
    iconKind: 'film',
    aliasDisponibles: [
      'Vinilo adhesivo transparente',
      'Vinil adhesivo transparente',
      'Vinilo transparente',
      'Vinil transparente',
      'Vinilo cristal',
      'Vinil cristal',
      'Clear vinyl',
      'Autoadhesivo transparente',
      'Sticker transparente',
      'Calco transparente',
    ],
    usosRecomendados: ['stickers', 'etiquetas', 'ploteo_vinilo'],
    procesosCompatibles: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'corte_digital',
    ],
    advertencias: ['Puede requerir blanco de apoyo según equipo y aplicación.'],
    ...rollPresetMeta('vinilo_adhesivo_transparente'),
    variantes: rollVariants('VIN-TRANS', [1.06, 1.27, 1.37, 1.52], {
      largo: 50,
      acabado: 'Brillante',
      color: 'Transparente',
      recomendadas: new Set([1.27, 1.37]),
    }),
  },
  {
    key: 'VINILO_MICROPERFORADO_ONE_WAY',
    nombreCanonico: 'Vinilo microperforado one way',
    descripcionCorta:
      'Vinilo perforado para vidrieras, ventanas y gráfica exterior con visibilidad parcial desde el interior.',
    iconKind: 'mesh',
    aliasDisponibles: [
      'Vinilo microperforado',
      'Vinil microperforado',
      'One way vision',
      'Window vision',
      'OWV',
      'Vinilo perforado',
      'Vinil perforado',
      'Vinilo para vidriera',
      'Microperforado para ventanas',
    ],
    usosRecomendados: ['ploteo_vinilo', 'pop_signage', 'stickers'],
    procesosCompatibles: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'corte_digital',
    ],
    advertencias: [
      'Revisar normativa local para uso en vehículos y vidrieras.',
    ],
    ...rollPresetMeta('vinilo_microperforado_one_way'),
    variantes: rollVariants('VIN-OWV', [1.27, 1.37, 1.52], {
      largo: 50,
      acabado: 'Microperforado',
      color: 'Blanco/negro',
      recomendadas: new Set([1.37, 1.52]),
    }),
  },
  {
    key: 'VINILO_DE_CORTE_COLOR',
    nombreCanonico: 'Vinilo de corte color',
    descripcionCorta:
      'Vinilo de color para plotter de corte, rotulación, letras adhesivas, señalética y calcos sin impresión full color.',
    iconKind: 'roll',
    aliasDisponibles: [
      'Vinilo de corte',
      'Vinil de corte',
      'Vinilo para plotter',
      'Vinil para plotter',
      'Vinilo rotulación',
      'Vinil rotulación',
      'Plotter de corte',
      'Oracal',
      'Calandrado color',
      'Vinilo autoadhesivo de color',
    ],
    usosRecomendados: ['ploteo_vinilo', 'stickers', 'etiquetas'],
    procesosCompatibles: ['ploteo_vinilo', 'corte_digital'],
    advertencias: [
      'El color se define en la ficha/variante real luego de instalar el material.',
    ],
    ...rollPresetMeta('vinilo_de_corte_color'),
    variantes: rollVariants('VIN-CORTE', [0.3, 0.61, 0.76, 1.22, 1.52], {
      largo: 50,
      acabado: 'Color',
      color: 'Color surtido',
      recomendadas: new Set([0.61, 1.22]),
    }),
  },
  {
    key: 'LONA_FRONTLIT',
    nombreCanonico: 'Lona frontlit',
    descripcionCorta:
      'Lona PVC para banners, carteles exteriores, marquesinas, eventos y gráfica de gran formato iluminada de frente.',
    iconKind: 'banner',
    aliasDisponibles: [
      'Lona frontlit',
      'Lona front',
      'Frontlit',
      'Lona banner',
      'Banner vinílico',
      'Lona PVC',
      'Lona 13 oz',
      'Lona base gris',
      'Lona para impresión',
      'Lona publicitaria',
    ],
    usosRecomendados: ['lonas_banners', 'pop_signage', 'rollups_displays'],
    procesosCompatibles: ['impresion_directa_uv', 'corte_digital'],
    advertencias: [],
    ...rollPresetMeta('lona_frontlit'),
    variantes: rollVariants(
      'LONA-FRONT',
      [0.91, 1, 1.1, 1.25, 1.37, 1.52, 1.6, 1.83, 2.05, 2.2, 2.5, 3.2],
      {
        largo: 50,
        acabado: 'Frontlit',
        color: 'Blanco',
        recomendadas: new Set([1.37, 1.52, 1.6, 3.2]),
      },
    ),
  },
  {
    key: 'LONA_BLOCKOUT',
    nombreCanonico: 'Lona blockout',
    descripcionCorta:
      'Lona opaca o doble faz para banners donde se necesita bloquear el paso de luz o imprimir ambas caras.',
    iconKind: 'banner',
    aliasDisponibles: [
      'Lona blockout',
      'Lona blackout',
      'Blockout',
      'Blackout',
      'Lona doble faz',
      'Lona fondo negro',
      'Lona opaca',
      'Banner blockout',
      'Lona dos caras',
    ],
    usosRecomendados: ['lonas_banners', 'pop_signage'],
    procesosCompatibles: ['impresion_directa_uv', 'corte_digital'],
    advertencias: [
      'Confirmar si el producto se imprime a una o dos caras antes de cotizar.',
    ],
    ...rollPresetMeta('lona_blockout'),
    variantes: rollVariants(
      'LONA-BLOCK',
      [1.1, 1.37, 1.52, 1.6, 2.2, 2.5, 3.2],
      {
        largo: 50,
        acabado: 'Blockout',
        color: 'Blanco',
        recomendadas: new Set([1.37, 1.52, 3.2]),
      },
    ),
  },
  {
    key: 'LONA_BACKLIT',
    nombreCanonico: 'Lona backlit',
    descripcionCorta:
      'Lona translúcida para cajas de luz, cartelería retroiluminada y gráficas con iluminación posterior.',
    iconKind: 'banner',
    aliasDisponibles: [
      'Lona backlit',
      'Backlit',
      'Lona translúcida',
      'Lona traslúcida',
      'Lona para caja de luz',
      'Lona retroiluminada',
      'Banner backlit',
      'Lona para marquesina iluminada',
    ],
    usosRecomendados: ['cajas_luz', 'lonas_banners', 'pop_signage'],
    procesosCompatibles: ['impresion_directa_uv', 'corte_digital'],
    advertencias: [
      'Revisar densidad de tinta/perfil para piezas retroiluminadas.',
    ],
    ...rollPresetMeta('lona_backlit'),
    variantes: rollVariants('LONA-BACKLIT', [1.27, 1.52, 2.2, 3.2], {
      largo: 50,
      acabado: 'Backlit',
      color: 'Blanco translúcido',
      recomendadas: new Set([1.52, 3.2]),
    }),
  },
  {
    key: 'LONA_MESH',
    nombreCanonico: 'Lona mesh',
    descripcionCorta:
      'Lona microperforada para fachadas, cercos, exteriores ventosos y piezas de gran superficie.',
    iconKind: 'mesh',
    aliasDisponibles: [
      'Lona mesh',
      'Mesh',
      'Lona microperforada',
      'Banner mesh',
      'Lona con liner',
      'Lona anti viento',
      'Lona para fachada',
      'Lona perforada',
      'Malla mesh',
    ],
    usosRecomendados: ['mesh_microperforado', 'lonas_banners', 'pop_signage'],
    procesosCompatibles: ['impresion_directa_uv', 'corte_digital'],
    advertencias: [
      'Algunas variantes traen liner removible; confirmarlo al proveedor.',
    ],
    ...rollPresetMeta('lona_mesh'),
    variantes: rollVariants(
      'LONA-MESH',
      [1.02, 1.37, 1.52, 1.6, 1.83, 2.2, 2.5, 3.2],
      {
        largo: 50,
        acabado: 'Mesh',
        color: 'Blanco',
        recomendadas: new Set([1.52, 3.2]),
      },
    ),
  },
  {
    key: 'PET_BACKLIT_FILM',
    nombreCanonico: 'PET backlit film',
    descripcionCorta:
      'Film PET translúcido para gráficas retroiluminadas, cajas de luz, displays y aplicaciones indoor premium.',
    iconKind: 'film',
    aliasDisponibles: [
      'PET backlit film',
      'Backlit film',
      'Film backlit',
      'Film PET backlit',
      'Film translúcido',
      'Película translúcida',
      'Acetato translúcido',
      'Película para caja de luz',
    ],
    usosRecomendados: ['cajas_luz', 'pop_signage'],
    procesosCompatibles: ['impresion_directa_uv', 'corte_digital'],
    advertencias: [
      'Puede requerir perfiles de color específicos para retroiluminación.',
    ],
    ...rollPresetMeta('pet_backlit_film'),
    variantes: rollVariants('PET-BACKLIT', [1.27, 1.52], {
      largo: 50,
      acabado: 'Backlit',
      color: 'Translúcido',
      recomendadas: new Set([1.27, 1.52]),
    }),
  },
  {
    key: 'PAPEL_BLUEBACK',
    nombreCanonico: 'Papel blueback',
    descripcionCorta:
      'Papel para vía pública con dorso azul, pensado para afiches, carteles temporales y pegado sobre superficies existentes.',
    iconKind: 'paper',
    aliasDisponibles: [
      'Papel blueback',
      'Blueback',
      'Blue back',
      'Papel dorso azul',
      'Papel vía pública',
      'Papel para cartelería',
      'Papel cartel',
      'Papel afiche exterior',
    ],
    usosRecomendados: ['pop_signage', 'papeleria_comercial'],
    procesosCompatibles: ['impresion_directa_uv', 'corte_digital'],
    advertencias: [
      'Material orientado a campañas temporales; validar adhesivo/pegado fuera del sistema.',
    ],
    ...rollPresetMeta('papel_blueback'),
    variantes: rollVariants('PAPEL-BLUEBACK', [1.37, 1.5, 1.52], {
      largo: 50,
      acabado: 'Mate',
      color: 'Dorso azul',
      recomendadas: new Set([1.37, 1.52]),
    }),
  },
  {
    key: 'PAPEL_OBRA_80_PLOTEO_CAD',
    nombreCanonico: 'Papel obra 80 grs para ploteo CAD',
    descripcionCorta:
      'Papel obra blanco en rollo para planos, documentación técnica, arquitectura, ingeniería y ploteo CAD monocromo o color básico.',
    iconKind: 'paper',
    aliasDisponibles: [
      'Papel obra 80 grs',
      'Papel obra 80 g',
      'Papel obra 80 gramos',
      'Papel bond 80 grs',
      'Bond 80 g',
      'Papel para plotter',
      'Papel plotter',
      'Papel ploteo CAD',
      'Papel CAD',
      'Papel para planos',
      'Rollo papel obra',
      'Rollo papel bond',
    ],
    usosRecomendados: ['planos_cad', 'papeleria_comercial'],
    procesosCompatibles: ['impresion_inkjet', 'ploteo_cad', 'corte_manual'],
    advertencias: [
      'Orientado a planos y piezas técnicas; no reemplaza papeles fotográficos o coated para alta cobertura de tinta.',
    ],
    ...rollPresetMeta('papel_obra_80_ploteo_cad'),
    variantes: rollVariants('PAPEL-OBRA80-CAD', [0.61, 0.914, 1.067, 1.118], {
      largo: 50,
      acabado: 'Obra 80 grs',
      color: 'Blanco',
      recomendadas: new Set([0.914, 1.067]),
    }),
  },
  {
    key: 'PAPEL_FOTOGRAFICO_POSTER',
    nombreCanonico: 'Papel fotográfico / poster',
    descripcionCorta:
      'Papel coated o fotográfico en rollo para posters, fotos, láminas, comunicación visual indoor y displays.',
    iconKind: 'coated',
    aliasDisponibles: [
      'Papel fotográfico',
      'Photo paper',
      'Papel poster',
      'Poster paper',
      'Papel coated',
      'Papel satinado',
      'Papel glossy',
      'Papel mate',
      'Papel RC',
      'Papel para póster',
    ],
    usosRecomendados: ['pop_signage', 'papeleria_comercial', 'folleteria'],
    procesosCompatibles: ['impresion_directa_uv', 'corte_digital'],
    advertencias: [
      'El acabado real puede ser mate, satinado o brillante según proveedor.',
    ],
    ...rollPresetMeta('papel_fotografico_poster'),
    variantes: rollVariants(
      'PAPEL-POSTER',
      [0.61, 0.914, 1.067, 1.27, 1.37, 1.52],
      {
        largo: 30,
        acabado: 'Satinado',
        color: 'Blanco',
        recomendadas: new Set([0.914, 1.27, 1.52]),
      },
    ),
  },
  {
    key: 'CANVAS_LIENZO',
    nombreCanonico: 'Canvas / lienzo',
    descripcionCorta:
      'Tela canvas o lienzo imprimible para cuadros, decoración, reproducciones artísticas y piezas premium.',
    iconKind: 'canvas',
    aliasDisponibles: [
      'Canvas',
      'Lienzo',
      'Tela canvas',
      'Tela lienzo',
      'Lienzo artístico',
      'Canvas poliéster',
      'Canvas algodón',
      'Tela para cuadros',
      'Lienzo para impresión',
    ],
    usosRecomendados: ['pop_signage', 'papeleria_comercial'],
    procesosCompatibles: ['impresion_directa_uv', 'corte_digital'],
    advertencias: [
      'Puede variar mucho la tensión y textura según composición algodón/poliéster.',
    ],
    ...rollPresetMeta('canvas_lienzo'),
    variantes: rollVariants('CANVAS', [1.27, 1.52], {
      largo: 30,
      acabado: 'Mate texturado',
      color: 'Blanco natural',
      recomendadas: new Set([1.27, 1.52]),
    }),
  },
  {
    key: 'VINILO_HOLOGRAFICO_GLITTER',
    nombreCanonico: 'Vinilo holográfico glitter',
    descripcionCorta:
      'Film/vinilo holográfico con efecto glitter para etiquetas, stickers, detalles decorativos y piezas promocionales.',
    iconKind: 'sticker',
    aliasDisponibles: [
      'Vinilo holográfico glitter',
      'Vinil holográfico glitter',
      'Vinilo tornasol glitter',
      'Vinil tornasol glitter',
      'Vinilo escarchado',
      'Vinilo diamantado',
      'Vinilo efecto purpurina',
      'Glitter holográfico',
      'Holographic glitter vinyl',
    ],
    usosRecomendados: [
      'stickers',
      'etiquetas',
      'ploteo_vinilo',
      'papeleria_comercial',
    ],
    procesosCompatibles: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'corte_digital',
    ],
    advertencias: [
      'Validar compatibilidad de tinta/adhesivo con el proveedor antes de usar en exterior prolongado.',
    ],
    ...rollPresetMeta('vinilo_holografico_glitter'),
    variantes: rollVariants('HOLO-GLITTER', [0.61, 1.22, 1.52], {
      largo: 50,
      acabado: 'Holográfico glitter',
      color: 'Holográfico',
      recomendadas: new Set([0.61, 1.22]),
    }),
  },
  {
    key: 'VINILO_HOLOGRAFICO_TORNASOLADO',
    nombreCanonico: 'Vinilo holográfico tornasolado',
    descripcionCorta:
      'Film/vinilo holográfico tornasolado con reflejo iridiscente para stickers, packaging y piezas de alto impacto visual.',
    iconKind: 'textile',
    aliasDisponibles: [
      'Vinilo holográfico tornasolado',
      'Vinil holográfico tornasol',
      'Vinilo tornasol',
      'Vinil tornasolado',
      'Vinilo iridiscente',
      'Vinilo arcoíris',
      'Vinilo efecto prisma',
      'Vinilo tornasol rainbow',
      'Holographic rainbow vinyl',
    ],
    usosRecomendados: ['stickers', 'etiquetas', 'ploteo_vinilo', 'packaging'],
    procesosCompatibles: [
      'impresion_directa_uv',
      'ploteo_vinilo',
      'corte_digital',
    ],
    advertencias: [
      'La lectura de color varía según iluminación y ángulo de observación.',
    ],
    ...rollPresetMeta('vinilo_holografico_tornasolado'),
    variantes: rollVariants('HOLO-TORNASOL', [0.61, 1.22, 1.52], {
      largo: 50,
      acabado: 'Holográfico tornasolado',
      color: 'Tornasolado',
      recomendadas: new Set([0.61, 1.22]),
    }),
  },
  {
    key: 'FILM_AB_DTF_UV',
    nombreCanonico: 'Film A+B para DTF UV',
    descripcionCorta:
      'Kit de film A imprimible y film B de transferencia para DTF UV sobre superficies rígidas o promocionales.',
    iconKind: 'sticker',
    aliasDisponibles: [
      'Film A+B DTF UV',
      'Film AB DTF UV',
      'Película A+B DTF UV',
      'Película AB UV DTF',
      'UV DTF AB film',
      'Crystal label film',
      'Film cristal DTF UV',
      'Film para stickers UV DTF',
    ],
    usosRecomendados: [
      'stickers',
      'etiquetas',
      'objeto_promocional',
      'packaging',
    ],
    procesosCompatibles: ['impresion_directa_uv', 'corte_digital'],
    advertencias: [
      'Se instala como set A+B. Verificar si el proveedor vende film A y B por separado o como kit.',
    ],
    ...filmTransferPresetMeta('film_ab_dtf_uv'),
    variantes: filmTransferVariants('DTFUV-AB', [300, 600], {
      largo: 100,
      tecnologiaCompatible: 'dtf_uv',
      color: 'Transparente',
      recomendadas: new Set([300, 600]),
    }),
  },
  {
    key: 'FILM_DTF_TEXTIL',
    nombreCanonico: 'Film DTF textil',
    descripcionCorta:
      'Film PET para impresión DTF textil, transferencia en prendas, merchandising textil y producción por rollo.',
    iconKind: 'textile',
    aliasDisponibles: [
      'Film DTF textil',
      'Película DTF textil',
      'PET film DTF',
      'Film transfer DTF',
      'Film para DTF',
      'Rollo DTF',
      'DTF transfer film',
      'Hot peel',
      'Cold peel',
    ],
    usosRecomendados: ['textil', 'stickers', 'objeto_promocional'],
    procesosCompatibles: ['impresion_directa_uv', 'corte_digital'],
    advertencias: [
      'Elegir hot peel, cold peel o instant peel según proceso y tinta del equipo.',
    ],
    ...filmTransferPresetMeta('film_dtf_textil'),
    variantes: filmTransferVariants('DTF-TEXTIL', [300, 330, 600, 1200], {
      largo: 100,
      tecnologiaCompatible: 'dtf_textil',
      color: 'Transparente',
      recomendadas: new Set([300, 600]),
    }),
  },
  {
    key: 'LAMINADO_FILM_BOPP',
    nombreCanonico: 'Laminado film BOPP',
    descripcionCorta:
      'Film BOPP térmico en rollo para proteger impresos, disponible en terminación brillante o mate.',
    iconKind: 'lamination',
    aliasDisponibles: [
      'Laminado film BOPP',
      'Film BOPP',
      'BOPP brillante',
      'BOPP mate',
      'Film laminado brillante',
      'Film laminado mate',
      'Film de laminación brillante',
      'Film de laminación mate',
      'Rollo para laminar BOPP',
      'Termolaminado brillante',
      'Termolaminado mate',
      'Polipropileno BOPP brillante',
      'Polipropileno BOPP mate',
      'Laminado glossy',
      'Laminado cristal',
      'Laminado matte',
      'Laminado opaco',
    ],
    usosRecomendados: ['folleteria', 'tarjeteria', 'packaging', 'editorial'],
    procesosCompatibles: ['laminado_termico', 'terminacion_grafica'],
    advertencias: [
      'Validar temperatura, tensión y sentido de bobina según laminadora y gramaje del impreso.',
      'El mate puede marcar más roces que el brillante; considerar soft touch o antihuellas en piezas premium.',
    ],
    ...laminadoFilmPresetMeta('laminado_film_bopp'),
    variantes: [
      ...laminadoFilmVariants(
        'LAM-BOPP-BRI',
        [
          [228, 100, 25],
          [330, 150, 25],
          [330, 150, 32],
          [480, 150, 25],
          [480, 150, 32],
        ],
        {
          acabado: 'Brillante',
          color: 'Transparente',
          recomendadas: new Set(['330-150-25', '480-150-25']),
        },
      ),
      ...laminadoFilmVariants(
        'LAM-BOPP-MATE',
        [
          [228, 100, 25],
          [330, 150, 25],
          [330, 150, 32],
          [480, 150, 25],
          [480, 150, 32],
        ],
        {
          acabado: 'Mate',
          color: 'Transparente',
          recomendadas: new Set(['330-150-25', '480-150-25']),
        },
      ),
    ],
  },
  {
    key: 'LAMINADO_FILM_BOPP_SOFT_TOUCH',
    nombreCanonico: 'Laminado film BOPP soft touch',
    descripcionCorta:
      'Film BOPP térmico soft touch en rollo para terminaciones premium con tacto aterciopelado.',
    iconKind: 'lamination',
    aliasDisponibles: [
      'Laminado film BOPP soft touch',
      'BOPP soft touch',
      'Soft touch',
      'Laminado soft touch',
      'Film soft touch',
      'Film aterciopelado',
      'Laminado aterciopelado',
      'Velvet film',
      'Velvet lamination',
      'Laminado velvet',
    ],
    usosRecomendados: ['tarjeteria', 'packaging', 'editorial'],
    procesosCompatibles: ['laminado_termico', 'terminacion_grafica'],
    advertencias: [
      'Terminación sensible a manipulación y marcas; validar compatibilidad con barniz sectorizado o stamping posterior.',
    ],
    ...laminadoFilmPresetMeta('laminado_film_bopp_soft_touch'),
    variantes: laminadoFilmVariants(
      'LAM-BOPP-SOFT',
      [
        [330, 150, 28],
        [330, 150, 32],
        [480, 150, 28],
        [480, 150, 32],
      ],
      {
        acabado: 'Soft touch',
        color: 'Transparente',
        recomendadas: new Set(['330-150-28', '480-150-28']),
      },
    ),
  },
  {
    key: 'LAMINADO_POUCH_BRILLANTE',
    nombreCanonico: 'Laminado pouch brillante',
    descripcionCorta:
      'Sobres pouch transparentes para plastificado en caliente de credenciales, documentos, láminas y piezas sueltas.',
    iconKind: 'pouch',
    aliasDisponibles: [
      'Laminado pouch brillante',
      'Pouch',
      'Pouch film',
      'Sobre pouch',
      'Sobre para plastificar',
      'Funda para plastificar',
      'Bolsa para plastificar',
      'Mica para plastificar',
      'Polaseal',
      'Plastificado pouch',
      'Plastificado en caliente',
      'Pouch cristal',
    ],
    usosRecomendados: ['credenciales', 'papeleria_comercial', 'editorial'],
    procesosCompatibles: ['plastificado_pouch', 'laminado_termico'],
    advertencias: [
      'El espesor informado suele expresarse por hoja/lado según proveedor; confirmar criterio antes de costear.',
    ],
    ...laminadoPouchPresetMeta('laminado_pouch_brillante'),
    variantes: laminadoPouchVariants(
      'POUCH-BRI',
      [
        ['Credencial 67 x 98 mm', 67, 98, 125, 100],
        ['Credencial 67 x 98 mm', 67, 98, 250, 100],
        ['A6', 111, 154, 125, 100],
        ['A5', 154, 216, 125, 100],
        ['A4', 216, 303, 80, 100],
        ['A4', 216, 303, 125, 100],
        ['A4', 216, 303, 175, 100],
        ['Oficio', 229, 356, 125, 100],
        ['A3', 303, 426, 125, 100],
        ['A3', 303, 426, 175, 100],
      ],
      {
        acabado: 'Brillante',
        color: 'Transparente',
        recomendadas: new Set([
          'Credencial 67 x 98 mm-125',
          'A4-125',
          'A3-125',
        ]),
      },
    ),
  },
  {
    key: 'IMAN_FLEXIBLE_HELADERA',
    nombreCanonico: 'Imán flexible para heladera / souvenir',
    descripcionCorta:
      'Imán flexible en rollo para souvenirs, calendarios, imanes de heladera y piezas promocionales interiores.',
    iconKind: 'magnet',
    aliasDisponibles: [
      'Imán flexible para heladera',
      'Imán para heladera',
      'Imán para nevera',
      'Imán souvenir',
      'Rollo de imán',
      'Lámina magnética flexible',
      'Hoja imantada',
      'Vinilo magnético',
      'Goma magnética',
      'Flexible magnetic sheet',
      'Magnetic sheeting',
    ],
    usosRecomendados: ['souvenirs', 'papeleria_comercial', 'pop_signage'],
    procesosCompatibles: ['corte_manual', 'corte_digital'],
    advertencias: [
      'Material para interior o baja exigencia; no recomendado para uso vehicular exterior.',
    ],
    ...imanPresetMeta('iman_flexible_rollo_heladera', 'iman_flexible_rollo_v1'),
    variantes: imanRolloVariants(
      'IMAN-HEL',
      [
        [610, 1, 0.35],
        [610, 20, 0.35],
        [600, 1, 0.4],
        [610, 20, 0.4],
        [610, 15, 0.5],
      ],
      {
        recomendadas: new Set(['610-1-0.35', '610-20-0.4']),
      },
    ),
  },
  {
    key: 'IMAN_FLEXIBLE_VEHICULAR',
    nombreCanonico: 'Imán flexible vehicular',
    descripcionCorta:
      'Imán flexible en rollo de mayor espesor para carteles magnéticos removibles en vehículos y señalética exterior temporal.',
    iconKind: 'magnet',
    aliasDisponibles: [
      'Imán flexible vehicular',
      'Imán vehicular',
      'Imán para auto',
      'Imán para camioneta',
      'Cartel magnético vehicular',
      'Rollo imán vehicular',
      'Vinilo magnético vehicular',
      'Goma magnética vehicular',
      'Vehicle magnet',
      'Vehicle magnetic sheet',
      'Magnetic car sign',
    ],
    usosRecomendados: ['vehiculos', 'pop_signage', 'señaletica_exterior'],
    procesosCompatibles: ['corte_manual', 'corte_digital'],
    advertencias: [
      'Validar limpieza de superficie, bordes redondeados, velocidad de uso y espesor mínimo recomendado por proveedor.',
    ],
    ...imanPresetMeta(
      'iman_flexible_rollo_vehicular',
      'iman_flexible_rollo_v1',
    ),
    variantes: imanRolloVariants(
      'IMAN-VEH',
      [
        [610, 1, 0.7],
        [610, 10, 0.7],
        [620, 20, 0.7],
        [610, 1, 0.8],
        [610, 5, 0.8],
        [610, 10, 0.8],
        [610, 30, 0.8],
      ],
      {
        recomendadas: new Set(['610-1-0.8', '610-10-0.8']),
      },
    ),
  },
  {
    key: 'IMAN_FERRITA_CERAMICO_REDONDO',
    nombreCanonico: 'Imán ferrita / cerámico redondo',
    descripcionCorta:
      'Imán rígido redondo de ferrita o cerámico para souvenirs, imanes de heladera, manualidades y piezas promocionales económicas.',
    iconKind: 'magnet',
    aliasDisponibles: [
      'Imán ferrita redondo',
      'Imán cerámico redondo',
      'Imán rígido redondo',
      'Imán redondo negro',
      'Imán circular',
      'Disco ferrita',
      'Disco cerámico',
      'Imán para souvenir',
      'Imán para heladera',
      'Imán para manualidades',
      'Ferrite magnet',
      'Ceramic magnet',
      'Ferrite disc magnet',
    ],
    usosRecomendados: ['souvenirs', 'papeleria_comercial', 'pop_signage'],
    procesosCompatibles: ['pegado_manual', 'ensamble_manual'],
    advertencias: [
      'Menor fuerza que neodimio; validar peso de la pieza y superficie de fijación.',
    ],
    ...imanPresetMeta('iman_ferrita_ceramico_redondo', 'iman_redondo_v1'),
    variantes: imanRedondoVariants(
      'IMAN-FERRITA',
      [
        [15, 3, null, false, 100],
        [18, 3, null, false, 100],
        [20, 3, null, false, 100],
        [20, 3, null, true, 100],
        [25, 3, null, false, 100],
        [25, 3, null, true, 100],
        [30, 3, null, false, 100],
        [30, 3, null, true, 100],
      ],
      {
        color: 'Negro',
        recomendadas: new Set(['20-3-false', '25-3-true', '30-3-true']),
      },
    ),
  },
  {
    key: 'IMAN_NEODIMIO_REDONDO',
    nombreCanonico: 'Imán neodimio redondo',
    descripcionCorta:
      'Imán redondo de neodimio de alta fuerza para cierres magnéticos, packaging premium, displays, acrílicos y fijaciones compactas.',
    iconKind: 'magnet',
    aliasDisponibles: [
      'Imán neodimio redondo',
      'Imán de neodimio',
      'Imán potente',
      'Imán tierras raras',
      'Disco neodimio',
      'Imán para cierre magnético',
      'Imán para packaging',
      'NdFeB',
      'Neodymium magnet',
      'Neodymium disc magnet',
      'Rare earth magnet',
    ],
    usosRecomendados: ['packaging', 'pop_signage', 'objeto_promocional'],
    procesosCompatibles: ['pegado_manual', 'ensamble_manual'],
    advertencias: [
      'Imán de alta fuerza y fragilidad; manipular con cuidado y validar polaridad, recubrimiento y seguridad del producto final.',
    ],
    ...imanPresetMeta('iman_neodimio_redondo', 'iman_redondo_v1'),
    variantes: imanRedondoVariants(
      'IMAN-NEO',
      [
        [5, 2, 'N35', false, 100],
        [8, 2, 'N35', false, 100],
        [10, 1, 'N35', false, 100],
        [10, 2, 'N35', false, 100],
        [10, 2, 'N35', true, 100],
        [12, 2, 'N35', false, 100],
        [15, 2, 'N35', false, 100],
        [20, 2, 'N35', false, 50],
      ],
      {
        color: 'Níquel',
        recomendadas: new Set([
          '10-2-N35-false',
          '10-2-N35-true',
          '12-2-N35-false',
        ]),
      },
    ),
  },
  tintaPreset({
    key: 'TINTA_ECOSOLVENTE_CMYK',
    nombreCanonico: 'Tinta ecosolvente CMYK',
    descripcionCorta:
      'Tinta ecosolvente genérica para plotters de gran formato, vinilos, lonas y gráfica exterior.',
    iconKind: 'ink',
    aliasDisponibles: [
      'Tinta ecosolvente',
      'Tinta eco solvente',
      'Eco solvent ink',
      'Tinta para plotter ecosolvente',
      'Tinta CMYK ecosolvente',
      'Tinta solvente suave',
    ],
    tipoTecnico: 'tinta_ecosolvente',
    atributosTecnicos: { tecnologia: 'ecosolvente', colores: 'CMYK' },
    variantes: tintaColorVariants('TINTA-ECO', cmykChannels(), {
      tecnologiaCompatible: 'impresora_gran_formato_por_area',
      equipoCompatible: 'Genérico ecosolvente',
      volumenPresentacion: 1000,
      baseQuimica: 'ecosolvente',
      recomendadas: new Set(['cian', 'magenta', 'amarillo', 'negro']),
    }),
  }),
  tintaPreset({
    key: 'TINTA_UV_CMYK',
    nombreCanonico: 'Tinta UV CMYK',
    descripcionCorta:
      'Tinta UV genérica CMYK para impresión directa, rígidos, objetos promocionales y gran formato UV.',
    iconKind: 'ink',
    aliasDisponibles: [
      'Tinta UV',
      'Tinta UV CMYK',
      'UV ink',
      'Tinta curado UV',
      'Tinta para cama plana UV',
      'Tinta para flatbed UV',
    ],
    tipoTecnico: 'tinta_uv',
    atributosTecnicos: { tecnologia: 'uv', colores: 'CMYK' },
    variantes: tintaColorVariants('TINTA-UV', cmykChannels(), {
      tecnologiaCompatible: 'impresora_gran_formato_por_area',
      equipoCompatible: 'Genérico UV',
      volumenPresentacion: 1000,
      baseQuimica: 'uv',
      recomendadas: new Set(['cian', 'magenta', 'amarillo', 'negro']),
    }),
  }),
  tintaPreset({
    key: 'TINTA_UV_BLANCO',
    nombreCanonico: 'Tinta UV blanco',
    descripcionCorta:
      'Tinta blanca UV genérica para base de apoyo, impresión sobre transparentes, oscuros y objetos.',
    iconKind: 'ink',
    aliasDisponibles: [
      'Tinta UV blanco',
      'Tinta blanca UV',
      'UV white ink',
      'Blanco UV',
      'White UV',
    ],
    tipoTecnico: 'tinta_uv_blanco',
    atributosTecnicos: { tecnologia: 'uv', colores: 'W' },
    variantes: tintaColorVariants('TINTA-UV-W', [['Blanco', 'blanco']], {
      tecnologiaCompatible: 'impresora_gran_formato_por_area',
      equipoCompatible: 'Genérico UV',
      volumenPresentacion: 1000,
      baseQuimica: 'uv',
      recomendadas: new Set(['blanco']),
    }),
  }),
  tintaPreset({
    key: 'TINTA_UV_BARNIZ',
    nombreCanonico: 'Tinta UV barniz',
    descripcionCorta:
      'Barniz UV transparente para efectos de brillo, reserva sectorizada y terminaciones especiales.',
    iconKind: 'ink',
    aliasDisponibles: [
      'Tinta UV barniz',
      'Barniz UV',
      'Varnish UV',
      'Clear UV',
      'Tinta clear UV',
      'Barniz sectorizado UV',
    ],
    tipoTecnico: 'tinta_uv_barniz',
    atributosTecnicos: { tecnologia: 'uv', colores: 'Barniz' },
    variantes: tintaColorVariants('TINTA-UV-BARNIZ', [['Barniz', 'barniz']], {
      tecnologiaCompatible: 'impresora_gran_formato_por_area',
      equipoCompatible: 'Genérico UV',
      volumenPresentacion: 1000,
      baseQuimica: 'uv',
      recomendadas: new Set(['barniz']),
    }),
  }),
  tintaPreset({
    key: 'TINTA_LATEX_CMYK',
    nombreCanonico: 'Tinta látex CMYK',
    descripcionCorta:
      'Tinta látex genérica CMYK para gran formato, cartelería, vinilos, lonas y aplicaciones indoor/outdoor.',
    iconKind: 'ink',
    aliasDisponibles: [
      'Tinta látex',
      'Tinta latex',
      'Latex ink',
      'Tinta HP latex',
      'Tinta CMYK látex',
      'Tinta para plotter látex',
    ],
    tipoTecnico: 'tinta_latex',
    atributosTecnicos: { tecnologia: 'latex', colores: 'CMYK' },
    variantes: tintaColorVariants('TINTA-LATEX', cmykChannels(), {
      tecnologiaCompatible: 'impresora_gran_formato_por_area',
      equipoCompatible: 'Genérico látex',
      volumenPresentacion: 1000,
      baseQuimica: 'latex',
      recomendadas: new Set(['cian', 'magenta', 'amarillo', 'negro']),
    }),
  }),
  tintaPreset({
    key: 'TINTA_SUBLIMACION_CMYK',
    nombreCanonico: 'Tinta sublimación CMYK',
    descripcionCorta:
      'Tinta de sublimación CMYK para transferencia sobre textiles poliéster, rígidos sublimables y merchandising.',
    iconKind: 'ink',
    aliasDisponibles: [
      'Tinta sublimación',
      'Tinta para sublimar',
      'Sublimation ink',
      'Tinta CMYK sublimación',
      'Tinta transfer sublimación',
    ],
    tipoTecnico: 'tinta_sublimacion',
    atributosTecnicos: { tecnologia: 'sublimacion', colores: 'CMYK' },
    variantes: tintaColorVariants('TINTA-SUBLI', cmykChannels(), {
      tecnologiaCompatible: 'impresora_gran_formato_por_area',
      equipoCompatible: 'Genérico sublimación',
      volumenPresentacion: 1000,
      baseQuimica: 'sublimacion',
      recomendadas: new Set(['cian', 'magenta', 'amarillo', 'negro']),
    }),
  }),
  tintaPreset({
    key: 'TINTA_DTF_TEXTIL_CMYK',
    nombreCanonico: 'Tinta DTF textil CMYK',
    descripcionCorta:
      'Tinta DTF textil CMYK para impresión sobre film de transferencia y estampado de prendas.',
    iconKind: 'ink',
    aliasDisponibles: [
      'Tinta DTF textil',
      'Tinta DTF CMYK',
      'DTF textile ink',
      'Tinta para DTF',
      'Tinta transfer DTF',
    ],
    tipoTecnico: 'tinta_dtf_textil',
    atributosTecnicos: { tecnologia: 'dtf_textil', colores: 'CMYK' },
    variantes: tintaColorVariants('TINTA-DTF-TEXTIL', cmykChannels(), {
      tecnologiaCompatible: 'impresora_gran_formato_por_area',
      equipoCompatible: 'Genérico DTF textil',
      volumenPresentacion: 1000,
      baseQuimica: 'dtf_textil',
      recomendadas: new Set(['cian', 'magenta', 'amarillo', 'negro']),
    }),
  }),
  tintaPreset({
    key: 'TINTA_DTF_TEXTIL_BLANCO',
    nombreCanonico: 'Tinta DTF textil blanco',
    descripcionCorta:
      'Tinta blanca DTF textil para base de transferencia y estampado sobre prendas oscuras o de color.',
    iconKind: 'ink',
    aliasDisponibles: [
      'Tinta DTF blanco',
      'Tinta blanca DTF textil',
      'DTF white ink',
      'White DTF',
      'Blanco DTF',
    ],
    tipoTecnico: 'tinta_dtf_textil_blanco',
    atributosTecnicos: { tecnologia: 'dtf_textil', colores: 'W' },
    variantes: tintaColorVariants(
      'TINTA-DTF-TEXTIL-W',
      [['Blanco', 'blanco']],
      {
        tecnologiaCompatible: 'impresora_gran_formato_por_area',
        equipoCompatible: 'Genérico DTF textil',
        volumenPresentacion: 1000,
        baseQuimica: 'dtf_textil',
        recomendadas: new Set(['blanco']),
      },
    ),
  }),
  tintaPreset({
    key: 'TINTA_DTF_UV_CMYK',
    nombreCanonico: 'Tinta DTF UV CMYK',
    descripcionCorta:
      'Tinta DTF UV CMYK para impresión de stickers transferibles sobre film A+B y objetos promocionales.',
    iconKind: 'ink',
    aliasDisponibles: [
      'Tinta DTF UV',
      'Tinta UV DTF',
      'UV DTF ink',
      'Tinta para stickers DTF UV',
      'Tinta cristal DTF UV',
    ],
    tipoTecnico: 'tinta_dtf_uv',
    atributosTecnicos: { tecnologia: 'dtf_uv', colores: 'CMYK' },
    variantes: tintaColorVariants('TINTA-DTF-UV', cmykChannels(), {
      tecnologiaCompatible: 'impresora_gran_formato_por_area',
      equipoCompatible: 'Genérico DTF UV',
      volumenPresentacion: 1000,
      baseQuimica: 'dtf_uv',
      recomendadas: new Set(['cian', 'magenta', 'amarillo', 'negro']),
    }),
  }),
  tintaPreset({
    key: 'TINTA_DTF_UV_BLANCO',
    nombreCanonico: 'Tinta DTF UV blanco',
    descripcionCorta:
      'Tinta blanca DTF UV para base de apoyo en stickers transferibles y aplicaciones sobre objetos.',
    iconKind: 'ink',
    aliasDisponibles: [
      'Tinta DTF UV blanco',
      'Tinta blanca DTF UV',
      'UV DTF white ink',
      'Blanco DTF UV',
    ],
    tipoTecnico: 'tinta_dtf_uv_blanco',
    atributosTecnicos: { tecnologia: 'dtf_uv', colores: 'W' },
    variantes: tintaColorVariants('TINTA-DTF-UV-W', [['Blanco', 'blanco']], {
      tecnologiaCompatible: 'impresora_gran_formato_por_area',
      equipoCompatible: 'Genérico DTF UV',
      volumenPresentacion: 1000,
      baseQuimica: 'dtf_uv',
      recomendadas: new Set(['blanco']),
    }),
  }),
  tintaPreset({
    key: 'TINTA_PIGMENTO_CMYK',
    nombreCanonico: 'Tinta pigmento CMYK',
    descripcionCorta:
      'Tinta pigmentada CMYK para inkjet, plotter CAD, fotografía, posters y piezas de alta definición.',
    iconKind: 'ink',
    aliasDisponibles: [
      'Tinta pigmento',
      'Tinta pigmentada',
      'Pigment ink',
      'Tinta inkjet pigmento',
      'Tinta para plotter CAD',
      'Tinta fotográfica pigmentada',
    ],
    tipoTecnico: 'tinta_pigmento',
    atributosTecnicos: { tecnologia: 'pigmento', colores: 'CMYK' },
    variantes: tintaColorVariants('TINTA-PIGMENTO', cmykChannels(), {
      tecnologiaCompatible: 'impresora_gran_formato_por_area',
      equipoCompatible: 'Genérico pigmento',
      volumenPresentacion: 1000,
      baseQuimica: 'pigmento',
      recomendadas: new Set(['cian', 'magenta', 'amarillo', 'negro']),
    }),
  }),
  tonerPreset({
    key: 'TONER_LASER_MONOCROMO_GENERICO',
    nombreCanonico: 'Tóner láser monocromo genérico',
    descripcionCorta:
      'Tóner negro genérico para impresoras láser monocromáticas de oficina o producción liviana.',
    iconKind: 'toner',
    aliasDisponibles: [
      'Tóner láser negro',
      'Toner laser negro',
      'Tóner monocromo',
      'Cartucho toner negro',
      'Black toner cartridge',
    ],
    tipoTecnico: 'toner_laser_monocromo',
    atributosTecnicos: { tecnologia: 'laser', colores: 'K' },
    variantes: tonerVariants('TONER-LASER-K', [['Negro', 'negro', 5000]], {
      equipoCompatible: 'Genérico láser monocromo',
      presentacion: 'Cartucho',
      oemOAlternativo: 'Genérico',
      recomendadas: new Set(['negro']),
    }),
  }),
  tonerPreset({
    key: 'TONER_LASER_CMYK_GENERICO',
    nombreCanonico: 'Tóner láser CMYK genérico',
    descripcionCorta:
      'Tóner CMYK genérico para impresoras láser color y equipos de oficina gráfica.',
    iconKind: 'toner',
    aliasDisponibles: [
      'Tóner láser CMYK',
      'Toner laser color',
      'Tóner color',
      'Cartucho toner color',
      'CMYK toner cartridge',
    ],
    tipoTecnico: 'toner_laser_color',
    atributosTecnicos: { tecnologia: 'laser', colores: 'CMYK' },
    variantes: tonerVariants('TONER-LASER', cmykTonerChannels(8000), {
      equipoCompatible: 'Genérico láser color',
      presentacion: 'Cartucho',
      oemOAlternativo: 'Genérico',
      recomendadas: new Set(['cian', 'magenta', 'amarillo', 'negro']),
    }),
  }),
  tonerPreset({
    key: 'TONER_PRODUCCION_CMYK_GENERICO',
    nombreCanonico: 'Tóner producción CMYK genérico',
    descripcionCorta:
      'Tóner CMYK genérico para prensas digitales y equipos láser de producción.',
    iconKind: 'toner',
    aliasDisponibles: [
      'Tóner producción CMYK',
      'Toner prensa digital',
      'Tóner digital press',
      'Production toner',
      'Tóner CMYK producción',
    ],
    tipoTecnico: 'toner_produccion_color',
    atributosTecnicos: { tecnologia: 'laser_produccion', colores: 'CMYK' },
    variantes: tonerVariants('TONER-PROD', cmykTonerChannels(16000), {
      equipoCompatible: 'Genérico producción color',
      presentacion: 'Cartucho',
      oemOAlternativo: 'Genérico',
      recomendadas: new Set(['cian', 'magenta', 'amarillo', 'negro']),
    }),
  }),
  tonerPreset({
    key: 'TONER_PRODUCCION_BLANCO_GENERICO',
    nombreCanonico: 'Tóner producción blanco genérico',
    descripcionCorta:
      'Tóner blanco genérico para prensas digitales con canal especial de blanco.',
    iconKind: 'toner',
    aliasDisponibles: [
      'Tóner blanco',
      'Toner blanco',
      'White toner',
      'Tóner especial blanco',
      'Tóner producción blanco',
    ],
    tipoTecnico: 'toner_produccion_blanco',
    atributosTecnicos: { tecnologia: 'laser_produccion', colores: 'W' },
    variantes: tonerVariants('TONER-PROD-W', [['Blanco', 'blanco', 10000]], {
      equipoCompatible: 'Genérico producción blanco',
      presentacion: 'Cartucho',
      oemOAlternativo: 'Genérico',
      recomendadas: new Set(['blanco']),
    }),
  }),
  tonerPreset({
    key: 'TONER_PRODUCCION_CLEAR_GENERICO',
    nombreCanonico: 'Tóner producción clear genérico',
    descripcionCorta:
      'Tóner clear o transparente genérico para efectos especiales, realces y aplicaciones de producción.',
    iconKind: 'toner',
    aliasDisponibles: [
      'Tóner clear',
      'Toner clear',
      'Tóner transparente',
      'Clear toner',
      'Tóner barniz',
      'Tóner especial clear',
    ],
    tipoTecnico: 'toner_produccion_clear',
    atributosTecnicos: { tecnologia: 'laser_produccion', colores: 'Clear' },
    variantes: tonerVariants('TONER-PROD-CLEAR', [['Clear', 'clear', 10000]], {
      equipoCompatible: 'Genérico producción clear',
      presentacion: 'Cartucho',
      oemOAlternativo: 'Genérico',
      recomendadas: new Set(['clear']),
    }),
  }),
];

function acrilicoVariants() {
  const formato = '2050 × 3050 mm';
  const ancho = 2.05;
  const alto = 3.05;
  const espesores = [2, 3, 4, 5, 6, 8, 10];
  return [
    ...espesores.map((espesor) =>
      v(
        `ACR-CR-${espesor}`,
        formato,
        ancho,
        alto,
        espesor,
        'Cristal',
        espesor === 3 || espesor === 5,
      ),
    ),
    ...espesores.map((espesor) =>
      v(
        `ACR-OP-${espesor}`,
        formato,
        ancho,
        alto,
        espesor,
        'Opal',
        espesor === 3 || espesor === 5,
      ),
    ),
    ...espesores.map((espesor) =>
      v(`ACR-NG-${espesor}`, formato, ancho, alto, espesor, 'Negro', false),
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
    moneda: 'ARS',
  };
}

function sheetPresetMeta(tipoTecnico) {
  return {
    familia: FamiliaMateriaPrima.SUSTRATO,
    subfamilia: SubfamiliaMateriaPrima.SUSTRATO_HOJA,
    tipoTecnico,
    templateId: 'sustrato_hoja_v1',
  };
}

function rollPresetMeta(tipoTecnico) {
  return {
    familia: FamiliaMateriaPrima.SUSTRATO,
    subfamilia: SubfamiliaMateriaPrima.SUSTRATO_ROLLO_FLEXIBLE,
    tipoTecnico,
    templateId: 'sustrato_rollo_flexible_v1',
  };
}

function filmTransferPresetMeta(tipoTecnico) {
  return {
    familia: FamiliaMateriaPrima.TRANSFERENCIA_LAMINACION,
    subfamilia: SubfamiliaMateriaPrima.FILM_TRANSFERENCIA,
    tipoTecnico,
    templateId: 'film_transferencia_v1',
  };
}

function laminadoFilmPresetMeta(tipoTecnico) {
  return {
    familia: FamiliaMateriaPrima.TRANSFERENCIA_LAMINACION,
    subfamilia: SubfamiliaMateriaPrima.LAMINADO_FILM,
    tipoTecnico,
    templateId: 'laminado_film_v1',
  };
}

function laminadoPouchPresetMeta(tipoTecnico) {
  return {
    familia: FamiliaMateriaPrima.TRANSFERENCIA_LAMINACION,
    subfamilia: SubfamiliaMateriaPrima.LAMINADO_POUCH,
    tipoTecnico,
    templateId: 'laminado_pouch_v1',
  };
}

function imanPresetMeta(tipoTecnico, templateId) {
  return {
    familia: FamiliaMateriaPrima.MAGNETICO_FIJACION,
    subfamilia: SubfamiliaMateriaPrima.IMAN_CERAMICO_FLEXIBLE,
    tipoTecnico,
    templateId,
  };
}

function tintaPreset(config) {
  return {
    key: config.key,
    nombreCanonico: config.nombreCanonico,
    descripcionCorta: config.descripcionCorta,
    iconKind: config.iconKind,
    aliasDisponibles: config.aliasDisponibles,
    usosRecomendados: [
      'impresion_digital',
      'pop_signage',
      'papeleria_comercial',
    ],
    procesosCompatibles: ['impresion_digital', 'impresion_gran_formato'],
    advertencias: [
      'Preset genérico: ajustar marca, equipo compatible, perfil de color y precio real al instalar.',
    ],
    familia: FamiliaMateriaPrima.TINTA_COLORANTE,
    subfamilia: SubfamiliaMateriaPrima.TINTA_IMPRESION,
    tipoTecnico: config.tipoTecnico,
    templateId: 'tinta_impresion_v1',
    atributosTecnicos: config.atributosTecnicos,
    variantes: config.variantes,
  };
}

function tonerPreset(config) {
  return {
    key: config.key,
    nombreCanonico: config.nombreCanonico,
    descripcionCorta: config.descripcionCorta,
    iconKind: config.iconKind,
    aliasDisponibles: config.aliasDisponibles,
    usosRecomendados: ['impresion_digital', 'papeleria_comercial', 'editorial'],
    procesosCompatibles: ['impresion_laser', 'impresion_digital'],
    advertencias: [
      'Preset genérico: validar compatibilidad exacta por equipo, fabricante y rendimiento antes de costear producción.',
    ],
    familia: FamiliaMateriaPrima.TINTA_COLORANTE,
    subfamilia: SubfamiliaMateriaPrima.TONER,
    tipoTecnico: config.tipoTecnico,
    templateId: 'toner_v1',
    atributosTecnicos: config.atributosTecnicos,
    variantes: config.variantes,
  };
}

function cmykChannels() {
  return [
    ['Cian', 'cian'],
    ['Magenta', 'magenta'],
    ['Amarillo', 'amarillo'],
    ['Negro', 'negro'],
  ];
}

function cmykTonerChannels(rendimientoPaginasIso) {
  return cmykChannels().map(([color, canal]) => [
    color,
    canal,
    rendimientoPaginasIso,
  ]);
}

function tintaColorVariants(prefix, colores, options) {
  return colores.map(([color, canal]) => vtinta(prefix, color, canal, options));
}

function vtinta(prefix, color, canal, options) {
  const volumenPresentacion = options.volumenPresentacion;
  const recomendada = Boolean(options.recomendadas?.has(canal));
  const sku = `${prefix}-${channelSku(canal)}-${volumenPresentacion}ML`;
  const formato = `${color} ${volumenPresentacion} ml`;
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `Tinta ${formato}`,
    formato,
    espesor: null,
    color,
    recomendada,
    atributosVarianteJson: {
      tecnologiaCompatible: options.tecnologiaCompatible,
      color,
      canal,
      volumenPresentacion,
      volumenMl: volumenPresentacion,
      equipoCompatible: options.equipoCompatible,
      baseQuimica: options.baseQuimica,
    },
    unidadStock: UnidadMateriaPrima.ML,
    unidadCompra: UnidadMateriaPrima.LITRO,
    precioReferencia: null,
    moneda: 'ARS',
  };
}

function tonerVariants(prefix, colores, options) {
  return colores.map(([color, canal, rendimientoPaginasIso]) =>
    vtoner(prefix, color, canal, rendimientoPaginasIso, options),
  );
}

function vtoner(prefix, color, canal, rendimientoPaginasIso, options) {
  const recomendada = Boolean(options.recomendadas?.has(canal));
  const sku = `${prefix}-${channelSku(canal)}-${rendimientoPaginasIso}`;
  const formato = `${color} ${rendimientoPaginasIso} págs. ISO`;
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `Tóner ${formato}`,
    formato,
    espesor: null,
    color,
    recomendada,
    atributosVarianteJson: {
      color,
      canal,
      rendimientoPaginasIso,
      equipoCompatible: options.equipoCompatible,
      presentacion: options.presentacion,
      oemOAlternativo: options.oemOAlternativo,
    },
    unidadStock: UnidadMateriaPrima.UNIDAD,
    unidadCompra: UnidadMateriaPrima.UNIDAD,
    precioReferencia: null,
    moneda: 'ARS',
  };
}

function channelSku(canal) {
  const aliases = {
    cian: 'C',
    magenta: 'M',
    amarillo: 'Y',
    negro: 'K',
    blanco: 'W',
    barniz: 'VARNISH',
    clear: 'CLEAR',
  };
  return aliases[canal] ?? canal.toUpperCase().replace(/[^A-Z0-9]+/g, '-');
}

function rollVariants(prefix, anchos, options) {
  return anchos.map((ancho) => vr(prefix, ancho, options));
}

function vr(prefix, ancho, options) {
  const largo = options.largo;
  const recomendada = Boolean(options.recomendadas?.has(ancho));
  const sku = `${prefix}-${rollSkuWidth(ancho)}-${largo}M`;
  const formato = `Rollo ${formatRollWidth(ancho)} × ${largo} m`;
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `${formato} · ${options.acabado}`,
    formato,
    espesor: null,
    color: options.color,
    recomendada,
    atributosVarianteJson: {
      ancho,
      largo,
      acabado: options.acabado,
      anchoMm: Math.round(ancho * 1000),
      largoMm: Math.round(largo * 1000),
      largoRolloMm: Math.round(largo * 1000),
    },
    unidadStock: UnidadMateriaPrima.METRO_LINEAL,
    unidadCompra: UnidadMateriaPrima.ROLLO,
    precioReferencia: null,
    moneda: 'ARS',
  };
}

function formatRollWidth(ancho) {
  return ancho < 1
    ? `${Math.round(ancho * 100)} cm`
    : `${ancho.toString().replace('.', ',')} m`;
}

function rollSkuWidth(ancho) {
  return `${Math.round(ancho * 100)
    .toString()
    .padStart(3, '0')}CM`;
}

function filmTransferVariants(prefix, anchosMm, options) {
  return anchosMm.map((anchoMm) => vf(prefix, anchoMm, options));
}

function vf(prefix, anchoMm, options) {
  const largo = options.largo;
  const recomendada = Boolean(options.recomendadas?.has(anchoMm));
  const sku = `${prefix}-${anchoMm}MM-${largo}M`;
  const formato = `Rollo ${anchoMm} mm × ${largo} m`;
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `${formato} · ${options.tecnologiaCompatible}`,
    formato,
    espesor: null,
    color: options.color,
    recomendada,
    atributosVarianteJson: {
      ancho: anchoMm,
      largo,
      tecnologiaCompatible: options.tecnologiaCompatible,
      anchoMm,
      largoMm: Math.round(largo * 1000),
      largoRolloMm: Math.round(largo * 1000),
    },
    unidadStock: UnidadMateriaPrima.METRO_LINEAL,
    unidadCompra: UnidadMateriaPrima.ROLLO,
    precioReferencia: null,
    moneda: 'ARS',
  };
}

function laminadoFilmVariants(prefix, variantes, options) {
  return variantes.map(([anchoMm, largo, micrones]) =>
    vlf(prefix, anchoMm, largo, micrones, options),
  );
}

function vlf(prefix, anchoMm, largo, micrones, options) {
  const recomendada = Boolean(
    options.recomendadas?.has(`${anchoMm}-${largo}-${micrones}`),
  );
  const sku = `${prefix}-${anchoMm}MM-${largo}M-${micrones}MIC`;
  const formato = `Rollo ${anchoMm} mm × ${largo} m`;
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `${formato} · ${micrones} mic · ${options.acabado}`,
    formato,
    espesor: null,
    color: options.color,
    recomendada,
    atributosVarianteJson: {
      ancho: anchoMm,
      largo,
      micrones,
      acabado: options.acabado,
      anchoMm,
      largoMm: Math.round(largo * 1000),
      largoRolloMm: Math.round(largo * 1000),
    },
    unidadStock: UnidadMateriaPrima.METRO_LINEAL,
    unidadCompra: UnidadMateriaPrima.ROLLO,
    precioReferencia: null,
    moneda: 'ARS',
  };
}

function laminadoPouchVariants(prefix, variantes, options) {
  return variantes.map(
    ([formato, anchoMm, altoMm, micrones, unidadesPorPack]) =>
      vlp(prefix, formato, anchoMm, altoMm, micrones, unidadesPorPack, options),
  );
}

function vlp(
  prefix,
  formato,
  anchoMm,
  altoMm,
  micrones,
  unidadesPorPack,
  options,
) {
  const recomendada = Boolean(
    options.recomendadas?.has(`${formato}-${micrones}`),
  );
  const sku = `${prefix}-${pouchSkuFormat(formato)}-${micrones}MIC-X${unidadesPorPack}`;
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `${formato} · ${micrones} mic · ${options.acabado} · pack x ${unidadesPorPack}`,
    formato,
    espesor: null,
    color: options.color,
    recomendada,
    atributosVarianteJson: {
      formato,
      anchoMm,
      altoMm,
      micrones,
      acabado: options.acabado,
      unidadesPorPack,
    },
    unidadStock: UnidadMateriaPrima.UNIDAD,
    unidadCompra: UnidadMateriaPrima.PACK,
    precioReferencia: null,
    moneda: 'ARS',
  };
}

function pouchSkuFormat(formato) {
  return formato
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replaceAll(' X ', 'X')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function imanRolloVariants(prefix, variantes, options) {
  return variantes.map(([anchoMm, largo, espesor]) =>
    vir(prefix, anchoMm, largo, espesor, options),
  );
}

function vir(prefix, anchoMm, largo, espesor, options) {
  const recomendada = Boolean(
    options.recomendadas?.has(`${anchoMm}-${largo}-${espesor}`),
  );
  const sku = `${prefix}-${anchoMm}MM-${largo}M-${magnetThicknessSku(espesor)}MM`;
  const formato = `Rollo ${anchoMm} mm × ${largo} m`;
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `${formato} · ${formatNumber(espesor)} mm`,
    formato,
    espesor,
    color: 'Negro',
    recomendada,
    atributosVarianteJson: {
      ancho: anchoMm,
      largo,
      espesor,
      anchoMm,
      largoMm: Math.round(largo * 1000),
      largoRolloMm: Math.round(largo * 1000),
    },
    unidadStock: UnidadMateriaPrima.METRO_LINEAL,
    unidadCompra: UnidadMateriaPrima.ROLLO,
    precioReferencia: null,
    moneda: 'ARS',
  };
}

function imanRedondoVariants(prefix, variantes, options) {
  return variantes.map(
    ([diametro, espesor, grado, adhesivo, unidadesPorPack]) =>
      vid(prefix, diametro, espesor, grado, adhesivo, unidadesPorPack, options),
  );
}

function vid(
  prefix,
  diametro,
  espesor,
  grado,
  adhesivo,
  unidadesPorPack,
  options,
) {
  const recommendationKey = grado
    ? `${diametro}-${espesor}-${grado}-${adhesivo}`
    : `${diametro}-${espesor}-${adhesivo}`;
  const recomendada = Boolean(options.recomendadas?.has(recommendationKey));
  const adhesiveSku = adhesivo ? 'ADH' : 'SINADH';
  const gradeSku = grado ? `-${grado}` : '';
  const sku = `${prefix}-${diametro}X${magnetThicknessSku(espesor)}MM${gradeSku}-${adhesiveSku}-X${unidadesPorPack}`;
  const formato = `Disco ${diametro} × ${formatNumber(espesor)} mm`;
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: [
      formato,
      grado,
      adhesivo ? 'adhesivo' : 'sin adhesivo',
      `pack x ${unidadesPorPack}`,
    ]
      .filter(Boolean)
      .join(' · '),
    formato,
    espesor,
    color: options.color,
    recomendada,
    atributosVarianteJson: {
      diametro,
      espesor,
      grado,
      adhesivo,
      unidadesPorPack,
    },
    unidadStock: UnidadMateriaPrima.UNIDAD,
    unidadCompra: UnidadMateriaPrima.PACK,
    precioReferencia: null,
    moneda: 'ARS',
  };
}

function magnetThicknessSku(value) {
  return String(value).replace('.', 'P');
}

function formatNumber(value) {
  return Number.isInteger(value)
    ? String(value)
    : String(value).replace('.', ',');
}

function sheetVariants(prefix, formatos, gramajes, options) {
  return formatos.flatMap((formato) =>
    gramajes.map((gramaje) => vh(prefix, formato, gramaje, options)),
  );
}

function vh(prefix, formato, gramaje, options) {
  const size = sheetSizeCm(formato);
  const recomendada = Boolean(
    options.recomendadas?.has(`${formato}-${gramaje}`),
  );
  const acabadoCode = options.acabado.toUpperCase().startsWith('BR')
    ? 'B'
    : 'M';
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
    moneda: 'ARS',
  };
}

function sheetSizeCm(formato) {
  const sizes = {
    A4: { ancho: 21, alto: 29.7 },
    A3: { ancho: 29.7, alto: 42 },
    SRA3: { ancho: 32.5, alto: 47.5 },
    '65 x 95 cm': { ancho: 65, alto: 95 },
    '72 x 102 cm': { ancho: 72, alto: 102 },
    '50 x 70 cm': { ancho: 50, alto: 70 },
    '65 x 45 cm': { ancho: 65, alto: 45 },
    '22 x 34 cm': { ancho: 22, alto: 34 },
  };
  return sizes[formato];
}

function sheetSkuSize(formato) {
  return formato
    .replaceAll(' ', '')
    .replaceAll('x', 'X')
    .replaceAll('cm', '')
    .replaceAll('.', 'P');
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
        tipoTecnico: preset.tipoTecnico ?? 'sustrato_rigido',
        templateId: preset.templateId ?? 'sustrato_rigido_v1',
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

module.exports = { seedMaterialPresets, materialPresets: presets };
