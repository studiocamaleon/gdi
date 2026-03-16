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
exports.ProductosServiciosController = void 0;
const common_1 = require("@nestjs/common");
const current_auth_decorator_1 = require("../auth/current-auth.decorator");
const productos_servicios_dto_1 = require("./dto/productos-servicios.dto");
const productos_servicios_service_1 = require("./productos-servicios.service");
let ProductosServiciosController = class ProductosServiciosController {
    service;
    constructor(service) {
        this.service = service;
    }
    getFamilias(auth) {
        return this.service.findFamilias(auth);
    }
    getCatalogoPliegosImpresion() {
        return this.service.getCatalogoPliegosImpresion();
    }
    getMotoresCosto() {
        return this.service.getMotoresCosto();
    }
    createFamilia(auth, payload) {
        return this.service.createFamilia(auth, payload);
    }
    updateFamilia(auth, id, payload) {
        return this.service.updateFamilia(auth, id, payload);
    }
    getSubfamilias(auth, familiaId) {
        return this.service.findSubfamilias(auth, familiaId);
    }
    createSubfamilia(auth, payload) {
        return this.service.createSubfamilia(auth, payload);
    }
    updateSubfamilia(auth, id, payload) {
        return this.service.updateSubfamilia(auth, id, payload);
    }
    getProductos(auth) {
        return this.service.findProductos(auth);
    }
    getProducto(auth, id) {
        return this.service.findProducto(auth, id);
    }
    createProducto(auth, payload) {
        return this.service.createProducto(auth, payload);
    }
    updateProducto(auth, id, payload) {
        return this.service.updateProducto(auth, id, payload);
    }
    assignProductoMotor(auth, id, payload) {
        return this.service.assignProductoMotor(auth, id, payload);
    }
    getProductoMotorConfig(auth, id) {
        return this.service.getProductoMotorConfig(auth, id);
    }
    upsertProductoMotorConfig(auth, id, payload) {
        return this.service.upsertProductoMotorConfig(auth, id, payload);
    }
    updateProductoRutaPolicy(auth, id, payload) {
        return this.service.updateProductoRutaPolicy(auth, id, payload);
    }
    assignProductoVariantesRutaMasiva(auth, id, payload) {
        return this.service.assignProductoVariantesRutaMasiva(auth, id, payload);
    }
    getVariantes(auth, id) {
        return this.service.findVariantes(auth, id);
    }
    createVariante(auth, id, payload) {
        return this.service.createVariante(auth, id, payload);
    }
    updateVariante(auth, varianteId, payload) {
        return this.service.updateVariante(auth, varianteId, payload);
    }
    deleteVariante(auth, varianteId) {
        return this.service.deleteVariante(auth, varianteId);
    }
    assignVarianteRuta(auth, varianteId, payload) {
        return this.service.assignVarianteRuta(auth, varianteId, payload);
    }
    getVarianteMotorOverride(auth, varianteId) {
        return this.service.getVarianteMotorOverride(auth, varianteId);
    }
    upsertVarianteMotorOverride(auth, varianteId, payload) {
        return this.service.upsertVarianteMotorOverride(auth, varianteId, payload);
    }
    cotizarVariante(auth, varianteId, payload) {
        return this.service.cotizarVariante(auth, varianteId, payload);
    }
    previewImposicionVariante(auth, varianteId, payload) {
        return this.service.previewVarianteImposicion(auth, varianteId, payload);
    }
    getVarianteCotizaciones(auth, varianteId) {
        return this.service.getVarianteCotizaciones(auth, varianteId);
    }
    getCotizacionById(auth, snapshotId) {
        return this.service.getCotizacionById(auth, snapshotId);
    }
};
exports.ProductosServiciosController = ProductosServiciosController;
__decorate([
    (0, common_1.Get)('familias'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "getFamilias", null);
__decorate([
    (0, common_1.Get)('catalogos/pliegos-impresion'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "getCatalogoPliegosImpresion", null);
__decorate([
    (0, common_1.Get)('motores'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "getMotoresCosto", null);
__decorate([
    (0, common_1.Post)('familias'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, productos_servicios_dto_1.UpsertFamiliaProductoDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "createFamilia", null);
__decorate([
    (0, common_1.Put)('familias/:id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, productos_servicios_dto_1.UpsertFamiliaProductoDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "updateFamilia", null);
__decorate([
    (0, common_1.Get)('subfamilias'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Query)('familiaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "getSubfamilias", null);
__decorate([
    (0, common_1.Post)('subfamilias'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, productos_servicios_dto_1.UpsertSubfamiliaProductoDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "createSubfamilia", null);
__decorate([
    (0, common_1.Put)('subfamilias/:id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, productos_servicios_dto_1.UpsertSubfamiliaProductoDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "updateSubfamilia", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "getProductos", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "getProducto", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, productos_servicios_dto_1.UpsertProductoServicioDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "createProducto", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, productos_servicios_dto_1.UpsertProductoServicioDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "updateProducto", null);
__decorate([
    (0, common_1.Put)(':id/motor'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, productos_servicios_dto_1.AssignProductoMotorDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "assignProductoMotor", null);
__decorate([
    (0, common_1.Get)(':id/motor-config'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "getProductoMotorConfig", null);
__decorate([
    (0, common_1.Put)(':id/motor-config'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, productos_servicios_dto_1.UpsertProductoMotorConfigDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "upsertProductoMotorConfig", null);
__decorate([
    (0, common_1.Put)(':id/ruta-policy'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, productos_servicios_dto_1.UpdateProductoRutaPolicyDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "updateProductoRutaPolicy", null);
__decorate([
    (0, common_1.Put)(':id/variantes/ruta-masiva'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, productos_servicios_dto_1.AssignProductoVariantesRutaMasivaDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "assignProductoVariantesRutaMasiva", null);
__decorate([
    (0, common_1.Get)(':id/variantes'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "getVariantes", null);
__decorate([
    (0, common_1.Post)(':id/variantes'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, productos_servicios_dto_1.CreateProductoVarianteDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "createVariante", null);
__decorate([
    (0, common_1.Put)('variantes/:varianteId'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('varianteId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, productos_servicios_dto_1.UpdateProductoVarianteDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "updateVariante", null);
__decorate([
    (0, common_1.Delete)('variantes/:varianteId'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('varianteId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "deleteVariante", null);
__decorate([
    (0, common_1.Put)('variantes/:varianteId/ruta'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('varianteId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, productos_servicios_dto_1.AssignVarianteRutaDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "assignVarianteRuta", null);
__decorate([
    (0, common_1.Get)('variantes/:varianteId/motor-override'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('varianteId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "getVarianteMotorOverride", null);
__decorate([
    (0, common_1.Put)('variantes/:varianteId/motor-override'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('varianteId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, productos_servicios_dto_1.UpsertVarianteMotorOverrideDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "upsertVarianteMotorOverride", null);
__decorate([
    (0, common_1.Post)('variantes/:varianteId/cotizar'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('varianteId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, productos_servicios_dto_1.CotizarProductoVarianteDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "cotizarVariante", null);
__decorate([
    (0, common_1.Post)('variantes/:varianteId/imposicion-preview'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('varianteId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, productos_servicios_dto_1.PreviewImposicionProductoVarianteDto]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "previewImposicionVariante", null);
__decorate([
    (0, common_1.Get)('variantes/:varianteId/cotizaciones'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('varianteId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "getVarianteCotizaciones", null);
__decorate([
    (0, common_1.Get)('cotizaciones/:snapshotId'),
    __param(0, (0, current_auth_decorator_1.CurrentSession)()),
    __param(1, (0, common_1.Param)('snapshotId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductosServiciosController.prototype, "getCotizacionById", null);
exports.ProductosServiciosController = ProductosServiciosController = __decorate([
    (0, common_1.Controller)('productos-servicios'),
    __metadata("design:paramtypes", [productos_servicios_service_1.ProductosServiciosService])
], ProductosServiciosController);
//# sourceMappingURL=productos-servicios.controller.js.map