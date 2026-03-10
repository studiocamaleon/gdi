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
exports.EmpleadoComisionDto = exports.TipoComisionDto = void 0;
const class_validator_1 = require("class-validator");
var TipoComisionDto;
(function (TipoComisionDto) {
    TipoComisionDto["porcentaje"] = "porcentaje";
    TipoComisionDto["fijo"] = "fijo";
})(TipoComisionDto || (exports.TipoComisionDto = TipoComisionDto = {}));
class EmpleadoComisionDto {
    descripcion;
    tipo;
    valor;
}
exports.EmpleadoComisionDto = EmpleadoComisionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], EmpleadoComisionDto.prototype, "descripcion", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TipoComisionDto),
    __metadata("design:type", String)
], EmpleadoComisionDto.prototype, "tipo", void 0);
__decorate([
    (0, class_validator_1.IsNumberString)(),
    __metadata("design:type", String)
], EmpleadoComisionDto.prototype, "valor", void 0);
//# sourceMappingURL=comision.dto.js.map