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
exports.UpsertCentroCostoDto = exports.UnidadBaseCentroCostoDto = exports.ImputacionPreferidaCentroCostoDto = exports.CategoriaGraficaCentroCostoDto = exports.TipoCentroCostoDto = void 0;
const class_validator_1 = require("class-validator");
var TipoCentroCostoDto;
(function (TipoCentroCostoDto) {
    TipoCentroCostoDto["productivo"] = "productivo";
    TipoCentroCostoDto["apoyo"] = "apoyo";
    TipoCentroCostoDto["administrativo"] = "administrativo";
    TipoCentroCostoDto["comercial"] = "comercial";
    TipoCentroCostoDto["logistico"] = "logistico";
    TipoCentroCostoDto["tercerizado"] = "tercerizado";
})(TipoCentroCostoDto || (exports.TipoCentroCostoDto = TipoCentroCostoDto = {}));
var CategoriaGraficaCentroCostoDto;
(function (CategoriaGraficaCentroCostoDto) {
    CategoriaGraficaCentroCostoDto["preprensa"] = "preprensa";
    CategoriaGraficaCentroCostoDto["impresion"] = "impresion";
    CategoriaGraficaCentroCostoDto["terminacion"] = "terminacion";
    CategoriaGraficaCentroCostoDto["empaque"] = "empaque";
    CategoriaGraficaCentroCostoDto["logistica"] = "logistica";
    CategoriaGraficaCentroCostoDto["calidad"] = "calidad";
    CategoriaGraficaCentroCostoDto["mantenimiento"] = "mantenimiento";
    CategoriaGraficaCentroCostoDto["administracion"] = "administracion";
    CategoriaGraficaCentroCostoDto["comercial"] = "comercial";
    CategoriaGraficaCentroCostoDto["tercerizado"] = "tercerizado";
})(CategoriaGraficaCentroCostoDto || (exports.CategoriaGraficaCentroCostoDto = CategoriaGraficaCentroCostoDto = {}));
var ImputacionPreferidaCentroCostoDto;
(function (ImputacionPreferidaCentroCostoDto) {
    ImputacionPreferidaCentroCostoDto["directa"] = "directa";
    ImputacionPreferidaCentroCostoDto["indirecta"] = "indirecta";
    ImputacionPreferidaCentroCostoDto["reparto"] = "reparto";
})(ImputacionPreferidaCentroCostoDto || (exports.ImputacionPreferidaCentroCostoDto = ImputacionPreferidaCentroCostoDto = {}));
var UnidadBaseCentroCostoDto;
(function (UnidadBaseCentroCostoDto) {
    UnidadBaseCentroCostoDto["ninguna"] = "ninguna";
    UnidadBaseCentroCostoDto["hora_maquina"] = "hora_maquina";
    UnidadBaseCentroCostoDto["hora_hombre"] = "hora_hombre";
    UnidadBaseCentroCostoDto["pliego"] = "pliego";
    UnidadBaseCentroCostoDto["unidad"] = "unidad";
    UnidadBaseCentroCostoDto["m2"] = "m2";
    UnidadBaseCentroCostoDto["kg"] = "kg";
})(UnidadBaseCentroCostoDto || (exports.UnidadBaseCentroCostoDto = UnidadBaseCentroCostoDto = {}));
class UpsertCentroCostoDto {
    plantaId;
    areaCostoId;
    codigo;
    nombre;
    descripcion;
    tipoCentro;
    categoriaGrafica;
    imputacionPreferida;
    unidadBaseFutura;
    responsableEmpleadoId;
    proveedorDefaultId;
    activo;
}
exports.UpsertCentroCostoDto = UpsertCentroCostoDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertCentroCostoDto.prototype, "plantaId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertCentroCostoDto.prototype, "areaCostoId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpsertCentroCostoDto.prototype, "codigo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpsertCentroCostoDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertCentroCostoDto.prototype, "descripcion", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(TipoCentroCostoDto),
    __metadata("design:type", String)
], UpsertCentroCostoDto.prototype, "tipoCentro", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(CategoriaGraficaCentroCostoDto),
    __metadata("design:type", String)
], UpsertCentroCostoDto.prototype, "categoriaGrafica", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(ImputacionPreferidaCentroCostoDto),
    __metadata("design:type", String)
], UpsertCentroCostoDto.prototype, "imputacionPreferida", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(UnidadBaseCentroCostoDto),
    __metadata("design:type", String)
], UpsertCentroCostoDto.prototype, "unidadBaseFutura", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertCentroCostoDto.prototype, "responsableEmpleadoId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertCentroCostoDto.prototype, "proveedorDefaultId", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertCentroCostoDto.prototype, "activo", void 0);
//# sourceMappingURL=upsert-centro-costo.dto.js.map