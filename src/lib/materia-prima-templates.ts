import type {
  FamiliaMateriaPrima,
  SubfamiliaMateriaPrima,
  UnidadMateriaPrima,
} from "@/lib/materias-primas";
import {
  assertAnchoAntesDeAlto,
  assertCanonicalTemplateKeys,
} from "@/lib/canonical-keys";
import type { UnitCode } from "@/lib/unidades";

export type CampoTecnicoTemplate = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean";
  unit?: UnitCode;
  options?: string[];
  required?: boolean;
  optional?: boolean;
};

export type MateriaPrimaTemplateDef = {
  id: string;
  nombre: string;
  descripcion: string;
  familia: FamiliaMateriaPrima;
  subfamilia: SubfamiliaMateriaPrima;
  tipoTecnico: string;
  unidadStock: UnidadMateriaPrima;
  unidadCompra: UnidadMateriaPrima;
  camposTecnicos: CampoTecnicoTemplate[];
  dimensionesVariante: string[];
  requiredAtributos: string[];
  atributosIniciales: Record<string, unknown>;
};

export const SUSTRATO_HOJA_FORMATOS_PRESET = [
  { id: "a6_105x148", nombre: "A6", ancho: 10.5, alto: 14.8 },
  { id: "a5_148x210", nombre: "A5", ancho: 14.8, alto: 21.0 },
  { id: "a4_210x297", nombre: "A4", ancho: 21.0, alto: 29.7 },
  { id: "a3_297x420", nombre: "A3", ancho: 29.7, alto: 42.0 },
  { id: "sra3_320x450", nombre: "SRA3", ancho: 32.0, alto: 45.0 },
  { id: "sra3_plus_330x480", nombre: "SRA3+", ancho: 33.0, alto: 48.0 },
  { id: "sra3_plus_plus_325x500", nombre: "SRA3++", ancho: 32.5, alto: 50.0 },
  { id: "22x34_220x340", nombre: "22x34", ancho: 22.0, alto: 34.0 },
  { id: "carta_216x279", nombre: "Carta", ancho: 21.6, alto: 27.9 },
  { id: "oficio_216x356", nombre: "Oficio", ancho: 21.6, alto: 35.6 },
] as const;

const duplicatedSustratoHojaNames = SUSTRATO_HOJA_FORMATOS_PRESET.reduce<Record<string, number>>(
  (acc, item) => {
    acc[item.nombre] = (acc[item.nombre] ?? 0) + 1;
    return acc;
  },
  {},
);

const duplicatedSustratoHojaNameList = Object.entries(duplicatedSustratoHojaNames)
  .filter(([, count]) => count > 1)
  .map(([name]) => name);

if (duplicatedSustratoHojaNameList.length > 0) {
  throw new Error(
    `SUSTRATO_HOJA_FORMATOS_PRESET tiene nombres duplicados: ${duplicatedSustratoHojaNameList.join(", ")}`,
  );
}

export const materiaPrimaTemplatesV1: MateriaPrimaTemplateDef[] = [
  {
    id: "sustrato_hoja_v1",
    nombre: "Sustrato hoja",
    descripcion: "Papel/cartulina en hoja o pliego para impresión",
    familia: "sustrato",
    subfamilia: "sustrato_hoja",
    tipoTecnico: "sustrato_hoja",
    unidadStock: "hoja",
    unidadCompra: "resma",
    camposTecnicos: [
      { key: "formatoComercial", label: "Nombre/Descripción", type: "text", required: true },
      { key: "ancho", label: "Ancho", type: "number", unit: "cm", required: true },
      { key: "alto", label: "Alto", type: "number", unit: "cm", required: true },
      { key: "gramaje", label: "Gramaje", type: "number", unit: "g_m2", required: true },
      { key: "material", label: "Material", type: "text", required: true },
      { key: "acabado", label: "Acabado", type: "text", options: ["Brillo", "Mate"], required: true },
    ],
    dimensionesVariante: ["formatoComercial", "ancho", "alto", "gramaje", "material", "acabado"],
    requiredAtributos: ["formatoComercial", "ancho", "alto", "gramaje", "material", "acabado"],
    atributosIniciales: {
      formatoComercial: "A4",
      ancho: 21,
      alto: 29.7,
      gramaje: 115,
      material: "ilustracion",
      acabado: "mate",
    },
  },
  {
    id: "sustrato_rollo_flexible_v1",
    nombre: "Sustrato rollo flexible",
    descripcion: "Vinilo/lona/film en rollo",
    familia: "sustrato",
    subfamilia: "sustrato_rollo_flexible",
    tipoTecnico: "sustrato_rollo_flexible",
    unidadStock: "rollo",
    unidadCompra: "rollo",
    camposTecnicos: [
      { key: "ancho", label: "Ancho de rollo", type: "number", unit: "m", required: true },
      { key: "largo", label: "Largo de rollo", type: "number", unit: "m", required: true },
      { key: "acabado", label: "Acabado", type: "text", options: ["Brillante", "Mate"], required: true },
    ],
    dimensionesVariante: ["ancho", "largo", "acabado"],
    requiredAtributos: ["ancho", "largo", "acabado"],
    atributosIniciales: {
      ancho: 1.27,
      largo: 50,
      acabado: "Brillante",
    },
  },
  {
    id: "sustrato_rigido_v1",
    nombre: "Sustrato rígido",
    descripcion: "PVC, acrílico, MDF, dibond y similares",
    familia: "sustrato",
    subfamilia: "sustrato_rigido",
    tipoTecnico: "sustrato_rigido",
    unidadStock: "unidad",
    unidadCompra: "unidad",
    camposTecnicos: [
      { key: "ancho", label: "Ancho", type: "number", unit: "m", required: true },
      { key: "alto", label: "Alto", type: "number", unit: "m", required: true },
      { key: "espesor", label: "Espesor", type: "number", unit: "mm", required: true },
      { key: "colorBase", label: "Color base", type: "text", required: true },
    ],
    dimensionesVariante: ["ancho", "alto", "espesor", "colorBase"],
    requiredAtributos: ["ancho", "alto", "espesor", "colorBase"],
    atributosIniciales: {
      ancho: 1.22,
      alto: 2.44,
      espesor: 3,
      colorBase: "blanco",
    },
  },
  {
    id: "tinta_impresion_v1",
    nombre: "Tinta impresión",
    descripcion: "Tintas para solvente, UV, latex, DTF, sublimación",
    familia: "tinta_colorante",
    subfamilia: "tinta_impresion",
    tipoTecnico: "tinta_impresion",
    unidadStock: "ml",
    unidadCompra: "litro",
    camposTecnicos: [
      { key: "tecnologiaCompatible", label: "Tecnología compatible", type: "text", required: true },
      { key: "color", label: "Color", type: "text", required: true },
    ],
    dimensionesVariante: ["color"],
    requiredAtributos: ["tecnologiaCompatible", "color"],
    atributosIniciales: {
      tecnologiaCompatible: "impresora_uv_rollo",
      color: "c",
      baseQuimica: "uv",
      rendimientoReferencia: 1,
    },
  },
  {
    id: "toner_v1",
    nombre: "Tóner",
    descripcion: "Consumibles de impresión láser",
    familia: "tinta_colorante",
    subfamilia: "toner",
    tipoTecnico: "toner",
    unidadStock: "unidad",
    unidadCompra: "unidad",
    camposTecnicos: [
      { key: "color", label: "Color", type: "text", required: true },
      { key: "rendimientoPaginasIso", label: "Rendimiento", type: "number", required: true },
    ],
    dimensionesVariante: ["color"],
    requiredAtributos: ["color", "rendimientoPaginasIso"],
    atributosIniciales: {
      color: "negro",
      rendimientoPaginasIso: 5000,
      oemOAlternativo: "oem",
      equipoCompatible: "generico",
    },
  },
  {
    id: "film_transferencia_v1",
    nombre: "Film transferencia",
    descripcion: "Film DTF PET o A/B UV",
    familia: "transferencia_laminacion",
    subfamilia: "film_transferencia",
    tipoTecnico: "film_transferencia",
    unidadStock: "rollo",
    unidadCompra: "rollo",
    camposTecnicos: [
      { key: "ancho", label: "Ancho", type: "number", unit: "mm", required: true },
      { key: "largo", label: "Largo", type: "number", unit: "m", required: true },
      { key: "tecnologiaCompatible", label: "Tecnología compatible", type: "text", required: true },
    ],
    dimensionesVariante: ["ancho", "largo"],
    requiredAtributos: ["ancho", "largo", "tecnologiaCompatible"],
    atributosIniciales: {
      ancho: 600,
      largo: 100,
      tipoRelease: "cold_peel",
      espesorMicrones: 75,
      tecnologiaCompatible: "impresora_dtf",
    },
  },
  {
    id: "papel_transferencia_v1",
    nombre: "Papel transferencia",
    descripcion: "Papel de sublimación o transferencia",
    familia: "transferencia_laminacion",
    subfamilia: "papel_transferencia",
    tipoTecnico: "papel_transferencia",
    unidadStock: "rollo",
    unidadCompra: "rollo",
    camposTecnicos: [
      { key: "ancho", label: "Ancho", type: "number", unit: "mm", required: true },
      { key: "largo", label: "Largo", type: "number", unit: "m", optional: true },
      { key: "gramaje", label: "Gramaje", type: "number", unit: "g_m2", required: true },
    ],
    dimensionesVariante: ["ancho", "gramaje"],
    requiredAtributos: ["ancho", "gramaje"],
    atributosIniciales: {
      ancho: 610,
      largo: 120,
      gramaje: 90,
      ladoImprimible: "una_cara",
    },
  },
  {
    id: "laminado_film_v1",
    nombre: "Laminado film",
    descripcion: "Laminado brillo/mate para protección",
    familia: "transferencia_laminacion",
    subfamilia: "laminado_film",
    tipoTecnico: "laminado_film",
    unidadStock: "rollo",
    unidadCompra: "rollo",
    camposTecnicos: [
      { key: "ancho", label: "Ancho", type: "number", unit: "mm", required: true },
      { key: "largo", label: "Largo", type: "number", unit: "m", required: true },
      { key: "acabado", label: "Acabado", type: "text", required: true },
      { key: "espesor", label: "Espesor", type: "number", unit: "mm", optional: true },
      { key: "adhesivoTipo", label: "Tipo de adhesivo", type: "text", optional: true },
    ],
    dimensionesVariante: ["ancho", "largo", "acabado"],
    requiredAtributos: ["ancho", "largo", "acabado"],
    atributosIniciales: {
      ancho: 1270,
      largo: 50,
      espesor: 75,
      acabado: "mate",
      adhesivoTipo: "acrilico",
    },
  },
  {
    id: "quimico_acabado_v1",
    nombre: "Químico acabado",
    descripcion: "Barniz, primer, promotor de adherencia",
    familia: "quimico_auxiliar",
    subfamilia: "quimico_acabado",
    tipoTecnico: "quimico_acabado",
    unidadStock: "ml",
    unidadCompra: "litro",
    camposTecnicos: [
      { key: "volumenPresentacion", label: "Volumen de presentación", type: "number", unit: "ml", required: true },
      { key: "tecnologiaCompatible", label: "Tecnología compatible", type: "text", required: true },
    ],
    dimensionesVariante: ["volumenPresentacion"],
    requiredAtributos: ["volumenPresentacion", "tecnologiaCompatible"],
    atributosIniciales: {
      volumenPresentacion: 1000,
      tecnologiaCompatible: "impresora_uv_flatbed",
      superficiesCompatibles: "acrilico,pvc,vidrio",
    },
  },
  {
    id: "polvo_dtf_v1",
    nombre: "Polvo DTF",
    descripcion: "Polvo adhesivo para proceso DTF",
    familia: "quimico_auxiliar",
    subfamilia: "polvo_dtf",
    tipoTecnico: "polvo_dtf",
    unidadStock: "kg",
    unidadCompra: "kg",
    camposTecnicos: [
      { key: "tipoPolvo", label: "Tipo de polvo", type: "text", required: true },
      { key: "rangoTemperaturaAplicacion", label: "Rango de temperatura", type: "text", required: true },
    ],
    dimensionesVariante: ["tipoPolvo"],
    requiredAtributos: ["tipoPolvo", "rangoTemperaturaAplicacion"],
    atributosIniciales: {
      tipoPolvo: "hot_melt",
      granulometria: "80-200um",
      rangoTemperaturaAplicacion: "130-160C",
    },
  },
  {
    id: "modulo_led_carteleria_v1",
    nombre: "Modulo LED carteleria",
    descripcion: "Modulos LED para carteles, corporeas y cajas de luz",
    familia: "electronica_carteleria",
    subfamilia: "modulo_led_carteleria",
    tipoTecnico: "modulo_led_carteleria",
    unidadStock: "unidad",
    unidadCompra: "caja",
    camposTecnicos: [
      { key: "colorLuz", label: "Color de luz", type: "text", options: ["Blanco frio", "Blanco neutro", "Blanco calido", "Rojo", "Verde", "Azul"], required: true },
      { key: "tension", label: "Tension", type: "number", unit: "v", required: true },
      { key: "potencia", label: "Potencia", type: "number", unit: "w", required: true },
      { key: "corrienteNominal", label: "Corriente nominal", type: "number", unit: "a", optional: true },
      { key: "ip", label: "Grado IP", type: "text", options: ["IP20", "IP65", "IP67", "IP68"], required: true },
      { key: "flujoLuminoso", label: "Flujo luminoso", type: "number", unit: "lm", optional: true },
      { key: "modulosPorCadenaMax", label: "Modulos maximo por cadena", type: "number", optional: true },
    ],
    dimensionesVariante: ["colorLuz", "tension", "potencia", "ip"],
    requiredAtributos: ["colorLuz", "tension", "potencia", "ip"],
    atributosIniciales: {
      colorLuz: "Blanco frio",
      tension: 12,
      potencia: 0.72,
      corrienteNominal: 0.06,
      ip: "IP67",
      flujoLuminoso: 75,
      modulosPorCadenaMax: 50,
    },
  },
  {
    id: "fuente_alimentacion_led_v1",
    nombre: "Fuente alimentacion LED",
    descripcion: "Fuentes switching para modulos, tiras y neon LED",
    familia: "electronica_carteleria",
    subfamilia: "fuente_alimentacion_led",
    tipoTecnico: "fuente_alimentacion_led",
    unidadStock: "unidad",
    unidadCompra: "unidad",
    camposTecnicos: [
      { key: "tensionSalida", label: "Tension de salida", type: "number", unit: "v", required: true },
      { key: "corrienteSalidaMax", label: "Corriente maxima de salida", type: "number", unit: "a", required: true },
      { key: "potencia", label: "Potencia", type: "number", unit: "w", required: true },
      { key: "ip", label: "Grado IP", type: "text", options: ["IP20", "IP65", "IP67"], required: true },
      { key: "tipoRegulacion", label: "Tipo de regulacion", type: "text", options: ["CV", "CC"], required: true },
      { key: "dimerizable", label: "Dimerizable", type: "boolean", optional: true },
    ],
    dimensionesVariante: ["tensionSalida", "corrienteSalidaMax", "potencia", "ip"],
    requiredAtributos: ["tensionSalida", "corrienteSalidaMax", "potencia", "ip", "tipoRegulacion"],
    atributosIniciales: {
      tensionSalida: 12,
      corrienteSalidaMax: 16.6,
      potencia: 200,
      ip: "IP67",
      tipoRegulacion: "CV",
      dimerizable: false,
    },
  },
  {
    id: "cableado_conectica_v1",
    nombre: "Cableado y conectica",
    descripcion: "Cables, conectores y derivadores para alimentacion/control LED",
    familia: "electronica_carteleria",
    subfamilia: "cableado_conectica",
    tipoTecnico: "cableado_conectica",
    unidadStock: "metro_lineal",
    unidadCompra: "rollo",
    camposTecnicos: [
      { key: "tipoCable", label: "Tipo de cable", type: "text", options: ["Unipolar", "Bipolar", "Multipolar", "Siliconado"], required: true },
      { key: "seccion", label: "Seccion", type: "number", unit: "mm2", required: true },
      { key: "conductores", label: "Cantidad de conductores", type: "number", required: true },
      { key: "tensionAislacion", label: "Tension de aislacion", type: "number", unit: "v", required: true },
      { key: "corrienteMax", label: "Corriente maxima", type: "number", unit: "a", optional: true },
      { key: "materialConductor", label: "Material conductor", type: "text", options: ["Cobre", "Cobre estañado", "Aluminio cobreado"], optional: true },
    ],
    dimensionesVariante: ["tipoCable", "seccion", "conductores", "tensionAislacion"],
    requiredAtributos: ["tipoCable", "seccion", "conductores", "tensionAislacion"],
    atributosIniciales: {
      tipoCable: "Bipolar",
      seccion: 1.5,
      conductores: 2,
      tensionAislacion: 300,
      corrienteMax: 10,
      materialConductor: "Cobre",
    },
  },
  {
    id: "controlador_led_v1",
    nombre: "Controlador LED",
    descripcion: "Controladores para mono, CCT, RGB y RGBW",
    familia: "electronica_carteleria",
    subfamilia: "controlador_led",
    tipoTecnico: "controlador_led",
    unidadStock: "unidad",
    unidadCompra: "unidad",
    camposTecnicos: [
      { key: "tipoControlador", label: "Tipo de controlador", type: "text", options: ["Mono", "CCT", "RGB", "RGBW"], required: true },
      { key: "tensionEntrada", label: "Tension de entrada", type: "number", unit: "v", required: true },
      { key: "canales", label: "Canales", type: "number", required: true },
      { key: "corrienteMaxCanal", label: "Corriente maxima por canal", type: "number", unit: "a", required: true },
      { key: "corrienteTotalMax", label: "Corriente total maxima", type: "number", unit: "a", optional: true },
      { key: "protocolo", label: "Protocolo", type: "text", options: ["RF", "Wifi", "DMX", "0-10V", "Bluetooth"], optional: true },
    ],
    dimensionesVariante: ["tipoControlador", "tensionEntrada", "canales", "corrienteMaxCanal"],
    requiredAtributos: ["tipoControlador", "tensionEntrada", "canales", "corrienteMaxCanal"],
    atributosIniciales: {
      tipoControlador: "RGBW",
      tensionEntrada: 24,
      canales: 4,
      corrienteMaxCanal: 5,
      corrienteTotalMax: 20,
      protocolo: "RF",
    },
  },
  {
    id: "neon_flex_led_v1",
    nombre: "Neon flex LED",
    descripcion: "Neon flexible LED para carteleria lineal e iluminacion decorativa",
    familia: "neon_luminaria",
    subfamilia: "neon_flex_led",
    tipoTecnico: "neon_flex_led",
    unidadStock: "metro_lineal",
    unidadCompra: "rollo",
    camposTecnicos: [
      { key: "ancho", label: "Ancho", type: "number", unit: "mm", required: true },
      { key: "alto", label: "Alto", type: "number", unit: "mm", required: true },
      { key: "tension", label: "Tension", type: "number", unit: "v", required: true },
      { key: "potenciaLineal", label: "Potencia lineal", type: "number", unit: "w_m", required: true },
      { key: "corrienteNominal", label: "Corriente nominal", type: "number", unit: "a", optional: true },
      { key: "colorLuz", label: "Color de luz", type: "text", options: ["3000K", "4000K", "6500K", "Rojo", "Verde", "Azul", "RGB"], required: true },
      { key: "ip", label: "Grado IP", type: "text", options: ["IP20", "IP65", "IP67", "IP68"], required: true },
    ],
    dimensionesVariante: ["ancho", "alto", "tension", "potenciaLineal", "colorLuz", "ip"],
    requiredAtributos: ["ancho", "alto", "tension", "potenciaLineal", "colorLuz", "ip"],
    atributosIniciales: {
      ancho: 6,
      alto: 12,
      tension: 24,
      potenciaLineal: 10,
      corrienteNominal: 0.42,
      colorLuz: "4000K",
      ip: "IP67",
    },
  },
  {
    id: "accesorio_neon_led_v1",
    nombre: "Accesorio neon LED",
    descripcion: "Clips, tapas, conectores y accesorios de montaje para neon flex",
    familia: "neon_luminaria",
    subfamilia: "accesorio_neon_led",
    tipoTecnico: "accesorio_neon_led",
    unidadStock: "unidad",
    unidadCompra: "pack",
    camposTecnicos: [
      { key: "tipoAccesorio", label: "Tipo de accesorio", type: "text", options: ["Clip", "Tapa final", "Conector recto", "Conector L", "Conector T", "Grapa"], required: true },
      { key: "anchoCompatible", label: "Ancho compatible", type: "number", unit: "mm", optional: true },
      { key: "material", label: "Material", type: "text", options: ["Plastico", "Metal", "Silicona"], optional: true },
    ],
    dimensionesVariante: ["tipoAccesorio", "anchoCompatible"],
    requiredAtributos: ["tipoAccesorio"],
    atributosIniciales: {
      tipoAccesorio: "Clip",
      anchoCompatible: 8,
      material: "Plastico",
    },
  },
  {
    id: "anillado_encuadernacion_v1",
    nombre: "Anillado encuadernación",
    descripcion: "Espirales y anillos para terminación editorial",
    familia: "terminacion_editorial",
    subfamilia: "anillado_encuadernacion",
    tipoTecnico: "anillado_encuadernacion",
    unidadStock: "unidad",
    unidadCompra: "caja",
    camposTecnicos: [
      { key: "diametro", label: "Diámetro", type: "number", unit: "mm", required: true },
      { key: "material", label: "Material", type: "text", required: true },
    ],
    dimensionesVariante: ["diametro", "material"],
    requiredAtributos: ["diametro", "material"],
    atributosIniciales: {
      diametro: 10,
      material: "plastico",
      color: "negro",
      pasoPerforacion: "3:1",
    },
  },
  {
    id: "tapa_encuadernacion_v1",
    nombre: "Tapa encuadernación",
    descripcion: "Tapas para cuadernos y documentos",
    familia: "terminacion_editorial",
    subfamilia: "tapa_encuadernacion",
    tipoTecnico: "tapa_encuadernacion",
    unidadStock: "unidad",
    unidadCompra: "caja",
    camposTecnicos: [
      { key: "ancho", label: "Ancho", type: "number", unit: "mm", required: true },
      { key: "alto", label: "Alto", type: "number", unit: "mm", required: true },
      { key: "material", label: "Material", type: "text", required: true },
    ],
    dimensionesVariante: ["ancho", "alto", "material"],
    requiredAtributos: ["ancho", "alto", "material"],
    atributosIniciales: {
      ancho: 210,
      alto: 297,
      material: "polipropileno",
      espesor: 0.5,
      colorBase: "transparente",
    },
  },
  {
    id: "argolla_llavero_accesorio_v1",
    nombre: "Argolla llavero",
    descripcion: "Herrajes para llaveros promocionales",
    familia: "herraje_accesorio",
    subfamilia: "argolla_llavero_accesorio",
    tipoTecnico: "argolla_llavero",
    unidadStock: "unidad",
    unidadCompra: "pack",
    camposTecnicos: [
      { key: "diametro", label: "Diámetro", type: "number", unit: "mm", required: true },
      { key: "material", label: "Material", type: "text", required: true },
    ],
    dimensionesVariante: ["diametro", "material"],
    requiredAtributos: ["diametro", "material"],
    atributosIniciales: {
      diametro: 25,
      material: "acero",
      terminacion: "niquelado",
    },
  },
  {
    id: "ojal_ojalillo_remache_v1",
    nombre: "Ojal / ojalillo",
    descripcion: "Ojales para lona, banners y cartelería",
    familia: "herraje_accesorio",
    subfamilia: "ojal_ojalillo_remache",
    tipoTecnico: "ojal",
    unidadStock: "unidad",
    unidadCompra: "caja",
    camposTecnicos: [
      { key: "diametroInterno", label: "Diámetro interno", type: "number", unit: "mm", required: true },
      { key: "material", label: "Material", type: "text", required: true },
    ],
    dimensionesVariante: ["diametroInterno", "material"],
    requiredAtributos: ["diametroInterno", "material"],
    atributosIniciales: {
      diametroInterno: 10,
      material: "laton",
      terminado: "niquelado",
    },
  },
  {
    id: "portabanner_estructura_v1",
    nombre: "Portabanner estructura",
    descripcion: "Estructuras roll-up, X, L o pop-up",
    familia: "pop_exhibidor",
    subfamilia: "portabanner_estructura",
    tipoTecnico: "portabanner",
    unidadStock: "unidad",
    unidadCompra: "unidad",
    camposTecnicos: [
      { key: "tipoPortabanner", label: "Tipo de portabanner", type: "text", required: true },
      { key: "ancho", label: "Ancho", type: "number", unit: "cm", required: true },
      { key: "alto", label: "Alto", type: "number", unit: "cm", required: true },
    ],
    dimensionesVariante: ["tipoPortabanner", "ancho", "alto"],
    requiredAtributos: ["tipoPortabanner", "ancho", "alto"],
    atributosIniciales: {
      tipoPortabanner: "rollup",
      ancho: 85,
      alto: 200,
      materialEstructura: "aluminio",
    },
  },
];

export const materiaPrimaTemplatesMap = new Map(
  materiaPrimaTemplatesV1.map((template) => [template.id, template]),
);

for (const template of materiaPrimaTemplatesV1) {
  const fieldKeys = template.camposTecnicos.map((field) => field.key);
  assertCanonicalTemplateKeys(template.id, fieldKeys);
  assertAnchoAntesDeAlto(template.id, template.dimensionesVariante);
}

export function getMateriaPrimaTemplate(templateId: string) {
  return materiaPrimaTemplatesMap.get(templateId) ?? null;
}
