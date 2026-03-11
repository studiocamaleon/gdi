import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import { SwitchTenantDto } from '../auth/dto/switch-tenant.dto';
import { TenantsService } from './tenants.service';
import type { CurrentAuth } from '../auth/auth.types';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  getCurrent(@CurrentSession() auth: CurrentAuth) {
    return this.tenantsService.getCurrent(auth);
  }

  @Post('switch')
  switchTenant(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: SwitchTenantDto,
  ) {
    return this.tenantsService.switchTenant(auth, payload.tenantId);
  }
}
