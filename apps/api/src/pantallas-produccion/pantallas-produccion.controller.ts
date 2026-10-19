import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso, RequiereVista } from '../auth/permiso.decorator';
import { ipDeRequest } from '../auth/ip';
import { PermitirSuscripcionInactiva } from '../suscripciones/permitir-suscripcion-inactiva.decorator';
import { PantallasProduccionService } from './pantallas-produccion.service';
import { VincularPantallaDto } from './pantallas-produccion.dto';

@Controller('pantalla-produccion')
export class DispositivoProduccionController {
  constructor(private readonly service: PantallasProduccionService) {}

  @Public()
  @Post('iniciar')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  iniciar(@Headers('authorization') authorization?: string) {
    return this.service.iniciar(authorization);
  }

  @Public()
  @Get('estado')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  estado(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ) {
    return this.service.estado(authorization, ipDeRequest(req));
  }

  @Public()
  @Get('datos')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  datos(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ) {
    return this.service.datos(authorization, ipDeRequest(req));
  }
}

@Controller('produccion/pantallas')
@Permiso('produccion.configurar')
@RequiereVista('produccion.tablero.ver')
export class PantallasProduccionController {
  constructor(private readonly service: PantallasProduccionService) {}

  @Get()
  listar(@CurrentSession() auth: CurrentAuth) {
    return this.service.listar(auth);
  }

  @Post('vincular')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  vincular(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: VincularPantallaDto,
  ) {
    return this.service.vincular(auth, dto);
  }

  @Delete(':id')
  @PermitirSuscripcionInactiva()
  revocar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.revocar(auth, id);
  }
}
