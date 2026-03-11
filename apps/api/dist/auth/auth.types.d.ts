import { RolSistema } from '@prisma/client';
export type JwtPayload = {
    sub: string;
    sessionId: string;
    tenantId: string;
    membershipId: string;
    role: RolSistema;
    email: string;
};
export type CurrentAuth = {
    userId: string;
    sessionId: string;
    tenantId: string;
    membershipId: string;
    role: RolSistema;
    email: string;
};
