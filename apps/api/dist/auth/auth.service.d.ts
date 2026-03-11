import { JwtService } from '@nestjs/jwt';
import { RolSistema } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { LoginDto } from './dto/login.dto';
import { CurrentAuth } from './auth.types';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    login(payload: LoginDto): Promise<{
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
    provisionEmployeeAccess(auth: CurrentAuth, empleadoId: string, email: string, rol: RolSistema): Promise<{
        invitationState: string;
        invitationUrl: null;
    } | {
        invitationState: string;
        invitationUrl: string;
    }>;
    revokeEmployeeAccess(auth: CurrentAuth, empleadoId: string): Promise<void>;
    private createSessionResponse;
    private issueToken;
    private findInvitationOrThrow;
    private buildAuthResponse;
    private hashToken;
    private fromPrismaRol;
}
