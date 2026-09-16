import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class SimularAsignacionPersonalDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(99)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  empleadoIds!: string[];
}

export class ConfirmarAsignacionPersonalDto {
  @IsString()
  @MaxLength(8192)
  token!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
