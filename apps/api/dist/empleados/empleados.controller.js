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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmpleadosController = void 0;
const common_1 = require("@nestjs/common");
const current_auth_decorator_1 = require("../auth/current-auth.decorator");
const pagination_dto_1 = require("../common/dto/pagination.dto");
const invitar_acceso_dto_1 = require("./dto/invitar-acceso.dto");
const empleados_service_1 = require("./empleados.service");
const upsert_empleado_dto_1 = require("./dto/upsert-empleado.dto");
let EmpleadosController = class EmpleadosController {
    empleadosService;
    constructor(empleadosService) {
        this.empleadosService = empleadosService;
    }
    findAll(auth, pagination) {
        return this.empleadosService.findAll(auth, pagination);
    }
    findOne(auth, id) {
        return this.empleadosService.findOne(auth, id);
    }
    create(auth, payload) {
        return this.empleadosService.create(auth, payload);
    }
    update(auth, id, payload) {
        return this.empleadosService.update(auth, id, payload);
    }
    invitarAcceso(auth, id, payload) {
        return this.empleadosService.invitarAcceso(auth, id, payload);
    }
    async remove(auth, id) {
        await this.empleadosService.remove(auth, id);
    }
};
exports.EmpleadosController = EmpleadosController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", void 0)
], EmpleadosController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmpleadosController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_empleado_dto_1.UpsertEmpleadoDto]),
    __metadata("design:returntype", void 0)
], EmpleadosController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, upsert_empleado_dto_1.UpsertEmpleadoDto]),
    __metadata("design:returntype", void 0)
], EmpleadosController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/invitar-acceso'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, invitar_acceso_dto_1.InvitarAccesoDto]),
    __metadata("design:returntype", void 0)
], EmpleadosController.prototype, "invitarAcceso", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EmpleadosController.prototype, "remove", null);
exports.EmpleadosController = EmpleadosController = __decorate([
    (0, common_1.Controller)('empleados'),
    __metadata("design:paramtypes", [empleados_service_1.EmpleadosService])
], EmpleadosController);
//# sourceMappingURL=empleados.controller.js.map