import { BadRequestException } from '@nestjs/common';
import type { ProductMotorDefinition, ProductMotorModule } from './product-motor.contract';

export class ProductMotorRegistry {
  private readonly modulesByKey = new Map<string, ProductMotorModule>();

  constructor(modules: ProductMotorModule[]) {
    for (const module of modules) {
      this.modulesByKey.set(this.toKey(module.getDefinition().code, module.getDefinition().version), module);
    }
  }

  getCatalogDefinitions(): ProductMotorDefinition[] {
    return Array.from(this.modulesByKey.values())
      .map((module) => module.getDefinition())
      .filter((definition) => definition.exposedInCatalog);
  }

  getModule(code: string, version: number) {
    const module = this.modulesByKey.get(this.toKey(code, version));
    if (!module) {
      throw new BadRequestException(`Motor no soportado: ${code}@${version}.`);
    }
    return module;
  }

  hasModule(code: string, version: number) {
    return this.modulesByKey.has(this.toKey(code, version));
  }

  private toKey(code: string, version: number) {
    return `${code}@${version}`;
  }
}
