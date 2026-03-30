import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentSession } from './current-auth.decorator';
import { AuthService } from './auth.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { LoginDto } from './dto/login.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import { Public } from './public.decorator';
import type { CurrentAuth } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login')
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

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
}
