import type { FitBaseType, Layer, Parameters, Project, StyleId } from "./types";
import { LAYER_NAMES } from "./project";

export type FitComponent = "body" | "back" | "face" | "pvc" | "fit";

export const FIT_BASES: {
  value: FitBaseType;
  label: string;
  description: string;
}[] = [
  {
    value: "legacy",
    label: "Base clásica",
    description:
      "Conserva el encastre y el retroceso de los proyectos anteriores.",
  },
  {
    value: "inset",
    label: "Base interior sin reborde",
    description: "Fondo y pared interior contenidos dentro del cuerpo.",
  },
  {
    value: "flush",
    label: "Base al ras",
    description:
      "Fondo alineado al contorno exterior, con pared interior de encastre.",
  },
  {
    value: "rim",
    label: "Base con reborde exterior",
    description:
      "Una segunda pared rodea el cuerpo por fuera y lo recibe en un canal.",
  },
  {
    value: "ring-pvc",
    label: "Marco con fondo de PVC",
    description:
      "Marco impreso desmontable y placa de PVC independientes. El PVC se coloca en el marco antes de montar la base.",
  },
  {
    value: "double-channel",
    label: "Base de doble canal",
    description:
      "Base al ras con segunda pared interior y altura del canal configurables.",
  },
  {
    value: "pvc-lock",
    label: "PVC con traba trapezoidal",
    description:
      "Fondo de PVC que entra por atrás y apoya en un tope trapezoidal integrado en el cuerpo.",
  },
];

export function fitComponents(style: StyleId, p: Parameters): FitComponent[] {
  return [
    "body",
    ...(p.fitBaseType === "pvc-lock" ? [] : (["back"] as const)),
    ...(style !== "printed-fit" ? (["face"] as const) : []),
    ...(["ring-pvc", "pvc-lock"].includes(p.fitBaseType)
      ? (["pvc"] as const)
      : []),
    "fit",
  ];
}

export function isFitStyle(style: StyleId) {
  return (
    style === "acrylic-fit" || style === "printed-fit" || style === "perforated"
  );
}

export function fitAssembly(style: StyleId, p: Parameters) {
  const front =
    style === "printed-fit"
      ? p.base
      : style === "perforated"
        ? p.base + p.acrylic
        : p.borderThickness + p.acrylic;
  const clearance = (style === "printed-fit" ? 2 : 1) * p.clearance;
  const baseHeight =
    p.fitBaseHeight > 0
      ? p.fitBaseHeight
      : p.height - front - p.innerReduction - clearance;
  return {
    front,
    clearance,
    baseHeight,
    bodyHeight:
      p.fitBaseType === "legacy"
        ? p.height - p.outerRecess
        : ["inset", "pvc-lock"].includes(p.fitBaseType)
          ? p.height
          : p.height - p.traySheet - p.clearance,
    baseMin: Math.max(
      p.traySheet + 0.1,
      p.fitBaseType === "legacy" ? p.outerRecess - p.clearance : 0,
      p.fitBaseType === "ring-pvc" ? p.traySheet + p.pvc + 0.1 : 0,
      p.fitBaseType === "double-channel"
        ? p.traySheet + p.fitChannelFloor + p.fitChannelHeight
        : 0,
      p.fitBaseType === "rim" ? p.traySheet + p.fitRimHeight : 0,
    ),
    baseMax: p.height - front - clearance,
  };
}

// Resolver la medida anterior antes de editar evita que cambiar el cuerpo,
// el frente o una holgura vuelva a dimensionar la base implícitamente.
export function updateFitParameters(
  style: StyleId,
  params: Parameters,
  changes: Partial<Parameters>,
): Parameters {
  return {
    ...params,
    fitBaseHeight: fitAssembly(style, params).baseHeight,
    ...changes,
  };
}

export function componentLabel(
  project: Pick<Project, "style" | "mode"> & { params?: Parameters },
  layer: Layer,
) {
  if (project.mode === "letters" && isFitStyle(project.style)) {
    if (layer === "body")
      return project.style === "printed-fit"
        ? "Cuerpo y frente"
        : project.style === "perforated"
          ? "Cuerpo y frente calado"
          : "Cuerpo";
    if (layer === "back")
      return project.params?.fitBaseType === "ring-pvc"
        ? "Marco desmontable"
        : "Base desmontable";
    if (layer === "face")
      return project.style === "perforated" ? "Difusor acrílico" : "Acrílico";
  }
  return LAYER_NAMES[layer];
}
