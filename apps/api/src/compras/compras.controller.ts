import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  DefaultValuePipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { Permiso } from '../auth/permiso.decorator';
import { CurrentSession } from '../auth/current-auth.decorator';
import type { CurrentAuth } from '../auth/auth.types';
import { ComprasService } from './compras.service';
import {
  AccionCompraDto,
  CrearCompraDto,
  OfertaCompraDto,
  RecibirCompraDto,
} from './dto/compras.dto';
@Controller('compras')
@Permiso('inventario.ver')
export class ComprasController {
  constructor(private readonly service: ComprasService) {}
  private page(value: number) {
    if (value < 1 || value > 100000)
      throw new BadRequestException('Página no válida.');
    return value;
  }
  @Get('catalogo') catalogo(@CurrentSession() a: CurrentAuth) {
    return this.service.catalogo(a);
  }
  @Get('necesidades') necesidades(
    @CurrentSession() a: CurrentAuth,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return this.service.necesidades(a, this.page(page));
  }
  @Get() listar(
    @CurrentSession() a: CurrentAuth,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('estado') estado?: string,
  ) {
    if (
      estado &&
      ![
        'BORRADOR',
        'EMITIDA',
        'PARCIAL',
        'RECIBIDA',
        'CERRADA',
        'CANCELADA',
      ].includes(estado)
    )
      throw new BadRequestException('Estado no válido.');
    return this.service.listar(a, this.page(page), estado);
  }
  @Get(':id') detalle(
    @CurrentSession() a: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detalle(a, id);
  }
  @Put('ofertas') @Permiso('inventario.gestionar') oferta(
    @CurrentSession() a: CurrentAuth,
    @Body() d: OfertaCompraDto,
  ) {
    return this.service.guardarOferta(a, d);
  }
  @Post() @Permiso('inventario.gestionar') crear(
    @CurrentSession() a: CurrentAuth,
    @Body() d: CrearCompraDto,
  ) {
    return this.service.crear(a, d);
  }
  @Post(':id/acciones') @Permiso('inventario.gestionar') actuar(
    @CurrentSession() a: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: AccionCompraDto,
  ) {
    return this.service.actuar(a, id, d);
  }
  @Post(':id/recepciones') @Permiso('inventario.gestionar') recibir(
    @CurrentSession() a: CurrentAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: RecibirCompraDto,
  ) {
    return this.service.recibir(a, id, d);
  }
}
