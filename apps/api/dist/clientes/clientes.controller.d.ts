import { UpsertClienteDto } from './dto/upsert-cliente.dto';
import { ClientesService } from './clientes.service';
import type { CurrentAuth } from '../auth/auth.types';
export declare class ClientesController {
    private readonly clientesService;
    constructor(clientesService: ClientesService);
    findAll(auth: CurrentAuth): Promise<{
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
    findOne(auth: CurrentAuth, id: string): Promise<{
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
    create(auth: CurrentAuth, payload: UpsertClienteDto): Promise<{
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
    update(auth: CurrentAuth, id: string, payload: UpsertClienteDto): Promise<{
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
    remove(auth: CurrentAuth, id: string): Promise<void>;
}
