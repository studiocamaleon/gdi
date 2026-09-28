import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { RolSistema } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../auth/roles.decorator';
import { Permiso } from '../../auth/permiso.decorator';
import { CurrentSession } from '../../auth/current-auth.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import { ProhibidoImpersonando } from '../../auth/prohibido-impersonando.decorator';
import { RequiereCapacidad } from '../../suscripciones/capacidad.guard';
import { MetaPilotoService } from './meta-piloto.service';

export class PruebaMetaDto {
  @IsUUID('4') clave!: string;
}

@Controller('integraciones/meta/piloto')
@Roles(RolSistema.ADMINISTRADOR)
@Permiso('configuracion.gestionar')
@ProhibidoImpersonando()
export class MetaPilotoController {
  constructor(private readonly service: MetaPilotoService) {}
  @Get()
  estado(@CurrentSession() auth: CurrentAuth) {
    return this.service.estado(auth.tenantId);
  }

  @Post('prueba')
  @RequiereCapacidad('whatsapp_automatico')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  enviar(@CurrentSession() auth: CurrentAuth, @Body() dto: PruebaMetaDto) {
    return this.service.enviarPrueba(auth.tenantId, dto.clave);
  }
}
