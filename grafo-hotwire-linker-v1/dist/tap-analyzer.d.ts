export type TapPoint = {
    x: number;
    y: number;
};
export type TapBounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};
export type TapAnalysis = {
    lineEnding: "CRLF" | "LF" | "MIXED_OR_UNKNOWN";
    totalLines: number;
    nonEmptyLines: number;
    headerLines: string[];
    coordinateCount: number;
    zeroLengthMoves: number;
    start: TapPoint | null;
    end: TapPoint | null;
    closed: boolean;
    bounds: TapBounds | null;
    routeLengthMm: number;
    feedRateMmPerMin: number | null;
    estimatedSeconds: number | null;
    decimalsObserved: number[];
};
export declare function analyzeTap(tap: string): TapAnalysis;
