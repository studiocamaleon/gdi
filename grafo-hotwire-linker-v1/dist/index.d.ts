export type Point = {
    x: number;
    y: number;
};
export type Bounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};
type Location = {
    contourId: string;
    segmentIndex: number;
    t: number;
    point: Point;
};
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
export declare const CORPOREARTE_POLIFAN_PROFILE: MachineProfile;
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
export declare function parseSvg(svg: string): ParsedSvg;
export declare function originPointForCorner(parsed: ParsedSvg, corner: OriginCorner): Point;
export declare function automaticOriginPoint(parsed: ParsedSvg, profile: MachineProfile): Point;
export declare function svgPointToMachine(point: Point, originSvg: Point, corner: OriginCorner): Point;
export declare function makeTap(routeMachine: RoutePoint[], profile: MachineProfile): string;
export declare function generateHotwireJob(input: GenerateHotwireInput): HotwireJob;
export {};
