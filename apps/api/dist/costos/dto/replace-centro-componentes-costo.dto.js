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
exports.ReplaceCentroComponentesCostoDto = exports.CentroCostoComponenteCostoItemDto = exports.OrigenComponenteCostoCentroDto = exports.CategoriaComponenteCostoCentroDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
var CategoriaComponenteCostoCentroDto;
(function (CategoriaComponenteCostoCentroDto) {
    CategoriaComponenteCostoCentroDto["sueldos"] = "sueldos";
    CategoriaComponenteCostoCentroDto["cargas"] = "cargas";
    CategoriaComponenteCostoCentroDto["mantenimiento"] = "mantenimiento";
    CategoriaComponenteCostoCentroDto["energia"] = "energia";
    CategoriaComponenteCostoCentroDto["alquiler"] = "alquiler";
    CategoriaComponenteCostoCentroDto["amortizacion"] = "amortizacion";
    CategoriaComponenteCostoCentroDto["tercerizacion"] = "tercerizacion";
    CategoriaComponenteCostoCentroDto["insumos_indirectos"] = "insumos_indirectos";
    CategoriaComponenteCostoCentroDto["otros"] = "otros";
})(CategoriaComponenteCostoCentroDto || (exports.CategoriaComponenteCostoCentroDto = CategoriaComponenteCostoCentroDto = {}));
var OrigenComponenteCostoCentroDto;
(function (OrigenComponenteCostoCentroDto) {
    OrigenComponenteCostoCentroDto["manual"] = "manual";
    OrigenComponenteCostoCentroDto["sugerido"] = "sugerido";
})(OrigenComponenteCostoCentroDto || (exports.OrigenComponenteCostoCentroDto = OrigenComponenteCostoCentroDto = {}));
class CentroCostoComponenteCostoItemDto {
    categoria;
    nombre;
    origen;
    importeMensual;
    notas;
    detalle;
}
exports.CentroCostoComponenteCostoItemDto = CentroCostoComponenteCostoItemDto;
__decorate([
    (0, class_validator_1.IsEnum)(CategoriaComponenteCostoCentroDto),
    __metadata("design:type", String)
], CentroCostoComponenteCostoItemDto.prototype, "categoria", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CentroCostoComponenteCostoItemDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(OrigenComponenteCostoCentroDto),
    __metadata("design:type", String)
], CentroCostoComponenteCostoItemDto.prototype, "origen", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoComponenteCostoItemDto.prototype, "importeMensual", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CentroCostoComponenteCostoItemDto.prototype, "notas", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CentroCostoComponenteCostoItemDto.prototype, "detalle", void 0);
class ReplaceCentroComponentesCostoDto {
    componentes;
}
exports.ReplaceCentroComponentesCostoDto = ReplaceCentroComponentesCostoDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CentroCostoComponenteCostoItemDto),
    __metadata("design:type", Array)
], ReplaceCentroComponentesCostoDto.prototype, "componentes", void 0);
//# sourceMappingURL=replace-centro-componentes-costo.dto.js.map