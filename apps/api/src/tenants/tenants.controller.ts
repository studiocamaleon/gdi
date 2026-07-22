import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import { ArchivosService } from '../archivos/archivos.service';
import { CurrentSession } from '../auth/current-auth.decorator';
import { Roles } from '../auth/roles.decorator';
import { SwitchTenantDto } from '../auth/dto/switch-tenant.dto';
import { DefinirLogoTenantDto } from './dto/logo-tenant.dto';
import { TenantsService } from './tenants.service';
import type { CurrentAuth } from '../auth/auth.types';

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly archivos: ArchivosService,
  ) {}

  // ── Logo (identidad visual del tenant) ───────────────────────────────

  @Get('logo')
  logo(@CurrentSession() auth: CurrentAuth) {
    return this.archivos.logoDeTenant(auth.tenantId);
  }

  /** Cambiar la marca del negocio no es cosa de un operador. */
  @Put('logo')
  @Roles(RolSistema.ADMINISTRADOR, RolSistema.SUPERVISOR)
  definirLogo(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: DefinirLogoTenantDto,
  ) {
    return this.archivos.definirLogo(auth, dto.archivoId);
  }

  @Delete('logo')
  @Roles(RolSistema.ADMINISTRADOR, RolSistema.SUPERVISOR)
  async quitarLogo(@CurrentSession() auth: CurrentAuth): Promise<{ ok: true }> {
    await this.archivos.quitarLogo(auth);
    return { ok: true };
  }

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
