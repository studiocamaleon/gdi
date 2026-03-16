import { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AssignProductoVariantesRutaMasivaDto, AssignProductoAdicionalDto, AssignProductoMotorDto, AssignVarianteRutaDto, DimensionOpcionProductivaDto, CarasProductoVarianteDto, ReglaCostoAdicionalEfectoDto, MetodoCostoProductoAdicionalDto, CotizarProductoVarianteDto, CreateProductoVarianteDto, TipoProductoAdicionalEfectoDto, SetVarianteAdicionalRestrictionDto, UpsertProductoAdicionalEfectoDto, TipoConsumoAdicionalMaterialDto, TipoProductoAdicionalDto, UpsertProductoAdicionalServicioPricingDto, UpsertVarianteOpcionesProductivasDto, UpsertProductoAdicionalDto, PreviewImposicionProductoVarianteDto, UpdateProductoRutaPolicyDto, EstadoProductoServicioDto, TipoImpresionProductoVarianteDto, TipoProductoServicioDto, ValorOpcionProductivaDto, UpsertProductoMotorConfigDto, UpsertVarianteMotorOverrideDto, UpdateProductoVarianteDto, UpsertFamiliaProductoDto, UpsertProductoServicioDto, UpsertSubfamiliaProductoDto } from './dto/productos-servicios.dto';
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
    private static readonly MOTOR_DEFAULT;
    private static readonly DEFAULT_A4_AREA_M2;
    private static readonly CANONICAL_PLIEGOS_MM;
    constructor(prisma: PrismaService);
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
        createdAt: string;
        updatedAt: string;
    }[]>;
    findProducto(auth: CurrentAuth, id: string): Promise<{
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
        createdAt: string;
        updatedAt: string;
    }>;
    createProducto(auth: CurrentAuth, payload: UpsertProductoServicioDto): Promise<{
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
        createdAt: string;
        updatedAt: string;
    }>;
    updateProducto(auth: CurrentAuth, id: string, payload: UpsertProductoServicioDto): Promise<{
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
        createdAt: string;
        updatedAt: string;
    }>;
    assignProductoMotor(auth: CurrentAuth, productoId: string, payload: AssignProductoMotorDto): Promise<{
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
        createdAt: string;
        updatedAt: string;
    }>;
    getProductoMotorConfig(auth: CurrentAuth, productoId: string): Promise<{
        productoId: string;
        motorCodigo: "impresion_digital_laser";
        motorVersion: 1;
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
    upsertProductoMotorConfig(auth: CurrentAuth, productoId: string, payload: UpsertProductoMotorConfigDto): Promise<{
        productoId: string;
        motorCodigo: "impresion_digital_laser";
        motorVersion: 1;
        parametros: Prisma.JsonValue;
        versionConfig: number;
        activo: boolean;
        updatedAt: string;
    }>;
    updateProductoRutaPolicy(auth: CurrentAuth, productoId: string, payload: UpdateProductoRutaPolicyDto): Promise<{
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
    getVarianteMotorOverride(auth: CurrentAuth, varianteId: string): Promise<{
        varianteId: string;
        motorCodigo: "impresion_digital_laser";
        motorVersion: 1;
        parametros: string | number | boolean | Prisma.JsonObject | Prisma.JsonArray;
        versionConfig: number;
        activo: boolean;
        updatedAt: string | null;
    }>;
    upsertVarianteMotorOverride(auth: CurrentAuth, varianteId: string, payload: UpsertVarianteMotorOverrideDto): Promise<{
        varianteId: string;
        motorCodigo: "impresion_digital_laser";
        motorVersion: 1;
        parametros: Prisma.JsonValue;
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
            }[];
            materiales: Record<string, unknown>[];
        };
        subtotales: {
            procesos: number;
            papel: number;
            toner: number;
            desgaste: number;
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
            addonsSeleccionados: string[];
            addonsConfig: {
                addonId: string;
                nivelId: string | null;
            }[];
            opcionProductivaEfectiva: {
                dimension: DimensionOpcionProductivaDto;
                valores: ValorOpcionProductivaDto[];
            }[];
            efectosAplicados: {
                id: string;
                addonId: string;
                addonNombre: string;
                tipo: TipoProductoAdicionalEfectoDto;
                nombre: string;
            }[];
            routeEffectsAplicados: {
                id: string;
                addonId: string;
                nombre: string;
                pasos: number;
            }[];
            costEffectsAplicados: {
                id: string;
                addonId: string;
                nombre: string;
                regla: ReglaCostoAdicionalEfectoDto | null;
            }[];
            materialEffectsAplicados: {
                id: string;
                addonId: string;
                nombre: string;
                material: string;
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
    previewVarianteImposicion(auth: CurrentAuth, varianteId: string, payload: PreviewImposicionProductoVarianteDto): Promise<{
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
    private findProductoOrThrow;
    private findVarianteOrThrow;
    private findPapelVarianteOrThrow;
    private findProcesoOrThrow;
    private findCentroCostoOrThrow;
    private findAdicionalCatalogoOrThrow;
    private getAdicionalCatalogoByIdOrThrow;
    private validateAdicionalPayload;
    private getAdicionalEfectoInclude;
    private parseServicioPricing;
    private normalizeServicioPricingPayload;
    private findAdicionalEfectoOrThrow;
    private getAdicionalEfectoByIdOrThrow;
    private validateAdicionalEfectoPayload;
    private resolveAdicionalEfectoNombre;
    private assertSingleAddonEffectTypeConstraint;
    private replaceAdicionalEfectoDetail;
    private toAdicionalEfectoResponse;
    private validateOpcionesProductivasPayload;
    private normalizeOpcionesProductivasPayload;
    private toVarianteOpcionesProductivasResponse;
    private toAdicionalCatalogoResponse;
    private toFamiliaResponse;
    private toSubfamiliaResponse;
    private validateVarianteRelations;
    private toVarianteResponse;
    private generateProductoCodigo;
    private generateAdicionalCodigo;
    private ensureCatalogoInicialImprentaDigital;
    private resolveMotorOrThrow;
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
    private calculateMachineConsumables;
    private normalizeColor;
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
    private toTipoAdicionalEfecto;
    private fromTipoAdicionalEfecto;
    private toReglaCostoAdicionalEfecto;
    private fromReglaCostoAdicionalEfecto;
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
