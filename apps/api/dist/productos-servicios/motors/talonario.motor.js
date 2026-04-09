"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TalonarioMotorModule = void 0;
class TalonarioMotorModule {
    service;
    constructor(service) {
        this.service = service;
    }
    getDefinition() {
        return this.service.getTalonarioMotorDefinition();
    }
    getProductConfig(auth, productoId) {
        return this.service.getTalonarioProductMotorConfig(auth, productoId);
    }
    upsertProductConfig(auth, productoId, payload) {
        return this.service.upsertTalonarioProductMotorConfig(auth, productoId, payload);
    }
    getVariantOverride(auth, varianteId) {
        return this.service.getTalonarioVariantMotorOverride(auth, varianteId);
    }
    upsertVariantOverride(auth, varianteId, payload) {
        return this.service.upsertTalonarioVariantMotorOverride(auth, varianteId, payload);
    }
    quoteVariant(auth, varianteId, payload) {
        return this.service.quoteTalonarioVariant(auth, varianteId, payload);
    }
    previewVariant(auth, varianteId, payload) {
        return this.service.previewTalonarioVariant(auth, varianteId, payload);
    }
}
exports.TalonarioMotorModule = TalonarioMotorModule;
//# sourceMappingURL=talonario.motor.js.map