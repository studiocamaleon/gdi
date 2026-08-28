import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentSession } from '../auth/current-auth.decorator';
import { SoloAutenticado } from '../auth/permiso.decorator';
import { Public } from '../auth/public.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { PermitirSuscripcionInactiva } from '../suscripciones/permitir-suscripcion-inactiva.decorator';
import { SinTenant } from '../common/sin-tenant.decorator';
import { IniciarRegistroDto } from './dto/iniciar-registro.dto';
import { TokenRegistroDto } from './dto/token-registro.dto';
import { RegistroService } from './registro.service';

@Controller('registro')
export class RegistroController {
  constructor(private readonly registro: RegistroService) {}

  @Public()
  @Get('planes')
  planes() {
    return this.registro.planes();
  }

  @Public()
  @Throttle({ default: { ttl: 60 * 60 * 1000, limit: 8 } })
  @Post()
  iniciar(@Body() dto: IniciarRegistroDto) {
    return this.registro.iniciar(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('verificar/:token')
  estado(@Param('token') token: string) {
    return this.registro.estado(token);
  }

  @Public()
  @Throttle({ default: { ttl: 60 * 60 * 1000, limit: 12 } })
  @Post('completar')
  completar(@Body() dto: TokenRegistroDto) {
    return this.registro.completarNuevo(dto.token);
  }

  @SoloAutenticado()
  @PermitirSuscripcionInactiva()
  @SinTenant()
  @Post('completar-existente')
  completarExistente(
    @Body() dto: TokenRegistroDto,
    @CurrentSession() auth: CurrentAuth,
  ) {
    return this.registro.completarExistente(dto.token, auth);
  }

  @SoloAutenticado()
  @PermitirSuscripcionInactiva()
  @Post('onboarding/completar')
  completarOnboarding(@CurrentSession() auth: CurrentAuth) {
    return this.registro.completarOnboarding(auth);
  }
}
