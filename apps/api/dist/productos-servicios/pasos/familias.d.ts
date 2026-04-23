import { type OutputCanonicoNombre } from './outputs-canonicos';
export type FamiliaPlantillaConfig = {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
};
export type ModoNesting = 'produce' | 'consume' | 'none';
export type NestingAlgoritmo = 'nesting-hoja' | 'nesting-rollo' | 'nesting-placa-rigida';
export type DimensionProductivaCanonica = 'unidades' | 'm2' | 'metro_lineal' | 'tiempo_fijo';
export type FamiliaPaso = {
    codigo: string;
    nombre: string;
    descripcion: string;
    categoria: 'produccion' | 'corte_y_formado' | 'terminaciones' | 'estructural' | 'servicios' | 'operaciones_manuales';
    plantillaConfig: FamiliaPlantillaConfig;
    outputsCanonicos: OutputCanonicoNombre[];
    formulasDisponibles: {
        tiempo: string[];
        material: string[];
    };
    requiereCentroCosto: boolean;
    ejemplos: string[];
    modoNesting: ModoNesting;
    nestingAlgoritmo: NestingAlgoritmo | null;
    dimensionProductivaCanonica: DimensionProductivaCanonica;
    dimensionDisplay: string;
};
export declare const FAMILIAS_PASO: Record<string, FamiliaPaso>;
export declare const FAMILIAS_CODIGOS: string[];
export declare function getFamilia(codigo: string): FamiliaPaso | undefined;
export declare function getFamiliasPorCategoria(categoria: FamiliaPaso['categoria']): FamiliaPaso[];
