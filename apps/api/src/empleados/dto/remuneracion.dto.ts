import {
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Por qué cambió el sueldo. Picklist, nunca texto libre solo. */
export const MOTIVOS_REMUNERACION = [
  'alta',
  'paritaria',
  'ascenso',
  'correccion',
  'otro',
] as const;
export type MotivoRemuneracion = (typeof MOTIVOS_REMUNERACION)[number];

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export class UpsertRemuneracionDto {
  /** 'YYYY-MM' — desde qué mes rige. */
  @Matches(PERIODO_RE, { message: 'El mes debe tener el formato AAAA-MM.' })
  vigenteDesde: string;

  /**
   * 'YYYY-MM' o null. Normalmente se deja vacío: la vigencia la cierra sola la
   * remuneración siguiente cuando se carga un aumento.
   */
  @IsOptional()
  @Matches(PERIODO_RE, { message: 'El mes debe tener el formato AAAA-MM.' })
  vigenteHasta?: string | null;

  @IsNumberString()
  sueldoNeto: string;

  @IsNumberString()
  cargasSociales: string;

  /**
   * 13 con aguinaldo (lo normal en Argentina), 12 sin. El tope de 14 deja lugar
   * a un convenio con más sueldos sin necesitar un release.
   */
  @IsOptional()
  @IsInt()
  @Min(12)
  @Max(14)
  sueldosPorAnio?: number;

  @IsOptional()
  @IsIn(MOTIVOS_REMUNERACION)
  motivo?: MotivoRemuneracion;

  @IsOptional()
  @IsString()
  notas?: string;
}
