import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Permiso } from '../../auth/permiso.decorator';
import { CrearTrabajoNestingOpenNestDto } from './geometria-jobs.dto';
import { GeometriaJobsService } from './geometria-jobs.service';

interface RequestConTenant extends Request {
  auth?: { tenantId: string; userId: string };
}

@Permiso('comercial.ver')
@Controller('trabajos-geometria')
export class GeometriaJobsController {
  constructor(private readonly jobs: GeometriaJobsService) {}

  @Post('nesting-irregular')
  @HttpCode(HttpStatus.ACCEPTED)
  crear(
    @Body() dto: CrearTrabajoNestingOpenNestDto,
    @Req() req: RequestConTenant,
  ) {
    return this.jobs.crear({ tenantId: exigirTenant(req), dto });
  }

  @Get(':id')
  consultar(@Param('id') id: string, @Req() req: RequestConTenant) {
    return this.jobs.consultar(exigirTenant(req), id);
  }

  @Delete(':id')
  cancelar(@Param('id') id: string, @Req() req: RequestConTenant) {
    return this.jobs.cancelar(exigirTenant(req), id);
  }
}

function exigirTenant(req: RequestConTenant): string {
  if (!req.auth?.tenantId)
    throw new UnauthorizedException(
      'Falta tenant en el contexto de autenticación',
    );
  return req.auth.tenantId;
}
