import {
  IsOptional,
  IsIn,
  IsUUID,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

/** La empresa y el número propio se resuelven en el servidor. */
export class MetaInboxQueryDto {
  @IsOptional() @IsIn(['TODAS', 'MIAS', 'SIN_ASIGNAR', 'PARTICIPE']) filtro?:
    | 'TODAS'
    | 'MIAS'
    | 'SIN_ASIGNAR'
    | 'PARTICIPE';
  @IsOptional() @IsUUID('4') eventosAntesDe?: string;
  @IsOptional() @IsUUID('4') eventosDesdeId?: string;
  @IsOptional() @IsUUID('4') conversacionId?: string;
  @IsOptional() @IsUUID('4') desdeId?: string;
  @IsOptional() @IsString() @MaxLength(120) busqueda?: string;
  @IsOptional() @Matches(/^[A-Za-z0-9_-]{1,800}$/) listaAntesDe?: string;

  @IsOptional()
  @IsUUID()
  antesDe?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;
}
