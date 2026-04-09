import { CurrentAuth } from '../auth/auth.types';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TipoDireccionDto } from './dto/direccion.dto';
import { UpsertProveedorDto } from './dto/upsert-proveedor.dto';
export declare class ProveedoresService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(auth: CurrentAuth, pagination: PaginationDto): Promise<{
        data: {
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
        }[];
        total: number;
        page: number;
        limit: number;
        pages: number;
    }>;
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
            tipo: TipoDireccionDto;
            principal: boolean;
        }[];
    }>;
    create(auth: CurrentAuth, payload: UpsertProveedorDto): Promise<{
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
    update(auth: CurrentAuth, id: string, payload: UpsertProveedorDto): Promise<{
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
    remove(auth: CurrentAuth, id: string): Promise<void>;
    private findProveedorOrThrow;
    private normalizePayload;
    private normalizeContactos;
    private normalizeDirecciones;
    private toResponse;
    private toPrismaTipoDireccion;
    private fromPrismaTipoDireccion;
}
