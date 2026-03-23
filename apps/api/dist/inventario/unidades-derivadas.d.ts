import type { UnitCode } from './unidades-canonicas';
type FlexibleRollMetrics = {
    widthM: number;
    lengthM: number;
    areaM2: number;
};
export declare function resolveFlexibleRollMetrics(attributes: unknown): FlexibleRollMetrics | null;
export declare function canUseFlexibleRollDerivedUnits(input: {
    subfamilia?: string | null;
    from?: UnitCode | null;
    to?: UnitCode | null;
    attributes?: unknown;
}): boolean;
export declare function convertFlexibleRollUnitPrice(input: {
    pricePerFromUnit: number;
    from: UnitCode;
    to: UnitCode;
    attributes?: unknown;
    subfamilia?: string | null;
}): number | null;
export {};
