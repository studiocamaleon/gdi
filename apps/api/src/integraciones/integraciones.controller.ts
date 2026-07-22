import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ProveedorIntegracion, RolSistema } from '@prisma/client';

import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import { Roles } from '../auth/roles.decorator';
import { ConectarWatiDto, ProbarEnvioWatiDto } from './dto/integraciones.dto';
import { IntegracionesService } from './integraciones.service';

/**
 * Configuración → Integraciones.
 *
 * Todo lo que escribe pide ADMINISTRADOR: conectar una integración es dar
 * acceso a los datos de los clientes del tenant y, en el caso de Wati, poder
 * mandarles mensajes desde su número oficial. No es una preferencia de
 * usuario.
 */
@Controller('integraciones')
export class IntegracionesController {
  constructor(private readonly service: IntegracionesService) {}

  @Get()
  async listar(): Promise<{
    integraciones: Awaited<ReturnType<IntegracionesService['listar']>>;
    cifradoDisponible: boolean;
  }> {
    return {
      integraciones: await this.service.listar(),
      // Si el entorno no tiene clave de cifrado, la UI lo dice ANTES de
      // pedirle al usuario que pegue un token que no vamos a poder guardar.
      cifradoDisponible: this.service.cifradoDisponible,
    };
  }

  /** Sólo lectura: qué plantillas hay hoy en la cuenta de Wati del tenant. */
  @Get('wati/plantillas')
  plantillasWati() {
    return this.service.plantillasWati();
  }

  /** Somete una plantilla del catálogo de Grafo a Meta. */
  @Post('wati/plantillas/:codigo/someter')
  @Roles(RolSistema.ADMINISTRADOR)
  someterPlantillaWati(@Param('codigo') codigo: string) {
    return this.service.someterPlantillaWati(codigo);
  }

  /** Envío de prueba a un número propio, antes de encender la integración. */
  @Post('wati/probar-envio')
  @Roles(RolSistema.ADMINISTRADOR)
  probarEnvioWati(@Body() dto: ProbarEnvioWatiDto) {
    return this.service.probarEnvioWati(dto);
  }

  @Get(':proveedor')
  obtener(
    @Param('proveedor', new ParseEnumPipe(ProveedorIntegracion))
    proveedor: ProveedorIntegracion,
  ) {
    return this.service.obtener(proveedor);
  }

  @Put('wati')
  @Roles(RolSistema.ADMINISTRADOR)
  conectarWati(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: ConectarWatiDto,
  ) {
    return this.service.conectarWati(auth, dto);
  }

  @Post(':proveedor/probar')
  @Roles(RolSistema.ADMINISTRADOR)
  probar(
    @CurrentSession() auth: CurrentAuth,
    @Param('proveedor', new ParseEnumPipe(ProveedorIntegracion))
    proveedor: ProveedorIntegracion,
  ) {
    return this.service.probar(auth, proveedor);
  }

  @Delete(':proveedor')
  @Roles(RolSistema.ADMINISTRADOR)
  async desconectar(
    @Param('proveedor', new ParseEnumPipe(ProveedorIntegracion))
    proveedor: ProveedorIntegracion,
  ): Promise<{ ok: true }> {
    await this.service.desconectar(proveedor);
    return { ok: true };
  }
}
