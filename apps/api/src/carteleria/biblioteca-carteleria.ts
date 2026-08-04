/**
 * Biblioteca instalable de cartelería — materiales del feature
 * (docs/carteleria-biblioteca-materiales.md).
 *
 * Cuando el plan incluye cartelería, la provisión instala estos materiales
 * SIN PRECIO (patrón portabanners): el tenant completa sus costos y ya puede
 * cotizar — el motor corta con diagnóstico si falta un precio.
 *
 * Idempotente a nivel VARIANTE (clave: sku): agregar una variante nueva acá y
 * re-provisionar la suma sin tocar precios ni variantes existentes del tenant.
 *
 * Atributos con CLAVES CANÓNICAS (la unidad vive en el template, no en la
 * clave): potencia (W) · cobertura (m²) · paso (mm) · capacidad (W) ·
 * espesor (mm) · desarrolloSeccion (m²/ml) · ancho/largo (m, rollos).
 * `cobertura`/`paso` los lee el motor para derivar el sembrado
 * (iluminacion-led.ts); `capacidad` alimenta el selector MENOR_CAPACIDAD de
 * la fuente. Valores relevados 2026-08-04 de proveedores del rubro (AR).
 */
import type { PrismaClient } from '@prisma/client';

type VarianteDef = {
  sku: string;
  nombre: string;
  attrs: Record<string, unknown>;
  /** Sólo para seeds de desarrollo; la provisión real instala sin precio. */
  precioReferencia?: number;
};

type MateriaDef = {
  codigo: string;
  nombre: string;
  familia: string;
  subfamilia: string;
  templateId: string;
  unidadStock: string;
  variantes: VarianteDef[];
};

export const BIBLIOTECA_CARTELERIA: MateriaDef[] = [
  /* ── Iluminación ─────────────────────────────────────────────── */
  {
    codigo: 'CART-LED-MOD',
    nombre: 'Módulo LED de cartelería',
    familia: 'ELECTRONICA_CARTELERIA',
    subfamilia: 'MODULO_LED_CARTELERIA',
    templateId: 'modulo_led_carteleria_v1',
    unidadStock: 'UNIDAD',
    variantes: [
      {
        sku: 'CART-LED-1-2835',
        nombre: 'Módulo 1 LED 2835 · 12V 0,6W · 160°',
        // Pastillas y cajas finas (≥ 2,5 cm de profundidad).
        attrs: { modelo: '1×2835', potencia: 0.6, tension: '12V', cobertura: 0.04, paso: 80, proteccion: 'IP65' },
      },
      {
        sku: 'CART-LED-2835',
        nombre: 'Módulo 3 LED 2835 · 12V 1,2W · 160°',
        // El estándar del rubro para corpóreas y cajones de 8–15 cm.
        attrs: { modelo: '3×2835', potencia: 1.2, tension: '12V', cobertura: 0.0625, paso: 100, proteccion: 'IP65' },
      },
      {
        sku: 'CART-LED-LENTE',
        nombre: 'Módulo 3 LED con lente 160° · 12V 1,2W (alto rendimiento)',
        attrs: { modelo: '3×lente 160°', potencia: 1.2, tension: '12V', cobertura: 0.09, paso: 120, proteccion: 'IP65' },
      },
      {
        sku: 'CART-LED-BL-3W',
        nombre: 'Módulo backlight lente 10°×65° · 12V 3W',
        // Cajones profundos (12–20 cm): proyecta al frente.
        attrs: { modelo: 'backlight 10°×65°', potencia: 3, tension: '12V', cobertura: 0.18, paso: 150, proteccion: 'IP65' },
      },
      {
        sku: 'CART-LED-COB-2W',
        nombre: 'Módulo COB · 12V 2W · 160°',
        attrs: { modelo: 'COB', potencia: 2, tension: '12V', cobertura: 0.1, paso: 110, proteccion: 'IP65' },
      },
    ],
  },
  {
    codigo: 'CART-LED-TUBO',
    nombre: 'Tubo LED T8 para cajas de luz',
    familia: 'ELECTRONICA_CARTELERIA',
    subfamilia: 'MODULO_LED_CARTELERIA',
    templateId: 'modulo_led_carteleria_v1',
    unidadStock: 'UNIDAD',
    variantes: [
      {
        sku: 'CART-TUBO-60',
        nombre: 'Tubo LED T8 · 60 cm · 9W · 6500K',
        attrs: { modelo: 'T8 60cm', potencia: 9, tension: '220V', cobertura: 0.15, paso: 300 },
      },
      {
        sku: 'CART-TUBO-120',
        nombre: 'Tubo LED T8 · 120 cm · 18W · 6500K',
        attrs: { modelo: 'T8 120cm', potencia: 18, tension: '220V', cobertura: 0.3, paso: 300 },
      },
    ],
  },
  {
    codigo: 'CART-NEON',
    nombre: 'Neón flex LED',
    familia: 'NEON_LUMINARIA',
    subfamilia: 'NEON_FLEX_LED',
    templateId: 'modulo_led_carteleria_v1',
    unidadStock: 'METRO_LINEAL',
    variantes: [
      {
        sku: 'CART-NEON-6X12-F',
        nombre: 'Neón flex 6×12 mm · 12V · blanco frío',
        attrs: { modelo: '6×12', potencia: 9.6, tension: '12V', paso: 1000 },
      },
      {
        sku: 'CART-NEON-6X12-C',
        nombre: 'Neón flex 6×12 mm · 12V · blanco cálido',
        attrs: { modelo: '6×12', potencia: 9.6, tension: '12V', paso: 1000 },
      },
      {
        sku: 'CART-NEON-6X12-COLOR',
        nombre: 'Neón flex 6×12 mm · 12V · color',
        attrs: { modelo: '6×12', potencia: 9.6, tension: '12V', paso: 1000 },
      },
    ],
  },
  {
    codigo: 'CART-FUENTE',
    nombre: 'Fuente switching 12V',
    familia: 'ELECTRONICA_CARTELERIA',
    subfamilia: 'FUENTE_ALIMENTACION_LED',
    templateId: 'fuente_alimentacion_led_v1',
    unidadStock: 'UNIDAD',
    variantes: [
      { sku: 'CART-FUE-60', nombre: '60W IP67', attrs: { capacidad: 60, tension: '12V', proteccion: 'IP67' } },
      { sku: 'CART-FUE-100', nombre: '100W IP67', attrs: { capacidad: 100, tension: '12V', proteccion: 'IP67' } },
      { sku: 'CART-FUE-150', nombre: '150W IP67', attrs: { capacidad: 150, tension: '12V', proteccion: 'IP67' } },
      { sku: 'CART-FUE-200', nombre: '200W IP67', attrs: { capacidad: 200, tension: '12V', proteccion: 'IP67' } },
      { sku: 'CART-FUE-350', nombre: '350W IP67', attrs: { capacidad: 350, tension: '12V', proteccion: 'IP67' } },
      { sku: 'CART-FUE-150-INT', nombre: '150W IP20 (interior)', attrs: { capacidad: 150, tension: '12V', proteccion: 'IP20' } },
    ],
  },
  {
    codigo: 'CART-CONTROL',
    nombre: 'Controlador / dimmer LED',
    familia: 'ELECTRONICA_CARTELERIA',
    subfamilia: 'CONTROLADOR_LED',
    templateId: 'fuente_alimentacion_led_v1',
    unidadStock: 'UNIDAD',
    variantes: [
      { sku: 'CART-DIM-8A', nombre: 'Dimmer 12V 8A', attrs: { capacidad: 96, tension: '12V' } },
      { sku: 'CART-RGB-CTL', nombre: 'Controladora RGB 12V con remoto', attrs: { capacidad: 72, tension: '12V' } },
    ],
  },
  {
    codigo: 'CART-CABLE',
    nombre: 'Cable de baja tensión',
    familia: 'ELECTRONICA_CARTELERIA',
    subfamilia: 'CABLEADO_CONECTICA',
    templateId: 'cableado_conectica_v1',
    unidadStock: 'METRO_LINEAL',
    variantes: [
      { sku: 'CART-CAB-2X1', nombre: 'Cable taller 2×1 mm²', attrs: { seccion: '2×1 mm²', tipo: 'Cable taller' } },
      { sku: 'CART-CAB-2X15', nombre: 'Cable taller 2×1,5 mm²', attrs: { seccion: '2×1,5 mm²', tipo: 'Cable taller' } },
    ],
  },
  {
    codigo: 'CART-CONECTOR',
    nombre: 'Conectores y prensacables',
    familia: 'ELECTRONICA_CARTELERIA',
    subfamilia: 'CABLEADO_CONECTICA',
    templateId: 'cableado_conectica_v1',
    unidadStock: 'UNIDAD',
    variantes: [
      { sku: 'CART-CON-FAST', nombre: 'Ficha fast 12V', attrs: { seccion: '—', tipo: 'Conector fast' } },
      { sku: 'CART-PRENSA-PG7', nombre: 'Prensacable PG7', attrs: { seccion: '—', tipo: 'Prensacable' } },
    ],
  },

  /* ── Estructura ──────────────────────────────────────────────── */
  {
    codigo: 'CART-PERFIL',
    nombre: 'Caño estructural',
    familia: 'METAL_ESTRUCTURA',
    subfamilia: 'PERFIL_ESTRUCTURAL',
    templateId: 'perfil_estructural_v1',
    unidadStock: 'METRO_LINEAL',
    variantes: [
      { sku: 'CART-PERFIL-2020', nombre: 'Caño 20×20×1,2 · barra 6 m', attrs: { seccion: '20×20 mm', espesor: 1.2, material: 'Acero', desarrolloSeccion: 0.08, largoBarra: 6 } },
      { sku: 'CART-PERFIL-3030', nombre: 'Caño 30×30×1,6 · barra 6 m', attrs: { seccion: '30×30 mm', espesor: 1.6, material: 'Acero', desarrolloSeccion: 0.12, largoBarra: 6 } },
      { sku: 'CART-PERFIL-4040', nombre: 'Caño 40×40×1,6 · barra 6 m', attrs: { seccion: '40×40 mm', espesor: 1.6, material: 'Acero', desarrolloSeccion: 0.16, largoBarra: 6 } },
      { sku: 'CART-PERFIL-AL40', nombre: 'Perfil aluminio 40×40 · barra 6 m', attrs: { seccion: '40×40 mm', espesor: 1.5, material: 'Aluminio', desarrolloSeccion: 0.16, largoBarra: 6 } },
    ],
  },
  {
    codigo: 'CART-CHAPA',
    nombre: 'Chapa para cenefa',
    familia: 'METAL_ESTRUCTURA',
    subfamilia: 'CHAPA_METALICA',
    templateId: 'chapa_metalica_v1',
    unidadStock: 'M2',
    variantes: [
      { sku: 'CART-CHAPA-GALV07', nombre: 'Galvanizada 0,7 mm', attrs: { tipo: 'Galvanizada', espesor: 0.7 } },
      { sku: 'CART-CHAPA-PINT07', nombre: 'Prepintada blanca 0,7 mm', attrs: { tipo: 'Prepintada', espesor: 0.7 } },
      { sku: 'CART-CHAPA-ALU10', nombre: 'Aluminio 1,0 mm', attrs: { tipo: 'Aluminio', espesor: 1.0 } },
    ],
  },
  {
    codigo: 'CART-PINTURA',
    nombre: 'Pintura de cartelería',
    familia: 'PINTURA_RECUBRIMIENTO',
    subfamilia: 'PINTURA_CARTELERIA',
    templateId: 'pintura_carteleria_v1',
    unidadStock: 'LITRO',
    variantes: [
      { sku: 'CART-PINT-NEG', nombre: 'Antióxido + esmalte negro semimate', attrs: {} },
      { sku: 'CART-PINT-BLA', nombre: 'Antióxido + esmalte blanco', attrs: {} },
    ],
  },
  {
    codigo: 'CART-ANCLAJE',
    nombre: 'Anclajes de cartelería',
    familia: 'HERRAJE_ACCESORIO',
    subfamilia: 'SISTEMA_COLGADO_MONTAJE',
    templateId: 'perfil_estructural_v1',
    unidadStock: 'UNIDAD',
    variantes: [
      { sku: 'CART-ANC-PARED', nombre: 'Soporte L 100×100 + brocas', attrs: { seccion: 'L 100×100', material: 'Acero' } },
      { sku: 'CART-ANC-COLUMNA', nombre: 'Abrazadera de columna doble', attrs: { seccion: 'abrazadera', material: 'Acero' } },
      { sku: 'CART-ANC-CADENA', nombre: 'Suspensión a cadena/tensor', attrs: { seccion: 'cadena', material: 'Acero' } },
    ],
  },

  /* ── Lonas (la impresión las consume con nesting de rollo) ───── */
  {
    codigo: 'CART-LONA-BACK',
    nombre: 'Lona backlight translúcida 510 g',
    familia: 'SUSTRATO',
    subfamilia: 'SUSTRATO_ROLLO_FLEXIBLE',
    templateId: 'sustrato_rollo_flexible_v1',
    unidadStock: 'ROLLO',
    variantes: [
      {
        sku: 'CART-LONA-BACK-320',
        nombre: 'Rollo 3,20 × 50 m',
        // anchoMm/largoMm: los lee el nesting shelf-rollo (compat con las
        // lonas existentes); ancho/largo en m son los del template.
        attrs: { ancho: 3.2, largo: 50, anchoMm: 3200, largoMm: 50000, largoRolloMm: 50000, acabado: 'Backlit translúcida' },
      },
    ],
  },
  {
    codigo: 'CART-LONA-FRONT',
    nombre: 'Lona frontlight 440 g',
    familia: 'SUSTRATO',
    subfamilia: 'SUSTRATO_ROLLO_FLEXIBLE',
    templateId: 'sustrato_rollo_flexible_v1',
    unidadStock: 'ROLLO',
    variantes: [
      {
        sku: 'CART-LONA-FRONT-320',
        nombre: 'Rollo 3,20 × 50 m',
        attrs: { ancho: 3.2, largo: 50, anchoMm: 3200, largoMm: 50000, largoRolloMm: 50000, acabado: 'Frontlit' },
      },
    ],
  },
];

export type ResultadoInstalacion = {
  materiasCreadas: number;
  variantesCreadas: number;
};

/**
 * Instala la biblioteca en el tenant (idempotente por codigo/sku, nunca toca
 * precios existentes). La llamará `provisionar-carteleria` cuando el plan
 * incluya el feature; también sirve para seeds de desarrollo.
 */
export async function instalarBibliotecaCarteleria(
  prisma: PrismaClient,
  tenantId: string,
): Promise<ResultadoInstalacion> {
  let materiasCreadas = 0;
  let variantesCreadas = 0;

  for (const def of BIBLIOTECA_CARTELERIA) {
    let materia = await prisma.materiaPrima.findFirst({
      where: { tenantId, codigo: def.codigo },
      select: { id: true },
    });
    if (!materia) {
      materia = await prisma.materiaPrima.create({
        data: {
          tenantId,
          codigo: def.codigo,
          nombre: def.nombre,
          familia: def.familia as never,
          subfamilia: def.subfamilia as never,
          tipoTecnico: def.templateId.replace(/_v\d+$/, ''),
          templateId: def.templateId,
          unidadStock: def.unidadStock as never,
          unidadCompra: def.unidadStock as never,
          atributosTecnicosJson: {},
        },
        select: { id: true },
      });
      materiasCreadas++;
    }

    for (const variante of def.variantes) {
      const existente = await prisma.materiaPrimaVariante.findFirst({
        where: { tenantId, sku: variante.sku },
        select: { id: true },
      });
      if (existente) continue;
      await prisma.materiaPrimaVariante.create({
        data: {
          tenantId,
          materiaPrimaId: materia.id,
          sku: variante.sku,
          nombreVariante: variante.nombre,
          precioReferencia: variante.precioReferencia ?? null,
          moneda: variante.precioReferencia != null ? 'ARS' : null,
          atributosVarianteJson: variante.attrs as never,
        },
      });
      variantesCreadas++;
    }
  }

  return { materiasCreadas, variantesCreadas };
}
