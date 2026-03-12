import { ModoProductividadProceso, Prisma, UnidadProceso } from '@prisma/client';
type JsonObject = Record<string, unknown>;
export type ProductividadValidationError = {
    field: 'productividadBase' | 'reglaVelocidad' | 'reglaMerma';
    message: string;
};
export type ProductividadEvaluationInput = {
    modoProductividad: ModoProductividadProceso;
    productividadBase: Prisma.Decimal | null;
    reglaVelocidadJson: Prisma.JsonValue | null;
    reglaMermaJson: Prisma.JsonValue | null;
    runMin: Prisma.Decimal | null;
    unidadTiempo: UnidadProceso;
    mermaRunPct: Prisma.Decimal | null;
    mermaSetup: Prisma.Decimal | null;
    cantidadObjetivoSalida: number;
    contexto: JsonObject;
};
export type ProductividadEvaluationResult = {
    runMin: number;
    productividadAplicada: number | null;
    cantidadRun: number;
    mermaRunPctAplicada: number;
    mermaSetupAplicada: number;
    warnings: string[];
};
export declare function validateProductividadRulesByMode(args: {
    modoProductividad: ModoProductividadProceso;
    productividadBase: Prisma.Decimal | null;
    reglaVelocidadJson: Prisma.JsonValue | null;
    reglaMermaJson: Prisma.JsonValue | null;
}): ProductividadValidationError[];
export declare function evaluateProductividad(input: ProductividadEvaluationInput): ProductividadEvaluationResult;
export {};
