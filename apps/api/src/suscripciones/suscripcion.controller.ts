import { BadRequestException, Controller, Get, Post } from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import { CurrentSession } from '../auth/current-auth.decorator';
import { Roles } from '../auth/roles.decorator';
import { ProhibidoImpersonando } from '../auth/prohibido-impersonando.decorator';
import { SuscripcionesService } from './suscripciones.service';
import type { CurrentAuth } from '../auth/auth.types';

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
@Controller('suscripcion')
export class SuscripcionController {
  constructor(private readonly suscripciones: SuscripcionesService) {}

  @Get()
  @Roles(RolSistema.ADMINISTRADOR)
  @ProhibidoImpersonando()
  estado(@CurrentSession() auth: CurrentAuth) {
    return this.suscripciones.estadoParaTenant(auth.tenantId, auth.email);
  }

  /**
   * Abre el portal de Paddle (medio de pago, facturas, cancelación). Devuelve
   * la URL para que el front redirija; la sesión es de un solo uso y expira,
   * así que se pide en el momento y no se guarda.
   */
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
