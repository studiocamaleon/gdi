import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { Permiso } from '../auth/permiso.decorator';
import { CurrentAuth } from '../auth/auth.types';
import { CredencialesMcpService } from './credenciales-mcp.service';
import { CrearCredencialMcpDto } from './credenciales-mcp.dto';

/**
 * Gestión de credenciales MCP ("Conectar tu IA", Configuración →
 * Integraciones). Sólo administradores del tenant (configuracion.gestionar);
 * el service además rechaza que una credencial MCP se gestione a sí misma.
 */
@Controller('mcp/credenciales')
@Permiso('configuracion.gestionar')
export class CredencialesMcpController {
  constructor(private readonly service: CredencialesMcpService) {}

  @Get()
  listar(@Req() req: { auth: CurrentAuth }) {
    return this.service.listar(req.auth);
  }

  @Post()
  crear(
    @Req() req: { auth: CurrentAuth },
    @Body() dto: CrearCredencialMcpDto,
  ) {
    return this.service.crear(req.auth, dto);
  }

  @Delete(':id')
  revocar(
    @Req() req: { auth: CurrentAuth },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.revocar(req.auth, id);
  }
}
