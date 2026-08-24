import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export enum OrdenProductosDto {
  recientes = 'recientes',
  nombre_asc = 'nombre_asc',
  nombre_desc = 'nombre_desc',
}

function booleanQuery(value: unknown) {
  if (value === undefined || value === true || value === false) return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

/**
 * Query del listado de productos: paginación + filtros. Todos los params deben
 * estar declarados acá para pasar el ValidationPipe (forbidNonWhitelisted).
 */
export class ListProductosQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => booleanQuery(value))
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['unidad', 'm2', 'metro_lineal'])
  unidadComercial?: 'unidad' | 'm2' | 'metro_lineal';

  @IsOptional()
  @IsString()
  subcategoriaCodigo?: string;

  @IsOptional()
  @IsString()
  categoriaCodigo?: string;

  @IsOptional()
  @IsEnum(OrdenProductosDto)
  orden: OrdenProductosDto = OrdenProductosDto.recientes;
}
