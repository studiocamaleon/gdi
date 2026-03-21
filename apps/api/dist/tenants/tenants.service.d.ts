import { AuthService } from '../auth/auth.service';
import { CurrentAuth } from '../auth/auth.types';
export declare class TenantsService {
    private readonly authService;
    constructor(authService: AuthService);
    getCurrent(auth: CurrentAuth): Promise<{
        accessToken: string | null;
        sessionId: string;
        currentUser: {
            id: string;
            email: string;
            nombreCompleto: string | null;
            tenantActual: {
                id: string;
                nombre: string;
                slug: string;
                rol: "administrador" | "supervisor" | "operador";
            };
            tenants: {
                id: string;
                nombre: string;
                slug: string;
                rol: "administrador" | "supervisor" | "operador";
            }[];
        };
    }>;
    switchTenant(auth: CurrentAuth, tenantId: string): Promise<{
        accessToken: string | null;
        sessionId: string;
        currentUser: {
            id: string;
            email: string;
            nombreCompleto: string | null;
            tenantActual: {
                id: string;
                nombre: string;
                slug: string;
                rol: "administrador" | "supervisor" | "operador";
            };
            tenants: {
                id: string;
                nombre: string;
                slug: string;
                rol: "administrador" | "supervisor" | "operador";
            }[];
        };
    }>;
}
