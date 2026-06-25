import { tecnologiaMaquinaItems, type TecnologiaMaquina } from "@/lib/maquinaria";

type MachineTechnologySource = {
  plantilla?: string | null;
  parametrosTecnicosJson?: Record<string, unknown> | null;
  capacidadesAvanzadas?: Record<string, unknown> | null;
};

const TECHNOLOGY_LABELS = new Map(
  tecnologiaMaquinaItems.map((item) => [item.value, item.label]),
);

export function normalizeMachineTechnology(value: unknown): TecnologiaMaquina | null {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return null;
  const normalized = raw
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (["solvente", "eco_solvente", "ecosolvente", "eco"].includes(normalized)) {
    return "eco_solvente";
  }
  if (["uv", "ultravioleta"].includes(normalized)) return "uv";
  if (["latex", "látex"].includes(normalized)) return "latex";
  if (["laser", "láser"].includes(normalized)) return "laser";
  if (["sublimacion", "sublimación"].includes(normalized)) return "sublimacion";
  if (["dtf_textil", "dtftextil"].includes(normalized)) return "dtf_textil";
  if (["dtf_uv", "dtfuv"].includes(normalized)) return "dtf_uv";
  if (normalized === "inkjet") return "inkjet";

  return tecnologiaMaquinaItems.some((item) => item.value === normalized)
    ? (normalized as TecnologiaMaquina)
    : null;
}

export function getMachineTechnology(machine: MachineTechnologySource): TecnologiaMaquina | null {
  const params = machine.parametrosTecnicosJson ?? {};
  const explicit =
    normalizeMachineTechnology(params.tecnologia) ??
    normalizeMachineTechnology(params.tecnologiaMaquina) ??
    normalizeMachineTechnology(machine.capacidadesAvanzadas?.tecnologiaMaquina);
  if (explicit) return explicit;

  const plantilla = typeof machine.plantilla === "string" ? machine.plantilla.toLowerCase() : "";
  if (plantilla === "impresora_laser") return "laser";
  return null;
}

export function machineTechnologyLabel(machine: MachineTechnologySource) {
  const technology = getMachineTechnology(machine);
  return technology ? TECHNOLOGY_LABELS.get(technology) ?? technology : "Sin tecnología";
}
