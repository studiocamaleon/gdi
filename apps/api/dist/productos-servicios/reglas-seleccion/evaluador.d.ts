export type JsonLogicExpr = unknown;
export type EvalContext = Record<string, unknown>;
export declare function evaluarCondicion(expr: JsonLogicExpr, context: EvalContext): unknown;
export declare function evaluarBool(expr: JsonLogicExpr, context: EvalContext): boolean;
export type ReglaCaso = {
    condicion: JsonLogicExpr;
    decision: unknown;
};
export declare function resolverRegla(casos: ReglaCaso[], defaultDecision: unknown, context: EvalContext): unknown;
