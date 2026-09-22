import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { Permiso } from '../auth/permiso.decorator';
import { ProhibidoImpersonando } from '../auth/prohibido-impersonando.decorator';
import { PermitirSuscripcionInactiva } from './permitir-suscripcion-inactiva.decorator';
import { ContratacionService } from './contratacion.service';
export class PrepararContratacionDto {
  @IsUUID() ofertaId: string;
  @IsIn(['mensual', 'anual']) ciclo: 'mensual' | 'anual';
  @IsInt() @Min(0) @Max(10000) adicionales: number;
}
export class ConfirmarContratacionDto {
  @IsArray()
  @ArrayMaxSize(70)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  revisionesAceptadas: string[];
}

@Controller('suscripcion/contrataciones')
@Permiso('configuracion.gestionar')
@Roles('ADMINISTRADOR')
@ProhibidoImpersonando()
@PermitirSuscripcionInactiva()
export class ContratacionController {
  constructor(private readonly contratacion: ContratacionService) {}
  @Get('pendiente')
  @Header('Cache-Control', 'no-store')
  pendiente(@CurrentSession() auth: CurrentAuth) {
    return this.contratacion.pendiente(auth);
  }
  @Post('revisar')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  revisar(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: PrepararContratacionDto,
  ) {
    return this.contratacion.preparar(auth, dto);
  }
  @Post(':id/confirmar')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  confirmar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmarContratacionDto,
  ) {
    return this.contratacion.confirmar(auth, id, dto.revisionesAceptadas);
  }
  @Post(':id/descartar')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  descartar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contratacion.descartar(auth, id);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  consultar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contratacion.consultar(auth, id);
  }
}
