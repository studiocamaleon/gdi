import { Body, Controller, Get, Header, Put, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { SinTenant } from '../common/sin-tenant.decorator';
import {
  CredencialesArcaService,
  type AmbienteArca,
} from '../fiscal-plataforma/credenciales-arca.service';
import { MAX_PEM_BYTES } from '../fiscal-plataforma/certificado-arca';
import { PlataformaGuard } from './plataforma.guard';
import { PlataformaAdminGuard } from './plataforma-admin.guard';

export class GuardarCertificadoArcaDto {
  @IsIn(['dev', 'prod']) ambiente: AmbienteArca;
  @IsString() @MaxLength(MAX_PEM_BYTES) certificado: string;
  @IsString() @MaxLength(MAX_PEM_BYTES) clavePrivada: string;
  @IsOptional() @IsUUID() revisionAnterior: string | null = null;
}

@Controller('plataforma/fiscal/arca')
@SinTenant()
@UseGuards(PlataformaGuard)
export class FiscalPlataformaController {
  constructor(private readonly credenciales: CredencialesArcaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  estado() {
    return this.credenciales.estado();
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  @UseGuards(PlataformaAdminGuard)
  guardar(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: GuardarCertificadoArcaDto,
  ) {
    return this.credenciales.guardar(auth.userId, dto);
  }
}
