import type { CurrentAuth } from '../auth/auth.types';
import { AssignProductoVariantesRutaMasivaDto, AssignProductoMotorDto, AssignVarianteRutaDto, CotizarProductoVarianteDto, CreateProductoVarianteDto, PreviewImposicionProductoVarianteDto, UpdateProductoRutaPolicyDto, UpsertProductoMotorConfigDto, UpsertVarianteMotorOverrideDto, UpdateProductoVarianteDto, UpsertFamiliaProductoDto, UpsertProductoServicioDto, UpsertSubfamiliaProductoDto } from './dto/productos-servicios.dto';
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
        createdAt: string;
        updatedAt: string;
    }[]>;
    getProducto(auth: CurrentAuth, id: string): Promise<{
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
        createdAt: string;
        updatedAt: string;
    }>;
    createProducto(auth: CurrentAuth, payload: UpsertProductoServicioDto): Promise<{
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
        createdAt: string;
        updatedAt: string;
    }>;
    updateProducto(auth: CurrentAuth, id: string, payload: UpsertProductoServicioDto): Promise<{
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
        createdAt: string;
        updatedAt: string;
    }>;
    assignProductoMotor(auth: CurrentAuth, id: string, payload: AssignProductoMotorDto): Promise<{
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
        procesoDefinicionId: string | null;
        procesoDefinicionCodigo: string;
        procesoDefinicionNombre: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }[]>;
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
        procesoDefinicionId: string | null;
        procesoDefinicionCodigo: string;
        procesoDefinicionNombre: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
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
        tipoImpresion: import("./dto/productos-servicios.dto").TipoImpresionProductoVarianteDto;
        caras: import("./dto/productos-servicios.dto").CarasProductoVarianteDto;
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
