import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentSession } from './current-auth.decorator';
import { AuthService } from './auth.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { ipDeRequest } from './ip';
import { LoginDto } from './dto/login.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import { Public } from './public.decorator';
import { SoloAutenticado } from './permiso.decorator';
import { SinTenant } from '../common/sin-tenant.decorator';
import type { CurrentAuth } from './auth.types';
import { PermitirSuscripcionInactiva } from '../suscripciones/permitir-suscripcion-inactiva.decorator';

/**
 * Nada de acá pide permiso: es la puerta de entrada y lo que todo usuario tiene
 * que poder hacer sea cual sea su rol — entrar, leer su sesión, cambiar de
 * empresa, salir. Un permiso que se pueda perder acá deja a alguien sin poder
 * ni desloguearse.
 */
@SoloAutenticado()
@PermitirSuscripcionInactiva()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login')
  login(@Body() payload: LoginDto, @Req() req: Request) {
    // La IP sale de Express, que ya resolvió el X-Forwarded-For según el
    // `trust proxy` de main.ts. Leer el header a mano acá sería confiar en un
    // dato que cualquiera puede escribir.
    return this.authService.login(payload, ipDeRequest(req));
  }

  /** Login del backoffice: staff de plataforma, sin exigir empresa. */
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login-plataforma')
  loginPlataforma(@Body() payload: LoginDto) {
    return this.authService.loginPlataforma(payload);
  }

  // @SinTenant: el logout no necesita contexto de tenant (revoca la AuthSession
  // por id) y así también lo pueden llamar las sesiones de plataforma, que sólo
  // tienen permitidas las rutas @SinTenant. Sin esto, el staff del backoffice no
  // podía cerrar sesión.
  @SinTenant()
  @Post('logout')
  logout(@CurrentSession() auth: CurrentAuth) {
    return this.authService.logout(auth);
  }

  @Public()
  @Get('invitations/:token')
  getInvitation(@Param('token') token: string) {
    return this.authService.getInvitation(token);
  }

  @Public()
  @Post('invitations/:token/accept')
  acceptInvitation(
    @Param('token') token: string,
    @Body() payload: AcceptInvitationDto,
  ) {
    return this.authService.acceptInvitation(token, payload);
  }

  /** El usuario cambia su propia clave. Pide la actual. */
  @Post('password')
  cambiarPassword(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: CambiarPasswordDto,
  ) {
    return this.authService.cambiarPassword(auth, payload);
  }

  @Get('me')
  getCurrentContext(@CurrentSession() auth: CurrentAuth) {
    return this.authService.getCurrentContext(auth);
  }

  @Post('switch-tenant')
  switchTenant(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: SwitchTenantDto,
  ) {
    return this.authService.switchTenant(auth, payload.tenantId);
  }

  /** Salir de una impersonación: cierra la sesión y vuelve a la cuenta staff. */
  @Post('salir-impersonacion')
  salirDeImpersonacion(@CurrentSession() auth: CurrentAuth) {
    return this.authService.salirDeImpersonacion(auth);
  }
}
