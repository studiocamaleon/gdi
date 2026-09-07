import { z } from "zod";
import { newProject, STYLES, styleDefaults } from "./project";
import { DEFAULT_LIGHTBOX, LIGHTBOX_LAYERS, validateLightbox } from "./lightbox";
import type { Project, Parameters, Production, JointParameters } from "./types";
const finite = z.number().finite();
const source = z.object({
  mode: z.enum(["text", "svg"]),
  text: z.string().max(100),
  font: z.string().max(60),
  height: finite.min(5).max(3000),
  spacing: finite.min(-30).max(100),
  svg: z.string().max(4000000),
  fileName: z.string().max(250),
});
const schema = z.object({
  version: z.literal(1),
  mode: z.enum(["letters", "joint", "lightbox"]).default("letters"),
  id: z.string().max(100),
  name: z
    .string()
    .max(150)
    .transform((value) => value.trim() || "Proyecto sin título"),
  source,
  style: z.enum(
    STYLES.map((s) => s.id) as ["solid-back", ...Project["style"][]],
  ),
  params: z.record(
    z.string(),
    z.union([finite, z.boolean(), z.string().max(20)]),
  ),
  styleParameters: z
    .record(
      z.string(),
      z.record(z.string(), z.union([finite, z.boolean(), z.string().max(20)])),
    )
    .optional(),
  features: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["hole", "pin"]),
        x: finite,
        y: finite,
        diameter: finite.min(0.1).max(300),
        width: finite.min(0.1).max(300),
        height: finite.min(0.1).max(300),
        radius: finite.min(0).max(150),
        shape: z.enum(["circle", "slot"]),
      }),
    )
    .max(500),
  cuts: z
    .array(
      z.object({
        id: z.string(),
        axis: z.enum(["x", "y"]),
        at: finite,
        gap: finite.min(0).max(20),
      }),
    )
    .max(20),
  joint: z.record(z.string(), z.union([finite, z.boolean()])),
  lightbox: z.record(z.string(), z.union([finite, z.boolean(), z.string().max(20)])).optional(),
  faceArtwork: z.object({a:z.string().max(2800000),b:z.string().max(2800000)}).optional(),
  production: z.record(
    z.string(),
    z.union([finite, z.boolean(), z.string().max(3000000)]),
  ),
  colors: z.record(z.string(), z.string().regex(/^#[\da-f]{6}$/i)),
  hidden: z.array(
    z.enum(["body", "face", "back", "pvc", "liner", "pin", "socket", "clips", "lightRails", ...Object.keys(LIGHTBOX_LAYERS)]),
  ),
  updatedAt: z.string(),
});
export function parseProject(input: unknown): Project {
  const p = schema.parse(input),
    defaults = { ...newProject(), params: styleDefaults(p.style) };
  for (const [key, val] of Object.entries(p.params)) {
    if (!(key in defaults.params)) throw new Error("Parámetro desconocido.");
    if (typeof val !== typeof defaults.params[key as keyof Parameters])
      throw new Error("Tipo de parámetro inválido.");
    if (
      typeof val === "number" &&
      (val < (["curveCenter", "organicBelly"].includes(key) ? -500 : 0) ||
        val > 3000)
    )
      throw new Error("Parámetro fuera de rango.");
  }
  for (const [key, val] of Object.entries(p.joint)) {
    if (
      !(key in defaults.joint) ||
      typeof val !== typeof defaults.joint[key as keyof JointParameters]
    )
      throw new Error("Encastre inválido.");
    if (typeof val === "number" && (val < 0 || val > 3000))
      throw new Error("Encastre fuera de rango.");
  }
  for (const [key, val] of Object.entries(p.production)) {
    if (
      !(key in defaults.production) ||
      typeof val !== typeof defaults.production[key as keyof Production]
    )
      throw new Error("Configuración de producción inválida.");
    if (typeof val === "number" && (val < 0 || val > 10000000))
      throw new Error("Tarifa o dimensión de producción fuera de rango.");
  }
  const result = {
    ...defaults,
    ...p,
    params: { ...defaults.params, ...p.params },
    joint: { ...defaults.joint, ...p.joint },
    lightbox: { ...DEFAULT_LIGHTBOX, ...p.lightbox, mountStyle: p.lightbox?.mountStyle ?? (p.lightbox ? "classic" : DEFAULT_LIGHTBOX.mountStyle), rimClosure: p.lightbox?.rimClosure ?? (p.lightbox ? "screws" : DEFAULT_LIGHTBOX.rimClosure), lights: false },
    faceArtwork: { a: "", b: "", ...p.faceArtwork },
    production: { ...defaults.production, ...p.production },
    colors: { ...defaults.colors, ...p.colors },
  } as Project;
  for (const [key,value] of Object.entries(p.lightbox || {})) {
    if (!(key in DEFAULT_LIGHTBOX) || typeof value !== typeof DEFAULT_LIGHTBOX[key as keyof typeof DEFAULT_LIGHTBOX])
      throw new Error("Parámetro de banderola desconocido o inválido.");
  }
  // Todos los estilos pasan al brazo central. Los alojamientos nuevos requieren
  // más fondo que el apoyo pasante anterior; conservar las demás medidas.
  if (p.lightbox && !("mountInsertDepth" in p.lightbox)) {
    result.lightbox.mountShoeThickness = Math.max(result.lightbox.mountShoeThickness, DEFAULT_LIGHTBOX.mountShoeThickness);
    result.lightbox.armWidth = Math.max(result.lightbox.armWidth, 28);
  }
  validateLightbox(result.lightbox);
  for (const image of Object.values(result.faceArtwork || {}))
    if(image && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image))
      throw new Error("La gráfica debe ser una imagen PNG, JPEG o WebP incorporada al proyecto.");
  if (!("lipEnabled" in p.params))
    result.params.lipEnabled = Number(p.params.lip || 0) > 0;
  if (!["Round", "Miter", "Bevel"].includes(result.params.corner))
    throw new Error("Tipo de esquina inválido.");
  const enums: Partial<Record<keyof Parameters, string[]>> = {
    patternType: [
      "circle",
      "diamond",
      "square",
      "hexagon",
      "oblong",
      "triangle",
    ],
    fitBaseType: [
      "legacy",
      "inset",
      "flush",
      "rim",
      "ring-pvc",
      "double-channel",
      "pvc-lock",
    ],
    fitWallProfile: ["straight", "bevel", "curved", "angular"],
    fitProfileDirection: ["outward", "inward"],
    organicProfile: [
      "zigzag",
      "belly",
      "pedestal",
      "waves",
      "bumper",
      "bubble",
      "stack",
    ],
    organicFace: ["acrylic", "printed"],
    organicBack: ["printed", "pvc"],
    organicFit: ["front", "back"],
    organicFaceCorner: ["straight", "chamfer", "round"],
  };
  for (const [key, values] of Object.entries(enums))
    if (!values.includes(String(result.params[key as keyof Parameters])))
      throw new Error("Opción de modelo inválida.");
  if (
    result.production.bedWidth < 20 ||
    result.production.bedHeight < 20 ||
    result.production.bedWidth > 5000 ||
    result.production.bedHeight > 5000 ||
    result.production.bedDepth < 20 || result.production.bedDepth > 5000 ||
    result.production.flexibleDensity <= 0 ||
    result.production.density <= 0 ||
    result.production.gramsHour <= 0 ||
    result.production.margin > 95 ||
    result.production.waste > 100 ||
    !["ARS", "USD", "EUR", "BRL"].includes(result.production.currency)
  )
    throw new Error("Revisá las dimensiones, tarifas y moneda de producción.");
  result.styleParameters = {};
  for (const [style, parameters] of Object.entries(p.styleParameters || {})) {
    if (!STYLES.some((s) => s.id === style))
      throw new Error("Modelo guardado desconocido.");
    result.styleParameters[style as Project["style"]] = parseProject({
      ...p,
      style,
      params: parameters,
      styleParameters: {},
    }).params;
  }
  result.joint = parseJoint(result.joint);
  return result;
}
export function parseJoint(input: unknown): JointParameters {
  const defaults = newProject().joint;
  const values = z
    .record(z.string(), z.union([finite, z.boolean()]))
    .parse(input);
  for (const [key, value] of Object.entries(values)) {
    if (
      !(key in defaults) ||
      typeof value !== typeof defaults[key as keyof JointParameters] ||
      (typeof value === "number" && (value < 0 || value > 3000))
    )
      throw new Error("Configuración de encastre inválida.");
  }
  const j = { ...defaults, ...values } as JointParameters;
  if (
    j.ball < 1 ||
    j.neck < 0.1 ||
    j.neck >= j.ball ||
    j.tipAngle <= 0 ||
    j.tipAngle >= 180 ||
    !Number.isInteger(j.slots) ||
    j.slots > 12 ||
    j.slotLength >= j.socketHeight ||
    j.socketHeight < 2 ||
    j.flangeHeight <= 0 ||
    j.socketTop < j.ball + j.clearance + 2
  )
    throw new Error("Las medidas del encastre son incompatibles.");
  return j;
}
export function savedProjects(): Project[] {
  try {
    return JSON.parse(localStorage.getItem("forma.projects") || "[]").map(
      parseProject,
    );
  } catch {
    return [];
  }
}
export function saveProject(p: Project) {
  const next = {
    ...p,
    name: p.name.trim() || "Proyecto sin título",
    updatedAt: new Date().toISOString(),
  };
  const all = savedProjects().filter((x) => x.id !== p.id);
  localStorage.setItem(
    "forma.projects",
    JSON.stringify([next, ...all].slice(0, 40)),
  );
  return next;
}
export interface RecordEntry {
  number: string;
  at: string;
  project: Project;
}
export function history(): RecordEntry[] {
  try {
    return z
      .array(
        z.object({
          number: z.string().max(50),
          at: z.string(),
          project: z.unknown(),
        }),
      )
      .parse(JSON.parse(localStorage.getItem("forma.history") || "[]"))
      .map((record) => ({ ...record, project: parseProject(record.project) }));
  } catch {
    return [];
  }
}
export function addRecord(p: Project) {
  const counter = Number(localStorage.getItem("forma.counter") || "0") + 1;
  const number = `FS-${new Date().getFullYear()}-${String(counter).padStart(4, "0")}`;
  localStorage.setItem(
    "forma.history",
    JSON.stringify(
      [
        { number, at: new Date().toISOString(), project: p },
        ...history(),
      ].slice(0, 50),
    ),
  );
  localStorage.setItem("forma.counter", String(counter));
  return number;
}
