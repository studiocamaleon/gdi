import { EmpleadosService } from './empleados.service';
import { UpsertEmpleadoDto } from './dto/upsert-empleado.dto';
export declare class EmpleadosController {
    private readonly empleadosService;
    constructor(empleadosService: EmpleadosService);
    findAll(): Promise<{
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
    findOne(id: string): Promise<{
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
    create(payload: UpsertEmpleadoDto): Promise<{
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
    update(id: string, payload: UpsertEmpleadoDto): Promise<{
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
    remove(id: string): Promise<void>;
}
