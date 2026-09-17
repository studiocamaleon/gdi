import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { OrdenesTrabajoService } from './ordenes-trabajo.service';
import { AccionPasoOrdenTrabajoDto } from './dto/accion-paso.dto';
import { CompletarColaDto } from './dto/completar-cola.dto';

/** Vive junto al comando canónico para no crear una dependencia circular con ETA. */
@Controller('produccion/colas')
export class AccionesColaController {
  constructor(private readonly ordenes: OrdenesTrabajoService) {}

  @Permiso('produccion.ejecutar', 'produccion.supervisar')
  @Post(':maquinaId/pasos/:pasoId/accion')
  @HttpCode(200)
  accion(
    @CurrentSession() auth: CurrentAuth,
    @Param('maquinaId', ParseUUIDPipe) maquinaId: string,
    @Param('pasoId', ParseUUIDPipe) pasoId: string,
    @Body() dto: AccionPasoOrdenTrabajoDto,
  ) {
    return this.ordenes.accionTrabajoCola(auth, maquinaId, pasoId, dto);
  }

  @Permiso('produccion.ejecutar', 'produccion.supervisar')
  @Post(':maquinaId/completar')
  @HttpCode(200)
  completar(
    @CurrentSession() auth: CurrentAuth,
    @Param('maquinaId', ParseUUIDPipe) maquinaId: string,
    @Body() dto: CompletarColaDto,
  ) {
    return this.ordenes.completarTrabajosCola(
      auth,
      maquinaId,
      dto.pasoIds,
      dto.tiempos,
    );
  }
}
