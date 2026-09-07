import type { CrossSection, ManifoldToplevel } from "manifold-3d";
import type { Parameters, Point, Polygon } from "./types";
import type { Keeper } from "./profile-sweep";

export const PATTERNS: {
  value: Parameters["patternType"];
  label: string;
  sizeLabel: string;
}[] = [
  { value: "circle", label: "Círculos", sizeLabel: "Diámetro del círculo" },
  { value: "diamond", label: "Diamantes", sizeLabel: "Diagonal del diamante" },
  { value: "square", label: "Cuadrados", sizeLabel: "Lado del cuadrado" },
  {
    value: "hexagon",
    label: "Hexágonos",
    sizeLabel: "Diámetro entre vértices",
  },
  { value: "oblong", label: "Oblongos", sizeLabel: "Ancho del oblongo" },
  { value: "triangle", label: "Triángulos", sizeLabel: "Lado del triángulo" },
];
export const MAX_PATTERN_HOLES = 8000;
const MAX_CANDIDATES = 30000;
const radians = (degrees: number) => (degrees * Math.PI) / 180;
export function rotatePatternPoint([x, y]: Point, angle: number): Point {
  const a = radians(angle);
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

/** Contorno propio del hueco, antes de la rotación de la retícula. */
export function patternShape(
  p: Pick<
    Parameters,
    "patternType" | "patternSize" | "patternLength" | "patternAngle"
  >,
): Polygon {
  const d = p.patternSize,
    r = d / 2;
  const regular = (n: number, radius: number, start = 0): Polygon =>
    Array.from({ length: n }, (_, i) => {
      const a = start + (i * 2 * Math.PI) / n;
      return [radius * Math.cos(a), radius * Math.sin(a)];
    });
  let points: Polygon;
  switch (p.patternType) {
    case "circle":
      points = regular(48, r);
      break;
    case "diamond":
      points = regular(4, r);
      break;
    case "square":
      points = [
        [-r, -r],
        [r, -r],
        [r, r],
        [-r, r],
      ];
      break;
    case "hexagon":
      points = regular(6, r);
      break;
    case "triangle":
      points = regular(3, d / Math.sqrt(3), Math.PI / 2);
      break;
    case "oblong": {
      const half = (p.patternLength - d) / 2;
      points = [];
      for (let i = 0; i <= 24; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 24;
        points.push([half + r * Math.cos(a), r * Math.sin(a)]);
      }
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI / 2 + (i * Math.PI) / 24;
        points.push([-half + r * Math.cos(a), r * Math.sin(a)]);
      }
      break;
    }
    default:
      throw new Error("Tipo de calado desconocido.");
  }
  return points.map((point) => rotatePatternPoint(point, p.patternAngle));
}

export function patternPitch(p: Parameters) {
  const polygon = patternShape(p),
    xs = polygon.map((pt) => pt[0]),
    ys = polygon.map((pt) => pt[1]);
  return {
    polygon,
    x: Math.max(...xs) - Math.min(...xs) + p.patternSpacing,
    y: Math.max(...ys) - Math.min(...ys) + p.patternSpacing,
  };
}

/** Sólo huecos completos. Una retícula común mantiene alineado un cartel de
 * varias letras; la separación mínima se conserva al girar cualquier figura. */
export function createPerforation(
  wasm: ManifoldToplevel,
  keep: Keeper,
  outline: CrossSection,
  diffuser: CrossSection,
  p: Parameters,
) {
  if (
    ![
      p.patternSize,
      p.patternLength,
      p.patternSpacing,
      p.patternBorder,
      p.patternMargin,
      p.patternRotation,
      p.patternAngle,
    ].every(Number.isFinite) ||
    p.patternSize < 0.4 ||
    p.patternSpacing < 0.4 ||
    p.patternBorder < 2 ||
    p.patternMargin < 0 ||
    (p.patternType === "oblong" && p.patternLength < p.patternSize)
  )
    throw new Error(
      "Revisá el calado: tamaño y separación mínimos de 0,4 mm, borde de al menos 2 mm y largo del oblongo mayor o igual a su ancho.",
    );
  const { CrossSection: CS } = wasm;
  const protectedOutline = keep(
    outline.offset(-p.patternBorder - p.patternMargin, "Miter", 2, 48),
  );
  // Cada hueco debe quedar sobre el difusor y conservar al menos 0,6 mm
  // de apoyo perimetral; se protegen también los huecos internos de la letra.
  const covered = keep(diffuser.offset(-0.6, "Miter", 2, 48));
  const safe = keep(
    keep(protectedOutline.intersect(covered)).rotate(-p.patternRotation),
  );
  const empty = () => keep(new CS([]));
  if (safe.isEmpty())
    return { holes: empty(), count: 0, area: 0, frontArea: outline.area() };
  const { polygon, x: dx, y: dy } = patternPitch(p),
    bounds = safe.bounds();
  const minX = Math.floor(bounds.min[0] / dx) - 1,
    maxX = Math.ceil(bounds.max[0] / dx) + 1;
  const minY = Math.floor(bounds.min[1] / dy) - 1,
    maxY = Math.ceil(bounds.max[1] / dy) + 1;
  if ((maxX - minX + 1) * (maxY - minY + 1) > MAX_CANDIDATES)
    throw new Error(
      "El calado es demasiado denso para este tamaño. Aumentá el tamaño o la separación de los huecos, o dividí el diseño.",
    );
  const contours: Polygon[] = [];
  const shape = keep(new CS([polygon]));
  for (let row = minY; row <= maxY; row++)
    for (let col = minX; col <= maxX; col++) {
      // Liberar cada candidato de inmediato: una retícula densa no debe
      // retener decenas de miles de objetos WASM hasta terminar el modelo.
      const candidate = shape.translate([col * dx, row * dy]);
      const outside = candidate.subtract(safe);
      const fits = outside.isEmpty();
      outside.delete();
      candidate.delete();
      if (!fits) continue;
      contours.push(polygon.map(([x, y]) => [x + col * dx, y + row * dy]));
      if (contours.length > MAX_PATTERN_HOLES)
        throw new Error(
          "El diseño supera los 8000 huecos de calado. Aumentá su tamaño o separación.",
        );
    }
  const holes = keep(
    keep(new CS(contours, "NonZero")).rotate(p.patternRotation),
  );
  return {
    holes,
    count: contours.length,
    area: holes.area(),
    frontArea: outline.area(),
  };
}
