import { IsUUID } from 'class-validator';

export class DefinirLogoTenantDto {
  /** Archivo ya subido y confirmado, con scope TENANT_BRANDING. */
  @IsUUID()
  archivoId!: string;
}
