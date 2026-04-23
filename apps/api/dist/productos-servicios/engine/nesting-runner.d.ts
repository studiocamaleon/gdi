import type { FamiliaPaso } from '../pasos/familias';
import { type NestingPlacaResult } from '../nesting/nesting-placa-rigida';
import { type NestingRolloResult } from '../nesting/nesting-rollo';
import { type NestingHojaResult } from '../nesting/nesting-hoja';
export type CriterioSeleccionMaterial = 'menor_costo_total' | 'menor_largo_consumido' | 'mayor_aprovechamiento';
export type EvaluacionMultiMaterial = {
    criterio: CriterioSeleccionMaterial;
    materialElegido: {
        materialVarianteId: string;
        sku: string;
        nombre: string;
        rolloAnchoMm: number | null;
        rolloLargoM: number | null;
        precioReferencia: number | null;
        precioPorM2: number | null;
        areaConsumidaM2: number;
        aprovechamientoPct: number;
        sustratoCosto: number | null;
    };
    materialesEvaluados: Array<{
        materialVarianteId: string;
        sku: string;
        nombre: string;
        rolloAnchoMm: number | null;
        aprovechamientoPct: number;
        largoConsumidoMm: number;
        sustratoCosto: number | null;
        esGanador: boolean;
    }>;
    materialesDescartados: Array<{
        sku: string;
        nombre: string;
        motivo: string;
        rolloAnchoMm: number | null;
    }>;
};
export type NestingResultUnion = {
    algoritmo: 'nesting-placa-rigida';
    result: NestingPlacaResult;
} | {
    algoritmo: 'nesting-rollo';
    result: NestingRolloResult;
    marginLeftMm?: number;
    marginRightMm?: number;
    marginStartMm?: number;
    marginEndMm?: number;
    rolloAnchoTotalMm?: number;
    evaluacion?: EvaluacionMultiMaterial;
} | {
    algoritmo: 'nesting-hoja';
    result: NestingHojaResult;
};
export type PasoMaterialRuntime = {
    id: string;
    nombre: string;
    esSustratoNesting: boolean;
    variantesHabilitadas: Array<{
        materiaPrimaVarianteId: string;
        sku: string;
        nombreVariante: string | null;
        atributosVariante: Record<string, unknown> | null;
        precioReferencia: number | null;
    }>;
};
export type PasoRuntime = {
    id: string;
    familiaCodigo: string;
    configNesting: Record<string, unknown> | null;
    materialesConsumidos?: PasoMaterialRuntime[];
};
export type TrabajoContext = {
    medidas: Array<{
        anchoMm: number;
        altoMm: number;
        cantidad: number;
    }>;
    cantidadTotal?: number;
};
export type MaterialMaquinaContext = {
    maquinaPrintableWidthMm?: number;
    maquinaAnchoTotalMm?: number;
    maquinaMarginLeftMm?: number;
    maquinaMarginRightMm?: number;
    maquinaMarginStartMm?: number;
    maquinaMarginEndMm?: number;
    placaAnchoMm?: number;
    placaAltoMm?: number;
};
export type NestingRunnerInput = {
    pasos: PasoRuntime[];
    familiasMap: Record<string, FamiliaPaso>;
    trabajo: TrabajoContext;
    materialMaquina?: MaterialMaquinaContext;
};
export type NestingRunnerOutput = {
    layoutsPorPasoId: Map<string, NestingResultUnion>;
    consumeMap: Map<string, string>;
    consumersSinProduce: string[];
};
export declare function runNestingPipeline(input: NestingRunnerInput): NestingRunnerOutput;
export declare function getLayoutHeredado(output: NestingRunnerOutput, pasoId: string): NestingResultUnion | null;
