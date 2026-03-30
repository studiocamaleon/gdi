import type { CurrentAuth } from '../../auth/auth.types';
import type { CotizarProductoVarianteDto, PreviewImposicionProductoVarianteDto, UpsertProductoMotorConfigDto, UpsertVarianteMotorOverrideDto } from '../dto/productos-servicios.dto';
import type { ProductosServiciosService } from '../productos-servicios.service';
import type { ProductMotorDefinition, ProductMotorModule } from './product-motor.contract';
export declare class DigitalSheetMotorModule implements ProductMotorModule {
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
        createdAt: string;
        varianteId: string;
        productoServicioId: string;
        productoNombre: string;
        varianteNombre: string;
        motorCodigo: string;
        motorVersion: number;
        periodo: string;
        cantidad: number;
        piezasPorPliego: number;
        pliegos: number;
        warnings: string[];
        bloques: {
            procesos: {
                orden: number;
                codigo: string;
                nombre: string;
                centroCostoId: string;
                centroCostoNombre: string;
                origen: string;
                addonId: string | null;
                setupMin: number;
                runMin: number;
                cleanupMin: number;
                tiempoFijoMin: number;
                totalMin: number;
                tarifaHora: number;
                costo: number;
                detalleTecnico: Record<string, unknown> | null;
            }[];
            materiales: Record<string, unknown>[];
        };
        subtotales: {
            procesos: number;
            papel: number;
            toner: number;
            desgaste: number;
            consumiblesTerminacion: number;
            adicionalesMateriales: number;
            adicionalesCostEffects: number;
        };
        total: number;
        unitario: number;
        trazabilidad: {
            imposicion: {
                tipoCorte: string;
                piezasPorPliego: number;
                orientacion: string;
                anchoImprimibleMm: number;
                altoImprimibleMm: number;
                anchoDisponibleMm: number;
                altoDisponibleMm: number;
                normal: number;
                rotada: number;
                demasiaCorteMm: number;
                lineaCorteMm: number;
                piezaAnchoMm: number;
                piezaAltoMm: number;
                piezaAnchoEfectivoMm: number;
                piezaAltoEfectivoMm: number;
                cols: number;
                rows: number;
                sheetAnchoMm: number;
                sheetAltoMm: number;
                machineMargins: {
                    leftMm: number;
                    rightMm: number;
                    topMm: number;
                    bottomMm: number;
                };
            };
            conversionPapel: {
                esDerivado: boolean;
                pliegosPorSustrato: number;
                orientacion: string;
            };
            matchingBaseAplicado: {
                pasoPlantillaId: any;
                pasoPlantillaNombre: any;
                perfilOperativoId: any;
                perfilOperativoNombre: any;
                tipoImpresion: import("../dto/productos-servicios.dto").TipoImpresionProductoVarianteDto | null;
                caras: import("../dto/productos-servicios.dto").CarasProductoVarianteDto | null;
            }[];
            checklistAplicado: Record<string, unknown>[];
            checklistRespuestasSeleccionadas: import("../dto/productos-servicios.dto").CotizarChecklistRespuestaDto[];
            atributosTecnicosConfigurados: {
                dimension: import("../dto/productos-servicios.dto").DimensionOpcionProductivaDto;
                valor: import("../dto/productos-servicios.dto").ValorOpcionProductivaDto;
            }[];
            opcionProductivaEfectiva: {
                dimension: import("../dto/productos-servicios.dto").DimensionOpcionProductivaDto;
                valores: import("../dto/productos-servicios.dto").ValorOpcionProductivaDto[];
            }[];
            efectosAplicados: {
                id: any;
                addonId: any;
                addonNombre: string;
                tipo: import("../dto/productos-servicios.dto").TipoProductoAdicionalEfectoDto;
                nombre: any;
            }[];
            routeEffectsAplicados: {
                id: any;
                addonId: any;
                nombre: any;
                pasos: any;
                insertion: {
                    modo: "append" | "before_step" | "after_step";
                    pasoPlantillaId: string | null;
                };
            }[];
            costEffectsAplicados: {
                id: any;
                addonId: any;
                nombre: any;
                regla: import("../dto/productos-servicios.dto").ReglaCostoAdicionalEfectoDto | null;
            }[];
            materialEffectsAplicados: {
                id: any;
                addonId: any;
                nombre: any;
                material: any;
            }[];
            costosPorEfecto: Record<string, unknown>[];
            pasosCondicionalesActivos: {
                pasoCodigo: string;
                addonId: string | null;
            }[];
            config: {
                [x: string]: unknown;
            };
            configVersionBase: number | null;
            configVersionOverride: number | null;
        };
        snapshotId: string;
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
        imposicion: {
            tipoCorte: string;
            piezasPorPliego: number;
            orientacion: string;
            anchoImprimibleMm: number;
            altoImprimibleMm: number;
            anchoDisponibleMm: number;
            altoDisponibleMm: number;
            normal: number;
            rotada: number;
            demasiaCorteMm: number;
            lineaCorteMm: number;
            piezaAnchoMm: number;
            piezaAltoMm: number;
            piezaAnchoEfectivoMm: number;
            piezaAltoEfectivoMm: number;
            cols: number;
            rows: number;
            sheetAnchoMm: number;
            sheetAltoMm: number;
            machineMargins: {
                leftMm: number;
                rightMm: number;
                topMm: number;
                bottomMm: number;
            };
        };
        conversionPapel: {
            esDerivado: boolean;
            pliegosPorSustrato: number;
            orientacion: string;
        };
        config: {
            [x: string]: unknown;
        };
    }>;
}
