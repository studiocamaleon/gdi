import type { CurrentAuth } from '../auth/auth.types';
import { AssignProductoAdicionalDto, AssignProductoVariantesRutaMasivaDto, AssignProductoMotorDto, UpdateProductoPrecioDto, UpdateProductoPrecioEspecialClientesDto, UpdateGranFormatoConfigDto, UpdateGranFormatoChecklistDto, UpdateGranFormatoRutaBaseDto, AssignVarianteRutaDto, CotizarProductoVarianteDto, PreviewGranFormatoCostosDto, CreateProductoVarianteDto, CreateGranFormatoVarianteDto, UpsertProductoChecklistDto, UpsertProductoAdicionalServicioPricingDto, UpsertVarianteOpcionesProductivasDto, SetVarianteAdicionalRestrictionDto, UpsertProductoAdicionalEfectoDto, UpsertProductoAdicionalDto, PreviewImposicionProductoVarianteDto, UpdateProductoRutaPolicyDto, UpsertProductoMotorConfigDto, UpsertVarianteMotorOverrideDto, UpdateProductoVarianteDto, UpdateGranFormatoVarianteDto, UpsertFamiliaProductoDto, UpsertProductoImpuestoDto, UpsertProductoServicioDto, UpsertSubfamiliaProductoDto } from './dto/productos-servicios.dto';
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
        code: string;
        version: number;
        label: string;
        category: import("./motors/product-motor.contract").MotorCategory;
        capabilities: import("./motors/product-motor.contract").ProductMotorCapabilities;
        schema: Record<string, unknown>;
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
    getImpuestos(auth: CurrentAuth): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        porcentaje: number;
        detalle: {
            items: {
                nombre: string;
                porcentaje: number;
            }[];
        };
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }[]>;
    createImpuesto(auth: CurrentAuth, payload: UpsertProductoImpuestoDto): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        porcentaje: number;
        detalle: {
            items: {
                nombre: string;
                porcentaje: number;
            }[];
        };
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    updateImpuesto(auth: CurrentAuth, id: string, payload: UpsertProductoImpuestoDto): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        porcentaje: number;
        detalle: {
            items: {
                nombre: string;
                porcentaje: number;
            }[];
        };
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
        unidadComercial: string;
        precio: {
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } | null;
        precioEspecialClientes: ({
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } & {
            id: string;
            clienteId: string;
            clienteNombre: string;
            descripcion: string;
            activo: boolean;
            createdAt: string;
            updatedAt: string;
        })[];
        dimensionesBaseConsumidas: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }[]>;
    getProductoCotizaciones(auth: CurrentAuth, id: string): Promise<{
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
        unidadComercial: string;
        precio: {
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } | null;
        precioEspecialClientes: ({
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } & {
            id: string;
            clienteId: string;
            clienteNombre: string;
            descripcion: string;
            activo: boolean;
            createdAt: string;
            updatedAt: string;
        })[];
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
        unidadComercial: string;
        precio: {
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } | null;
        precioEspecialClientes: ({
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } & {
            id: string;
            clienteId: string;
            clienteNombre: string;
            descripcion: string;
            activo: boolean;
            createdAt: string;
            updatedAt: string;
        })[];
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
        unidadComercial: string;
        precio: {
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } | null;
        precioEspecialClientes: ({
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } & {
            id: string;
            clienteId: string;
            clienteNombre: string;
            descripcion: string;
            activo: boolean;
            createdAt: string;
            updatedAt: string;
        })[];
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
        unidadComercial: string;
        precio: {
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } | null;
        precioEspecialClientes: ({
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } & {
            id: string;
            clienteId: string;
            clienteNombre: string;
            descripcion: string;
            activo: boolean;
            createdAt: string;
            updatedAt: string;
        })[];
        dimensionesBaseConsumidas: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }>;
    updateProductoPrecio(auth: CurrentAuth, id: string, payload: UpdateProductoPrecioDto): Promise<{
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
        unidadComercial: string;
        precio: {
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } | null;
        precioEspecialClientes: ({
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } & {
            id: string;
            clienteId: string;
            clienteNombre: string;
            descripcion: string;
            activo: boolean;
            createdAt: string;
            updatedAt: string;
        })[];
        dimensionesBaseConsumidas: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }>;
    updateProductoPrecioEspecialClientes(auth: CurrentAuth, id: string, payload: UpdateProductoPrecioEspecialClientesDto): Promise<{
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
        unidadComercial: string;
        precio: {
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } | null;
        precioEspecialClientes: ({
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } & {
            id: string;
            clienteId: string;
            clienteNombre: string;
            descripcion: string;
            activo: boolean;
            createdAt: string;
            updatedAt: string;
        })[];
        dimensionesBaseConsumidas: import("./dto/productos-servicios.dto").DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }>;
    getProductoMotorConfig(auth: CurrentAuth, id: string): Promise<unknown>;
    upsertProductoMotorConfig(auth: CurrentAuth, id: string, payload: UpsertProductoMotorConfigDto): Promise<unknown>;
    getGranFormatoConfig(auth: CurrentAuth, id: string): Promise<{
        productoId: string;
        tecnologiasCompatibles: string[];
        maquinasCompatibles: string[];
        perfilesCompatibles: string[];
        materialBaseId: string | null;
        materialesCompatibles: string[];
        imposicion: {
            medidas: {
                anchoMm: number | null;
                altoMm: number | null;
                cantidad: number;
            }[];
            piezaAnchoMm: number | null;
            piezaAltoMm: number | null;
            cantidadReferencia: number;
            tecnologiaDefault: string | null;
            maquinaDefaultId: string | null;
            perfilDefaultId: string | null;
            permitirRotacion: boolean;
            separacionHorizontalMm: number;
            separacionVerticalMm: number;
            margenLateralIzquierdoMmOverride: number | null;
            margenLateralDerechoMmOverride: number | null;
            margenInicioMmOverride: number | null;
            margenFinalMmOverride: number | null;
            panelizadoActivo: boolean;
            panelizadoDireccion: import("./dto/productos-servicios.dto").GranFormatoPanelizadoDireccionDto;
            panelizadoSolapeMm: number | null;
            panelizadoAnchoMaxPanelMm: number | null;
            panelizadoDistribucion: import("./dto/productos-servicios.dto").GranFormatoPanelizadoDistribucionDto;
            panelizadoInterpretacionAnchoMaximo: import("./dto/productos-servicios.dto").GranFormatoPanelizadoInterpretacionAnchoMaximoDto;
            panelizadoModo: import("./dto/productos-servicios.dto").GranFormatoPanelizadoModoDto;
            panelizadoManualLayout: Record<string, unknown> | null;
            criterioOptimizacion: import("./dto/productos-servicios.dto").GranFormatoImposicionCriterioOptimizacionDto;
        };
        updatedAt: string;
    }>;
    updateGranFormatoConfig(auth: CurrentAuth, id: string, payload: UpdateGranFormatoConfigDto): Promise<{
        productoId: string;
        tecnologiasCompatibles: string[];
        maquinasCompatibles: string[];
        perfilesCompatibles: string[];
        materialBaseId: string | null;
        materialesCompatibles: string[];
        imposicion: {
            medidas: {
                anchoMm: number | null;
                altoMm: number | null;
                cantidad: number;
            }[];
            piezaAnchoMm: number | null;
            piezaAltoMm: number | null;
            cantidadReferencia: number;
            tecnologiaDefault: string | null;
            maquinaDefaultId: string | null;
            perfilDefaultId: string | null;
            permitirRotacion: boolean;
            separacionHorizontalMm: number;
            separacionVerticalMm: number;
            margenLateralIzquierdoMmOverride: number | null;
            margenLateralDerechoMmOverride: number | null;
            margenInicioMmOverride: number | null;
            margenFinalMmOverride: number | null;
            panelizadoActivo: boolean;
            panelizadoDireccion: import("./dto/productos-servicios.dto").GranFormatoPanelizadoDireccionDto;
            panelizadoSolapeMm: number | null;
            panelizadoAnchoMaxPanelMm: number | null;
            panelizadoDistribucion: import("./dto/productos-servicios.dto").GranFormatoPanelizadoDistribucionDto;
            panelizadoInterpretacionAnchoMaximo: import("./dto/productos-servicios.dto").GranFormatoPanelizadoInterpretacionAnchoMaximoDto;
            panelizadoModo: import("./dto/productos-servicios.dto").GranFormatoPanelizadoModoDto;
            panelizadoManualLayout: Record<string, unknown> | null;
            criterioOptimizacion: import("./dto/productos-servicios.dto").GranFormatoImposicionCriterioOptimizacionDto;
        };
        updatedAt: string;
    }>;
    getGranFormatoRutaBase(auth: CurrentAuth, id: string): Promise<{
        productoId: string;
        procesoDefinicionId: string | null;
        procesoDefinicionNombre: string;
        reglasImpresion: {
            id: string;
            tecnologia: string;
            maquinaId: string | null;
            maquinaNombre: string;
            pasoPlantillaId: string;
            pasoPlantillaNombre: string;
            perfilOperativoDefaultId: string | null;
            perfilOperativoDefaultNombre: string;
        }[];
        updatedAt: string;
    }>;
    updateGranFormatoRutaBase(auth: CurrentAuth, id: string, payload: UpdateGranFormatoRutaBaseDto): Promise<{
        productoId: string;
        procesoDefinicionId: string | null;
        procesoDefinicionNombre: string;
        reglasImpresion: {
            id: string;
            tecnologia: string;
            maquinaId: string | null;
            maquinaNombre: string;
            pasoPlantillaId: string;
            pasoPlantillaNombre: string;
            perfilOperativoDefaultId: string | null;
            perfilOperativoDefaultNombre: string;
        }[];
        updatedAt: string;
    }>;
    getGranFormatoChecklist(auth: CurrentAuth, id: string): Promise<{
        productoId: string;
        aplicaATodasLasTecnologias: boolean;
        checklistComun: {
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
                    preguntaSiguienteId: string | null;
                    orden: number;
                    activo: boolean;
                    reglas: {
                        id: string;
                        accion: "activar_paso" | "seleccionar_variante_paso" | "costo_extra" | "material_extra";
                        orden: number;
                        activo: boolean;
                        pasoPlantillaId: string | null;
                        pasoPlantillaNombre: any;
                        centroCostoId: any;
                        centroCostoNombre: any;
                        maquinaNombre: any;
                        perfilOperativoNombre: any;
                        setupMin: number | null;
                        runMin: null;
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
                        costoRegla: "flat" | "por_unidad" | "por_pliego" | "porcentaje_sobre_total" | "tiempo_min" | null;
                        costoValor: number | null;
                        costoCentroCostoId: string | null;
                        costoCentroCostoNombre: string;
                        materiaPrimaVarianteId: string | null;
                        materiaPrimaNombre: any;
                        materiaPrimaSku: any;
                        tipoConsumo: "por_unidad" | "por_pliego" | "por_m2" | null;
                        factorConsumo: number | null;
                        mermaPct: number | null;
                        detalle: Record<string, unknown> | null;
                    }[];
                }[];
            }[];
            createdAt: null;
            updatedAt: string;
        };
        checklistsPorTecnologia: ({
            tecnologia: string;
            checklist: {
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
                        preguntaSiguienteId: string | null;
                        orden: number;
                        activo: boolean;
                        reglas: {
                            id: string;
                            accion: "activar_paso" | "seleccionar_variante_paso" | "costo_extra" | "material_extra";
                            orden: number;
                            activo: boolean;
                            pasoPlantillaId: string | null;
                            pasoPlantillaNombre: any;
                            centroCostoId: any;
                            centroCostoNombre: any;
                            maquinaNombre: any;
                            perfilOperativoNombre: any;
                            setupMin: number | null;
                            runMin: null;
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
                            costoRegla: "flat" | "por_unidad" | "por_pliego" | "porcentaje_sobre_total" | "tiempo_min" | null;
                            costoValor: number | null;
                            costoCentroCostoId: string | null;
                            costoCentroCostoNombre: string;
                            materiaPrimaVarianteId: string | null;
                            materiaPrimaNombre: any;
                            materiaPrimaSku: any;
                            tipoConsumo: "por_unidad" | "por_pliego" | "por_m2" | null;
                            factorConsumo: number | null;
                            mermaPct: number | null;
                            detalle: Record<string, unknown> | null;
                        }[];
                    }[];
                }[];
                createdAt: null;
                updatedAt: string;
            };
        } | null)[];
        updatedAt: string;
    }>;
    upsertGranFormatoChecklist(auth: CurrentAuth, id: string, payload: UpdateGranFormatoChecklistDto): Promise<{
        productoId: string;
        aplicaATodasLasTecnologias: boolean;
        checklistComun: {
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
                    preguntaSiguienteId: string | null;
                    orden: number;
                    activo: boolean;
                    reglas: {
                        id: string;
                        accion: "activar_paso" | "seleccionar_variante_paso" | "costo_extra" | "material_extra";
                        orden: number;
                        activo: boolean;
                        pasoPlantillaId: string | null;
                        pasoPlantillaNombre: any;
                        centroCostoId: any;
                        centroCostoNombre: any;
                        maquinaNombre: any;
                        perfilOperativoNombre: any;
                        setupMin: number | null;
                        runMin: null;
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
                        costoRegla: "flat" | "por_unidad" | "por_pliego" | "porcentaje_sobre_total" | "tiempo_min" | null;
                        costoValor: number | null;
                        costoCentroCostoId: string | null;
                        costoCentroCostoNombre: string;
                        materiaPrimaVarianteId: string | null;
                        materiaPrimaNombre: any;
                        materiaPrimaSku: any;
                        tipoConsumo: "por_unidad" | "por_pliego" | "por_m2" | null;
                        factorConsumo: number | null;
                        mermaPct: number | null;
                        detalle: Record<string, unknown> | null;
                    }[];
                }[];
            }[];
            createdAt: null;
            updatedAt: string;
        };
        checklistsPorTecnologia: ({
            tecnologia: string;
            checklist: {
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
                        preguntaSiguienteId: string | null;
                        orden: number;
                        activo: boolean;
                        reglas: {
                            id: string;
                            accion: "activar_paso" | "seleccionar_variante_paso" | "costo_extra" | "material_extra";
                            orden: number;
                            activo: boolean;
                            pasoPlantillaId: string | null;
                            pasoPlantillaNombre: any;
                            centroCostoId: any;
                            centroCostoNombre: any;
                            maquinaNombre: any;
                            perfilOperativoNombre: any;
                            setupMin: number | null;
                            runMin: null;
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
                            costoRegla: "flat" | "por_unidad" | "por_pliego" | "porcentaje_sobre_total" | "tiempo_min" | null;
                            costoValor: number | null;
                            costoCentroCostoId: string | null;
                            costoCentroCostoNombre: string;
                            materiaPrimaVarianteId: string | null;
                            materiaPrimaNombre: any;
                            materiaPrimaSku: any;
                            tipoConsumo: "por_unidad" | "por_pliego" | "por_m2" | null;
                            factorConsumo: number | null;
                            mermaPct: number | null;
                            detalle: Record<string, unknown> | null;
                        }[];
                    }[];
                }[];
                createdAt: null;
                updatedAt: string;
            };
        } | null)[];
        updatedAt: string;
    }>;
    previewGranFormatoCostos(auth: CurrentAuth, id: string, payload: PreviewGranFormatoCostosDto): Promise<{
        candidatos: {
            variantId: any;
            rollWidthMm: number;
            printableWidthMm: number;
            marginLeftMm: number;
            marginRightMm: number;
            marginStartMm: number;
            marginEndMm: number;
            orientacion: "rotada" | "normal" | "mixta";
            panelizado: boolean;
            panelAxis: "vertical" | "horizontal" | null;
            panelCount: number;
            panelOverlapMm: number | null;
            panelMaxWidthMm: number | null;
            panelDistribution: "equilibrada" | "libre" | null;
            panelWidthInterpretation: "total" | "util" | null;
            panelMode: "manual" | "automatico" | null;
            piecesPerRow: number;
            rows: number;
            consumedLengthMm: number;
            usefulAreaM2: number;
            consumedAreaM2: number;
            wasteAreaM2: number;
            wastePct: number;
            substrateCost: number;
            inkCost: number;
            timeCost: number;
            totalCost: number;
            placements: {
                id: string;
                widthMm: number;
                heightMm: number;
                usefulWidthMm: number;
                usefulHeightMm: number;
                overlapStartMm: number;
                overlapEndMm: number;
                centerXMm: number;
                centerYMm: number;
                label: string;
                rotated: boolean;
                originalWidthMm: number;
                originalHeightMm: number;
                panelIndex: number | null;
                panelCount: number | null;
                panelAxis: "vertical" | "horizontal" | null;
                sourcePieceId: string | null;
            }[];
        }[] | undefined;
        productoId: string;
        cantidadTotal: number;
        periodo: string;
        tecnologia: string;
        maquinaId: any;
        maquinaNombre: any;
        perfilId: any;
        perfilNombre: any;
        warnings: string[];
        resumenTecnico: {
            varianteId: any;
            varianteNombre: any;
            varianteChips: {
                label: string;
                value: string;
            }[];
            anchoRolloMm: number;
            anchoImprimibleMm: number;
            orientacion: "rotada" | "normal" | "mixta";
            panelizado: boolean;
            panelAxis: "vertical" | "horizontal" | null;
            panelCount: number;
            panelOverlapMm: number | null;
            panelMaxWidthMm: number | null;
            panelDistribution: "equilibrada" | "libre" | null;
            panelWidthInterpretation: "total" | "util" | null;
            panelMode: "manual" | "automatico" | null;
            piezasPorFila: number;
            filas: number;
            largoConsumidoMm: number;
            areaUtilM2: number;
            areaConsumidaM2: number;
            areaDesperdicioM2: number;
            desperdicioPct: number;
            costoSustrato: number;
            costoTinta: number;
            costoTiempo: number;
            costoTotal: number;
        };
        materiasPrimas: Record<string, unknown>[];
        centrosCosto: {
            orden: number;
            codigo: string;
            paso: string;
            centroCostoId: string;
            centroCostoNombre: string;
            origen: string;
            minutos: number;
            tarifaHora: number;
            costo: number;
            detalleTecnico: Record<string, unknown> | null;
        }[];
        totales: {
            materiales: number;
            centrosCosto: number;
            tecnico: number;
        };
        nestingPreview: {
            rollWidth: number;
            rollLength: number;
            marginLeft: number;
            marginRight: number;
            marginStart: number;
            marginEnd: number;
            panelizado: boolean;
            panelAxis: "vertical" | "horizontal" | null;
            panelCount: number;
            panelOverlap: number | null;
            panelMaxWidth: number | null;
            panelDistribution: "equilibrada" | "libre" | null;
            panelWidthInterpretation: "total" | "util" | null;
            panelMode: "manual" | "automatico" | null;
            pieces: {
                id: string;
                w: number;
                h: number;
                usefulW: number;
                usefulH: number;
                cx: number;
                cy: number;
                color: string;
                label: string;
                textColor: string;
                rotated: boolean;
                panelIndex: number | null;
                panelCount: number | null;
                panelAxis: "vertical" | "horizontal" | null;
                sourcePieceId: string | null;
                overlapStart: number;
                overlapEnd: number;
            }[];
        };
    } | {
        candidatos: {
            variantId: any;
            rollWidthMm: number;
            printableWidthMm: number;
            marginLeftMm: number;
            marginRightMm: number;
            marginStartMm: number;
            marginEndMm: number;
            orientacion: "rotada" | "normal" | "mixta";
            panelizado: boolean;
            panelAxis: "vertical" | "horizontal" | null;
            panelCount: number;
            panelOverlapMm: number | null;
            panelMaxWidthMm: number | null;
            panelDistribution: "equilibrada" | "libre" | null;
            panelWidthInterpretation: "total" | "util" | null;
            panelMode: "manual" | "automatico" | null;
            piecesPerRow: number;
            rows: number;
            consumedLengthMm: number;
            usefulAreaM2: number;
            consumedAreaM2: number;
            wasteAreaM2: number;
            wastePct: number;
            substrateCost: number;
            inkCost: number;
            timeCost: number;
            totalCost: number;
            placements: {
                id: string;
                widthMm: number;
                heightMm: number;
                usefulWidthMm: number;
                usefulHeightMm: number;
                overlapStartMm: number;
                overlapEndMm: number;
                centerXMm: number;
                centerYMm: number;
                label: string;
                rotated: boolean;
                originalWidthMm: number;
                originalHeightMm: number;
                panelIndex: number | null;
                panelCount: number | null;
                panelAxis: "vertical" | "horizontal" | null;
                sourcePieceId: string | null;
            }[];
        }[] | undefined;
        snapshotId: string;
        createdAt: string;
        productoId: string;
        cantidadTotal: number;
        periodo: string;
        tecnologia: string;
        maquinaId: any;
        maquinaNombre: any;
        perfilId: any;
        perfilNombre: any;
        warnings: string[];
        resumenTecnico: {
            varianteId: any;
            varianteNombre: any;
            varianteChips: {
                label: string;
                value: string;
            }[];
            anchoRolloMm: number;
            anchoImprimibleMm: number;
            orientacion: "rotada" | "normal" | "mixta";
            panelizado: boolean;
            panelAxis: "vertical" | "horizontal" | null;
            panelCount: number;
            panelOverlapMm: number | null;
            panelMaxWidthMm: number | null;
            panelDistribution: "equilibrada" | "libre" | null;
            panelWidthInterpretation: "total" | "util" | null;
            panelMode: "manual" | "automatico" | null;
            piezasPorFila: number;
            filas: number;
            largoConsumidoMm: number;
            areaUtilM2: number;
            areaConsumidaM2: number;
            areaDesperdicioM2: number;
            desperdicioPct: number;
            costoSustrato: number;
            costoTinta: number;
            costoTiempo: number;
            costoTotal: number;
        };
        materiasPrimas: Record<string, unknown>[];
        centrosCosto: {
            orden: number;
            codigo: string;
            paso: string;
            centroCostoId: string;
            centroCostoNombre: string;
            origen: string;
            minutos: number;
            tarifaHora: number;
            costo: number;
            detalleTecnico: Record<string, unknown> | null;
        }[];
        totales: {
            materiales: number;
            centrosCosto: number;
            tecnico: number;
        };
        nestingPreview: {
            rollWidth: number;
            rollLength: number;
            marginLeft: number;
            marginRight: number;
            marginStart: number;
            marginEnd: number;
            panelizado: boolean;
            panelAxis: "vertical" | "horizontal" | null;
            panelCount: number;
            panelOverlap: number | null;
            panelMaxWidth: number | null;
            panelDistribution: "equilibrada" | "libre" | null;
            panelWidthInterpretation: "total" | "util" | null;
            panelMode: "manual" | "automatico" | null;
            pieces: {
                id: string;
                w: number;
                h: number;
                usefulW: number;
                usefulH: number;
                cx: number;
                cy: number;
                color: string;
                label: string;
                textColor: string;
                rotated: boolean;
                panelIndex: number | null;
                panelCount: number | null;
                panelAxis: "vertical" | "horizontal" | null;
                sourcePieceId: string | null;
                overlapStart: number;
                overlapEnd: number;
            }[];
        };
    }>;
    getGranFormatoVariantes(auth: CurrentAuth, id: string): Promise<{
        id: string;
        productoServicioId: string;
        nombre: string;
        maquinaId: string;
        maquinaNombre: string;
        plantillaMaquina: string;
        tecnologia: string;
        geometriaTrabajo: string;
        anchoUtilMaquina: number | null;
        perfilOperativoId: string;
        perfilOperativoNombre: string;
        productivityValue: number | null;
        productivityUnit: string;
        cantidadPasadas: number | null;
        materialPreset: string;
        configuracionTintas: string;
        materiaPrimaVarianteId: string;
        materiaPrimaNombre: string;
        materiaPrimaSku: string;
        esDefault: boolean;
        permiteOverrideEnCotizacion: boolean;
        activo: boolean;
        observaciones: string;
        detalle: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
    }[]>;
    createGranFormatoVariante(auth: CurrentAuth, id: string, payload: CreateGranFormatoVarianteDto): Promise<{
        id: string;
        productoServicioId: string;
        nombre: string;
        maquinaId: string;
        maquinaNombre: string;
        plantillaMaquina: string;
        tecnologia: string;
        geometriaTrabajo: string;
        anchoUtilMaquina: number | null;
        perfilOperativoId: string;
        perfilOperativoNombre: string;
        productivityValue: number | null;
        productivityUnit: string;
        cantidadPasadas: number | null;
        materialPreset: string;
        configuracionTintas: string;
        materiaPrimaVarianteId: string;
        materiaPrimaNombre: string;
        materiaPrimaSku: string;
        esDefault: boolean;
        permiteOverrideEnCotizacion: boolean;
        activo: boolean;
        observaciones: string;
        detalle: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
    }>;
    updateGranFormatoVariante(auth: CurrentAuth, varianteId: string, payload: UpdateGranFormatoVarianteDto): Promise<{
        id: string;
        productoServicioId: string;
        nombre: string;
        maquinaId: string;
        maquinaNombre: string;
        plantillaMaquina: string;
        tecnologia: string;
        geometriaTrabajo: string;
        anchoUtilMaquina: number | null;
        perfilOperativoId: string;
        perfilOperativoNombre: string;
        productivityValue: number | null;
        productivityUnit: string;
        cantidadPasadas: number | null;
        materialPreset: string;
        configuracionTintas: string;
        materiaPrimaVarianteId: string;
        materiaPrimaNombre: string;
        materiaPrimaSku: string;
        esDefault: boolean;
        permiteOverrideEnCotizacion: boolean;
        activo: boolean;
        observaciones: string;
        detalle: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
    }>;
    deleteGranFormatoVariante(auth: CurrentAuth, varianteId: string): Promise<{
        id: string;
        deleted: boolean;
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
        unidadComercial: string;
        precio: {
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } | null;
        precioEspecialClientes: ({
            metodoCalculo: import("./dto/productos-servicios.dto").MetodoCalculoPrecioProductoDto;
            measurementUnit: string | null;
            impuestos: {
                esquemaId: string | null;
                esquemaNombre: string;
                items: Array<{
                    nombre: string;
                    porcentaje: number;
                }>;
                porcentajeTotal: number;
            };
            comisiones: {
                items: Array<{
                    id: string;
                    nombre: string;
                    tipo: "financiera" | "vendedor";
                    porcentaje: number;
                    activo: boolean;
                }>;
                porcentajeTotal: number;
            };
            detalle: Record<string, unknown>;
        } & {
            id: string;
            clienteId: string;
            clienteNombre: string;
            descripcion: string;
            activo: boolean;
            createdAt: string;
            updatedAt: string;
        })[];
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
                preguntaSiguienteId: string | null;
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
                preguntaSiguienteId: string | null;
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
    getVarianteMotorOverride(auth: CurrentAuth, varianteId: string): Promise<unknown>;
    upsertVarianteMotorOverride(auth: CurrentAuth, varianteId: string, payload: UpsertVarianteMotorOverrideDto): Promise<unknown>;
    cotizarVariante(auth: CurrentAuth, varianteId: string, payload: CotizarProductoVarianteDto): Promise<unknown>;
    previewImposicionVariante(auth: CurrentAuth, varianteId: string, payload: PreviewImposicionProductoVarianteDto): Promise<unknown>;
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
