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
exports.UpsertProcesoOperacionMaterialDto = exports.MATERIAL_FORMULAS = exports.UpsertProcesoOperacionMaterialVarianteDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class UpsertProcesoOperacionMaterialVarianteDto {
    materiaPrimaVarianteId;
    orden;
    activo;
}
exports.UpsertProcesoOperacionMaterialVarianteDto = UpsertProcesoOperacionMaterialVarianteDto;
__decorate([
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], UpsertProcesoOperacionMaterialVarianteDto.prototype, "materiaPrimaVarianteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProcesoOperacionMaterialVarianteDto.prototype, "orden", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProcesoOperacionMaterialVarianteDto.prototype, "activo", void 0);
exports.MATERIAL_FORMULAS = [
    'por_unidad_productiva',
    'por_m2',
    'por_pieza',
    'por_metro_lineal',
    'fijo',
];
class UpsertProcesoOperacionMaterialDto {
    nombre;
    materiaPrimaVarianteId;
    productoComponenteId;
    varianteComponenteId;
    formula;
    cantidadPorUnidad;
    unidad;
    precioManual;
    aplicaMultiCaras;
    esSustratoNesting;
    variantesHabilitadas;
    orden;
    activo;
}
exports.UpsertProcesoOperacionMaterialDto = UpsertProcesoOperacionMaterialDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpsertProcesoOperacionMaterialDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", Object)
], UpsertProcesoOperacionMaterialDto.prototype, "materiaPrimaVarianteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", Object)
], UpsertProcesoOperacionMaterialDto.prototype, "productoComponenteId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", Object)
], UpsertProcesoOperacionMaterialDto.prototype, "varianteComponenteId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.MATERIAL_FORMULAS),
    __metadata("design:type", String)
], UpsertProcesoOperacionMaterialDto.prototype, "formula", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProcesoOperacionMaterialDto.prototype, "cantidadPorUnidad", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], UpsertProcesoOperacionMaterialDto.prototype, "unidad", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Object)
], UpsertProcesoOperacionMaterialDto.prototype, "precioManual", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProcesoOperacionMaterialDto.prototype, "aplicaMultiCaras", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProcesoOperacionMaterialDto.prototype, "esSustratoNesting", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => UpsertProcesoOperacionMaterialVarianteDto),
    __metadata("design:type", Array)
], UpsertProcesoOperacionMaterialDto.prototype, "variantesHabilitadas", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertProcesoOperacionMaterialDto.prototype, "orden", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProcesoOperacionMaterialDto.prototype, "activo", void 0);
//# sourceMappingURL=upsert-proceso-operacion-material.dto.js.map