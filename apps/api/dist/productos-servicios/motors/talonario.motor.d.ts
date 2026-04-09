import type { CurrentAuth } from '../../auth/auth.types';
import type { CotizarProductoVarianteDto, PreviewImposicionProductoVarianteDto, UpsertProductoMotorConfigDto, UpsertVarianteMotorOverrideDto } from '../dto/productos-servicios.dto';
import type { ProductosServiciosService } from '../productos-servicios.service';
import type { ProductMotorDefinition, ProductMotorModule } from './product-motor.contract';
export declare class TalonarioMotorModule implements ProductMotorModule {
    private readonly service;
    constructor(service: ProductosServiciosService);
    getDefinition(): ProductMotorDefinition;
    getProductConfig(auth: CurrentAuth, productoId: string): Promise<{
        productoId: string;
        motorCodigo: string;
        motorVersion: number;
        parametros: string | number | boolean | Record<string, unknown> | import("@prisma/client/runtime/library").JsonArray;
        versionConfig: number;
        activo: boolean;
        updatedAt: string | null;
    }>;
    upsertProductConfig(auth: CurrentAuth, productoId: string, payload: UpsertProductoMotorConfigDto): Promise<{
        productoId: string;
        motorCodigo: string;
        motorVersion: number;
        parametros: import("@prisma/client/runtime/library").JsonValue;
        versionConfig: number;
        activo: boolean;
        updatedAt: string;
    }>;
    getVariantOverride(auth: CurrentAuth, varianteId: string): Promise<{
        varianteId: string;
        motorCodigo: string;
        motorVersion: number;
        parametros: string | number | boolean | import("@prisma/client/runtime/library").JsonObject | import("@prisma/client/runtime/library").JsonArray;
        versionConfig: number;
        activo: boolean;
        updatedAt: string | null;
    }>;
    upsertVariantOverride(auth: CurrentAuth, varianteId: string, payload: UpsertVarianteMotorOverrideDto): Promise<{
        varianteId: string;
        motorCodigo: string;
        motorVersion: number;
        parametros: import("@prisma/client/runtime/library").JsonValue;
        versionConfig: number;
        activo: boolean;
        updatedAt: string;
    }>;
    quoteVariant(auth: CurrentAuth, varianteId: string, payload: CotizarProductoVarianteDto): Promise<{
        status: "disponible";
        varianteId: string;
        varianteNombre: string;
        motorCodigo: string;
        motorVersion: number;
        periodo: string;
        cantidad: number;
        tipoCopia: import("./talonario.calculations").TipoCopiaValor;
        capas: number;
        numerosXTalonario: number;
        piezasPorPliego: number;
        pliegos: number;
        pliegosXCapa: number;
        pliegosTotales: number;
        warnings: string[];
        bloques: {
            procesos: Record<string, unknown>[];
            materiales: (Record<string, unknown> | {
                tipo: string;
                nombre: string;
                cantidad: number;
                costoUnitario: number;
                costo: number;
            })[];
        };
        subtotales: {
            procesos: number;
            papel: number;
            materialesExtra: number;
            toner: number;
            desgaste: number;
            consumiblesTerminacion: number;
            adicionalesMateriales: number;
            adicionalesCostEffects: number;
        };
        total: number;
        unitario: number;
        trazabilidad: {
            imposicion: import("./talonario.calculations").TalonarioImposicionResult;
            grouping: import("./talonario.calculations").TalonarioGroupingResult;
            guillotinado: import("./talonario.calculations").GuillotinadoResult;
            paperCosts: import("./talonario.calculations").PaperLayerCost[];
            extraMaterials: import("./talonario.calculations").ExtraMaterialCost[];
            config: {
                [x: string]: unknown;
            };
            configVersionBase: number | null;
            configVersionOverride: number | null;
        };
    }>;
    previewVariant(auth: CurrentAuth, varianteId: string, payload: PreviewImposicionProductoVarianteDto): Promise<{
        varianteId: string;
        varianteNombre: string;
        pliegoImpresion: {
            codigo: string;
            nombre: string;
            anchoMm: number;
            altoMm: number;
        };
        sustrato: {
            anchoMm: number;
            altoMm: number;
        };
        machineMargins: {
            leftMm: number;
            rightMm: number;
            topMm: number;
            bottomMm: number;
        };
        imposicion: import("./talonario.calculations").TalonarioImposicionResult;
        conversionPapel: {
            esDerivado: boolean;
            pliegosPorSustrato: number;
            orientacion: string;
        };
        config: {
            [x: string]: unknown;
        };
        talonario: {
            encuadernacion: import("./talonario.calculations").EncuadernacionConfig;
            puntillado: import("./talonario.calculations").PuntilladoConfig;
            teteBeche: boolean;
            puntilladoLineMm: number | null;
            puntilladoBorde: string | null;
        };
    }>;
}
