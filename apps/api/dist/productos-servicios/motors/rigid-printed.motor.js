"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RigidPrintedMotorModule = void 0;
const common_1 = require("@nestjs/common");
class RigidPrintedMotorModule {
    service;
    constructor(service) {
        this.service = service;
    }
    getDefinition() {
        return this.service.getRigidPrintedMotorDefinition();
    }
    getProductConfig(auth, productoId) {
        return this.service.getRigidPrintedProductMotorConfig(auth, productoId);
    }
    upsertProductConfig(auth, productoId, payload) {
        return this.service.upsertRigidPrintedProductMotorConfig(auth, productoId, payload);
    }
    async getVariantOverride(_auth, _varianteId) {
        throw new common_1.BadRequestException('El motor rigidos_impresos@1 no usa overrides por variante.');
    }
    async upsertVariantOverride(_auth, _varianteId, _payload) {
        throw new common_1.BadRequestException('El motor rigidos_impresos@1 no usa overrides por variante.');
    }
    async quoteVariant(auth, varianteId, payload) {
        return this.service.quoteRigidPrintedVariant(auth, varianteId, payload);
    }
    async previewVariant(_auth, _varianteId, _payload) {
        throw new common_1.BadRequestException('El preview del motor rigidos_impresos@1 está en desarrollo.');
    }
}
exports.RigidPrintedMotorModule = RigidPrintedMotorModule;
//# sourceMappingURL=rigid-printed.motor.js.map