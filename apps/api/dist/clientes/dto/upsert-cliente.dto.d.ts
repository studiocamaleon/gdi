import { ClienteContactoDto } from './contacto.dto';
import { ClienteDireccionDto } from './direccion.dto';
export declare class UpsertClienteDto {
    nombre: string;
    razonSocial?: string;
    email: string;
    telefonoCodigo: string;
    telefonoNumero: string;
    pais: string;
    contactos: ClienteContactoDto[];
    direcciones: ClienteDireccionDto[];
}
