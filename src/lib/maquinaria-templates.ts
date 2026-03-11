import {
  maquinariaBaseSectionOrder,
  type MaquinariaTemplateDefinition,
  type MaquinariaTemplateField,
  type MaquinariaTemplateOption,
  type MaquinariaTemplateSection,
  type PlantillaMaquinaria,
} from "@/lib/maquinaria";

function option(
  value: string,
  label: string,
  description?: string,
): MaquinariaTemplateOption {
  return { value, label, description };
}

function field(definition: MaquinariaTemplateField): MaquinariaTemplateField {
  return definition;
}

function section(definition: MaquinariaTemplateSection): MaquinariaTemplateSection {
  return definition;
}

function template(definition: MaquinariaTemplateDefinition): MaquinariaTemplateDefinition {
  return definition;
}

const qualityOptions = [
  option("rapido", "Rapido"),
  option("normal", "Normal"),
  option("alta", "Alta calidad"),
];

const printModeOptions = [
  option("blanco_negro", "Blanco y negro"),
  option("color", "Color"),
];

const uvPrintModeOptions = [
  option("cmyk", "CMYK"),
  option("cmyk_blanco", "CMYK + Blanco"),
  option("cmyk_barniz", "CMYK + Barniz"),
  option("cmyk_blanco_barniz", "CMYK + Blanco + Barniz"),
  option("cmyk_blanco_barniz_primer", "CMYK + Blanco + Barniz + Primer"),
];

const rollMediaOptions = [
  option("vinilo", "Vinilo"),
  option("lona", "Lona"),
  option("film", "Film"),
  option("papel", "Papel"),
  option("textil", "Textil"),
  option("backlit", "Backlit"),
  option("canvas", "Canvas"),
];

const rigidMediaOptions = [
  option("acrilico", "Acrilico"),
  option("madera", "Madera"),
  option("mdf", "MDF"),
  option("pvc", "PVC"),
  option("carton_pluma", "Carton pluma"),
  option("vidrio", "Vidrio"),
  option("metal", "Metal"),
  option("corrugado", "Corrugado"),
];

const cylindricalObjectOptions = [
  option("botella", "Botella"),
  option("termo", "Termo"),
  option("vaso", "Vaso"),
  option("frasco", "Frasco"),
  option("tubo", "Tubo"),
];

const cncMaterialOptions = [
  option("mdf", "MDF"),
  option("madera", "Madera"),
  option("acrilico", "Acrilico"),
  option("pvc", "PVC"),
  option("aluminio", "Aluminio"),
  option("dibond", "Dibond"),
  option("foamboard", "Foamboard"),
];

const laserMaterialOptions = [
  option("acrilico", "Acrilico"),
  option("madera", "Madera"),
  option("mdf", "MDF"),
  option("carton", "Carton"),
  option("papel", "Papel"),
  option("cuero", "Cuero"),
  option("tela", "Tela"),
];

const additiveMaterialOptions = [
  option("pla", "PLA"),
  option("abs", "ABS"),
  option("petg", "PETG"),
  option("resina", "Resina"),
  option("nylon", "Nylon"),
  option("tpu", "TPU"),
];

const cuttingToolOptions = [
  option("cuchilla_arrastre", "Cuchilla de arrastre"),
  option("cuchilla_tangencial", "Cuchilla tangencial"),
  option("rueda_hendido", "Rueda de hendido"),
  option("punzon", "Punzon"),
  option("fresa", "Fresa"),
];

const laserTypeOptions = [
  option("co2", "CO2"),
  option("fibra", "Fibra"),
  option("mixto", "Mixto"),
];

const sheetFormatOptions = [
  option("a5", "A5"),
  option("a4", "A4"),
  option("a3", "A3"),
  option("sra3", "SRA3"),
  option("personalizado", "Personalizado"),
];

const threeDTechnologyOptions = [
  option("fdm", "FDM"),
  option("sla", "SLA"),
  option("dlp", "DLP"),
  option("resina", "Resina"),
];

const dtfInkOptions = [
  option("cmyk_blanco", "CMYK + Blanco"),
  option("cmyk_blanco_fluor", "CMYK + Blanco + Fluor"),
];

const cureSystemOptions = [
  option("aire", "Secado por aire"),
  option("calor", "Secado por calor"),
  option("uv_led", "UV LED"),
  option("sublimacion", "Transferencia termica"),
];

const commonTemplateSections = maquinariaBaseSectionOrder;

const genericConsumableFields = [
  field({
    key: "nombre",
    label: "Nombre",
    scope: "consumible",
    kind: "text",
    required: true,
    description: "Nombre tecnico o comercial del consumible.",
    tooltip: "Usa un nombre claro, por ejemplo Toner negro o Tinta blanca.",
    placeholder: "Toner negro",
  }),
  field({
    key: "tipo",
    label: "Tipo",
    scope: "consumible",
    kind: "select",
    required: true,
    description: "Clasifica el consumible para ordenar la carga y futuros calculos.",
    options: [
      option("toner", "Toner"),
      option("tinta", "Tinta"),
      option("barniz", "Barniz"),
      option("primer", "Primer"),
      option("film", "Film"),
      option("polvo", "Polvo"),
      option("adhesivo", "Adhesivo"),
      option("resina", "Resina"),
      option("lubricante", "Lubricante"),
      option("otro", "Otro"),
    ],
  }),
  field({
    key: "unidad",
    label: "Unidad",
    scope: "consumible",
    kind: "select",
    required: true,
    description: "Unidad de compra o control del consumible.",
    options: [
      option("unidad", "Unidad"),
      option("ml", "Mililitros"),
      option("litro", "Litros"),
      option("gramo", "Gramos"),
      option("kg", "Kilogramos"),
      option("m2", "Metro cuadrado"),
      option("metro_lineal", "Metro lineal"),
      option("pagina", "Pagina"),
      option("a4_equiv", "A4 equivalente"),
    ],
  }),
  field({
    key: "costoReferencia",
    label: "Costo referencia",
    scope: "consumible",
    kind: "number",
    description: "Costo base del consumible para futuras valorizaciones.",
    tooltip: "No reemplaza compras reales; funciona como referencia tecnica.",
    placeholder: "0",
  }),
  field({
    key: "rendimientoEstimado",
    label: "Rendimiento estimado",
    scope: "consumible",
    kind: "number",
    description: "Rendimiento esperado del consumible en su unidad de control.",
    placeholder: "0",
  }),
  field({
    key: "dependePerfilOperativo",
    label: "Depende del perfil operativo",
    scope: "consumible",
    kind: "boolean",
    description: "Indica si el consumible cambia segun calidad, modo o material.",
  }),
];

const genericWearFields = [
  field({
    key: "nombre",
    label: "Nombre",
    scope: "desgaste",
    kind: "text",
    required: true,
    description: "Nombre del repuesto o componente de desgaste.",
    placeholder: "Fusor principal",
  }),
  field({
    key: "tipo",
    label: "Tipo",
    scope: "desgaste",
    kind: "select",
    required: true,
    description: "Categoria del componente para ordenar el prorrateo futuro.",
    options: [
      option("fusor", "Fusor"),
      option("drum", "Drum"),
      option("developer", "Developer"),
      option("correa_transferencia", "Correa de transferencia"),
      option("cabezal", "Cabezal"),
      option("lampara_uv", "Lampara UV"),
      option("fresa", "Fresa"),
      option("cuchilla", "Cuchilla"),
      option("filtro", "Filtro"),
      option("kit_mantenimiento", "Kit de mantenimiento"),
      option("otro", "Otro"),
    ],
  }),
  field({
    key: "vidaUtilEstimada",
    label: "Vida util estimada",
    scope: "desgaste",
    kind: "number",
    required: true,
    description: "Cantidad esperada antes del reemplazo.",
    placeholder: "0",
  }),
  field({
    key: "unidadDesgaste",
    label: "Unidad de desgaste",
    scope: "desgaste",
    kind: "select",
    required: true,
    description: "Unidad sobre la cual se consume el componente.",
    options: [
      option("copias_a4_equiv", "Copias A4 equivalentes"),
      option("m2", "Metros cuadrados"),
      option("metros_lineales", "Metros lineales"),
      option("horas", "Horas"),
      option("ciclos", "Ciclos"),
      option("piezas", "Piezas"),
    ],
  }),
  field({
    key: "costoReposicion",
    label: "Costo reposicion",
    scope: "desgaste",
    kind: "number",
    description: "Costo de reemplazo del componente.",
    placeholder: "0",
  }),
];

function buildLaserPrinterSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades fisicas",
      description: "Limites reales de hoja, area imprimible y gramajes admitidos.",
      tooltip: "Estos datos condicionan que formatos podran vincularse luego en procesos.",
      fields: [
        field({
          key: "anchoMinHoja",
          label: "Ancho minimo hoja",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Ancho minimo de hoja que puede tomar la maquina.",
          placeholder: "14.8",
        }),
        field({
          key: "anchoMaxHoja",
          label: "Ancho maximo hoja",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Ancho maximo de hoja soportado.",
          placeholder: "33",
        }),
        field({
          key: "altoMinHoja",
          label: "Alto minimo hoja",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Alto minimo de hoja soportado.",
          placeholder: "21",
        }),
        field({
          key: "altoMaxHoja",
          label: "Alto maximo hoja",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Alto maximo de hoja soportado.",
          placeholder: "48.8",
        }),
        field({
          key: "areaImprimibleMaxima",
          label: "Area imprimible maxima",
          scope: "maquina",
          kind: "number",
          unit: "m2",
          description: "Superficie util de impresion en una hoja maxima.",
          placeholder: "0.15",
        }),
        field({
          key: "margenSuperior",
          label: "Margen superior",
          scope: "maquina",
          kind: "number",
          unit: "cm",
          description: "Margen no imprimible superior.",
          placeholder: "0.5",
        }),
        field({
          key: "margenInferior",
          label: "Margen inferior",
          scope: "maquina",
          kind: "number",
          unit: "cm",
          description: "Margen no imprimible inferior.",
          placeholder: "0.5",
        }),
        field({
          key: "margenIzquierdo",
          label: "Margen izquierdo",
          scope: "maquina",
          kind: "number",
          unit: "cm",
          description: "Margen no imprimible izquierdo.",
          placeholder: "0.5",
        }),
        field({
          key: "margenDerecho",
          label: "Margen derecho",
          scope: "maquina",
          kind: "number",
          unit: "cm",
          description: "Margen no imprimible derecho.",
          placeholder: "0.5",
        }),
        field({
          key: "gramajeMinimo",
          label: "Gramaje minimo",
          scope: "maquina",
          kind: "number",
          unit: "g_m2",
          description: "Gramaje minimo admitido.",
          placeholder: "60",
        }),
        field({
          key: "gramajeMaximo",
          label: "Gramaje maximo",
          scope: "maquina",
          kind: "number",
          unit: "g_m2",
          description: "Gramaje maximo admitido.",
          placeholder: "350",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parametros tecnicos",
      description: "Configuracion de impresion y restricciones operativas del equipo.",
      fields: [
        field({
          key: "configuracionColor",
          label: "Configuracion color",
          scope: "maquina",
          kind: "select",
          required: true,
          description: "Define si la maquina trabaja solo en negro o tambien color.",
          options: [
            option("bn", "Solo blanco y negro"),
            option("color", "Color"),
            option("color_especial", "Color con estaciones especiales"),
          ],
        }),
        field({
          key: "resolucionNominal",
          label: "Resolucion nominal",
          scope: "maquina",
          kind: "number",
          unit: "dpi",
          description: "Resolucion nominal del equipo.",
          placeholder: "1200",
        }),
        field({
          key: "duplexSoportado",
          label: "Duplex soportado",
          scope: "maquina",
          kind: "boolean",
          description: "Indica si la maquina puede imprimir doble faz.",
        }),
        field({
          key: "bannerSoportado",
          label: "Banner soportado",
          scope: "maquina",
          kind: "boolean",
          description: "Activalo si permite tiradas largas tipo banner.",
        }),
        field({
          key: "largoMaximoBanner",
          label: "Largo maximo banner",
          scope: "maquina",
          kind: "number",
          unit: "cm",
          description: "Largo maximo de impresion en modo banner.",
          placeholder: "120",
        }),
        field({
          key: "controladorRip",
          label: "Controlador o RIP",
          scope: "maquina",
          kind: "text",
          description: "Nombre del controlador digital principal del equipo.",
          placeholder: "Fiery",
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Perfiles por formato, modo de color y calidad de impresion.",
      tooltip: "Es la parte mas importante para reflejar la productividad real de una digital.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Nombre visible del perfil operativo.",
          placeholder: "A4 Color Normal",
        }),
        field({
          key: "formatoObjetivo",
          label: "Formato objetivo",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          description: "Formato estandar o personalizado para este perfil.",
          options: sheetFormatOptions,
        }),
        field({
          key: "modoImpresion",
          label: "Modo de impresion",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          description: "Define si el perfil imprime en blanco y negro o color.",
          options: printModeOptions,
        }),
        field({
          key: "calidad",
          label: "Calidad",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          description: "Nivel de calidad del perfil.",
          options: qualityOptions,
        }),
        field({
          key: "productividad",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          required: true,
          unit: "ppm",
          description: "Velocidad nominal del perfil en paginas por minuto.",
          placeholder: "33",
        }),
        field({
          key: "tiempoRipMin",
          label: "Tiempo RIP",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo medio de RIP por corrida.",
          placeholder: "3",
        }),
        field({
          key: "tiempoCargaMin",
          label: "Tiempo de carga",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo medio de carga o preparacion de material.",
          placeholder: "2",
        }),
      ],
    }),
    section({
      id: "consumibles",
      title: "Consumibles",
      description: "Toners y otros insumos variables del equipo.",
      fields: genericConsumableFields,
    }),
    section({
      id: "desgaste_repuestos",
      title: "Desgaste y repuestos",
      description: "Componentes con vida util que deben prorratearse.",
      fields: genericWearFields,
    }),
  ];
}

function buildUvFlatbedSections(kind: "flatbed" | "mesa_extensora"): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades fisicas",
      description: "Superficie util, altura de objeto y limites mecanicos del equipo UV.",
      fields: [
        field({
          key: "anchoCama",
          label: "Ancho cama",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Ancho util de cama o zona de impresion.",
          placeholder: "250",
        }),
        field({
          key: "largoCama",
          label: "Largo cama",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Largo util de cama o zona de impresion.",
          placeholder: "130",
        }),
        field({
          key: "alturaMaximaObjeto",
          label: "Altura maxima objeto",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Altura maxima del objeto que puede imprimirse.",
          placeholder: "15",
        }),
        field({
          key: "pesoMaximoSoportado",
          label: "Peso maximo soportado",
          scope: "maquina",
          kind: "number",
          unit: "kg",
          description: "Peso maximo de la pieza o mesa cargada.",
          placeholder: "80",
        }),
        field({
          key: "zonasVacio",
          label: "Zonas de vacio",
          scope: "maquina",
          kind: "number",
          description: "Cantidad de zonas de vacio controlables.",
          placeholder: "4",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parametros tecnicos",
      description: "Canales de tinta, mesa y comportamiento UV del equipo.",
      fields: [
        field({
          key: "tipoMesa",
          label: "Tipo de mesa",
          scope: "maquina",
          kind: "select",
          required: true,
          description: "Configuracion mecanica principal de alimentacion.",
          options:
            kind === "mesa_extensora"
              ? [
                  option("mesa_extensora", "Mesa extensora"),
                  option("cinta", "Cinta"),
                ]
              : [option("flatbed", "Flatbed fija")],
        }),
        field({
          key: "configuracionCanales",
          label: "Configuracion de canales",
          scope: "maquina",
          kind: "select",
          required: true,
          description: "Combinacion de canales de tinta habilitada en la maquina.",
          options: uvPrintModeOptions,
        }),
        field({
          key: "blancoDisponible",
          label: "Blanco disponible",
          scope: "maquina",
          kind: "boolean",
          description: "Indica si la maquina imprime tinta blanca.",
        }),
        field({
          key: "barnizDisponible",
          label: "Barniz disponible",
          scope: "maquina",
          kind: "boolean",
          description: "Indica si la maquina aplica barniz o clear.",
        }),
        field({
          key: "primerDisponible",
          label: "Primer disponible",
          scope: "maquina",
          kind: "boolean",
          description: "Activalo si el equipo puede usar primer en linea.",
        }),
        field({
          key: "materialesCompatibles",
          label: "Materiales compatibles",
          scope: "maquina",
          kind: "multiselect",
          description: "Materiales rigidos sobre los que la maquina trabaja con seguridad.",
          options: rigidMediaOptions,
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Modos de impresion por calidad, color y complejidad del objeto.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Nombre tecnico del perfil UV.",
          placeholder: "Rigido blanco y barniz - normal",
        }),
        field({
          key: "modoImpresion",
          label: "Modo de impresion",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          description: "Combinacion de color y canales usada por este perfil.",
          options: uvPrintModeOptions,
        }),
        field({
          key: "calidad",
          label: "Calidad",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          description: "Nivel de calidad esperado.",
          options: qualityOptions,
        }),
        field({
          key: "productividad",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          required: true,
          unit: "m2_h",
          description: "Rendimiento del perfil en metros cuadrados por hora.",
          placeholder: "18",
        }),
        field({
          key: "cantidadPasadas",
          label: "Cantidad de pasadas",
          scope: "perfil_operativo",
          kind: "number",
          description: "Numero de pasadas del cabezal para este perfil.",
          placeholder: "8",
        }),
        field({
          key: "tiempoPreparacionMin",
          label: "Tiempo preparacion",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo medio para registro, fijacion y limpieza previa.",
          placeholder: "5",
        }),
        field({
          key: "tiempoCargaMin",
          label: "Tiempo carga/descarga",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo medio de carga y descarga por corrida.",
          placeholder: "4",
        }),
      ],
    }),
    section({
      id: "consumibles",
      title: "Consumibles",
      description: "Tintas, barnices y fluidos del equipo UV.",
      fields: genericConsumableFields,
    }),
    section({
      id: "desgaste_repuestos",
      title: "Desgaste y repuestos",
      description: "Cabezales, filtros y componentes con vida util.",
      fields: genericWearFields,
    }),
  ];
}

function buildUvRolloSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades fisicas",
      description: "Ancho util, limites de bobina y espesor del material.",
      fields: [
        field({
          key: "anchoUtil",
          label: "Ancho util",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Ancho maximo imprimible real.",
          placeholder: "160",
        }),
        field({
          key: "diametroMaximoBobina",
          label: "Diametro maximo bobina",
          scope: "maquina",
          kind: "number",
          unit: "cm",
          description: "Diametro maximo de rollo admitido.",
          placeholder: "25",
        }),
        field({
          key: "pesoMaximoBobina",
          label: "Peso maximo bobina",
          scope: "maquina",
          kind: "number",
          unit: "kg",
          description: "Peso maximo de rollo admitido.",
          placeholder: "45",
        }),
        field({
          key: "espesorMaximoMaterial",
          label: "Espesor maximo material",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          description: "Espesor maximo del material flexible.",
          placeholder: "1",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parametros tecnicos",
      description: "Canales, secado y materiales compatibles.",
      fields: [
        field({
          key: "configuracionCanales",
          label: "Configuracion de canales",
          scope: "maquina",
          kind: "select",
          required: true,
          description: "Canales de tinta habilitados en la maquina.",
          options: uvPrintModeOptions,
        }),
        field({
          key: "sistemaCurado",
          label: "Sistema curado",
          scope: "maquina",
          kind: "select",
          description: "Tipo de curado principal del equipo.",
          options: [option("uv_led", "UV LED")],
        }),
        field({
          key: "materialesCompatibles",
          label: "Materiales compatibles",
          scope: "maquina",
          kind: "multiselect",
          description: "Materiales flexibles compatibles con esta maquina.",
          options: rollMediaOptions,
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Perfiles por calidad, velocidad y configuracion de color.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Nombre del perfil UV rollo.",
          placeholder: "Vinilo CMYK + Blanco normal",
        }),
        field({
          key: "modoImpresion",
          label: "Modo impresion",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          description: "Configuracion de color usada en el perfil.",
          options: uvPrintModeOptions,
        }),
        field({
          key: "calidad",
          label: "Calidad",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          description: "Nivel de calidad o produccion del perfil.",
          options: qualityOptions,
        }),
        field({
          key: "productividad",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          required: true,
          unit: "m2_h",
          description: "Rendimiento nominal por hora.",
          placeholder: "22",
        }),
        field({
          key: "cantidadPasadas",
          label: "Cantidad de pasadas",
          scope: "perfil_operativo",
          kind: "number",
          description: "Numero de pasadas del perfil.",
          placeholder: "6",
        }),
        field({
          key: "tiempoPreparacionMin",
          label: "Tiempo preparacion",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo medio de montaje, tensado y limpieza.",
          placeholder: "4",
        }),
      ],
    }),
    section({
      id: "consumibles",
      title: "Consumibles",
      description: "Tintas y fluidos del equipo UV rollo.",
      fields: genericConsumableFields,
    }),
    section({
      id: "desgaste_repuestos",
      title: "Desgaste y repuestos",
      description: "Cabezales, filtros y partes de arrastre.",
      fields: genericWearFields,
    }),
  ];
}

function buildUvCylindricalSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades fisicas",
      description: "Limites geometricos de objetos cilindricos.",
      fields: [
        field({
          key: "diametroMinimo",
          label: "Diametro minimo",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Diametro minimo admitido.",
          placeholder: "4",
        }),
        field({
          key: "diametroMaximo",
          label: "Diametro maximo",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Diametro maximo admitido.",
          placeholder: "12",
        }),
        field({
          key: "largoUtil",
          label: "Largo util",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Largo util de impresion del objeto.",
          placeholder: "28",
        }),
        field({
          key: "pesoMaximoObjeto",
          label: "Peso maximo objeto",
          scope: "maquina",
          kind: "number",
          unit: "kg",
          description: "Peso maximo del objeto cilindrico.",
          placeholder: "3",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parametros tecnicos",
      description: "Canales y objetos compatibles de la maquina cilindrica.",
      fields: [
        field({
          key: "configuracionCanales",
          label: "Configuracion de canales",
          scope: "maquina",
          kind: "select",
          required: true,
          description: "Canales de tinta disponibles.",
          options: uvPrintModeOptions,
        }),
        field({
          key: "objetosCompatibles",
          label: "Objetos compatibles",
          scope: "maquina",
          kind: "multiselect",
          description: "Objetos cilindricos mas frecuentes.",
          options: cylindricalObjectOptions,
        }),
        field({
          key: "rotacionControlada",
          label: "Rotacion controlada",
          scope: "maquina",
          kind: "boolean",
          description: "Activalo si controla automaticamente la rotacion del objeto.",
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Perfiles de impresion por tipo de objeto y calidad.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Nombre del perfil de objeto cilindrico.",
          placeholder: "Termo blanco normal",
        }),
        field({
          key: "modoImpresion",
          label: "Modo impresion",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          description: "Configuracion de color usada.",
          options: uvPrintModeOptions,
        }),
        field({
          key: "calidad",
          label: "Calidad",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          description: "Nivel de calidad del perfil.",
          options: qualityOptions,
        }),
        field({
          key: "productividad",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          required: true,
          unit: "piezas_h",
          description: "Piezas por hora para este perfil.",
          placeholder: "40",
        }),
        field({
          key: "cantidadPasadas",
          label: "Cantidad de pasadas",
          scope: "perfil_operativo",
          kind: "number",
          description: "Cantidad de pasadas del cabezal.",
          placeholder: "6",
        }),
        field({
          key: "tiempoPreparacionMin",
          label: "Tiempo preparacion",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo medio de ajuste y fijacion del objeto.",
          placeholder: "5",
        }),
      ],
    }),
    section({
      id: "consumibles",
      title: "Consumibles",
      description: "Tintas y fluidos asociados a impresion cilindrica.",
      fields: genericConsumableFields,
    }),
    section({
      id: "desgaste_repuestos",
      title: "Desgaste y repuestos",
      description: "Cabezales, rodillos y componentes de desgaste.",
      fields: genericWearFields,
    }),
  ];
}

function buildRollInkjetSections(
  familyLabel: string,
  extraDescription: string,
): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades fisicas",
      description: "Ancho util y limites de bobina del equipo.",
      fields: [
        field({
          key: "anchoUtil",
          label: "Ancho util",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Ancho maximo imprimible real.",
          placeholder: "160",
        }),
        field({
          key: "diametroMaximoBobina",
          label: "Diametro maximo bobina",
          scope: "maquina",
          kind: "number",
          unit: "cm",
          description: "Diametro maximo de rollo admitido.",
          placeholder: "25",
        }),
        field({
          key: "pesoMaximoBobina",
          label: "Peso maximo bobina",
          scope: "maquina",
          kind: "number",
          unit: "kg",
          description: "Peso maximo de rollo admitido.",
          placeholder: "40",
        }),
        field({
          key: "espesorMaximoMaterial",
          label: "Espesor maximo material",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          description: "Espesor maximo del sustrato.",
          placeholder: "1",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parametros tecnicos",
      description: extraDescription,
      fields: [
        field({
          key: "configuracionTintas",
          label: "Configuracion de tintas",
          scope: "maquina",
          kind: "text",
          description: "Describe la configuracion principal de tintas del equipo.",
          placeholder: "CMYK + Light Cyan + Light Magenta",
        }),
        field({
          key: "resolucionNominal",
          label: "Resolucion nominal",
          scope: "maquina",
          kind: "number",
          unit: "dpi",
          description: "Resolucion nominal del equipo.",
          placeholder: "1200",
        }),
        field({
          key: "sistemaSecadoCurado",
          label: "Sistema secado/curado",
          scope: "maquina",
          kind: "select",
          description: "Sistema de secado o curado principal.",
          options: cureSystemOptions,
        }),
        field({
          key: "materialesCompatibles",
          label: "Materiales compatibles",
          scope: "maquina",
          kind: "multiselect",
          description: "Materiales que puede procesar la maquina.",
          options: rollMediaOptions,
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: `Perfiles de ${familyLabel.toLowerCase()} por calidad, pasadas y material.`,
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Nombre del perfil operativo.",
          placeholder: "Vinilo alta calidad",
        }),
        field({
          key: "calidad",
          label: "Calidad",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          description: "Nivel de calidad del perfil.",
          options: qualityOptions,
        }),
        field({
          key: "productividad",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          required: true,
          unit: "m2_h",
          description: "Rendimiento en metros cuadrados por hora.",
          placeholder: "25",
        }),
        field({
          key: "cantidadPasadas",
          label: "Cantidad de pasadas",
          scope: "perfil_operativo",
          kind: "number",
          description: "Numero de pasadas del perfil.",
          placeholder: "6",
        }),
        field({
          key: "tiempoPreparacionMin",
          label: "Tiempo preparacion",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo medio de montaje, tensado y limpieza.",
          placeholder: "4",
        }),
      ],
    }),
    section({
      id: "consumibles",
      title: "Consumibles",
      description: "Tintas y materiales variables del equipo.",
      fields: genericConsumableFields,
    }),
    section({
      id: "desgaste_repuestos",
      title: "Desgaste y repuestos",
      description: "Cabezales, filtros y piezas de arrastre.",
      fields: genericWearFields,
    }),
  ];
}

function buildDtfSections(kind: "dtf" | "dtf_uv"): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades fisicas",
      description: "Ancho util y limitaciones del consumible de transferencia.",
      fields: [
        field({
          key: "anchoUtil",
          label: "Ancho util",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Ancho maximo imprimible sobre film.",
          placeholder: "60",
        }),
        field({
          key: "espesorMaximoFilm",
          label: "Espesor maximo film",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          description: "Espesor maximo admitido del film.",
          placeholder: "0.5",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parametros tecnicos",
      description:
        kind === "dtf"
          ? "Canales, tipo de film y configuracion de impresion DTF."
          : "Canales, materiales y laminacion para transferencia DTF UV.",
      fields: [
        field({
          key: "configuracionTintas",
          label: "Configuracion de tintas",
          scope: "maquina",
          kind: "select",
          required: true,
          description: "Configuracion de tintas del equipo.",
          options:
            kind === "dtf"
              ? dtfInkOptions
              : [
                  option("cmyk_blanco_barniz", "CMYK + Blanco + Barniz"),
                  option("cmyk_blanco", "CMYK + Blanco"),
                ],
        }),
        field({
          key: "tipoFilm",
          label: "Tipo de film",
          scope: "maquina",
          kind: "text",
          description: "Tipo de film o material de transferencia utilizado.",
          placeholder: kind === "dtf" ? "PET hot peel" : "Film A/B UV",
        }),
        field({
          key: "sistemaSecadoCurado",
          label: "Sistema secado/curado",
          scope: "maquina",
          kind: "select",
          description: "Sistema principal de secado o curado.",
          options:
            kind === "dtf"
              ? [option("calor", "Secado por calor")]
              : [option("uv_led", "UV LED")],
        }),
        field({
          key: "materialesCompatibles",
          label: "Materiales compatibles",
          scope: "maquina",
          kind: kind === "dtf" ? "multiselect" : "multiselect",
          description:
            kind === "dtf"
              ? "Textiles sobre los que suele aplicarse la transferencia."
              : "Superficies sobre las que puede adherirse la transferencia UV.",
          options:
            kind === "dtf"
              ? [
                  option("algodon", "Algodon"),
                  option("polyester", "Polyester"),
                  option("mezcla", "Mezcla"),
                ]
              : rigidMediaOptions,
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Perfiles por calidad, ancho de trabajo y configuracion de tintas.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Nombre del perfil DTF.",
          placeholder:
            kind === "dtf" ? "Textil color normal" : "Transfer UV rigido normal",
        }),
        field({
          key: "calidad",
          label: "Calidad",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          description: "Nivel de calidad del perfil.",
          options: qualityOptions,
        }),
        field({
          key: "productividad",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          required: true,
          unit: "m2_h",
          description: "Rendimiento por hora del perfil.",
          placeholder: "8",
        }),
        field({
          key: "cantidadPasadas",
          label: "Cantidad de pasadas",
          scope: "perfil_operativo",
          kind: "number",
          description: "Numero de pasadas del perfil.",
          placeholder: "8",
        }),
        field({
          key: "tiempoPreparacionMin",
          label: "Tiempo preparacion",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo medio de preparacion por corrida.",
          placeholder: "4",
        }),
      ],
    }),
    section({
      id: "consumibles",
      title: "Consumibles",
      description: "Tintas, film, polvo y materiales auxiliares.",
      fields: genericConsumableFields,
    }),
    section({
      id: "desgaste_repuestos",
      title: "Desgaste y repuestos",
      description: "Cabezales, filtros y kits del equipo.",
      fields: genericWearFields,
    }),
  ];
}

function build3dSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades fisicas",
      description: "Volumen util de impresion y limites geometricos del equipo 3D.",
      fields: [
        field({
          key: "volumenX",
          label: "Volumen X",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Medida util del eje X.",
          placeholder: "22",
        }),
        field({
          key: "volumenY",
          label: "Volumen Y",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Medida util del eje Y.",
          placeholder: "22",
        }),
        field({
          key: "volumenZ",
          label: "Volumen Z",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Medida util del eje Z.",
          placeholder: "30",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parametros tecnicos",
      description: "Tecnologia, materiales y granularidad de impresion 3D.",
      fields: [
        field({
          key: "tecnologia",
          label: "Tecnologia",
          scope: "maquina",
          kind: "select",
          required: true,
          description: "Tecnologia principal de fabricacion.",
          options: threeDTechnologyOptions,
        }),
        field({
          key: "alturaMinimaCapa",
          label: "Altura minima capa",
          scope: "maquina",
          kind: "number",
          unit: "micrones",
          description: "Altura minima de capa soportada.",
          placeholder: "50",
        }),
        field({
          key: "alturaMaximaCapa",
          label: "Altura maxima capa",
          scope: "maquina",
          kind: "number",
          unit: "micrones",
          description: "Altura maxima de capa soportada.",
          placeholder: "300",
        }),
        field({
          key: "cantidadExtrusores",
          label: "Cantidad extrusores/cabezales",
          scope: "maquina",
          kind: "number",
          description: "Cantidad de extrusores o cabezales utiles.",
          placeholder: "1",
        }),
        field({
          key: "diametroBoquilla",
          label: "Diametro boquilla",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          description: "Diametro de boquilla principal.",
          placeholder: "0.4",
        }),
        field({
          key: "materialesCompatibles",
          label: "Materiales compatibles",
          scope: "maquina",
          kind: "multiselect",
          description: "Materiales imprimibles en esta maquina.",
          options: additiveMaterialOptions,
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Perfiles de calidad y produccion para impresiones 3D repetibles.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Nombre del perfil 3D.",
          placeholder: "PLA calidad normal",
        }),
        field({
          key: "materialObjetivo",
          label: "Material objetivo",
          scope: "perfil_operativo",
          kind: "select",
          description: "Material recomendado para este perfil.",
          options: additiveMaterialOptions,
        }),
        field({
          key: "calidad",
          label: "Calidad",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          description: "Nivel de calidad del perfil.",
          options: qualityOptions,
        }),
        field({
          key: "alturaCapa",
          label: "Altura de capa",
          scope: "perfil_operativo",
          kind: "number",
          unit: "micrones",
          description: "Altura de capa usada por el perfil.",
          placeholder: "150",
        }),
        field({
          key: "productividad",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          unit: "piezas_h",
          description: "Piezas estimadas por hora en este perfil.",
          placeholder: "2",
        }),
      ],
    }),
    section({
      id: "consumibles",
      title: "Consumibles",
      description: "Filamentos, resinas y materiales auxiliares.",
      fields: genericConsumableFields,
    }),
    section({
      id: "desgaste_repuestos",
      title: "Desgaste y repuestos",
      description: "Boquillas, filtros y kits de mantenimiento.",
      fields: genericWearFields,
    }),
  ];
}

function buildRouterSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades fisicas",
      description: "Area util de trabajo y limite de espesor para mecanizado.",
      fields: [
        field({
          key: "ejeXUtil",
          label: "Eje X util",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Area util del eje X.",
          placeholder: "210",
        }),
        field({
          key: "ejeYUtil",
          label: "Eje Y util",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Area util del eje Y.",
          placeholder: "310",
        }),
        field({
          key: "ejeZUtil",
          label: "Eje Z util",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Recorrido util del eje Z.",
          placeholder: "20",
        }),
        field({
          key: "espesorMaximo",
          label: "Espesor maximo",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          description: "Espesor maximo del material procesable.",
          placeholder: "80",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parametros tecnicos",
      description: "Potencia, velocidad y configuracion mecanica del router.",
      fields: [
        field({
          key: "potenciaSpindle",
          label: "Potencia spindle",
          scope: "maquina",
          kind: "number",
          unit: "kw",
          description: "Potencia nominal del spindle.",
          placeholder: "6",
        }),
        field({
          key: "rpmMinima",
          label: "RPM minima",
          scope: "maquina",
          kind: "number",
          unit: "rpm",
          description: "RPM minima del spindle.",
          placeholder: "6000",
        }),
        field({
          key: "rpmMaxima",
          label: "RPM maxima",
          scope: "maquina",
          kind: "number",
          unit: "rpm",
          description: "RPM maxima del spindle.",
          placeholder: "24000",
        }),
        field({
          key: "velocidadAvance",
          label: "Velocidad avance",
          scope: "maquina",
          kind: "number",
          unit: "mm_s",
          description: "Velocidad maxima de avance.",
          placeholder: "300",
        }),
        field({
          key: "velocidadDesplazamiento",
          label: "Velocidad desplazamiento",
          scope: "maquina",
          kind: "number",
          unit: "mm_s",
          description: "Velocidad maxima en vacio.",
          placeholder: "500",
        }),
        field({
          key: "cantidadHerramientas",
          label: "Cantidad herramientas",
          scope: "maquina",
          kind: "number",
          description: "Cantidad de herramientas en magazin o cambiador.",
          placeholder: "8",
        }),
        field({
          key: "cambiadorAutomatico",
          label: "Cambiador automatico",
          scope: "maquina",
          kind: "boolean",
          description: "Activalo si el equipo cambia herramientas automaticamente.",
        }),
        field({
          key: "vacioSujecion",
          label: "Vacio o sujecion",
          scope: "maquina",
          kind: "boolean",
          description: "Indica si tiene mesa de vacio o sistema de sujecion asistido.",
        }),
        field({
          key: "materialesCompatibles",
          label: "Materiales compatibles",
          scope: "maquina",
          kind: "multiselect",
          description: "Materiales que el router puede mecanizar con seguridad.",
          options: cncMaterialOptions,
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Perfiles por material, herramienta y estrategia de mecanizado.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Nombre del perfil de mecanizado.",
          placeholder: "Acrilico 5 mm corte limpio",
        }),
        field({
          key: "tipoOperacion",
          label: "Tipo de operacion",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          description: "Tipo principal de operacion del perfil.",
          options: [
            option("corte", "Corte"),
            option("grabado", "Grabado"),
            option("desbaste", "Desbaste"),
            option("terminacion", "Terminacion"),
          ],
        }),
        field({
          key: "materialObjetivo",
          label: "Material objetivo",
          scope: "perfil_operativo",
          kind: "select",
          description: "Material principal del perfil.",
          options: cncMaterialOptions,
        }),
        field({
          key: "herramienta",
          label: "Herramienta",
          scope: "perfil_operativo",
          kind: "text",
          description: "Herramienta principal recomendada para el perfil.",
          placeholder: "Fresa 3 mm 2 filos",
        }),
        field({
          key: "profundidadMaximaPorPasada",
          label: "Profundidad max por pasada",
          scope: "perfil_operativo",
          kind: "number",
          unit: "mm",
          description: "Profundidad maxima por pasada.",
          placeholder: "2",
        }),
        field({
          key: "velocidadAvance",
          label: "Velocidad avance",
          scope: "perfil_operativo",
          kind: "number",
          unit: "mm_s",
          description: "Velocidad de avance recomendada.",
          placeholder: "120",
        }),
        field({
          key: "rpmSpindle",
          label: "RPM spindle",
          scope: "perfil_operativo",
          kind: "number",
          unit: "rpm",
          description: "RPM sugerida para el perfil.",
          placeholder: "18000",
        }),
      ],
    }),
    section({
      id: "consumibles",
      title: "Consumibles",
      description: "Lubricantes y materiales auxiliares del equipo.",
      fields: genericConsumableFields,
    }),
    section({
      id: "desgaste_repuestos",
      title: "Desgaste y repuestos",
      description: "Fresas, filtros y componentes de mantenimiento.",
      fields: genericWearFields,
    }),
  ];
}

function buildLaserCutSections(): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades fisicas",
      description: "Area util y despeje del equipo de corte laser.",
      fields: [
        field({
          key: "ejeXUtil",
          label: "Eje X util",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Area util del eje X.",
          placeholder: "130",
        }),
        field({
          key: "ejeYUtil",
          label: "Eje Y util",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Area util del eje Y.",
          placeholder: "90",
        }),
        field({
          key: "despejeZ",
          label: "Despeje Z",
          scope: "maquina",
          kind: "number",
          unit: "cm",
          description: "Despeje vertical disponible.",
          placeholder: "15",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parametros tecnicos",
      description: "Potencia, tipo de laser y materiales compatibles.",
      fields: [
        field({
          key: "tipoLaser",
          label: "Tipo de laser",
          scope: "maquina",
          kind: "select",
          required: true,
          description: "Tecnologia principal del tubo o fuente.",
          options: laserTypeOptions,
        }),
        field({
          key: "potenciaLaser",
          label: "Potencia laser",
          scope: "maquina",
          kind: "number",
          unit: "kw",
          description: "Potencia nominal del laser.",
          placeholder: "0.15",
        }),
        field({
          key: "velocidadCorte",
          label: "Velocidad corte",
          scope: "maquina",
          kind: "number",
          unit: "mm_s",
          description: "Velocidad maxima de corte.",
          placeholder: "400",
        }),
        field({
          key: "velocidadGrabado",
          label: "Velocidad grabado",
          scope: "maquina",
          kind: "number",
          unit: "mm_s",
          description: "Velocidad maxima de grabado.",
          placeholder: "600",
        }),
        field({
          key: "extraccionAsistida",
          label: "Extraccion asistida",
          scope: "maquina",
          kind: "boolean",
          description: "Activalo si el equipo cuenta con extraccion o asistencia de aire.",
        }),
        field({
          key: "materialesCompatibles",
          label: "Materiales compatibles",
          scope: "maquina",
          kind: "multiselect",
          description: "Materiales aptos para corte o grabado en esta maquina.",
          options: laserMaterialOptions,
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Perfiles por material, potencia y velocidad.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Nombre del perfil de corte o grabado.",
          placeholder: "Acrilico 3 mm corte limpio",
        }),
        field({
          key: "tipoOperacion",
          label: "Tipo de operacion",
          scope: "perfil_operativo",
          kind: "select",
          required: true,
          description: "Operacion principal del perfil.",
          options: [
            option("corte", "Corte"),
            option("grabado", "Grabado"),
          ],
        }),
        field({
          key: "materialObjetivo",
          label: "Material objetivo",
          scope: "perfil_operativo",
          kind: "select",
          description: "Material principal del perfil.",
          options: laserMaterialOptions,
        }),
        field({
          key: "potenciaAplicada",
          label: "Potencia aplicada",
          scope: "perfil_operativo",
          kind: "number",
          unit: "porcentaje",
          description: "Potencia recomendada del perfil.",
          placeholder: "80",
        }),
        field({
          key: "velocidadTrabajo",
          label: "Velocidad trabajo",
          scope: "perfil_operativo",
          kind: "number",
          unit: "mm_s",
          description: "Velocidad recomendada del perfil.",
          placeholder: "150",
        }),
        field({
          key: "cantidadPasadas",
          label: "Cantidad de pasadas",
          scope: "perfil_operativo",
          kind: "number",
          description: "Pasadas necesarias para el resultado deseado.",
          placeholder: "1",
        }),
      ],
    }),
    section({
      id: "consumibles",
      title: "Consumibles",
      description: "Gases, lubricantes o materiales auxiliares.",
      fields: genericConsumableFields,
    }),
    section({
      id: "desgaste_repuestos",
      title: "Desgaste y repuestos",
      description: "Lentes, espejos, filtros y piezas de mantenimiento.",
      fields: genericWearFields,
    }),
  ];
}

function buildCuttingTableSections(kind: "mesa" | "plotter"): MaquinariaTemplateSection[] {
  return [
    section({
      id: "capacidades_fisicas",
      title: "Capacidades fisicas",
      description: "Area util de trabajo y espesor maximo del material.",
      fields: [
        field({
          key: "anchoUtil",
          label: "Ancho util",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Ancho util de trabajo.",
          placeholder: kind === "mesa" ? "160" : "140",
        }),
        field({
          key: "largoUtil",
          label: "Largo util",
          scope: "maquina",
          kind: "number",
          required: true,
          unit: "cm",
          description: "Largo util de trabajo.",
          placeholder: kind === "mesa" ? "300" : "1000",
        }),
        field({
          key: "espesorMaximo",
          label: "Espesor maximo",
          scope: "maquina",
          kind: "number",
          unit: "mm",
          description: "Espesor maximo procesable.",
          placeholder: kind === "mesa" ? "20" : "2",
        }),
      ],
    }),
    section({
      id: "parametros_tecnicos",
      title: "Parametros tecnicos",
      description:
        kind === "mesa"
          ? "Herramientas, vacio y materiales del equipo de corte."
          : "Herramientas, fuerza y materiales del plotter de corte.",
      fields: [
        field({
          key: "herramientasCompatibles",
          label: "Herramientas compatibles",
          scope: "maquina",
          kind: "multiselect",
          description: "Herramientas disponibles para esta maquina.",
          options: cuttingToolOptions,
        }),
        field({
          key: "velocidadCorte",
          label: "Velocidad corte",
          scope: "maquina",
          kind: "number",
          unit: "mm_s",
          description: "Velocidad maxima de corte.",
          placeholder: "600",
        }),
        field({
          key: "vacioSujecion",
          label: "Vacio o sujecion",
          scope: "maquina",
          kind: "boolean",
          description: "Activalo si cuenta con cama de vacio o sujecion asistida.",
        }),
        field({
          key: "materialesCompatibles",
          label: "Materiales compatibles",
          scope: "maquina",
          kind: "multiselect",
          description: "Materiales procesables por este equipo.",
          options:
            kind === "mesa"
              ? [
                  option("carton", "Carton"),
                  option("corrugado", "Corrugado"),
                  option("foamboard", "Foamboard"),
                  option("vinilo", "Vinilo"),
                  option("pvc", "PVC"),
                ]
              : [
                  option("vinilo", "Vinilo"),
                  option("papel", "Papel"),
                  option("film", "Film"),
                  option("transfer", "Transfer"),
                ],
        }),
      ],
    }),
    section({
      id: "perfiles_operativos",
      title: "Perfiles operativos",
      description: "Perfiles de corte por material, herramienta y velocidad.",
      fields: [
        field({
          key: "nombre",
          label: "Nombre del perfil",
          scope: "perfil_operativo",
          kind: "text",
          required: true,
          description: "Nombre del perfil de corte.",
          placeholder: kind === "mesa" ? "Corrugado corte rapido" : "Vinilo rotulacion fino",
        }),
        field({
          key: "materialObjetivo",
          label: "Material objetivo",
          scope: "perfil_operativo",
          kind: "text",
          description: "Material principal del perfil.",
          placeholder: kind === "mesa" ? "Corrugado doble canal" : "Vinilo calandrado",
        }),
        field({
          key: "herramienta",
          label: "Herramienta",
          scope: "perfil_operativo",
          kind: "text",
          description: "Herramienta principal del perfil.",
          placeholder: kind === "mesa" ? "Cuchilla tangencial" : "Cuchilla 45 grados",
        }),
        field({
          key: "productividad",
          label: "Productividad",
          scope: "perfil_operativo",
          kind: "number",
          unit: "m2_h",
          description: "Rendimiento nominal del perfil.",
          placeholder: kind === "mesa" ? "35" : "12",
        }),
        field({
          key: "tiempoPreparacionMin",
          label: "Tiempo preparacion",
          scope: "perfil_operativo",
          kind: "number",
          unit: "min",
          description: "Tiempo medio de carga y ajuste.",
          placeholder: "3",
        }),
      ],
    }),
    section({
      id: "consumibles",
      title: "Consumibles",
      description: "Materiales auxiliares y consumibles del equipo.",
      fields: genericConsumableFields,
    }),
    section({
      id: "desgaste_repuestos",
      title: "Desgaste y repuestos",
      description: "Cuchillas, ruedas y kits de mantenimiento.",
      fields: genericWearFields,
    }),
  ];
}

export const maquinariaTemplates: MaquinariaTemplateDefinition[] = [
  template({
    id: "router_cnc",
    label: "Router CNC",
    family: "corte_mecanizado",
    description: "Equipo de mecanizado para corte, grabado o desbaste de materiales rigidos.",
    geometry: "volumen",
    defaultProductionUnit: "hora",
    visibleSections: commonTemplateSections,
    sections: buildRouterSections(),
    help: {
      summary:
        "Usa esta plantilla para routers CNC donde el recorrido X/Y/Z y la configuracion del spindle determinan la capacidad del equipo.",
      tips: [
        "Carga las medidas utiles reales y no el tamano nominal del banco.",
        "Conviene crear perfiles separados por material y herramienta.",
        "Si el equipo usa vacio o cambiador automatico, dejalo explicitado porque impacta la operacion.",
      ],
      examples: ["Router CNC 210x310 cm para acrilico y MDF"],
    },
  }),
  template({
    id: "corte_laser",
    label: "Corte laser",
    family: "corte_mecanizado",
    description: "Equipo laser para corte y grabado de materiales livianos o rigidos segun potencia.",
    geometry: "plano",
    defaultProductionUnit: "hora",
    visibleSections: commonTemplateSections,
    sections: buildLaserCutSections(),
    help: {
      summary:
        "Usa esta plantilla para equipos donde la potencia del laser, el tipo de fuente y el material definen el rendimiento real.",
      tips: [
        "Separa perfiles de corte y grabado para evitar mezclar velocidades.",
        "Registra los materiales compatibles de forma conservadora.",
      ],
      warnings: [
        "No todos los materiales son aptos para corte laser; evita cargar compatibilidades dudosas.",
      ],
      examples: ["Laser CO2 130x90 cm para acrilico y MDF"],
    },
  }),
  template({
    id: "impresora_3d",
    label: "Impresora 3D",
    family: "fabricacion_aditiva",
    description: "Equipo de fabricacion aditiva para piezas, prototipos y series cortas.",
    geometry: "volumen",
    defaultProductionUnit: "pieza",
    visibleSections: commonTemplateSections,
    sections: build3dSections(),
    help: {
      summary:
        "Usa esta plantilla para equipos 3D donde el volumen de impresion, la tecnologia y el material condicionan la capacidad del equipo.",
      tips: [
        "Conviene cargar perfiles separados por material y altura de capa.",
        "Si una impresora usa resina o tecnologia distinta, reflejalo en el campo de tecnologia.",
      ],
      examples: ["Impresora FDM de 22x22x30 cm con PLA y PETG"],
    },
  }),
  template({
    id: "impresora_dtf",
    label: "Impresora DTF",
    family: "impresion_transferencia",
    description: "Equipo DTF para impresion sobre film y transferencia textil.",
    geometry: "rollo",
    defaultProductionUnit: "m2",
    visibleSections: commonTemplateSections,
    sections: buildDtfSections("dtf"),
    help: {
      summary:
        "Usa esta plantilla para DTF textil donde el ancho de film, la configuracion de tintas y el secado explican el comportamiento del equipo.",
      tips: [
        "Conviene separar perfiles por calidad y tipo de prenda.",
        "Carga film y polvo como consumibles distintos.",
      ],
      examples: ["DTF 60 cm CMYK + Blanco para remeras y buzos"],
    },
  }),
  template({
    id: "impresora_dtf_uv",
    label: "Impresora DTF UV",
    family: "impresion_transferencia",
    description: "Equipo DTF UV para transferencia sobre superficies rigidas o semirigidas.",
    geometry: "rollo",
    defaultProductionUnit: "m2",
    visibleSections: commonTemplateSections,
    sections: buildDtfSections("dtf_uv"),
    help: {
      summary:
        "Usa esta plantilla para DTF UV con film A/B o esquemas similares de transferencia.",
      tips: [
        "Conviene separar perfiles por tipo de superficie objetivo.",
        "Si usa barniz o blanco, reflejalo en los perfiles y consumibles.",
      ],
      examples: ["DTF UV 30 cm para stickers y decoracion sobre rigidos"],
    },
  }),
  template({
    id: "impresora_uv_mesa_extensora",
    label: "Impresora UV mesa extensora/cinta",
    family: "impresion_uv",
    description: "Equipo UV para rigidos o piezas especiales con mesa extensora o cinta.",
    geometry: "plano",
    defaultProductionUnit: "m2",
    visibleSections: commonTemplateSections,
    sections: buildUvFlatbedSections("mesa_extensora"),
    help: {
      summary:
        "Usa esta plantilla para UV con mesa extensora o alimentacion por cinta, util en piezas largas o flujos semicontinuos.",
      tips: [
        "Refleja el tipo de mesa correcto para distinguirla de una flatbed fija.",
        "Crea perfiles separados si el equipo cambia mucho entre rigidos y piezas largas.",
      ],
      examples: ["UV con mesa extensora para PVC espumado y corrugado"],
    },
  }),
  template({
    id: "impresora_uv_cilindrica",
    label: "Impresora UV 360 - Cilindrica",
    family: "impresion_uv",
    description: "Equipo UV para impresion directa sobre objetos cilindricos.",
    geometry: "cilindrico",
    defaultProductionUnit: "pieza",
    visibleSections: commonTemplateSections,
    sections: buildUvCylindricalSections(),
    help: {
      summary:
        "Usa esta plantilla para equipos UV con rotacion controlada para botellas, vasos o termos.",
      tips: [
        "Carga los diametros minimos y maximos reales para evitar sobreestimar capacidad.",
        "Conviene separar perfiles por tipo de objeto y calidad.",
      ],
      examples: ["UV cilindrica para termos y botellas promocionales"],
    },
  }),
  template({
    id: "impresora_uv_flatbed",
    label: "Impresora UV Flatbed",
    family: "impresion_uv",
    description: "Equipo UV de cama plana para impresion directa sobre rigidos.",
    geometry: "plano",
    defaultProductionUnit: "m2",
    visibleSections: commonTemplateSections,
    sections: buildUvFlatbedSections("flatbed"),
    help: {
      summary:
        "Usa esta plantilla para impresoras UV de cama plana donde la superficie util, la altura de objeto y los canales especiales marcan la capacidad.",
      tips: [
        "Carga solo materiales que el equipo pueda imprimir con estabilidad.",
        "Separa perfiles por uso de blanco y barniz porque alteran mucho el rendimiento.",
      ],
      examples: ["UV flatbed 250x130 cm con blanco y barniz"],
    },
  }),
  template({
    id: "impresora_uv_rollo",
    label: "Impresora UV rollo a rollo",
    family: "impresion_uv",
    description: "Equipo UV para materiales flexibles en bobina.",
    geometry: "rollo",
    defaultProductionUnit: "m2",
    visibleSections: commonTemplateSections,
    sections: buildUvRolloSections(),
    help: {
      summary:
        "Usa esta plantilla para UV rollo a rollo sobre vinilos, films y otros materiales flexibles.",
      tips: [
        "La productividad real cambia mucho segun pasadas y canales; por eso conviene usar perfiles.",
        "Carga diametro y peso de bobina reales para evitar datos irreales de capacidad.",
      ],
      examples: ["UV rollo 160 cm para vinilo backlit y film"],
    },
  }),
  template({
    id: "impresora_solvente",
    label: "Impresora solvente",
    family: "impresion_inkjet",
    description: "Equipo de gran formato solvente para materiales flexibles.",
    geometry: "rollo",
    defaultProductionUnit: "m2",
    visibleSections: commonTemplateSections,
    sections: buildRollInkjetSections(
      "Impresion solvente",
      "Tintas, resolucion y secado del equipo solvente.",
    ),
    help: {
      summary:
        "Usa esta plantilla para equipos solventes de exterior o grafica de alto volumen.",
      tips: [
        "Conviene separar perfiles por calidad y por tipo de material.",
        "Carga tintas y limpiezas como consumibles distintos.",
      ],
      examples: ["Solvente 320 cm para lona y vinilo exterior"],
    },
  }),
  template({
    id: "impresora_inyeccion_tinta",
    label: "Impresora de inyeccion de tinta",
    family: "impresion_inkjet",
    description: "Equipo inkjet general para produccion sobre materiales flexibles.",
    geometry: "rollo",
    defaultProductionUnit: "m2",
    visibleSections: commonTemplateSections,
    sections: buildRollInkjetSections(
      "Impresion inkjet",
      "Tintas, resolucion y secado del equipo inkjet.",
    ),
    help: {
      summary:
        "Usa esta plantilla cuando el equipo sea inkjet pero no encaje mejor en latex, solvente o sublimacion.",
      tips: [
        "Si la tecnologia principal es clara, prioriza la plantilla especifica.",
        "Usa esta como categoria general controlada y no como comodin indiscriminado.",
      ],
      examples: ["Inkjet 180 cm para papeles y films especiales"],
    },
  }),
  template({
    id: "impresora_latex",
    label: "Impresora de latex",
    family: "impresion_inkjet",
    description: "Equipo latex para impresion sobre sustratos flexibles con secado integrado.",
    geometry: "rollo",
    defaultProductionUnit: "m2",
    visibleSections: commonTemplateSections,
    sections: buildRollInkjetSections(
      "Impresion latex",
      "Tintas latex, resolucion y secado integrado del equipo.",
    ),
    help: {
      summary:
        "Usa esta plantilla para equipos latex donde el secado y el tipo de tinta condicionan la velocidad real.",
      tips: [
        "Distingue perfiles de alta calidad y produccion porque pueden variar mucho en m2/h.",
        "Carga los materiales flexibles compatibles reales del fabricante.",
      ],
      examples: ["Latex 160 cm para vinilo, canvas y papeles mural"],
    },
  }),
  template({
    id: "impresora_sublimacion_gran_formato",
    label: "Impresora de sublimacion - Grandes formatos",
    family: "impresion_inkjet",
    description: "Equipo para sublimacion sobre papel de transferencia o flujos textiles relacionados.",
    geometry: "rollo",
    defaultProductionUnit: "m2",
    visibleSections: commonTemplateSections,
    sections: buildRollInkjetSections(
      "Impresion sublimacion",
      "Tintas de sublimacion, resolucion y secado del equipo.",
    ),
    help: {
      summary:
        "Usa esta plantilla para equipos de sublimacion de gran formato sobre papel o soportes de transferencia.",
      tips: [
        "Carga el papel de sublimacion como consumible independiente de la tinta.",
        "Si el negocio separa impresion y planchado, aqui modela solo la parte de impresion.",
      ],
      examples: ["Sublimacion 190 cm para textil deportivo y decoracion"],
    },
  }),
  template({
    id: "impresora_laser",
    label: "Impresora laser",
    family: "impresion_digital",
    description: "Equipo digital hoja a hoja con tecnologia laser o toner.",
    geometry: "pliego",
    defaultProductionUnit: "copia",
    visibleSections: commonTemplateSections,
    sections: buildLaserPrinterSections(),
    help: {
      summary:
        "Usa esta plantilla para digitales laser o toner donde perfiles, toners y repuestos con vida util forman parte del costo operativo real.",
      tips: [
        "Crea perfiles separados por formato, color y calidad.",
        "Ademas de toner, registra fusor, drum y kits de mantenimiento en desgaste.",
        "Carga solo los margenes realmente no imprimibles para no perder superficie util sin motivo.",
      ],
      examples: ["Digital SRA3 color con perfiles A4, A3 y duplex"],
    },
  }),
  template({
    id: "plotter_cad",
    label: "Impresora CAD/Plotter",
    family: "impresion_inkjet",
    description: "Equipo de impresion tecnica para planos, lineas y reproduccion CAD.",
    geometry: "rollo",
    defaultProductionUnit: "metro_lineal",
    visibleSections: commonTemplateSections,
    sections: buildRollInkjetSections(
      "Impresion CAD/plotter",
      "Tintas, resolucion y materiales para reproduccion tecnica.",
    ),
    help: {
      summary:
        "Usa esta plantilla para plotters CAD donde predominan planos, lineas y formatos tecnicos.",
      tips: [
        "Conviene separar perfiles monocromo y color.",
        "Si la productividad se mide mejor por metro lineal, reflejalo luego en procesos o costeo.",
      ],
      examples: ["Plotter CAD 91 cm para planos y documentacion tecnica"],
    },
  }),
  template({
    id: "mesa_de_corte",
    label: "Mesa de corte",
    family: "corte_mecanizado",
    description: "Equipo de corte digital plano para materiales flexibles o semirigidos.",
    geometry: "plano",
    defaultProductionUnit: "m2",
    visibleSections: commonTemplateSections,
    sections: buildCuttingTableSections("mesa"),
    help: {
      summary:
        "Usa esta plantilla para mesas de corte digital con herramientas intercambiables y cama de vacio.",
      tips: [
        "Carga las herramientas y materiales compatibles de forma conservadora.",
        "Conviene crear perfiles por material y herramienta para reflejar mejor la realidad operativa.",
      ],
      examples: ["Mesa de corte 160x300 cm para carton, foamboard y corrugado"],
    },
  }),
  template({
    id: "plotter_de_corte",
    label: "Plotter de corte",
    family: "corte_mecanizado",
    description: "Equipo de corte continuo para vinilo, film y materiales delgados.",
    geometry: "rollo",
    defaultProductionUnit: "metro_lineal",
    visibleSections: commonTemplateSections,
    sections: buildCuttingTableSections("plotter"),
    help: {
      summary:
        "Usa esta plantilla para plotters de corte continuo donde velocidad, cuchilla y material son la base del rendimiento.",
      tips: [
        "Conviene separar perfiles por tipo de vinilo o film.",
        "Si trabajas con transferencia, registra cuchillas y bandas como desgaste.",
      ],
      examples: ["Plotter de corte 140 cm para vinilo de rotulacion"],
    },
  }),
];

export const plantillaMaquinariaItems = maquinariaTemplates.map((templateItem) => ({
  label: templateItem.label,
  value: templateItem.id,
}));

export function getMaquinariaTemplate(templateId: PlantillaMaquinaria) {
  return maquinariaTemplates.find((templateItem) => templateItem.id === templateId) ?? null;
}

export function getPlantillaMaquinariaLabel(templateId: PlantillaMaquinaria) {
  return getMaquinariaTemplate(templateId)?.label ?? templateId;
}
