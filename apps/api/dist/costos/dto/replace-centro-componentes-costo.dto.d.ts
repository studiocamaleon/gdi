export declare enum CategoriaComponenteCostoCentroDto {
    sueldos = "sueldos",
    cargas = "cargas",
    mantenimiento = "mantenimiento",
    energia = "energia",
    alquiler = "alquiler",
    amortizacion = "amortizacion",
    tercerizacion = "tercerizacion",
    insumos_indirectos = "insumos_indirectos",
    otros = "otros"
}
export declare enum OrigenComponenteCostoCentroDto {
    manual = "manual",
    sugerido = "sugerido"
}
export declare class CentroCostoComponenteCostoItemDto {
    categoria: CategoriaComponenteCostoCentroDto;
    nombre: string;
    origen: OrigenComponenteCostoCentroDto;
    importeMensual: number;
    notas?: string;
    detalle?: Record<string, unknown>;
}
export declare class ReplaceCentroComponentesCostoDto {
    componentes: CentroCostoComponenteCostoItemDto[];
}
