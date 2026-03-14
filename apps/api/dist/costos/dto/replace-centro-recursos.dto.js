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
exports.ReplaceCentroRecursosDto = exports.CentroCostoRecursoItemDto = exports.TipoGastoGeneralCentroCostoDto = exports.TipoRecursoCentroCostoDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
var TipoRecursoCentroCostoDto;
(function (TipoRecursoCentroCostoDto) {
    TipoRecursoCentroCostoDto["empleado"] = "empleado";
    TipoRecursoCentroCostoDto["maquinaria"] = "maquinaria";
    TipoRecursoCentroCostoDto["gasto_general"] = "gasto_general";
    TipoRecursoCentroCostoDto["activo_fijo"] = "activo_fijo";
})(TipoRecursoCentroCostoDto || (exports.TipoRecursoCentroCostoDto = TipoRecursoCentroCostoDto = {}));
var TipoGastoGeneralCentroCostoDto;
(function (TipoGastoGeneralCentroCostoDto) {
    TipoGastoGeneralCentroCostoDto["limpieza"] = "limpieza";
    TipoGastoGeneralCentroCostoDto["mantenimiento"] = "mantenimiento";
    TipoGastoGeneralCentroCostoDto["servicios"] = "servicios";
    TipoGastoGeneralCentroCostoDto["alquiler"] = "alquiler";
    TipoGastoGeneralCentroCostoDto["otro"] = "otro";
})(TipoGastoGeneralCentroCostoDto || (exports.TipoGastoGeneralCentroCostoDto = TipoGastoGeneralCentroCostoDto = {}));
class CentroCostoRecursoItemDto {
    tipoRecurso;
    empleadoId;
    maquinaId;
    nombreRecurso;
    tipoGastoGeneral;
    valorMensual;
    vidaUtilRestanteMeses;
    valorActual;
    valorFinalVida;
    descripcion;
    porcentajeAsignacion;
    activo;
}
exports.CentroCostoRecursoItemDto = CentroCostoRecursoItemDto;
__decorate([
    (0, class_validator_1.IsEnum)(TipoRecursoCentroCostoDto),
    __metadata("design:type", String)
], CentroCostoRecursoItemDto.prototype, "tipoRecurso", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CentroCostoRecursoItemDto.prototype, "empleadoId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CentroCostoRecursoItemDto.prototype, "maquinaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CentroCostoRecursoItemDto.prototype, "nombreRecurso", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(TipoGastoGeneralCentroCostoDto),
    __metadata("design:type", String)
], CentroCostoRecursoItemDto.prototype, "tipoGastoGeneral", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoRecursoItemDto.prototype, "valorMensual", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 0 }),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CentroCostoRecursoItemDto.prototype, "vidaUtilRestanteMeses", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoRecursoItemDto.prototype, "valorActual", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CentroCostoRecursoItemDto.prototype, "valorFinalVida", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CentroCostoRecursoItemDto.prototype, "descripcion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CentroCostoRecursoItemDto.prototype, "porcentajeAsignacion", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CentroCostoRecursoItemDto.prototype, "activo", void 0);
class ReplaceCentroRecursosDto {
    recursos;
}
exports.ReplaceCentroRecursosDto = ReplaceCentroRecursosDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CentroCostoRecursoItemDto),
    __metadata("design:type", Array)
], ReplaceCentroRecursosDto.prototype, "recursos", void 0);
//# sourceMappingURL=replace-centro-recursos.dto.js.map