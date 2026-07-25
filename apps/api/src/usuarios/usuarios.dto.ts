import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CrearUsuarioDto {
  @IsEmail({}, { message: 'Escribí un email válido.' })
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombreCompleto?: string;

  @IsUUID('4', { message: 'Elegí un rol.' })
  rolId!: string;

  /** Vincular con un legajo es opcional: hay usuarios que no son empleados. */
  @IsOptional()
  @IsUUID('4')
  empleadoId?: string;
}

export class EditarUsuarioDto {
  @IsOptional()
  @IsUUID('4')
  rolId?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  /** `null` explícito desvincula del empleado; ausente no lo toca. */
  @IsOptional()
  @IsUUID('4')
  empleadoId?: string | null;
}
