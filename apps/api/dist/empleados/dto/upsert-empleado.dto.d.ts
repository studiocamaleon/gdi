import { EmpleadoComisionDto } from './comision.dto';
import { EmpleadoDireccionDto } from './direccion.dto';
export declare enum SexoEmpleadoDto {
    masculino = "masculino",
    femenino = "femenino",
    no_binario = "no_binario",
    prefiero_no_decir = "prefiero_no_decir"
}
export declare enum RolSistemaDto {
    administrador = "administrador",
    supervisor = "supervisor",
    operador = "operador"
}
export declare class UpsertEmpleadoDto {
    nombreCompleto: string;
    email: string;
    telefonoCodigo: string;
    telefonoNumero: string;
    sector: string;
    ocupacion?: string;
    sexo?: SexoEmpleadoDto;
    fechaIngreso: string;
    fechaNacimiento?: string;
    usuarioSistema: boolean;
    emailAcceso?: string;
    rolSistema?: RolSistemaDto;
    comisionesHabilitadas: boolean;
    direcciones: EmpleadoDireccionDto[];
    comisiones: EmpleadoComisionDto[];
}
