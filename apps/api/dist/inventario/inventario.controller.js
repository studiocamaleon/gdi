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
exports.InventarioController = void 0;
const common_1 = require("@nestjs/common");
const current_auth_decorator_1 = require("../auth/current-auth.decorator");
const upsert_materia_prima_dto_1 = require("./dto/upsert-materia-prima.dto");
const inventario_service_1 = require("./inventario.service");
let InventarioController = class InventarioController {
    inventarioService;
    constructor(inventarioService) {
        this.inventarioService = inventarioService;
    }
    findAll(auth) {
        return this.inventarioService.findAllMateriasPrimas(auth);
    }
    findOne(auth, id) {
        return this.inventarioService.findMateriaPrima(auth, id);
    }
    create(auth, payload) {
        return this.inventarioService.createMateriaPrima(auth, payload);
    }
    update(auth, id, payload) {
        return this.inventarioService.updateMateriaPrima(auth, id, payload);
    }
    toggle(auth, id) {
        return this.inventarioService.toggleMateriaPrima(auth, id);
    }
};
exports.InventarioController = InventarioController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InventarioController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventarioController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_materia_prima_dto_1.UpsertMateriaPrimaDto]),
    __metadata("design:returntype", void 0)
], InventarioController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, upsert_materia_prima_dto_1.UpsertMateriaPrimaDto]),
    __metadata("design:returntype", void 0)
], InventarioController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/toggle'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventarioController.prototype, "toggle", null);
exports.InventarioController = InventarioController = __decorate([
    (0, common_1.Controller)('inventario/materias-primas'),
    __metadata("design:paramtypes", [inventario_service_1.InventarioService])
], InventarioController);
//# sourceMappingURL=inventario.controller.js.map