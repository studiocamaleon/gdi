import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ConsultaColaDto {
  @IsIn(['todos', 'listos', 'en_curso', 'pausados', 'en_espera'])
  estado: 'todos' | 'listos' | 'en_curso' | 'pausados' | 'en_espera' = 'todos';

  @IsOptional() @IsString() @MaxLength(120)
  q?: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(100000)
  page = 1;

  @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 50;
}
