import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Query del listado de materias primas: paginación + búsqueda. Todos los params
 * deben estar declarados acá para pasar el ValidationPipe (forbidNonWhitelisted).
 */
export class ListMateriasPrimasQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;
}
