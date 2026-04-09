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
exports.ProcesosController = void 0;
const common_1 = require("@nestjs/common");
const current_auth_decorator_1 = require("../auth/current-auth.decorator");
const pagination_dto_1 = require("../common/dto/pagination.dto");
const evaluar_proceso_costo_dto_1 = require("./dto/evaluar-proceso-costo.dto");
const bulk_assign_estacion_plantillas_dto_1 = require("./dto/bulk-assign-estacion-plantillas.dto");
const upsert_proceso_operacion_plantilla_dto_1 = require("./dto/upsert-proceso-operacion-plantilla.dto");
const upsert_proceso_dto_1 = require("./dto/upsert-proceso.dto");
const procesos_service_1 = require("./procesos.service");
let ProcesosController = class ProcesosController {
    procesosService;
    constructor(procesosService) {
        this.procesosService = procesosService;
    }
    findAll(auth, pagination) {
        return this.procesosService.findAll(auth, pagination);
    }
    findAllBiblioteca(auth) {
        return this.procesosService.findAllBibliotecaOperaciones(auth);
    }
    createBiblioteca(auth, payload) {
        return this.procesosService.createBibliotecaOperacion(auth, payload);
    }
    updateBiblioteca(auth, id, payload) {
        return this.procesosService.updateBibliotecaOperacion(auth, id, payload);
    }
    toggleBiblioteca(auth, id) {
        return this.procesosService.toggleBibliotecaOperacion(auth, id);
    }
    bulkAssignEstacion(auth, payload) {
        return this.procesosService.bulkAssignEstacionPlantillas(auth, payload);
    }
    findOne(auth, id) {
        return this.procesosService.findOne(auth, id);
    }
    getVersiones(auth, id) {
        return this.procesosService.getVersiones(auth, id);
    }
    create(auth, payload) {
        return this.procesosService.create(auth, payload);
    }
    update(auth, id, payload) {
        return this.procesosService.update(auth, id, payload);
    }
    toggle(auth, id) {
        return this.procesosService.toggle(auth, id);
    }
    snapshotCosto(auth, id, periodo) {
        return this.procesosService.snapshotCosto(auth, id, periodo);
    }
    evaluarCosto(auth, id, payload) {
        return this.procesosService.evaluarCosto(auth, id, payload);
    }
};
exports.ProcesosController = ProcesosController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", void 0)
], ProcesosController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('biblioteca-operaciones'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProcesosController.prototype, "findAllBiblioteca", null);
__decorate([
    (0, common_1.Post)('biblioteca-operaciones'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_proceso_operacion_plantilla_dto_1.UpsertProcesoOperacionPlantillaDto]),
    __metadata("design:returntype", void 0)
], ProcesosController.prototype, "createBiblioteca", null);
__decorate([
    (0, common_1.Put)('biblioteca-operaciones/:id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, upsert_proceso_operacion_plantilla_dto_1.UpsertProcesoOperacionPlantillaDto]),
    __metadata("design:returntype", void 0)
], ProcesosController.prototype, "updateBiblioteca", null);
__decorate([
    (0, common_1.Patch)('biblioteca-operaciones/:id/toggle'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProcesosController.prototype, "toggleBiblioteca", null);
__decorate([
    (0, common_1.Patch)('biblioteca-operaciones/bulk-assign-estacion'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bulk_assign_estacion_plantillas_dto_1.BulkAssignEstacionPlantillasDto]),
    __metadata("design:returntype", void 0)
], ProcesosController.prototype, "bulkAssignEstacion", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProcesosController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/versiones'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProcesosController.prototype, "getVersiones", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_proceso_dto_1.UpsertProcesoDto]),
    __metadata("design:returntype", void 0)
], ProcesosController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, upsert_proceso_dto_1.UpsertProcesoDto]),
    __metadata("design:returntype", void 0)
], ProcesosController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/toggle'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProcesosController.prototype, "toggle", null);
__decorate([
    (0, common_1.Post)(':id/snapshot-costo'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('periodo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ProcesosController.prototype, "snapshotCosto", null);
__decorate([
    (0, common_1.Post)(':id/evaluar-costo'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, evaluar_proceso_costo_dto_1.EvaluarProcesoCostoDto]),
    __metadata("design:returntype", void 0)
], ProcesosController.prototype, "evaluarCosto", null);
exports.ProcesosController = ProcesosController = __decorate([
    (0, common_1.Controller)('procesos'),
    __metadata("design:paramtypes", [procesos_service_1.ProcesosService])
], ProcesosController);
//# sourceMappingURL=procesos.controller.js.map