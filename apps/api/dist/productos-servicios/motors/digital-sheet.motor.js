"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigitalSheetMotorModule = void 0;
class DigitalSheetMotorModule {
    service;
    constructor(service) {
        this.service = service;
    }
    getDefinition() {
        return this.service.getDigitalMotorDefinition();
    }
    getProductConfig(auth, productoId) {
        return this.service.getDigitalProductMotorConfig(auth, productoId);
    }
    upsertProductConfig(auth, productoId, payload) {
        return this.service.upsertDigitalProductMotorConfig(auth, productoId, payload);
    }
    getVariantOverride(auth, varianteId) {
        return this.service.getDigitalVariantMotorOverride(auth, varianteId);
    }
    upsertVariantOverride(auth, varianteId, payload) {
        return this.service.upsertDigitalVariantMotorOverride(auth, varianteId, payload);
    }
    quoteVariant(auth, varianteId, payload) {
        return this.service.quoteDigitalVariant(auth, varianteId, payload);
    }
    previewVariant(auth, varianteId, payload) {
        return this.service.previewDigitalVariant(auth, varianteId, payload);
    }
}
exports.DigitalSheetMotorModule = DigitalSheetMotorModule;
//# sourceMappingURL=digital-sheet.motor.js.map