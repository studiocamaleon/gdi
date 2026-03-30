"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VinylCutMotorModule = void 0;
const common_1 = require("@nestjs/common");
class VinylCutMotorModule {
    service;
    constructor(service) {
        this.service = service;
    }
    getDefinition() {
        return this.service.getVinylCutMotorDefinition();
    }
    getProductConfig(auth, productoId) {
        return this.service.getVinylCutProductMotorConfig(auth, productoId);
    }
    upsertProductConfig(auth, productoId, payload) {
        return this.service.upsertVinylCutProductMotorConfig(auth, productoId, payload);
    }
    async getVariantOverride(_auth, _varianteId) {
        throw new common_1.BadRequestException('El motor vinilo_de_corte@1 no usa overrides por variante en esta etapa.');
    }
    async upsertVariantOverride(_auth, _varianteId, _payload) {
        throw new common_1.BadRequestException('El motor vinilo_de_corte@1 no usa overrides por variante en esta etapa.');
    }
    quoteVariant(auth, varianteId, payload) {
        return this.service.quoteVinylCutVariant(auth, varianteId, payload);
    }
    previewVariant(auth, varianteId, payload) {
        return this.service.previewVinylCutVariant(auth, varianteId, payload);
    }
}
exports.VinylCutMotorModule = VinylCutMotorModule;
//# sourceMappingURL=vinyl-cut.motor.js.map