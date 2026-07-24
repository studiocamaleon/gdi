import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsEmail,
  IsIn,
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
import { ImpersonacionService } from './impersonacion.service';
import { NegocioService } from './negocio.service';
import { PlataformaGuard } from './plataforma.guard';
import { PlataformaService } from './plataforma.service';

export class CambiarPlanDto {
  @IsUUID()
  planId: string;
}

export class DescribirPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(220)
  descripcion?: string;
}

/** Vincular un plan con su precio en Paddle. Vacío = desvincular. */
export class VincularPaddleDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^pri_[a-zA-Z0-9]+$/, {
    message: 'El id de precio de Paddle tiene la forma pri_xxxxxxxx.',
  })
  priceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^pro_[a-zA-Z0-9]+$/, {
    message: 'El id de producto de Paddle tiene la forma pro_xxxxxxxx.',
  })
  productId?: string;

  /** 'mensual' (default) o 'anual': el mismo plan tiene un precio por ciclo. */
  @IsOptional()
  @IsIn(['mensual', 'anual'])
  ciclo?: 'mensual' | 'anual';
}

export class SuspenderTenantDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  motivo: string;
}

export class IniciarImpersonacionDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  @MinLength(5)
  @MaxLength(300)
  motivo: string;
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
    private readonly impersonacion: ImpersonacionService,
    private readonly negocio: NegocioService,
  ) {}

  /** La consola completa: resumen + tenants + auditoría + quién mira. */
  @Get('consola')
  consola(@CurrentSession() auth: CurrentAuth) {
    return this.service.consola(auth.userId, auth.esPlataforma === true);
  }

  /**
   * Inteligencia de negocio del ecosistema: ventas/facturación/categorías
   * agregadas cross-tenant. Endpoint aparte (lazy) para no frenar la consola.
   * Ver docs/control-plane-negocio-diseno.md
   */
  @Get('negocio')
  negocioEcosistema(@Query('periodo') periodo?: string) {
    return this.negocio.negocio(periodo);
  }

  @Get('planes')
  planes() {
    return this.service.planes();
  }

  /** Edita la bajada comercial del plan. */
  @Put('planes/:id/descripcion')
  @UseGuards(PlataformaAdminGuard)
  describirPlan(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DescribirPlanDto,
  ) {
    return this.service.describirPlan(auth.userId, id, dto.descripcion ?? null);
  }

  /** Vincula un plan con su precio de Paddle. Devuelve el catálogo actualizado. */
  @Put('planes/:id/paddle')
  @UseGuards(PlataformaAdminGuard)
  vincularPlanPaddle(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VincularPaddleDto,
  ) {
    return this.service.vincularPlanPaddle(
      auth.userId,
      id,
      dto.priceId ?? null,
      dto.productId ?? null,
      dto.ciclo ?? 'mensual',
    );
  }

  // ── Impersonación (etapa C) ──────────────────────────────────────────

  @Get('impersonacion')
  sesionesActivas() {
    return this.impersonacion.activas();
  }

  /** Entra a un tenant. Devuelve el token con el que el front "entra". */
  @Post('impersonacion')
  @UseGuards(PlataformaAdminGuard)
  iniciarImpersonacion(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: IniciarImpersonacionDto,
  ) {
    return this.impersonacion.iniciar(auth.userId, dto.tenantId, dto.motivo);
  }

  @Post('impersonacion/:id/cerrar')
  async cerrarImpersonacion(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.impersonacion.cerrar(auth.userId, id);
    return { ok: true };
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
