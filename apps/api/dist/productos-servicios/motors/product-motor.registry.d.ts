import type { ProductMotorDefinition, ProductMotorModule } from './product-motor.contract';
export declare class ProductMotorRegistry {
    private readonly modulesByKey;
    constructor(modules: ProductMotorModule[]);
    getCatalogDefinitions(): ProductMotorDefinition[];
    getModule(code: string, version: number): ProductMotorModule;
    hasModule(code: string, version: number): boolean;
    private toKey;
}
