import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Etapas productivas FIJAS del taller (ordenan las vistas operativas). */
export const ETAPAS_ESTACION = [
  'preprensa',
  'impresion',
  'postprensa',
  'terminaciones',
  'instalacion',
  'qa-despacho',
] as const;

export type EtapaEstacion = (typeof ETAPAS_ESTACION)[number];

export class UpsertEstacionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsBoolean()
  activo: boolean;

  /** Etapa productiva fija (default 'preprensa'). */
  @IsOptional()
  @IsIn(ETAPAS_ESTACION)
  etapa?: EtapaEstacion;

  /** Clave del set de iconos del tablero (Printer, Cut, Shield, …). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  icono?: string;

  /** Pasos que pueden ejecutarse en paralelo. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  capacidadConcurrente?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  horario?: string;

  /**
   * Reemplazo COMPLETO de las tres listas: el form edita el conjunto.
   * Familias por código del catálogo; una familia vive en una sola estación.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  familias?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  empleadoIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  maquinaIds?: string[];
}
