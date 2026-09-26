import { IsOptional, IsUUID } from 'class-validator';

/** El teléfono y la empresa salen del piloto y de la sesión, nunca del navegador. */
export class MetaInboxQueryDto {
  @IsOptional()
  @IsUUID()
  antesDe?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;
}
