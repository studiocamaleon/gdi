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
exports.UpsertEmpleadoDto = exports.RolSistemaDto = exports.SexoEmpleadoDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const comision_dto_1 = require("./comision.dto");
const direccion_dto_1 = require("./direccion.dto");
var SexoEmpleadoDto;
(function (SexoEmpleadoDto) {
    SexoEmpleadoDto["masculino"] = "masculino";
    SexoEmpleadoDto["femenino"] = "femenino";
    SexoEmpleadoDto["no_binario"] = "no_binario";
    SexoEmpleadoDto["prefiero_no_decir"] = "prefiero_no_decir";
})(SexoEmpleadoDto || (exports.SexoEmpleadoDto = SexoEmpleadoDto = {}));
var RolSistemaDto;
(function (RolSistemaDto) {
    RolSistemaDto["administrador"] = "administrador";
    RolSistemaDto["supervisor"] = "supervisor";
    RolSistemaDto["operador"] = "operador";
})(RolSistemaDto || (exports.RolSistemaDto = RolSistemaDto = {}));
class UpsertEmpleadoDto {
    nombreCompleto;
    email;
    telefonoCodigo;
    telefonoNumero;
    sector;
    ocupacion;
    sexo;
    fechaIngreso;
    fechaNacimiento;
    usuarioSistema;
    emailAcceso;
    rolSistema;
    comisionesHabilitadas;
    direcciones;
    comisiones;
}
exports.UpsertEmpleadoDto = UpsertEmpleadoDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpsertEmpleadoDto.prototype, "nombreCompleto", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], UpsertEmpleadoDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertEmpleadoDto.prototype, "telefonoCodigo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertEmpleadoDto.prototype, "telefonoNumero", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpsertEmpleadoDto.prototype, "sector", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertEmpleadoDto.prototype, "ocupacion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(SexoEmpleadoDto),
    __metadata("design:type", String)
], UpsertEmpleadoDto.prototype, "sexo", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpsertEmpleadoDto.prototype, "fechaIngreso", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpsertEmpleadoDto.prototype, "fechaNacimiento", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertEmpleadoDto.prototype, "usuarioSistema", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], UpsertEmpleadoDto.prototype, "emailAcceso", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(RolSistemaDto),
    __metadata("design:type", String)
], UpsertEmpleadoDto.prototype, "rolSistema", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertEmpleadoDto.prototype, "comisionesHabilitadas", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => direccion_dto_1.EmpleadoDireccionDto),
    __metadata("design:type", Array)
], UpsertEmpleadoDto.prototype, "direcciones", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => comision_dto_1.EmpleadoComisionDto),
    __metadata("design:type", Array)
], UpsertEmpleadoDto.prototype, "comisiones", void 0);
//# sourceMappingURL=upsert-empleado.dto.js.map