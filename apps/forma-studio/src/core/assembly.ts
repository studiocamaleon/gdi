import type { Layer, Project } from "./types";

// Z es la orientación de fabricación de los sólidos, no la cara del cartel.
// En estos cuerpos el frente se imprime contra la cama y queda en Z mínimo.
export function frontDirection(
  project: Pick<Project, "mode" | "style" | "params">,
): 1 | -1 {
  if (project.mode !== "letters") return 1;
  return [
    "back-fit",
    "acrylic-fit",
    "printed-fit",
    "perforated",
    "halo",
  ].includes(project.style) ||
    (project.style === "organic" &&
      project.params.organicFit === "back" &&
      !project.params.organicSolid)
    ? -1
    : 1;
}

export function assemblyDirection(
  project: Pick<Project, "mode" | "style" | "params">,
  layer: Layer,
): -1 | 0 | 1 {
  if (project.mode !== "letters") return 0;
  if (project.style === "curved")
    return project.params.curveSeparate && layer === "body" ? 1 : 0;
  if (layer === "body") return 0;
  // El acrílico de los encastres se retira por la apertura posterior, nunca
  // atravesando el labio frontal, aunque esté cerca del extremo inferior.
  if (layer === "face" || layer === "liner" || layer === "pvc") return 1;
  if (layer === "back") return frontDirection(project) === -1 ? 1 : -1;
  return 0;
}

/** El PVC de un marco sale junto con éste y después se separa hacia su
 * abertura frontal. No atraviesa el suelo del marco en la vista de montaje. */
export function assemblyOffset(
  project: Project,
  layer: Layer,
  direction: number,
  distance: number,
) {
  if (
    project.mode === "letters" &&
    ["acrylic-fit", "printed-fit", "perforated"].includes(project.style) &&
    project.params.fitBaseType !== "legacy" &&
    (layer === "face" ||
      (project.params.fitBaseType === "ring-pvc" && layer === "pvc"))
  ) {
    const clearBody = project.params.height + 1;
    const separation = layer === "face" ? 0.25 : 0.5;
    return distance <= clearBody
      ? distance
      : clearBody + (distance - clearBody) * separation;
  }
  return direction * distance;
}
