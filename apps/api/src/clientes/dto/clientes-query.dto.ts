import { IsBooleanString, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ClientesQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  /**
   * 'true' para incluir los inhabilitados. Por defecto NO vienen: un cliente
   * inhabilitado tiene que desaparecer de todos lados —selectores del
   * cotizador, buscadores— salvo de la pantalla de Clientes cuando alguien
   * pide verlos a propósito.
   */
  @IsOptional()
  @IsBooleanString()
  incluirInactivos?: string;
}
