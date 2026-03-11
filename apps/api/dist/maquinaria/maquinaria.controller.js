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
exports.MaquinariaController = void 0;
const common_1 = require("@nestjs/common");
const current_auth_decorator_1 = require("../auth/current-auth.decorator");
const upsert_maquina_dto_1 = require("./dto/upsert-maquina.dto");
const maquinaria_service_1 = require("./maquinaria.service");
let MaquinariaController = class MaquinariaController {
    maquinariaService;
    constructor(maquinariaService) {
        this.maquinariaService = maquinariaService;
    }
    findAll(auth) {
        return this.maquinariaService.findAll(auth);
    }
    findOne(auth, id) {
        return this.maquinariaService.findOne(auth, id);
    }
    create(auth, payload) {
        return this.maquinariaService.create(auth, payload);
    }
    update(auth, id, payload) {
        return this.maquinariaService.update(auth, id, payload);
    }
    toggle(auth, id) {
        return this.maquinariaService.toggle(auth, id);
    }
};
exports.MaquinariaController = MaquinariaController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MaquinariaController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MaquinariaController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_maquina_dto_1.UpsertMaquinaDto]),
    __metadata("design:returntype", void 0)
], MaquinariaController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, upsert_maquina_dto_1.UpsertMaquinaDto]),
    __metadata("design:returntype", void 0)
], MaquinariaController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/toggle'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MaquinariaController.prototype, "toggle", null);
exports.MaquinariaController = MaquinariaController = __decorate([
    (0, common_1.Controller)('maquinaria'),
    __metadata("design:paramtypes", [maquinaria_service_1.MaquinariaService])
], MaquinariaController);
//# sourceMappingURL=maquinaria.controller.js.map