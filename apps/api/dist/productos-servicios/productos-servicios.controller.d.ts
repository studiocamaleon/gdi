import type { CurrentAuth } from '../auth/auth.types';
import { AssignProductoAdicionalDto, AssignProductoVariantesRutaMasivaDto, AssignProductoMotorDto, AssignVarianteRutaDto, CotizarProductoVarianteDto, CreateProductoVarianteDto, UpsertProductoChecklistDto, UpsertProductoAdicionalServicioPricingDto, UpsertVarianteOpcionesProductivasDto, SetVarianteAdicionalRestrictionDto, UpsertProductoAdicionalEfectoDto, UpsertProductoAdicionalDto, PreviewImposicionProductoVarianteDto, UpdateProductoRutaPolicyDto, UpsertProductoMotorConfigDto, UpsertVarianteMotorOverrideDto, UpdateProductoVarianteDto, UpsertFamiliaProductoDto, UpsertProductoServicioDto, UpsertSubfamiliaProductoDto } from './dto/productos-servicios.dto';
import { ProductosServiciosService } from './productos-servicios.service';
export declare class ProductosServiciosController {
    private readonly service;
    constructor(service: ProductosServiciosService);
    getFamilias(auth: CurrentAuth): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        activo: boolean;
        subfamiliasCount: number;
        createdAt: string;
        updatedAt: string;
    }[]>;
    getCatalogoPliegosImpresion(): {
        label: string;
        codigo: string;
        nombre: string;
        anchoMm: number;
        altoMm: number;
    }[];
    getMotoresCosto(): {
        code: "impresion_digital_laser";
        version: 1;
        label: "Impresión digital laser · v1";
        schema: {
            tipoCorte: string;
            demasiaCorteMm: number;
            lineaCorteMm: number;
            tamanoPliegoImpresion: {
                codigo: string;
                nombre: string;
                anchoMm: number;
                altoMm: number;
            };
            mermaAdicionalPct: number;
        };
    }[];
    getAdicionales(auth: CurrentAuth): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        descripcion: string;
        tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalDto;
        metodoCosto: import("./dto/productos-servicios.dto").MetodoCostoProductoAdicionalDto;
        centroCostoId: string | null;
        centroCostoNombre: string;
        activo: boolean;
        metadata: Record<string, unknown> | null;
        servicioPricing: {
            niveles: {
                id: string;
                nombre: string;
                orden: number;
                activo: boolean;
            }[];
            reglas: {
                id: string;
                nivelId: string;
                tiempoMin: number;
            }[];
        };
        efectos: {
            id: string;
            tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalEfectoDto;
            activo: boolean;
        }[];
        materiales: {
            id: string;
            materiaPrimaVarianteId: string;
            materiaPrimaNombre: string;
            materiaPrimaSku: string;
            tipoConsumo: import("./dto/productos-servicios.dto").TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            activo: boolean;
            detalle: Record<string, unknown> | null;
        }[];
        createdAt: string;
        updatedAt: string;
    }[]>;
    createAdicional(auth: CurrentAuth, payload: UpsertProductoAdicionalDto): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        descripcion: string;
        tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalDto;
        metodoCosto: import("./dto/productos-servicios.dto").MetodoCostoProductoAdicionalDto;
        centroCostoId: string | null;
        centroCostoNombre: string;
        activo: boolean;
        metadata: Record<string, unknown> | null;
        servicioPricing: {
            niveles: {
                id: string;
                nombre: string;
                orden: number;
                activo: boolean;
            }[];
            reglas: {
                id: string;
                nivelId: string;
                tiempoMin: number;
            }[];
        };
        efectos: {
            id: string;
            tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalEfectoDto;
            activo: boolean;
        }[];
        materiales: {
            id: string;
            materiaPrimaVarianteId: string;
            materiaPrimaNombre: string;
            materiaPrimaSku: string;
            tipoConsumo: import("./dto/productos-servicios.dto").TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            activo: boolean;
            detalle: Record<string, unknown> | null;
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
    updateAdicional(auth: CurrentAuth, id: string, payload: UpsertProductoAdicionalDto): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        descripcion: string;
        tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalDto;
        metodoCosto: import("./dto/productos-servicios.dto").MetodoCostoProductoAdicionalDto;
        centroCostoId: string | null;
        centroCostoNombre: string;
        activo: boolean;
        metadata: Record<string, unknown> | null;
        servicioPricing: {
            niveles: {
                id: string;
                nombre: string;
                orden: number;
                activo: boolean;
            }[];
            reglas: {
                id: string;
                nivelId: string;
                tiempoMin: number;
            }[];
        };
        efectos: {
            id: string;
            tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalEfectoDto;
            activo: boolean;
        }[];
        materiales: {
            id: string;
            materiaPrimaVarianteId: string;
            materiaPrimaNombre: string;
            materiaPrimaSku: string;
            tipoConsumo: import("./dto/productos-servicios.dto").TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            activo: boolean;
            detalle: Record<string, unknown> | null;
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
    toggleAdicional(auth: CurrentAuth, id: string): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        descripcion: string;
        tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalDto;
        metodoCosto: import("./dto/productos-servicios.dto").MetodoCostoProductoAdicionalDto;
        centroCostoId: string | null;
        centroCostoNombre: string;
        activo: boolean;
        metadata: Record<string, unknown> | null;
        servicioPricing: {
            niveles: {
                id: string;
                nombre: string;
                orden: number;
                activo: boolean;
            }[];
            reglas: {
                id: string;
                nivelId: string;
                tiempoMin: number;
            }[];
        };
        efectos: {
            id: string;
            tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalEfectoDto;
            activo: boolean;
        }[];
        materiales: {
            id: string;
            materiaPrimaVarianteId: string;
            materiaPrimaNombre: string;
            materiaPrimaSku: string;
            tipoConsumo: import("./dto/productos-servicios.dto").TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            activo: boolean;
            detalle: Record<string, unknown> | null;
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
    getAdicionalEfectos(auth: CurrentAuth, id: string): Promise<{
        id: string;
        adicionalId: string;
        tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalEfectoDto;
        nombre: string;
        activo: boolean;
        scopes: {
            id: string;
            varianteId: string | null;
            dimension: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto | null;
            valor: import("./dto/productos-servicios.dto").ValorOpcionProductivaDto | null;
        }[];
        routeEffect: {
            id: string;
            insertion: {
                modo: "append" | "before_step" | "after_step";
                pasoPlantillaId: string | null;
            };
            pasos: {
                id: string;
                orden: number;
                nombre: string;
                centroCostoId: string;
                centroCostoNombre: string;
                maquinaId: string | null;
                maquinaNombre: string;
                perfilOperativoId: string | null;
                perfilOperativoNombre: string;
                setupMin: number | null;
                runMin: number | null;
                cleanupMin: number | null;
                tiempoFijoMin: number | null;
                tiempoFijoMinFallback: number | null;
                overridesProductividad: Record<string, unknown> | null;
                usarMaquinariaTerminacion: boolean;
            }[];
        } | null;
        costEffect: {
            id: string;
            regla: import("./dto/productos-servicios.dto").ReglaCostoAdicionalEfectoDto;
            valor: number;
            centroCostoId: string | null;
            centroCostoNombre: string;
            detalle: Record<string, unknown> | null;
        } | null;
        materialEffect: {
            id: string;
            materiaPrimaVarianteId: string;
            materiaPrimaNombre: string;
            materiaPrimaSku: string;
            tipoConsumo: import("./dto/productos-servicios.dto").TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            detalle: Record<string, unknown> | null;
        } | null;
        createdAt: string;
        updatedAt: string;
    }[]>;
    createAdicionalEfecto(auth: CurrentAuth, id: string, payload: UpsertProductoAdicionalEfectoDto): Promise<{
        id: string;
        adicionalId: string;
        tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalEfectoDto;
        nombre: string;
        activo: boolean;
        scopes: {
            id: string;
            varianteId: string | null;
            dimension: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto | null;
            valor: import("./dto/productos-servicios.dto").ValorOpcionProductivaDto | null;
        }[];
        routeEffect: {
            id: string;
            insertion: {
                modo: "append" | "before_step" | "after_step";
                pasoPlantillaId: string | null;
            };
            pasos: {
                id: string;
                orden: number;
                nombre: string;
                centroCostoId: string;
                centroCostoNombre: string;
                maquinaId: string | null;
                maquinaNombre: string;
                perfilOperativoId: string | null;
                perfilOperativoNombre: string;
                setupMin: number | null;
                runMin: number | null;
                cleanupMin: number | null;
                tiempoFijoMin: number | null;
                tiempoFijoMinFallback: number | null;
                overridesProductividad: Record<string, unknown> | null;
                usarMaquinariaTerminacion: boolean;
            }[];
        } | null;
        costEffect: {
            id: string;
            regla: import("./dto/productos-servicios.dto").ReglaCostoAdicionalEfectoDto;
            valor: number;
            centroCostoId: string | null;
            centroCostoNombre: string;
            detalle: Record<string, unknown> | null;
        } | null;
        materialEffect: {
            id: string;
            materiaPrimaVarianteId: string;
            materiaPrimaNombre: string;
            materiaPrimaSku: string;
            tipoConsumo: import("./dto/productos-servicios.dto").TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            detalle: Record<string, unknown> | null;
        } | null;
        createdAt: string;
        updatedAt: string;
    }>;
    updateAdicionalEfecto(auth: CurrentAuth, id: string, efectoId: string, payload: UpsertProductoAdicionalEfectoDto): Promise<{
        id: string;
        adicionalId: string;
        tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalEfectoDto;
        nombre: string;
        activo: boolean;
        scopes: {
            id: string;
            varianteId: string | null;
            dimension: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto | null;
            valor: import("./dto/productos-servicios.dto").ValorOpcionProductivaDto | null;
        }[];
        routeEffect: {
            id: string;
            insertion: {
                modo: "append" | "before_step" | "after_step";
                pasoPlantillaId: string | null;
            };
            pasos: {
                id: string;
                orden: number;
                nombre: string;
                centroCostoId: string;
                centroCostoNombre: string;
                maquinaId: string | null;
                maquinaNombre: string;
                perfilOperativoId: string | null;
                perfilOperativoNombre: string;
                setupMin: number | null;
                runMin: number | null;
                cleanupMin: number | null;
                tiempoFijoMin: number | null;
                tiempoFijoMinFallback: number | null;
                overridesProductividad: Record<string, unknown> | null;
                usarMaquinariaTerminacion: boolean;
            }[];
        } | null;
        costEffect: {
            id: string;
            regla: import("./dto/productos-servicios.dto").ReglaCostoAdicionalEfectoDto;
            valor: number;
            centroCostoId: string | null;
            centroCostoNombre: string;
            detalle: Record<string, unknown> | null;
        } | null;
        materialEffect: {
            id: string;
            materiaPrimaVarianteId: string;
            materiaPrimaNombre: string;
            materiaPrimaSku: string;
            tipoConsumo: import("./dto/productos-servicios.dto").TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            detalle: Record<string, unknown> | null;
        } | null;
        createdAt: string;
        updatedAt: string;
    }>;
    toggleAdicionalEfecto(auth: CurrentAuth, id: string, efectoId: string): Promise<{
        id: string;
        adicionalId: string;
        tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalEfectoDto;
        nombre: string;
        activo: boolean;
        scopes: {
            id: string;
            varianteId: string | null;
            dimension: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto | null;
            valor: import("./dto/productos-servicios.dto").ValorOpcionProductivaDto | null;
        }[];
        routeEffect: {
            id: string;
            insertion: {
                modo: "append" | "before_step" | "after_step";
                pasoPlantillaId: string | null;
            };
            pasos: {
                id: string;
                orden: number;
                nombre: string;
                centroCostoId: string;
                centroCostoNombre: string;
                maquinaId: string | null;
                maquinaNombre: string;
                perfilOperativoId: string | null;
                perfilOperativoNombre: string;
                setupMin: number | null;
                runMin: number | null;
                cleanupMin: number | null;
                tiempoFijoMin: number | null;
                tiempoFijoMinFallback: number | null;
                overridesProductividad: Record<string, unknown> | null;
                usarMaquinariaTerminacion: boolean;
            }[];
        } | null;
        costEffect: {
            id: string;
            regla: import("./dto/productos-servicios.dto").ReglaCostoAdicionalEfectoDto;
            valor: number;
            centroCostoId: string | null;
            centroCostoNombre: string;
            detalle: Record<string, unknown> | null;
        } | null;
        materialEffect: {
            id: string;
            materiaPrimaVarianteId: string;
            materiaPrimaNombre: string;
            materiaPrimaSku: string;
            tipoConsumo: import("./dto/productos-servicios.dto").TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            detalle: Record<string, unknown> | null;
        } | null;
        createdAt: string;
        updatedAt: string;
    }>;
    deleteAdicionalEfecto(auth: CurrentAuth, id: string, efectoId: string): Promise<{
        adicionalId: string;
        efectoId: string;
        deleted: boolean;
    }>;
    getAdicionalServicioPricing(auth: CurrentAuth, id: string): Promise<{
        niveles: {
            id: string;
            nombre: string;
            orden: number;
            activo: boolean;
        }[];
        reglas: {
            id: string;
            nivelId: string;
            tiempoMin: number;
        }[];
    }>;
    upsertAdicionalServicioPricing(auth: CurrentAuth, id: string, payload: UpsertProductoAdicionalServicioPricingDto): Promise<{
        niveles: {
            id: string;
            nombre: string;
            orden: number;
            activo: boolean;
        }[];
        reglas: {
            id: string;
            nivelId: string;
            tiempoMin: number;
        }[];
    }>;
    createFamilia(auth: CurrentAuth, payload: UpsertFamiliaProductoDto): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    updateFamilia(auth: CurrentAuth, id: string, payload: UpsertFamiliaProductoDto): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    getSubfamilias(auth: CurrentAuth, familiaId?: string): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        unidadComercial: string;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        createdAt: string;
        updatedAt: string;
    }[]>;
    createSubfamilia(auth: CurrentAuth, payload: UpsertSubfamiliaProductoDto): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        unidadComercial: string;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        createdAt: string;
        updatedAt: string;
    }>;
    updateSubfamilia(auth: CurrentAuth, id: string, payload: UpsertSubfamiliaProductoDto): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        unidadComercial: string;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        createdAt: string;
        updatedAt: string;
    }>;
    getProductos(auth: CurrentAuth): Promise<{
        matchingBasePorVariante: never[];
        pasosFijosPorVariante: never[];
        id: string;
        tipo: import("./dto/productos-servicios.dto").TipoProductoServicioDto;
        codigo: string;
        nombre: string;
        descripcion: string;
        motorCodigo: string;
        motorVersion: number;
        usarRutaComunVariantes: boolean;
        procesoDefinicionDefaultId: string | null;
        procesoDefinicionDefaultNombre: string;
        estado: import("./dto/productos-servicios.dto").EstadoProductoServicioDto;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        subfamiliaProductoId: string | null;
        subfamiliaProductoNombre: string;
        dimensionesBaseConsumidas: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }[]>;
    getProducto(auth: CurrentAuth, id: string): Promise<{
        matchingBasePorVariante: {
            varianteId: string;
            matching: {
                tipoImpresion: any;
                caras: any;
                pasoPlantillaId: any;
                pasoPlantillaNombre: string;
                perfilOperativoId: any;
                perfilOperativoNombre: string;
            }[];
        }[];
        pasosFijosPorVariante: {
            varianteId: string;
            pasos: {
                pasoPlantillaId: any;
                pasoPlantillaNombre: string;
                perfilOperativoId: any;
                perfilOperativoNombre: string;
            }[];
        }[];
        id: string;
        tipo: import("./dto/productos-servicios.dto").TipoProductoServicioDto;
        codigo: string;
        nombre: string;
        descripcion: string;
        motorCodigo: string;
        motorVersion: number;
        usarRutaComunVariantes: boolean;
        procesoDefinicionDefaultId: string | null;
        procesoDefinicionDefaultNombre: string;
        estado: import("./dto/productos-servicios.dto").EstadoProductoServicioDto;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        subfamiliaProductoId: string | null;
        subfamiliaProductoNombre: string;
        dimensionesBaseConsumidas: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }>;
    createProducto(auth: CurrentAuth, payload: UpsertProductoServicioDto): Promise<{
        matchingBasePorVariante: {
            varianteId: string;
            matching: {
                tipoImpresion: any;
                caras: any;
                pasoPlantillaId: any;
                pasoPlantillaNombre: string;
                perfilOperativoId: any;
                perfilOperativoNombre: string;
            }[];
        }[];
        pasosFijosPorVariante: {
            varianteId: string;
            pasos: {
                pasoPlantillaId: any;
                pasoPlantillaNombre: string;
                perfilOperativoId: any;
                perfilOperativoNombre: string;
            }[];
        }[];
        id: string;
        tipo: import("./dto/productos-servicios.dto").TipoProductoServicioDto;
        codigo: string;
        nombre: string;
        descripcion: string;
        motorCodigo: string;
        motorVersion: number;
        usarRutaComunVariantes: boolean;
        procesoDefinicionDefaultId: string | null;
        procesoDefinicionDefaultNombre: string;
        estado: import("./dto/productos-servicios.dto").EstadoProductoServicioDto;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        subfamiliaProductoId: string | null;
        subfamiliaProductoNombre: string;
        dimensionesBaseConsumidas: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }>;
    updateProducto(auth: CurrentAuth, id: string, payload: UpsertProductoServicioDto): Promise<{
        matchingBasePorVariante: {
            varianteId: string;
            matching: {
                tipoImpresion: any;
                caras: any;
                pasoPlantillaId: any;
                pasoPlantillaNombre: string;
                perfilOperativoId: any;
                perfilOperativoNombre: string;
            }[];
        }[];
        pasosFijosPorVariante: {
            varianteId: string;
            pasos: {
                pasoPlantillaId: any;
                pasoPlantillaNombre: string;
                perfilOperativoId: any;
                perfilOperativoNombre: string;
            }[];
        }[];
        id: string;
        tipo: import("./dto/productos-servicios.dto").TipoProductoServicioDto;
        codigo: string;
        nombre: string;
        descripcion: string;
        motorCodigo: string;
        motorVersion: number;
        usarRutaComunVariantes: boolean;
        procesoDefinicionDefaultId: string | null;
        procesoDefinicionDefaultNombre: string;
        estado: import("./dto/productos-servicios.dto").EstadoProductoServicioDto;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        subfamiliaProductoId: string | null;
        subfamiliaProductoNombre: string;
        dimensionesBaseConsumidas: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }>;
    assignProductoMotor(auth: CurrentAuth, id: string, payload: AssignProductoMotorDto): Promise<{
        matchingBasePorVariante: {
            varianteId: string;
            matching: {
                tipoImpresion: any;
                caras: any;
                pasoPlantillaId: any;
                pasoPlantillaNombre: string;
                perfilOperativoId: any;
                perfilOperativoNombre: string;
            }[];
        }[];
        pasosFijosPorVariante: {
            varianteId: string;
            pasos: {
                pasoPlantillaId: any;
                pasoPlantillaNombre: string;
                perfilOperativoId: any;
                perfilOperativoNombre: string;
            }[];
        }[];
        id: string;
        tipo: import("./dto/productos-servicios.dto").TipoProductoServicioDto;
        codigo: string;
        nombre: string;
        descripcion: string;
        motorCodigo: string;
        motorVersion: number;
        usarRutaComunVariantes: boolean;
        procesoDefinicionDefaultId: string | null;
        procesoDefinicionDefaultNombre: string;
        estado: import("./dto/productos-servicios.dto").EstadoProductoServicioDto;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        subfamiliaProductoId: string | null;
        subfamiliaProductoNombre: string;
        dimensionesBaseConsumidas: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }>;
    getProductoMotorConfig(auth: CurrentAuth, id: string): Promise<{
        productoId: string;
        motorCodigo: "impresion_digital_laser";
        motorVersion: 1;
        parametros: string | number | boolean | import("@prisma/client/runtime/library").JsonObject | import("@prisma/client/runtime/library").JsonArray | {
            tipoCorte: string;
            demasiaCorteMm: number;
            lineaCorteMm: number;
            tamanoPliegoImpresion: {
                codigo: string;
                nombre: string;
                anchoMm: number;
                altoMm: number;
            };
            mermaAdicionalPct: number;
        };
        versionConfig: number;
        activo: boolean;
        updatedAt: string | null;
    }>;
    upsertProductoMotorConfig(auth: CurrentAuth, id: string, payload: UpsertProductoMotorConfigDto): Promise<{
        productoId: string;
        motorCodigo: "impresion_digital_laser";
        motorVersion: 1;
        parametros: import("@prisma/client/runtime/library").JsonValue;
        versionConfig: number;
        activo: boolean;
        updatedAt: string;
    }>;
    updateProductoRutaPolicy(auth: CurrentAuth, id: string, payload: UpdateProductoRutaPolicyDto): Promise<{
        matchingBasePorVariante: {
            varianteId: string;
            matching: {
                tipoImpresion: any;
                caras: any;
                pasoPlantillaId: any;
                pasoPlantillaNombre: string;
                perfilOperativoId: any;
                perfilOperativoNombre: string;
            }[];
        }[];
        pasosFijosPorVariante: {
            varianteId: string;
            pasos: {
                pasoPlantillaId: any;
                pasoPlantillaNombre: string;
                perfilOperativoId: any;
                perfilOperativoNombre: string;
            }[];
        }[];
        id: string;
        tipo: import("./dto/productos-servicios.dto").TipoProductoServicioDto;
        codigo: string;
        nombre: string;
        descripcion: string;
        motorCodigo: string;
        motorVersion: number;
        usarRutaComunVariantes: boolean;
        procesoDefinicionDefaultId: string | null;
        procesoDefinicionDefaultNombre: string;
        estado: import("./dto/productos-servicios.dto").EstadoProductoServicioDto;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        subfamiliaProductoId: string | null;
        subfamiliaProductoNombre: string;
        dimensionesBaseConsumidas: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }>;
    assignProductoVariantesRutaMasiva(auth: CurrentAuth, id: string, payload: AssignProductoVariantesRutaMasivaDto): Promise<{
        productoId: string;
        updatedCount: number;
        procesoDefinicionId: string;
        incluirInactivas: boolean;
    }>;
    getVariantes(auth: CurrentAuth, id: string): Promise<{
        id: string;
        productoServicioId: string;
        nombre: string;
        anchoMm: number;
        altoMm: number;
        papelVarianteId: string | null;
        papelVarianteSku: string;
        papelNombre: string;
        tipoImpresion: import("./dto/productos-servicios.dto").TipoImpresionProductoVarianteDto;
        caras: import("./dto/productos-servicios.dto").CarasProductoVarianteDto;
        opcionesProductivas: {
            dimension: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto;
            valores: import("./dto/productos-servicios.dto").ValorOpcionProductivaDto[];
        }[] | null;
        procesoDefinicionId: string | null;
        procesoDefinicionCodigo: string;
        procesoDefinicionNombre: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }[]>;
    getProductoChecklist(auth: CurrentAuth, id: string): Promise<{
        id: string;
        productoId: string;
        activo: boolean;
        preguntas: {
            id: string;
            texto: string;
            tipoPregunta: import("./dto/productos-servicios.dto").TipoChecklistPreguntaDto;
            orden: number;
            activo: boolean;
            respuestas: {
                id: string;
                texto: string;
                codigo: string | null;
                orden: number;
                activo: boolean;
                reglas: {
                    id: string;
                    accion: import("./dto/productos-servicios.dto").TipoChecklistAccionReglaDto;
                    orden: number;
                    activo: boolean;
                    pasoPlantillaId: string | null;
                    pasoPlantillaNombre: any;
                    centroCostoId: any;
                    centroCostoNombre: any;
                    maquinaNombre: any;
                    perfilOperativoNombre: any;
                    setupMin: number | null;
                    runMin: number | null;
                    cleanupMin: number | null;
                    tiempoFijoMin: number | null;
                    variantePasoId: string | null;
                    variantePasoNombre: string;
                    variantePasoResumen: string;
                    nivelesDisponibles: {
                        id: string;
                        nombre: string;
                        orden: number;
                        activo: boolean;
                        modoProductividadNivel: string;
                        tiempoFijoMin: number | null;
                        productividadBase: number | null;
                        unidadSalida: string | null;
                        unidadTiempo: string | null;
                        maquinaId: string | null;
                        maquinaNombre: string;
                        perfilOperativoId: string | null;
                        perfilOperativoNombre: string;
                        setupMin: number | null;
                        cleanupMin: number | null;
                        resumen: string;
                        detalle: Record<string, unknown>;
                    }[];
                    costoRegla: import("./dto/productos-servicios.dto").ReglaCostoChecklistDto | null;
                    costoValor: number | null;
                    costoCentroCostoId: string | null;
                    costoCentroCostoNombre: string;
                    materiaPrimaVarianteId: string | null;
                    materiaPrimaNombre: string;
                    materiaPrimaSku: string;
                    tipoConsumo: import("./dto/productos-servicios.dto").TipoConsumoAdicionalMaterialDto | null;
                    factorConsumo: number | null;
                    mermaPct: number | null;
                    detalle: Record<string, unknown> | null;
                }[];
            }[];
        }[];
        createdAt: string;
        updatedAt: string;
    } | {
        productoId: string;
        activo: boolean;
        preguntas: never[];
        createdAt: null;
        updatedAt: null;
    }>;
    upsertProductoChecklist(auth: CurrentAuth, id: string, payload: UpsertProductoChecklistDto): Promise<{
        id: string;
        productoId: string;
        activo: boolean;
        preguntas: {
            id: string;
            texto: string;
            tipoPregunta: import("./dto/productos-servicios.dto").TipoChecklistPreguntaDto;
            orden: number;
            activo: boolean;
            respuestas: {
                id: string;
                texto: string;
                codigo: string | null;
                orden: number;
                activo: boolean;
                reglas: {
                    id: string;
                    accion: import("./dto/productos-servicios.dto").TipoChecklistAccionReglaDto;
                    orden: number;
                    activo: boolean;
                    pasoPlantillaId: string | null;
                    pasoPlantillaNombre: any;
                    centroCostoId: any;
                    centroCostoNombre: any;
                    maquinaNombre: any;
                    perfilOperativoNombre: any;
                    setupMin: number | null;
                    runMin: number | null;
                    cleanupMin: number | null;
                    tiempoFijoMin: number | null;
                    variantePasoId: string | null;
                    variantePasoNombre: string;
                    variantePasoResumen: string;
                    nivelesDisponibles: {
                        id: string;
                        nombre: string;
                        orden: number;
                        activo: boolean;
                        modoProductividadNivel: string;
                        tiempoFijoMin: number | null;
                        productividadBase: number | null;
                        unidadSalida: string | null;
                        unidadTiempo: string | null;
                        maquinaId: string | null;
                        maquinaNombre: string;
                        perfilOperativoId: string | null;
                        perfilOperativoNombre: string;
                        setupMin: number | null;
                        cleanupMin: number | null;
                        resumen: string;
                        detalle: Record<string, unknown>;
                    }[];
                    costoRegla: import("./dto/productos-servicios.dto").ReglaCostoChecklistDto | null;
                    costoValor: number | null;
                    costoCentroCostoId: string | null;
                    costoCentroCostoNombre: string;
                    materiaPrimaVarianteId: string | null;
                    materiaPrimaNombre: string;
                    materiaPrimaSku: string;
                    tipoConsumo: import("./dto/productos-servicios.dto").TipoConsumoAdicionalMaterialDto | null;
                    factorConsumo: number | null;
                    mermaPct: number | null;
                    detalle: Record<string, unknown> | null;
                }[];
            }[];
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
    getProductoAdicionales(auth: CurrentAuth, id: string): Promise<{
        id: string;
        productoServicioId: string;
        adicionalId: string;
        activo: boolean;
        adicional: {
            id: string;
            codigo: string;
            nombre: string;
            descripcion: string;
            tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalDto;
            metodoCosto: import("./dto/productos-servicios.dto").MetodoCostoProductoAdicionalDto;
            centroCostoId: string | null;
            centroCostoNombre: string;
            activo: boolean;
            metadata: Record<string, unknown> | null;
            servicioPricing: {
                niveles: {
                    id: string;
                    nombre: string;
                    orden: number;
                    activo: boolean;
                }[];
                reglas: {
                    id: string;
                    nivelId: string;
                    tiempoMin: number;
                }[];
            };
            efectos: {
                id: string;
                tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalEfectoDto;
                activo: boolean;
            }[];
            materiales: {
                id: string;
                materiaPrimaVarianteId: string;
                materiaPrimaNombre: string;
                materiaPrimaSku: string;
                tipoConsumo: import("./dto/productos-servicios.dto").TipoConsumoAdicionalMaterialDto;
                factorConsumo: number;
                mermaPct: number | null;
                activo: boolean;
                detalle: Record<string, unknown> | null;
            }[];
            createdAt: string;
            updatedAt: string;
        };
        createdAt: string;
        updatedAt: string;
    }[]>;
    assignProductoAdicional(auth: CurrentAuth, id: string, payload: AssignProductoAdicionalDto): Promise<{
        id: string;
        productoServicioId: string;
        adicionalId: string;
        activo: boolean;
        adicional: {
            id: string;
            codigo: string;
            nombre: string;
            descripcion: string;
            tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalDto;
            metodoCosto: import("./dto/productos-servicios.dto").MetodoCostoProductoAdicionalDto;
            centroCostoId: string | null;
            centroCostoNombre: string;
            activo: boolean;
            metadata: Record<string, unknown> | null;
            servicioPricing: {
                niveles: {
                    id: string;
                    nombre: string;
                    orden: number;
                    activo: boolean;
                }[];
                reglas: {
                    id: string;
                    nivelId: string;
                    tiempoMin: number;
                }[];
            };
            efectos: {
                id: string;
                tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalEfectoDto;
                activo: boolean;
            }[];
            materiales: {
                id: string;
                materiaPrimaVarianteId: string;
                materiaPrimaNombre: string;
                materiaPrimaSku: string;
                tipoConsumo: import("./dto/productos-servicios.dto").TipoConsumoAdicionalMaterialDto;
                factorConsumo: number;
                mermaPct: number | null;
                activo: boolean;
                detalle: Record<string, unknown> | null;
            }[];
            createdAt: string;
            updatedAt: string;
        };
        createdAt: string;
        updatedAt: string;
    }>;
    removeProductoAdicional(auth: CurrentAuth, id: string, adicionalId: string): Promise<{
        productoServicioId: string;
        adicionalId: string;
        removed: boolean;
    }>;
    createVariante(auth: CurrentAuth, id: string, payload: CreateProductoVarianteDto): Promise<{
        id: string;
        productoServicioId: string;
        nombre: string;
        anchoMm: number;
        altoMm: number;
        papelVarianteId: string | null;
        papelVarianteSku: string;
        papelNombre: string;
        tipoImpresion: import("./dto/productos-servicios.dto").TipoImpresionProductoVarianteDto;
        caras: import("./dto/productos-servicios.dto").CarasProductoVarianteDto;
        opcionesProductivas: {
            dimension: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto;
            valores: import("./dto/productos-servicios.dto").ValorOpcionProductivaDto[];
        }[] | null;
        procesoDefinicionId: string | null;
        procesoDefinicionCodigo: string;
        procesoDefinicionNombre: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    updateVariante(auth: CurrentAuth, varianteId: string, payload: UpdateProductoVarianteDto): Promise<{
        id: string;
        productoServicioId: string;
        nombre: string;
        anchoMm: number;
        altoMm: number;
        papelVarianteId: string | null;
        papelVarianteSku: string;
        papelNombre: string;
        tipoImpresion: import("./dto/productos-servicios.dto").TipoImpresionProductoVarianteDto;
        caras: import("./dto/productos-servicios.dto").CarasProductoVarianteDto;
        opcionesProductivas: {
            dimension: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto;
            valores: import("./dto/productos-servicios.dto").ValorOpcionProductivaDto[];
        }[] | null;
        procesoDefinicionId: string | null;
        procesoDefinicionCodigo: string;
        procesoDefinicionNombre: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    getVarianteOpcionesProductivas(auth: CurrentAuth, varianteId: string): Promise<{
        varianteId: string;
        source: string;
        dimensiones: {
            dimension: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto;
            valores: import("./dto/productos-servicios.dto").ValorOpcionProductivaDto[];
        }[];
        createdAt?: undefined;
        updatedAt?: undefined;
    } | {
        varianteId: string;
        source: string;
        dimensiones: {
            dimension: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto;
            valores: import("./dto/productos-servicios.dto").ValorOpcionProductivaDto[];
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
    upsertVarianteOpcionesProductivas(auth: CurrentAuth, varianteId: string, payload: UpsertVarianteOpcionesProductivasDto): Promise<{
        varianteId: string;
        source: string;
        dimensiones: {
            dimension: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto;
            valores: import("./dto/productos-servicios.dto").ValorOpcionProductivaDto[];
        }[];
        createdAt?: undefined;
        updatedAt?: undefined;
    } | {
        varianteId: string;
        source: string;
        dimensiones: {
            dimension: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto;
            valores: import("./dto/productos-servicios.dto").ValorOpcionProductivaDto[];
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
    deleteVariante(auth: CurrentAuth, varianteId: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    getVarianteAdicionalesRestricciones(auth: CurrentAuth, varianteId: string): Promise<{
        id: string;
        varianteId: string;
        adicionalId: string;
        adicionalNombre: string;
        permitido: boolean;
        createdAt: string;
        updatedAt: string;
    }[]>;
    setVarianteAdicionalRestriccion(auth: CurrentAuth, varianteId: string, payload: SetVarianteAdicionalRestrictionDto): Promise<{
        id: string;
        varianteId: string;
        adicionalId: string;
        permitido: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    assignVarianteRuta(auth: CurrentAuth, varianteId: string, payload: AssignVarianteRutaDto): Promise<{
        id: string;
        productoServicioId: string;
        nombre: string;
        anchoMm: number;
        altoMm: number;
        papelVarianteId: string | null;
        papelVarianteSku: string;
        papelNombre: string;
        tipoImpresion: import("./dto/productos-servicios.dto").TipoImpresionProductoVarianteDto;
        caras: import("./dto/productos-servicios.dto").CarasProductoVarianteDto;
        opcionesProductivas: {
            dimension: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto;
            valores: import("./dto/productos-servicios.dto").ValorOpcionProductivaDto[];
        }[] | null;
        procesoDefinicionId: string | null;
        procesoDefinicionCodigo: string;
        procesoDefinicionNombre: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    getVarianteMotorOverride(auth: CurrentAuth, varianteId: string): Promise<{
        varianteId: string;
        motorCodigo: "impresion_digital_laser";
        motorVersion: 1;
        parametros: string | number | boolean | import("@prisma/client/runtime/library").JsonObject | import("@prisma/client/runtime/library").JsonArray;
        versionConfig: number;
        activo: boolean;
        updatedAt: string | null;
    }>;
    upsertVarianteMotorOverride(auth: CurrentAuth, varianteId: string, payload: UpsertVarianteMotorOverrideDto): Promise<{
        varianteId: string;
        motorCodigo: "impresion_digital_laser";
        motorVersion: 1;
        parametros: import("@prisma/client/runtime/library").JsonValue;
        versionConfig: number;
        activo: boolean;
        updatedAt: string;
    }>;
    cotizarVariante(auth: CurrentAuth, varianteId: string, payload: CotizarProductoVarianteDto): Promise<{
        createdAt: string;
        varianteId: string;
        productoServicioId: string;
        productoNombre: string;
        varianteNombre: string;
        motorCodigo: "impresion_digital_laser";
        motorVersion: 1;
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
                tipoImpresion: import("./dto/productos-servicios.dto").TipoImpresionProductoVarianteDto | null;
                caras: import("./dto/productos-servicios.dto").CarasProductoVarianteDto | null;
            }[];
            checklistAplicado: Record<string, unknown>[];
            checklistRespuestasSeleccionadas: import("./dto/productos-servicios.dto").CotizarChecklistRespuestaDto[];
            atributosTecnicosConfigurados: {
                dimension: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto;
                valor: import("./dto/productos-servicios.dto").ValorOpcionProductivaDto;
            }[];
            opcionProductivaEfectiva: {
                dimension: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto;
                valores: import("./dto/productos-servicios.dto").ValorOpcionProductivaDto[];
            }[];
            efectosAplicados: {
                id: any;
                addonId: any;
                addonNombre: string;
                tipo: import("./dto/productos-servicios.dto").TipoProductoAdicionalEfectoDto;
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
                regla: import("./dto/productos-servicios.dto").ReglaCostoAdicionalEfectoDto | null;
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
                tipoCorte: string;
                demasiaCorteMm: number;
                lineaCorteMm: number;
                tamanoPliegoImpresion: {
                    codigo: string;
                    nombre: string;
                    anchoMm: number;
                    altoMm: number;
                };
                mermaAdicionalPct: number;
            };
            configVersionBase: number | null;
            configVersionOverride: number | null;
        };
        snapshotId: string;
    }>;
    previewImposicionVariante(auth: CurrentAuth, varianteId: string, payload: PreviewImposicionProductoVarianteDto): Promise<{
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
            tipoCorte: string;
            demasiaCorteMm: number;
            lineaCorteMm: number;
            tamanoPliegoImpresion: {
                codigo: string;
                nombre: string;
                anchoMm: number;
                altoMm: number;
            };
            mermaAdicionalPct: number;
        };
    }>;
    getVarianteCotizaciones(auth: CurrentAuth, varianteId: string): Promise<{
        id: string;
        cantidad: number;
        periodoTarifa: string;
        motorCodigo: string;
        motorVersion: number;
        configVersionBase: number | null;
        configVersionOverride: number | null;
        total: number;
        unitario: number;
        createdAt: string;
    }[]>;
    getCotizacionById(auth: CurrentAuth, snapshotId: string): Promise<{
        id: string;
        cantidad: number;
        periodoTarifa: string;
        motorCodigo: string;
        motorVersion: number;
        configVersionBase: number | null;
        configVersionOverride: number | null;
        total: number;
        resultado: import("@prisma/client/runtime/library").JsonValue;
        createdAt: string;
    }>;
}
