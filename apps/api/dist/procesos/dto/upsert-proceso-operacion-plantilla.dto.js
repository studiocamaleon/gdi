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
exports.UpsertProcesoOperacionPlantillaDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const upsert_proceso_dto_1 = require("./upsert-proceso.dto");
class UpsertProcesoOperacionPlantillaDto {
    nombre;
    tipoOperacion;
    centroCostoId;
    maquinaId;
    perfilOperativoId;
    setupMin;
    cleanupMin;
    tiempoFijoMin;
    modoProductividad;
    productividadBase;
    unidadEntrada;
    unidadSalida;
    unidadTiempo;
    mermaRunPct;
    reglaVelocidad;
    reglaMerma;
    observaciones;
    niveles;
    activo;
}
exports.UpsertProcesoOperacionPlantillaDto = UpsertProcesoOperacionPlantillaDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpsertProcesoOperacionPlantillaDto.prototype, "nombre", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(upsert_proceso_dto_1.TipoOperacionProcesoDto),
    __metadata("design:type", String)
], UpsertProcesoOperacionPlantillaDto.prototype, "tipoOperacion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProcesoOperacionPlantillaDto.prototype, "centroCostoId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProcesoOperacionPlantillaDto.prototype, "maquinaId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertProcesoOperacionPlantillaDto.prototype, "perfilOperativoId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertProcesoOperacionPlantillaDto.prototype, "setupMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertProcesoOperacionPlantillaDto.prototype, "cleanupMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertProcesoOperacionPlantillaDto.prototype, "tiempoFijoMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(upsert_proceso_dto_1.ModoProductividadProcesoDto),
    __metadata("design:type", String)
], UpsertProcesoOperacionPlantillaDto.prototype, "modoProductividad", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertProcesoOperacionPlantillaDto.prototype, "productividadBase", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(upsert_proceso_dto_1.UnidadProcesoDto),
    __metadata("design:type", String)
], UpsertProcesoOperacionPlantillaDto.prototype, "unidadEntrada", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(upsert_proceso_dto_1.UnidadProcesoDto),
    __metadata("design:type", String)
], UpsertProcesoOperacionPlantillaDto.prototype, "unidadSalida", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(upsert_proceso_dto_1.UnidadProcesoDto),
    __metadata("design:type", String)
], UpsertProcesoOperacionPlantillaDto.prototype, "unidadTiempo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertProcesoOperacionPlantillaDto.prototype, "mermaRunPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertProcesoOperacionPlantillaDto.prototype, "reglaVelocidad", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertProcesoOperacionPlantillaDto.prototype, "reglaMerma", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertProcesoOperacionPlantillaDto.prototype, "observaciones", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => upsert_proceso_dto_1.ProcesoOperacionNivelDto),
    __metadata("design:type", Array)
], UpsertProcesoOperacionPlantillaDto.prototype, "niveles", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertProcesoOperacionPlantillaDto.prototype, "activo", void 0);
//# sourceMappingURL=upsert-proceso-operacion-plantilla.dto.js.map