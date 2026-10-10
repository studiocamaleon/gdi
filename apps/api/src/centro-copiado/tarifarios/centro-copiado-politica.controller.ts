import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Permiso } from '../../auth/permiso.decorator';
import { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { CentroCopiadoPoliticaService } from './centro-copiado-politica.service';
import { GuardarPoliticaPreciosDto } from './politica-precios.dto';

interface RequestConAuth extends Request {
  auth?: { tenantId: string; userId: string };
}

@Permiso('configuracion.copiado.ver')
@Controller('centro-copiado/politica-precios/borrador')
export class CentroCopiadoPoliticaController {
  constructor(
    private readonly politica: CentroCopiadoPoliticaService,
    private readonly capacidades: CapacidadesEmpresaService,
  ) {}

  private async contexto(req: RequestConAuth) {
    if (!req.auth?.tenantId || !req.auth.userId)
      throw new UnauthorizedException('Falta el contexto de autenticación.');
    await this.capacidades.exigirIncluida(req.auth.tenantId, 'centro_copiado');
    return req.auth;
  }

  @Get()
  async obtener(@Req() req: RequestConAuth) {
    return this.politica.obtenerBorrador((await this.contexto(req)).tenantId);
  }

  @Put()
  @Permiso('configuracion.copiado.gestionar')
  async guardar(
    @Req() req: RequestConAuth,
    @Body() dto: GuardarPoliticaPreciosDto,
  ) {
    const { tenantId, userId } = await this.contexto(req);
    return this.politica.guardarBorrador(tenantId, userId, dto);
  }

  @Get('previsualizacion')
  async previsualizar(@Req() req: RequestConAuth) {
    return this.politica.previsualizar((await this.contexto(req)).tenantId);
  }
}
