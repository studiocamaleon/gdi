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
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { PerfilesCadService } from './perfiles-cad.service';
import { PerfilCadDto, SimularPerfilCadDto } from './perfiles-cad.dto';

@Controller('impresion/cad')
@Permiso('configuracion.gestionar')
export class PerfilesCadController {
  constructor(private readonly service: PerfilesCadService) {}
  @Get('destinos/:id/opciones')
  opciones(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.opciones(auth.tenantId, id);
  }
  @Post('perfiles')
  crear(@CurrentSession() auth: CurrentAuth, @Body() dto: PerfilCadDto) {
    return this.service.guardar(auth, dto);
  }
  @Put('perfiles/:id')
  editar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PerfilCadDto,
  ) {
    return this.service.guardar(auth, dto, id);
  }
  @Post('perfiles/:id/prueba')
  @Header('Cache-Control', 'no-store')
  prueba(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SimularPerfilCadDto,
  ) {
    return this.service.prueba(auth, id, dto);
  }
  @Post('perfiles/:id/cotizar-muestra')
  cotizar(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SimularPerfilCadDto,
  ) {
    return this.service.cotizarMuestra(auth, id, dto);
  }
}
