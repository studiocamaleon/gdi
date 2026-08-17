import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  EstadoConfiguracionMaquinaDto,
  EstadoMaquinaDto,
  PlantillaMaquinariaDto,
} from './upsert-maquina.dto';

function parseBooleanQuery({ value }: TransformFnParams): unknown {
  const raw: unknown = value;
  if (raw === true || raw === 'true') return true;
  if (raw === false || raw === 'false') return false;
  return raw;
}

export class ListMaquinasQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(PlantillaMaquinariaDto)
  plantilla?: PlantillaMaquinariaDto;

  @IsOptional()
  @IsEnum(EstadoMaquinaDto)
  estado?: EstadoMaquinaDto;

  @IsOptional()
  @IsEnum(EstadoConfiguracionMaquinaDto)
  estadoConfiguracion?: EstadoConfiguracionMaquinaDto;

  @IsOptional()
  @Transform(parseBooleanQuery)
  @IsBoolean()
  activo?: boolean;
}

export class SetMaquinaActivaDto {
  @IsBoolean()
  activo: boolean;
}
