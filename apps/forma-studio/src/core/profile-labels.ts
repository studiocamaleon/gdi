import type { Parameters } from "./types";

// Los identificadores se mantienen para conservar los proyectos guardados.
export const SPECIAL_PROFILE_LABELS: Record<Parameters["organicProfile"], string> = {
  zigzag: "Pliegues",
  belly: "Arco",
  pedestal: "Transición",
  waves: "Acanalado",
  bumper: "Zócalo",
  bubble: "Cúpula",
  stack: "Estratos",
};
