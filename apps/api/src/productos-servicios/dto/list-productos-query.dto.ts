import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Query del listado de productos: paginación + filtros. Todos los params deben
 * estar declarados acá para pasar el ValidationPipe (forbidNonWhitelisted).
 */
export class ListProductosQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  activo?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
