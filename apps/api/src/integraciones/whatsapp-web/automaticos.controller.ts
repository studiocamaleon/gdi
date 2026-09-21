import { RequiereCapacidad } from '../../suscripciones/capacidad.guard';
import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { RolSistema } from '@prisma/client';
import { Roles } from '../../auth/roles.decorator';
import { Permiso } from '../../auth/permiso.decorator';
import { CurrentSession } from '../../auth/current-auth.decorator';
import type { CurrentAuth } from '../../auth/auth.types';
import {
  ConfigurarWebDto,
  DispositivoWebDto,
  ReservaWebDto,
  ResultadoWebDto,
} from './automaticos.dto';
import { AutomaticosWebService } from './automaticos.service';

@Permiso('configuracion.gestionar')
@Roles(RolSistema.ADMINISTRADOR)
@Controller('chrome-whatsapp/automaticos')
export class AutomaticosWebController {
  constructor(private readonly service: AutomaticosWebService) {}
  @RequiereCapacidad('whatsapp_web')
  @Get('estado')
  @Header('Cache-Control', 'no-store')
  estado(@CurrentSession() auth: CurrentAuth) {
    return this.service.estado(auth.tenantId);
  }
  @RequiereCapacidad('whatsapp_web')
  @Put('configuracion')
  configurar(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: ConfigurarWebDto,
  ) {
    return this.service.configurar(auth.tenantId, dto);
  }
  @RequiereCapacidad('whatsapp_web')
  @Post('prueba')
  prueba(@CurrentSession() auth: CurrentAuth, @Body() dto: DispositivoWebDto) {
    return this.service.prueba(auth.tenantId, dto);
  }
  @RequiereCapacidad('whatsapp_web')
  @Post('reservar')
  reservar(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: DispositivoWebDto,
  ) {
    return this.service.reservar(auth.tenantId, dto);
  }
  @RequiereCapacidad('whatsapp_web')
  @Post(':id/iniciar')
  iniciar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReservaWebDto,
  ) {
    return this.service.iniciar(auth.tenantId, id, dto);
  }
  @Post(':id/resultado')
  resultado(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResultadoWebDto,
  ) {
    return this.service.resultado(auth.tenantId, id, dto);
  }
}
