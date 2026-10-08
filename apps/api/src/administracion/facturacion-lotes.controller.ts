import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { Permiso } from '../auth/permiso.decorator';
import { IniciarLoteFacturacionDto } from './dto/comprobante.dto';
import { FacturacionLotesService } from './facturacion-lotes.service';

@Controller('administracion/facturacion')
export class FacturacionLotesController {
  constructor(private readonly lotes: FacturacionLotesService) {}

  @Permiso('administracion.facturacion.gestionar')
  @Post(['lote', 'lotes'])
  @HttpCode(202)
  async iniciar(
    @CurrentSession() auth: CurrentAuth,
    @Body() body: IniciarLoteFacturacionDto,
  ) {
    return this.lotes.presentar(await this.lotes.iniciar(auth, body));
  }

  @Permiso('administracion.facturacion.ver')
  @Get('lotes')
  async listar(
    @CurrentSession() auth: CurrentAuth,
    @Query('activos') activos?: string,
    @Query('cursor', new ParseUUIDPipe({ optional: true })) cursor?: string,
  ) {
    return (
      await this.lotes.listar(auth, { activos: activos === 'true', cursor })
    ).map((lote) => this.lotes.presentar(lote));
  }

  @Permiso('administracion.facturacion.ver')
  @Get('lotes/:id')
  async obtener(
    @CurrentSession() auth: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lotes.presentar(await this.lotes.obtener(auth, id));
  }
}
