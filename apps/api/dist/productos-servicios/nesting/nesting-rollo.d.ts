export type NestingRolloOrientacion = 'normal' | 'rotada' | 'mixta';
export type NestingRolloPlacement = {
    id: string;
    widthMm: number;
    heightMm: number;
    usefulWidthMm: number;
    usefulHeightMm: number;
    overlapStartMm: number;
    overlapEndMm: number;
    centerXMm: number;
    centerYMm: number;
    label: string;
    rotated: boolean;
    originalWidthMm: number;
    originalHeightMm: number;
    panelIndex: number | null;
    panelCount: number | null;
    panelAxis: 'vertical' | 'horizontal' | null;
    sourcePieceId: string | null;
};
export type NestingRolloMedida = {
    anchoMm: number;
    altoMm: number;
    cantidad: number;
};
export type NestingRolloPanelizadoConfig = {
    activo: boolean;
    mode: 'automatico' | 'manual';
    axis: 'vertical' | 'horizontal';
    overlapMm: number;
    maxPanelWidthMm: number;
    distribution: 'equilibrada' | 'libre';
    widthInterpretation: 'total' | 'util';
    manualLayout?: Record<string, unknown> | null;
};
export type NestingRolloInput = {
    printableWidthMm: number;
    marginLeftMm: number;
    marginStartMm: number;
    marginEndMm: number;
    separacionHorizontalMm: number;
    separacionVerticalMm: number;
    permitirRotacion: boolean;
    medidas: NestingRolloMedida[];
    panelizado?: NestingRolloPanelizadoConfig;
};
export type NestingRolloResult = {
    orientacion: NestingRolloOrientacion;
    panelizado: boolean;
    panelAxis: 'vertical' | 'horizontal' | null;
    panelCount: number;
    panelOverlapMm: number | null;
    panelMaxWidthMm: number | null;
    panelDistribution: 'equilibrada' | 'libre' | null;
    panelWidthInterpretation: 'total' | 'util' | null;
    panelMode: 'automatico' | 'manual' | null;
    piecesPerRow: number;
    rows: number;
    consumedLengthMm: number;
    usefulAreaM2: number;
    placements: NestingRolloPlacement[];
};
type ManualLayoutNormalizado = {
    items: Array<{
        sourcePieceId: string;
        pieceWidthMm: number;
        pieceHeightMm: number;
        axis: 'vertical' | 'horizontal';
        panels: Array<{
            panelIndex: number;
            usefulWidthMm: number;
            usefulHeightMm: number;
            overlapStartMm: number;
            overlapEndMm: number;
            finalWidthMm: number;
            finalHeightMm: number;
        }>;
    }>;
};
export declare function normalizeManualLayout(value: Record<string, unknown> | null | undefined): ManualLayoutNormalizado | null;
export declare function nestOnRoll(input: NestingRolloInput): NestingRolloResult | null;
export {};
