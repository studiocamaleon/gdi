export declare enum TipoDireccionDto {
    principal = "principal",
    facturacion = "facturacion",
    entrega = "entrega"
}
export declare class ClienteDireccionDto {
    descripcion: string;
    pais: string;
    codigoPostal?: string;
    direccion: string;
    numero?: string;
    ciudad: string;
    tipo: TipoDireccionDto;
    principal: boolean;
}
