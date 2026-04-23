export type LongitudUnit = 'mm' | 'cm' | 'm';
export declare function getLongitudMm(attrs: Record<string, unknown> | null | undefined, baseKey: string): number | null;
export declare function getLongitudCm(attrs: Record<string, unknown> | null | undefined, baseKey: string): number | null;
export declare function setLongitud(attrs: Record<string, unknown> | null | undefined, baseKey: string, valor: number, unidad: LongitudUnit): Record<string, unknown>;
export declare function getLongitudMmOrDefault(attrs: Record<string, unknown> | null | undefined, baseKey: string, defaultMm: number): number;
