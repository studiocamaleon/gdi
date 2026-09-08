/**
 * Helpers puros + renderer genérico de campos del editor de máquinas.
 *
 * Extraído de maquinaria-panel.tsx en la Fase B de la migración de UI
 * (2026-07-28) para que el mismo editor sirva al sheet de hoy y a la
 * ficha por máquina de la Fase C. Sin cambios de comportamiento.
 */

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  Maquina,
  MaquinaConsumible,
  MaquinaPayload,
  MaquinariaTemplateField,
  MaquinariaTemplateOption,
  PlantillaMaquinaria,
  TipoConsumibleMaquina,
  TipoPerfilOperativoMaquina,
  UnidadConsumoMaquina,
  UnidadProduccionMaquina,
} from "@/lib/maquinaria";
import { getGeometriaTrabajoMaquinaLabel } from "@/lib/maquinaria";
import { getMaquinariaTemplate } from "@/lib/maquinaria-templates";

export type LocalPerfil = NonNullable<
  MaquinaPayload["perfilesOperativos"]
>[number] & {
  uiKey: string;
};

export type ConsumibleCanal =
  "cian" | "magenta" | "amarillo" | "negro" | "blanco" | "barniz";

export const PRINTER_TEMPLATES_WITH_CONSUMIBLES = new Set<PlantillaMaquinaria>([
  "impresora_laser",
  "duplicadora_digital",
  "impresora_gran_formato_por_area",
  "plotter_cad",
]);

export const CANAL_META: Record<
  ConsumibleCanal,
  { label: string; short: string; swatch: string }
> = {
  cian: { label: "Cian", short: "C", swatch: "#00a3d7" },
  magenta: { label: "Magenta", short: "M", swatch: "#d1007f" },
  amarillo: { label: "Amarillo", short: "Y", swatch: "#f3c900" },
  negro: { label: "Negro", short: "K", swatch: "#111827" },
  blanco: { label: "Blanco", short: "W", swatch: "#ffffff" },
  barniz: { label: "Barniz", short: "V", swatch: "#c7b58a" },
};

export function normalizeCanal(value: unknown): ConsumibleCanal | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, ConsumibleCanal> = {
    c: "cian",
    cyan: "cian",
    cian: "cian",
    m: "magenta",
    magenta: "magenta",
    y: "amarillo",
    yellow: "amarillo",
    amarillo: "amarillo",
    k: "negro",
    black: "negro",
    negro: "negro",
    w: "blanco",
    white: "blanco",
    blanco: "blanco",
    v: "barniz",
    varnish: "barniz",
    barniz: "barniz",
  };
  return aliases[normalized] ?? null;
}

export function requiredChannelsFromColorMode(
  rawMode: unknown,
): ConsumibleCanal[] {
  if (Array.isArray(rawMode)) {
    return Array.from(
      new Set(
        rawMode.flatMap((item) => {
          const fromMode = requiredChannelsFromColorMode(item);
          if (fromMode.length > 0) return fromMode;
          const channel = normalizeCanal(item);
          return channel ? [channel] : [];
        }),
      ),
    );
  }
  if (typeof rawMode !== "string") return [];
  const normalized = rawMode
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/W/g, "BLANCO");
  if (!normalized) return [];
  if (["BN", "B/N", "NEGRO", "K"].includes(normalized)) return ["negro"];
  const channels: ConsumibleCanal[] = [];
  if (normalized.includes("CMYK"))
    channels.push("cian", "magenta", "amarillo", "negro");
  if (normalized.includes("BLANCO")) channels.push("blanco");
  if (normalized.includes("BARNIZ") || normalized.includes("VARNISH"))
    channels.push("barniz");
  return Array.from(new Set(channels));
}

export function requiredChannelsForPerfil(
  perfil: LocalPerfil,
  parametrosTecnicos: Record<string, unknown> | undefined,
): ConsumibleCanal[] {
  const detalle = (perfil.detalle ?? {}) as Record<string, unknown>;
  const byPerfil = requiredChannelsFromColorMode(
    detalle.colores ?? detalle.modoColor,
  );
  if (byPerfil.length > 0) return byPerfil;
  const byMachine = requiredChannelsFromColorMode(
    parametrosTecnicos?.coloresSoportados ??
      parametrosTecnicos?.configuracionColor ??
      parametrosTecnicos?.configuracionCanales,
  );
  return byMachine.length > 0 ? byMachine : [];
}

export function requiredChannelsForLaserMachine(
  form: MaquinaPayload,
  perfiles: LocalPerfil[],
): ConsumibleCanal[] {
  const parametrosTecnicos = (form.parametrosTecnicos ?? {}) as Record<
    string,
    unknown
  >;
  const byMachine = requiredChannelsFromColorMode(
    parametrosTecnicos.coloresSoportados ??
      parametrosTecnicos.configuracionColor ??
      parametrosTecnicos.configuracionCanales,
  );
  if (byMachine.length > 0) return byMachine;
  return Array.from(
    new Set(
      perfiles.flatMap((perfil) =>
        requiredChannelsForPerfil(perfil, parametrosTecnicos),
      ),
    ),
  );
}

export function canalFromConsumible(
  consumible:
    Pick<MaquinaConsumible, "detalle"> | MaquinaPayload["consumibles"][number],
) {
  const detalle = (consumible.detalle ?? {}) as Record<string, unknown>;
  return normalizeCanal(detalle.color ?? detalle.canal);
}

export function consumibleTipoFor(
  plantilla: PlantillaMaquinaria,
  canal: ConsumibleCanal,
): TipoConsumibleMaquina {
  if (canal === "barniz") return "barniz";
  return plantilla === "impresora_laser" ? "toner" : "tinta";
}

export function consumibleUnidadFor(
  plantilla: PlantillaMaquinaria,
): UnidadConsumoMaquina {
  return plantilla === "impresora_laser" ? "gramo" : "ml";
}

export function cloneRecord(value: Record<string, unknown> | undefined | null) {
  return value
    ? (structuredClone(value) as Record<string, unknown>)
    : undefined;
}

export function defaultConsumoBase(
  plantilla: PlantillaMaquinaria,
  canal: ConsumibleCanal,
) {
  if (plantilla === "impresora_laser") return 1.73;
  if (plantilla === "duplicadora_digital") return 1.603;
  if (canal === "blanco") return 5;
  if (canal === "barniz") return 3;
  return 8;
}

export function emptyMaquina(plantaId: string): MaquinaPayload {
  return {
    nombre: "",
    plantilla: "impresora_laser",
    plantaId,
    estado: "activa",
    geometriaTrabajo: "pliego",
    unidadProduccionPrincipal: "ppm",
    activo: true,
    perfilesOperativos: [],
    consumibles: [],
    componentesDesgaste: [],
    parametrosTecnicos: {},
  };
}

/**
 * Claves de `detalle` que su plantilla dejó de declarar (2026-07-28). Siguen
 * guardadas en los perfiles viejos, y el API rechaza guardar un perfil con
 * una clave que su plantilla no reconoce: se limpian al cargar la máquina,
 * así el primer guardado las deja atrás.
 */
const PERFIL_DETALLE_RETIRADO: Partial<Record<PlantillaMaquinaria, string[]>> =
  {
    // gramajeMaxGr volvió al perfil láser como escalón: acá sólo queda el
    // mínimo, que ya no existe en ninguna plantilla.
    impresora_laser: ["gramajeMinGr"],
    guillotina: ["gramajeMinGr"],
  };

/**
 * Claves que se mudaron de la máquina al perfil: si el perfil todavía no
 * las trae, se siembran con el valor de la máquina para que el primer
 * guardado las deje escritas donde corresponde.
 */
const PERFIL_DETALLE_HEREDADO: Partial<Record<PlantillaMaquinaria, string[]>> =
  {
    guillotina: ["tiempoPorCorteSeg"],
  };

function prepararDetallePerfil(
  plantilla: PlantillaMaquinaria,
  detalle: Record<string, unknown> | null | undefined,
  parametrosTecnicos: Record<string, unknown> | null | undefined,
) {
  const retiradas = PERFIL_DETALLE_RETIRADO[plantilla] ?? [];
  const heredadas = PERFIL_DETALLE_HEREDADO[plantilla] ?? [];
  if (!detalle && heredadas.length === 0) return undefined;

  const preparado = { ...(detalle ?? {}) };
  for (const clave of retiradas) delete preparado[clave];
  for (const clave of heredadas) {
    if (
      preparado[clave] === undefined &&
      parametrosTecnicos?.[clave] !== undefined
    ) {
      preparado[clave] = parametrosTecnicos[clave];
    }
  }
  return preparado;
}

/**
 * El tóner de la láser pasó a declararse por perfil (2026-07-28). Las
 * máquinas cargadas antes lo tienen a nivel máquina —`perfilOperativoId`
 * nulo—, donde el editor nuevo no lo muestra: se reparte una copia a cada
 * perfil que todavía no tenga la suya, así el primer guardado lo deja
 * donde corresponde. El motor mientras tanto sigue leyendo el de la
 * máquina como respaldo.
 */
function repartirConsumiblesDeMaquinaEnPerfiles(
  maquina: Maquina,
  consumibles: MaquinaPayload["consumibles"],
): MaquinaPayload["consumibles"] {
  if (maquina.plantilla !== "impresora_laser") return consumibles;
  const perfiles = maquina.perfilesOperativos.filter((p) => p.activo);
  if (perfiles.length === 0) return consumibles;

  const deMaquina = consumibles.filter((item) => !item.perfilOperativoId);
  if (deMaquina.length === 0) return consumibles;

  const yaTiene = new Set(
    consumibles
      .filter((item) => item.perfilOperativoId)
      .map((item) => `${item.perfilOperativoId}::${canalFromConsumible(item)}`),
  );

  const copias = perfiles.flatMap((perfil) =>
    deMaquina
      .filter(
        (item) => !yaTiene.has(`${perfil.id}::${canalFromConsumible(item)}`),
      )
      .map((item) => ({
        ...item,
        // Sin id: es un consumible nuevo del perfil, no una edición del de
        // la máquina (que se descarta abajo).
        id: undefined,
        perfilOperativoId: perfil.id,
        perfilOperativoNombre: perfil.nombre,
        detalle: item.detalle ? { ...item.detalle } : undefined,
      })),
  );

  return [...consumibles.filter((item) => item.perfilOperativoId), ...copias];
}

export function maquinaToPayload(maquina: Maquina): MaquinaPayload {
  return {
    expectedUpdatedAt: maquina.updatedAt,
    nombre: maquina.nombre,
    plantilla: maquina.plantilla,
    plantillaVersion: maquina.plantillaVersion,
    fabricante: maquina.fabricante || undefined,
    modelo: maquina.modelo || undefined,
    numeroSerie: maquina.numeroSerie || undefined,
    plantaId: maquina.plantaId,
    centroCostoPrincipalId: maquina.centroCostoPrincipalId || undefined,
    estado: maquina.estado,
    estadoConfiguracion: maquina.estadoConfiguracion,
    geometriaTrabajo: maquina.geometriaTrabajo,
    unidadProduccionPrincipal: maquina.unidadProduccionPrincipal,
    anchoUtil: maquina.anchoUtil ?? undefined,
    largoUtil: maquina.largoUtil ?? undefined,
    altoUtil: maquina.altoUtil ?? undefined,
    espesorMaximo: maquina.espesorMaximo ?? undefined,
    pesoMaximo: maquina.pesoMaximo ?? undefined,
    gramajeMaxGr: maquina.gramajeMaxGr ?? undefined,
    activo: maquina.activo,
    observaciones: maquina.observaciones || undefined,
    parametrosTecnicos:
      (maquina.parametrosTecnicos as Record<string, unknown> | null) ?? {},
    perfilesOperativos: maquina.perfilesOperativos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      tipoPerfil: p.tipoPerfil,
      activo: p.activo,
      productivityValue: p.productivityValue ?? undefined,
      productivityUnit: p.productivityUnit || undefined,
      setupMin: p.setupMin ?? undefined,
      cleanupMin: p.cleanupMin ?? undefined,
      feedReloadMin: p.feedReloadMin ?? undefined,
      detalle: prepararDetallePerfil(
        maquina.plantilla,
        p.detalle,
        maquina.parametrosTecnicos,
      ),
      reglaSeleccionJson: p.reglaSeleccionJson ?? undefined,
    })),
    consumibles: repartirConsumiblesDeMaquinaEnPerfiles(
      maquina,
      maquina.consumibles.map((c) => ({
        id: c.id,
        materiaPrimaVarianteId: c.materiaPrimaVarianteId,
        nombre: c.nombre,
        tipo: c.tipo,
        unidad: c.unidad,
        rendimientoEstimado: c.rendimientoEstimado ?? undefined,
        consumoBase: c.consumoBase ?? undefined,
        consumoPorCobertura: c.consumoPorCobertura ?? undefined,
        perfilOperativoId: c.perfilOperativoId ?? undefined,
        perfilOperativoNombre: c.perfilOperativoNombre || undefined,
        activo: c.activo,
        detalle: c.detalle ?? undefined,
        observaciones: c.observaciones || undefined,
      })),
    ),
    componentesDesgaste: maquina.componentesDesgaste.map((d) => ({
      id: d.id,
      // La API devuelve "" cuando el repuesto no está en inventario; el
      // payload espera que no viaje el campo.
      materiaPrimaVarianteId: d.materiaPrimaVarianteId || undefined,
      precioUnitario: d.precioUnitario ?? undefined,
      soloColor: d.soloColor,
      nombre: d.nombre,
      tipo: d.tipo,
      vidaUtilEstimada: d.vidaUtilEstimada ?? undefined,
      unidadDesgaste: d.unidadDesgaste,
      activo: d.activo,
      detalle: d.detalle ?? undefined,
      observaciones: d.observaciones || undefined,
    })),
  };
}

// ─── Helpers para campos genéricos ──────────────────────────────────

export const MAQUINA_DIRECT_FIELDS = new Set([
  "anchoUtil",
  "largoUtil",
  "altoUtil",
  "espesorMaximo",
  "pesoMaximo",
  "gramajeMaxGr",
]);

export function getMaquinaFieldValue(
  form: MaquinaPayload,
  key: string,
): unknown {
  if (MAQUINA_DIRECT_FIELDS.has(key)) {
    return (form as unknown as Record<string, unknown>)[key];
  }
  const value = (form.parametrosTecnicos ?? {})[key];
  if (
    value == null &&
    form.plantilla === "corte_hilo_caliente" &&
    key in HOTWIRE_ENCASTRE_DEFAULTS
  ) {
    return HOTWIRE_ENCASTRE_DEFAULTS[key];
  }
  return value;
}

const HOTWIRE_ENCASTRE_DEFAULTS: Record<string, string | number> = {
  tipoUnionVectorial: "cola_milano",
  anchoEncastreMm: 30,
  profundidadEncastreMm: 30,
  modoCantidadEncastres: "por_distancia",
  distanciaMaximaEncastresMm: 100,
  cantidadFijaEncastres: 1,
  cantidadMinimaEncastres: 1,
  cantidadMaximaEncastres: 100,
  kerfEncastreMm: 0.3,
};

export function setMaquinaFieldValue(
  form: MaquinaPayload,
  key: string,
  value: unknown,
): MaquinaPayload {
  if (MAQUINA_DIRECT_FIELDS.has(key)) {
    return { ...form, [key]: value } as MaquinaPayload;
  }
  return {
    ...form,
    parametrosTecnicos: { ...(form.parametrosTecnicos ?? {}), [key]: value },
  };
}

export const PERFIL_DIRECT_FIELDS = new Set([
  "nombre",
  "tipoPerfil",
  "activo",
  "productivityValue",
  "productivityUnit",
  "setupMin",
  "cleanupMin",
  "feedReloadMin",
]);

export function getPerfilFieldValue(perfil: LocalPerfil, key: string): unknown {
  if (PERFIL_DIRECT_FIELDS.has(key)) {
    return (perfil as unknown as Record<string, unknown>)[key];
  }
  return (perfil.detalle ?? {})[key];
}

export function setPerfilFieldValue(
  perfil: LocalPerfil,
  key: string,
  value: unknown,
): LocalPerfil {
  if (PERFIL_DIRECT_FIELDS.has(key)) {
    return { ...perfil, [key]: value } as LocalPerfil;
  }
  return { ...perfil, detalle: { ...(perfil.detalle ?? {}), [key]: value } };
}

/**
 * PLANCHA_TERMICA — productividad (piezas/hora) en vivo desde los segundos del
 * ciclo. Espeja `deriveProductividadPlanchaTermica` del backend (fuente de
 * verdad al guardar); acá es solo para mostrar el cálculo mientras se edita.
 */
export function productividadPlanchaEnVivo(perfil: LocalPerfil): number | null {
  const num = (key: string): number | null => {
    const raw = getPerfilFieldValue(perfil, key);
    const n = typeof raw === "string" ? Number(raw) : (raw as number);
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  };
  const planchado = num("tiempoPrensadoSeg");
  if (planchado === null) return null;
  const seg =
    (num("tiempoPreplanchadoSeg") ?? 0) +
    planchado +
    (num("tiempoPostplanchadoSeg") ?? 0);
  if (seg <= 0) return null;
  return 3600 / seg;
}

export function getDefaultProductivityUnit(
  form: MaquinaPayload,
): UnidadProduccionMaquina {
  return (
    getMaquinariaTemplate(form.plantilla)?.defaultProductionUnit ??
    form.unidadProduccionPrincipal
  );
}

export function getAllowedProductivityUnits(
  form: MaquinaPayload,
): UnidadProduccionMaquina[] {
  const template = getMaquinariaTemplate(form.plantilla);
  return template?.allowedProductionUnits ?? [getDefaultProductivityUnit(form)];
}

export function normalizeProductionUnitForTemplate(
  form: MaquinaPayload,
): UnidadProduccionMaquina {
  const allowedUnits = getAllowedProductivityUnits(form);
  return allowedUnits.includes(form.unidadProduccionPrincipal)
    ? form.unidadProduccionPrincipal
    : getDefaultProductivityUnit(form);
}

export function SelectDisplay({
  label,
  placeholder = "Elegí",
}: {
  label?: string | null;
  placeholder?: string;
}) {
  return (
    <span
      className={
        label
          ? "flex flex-1 truncate text-left"
          : "flex flex-1 truncate text-left text-muted-foreground"
      }
    >
      {label || placeholder}
    </span>
  );
}

export function getOptionLabel(
  options: MaquinariaTemplateOption[] | undefined,
  value: unknown,
) {
  if (typeof value !== "string") return "";
  return (
    options?.find((optionItem) => optionItem.value === value)?.label ?? value
  );
}

/**
 * Se decide por la CLAVE y no por las opciones: mirando si existe "CMYK" se
 * perdían las pills en una máquina que sólo soporta B/N —el filtro por
 * colores de la máquina deja el campo sin esa opción—.
 */
export function isColorModeMultiselect(field: MaquinariaTemplateField) {
  return (
    field.kind === "multiselect" &&
    (field.key === "colores" || field.key === "coloresSoportados")
  );
}

export const COLOR_CHANNEL_META: Record<
  string,
  { label: string; className: string; textClassName?: string; dot: string }
> = {
  C: {
    label: "C",
    className: "border-cyan-300 bg-cyan-400",
    textClassName: "text-cyan-950",
    dot: "#22d3ee",
  },
  M: {
    label: "M",
    className: "border-fuchsia-300 bg-fuchsia-500",
    textClassName: "text-white",
    dot: "#d946ef",
  },
  Y: {
    label: "Y",
    className: "border-yellow-300 bg-yellow-300",
    textClassName: "text-yellow-950",
    dot: "#fde047",
  },
  K: {
    label: "K",
    className: "border-neutral-700 bg-neutral-950",
    textClassName: "text-white",
    dot: "#0a0a0a",
  },
  blanco: {
    label: "W",
    className: "border-neutral-300 bg-white",
    textClassName: "text-neutral-700",
    dot: "#ffffff",
  },
  barniz: {
    label: "V",
    className: "border-amber-300 bg-amber-100",
    textClassName: "text-amber-900",
    dot: "#fde68a",
  },
};

export function getColorModeChannels(value: string) {
  const normalized = value.trim().toUpperCase();
  if (["BN", "B/N", "NEGRO", "K"].includes(normalized)) return ["K"];

  const normalizedLower = normalized.toLowerCase();
  const channels = ["C", "M", "Y", "K"];
  if (normalizedLower.includes("blanco")) channels.push("blanco");
  if (normalizedLower.includes("barniz")) channels.push("barniz");
  return channels;
}

export function getGranFormatoGeometria(form: MaquinaPayload) {
  const value = (form.parametrosTecnicos ?? {}).geometria;
  return typeof value === "string" ? value : "";
}

export const GRAN_FORMATO_CM_FIELD_KEYS = new Set([
  "anchoMaxRolloMm",
  "anchoMesaMm",
  "largoMesaMm",
]);

export function shouldDisplayGranFormatoFieldInCm(
  field: MaquinariaTemplateField,
  form: MaquinaPayload,
) {
  return (
    form.plantilla === "impresora_gran_formato_por_area" &&
    field.kind === "number" &&
    field.unit === "mm" &&
    GRAN_FORMATO_CM_FIELD_KEYS.has(field.key)
  );
}

export function getTemplateUnitLabel(unit: MaquinariaTemplateField["unit"]) {
  if (!unit) return "";
  const labels: Partial<
    Record<NonNullable<MaquinariaTemplateField["unit"]>, string>
  > = {
    mm_s: "mm/seg",
    mm_min: "mm/min",
    g_h: "g/h",
    gramos: "g",
    m2_h: "m²/h",
    g_m2: "g/m²",
    m_min: "m/min",
    piezas_h: "piezas/h",
    hojas_h: "hojas/h",
    copias_min: "copias/min",
    unidades_min: "unid/min",
  };
  return labels[unit] ?? unit;
}

type MaquinaTecnologia = Pick<
  Maquina,
  "parametrosTecnicos" | "plantilla" | "geometriaTrabajo"
>;

export function getMachineTechnologyLabel(maquina: MaquinaTecnologia) {
  const tecnologia = maquina.parametrosTecnicos?.tecnologia;
  if (typeof tecnologia === "string" && tecnologia.trim()) {
    return tecnologia.replaceAll("_", " ").toUpperCase();
  }
  // Tecnologías fijas por plantilla (no se cargan en parametrosTecnicos).
  if (maquina.plantilla === "impresora_laser") return "LÁSER";
  if (maquina.plantilla === "duplicadora_digital") return "FOTODUPLICACIÓN";
  if (maquina.plantilla === "plotter_cad") return "INKJET";
  return getGeometriaTrabajoMaquinaLabel(maquina.geometriaTrabajo);
}

// Color del punto de la tecnología (columna Tipo de la tabla).
export function getMachineTechColor(maquina: MaquinaTecnologia) {
  const tech = getMachineTechnologyLabel(maquina).toUpperCase();
  if (tech.includes("DTF") && tech.includes("UV")) return "#3b74f0";
  if (tech.includes("DTF")) return "#8b5cf6";
  if (tech.includes("SOLVENTE") || tech.includes("ECOSOLVENTE"))
    return "#0d9488";
  if (tech.includes("UV")) return "#7c3aed";
  if (tech.includes("INKJET") || tech.includes("LATEX")) return "#0ea5e9";
  return "var(--ink, #14141a)";
}

export function mmToCmForInput(value: unknown) {
  if (typeof value !== "number") return value;
  return Number((value / 10).toFixed(4));
}

export function cmToMmForPayload(value: unknown) {
  if (typeof value !== "number") return value;
  return Number((value * 10).toFixed(4));
}

export function getRequiredConsumibleKeys(
  form: MaquinaPayload,
  perfiles: LocalPerfil[],
) {
  const requiredKeys = new Set<string>();
  const parametrosTecnicos = (form.parametrosTecnicos ?? {}) as Record<
    string,
    unknown
  >;

  if (!PRINTER_TEMPLATES_WITH_CONSUMIBLES.has(form.plantilla)) {
    return requiredKeys;
  }

  for (const perfil of perfiles) {
    if (!perfil.id) continue;
    for (const canal of requiredChannelsForPerfil(perfil, parametrosTecnicos)) {
      requiredKeys.add(`${perfil.id}::${canal}`);
    }
  }

  return requiredKeys;
}

export function normalizeRequiredPrinterConsumibles(
  form: MaquinaPayload,
  perfiles: LocalPerfil[],
) {
  const requiredKeys = getRequiredConsumibleKeys(form, perfiles);
  if (requiredKeys.size === 0) return form.consumibles;

  return form.consumibles.map((consumible) => {
    const canal = canalFromConsumible(consumible);
    if (!canal) return consumible;
    const key = `${consumible.perfilOperativoId ?? "maquina"}::${canal}`;
    return requiredKeys.has(key) ? { ...consumible, activo: true } : consumible;
  });
}

export function getAllowedProfileTypes(
  form: MaquinaPayload,
): TipoPerfilOperativoMaquina[] {
  const template = getMaquinariaTemplate(form.plantilla);
  const baseTypes = template?.allowedProfileTypes ?? ["impresion"];
  if (
    form.plantilla === "impresora_gran_formato_por_area" &&
    form.parametrosTecnicos?.soportaCorteIntegrado === true
  ) {
    return Array.from(new Set([...baseTypes, "corte"]));
  }
  return baseTypes;
}

export function getDefaultProfileType(
  form: MaquinaPayload,
): TipoPerfilOperativoMaquina {
  return getAllowedProfileTypes(form)[0] ?? "impresion";
}

export function cleanPerfilDetailsForType(perfil: LocalPerfil): LocalPerfil {
  if (perfil.tipoPerfil === "corte" || perfil.tipoPerfil === "mixto")
    return perfil;
  const detalle = { ...(perfil.detalle ?? {}) };
  delete detalle.tipoCorte;
  delete detalle.factorComplejidad;
  return { ...perfil, detalle };
}

export function normalizePlotterCortePerfil(
  perfil: LocalPerfil,
  form: MaquinaPayload,
): LocalPerfil {
  if (form.plantilla !== "plotter_de_corte") return perfil;
  // `tipoCorte` y `factorComplejidad` fueron retirados (eran inertes): no se
  // re-guardan desde el editor. La complejidad ahora es UN PERFIL por nivel,
  // con su propia productividad m²/h.
  const detalle = { ...(perfil.detalle ?? {}) };
  delete detalle.tipoCorte;
  delete detalle.factorComplejidad;
  return { ...perfil, detalle, productivityUnit: "m2_h" };
}

/**
 * En una cortadora láser, el tipo universal y la operación representan la
 * misma decisión. La UI muestra sólo Operación; el detalle se mantiene para
 * el selector automático del motor y para compatibilidad con datos previos.
 */
export function normalizeCorteLaserPerfil(
  perfil: LocalPerfil,
  form: MaquinaPayload,
): LocalPerfil {
  if (form.plantilla !== "corte_laser") return perfil;
  const tipoOperacion = perfil.tipoPerfil === "grabado" ? "GRABADO" : "CORTE";
  return {
    ...perfil,
    detalle: { ...(perfil.detalle ?? {}), tipoOperacion },
  };
}

export function setPerfilFieldValueForTemplate(
  perfil: LocalPerfil,
  form: MaquinaPayload,
  key: string,
  value: unknown,
): LocalPerfil {
  const next = setPerfilFieldValue(perfil, key, value);
  if (form.plantilla === "impresora_laser" && key === "productivityValue") {
    return {
      ...next,
      detalle: {
        ...(next.detalle ?? {}),
        origenProductividad: "CALIBRADO_TALLER",
      },
    };
  }
  // El plotter de corte cotiza siempre en m²/h.
  if (form.plantilla === "plotter_de_corte" && key === "productivityValue") {
    return { ...next, productivityUnit: "m2_h" };
  }
  return next;
}

export function normalizePerfilTypeForTemplate(
  perfil: LocalPerfil,
  form: MaquinaPayload,
): LocalPerfil {
  const allowedTypes = getAllowedProfileTypes(form);
  const allowedUnits = getAllowedProductivityUnits(form);
  const defaultUnit = getDefaultProductivityUnit(form);
  const perfilWithDefaults = {
    ...perfil,
    productivityUnit:
      perfil.productivityUnit && allowedUnits.includes(perfil.productivityUnit)
        ? perfil.productivityUnit
        : defaultUnit,
  };
  if (allowedTypes.includes(perfilWithDefaults.tipoPerfil)) {
    return normalizeCorteLaserPerfil(
      normalizePlotterCortePerfil(
        cleanPerfilDetailsForType(perfilWithDefaults),
        form,
      ),
      form,
    );
  }
  return normalizeCorteLaserPerfil(
    normalizePlotterCortePerfil(
      cleanPerfilDetailsForType({
        ...perfilWithDefaults,
        tipoPerfil: getDefaultProfileType(form),
      }),
      form,
    ),
    form,
  );
}

export function shouldShowMaquinaField(
  field: MaquinariaTemplateField,
  form: MaquinaPayload,
) {
  if (
    field.key === "ejeSobresalientePlaca" &&
    getMaquinaFieldValue(form, "placaSobresalientePermitida") !== true
  ) {
    return false;
  }
  if (form.plantilla === "corte_hilo_caliente") {
    const tipoUnion = getMaquinaFieldValue(form, "tipoUnionVectorial");
    const modoCantidad = getMaquinaFieldValue(form, "modoCantidadEncastres");
    const soloConEncastre = new Set([
      "anchoEncastreMm",
      "profundidadEncastreMm",
      "modoCantidadEncastres",
      "distanciaMaximaEncastresMm",
      "cantidadFijaEncastres",
      "cantidadMinimaEncastres",
      "cantidadMaximaEncastres",
    ]);
    if (tipoUnion === "recta" && soloConEncastre.has(field.key)) return false;
    if (
      modoCantidad === "cantidad_fija" &&
      new Set([
        "distanciaMaximaEncastresMm",
        "cantidadMinimaEncastres",
        "cantidadMaximaEncastres",
      ]).has(field.key)
    )
      return false;
    if (
      modoCantidad !== "cantidad_fija" &&
      field.key === "cantidadFijaEncastres"
    )
      return false;
  }
  if (form.plantilla !== "impresora_gran_formato_por_area") return true;
  const geometria = getGranFormatoGeometria(form);
  const mesaOnly = new Set(["largoUtil", "anchoMesaMm", "largoMesaMm"]);
  const rolloOnly = new Set(["anchoMaxRolloMm"]);
  if (mesaOnly.has(field.key)) return geometria === "MESA_EXTENSORA";
  if (rolloOnly.has(field.key))
    return (
      geometria === "" ||
      geometria === "ROLLO" ||
      geometria === "MESA_EXTENSORA"
    );
  return true;
}

/**
 * Los modos de color de un perfil no pueden salirse de los que declara la
 * máquina: si la impresora sólo soporta CMYK, ningún perfil puede pedir
 * blanco o barniz —el modal de tintas generaría un canal inexistente y el
 * motor lo costearía—. Las opciones del perfil se intersectan con
 * `coloresSoportados`.
 *
 * Un valor ya guardado fuera de la lista NO se borra: se muestra marcado
 * para que se vea el problema en vez de desaparecer en silencio.
 */
export function restringirColoresDelPerfil(
  field: MaquinariaTemplateField,
  form: MaquinaPayload,
  valorActual: unknown,
): MaquinariaTemplateField {
  if (field.scope !== "perfil_operativo" || field.key !== "colores") {
    return field;
  }
  const declarados = (form.parametrosTecnicos ?? {}).coloresSoportados;
  const soportados = Array.isArray(declarados)
    ? declarados.map(String)
    : typeof declarados === "string" && declarados
      ? [declarados]
      : [];
  if (soportados.length === 0) return field;

  const opciones = field.options ?? [];
  const permitidas = opciones.filter((opt) => soportados.includes(opt.value));
  // Si nada coincide, mejor no dejar el campo sin opciones.
  if (permitidas.length === 0) return field;

  const actuales = Array.isArray(valorActual)
    ? valorActual.map(String)
    : typeof valorActual === "string" && valorActual
      ? [valorActual]
      : [];
  const heredadas = opciones
    .filter(
      (opt) =>
        actuales.includes(opt.value) &&
        !permitidas.some((permitida) => permitida.value === opt.value),
    )
    .map((opt) => ({ ...opt, label: `${opt.label} · no soportado` }));

  return { ...field, options: [...permitidas, ...heredadas] };
}

export function shouldShowPerfilField(
  field: MaquinariaTemplateField,
  form: MaquinaPayload,
  perfil?: MaquinaPayload["perfilesOperativos"][number],
) {
  if (form.plantilla === "corte_laser") {
    const soloCorte = new Set(["espesorMinMm", "espesorMaxMm"]);
    if (soloCorte.has(field.key)) return perfil?.tipoPerfil === "corte";
  }
  if (form.plantilla !== "impresora_gran_formato_por_area") return true;
  const corteFieldKeys = new Set(["factorComplejidad"]);
  const impresionFieldKeys = new Set(["colores"]);
  const isCorte = perfil?.tipoPerfil === "corte";
  const isMixto = perfil?.tipoPerfil === "mixto";

  if (corteFieldKeys.has(field.key)) return isCorte || isMixto;
  if (impresionFieldKeys.has(field.key)) return !isCorte || isMixto;
  return true;
}

export function isPerfilFieldRequired(
  field: MaquinariaTemplateField,
  form: MaquinaPayload,
  perfil?: MaquinaPayload["perfilesOperativos"][number],
) {
  if (field.required) return true;
  return (
    form.plantilla === "corte_laser" &&
    perfil?.tipoPerfil === "corte" &&
    new Set(["material", "espesorMinMm", "espesorMaxMm"]).has(field.key)
  );
}

export function cleanGranFormatoGeometryFields(
  form: MaquinaPayload,
  nextGeometria: unknown,
): MaquinaPayload {
  if (form.plantilla !== "impresora_gran_formato_por_area") return form;
  if (nextGeometria !== "ROLLO" && nextGeometria !== "MESA_EXTENSORA")
    return form;
  const parametrosTecnicos = { ...(form.parametrosTecnicos ?? {}) };
  if (nextGeometria === "ROLLO") {
    delete parametrosTecnicos.anchoMesaMm;
    delete parametrosTecnicos.largoMesaMm;
    delete parametrosTecnicos.alturaMaxCabezalMm;
    return {
      ...form,
      geometriaTrabajo: "rollo",
      largoUtil: undefined,
      parametrosTecnicos,
      perfilesOperativos: form.perfilesOperativos,
    };
  }
  return { ...form, geometriaTrabajo: "plano", parametrosTecnicos };
}

export const STRUCTURED_MARGIN_FIELDS = new Set([
  "margenesNoImprimiblesMm",
  "margenesDesperdicioMm",
]);

export const marginFieldDefinitions: Record<
  string,
  Array<{ key: string; label: string }>
> = {
  margenesNoImprimiblesMm: [
    { key: "sup", label: "Superior" },
    { key: "inf", label: "Inferior" },
    { key: "izq", label: "Izquierdo" },
    { key: "der", label: "Derecho" },
  ],
  margenesDesperdicioMm: [
    { key: "inicio", label: "Inicio" },
    { key: "fin", label: "Fin" },
    { key: "izquierdo", label: "Izquierdo" },
    { key: "derecho", label: "Derecho" },
  ],
};

export function normalizeMarginValue(
  value: unknown,
): Record<string, number | undefined> {
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, number | undefined>;
      }
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, number | undefined>;
  }
  return {};
}

export function getFriendlyFieldDescription(field: MaquinariaTemplateField) {
  // La descripción de la plantilla gana (láser/CNC hablan de "usar", no de
  // "imprimir"); los textos de acá quedan de fallback para templates viejos.
  if (field.description) return field.description;
  if (field.key === "margenesNoImprimiblesMm") {
    return "Distancia que la máquina no puede imprimir en cada borde.";
  }
  if (field.key === "margenesDesperdicioMm") {
    return "Material reservado como desperdicio al iniciar, terminar o en los laterales.";
  }
  return field.description;
}

// ─── Renderer genérico de un campo del template ────────────────────

export interface FieldInputProps {
  field: MaquinariaTemplateField;
  value: unknown;
  onChange: (value: unknown) => void;
  max?: number;
  renderColorModeCards?: boolean;
  compactColorModeLabels?: boolean;
}

export function FieldInput({
  field,
  value,
  onChange,
  max,
  renderColorModeCards = false,
  compactColorModeLabels = false,
}: FieldInputProps) {
  const id = `field-${field.scope}-${field.key}`;

  if (STRUCTURED_MARGIN_FIELDS.has(field.key)) {
    const current = normalizeMarginValue(value);
    const definitions = marginFieldDefinitions[field.key] ?? [];
    // Los 4 bordes en una sola fila: son valores de 2-3 dígitos, no
    // necesitan media pantalla cada uno.
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {definitions.map((definition) => (
          <div key={definition.key} className="min-w-0 space-y-1">
            <Label htmlFor={`${id}-${definition.key}`} className="text-xs">
              {definition.label}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={`${id}-${definition.key}`}
                type="number"
                inputMode="decimal"
                min={0}
                value={
                  typeof current[definition.key] === "number"
                    ? current[definition.key]
                    : current[definition.key]
                      ? Number(current[definition.key])
                      : ""
                }
                onChange={(event) => {
                  const nextValue = event.target.value;
                  onChange({
                    ...current,
                    [definition.key]:
                      nextValue === "" ? undefined : Number(nextValue),
                  });
                }}
              />
              <span className="text-muted-foreground text-xs">mm</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  switch (field.kind) {
    case "text":
      return (
        <Input
          id={id}
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "textarea":
      return (
        <Textarea
          id={id}
          rows={3}
          value={
            typeof value === "string"
              ? value
              : value !== undefined && value !== null
                ? JSON.stringify(value, null, 2)
                : ""
          }
          placeholder={field.placeholder}
          onChange={(e) => {
            const raw = e.target.value;
            try {
              onChange(JSON.parse(raw));
            } catch {
              onChange(raw);
            }
          }}
        />
      );

    case "number":
      return (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            max={max}
            value={
              typeof value === "number" ? value : value ? Number(value) : ""
            }
            placeholder={field.placeholder}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") {
                onChange(undefined);
                return;
              }
              const parsed = Number(v);
              onChange(typeof max === "number" && parsed > max ? max : parsed);
            }}
          />
          {field.unit && (
            <span className="text-muted-foreground text-xs">
              {getTemplateUnitLabel(field.unit)}
            </span>
          )}
        </div>
      );

    case "boolean": {
      // Segmented chico Sí | No en lugar de checkbox.
      const activo = Boolean(value);
      return (
        <div className="maq-seg" role="group" aria-label={field.label}>
          <button
            type="button"
            className={activo ? "activo" : ""}
            aria-pressed={activo}
            onClick={() => onChange(true)}
          >
            Sí
          </button>
          <button
            type="button"
            className={!activo ? "activo" : ""}
            aria-pressed={!activo}
            onClick={() => onChange(false)}
          >
            No
          </button>
        </div>
      );
    }

    case "select":
      return (
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onChange(v ?? "")}
        >
          <SelectTrigger id={id} className="w-full min-w-0">
            <SelectDisplay label={getOptionLabel(field.options, value)} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multiselect": {
      const current = Array.isArray(value)
        ? (value as string[])
        : typeof value === "string" && value
          ? [value]
          : [];
      if (renderColorModeCards && isColorModeMultiselect(field)) {
        // Pills compactas de una línea: puntos de color superpuestos + nombre.
        return (
          <div className="maq-colores">
            {field.options?.map((opt) => {
              const selected = current.includes(opt.value);
              const channels = getColorModeChannels(opt.value);

              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${selected ? "Quitar" : "Agregar"} ${opt.label}`}
                  title={opt.label}
                  onClick={() => {
                    const next = selected
                      ? current.filter((v) => v !== opt.value)
                      : [...current, opt.value];
                    onChange(next);
                  }}
                  className={`maq-color-pill ${selected ? "activo" : ""}`}
                >
                  <span className="maq-color-pila">
                    {channels.map((channel) => (
                      <span
                        key={channel}
                        className="maq-color-punto"
                        style={{ background: COLOR_CHANNEL_META[channel].dot }}
                      />
                    ))}
                  </span>
                  {compactColorModeLabels ? null : (
                    <span className="maq-color-etiqueta">{opt.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        );
      }
      // Botones tipo selector (pills) en lugar de checkboxes: misma estética que
      // el resto de la app (reusa las clases de las pills de color).
      return (
        <div className="maq-colores" role="group" aria-label={field.label}>
          {field.options?.map((opt) => {
            const selected = current.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  const next = selected
                    ? current.filter((v) => v !== opt.value)
                    : [...current, opt.value];
                  onChange(next);
                }}
                className={`maq-color-pill ${selected ? "activo" : ""}`}
              >
                <span className="maq-color-etiqueta">{opt.label}</span>
              </button>
            );
          })}
        </div>
      );
    }
  }
}
