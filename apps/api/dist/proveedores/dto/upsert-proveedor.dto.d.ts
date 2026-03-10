import { ProveedorContactoDto } from './contacto.dto';
import { ProveedorDireccionDto } from './direccion.dto';
export declare class UpsertProveedorDto {
    nombre: string;
    razonSocial?: string;
    email: string;
    telefonoCodigo: string;
    telefonoNumero: string;
    pais: string;
    contactos: ProveedorContactoDto[];
    direcciones: ProveedorDireccionDto[];
}
