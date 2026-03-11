"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const public_decorator_1 = require("./public.decorator");
let AuthGuard = class AuthGuard {
    reflector;
    jwtService;
    prisma;
    constructor(reflector, jwtService, prisma) {
        this.reflector = reflector;
        this.jwtService = jwtService;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const token = this.extractBearerToken(request.headers.authorization);
        if (!token) {
            throw new common_1.UnauthorizedException('Debes iniciar sesion.');
        }
        let payload;
        try {
            payload = await this.jwtService.verifyAsync(token, {
                secret: process.env.JWT_SECRET ?? 'gdi-dev-secret',
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Sesion invalida.');
        }
        const session = await this.prisma.authSession.findUnique({
            where: { id: payload.sessionId },
            include: {
                user: true,
                currentTenant: true,
                currentMembership: true,
            },
        });
        if (!session ||
            session.revokedAt ||
            session.expiresAt <= new Date() ||
            !session.user.activo ||
            !session.currentTenant.activo ||
            !session.currentMembership.activa ||
            session.userId !== payload.sub ||
            session.currentTenantId !== payload.tenantId ||
            session.currentMembershipId !== payload.membershipId) {
            throw new common_1.UnauthorizedException('Sesion expirada o revocada.');
        }
        request.auth = {
            userId: payload.sub,
            sessionId: payload.sessionId,
            tenantId: payload.tenantId,
            membershipId: payload.membershipId,
            role: payload.role,
            email: payload.email,
        };
        return true;
    }
    extractBearerToken(authorization) {
        if (!authorization) {
            return null;
        }
        const [type, token] = authorization.split(' ');
        if (type !== 'Bearer' || !token) {
            return null;
        }
        return token;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        jwt_1.JwtService,
        prisma_service_1.PrismaService])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map