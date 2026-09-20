import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class ComandoReservasDto {
  @IsUUID() clave: string;
  @IsString() @Length(64, 64) revision: string;
  @IsIn(['reservar', 'liberar', 'consumir', 'definir', 'sincronizar']) accion:
    | 'reservar'
    | 'liberar'
    | 'consumir'
    | 'definir'
    | 'sincronizar';
  @IsOptional() @IsUUID() varianteId?: string;
  @IsOptional() @IsUUID() ubicacionId?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.00000001)
  @Max(999999999999)
  cantidad?: number;
  @IsOptional() @IsString() @MaxLength(32) unidad?: string;
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
}

export class PoliticaReservasDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['AL_EMITIR', 'MANUAL'])
  modo?: 'AL_EMITIR' | 'MANUAL';
  @IsBoolean() habilitada: boolean;
  @IsBoolean() incluirConsumibles: boolean;
  @IsInt() @Min(0) version: number;
}
