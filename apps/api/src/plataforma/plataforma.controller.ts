import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { SinTenant } from '../common/sin-tenant.decorator';
import { PlataformaAdminGuard } from './plataforma-admin.guard';
import { PlataformaBillingService } from './plataforma-billing.service';
import { PlataformaGuard } from './plataforma.guard';
import { PlataformaService } from './plataforma.service';

export class CambiarPlanDto {
  @IsUUID()
  planId: string;
}

export class SuspenderTenantDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  motivo: string;
}

export class GenerarBillingDto {
  @IsUUID()
  puntoVentaId: string;

  /** YYYY-MM; default el período actual. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  periodo?: string;
}

export class CrearTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre: string;

  @Matches(/^[a-z0-9][a-z0-9-]{1,40}$/, {
    message: 'El slug: minúsculas, números y guiones.',
  })
  slug: string;

  @IsUUID()
  planId: string;

  @IsEmail()
  adminEmail: string;
}

/**
 * El namespace del control plane. Dos marcas a nivel de clase, y las dos son
 * la definición de este plano:
 *  - @UseGuards(PlataformaGuard): sólo staff (User.rolPlataforma).
 *  - @SinTenant(): sin contexto de tenant — el guard de aislamiento no
 *    filtra, porque acá se lee A TRAVÉS de los tenants.
 * Las escrituras llevan además PlataformaAdminGuard: SOPORTE ve, ADMIN muta.
 * Ver docs/control-plane-diseno.md
 */
@Controller('plataforma')
@UseGuards(PlataformaGuard)
@SinTenant()
export class PlataformaController {
  constructor(
    private readonly service: PlataformaService,
    private readonly billing: PlataformaBillingService,
  ) {}

  /** La consola completa: resumen + tenants + auditoría + quién mira. */
  @Get('consola')
  consola(@CurrentSession() auth: CurrentAuth) {
    return this.service.consola(auth.userId);
  }

  @Get('planes')
  planes() {
    return this.service.planes();
  }

  @Put('tenants/:id/plan')
  @UseGuards(PlataformaAdminGuard)
  async cambiarPlan(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarPlanDto,
  ) {
    await this.service.cambiarPlan(auth.userId, id, dto.planId);
    return this.service.consola(auth.userId);
  }

  @Post('tenants/:id/suspender')
  @UseGuards(PlataformaAdminGuard)
  async suspender(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspenderTenantDto,
  ) {
    await this.service.suspenderTenant(auth.userId, id, dto.motivo);
    return this.service.consola(auth.userId);
  }

  @Post('tenants/:id/reactivar')
  @UseGuards(PlataformaAdminGuard)
  async reactivar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.reactivarTenant(auth.userId, id);
    return this.service.consola(auth.userId);
  }

  @Get('billing')
  billingEstado() {
    return this.billing.estado();
  }

  /** Genera los borradores del período. Reentrante: no duplica. */
  @Post('billing/generar')
  @UseGuards(PlataformaAdminGuard)
  async generarBilling(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: GenerarBillingDto,
  ) {
    return this.billing.generarPeriodo(
      auth.userId,
      dto.puntoVentaId,
      dto.periodo,
    );
  }

  /** Alta de tenant + invitación del primer admin. Devuelve el link. */
  @Post('tenants')
  @UseGuards(PlataformaAdminGuard)
  crearTenant(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: CrearTenantDto,
  ) {
    return this.service.crearTenant(auth.userId, dto);
  }
}
