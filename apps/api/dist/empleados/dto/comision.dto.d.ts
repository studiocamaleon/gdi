export declare enum TipoComisionDto {
    porcentaje = "porcentaje",
    fijo = "fijo"
}
export declare class EmpleadoComisionDto {
    descripcion: string;
    tipo: TipoComisionDto;
    valor: string;
}
