import { Controller, Get, Query } from '@nestjs/common';
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
}
