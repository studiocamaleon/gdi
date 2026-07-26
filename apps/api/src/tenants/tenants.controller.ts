import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import { ArchivosService } from '../archivos/archivos.service';
import { CurrentSession } from '../auth/current-auth.decorator';
import { Roles } from '../auth/roles.decorator';
import { Permiso, SoloAutenticado } from '../auth/permiso.decorator';
import { SwitchTenantDto } from '../auth/dto/switch-tenant.dto';
import { DefinirLogoTenantDto } from './dto/logo-tenant.dto';
import { GuardarDatosEmpresaDto } from './dto/datos-empresa.dto';
import { DatosEmpresaService } from './datos-empresa.service';
import { TenantsService } from './tenants.service';
import type { CurrentAuth } from '../auth/auth.types';

/**
 * Leer la empresa en la que estoy parado y cambiar de empresa son cosas de la
 * sesión, no de un módulo: sin esto, un operario no podría ni cargar el
 * dashboard. Lo que sí pide permiso es tocar la marca del negocio.
 */
@SoloAutenticado()
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly archivos: ArchivosService,
    private readonly datosEmpresaService: DatosEmpresaService,
  ) {}

  // ── Logo (identidad visual del tenant) ───────────────────────────────

  @Get('logo')
  logo(@CurrentSession() auth: CurrentAuth) {
    return this.archivos.logoDeTenant(auth.tenantId);
  }

  /** Cambiar la marca del negocio no es cosa de un operador. */
  @Put('logo')
  @Permiso('configuracion.gestionar')
  @Roles(RolSistema.ADMINISTRADOR, RolSistema.SUPERVISOR)
  definirLogo(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: DefinirLogoTenantDto,
  ) {
    return this.archivos.definirLogo(auth, dto.archivoId);
  }

  @Delete('logo')
  @Permiso('configuracion.gestionar')
  @Roles(RolSistema.ADMINISTRADOR, RolSistema.SUPERVISOR)
  async quitarLogo(@CurrentSession() auth: CurrentAuth): Promise<{ ok: true }> {
    await this.archivos.quitarLogo(auth);
    return { ok: true };
  }

  // ── Datos de empresa (lo comercial: teléfono, web, dónde queda) ──────

  /**
   * Lectura abierta a cualquiera con sesión, igual que el logo: estos datos
   * son los que el sistema imprime en un presupuesto y le muestra al cliente
   * en el seguimiento. Esconderlos del propio equipo no protege nada.
   */
  @Get('empresa')
  datosEmpresa(@CurrentSession() auth: CurrentAuth) {
    return this.datosEmpresaService.leer(auth);
  }

  /** Cambiar cómo se presenta el negocio es del dueño, no del que factura. */
  @Put('empresa')
  @Permiso('configuracion.gestionar')
  @Roles(RolSistema.ADMINISTRADOR, RolSistema.SUPERVISOR)
  guardarDatosEmpresa(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: GuardarDatosEmpresaDto,
  ) {
    return this.datosEmpresaService.guardar(auth, dto);
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
