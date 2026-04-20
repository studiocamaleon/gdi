/**
 * Catálogo de campos expuestos por el Job Context del super motor.
 *
 * Cuando una ruta tiene un paso con activación CONDICIONAL, la expresión
 * JsonLogic guardada en `condicionV2` se evalúa contra el Job Context. Este
 * catálogo describe qué campos están disponibles para que el
 * `<CondicionBuilder>` arme dropdowns tipados en la UI.
 *
 * Debe mantenerse sincronizado con la forma del Job Context construido en
 * `apps/api/src/productos-servicios/motors/super-motor.ts`.
 */

export type CampoTipo = "number" | "text" | "enum";

export type CampoJobContext = {
  /** Path JsonLogic (clave para `{ var: path }`). */
  path: string;
  /** Label legible en la UI. */
  label: string;
  /** Agrupación visual. */
  grupo: "trabajo" | "variante" | "parametros" | "selecciones";
  /** Tipo del valor — define los operadores y el tipo de input. */
  tipo: CampoTipo;
  /** Opciones si tipo="enum". */
  opciones?: Array<{ value: string; label: string }>;
  /** Unidad o sufijo del valor, para mostrar en UI (ej. "mm", "piezas"). */
  sufijo?: string;
};

export const CAMPOS_JOB_CONTEXT: CampoJobContext[] = [
  // ── Trabajo (datos generales de la cotización) ──
  {
    path: "cantidad",
    label: "Cantidad pedida",
    grupo: "trabajo",
    tipo: "number",
    sufijo: "piezas",
  },

  // ── Variante (medidas base del producto) ──
  {
    path: "variante.anchoMm",
    label: "Variante: ancho",
    grupo: "variante",
    tipo: "number",
    sufijo: "mm",
  },
  {
    path: "variante.altoMm",
    label: "Variante: alto",
    grupo: "variante",
    tipo: "number",
    sufijo: "mm",
  },

  // ── Parámetros del cotizador (medidas libres, cliente tipea) ──
  {
    path: "parametros.anchoMm",
    label: "Parámetros: ancho solicitado",
    grupo: "parametros",
    tipo: "number",
    sufijo: "mm",
  },
  {
    path: "parametros.altoMm",
    label: "Parámetros: alto solicitado",
    grupo: "parametros",
    tipo: "number",
    sufijo: "mm",
  },

  // ── Selecciones (checklist del cotizador) ──
  {
    path: "selecciones.caras",
    label: "Caras",
    grupo: "selecciones",
    tipo: "enum",
    opciones: [
      { value: "simple_faz", label: "Simple faz" },
      { value: "doble_faz", label: "Doble faz" },
    ],
  },
  {
    path: "selecciones.acabado",
    label: "Acabado",
    grupo: "selecciones",
    tipo: "text",
  },
  {
    path: "selecciones.papel",
    label: "Papel",
    grupo: "selecciones",
    tipo: "text",
  },
];

export const GRUPOS_CAMPO: Record<CampoJobContext["grupo"], string> = {
  trabajo: "Trabajo",
  variante: "Variante",
  parametros: "Parámetros del cotizador",
  selecciones: "Selecciones del cliente",
};

export function buscarCampo(path: string): CampoJobContext | null {
  return CAMPOS_JOB_CONTEXT.find((c) => c.path === path) ?? null;
}

/** Operadores disponibles según el tipo del campo. */
export type OperadorCondicion = {
  /** Operador JsonLogic. */
  op: string;
  /** Label en UI. */
  label: string;
};

export const OPERADORES_POR_TIPO: Record<CampoTipo, OperadorCondicion[]> = {
  number: [
    { op: "==", label: "es igual a" },
    { op: "!=", label: "es distinto de" },
    { op: "<", label: "menor que" },
    { op: "<=", label: "menor o igual a" },
    { op: ">", label: "mayor que" },
    { op: ">=", label: "mayor o igual a" },
  ],
  text: [
    { op: "==", label: "es" },
    { op: "!=", label: "no es" },
  ],
  enum: [
    { op: "==", label: "es" },
    { op: "!=", label: "no es" },
  ],
};
