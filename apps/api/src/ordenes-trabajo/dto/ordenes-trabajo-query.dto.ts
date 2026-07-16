import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ORDEN_TRABAJO_ESTADOS } from '../ordenes-trabajo.types';

export class OrdenesTrabajoQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn(ORDEN_TRABAJO_ESTADOS)
  estado?: string;
}
