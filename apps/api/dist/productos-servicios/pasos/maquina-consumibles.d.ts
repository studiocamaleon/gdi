import type { NestingResultUnion } from '../engine/nesting-runner';
import type { MaterialConsumido } from './material-plantillas';
export type MaquinaConsumibleRuntime = {
    id: string;
    perfilOperativoId: string | null;
    nombre: string;
    tipo: string;
    unidad: string;
    consumoBase: unknown;
    rendimientoEstimado: unknown;
    activo: boolean;
    materiaPrimaVariante: {
        id: string;
        sku: string;
        nombreVariante: string | null;
        precioReferencia: unknown;
    };
};
export type MaquinaDesgasteRuntime = {
    id: string;
    nombre: string;
    tipo: string;
    vidaUtilEstimada: unknown;
    unidadDesgaste: string;
    modoProrrateo: string | null;
    activo: boolean;
    materiaPrimaVariante: {
        id: string;
        sku: string;
        nombreVariante: string | null;
        precioReferencia: unknown;
    };
};
export type PerfilRuntime = {
    id: string;
    dobleFaz: boolean;
    productivityUnit: string | null;
} | null;
export type ConsumiblesContext = {
    cantidadPedida: number;
    layout: NestingResultUnion | null;
    perfil: PerfilRuntime;
};
export declare function construirConsumiblesDelPerfil(consumibles: MaquinaConsumibleRuntime[] | undefined, ctx: ConsumiblesContext): MaterialConsumido[];
export declare function construirDesgasteDelPaso(componentesDesgaste: MaquinaDesgasteRuntime[] | undefined, ctx: ConsumiblesContext): MaterialConsumido[];
