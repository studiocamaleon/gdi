import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Permiso, RequiereVista } from '../../auth/permiso.decorator';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { CentroCopiadoSimulacionService } from './centro-copiado-simulacion.service';

@Controller('centro-copiado/tarifarios/:id/simulaciones')
@Permiso('finanzas.ver_margenes')
@RequiereVista('configuracion.copiado.ver')
export class CentroCopiadoSimulacionController {
  constructor(
    private readonly simulacion: CentroCopiadoSimulacionService,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}
  @Post()
  async simular(
    @Req() req: Request & { auth?: { tenantId: string; userId: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    if (!req.auth?.tenantId || !req.auth.userId)
      throw new UnauthorizedException('Falta el contexto de autenticación.');
    await this.capacidades.exigirIncluida(req.auth.tenantId, 'centro_copiado');
    return this.simulacion.simular(req.auth.tenantId, id, body);
  }
}
