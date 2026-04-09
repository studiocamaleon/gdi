import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertEstacionDto } from './dto/upsert-estacion.dto';
export declare class ProduccionService {
    private readonly prisma;
    constructor(prisma: PrismaService);
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
