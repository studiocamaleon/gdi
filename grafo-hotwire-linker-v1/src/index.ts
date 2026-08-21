import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EPS = 1e-7;
const LOCATION_EPS = 1e-5;

export type Point = { x: number; y: number };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
type Location = { contourId: string; segmentIndex: number; t: number; point: Point };
export type ContourRole = "outer" | "hole" | "island";

export type Contour = {
  id: string;
  pieceId: string;
  points: Point[];
  signedArea: number;
  area: number;
  perimeter: number;
  bounds: Bounds;
  depth: number;
  parentContourId?: string;
  role: ContourRole;
};

export type Piece = {
  id: string;
  contours: Contour[];
};

export type ParsedSvg = {
  source: string;
  widthMm: number;
  heightMm: number;
  viewBox: [number, number, number, number];
  unitScaleX: number;
  unitScaleY: number;
  contours: Contour[];
  pieces: Piece[];
};

export type BridgeKind = "external" | "internal" | "origin";

export type Bridge = {
  id: string;
  kind: BridgeKind;
  aNodeId: string;
  bNodeId: string;
  a?: Location;
  b?: Location;
  originPoint?: Point;
  length: number;
};

type Candidate = Bridge & { score: number };

type Attachment = {
  id: string;
  bridgeId: string;
  contourId: string;
  segmentIndex: number;
  t: number;
  point: Point;
};

type OrderedContour = {
  contour: Contour;
  points: Point[];
  attachmentIdsAtVertex: Map<number, string[]>;
  attachmentVertexIndex: Map<string, number>;
};

export type RouteSegmentType = "origin" | "bridge" | "contour";

export type RoutePoint = Point & {
  via: RouteSegmentType;
  contourId?: string;
  bridgeId?: string;
};

export type Metrics = {
  contourLengthMm: number;
  bridgeOneWayLengthMm: number;
  bridgeTravelLengthMm: number;
  totalLengthMm: number;
  estimatedSeconds: number;
  contourCount: number;
  pieceCount: number;
  bridgeCount: number;
};

export type OriginCorner = "bottom-left" | "bottom-right" | "top-left" | "top-right";
export type LineEnding = "CRLF" | "LF";
export type OriginStrategy = "geometry-bounds" | "plate-corner";

export type MachineProfile = {
  id: string;
  name: string;
  bedWidthMm: number;
  bedHeightMm: number;
  feedRateMmPerMin: number;
  decimals: number;
  originCorner: OriginCorner;
  originStrategy: OriginStrategy;
  originLeadInMm: number;
  lineEnding: LineEnding;
  headerLines: string[];
  feedCommand: string;
  trailingSpaceAfterFeed: boolean;
  duplicateInitialOriginLines: number;
  footerLines: string[];
  finalBlankLines: number;
  strictBounds: boolean;
  calibration: {
    source: string;
    notes: string;
  };
};

export const CORPOREARTE_POLIFAN_PROFILE: MachineProfile = {
  id: "corporearte-polifan-grbl-vectorlinker",
  name: "Corporearte · cortadora de polifan 1250 × 600 mm",
  bedWidthMm: 1250,
  bedHeightMm: 600,
  feedRateMmPerMin: 350,
  decimals: 6,
  originCorner: "bottom-left",
  originStrategy: "geometry-bounds",
  originLeadInMm: 8,
  lineEnding: "CRLF",
  headerLines: [
    "G17 G90 G21",
    "G94",
    "G92 X0 Y0 Z0",
    "G54",
    "T08",
    "G00 S0 M03",
    "Z.24",
  ],
  feedCommand: "G1 F",
  trailingSpaceAfterFeed: true,
  duplicateInitialOriginLines: 2,
  footerLines: [],
  finalBlankLines: 1,
  strictBounds: true,
  calibration: {
    source: "andina.tap generado por VectorLinker",
    notes: "Origen inferior izquierdo, X hacia la derecha, Y hacia arriba, seis decimales y salida CRLF.",
  },
};

export type GenerateHotwireInput = {
  svg: string;
  sourceName?: string;
  profile?: Partial<MachineProfile>;
  originCorner?: OriginCorner;
  originStrategy?: OriginStrategy;
  originSvg?: Point;
  strictBounds?: boolean;
};

export type HotwireReport = Record<string, unknown>;

export type HotwireJob = {
  parsed: ParsedSvg;
  profile: MachineProfile;
  originSvg: Point;
  bridges: Bridge[];
  routeSvg: RoutePoint[];
  routeMachine: RoutePoint[];
  metrics: Metrics;
  tap: string;
  linkedSvg: string;
  previewHtml: string;
  report: HotwireReport;
};

type CliOptions = {
  input: string;
  outputDir: string;
  profilePath?: string;
  feedRate?: number;
  decimals?: number;
  originCorner?: OriginCorner;
  originStrategy?: OriginStrategy;
  originSvg?: Point;
  allowOutOfBounds: boolean;
};

function parsePoint(raw: string, optionName: string): Point {
  const [x, y] = raw.split(",").map((value) => Number(value.trim()));
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${optionName} debe tener el formato X,Y, por ejemplo 0,600`);
  }
  return { x, y };
}

function parseOriginCorner(raw: string): OriginCorner {
  const allowed: OriginCorner[] = ["bottom-left", "bottom-right", "top-left", "top-right"];
  if (!allowed.includes(raw as OriginCorner)) {
    throw new Error(`--origin debe ser uno de: ${allowed.join(", ")}`);
  }
  return raw as OriginCorner;
}

function parseOriginStrategy(raw: string): OriginStrategy {
  const normalized = raw === "geometry" ? "geometry-bounds" : raw === "plate" ? "plate-corner" : raw;
  const allowed: OriginStrategy[] = ["geometry-bounds", "plate-corner"];
  if (!allowed.includes(normalized as OriginStrategy)) {
    throw new Error(`--origin-strategy debe ser uno de: geometry-bounds, plate-corner`);
  }
  return normalized as OriginStrategy;
}

function parseArgs(argv: string[]): CliOptions {
  const positional: string[] = [];
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split("=", 2);
      if (inline !== undefined) values.set(key, inline);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) values.set(key, argv[++i]);
      else flags.add(key);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length === 0) {
    throw new Error(
      "Uso: node dist/index.js <archivo.svg> [--output ./output] [--profile ./config/perfil.json] " +
      "[--origin bottom-left] [--origin-strategy geometry-bounds|plate-corner] [--origin-svg 0,600] " +
      "[--feed 350] [--decimals 6] [--allow-out-of-bounds]",
    );
  }

  const feedRate = values.has("feed") ? Number(values.get("feed")) : undefined;
  const decimals = values.has("decimals") ? Number(values.get("decimals")) : undefined;
  if (feedRate !== undefined && (!Number.isFinite(feedRate) || feedRate <= 0)) {
    throw new Error("--feed debe ser mayor que cero");
  }
  if (decimals !== undefined && (!Number.isInteger(decimals) || decimals < 0 || decimals > 9)) {
    throw new Error("--decimals debe ser un entero entre 0 y 9");
  }

  return {
    input: path.resolve(positional[0]),
    outputDir: path.resolve(values.get("output") ?? "./output"),
    profilePath: values.has("profile") ? path.resolve(values.get("profile")!) : undefined,
    feedRate,
    decimals,
    originCorner: values.has("origin") ? parseOriginCorner(values.get("origin")!) : undefined,
    originStrategy: values.has("origin-strategy") ? parseOriginStrategy(values.get("origin-strategy")!) : undefined,
    originSvg: values.has("origin-svg") ? parsePoint(values.get("origin-svg")!, "--origin-svg") : undefined,
    allowOutOfBounds: flags.has("allow-out-of-bounds"),
  };
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([:\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(tag)) !== null) {
    attrs[match[1]] = match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function parseLengthMm(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const match = raw.trim().match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*(mm|cm|in|px)?$/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  const unit = (match[2] ?? "px").toLowerCase();
  if (unit === "mm") return value;
  if (unit === "cm") return value * 10;
  if (unit === "in") return value * 25.4;
  if (unit === "px") return (value * 25.4) / 96;
  return undefined;
}

function tokenizePathData(d: string): string[] {
  return d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
}

function parseLinearPaths(d: string): Point[][] {
  const tokens = tokenizePathData(d);
  const paths: Point[][] = [];
  let points: Point[] = [];
  let i = 0;
  let cmd = "";
  let current: Point = { x: 0, y: 0 };
  let start: Point | undefined;
  let closed = false;

  const isCommand = (token: string) => /^[a-zA-Z]$/.test(token);
  const number = (): number => {
    if (i >= tokens.length || isCommand(tokens[i])) throw new Error(`Path inválido cerca de ${tokens[i] ?? "EOF"}`);
    const value = Number(tokens[i++]);
    if (!Number.isFinite(value)) throw new Error("Número inválido en path");
    return value;
  };
  const addPoint = (point: Point): void => {
    if (points.length === 0 || distance(points[points.length - 1], point) > EPS) points.push(point);
    current = point;
  };
  const finishPath = (): void => {
    if (points.length === 0) return;
    if (!closed) throw new Error("Cada subcontorno del path debe estar cerrado con Z");
    const normalized = removeConsecutiveDuplicates(points);
    if (normalized.length < 3) throw new Error("Un contorno debe tener al menos 3 puntos");
    paths.push(normalized);
    points = [];
    start = undefined;
    closed = false;
  };

  while (i < tokens.length) {
    if (isCommand(tokens[i])) cmd = tokens[i++];
    if (!cmd) throw new Error("Path sin comando inicial");

    const relative = cmd === cmd.toLowerCase();
    const upper = cmd.toUpperCase();

    if (upper === "M") {
      finishPath();
      const x = number();
      const y = number();
      const p = relative ? { x: current.x + x, y: current.y + y } : { x, y };
      addPoint(p);
      start = p;
      cmd = relative ? "l" : "L";
      while (i < tokens.length && !isCommand(tokens[i])) {
        const lx = number();
        const ly = number();
        addPoint(relative ? { x: current.x + lx, y: current.y + ly } : { x: lx, y: ly });
      }
      continue;
    }

    if (upper === "L") {
      while (i < tokens.length && !isCommand(tokens[i])) {
        const x = number();
        const y = number();
        addPoint(relative ? { x: current.x + x, y: current.y + y } : { x, y });
      }
      continue;
    }

    if (upper === "H") {
      while (i < tokens.length && !isCommand(tokens[i])) {
        const x = number();
        addPoint({ x: relative ? current.x + x : x, y: current.y });
      }
      continue;
    }

    if (upper === "V") {
      while (i < tokens.length && !isCommand(tokens[i])) {
        const y = number();
        addPoint({ x: current.x, y: relative ? current.y + y : y });
      }
      continue;
    }

    if (upper === "Z") {
      if (!start) throw new Error("Path cerrado sin punto inicial");
      current = start;
      closed = true;
      finishPath();
      cmd = "";
      continue;
    }

    throw new Error(
      `El prototipo recibió el comando SVG ${cmd}. Esta primera versión acepta paths ya aplanados: M/L/H/V/Z.`,
    );
  }

  finishPath();
  if (paths.length === 0) throw new Error("El path no contiene contornos cerrados");
  return paths;
}

function removeConsecutiveDuplicates(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    if (result.length === 0 || distance(result[result.length - 1], point) > EPS) result.push(point);
  }
  if (result.length > 1 && distance(result[0], result[result.length - 1]) <= EPS) result.pop();
  return result;
}

function polygonSignedArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function polygonPerimeter(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) sum += distance(points[i], points[(i + 1) % points.length]);
  return sum;
}

function getBounds(points: Point[]): Bounds {
  return points.reduce<Bounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

function pointOnSegment(point: Point, a: Point, b: Point, tolerance = 1e-5): boolean {
  const ab = subtract(b, a);
  const ap = subtract(point, a);
  const crossValue = Math.abs(cross(ab, ap));
  if (crossValue > tolerance * Math.max(1, length(ab))) return false;
  const dotValue = dot(ap, ab);
  if (dotValue < -tolerance) return false;
  if (dotValue > dot(ab, ab) + tolerance) return false;
  return true;
}

function pointInPolygon(point: Point, polygon: Point[], includeBoundary = true): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j];
    const b = polygon[i];
    if (includeBoundary && pointOnSegment(point, a, b)) return true;
    const intersects =
      b.y > point.y !== a.y > point.y &&
      point.x < ((a.x - b.x) * (point.y - b.y)) / (a.y - b.y + Number.EPSILON) + b.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pieceIdFromPathId(id: string): string {
  return id.replace(/-\d+$/, "");
}

export function parseSvg(svg: string): ParsedSvg {
  const svgTag = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!svgTag) throw new Error("No se encontró la etiqueta <svg>");
  const svgAttrs = parseAttributes(svgTag);
  const viewBoxValues = (svgAttrs.viewBox ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (viewBoxValues.length !== 4 || viewBoxValues.some((value) => !Number.isFinite(value))) {
    throw new Error("El SVG debe incluir un viewBox válido");
  }
  const viewBox = viewBoxValues as [number, number, number, number];
  const widthMm = parseLengthMm(svgAttrs.width) ?? viewBox[2];
  const heightMm = parseLengthMm(svgAttrs.height) ?? viewBox[3];
  const unitScaleX = widthMm / viewBox[2];
  const unitScaleY = heightMm / viewBox[3];
  if (Math.abs(unitScaleX - unitScaleY) > 1e-6) {
    throw new Error("El SVG tiene escalas X/Y distintas; el prototipo requiere escala uniforme");
  }

  const contours: Contour[] = [];
  const pathRegex = /<path\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(svg)) !== null) {
    const attrs = parseAttributes(match[0]);
    if (!attrs.d) continue;
    if (attrs.transform) {
      throw new Error(`El path ${attrs.id ?? contours.length + 1} contiene transform. Grafo debe exportar coordenadas finales sin transformaciones.`);
    }
    if (!/[zZ]/.test(attrs.d)) {
      throw new Error(`El path ${attrs.id ?? contours.length + 1} no está cerrado con Z.`);
    }
    const pathId = attrs.id ?? `path-${contours.length + 1}`;
    const pieceId = attrs["data-piece-id"] ?? pieceIdFromPathId(pathId);
    const rawPaths = parseLinearPaths(attrs.d);
    for (let subpathIndex = 0; subpathIndex < rawPaths.length; subpathIndex += 1) {
      const points = rawPaths[subpathIndex].map((point) => ({
        x: (point.x - viewBox[0]) * unitScaleX,
        y: (point.y - viewBox[1]) * unitScaleY,
      }));
      const signedArea = polygonSignedArea(points);
      contours.push({
        id: rawPaths.length === 1 ? pathId : `${pathId}-subpath-${subpathIndex + 1}`,
        pieceId,
        points,
        signedArea,
        area: Math.abs(signedArea),
        perimeter: polygonPerimeter(points),
        bounds: getBounds(points),
        depth: 0,
        role: "outer",
      });
    }
  }
  if (contours.length === 0) throw new Error("El SVG no contiene paths de corte");

  const grouped = new Map<string, Contour[]>();
  for (const contour of contours) {
    const group = grouped.get(contour.pieceId) ?? [];
    group.push(contour);
    grouped.set(contour.pieceId, group);
  }

  const pieces: Piece[] = [];
  for (const [pieceId, group] of grouped.entries()) {
    const byArea = [...group].sort((a, b) => b.area - a.area);
    for (const contour of group) {
      const containers = byArea.filter(
        (other) => other.id !== contour.id && other.area > contour.area && pointInPolygon(contour.points[0], other.points, false),
      );
      contour.depth = containers.length;
      const parent = containers.sort((a, b) => a.area - b.area)[0];
      contour.parentContourId = parent?.id;
      contour.role = contour.depth % 2 === 0 ? (contour.depth === 0 ? "outer" : "island") : "hole";
    }
    pieces.push({ id: pieceId, contours: group });
  }

  return { source: svg, widthMm, heightMm, viewBox, unitScaleX, unitScaleY, contours, pieces };
}

function resolveMachineProfile(overrides?: Partial<MachineProfile>): MachineProfile {
  const profile: MachineProfile = {
    ...CORPOREARTE_POLIFAN_PROFILE,
    ...overrides,
    headerLines: overrides?.headerLines ? [...overrides.headerLines] : [...CORPOREARTE_POLIFAN_PROFILE.headerLines],
    footerLines: overrides?.footerLines ? [...overrides.footerLines] : [...CORPOREARTE_POLIFAN_PROFILE.footerLines],
    calibration: {
      ...CORPOREARTE_POLIFAN_PROFILE.calibration,
      ...(overrides?.calibration ?? {}),
    },
  };
  if (!Number.isFinite(profile.bedWidthMm) || profile.bedWidthMm <= 0) throw new Error("El ancho útil de máquina debe ser positivo");
  if (!Number.isFinite(profile.bedHeightMm) || profile.bedHeightMm <= 0) throw new Error("El alto útil de máquina debe ser positivo");
  if (!Number.isFinite(profile.feedRateMmPerMin) || profile.feedRateMmPerMin <= 0) throw new Error("La velocidad F debe ser positiva");
  if (!Number.isInteger(profile.decimals) || profile.decimals < 0 || profile.decimals > 9) throw new Error("La precisión debe ser un entero entre 0 y 9");
  return profile;
}

export function originPointForCorner(parsed: ParsedSvg, corner: OriginCorner): Point {
  switch (corner) {
    case "bottom-left": return { x: 0, y: parsed.heightMm };
    case "bottom-right": return { x: parsed.widthMm, y: parsed.heightMm };
    case "top-left": return { x: 0, y: 0 };
    case "top-right": return { x: parsed.widthMm, y: 0 };
  }
}

export function automaticOriginPoint(parsed: ParsedSvg, profile: MachineProfile): Point {
  if (profile.originStrategy === "plate-corner") return originPointForCorner(parsed, profile.originCorner);
  const geometryBounds = boundsOfPoints(parsed.contours.flatMap((contour) => contour.points));
  const lead = Math.max(0, profile.originLeadInMm);
  switch (profile.originCorner) {
    case "bottom-left":
      return { x: Math.max(0, geometryBounds.minX - lead), y: Math.min(parsed.heightMm, geometryBounds.maxY + lead) };
    case "bottom-right":
      return { x: Math.min(parsed.widthMm, geometryBounds.maxX + lead), y: Math.min(parsed.heightMm, geometryBounds.maxY + lead) };
    case "top-left":
      return { x: Math.max(0, geometryBounds.minX - lead), y: Math.max(0, geometryBounds.minY - lead) };
    case "top-right":
      return { x: Math.min(parsed.widthMm, geometryBounds.maxX + lead), y: Math.max(0, geometryBounds.minY - lead) };
  }
}

export function svgPointToMachine(point: Point, originSvg: Point, corner: OriginCorner): Point {
  switch (corner) {
    case "bottom-left": return { x: point.x - originSvg.x, y: originSvg.y - point.y };
    case "bottom-right": return { x: originSvg.x - point.x, y: originSvg.y - point.y };
    case "top-left": return { x: point.x - originSvg.x, y: point.y - originSvg.y };
    case "top-right": return { x: originSvg.x - point.x, y: point.y - originSvg.y };
  }
}

function routeToMachine(route: RoutePoint[], originSvg: Point, corner: OriginCorner): RoutePoint[] {
  return route.map((point) => ({ ...point, ...svgPointToMachine(point, originSvg, corner) }));
}

function boundsOfPoints(points: Point[]): Bounds {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return getBounds(points);
}

function validateSourceGeometry(parsed: ParsedSvg): string[] {
  const warnings: string[] = [];
  for (const contour of parsed.contours) {
    if (contour.bounds.minX < -EPS || contour.bounds.minY < -EPS || contour.bounds.maxX > parsed.widthMm + EPS || contour.bounds.maxY > parsed.heightMm + EPS) {
      warnings.push(`El contorno ${contour.id} excede el área SVG de ${parsed.widthMm} × ${parsed.heightMm} mm.`);
    }
  }
  return warnings;
}

function validateMachineRoute(routeMachine: RoutePoint[], profile: MachineProfile, strictBounds: boolean): string[] {
  const bounds = boundsOfPoints(routeMachine);
  const warnings: string[] = [];
  if (!pointEquals(routeMachine[0], { x: 0, y: 0 }, 1e-5)) warnings.push("El recorrido de máquina no comienza en X0 Y0.");
  if (!pointEquals(routeMachine[routeMachine.length - 1], { x: 0, y: 0 }, 1e-5)) warnings.push("El recorrido de máquina no regresa a X0 Y0.");
  if (bounds.minX < -1e-5 || bounds.minY < -1e-5) {
    warnings.push(`El recorrido genera coordenadas negativas: Xmín ${bounds.minX.toFixed(3)}, Ymín ${bounds.minY.toFixed(3)} mm.`);
  }
  if (bounds.maxX > profile.bedWidthMm + 1e-5 || bounds.maxY > profile.bedHeightMm + 1e-5) {
    warnings.push(
      `El recorrido excede el área útil ${profile.bedWidthMm} × ${profile.bedHeightMm} mm: ` +
      `Xmáx ${bounds.maxX.toFixed(3)}, Ymáx ${bounds.maxY.toFixed(3)} mm.`,
    );
  }
  if (strictBounds && warnings.length > 0) throw new Error(warnings.join(" "));
  return warnings;
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}
function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}
function multiply(a: Point, scalar: number): Point {
  return { x: a.x * scalar, y: a.y * scalar };
}
function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}
function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}
function length(a: Point): number {
  return Math.hypot(a.x, a.y);
}
function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function closestPointsOnSegments(p1: Point, q1: Point, p2: Point, q2: Point): { pa: Point; pb: Point; ta: number; tb: number; distance: number } {
  // Adaptación 2D del algoritmo de Real-Time Collision Detection (Christer Ericson).
  const d1 = subtract(q1, p1);
  const d2 = subtract(q2, p2);
  const r = subtract(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  let s = 0;
  let t = 0;

  if (a <= EPS && e <= EPS) {
    return { pa: p1, pb: p2, ta: 0, tb: 0, distance: distance(p1, p2) };
  }
  if (a <= EPS) {
    s = 0;
    t = clamp(f / e, 0, 1);
  } else {
    const c = dot(d1, r);
    if (e <= EPS) {
      t = 0;
      s = clamp(-c / a, 0, 1);
    } else {
      const b = dot(d1, d2);
      const denominator = a * e - b * b;
      if (Math.abs(denominator) > EPS) s = clamp((b * f - c * e) / denominator, 0, 1);
      else s = 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }

  const pa = add(p1, multiply(d1, s));
  const pb = add(p2, multiply(d2, t));
  return { pa, pb, ta: s, tb: t, distance: distance(pa, pb) };
}

function closestPointOnContour(point: Point, contour: Contour): Location {
  let best: Location | undefined;
  let bestDistance = Infinity;
  for (let i = 0; i < contour.points.length; i += 1) {
    const a = contour.points[i];
    const b = contour.points[(i + 1) % contour.points.length];
    const ab = subtract(b, a);
    const t = dot(subtract(point, a), ab) / Math.max(EPS, dot(ab, ab));
    const clampedT = clamp(t, 0, 1);
    const candidate = lerp(a, b, clampedT);
    const candidateDistance = distance(point, candidate);
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      best = normalizeLocation({ contourId: contour.id, segmentIndex: i, t: clampedT, point: candidate }, contour);
    }
  }
  if (!best) throw new Error(`No se pudo localizar un punto sobre ${contour.id}`);
  return best;
}

function normalizeLocation(location: Location, contour: Contour): Location {
  let segmentIndex = location.segmentIndex;
  let t = location.t;
  let point = location.point;
  if (t >= 1 - LOCATION_EPS) {
    segmentIndex = (segmentIndex + 1) % contour.points.length;
    t = 0;
    point = contour.points[segmentIndex];
  } else if (t <= LOCATION_EPS) {
    t = 0;
    point = contour.points[segmentIndex];
  }
  return { ...location, segmentIndex, t, point };
}

function orientation(a: Point, b: Point, c: Point): number {
  return cross(subtract(b, a), subtract(c, a));
}

function segmentIntersection(a: Point, b: Point, c: Point, d: Point, tolerance = 1e-7): { intersects: boolean; point?: Point; proper: boolean } {
  const r = subtract(b, a);
  const s = subtract(d, c);
  const denominator = cross(r, s);
  const cma = subtract(c, a);
  const numeratorT = cross(cma, s);
  const numeratorU = cross(cma, r);

  if (Math.abs(denominator) <= tolerance) {
    if (Math.abs(cross(cma, r)) > tolerance) return { intersects: false, proper: false };
    const rr = dot(r, r);
    if (rr <= tolerance) return { intersects: distance(a, c) <= tolerance, point: a, proper: false };
    const t0 = dot(subtract(c, a), r) / rr;
    const t1 = dot(subtract(d, a), r) / rr;
    const minT = Math.max(0, Math.min(t0, t1));
    const maxT = Math.min(1, Math.max(t0, t1));
    if (maxT < minT - tolerance) return { intersects: false, proper: false };
    return { intersects: true, point: lerp(a, b, clamp(minT, 0, 1)), proper: maxT - minT > tolerance };
  }

  const t = numeratorT / denominator;
  const u = numeratorU / denominator;
  if (t < -tolerance || t > 1 + tolerance || u < -tolerance || u > 1 + tolerance) {
    return { intersects: false, proper: false };
  }
  const point = lerp(a, b, clamp(t, 0, 1));
  const proper = t > tolerance && t < 1 - tolerance && u > tolerance && u < 1 - tolerance;
  return { intersects: true, point, proper };
}

function pointEquals(a: Point, b: Point, tolerance = 1e-4): boolean {
  return distance(a, b) <= tolerance;
}

function pointInsidePieceMaterial(point: Point, piece: Piece): boolean {
  let count = 0;
  for (const contour of piece.contours) {
    if (pointInPolygon(point, contour.points, false)) count += 1;
  }
  return count % 2 === 1;
}

function segmentIntersectsContours(
  start: Point,
  end: Point,
  parsed: ParsedSvg,
  allowedEndpoints: Array<{ contourId: string; point: Point }>,
): boolean {
  for (const contour of parsed.contours) {
    for (let i = 0; i < contour.points.length; i += 1) {
      const a = contour.points[i];
      const b = contour.points[(i + 1) % contour.points.length];
      const hit = segmentIntersection(start, end, a, b);
      if (!hit.intersects) continue;
      const allowed = allowedEndpoints.some(
        (endpoint) => endpoint.contourId === contour.id && hit.point && pointEquals(hit.point, endpoint.point),
      );
      if (!allowed) return true;
      if (hit.proper && !allowed) return true;
    }
  }
  return false;
}

function validateExternalBridge(candidate: Candidate, parsed: ParsedSvg): boolean {
  if (!candidate.a || !candidate.b) return false;
  const start = candidate.a.point;
  const end = candidate.b.point;
  if (candidate.length <= EPS) return false;
  if (segmentIntersectsContours(start, end, parsed, [
    { contourId: candidate.a.contourId, point: start },
    { contourId: candidate.b.contourId, point: end },
  ])) return false;

  const sampleCount = Math.max(12, Math.ceil(candidate.length / 2));
  for (let i = 1; i < sampleCount; i += 1) {
    const t = i / sampleCount;
    if (t < 0.01 || t > 0.99) continue;
    const point = lerp(start, end, t);
    for (const piece of parsed.pieces) {
      if (pointInsidePieceMaterial(point, piece)) return false;
    }
  }
  return true;
}

function validateOriginBridge(candidate: Candidate, parsed: ParsedSvg): boolean {
  if (!candidate.originPoint || !candidate.b) return false;
  const start = candidate.originPoint;
  const end = candidate.b.point;
  const pseudo: Candidate = {
    ...candidate,
    a: { contourId: "__origin__", segmentIndex: 0, t: 0, point: start },
  };
  if (segmentIntersectsContours(start, end, parsed, [{ contourId: candidate.b.contourId, point: end }])) return false;
  const sampleCount = Math.max(12, Math.ceil(candidate.length / 2));
  for (let i = 1; i < sampleCount; i += 1) {
    const t = i / sampleCount;
    if (t > 0.99) continue;
    const point = lerp(start, end, t);
    for (const piece of parsed.pieces) if (pointInsidePieceMaterial(point, piece)) return false;
  }
  return validatePointInsidePlate(start, parsed) && validatePointInsidePlate(end, parsed) && pseudo.length > EPS;
}

function validateInternalBridge(candidate: Candidate, parsed: ParsedSvg, ownerPiece: Piece): boolean {
  if (!candidate.a || !candidate.b) return false;
  const start = candidate.a.point;
  const end = candidate.b.point;
  if (segmentIntersectsContours(start, end, parsed, [
    { contourId: candidate.a.contourId, point: start },
    { contourId: candidate.b.contourId, point: end },
  ])) return false;

  const parentContour = ownerPiece.contours.find((contour) => contour.id === candidate.a!.contourId);
  if (!parentContour) return false;
  // Entre un contorno exterior/isla y su hijo hay material; entre un hueco y una isla hay vacío.
  const expectedMaterial = parentContour.depth % 2 === 0;
  const sampleCount = Math.max(12, Math.ceil(candidate.length / 1.5));
  for (let i = 1; i < sampleCount; i += 1) {
    const t = i / sampleCount;
    if (t < 0.01 || t > 0.99) continue;
    const point = lerp(start, end, t);
    if (pointInsidePieceMaterial(point, ownerPiece) !== expectedMaterial) return false;
  }
  return true;
}

function validatePointInsidePlate(point: Point, parsed: ParsedSvg): boolean {
  return point.x >= -EPS && point.y >= -EPS && point.x <= parsed.widthMm + EPS && point.y <= parsed.heightMm + EPS;
}

function locationsKey(a: Location, b: Location): string {
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return `${a.contourId}:${a.segmentIndex}:${round(a.t)}|${b.contourId}:${b.segmentIndex}:${round(b.t)}`;
}

function generateContourPairCandidates(
  contourA: Contour,
  contourB: Contour,
  kind: BridgeKind,
  parsed: ParsedSvg,
  ownerPiece?: Piece,
  limit = 5,
): Candidate[] {
  const raw: Candidate[] = [];
  const retainedCandidates = 6000;
  const prune = (): void => {
    if (raw.length <= retainedCandidates * 2) return;
    raw.sort((a, b) => a.score - b.score);
    raw.length = retainedCandidates;
  };
  for (let i = 0; i < contourA.points.length; i += 1) {
    const a1 = contourA.points[i];
    const a2 = contourA.points[(i + 1) % contourA.points.length];
    for (let j = 0; j < contourB.points.length; j += 1) {
      const b1 = contourB.points[j];
      const b2 = contourB.points[(j + 1) % contourB.points.length];
      const closest = closestPointsOnSegments(a1, a2, b1, b2);
      if (closest.distance <= EPS) continue;
      const locA = normalizeLocation(
        { contourId: contourA.id, segmentIndex: i, t: closest.ta, point: closest.pa },
        contourA,
      );
      const locB = normalizeLocation(
        { contourId: contourB.id, segmentIndex: j, t: closest.tb, point: closest.pb },
        contourB,
      );
      raw.push({
        id: `candidate-${kind}-${contourA.id}-${contourB.id}-${i}-${j}`,
        kind,
        aNodeId: contourA.id,
        bNodeId: contourB.id,
        a: locA,
        b: locB,
        length: closest.distance,
        score: closest.distance,
      });
      prune();
    }
  }

  raw.sort((a, b) => a.score - b.score);
  const result: Candidate[] = [];
  const seen = new Set<string>();
  const scanLimit = Math.min(raw.length, 5000);
  for (let i = 0; i < scanLimit && result.length < limit; i += 1) {
    const candidate = raw[i];
    if (!candidate.a || !candidate.b) continue;
    const key = locationsKey(candidate.a, candidate.b);
    if (seen.has(key)) continue;
    seen.add(key);
    const valid =
      kind === "internal"
        ? ownerPiece !== undefined && validateInternalBridge(candidate, parsed, ownerPiece)
        : validateExternalBridge(candidate, parsed);
    if (valid) result.push(candidate);
  }
  return result;
}

function generateOriginCandidates(origin: Point, contour: Contour, parsed: ParsedSvg, limit = 5): Candidate[] {
  const raw: Candidate[] = [];
  for (let i = 0; i < contour.points.length; i += 1) {
    const a = contour.points[i];
    const b = contour.points[(i + 1) % contour.points.length];
    const ab = subtract(b, a);
    const t = clamp(dot(subtract(origin, a), ab) / Math.max(EPS, dot(ab, ab)), 0, 1);
    const point = lerp(a, b, t);
    const location = normalizeLocation({ contourId: contour.id, segmentIndex: i, t, point }, contour);
    raw.push({
      id: `candidate-origin-${contour.id}-${i}`,
      kind: "origin",
      aNodeId: "__origin__",
      bNodeId: contour.id,
      b: location,
      originPoint: origin,
      length: distance(origin, point),
      score: distance(origin, point),
    });
  }
  raw.sort((a, b) => a.score - b.score);
  const result: Candidate[] = [];
  const seen = new Set<string>();
  for (const candidate of raw) {
    if (result.length >= limit) break;
    if (!candidate.b) continue;
    const key = `${candidate.b.contourId}:${candidate.b.segmentIndex}:${Math.round(candidate.b.t * 1000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (validateOriginBridge(candidate, parsed)) result.push(candidate);
  }
  return result;
}

class UnionFind {
  private readonly parent = new Map<string, string>();
  private readonly rank = new Map<string, number>();

  constructor(nodes: string[]) {
    for (const node of nodes) {
      this.parent.set(node, node);
      this.rank.set(node, 0);
    }
  }

  find(node: string): string {
    const parent = this.parent.get(node);
    if (parent === undefined) throw new Error(`Nodo desconocido: ${node}`);
    if (parent !== node) this.parent.set(node, this.find(parent));
    return this.parent.get(node)!;
  }

  union(a: string, b: string): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;
    const rankA = this.rank.get(rootA) ?? 0;
    const rankB = this.rank.get(rootB) ?? 0;
    if (rankA < rankB) this.parent.set(rootA, rootB);
    else if (rankA > rankB) this.parent.set(rootB, rootA);
    else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
    return true;
  }
}

function bridgesCross(a: Bridge, b: Bridge): boolean {
  const aStart = a.originPoint ?? a.a?.point;
  const aEnd = a.b?.point;
  const bStart = b.originPoint ?? b.a?.point;
  const bEnd = b.b?.point;
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  const hit = segmentIntersection(aStart, aEnd, bStart, bEnd);
  if (!hit.intersects || !hit.point) return false;
  const sharedEndpoint =
    pointEquals(hit.point, aStart) || pointEquals(hit.point, aEnd) || pointEquals(hit.point, bStart) || pointEquals(hit.point, bEnd);
  return hit.proper || !sharedEndpoint;
}

/**
 * El Kruskal voraz alcanza para nestings compactos, pero puede encerrarse en
 * una composición original con piezas separadas: un puente corto elegido al
 * principio puede cruzar el único puente visible que queda para otra isla.
 * Esta búsqueda acotada se usa sólo como recuperación y elige primero el
 * componente con menos salidas posibles para evitar explorar combinaciones
 * irrelevantes.
 */
function searchExternalTree(
  nodes: string[],
  originBridge: Bridge,
  pairCandidates: Candidate[],
  blockedBridges: Bridge[],
  maxAttempts = 100_000,
): Bridge[] | undefined {
  const selected: Bridge[] = [originBridge];
  let attempts = 0;

  const visit = (): Bridge[] | undefined => {
    if (selected.length === nodes.length - 1) return [...selected];
    if (attempts >= maxAttempts) return undefined;

    const uf = new UnionFind(nodes);
    for (const bridge of selected) uf.union(bridge.aNodeId, bridge.bNodeId);

    const eligible = pairCandidates.filter((candidate) => {
      if (uf.find(candidate.aNodeId) === uf.find(candidate.bNodeId)) return false;
      if (blockedBridges.some((bridge) => bridgesCross(candidate, bridge))) return false;
      return !selected.some((bridge) => bridgesCross(candidate, bridge));
    });
    if (eligible.length === 0) return undefined;

    const components = new Set(nodes.map((node) => uf.find(node)));
    let constrainedComponent: string | undefined;
    let constrainedCount = Number.POSITIVE_INFINITY;
    for (const component of components) {
      const count = eligible.reduce(
        (sum, candidate) =>
          sum +
          (uf.find(candidate.aNodeId) === component ||
          uf.find(candidate.bNodeId) === component
            ? 1
            : 0),
        0,
      );
      if (count === 0) return undefined;
      if (count < constrainedCount) {
        constrainedComponent = component;
        constrainedCount = count;
      }
    }

    const next = eligible
      .filter(
        (candidate) =>
          uf.find(candidate.aNodeId) === constrainedComponent ||
          uf.find(candidate.bNodeId) === constrainedComponent,
      )
      .sort((a, b) => a.score - b.score);

    for (const candidate of next) {
      attempts += 1;
      selected.push({ ...candidate, id: `bridge-external-${selected.length}` });
      const result = visit();
      if (result) return result;
      selected.pop();
      if (attempts >= maxAttempts) break;
    }
    return undefined;
  };

  return visit();
}

function selectExternalMst(parsed: ParsedSvg, origin: Point, blockedBridges: Bridge[] = []): Bridge[] {
  const roots = parsed.contours.filter((contour) => contour.parentContourId === undefined);
  if (roots.length === 0) throw new Error("No se encontraron contornos exteriores para vincular");
  const nodes = ["__origin__", ...roots.map((contour) => contour.id)];

  const originCandidates = roots
    // Una composición conservada suele dejar las piezas más separadas que un
    // nesting optimizado. Retener más alternativas evita que una conexión
    // local barata bloquee después el único puente visible hacia otra pieza.
    .flatMap((root) => generateOriginCandidates(origin, root, parsed, 24))
    .filter((candidate) => !blockedBridges.some((bridge) => bridgesCross(candidate, bridge)))
    .sort((a, b) => a.score - b.score)
    .slice(0, 32);

  const pairCandidates: Candidate[] = [];
  for (let i = 0; i < roots.length; i += 1) {
    for (let j = i + 1; j < roots.length; j += 1) {
      pairCandidates.push(...generateContourPairCandidates(roots[i], roots[j], "external", parsed, undefined, 24));
    }
  }
  pairCandidates.sort((a, b) => a.score - b.score);

  let best: { bridges: Bridge[]; score: number } | undefined;
  for (const originCandidate of originCandidates) {
    const uf = new UnionFind(nodes);
    uf.union(originCandidate.aNodeId, originCandidate.bNodeId);
    const selected: Bridge[] = [{ ...originCandidate, id: "bridge-origin-1" }];
    let totalScore = originCandidate.score;

    for (const candidate of pairCandidates) {
      if (selected.length === nodes.length - 1) break;
      if (uf.find(candidate.aNodeId) === uf.find(candidate.bNodeId)) continue;
      if (blockedBridges.some((bridge) => bridgesCross(candidate, bridge))) continue;
      if (selected.some((bridge) => bridgesCross(candidate, bridge))) continue;
      uf.union(candidate.aNodeId, candidate.bNodeId);
      selected.push({ ...candidate, id: `bridge-external-${selected.length}` });
      totalScore += candidate.score;
    }

    if (selected.length !== nodes.length - 1) continue;
    if (!best || totalScore < best.score) best = { bridges: selected, score: totalScore };
  }

  if (!best) {
    for (const originCandidate of originCandidates) {
      const recovered = searchExternalTree(
        nodes,
        { ...originCandidate, id: "bridge-origin-1" },
        pairCandidates,
        blockedBridges,
      );
      if (recovered) {
        return recovered.map((bridge, index) => ({
          ...bridge,
          id: index === 0 ? "bridge-origin-1" : `bridge-external-${index}`,
        }));
      }
    }
    throw new Error(
      "No se pudo conectar todo el nesting al origen inferior sin atravesar piezas ni uniones internas. " +
      "Revise el nesting o habilite una corrección manual de vínculos.",
    );
  }
  return best.bridges;
}

function selectInternalBridges(parsed: ParsedSvg): Bridge[] {
  const selected: Bridge[] = [];
  const contourById = new Map(parsed.contours.map((contour) => [contour.id, contour]));
  const pieceById = new Map(parsed.pieces.map((piece) => [piece.id, piece]));

  for (const contour of parsed.contours) {
    if (!contour.parentContourId) continue;
    const parent = contourById.get(contour.parentContourId);
    const ownerPiece = pieceById.get(contour.pieceId);
    if (!parent || !ownerPiece) throw new Error(`Jerarquía inválida para ${contour.id}`);
    const candidates = generateContourPairCandidates(parent, contour, "internal", parsed, ownerPiece, 10);
    const chosen = candidates.find((candidate) => !selected.some((bridge) => bridgesCross(candidate, bridge)));
    if (!chosen) throw new Error(`No se encontró una unión interna válida entre ${parent.id} y ${contour.id}`);
    selected.push({ ...chosen, id: `bridge-internal-${selected.length + 1}` });
  }
  return selected;
}

function attachmentForBridgeEnd(bridge: Bridge, side: "a" | "b"): Attachment | undefined {
  const location = side === "a" ? bridge.a : bridge.b;
  if (!location) return undefined;
  return {
    id: `${bridge.id}:${side}`,
    bridgeId: bridge.id,
    contourId: location.contourId,
    segmentIndex: location.segmentIndex,
    t: location.t,
    point: location.point,
  };
}

function buildOrderedContours(parsed: ParsedSvg, bridges: Bridge[]): { ordered: Map<string, OrderedContour>; attachments: Map<string, Attachment> } {
  const attachments = new Map<string, Attachment>();
  const byContour = new Map<string, Attachment[]>();
  for (const bridge of bridges) {
    for (const side of ["a", "b"] as const) {
      const attachment = attachmentForBridgeEnd(bridge, side);
      if (!attachment) continue;
      attachments.set(attachment.id, attachment);
      const group = byContour.get(attachment.contourId) ?? [];
      group.push(attachment);
      byContour.set(attachment.contourId, group);
    }
  }

  const ordered = new Map<string, OrderedContour>();
  for (const contour of parsed.contours) {
    const contourAttachments = byContour.get(contour.id) ?? [];
    const normalizedGroups = new Map<number, Attachment[]>();
    for (const attachment of contourAttachments) {
      const group = normalizedGroups.get(attachment.segmentIndex) ?? [];
      group.push(attachment);
      normalizedGroups.set(attachment.segmentIndex, group);
    }
    for (const group of normalizedGroups.values()) group.sort((a, b) => a.t - b.t);

    const points: Point[] = [];
    const attachmentIdsAtVertex = new Map<number, string[]>();
    const attachmentVertexIndex = new Map<string, number>();
    const originalVertexIndexBySegment = new Map<number, number>();

    const addVertex = (point: Point): number => {
      if (points.length > 0 && pointEquals(points[points.length - 1], point, 1e-6)) return points.length - 1;
      points.push(point);
      return points.length - 1;
    };
    const attach = (attachment: Attachment, vertexIndex: number): void => {
      attachmentVertexIndex.set(attachment.id, vertexIndex);
      const ids = attachmentIdsAtVertex.get(vertexIndex) ?? [];
      ids.push(attachment.id);
      attachmentIdsAtVertex.set(vertexIndex, ids);
    };

    for (let segmentIndex = 0; segmentIndex < contour.points.length; segmentIndex += 1) {
      const start = contour.points[segmentIndex];
      const startIndex = addVertex(start);
      originalVertexIndexBySegment.set(segmentIndex, startIndex);
      const segmentAttachments = normalizedGroups.get(segmentIndex) ?? [];
      for (const attachment of segmentAttachments) {
        if (attachment.t <= LOCATION_EPS) attach(attachment, startIndex);
        else {
          const index = addVertex(attachment.point);
          attach(attachment, index);
        }
      }
    }

    // Las ubicaciones normalizadas con t=0 ya quedaron en el vértice del segmento correspondiente.
    // Fusionar un eventual último punto igual al primero.
    if (points.length > 1 && pointEquals(points[points.length - 1], points[0], 1e-6)) {
      const last = points.length - 1;
      const firstIds = attachmentIdsAtVertex.get(0) ?? [];
      const lastIds = attachmentIdsAtVertex.get(last) ?? [];
      attachmentIdsAtVertex.set(0, [...firstIds, ...lastIds]);
      for (const attachmentId of lastIds) attachmentVertexIndex.set(attachmentId, 0);
      points.pop();
      attachmentIdsAtVertex.delete(last);
    }

    ordered.set(contour.id, { contour, points, attachmentIdsAtVertex, attachmentVertexIndex });
  }
  return { ordered, attachments };
}

type TreeEdge = { bridge: Bridge; otherNodeId: string; selfAttachmentId?: string; otherAttachmentId?: string };
type RootedTreeNode = {
  nodeId: string;
  parentNodeId?: string;
  parentBridge?: Bridge;
  parentAttachmentId?: string;
  children: Array<{ childNodeId: string; bridge: Bridge; selfAttachmentId?: string; childAttachmentId?: string }>;
};

function bridgeAttachmentIds(bridge: Bridge, nodeId: string): { selfAttachmentId?: string; otherAttachmentId?: string; otherNodeId: string } {
  if (bridge.aNodeId === nodeId) {
    return {
      selfAttachmentId: bridge.a ? `${bridge.id}:a` : undefined,
      otherAttachmentId: bridge.b ? `${bridge.id}:b` : undefined,
      otherNodeId: bridge.bNodeId,
    };
  }
  if (bridge.bNodeId === nodeId) {
    return {
      selfAttachmentId: bridge.b ? `${bridge.id}:b` : undefined,
      otherAttachmentId: bridge.a ? `${bridge.id}:a` : undefined,
      otherNodeId: bridge.aNodeId,
    };
  }
  throw new Error(`El puente ${bridge.id} no toca el nodo ${nodeId}`);
}

function rootBridgeTree(bridges: Bridge[]): Map<string, RootedTreeNode> {
  const adjacency = new Map<string, TreeEdge[]>();
  const ensure = (nodeId: string): TreeEdge[] => {
    const existing = adjacency.get(nodeId);
    if (existing) return existing;
    const created: TreeEdge[] = [];
    adjacency.set(nodeId, created);
    return created;
  };

  for (const bridge of bridges) {
    const aIds = bridgeAttachmentIds(bridge, bridge.aNodeId);
    const bIds = bridgeAttachmentIds(bridge, bridge.bNodeId);
    ensure(bridge.aNodeId).push({
      bridge,
      otherNodeId: bridge.bNodeId,
      selfAttachmentId: aIds.selfAttachmentId,
      otherAttachmentId: aIds.otherAttachmentId,
    });
    ensure(bridge.bNodeId).push({
      bridge,
      otherNodeId: bridge.aNodeId,
      selfAttachmentId: bIds.selfAttachmentId,
      otherAttachmentId: bIds.otherAttachmentId,
    });
  }

  const rooted = new Map<string, RootedTreeNode>();
  const queue = ["__origin__"];
  rooted.set("__origin__", { nodeId: "__origin__", children: [] });
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = rooted.get(nodeId)!;
    for (const edge of adjacency.get(nodeId) ?? []) {
      if (edge.otherNodeId === node.parentNodeId) continue;
      if (rooted.has(edge.otherNodeId)) throw new Error("La red de uniones contiene un ciclo inesperado");
      const childInfo = bridgeAttachmentIds(edge.bridge, edge.otherNodeId);
      rooted.set(edge.otherNodeId, {
        nodeId: edge.otherNodeId,
        parentNodeId: nodeId,
        parentBridge: edge.bridge,
        parentAttachmentId: childInfo.selfAttachmentId,
        children: [],
      });
      node.children.push({
        childNodeId: edge.otherNodeId,
        bridge: edge.bridge,
        selfAttachmentId: edge.selfAttachmentId,
        childAttachmentId: edge.otherAttachmentId,
      });
      queue.push(edge.otherNodeId);
    }
  }

  if (rooted.size !== new Set(bridges.flatMap((bridge) => [bridge.aNodeId, bridge.bNodeId])).size) {
    throw new Error("La red de uniones no quedó totalmente conectada al origen");
  }
  return rooted;
}

function childPriority(child: RootedTreeNode["children"][number], contourById: Map<string, Contour>): number {
  const target = contourById.get(child.childNodeId);
  if (!target) return 10;
  if (target.role === "hole") return 0;
  if (target.role === "island") return 1;
  return 5;
}

function chooseContourDirection(
  ordered: OrderedContour,
  entryVertex: number,
  childEvents: Map<number, RootedTreeNode["children"]>,
  contourById: Map<string, Contour>,
): 1 | -1 {
  if (childEvents.size === 0) return ordered.contour.signedArea >= 0 ? 1 : -1;
  const n = ordered.points.length;
  const scoreDirection = (direction: 1 | -1): number => {
    let score = 0;
    let step = 0;
    for (let index = entryVertex; step < n; index = (index + direction + n) % n, step += 1) {
      for (const child of childEvents.get(index) ?? []) {
        const priority = childPriority(child, contourById);
        score += (priority + 1) * step;
      }
    }
    return score;
  };
  return scoreDirection(1) <= scoreDirection(-1) ? 1 : -1;
}

function buildRoute(
  parsed: ParsedSvg,
  bridges: Bridge[],
  origin: Point,
  orderedMap: Map<string, OrderedContour>,
): RoutePoint[] {
  const rooted = rootBridgeTree(bridges);
  const contourById = new Map(parsed.contours.map((contour) => [contour.id, contour]));
  const route: RoutePoint[] = [{ ...origin, via: "origin" }];

  const append = (point: Point, via: RouteSegmentType, extra: Partial<RoutePoint> = {}): void => {
    const previous = route[route.length - 1];
    if (pointEquals(previous, point, 1e-8)) return;
    route.push({ ...point, via, ...extra });
  };

  const walkContour = (nodeId: string, entryAttachmentId: string): void => {
    const treeNode = rooted.get(nodeId);
    const ordered = orderedMap.get(nodeId);
    if (!treeNode || !ordered) throw new Error(`No se pudo recorrer el contorno ${nodeId}`);
    const entryVertex = ordered.attachmentVertexIndex.get(entryAttachmentId);
    if (entryVertex === undefined) throw new Error(`No se encontró el punto de entrada ${entryAttachmentId}`);

    const childEvents = new Map<number, RootedTreeNode["children"]>();
    for (const child of treeNode.children) {
      if (!child.selfAttachmentId) throw new Error(`El hijo ${child.childNodeId} no tiene anclaje sobre ${nodeId}`);
      const vertexIndex = ordered.attachmentVertexIndex.get(child.selfAttachmentId);
      if (vertexIndex === undefined) throw new Error(`No se encontró el anclaje ${child.selfAttachmentId}`);
      const group = childEvents.get(vertexIndex) ?? [];
      group.push(child);
      childEvents.set(vertexIndex, group);
    }
    for (const group of childEvents.values()) {
      group.sort((a, b) => {
        const pa = childPriority(a, contourById);
        const pb = childPriority(b, contourById);
        return pa - pb || a.bridge.length - b.bridge.length;
      });
    }

    const visitChildren = (vertexIndex: number): void => {
      const children = childEvents.get(vertexIndex) ?? [];
      for (const child of children) {
        if (!child.childAttachmentId) throw new Error(`El puente ${child.bridge.id} no tiene anclaje hijo`);
        const childOrdered = orderedMap.get(child.childNodeId);
        if (!childOrdered) throw new Error(`No se encontró el contorno hijo ${child.childNodeId}`);
        const childVertexIndex = childOrdered.attachmentVertexIndex.get(child.childAttachmentId);
        if (childVertexIndex === undefined) throw new Error(`No se encontró el anclaje hijo ${child.childAttachmentId}`);
        const childPoint = childOrdered.points[childVertexIndex];
        append(childPoint, "bridge", { bridgeId: child.bridge.id });
        walkContour(child.childNodeId, child.childAttachmentId);
        append(ordered.points[vertexIndex], "bridge", { bridgeId: child.bridge.id });
      }
    };

    const direction = chooseContourDirection(ordered, entryVertex, childEvents, contourById);
    visitChildren(entryVertex);
    let current = entryVertex;
    for (let step = 0; step < ordered.points.length; step += 1) {
      const next = (current + direction + ordered.points.length) % ordered.points.length;
      append(ordered.points[next], "contour", { contourId: nodeId });
      current = next;
      if (current !== entryVertex) visitChildren(current);
    }
  };

  const originNode = rooted.get("__origin__");
  if (!originNode) throw new Error("No existe el nodo de origen");
  const originChildren = [...originNode.children].sort((a, b) => a.bridge.length - b.bridge.length);
  for (const child of originChildren) {
    if (!child.childAttachmentId) throw new Error(`El puente ${child.bridge.id} no tiene destino`);
    const ordered = orderedMap.get(child.childNodeId);
    if (!ordered) throw new Error(`No se encontró ${child.childNodeId}`);
    const entryIndex = ordered.attachmentVertexIndex.get(child.childAttachmentId);
    if (entryIndex === undefined) throw new Error(`No se encontró ${child.childAttachmentId}`);
    append(ordered.points[entryIndex], "bridge", { bridgeId: child.bridge.id });
    walkContour(child.childNodeId, child.childAttachmentId);
    append(origin, "bridge", { bridgeId: child.bridge.id });
  }

  return route;
}

function routeLength(route: RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i += 1) total += distance(route[i - 1], route[i]);
  return total;
}

function computeMetrics(parsed: ParsedSvg, bridges: Bridge[], route: RoutePoint[], feedRate: number): Metrics {
  const contourLengthMm = parsed.contours.reduce((sum, contour) => sum + contour.perimeter, 0);
  const bridgeOneWayLengthMm = bridges.reduce((sum, bridge) => sum + bridge.length, 0);
  const totalLengthMm = routeLength(route);
  return {
    contourLengthMm,
    bridgeOneWayLengthMm,
    bridgeTravelLengthMm: bridgeOneWayLengthMm * 2,
    totalLengthMm,
    estimatedSeconds: (totalLengthMm / feedRate) * 60,
    contourCount: parsed.contours.length,
    pieceCount: parsed.pieces.length,
    bridgeCount: bridges.length,
  };
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatPoint(point: Point, decimals = 3): string {
  return `${point.x.toFixed(decimals)},${point.y.toFixed(decimals)}`;
}

function makeLinkedSvg(
  parsed: ParsedSvg,
  bridges: Bridge[],
  routeSvg: RoutePoint[],
  originSvg: Point,
  metrics: Metrics,
  profile: MachineProfile,
): string {
  const originalPaths = parsed.contours
    .map((contour) => {
      const d = contour.points
        .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(3)} ${point.y.toFixed(3)}`)
        .join(" ") + " Z";
      const dash = contour.role === "hole" ? ' stroke-dasharray="2 1"' : "";
      return `<path id="${escapeXml(contour.id)}" data-piece-id="${escapeXml(contour.pieceId)}" d="${d}" fill="none" stroke="#111" stroke-width="0.7"${dash}/>`;
    })
    .join("\n    ");

  const bridgeLines = bridges
    .map((bridge, index) => {
      const start = bridge.originPoint ?? bridge.a?.point;
      const end = bridge.b?.point;
      if (!start || !end) return "";
      const color = bridge.kind === "internal" ? "#8b5cf6" : bridge.kind === "origin" ? "#2563eb" : "#16a34a";
      return `<g data-bridge-id="${escapeXml(bridge.id)}" data-bridge-kind="${bridge.kind}">
        <line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
        <circle cx="${end.x}" cy="${end.y}" r="2.3" fill="#ef4444" vector-effect="non-scaling-stroke"/>
        ${bridge.a ? `<circle cx="${bridge.a.point.x}" cy="${bridge.a.point.y}" r="2.3" fill="#ef4444" vector-effect="non-scaling-stroke"/>` : ""}
        <text x="${(start.x + end.x) / 2 + 2}" y="${(start.y + end.y) / 2 - 2}" font-size="7" fill="${color}">${index + 1}</text>
      </g>`;
    })
    .join("\n    ");

  const routePoints = routeSvg.map((point) => formatPoint(point)).join(" ");
  const legend =
    `Piezas: ${metrics.pieceCount} · contornos: ${metrics.contourCount} · uniones: ${metrics.bridgeCount} · ` +
    `recorrido: ${(metrics.totalLengthMm / 1000).toFixed(2)} m · F${profile.feedRateMmPerMin}`;
  const labelY = originSvg.y > parsed.heightMm - 20 ? originSvg.y - 9 : originSvg.y + 12;
  const labelX = originSvg.x > parsed.widthMm - 90 ? originSvg.x - 80 : originSvg.x + 6;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${parsed.widthMm}mm" height="${parsed.heightMm}mm" viewBox="0 0 ${parsed.widthMm} ${parsed.heightMm}">
  <title>Grafo Hotwire Linker · recorrido vinculado</title>
  <desc>Origen físico inferior izquierdo; el SVG conserva Y hacia abajo y el TAP transforma Y hacia arriba.</desc>
  <rect x="0" y="0" width="${parsed.widthMm}" height="${parsed.heightMm}" fill="#fffdf4" stroke="#d97706" stroke-width="1"/>
  <g id="contours">
    ${originalPaths}
  </g>
  <g id="bridges">
    ${bridgeLines}
  </g>
  <polyline id="full-route" points="${routePoints}" fill="none" stroke="#0ea5e9" stroke-width="0.45" opacity="0.45" vector-effect="non-scaling-stroke"/>
  <circle cx="${originSvg.x}" cy="${originSvg.y}" r="4" fill="#2563eb" stroke="#fff" stroke-width="1" vector-effect="non-scaling-stroke"/>
  <text x="${labelX}" y="${labelY}" font-size="9" fill="#1d4ed8">ORIGEN MÁQUINA X0 Y0</text>
  <g transform="translate(12 ${parsed.heightMm - 17})">
    <rect x="-4" y="-13" width="620" height="18" rx="3" fill="#ffffff" opacity="0.92"/>
    <text x="0" y="0" font-size="9" fill="#111827">${escapeXml(legend)}</text>
  </g>
</svg>`;
}

function makePreviewHtml(
  parsed: ParsedSvg,
  bridges: Bridge[],
  routeSvg: RoutePoint[],
  routeMachine: RoutePoint[],
  metrics: Metrics,
  linkedSvg: string,
  profile: MachineProfile,
  warnings: string[],
): string {
  const routeSvgJson = JSON.stringify(routeSvg);
  const routeMachineJson = JSON.stringify(routeMachine);
  const linkedSvgJson = JSON.stringify(linkedSvg);
  const bridgeJson = JSON.stringify(
    bridges.map((bridge) => ({
      id: bridge.id,
      kind: bridge.kind,
      from: bridge.originPoint ?? bridge.a?.point,
      to: bridge.b?.point,
      length: bridge.length,
      aNodeId: bridge.aNodeId,
      bNodeId: bridge.bNodeId,
    })),
  );
  const warningsHtml = warnings.length
    ? `<div class="warning"><strong>Advertencias</strong><ul>${warnings.map((warning) => `<li>${escapeXml(warning)}</li>`).join("")}</ul></div>`
    : `<div class="ok">✓ Geometría dentro del área útil y recorrido cerrado en X0 Y0.</div>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Grafo Hotwire Linker · simulación</title>
<style>
  :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0f1115; color: #f4f4f5; display: grid; grid-template-columns: minmax(0, 1fr) 370px; min-height: 100vh; }
  main { padding: 20px; display: grid; place-items: center; }
  .stage { width: 100%; max-width: 1200px; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 16px 55px #0008; }
  svg { width: 100%; height: auto; display: block; }
  aside { padding: 22px; background: #171a21; border-left: 1px solid #2a2f3a; overflow: auto; }
  h1 { font-size: 18px; margin: 0 0 6px; }
  .muted { color: #a1a1aa; font-size: 13px; line-height: 1.45; }
  .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 18px 0; }
  button, select { border: 1px solid #353b47; background: #232833; color: #fff; border-radius: 8px; padding: 10px; }
  button { cursor: pointer; font-weight: 700; }
  button.primary { background: #2563eb; border-color: #2563eb; }
  .stat { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #2a2f3a; padding: 9px 0; font-size: 13px; }
  .stat strong { font-variant-numeric: tabular-nums; text-align: right; }
  .legend { margin-top: 18px; font-size: 13px; display: grid; gap: 8px; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 999px; margin-right: 7px; }
  .warning, .ok { margin: 16px 0; border-radius: 9px; padding: 11px; font-size: 12px; line-height: 1.45; }
  .warning { background: #451a1a; border: 1px solid #7f1d1d; }
  .warning ul { margin: 7px 0 0; padding-left: 17px; }
  .ok { background: #052e16; border: 1px solid #166534; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12px; }
  td, th { text-align: left; border-bottom: 1px solid #2a2f3a; padding: 7px 4px; }
  @media (max-width: 900px) { body { grid-template-columns: 1fr; } aside { border-left: 0; border-top: 1px solid #2a2f3a; } }
</style>
</head>
<body>
<main><div class="stage" id="stage"></div></main>
<aside>
  <h1>Simulación de recorrido</h1>
  <div class="muted">Postprocesador calibrado con <strong>andina.tap</strong> de VectorLinker. El primer uso en la máquina debe hacerse en seco, con el hilo apagado.</div>
  ${warningsHtml}
  <div class="controls">
    <button class="primary" id="play">▶ Reproducir</button>
    <button id="reset">↺ Reiniciar</button>
    <label style="grid-column: 1 / -1">Velocidad visual
      <select id="speed" style="width:100%; margin-top:5px">
        <option value="50">0,5×</option><option value="100" selected>1×</option><option value="250">2,5×</option><option value="500">5×</option><option value="1000">10×</option>
      </select>
    </label>
  </div>
  <div class="stat"><span>Progreso</span><strong id="progress">0%</strong></div>
  <div class="stat"><span>Coordenada máquina</span><strong id="coords">X0,000 · Y0,000</strong></div>
  <div class="stat"><span>Distancia</span><strong id="distance">0 mm</strong></div>
  <div class="stat"><span>Recorrido total</span><strong>${metrics.totalLengthMm.toFixed(1)} mm</strong></div>
  <div class="stat"><span>Tiempo a F${profile.feedRateMmPerMin}</span><strong>${formatDuration(metrics.estimatedSeconds)}</strong></div>
  <div class="stat"><span>Área SVG</span><strong>${parsed.widthMm} × ${parsed.heightMm} mm</strong></div>
  <div class="stat"><span>Área útil máquina</span><strong>${profile.bedWidthMm} × ${profile.bedHeightMm} mm</strong></div>
  <div class="stat"><span>Origen</span><strong>${profile.originCorner} · ${profile.originStrategy}</strong></div>
  <div class="legend">
    <div><span class="dot" style="background:#16a34a"></span>Unión entre piezas</div>
    <div><span class="dot" style="background:#8b5cf6"></span>Unión a hueco interior</div>
    <div><span class="dot" style="background:#2563eb"></span>Origen físico X0 Y0</div>
    <div><span class="dot" style="background:#ef4444"></span>Punto de conexión</div>
  </div>
  <table><thead><tr><th>#</th><th>Tipo</th><th>Desde → hasta</th><th>mm</th></tr></thead><tbody id="bridgeRows"></tbody></table>
</aside>
<script>
const routeSvg = ${routeSvgJson};
const routeMachine = ${routeMachineJson};
const bridges = ${bridgeJson};
const stage = document.getElementById('stage');
stage.innerHTML = ${linkedSvgJson};
const svg = stage.querySelector('svg');
const ns = 'http://www.w3.org/2000/svg';
const trail = document.createElementNS(ns, 'polyline');
trail.setAttribute('fill', 'none'); trail.setAttribute('stroke', '#ef4444'); trail.setAttribute('stroke-width', '1.3');
trail.setAttribute('vector-effect', 'non-scaling-stroke'); svg.appendChild(trail);
const head = document.createElementNS(ns, 'circle');
head.setAttribute('r', '4'); head.setAttribute('fill', '#ef4444'); head.setAttribute('stroke', '#fff'); head.setAttribute('stroke-width', '1');
head.setAttribute('vector-effect', 'non-scaling-stroke'); svg.appendChild(head);
document.getElementById('bridgeRows').innerHTML = bridges.map((b, i) => '<tr><td>'+(i+1)+'</td><td>'+b.kind+'</td><td>'+b.aNodeId+' → '+b.bNodeId+'</td><td>'+b.length.toFixed(1)+'</td></tr>').join('');

const cumulative = [0];
for (let i=1;i<routeSvg.length;i++) cumulative.push(cumulative[i-1] + Math.hypot(routeSvg[i].x-routeSvg[i-1].x, routeSvg[i].y-routeSvg[i-1].y));
const total = cumulative[cumulative.length-1];
let traveled = 0, last = 0, playing = false, raf = 0;
const play = document.getElementById('play');
const reset = document.getElementById('reset');
function render() {
  let index = 1;
  while (index < cumulative.length && cumulative[index] < traveled) index++;
  index = Math.min(index, routeSvg.length - 1);
  const previousIndex = Math.max(0,index-1);
  const prev = routeSvg[previousIndex], next = routeSvg[index];
  const prevMachine = routeMachine[previousIndex], nextMachine = routeMachine[index];
  const span = Math.max(1e-9, cumulative[index]-cumulative[previousIndex]);
  const t = Math.max(0, Math.min(1,(traveled-cumulative[previousIndex])/span));
  const x = prev.x + (next.x-prev.x)*t, y = prev.y + (next.y-prev.y)*t;
  const mx = prevMachine.x + (nextMachine.x-prevMachine.x)*t, my = prevMachine.y + (nextMachine.y-prevMachine.y)*t;
  const completed = routeSvg.slice(0,index).map(p=>p.x+','+p.y); completed.push(x+','+y);
  trail.setAttribute('points', completed.join(' ')); head.setAttribute('cx', x); head.setAttribute('cy', y);
  document.getElementById('progress').textContent = total ? ((traveled/total)*100).toFixed(1)+'%' : '100%';
  document.getElementById('coords').textContent = 'X'+mx.toFixed(3)+' · Y'+my.toFixed(3);
  document.getElementById('distance').textContent = traveled.toFixed(1)+' mm';
}
function frame(now) {
  if (!playing) return;
  if (!last) last = now;
  const visualMmPerSecond = Number(document.getElementById('speed').value);
  traveled = Math.min(total, traveled + ((now-last)/1000)*visualMmPerSecond); last = now; render();
  if (traveled >= total) { playing=false; play.textContent='▶ Reproducir'; return; }
  raf=requestAnimationFrame(frame);
}
play.onclick=()=>{ playing=!playing; play.textContent=playing?'❚❚ Pausar':'▶ Reproducir'; last=0; if(playing) raf=requestAnimationFrame(frame); else cancelAnimationFrame(raf); };
reset.onclick=()=>{ playing=false; cancelAnimationFrame(raf); traveled=0; last=0; play.textContent='▶ Reproducir'; render(); };
render();
</script>
</body>
</html>`;
}

function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainder = rounded % 60;
  return hours > 0
    ? `${hours} h ${String(minutes).padStart(2, "0")} min ${String(remainder).padStart(2, "0")} s`
    : `${minutes} min ${String(remainder).padStart(2, "0")} s`;
}

export function makeTap(routeMachine: RoutePoint[], profile: MachineProfile): string {
  if (routeMachine.length < 2) throw new Error("El recorrido está vacío");
  if (!pointEquals(routeMachine[0], { x: 0, y: 0 }, 1e-5)) throw new Error("El TAP debe comenzar en X0 Y0");
  if (!pointEquals(routeMachine[routeMachine.length - 1], { x: 0, y: 0 }, 1e-5)) throw new Error("El TAP debe terminar en X0 Y0");

  const coordinate = (point: Point): string =>
    `X${normalizeNegativeZero(point.x).toFixed(profile.decimals)} Y${normalizeNegativeZero(point.y).toFixed(profile.decimals)}`;
  const lines = [...profile.headerLines];
  lines.push(`${profile.feedCommand}${formatFeed(profile.feedRateMmPerMin)}${profile.trailingSpaceAfterFeed ? " " : ""}`);
  for (let i = 0; i < profile.duplicateInitialOriginLines; i += 1) lines.push(coordinate(routeMachine[0]));
  for (let i = 1; i < routeMachine.length; i += 1) lines.push(coordinate(routeMachine[i]));
  lines.push(...profile.footerLines);

  const eol = profile.lineEnding === "CRLF" ? "\r\n" : "\n";
  return lines.join(eol) + eol.repeat(profile.finalBlankLines + 1);
}

function normalizeNegativeZero(value: number): number {
  return Math.abs(value) < 0.5e-9 ? 0 : value;
}

function formatFeed(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, "").replace(/\.$/, "");
}

function makeReport(
  parsed: ParsedSvg,
  bridges: Bridge[],
  routeSvg: RoutePoint[],
  routeMachine: RoutePoint[],
  metrics: Metrics,
  profile: MachineProfile,
  originSvg: Point,
  sourceName: string,
  warnings: string[],
): HotwireReport {
  const machineBounds = boundsOfPoints(routeMachine);
  return {
    version: "1.0.0",
    status: warnings.length === 0 ? "POSTPROCESSOR_CALIBRATED_DRY_RUN_REQUIRED" : "GENERATED_WITH_WARNINGS",
    source: sourceName,
    svgWorkArea: { widthMm: parsed.widthMm, heightMm: parsed.heightMm, yAxis: "down" },
    machine: {
      profileId: profile.id,
      name: profile.name,
      bedWidthMm: profile.bedWidthMm,
      bedHeightMm: profile.bedHeightMm,
      originCorner: profile.originCorner,
      originStrategy: profile.originStrategy,
      originLeadInMm: profile.originLeadInMm,
      originSvg,
      yAxis: "up",
      feedRateMmPerMin: profile.feedRateMmPerMin,
      decimals: profile.decimals,
      lineEnding: profile.lineEnding,
      headerLines: profile.headerLines,
      footerLines: profile.footerLines,
      calibration: profile.calibration,
    },
    pieces: parsed.pieces.map((piece) => ({ id: piece.id, contourIds: piece.contours.map((contour) => contour.id) })),
    contours: parsed.contours.map((contour) => ({
      id: contour.id,
      pieceId: contour.pieceId,
      role: contour.role,
      depth: contour.depth,
      parentContourId: contour.parentContourId ?? null,
      points: contour.points.length,
      areaMm2: contour.area,
      perimeterMm: contour.perimeter,
      boundsSvg: contour.bounds,
    })),
    bridges: bridges.map((bridge) => ({
      id: bridge.id,
      kind: bridge.kind,
      fromNode: bridge.aNodeId,
      toNode: bridge.bNodeId,
      fromSvg: bridge.originPoint ?? bridge.a?.point,
      toSvg: bridge.b?.point,
      lengthMm: bridge.length,
    })),
    route: {
      svgPointCount: routeSvg.length,
      machinePointCount: routeMachine.length,
      closedSvg: pointEquals(routeSvg[0], routeSvg[routeSvg.length - 1]),
      closedMachine: pointEquals(routeMachine[0], routeMachine[routeMachine.length - 1]),
      startsAtMachineZero: pointEquals(routeMachine[0], { x: 0, y: 0 }),
      endsAtMachineZero: pointEquals(routeMachine[routeMachine.length - 1], { x: 0, y: 0 }),
      machineBounds,
      lengthMm: routeLength(routeMachine),
    },
    metrics,
    warnings: [
      ...warnings,
      "El formato TAP fue calibrado contra un archivo real de VectorLinker, pero el primer uso debe validarse con una corrida en seco y el hilo apagado.",
      "El parser espera paths SVG cerrados y aplanados con M/L/H/V/Z, sin transformaciones.",
    ],
  };
}

export function generateHotwireJob(input: GenerateHotwireInput): HotwireJob {
  const parsed = parseSvg(input.svg);
  const profile = resolveMachineProfile(input.profile);
  if (input.originCorner) profile.originCorner = input.originCorner;
  if (input.strictBounds !== undefined) profile.strictBounds = input.strictBounds;
  if (input.originStrategy) profile.originStrategy = input.originStrategy;
  const originSvg = input.originSvg ?? automaticOriginPoint(parsed, profile);
  if (!validatePointInsidePlate(originSvg, parsed)) throw new Error("El origen geométrico está fuera del área SVG");

  const sourceWarnings = validateSourceGeometry(parsed);
  if (profile.strictBounds && sourceWarnings.length > 0) throw new Error(sourceWarnings.join(" "));

  const internalBridges = selectInternalBridges(parsed);
  const externalBridges = selectExternalMst(parsed, originSvg, internalBridges);
  const bridges = [...externalBridges, ...internalBridges];
  if (bridges.length !== parsed.contours.length) {
    throw new Error(`La red debe contener exactamente ${parsed.contours.length} uniones y generó ${bridges.length}`);
  }

  const { ordered } = buildOrderedContours(parsed, bridges);
  const routeSvg = buildRoute(parsed, bridges, originSvg, ordered);
  const routeMachine = routeToMachine(routeSvg, originSvg, profile.originCorner);
  const machineWarnings = validateMachineRoute(routeMachine, profile, profile.strictBounds);
  const warnings = [...sourceWarnings, ...machineWarnings];
  const metrics = computeMetrics(parsed, bridges, routeMachine, profile.feedRateMmPerMin);
  const linkedSvg = makeLinkedSvg(parsed, bridges, routeSvg, originSvg, metrics, profile);
  const report = makeReport(
    parsed,
    bridges,
    routeSvg,
    routeMachine,
    metrics,
    profile,
    originSvg,
    input.sourceName ?? "nesting.svg",
    warnings,
  );
  const previewHtml = makePreviewHtml(parsed, bridges, routeSvg, routeMachine, metrics, linkedSvg, profile, warnings);
  const tap = makeTap(routeMachine, profile);

  return { parsed, profile, originSvg, bridges, routeSvg, routeMachine, metrics, tap, linkedSvg, previewHtml, report };
}

function loadProfileOverrides(profilePath: string | undefined): Partial<MachineProfile> | undefined {
  if (!profilePath) return undefined;
  const raw = JSON.parse(fs.readFileSync(profilePath, "utf8")) as Partial<MachineProfile>;
  return raw;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  fs.mkdirSync(options.outputDir, { recursive: true });
  const source = fs.readFileSync(options.input, "utf8");
  const profileOverrides = loadProfileOverrides(options.profilePath) ?? {};
  if (options.feedRate !== undefined) profileOverrides.feedRateMmPerMin = options.feedRate;
  if (options.decimals !== undefined) profileOverrides.decimals = options.decimals;
  if (options.allowOutOfBounds) profileOverrides.strictBounds = false;

  const job = generateHotwireJob({
    svg: source,
    sourceName: path.basename(options.input),
    profile: profileOverrides,
    originCorner: options.originCorner,
    originStrategy: options.originStrategy,
    originSvg: options.originSvg,
  });

  const basename = path.basename(options.input, path.extname(options.input));
  const linkedSvgName = `${basename}-linked.svg`;
  const htmlName = `${basename}-preview.html`;
  const tapName = `${basename}.tap`;
  const reportName = `${basename}-report.json`;
  const routeName = `${basename}-route.json`;

  fs.writeFileSync(path.join(options.outputDir, linkedSvgName), job.linkedSvg);
  fs.writeFileSync(path.join(options.outputDir, htmlName), job.previewHtml);
  fs.writeFileSync(path.join(options.outputDir, tapName), job.tap, "ascii");
  fs.writeFileSync(path.join(options.outputDir, reportName), JSON.stringify(job.report, null, 2));
  fs.writeFileSync(
    path.join(options.outputDir, routeName),
    JSON.stringify(
      {
        version: "1.0.0",
        profile: job.profile,
        originSvg: job.originSvg,
        bridges: job.bridges,
        routeSvg: job.routeSvg,
        routeMachine: job.routeMachine,
        metrics: job.metrics,
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        input: options.input,
        outputDir: options.outputDir,
        profile: job.profile.id,
        files: [linkedSvgName, htmlName, tapName, reportName, routeName],
        metrics: job.metrics,
        machineBounds: (job.report.route as { machineBounds?: Bounds } | undefined)?.machineBounds,
        bridges: job.bridges.map((bridge) => ({
          id: bridge.id,
          kind: bridge.kind,
          from: bridge.aNodeId,
          to: bridge.bNodeId,
          lengthMm: Number(bridge.length.toFixed(3)),
        })),
      },
      null,
      2,
    ),
  );
}

const isDirectExecution = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectExecution) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
