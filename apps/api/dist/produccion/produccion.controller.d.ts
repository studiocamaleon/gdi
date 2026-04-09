import type { CurrentAuth } from '../auth/auth.types';
import { ProduccionService } from './produccion.service';
import { UpsertEstacionDto } from './dto/upsert-estacion.dto';
export declare class ProduccionController {
    private readonly service;
    constructor(service: ProduccionService);
    findEstaciones(auth: CurrentAuth): Promise<{
        id: string;
        nombre: string;
        descripcion: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }[]>;
    createEstacion(auth: CurrentAuth, payload: UpsertEstacionDto): Promise<{
        id: string;
        nombre: string;
        descripcion: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    updateEstacion(auth: CurrentAuth, id: string, payload: UpsertEstacionDto): Promise<{
        id: string;
        nombre: string;
        descripcion: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
    toggleEstacion(auth: CurrentAuth, id: string): Promise<{
        id: string;
        nombre: string;
        descripcion: string;
        activo: boolean;
        createdAt: string;
        updatedAt: string;
    }>;
}
