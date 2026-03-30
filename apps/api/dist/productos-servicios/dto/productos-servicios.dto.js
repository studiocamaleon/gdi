"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignVarianteRutaDto = exports.UpdateProductoVarianteDto = exports.CreateProductoVarianteDto = exports.UpsertProductoServicioDto = exports.UpsertSubfamiliaProductoDto = exports.UpsertProductoComisionDto = exports.UpsertProductoImpuestoDto = exports.UpsertFamiliaProductoDto = exports.SetVarianteAdicionalRestrictionDto = exports.AssignProductoAdicionalDto = exports.UpsertProductoAdicionalServicioPricingDto = exports.UpsertProductoAdicionalServicioReglaCostoDto = exports.UpsertProductoAdicionalServicioNivelDto = exports.UpsertProductoAdicionalDto = exports.UpsertProductoAdicionalMaterialDto = exports.UpsertProductoAdicionalEfectoDto = exports.UpsertProductoAdicionalMaterialEffectDto = exports.UpsertProductoAdicionalCostEffectDto = exports.UpsertProductoAdicionalRouteEffectDto = exports.UpsertProductoAdicionalRouteInsertionDto = exports.UpsertProductoAdicionalRouteEffectPasoDto = exports.UpsertProductoAdicionalEfectoScopeDto = exports.UpsertVarianteOpcionesProductivasDto = exports.UpsertVarianteOpcionProductivaDimensionDto = exports.MetodoCalculoPrecioProductoDto = exports.ReglaCostoChecklistDto = exports.TipoChecklistAccionReglaDto = exports.TipoChecklistPreguntaDto = exports.ReglaCostoAdicionalEfectoDto = exports.TipoInsercionRouteEffectDto = exports.TipoProductoAdicionalEfectoDto = exports.ValorOpcionProductivaDto = exports.DimensionOpcionProductivaDto = exports.TipoConsumoAdicionalMaterialDto = exports.MetodoCostoProductoAdicionalDto = exports.TipoProductoAdicionalDto = exports.CarasProductoVarianteDto = exports.TipoImpresionProductoVarianteDto = exports.GranFormatoPanelManualLayoutDto = exports.GranFormatoPanelManualLayoutItemDto = exports.GranFormatoPanelManualItemDto = exports.GranFormatoPanelizadoModoDto = exports.GranFormatoPanelizadoInterpretacionAnchoMaximoDto = exports.GranFormatoPanelizadoDistribucionDto = exports.GranFormatoPanelizadoDireccionDto = exports.GranFormatoImposicionCriterioOptimizacionDto = exports.UnidadComercialProductoDto = exports.TipoVentaGranFormatoDto = exports.EstadoProductoServicioDto = exports.TipoProductoServicioDto = void 0;
exports.PreviewImposicionProductoVarianteDto = exports.CotizarProductoVarianteDto = exports.PreviewGranFormatoCostosDto = exports.PreviewGranFormatoCostoMedidaDto = exports.UpdateGranFormatoChecklistDto = exports.UpsertGranFormatoChecklistPorTecnologiaDto = exports.UpsertProductoChecklistDto = exports.UpsertChecklistPreguntaDto = exports.UpsertChecklistRespuestaDto = exports.UpsertChecklistReglaDto = exports.UpsertChecklistReglaNivelDto = exports.CotizarSeleccionBaseDto = exports.CotizarChecklistRespuestaDto = exports.CotizarAddonConfigDto = exports.UpsertVarianteMotorOverrideDto = exports.UpdateGranFormatoVarianteDto = exports.CreateGranFormatoVarianteDto = exports.UpdateGranFormatoRutaBaseDto = exports.UpsertGranFormatoRutaBaseReglaImpresionDto = exports.UpdateGranFormatoConfigDto = exports.UpdateGranFormatoImposicionDto = exports.GranFormatoImposicionMedidaDto = exports.UpsertProductoMotorConfigDto = exports.UpdateProductoPrecioEspecialClientesDto = exports.UpdateProductoPrecioDto = exports.AssignProductoMotorDto = exports.AssignProductoVariantesRutaMasivaDto = exports.UpdateProductoRutaPolicyDto = exports.UpsertProductoRutaPasoFijoVarianteDto = exports.UpsertProductoRutaPasoFijoItemDto = exports.UpsertProductoRutaBaseMatchingVarianteDto = exports.UpsertProductoRutaBaseMatchingItemDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
var TipoProductoServicioDto;
(function (TipoProductoServicioDto) {
    TipoProductoServicioDto["producto"] = "producto";
    TipoProductoServicioDto["servicio"] = "servicio";
})(TipoProductoServicioDto || (exports.TipoProductoServicioDto = TipoProductoServicioDto = {}));
var EstadoProductoServicioDto;
(function (EstadoProductoServicioDto) {
    EstadoProductoServicioDto["activo"] = "activo";
    EstadoProductoServicioDto["inactivo"] = "inactivo";
})(EstadoProductoServicioDto || (exports.EstadoProductoServicioDto = EstadoProductoServicioDto = {}));
var TipoVentaGranFormatoDto;
(function (TipoVentaGranFormatoDto) {
    TipoVentaGranFormatoDto["m2"] = "m2";
    TipoVentaGranFormatoDto["metro_lineal"] = "metro_lineal";
})(TipoVentaGranFormatoDto || (exports.TipoVentaGranFormatoDto = TipoVentaGranFormatoDto = {}));
var UnidadComercialProductoDto;
(function (UnidadComercialProductoDto) {
    UnidadComercialProductoDto["unidad"] = "unidad";
    UnidadComercialProductoDto["m2"] = "m2";
    UnidadComercialProductoDto["metro_lineal"] = "metro_lineal";
})(UnidadComercialProductoDto || (exports.UnidadComercialProductoDto = UnidadComercialProductoDto = {}));
var GranFormatoImposicionCriterioOptimizacionDto;
(function (GranFormatoImposicionCriterioOptimizacionDto) {
    GranFormatoImposicionCriterioOptimizacionDto["menor_costo_total"] = "menor_costo_total";
    GranFormatoImposicionCriterioOptimizacionDto["menor_desperdicio"] = "menor_desperdicio";
    GranFormatoImposicionCriterioOptimizacionDto["menor_largo_consumido"] = "menor_largo_consumido";
})(GranFormatoImposicionCriterioOptimizacionDto || (exports.GranFormatoImposicionCriterioOptimizacionDto = GranFormatoImposicionCriterioOptimizacionDto = {}));
var GranFormatoPanelizadoDireccionDto;
(function (GranFormatoPanelizadoDireccionDto) {
    GranFormatoPanelizadoDireccionDto["automatica"] = "automatica";
    GranFormatoPanelizadoDireccionDto["vertical"] = "vertical";
    GranFormatoPanelizadoDireccionDto["horizontal"] = "horizontal";
})(GranFormatoPanelizadoDireccionDto || (exports.GranFormatoPanelizadoDireccionDto = GranFormatoPanelizadoDireccionDto = {}));
var GranFormatoPanelizadoDistribucionDto;
(function (GranFormatoPanelizadoDistribucionDto) {
    GranFormatoPanelizadoDistribucionDto["equilibrada"] = "equilibrada";
    GranFormatoPanelizadoDistribucionDto["libre"] = "libre";
})(GranFormatoPanelizadoDistribucionDto || (exports.GranFormatoPanelizadoDistribucionDto = GranFormatoPanelizadoDistribucionDto = {}));
var GranFormatoPanelizadoInterpretacionAnchoMaximoDto;
(function (GranFormatoPanelizadoInterpretacionAnchoMaximoDto) {
    GranFormatoPanelizadoInterpretacionAnchoMaximoDto["total"] = "total";
    GranFormatoPanelizadoInterpretacionAnchoMaximoDto["util"] = "util";
})(GranFormatoPanelizadoInterpretacionAnchoMaximoDto || (exports.GranFormatoPanelizadoInterpretacionAnchoMaximoDto = GranFormatoPanelizadoInterpretacionAnchoMaximoDto = {}));
var GranFormatoPanelizadoModoDto;
(function (GranFormatoPanelizadoModoDto) {
    GranFormatoPanelizadoModoDto["automatico"] = "automatico";
    GranFormatoPanelizadoModoDto["manual"] = "manual";
})(GranFormatoPanelizadoModoDto || (exports.GranFormatoPanelizadoModoDto = GranFormatoPanelizadoModoDto = {}));
class GranFormatoPanelManualItemDto {
    panelIndex;
    usefulWidthMm;
    usefulHeightMm;
    overlapStartMm;
    overlapEndMm;
    finalWidthMm;
    finalHeightMm;
}
exports.GranFormatoPanelManualItemDto = GranFormatoPanelManualItemDto;
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GranFormatoPanelManualItemDto.prototype, "panelIndex", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GranFormatoPanelManualItemDto.prototype, "usefulWidthMm", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GranFormatoPanelManualItemDto.prototype, "usefulHeightMm", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], GranFormatoPanelManualItemDto.prototype, "overlapStartMm", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], GranFormatoPanelManualItemDto.prototype, "overlapEndMm", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GranFormatoPanelManualItemDto.prototype, "finalWidthMm", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GranFormatoPanelManualItemDto.prototype, "finalHeightMm", void 0);
class GranFormatoPanelManualLayoutItemDto {
    sourcePieceId;
    pieceWidthMm;
    pieceHeightMm;
    axis;
    panels;
}
exports.GranFormatoPanelManualLayoutItemDto = GranFormatoPanelManualLayoutItemDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GranFormatoPanelManualLayoutItemDto.prototype, "sourcePieceId", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GranFormatoPanelManualLayoutItemDto.prototype, "pieceWidthMm", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GranFormatoPanelManualLayoutItemDto.prototype, "pieceHeightMm", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(GranFormatoPanelizadoDireccionDto),
    __metadata("design:type", String)
], GranFormatoPanelManualLayoutItemDto.prototype, "axis", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => GranFormatoPanelManualItemDto),
    __metadata("design:type", Array)
], GranFormatoPanelManualLayoutItemDto.prototype, "panels", void 0);
class GranFormatoPanelManualLayoutDto {
    items;
}
exports.GranFormatoPanelManualLayoutDto = GranFormatoPanelManualLayoutDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => GranFormatoPanelManualLayoutItemDto),
    __metadata("design:type", Array)
], GranFormatoPanelManualLayoutDto.prototype, "items", void 0);
var TipoImpresionProductoVarianteDto;
(function (TipoImpresionProductoVarianteDto) {
    TipoImpresionProductoVarianteDto["bn"] = "bn";
    TipoImpresionProductoVarianteDto["cmyk"] = "cmyk";
})(TipoImpresionProductoVarianteDto || (exports.TipoImpresionProductoVarianteDto = TipoImpresionProductoVarianteDto = {}));
var CarasProductoVarianteDto;
(function (CarasProductoVarianteDto) {
    CarasProductoVarianteDto["simple_faz"] = "simple_faz";
    CarasProductoVarianteDto["doble_faz"] = "doble_faz";
})(CarasProductoVarianteDto || (exports.CarasProductoVarianteDto = CarasProductoVarianteDto = {}));
var TipoProductoAdicionalDto;
(function (TipoProductoAdicionalDto) {
    TipoProductoAdicionalDto["servicio"] = "servicio";
    TipoProductoAdicionalDto["acabado"] = "acabado";
})(TipoProductoAdicionalDto || (exports.TipoProductoAdicionalDto = TipoProductoAdicionalDto = {}));
var MetodoCostoProductoAdicionalDto;
(function (MetodoCostoProductoAdicionalDto) {
    MetodoCostoProductoAdicionalDto["time_only"] = "time_only";
    MetodoCostoProductoAdicionalDto["time_plus_material"] = "time_plus_material";
})(MetodoCostoProductoAdicionalDto || (exports.MetodoCostoProductoAdicionalDto = MetodoCostoProductoAdicionalDto = {}));
var TipoConsumoAdicionalMaterialDto;
(function (TipoConsumoAdicionalMaterialDto) {
    TipoConsumoAdicionalMaterialDto["por_unidad"] = "por_unidad";
    TipoConsumoAdicionalMaterialDto["por_pliego"] = "por_pliego";
    TipoConsumoAdicionalMaterialDto["por_m2"] = "por_m2";
})(TipoConsumoAdicionalMaterialDto || (exports.TipoConsumoAdicionalMaterialDto = TipoConsumoAdicionalMaterialDto = {}));
var DimensionOpcionProductivaDto;
(function (DimensionOpcionProductivaDto) {
    DimensionOpcionProductivaDto["tipo_impresion"] = "tipo_impresion";
    DimensionOpcionProductivaDto["caras"] = "caras";
})(DimensionOpcionProductivaDto || (exports.DimensionOpcionProductivaDto = DimensionOpcionProductivaDto = {}));
var ValorOpcionProductivaDto;
(function (ValorOpcionProductivaDto) {
    ValorOpcionProductivaDto["bn"] = "bn";
    ValorOpcionProductivaDto["cmyk"] = "cmyk";
    ValorOpcionProductivaDto["simple_faz"] = "simple_faz";
    ValorOpcionProductivaDto["doble_faz"] = "doble_faz";
})(ValorOpcionProductivaDto || (exports.ValorOpcionProductivaDto = ValorOpcionProductivaDto = {}));
var TipoProductoAdicionalEfectoDto;
(function (TipoProductoAdicionalEfectoDto) {
    TipoProductoAdicionalEfectoDto["route_effect"] = "route_effect";
    TipoProductoAdicionalEfectoDto["cost_effect"] = "cost_effect";
    TipoProductoAdicionalEfectoDto["material_effect"] = "material_effect";
})(TipoProductoAdicionalEfectoDto || (exports.TipoProductoAdicionalEfectoDto = TipoProductoAdicionalEfectoDto = {}));
var TipoInsercionRouteEffectDto;
(function (TipoInsercionRouteEffectDto) {
    TipoInsercionRouteEffectDto["append"] = "append";
    TipoInsercionRouteEffectDto["before_step"] = "before_step";
    TipoInsercionRouteEffectDto["after_step"] = "after_step";
})(TipoInsercionRouteEffectDto || (exports.TipoInsercionRouteEffectDto = TipoInsercionRouteEffectDto = {}));
var ReglaCostoAdicionalEfectoDto;
(function (ReglaCostoAdicionalEfectoDto) {
    ReglaCostoAdicionalEfectoDto["flat"] = "flat";
    ReglaCostoAdicionalEfectoDto["por_unidad"] = "por_unidad";
    ReglaCostoAdicionalEfectoDto["por_pliego"] = "por_pliego";
    ReglaCostoAdicionalEfectoDto["porcentaje_sobre_total"] = "porcentaje_sobre_total";
    ReglaCostoAdicionalEfectoDto["tiempo_extra_min"] = "tiempo_extra_min";
})(ReglaCostoAdicionalEfectoDto || (exports.ReglaCostoAdicionalEfectoDto = ReglaCostoAdicionalEfectoDto = {}));
var TipoChecklistPreguntaDto;
(function (TipoChecklistPreguntaDto) {
    TipoChecklistPreguntaDto["binaria"] = "binaria";
    TipoChecklistPreguntaDto["single_select"] = "single_select";
})(TipoChecklistPreguntaDto || (exports.TipoChecklistPreguntaDto = TipoChecklistPreguntaDto = {}));
var TipoChecklistAccionReglaDto;
(function (TipoChecklistAccionReglaDto) {
    TipoChecklistAccionReglaDto["activar_paso"] = "activar_paso";
    TipoChecklistAccionReglaDto["seleccionar_variante_paso"] = "seleccionar_variante_paso";
    TipoChecklistAccionReglaDto["costo_extra"] = "costo_extra";
    TipoChecklistAccionReglaDto["material_extra"] = "material_extra";
    TipoChecklistAccionReglaDto["mutar_producto_base"] = "mutar_producto_base";
    TipoChecklistAccionReglaDto["set_atributo_tecnico"] = "set_atributo_tecnico";
})(TipoChecklistAccionReglaDto || (exports.TipoChecklistAccionReglaDto = TipoChecklistAccionReglaDto = {}));
var ReglaCostoChecklistDto;
(function (ReglaCostoChecklistDto) {
    ReglaCostoChecklistDto["tiempo_min"] = "tiempo_min";
    ReglaCostoChecklistDto["flat"] = "flat";
    ReglaCostoChecklistDto["por_unidad"] = "por_unidad";
    ReglaCostoChecklistDto["por_pliego"] = "por_pliego";
    ReglaCostoChecklistDto["porcentaje_sobre_total"] = "porcentaje_sobre_total";
})(ReglaCostoChecklistDto || (exports.ReglaCostoChecklistDto = ReglaCostoChecklistDto = {}));
var MetodoCalculoPrecioProductoDto;
(function (MetodoCalculoPrecioProductoDto) {
    MetodoCalculoPrecioProductoDto["margen_variable"] = "margen_variable";
    MetodoCalculoPrecioProductoDto["por_margen"] = "por_margen";
    MetodoCalculoPrecioProductoDto["precio_fijo"] = "precio_fijo";
    MetodoCalculoPrecioProductoDto["fijado_por_cantidad"] = "fijado_por_cantidad";
    MetodoCalculoPrecioProductoDto["fijo_con_margen_variable"] = "fijo_con_margen_variable";
    MetodoCalculoPrecioProductoDto["variable_por_cantidad"] = "variable_por_cantidad";
    MetodoCalculoPrecioProductoDto["precio_fijo_para_margen_minimo"] = "precio_fijo_para_margen_minimo";
})(MetodoCalculoPrecioProductoDto || (exports.MetodoCalculoPrecioProductoDto = MetodoCalculoPrecioProductoDto = {}));
class UpsertVarianteOpcionProductivaDimensionDto {
    dimension;
    valores;
}
exports.UpsertVarianteOpcionProductivaDimensionDto = UpsertVarianteOpcionProductivaDimensionDto;
__decorate([
    (0, class_validator_1.IsEnum)(DimensionOpcionProductivaDto),
    __metadata("design:type", String)
], UpsertVarianteOpcionProductivaDimensionDto.prototype, "dimension", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(10),
    (0, class_validator_1.IsEnum)(ValorOpcionProductivaDto, { each: true }),
    __metadata("design:type", Array)
], UpsertVarianteOpcionProductivaDimensionDto.prototype, "valores", void 0);
class UpsertVarianteOpcionesProductivasDto {
    dimensiones;
}
exports.UpsertVarianteOpcionesProductivasDto = UpsertVarianteOpcionesProductivasDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(10),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertVarianteOpcionProductivaDimensionDto),
    __metadata("design:type", Array)
], UpsertVarianteOpcionesProductivasDto.prototype, "dimensiones", void 0);
class UpsertProductoAdicionalEfectoScopeDto {
    varianteId;
    dimension;
    valor;
}
exports.UpsertProductoAdicionalEfectoScopeDto = UpsertProductoAdicionalEfectoScopeDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalEfectoScopeDto.prototype, "varianteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(DimensionOpcionProductivaDto),
    __metadata("design:type", String)
], UpsertProductoAdicionalEfectoScopeDto.prototype, "dimension", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(ValorOpcionProductivaDto),
    __metadata("design:type", String)
], UpsertProductoAdicionalEfectoScopeDto.prototype, "valor", void 0);
class UpsertProductoAdicionalRouteEffectPasoDto {
    orden;
    nombre;
    centroCostoId;
    maquinaId;
    perfilOperativoId;
    usarMaquinariaTerminacion;
    setupMin;
    runMin;
    cleanupMin;
    tiempoFijoMin;
    tiempoFijoMinFallback;
    overridesProductividad;
}
exports.UpsertProductoAdicionalRouteEffectPasoDto = UpsertProductoAdicionalRouteEffectPasoDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpsertProductoAdicionalRouteEffectPasoDto.prototype, "orden", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalRouteEffectPasoDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalRouteEffectPasoDto.prototype, "centroCostoId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalRouteEffectPasoDto.prototype, "maquinaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalRouteEffectPasoDto.prototype, "perfilOperativoId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProductoAdicionalRouteEffectPasoDto.prototype, "usarMaquinariaTerminacion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProductoAdicionalRouteEffectPasoDto.prototype, "setupMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProductoAdicionalRouteEffectPasoDto.prototype, "runMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProductoAdicionalRouteEffectPasoDto.prototype, "cleanupMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProductoAdicionalRouteEffectPasoDto.prototype, "tiempoFijoMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProductoAdicionalRouteEffectPasoDto.prototype, "tiempoFijoMinFallback", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertProductoAdicionalRouteEffectPasoDto.prototype, "overridesProductividad", void 0);
class UpsertProductoAdicionalRouteInsertionDto {
    modo;
    pasoPlantillaId;
}
exports.UpsertProductoAdicionalRouteInsertionDto = UpsertProductoAdicionalRouteInsertionDto;
__decorate([
    (0, class_validator_1.IsEnum)(TipoInsercionRouteEffectDto),
    __metadata("design:type", String)
], UpsertProductoAdicionalRouteInsertionDto.prototype, "modo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalRouteInsertionDto.prototype, "pasoPlantillaId", void 0);
class UpsertProductoAdicionalRouteEffectDto {
    pasos;
    insertion;
}
exports.UpsertProductoAdicionalRouteEffectDto = UpsertProductoAdicionalRouteEffectDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertProductoAdicionalRouteEffectPasoDto),
    __metadata("design:type", Array)
], UpsertProductoAdicionalRouteEffectDto.prototype, "pasos", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => UpsertProductoAdicionalRouteInsertionDto),
    __metadata("design:type", UpsertProductoAdicionalRouteInsertionDto)
], UpsertProductoAdicionalRouteEffectDto.prototype, "insertion", void 0);
class UpsertProductoAdicionalCostEffectDto {
    regla;
    valor;
    centroCostoId;
    detalle;
}
exports.UpsertProductoAdicionalCostEffectDto = UpsertProductoAdicionalCostEffectDto;
__decorate([
    (0, class_validator_1.IsEnum)(ReglaCostoAdicionalEfectoDto),
    __metadata("design:type", String)
], UpsertProductoAdicionalCostEffectDto.prototype, "regla", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertProductoAdicionalCostEffectDto.prototype, "valor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalCostEffectDto.prototype, "centroCostoId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertProductoAdicionalCostEffectDto.prototype, "detalle", void 0);
class UpsertProductoAdicionalMaterialEffectDto {
    materiaPrimaVarianteId;
    tipoConsumo;
    factorConsumo;
    mermaPct;
    detalle;
}
exports.UpsertProductoAdicionalMaterialEffectDto = UpsertProductoAdicionalMaterialEffectDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalMaterialEffectDto.prototype, "materiaPrimaVarianteId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TipoConsumoAdicionalMaterialDto),
    __metadata("design:type", String)
], UpsertProductoAdicionalMaterialEffectDto.prototype, "tipoConsumo", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProductoAdicionalMaterialEffectDto.prototype, "factorConsumo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProductoAdicionalMaterialEffectDto.prototype, "mermaPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertProductoAdicionalMaterialEffectDto.prototype, "detalle", void 0);
class UpsertProductoAdicionalEfectoDto {
    tipo;
    nombre;
    activo;
    scopes;
    routeEffect;
    costEffect;
    materialEffect;
}
exports.UpsertProductoAdicionalEfectoDto = UpsertProductoAdicionalEfectoDto;
__decorate([
    (0, class_validator_1.IsEnum)(TipoProductoAdicionalEfectoDto),
    __metadata("design:type", String)
], UpsertProductoAdicionalEfectoDto.prototype, "tipo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalEfectoDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProductoAdicionalEfectoDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertProductoAdicionalEfectoScopeDto),
    __metadata("design:type", Array)
], UpsertProductoAdicionalEfectoDto.prototype, "scopes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => UpsertProductoAdicionalRouteEffectDto),
    __metadata("design:type", UpsertProductoAdicionalRouteEffectDto)
], UpsertProductoAdicionalEfectoDto.prototype, "routeEffect", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => UpsertProductoAdicionalCostEffectDto),
    __metadata("design:type", UpsertProductoAdicionalCostEffectDto)
], UpsertProductoAdicionalEfectoDto.prototype, "costEffect", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => UpsertProductoAdicionalMaterialEffectDto),
    __metadata("design:type", UpsertProductoAdicionalMaterialEffectDto)
], UpsertProductoAdicionalEfectoDto.prototype, "materialEffect", void 0);
class UpsertProductoAdicionalMaterialDto {
    materiaPrimaVarianteId;
    tipoConsumo;
    factorConsumo;
    mermaPct;
    activo;
    detalle;
}
exports.UpsertProductoAdicionalMaterialDto = UpsertProductoAdicionalMaterialDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalMaterialDto.prototype, "materiaPrimaVarianteId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TipoConsumoAdicionalMaterialDto),
    __metadata("design:type", String)
], UpsertProductoAdicionalMaterialDto.prototype, "tipoConsumo", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProductoAdicionalMaterialDto.prototype, "factorConsumo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProductoAdicionalMaterialDto.prototype, "mermaPct", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProductoAdicionalMaterialDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertProductoAdicionalMaterialDto.prototype, "detalle", void 0);
class UpsertProductoAdicionalDto {
    codigo;
    nombre;
    descripcion;
    tipo;
    metodoCosto;
    centroCostoId;
    activo;
    metadata;
    materiales;
}
exports.UpsertProductoAdicionalDto = UpsertProductoAdicionalDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalDto.prototype, "codigo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalDto.prototype, "descripcion", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TipoProductoAdicionalDto),
    __metadata("design:type", String)
], UpsertProductoAdicionalDto.prototype, "tipo", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(MetodoCostoProductoAdicionalDto),
    __metadata("design:type", String)
], UpsertProductoAdicionalDto.prototype, "metodoCosto", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalDto.prototype, "centroCostoId", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProductoAdicionalDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertProductoAdicionalDto.prototype, "metadata", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertProductoAdicionalMaterialDto),
    __metadata("design:type", Array)
], UpsertProductoAdicionalDto.prototype, "materiales", void 0);
class UpsertProductoAdicionalServicioNivelDto {
    id;
    nombre;
    orden;
    activo;
}
exports.UpsertProductoAdicionalServicioNivelDto = UpsertProductoAdicionalServicioNivelDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalServicioNivelDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalServicioNivelDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpsertProductoAdicionalServicioNivelDto.prototype, "orden", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProductoAdicionalServicioNivelDto.prototype, "activo", void 0);
class UpsertProductoAdicionalServicioReglaCostoDto {
    nivelId;
    tiempoMin;
}
exports.UpsertProductoAdicionalServicioReglaCostoDto = UpsertProductoAdicionalServicioReglaCostoDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertProductoAdicionalServicioReglaCostoDto.prototype, "nivelId", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProductoAdicionalServicioReglaCostoDto.prototype, "tiempoMin", void 0);
class UpsertProductoAdicionalServicioPricingDto {
    niveles;
    reglas;
}
exports.UpsertProductoAdicionalServicioPricingDto = UpsertProductoAdicionalServicioPricingDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertProductoAdicionalServicioNivelDto),
    __metadata("design:type", Array)
], UpsertProductoAdicionalServicioPricingDto.prototype, "niveles", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(40),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertProductoAdicionalServicioReglaCostoDto),
    __metadata("design:type", Array)
], UpsertProductoAdicionalServicioPricingDto.prototype, "reglas", void 0);
class AssignProductoAdicionalDto {
    adicionalId;
    activo;
}
exports.AssignProductoAdicionalDto = AssignProductoAdicionalDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AssignProductoAdicionalDto.prototype, "adicionalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AssignProductoAdicionalDto.prototype, "activo", void 0);
class SetVarianteAdicionalRestrictionDto {
    adicionalId;
    permitido;
}
exports.SetVarianteAdicionalRestrictionDto = SetVarianteAdicionalRestrictionDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SetVarianteAdicionalRestrictionDto.prototype, "adicionalId", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SetVarianteAdicionalRestrictionDto.prototype, "permitido", void 0);
class UpsertFamiliaProductoDto {
    codigo;
    nombre;
    activo;
}
exports.UpsertFamiliaProductoDto = UpsertFamiliaProductoDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertFamiliaProductoDto.prototype, "codigo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertFamiliaProductoDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertFamiliaProductoDto.prototype, "activo", void 0);
class UpsertProductoImpuestoDto {
    codigo;
    nombre;
    porcentaje;
    detalle;
    activo;
}
exports.UpsertProductoImpuestoDto = UpsertProductoImpuestoDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertProductoImpuestoDto.prototype, "codigo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertProductoImpuestoDto.prototype, "nombre", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProductoImpuestoDto.prototype, "porcentaje", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertProductoImpuestoDto.prototype, "detalle", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProductoImpuestoDto.prototype, "activo", void 0);
class UpsertProductoComisionDto {
    codigo;
    nombre;
    porcentaje;
    detalle;
    activo;
}
exports.UpsertProductoComisionDto = UpsertProductoComisionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertProductoComisionDto.prototype, "codigo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertProductoComisionDto.prototype, "nombre", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProductoComisionDto.prototype, "porcentaje", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertProductoComisionDto.prototype, "detalle", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProductoComisionDto.prototype, "activo", void 0);
class UpsertSubfamiliaProductoDto {
    familiaProductoId;
    codigo;
    nombre;
    unidadComercial;
    activo;
}
exports.UpsertSubfamiliaProductoDto = UpsertSubfamiliaProductoDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertSubfamiliaProductoDto.prototype, "familiaProductoId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertSubfamiliaProductoDto.prototype, "codigo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertSubfamiliaProductoDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertSubfamiliaProductoDto.prototype, "unidadComercial", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertSubfamiliaProductoDto.prototype, "activo", void 0);
class UpsertProductoServicioDto {
    tipo;
    codigo;
    nombre;
    descripcion;
    motorCodigo;
    motorVersion;
    familiaProductoId;
    subfamiliaProductoId;
    unidadComercial;
    estado;
    activo;
}
exports.UpsertProductoServicioDto = UpsertProductoServicioDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(TipoProductoServicioDto),
    __metadata("design:type", String)
], UpsertProductoServicioDto.prototype, "tipo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpsertProductoServicioDto.prototype, "codigo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertProductoServicioDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertProductoServicioDto.prototype, "descripcion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertProductoServicioDto.prototype, "motorCodigo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpsertProductoServicioDto.prototype, "motorVersion", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoServicioDto.prototype, "familiaProductoId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoServicioDto.prototype, "subfamiliaProductoId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(UnidadComercialProductoDto),
    __metadata("design:type", String)
], UpsertProductoServicioDto.prototype, "unidadComercial", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(EstadoProductoServicioDto),
    __metadata("design:type", String)
], UpsertProductoServicioDto.prototype, "estado", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProductoServicioDto.prototype, "activo", void 0);
class CreateProductoVarianteDto {
    nombre;
    anchoMm;
    altoMm;
    papelVarianteId;
    tipoImpresion;
    caras;
    procesoDefinicionId;
    activo;
}
exports.CreateProductoVarianteDto = CreateProductoVarianteDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateProductoVarianteDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateProductoVarianteDto.prototype, "anchoMm", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateProductoVarianteDto.prototype, "altoMm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateProductoVarianteDto.prototype, "papelVarianteId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TipoImpresionProductoVarianteDto),
    __metadata("design:type", String)
], CreateProductoVarianteDto.prototype, "tipoImpresion", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(CarasProductoVarianteDto),
    __metadata("design:type", String)
], CreateProductoVarianteDto.prototype, "caras", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateProductoVarianteDto.prototype, "procesoDefinicionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateProductoVarianteDto.prototype, "activo", void 0);
class UpdateProductoVarianteDto {
    nombre;
    anchoMm;
    altoMm;
    papelVarianteId;
    tipoImpresion;
    caras;
    procesoDefinicionId;
    activo;
}
exports.UpdateProductoVarianteDto = UpdateProductoVarianteDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateProductoVarianteDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateProductoVarianteDto.prototype, "anchoMm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateProductoVarianteDto.prototype, "altoMm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateProductoVarianteDto.prototype, "papelVarianteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(TipoImpresionProductoVarianteDto),
    __metadata("design:type", String)
], UpdateProductoVarianteDto.prototype, "tipoImpresion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(CarasProductoVarianteDto),
    __metadata("design:type", String)
], UpdateProductoVarianteDto.prototype, "caras", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateProductoVarianteDto.prototype, "procesoDefinicionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateProductoVarianteDto.prototype, "activo", void 0);
class AssignVarianteRutaDto {
    procesoDefinicionId;
}
exports.AssignVarianteRutaDto = AssignVarianteRutaDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AssignVarianteRutaDto.prototype, "procesoDefinicionId", void 0);
class UpsertProductoRutaBaseMatchingItemDto {
    tipoImpresion;
    caras;
    pasoPlantillaId;
    perfilOperativoId;
}
exports.UpsertProductoRutaBaseMatchingItemDto = UpsertProductoRutaBaseMatchingItemDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(TipoImpresionProductoVarianteDto),
    __metadata("design:type", Object)
], UpsertProductoRutaBaseMatchingItemDto.prototype, "tipoImpresion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(CarasProductoVarianteDto),
    __metadata("design:type", Object)
], UpsertProductoRutaBaseMatchingItemDto.prototype, "caras", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoRutaBaseMatchingItemDto.prototype, "pasoPlantillaId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoRutaBaseMatchingItemDto.prototype, "perfilOperativoId", void 0);
class UpsertProductoRutaBaseMatchingVarianteDto {
    varianteId;
    matching;
}
exports.UpsertProductoRutaBaseMatchingVarianteDto = UpsertProductoRutaBaseMatchingVarianteDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoRutaBaseMatchingVarianteDto.prototype, "varianteId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertProductoRutaBaseMatchingItemDto),
    __metadata("design:type", Array)
], UpsertProductoRutaBaseMatchingVarianteDto.prototype, "matching", void 0);
class UpsertProductoRutaPasoFijoItemDto {
    pasoPlantillaId;
    perfilOperativoId;
}
exports.UpsertProductoRutaPasoFijoItemDto = UpsertProductoRutaPasoFijoItemDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoRutaPasoFijoItemDto.prototype, "pasoPlantillaId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoRutaPasoFijoItemDto.prototype, "perfilOperativoId", void 0);
class UpsertProductoRutaPasoFijoVarianteDto {
    varianteId;
    pasos;
}
exports.UpsertProductoRutaPasoFijoVarianteDto = UpsertProductoRutaPasoFijoVarianteDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProductoRutaPasoFijoVarianteDto.prototype, "varianteId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertProductoRutaPasoFijoItemDto),
    __metadata("design:type", Array)
], UpsertProductoRutaPasoFijoVarianteDto.prototype, "pasos", void 0);
class UpdateProductoRutaPolicyDto {
    usarRutaComunVariantes;
    procesoDefinicionDefaultId;
    dimensionesBaseConsumidas;
    matchingBasePorVariante;
    pasosFijosPorVariante;
}
exports.UpdateProductoRutaPolicyDto = UpdateProductoRutaPolicyDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateProductoRutaPolicyDto.prototype, "usarRutaComunVariantes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], UpdateProductoRutaPolicyDto.prototype, "procesoDefinicionDefaultId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(10),
    (0, class_validator_1.IsEnum)(DimensionOpcionProductivaDto, { each: true }),
    __metadata("design:type", Array)
], UpdateProductoRutaPolicyDto.prototype, "dimensionesBaseConsumidas", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertProductoRutaBaseMatchingVarianteDto),
    __metadata("design:type", Array)
], UpdateProductoRutaPolicyDto.prototype, "matchingBasePorVariante", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertProductoRutaPasoFijoVarianteDto),
    __metadata("design:type", Array)
], UpdateProductoRutaPolicyDto.prototype, "pasosFijosPorVariante", void 0);
class AssignProductoVariantesRutaMasivaDto {
    procesoDefinicionId;
    incluirInactivas;
}
exports.AssignProductoVariantesRutaMasivaDto = AssignProductoVariantesRutaMasivaDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AssignProductoVariantesRutaMasivaDto.prototype, "procesoDefinicionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AssignProductoVariantesRutaMasivaDto.prototype, "incluirInactivas", void 0);
class AssignProductoMotorDto {
    motorCodigo;
    motorVersion;
}
exports.AssignProductoMotorDto = AssignProductoMotorDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AssignProductoMotorDto.prototype, "motorCodigo", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AssignProductoMotorDto.prototype, "motorVersion", void 0);
class UpdateProductoPrecioDto {
    metodoCalculo;
    measurementUnit;
    detalle;
    impuestos;
    comisiones;
}
exports.UpdateProductoPrecioDto = UpdateProductoPrecioDto;
__decorate([
    (0, class_validator_1.IsEnum)(MetodoCalculoPrecioProductoDto),
    __metadata("design:type", String)
], UpdateProductoPrecioDto.prototype, "metodoCalculo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateProductoPrecioDto.prototype, "measurementUnit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateProductoPrecioDto.prototype, "detalle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateProductoPrecioDto.prototype, "impuestos", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateProductoPrecioDto.prototype, "comisiones", void 0);
class UpdateProductoPrecioEspecialClientesDto {
    items;
}
exports.UpdateProductoPrecioEspecialClientesDto = UpdateProductoPrecioEspecialClientesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpdateProductoPrecioEspecialClientesDto.prototype, "items", void 0);
class UpsertProductoMotorConfigDto {
    parametros;
}
exports.UpsertProductoMotorConfigDto = UpsertProductoMotorConfigDto;
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertProductoMotorConfigDto.prototype, "parametros", void 0);
class GranFormatoImposicionMedidaDto {
    anchoMm;
    altoMm;
    cantidad;
}
exports.GranFormatoImposicionMedidaDto = GranFormatoImposicionMedidaDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Object)
], GranFormatoImposicionMedidaDto.prototype, "anchoMm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Object)
], GranFormatoImposicionMedidaDto.prototype, "altoMm", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], GranFormatoImposicionMedidaDto.prototype, "cantidad", void 0);
class UpdateGranFormatoImposicionDto {
    medidas;
    piezaAnchoMm;
    piezaAltoMm;
    cantidadReferencia;
    tecnologiaDefault;
    maquinaDefaultId;
    perfilDefaultId;
    permitirRotacion;
    separacionHorizontalMm;
    separacionVerticalMm;
    margenLateralIzquierdoMmOverride;
    margenLateralDerechoMmOverride;
    margenInicioMmOverride;
    margenFinalMmOverride;
    criterioOptimizacion;
    panelizadoActivo;
    panelizadoModo;
    panelizadoDireccion;
    panelizadoSolapeMm;
    panelizadoAnchoMaxPanelMm;
    panelizadoDistribucion;
    panelizadoInterpretacionAnchoMaximo;
    panelizadoManualLayout;
}
exports.UpdateGranFormatoImposicionDto = UpdateGranFormatoImposicionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => GranFormatoImposicionMedidaDto),
    __metadata("design:type", Array)
], UpdateGranFormatoImposicionDto.prototype, "medidas", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Object)
], UpdateGranFormatoImposicionDto.prototype, "piezaAnchoMm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Object)
], UpdateGranFormatoImposicionDto.prototype, "piezaAltoMm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateGranFormatoImposicionDto.prototype, "cantidadReferencia", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateGranFormatoImposicionDto.prototype, "tecnologiaDefault", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], UpdateGranFormatoImposicionDto.prototype, "maquinaDefaultId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], UpdateGranFormatoImposicionDto.prototype, "perfilDefaultId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateGranFormatoImposicionDto.prototype, "permitirRotacion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateGranFormatoImposicionDto.prototype, "separacionHorizontalMm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateGranFormatoImposicionDto.prototype, "separacionVerticalMm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], UpdateGranFormatoImposicionDto.prototype, "margenLateralIzquierdoMmOverride", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], UpdateGranFormatoImposicionDto.prototype, "margenLateralDerechoMmOverride", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], UpdateGranFormatoImposicionDto.prototype, "margenInicioMmOverride", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], UpdateGranFormatoImposicionDto.prototype, "margenFinalMmOverride", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(GranFormatoImposicionCriterioOptimizacionDto),
    __metadata("design:type", String)
], UpdateGranFormatoImposicionDto.prototype, "criterioOptimizacion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateGranFormatoImposicionDto.prototype, "panelizadoActivo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(GranFormatoPanelizadoModoDto),
    __metadata("design:type", String)
], UpdateGranFormatoImposicionDto.prototype, "panelizadoModo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(GranFormatoPanelizadoDireccionDto),
    __metadata("design:type", String)
], UpdateGranFormatoImposicionDto.prototype, "panelizadoDireccion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], UpdateGranFormatoImposicionDto.prototype, "panelizadoSolapeMm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Object)
], UpdateGranFormatoImposicionDto.prototype, "panelizadoAnchoMaxPanelMm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(GranFormatoPanelizadoDistribucionDto),
    __metadata("design:type", String)
], UpdateGranFormatoImposicionDto.prototype, "panelizadoDistribucion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(GranFormatoPanelizadoInterpretacionAnchoMaximoDto),
    __metadata("design:type", String)
], UpdateGranFormatoImposicionDto.prototype, "panelizadoInterpretacionAnchoMaximo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GranFormatoPanelManualLayoutDto),
    __metadata("design:type", Object)
], UpdateGranFormatoImposicionDto.prototype, "panelizadoManualLayout", void 0);
class UpdateGranFormatoConfigDto {
    tecnologiasCompatibles;
    maquinasCompatibles;
    perfilesCompatibles;
    materialBaseId;
    materialesCompatibles;
    imposicion;
}
exports.UpdateGranFormatoConfigDto = UpdateGranFormatoConfigDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateGranFormatoConfigDto.prototype, "tecnologiasCompatibles", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)(undefined, { each: true }),
    __metadata("design:type", Array)
], UpdateGranFormatoConfigDto.prototype, "maquinasCompatibles", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)(undefined, { each: true }),
    __metadata("design:type", Array)
], UpdateGranFormatoConfigDto.prototype, "perfilesCompatibles", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], UpdateGranFormatoConfigDto.prototype, "materialBaseId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)(undefined, { each: true }),
    __metadata("design:type", Array)
], UpdateGranFormatoConfigDto.prototype, "materialesCompatibles", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => UpdateGranFormatoImposicionDto),
    __metadata("design:type", UpdateGranFormatoImposicionDto)
], UpdateGranFormatoConfigDto.prototype, "imposicion", void 0);
class UpsertGranFormatoRutaBaseReglaImpresionDto {
    tecnologia;
    maquinaId;
    pasoPlantillaId;
    perfilOperativoDefaultId;
}
exports.UpsertGranFormatoRutaBaseReglaImpresionDto = UpsertGranFormatoRutaBaseReglaImpresionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertGranFormatoRutaBaseReglaImpresionDto.prototype, "tecnologia", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], UpsertGranFormatoRutaBaseReglaImpresionDto.prototype, "maquinaId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertGranFormatoRutaBaseReglaImpresionDto.prototype, "pasoPlantillaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], UpsertGranFormatoRutaBaseReglaImpresionDto.prototype, "perfilOperativoDefaultId", void 0);
class UpdateGranFormatoRutaBaseDto {
    procesoDefinicionId;
    reglasImpresion;
}
exports.UpdateGranFormatoRutaBaseDto = UpdateGranFormatoRutaBaseDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", Object)
], UpdateGranFormatoRutaBaseDto.prototype, "procesoDefinicionId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertGranFormatoRutaBaseReglaImpresionDto),
    __metadata("design:type", Array)
], UpdateGranFormatoRutaBaseDto.prototype, "reglasImpresion", void 0);
class CreateGranFormatoVarianteDto {
    nombre;
    maquinaId;
    perfilOperativoId;
    materiaPrimaVarianteId;
    esDefault;
    permiteOverrideEnCotizacion;
    activo;
    observaciones;
}
exports.CreateGranFormatoVarianteDto = CreateGranFormatoVarianteDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateGranFormatoVarianteDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateGranFormatoVarianteDto.prototype, "maquinaId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateGranFormatoVarianteDto.prototype, "perfilOperativoId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateGranFormatoVarianteDto.prototype, "materiaPrimaVarianteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateGranFormatoVarianteDto.prototype, "esDefault", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateGranFormatoVarianteDto.prototype, "permiteOverrideEnCotizacion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateGranFormatoVarianteDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateGranFormatoVarianteDto.prototype, "observaciones", void 0);
class UpdateGranFormatoVarianteDto {
    nombre;
    maquinaId;
    perfilOperativoId;
    materiaPrimaVarianteId;
    esDefault;
    permiteOverrideEnCotizacion;
    activo;
    observaciones;
}
exports.UpdateGranFormatoVarianteDto = UpdateGranFormatoVarianteDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateGranFormatoVarianteDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateGranFormatoVarianteDto.prototype, "maquinaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateGranFormatoVarianteDto.prototype, "perfilOperativoId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateGranFormatoVarianteDto.prototype, "materiaPrimaVarianteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateGranFormatoVarianteDto.prototype, "esDefault", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateGranFormatoVarianteDto.prototype, "permiteOverrideEnCotizacion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateGranFormatoVarianteDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateGranFormatoVarianteDto.prototype, "observaciones", void 0);
class UpsertVarianteMotorOverrideDto {
    parametros;
}
exports.UpsertVarianteMotorOverrideDto = UpsertVarianteMotorOverrideDto;
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertVarianteMotorOverrideDto.prototype, "parametros", void 0);
class CotizarAddonConfigDto {
    addonId;
    nivelId;
}
exports.CotizarAddonConfigDto = CotizarAddonConfigDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CotizarAddonConfigDto.prototype, "addonId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CotizarAddonConfigDto.prototype, "nivelId", void 0);
class CotizarChecklistRespuestaDto {
    preguntaId;
    respuestaId;
}
exports.CotizarChecklistRespuestaDto = CotizarChecklistRespuestaDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CotizarChecklistRespuestaDto.prototype, "preguntaId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CotizarChecklistRespuestaDto.prototype, "respuestaId", void 0);
class CotizarSeleccionBaseDto {
    dimension;
    valor;
}
exports.CotizarSeleccionBaseDto = CotizarSeleccionBaseDto;
__decorate([
    (0, class_validator_1.IsEnum)(DimensionOpcionProductivaDto),
    __metadata("design:type", String)
], CotizarSeleccionBaseDto.prototype, "dimension", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(ValorOpcionProductivaDto),
    __metadata("design:type", String)
], CotizarSeleccionBaseDto.prototype, "valor", void 0);
class UpsertChecklistReglaNivelDto {
    id;
    nombreNivel;
    orden;
    activo;
    costoRegla;
    costoValor;
    tiempoMin;
}
exports.UpsertChecklistReglaNivelDto = UpsertChecklistReglaNivelDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertChecklistReglaNivelDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertChecklistReglaNivelDto.prototype, "nombreNivel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpsertChecklistReglaNivelDto.prototype, "orden", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertChecklistReglaNivelDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(ReglaCostoChecklistDto),
    __metadata("design:type", String)
], UpsertChecklistReglaNivelDto.prototype, "costoRegla", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertChecklistReglaNivelDto.prototype, "costoValor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertChecklistReglaNivelDto.prototype, "tiempoMin", void 0);
class UpsertChecklistReglaDto {
    id;
    accion;
    orden;
    activo;
    pasoPlantillaId;
    variantePasoId;
    atributoTecnicoDimension;
    atributoTecnicoValor;
    costoRegla;
    costoValor;
    costoCentroCostoId;
    materiaPrimaVarianteId;
    tipoConsumo;
    factorConsumo;
    mermaPct;
    detalle;
}
exports.UpsertChecklistReglaDto = UpsertChecklistReglaDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertChecklistReglaDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TipoChecklistAccionReglaDto),
    __metadata("design:type", String)
], UpsertChecklistReglaDto.prototype, "accion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpsertChecklistReglaDto.prototype, "orden", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertChecklistReglaDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertChecklistReglaDto.prototype, "pasoPlantillaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertChecklistReglaDto.prototype, "variantePasoId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(DimensionOpcionProductivaDto),
    __metadata("design:type", String)
], UpsertChecklistReglaDto.prototype, "atributoTecnicoDimension", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(ValorOpcionProductivaDto),
    __metadata("design:type", String)
], UpsertChecklistReglaDto.prototype, "atributoTecnicoValor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(ReglaCostoChecklistDto),
    __metadata("design:type", String)
], UpsertChecklistReglaDto.prototype, "costoRegla", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertChecklistReglaDto.prototype, "costoValor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertChecklistReglaDto.prototype, "costoCentroCostoId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertChecklistReglaDto.prototype, "materiaPrimaVarianteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(TipoConsumoAdicionalMaterialDto),
    __metadata("design:type", String)
], UpsertChecklistReglaDto.prototype, "tipoConsumo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertChecklistReglaDto.prototype, "factorConsumo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpsertChecklistReglaDto.prototype, "mermaPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertChecklistReglaDto.prototype, "detalle", void 0);
class UpsertChecklistRespuestaDto {
    id;
    texto;
    codigo;
    orden;
    activo;
    preguntaSiguienteId;
    reglas;
}
exports.UpsertChecklistRespuestaDto = UpsertChecklistRespuestaDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertChecklistRespuestaDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertChecklistRespuestaDto.prototype, "texto", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertChecklistRespuestaDto.prototype, "codigo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpsertChecklistRespuestaDto.prototype, "orden", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertChecklistRespuestaDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertChecklistRespuestaDto.prototype, "preguntaSiguienteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(30),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertChecklistReglaDto),
    __metadata("design:type", Array)
], UpsertChecklistRespuestaDto.prototype, "reglas", void 0);
class UpsertChecklistPreguntaDto {
    id;
    texto;
    tipoPregunta;
    orden;
    activo;
    respuestas;
}
exports.UpsertChecklistPreguntaDto = UpsertChecklistPreguntaDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertChecklistPreguntaDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertChecklistPreguntaDto.prototype, "texto", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(TipoChecklistPreguntaDto),
    __metadata("design:type", String)
], UpsertChecklistPreguntaDto.prototype, "tipoPregunta", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpsertChecklistPreguntaDto.prototype, "orden", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertChecklistPreguntaDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertChecklistRespuestaDto),
    __metadata("design:type", Array)
], UpsertChecklistPreguntaDto.prototype, "respuestas", void 0);
class UpsertProductoChecklistDto {
    activo;
    preguntas;
}
exports.UpsertProductoChecklistDto = UpsertProductoChecklistDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProductoChecklistDto.prototype, "activo", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertChecklistPreguntaDto),
    __metadata("design:type", Array)
], UpsertProductoChecklistDto.prototype, "preguntas", void 0);
class UpsertGranFormatoChecklistPorTecnologiaDto {
    tecnologia;
    checklist;
}
exports.UpsertGranFormatoChecklistPorTecnologiaDto = UpsertGranFormatoChecklistPorTecnologiaDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpsertGranFormatoChecklistPorTecnologiaDto.prototype, "tecnologia", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => UpsertProductoChecklistDto),
    __metadata("design:type", UpsertProductoChecklistDto)
], UpsertGranFormatoChecklistPorTecnologiaDto.prototype, "checklist", void 0);
class UpdateGranFormatoChecklistDto {
    aplicaATodasLasTecnologias;
    checklistComun;
    checklistsPorTecnologia;
}
exports.UpdateGranFormatoChecklistDto = UpdateGranFormatoChecklistDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateGranFormatoChecklistDto.prototype, "aplicaATodasLasTecnologias", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => UpsertProductoChecklistDto),
    __metadata("design:type", UpsertProductoChecklistDto)
], UpdateGranFormatoChecklistDto.prototype, "checklistComun", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertGranFormatoChecklistPorTecnologiaDto),
    __metadata("design:type", Array)
], UpdateGranFormatoChecklistDto.prototype, "checklistsPorTecnologia", void 0);
class PreviewGranFormatoCostoMedidaDto {
    anchoMm;
    altoMm;
    cantidad;
}
exports.PreviewGranFormatoCostoMedidaDto = PreviewGranFormatoCostoMedidaDto;
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PreviewGranFormatoCostoMedidaDto.prototype, "anchoMm", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PreviewGranFormatoCostoMedidaDto.prototype, "altoMm", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PreviewGranFormatoCostoMedidaDto.prototype, "cantidad", void 0);
class PreviewGranFormatoCostosDto {
    periodo;
    tecnologia;
    perfilOverrideId;
    persistirSnapshot;
    incluirCandidatos;
    medidas;
    checklistRespuestas;
    panelizado;
}
exports.PreviewGranFormatoCostosDto = PreviewGranFormatoCostosDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{4}-(0[1-9]|1[0-2])$/),
    __metadata("design:type", String)
], PreviewGranFormatoCostosDto.prototype, "periodo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PreviewGranFormatoCostosDto.prototype, "tecnologia", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PreviewGranFormatoCostosDto.prototype, "perfilOverrideId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PreviewGranFormatoCostosDto.prototype, "persistirSnapshot", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PreviewGranFormatoCostosDto.prototype, "incluirCandidatos", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(200),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PreviewGranFormatoCostoMedidaDto),
    __metadata("design:type", Array)
], PreviewGranFormatoCostosDto.prototype, "medidas", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CotizarChecklistRespuestaDto),
    __metadata("design:type", Array)
], PreviewGranFormatoCostosDto.prototype, "checklistRespuestas", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], PreviewGranFormatoCostosDto.prototype, "panelizado", void 0);
class CotizarProductoVarianteDto {
    cantidad;
    periodo;
    checklistRespuestas;
    seleccionesBase;
    parametros;
}
exports.CotizarProductoVarianteDto = CotizarProductoVarianteDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CotizarProductoVarianteDto.prototype, "cantidad", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{4}-(0[1-9]|1[0-2])$/),
    __metadata("design:type", String)
], CotizarProductoVarianteDto.prototype, "periodo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CotizarChecklistRespuestaDto),
    __metadata("design:type", Array)
], CotizarProductoVarianteDto.prototype, "checklistRespuestas", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(10),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CotizarSeleccionBaseDto),
    __metadata("design:type", Array)
], CotizarProductoVarianteDto.prototype, "seleccionesBase", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CotizarProductoVarianteDto.prototype, "parametros", void 0);
class PreviewImposicionProductoVarianteDto {
    parametros;
}
exports.PreviewImposicionProductoVarianteDto = PreviewImposicionProductoVarianteDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], PreviewImposicionProductoVarianteDto.prototype, "parametros", void 0);
//# sourceMappingURL=productos-servicios.dto.js.map