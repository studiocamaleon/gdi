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
exports.UpsertCentroRecursosMaquinariaDto = exports.CentroCostoRecursoMaquinaPeriodoItemDto = exports.MetodoDepreciacionMaquinaDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
var MetodoDepreciacionMaquinaDto;
(function (MetodoDepreciacionMaquinaDto) {
    MetodoDepreciacionMaquinaDto["lineal"] = "lineal";
})(MetodoDepreciacionMaquinaDto || (exports.MetodoDepreciacionMaquinaDto = MetodoDepreciacionMaquinaDto = {}));
class CentroCostoRecursoMaquinaPeriodoItemDto {
    centroCostoRecursoId;
    metodoDepreciacion;
    valorCompra;
    valorResidual;
    vidaUtilMeses;
    potenciaNominalKw;
    factorCargaPct;
    tarifaEnergiaKwh;
    horasProgramadasMes;
    disponibilidadPct;
    eficienciaPct;
    mantenimientoMensual;
    segurosMensual;
    otrosFijosMensual;
}
exports.CentroCostoRecursoMaquinaPeriodoItemDto = CentroCostoRecursoMaquinaPeriodoItemDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CentroCostoRecursoMaquinaPeriodoItemDto.prototype, "centroCostoRecursoId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(MetodoDepreciacionMaquinaDto),
    __metadata("design:type", String)
], CentroCostoRecursoMaquinaPeriodoItemDto.prototype, "metodoDepreciacion", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoRecursoMaquinaPeriodoItemDto.prototype, "valorCompra", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoRecursoMaquinaPeriodoItemDto.prototype, "valorResidual", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 0 }),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CentroCostoRecursoMaquinaPeriodoItemDto.prototype, "vidaUtilMeses", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoRecursoMaquinaPeriodoItemDto.prototype, "potenciaNominalKw", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoRecursoMaquinaPeriodoItemDto.prototype, "factorCargaPct", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 4 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoRecursoMaquinaPeriodoItemDto.prototype, "tarifaEnergiaKwh", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoRecursoMaquinaPeriodoItemDto.prototype, "horasProgramadasMes", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoRecursoMaquinaPeriodoItemDto.prototype, "disponibilidadPct", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoRecursoMaquinaPeriodoItemDto.prototype, "eficienciaPct", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoRecursoMaquinaPeriodoItemDto.prototype, "mantenimientoMensual", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoRecursoMaquinaPeriodoItemDto.prototype, "segurosMensual", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoRecursoMaquinaPeriodoItemDto.prototype, "otrosFijosMensual", void 0);
class UpsertCentroRecursosMaquinariaDto {
    recursos;
}
exports.UpsertCentroRecursosMaquinariaDto = UpsertCentroRecursosMaquinariaDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CentroCostoRecursoMaquinaPeriodoItemDto),
    __metadata("design:type", Array)
], UpsertCentroRecursosMaquinariaDto.prototype, "recursos", void 0);
//# sourceMappingURL=upsert-centro-recursos-maquinaria.dto.js.map