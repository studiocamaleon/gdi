/**
 * Diccionario centralizado de labels humanos para enums y códigos del modelo universal.
 *
 * Sprint UX 1 (2026-04-26): traduce vocabulario técnico (enums Prisma en
 * mayúscula, códigos internos) a copy claro para el usuario final, con
 * descripciones largas opcionales que se renderizan como tooltips.
 *
 * Convención por entrada:
 *   - `label`: visible en el control (Select, Badge, Header). Corto, en español
 *     natural, sin mayúsculas innecesarias.
 *   - `descripcion`: explicación 1-2 frases que se muestra en tooltip al pasar
 *     el cursor por el icono ⓘ.
 *   - `ejemplo` (opcional): caso concreto para que el modelador entienda cuándo
 *     usar esta opción.
 *
 * Cómo se usa en componentes:
 *
 *   import { modoActivacionLabels, getLabel } from "@/lib/labels-humanos";
 *
 *   <SelectItem value="OBLIGATORIO">
 *     {getLabel(modoActivacionLabels, "OBLIGATORIO").label}
 *   </SelectItem>
 *
 *   <LabelConTooltip
 *     label="Activación"
 *     tooltip={modoActivacionLabels.OBLIGATORIO.descripcion}
 *   />
 */

export type EntradaLabel = {
  label: string;
  descripcion: string;
  ejemplo?: string;
};

export type DiccionarioLabels<K extends string = string> = Record<K, EntradaLabel>;

/**
 * Devuelve el label si existe, sino devuelve un fallback con la key cruda.
 * Esto evita romper la UI si llega un valor desconocido del backend.
 */
export function getLabel<K extends string>(
  dict: DiccionarioLabels<K>,
  key: string,
): EntradaLabel {
  return (
    (dict as Record<string, EntradaLabel>)[key] ?? {
      label: key,
      descripcion: "Valor sin traducción configurada en labels-humanos.ts.",
    }
  );
}

/**
 * Devuelve solo el label corto (helper para casos donde no necesitamos tooltip).
 */
export function shortLabel<K extends string>(dict: DiccionarioLabels<K>, key: string): string {
  return getLabel(dict, key).label;
}

// ════════════════════════════════════════════════════════════════════
// MODELO UNIVERSAL — Configuración de pasos
// ════════════════════════════════════════════════════════════════════

/** Modo de activación de un paso (D.1). */
export const modoActivacionLabels: DiccionarioLabels = {
  OBLIGATORIO: {
    label: "Obligatorio",
    descripcion: "El paso siempre se ejecuta. El comercial no puede desactivarlo al cotizar.",
    ejemplo: "Pre-prensa o impresión en una tarjeta — siempre va.",
  },
  OPCIONAL: {
    label: "Opcional",
    descripcion:
      "El paso se incluye solo si el comercial lo activa al cotizar (con un check).",
    ejemplo: "Laminado de tarjetas — el cliente decide si lo quiere.",
  },
  CONDICIONAL: {
    label: "Condicional (regla automática)",
    descripcion:
      "El paso se activa solo cuando se cumple una regla evaluada contra los datos de la cotización.",
    ejemplo: "Capa 2 de talonario — se imprime solo si tipoCopia ≥ 2.",
  },
};

/** Modo de cálculo del tiempo del paso (D.4). */
export const modoTiempoLabels: DiccionarioLabels = {
  "T-1": {
    label: "Tiempo fijo",
    descripcion:
      "El paso tiene un tiempo declarado por el modelador, no depende de la cantidad. Útil para diseño o configuración inicial.",
    ejemplo: "Diseño gráfico = 2 horas estimadas (cobrado como cargo único).",
  },
  "T-2": {
    label: "Productividad propia del paso",
    descripcion:
      "El tiempo se calcula a partir de una productividad declarada en el paso (cantidad por hora del operario), independiente de máquina.",
    ejemplo: "Embalaje manual = 60 cajas/hora.",
  },
  "T-3": {
    label: "Productividad de la máquina y perfil",
    descripcion:
      "El tiempo se calcula con la productividad del perfil operativo de la máquina elegida (ej: 40 ppm en Ricoh).",
    ejemplo: "Impresión digital láser = 40 pliegos/min.",
  },
  "T-4": {
    label: "Tiempo ingresado por el comercial al cotizar",
    descripcion:
      "El comercial ingresa el tiempo en cada cotización (típicamente cuando lo da el RIP de la máquina, ej: corte láser).",
    ejemplo: "Corte láser de pieza compleja = el comercial ingresa 45 min.",
  },
};

/** Mecanismo para resolver la cantidad efectiva del paso (D.3). */
export const mecanismoCantidadLabels: DiccionarioLabels = {
  DIRECT_FROM_JOBCONTEXT: {
    label: "Cantidad pedida directa",
    descripcion:
      "Usa la cantidad que pidió el comercial al cotizar (ej: 1000 tarjetas).",
  },
  HEREDAR_DEL_OUTPUT_CANONICO: {
    label: "Hereda del paso anterior",
    descripcion:
      "Toma el resultado calculado por un paso previo (ej: pliegos calculados por pre-prensa).",
    ejemplo: "Impresión hereda los pliegos que pre-prensa decidió.",
  },
  CALCULADO_POR_PASO: {
    label: "Calculado por nesting",
    descripcion:
      "El paso ejecuta un algoritmo de nesting (acomodo de piezas) para determinar la cantidad real con desperdicio.",
    ejemplo: "Vinilo gran formato → calcula metros de rollo necesarios.",
  },
  CONVERSION: {
    label: "Conversión por unidad de empaque",
    descripcion:
      "Aplica una fórmula simple (ej: piezas / piezasPorCaja) para convertir piezas a otra unidad.",
    ejemplo: "1000 tarjetas / 100 tarjetas por caja = 10 cajas de embalaje.",
  },
};

/** Modo de selección de material en un slot (D.5). */
export const modoSeleccionMaterialLabels: DiccionarioLabels = {
  HARDCODED: {
    label: "Material fijo",
    descripcion:
      "El material está predefinido por el modelador. El comercial no puede cambiarlo al cotizar.",
    ejemplo: "Sustrato 'Opalina 300gr' fijo para tarjetas premium.",
  },
  COMERCIAL_ELIGE: {
    label: "El comercial elige al cotizar",
    descripcion:
      "El modelador define una lista de candidatos. El comercial elige cuál usar en cada cotización.",
    ejemplo: "Film para laminado: brillo o mate, lo elige el cliente.",
  },
  MOTOR_ELIGE_AUTO: {
    label: "El sistema elige automáticamente",
    descripcion:
      "El motor elige el mejor material de una lista de candidatos según un criterio (menor costo, mayor aprovechamiento, capacidad mínima que cumpla).",
    ejemplo: "Vinilo: el sistema elige el rollo que aproveche mejor.",
  },
};

/** Criterio del motor para elegir material cuando es MOTOR_ELIGE_AUTO. */
export const criterioMotorAutoLabels: DiccionarioLabels = {
  MENOR_COSTO: {
    label: "Más barato",
    descripcion: "Elige la variante con menor precio de referencia.",
  },
  MAYOR_APROVECHAMIENTO: {
    label: "Mejor aprovechamiento",
    descripcion:
      "Corre el nesting con cada candidato y elige el que da mayor porcentaje de aprovechamiento del sustrato.",
    ejemplo: "Entre rollo 1.37m y 1.52m, elige el que deja menos desperdicio.",
  },
  MENOR_CAPACIDAD_QUE_CUMPLA: {
    label: "El más chico que cumpla",
    descripcion:
      "Elige la variante MÁS PEQUEÑA cuya capacidad cumpla con el requerimiento del trabajo.",
    ejemplo: "Anillo: para libro de 80 hojas, elige espiral 15mm (cap 100), no el 20mm.",
  },
};

/** Fórmula de consumo de material (cómo se calcula la cantidad consumida). */
export const formulaConsumoLabels: DiccionarioLabels = {
  por_unidad_productiva: {
    label: "Por unidad producida",
    descripcion:
      "El material se consume según la cantidad efectiva del paso (ej: 1 pliego de papel por cada pliego impreso).",
  },
  por_pieza: {
    label: "Por pieza pedida",
    descripcion:
      "Una unidad del material por cada pieza del jobContext (ej: 1 bolsa por cada paquete embalado).",
  },
  por_m2: {
    label: "Por metro cuadrado",
    descripcion:
      "Cobra los m² consumidos del sustrato. Si hay nesting de rollo, incluye el desperdicio horizontal.",
  },
  por_metro_lineal: {
    label: "Por metro lineal",
    descripcion:
      "Cobra los metros lineales consumidos del rollo (largo del nesting / 1000).",
  },
  fijo: {
    label: "Cantidad fija (1 unidad)",
    descripcion: "Una sola unidad de material por cotización (ej: una matriz custom).",
  },
};

// ════════════════════════════════════════════════════════════════════
// CARGOS DIRECTOS
// ════════════════════════════════════════════════════════════════════

/** Modo de cálculo de un cargo directo (D.6). */
export const modoCalculoCargoLabels: DiccionarioLabels = {
  MONTO_FIJO_PLANO: {
    label: "Monto fijo",
    descripcion:
      "Cobra un monto fijo declarado en el cargo. Puede tener variantes por zona (ej: viático según destino).",
    ejemplo: "Tercerización = $500 fijos. Viático CABA = $3000, FUERA_AMBA = $12000.",
  },
  PORCENTAJE_SOBRE_BASE: {
    label: "Porcentaje sobre subtotal",
    descripcion:
      "Cobra un porcentaje sobre el subtotal (de la cotización o del paso, según donde esté asociado).",
    ejemplo: "Recargo por urgencia = 30% sobre el subtotal.",
  },
  POR_UNIDAD_INPUT: {
    label: "Por unidad de input",
    descripcion:
      "Cobra precio_por_unidad × valor_del_input declarado (ej: $80/km × distanciaKm).",
    ejemplo: "Combustible = $80 × cantidad de km del envío.",
  },
};

/** Convención: scope donde aplica un cargo. */
export const scopeCargoLabels: DiccionarioLabels = {
  PASO: {
    label: "A nivel de paso",
    descripcion:
      "El cargo se suma al costo del paso específico (ej: tercerización solo del corte). PORCENTAJE usa el subtotal del paso como base.",
  },
  COTIZACION: {
    label: "A nivel cotización",
    descripcion:
      "El cargo se suma al final de toda la cotización (ej: viático del trabajo entero). PORCENTAJE usa el subtotal global.",
  },
};

// ════════════════════════════════════════════════════════════════════
// PRODUCTO — Tab Precio
// ════════════════════════════════════════════════════════════════════

/** Métodos de cálculo de precio del Tab Precio. */
export const metodoPrecioLabels: DiccionarioLabels = {
  por_margen: {
    label: "Margen objetivo fijo",
    descripcion: "Calcula el precio necesario para preservar un margen sobre el precio final.",
    ejemplo: "Costo $100 + margen objetivo 50% = precio $200.",
  },
  precio_fijo: {
    label: "Precio fijo (sin importar costo)",
    descripcion: "Precio fijo por unidad declarado por el modelador, ignora el costo.",
    ejemplo: "Tarjeta personal = $50/u siempre, no importa qué papel use.",
  },
  precio_fijo_para_margen_minimo: {
    label: "Precio fijo si margen ≥ mínimo",
    descripcion:
      "Usa precio fijo solo si garantiza el margen mínimo configurado; sino aplica el margen mínimo.",
    ejemplo: "Precio $50, margen mín 30%; si no alcanza, se recalcula al precio necesario.",
  },
  margen_variable: {
    label: "Margen variable por cantidad (escalonado)",
    descripcion:
      "Margen objetivo distinto según el rango de cantidad comercial del pedido.",
    ejemplo: "Hasta 5 m² → 50%, hasta 20 m² → 40%, 20+ m² → 30%.",
  },
  fijado_por_cantidad: {
    label: "Precio fijo por cantidad (escalonado)",
    descripcion: "Precio fijo distinto según el rango de cantidad pedida.",
    ejemplo: "1-50u → $60/u, 51-200u → $50/u, 201+u → $40/u.",
  },
  fijo_con_margen_variable: {
    label: "Cantidades fijas con margen objetivo",
    descripcion:
      "Define cantidades exactas habilitadas y un margen objetivo para cada una.",
  },
  variable_por_cantidad: {
    label: "Variable por cantidad",
    descripcion:
      "Combinación de descuentos y márgenes variables según rangos de cantidad.",
  },
};

// ════════════════════════════════════════════════════════════════════
// PRODUCTO — Comercial y medidas
// ════════════════════════════════════════════════════════════════════

export const unidadComercialLabels: DiccionarioLabels = {
  unidad: {
    label: "Por unidad",
    descripcion: "Se cotiza por cantidad (ej: 1000 tarjetas, 50 cuadernos).",
  },
  m2: {
    label: "Por metro cuadrado",
    descripcion:
      "Se cotiza por superficie (ej: vinilo gran formato, lonas, calcomanías).",
  },
  metro_lineal: {
    label: "Por metro lineal",
    descripcion: "Se cotiza por largo (ej: vinilo de corte continuo).",
  },
};

export const modoMedidasLabels: DiccionarioLabels = {
  FIJA: {
    label: "Medida fija del producto",
    descripcion:
      "El modelador declara la medida única del producto. El comercial no la cambia al cotizar.",
    ejemplo: "Tarjeta de visita = 90×50mm siempre.",
  },
  LIBRE: {
    label: "El comercial ingresa medidas",
    descripcion:
      "El comercial declara las medidas (puede ser una lista de piezas) en cada cotización.",
    ejemplo: "Vinilo gran formato — cada trabajo tiene sus propias dimensiones.",
  },
  COMERCIAL_ELIGE: {
    label: "El comercial elige de una lista",
    descripcion:
      "El modelador declara opciones de medida y el comercial elige una al cotizar.",
    ejemplo: "Banner: A4 / A3 / SRA3.",
  },
};

// ════════════════════════════════════════════════════════════════════
// MAQUINARIA — discriminantes alineados a doc §5–§13
// ════════════════════════════════════════════════════════════════════

/** Tecnología de impresión gran formato (paramsTecnicos.tecnologia). */
export const tecnologiaImpresionLabels: DiccionarioLabels = {
  LATEX: {
    label: "Látex",
    descripcion: "Tinta látex base agua. Apta para vinilo, lonas, papel blueback.",
  },
  SOLVENTE: {
    label: "Solvente",
    descripcion:
      "Tinta solvente, alta durabilidad exterior. Vinilo, lonas, banners de calle.",
  },
  UV: {
    label: "UV",
    descripcion:
      "Tinta UV de curado instantáneo. Permite impresión sobre rígidos (acrílico, PVC) y tinta blanca/barniz.",
  },
  SUBLIMACION: {
    label: "Sublimación",
    descripcion:
      "Tinta sublimática para transferir a textil o sustratos polímero (telas, mugs).",
  },
  DTF_UV: {
    label: "DTF UV (rígidos)",
    descripcion:
      "Imprime film A+B para transferir luego a rígidos por calor + presión.",
  },
  DTF_TEXTIL: {
    label: "DTF Textil",
    descripcion:
      "Imprime film DTF para transferir a textiles (remeras, gorras) con plancha térmica.",
  },
};

/** Geometría del sustrato (paramsTecnicos.geometria). */
export const geometriaImpresionLabels: DiccionarioLabels = {
  ROLLO: {
    label: "Rollo",
    descripcion: "Imprime sobre material continuo en bobina (vinilos, lonas, films).",
  },
  MESA_EXTENSORA: {
    label: "Mesa extensora",
    descripcion:
      "Imprime sobre piezas planas apoyadas en una mesa (rígidos, PVC, acrílico).",
  },
};

/** Caras del perfil de impresión (perfil.detalle.caras según doc §5). */
export const carasLabels: DiccionarioLabels = {
  SIMPLE_FAZ: {
    label: "Simple faz",
    descripcion: "Imprime una sola cara del pliego.",
  },
  DOBLE_FAZ: {
    label: "Doble faz",
    descripcion:
      "Imprime ambas caras del pliego (puede ser en 1 pasada o 2 según la máquina).",
  },
};

/** Modo de calidad del perfil de impresión gran formato. */
export const modoCalidadLabels: DiccionarioLabels = {
  DRAFT: {
    label: "Borrador (rápido)",
    descripcion: "Calidad baja, alta velocidad. Para pruebas o trabajos express.",
  },
  NORMAL: {
    label: "Normal",
    descripcion: "Calidad estándar, balance velocidad/calidad. Default para la mayoría de trabajos.",
  },
  ALTA: {
    label: "Alta calidad",
    descripcion: "Calidad fotográfica, máxima resolución. Lento y mayor consumo de tinta.",
  },
};

/** Tipo de corte para plotters de corte. */
export const tipoCorteLabels: DiccionarioLabels = {
  COMPLETO: {
    label: "Corte completo (atraviesa todo)",
    descripcion: "La cuchilla atraviesa el vinilo + el liner. Las piezas quedan separadas.",
  },
  KISS_CUT: {
    label: "Kiss cut (solo vinilo)",
    descripcion:
      "La cuchilla corta solo el vinilo, no el liner. Piezas se transfieren con cinta.",
  },
};

/** Modo de operación del plotter (rollo vs hojas). */
export const modoOperacionPlotterLabels: DiccionarioLabels = {
  ROLLO: { label: "Rollo continuo", descripcion: "Carga material desde rollo." },
  HOJAS: { label: "Hojas individuales", descripcion: "Carga material en hojas pre-cortadas." },
};

/** Modos de laminado BOPP (paramsTecnicos.modosOperacionSoportados). */
export const modoLaminadoLabels: DiccionarioLabels = {
  UNA_CARA: {
    label: "Una cara",
    descripcion: "Lamina solo una cara del pliego en una pasada.",
  },
  DOS_CARAS_1_PASADA: {
    label: "Dos caras (1 pasada)",
    descripcion: "Máquinas dobles que laminan ambas caras simultáneamente.",
  },
  DOS_CARAS_2_PASADAS: {
    label: "Dos caras (2 pasadas)",
    descripcion: "Máquinas simples que laminan cara A, dan vuelta el pliego, y laminan cara B.",
  },
};

/** Tipo de láser (CO2 / Fibra). */
export const tipoLaserLabels: DiccionarioLabels = {
  CO2: {
    label: "Láser CO2",
    descripcion:
      "Láser de gas. Apto para acrílico, madera, MDF, papel, cuero, tela. NO metales.",
  },
  FIBRA: {
    label: "Láser de fibra",
    descripcion:
      "Láser de fibra óptica. Apto para metales (acero, aluminio) y plásticos. NO orgánicos densos.",
  },
};

/** Operaciones del láser. */
export const operacionLaserLabels: DiccionarioLabels = {
  CORTE: { label: "Corte", descripcion: "Atraviesa el material para separarlo en piezas." },
  GRABADO: { label: "Grabado", descripcion: "Marca superficial sin atravesar." },
};

/** Operaciones del CNC. */
export const operacionCncLabels: DiccionarioLabels = {
  CORTE_PASANTE: {
    label: "Corte pasante",
    descripcion: "Atraviesa el material completamente para separar piezas.",
  },
  FRESADO: {
    label: "Fresado",
    descripcion: "Mecanizado superficial: ranurado, vaciado, formas 3D parciales.",
  },
  PERFORADO: { label: "Perforado", descripcion: "Hace orificios pasantes." },
};

/** Tipo de anillo de la anilladora. */
export const tipoAnilloLabels: DiccionarioLabels = {
  ESPIRAL_PLASTICO: {
    label: "Espiral plástico",
    descripcion: "Espiral cilíndrico de plástico (PVC). Más económico.",
  },
  WIRE_O: {
    label: "Wire-O metálico",
    descripcion: "Doble alambre metálico. Más premium, mayor durabilidad.",
  },
};

/** Tipo de trabajo del plotter CAD. */
export const tipoTrabajoCadLabels: DiccionarioLabels = {
  CAD: {
    label: "CAD (técnico)",
    descripcion: "Planos arquitectónicos, mapas. Bajo consumo de tinta, alta velocidad.",
  },
  FOTO: {
    label: "Foto",
    descripcion: "Fotografía o pósters. Alta densidad de tinta, baja velocidad.",
  },
};

/** Categorías de familias de pasos (`familias.ts`). */
export const categoriaFamiliaLabels: DiccionarioLabels = {
  pre_prensa: {
    label: "Pre-prensa",
    descripcion: "Preparación: armado de imposición, proof, cálculo de pliegos.",
  },
  produccion_impresion: {
    label: "Producción / impresión",
    descripcion: "Pasos de impresión propiamente dicha (por hoja, por área, por pieza).",
  },
  corte_y_formado: {
    label: "Corte y formado",
    descripcion: "Guillotina, plotter, láser, CNC, troquelado, plegado.",
  },
  terminaciones: {
    label: "Terminaciones",
    descripcion: "Laminado, barniz, hot-stamping, pintura.",
  },
  encuadernacion_armado: {
    label: "Encuadernación / armado",
    descripcion: "Engrapado, anillado, emblocado, armado de cajas.",
  },
  estructural_montaje: {
    label: "Estructural y montaje",
    descripcion: "Soldadura, ensamble, instalación eléctrica.",
  },
  operaciones_manuales: {
    label: "Operaciones manuales",
    descripcion: "Embalaje, conteo, atado, etiquetado, control calidad, modificaciones.",
  },
  logistica_instalacion: {
    label: "Logística e instalación",
    descripcion: "Envío, instalación en sitio, toma de medidas.",
  },
  servicios_profesionales: {
    label: "Servicios profesionales",
    descripcion: "Diseño gráfico u otros servicios cobrados como honorarios.",
  },
};

/** Familias de plantilla de máquina. */
export const familiaPlantillaLabels: DiccionarioLabels = {
  impresion_digital: {
    label: "Impresión digital",
    descripcion: "Impresoras láser para tarjetas, talonarios, papelería.",
  },
  impresion_gran_formato: {
    label: "Impresión gran formato",
    descripcion: "Impresoras de látex, UV, solvente, sublimación, DTF.",
  },
  corte_mecanizado: {
    label: "Corte y mecanizado",
    descripcion: "Plotters, láseres, CNC, mesas de corte.",
  },
  terminacion: {
    label: "Terminación y armado",
    descripcion: "Guillotina, laminadora, anilladora, soldadora, cabina pintura.",
  },
};

// ════════════════════════════════════════════════════════════════════
// VALIDACIONES (D.7)
// ════════════════════════════════════════════════════════════════════

export const tipoValidacionLabels: DiccionarioLabels = {
  REQUIRES_INPUT: {
    label: "Falta dato del comercial",
    descripcion:
      "Un campo obligatorio del JobContext está vacío (ej: cantidad, caras, tipoCopia).",
  },
  COMPARE: {
    label: "Comparación entre valores",
    descripcion:
      "Dos valores no cumplen una relación esperada (ej: gramaje del papel vs capacidad de la máquina).",
  },
  IN_RANGE: {
    label: "Fuera de rango permitido",
    descripcion: "Un valor numérico está fuera del rango mín/máx aceptado por el paso.",
  },
  ONE_OF: {
    label: "Valor no permitido",
    descripcion: "Un valor no está en la lista de opciones válidas.",
  },
  EXISTS_OUTPUT: {
    label: "Falta output de paso anterior",
    descripcion:
      "El paso necesita un dato que un paso previo debía publicar pero no lo hizo (ej: corte_guillotina necesita pliegos_calculados de pre_prensa).",
  },
};

// ════════════════════════════════════════════════════════════════════
// TIPOS DE PERFIL OPERATIVO
// ════════════════════════════════════════════════════════════════════

export const tipoPerfilOperativoLabels: DiccionarioLabels = {
  impresion: { label: "Impresión", descripcion: "Perfil de máquina impresora." },
  corte: { label: "Corte", descripcion: "Perfil para máquinas de corte (guillotina, plotter, láser)." },
  laminado: { label: "Laminado", descripcion: "Perfil de laminadora." },
  mecanizado: { label: "Mecanizado", descripcion: "Perfil de CNC o router." },
  grabado: { label: "Grabado", descripcion: "Perfil para grabado láser superficial." },
  fabricacion: { label: "Fabricación", descripcion: "Perfil de fabricación aditiva (3D, etc.)." },
  mixto: { label: "Mixto", descripcion: "Perfil que combina varios tipos de operación." },
};

// ════════════════════════════════════════════════════════════════════
// UNIDADES
// ════════════════════════════════════════════════════════════════════

export const unidadProduccionLabels: DiccionarioLabels = {
  hora: { label: "Hora", descripcion: "Productividad medida en trabajos por hora." },
  ppm: { label: "Pliegos/min (PPM)", descripcion: "Pliegos por minuto. Típico de impresoras láser." },
  m2_h: { label: "m²/hora", descripcion: "Metros cuadrados por hora. Típico de gran formato." },
  m_min: { label: "Metros/min", descripcion: "Metros lineales por minuto. Típico de laminadoras." },
  cortes_min: { label: "Cortes/min", descripcion: "Cortes por minuto. Típico de guillotina." },
  piezas_h: { label: "Piezas/hora", descripcion: "Piezas terminadas por hora." },
  hoja: { label: "Hojas", descripcion: "Hojas individuales." },
  pieza: { label: "Pieza", descripcion: "Pieza individual." },
  copia: { label: "Copia", descripcion: "Copias impresas (foto-equivalente)." },
  ciclo: { label: "Ciclo", descripcion: "Ciclo completo de la máquina." },
  golpes_min: { label: "Golpes/min", descripcion: "Golpes/troqueles por minuto." },
  pliegos_min: { label: "Pliegos/min", descripcion: "Pliegos por minuto." },
  metro_lineal: { label: "Metro lineal", descripcion: "Metros lineales." },
  m2: { label: "m²", descripcion: "Metros cuadrados." },
  a4_equiv: { label: "A4-eq", descripcion: "Cantidad equivalente a hojas A4." },
};

// ════════════════════════════════════════════════════════════════════
// ESTADOS
// ════════════════════════════════════════════════════════════════════

export const estadoMaquinaLabels: DiccionarioLabels = {
  activa: { label: "Activa", descripcion: "Máquina operativa, disponible para producción." },
  inactiva: { label: "Inactiva", descripcion: "Apagada o no usada hoy." },
  mantenimiento: { label: "En mantenimiento", descripcion: "Servicio técnico en curso." },
  baja: { label: "Dada de baja", descripcion: "Retirada del taller, no se usa más." },
};

export const estadoConfiguracionMaquinaLabels: DiccionarioLabels = {
  borrador: {
    label: "Borrador",
    descripcion: "Configuración mínima. Falta completar datos para producción.",
  },
  incompleta: {
    label: "Incompleta",
    descripcion: "Datos parciales. No se puede usar para cotizar todavía.",
  },
  lista: {
    label: "Lista",
    descripcion: "Configuración completa. La máquina puede usarse en cotizaciones.",
  },
};
