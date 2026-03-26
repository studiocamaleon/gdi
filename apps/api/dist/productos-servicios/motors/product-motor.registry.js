"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductMotorRegistry = void 0;
const common_1 = require("@nestjs/common");
class ProductMotorRegistry {
    modulesByKey = new Map();
    constructor(modules) {
        for (const module of modules) {
            this.modulesByKey.set(this.toKey(module.getDefinition().code, module.getDefinition().version), module);
        }
    }
    getCatalogDefinitions() {
        return Array.from(this.modulesByKey.values())
            .map((module) => module.getDefinition())
            .filter((definition) => definition.exposedInCatalog);
    }
    getModule(code, version) {
        const module = this.modulesByKey.get(this.toKey(code, version));
        if (!module) {
            throw new common_1.BadRequestException(`Motor no soportado: ${code}@${version}.`);
        }
        return module;
    }
    hasModule(code, version) {
        return this.modulesByKey.has(this.toKey(code, version));
    }
    toKey(code, version) {
        return `${code}@${version}`;
    }
}
exports.ProductMotorRegistry = ProductMotorRegistry;
//# sourceMappingURL=product-motor.registry.js.map