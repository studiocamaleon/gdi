import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import type { CurrentAuth } from '../auth/auth.types';
import { CurrentSession } from '../auth/current-auth.decorator';
import {
  AssignProductoAdicionalDto,
  AssignProductoVariantesRutaMasivaDto,
  AssignProductoMotorDto,
  UpdateProductoPrecioDto,
  UpdateProductoPrecioEspecialClientesDto,
  AssignVarianteRutaDto,
  CotizarProductoVarianteDto,
  CreateProductoVarianteDto,
  UpsertProductoChecklistDto,
  UpsertProductoAdicionalServicioPricingDto,
  UpsertVarianteOpcionesProductivasDto,
  SetVarianteAdicionalRestrictionDto,
  UpsertProductoAdicionalEfectoDto,
  UpsertProductoAdicionalDto,
  PreviewImposicionProductoVarianteDto,
  UpdateProductoRutaPolicyDto,
  UpsertProductoMotorConfigDto,
  UpsertVarianteMotorOverrideDto,
  UpdateProductoVarianteDto,
  UpsertFamiliaProductoDto,
  UpsertProductoImpuestoDto,
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

  @Get('adicionales')
  getAdicionales(@CurrentSession() auth: CurrentAuth) {
    return this.service.findAdicionalesCatalogo(auth);
  }

  @Post('adicionales')
  createAdicional(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertProductoAdicionalDto,
  ) {
    return this.service.createAdicionalCatalogo(auth, payload);
  }

  @Put('adicionales/:id')
  updateAdicional(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertProductoAdicionalDto,
  ) {
    return this.service.updateAdicionalCatalogo(auth, id, payload);
  }

  @Put('adicionales/:id/toggle')
  toggleAdicional(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.service.toggleAdicionalCatalogo(auth, id);
  }

  @Get('adicionales/:id/efectos')
  getAdicionalEfectos(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.service.findAdicionalEfectos(auth, id);
  }

  @Post('adicionales/:id/efectos')
  createAdicionalEfecto(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertProductoAdicionalEfectoDto,
  ) {
    return this.service.createAdicionalEfecto(auth, id, payload);
  }

  @Put('adicionales/:id/efectos/:efectoId')
  updateAdicionalEfecto(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Param('efectoId') efectoId: string,
    @Body() payload: UpsertProductoAdicionalEfectoDto,
  ) {
    return this.service.updateAdicionalEfecto(auth, id, efectoId, payload);
  }

  @Put('adicionales/:id/efectos/:efectoId/toggle')
  toggleAdicionalEfecto(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Param('efectoId') efectoId: string,
  ) {
    return this.service.toggleAdicionalEfecto(auth, id, efectoId);
  }

  @Delete('adicionales/:id/efectos/:efectoId')
  deleteAdicionalEfecto(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Param('efectoId') efectoId: string,
  ) {
    return this.service.deleteAdicionalEfecto(auth, id, efectoId);
  }

  @Get('adicionales/:id/servicio-pricing')
  getAdicionalServicioPricing(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.service.getAdicionalServicioPricing(auth, id);
  }

  @Put('adicionales/:id/servicio-pricing')
  upsertAdicionalServicioPricing(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertProductoAdicionalServicioPricingDto,
  ) {
    return this.service.upsertAdicionalServicioPricing(auth, id, payload);
  }

  @Post('familias')
  createFamilia(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertFamiliaProductoDto,
  ) {
    return this.service.createFamilia(auth, payload);
  }

  @Get('impuestos')
  getImpuestos(@CurrentSession() auth: CurrentAuth) {
    return this.service.findImpuestos(auth);
  }

  @Post('impuestos')
  createImpuesto(
    @CurrentSession() auth: CurrentAuth,
    @Body() payload: UpsertProductoImpuestoDto,
  ) {
    return this.service.createImpuesto(auth, payload);
  }

  @Put('impuestos/:id')
  updateImpuesto(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertProductoImpuestoDto,
  ) {
    return this.service.updateImpuesto(auth, id, payload);
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

  @Put(':id/precio')
  updateProductoPrecio(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpdateProductoPrecioDto,
  ) {
    return this.service.updateProductoPrecio(auth, id, payload);
  }

  @Put(':id/precio-especial-clientes')
  updateProductoPrecioEspecialClientes(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpdateProductoPrecioEspecialClientesDto,
  ) {
    return this.service.updateProductoPrecioEspecialClientes(auth, id, payload);
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

  @Get(':id/checklist')
  getProductoChecklist(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.service.getProductoChecklist(auth, id);
  }

  @Put(':id/checklist')
  upsertProductoChecklist(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: UpsertProductoChecklistDto,
  ) {
    return this.service.upsertProductoChecklist(auth, id, payload);
  }

  @Get(':id/adicionales')
  getProductoAdicionales(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
  ) {
    return this.service.findProductoAdicionales(auth, id);
  }

  @Put(':id/adicionales')
  assignProductoAdicional(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Body() payload: AssignProductoAdicionalDto,
  ) {
    return this.service.assignProductoAdicional(auth, id, payload);
  }

  @Delete(':id/adicionales/:adicionalId')
  removeProductoAdicional(
    @CurrentSession() auth: CurrentAuth,
    @Param('id') id: string,
    @Param('adicionalId') adicionalId: string,
  ) {
    return this.service.removeProductoAdicional(auth, id, adicionalId);
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

  @Get('variantes/:varianteId/opciones-productivas')
  getVarianteOpcionesProductivas(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId') varianteId: string,
  ) {
    return this.service.getVarianteOpcionesProductivas(auth, varianteId);
  }

  @Put('variantes/:varianteId/opciones-productivas')
  upsertVarianteOpcionesProductivas(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId') varianteId: string,
    @Body() payload: UpsertVarianteOpcionesProductivasDto,
  ) {
    return this.service.upsertVarianteOpcionesProductivas(auth, varianteId, payload);
  }

  @Delete('variantes/:varianteId')
  deleteVariante(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId') varianteId: string,
  ) {
    return this.service.deleteVariante(auth, varianteId);
  }

  @Get('variantes/:varianteId/adicionales/restricciones')
  getVarianteAdicionalesRestricciones(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId') varianteId: string,
  ) {
    return this.service.findVarianteAdicionalesRestricciones(auth, varianteId);
  }

  @Put('variantes/:varianteId/adicionales/restricciones')
  setVarianteAdicionalRestriccion(
    @CurrentSession() auth: CurrentAuth,
    @Param('varianteId') varianteId: string,
    @Body() payload: SetVarianteAdicionalRestrictionDto,
  ) {
    return this.service.setVarianteAdicionalRestriccion(auth, varianteId, payload);
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
