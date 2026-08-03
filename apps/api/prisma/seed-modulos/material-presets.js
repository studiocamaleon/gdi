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
    variantes: [
      // Blanco: medidas y gramajes estándar.
      ...sheetVariants(
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
      // Blanco: medida 22 x 34 cm sólo en 75 g.
      ...sheetVariants('OBRA', ['22 x 34 cm'], [75], {
        material: 'Papel obra',
        color: 'Blanco',
        acabado: 'Mate',
        recomendadas: new Set(['22 x 34 cm-75']),
      }),
      // Color (genérico, cualquier color vale lo mismo): A4 y 22 x 34 cm, en
      // 75 y 80 g (papelería a color típica).
      ...sheetColorVariants('OBRA', ['A4', '22 x 34 cm'], [75, 80], ['Color'], {
        material: 'Papel obra',
        acabado: 'Mate',
        recomendadas: new Set(['A4-75-Color', '22 x 34 cm-75-Color']),
      }),
    ],
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
    variantes: [
      // Color base (Blanco): SKU sin sufijo de color.
      ...sheetVariants('AUTO-CB', ['22 x 34 cm'], [56, 60], {
        material: 'Autocopiativo CB',
        color: 'Blanco',
        acabado: 'Mate',
        recomendadas: new Set(['22 x 34 cm-56']),
      }),
      // Color (genérico): cualquier color no-blanco al mismo precio.
      ...sheetColorVariants('AUTO-CB', ['22 x 34 cm'], [56, 60], ['Color'], {
        material: 'Autocopiativo CB',
        acabado: 'Mate',
      }),
    ],
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
    variantes: [
      // Color base (Blanco): SKU sin sufijo de color.
      ...sheetVariants('AUTO-CFB', ['22 x 34 cm'], [56, 60], {
        material: 'Autocopiativo CFB',
        color: 'Blanco',
        acabado: 'Mate',
        recomendadas: new Set(['22 x 34 cm-56']),
      }),
      // Color (genérico): cualquier color no-blanco al mismo precio.
      ...sheetColorVariants('AUTO-CFB', ['22 x 34 cm'], [56, 60], ['Color'], {
        material: 'Autocopiativo CFB',
        acabado: 'Mate',
      }),
    ],
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
    variantes: [
      // Color base (Blanco): SKU sin sufijo de color.
      ...sheetVariants('AUTO-CF', ['22 x 34 cm'], [56, 60], {
        material: 'Autocopiativo CF',
        color: 'Blanco',
        acabado: 'Mate',
        recomendadas: new Set(['22 x 34 cm-56']),
      }),
      // Color (genérico): cualquier color no-blanco al mismo precio.
      ...sheetColorVariants('AUTO-CF', ['22 x 34 cm'], [56, 60], ['Color'], {
        material: 'Autocopiativo CF',
        acabado: 'Mate',
      }),
    ],
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
    key: 'PAPEL_OPP',
    nombreCanonico: 'Papel OPP',
    descripcionCorta:
      'Láminas de OPP en hojas para tapas y terminación de blocks, talonarios, anotadores y encuadernados. Lisos, metalizados y holográficos.',
    iconKind: 'film',
    aliasDisponibles: [
      'Papel OPP',
      'OPP',
      'Polipropileno biorientado',
      'OPP holográfico',
      'OPP metalizado',
      'Lámina OPP',
    ],
    usosRecomendados: ['emblocado', 'encuadernacion', 'terminacion_editorial'],
    procesosCompatibles: [
      'trabajo_manual',
      'terminacion_editorial',
      'guillotina',
    ],
    advertencias: [],
    ...sheetPresetMeta('opp'),
    variantes: oppVariants(),
  },
  {
    key: 'CARTON_EMBLOCADO',
    nombreCanonico: 'Cartón para emblocado',
    descripcionCorta:
      'Cartón gris rígido para contratapa de blocks, anotadores y talonarios. Se consume por pila de emblocado (1 cartón del tamaño del pliego por pila).',
    iconKind: 'layered',
    aliasDisponibles: [
      'Cartón para emblocado',
      'Cartón gris',
      'Cartón contratapa',
      'Cartón de fondo',
      'Cartón piedra',
    ],
    usosRecomendados: ['emblocado', 'talonarios', 'anotadores'],
    procesosCompatibles: ['trabajo_manual', 'guillotina'],
    advertencias: [],
    familia: FamiliaMateriaPrima.TERMINACION_EDITORIAL,
    subfamilia: SubfamiliaMateriaPrima.COMPONENTE_EDITORIAL,
    tipoTecnico: 'carton_emblocado',
    templateId: 'componente_editorial_hoja_v1',
    variantes: cartonEmblocadoVariants(),
  },
  {
    key: 'GANCHO_EMBLOCADO',
    nombreCanonico: 'Ganchos de emblocado',
    descripcionCorta:
      'Ganchos metálicos para colgar blocks y calendarios emblocados. Distintas medidas, se compran por caja de 1000 unidades.',
    iconKind: 'plastic',
    aliasDisponibles: [
      'Gancho de emblocado',
      'Gancho calendario',
      'Percha de calendario',
      'Gancho metálico',
      'Varilla de calendario',
    ],
    usosRecomendados: ['emblocado', 'calendarios', 'anotadores'],
    procesosCompatibles: ['trabajo_manual'],
    advertencias: [],
    familia: FamiliaMateriaPrima.TERMINACION_EDITORIAL,
    subfamilia: SubfamiliaMateriaPrima.COMPONENTE_EDITORIAL,
    tipoTecnico: 'gancho_emblocado',
    templateId: 'componente_editorial_v1',
    variantes: ganchoEmblocadoVariants(),
  },
  {
    key: 'BROCHE_ABROCHADO',
    nombreCanonico: 'Broches para abrochado',
    descripcionCorta:
      'Broches metálicos para abrochadoras de escritorio y de golpe (talonarios, blocks, cuadernillos). Medida calibre/pata, caja x 1000.',
    iconKind: 'plastic',
    aliasDisponibles: [
      'Broches',
      'Grapas',
      'Broches para abrochadora',
      'Ganchitos',
      'Staples',
    ],
    usosRecomendados: ['abrochado', 'talonarios', 'cuadernillos'],
    procesosCompatibles: ['trabajo_manual', 'terminacion_editorial'],
    advertencias: [],
    familia: FamiliaMateriaPrima.TERMINACION_EDITORIAL,
    subfamilia: SubfamiliaMateriaPrima.COMPONENTE_EDITORIAL,
    tipoTecnico: 'broche_abrochado',
    templateId: 'componente_editorial_v1',
    variantes: brocheVariants(),
  },
  {
    // Biblioteca de espirales plásticos (paso 4:1) para el paso encuadernado_anillado
    // y el "Anillado" del centro de copiado. La capacidad (hojas a 80g) sale de la
    // tabla de la industria y es EDITABLE por el tenant (varía por fabricante/gramaje).
    // Ver docs/anilladora-encuadernacion-espiral-diseno.md.
    key: 'ESPIRAL_PLASTICO',
    nombreCanonico: 'Espiral plástico (anillado)',
    descripcionCorta:
      'Espirales de PVC paso 4:1 para encuadernación por anillo. La capacidad (hojas a 80g) es editable por variante.',
    iconKind: 'plastic',
    aliasDisponibles: [
      'Espiral',
      'Espiral plástico',
      'Coil',
      'PVC coil',
      'Anillado plástico',
    ],
    usosRecomendados: ['anillado', 'encuadernacion', 'centro_copiado'],
    procesosCompatibles: ['encuadernado_anillado'],
    advertencias: [
      'La capacidad en hojas es a 80g; con papel más pesado baja ~15-20%.',
    ],
    familia: FamiliaMateriaPrima.TERMINACION_EDITORIAL,
    subfamilia: SubfamiliaMateriaPrima.ANILLADO_ENCUADERNACION,
    tipoTecnico: 'anillado_encuadernacion',
    templateId: 'anillado_encuadernacion_v1',
    variantes: espiralPlasticoVariants(),
  },
  {
    key: 'ESPIRAL_WIRE_O',
    nombreCanonico: 'Wire-O (anillo metálico doble)',
    descripcionCorta:
      'Anillo metálico doble para encuadernación premium (paso 3:1, y 2:1 en los Ø grandes). La capacidad (hojas a 80g) es editable por variante.',
    iconKind: 'objeto',
    aliasDisponibles: [
      'Wire-O',
      'Doble anillo',
      'Anillo metálico',
      'Doble O',
      'Doble bucle',
    ],
    usosRecomendados: ['anillado', 'encuadernacion', 'centro_copiado'],
    procesosCompatibles: ['encuadernado_anillado'],
    advertencias: [
      'La capacidad en hojas es a 80g; con papel más pesado baja ~15-20%.',
      'El Wire-O no lleva tapa/contratapa plástica (encuadernación premium).',
    ],
    familia: FamiliaMateriaPrima.TERMINACION_EDITORIAL,
    subfamilia: SubfamiliaMateriaPrima.ANILLADO_ENCUADERNACION,
    tipoTecnico: 'anillado_encuadernacion',
    templateId: 'anillado_encuadernacion_v1',
    variantes: wireOVariants(),
  },
  {
    key: 'TAPA_ENCUADERNACION_TRANSPARENTE',
    nombreCanonico: 'Tapa transparente (encuadernación)',
    descripcionCorta:
      'Tapa frontal de polipropileno transparente para anillado. Viene en A4, Oficio y A3 (se elige por el tamaño del documento).',
    iconKind: 'transparent',
    aliasDisponibles: [
      'Tapa transparente',
      'Portada transparente',
      'Tapa PVC',
      'Acetato',
      'Tapa cristal',
    ],
    usosRecomendados: ['anillado', 'encuadernacion', 'centro_copiado'],
    procesosCompatibles: ['encuadernado_anillado'],
    advertencias: [],
    familia: FamiliaMateriaPrima.TERMINACION_EDITORIAL,
    subfamilia: SubfamiliaMateriaPrima.TAPA_ENCUADERNACION,
    tipoTecnico: 'tapa_encuadernacion',
    templateId: 'tapa_encuadernacion_v1',
    variantes: tapaEncuadernacionVariants('transparente', 'Transparente'),
  },
  {
    key: 'CONTRATAPA_ENCUADERNACION_COLOR',
    nombreCanonico: 'Contratapa opaca de color (encuadernación)',
    descripcionCorta:
      'Contratapa de polipropileno opaco (negro) para anillado. Viene en A4, Oficio y A3. Duplicá el material para ofrecer otros colores.',
    iconKind: 'plastic',
    aliasDisponibles: [
      'Contratapa',
      'Contratapa negra',
      'Tapa posterior',
      'Respaldo',
      'Contraportada',
    ],
    usosRecomendados: ['anillado', 'encuadernacion', 'centro_copiado'],
    procesosCompatibles: ['encuadernado_anillado'],
    advertencias: [],
    familia: FamiliaMateriaPrima.TERMINACION_EDITORIAL,
    subfamilia: SubfamiliaMateriaPrima.TAPA_ENCUADERNACION,
    tipoTecnico: 'tapa_encuadernacion',
    templateId: 'tapa_encuadernacion_v1',
    variantes: tapaEncuadernacionVariants('negro', 'Negro'),
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
    key: 'TELA_BANDERA',
    nombreCanonico: 'Tela de bandera',
    descripcionCorta:
      'Tela de poliéster para banderas, flags publicitarios y wind banners. Liviana, con buena caída; impresión por sublimación o directa.',
    iconKind: 'banner',
    aliasDisponibles: [
      'Tela de bandera',
      'Tela bandera',
      'Bandera',
      'Tela para banderas',
      'Poliéster bandera',
      'Flag',
      'Wind banner',
      'Tela flag',
      'Tela sublimable',
    ],
    usosRecomendados: ['lonas_banners', 'rollups_displays', 'pop_signage'],
    procesosCompatibles: ['impresion_directa_uv', 'corte_digital'],
    advertencias: [],
    ...rollPresetMeta('tela_bandera'),
    variantes: rollVariants('TELA-BANDERA', [1.52], {
      largo: 50,
      acabado: 'Bandera',
      color: 'Blanco',
      recomendadas: new Set([1.52]),
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
  selloLineaTrodatPreset({
    key: 'TRODAT_PRINTY_40',
    nombreCanonico: 'Trodat Printy 4.0',
    descripcionCorta:
      'Sellos autoentintables Trodat línea Printy 4.0: rectangulares, redondos, ovalados y fechadores con placa de texto.',
    alias: ['Printy', 'Printy 4.0', 'Sello automático Trodat'],
    modelos: [
      ['TRODAT-4910', 'Printy 4910', 26, 9, 'Rectangular', 6000, false],
      ['TRODAT-4911', 'Printy 4911', 38, 14, 'Rectangular', 6100, true],
      ['TRODAT-4912', 'Printy 4912', 47, 18, 'Rectangular', 7300, true],
      ['TRODAT-4913', 'Printy 4913', 58, 22, 'Rectangular', 11000, true],
      ['TRODAT-4914', 'Printy 4914', 64, 26, 'Rectangular', 22500, false],
      ['TRODAT-4915', 'Printy 4915', 70, 25, 'Rectangular', 26500, true],
      ['TRODAT-4916', 'Printy 4916', 70, 10, 'Rectangular', 19000, false],
      ['TRODAT-4918', 'Printy 4918', 75, 15, 'Rectangular', 21500, false],
      ['TRODAT-4921', 'Printy 4921', 12, 12, 'Rectangular', 11500, false],
      ['TRODAT-4922', 'Printy 4922', 20, 20, 'Rectangular', 16000, false],
      ['TRODAT-4923', 'Printy 4923', 30, 30, 'Rectangular', 19000, false],
      ['TRODAT-4924', 'Printy 4924', 40, 40, 'Rectangular', 51200, false],
      ['TRODAT-4925', 'Printy 4925', 82, 25, 'Rectangular', 50300, false],
      ['TRODAT-4926', 'Printy 4926', 75, 38, 'Rectangular', 32000, false],
      ['TRODAT-4927', 'Printy 4927', 60, 40, 'Rectangular', 29500, false],
      ['TRODAT-4928', 'Printy 4928', 60, 33, 'Rectangular', 49300, false],
      ['TRODAT-4929', 'Printy 4929', 50, 30, 'Rectangular', 46300, false],
      ['TRODAT-4931', 'Printy 4931', 70, 30, 'Rectangular', 26500, false],
      ['TRODAT-4941', 'Printy 4941', 41, 24, 'Rectangular', 22000, false],
      ['TRODAT-46019', 'Printy 46019', 19, 19, 'Redondo', 28100, false],
      ['TRODAT-46025', 'Printy 46025', 25, 25, 'Redondo', 31000, false],
      ['TRODAT-4630', 'Printy 4630', 30, 30, 'Redondo', 35100, true],
      ['TRODAT-46040', 'Printy 46040', 40, 40, 'Redondo', 21800, false],
      ['TRODAT-4642', 'Printy 4642', 42, 42, 'Redondo', 32000, false],
      ['TRODAT-46050', 'Printy 46050 (sin almohadilla)', 50, 50, 'Redondo', 23000, false],
      ['TRODAT-44045', 'Printy 44045', 45, 30, 'Ovalado', 32500, false],
      ['TRODAT-44055', 'Printy 44055', 55, 35, 'Ovalado', 37500, false],
      ['TRODAT-46130', 'Printy fechador 46130', 30, 30, 'Redondo', 26000, false],
      ['TRODAT-46140', 'Printy fechador 46140', 40, 40, 'Redondo', 36000, false],
      ['TRODAT-46145', 'Printy fechador 46145', 45, 45, 'Redondo', 45000, false],
      ['TRODAT-4726', 'Printy fechador 4726', 75, 38, 'Rectangular', 46000, false],
      ['TRODAT-4727', 'Printy fechador 4727', 60, 40, 'Rectangular', 29500, false],
      ['TRODAT-4729', 'Printy fechador 4729', 50, 30, 'Rectangular', 37500, false],
      ['TRODAT-4750', 'Printy fechador 4750', 41, 24, 'Rectangular', 34000, false],
      ['TRODAT-4850', 'Printy fechador 4850', 25, 5, 'Rectangular', 20000, false],
    ],
  }),
  selloLineaTrodatPreset({
    key: 'TRODAT_PRINTY_CLASICOS',
    nombreCanonico: 'Trodat Printy Clásicos',
    descripcionCorta:
      'Sellos autoentintables Trodat línea Printy clásica (generación anterior a 4.0).',
    alias: ['Printy Clásico', 'Printy clásicos'],
    modelos: [
      ['TRODAT-4910-CL', 'Printy 4910 Clásico', 26, 9, 'Rectangular', 4300, false],
      ['TRODAT-4911-CL', 'Printy 4911 Clásico', 38, 14, 'Rectangular', 4800, true],
      ['TRODAT-4912-CL', 'Printy 4912 Clásico', 47, 18, 'Rectangular', 6000, true],
      ['TRODAT-4913-CL', 'Printy 4913 Clásico', 58, 23, 'Rectangular', 17700, false],
      ['TRODAT-4724', 'Printy fechador 4724', 40, 40, 'Rectangular', 35000, false],
    ],
  }),
  selloLineaTrodatPreset({
    key: 'TRODAT_PRINTY_ECO',
    nombreCanonico: 'Trodat Printy Eco',
    descripcionCorta:
      'Sellos autoentintables Trodat línea Eco (económica, plástico reciclado).',
    alias: ['Printy Eco', 'Línea Eco'],
    modelos: [
      ['TRODAT-3911', 'Printy Eco 3911', 38, 14, 'Rectangular', 3700, true],
      ['TRODAT-3912', 'Printy Eco 3912', 47, 18, 'Rectangular', 5400, true],
      ['TRODAT-3913', 'Printy Eco 3913', 58, 22, 'Rectangular', 6800, false],
      ['TRODAT-3915', 'Printy Eco 3915', 70, 25, 'Rectangular', 10500, false],
      ['TRODAT-3927', 'Printy Eco 3927', 60, 40, 'Rectangular', 17000, false],
      ['TRODAT-3445', 'Printy Eco 3445', 45, 30, 'Ovalado', 19000, false],
      ['TRODAT-3638', 'Printy Eco 3638', 38, 38, 'Redondo', 16000, false],
      ['TRODAT-3642', 'Printy Eco 3642', 42, 42, 'Redondo', 18000, false],
    ],
  }),
  selloLineaTrodatPreset({
    key: 'TRODAT_MICRO_PRINTY',
    nombreCanonico: 'Trodat Micro Printy',
    descripcionCorta: 'Sellos redondos compactos de bolsillo Trodat Micro Printy.',
    alias: ['Micro Printy'],
    modelos: [
      ['TRODAT-9330', 'Micro Printy 9330', 30, 30, 'Redondo', 13000, true],
      ['TRODAT-9342', 'Micro Printy 9342', 42, 42, 'Redondo', 16000, false],
    ],
  }),
  selloLineaTrodatPreset({
    key: 'TRODAT_MOBILE_PRINTY',
    nombreCanonico: 'Trodat Mobile Printy',
    descripcionCorta: 'Sellos de bolsillo Trodat Mobile Printy.',
    alias: ['Mobile Printy', 'Sello de bolsillo'],
    modelos: [
      ['TRODAT-9411', 'Mobile Printy 9411', 38, 14, 'Rectangular', 603, true],
      ['TRODAT-9412', 'Mobile Printy 9412', 47, 18, 'Rectangular', 804, true],
      ['TRODAT-9430', 'Mobile Printy 9430', 30, 30, 'Redondo', 808, false],
    ],
  }),
  selloLineaTrodatPreset({
    key: 'TRODAT_POCKET_PRINTY',
    nombreCanonico: 'Trodat Pocket Printy',
    descripcionCorta: 'Sello de bolsillo plano Trodat Pocket Printy.',
    alias: ['Pocket Printy'],
    modelos: [
      ['TRODAT-9511', 'Pocket Printy 9511', 38, 14, 'Rectangular', 6900, true],
    ],
  }),
  selloLineaTrodatPreset({
    key: 'TRODAT_IMPRINT',
    nombreCanonico: 'Imprint by Trodat',
    descripcionCorta: 'Línea económica Imprint by Trodat.',
    alias: ['Imprint'],
    modelos: [
      ['TRODAT-8910', 'Imprint 8910', 26, 9, 'Rectangular', 5100, false],
      ['TRODAT-8911', 'Imprint 8911', 38, 14, 'Rectangular', 5300, true],
      ['TRODAT-8912', 'Imprint 8912', 47, 18, 'Rectangular', 6700, true],
    ],
  }),
  selloLineaTrodatPreset({
    key: 'TRODAT_PROFESSIONAL',
    nombreCanonico: 'Trodat Professional',
    descripcionCorta:
      'Sellos autoentintables de estructura metálica Trodat Professional, formatos grandes y fechadores/numeradores con placa.',
    alias: ['Professional', 'Línea Professional'],
    modelos: [
      ['TRODAT-5203', 'Professional 5203', 49, 28, 'Rectangular', 24000, true],
      ['TRODAT-5204', 'Professional 5204', 56, 26, 'Rectangular', 25500, false],
      ['TRODAT-5205', 'Professional 5205', 68, 24, 'Rectangular', 28000, false],
      ['TRODAT-5206', 'Professional 5206', 56, 33, 'Rectangular', 48800, false],
      ['TRODAT-5207', 'Professional 5207', 60, 40, 'Rectangular', 57000, false],
      ['TRODAT-5208', 'Professional 5208', 68, 47, 'Rectangular', 71200, false],
      ['TRODAT-5211', 'Professional 5211', 85, 55, 'Rectangular', 42000, false],
      ['TRODAT-5212', 'Professional 5212', 116, 70, 'Rectangular', 44000, false],
      ['TRODAT-5215', 'Professional 5215', 45, 45, 'Redondo', 38000, false],
      ['TRODAT-5558', 'Professional numerador 5558', 56, 33, 'Rectangular', 82000, false],
      ['TRODAT-54110', 'Professional fechador 54110', 85, 55, 'Rectangular', 62000, false],
      ['TRODAT-5415', 'Professional fechador 5415', 45, 45, 'Redondo', 48000, false],
      ['TRODAT-5431', 'Professional fechador 5431', 41, 24, 'Rectangular', 39000, false],
      ['TRODAT-5440', 'Professional fechador 5440', 48, 28, 'Rectangular', 44000, false],
      ['TRODAT-5460', 'Professional fechador 5460', 56, 33, 'Rectangular', 47000, false],
      ['TRODAT-5470', 'Professional fechador 5470', 60, 40, 'Rectangular', 50000, false],
      ['TRODAT-5474', 'Professional fechador 5474', 60, 40, 'Rectangular', 50000, false],
      ['TRODAT-5480', 'Professional fechador 5480', 68, 47, 'Rectangular', 103000, false],
    ],
  }),
  {
    key: 'SELLO_MANUAL_MADERA',
    nombreCanonico: 'Sello manual con mango de madera',
    descripcionCorta:
      'Sello tradicional: goma grabada montada sobre mango de madera. Usa almohadilla aparte.',
    iconKind: 'stamp',
    aliasDisponibles: ['Sello de madera', 'Sello manual', 'Sello con mango'],
    usosRecomendados: ['sellos_artesanales', 'sellos_comerciales'],
    procesosCompatibles: ['grabado_laser', 'montaje_sobre_sustrato'],
    advertencias: [],
    ...selloManualPresetMeta(),
    variantes: [
      vselloManual('SELLO-MAD-3030', 'Genérica', 'Mango madera 30 mm', 30, 30, 3, 'Madera', true),
      vselloManual('SELLO-MAD-4040', 'Genérica', 'Mango madera 40 mm', 40, 40, 4, 'Madera', true),
      vselloManual('SELLO-MAD-6040', 'Genérica', 'Mango madera 60×40 mm', 60, 40, 5, 'Madera', false),
    ],
  },
  {
    key: 'GOMA_LASERABLE',
    nombreCanonico: 'Goma laserable Trodat',
    descripcionCorta:
      'Hoja de goma para grabar el cliché del sello con láser CO2. Tipos según tinta/uso. Se consume por área.',
    iconKind: 'stamp',
    aliasDisponibles: ['Goma laser', 'Caucho laserable', 'Laser rubber', 'Goma Trodat'],
    usosRecomendados: ['fabricacion_sellos'],
    procesosCompatibles: ['grabado_laser'],
    advertencias: [
      'Usar solo en láser CO2; verificar espesor compatible con la máquina.',
      'Medidas de hoja de referencia (A4): verificar el formato real de la hoja del proveedor.',
      'Precios de referencia del proveedor Sellos Multicolor (2026-07).',
    ],
    ...gomaLaserablePresetMeta(),
    variantes: [
      vgoma('GOMA-TRODAT-CLASICA-23', 'Clásica', 2.3, 210, 297, 23000, true),
      vgoma('GOMA-TRODAT-AERO-23', 'Aero sin olor', 2.3, 210, 297, 29700, true),
      vgoma('GOMA-TRODAT-TEMPO-23', 'Tempo rápida', 2.3, 210, 297, 27000, false),
      vgoma('GOMA-TRODAT-OLIO-23', 'Olio tinta indeleble', 2.3, 210, 297, 35000, false),
      vgoma('GOMA-TRODAT-CLASICA-15', 'Clásica bolígrafos', 1.5, 210, 297, 24000, false),
      vgoma('GOMA-TRODAT-AERO-50', 'Aero bolsas', 5, 210, 297, 57500, false),
    ],
  },
  repuestoAlmohadillaPreset({
    key: 'TRODAT_REPUESTOS_PRINTY',
    nombreCanonico: 'Repuestos de almohadilla Trodat Printy',
    descripcionCorta:
      'Almohadillas de recambio por modelo para las líneas Printy 4.0, Clásicos y Eco (código 6/<modelo>).',
    alias: ['Repuesto almohadilla', 'Almohadilla Printy', '6/4911'],
    // [sku, códigoRepuesto, modeloCompatible, colorTinta, precioARS, recomendada]
    repuestos: [
      ['REP-6-3638-NEGRO', '6/3638', 'Printy Eco 3638', 'Negro', 3500, false],
      ['REP-6-3642-NEGRO', '6/3642', 'Printy Eco 3642', 'Negro', 2400, false],
      ['REP-6-3911-NEGRO', '6/3911', 'Printy Eco 3911', 'Negro', 2200, true],
      ['REP-6-3912-NEGRO', '6/3912', 'Printy Eco 3912', 'Negro', 2600, true],
      ['REP-6-3913-NEGRO', '6/3913', 'Printy Eco 3913', 'Negro', 3300, false],
      ['REP-6-3915-NEGRO', '6/3915', 'Printy Eco 3915', 'Negro', 2900, false],
      ['REP-6-3927-NEGRO', '6/3927', 'Printy Eco 3927', 'Negro', 3600, false],
      ['REP-6-44055-MCI', '6/44055', 'Printy 44055', 'MCI', 17600, false],
      ['REP-6-46040-MCI', '6/46040', 'Printy 46040', 'MCI', 14900, false],
      ['REP-6-46045-MCI', '6/46045', 'Printy 46145', 'MCI', 17800, false],
      ['REP-6-46050-NEGRO', '6/46050', 'Printy 46050', 'Negro', 10500, false],
      ['REP-6-4630-MCI', '6/4630', 'Printy 4630', 'MCI', 10800, false],
      ['REP-6-4630-NEGRO', '6/4630', 'Printy 4630', 'Negro', 5500, false],
      ['REP-6-4630-NEUTRO', '6/4630', 'Printy 4630', 'Neutro', 5500, false],
      ['REP-6-4850-NEGRO', '6/4850', 'Printy fechador 4850', 'Negro', 4300, false],
      ['REP-6-4910-NEGRO', '6/4910', 'Printy 4910', 'Negro', 4300, false],
      ['REP-6-4911-NEGRO', '6/4911', 'Printy 4911', 'Negro', 4300, true],
      ['REP-6-4911-NEGRO-CM', '6/4911 Clothing Marker', 'Trodat 4911 Stamp n Stick', 'Negro', 7900, false],
      ['REP-6-4911-NEUTRO', '6/4911', 'Printy 4911', 'Neutro', 4300, false],
      ['REP-6-4911-NEUTRO-ESP', '6/4911 Esponja', 'Printy 4911', 'Neutro', 4300, false],
      ['REP-6-4912-MCI', '6/4912', 'Printy 4912', 'MCI', 9500, false],
      ['REP-6-4912-NEGRO', '6/4912', 'Printy 4912', 'Negro', 4800, true],
      ['REP-6-4912-NEUTRO', '6/4912', 'Printy 4912', 'Neutro', 4800, false],
      ['REP-6-4913-MCI', '6/4913', 'Printy 4913', 'MCI', 10900, false],
      ['REP-6-4913-NEGRO', '6/4913', 'Printy 4913', 'Negro', 5600, true],
      ['REP-6-4913-NEUTRO', '6/4913', 'Printy 4913', 'Neutro', 5700, false],
      ['REP-6-4915-MCI', '6/4915', 'Printy 4915', 'MCI', 14500, false],
      ['REP-6-4915-NEGRO', '6/4915', 'Printy 4915', 'Negro', 7000, false],
      ['REP-6-4916-NEGRO', '6/4916', 'Printy 4916', 'Negro', 6400, false],
      ['REP-6-4922-NEGRO', '6/4922', 'Printy 4922', 'Negro', 4900, false],
      ['REP-6-4923-NEGRO', '6/4923', 'Printy 4923', 'Negro', 5600, false],
      ['REP-6-4924-NEGRO', '6/4924', 'Printy 4924', 'Negro', 7500, false],
      ['REP-6-4924-NEUTRO', '6/4924', 'Printy 4924', 'Neutro', 7500, false],
      ['REP-6-4925-MCI', '6/4925', 'Printy 4925', 'MCI', 15600, false],
      ['REP-6-4926-NEGRO', '6/4926', 'Printy 4926', 'Negro', 8700, false],
      ['REP-6-4926-NEUTRO', '6/4926', 'Printy 4926', 'Neutro', 8700, false],
      ['REP-6-4927-BICOLOR', '6/4927', 'Printy 4927', 'Bicolor', 13800, false],
      ['REP-6-4927-NEGRO', '6/4927', 'Printy 4927', 'Negro', 7900, false],
      ['REP-6-4927-NEUTRO', '6/4927', 'Printy 4927', 'Neutro', 7900, false],
      ['REP-6-4928-MCI', '6/4928', 'Printy 4928', 'MCI', 15600, false],
      ['REP-6-4928-NEGRO', '6/4928', 'Printy 4928', 'Negro', 7900, false],
      ['REP-6-4928-NEUTRO', '6/4928', 'Printy 4928', 'Neutro', 7900, false],
      ['REP-6-4929-MCI', '6/4929', 'Printy 4929', 'MCI', 14000, false],
      ['REP-6-4929-NEGRO', '6/4929', 'Printy 4929', 'Negro', 7100, false],
      ['REP-6-4929-NEUTRO', '6/4929', 'Printy 4929', 'Neutro', 7100, false],
    ],
  }),
  repuestoAlmohadillaPreset({
    key: 'TRODAT_REPUESTOS_PROFESSIONAL',
    nombreCanonico: 'Repuestos de almohadilla Trodat Professional',
    descripcionCorta:
      'Almohadillas de recambio para la línea Professional (códigos 6/5x).',
    alias: ['Repuesto almohadilla Professional'],
    repuestos: [
      ['REP-6-15-MCI', '6/15', 'Professional 5215 / 5415', 'MCI', 10200, false],
      ['REP-6-50-MCI', '6/50', null, 'MCI', 5200, false],
      ['REP-6-511-MCI', '6/511', 'Professional 5211 / 54110', 'MCI', 23000, false],
      ['REP-6-511-NEUTRO', '6/511', 'Professional 5211 / 54110', 'Neutro', 12600, false],
      ['REP-6-53-MCI', '6/53', 'Professional 5203', 'MCI', 5200, true],
      ['REP-6-55-MCI', '6/55', 'Professional 5205', 'MCI', 7000, false],
      ['REP-6-56-MCI', '6/56', 'Professional 5206 / 5460 / 5558', 'MCI', 6000, true],
      ['REP-6-56-NEGRO', '6/56', 'Professional 5206 / 5460 / 5558', 'Negro', 6000, false],
      ['REP-6-56-2-BICOLOR', '6/56/2', 'Professional 5206 / 5460', 'Bicolor', 10500, false],
      ['REP-6-57-MCI', '6/57', 'Professional 5207 / 5470 / 5474', 'MCI', 7400, false],
      ['REP-6-58-MCI', '6/58', 'Professional 5208 / 5480', 'MCI', 10800, false],
      ['REP-6-58-NEGRO', '6/58', 'Professional 5208 / 5480', 'Negro', 10800, false],
    ],
  }),
  repuestoAlmohadillaPreset({
    key: 'TRODAT_REPUESTOS_MOBILE_POCKET',
    nombreCanonico: 'Repuestos de almohadilla Trodat Mobile / Pocket Printy',
    descripcionCorta:
      'Almohadillas de recambio para los sellos de bolsillo Mobile Printy y Pocket Printy.',
    alias: ['Repuesto almohadilla Mobile Printy', 'Repuesto almohadilla Pocket'],
    repuestos: [
      ['REP-6-9411-NEGRO', '6/9411', 'Mobile Printy 9411', 'Negro', 4300, true],
      ['REP-6-9412-MCI', '6/9412', 'Mobile Printy 9412', 'MCI', 9500, false],
      ['REP-6-9412-NEGRO', '6/9412', 'Mobile Printy 9412', 'Negro', 5000, true],
      ['REP-6-9430-NEGRO', '6/9430', 'Mobile Printy 9430', 'Negro', 5500, false],
      ['REP-6-9430-NEUTRO', '6/9430', 'Mobile Printy 9430', 'Neutro', 10800, false],
      ['REP-6-9511-NEGRO', '6/9511', 'Pocket Printy 9511', 'Negro', 4300, false],
    ],
  }),
  {
    key: 'TRODAT_TINTAS',
    nombreCanonico: 'Tintas Trodat para sellos',
    descripcionCorta:
      'Tintas de recarga Trodat en botellita para almohadillas de sellos (7011 general, 7750 telas).',
    iconKind: 'stamp',
    aliasDisponibles: ['Tinta Trodat', 'Tinta 7011', 'Tinta para sellos'],
    usosRecomendados: ['sellos_oficina', 'sellos_comerciales'],
    procesosCompatibles: [],
    advertencias: [
      'Precios de referencia del proveedor Sellos Multicolor (2026-07).',
    ],
    ...tintaSelloPresetMeta(),
    variantes: [
      vtintaSello('TINTA-7011-NEGRO', '7011', 'Negro', 28, 'General', 4900, true),
      vtintaSello('TINTA-7011-AZUL', '7011', 'Azul', 28, 'General', 4900, true),
      vtintaSello('TINTA-7011-ROJO', '7011', 'Rojo', 28, 'General', 4900, false),
      vtintaSello('TINTA-7011-VERDE', '7011', 'Verde', 28, 'General', 4900, false),
      vtintaSello('TINTA-7011-VIOLETA', '7011', 'Violeta', 28, 'General', 4900, false),
      vtintaSello('TINTA-7750-NEGRO', '7750', 'Negro', 28, 'Telas', 9000, false),
    ],
  },
  {
    key: 'TRODAT_ALMOHADILLAS_ESCRITORIO',
    nombreCanonico: 'Almohadillas de escritorio Trodat',
    descripcionCorta:
      'Tampones de escritorio Trodat para sellos manuales (N9051–N9054) y almohadilla dactilar 9094, por tamaño y color de tinta.',
    iconKind: 'stamp',
    aliasDisponibles: ['Trodat', 'Tampón', 'Almohadilla de escritorio', 'N9052'],
    usosRecomendados: ['sellos_oficina', 'sellos_comerciales'],
    procesosCompatibles: [],
    advertencias: [
      'La dactilar 9094 no publica medidas en el proveedor: completarlas al instalar.',
      'Precios de referencia del proveedor Sellos Multicolor (2026-07).',
    ],
    ...almohadillaEscritorioPresetMeta(),
    variantes: [
      ['ALM-N9051-NEGRO', 'N9051', 9, 5, 'Negro', 'Escritorio', 4400, true],
      ['ALM-N9051-AZUL', 'N9051', 9, 5, 'Azul', 'Escritorio', 4400, false],
      ['ALM-N9051-ROJO', 'N9051', 9, 5, 'Rojo', 'Escritorio', 4400, false],
      ['ALM-N9051-VERDE', 'N9051', 9, 5, 'Verde', 'Escritorio', 4400, false],
      ['ALM-N9051-NEUTRO', 'N9051', 9, 5, 'Neutro', 'Escritorio', 4400, false],
      ['ALM-N9052-NEGRO', 'N9052', 11, 7, 'Negro', 'Escritorio', 4700, true],
      ['ALM-N9052-AZUL', 'N9052', 11, 7, 'Azul', 'Escritorio', 4700, false],
      ['ALM-N9052-ROJO', 'N9052', 11, 7, 'Rojo', 'Escritorio', 4700, false],
      ['ALM-N9052-NEUTRO', 'N9052', 11, 7, 'Neutro', 'Escritorio', 4700, false],
      ['ALM-N9053-NEGRO', 'N9053', 16, 9, 'Negro', 'Escritorio', 10700, false],
      ['ALM-N9053-AZUL', 'N9053', 16, 9, 'Azul', 'Escritorio', 10700, false],
      ['ALM-N9053-ROJO', 'N9053', 16, 9, 'Rojo', 'Escritorio', 10700, false],
      ['ALM-N9053-NEUTRO', 'N9053', 16, 9, 'Neutro', 'Escritorio', 10700, false],
      ['ALM-N9054-NEGRO', 'N9054', 21, 14.8, 'Negro', 'Escritorio', 16500, false],
      ['ALM-N9054-NEUTRO', 'N9054', 21, 14.8, 'Neutro', 'Escritorio', 16500, false],
      ['ALM-9094-DACTILAR', '9094', null, null, 'Negro', 'Dactilar', 6700, false],
    ].map(valmohadillaEscritorio),
  },
  portabannerPreset({
    key: 'PORTABANNER_TENSORES',
    nombreCanonico: 'Portabanner de tensores',
    descripcionCorta:
      'Estructuras de tensores (varillas) para banner colgante: simple, doble, vertical, tres y cuatro tensores, en línea estándar y económica.',
    alias: ['Portabanner', 'Tensor', 'Portabanner de varillas'],
    filas: [
      ['PB-TS-60X150', 'Tensor simple', 'Tensor simple', 60, 150, 'Estándar', true],
      ['PB-TS-90X190', 'Tensor simple', 'Tensor simple', 90, 190, 'Estándar', true],
      ['PB-TS-ECO-90X190', 'Tensor simple (Eco)', 'Tensor simple', 90, 190, 'Económica', false],
      ['PB-DT-90X190', 'Doble tensor', 'Doble tensor', 90, 190, 'Estándar', true],
      ['PB-DT-ECO-90X190', 'Doble tensor (Eco)', 'Doble tensor', 90, 190, 'Económica', false],
      ['PB-DT-VERT-150X200', 'Doble tensor vertical', 'Doble tensor vertical', 150, 200, 'Estándar', false],
      ['PB-3T-200X200', 'Tres tensores', 'Tres tensores', 200, 200, 'Estándar', false],
      ['PB-3T-ECO-200X200', 'Tres tensores (Eco)', 'Tres tensores', 200, 200, 'Económica', false],
      ['PB-4T-300X200', 'Cuatro tensores', 'Cuatro tensores', 300, 200, 'Estándar', false],
      ['PB-4T-ECO-300X200', 'Cuatro tensores (Eco)', 'Cuatro tensores', 300, 200, 'Económica', false],
    ],
  }),
  portabannerPreset({
    key: 'PORTABANNER_ROLLUP',
    nombreCanonico: 'Portabanner Roll-Up',
    descripcionCorta:
      'Estructura roll-up autoenrollable con base de aluminio y bolso de transporte.',
    alias: ['Roll-Up', 'Rollup', 'Banner enrollable'],
    filas: [
      ['PB-ROLLUP-85X200', 'Roll-Up', 'Roll-Up', 85, 200, 'Estándar', true],
    ],
  }),
  portabannerPreset({
    key: 'PORTABANNER_FLY_DROP',
    nombreCanonico: 'Fly / Drop banner',
    descripcionCorta:
      'Estructuras con mástil flexible para banners tipo vela y gota (fly banner, drop banner).',
    alias: ['Fly banner', 'Drop banner', 'Bandera vela', 'Bandera gota', 'Potencia'],
    filas: [
      ['PB-FLY-50X260', 'Fly banner', 'Fly banner', 50, 260, 'Estándar', true],
      ['PB-DROP-60X250', 'Drop banner', 'Drop banner', 60, 250, 'Estándar', false],
      ['PB-DROP-GOTA-85X240', 'Drop banner (gota)', 'Drop banner gota', 85, 240, 'Estándar', false],
    ],
  }),
  portabannerPreset({
    key: 'PORTABANNER_BASE_CRUZ',
    nombreCanonico: 'Soporte base cruz',
    descripcionCorta:
      'Base cruz plegable para fly/drop banner y mástiles de vía pública.',
    alias: ['Base cruz', 'Soporte cruz', 'Pie cruz'],
    filas: [
      ['PB-BASE-CRUZ', 'Base cruz', 'Base cruz', null, null, 'Estándar', false],
    ],
  }),

  // ── Merchandising: objetos (Tanda 1, alta demanda) ──────────────────────────
  objetoPreset({
    key: 'MERCH_TAZA_CERAMICA',
    nombre: 'Taza cerámica',
    desc: 'Taza de cerámica blanca para sublimar / DTF UV. Costo por unidad.',
    categoria: 'Drinkware',
    tipoObjeto: 'Taza',
    material: 'Cerámica',
    alias: ['Taza', 'Jarro', 'Mug'],
    tecnicas: ['sublimacion', 'dtf_uv'],
    variantes: [
      { sku: 'TAZA-BLA-350', nombre: 'Taza blanca 350ml', formato: '350 ml', color: 'Blanco', capacidad: 350 },
      { sku: 'TAZA-INT-NEG-350', nombre: 'Taza interior negro 350ml', formato: '350 ml', color: 'Negro', capacidad: 350, modelo: 'Interior de color', recomendada: false },
      { sku: 'TAZA-INT-ROJ-350', nombre: 'Taza interior rojo 350ml', formato: '350 ml', color: 'Rojo', capacidad: 350, modelo: 'Interior de color', recomendada: false },
      { sku: 'TAZA-CON-BLA-350', nombre: 'Taza cónica blanca 350ml', formato: '350 ml', color: 'Blanco', capacidad: 350, modelo: 'Cónica', recomendada: false },
    ],
  }),
  objetoPreset({
    key: 'MERCH_TAZA_MAGICA',
    nombre: 'Taza mágica',
    desc: 'Taza termocrómica: revela la imagen con el calor. Sublimación.',
    categoria: 'Drinkware',
    tipoObjeto: 'Taza',
    material: 'Cerámica',
    alias: ['Taza mágica', 'Taza termocrómica', 'Taza morphing'],
    tecnicas: ['sublimacion'],
    variantes: [
      { sku: 'TAZA-MAG-350', nombre: 'Taza mágica 350ml', formato: '350 ml', color: 'Negro', capacidad: 350 },
    ],
  }),
  objetoPreset({
    key: 'MERCH_TERMO_ACERO',
    nombre: 'Termo de acero',
    desc: 'Termo de acero inoxidable para grabado láser / DTF UV. Por unidad.',
    categoria: 'Drinkware',
    tipoObjeto: 'Termo',
    material: 'Acero inoxidable',
    alias: ['Termo', 'Termo para mate'],
    tecnicas: ['grabado_laser', 'dtf_uv', 'tampografia'],
    variantes: [
      { sku: 'TERMO-PLA-1L', nombre: 'Termo plata 1L', formato: '1 L', color: 'Plata', capacidad: 1000 },
      { sku: 'TERMO-NEG-1L', nombre: 'Termo negro 1L', formato: '1 L', color: 'Negro', capacidad: 1000, recomendada: false },
      { sku: 'TERMO-AZU-1L', nombre: 'Termo azul 1L', formato: '1 L', color: 'Azul', capacidad: 1000, recomendada: false },
    ],
  }),
  objetoPreset({
    key: 'MERCH_BOTELLA_DEPORTIVA',
    nombre: 'Botella deportiva',
    desc: 'Botella / squeeze deportiva para tampografía, DTF UV o láser.',
    categoria: 'Drinkware',
    tipoObjeto: 'Botella',
    material: 'Plástico',
    alias: ['Botella', 'Squeeze', 'Caramañola', 'Bidón'],
    tecnicas: ['tampografia', 'dtf_uv', 'serigrafia'],
    variantes: [
      { sku: 'BOT-NEG-750', nombre: 'Botella negra 750ml', formato: '750 ml', color: 'Negro', capacidad: 750 },
      { sku: 'BOT-BLA-750', nombre: 'Botella blanca 750ml', formato: '750 ml', color: 'Blanco', capacidad: 750, recomendada: false },
      { sku: 'BOT-AZU-750', nombre: 'Botella azul 750ml', formato: '750 ml', color: 'Azul', capacidad: 750, recomendada: false },
    ],
  }),
  objetoPreset({
    key: 'MERCH_MATE',
    nombre: 'Mate',
    desc: 'Mate para grabado láser, sublimación o DTF UV. Por unidad.',
    categoria: 'Drinkware',
    tipoObjeto: 'Mate',
    material: 'Acero inoxidable',
    alias: ['Mate', 'Mate imperial', 'Mate camionero'],
    tecnicas: ['grabado_laser', 'sublimacion', 'dtf_uv'],
    variantes: [
      { sku: 'MATE-IMP-ACE', nombre: 'Mate imperial acero', formato: 'Imperial', color: 'Plata', modelo: 'Imperial' },
      { sku: 'MATE-CAM-ACE', nombre: 'Mate camionero acero', formato: 'Camionero', color: 'Plata', modelo: 'Camionero', recomendada: false },
      { sku: 'MATE-MAD', nombre: 'Mate de madera/algarrobo', formato: 'Madera', color: 'Natural', material: 'Madera', recomendada: false },
    ],
  }),
  objetoPreset({
    key: 'MERCH_VASO_TERMICO',
    nombre: 'Vaso térmico (tumbler)',
    desc: 'Vaso térmico de acero con tapa y sorbete. Láser / DTF UV.',
    categoria: 'Drinkware',
    tipoObjeto: 'Vaso',
    material: 'Acero inoxidable',
    alias: ['Vaso térmico', 'Tumbler', 'Vaso con sorbete'],
    tecnicas: ['grabado_laser', 'dtf_uv', 'tampografia'],
    variantes: [
      { sku: 'VASO-PLA-500', nombre: 'Vaso térmico plata 500ml', formato: '500 ml', color: 'Plata', capacidad: 500 },
      { sku: 'VASO-NEG-500', nombre: 'Vaso térmico negro 500ml', formato: '500 ml', color: 'Negro', capacidad: 500, recomendada: false },
    ],
  }),
  objetoPreset({
    key: 'MERCH_LAPICERA_PLASTICA',
    nombre: 'Lapicera plástica',
    desc: 'Lapicera/bolígrafo plástico para tampografía o serigrafía.',
    categoria: 'Escritura',
    tipoObjeto: 'Lapicera',
    material: 'Plástico',
    alias: ['Lapicera', 'Bolígrafo', 'Birome'],
    tecnicas: ['tampografia', 'serigrafia', 'dtf_uv'],
    variantes: [
      { sku: 'LAP-BLA', nombre: 'Lapicera blanca', formato: 'Estándar', color: 'Blanco' },
      { sku: 'LAP-NEG', nombre: 'Lapicera negra', formato: 'Estándar', color: 'Negro', recomendada: false },
      { sku: 'LAP-AZU', nombre: 'Lapicera azul', formato: 'Estándar', color: 'Azul', recomendada: false },
    ],
  }),
  objetoPreset({
    key: 'MERCH_MOUSEPAD',
    nombre: 'Mousepad',
    desc: 'Mousepad de tela con base de goma para sublimar. Por unidad.',
    categoria: 'Oficina',
    tipoObjeto: 'Mousepad',
    material: 'Otro',
    alias: ['Mousepad', 'Pad de mouse', 'Alfombrilla'],
    tecnicas: ['sublimacion', 'impresion_uv'],
    variantes: [
      { sku: 'MPAD-RECT', nombre: 'Mousepad rectangular 22×18', formato: '22 × 18 cm', color: 'Blanco', modelo: 'Rectangular' },
      { sku: 'MPAD-GAMER', nombre: 'Mousepad gamer XL', formato: '80 × 30 cm', color: 'Negro', modelo: 'Gamer XL', recomendada: false },
    ],
  }),
  objetoPreset({
    key: 'MERCH_LLAVERO_ACRILICO',
    nombre: 'Llavero acrílico',
    desc: 'Llavero de acrílico para impresión UV o sublimación. Por unidad.',
    categoria: 'Llavería',
    tipoObjeto: 'Llavero',
    material: 'Otro',
    alias: ['Llavero', 'Llavero acrílico'],
    tecnicas: ['impresion_uv', 'sublimacion', 'grabado_laser'],
    variantes: [
      { sku: 'LLAV-ACR-REC', nombre: 'Llavero acrílico rectangular', formato: '5 × 3 cm', color: 'Transparente', modelo: 'Rectangular' },
      { sku: 'LLAV-ACR-RED', nombre: 'Llavero acrílico redondo', formato: 'Ø 4 cm', color: 'Transparente', modelo: 'Redondo', recomendada: false },
    ],
  }),
  objetoPreset({
    key: 'MERCH_CUADERNO',
    nombre: 'Cuaderno tapa dura',
    desc: 'Cuaderno de tapa dura (PU/cuerina) para DTF UV, láser o UV.',
    categoria: 'Oficina',
    tipoObjeto: 'Cuaderno',
    material: 'Otro',
    alias: ['Cuaderno', 'Libreta tapa dura'],
    tecnicas: ['dtf_uv', 'grabado_laser', 'impresion_uv'],
    variantes: [
      { sku: 'CUAD-A5-NEG', nombre: 'Cuaderno A5 negro', formato: 'A5', color: 'Negro' },
      { sku: 'CUAD-A5-KRAFT', nombre: 'Cuaderno A5 kraft', formato: 'A5', color: 'Kraft', recomendada: false },
    ],
  }),
  objetoPreset({
    key: 'MERCH_AGENDA',
    nombre: 'Agenda',
    desc: 'Agenda anual (PU/cuerina) para DTF UV, grabado láser o UV.',
    categoria: 'Oficina',
    tipoObjeto: 'Agenda',
    material: 'Otro',
    alias: ['Agenda', 'Planner'],
    tecnicas: ['dtf_uv', 'grabado_laser', 'impresion_uv'],
    variantes: [
      { sku: 'AGENDA-A5-NEG', nombre: 'Agenda A5 negra', formato: 'A5', color: 'Negro' },
    ],
  }),
  objetoPreset({
    key: 'MERCH_POSAVASOS',
    nombre: 'Posavasos',
    desc: 'Posavasos de corcho/MDF para sublimar o impresión UV. Por unidad.',
    categoria: 'Hogar y bazar',
    tipoObjeto: 'Posavasos',
    material: 'Madera',
    alias: ['Posavasos', 'Individual'],
    tecnicas: ['sublimacion', 'impresion_uv', 'grabado_laser'],
    variantes: [
      { sku: 'POSA-RED', nombre: 'Posavasos redondo', formato: 'Ø 9 cm', color: 'Natural', modelo: 'Redondo' },
      { sku: 'POSA-CUA', nombre: 'Posavasos cuadrado', formato: '9 × 9 cm', color: 'Natural', modelo: 'Cuadrado', recomendada: false },
    ],
  }),

  // ── Merchandising: textil (Tanda 1, alta demanda) ───────────────────────────
  textilPreset({
    key: 'TEX_REMERA_ALGODON',
    nombre: 'Remera algodón',
    desc: 'Remera de algodón peinado para DTF, DTG, serigrafía o vinilo.',
    categoria: 'Remeras',
    tipoPrenda: 'Remera',
    material: 'Algodón',
    gramaje: 150,
    skuPrefix: 'REM-ALG',
    alias: ['Remera', 'Remera algodón', 'Camiseta'],
    tecnicas: ['dtf_textil', 'dtg', 'serigrafia', 'vinilo_textil', 'bordado'],
    colores: ['Blanco', 'Negro'],
    talles: ['S', 'M', 'L', 'XL', 'XXL'],
  }),
  textilPreset({
    key: 'TEX_REMERA_DAMA',
    nombre: 'Remera dama',
    desc: 'Remera entallada de dama, algodón. DTF, DTG, serigrafía, vinilo.',
    categoria: 'Remeras',
    tipoPrenda: 'Remera',
    material: 'Algodón',
    gramaje: 145,
    skuPrefix: 'REM-DAMA',
    alias: ['Remera dama', 'Remera entallada'],
    tecnicas: ['dtf_textil', 'dtg', 'serigrafia', 'vinilo_textil'],
    colores: ['Blanco', 'Negro'],
    talles: ['S', 'M', 'L', 'XL'],
  }),
  textilPreset({
    key: 'TEX_REMERA_NINO',
    nombre: 'Remera niño',
    desc: 'Remera de niño, algodón peinado. DTF, serigrafía, sublimación.',
    categoria: 'Remeras',
    tipoPrenda: 'Remera',
    material: 'Algodón',
    gramaje: 145,
    skuPrefix: 'REM-NINO',
    alias: ['Remera niño', 'Remera infantil'],
    tecnicas: ['dtf_textil', 'serigrafia', 'vinilo_textil'],
    colores: ['Blanco'],
    talles: ['4', '6', '8', '10', '12', '14', '16'],
  }),
  textilPreset({
    key: 'TEX_REMERA_POLIESTER',
    nombre: 'Remera poliéster deportiva',
    desc: 'Remera deportiva dry-fit de poliéster para sublimar. Por unidad.',
    categoria: 'Deportivo',
    tipoPrenda: 'Remera',
    material: 'Poliéster',
    gramaje: 140,
    skuPrefix: 'REM-POLI',
    alias: ['Remera deportiva', 'Remera dry-fit', 'Remera sublimable'],
    tecnicas: ['sublimacion', 'vinilo_textil', 'dtf_textil'],
    colores: ['Blanco'],
    talles: ['S', 'M', 'L', 'XL', 'XXL'],
  }),
  textilPreset({
    key: 'TEX_BUZO_CANGURO',
    nombre: 'Buzo canguro',
    desc: 'Buzo canguro (hoodie) de frisa. DTF, serigrafía o bordado.',
    categoria: 'Buzos y abrigo',
    tipoPrenda: 'Buzo canguro',
    material: 'Frisa',
    gramaje: 300,
    skuPrefix: 'BUZO-CANG',
    alias: ['Buzo canguro', 'Hoodie', 'Buzo con capucha'],
    tecnicas: ['dtf_textil', 'serigrafia', 'bordado'],
    colores: ['Negro', 'Gris'],
    talles: ['S', 'M', 'L', 'XL', 'XXL'],
  }),
  textilPreset({
    key: 'TEX_BUZO_REDONDO',
    nombre: 'Buzo cuello redondo',
    desc: 'Buzo cerrado cuello redondo de frisa. DTF, serigrafía o bordado.',
    categoria: 'Buzos y abrigo',
    tipoPrenda: 'Buzo cerrado',
    material: 'Frisa',
    gramaje: 300,
    skuPrefix: 'BUZO-RED',
    alias: ['Buzo cuello redondo', 'Buzo cerrado'],
    tecnicas: ['dtf_textil', 'serigrafia', 'bordado'],
    colores: ['Negro', 'Gris'],
    talles: ['S', 'M', 'L', 'XL'],
  }),
  textilPreset({
    key: 'TEX_GORRA_TRUCKER',
    nombre: 'Gorra trucker',
    desc: 'Gorra trucker (frente gomaespuma + malla). Bordado, DTF o sublimación.',
    categoria: 'Gorras y sombreros',
    tipoPrenda: 'Gorra',
    material: 'Poliéster',
    skuPrefix: 'GORRA-TRUCK',
    alias: ['Gorra trucker', 'Gorra malla'],
    tecnicas: ['bordado', 'dtf_textil', 'sublimacion'],
    colores: ['Negro', 'Blanco'],
    talles: ['Único'],
  }),
  textilPreset({
    key: 'TEX_GORRA_GABARDINA',
    nombre: 'Gorra gabardina',
    desc: 'Gorra de gabardina 6 paños, visera curva. Bordado o DTF.',
    categoria: 'Gorras y sombreros',
    tipoPrenda: 'Gorra',
    material: 'Algodón',
    skuPrefix: 'GORRA-GAB',
    alias: ['Gorra gabardina', 'Gorra 6 paños'],
    tecnicas: ['bordado', 'dtf_textil'],
    colores: ['Negro', 'Beige'],
    talles: ['Único'],
  }),
  textilPreset({
    key: 'TEX_TOTE_BAG',
    nombre: 'Tote bag',
    desc: 'Bolsa de tela (loneta/algodón) para serigrafía, DTF o vinilo.',
    categoria: 'Bolsos de tela',
    tipoPrenda: 'Tote bag',
    material: 'Algodón',
    skuPrefix: 'TOTE',
    alias: ['Tote bag', 'Bolsa de tela', 'Ecobag'],
    tecnicas: ['serigrafia', 'dtf_textil', 'vinilo_textil'],
    colores: ['Crudo', 'Negro'],
    talles: ['Único'],
  }),
];

// ── Blanks de merchandising / textil (esProductoBase) ─────────────────────────
// Ver docs/merchandising-taxonomia-y-plan.md. Precio null (lo carga el usuario).
function blankVariant(sku, nombre, formato, color, attrs, recomendada = true) {
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: nombre,
    formato: formato || '-',
    color: color || '-',
    recomendada,
    atributosVarianteJson: attrs,
    unidadStock: UnidadMateriaPrima.UNIDAD,
    unidadCompra: UnidadMateriaPrima.UNIDAD,
    precioReferencia: null,
    moneda: 'ARS',
  };
}

function objetoPreset(cfg) {
  return {
    key: cfg.key,
    nombreCanonico: cfg.nombre,
    descripcionCorta: cfg.desc,
    iconKind: 'objeto',
    aliasDisponibles: cfg.alias || [],
    usosRecomendados: cfg.tecnicas || [],
    procesosCompatibles: cfg.tecnicas || [],
    advertencias: [],
    familia: FamiliaMateriaPrima.SUSTRATO,
    subfamilia: SubfamiliaMateriaPrima.OBJETO_PROMOCIONAL_BASE,
    tipoTecnico: 'objeto_promocional_base',
    templateId: 'objeto_promocional_base_v1',
    variantes: cfg.variantes.map((vt) =>
      blankVariant(vt.sku, vt.nombre, vt.formato, vt.color, {
        categoria: cfg.categoria,
        tipoObjeto: cfg.tipoObjeto,
        material: vt.material || cfg.material,
        color: vt.color,
        ...(vt.modelo ? { modelo: vt.modelo } : {}),
        ...(vt.capacidad ? { capacidad: vt.capacidad } : {}),
      }, vt.recomendada !== false),
    ),
  };
}

function colorSlug(color) {
  return color.replace(/[^a-zA-Z0-9]+/g, '').slice(0, 3).toUpperCase();
}

function textilPreset(cfg) {
  const variantes = [];
  for (const color of cfg.colores) {
    for (const talle of cfg.talles) {
      variantes.push(
        blankVariant(
          `${cfg.skuPrefix}-${colorSlug(color)}-${talle}`,
          `${cfg.nombre} ${color} ${talle}`,
          String(talle),
          color,
          {
            categoria: cfg.categoria,
            tipoPrenda: cfg.tipoPrenda,
            material: cfg.material,
            color,
            talle: String(talle),
            ...(cfg.gramaje ? { gramaje: cfg.gramaje } : {}),
          },
          true,
        ),
      );
    }
  }
  return {
    key: cfg.key,
    nombreCanonico: cfg.nombre,
    descripcionCorta: cfg.desc,
    iconKind: 'textil',
    aliasDisponibles: cfg.alias || [],
    usosRecomendados: cfg.tecnicas || [],
    procesosCompatibles: cfg.tecnicas || [],
    advertencias: [],
    familia: FamiliaMateriaPrima.SUSTRATO,
    subfamilia: SubfamiliaMateriaPrima.TEXTIL_INDUMENTARIA,
    tipoTecnico: 'textil_indumentaria',
    templateId: 'textil_indumentaria_v1',
    variantes,
  };
}

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

function selloAutoPresetMeta() {
  return {
    familia: FamiliaMateriaPrima.SELLOS,
    subfamilia: SubfamiliaMateriaPrima.SELLOS_AUTOMATICOS,
    tipoTecnico: 'sello_automatico',
    templateId: 'sello_automatico_v1',
  };
}

function selloManualPresetMeta() {
  return {
    familia: FamiliaMateriaPrima.SELLOS,
    subfamilia: SubfamiliaMateriaPrima.SELLOS_MANUALES,
    tipoTecnico: 'sello_manual',
    templateId: 'sello_manual_v1',
  };
}

function gomaLaserablePresetMeta() {
  return {
    familia: FamiliaMateriaPrima.SELLOS,
    subfamilia: SubfamiliaMateriaPrima.GOMA_LASERABLE,
    tipoTecnico: 'goma_laserable',
    templateId: 'goma_laserable_v1',
  };
}

function almohadillaSelloPresetMeta() {
  return {
    familia: FamiliaMateriaPrima.SELLOS,
    subfamilia: SubfamiliaMateriaPrima.ALMOHADILLA_TINTA,
    tipoTecnico: 'almohadilla_sello',
    templateId: 'almohadilla_sello_v1',
  };
}

function tintaSelloPresetMeta() {
  return {
    familia: FamiliaMateriaPrima.SELLOS,
    subfamilia: SubfamiliaMateriaPrima.ALMOHADILLA_TINTA,
    tipoTecnico: 'tinta_sello',
    templateId: 'tinta_sello_v1',
  };
}

function portabannerPresetMeta() {
  return {
    familia: FamiliaMateriaPrima.POP_EXHIBIDOR,
    subfamilia: SubfamiliaMateriaPrima.PORTABANNER_ESTRUCTURA,
    tipoTecnico: 'portabanner',
    templateId: 'portabanner_estructura_v1',
  };
}

// Estructura portabanner. fila: [sku, nombre, tipoPortabanner, ancho cm|null,
// alto cm|null, linea, recomendada]. La medida es la del banner de referencia
// del fabricante: NO condiciona la lona, que se define en el producto/ruta.
// Sin precio de lista: se completa manualmente al instalar.
function vportabanner([sku, nombre, tipoPortabanner, ancho, alto, linea, recomendada]) {
  const medida = ancho && alto ? `${ancho}×${alto} cm` : 'Sin medida';
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: ancho && alto ? `${nombre} · ${medida}` : nombre,
    formato: medida,
    espesor: null,
    color: 'Estándar',
    recomendada: recomendada === true,
    atributosVarianteJson: {
      tipoPortabanner,
      ...(ancho ? { ancho } : {}),
      ...(alto ? { alto } : {}),
      linea,
    },
    unidadStock: UnidadMateriaPrima.UNIDAD,
    unidadCompra: UnidadMateriaPrima.UNIDAD,
    precioReferencia: null,
    moneda: 'ARS',
  };
}

function portabannerPreset({ key, nombreCanonico, descripcionCorta, alias, filas }) {
  return {
    key,
    nombreCanonico,
    descripcionCorta,
    iconKind: 'banner',
    aliasDisponibles: alias,
    usosRecomendados: ['exhibidores_pop', 'via_publica'],
    procesosCompatibles: ['ensamble_estructural'],
    advertencias: [
      'La medida es la del banner de referencia del fabricante: no condiciona la lona, que se define en el producto.',
      'Sin precio de lista cargado: completar el precio del proveedor al instalar.',
    ],
    ...portabannerPresetMeta(),
    variantes: filas.map(vportabanner),
  };
}

// Repuesto de almohadilla por modelo (catálogo Trodat del proveedor Sellos
// Multicolor, 2026-07). fila: [sku, códigoRepuesto, modeloCompatible|null,
// colorTinta, precioARS, recomendada]. "Neutro" = sin entintar; "MCI" =
// almohadilla de alto rendimiento Trodat.
function vrepuestoAlmohadilla([sku, codigoRepuesto, modeloCompatible, colorTinta, precio, recomendada]) {
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `${codigoRepuesto} · ${colorTinta}${modeloCompatible ? ` (${modeloCompatible})` : ''}`,
    formato: codigoRepuesto,
    espesor: null,
    color: colorTinta,
    recomendada: recomendada === true,
    atributosVarianteJson: {
      marca: 'Trodat',
      codigoRepuesto,
      ...(modeloCompatible ? { modeloCompatible } : {}),
      colorTinta,
    },
    unidadStock: UnidadMateriaPrima.UNIDAD,
    unidadCompra: UnidadMateriaPrima.UNIDAD,
    precioReferencia: precio ?? null,
    moneda: 'ARS',
  };
}

function repuestoAlmohadillaPreset({ key, nombreCanonico, descripcionCorta, alias, repuestos }) {
  return {
    key,
    nombreCanonico,
    descripcionCorta,
    iconKind: 'stamp',
    aliasDisponibles: ['Trodat', ...alias],
    usosRecomendados: ['sellos_oficina', 'sellos_comerciales'],
    procesosCompatibles: [],
    advertencias: [
      'Compatibilidad por código Trodat (6/<modelo>); verificar contra la tabla oficial en códigos compartidos.',
      'Precios de referencia del proveedor Sellos Multicolor (2026-07).',
    ],
    ...almohadillaSelloPresetMeta(),
    variantes: repuestos.map(vrepuestoAlmohadilla),
  };
}

function almohadillaEscritorioPresetMeta() {
  return {
    familia: FamiliaMateriaPrima.SELLOS,
    subfamilia: SubfamiliaMateriaPrima.ALMOHADILLA_TINTA,
    tipoTecnico: 'almohadilla_escritorio',
    templateId: 'almohadilla_escritorio_v1',
  };
}

// Tampón de escritorio (catálogo Trodat del proveedor, 2026-07).
// fila: [sku, referencia, ancho cm|null, alto cm|null, colorTinta, uso, precioARS, recomendada]
function valmohadillaEscritorio([sku, referencia, ancho, alto, colorTinta, uso, precio, recomendada]) {
  const medida = ancho && alto ? ` (${ancho}×${alto} cm)` : '';
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `Trodat ${referencia}${medida} · ${colorTinta}${uso === 'Dactilar' ? ' · dactilar' : ''}`,
    formato: ancho && alto ? `${ancho}×${alto} cm` : 'Sin medida publicada',
    espesor: null,
    color: colorTinta,
    recomendada: recomendada === true,
    atributosVarianteJson: {
      marca: 'Trodat',
      referencia,
      ...(ancho ? { ancho } : {}),
      ...(alto ? { alto } : {}),
      colorTinta,
      uso,
    },
    unidadStock: UnidadMateriaPrima.UNIDAD,
    unidadCompra: UnidadMateriaPrima.UNIDAD,
    precioReferencia: precio ?? null,
    moneda: 'ARS',
  };
}

function vtintaSello(sku, referencia, colorTinta, volumen, uso, precio, recomendada) {
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `Trodat ${referencia} ${colorTinta} · ${volumen} ml${uso === 'Telas' ? ' · telas' : ''}`,
    formato: `${volumen} ml`,
    espesor: null,
    color: colorTinta,
    recomendada: recomendada === true,
    atributosVarianteJson: {
      marca: 'Trodat',
      referencia,
      colorTinta,
      volumen,
      uso,
    },
    unidadStock: UnidadMateriaPrima.UNIDAD,
    unidadCompra: UnidadMateriaPrima.UNIDAD,
    precioReferencia: precio ?? null,
    moneda: 'ARS',
  };
}

// Variante de sello automático: el tamaño de polímero y las líneas de texto son
// propiedades del modelo (Colop Printer 30 → 47×18 mm, 5 líneas).
function vselloManual(sku, marca, modelo, anchoPolimero, altoPolimero, lineasTexto, material, recomendada) {
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `${modelo} · ${anchoPolimero}×${altoPolimero} mm · ${lineasTexto} líneas`,
    formato: `${anchoPolimero}×${altoPolimero} mm`,
    espesor: null,
    color: 'Estándar',
    recomendada,
    atributosVarianteJson: {
      marca,
      modelo,
      anchoPolimero,
      altoPolimero,
      lineasTexto,
      forma: 'Rectangular',
      material,
    },
    unidadStock: UnidadMateriaPrima.UNIDAD,
    unidadCompra: UnidadMateriaPrima.UNIDAD,
    precioReferencia: null,
    moneda: 'ARS',
  };
}

// Variante de goma laserable: plancha por tipo/espesor/formato, consumo por área.
// Datos reales del proveedor Sellos Multicolor (Trodat, relevado 2026-07).
function vgoma(sku, tipoGoma, espesor, ancho, alto, precio, recomendada) {
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `Trodat ${tipoGoma} · ${espesor} mm`,
    formato: `${ancho}×${alto} mm`,
    espesor,
    color: 'Estándar',
    recomendada,
    atributosVarianteJson: {
      marca: 'Trodat',
      tipoGoma,
      color: 'Estándar',
      espesor,
      ancho,
      alto,
    },
    unidadStock: UnidadMateriaPrima.HOJA,
    unidadCompra: UnidadMateriaPrima.HOJA,
    precioReferencia: precio ?? null,
    moneda: 'ARS',
  };
}

// ── Líneas de sellos Trodat — catálogo relevado del proveedor Sellos
// Multicolor (sellosmulticolor.com.ar, 2026-07). Las medidas son la placa de
// polímero/impresión de cada modelo. `lineasTexto` es una ESTIMACIÓN
// (≈ alto / 4 mm, redondeado hacia arriba) para tipografía estándar — el
// modelador puede ajustarla al instalar.
function lineasTextoEstimadas(altoMm) {
  return Math.max(1, Math.ceil(altoMm / 4));
}

// fila de modelo: [sku, modelo, ancho, alto, forma, precioARS, recomendada]
function vselloTrodat([sku, modelo, ancho, alto, forma, precio, recomendada]) {
  const lineasTexto = lineasTextoEstimadas(alto);
  const medida = forma === 'Redondo' ? `Ø${ancho} mm` : `${ancho}×${alto} mm`;
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `Trodat ${modelo} · ${medida} · ${lineasTexto} líneas`,
    formato: medida,
    espesor: null,
    color: 'Estándar',
    recomendada: recomendada === true,
    atributosVarianteJson: {
      marca: 'Trodat',
      modelo,
      anchoPolimero: ancho,
      altoPolimero: alto,
      lineasTexto,
      forma,
    },
    unidadStock: UnidadMateriaPrima.UNIDAD,
    unidadCompra: UnidadMateriaPrima.UNIDAD,
    precioReferencia: precio ?? null,
    moneda: 'ARS',
  };
}

function selloLineaTrodatPreset({ key, nombreCanonico, descripcionCorta, alias, modelos }) {
  return {
    key,
    nombreCanonico,
    descripcionCorta,
    iconKind: 'stamp',
    aliasDisponibles: ['Trodat', ...alias],
    usosRecomendados: ['sellos_oficina', 'sellos_comerciales'],
    procesosCompatibles: ['grabado_laser', 'montaje_sobre_sustrato'],
    advertencias: [
      'Líneas de texto estimadas (≈ alto de placa / 4 mm): verificar según cuerpo de letra.',
      'Precios de referencia del proveedor Sellos Multicolor (2026-07).',
    ],
    ...selloAutoPresetMeta(),
    variantes: modelos.map(vselloTrodat),
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

// Sufijos de color para el SKU (el SKU base no lleva color). Las variantes de
// color se generan como filas aparte para poder cargarles precio propio.
// Es una función (hoisted) porque el array `presets` se evalúa antes que un const.
function sheetColorCode(color) {
  const codes = {
    Blanco: 'BL',
    Color: 'CO',
    Amarillo: 'AM',
    Celeste: 'CE',
    Rosa: 'RO',
    Verde: 'VE',
    Marfil: 'MA',
    Natural: 'NA',
  };
  return codes[color] ?? color.slice(0, 2).toUpperCase();
}

function sheetColorVariants(prefix, formatos, gramajes, colores, options) {
  return colores.flatMap((color) =>
    formatos.flatMap((formato) =>
      gramajes.map((gramaje) =>
        vhColor(prefix, formato, gramaje, color, options),
      ),
    ),
  );
}

function vhColor(prefix, formato, gramaje, color, options) {
  const size = sheetSizeCm(formato);
  const acabado = options.acabado ?? 'Mate';
  const acabadoCode = acabado.toUpperCase().startsWith('BR') ? 'B' : 'M';
  const colorCode = sheetColorCode(color);
  const recomendada = Boolean(
    options.recomendadas?.has(`${formato}-${gramaje}-${color}`),
  );
  const sku = `${prefix}-${sheetSkuSize(formato)}-${gramaje}-${acabadoCode}-${colorCode}`;
  return {
    skuSugerido: sku,
    nombreVarianteSugerido: `${formato} · ${gramaje} g/m² · ${options.material} · ${color}`,
    formato,
    espesor: null,
    color,
    recomendada,
    atributosVarianteJson: {
      formatoComercial: formato,
      ancho: size.ancho,
      alto: size.alto,
      gramaje,
      material: options.material,
      color,
      acabado,
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
    '33 x 48 cm': { ancho: 33, alto: 48 },
  };
  return sizes[formato];
}

// Papel OPP en hojas 33 x 48 cm: colores lisos, metalizados y holográficos.
// Holográficos y transparente solo brillo; blanco y metalizados en mate y
// brillo (la instalación es selectiva, se eligen solo las que se usan).
function oppVariants() {
  const colores = [
    { color: 'Blanco', code: 'BL', acabados: ['Mate', 'Brillo'] },
    { color: 'Transparente', code: 'TR', acabados: ['Brillo'] },
    { color: 'Holográfico estándar', code: 'HOLO', acabados: ['Brillo'] },
    { color: 'Holográfico oro', code: 'HOLO-ORO', acabados: ['Brillo'] },
    { color: 'Holográfico mosaico', code: 'HOLO-MOS', acabados: ['Brillo'] },
    { color: 'Metalizado oro', code: 'MET-ORO', acabados: ['Mate', 'Brillo'] },
    { color: 'Metalizado plata', code: 'MET-PLA', acabados: ['Mate', 'Brillo'] },
  ];
  const recomendadas = new Set(['Blanco-Brillo', 'Transparente-Brillo']);
  return colores.flatMap(({ color, code, acabados }) =>
    acabados.map((acabado) => ({
      skuSugerido: `OPP-33X48-${code}-${acabado === 'Brillo' ? 'B' : 'M'}`,
      nombreVarianteSugerido: `33 x 48 cm · OPP ${color} · ${acabado}`,
      formato: '33 x 48 cm',
      espesor: null,
      color,
      recomendada: recomendadas.has(`${color}-${acabado}`),
      atributosVarianteJson: {
        formatoComercial: '33 x 48 cm',
        ancho: 33,
        alto: 48,
        material: 'Papel OPP',
        color,
        acabado,
        anchoMm: 330,
        altoMm: 480,
        largoMm: 480,
      },
      unidadStock: UnidadMateriaPrima.HOJA,
      unidadCompra: UnidadMateriaPrima.PACK,
      precioReferencia: null,
      moneda: 'ARS',
    })),
  );
}

// Cartón gris para contratapa de emblocado: se consume 1 por pila (base
// de cantidad 'talonario_pilas' en el paso manual).
function cartonEmblocadoVariants() {
  const formatos = ['22 x 34 cm', 'A4'];
  const recomendadas = new Set(['22 x 34 cm']);
  return formatos.map((formato) => {
    const size = sheetSizeCm(formato);
    return {
      skuSugerido: `CARTEMB-${sheetSkuSize(formato)}`,
      nombreVarianteSugerido: `${formato} · Cartón gris para emblocado`,
      formato,
      espesor: null,
      color: 'Gris',
      recomendada: recomendadas.has(formato),
      atributosVarianteJson: {
        formatoComercial: formato,
        ancho: size.ancho,
        alto: size.alto,
        material: 'Cartón gris',
        color: 'Gris',
        anchoMm: Math.round(size.ancho * 10),
        altoMm: Math.round(size.alto * 10),
        largoMm: Math.round(size.alto * 10),
      },
      unidadStock: UnidadMateriaPrima.HOJA,
      unidadCompra: UnidadMateriaPrima.PACK,
      precioReferencia: null,
      moneda: 'ARS',
    };
  });
}

// Broches metálicos: medida calibre/pata (ej. 23/10 = calibre 23, pata 10 mm).
// Calibre 20 para emblocado (abrochadora de golpe), 23 heavy duty, 26/24 de
// escritorio. `hojasDesde/hojasHasta` = rango de hojas que abrocha cada
// medida (sirve para lógica de selección por altura de pila).
function brocheVariants() {
  // [calibre, pataMm, unidadesPorCaja, hojasDesde, hojasHasta]
  const medidas = [
    // Serie 20 — emblocado (rangos del proveedor).
    [20, 6, 2000, 5, 20],
    [20, 8, 2000, 20, 40],
    [20, 10, 1000, 40, 60],
    [20, 12, 1000, 60, 80],
    [20, 15, 1000, 90, 110],
    [20, 18, 1000, 110, 130],
    [20, 20, 1000, 130, 150],
    // Escritorio y heavy duty (rangos estándar de catálogo).
    [26, 6, 1000, 2, 20],
    [24, 6, 1000, 2, 30],
    [24, 8, 1000, 30, 50],
    [23, 8, 1000, 20, 50],
    [23, 10, 1000, 40, 70],
    [23, 13, 1000, 70, 100],
    [23, 15, 1000, 90, 120],
    [23, 20, 1000, 140, 170],
  ];
  const recomendadas = new Set(['20/6', '20/10', '26/6']);
  return medidas.map(([calibre, pataMm, unidadesPorCaja, hojasDesde, hojasHasta]) => {
    const medida = `${calibre}/${pataMm}`;
    return {
      skuSugerido: `BROCHE-${calibre}-${pataMm}-X${unidadesPorCaja}`,
      nombreVarianteSugerido: `Broche ${medida} · ${hojasDesde}-${hojasHasta} hojas · caja x ${unidadesPorCaja}`,
      formato: medida,
      espesor: null,
      color: 'Plateado',
      recomendada: recomendadas.has(medida),
      atributosVarianteJson: {
        medida,
        calibre,
        largoPataMm: pataMm,
        hojasDesde,
        hojasHasta,
        unidadesPorCaja,
        material: 'Alambre metálico',
      },
      unidadStock: UnidadMateriaPrima.UNIDAD,
      unidadCompra: UnidadMateriaPrima.CAJA,
      precioReferencia: null,
      moneda: 'ARS',
    };
  });
}

// Espiral plástico (PVC coil) paso 4:1: Ø → capacidad en hojas a 80g (tabla de la
// industria). Cada variante es un diámetro con su capacidadMaxHojas EDITABLE por el
// tenant. El motor elige el menor Ø que cubre las hojas del libro
// (MENOR_CAPACIDAD_QUE_CUMPLA). v1: sólo negro, sólo espiral plástico.
function espiralPlasticoVariants() {
  // [diámetroMm, capacidadMaxHojas @80g]
  const tabla = [
    [6, 35],
    [8, 60],
    [10, 80],
    [12, 100],
    [14, 120],
    [16, 140],
    [18, 160],
    [20, 180],
    [25, 230],
    [32, 290],
    [40, 350],
    [50, 440],
  ];
  const color = 'Negro';
  return tabla.map(([diametroMm, capacidadMaxHojas]) => ({
    skuSugerido: `ESPIRAL-PVC-${diametroMm}MM-NEGRO`,
    nombreVarianteSugerido: `Espiral plástico ${diametroMm}mm · negro (${capacidadMaxHojas} hojas)`,
    formato: `${diametroMm}mm`,
    espesor: null,
    color,
    // Los diámetros más usados en un centro de copiado.
    recomendada: [10, 12, 16].includes(diametroMm),
    atributosVarianteJson: {
      tipoAnillo: 'ESPIRAL_PLASTICO',
      diametro: diametroMm,
      capacidadMaxHojas,
      color,
      material: 'PVC',
      pasoPerforacion: '4:1',
    },
    unidadStock: UnidadMateriaPrima.UNIDAD,
    unidadCompra: UnidadMateriaPrima.CAJA,
    precioReferencia: null,
    moneda: 'ARS',
  }));
}

// Wire-O (anillo metálico doble). Capacidades investigadas a 80g: paso 3:1 en
// los Ø chicos/medios, 2:1 en los grandes.
function wireOVariants() {
  // [diámetroMm, capacidadMaxHojas @80g, paso]
  const tabla = [
    [6.9, 45, '3:1'],
    [7.9, 60, '3:1'],
    [9.5, 75, '3:1'],
    [11, 90, '3:1'],
    [12.7, 105, '3:1'],
    [14.3, 120, '3:1'],
    [15.9, 135, '3:1'],
    [19, 165, '2:1'],
    [22, 190, '2:1'],
    [25.4, 220, '2:1'],
  ];
  const color = 'Negro';
  return tabla.map(([diametroMm, capacidadMaxHojas, pasoPerforacion]) => ({
    skuSugerido: `WIREO-${String(diametroMm).replace('.', 'p')}MM-NEGRO`,
    nombreVarianteSugerido: `Wire-O ${diametroMm}mm · negro (${capacidadMaxHojas} hojas)`,
    formato: `${diametroMm}mm`,
    espesor: null,
    color,
    // Los diámetros más usados en un centro de copiado.
    recomendada: [9.5, 12.7, 15.9].includes(diametroMm),
    atributosVarianteJson: {
      tipoAnillo: 'WIRE_O',
      diametro: diametroMm,
      capacidadMaxHojas,
      color,
      material: 'metal',
      pasoPerforacion,
    },
    unidadStock: UnidadMateriaPrima.UNIDAD,
    unidadCompra: UnidadMateriaPrima.CAJA,
    precioReferencia: null,
    moneda: 'ARS',
  }));
}

// Tapa/contratapa de anillado (polipropileno). Sólo A4/Oficio/A3; se elige por
// el tamaño del documento (la menor que lo cubre). `colorBase` distingue el rol:
// transparente = tapa frontal, opaco de color = contratapa.
function tapaEncuadernacionVariants(colorBase, colorLabel) {
  // [nombre, anchoMm, altoMm]
  const tamanos = [
    ['A4', 210, 297],
    ['Oficio', 216, 330],
    ['A3', 297, 420],
  ];
  return tamanos.map(([nombre, anchoMm, altoMm]) => ({
    skuSugerido: `TAPA-${colorLabel.toUpperCase()}-${nombre.toUpperCase()}`,
    nombreVarianteSugerido: `${nombre} · tapa ${colorLabel.toLowerCase()}`,
    formato: nombre,
    espesor: null,
    color: colorLabel,
    recomendada: nombre === 'A4',
    atributosVarianteJson: {
      formatoComercial: nombre,
      ancho: anchoMm,
      alto: altoMm,
      anchoMm,
      altoMm,
      material: 'polipropileno',
      colorBase,
    },
    unidadStock: UnidadMateriaPrima.UNIDAD,
    unidadCompra: UnidadMateriaPrima.CAJA,
    precioReferencia: null,
    moneda: 'ARS',
  }));
}

// Ganchos metálicos de emblocado: distintas medidas, caja x 1000.
function ganchoEmblocadoVariants() {
  const medidasCm = [7.5, 10, 12, 15, 20, 25, 33];
  return medidasCm.map((medidaCm) => {
    const largoMm = Math.round(medidaCm * 10);
    return {
      skuSugerido: `GANCHO-EMB-${largoMm}MM-X1000`,
      nombreVarianteSugerido: `Gancho ${formatNumber(medidaCm)} cm · caja x 1000`,
      formato: `${formatNumber(medidaCm)} cm`,
      espesor: null,
      color: 'Plateado',
      recomendada: false,
      atributosVarianteJson: {
        medida: `${formatNumber(medidaCm)} cm`,
        medidaCm,
        largoMm,
        unidadesPorCaja: 1000,
        material: 'Alambre metálico',
      },
      unidadStock: UnidadMateriaPrima.UNIDAD,
      unidadCompra: UnidadMateriaPrima.CAJA,
      precioReferencia: null,
      moneda: 'ARS',
    };
  });
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
