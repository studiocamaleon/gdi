import { PrismaService } from '../prisma/prisma.service';
import { TipoDireccionDto } from './dto/direccion.dto';
import { UpsertClienteDto } from './dto/upsert-cliente.dto';
export declare class ClientesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
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
            tipo: TipoDireccionDto;
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
            tipo: TipoDireccionDto;
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
            tipo: TipoDireccionDto;
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
            tipo: TipoDireccionDto;
            principal: boolean;
        }[];
    }>;
    remove(id: string): Promise<void>;
    private findClienteOrThrow;
    private normalizePayload;
    private normalizeContactos;
    private normalizeDirecciones;
    private toResponse;
    private toPrismaTipoDireccion;
    private fromPrismaTipoDireccion;
}
