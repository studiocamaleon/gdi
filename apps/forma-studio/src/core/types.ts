export type Point = [number, number];
export type Polygon = Point[];
export type Contours = Polygon[];
export type StyleId =
  | "solid-back"
  | "open-back"
  | "double-support"
  | "single-support"
  | "back-fit"
  | "halo"
  | "acrylic-fit"
  | "printed-fit"
  | "perforated"
  | "double-led"
  | "curved"
  | "neon"
  | "organic";
export type Layer =
  "body" | "face" | "back" | "pvc" | "liner" | "pin" | "socket"
  | "boxBody" | "faceA" | "faceB" | "rimA" | "rimB" | "clips"
  | "keys" | "lightRails" | "wallMount" | "seals";
export interface LightboxParameters {
  diameter: number;
  depth: number;
  wall: number;
  sideProfile: "smooth" | Parameters["organicProfile"];
  sideRelief: number;
  sidePeriod: number;
  sideShape: number;
  sideCount: number;
  sideGap: number;
  sideFoot: number;
  sideMargin: number;
  sideReverse: boolean;
  segments: 1 | 4 | 6 | 8 | 12;
  jointClearance: number;
  acrylicA: number;
  acrylicB: number;
  acrylicClearance: number;
  seatWidth: number;
  seatThickness: number;
  rimWidth: number;
  rimThickness: number;
  rimOverlap: number;
  rimSkirtThickness: number;
  rimClearance: number;
  rimClosure: "screws" | "snap";
  snapThickness: number;
  snapWidth: number;
  snapEngagement: number;
  rimScrewHole: number;
  rimPilotHole: number;
  rimScrewDepth: number;
  /** Parámetros del cierre anterior, conservados para abrir proyectos guardados. */
  clipWidth: number;
  clipThickness: number;
  sealThickness: number;
  drainage: boolean;
  /** Sistema LED anterior: se acepta al importar, pero ya no genera soportes. */
  lights: boolean;
  railWidth: number;
  railThickness: number;
  lightRows: number;
  moduleLength: number;
  moduleWidth: number;
  moduleSpacing: number;
  modulePower: number;
  voltage: number;
  mount: boolean;
  mountStyle: "classic" | "straight" | "arch";
  mountShoeThickness: number;
  mountInsertDiameter: number;
  mountInsertDepth: number;
  wallDistance: number;
  /** Medida del soporte doble anterior: sólo compatibilidad de archivos. */
  armSpacing: number;
  armHeight: number;
  armWidth: number;
  plateThickness: number;
  anchorDiameter: number;
  cableDiameter: number;
}
export type FitBaseType =
  | "legacy"
  | "inset"
  | "flush"
  | "rim"
  | "ring-pvc"
  | "double-channel"
  | "pvc-lock";
export interface Parameters {
  base: number;
  wall: number;
  innerWall: number;
  height: number;
  acrylic: number;
  clearance: number;
  ledge: number;
  lip: number;
  lipEnabled: boolean;
  lipHeight: number;
  mirror: boolean;
  doubleHalo: boolean;
  gap: number;
  outerHeight: number;
  backTray: boolean;
  trayWall: number;
  traySheet: number;
  retention: number;
  liner: boolean;
  curve: number;
  neonWidth: number;
  corner: "Round" | "Miter" | "Bevel";
  pvc: number;
  cutClearance: number;
  supportAngle: number;
  flatSupport: boolean;
  borderWidth: number;
  borderThickness: number;
  outerRecess: number;
  innerReduction: number;
  fitBaseHeight: number;
  fitBaseType: FitBaseType;
  fitRimWall: number;
  fitRimHeight: number;
  fitRingWidth: number;
  fitChannelGap: number;
  fitChannelHeight: number;
  fitChannelFloor: number;
  fitLockDepth: number;
  fitLockHeight: number;
  fitLockOffset: number;
  fitWallProfile: "straight" | "bevel" | "curved" | "angular";
  fitProfileDirection: "outward" | "inward";
  fitProfileAngle: number;
  fitProfileTop: number;
  fitProfileBottom: number;
  patternType:
    "circle" | "diamond" | "square" | "hexagon" | "oblong" | "triangle";
  patternSize: number;
  patternLength: number;
  patternSpacing: number;
  patternBorder: number;
  patternMargin: number;
  patternRotation: number;
  patternAngle: number;
  secondInnerWall: number;
  cornerRadius: number;
  trayDepth: number;
  curveAngle: number;
  curveRadius: number;
  curveCenter: number;
  curveSegments: number;
  curveBase: boolean;
  curveBaseThickness: number;
  curveSide: number;
  curveDepth: number;
  curveAdvance: number;
  curveBaseRadius: number;
  curveSeparate: boolean;
  curveFitDepth: number;
  curveFitClearance: number;
  neonOutline: boolean;
  neonPosition: number;
  neonRetention: number;
  neonRetentionHeight: number;
  organicProfile:
    "zigzag" | "belly" | "pedestal" | "waves" | "bumper" | "bubble" | "stack";
  organicAmplitude: number;
  organicPeriod: number;
  organicBelly: number;
  organicExpansion: number;
  organicCurvature: number;
  organicWaveAmplitude: number;
  organicWavePeriod: number;
  organicWaveShape: number;
  organicBumper: number;
  organicFoot: number;
  organicCloseBase: boolean;
  organicBubble: number;
  organicRadius: number;
  organicCount: number;
  organicStackAdvance: number;
  organicStackGap: number;
  organicSlant: number;
  organicAngle: number;
  organicSolid: boolean;
  organicFace: "acrylic" | "printed";
  organicBack: "printed" | "pvc";
  organicFit: "front" | "back";
  organicFaceAdvance: number;
  organicFaceCorner: "straight" | "chamfer" | "round";
  organicFaceRadius: number;
  organicShell: boolean;
  organicShellThickness: number;
  pvcClearance: number;
  organicCapSheet: number;
  organicCapHeight: number;
  organicCapWall: number;
  organicCapClearance: number;
  organicPvcSupport: boolean;
  pinDiameter: number;
  pinHeight: number;
  pinHole: number;
}
export interface Feature {
  id: string;
  type: "hole" | "pin";
  x: number;
  y: number;
  diameter: number;
  width: number;
  height: number;
  radius: number;
  shape: "circle" | "slot";
}
export interface Cut {
  id: string;
  axis: "x" | "y";
  at: number;
  gap: number;
}
export interface Source {
  mode: "text" | "svg";
  text: string;
  font: string;
  height: number;
  spacing: number;
  svg: string;
  fileName: string;
}
export interface JointParameters {
  ball: number;
  clearance: number;
  retention: number;
  chamfer: number;
  flangeLength: number;
  flangeWidth: number;
  flangeHeight: number;
  flangeRadius: number;
  screw: number;
  screwSpacing: number;
  recess: number;
  recessDepth: number;
  centralHole: number;
  notches: boolean;
  notch: number;
  baseDiameter: number;
  baseHeight: number;
  neck: number;
  neckHeight: number;
  fillet: number;
  flatTop: number;
  tipDiameter: number;
  tipAngle: number;
  socketHeight: number;
  socketTop: number;
  socketBottom: number;
  socketScrew: number;
  countersink: number;
  socketFlange: number;
  socketFlangeHeight: number;
  slots: number;
  slotWidth: number;
  slotLength: number;
  fingerThin: number;
  rootRelief: boolean;
  tilt: number;
}
export interface Production {
  bedWidth: number;
  bedHeight: number;
  bedDepth: number;
  gap: number;
  rotate: boolean;
  filament: string;
  density: number;
  priceKg: number;
  gramsHour: number;
  machineHour: number;
  acrylicM2: number;
  pvcM2: number;
  flexiblePriceKg: number;
  flexibleDensity: number;
  waste: number;
  margin: number;
  currency: string;
  company: string;
  contact: string;
  logo: string;
  checklist: string;
}
export interface Project {
  version: 1;
  mode: "letters" | "joint" | "lightbox";
  id: string;
  name: string;
  source: Source;
  style: StyleId;
  params: Parameters;
  styleParameters?: Partial<Record<StyleId, Parameters>>;
  features: Feature[];
  cuts: Cut[];
  joint: JointParameters;
  lightbox: LightboxParameters;
  faceArtwork?: { a: string; b: string };
  production: Production;
  colors: Record<Layer, string>;
  hidden: Layer[];
  updatedAt: string;
}
export interface Part {
  id: string;
  name: string;
  layer: Layer;
  material: "filament" | "acrylic" | "pvc" | "flexible";
  print?: { positions: Float32Array; bounds: Part["bounds"]; contours: Contours };
  motion?: { vector: [number, number, number]; start: number; travel: number };
  snapTabs?: { angles: number[]; width: number; rootZ: number; hookTop: number; depth: number; side: 1 | -1; release: number };
  printFlip?: boolean;
  assemblyDirection?: -1 | 0 | 1;
  positions: Float32Array;
  indices: Uint32Array;
  volume: number;
  surface: number;
  bounds: { min: number[]; max: number[] };
  contours: Contours;
  area: number;
  perimeter: number;
}
export interface Model {
  lightbox?: { ledCount: number; watts: number; voltage: number; lighting: "unconfigured"; mount: { style: LightboxParameters["mountStyle"]; enabled: boolean; separate: boolean; armCount: number; fastening: "inside-inserts"; bodyScrews: { quantity: number; nominal: string; clearanceDiameter: number; headSeatDiameter: number; gripLength: number; lengthToPocketBottom: number; direction: "inside-out"; nuts: number; washers: number }; inserts: { quantity: number; nominal: string; installation: "heat-set"; holeDiameter: number; holeDepth: number; outerWallMin: number }; wallAnchors: number }; sideProfile: { kind: LightboxParameters["sideProfile"]; from: number; to: number; relief: number; maxDiameter: number }; rimClosure: LightboxParameters["rimClosure"]; snapTabsPerFace: number; visibleDiameter: number; assembly: string[]; rimFasteners: { quantity: number; clearanceDiameter: number; pilotDiameter: number; pilotDepth: number; underHeadLengthMax: number } };
  perforation?: { holes: number; openArea: number; frontArea: number };
  frontDirection?: 1 | -1;
  parts: Part[];
  cutTemplates?: { name: string; contours: Contours }[];
  warnings: string[];
  width: number;
  height: number;
  depth: number;
  duration: number;
}
export interface EngineInput {
  project: Project;
  shapes: Contours[];
  mode: "letters" | "joint" | "lightbox";
}
export interface Placement {
  part: Part;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  bed: number;
}
