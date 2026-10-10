import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { Permiso } from '../auth/permiso.decorator';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { SolicitudesAltaService } from './solicitudes-alta.service';
import { ResolverAltaDto, SolicitudAltaDto } from './dto/solicitud-alta.dto';

@Controller('solicitudes-alta-clientes')
@Permiso('crm.aprobar_altas')
export class SolicitudesAltaController {
  constructor(private readonly service: SolicitudesAltaService) {}
  @Get('enlace') enlace(@CurrentSession() auth: CurrentAuth) {
    return this.service.enlace(auth.tenantId);
  }
  @Post('enlace') habilitar(@CurrentSession() auth: CurrentAuth) {
    return this.service.habilitar(auth.tenantId);
  }
  @Post('enlace/renovar') renovar(@CurrentSession() auth: CurrentAuth) {
    return this.service.cambiarEnlace(auth.tenantId, true);
  }
  @Delete('enlace') deshabilitar(@CurrentSession() auth: CurrentAuth) {
    return this.service.cambiarEnlace(auth.tenantId, false);
  }
  @Get() listar(
    @CurrentSession() auth: CurrentAuth,
    @Query('estado') estado?: string,
    @Query('pagina', new DefaultValuePipe(1), ParseIntPipe) pagina = 1,
  ) {
    if (pagina < 1 || pagina > 10000)
      throw new BadRequestException('Página inválida.');
    return this.service.listar(auth.tenantId, estado, pagina);
  }
  @Get(':id') detalle(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detalle(auth.tenantId, id);
  }
  @Post(':id/decision') decidir(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolverAltaDto,
  ) {
    return this.service.decidir(auth, id, dto);
  }
}
@Controller('registro-clientes')
@Public()
export class RegistroClientesPublicoController {
  constructor(private readonly service: SolicitudesAltaService) {}
  @Get(':token') ver(@Param('token') token: string) {
    return this.service.publico(token);
  }
  @Post(':token')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  solicitar(@Param('token') token: string, @Body() dto: SolicitudAltaDto) {
    return this.service.solicitar(token, dto);
  }
}
