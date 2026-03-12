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
exports.InventarioStockController = void 0;
const common_1 = require("@nestjs/common");
const current_auth_decorator_1 = require("../auth/current-auth.decorator");
const get_kardex_query_dto_1 = require("./dto/get-kardex-query.dto");
const get_stock_query_dto_1 = require("./dto/get-stock-query.dto");
const registrar_movimiento_stock_dto_1 = require("./dto/registrar-movimiento-stock.dto");
const registrar_transferencia_stock_dto_1 = require("./dto/registrar-transferencia-stock.dto");
const upsert_almacen_dto_1 = require("./dto/upsert-almacen.dto");
const upsert_ubicacion_dto_1 = require("./dto/upsert-ubicacion.dto");
const inventario_service_1 = require("./inventario.service");
let InventarioStockController = class InventarioStockController {
    inventarioService;
    constructor(inventarioService) {
        this.inventarioService = inventarioService;
    }
    getAlmacenes(auth) {
        return this.inventarioService.findAllAlmacenes(auth);
    }
    createAlmacen(auth, payload) {
        return this.inventarioService.createAlmacen(auth, payload);
    }
    updateAlmacen(auth, id, payload) {
        return this.inventarioService.updateAlmacen(auth, id, payload);
    }
    toggleAlmacen(auth, id) {
        return this.inventarioService.toggleAlmacen(auth, id);
    }
    getUbicaciones(auth, almacenId) {
        return this.inventarioService.findUbicacionesByAlmacen(auth, almacenId);
    }
    createUbicacion(auth, almacenId, payload) {
        return this.inventarioService.createUbicacion(auth, almacenId, payload);
    }
    updateUbicacion(auth, id, payload) {
        return this.inventarioService.updateUbicacion(auth, id, payload);
    }
    toggleUbicacion(auth, id) {
        return this.inventarioService.toggleUbicacion(auth, id);
    }
    registrarMovimiento(auth, payload) {
        return this.inventarioService.registrarMovimiento(auth, payload);
    }
    registrarTransferencia(auth, payload) {
        return this.inventarioService.registrarTransferencia(auth, payload);
    }
    getStock(auth, query) {
        return this.inventarioService.getStockActual(auth, query);
    }
    getKardex(auth, query) {
        return this.inventarioService.getKardex(auth, query);
    }
};
exports.InventarioStockController = InventarioStockController;
__decorate([
    (0, common_1.Get)('almacenes'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InventarioStockController.prototype, "getAlmacenes", null);
__decorate([
    (0, common_1.Post)('almacenes'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upsert_almacen_dto_1.UpsertAlmacenDto]),
    __metadata("design:returntype", void 0)
], InventarioStockController.prototype, "createAlmacen", null);
__decorate([
    (0, common_1.Put)('almacenes/:id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, upsert_almacen_dto_1.UpsertAlmacenDto]),
    __metadata("design:returntype", void 0)
], InventarioStockController.prototype, "updateAlmacen", null);
__decorate([
    (0, common_1.Patch)('almacenes/:id/toggle'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventarioStockController.prototype, "toggleAlmacen", null);
__decorate([
    (0, common_1.Get)('almacenes/:almacenId/ubicaciones'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('almacenId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventarioStockController.prototype, "getUbicaciones", null);
__decorate([
    (0, common_1.Post)('almacenes/:almacenId/ubicaciones'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('almacenId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, upsert_ubicacion_dto_1.UpsertUbicacionDto]),
    __metadata("design:returntype", void 0)
], InventarioStockController.prototype, "createUbicacion", null);
__decorate([
    (0, common_1.Put)('ubicaciones/:id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, upsert_ubicacion_dto_1.UpsertUbicacionDto]),
    __metadata("design:returntype", void 0)
], InventarioStockController.prototype, "updateUbicacion", null);
__decorate([
    (0, common_1.Patch)('ubicaciones/:id/toggle'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventarioStockController.prototype, "toggleUbicacion", null);
__decorate([
    (0, common_1.Post)('movimientos'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, registrar_movimiento_stock_dto_1.RegistrarMovimientoStockDto]),
    __metadata("design:returntype", void 0)
], InventarioStockController.prototype, "registrarMovimiento", null);
__decorate([
    (0, common_1.Post)('movimientos/transferencia'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, registrar_transferencia_stock_dto_1.RegistrarTransferenciaStockDto]),
    __metadata("design:returntype", void 0)
], InventarioStockController.prototype, "registrarTransferencia", null);
__decorate([
    (0, common_1.Get)('stock'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, get_stock_query_dto_1.GetStockQueryDto]),
    __metadata("design:returntype", void 0)
], InventarioStockController.prototype, "getStock", null);
__decorate([
    (0, common_1.Get)('kardex'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, get_kardex_query_dto_1.GetKardexQueryDto]),
    __metadata("design:returntype", void 0)
], InventarioStockController.prototype, "getKardex", null);
exports.InventarioStockController = InventarioStockController = __decorate([
    (0, common_1.Controller)('inventario'),
    __metadata("design:paramtypes", [inventario_service_1.InventarioService])
], InventarioStockController);
//# sourceMappingURL=inventario-stock.controller.js.map