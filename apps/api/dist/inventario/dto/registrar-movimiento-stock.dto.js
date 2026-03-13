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
exports.RegistrarMovimientoStockDto = exports.OrigenMovimientoStockMateriaPrimaDto = exports.TipoMovimientoStockMateriaPrimaDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
var TipoMovimientoStockMateriaPrimaDto;
(function (TipoMovimientoStockMateriaPrimaDto) {
    TipoMovimientoStockMateriaPrimaDto["ingreso"] = "ingreso";
    TipoMovimientoStockMateriaPrimaDto["egreso"] = "egreso";
    TipoMovimientoStockMateriaPrimaDto["ajuste_entrada"] = "ajuste_entrada";
    TipoMovimientoStockMateriaPrimaDto["ajuste_salida"] = "ajuste_salida";
})(TipoMovimientoStockMateriaPrimaDto || (exports.TipoMovimientoStockMateriaPrimaDto = TipoMovimientoStockMateriaPrimaDto = {}));
var OrigenMovimientoStockMateriaPrimaDto;
(function (OrigenMovimientoStockMateriaPrimaDto) {
    OrigenMovimientoStockMateriaPrimaDto["compra"] = "compra";
    OrigenMovimientoStockMateriaPrimaDto["consumo_produccion"] = "consumo_produccion";
    OrigenMovimientoStockMateriaPrimaDto["ajuste_manual"] = "ajuste_manual";
    OrigenMovimientoStockMateriaPrimaDto["transferencia"] = "transferencia";
    OrigenMovimientoStockMateriaPrimaDto["devolucion"] = "devolucion";
    OrigenMovimientoStockMateriaPrimaDto["otro"] = "otro";
})(OrigenMovimientoStockMateriaPrimaDto || (exports.OrigenMovimientoStockMateriaPrimaDto = OrigenMovimientoStockMateriaPrimaDto = {}));
class RegistrarMovimientoStockDto {
    varianteId;
    ubicacionId;
    tipo;
    origen;
    cantidad;
    costoUnitario;
    referenciaTipo;
    referenciaId;
    notas;
}
exports.RegistrarMovimientoStockDto = RegistrarMovimientoStockDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RegistrarMovimientoStockDto.prototype, "varianteId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RegistrarMovimientoStockDto.prototype, "ubicacionId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TipoMovimientoStockMateriaPrimaDto),
    __metadata("design:type", String)
], RegistrarMovimientoStockDto.prototype, "tipo", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(OrigenMovimientoStockMateriaPrimaDto),
    __metadata("design:type", String)
], RegistrarMovimientoStockDto.prototype, "origen", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.0001),
    __metadata("design:type", Number)
], RegistrarMovimientoStockDto.prototype, "cantidad", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], RegistrarMovimientoStockDto.prototype, "costoUnitario", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegistrarMovimientoStockDto.prototype, "referenciaTipo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegistrarMovimientoStockDto.prototype, "referenciaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegistrarMovimientoStockDto.prototype, "notas", void 0);
//# sourceMappingURL=registrar-movimiento-stock.dto.js.map