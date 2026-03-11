import { SwitchTenantDto } from '../auth/dto/switch-tenant.dto';
import { TenantsService } from './tenants.service';
import type { CurrentAuth } from '../auth/auth.types';
export declare class TenantsController {
    private readonly tenantsService;
    constructor(tenantsService: TenantsService);
    getCurrent(auth: CurrentAuth): Promise<{
        accessToken: string | null;
        sessionId: string;
        currentUser: {
            id: string;
            email: string;
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
    switchTenant(auth: CurrentAuth, payload: SwitchTenantDto): Promise<{
        accessToken: string | null;
        sessionId: string;
        currentUser: {
            id: string;
            email: string;
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
