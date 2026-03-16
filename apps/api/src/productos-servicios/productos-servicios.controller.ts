import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import {
  AssignProductoVariantesRutaMasivaDto,
  AssignProductoMotorDto,
  AssignVarianteRutaDto,
  CotizarProductoVarianteDto,
  CreateProductoVarianteDto,
  PreviewImposicionProductoVarianteDto,
  UpdateProductoRutaPolicyDto,
  UpsertProductoMotorConfigDto,
  UpsertVarianteMotorOverrideDto,
  UpdateProductoVarianteDto,
  UpsertFamiliaProductoDto,
  UpsertProductoServicioDto,
  UpsertSubfamiliaProductoDto,
} from './dto/productos-servicios.dto';
import { ProductosServiciosService } from './productos-servicios.service';

@Controller('productos-servicios')
export class ProductosServiciosController {
  constructor(private readonly service: ProductosServiciosService) {}

  @Get('familias')
  getFamilias(@CurrentSession() auth: CurrentAuth) {
    return this.service.findFamilias(auth);
  }

  @Get('catalogos/pliegos-impresion')
  getCatalogoPliegosImpresion() {
    return this.service.getCatalogoPliegosImpresion();
  }

  @Get('motores')
  getMotoresCosto() {
    return this.service.getMotoresCosto();
  }

  @Post('familias')
  createFamilia(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertFamiliaProductoDto,
  ) {
    return this.service.createFamilia(auth, payload);
  }

  @Put('familias/:id')
  updateFamilia(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertFamiliaProductoDto,
  ) {
    return this.service.updateFamilia(auth, id, payload);
  }

  @Get('subfamilias')
  getSubfamilias(
    @CurrentSession() auth: CurrentAuth,
    @Query('familiaId') familiaId?: string,
  ) {
    return this.service.findSubfamilias(auth, familiaId);
  }

  @Post('subfamilias')
  createSubfamilia(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertSubfamiliaProductoDto,
  ) {
    return this.service.createSubfamilia(auth, payload);
  }

  @Put('subfamilias/:id')
  updateSubfamilia(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertSubfamiliaProductoDto,
  ) {
    return this.service.updateSubfamilia(auth, id, payload);
  }

  @Get()
  getProductos(@CurrentSession() auth: CurrentAuth) {
    return this.service.findProductos(auth);
  }

  @Get(':id')
  getProducto(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.service.findProducto(auth, id);
  }

  @Post()
  createProducto(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertProductoServicioDto,
  ) {
    return this.service.createProducto(auth, payload);
  }

  @Put(':id')
  updateProducto(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertProductoServicioDto,
  ) {
    return this.service.updateProducto(auth, id, payload);
  }

  @Put(':id/motor')
  assignProductoMotor(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: AssignProductoMotorDto,
  ) {
    return this.service.assignProductoMotor(auth, id, payload);
  }

  @Get(':id/motor-config')
  getProductoMotorConfig(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.service.getProductoMotorConfig(auth, id);
  }

  @Put(':id/motor-config')
  upsertProductoMotorConfig(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertProductoMotorConfigDto,
  ) {
    return this.service.upsertProductoMotorConfig(auth, id, payload);
  }

  @Put(':id/ruta-policy')
  updateProductoRutaPolicy(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpdateProductoRutaPolicyDto,
  ) {
    return this.service.updateProductoRutaPolicy(auth, id, payload);
  }

  @Put(':id/variantes/ruta-masiva')
  assignProductoVariantesRutaMasiva(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: AssignProductoVariantesRutaMasivaDto,
  ) {
    return this.service.assignProductoVariantesRutaMasiva(auth, id, payload);
  }

  @Get(':id/variantes')
  getVariantes(@CurrentSession() auth: CurrentAuth, @Param('id') id: string) {
    return this.service.findVariantes(auth, id);
  }

  @Post(':id/variantes')
  createVariante(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: CreateProductoVarianteDto,
  ) {
    return this.service.createVariante(auth, id, payload);
  }

  @Put('variantes/:varianteId')
  updateVariante(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId') varianteId: string,
    @Body() payload: UpdateProductoVarianteDto,
  ) {
    return this.service.updateVariante(auth, varianteId, payload);
  }

  @Delete('variantes/:varianteId')
  deleteVariante(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId') varianteId: string,
  ) {
    return this.service.deleteVariante(auth, varianteId);
  }

  @Put('variantes/:varianteId/ruta')
  assignVarianteRuta(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId') varianteId: string,
    @Body() payload: AssignVarianteRutaDto,
  ) {
    return this.service.assignVarianteRuta(auth, varianteId, payload);
  }

  @Get('variantes/:varianteId/motor-override')
  getVarianteMotorOverride(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId') varianteId: string,
  ) {
    return this.service.getVarianteMotorOverride(auth, varianteId);
  }

  @Put('variantes/:varianteId/motor-override')
  upsertVarianteMotorOverride(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId') varianteId: string,
    @Body() payload: UpsertVarianteMotorOverrideDto,
  ) {
    return this.service.upsertVarianteMotorOverride(auth, varianteId, payload);
  }

  @Post('variantes/:varianteId/cotizar')
  cotizarVariante(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId') varianteId: string,
    @Body() payload: CotizarProductoVarianteDto,
  ) {
    return this.service.cotizarVariante(auth, varianteId, payload);
  }

  @Post('variantes/:varianteId/imposicion-preview')
  previewImposicionVariante(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId') varianteId: string,
    @Body() payload: PreviewImposicionProductoVarianteDto,
  ) {
    return this.service.previewVarianteImposicion(auth, varianteId, payload);
  }

  @Get('variantes/:varianteId/cotizaciones')
  getVarianteCotizaciones(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId') varianteId: string,
  ) {
    return this.service.getVarianteCotizaciones(auth, varianteId);
  }

  @Get('cotizaciones/:snapshotId')
  getCotizacionById(
    @CurrentSession() auth: CurrentAuth,
    @Param('snapshotId') snapshotId: string,
  ) {
    return this.service.getCotizacionById(auth, snapshotId);
  }
}
