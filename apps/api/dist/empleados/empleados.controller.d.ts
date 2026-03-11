import { InvitarAccesoDto } from './dto/invitar-acceso.dto';
import { EmpleadosService } from './empleados.service';
import { UpsertEmpleadoDto } from './dto/upsert-empleado.dto';
import type { CurrentAuth } from '../auth/auth.types';
export declare class EmpleadosController {
    private readonly empleadosService;
    constructor(empleadosService: EmpleadosService);
    findAll(auth: CurrentAuth): Promise<{
        id: string;
        nombreCompleto: string;
        email: string;
        telefonoCodigo: string;
        telefonoNumero: string;
        sector: string;
        ocupacion: string;
        sexo: string;
        fechaIngreso: string;
        fechaNacimiento: string;
        usuarioSistema: boolean;
        emailAcceso: string;
        rolSistema: string;
        comisionesHabilitadas: boolean;
        ciudad: string;
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
        comisiones: {
            id: string;
            descripcion: string;
            tipo: import("./dto/comision.dto").TipoComisionDto;
            valor: string;
        }[];
    }[]>;
    findOne(auth: CurrentAuth, id: string): Promise<{
        id: string;
        nombreCompleto: string;
        email: string;
        telefonoCodigo: string;
        telefonoNumero: string;
        sector: string;
        ocupacion: string;
        sexo: string;
        fechaIngreso: string;
        fechaNacimiento: string;
        usuarioSistema: boolean;
        emailAcceso: string;
        rolSistema: string;
        comisionesHabilitadas: boolean;
        ciudad: string;
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
        comisiones: {
            id: string;
            descripcion: string;
            tipo: import("./dto/comision.dto").TipoComisionDto;
            valor: string;
        }[];
    }>;
    create(auth: CurrentAuth, payload: UpsertEmpleadoDto): Promise<{
        id: string;
        nombreCompleto: string;
        email: string;
        telefonoCodigo: string;
        telefonoNumero: string;
        sector: string;
        ocupacion: string;
        sexo: string;
        fechaIngreso: string;
        fechaNacimiento: string;
        usuarioSistema: boolean;
        emailAcceso: string;
        rolSistema: string;
        comisionesHabilitadas: boolean;
        ciudad: string;
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
        comisiones: {
            id: string;
            descripcion: string;
            tipo: import("./dto/comision.dto").TipoComisionDto;
            valor: string;
        }[];
    }>;
    update(auth: CurrentAuth, id: string, payload: UpsertEmpleadoDto): Promise<{
        id: string;
        nombreCompleto: string;
        email: string;
        telefonoCodigo: string;
        telefonoNumero: string;
        sector: string;
        ocupacion: string;
        sexo: string;
        fechaIngreso: string;
        fechaNacimiento: string;
        usuarioSistema: boolean;
        emailAcceso: string;
        rolSistema: string;
        comisionesHabilitadas: boolean;
        ciudad: string;
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
        comisiones: {
            id: string;
            descripcion: string;
            tipo: import("./dto/comision.dto").TipoComisionDto;
            valor: string;
        }[];
    }>;
    invitarAcceso(auth: CurrentAuth, id: string, payload: InvitarAccesoDto): Promise<{
        invitationState: string;
        invitationUrl: null;
    } | {
        invitationState: string;
        invitationUrl: string;
    }>;
    remove(auth: CurrentAuth, id: string): Promise<void>;
}
