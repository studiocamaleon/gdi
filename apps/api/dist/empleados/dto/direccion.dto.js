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
exports.EmpleadoDireccionDto = exports.TipoDireccionDto = void 0;
const class_validator_1 = require("class-validator");
var TipoDireccionDto;
(function (TipoDireccionDto) {
    TipoDireccionDto["principal"] = "principal";
    TipoDireccionDto["facturacion"] = "facturacion";
    TipoDireccionDto["entrega"] = "entrega";
})(TipoDireccionDto || (exports.TipoDireccionDto = TipoDireccionDto = {}));
class EmpleadoDireccionDto {
    descripcion;
    pais;
    codigoPostal;
    direccion;
    numero;
    ciudad;
    tipo;
    principal;
}
exports.EmpleadoDireccionDto = EmpleadoDireccionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], EmpleadoDireccionDto.prototype, "descripcion", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 2),
    __metadata("design:type", String)
], EmpleadoDireccionDto.prototype, "pais", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EmpleadoDireccionDto.prototype, "codigoPostal", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], EmpleadoDireccionDto.prototype, "direccion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EmpleadoDireccionDto.prototype, "numero", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], EmpleadoDireccionDto.prototype, "ciudad", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TipoDireccionDto),
    __metadata("design:type", String)
], EmpleadoDireccionDto.prototype, "tipo", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EmpleadoDireccionDto.prototype, "principal", void 0);
//# sourceMappingURL=direccion.dto.js.map