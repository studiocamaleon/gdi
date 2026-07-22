import { Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { EtaService } from './eta.service';

@Controller('eta')
export class EtaController {
  constructor(private readonly eta: EtaService) {}

  /** Precisión de las promesas cerradas (opcional: rango por congeladaEl). */
  @Get('precision')
  precision(
    @CurrentSession() auth: CurrentAuth,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.eta.precision(auth, { desde, hasta });
  }

  /** Serie diaria de la cola por estación (F2). */
  @Get('colas')
  colas(
    @CurrentSession() auth: CurrentAuth,
    @Query('estacion') estacionKey?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.eta.seriesColas(auth.tenantId, { estacionKey, desde, hasta });
  }

  /** Dispara la foto del día para este tenant (backfill / "actualizar ahora"). */
  @Post('snapshot')
  async snapshot(@CurrentSession() auth: CurrentAuth) {
    await this.eta.snapshotDiario(auth.tenantId);
    return { ok: true };
  }
}
