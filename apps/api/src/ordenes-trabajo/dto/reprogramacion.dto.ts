import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type { SolicitudReprogramacion } from '../reprogramacion.contrato';

export class SimularReprogramacionDto implements SolicitudReprogramacion {
  @IsIn(['produccion', 'entrega']) tipo!: 'produccion' | 'entrega';
  @IsIn(['paso', 'item']) alcance!: 'paso' | 'item';
  @Matches(/^\d{4}-\d{2}-\d{2}$/) fecha!: string;
  @IsOptional() @Matches(/^\d{2}:\d{2}$/) hora?: string;
  @IsOptional()
  @IsIn(['mantener', 'automatico', 'manual'])
  ajusteProduccion?: 'mantener' | 'automatico' | 'manual';
  @IsOptional() @IsIn(['paso', 'item']) alcanceProduccion?: 'paso' | 'item';
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) fechaProduccion?: string;
  @IsOptional() @Matches(/^\d{2}:\d{2}$/) horaProduccion?: string;
}
export class ConfirmarReprogramacionDto {
  @IsString() @MaxLength(8192) token!: string;
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
}
