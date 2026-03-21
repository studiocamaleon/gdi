import { AuthService } from './auth.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { LoginDto } from './dto/login.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import type { CurrentAuth } from './auth.types';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(payload: LoginDto): Promise<{
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
    logout(auth: CurrentAuth): Promise<void>;
    getInvitation(token: string): Promise<{
        email: string;
        tenantNombre: string;
        rol: "administrador" | "supervisor" | "operador";
        requiresPasswordSetup: boolean;
    }>;
    acceptInvitation(token: string, payload: AcceptInvitationDto): Promise<{
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
    getCurrentContext(auth: CurrentAuth): Promise<{
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
    switchTenant(auth: CurrentAuth, payload: SwitchTenantDto): Promise<{
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
