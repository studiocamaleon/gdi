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
exports.ProduccionController = void 0;
const common_1 = require("@nestjs/common");
const current_auth_decorator_1 = require("../auth/current-auth.decorator");
const produccion_service_1 = require("./produccion.service");
const upsert_estacion_dto_1 = require("./dto/upsert-estacion.dto");
let ProduccionController = class ProduccionController {
    service;
    constructor(service) {
        this.service = service;
    }
    findEstaciones(auth) {
        return this.service.findEstaciones(auth);
    }
    createEstacion(auth, payload) {
        return this.service.createEstacion(auth, payload);
    }
    updateEstacion(auth, id, payload) {
        return this.service.updateEstacion(auth, id, payload);
    }
    toggleEstacion(auth, id) {
        return this.service.toggleEstacion(auth, id);
    }
};
exports.ProduccionController = ProduccionController;
__decorate([
    (0, common_1.Get)('estaciones'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProduccionController.prototype, "findEstaciones", null);
__decorate([
    (0, common_1.Post)('estaciones'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_estacion_dto_1.UpsertEstacionDto]),
    __metadata("design:returntype", void 0)
], ProduccionController.prototype, "createEstacion", null);
__decorate([
    (0, common_1.Put)('estaciones/:id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, upsert_estacion_dto_1.UpsertEstacionDto]),
    __metadata("design:returntype", void 0)
], ProduccionController.prototype, "updateEstacion", null);
__decorate([
    (0, common_1.Patch)('estaciones/:id/toggle'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProduccionController.prototype, "toggleEstacion", null);
exports.ProduccionController = ProduccionController = __decorate([
    (0, common_1.Controller)('produccion'),
    __metadata("design:paramtypes", [produccion_service_1.ProduccionService])
], ProduccionController);
//# sourceMappingURL=produccion.controller.js.map