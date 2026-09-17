import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso, SoloAutenticado } from '../auth/permiso.decorator';
import { CotizacionesService } from './cotizaciones.service';
import { TipoCambioService } from './tipo-cambio.service';
import { CrearTipoCambioDto } from './tipo-cambio.dto';

@Controller('cotizaciones')
export class CotizacionesController {
  constructor(
    private readonly cotizaciones: CotizacionesService,
    private readonly cambio: TipoCambioService,
  ) {}

  @Get('tipo-cambio/configuracion')
  @SoloAutenticado()
  configuracion(@CurrentSession() auth: CurrentAuth) {
    return this.cambio.configuracion(auth.tenantId);
  }

  @Patch('tipo-cambio/configuracion')
  @Permiso('configuracion.gestionar')
  configurar(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: CrearTipoCambioDto,
  ) {
    return this.cambio.guardarConfiguracion(auth.tenantId, dto);
  }

  @Post('tipo-cambio')
  @Permiso('comercial.ver', 'inventario.ver')
  crearCambio(
    @CurrentSession() auth: CurrentAuth,
    @Body() dto: CrearTipoCambioDto,
  ) {
    return this.cambio.crear(auth.tenantId, auth.userId, dto);
  }

  @Get('tipo-cambio/:id')
  @SoloAutenticado()
  obtenerCambio(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.cambio.obtener(auth.tenantId, id);
  }

  @Get('dolar')
  @SoloAutenticado()
  @Header('Cache-Control', 'private, no-store')
  dolar(@CurrentSession() auth: CurrentAuth) {
    return this.cotizaciones.dolar(auth.tenantId);
  }
}
