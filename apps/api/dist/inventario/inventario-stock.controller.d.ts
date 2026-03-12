import type { CurrentAuth } from '../auth/auth.types';
import { GetKardexQueryDto } from './dto/get-kardex-query.dto';
import { GetStockQueryDto } from './dto/get-stock-query.dto';
import { RegistrarMovimientoStockDto } from './dto/registrar-movimiento-stock.dto';
import { RegistrarTransferenciaStockDto } from './dto/registrar-transferencia-stock.dto';
import { UpsertAlmacenDto } from './dto/upsert-almacen.dto';
import { UpsertUbicacionDto } from './dto/upsert-ubicacion.dto';
import { InventarioService } from './inventario.service';
export declare class InventarioStockController {
    private readonly inventarioService;
    constructor(inventarioService: InventarioService);
    getAlmacenes(auth: CurrentAuth): Promise<{
        id: string;
        codigo: string;
        nombre: string;
        descripcion: string;
        activo: boolean;
        ubicaciones: {
            id: string;
            codigo: string;
            nombre: string;
            descripcion: string;
            activo: boolean;
        }[];
        createdAt: string;
        updatedAt: string;
    }[]>;
    createAlmacen(auth: CurrentAuth, payload: UpsertAlmacenDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        activo: boolean;
        nombre: string;
        tenantId: string;
        descripcion: string | null;
        codigo: string;
    }>;
    updateAlmacen(auth: CurrentAuth, id: string, payload: UpsertAlmacenDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        activo: boolean;
        nombre: string;
        tenantId: string;
        descripcion: string | null;
        codigo: string;
    }>;
    toggleAlmacen(auth: CurrentAuth, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        activo: boolean;
        nombre: string;
        tenantId: string;
        descripcion: string | null;
        codigo: string;
    }>;
    getUbicaciones(auth: CurrentAuth, almacenId: string): Promise<{
        id: string;
        almacenId: string;
        codigo: string;
        nombre: string;
        descripcion: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }[]>;
    createUbicacion(auth: CurrentAuth, almacenId: string, payload: UpsertUbicacionDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        activo: boolean;
        nombre: string;
        tenantId: string;
        descripcion: string | null;
        codigo: string;
        almacenId: string;
    }>;
    updateUbicacion(auth: CurrentAuth, id: string, payload: UpsertUbicacionDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        activo: boolean;
        nombre: string;
        tenantId: string;
        descripcion: string | null;
        codigo: string;
        almacenId: string;
    }>;
    toggleUbicacion(auth: CurrentAuth, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        activo: boolean;
        nombre: string;
        tenantId: string;
        descripcion: string | null;
        codigo: string;
        almacenId: string;
    }>;
    registrarMovimiento(auth: CurrentAuth, payload: RegistrarMovimientoStockDto): Promise<{
        movimientoId: string;
        varianteId: string;
        ubicacionId: string;
        tipo: string;
        origen: string;
        cantidad: number;
        costoUnitario: number | null;
        saldoPosterior: number;
        costoPromedioPost: number;
        referenciaTipo: string | null;
        referenciaId: string | null;
        transferenciaId: string | null;
        notas: string | null;
        createdAt: string;
    }>;
    registrarTransferencia(auth: CurrentAuth, payload: RegistrarTransferenciaStockDto): Promise<{
        transferenciaId: `${string}-${string}-${string}-${string}-${string}`;
        salida: {
            movimientoId: string;
            varianteId: string;
            ubicacionId: string;
            tipo: string;
            origen: string;
            cantidad: number;
            costoUnitario: number | null;
            saldoPosterior: number;
            costoPromedioPost: number;
            referenciaTipo: string | null;
            referenciaId: string | null;
            transferenciaId: string | null;
            notas: string | null;
            createdAt: string;
        };
        entrada: {
            movimientoId: string;
            varianteId: string;
            ubicacionId: string;
            tipo: string;
            origen: string;
            cantidad: number;
            costoUnitario: number | null;
            saldoPosterior: number;
            costoPromedioPost: number;
            referenciaTipo: string | null;
            referenciaId: string | null;
            transferenciaId: string | null;
            notas: string | null;
            createdAt: string;
        };
    }>;
    getStock(auth: CurrentAuth, query: GetStockQueryDto): Promise<{
        id: string;
        varianteId: string;
        varianteSku: string;
        materiaPrimaId: string;
        materiaPrimaNombre: string;
        ubicacionId: string;
        ubicacionNombre: string;
        almacenId: string;
        almacenNombre: string;
        cantidadDisponible: number;
        costoPromedio: number;
        valorStock: number;
        updatedAt: string;
    }[]>;
    getKardex(auth: CurrentAuth, query: GetKardexQueryDto): Promise<{
        items: {
            ubicacionNombre: string;
            movimientoId: string;
            varianteId: string;
            ubicacionId: string;
            tipo: string;
            origen: string;
            cantidad: number;
            costoUnitario: number | null;
            saldoPosterior: number;
            costoPromedioPost: number;
            referenciaTipo: string | null;
            referenciaId: string | null;
            transferenciaId: string | null;
            notas: string | null;
            createdAt: string;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
}
