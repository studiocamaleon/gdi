import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { SinTenant } from '../common/sin-tenant.decorator';
import { PlataformaGuard } from './plataforma.guard';
import { PlataformaService } from './plataforma.service';

/**
 * El namespace del control plane. Dos marcas a nivel de clase, y las dos son
 * la definición de este plano:
 *  - @UseGuards(PlataformaGuard): sólo staff (User.rolPlataforma).
 *  - @SinTenant(): sin contexto de tenant — el guard de aislamiento no
 *    filtra, porque acá se lee A TRAVÉS de los tenants.
 * Ver docs/control-plane-diseno.md
 */
@Controller('plataforma')
@UseGuards(PlataformaGuard)
@SinTenant()
export class PlataformaController {
  constructor(private readonly service: PlataformaService) {}

  /** La consola completa: resumen + tenants + auditoría + quién mira. */
  @Get('consola')
  consola(@CurrentSession() auth: CurrentAuth) {
    return this.service.consola(auth.userId);
  }
}
