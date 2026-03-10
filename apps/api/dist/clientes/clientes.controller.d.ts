import { UpsertClienteDto } from './dto/upsert-cliente.dto';
import { ClientesService } from './clientes.service';
export declare class ClientesController {
    private readonly clientesService;
    constructor(clientesService: ClientesService);
    findAll(): Promise<{
        id: string;
        nombre: string;
        razonSocial: string;
        email: string;
        telefonoCodigo: string;
        telefonoNumero: string;
        pais: string;
        contacto: string;
        ciudad: string;
        contactos: {
            id: string;
            nombre: string;
            cargo: string;
            email: string;
            telefonoCodigo: string;
            telefonoNumero: string;
            principal: boolean;
        }[];
        direcciones: {
            id: string;
            descripcion: string;
            pais: string;
            codigoPostal: string;
            direccion: string;
            numero: string;
            ciudad: string;
            tipo: import("./dto/direccion.dto").TipoDireccionDto;
            principal: boolean;
        }[];
    }[]>;
    findOne(id: string): Promise<{
        id: string;
        nombre: string;
        razonSocial: string;
        email: string;
        telefonoCodigo: string;
        telefonoNumero: string;
        pais: string;
        contacto: string;
        ciudad: string;
        contactos: {
            id: string;
            nombre: string;
            cargo: string;
            email: string;
            telefonoCodigo: string;
            telefonoNumero: string;
            principal: boolean;
        }[];
        direcciones: {
            id: string;
            descripcion: string;
            pais: string;
            codigoPostal: string;
            direccion: string;
            numero: string;
            ciudad: string;
            tipo: import("./dto/direccion.dto").TipoDireccionDto;
            principal: boolean;
        }[];
    }>;
    create(payload: UpsertClienteDto): Promise<{
        id: string;
        nombre: string;
        razonSocial: string;
        email: string;
        telefonoCodigo: string;
        telefonoNumero: string;
        pais: string;
        contacto: string;
        ciudad: string;
        contactos: {
            id: string;
            nombre: string;
            cargo: string;
            email: string;
            telefonoCodigo: string;
            telefonoNumero: string;
            principal: boolean;
        }[];
        direcciones: {
            id: string;
            descripcion: string;
            pais: string;
            codigoPostal: string;
            direccion: string;
            numero: string;
            ciudad: string;
            tipo: import("./dto/direccion.dto").TipoDireccionDto;
            principal: boolean;
        }[];
    }>;
    update(id: string, payload: UpsertClienteDto): Promise<{
        id: string;
        nombre: string;
        razonSocial: string;
        email: string;
        telefonoCodigo: string;
        telefonoNumero: string;
        pais: string;
        contacto: string;
        ciudad: string;
        contactos: {
            id: string;
            nombre: string;
            cargo: string;
            email: string;
            telefonoCodigo: string;
            telefonoNumero: string;
            principal: boolean;
        }[];
        direcciones: {
            id: string;
            descripcion: string;
            pais: string;
            codigoPostal: string;
            direccion: string;
            numero: string;
            ciudad: string;
            tipo: import("./dto/direccion.dto").TipoDireccionDto;
            principal: boolean;
        }[];
    }>;
    remove(id: string): Promise<void>;
}
