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
exports.PreviewImposicionProductoVarianteDto = exports.CotizarProductoVarianteDto = exports.UpsertVarianteMotorOverrideDto = exports.UpsertProductoMotorConfigDto = exports.AssignProductoMotorDto = exports.AssignProductoVariantesRutaMasivaDto = exports.UpdateProductoRutaPolicyDto = exports.AssignVarianteRutaDto = exports.UpdateProductoVarianteDto = exports.CreateProductoVarianteDto = exports.UpsertProductoServicioDto = exports.UpsertSubfamiliaProductoDto = exports.UpsertFamiliaProductoDto = exports.CarasProductoVarianteDto = exports.TipoImpresionProductoVarianteDto = exports.EstadoProductoServicioDto = exports.TipoProductoServicioDto = void 0;
const class_validator_1 = require("class-validator");
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
class CotizarProductoVarianteDto {
    cantidad;
    periodo;
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