import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { CalendarioEstacion } from '../calendario';

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

  /** PUESTOS de trabajo simultáneos (multiplican horas del calendario). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  capacidadConcurrente?: number;

  /** Minutos para traer el material hasta acá. null = default del tenant. */
  @IsOptional()
  @IsInt()
  @Min(0)
  tiempoPreparacionMin?: number | null;

  /**
   * Calendario semanal operativo; el shape fino lo valida el service con
   * parseCalendario (formato HH:MM, desde < hasta, días conocidos).
   */
  @IsOptional()
  @IsObject()
  calendario?: CalendarioEstacion | null;

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
