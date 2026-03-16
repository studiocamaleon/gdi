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
exports.PreviewImposicionProductoVarianteDto = exports.CotizarProductoVarianteDto = exports.CotizarAddonConfigDto = exports.UpsertVarianteMotorOverrideDto = exports.UpsertProductoMotorConfigDto = exports.AssignProductoMotorDto = exports.AssignProductoVariantesRutaMasivaDto = exports.UpdateProductoRutaPolicyDto = exports.AssignVarianteRutaDto = exports.UpdateProductoVarianteDto = exports.CreateProductoVarianteDto = exports.UpsertProductoServicioDto = exports.UpsertSubfamiliaProductoDto = exports.UpsertFamiliaProductoDto = exports.SetVarianteAdicionalRestrictionDto = exports.AssignProductoAdicionalDto = exports.UpsertProductoAdicionalServicioPricingDto = exports.UpsertProductoAdicionalServicioReglaCostoDto = exports.UpsertProductoAdicionalServicioNivelDto = exports.UpsertProductoAdicionalDto = exports.UpsertProductoAdicionalMaterialDto = exports.UpsertProductoAdicionalEfectoDto = exports.UpsertProductoAdicionalMaterialEffectDto = exports.UpsertProductoAdicionalCostEffectDto = exports.UpsertProductoAdicionalRouteEffectDto = exports.UpsertProductoAdicionalRouteEffectPasoDto = exports.UpsertProductoAdicionalEfectoScopeDto = exports.UpsertVarianteOpcionesProductivasDto = exports.UpsertVarianteOpcionProductivaDimensionDto = exports.ReglaCostoAdicionalEfectoDto = exports.TipoProductoAdicionalEfectoDto = exports.ValorOpcionProductivaDto = exports.DimensionOpcionProductivaDto = exports.TipoConsumoAdicionalMaterialDto = exports.MetodoCostoProductoAdicionalDto = exports.TipoProductoAdicionalDto = exports.CarasProductoVarianteDto = exports.TipoImpresionProductoVarianteDto = exports.EstadoProductoServicioDto = exports.TipoProductoServicioDto = void 0;
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
var ReglaCostoAdicionalEfectoDto;
(function (ReglaCostoAdicionalEfectoDto) {
    ReglaCostoAdicionalEfectoDto["flat"] = "flat";
    ReglaCostoAdicionalEfectoDto["por_unidad"] = "por_unidad";
    ReglaCostoAdicionalEfectoDto["por_pliego"] = "por_pliego";
    ReglaCostoAdicionalEfectoDto["porcentaje_sobre_total"] = "porcentaje_sobre_total";
    ReglaCostoAdicionalEfectoDto["tiempo_extra_min"] = "tiempo_extra_min";
})(ReglaCostoAdicionalEfectoDto || (exports.ReglaCostoAdicionalEfectoDto = ReglaCostoAdicionalEfectoDto = {}));
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
    setupMin;
    runMin;
    cleanupMin;
    tiempoFijoMin;
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
class UpsertProductoAdicionalRouteEffectDto {
    pasos;
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
class UpdateProductoRutaPolicyDto {
    usarRutaComunVariantes;
    procesoDefinicionDefaultId;
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
class UpsertProductoMotorConfigDto {
    parametros;
}
exports.UpsertProductoMotorConfigDto = UpsertProductoMotorConfigDto;
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertProductoMotorConfigDto.prototype, "parametros", void 0);
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
class CotizarProductoVarianteDto {
    cantidad;
    periodo;
    addonsSeleccionados;
    addonsConfig;
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
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsUUID)(undefined, { each: true }),
    __metadata("design:type", Array)
], CotizarProductoVarianteDto.prototype, "addonsSeleccionados", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CotizarAddonConfigDto),
    __metadata("design:type", Array)
], CotizarProductoVarianteDto.prototype, "addonsConfig", void 0);
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