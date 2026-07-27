import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
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

  // No hay campo `modo`: el acceso se entrega SIEMPRE con una clave provisoria
  // para dictar. El modo "link" se retiró (2026-07-27) porque nunca existió
  // nada que mandara el link.
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

export class CambiarIpsDto {
  /** Vacío = puede entrar desde cualquier lado. */
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  ips!: string[];
}

export class CrearRolDto {
  @IsString()
  @MinLength(2, { message: 'El rol necesita un nombre.' })
  @MaxLength(60)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  descripcion?: string;

  /**
   * Claves del catálogo. Las que no existan se descartan al guardar en vez de
   * rechazar el pedido entero: el catálogo lo mueve Grafo, y una UI de una
   * versión anterior no tiene que romper el guardado.
   */
  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  permisos!: string[];
}

export class EditarRolDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  descripcion?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  permisos?: string[];
}

export class EliminarRolDto {
  /** A qué rol pasan los usuarios que lo tenían. */
  @IsOptional()
  @IsUUID('4')
  destinoId?: string;
}
