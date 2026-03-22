import { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AssignProductoVariantesRutaMasivaDto, AssignProductoAdicionalDto, AssignProductoMotorDto, AssignVarianteRutaDto, DimensionOpcionProductivaDto, CarasProductoVarianteDto, ReglaCostoAdicionalEfectoDto, MetodoCostoProductoAdicionalDto, CotizarProductoVarianteDto, CreateProductoVarianteDto, TipoProductoAdicionalEfectoDto, SetVarianteAdicionalRestrictionDto, UpsertProductoAdicionalEfectoDto, TipoConsumoAdicionalMaterialDto, TipoProductoAdicionalDto, UpsertProductoAdicionalServicioPricingDto, UpsertVarianteOpcionesProductivasDto, UpsertProductoAdicionalDto, UpsertProductoChecklistDto, PreviewImposicionProductoVarianteDto, MetodoCalculoPrecioProductoDto, ReglaCostoChecklistDto, TipoChecklistPreguntaDto, TipoChecklistAccionReglaDto, UpdateProductoPrecioDto, UpdateProductoPrecioEspecialClientesDto, UpdateGranFormatoConfigDto, UpdateProductoRutaPolicyDto, EstadoProductoServicioDto, TipoVentaGranFormatoDto, TipoImpresionProductoVarianteDto, TipoProductoServicioDto, ValorOpcionProductivaDto, UpsertProductoMotorConfigDto, UpsertVarianteMotorOverrideDto, CreateGranFormatoVarianteDto, UpdateGranFormatoVarianteDto, UpdateProductoVarianteDto, UpsertFamiliaProductoDto, UpsertProductoImpuestoDto, UpsertProductoServicioDto, UpsertSubfamiliaProductoDto } from './dto/productos-servicios.dto';
import type { ProductMotorDefinition } from './motors/product-motor.contract';
type ServicioPricingNivel = {
    id: string;
    nombre: string;
    orden: number;
    activo: boolean;
};
type ServicioPricingRegla = {
    id: string;
    nivelId: string;
    tiempoMin: number;
};
type ServicioPricingConfig = {
    niveles: ServicioPricingNivel[];
    reglas: ServicioPricingRegla[];
};
type ProductoPrecioConfig = {
    metodoCalculo: MetodoCalculoPrecioProductoDto;
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
            tipo: 'financiera' | 'vendedor';
            porcentaje: number;
            activo: boolean;
        }>;
        porcentajeTotal: number;
    };
    detalle: Record<string, unknown>;
};
type ProductoPrecioEspecialClienteConfig = ProductoPrecioConfig & {
    id: string;
    clienteId: string;
    clienteNombre: string;
    descripcion: string;
    activo: boolean;
    createdAt: string;
    updatedAt: string;
};
type RouteEffectInsertionMode = 'append' | 'before_step' | 'after_step';
type RouteEffectInsertionConfig = {
    modo: RouteEffectInsertionMode;
    pasoPlantillaId: string | null;
};
export declare class ProductosServiciosService {
    private readonly prisma;
    private static readonly CODIGO_PREFIX;
    private static readonly CODIGO_MAX_RETRIES;
    private static readonly ADICIONAL_CODIGO_PREFIX;
    private static readonly ADICIONAL_CODIGO_MAX_RETRIES;
    private static readonly FAMILIA_BASE_CODIGO;
    private static readonly SUBFAMILIA_BASE_CODIGO;
    private static readonly FAMILIA_BASE_CODIGO_LEGACY;
    private static readonly SUBFAMILIA_BASE_CODIGO_LEGACY;
    private static readonly DIGITAL_SHEET_MOTOR_DEFINITION;
    private static readonly WIDE_FORMAT_MOTOR_DEFINITION;
    private static readonly DEFAULT_A4_AREA_M2;
    private static readonly TERMINACION_PLANTILLAS_SOPORTADAS;
    private static readonly WIDE_FORMAT_MACHINE_TEMPLATES;
    private static readonly CANONICAL_PLIEGOS_MM;
    private readonly motorRegistry;
    constructor(prisma: PrismaService);
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
    getDigitalMotorDefinition(): {
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
        code: string;
        version: number;
        label: string;
        category: import("./motors/product-motor.contract").MotorCategory;
        capabilities: import("./motors/product-motor.contract").ProductMotorCapabilities;
        exposedInCatalog: boolean;
    };
    getWideFormatMotorDefinition(): ProductMotorDefinition;
    findAdicionalesCatalogo(auth: CurrentAuth): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        descripcion: string;
        tipo: TipoProductoAdicionalDto;
        metodoCosto: MetodoCostoProductoAdicionalDto;
        centroCostoId: string | null;
        centroCostoNombre: string;
        activo: boolean;
        metadata: Record<string, unknown> | null;
        servicioPricing: ServicioPricingConfig;
        efectos: {
            id: string;
            tipo: TipoProductoAdicionalEfectoDto;
            activo: boolean;
        }[];
        materiales: {
            id: string;
            materiaPrimaVarianteId: string;
            materiaPrimaNombre: string;
            materiaPrimaSku: string;
            tipoConsumo: TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            activo: boolean;
            detalle: Record<string, unknown> | null;
        }[];
        createdAt: string;
        updatedAt: string;
    }[]>;
    createAdicionalCatalogo(auth: CurrentAuth, payload: UpsertProductoAdicionalDto): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        descripcion: string;
        tipo: TipoProductoAdicionalDto;
        metodoCosto: MetodoCostoProductoAdicionalDto;
        centroCostoId: string | null;
        centroCostoNombre: string;
        activo: boolean;
        metadata: Record<string, unknown> | null;
        servicioPricing: ServicioPricingConfig;
        efectos: {
            id: string;
            tipo: TipoProductoAdicionalEfectoDto;
            activo: boolean;
        }[];
        materiales: {
            id: string;
            materiaPrimaVarianteId: string;
            materiaPrimaNombre: string;
            materiaPrimaSku: string;
            tipoConsumo: TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            activo: boolean;
            detalle: Record<string, unknown> | null;
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
    updateAdicionalCatalogo(auth: CurrentAuth, adicionalId: string, payload: UpsertProductoAdicionalDto): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        descripcion: string;
        tipo: TipoProductoAdicionalDto;
        metodoCosto: MetodoCostoProductoAdicionalDto;
        centroCostoId: string | null;
        centroCostoNombre: string;
        activo: boolean;
        metadata: Record<string, unknown> | null;
        servicioPricing: ServicioPricingConfig;
        efectos: {
            id: string;
            tipo: TipoProductoAdicionalEfectoDto;
            activo: boolean;
        }[];
        materiales: {
            id: string;
            materiaPrimaVarianteId: string;
            materiaPrimaNombre: string;
            materiaPrimaSku: string;
            tipoConsumo: TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            activo: boolean;
            detalle: Record<string, unknown> | null;
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
    toggleAdicionalCatalogo(auth: CurrentAuth, adicionalId: string): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        descripcion: string;
        tipo: TipoProductoAdicionalDto;
        metodoCosto: MetodoCostoProductoAdicionalDto;
        centroCostoId: string | null;
        centroCostoNombre: string;
        activo: boolean;
        metadata: Record<string, unknown> | null;
        servicioPricing: ServicioPricingConfig;
        efectos: {
            id: string;
            tipo: TipoProductoAdicionalEfectoDto;
            activo: boolean;
        }[];
        materiales: {
            id: string;
            materiaPrimaVarianteId: string;
            materiaPrimaNombre: string;
            materiaPrimaSku: string;
            tipoConsumo: TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            activo: boolean;
            detalle: Record<string, unknown> | null;
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
    getAdicionalServicioPricing(auth: CurrentAuth, adicionalId: string): Promise<ServicioPricingConfig>;
    upsertAdicionalServicioPricing(auth: CurrentAuth, adicionalId: string, payload: UpsertProductoAdicionalServicioPricingDto): Promise<ServicioPricingConfig>;
    findProductoAdicionales(auth: CurrentAuth, productoId: string): Promise<{
        id: string;
        productoServicioId: string;
        adicionalId: string;
        activo: boolean;
        adicional: {
            id: string;
            codigo: string;
            nombre: string;
            descripcion: string;
            tipo: TipoProductoAdicionalDto;
            metodoCosto: MetodoCostoProductoAdicionalDto;
            centroCostoId: string | null;
            centroCostoNombre: string;
            activo: boolean;
            metadata: Record<string, unknown> | null;
            servicioPricing: ServicioPricingConfig;
            efectos: {
                id: string;
                tipo: TipoProductoAdicionalEfectoDto;
                activo: boolean;
            }[];
            materiales: {
                id: string;
                materiaPrimaVarianteId: string;
                materiaPrimaNombre: string;
                materiaPrimaSku: string;
                tipoConsumo: TipoConsumoAdicionalMaterialDto;
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
    assignProductoAdicional(auth: CurrentAuth, productoId: string, payload: AssignProductoAdicionalDto): Promise<{
        id: string;
        productoServicioId: string;
        adicionalId: string;
        activo: boolean;
        adicional: {
            id: string;
            codigo: string;
            nombre: string;
            descripcion: string;
            tipo: TipoProductoAdicionalDto;
            metodoCosto: MetodoCostoProductoAdicionalDto;
            centroCostoId: string | null;
            centroCostoNombre: string;
            activo: boolean;
            metadata: Record<string, unknown> | null;
            servicioPricing: ServicioPricingConfig;
            efectos: {
                id: string;
                tipo: TipoProductoAdicionalEfectoDto;
                activo: boolean;
            }[];
            materiales: {
                id: string;
                materiaPrimaVarianteId: string;
                materiaPrimaNombre: string;
                materiaPrimaSku: string;
                tipoConsumo: TipoConsumoAdicionalMaterialDto;
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
    removeProductoAdicional(auth: CurrentAuth, productoId: string, adicionalId: string): Promise<{
        productoServicioId: string;
        adicionalId: string;
        removed: boolean;
    }>;
    findVarianteAdicionalesRestricciones(auth: CurrentAuth, varianteId: string): Promise<{
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
    findFamilias(auth: CurrentAuth): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        activo: boolean;
        subfamiliasCount: number;
        createdAt: string;
        updatedAt: string;
    }[]>;
    createFamilia(auth: CurrentAuth, payload: UpsertFamiliaProductoDto): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    findImpuestos(auth: CurrentAuth): Promise<{
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
    findSubfamilias(auth: CurrentAuth, familiaId?: string): Promise<{
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
    findProductos(auth: CurrentAuth): Promise<{
        matchingBasePorVariante: never[];
        pasosFijosPorVariante: never[];
        id: string;
        tipo: TipoProductoServicioDto;
        codigo: string;
        nombre: string;
        descripcion: string;
        motorCodigo: string;
        motorVersion: number;
        usarRutaComunVariantes: boolean;
        procesoDefinicionDefaultId: string | null;
        procesoDefinicionDefaultNombre: string;
        estado: EstadoProductoServicioDto;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        subfamiliaProductoId: string | null;
        subfamiliaProductoNombre: string;
        unidadComercial: string;
        precio: ProductoPrecioConfig | null;
        precioEspecialClientes: ProductoPrecioEspecialClienteConfig[];
        dimensionesBaseConsumidas: DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }[]>;
    findProducto(auth: CurrentAuth, id: string): Promise<{
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
        tipo: TipoProductoServicioDto;
        codigo: string;
        nombre: string;
        descripcion: string;
        motorCodigo: string;
        motorVersion: number;
        usarRutaComunVariantes: boolean;
        procesoDefinicionDefaultId: string | null;
        procesoDefinicionDefaultNombre: string;
        estado: EstadoProductoServicioDto;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        subfamiliaProductoId: string | null;
        subfamiliaProductoNombre: string;
        unidadComercial: string;
        precio: ProductoPrecioConfig | null;
        precioEspecialClientes: ProductoPrecioEspecialClienteConfig[];
        dimensionesBaseConsumidas: DimensionOpcionProductivaDto[];
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
        tipo: TipoProductoServicioDto;
        codigo: string;
        nombre: string;
        descripcion: string;
        motorCodigo: string;
        motorVersion: number;
        usarRutaComunVariantes: boolean;
        procesoDefinicionDefaultId: string | null;
        procesoDefinicionDefaultNombre: string;
        estado: EstadoProductoServicioDto;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        subfamiliaProductoId: string | null;
        subfamiliaProductoNombre: string;
        unidadComercial: string;
        precio: ProductoPrecioConfig | null;
        precioEspecialClientes: ProductoPrecioEspecialClienteConfig[];
        dimensionesBaseConsumidas: DimensionOpcionProductivaDto[];
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
        tipo: TipoProductoServicioDto;
        codigo: string;
        nombre: string;
        descripcion: string;
        motorCodigo: string;
        motorVersion: number;
        usarRutaComunVariantes: boolean;
        procesoDefinicionDefaultId: string | null;
        procesoDefinicionDefaultNombre: string;
        estado: EstadoProductoServicioDto;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        subfamiliaProductoId: string | null;
        subfamiliaProductoNombre: string;
        unidadComercial: string;
        precio: ProductoPrecioConfig | null;
        precioEspecialClientes: ProductoPrecioEspecialClienteConfig[];
        dimensionesBaseConsumidas: DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }>;
    assignProductoMotor(auth: CurrentAuth, productoId: string, payload: AssignProductoMotorDto): Promise<{
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
        tipo: TipoProductoServicioDto;
        codigo: string;
        nombre: string;
        descripcion: string;
        motorCodigo: string;
        motorVersion: number;
        usarRutaComunVariantes: boolean;
        procesoDefinicionDefaultId: string | null;
        procesoDefinicionDefaultNombre: string;
        estado: EstadoProductoServicioDto;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        subfamiliaProductoId: string | null;
        subfamiliaProductoNombre: string;
        unidadComercial: string;
        precio: ProductoPrecioConfig | null;
        precioEspecialClientes: ProductoPrecioEspecialClienteConfig[];
        dimensionesBaseConsumidas: DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }>;
    updateProductoPrecio(auth: CurrentAuth, productoId: string, payload: UpdateProductoPrecioDto): Promise<{
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
        tipo: TipoProductoServicioDto;
        codigo: string;
        nombre: string;
        descripcion: string;
        motorCodigo: string;
        motorVersion: number;
        usarRutaComunVariantes: boolean;
        procesoDefinicionDefaultId: string | null;
        procesoDefinicionDefaultNombre: string;
        estado: EstadoProductoServicioDto;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        subfamiliaProductoId: string | null;
        subfamiliaProductoNombre: string;
        unidadComercial: string;
        precio: ProductoPrecioConfig | null;
        precioEspecialClientes: ProductoPrecioEspecialClienteConfig[];
        dimensionesBaseConsumidas: DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }>;
    updateProductoPrecioEspecialClientes(auth: CurrentAuth, productoId: string, payload: UpdateProductoPrecioEspecialClientesDto): Promise<{
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
        tipo: TipoProductoServicioDto;
        codigo: string;
        nombre: string;
        descripcion: string;
        motorCodigo: string;
        motorVersion: number;
        usarRutaComunVariantes: boolean;
        procesoDefinicionDefaultId: string | null;
        procesoDefinicionDefaultNombre: string;
        estado: EstadoProductoServicioDto;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        subfamiliaProductoId: string | null;
        subfamiliaProductoNombre: string;
        unidadComercial: string;
        precio: ProductoPrecioConfig | null;
        precioEspecialClientes: ProductoPrecioEspecialClienteConfig[];
        dimensionesBaseConsumidas: DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }>;
    getProductoMotorConfig(auth: CurrentAuth, productoId: string): Promise<unknown>;
    getDigitalProductMotorConfig(auth: CurrentAuth, productoId: string): Promise<{
        productoId: string;
        motorCodigo: string;
        motorVersion: number;
        parametros: string | number | boolean | Prisma.JsonObject | Prisma.JsonArray | {
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
    upsertProductoMotorConfig(auth: CurrentAuth, productoId: string, payload: UpsertProductoMotorConfigDto): Promise<unknown>;
    upsertDigitalProductMotorConfig(auth: CurrentAuth, productoId: string, payload: UpsertProductoMotorConfigDto): Promise<{
        productoId: string;
        motorCodigo: string;
        motorVersion: number;
        parametros: Prisma.JsonValue;
        versionConfig: number;
        activo: boolean;
        updatedAt: string;
    }>;
    getWideFormatProductMotorConfig(auth: CurrentAuth, productoId: string): Promise<{
        productoId: string;
        motorCodigo: string;
        motorVersion: number;
        parametros: string | number | boolean | Prisma.JsonObject | Prisma.JsonArray;
        versionConfig: number;
        activo: boolean;
        updatedAt: string | null;
    }>;
    upsertWideFormatProductMotorConfig(auth: CurrentAuth, productoId: string, payload: UpsertProductoMotorConfigDto): Promise<{
        productoId: string;
        motorCodigo: string;
        motorVersion: number;
        parametros: Prisma.JsonValue;
        versionConfig: number;
        activo: boolean;
        updatedAt: string;
    }>;
    getGranFormatoConfig(auth: CurrentAuth, productoId: string): Promise<{
        productoId: string;
        tipoVenta: TipoVentaGranFormatoDto;
        tecnologiasCompatibles: string[];
        maquinasCompatibles: string[];
        perfilesCompatibles: string[];
        materialBaseId: string | null;
        materialesCompatibles: string[];
        updatedAt: string;
    }>;
    updateGranFormatoConfig(auth: CurrentAuth, productoId: string, payload: UpdateGranFormatoConfigDto): Promise<{
        productoId: string;
        tipoVenta: TipoVentaGranFormatoDto;
        tecnologiasCompatibles: string[];
        maquinasCompatibles: string[];
        perfilesCompatibles: string[];
        materialBaseId: string | null;
        materialesCompatibles: string[];
        updatedAt: string;
    }>;
    findGranFormatoVariantes(auth: CurrentAuth, productoId: string): Promise<{
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
    createGranFormatoVariante(auth: CurrentAuth, productoId: string, payload: CreateGranFormatoVarianteDto): Promise<{
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
    updateProductoRutaPolicy(auth: CurrentAuth, productoId: string, payload: UpdateProductoRutaPolicyDto): Promise<{
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
        tipo: TipoProductoServicioDto;
        codigo: string;
        nombre: string;
        descripcion: string;
        motorCodigo: string;
        motorVersion: number;
        usarRutaComunVariantes: boolean;
        procesoDefinicionDefaultId: string | null;
        procesoDefinicionDefaultNombre: string;
        estado: EstadoProductoServicioDto;
        activo: boolean;
        familiaProductoId: string;
        familiaProductoNombre: string;
        subfamiliaProductoId: string | null;
        subfamiliaProductoNombre: string;
        unidadComercial: string;
        precio: ProductoPrecioConfig | null;
        precioEspecialClientes: ProductoPrecioEspecialClienteConfig[];
        dimensionesBaseConsumidas: DimensionOpcionProductivaDto[];
        createdAt: string;
        updatedAt: string;
    }>;
    assignProductoVariantesRutaMasiva(auth: CurrentAuth, productoId: string, payload: AssignProductoVariantesRutaMasivaDto): Promise<{
        productoId: string;
        updatedCount: number;
        procesoDefinicionId: string;
        incluirInactivas: boolean;
    }>;
    findVariantes(auth: CurrentAuth, productoId: string): Promise<{
        id: string;
        productoServicioId: string;
        nombre: string;
        anchoMm: number;
        altoMm: number;
        papelVarianteId: string | null;
        papelVarianteSku: string;
        papelNombre: string;
        tipoImpresion: TipoImpresionProductoVarianteDto;
        caras: CarasProductoVarianteDto;
        opcionesProductivas: {
            dimension: DimensionOpcionProductivaDto;
            valores: ValorOpcionProductivaDto[];
        }[] | null;
        procesoDefinicionId: string | null;
        procesoDefinicionCodigo: string;
        procesoDefinicionNombre: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }[]>;
    createVariante(auth: CurrentAuth, productoId: string, payload: CreateProductoVarianteDto): Promise<{
        id: string;
        productoServicioId: string;
        nombre: string;
        anchoMm: number;
        altoMm: number;
        papelVarianteId: string | null;
        papelVarianteSku: string;
        papelNombre: string;
        tipoImpresion: TipoImpresionProductoVarianteDto;
        caras: CarasProductoVarianteDto;
        opcionesProductivas: {
            dimension: DimensionOpcionProductivaDto;
            valores: ValorOpcionProductivaDto[];
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
        tipoImpresion: TipoImpresionProductoVarianteDto;
        caras: CarasProductoVarianteDto;
        opcionesProductivas: {
            dimension: DimensionOpcionProductivaDto;
            valores: ValorOpcionProductivaDto[];
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
            dimension: DimensionOpcionProductivaDto;
            valores: ValorOpcionProductivaDto[];
        }[];
        createdAt?: undefined;
        updatedAt?: undefined;
    } | {
        varianteId: string;
        source: string;
        dimensiones: {
            dimension: DimensionOpcionProductivaDto;
            valores: ValorOpcionProductivaDto[];
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
    upsertVarianteOpcionesProductivas(auth: CurrentAuth, varianteId: string, payload: UpsertVarianteOpcionesProductivasDto): Promise<{
        varianteId: string;
        source: string;
        dimensiones: {
            dimension: DimensionOpcionProductivaDto;
            valores: ValorOpcionProductivaDto[];
        }[];
        createdAt?: undefined;
        updatedAt?: undefined;
    } | {
        varianteId: string;
        source: string;
        dimensiones: {
            dimension: DimensionOpcionProductivaDto;
            valores: ValorOpcionProductivaDto[];
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
    getProductoChecklist(auth: CurrentAuth, productoId: string): Promise<{
        id: string;
        productoId: string;
        activo: boolean;
        preguntas: {
            id: string;
            texto: string;
            tipoPregunta: TipoChecklistPreguntaDto;
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
                    accion: TipoChecklistAccionReglaDto;
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
                    costoRegla: ReglaCostoChecklistDto | null;
                    costoValor: number | null;
                    costoCentroCostoId: string | null;
                    costoCentroCostoNombre: string;
                    materiaPrimaVarianteId: string | null;
                    materiaPrimaNombre: string;
                    materiaPrimaSku: string;
                    tipoConsumo: TipoConsumoAdicionalMaterialDto | null;
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
    upsertProductoChecklist(auth: CurrentAuth, productoId: string, payload: UpsertProductoChecklistDto): Promise<{
        id: string;
        productoId: string;
        activo: boolean;
        preguntas: {
            id: string;
            texto: string;
            tipoPregunta: TipoChecklistPreguntaDto;
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
                    accion: TipoChecklistAccionReglaDto;
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
                    costoRegla: ReglaCostoChecklistDto | null;
                    costoValor: number | null;
                    costoCentroCostoId: string | null;
                    costoCentroCostoNombre: string;
                    materiaPrimaVarianteId: string | null;
                    materiaPrimaNombre: string;
                    materiaPrimaSku: string;
                    tipoConsumo: TipoConsumoAdicionalMaterialDto | null;
                    factorConsumo: number | null;
                    mermaPct: number | null;
                    detalle: Record<string, unknown> | null;
                }[];
            }[];
        }[];
        createdAt: string;
        updatedAt: string;
    }>;
    findAdicionalEfectos(auth: CurrentAuth, adicionalId: string): Promise<{
        id: string;
        adicionalId: string;
        tipo: TipoProductoAdicionalEfectoDto;
        nombre: string;
        activo: boolean;
        scopes: {
            id: string;
            varianteId: string | null;
            dimension: DimensionOpcionProductivaDto | null;
            valor: ValorOpcionProductivaDto | null;
        }[];
        routeEffect: {
            id: string;
            insertion: RouteEffectInsertionConfig;
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
            regla: ReglaCostoAdicionalEfectoDto;
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
            tipoConsumo: TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            detalle: Record<string, unknown> | null;
        } | null;
        createdAt: string;
        updatedAt: string;
    }[]>;
    createAdicionalEfecto(auth: CurrentAuth, adicionalId: string, payload: UpsertProductoAdicionalEfectoDto): Promise<{
        id: string;
        adicionalId: string;
        tipo: TipoProductoAdicionalEfectoDto;
        nombre: string;
        activo: boolean;
        scopes: {
            id: string;
            varianteId: string | null;
            dimension: DimensionOpcionProductivaDto | null;
            valor: ValorOpcionProductivaDto | null;
        }[];
        routeEffect: {
            id: string;
            insertion: RouteEffectInsertionConfig;
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
            regla: ReglaCostoAdicionalEfectoDto;
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
            tipoConsumo: TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            detalle: Record<string, unknown> | null;
        } | null;
        createdAt: string;
        updatedAt: string;
    }>;
    updateAdicionalEfecto(auth: CurrentAuth, adicionalId: string, efectoId: string, payload: UpsertProductoAdicionalEfectoDto): Promise<{
        id: string;
        adicionalId: string;
        tipo: TipoProductoAdicionalEfectoDto;
        nombre: string;
        activo: boolean;
        scopes: {
            id: string;
            varianteId: string | null;
            dimension: DimensionOpcionProductivaDto | null;
            valor: ValorOpcionProductivaDto | null;
        }[];
        routeEffect: {
            id: string;
            insertion: RouteEffectInsertionConfig;
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
            regla: ReglaCostoAdicionalEfectoDto;
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
            tipoConsumo: TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            detalle: Record<string, unknown> | null;
        } | null;
        createdAt: string;
        updatedAt: string;
    }>;
    toggleAdicionalEfecto(auth: CurrentAuth, adicionalId: string, efectoId: string): Promise<{
        id: string;
        adicionalId: string;
        tipo: TipoProductoAdicionalEfectoDto;
        nombre: string;
        activo: boolean;
        scopes: {
            id: string;
            varianteId: string | null;
            dimension: DimensionOpcionProductivaDto | null;
            valor: ValorOpcionProductivaDto | null;
        }[];
        routeEffect: {
            id: string;
            insertion: RouteEffectInsertionConfig;
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
            regla: ReglaCostoAdicionalEfectoDto;
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
            tipoConsumo: TipoConsumoAdicionalMaterialDto;
            factorConsumo: number;
            mermaPct: number | null;
            detalle: Record<string, unknown> | null;
        } | null;
        createdAt: string;
        updatedAt: string;
    }>;
    deleteAdicionalEfecto(auth: CurrentAuth, adicionalId: string, efectoId: string): Promise<{
        adicionalId: string;
        efectoId: string;
        deleted: boolean;
    }>;
    deleteVariante(auth: CurrentAuth, varianteId: string): Promise<{
        id: string;
        deleted: boolean;
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
        tipoImpresion: TipoImpresionProductoVarianteDto;
        caras: CarasProductoVarianteDto;
        opcionesProductivas: {
            dimension: DimensionOpcionProductivaDto;
            valores: ValorOpcionProductivaDto[];
        }[] | null;
        procesoDefinicionId: string | null;
        procesoDefinicionCodigo: string;
        procesoDefinicionNombre: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    getVarianteMotorOverride(auth: CurrentAuth, varianteId: string): Promise<unknown>;
    getDigitalVariantMotorOverride(auth: CurrentAuth, varianteId: string): Promise<{
        varianteId: string;
        motorCodigo: string;
        motorVersion: number;
        parametros: string | number | boolean | Prisma.JsonObject | Prisma.JsonArray;
        versionConfig: number;
        activo: boolean;
        updatedAt: string | null;
    }>;
    upsertVarianteMotorOverride(auth: CurrentAuth, varianteId: string, payload: UpsertVarianteMotorOverrideDto): Promise<unknown>;
    upsertDigitalVariantMotorOverride(auth: CurrentAuth, varianteId: string, payload: UpsertVarianteMotorOverrideDto): Promise<{
        varianteId: string;
        motorCodigo: string;
        motorVersion: number;
        parametros: Prisma.JsonValue;
        versionConfig: number;
        activo: boolean;
        updatedAt: string;
    }>;
    cotizarVariante(auth: CurrentAuth, varianteId: string, payload: CotizarProductoVarianteDto): Promise<unknown>;
    quoteDigitalVariant(auth: CurrentAuth, varianteId: string, payload: CotizarProductoVarianteDto): Promise<{
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
                tipoImpresion: TipoImpresionProductoVarianteDto | null;
                caras: CarasProductoVarianteDto | null;
            }[];
            checklistAplicado: Record<string, unknown>[];
            checklistRespuestasSeleccionadas: import("./dto/productos-servicios.dto").CotizarChecklistRespuestaDto[];
            atributosTecnicosConfigurados: {
                dimension: DimensionOpcionProductivaDto;
                valor: ValorOpcionProductivaDto;
            }[];
            opcionProductivaEfectiva: {
                dimension: DimensionOpcionProductivaDto;
                valores: ValorOpcionProductivaDto[];
            }[];
            efectosAplicados: {
                id: any;
                addonId: any;
                addonNombre: string;
                tipo: TipoProductoAdicionalEfectoDto;
                nombre: any;
            }[];
            routeEffectsAplicados: {
                id: any;
                addonId: any;
                nombre: any;
                pasos: any;
                insertion: RouteEffectInsertionConfig;
            }[];
            costEffectsAplicados: {
                id: any;
                addonId: any;
                nombre: any;
                regla: ReglaCostoAdicionalEfectoDto | null;
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
    previewVarianteImposicion(auth: CurrentAuth, varianteId: string, payload: PreviewImposicionProductoVarianteDto): Promise<unknown>;
    previewDigitalVariant(auth: CurrentAuth, varianteId: string, payload: PreviewImposicionProductoVarianteDto): Promise<{
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
        resultado: Prisma.JsonValue;
        createdAt: string;
    }>;
    private validateProductoRelations;
    private findFamiliaOrThrow;
    private findSubfamiliaOrThrow;
    private findImpuestoOrThrow;
    private findProductoOrThrow;
    private findVarianteOrThrow;
    private findPapelVarianteOrThrow;
    private findGranFormatoVarianteOrThrow;
    private findProcesoOrThrow;
    private findProcesoOperacionOrThrow;
    private findBibliotecaOperacionOrThrow;
    private findCentroCostoOrThrow;
    private findAdicionalCatalogoOrThrow;
    private getAdicionalCatalogoByIdOrThrow;
    private validateAdicionalPayload;
    private getAdicionalEfectoInclude;
    private parseServicioPricing;
    private normalizeRouteEffectInsertionPayload;
    private parseRouteEffectInsertion;
    private parseChecklistRouteInsertion;
    private getChecklistRouteOrden;
    private normalizeServicioPricingPayload;
    private findAdicionalEfectoOrThrow;
    private getAdicionalEfectoByIdOrThrow;
    private validateAdicionalEfectoPayload;
    private resolveAdicionalEfectoNombre;
    private assertSingleAddonEffectTypeConstraint;
    private replaceAdicionalEfectoDetail;
    private toAdicionalEfectoResponse;
    private isPlantillaTerminacionSoportada;
    private validateProductoChecklistPayload;
    private resolveChecklistPreguntaIdsActivas;
    private toProductoChecklistResponse;
    private validateOpcionesProductivasPayload;
    private normalizeOpcionesProductivasPayload;
    private validateAndNormalizeMatchingBase;
    private validateAndNormalizePasosFijosRutaBase;
    private toVarianteOpcionesProductivasResponse;
    private toGranFormatoVarianteResponse;
    private toAdicionalCatalogoResponse;
    private toImpuestoResponse;
    private toFamiliaResponse;
    private toSubfamiliaResponse;
    private toProductoResponseBase;
    private mergeProductoDetalle;
    private ensureWideFormatProducto;
    private getGranFormatoDetalle;
    private getGranFormatoTipoVenta;
    private getGranFormatoStringArray;
    private getGranFormatoNullableString;
    private getProductoPrecioConfig;
    private getProductoPrecioEspecialClientes;
    private normalizeProductoPrecioImpuestos;
    private normalizeProductoPrecioComisiones;
    private normalizeProductoPrecioEspecialClienteStored;
    private resolveProductoPrecioEspecialClientes;
    private resolveProductoPrecioImpuestos;
    private parseImpuestoDetalle;
    private normalizeMetodoCalculoPrecioProducto;
    private normalizeProductoPrecioDetalle;
    private normalizeProductoPrecioTierRows;
    private getProductoDimensionesBaseConsumidas;
    private getProductoMatchingBaseByVariante;
    private getProductoPasosFijosByVariante;
    private toRutaBaseMatchingResponse;
    private toRutaBasePasosFijosResponse;
    private normalizeDimensionOpcionProductivaValue;
    private normalizeTipoImpresionProductoVarianteValue;
    private normalizeCarasProductoVarianteValue;
    private validateVarianteRelations;
    private toVarianteResponse;
    private generateProductoCodigo;
    private generateAdicionalCodigo;
    private ensureCatalogoInicialImprentaDigital;
    private ensureCatalogoInicialImpuestos;
    private resolveMotorOrThrow;
    private resolveProductMotorModule;
    private getDefaultMotorConfig;
    private mergeMotorConfig;
    private getEffectiveMotorConfig;
    private resolveRutaEfectivaId;
    private normalizePeriodo;
    private findVarianteCompletaOrThrow;
    private findProcesoConOperacionesOrThrow;
    private resolvePapelDimensionesMm;
    private normalizeToMm;
    private resolveMachineMarginsMm;
    private resolveImposicionMachineMargins;
    private calculateImposicion;
    private resolvePliegoImpresion;
    private calculateSustratoToPliegoConversion;
    private approxEqualMm;
    private calculateGuillotinaCutsFromImposicion;
    private calculateTerminatingOperationTiming;
    private calculateLaminadoraFilmConsumables;
    private asObject;
    private decimalToNumber;
    private toCanonicalUnitCode;
    private resolveMateriaPrimaVariantUnitCost;
    private enumToApiValue;
    private getProcesoOperacionNiveles;
    private toSafeNumber;
    private resolveChecklistCantidadObjetivo;
    private buildChecklistNivelResumen;
    private getChecklistPasoPlantillasMap;
    private getChecklistPasoPlantillaId;
    private resolveChecklistPasoPlantilla;
    private buildChecklistOperacionFromPlantilla;
    private buildChecklistOperacionFromPlantillaConPerfil;
    private getPasoPlantillaIdFromDetalle;
    private resolvePasoPlantillaIdFromOperacionRuta;
    private normalizePasoNombreBase;
    private buildOperacionesCotizadasOrdenadas;
    private buildChecklistPasoSignature;
    private isPasoPlantillaEligibleForMatchingBase;
    private getChecklistVariantePasoId;
    private getChecklistVariantePasoNombre;
    private getChecklistVariantePasoResumen;
    private getChecklistAtributoTecnicoDimension;
    private getChecklistAtributoTecnicoValor;
    private toPrismaUnidadProceso;
    private calculateMachineConsumables;
    private normalizeColor;
    private validateGranFormatoVarianteRelations;
    private validateGranFormatoConfigPayload;
    private isGranFormatoMachineCompatible;
    private buildGranFormatoVarianteDetalle;
    private deriveGranFormatoTecnologia;
    private normalizeGranFormatoTecnologias;
    private normalizeGranFormatoTecnologia;
    private deriveGranFormatoConfiguracionTintas;
    private normalizeGranFormatoTintas;
    private getSetupFromPerfilOperativo;
    private groupOpcionesProductivas;
    private resolveEffectiveOptionValues;
    private isAddonEffectScopeMatch;
    private assertScopeDimensionMatchesValue;
    private toDimensionOpcionProductiva;
    private fromDimensionOpcionProductiva;
    private toValorOpcionProductiva;
    private fromValorOpcionProductiva;
    private toValorFromTipoImpresion;
    private toValorFromCaras;
    private toTipoImpresionFromValor;
    private toCarasFromValor;
    private toTipoAdicionalEfecto;
    private fromTipoAdicionalEfecto;
    private toReglaCostoAdicionalEfecto;
    private fromReglaCostoAdicionalEfecto;
    private toTipoChecklistPregunta;
    private fromTipoChecklistPregunta;
    private toTipoChecklistAccion;
    private fromTipoChecklistAccion;
    private toReglaCostoChecklist;
    private fromReglaCostoChecklist;
    private toTipoImpresion;
    private fromTipoImpresion;
    private toCaras;
    private fromCaras;
    private toTipoProducto;
    private fromTipoProducto;
    private toEstadoProducto;
    private fromEstadoProducto;
    private toNullableJson;
    private toTipoAdicional;
    private fromTipoAdicional;
    private toMetodoCostoAdicional;
    private fromMetodoCostoAdicional;
    private toTipoConsumoAdicionalMaterial;
    private fromTipoConsumoAdicionalMaterial;
    private handleWriteError;
}
export {};
