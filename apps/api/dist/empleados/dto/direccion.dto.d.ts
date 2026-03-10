export declare enum TipoDireccionDto {
    principal = "principal",
    facturacion = "facturacion",
    entrega = "entrega"
}
export declare class EmpleadoDireccionDto {
    descripcion: string;
    pais: string;
    codigoPostal?: string;
    direccion: string;
    numero?: string;
    ciudad: string;
    tipo: TipoDireccionDto;
    principal: boolean;
}
