"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WideFormatMotorModule = void 0;
const common_1 = require("@nestjs/common");
class WideFormatMotorModule {
    service;
    constructor(service) {
        this.service = service;
    }
    getDefinition() {
        return this.service.getWideFormatMotorDefinition();
    }
    getProductConfig(auth, productoId) {
        return this.service.getWideFormatProductMotorConfig(auth, productoId);
    }
    upsertProductConfig(auth, productoId, payload) {
        return this.service.upsertWideFormatProductMotorConfig(auth, productoId, payload);
    }
    async getVariantOverride(_auth, _varianteId) {
        throw new common_1.BadRequestException('El motor gran_formato@1 no usa overrides por variante en esta etapa.');
    }
    async upsertVariantOverride(_auth, _varianteId, _payload) {
        throw new common_1.BadRequestException('El motor gran_formato@1 no usa overrides por variante en esta etapa.');
    }
    async quoteVariant(_auth, _varianteId, _payload) {
        throw new common_1.BadRequestException('La cotización del motor gran_formato@1 todavía está en análisis.');
    }
    async previewVariant(_auth, _varianteId, _payload) {
        throw new common_1.BadRequestException('El preview técnico del motor gran_formato@1 todavía está en análisis.');
    }
}
exports.WideFormatMotorModule = WideFormatMotorModule;
//# sourceMappingURL=wide-format.motor.js.map