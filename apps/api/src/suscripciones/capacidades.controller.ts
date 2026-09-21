import { Controller, Get, Header } from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { CapacidadesEmpresaService } from './capacidades-empresa.service';
import { SoloAutenticado } from '../auth/permiso.decorator';

@SoloAutenticado()
@Controller('capacidades')
export class CapacidadesController {
  constructor(private readonly capacidades: CapacidadesEmpresaService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  async actuales(@CurrentSession() auth: CurrentAuth) {
    const actual = await this.capacidades.actual(auth.tenantId);
    return { funciones: actual.contrato.funciones };
  }
}
