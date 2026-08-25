import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { RolSistema } from '@prisma/client';
import { CurrentSession } from '../auth/current-auth.decorator';
import { Roles } from '../auth/roles.decorator';
import { ProhibidoImpersonando } from '../auth/prohibido-impersonando.decorator';
import { SuscripcionesService } from './suscripciones.service';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { PermitirSuscripcionInactiva } from './permitir-suscripcion-inactiva.decorator';

export class CambiarPlanTenantDto {
  @IsString()
  @MaxLength(40)
  planCodigo: string;

  @IsOptional()
  @IsIn(['mensual', 'anual'])
  ciclo?: 'mensual' | 'anual';
}

export class SincronizarDto {
  @IsString()
  @MaxLength(80)
  transaccionId: string;
}

/**
 * La suscripción vista POR EL TENANT (su plan, y a qué puede pasarse).
 *
 * Sólo ADMINISTRADOR: contratar y cambiar de plan es plata de la empresa, no
 * cosa de un operador.
 *
 * @ProhibidoImpersonando: el soporte de Grafo entra al tenant para ayudarlo,
 * no para contratarle un plan. Que la decisión de gastar sea siempre del
 * dueño, aunque estemos adentro asistiéndolo.
 * Ver docs/suscripciones-cobro-diseno.md
 */
@Permiso('configuracion.ver')
@PermitirSuscripcionInactiva()
@Controller('suscripcion')
export class SuscripcionController {
  constructor(private readonly suscripciones: SuscripcionesService) {}

  @Get()
  @Roles(RolSistema.ADMINISTRADOR)
  @ProhibidoImpersonando()
  estado(@CurrentSession() auth: CurrentAuth) {
    return this.suscripciones.sincronizarEstadoActual(
      auth.tenantId,
      auth.email,
    );
  }

  /** Fuerza una verificación después de actualizar el medio de pago. */
  @Post('actualizar-estado')
  @Roles(RolSistema.ADMINISTRADOR)
  @ProhibidoImpersonando()
  actualizarEstado(@CurrentSession() auth: CurrentAuth) {
    return this.suscripciones.sincronizarEstadoActual(
      auth.tenantId,
      auth.email,
    );
  }

  /**
   * Cambia el plan sin pedir tarjeta: modifica la suscripción existente con
   * prorrateo. Abrir un checkout crearía una SEGUNDA suscripción y le
   * cobrarían las dos.
   */
  @Permiso('configuracion.gestionar')
  @Post('cambiar-plan')
  @Roles(RolSistema.ADMINISTRADOR)
  @ProhibidoImpersonando()
  cambiarPlan(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: CambiarPlanTenantDto,
  ) {
    return this.suscripciones.cambiarPlanDeTenant(
      auth.tenantId,
      dto.planCodigo,
      dto.ciclo ?? 'mensual',
      auth.email,
    );
  }

  /** Cuánto se le cobra ahora por ese cambio, antes de confirmarlo. */
  @Permiso('configuracion.gestionar')
  @Post('cambiar-plan/previsualizar')
  @Roles(RolSistema.ADMINISTRADOR)
  @ProhibidoImpersonando()
  previsualizar(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: CambiarPlanTenantDto,
  ) {
    return this.suscripciones.previsualizarCambio(
      auth.tenantId,
      dto.planCodigo,
      dto.ciclo ?? 'mensual',
    );
  }

  /**
   * Trae el alta desde la pasarela apenas cierra el checkout, sin esperar el
   * webhook: el usuario pagó y tiene que ver el resultado ya.
   */
  @Permiso('configuracion.gestionar')
  @Post('sincronizar')
  @Roles(RolSistema.ADMINISTRADOR)
  @ProhibidoImpersonando()
  sincronizar(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: SincronizarDto,
  ) {
    return this.suscripciones.sincronizarDesdeTransaccion(
      auth.tenantId,
      dto.transaccionId,
      auth.email,
    );
  }

  /**
   * URL de descarga del PDF de una factura. Se pide en el momento porque
   * Paddle la firma con vencimiento.
   */
  @Get('facturas/:id/pdf')
  @Roles(RolSistema.ADMINISTRADOR)
  @ProhibidoImpersonando()
  async facturaPdf(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    const r = await this.suscripciones.urlFacturaDeTenant(auth.tenantId, id);
    if (!r) throw new NotFoundException('La factura no existe.');
    return r;
  }

  /** Deshace la cancelación pendiente. */
  @Permiso('configuracion.gestionar')
  @Post('reactivar')
  @Roles(RolSistema.ADMINISTRADOR)
  @ProhibidoImpersonando()
  reactivar(@CurrentSession() auth: CurrentAuth) {
    return this.suscripciones.reactivarSuscripcion(auth.tenantId);
  }

  /**
   * Abre el portal de Paddle (medio de pago, facturas, cancelación). Devuelve
   * la URL para que el front redirija; la sesión es de un solo uso y expira,
   * así que se pide en el momento y no se guarda.
   */
  @Permiso('configuracion.gestionar')
  @Post('portal')
  @Roles(RolSistema.ADMINISTRADOR)
  @ProhibidoImpersonando()
  async portal(@CurrentSession() auth: CurrentAuth) {
    const r = await this.suscripciones.portalDeTenant(auth.tenantId);
    if (!r) {
      throw new BadRequestException(
        'Todavía no hay una suscripción activa en la pasarela de pago.',
      );
    }
    return r;
  }
}
