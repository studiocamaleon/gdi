"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
let AuthService = class AuthService {
    prisma;
    jwtService;
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async login(payload) {
        const user = await this.prisma.user.findUnique({
            where: { email: payload.email.trim().toLowerCase() },
            include: {
                memberships: {
                    where: {
                        activa: true,
                        tenant: {
                            activo: true,
                        },
                    },
                    include: {
                        tenant: true,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
            },
        });
        if (!user?.passwordHash || !user.activo) {
            throw new common_1.UnauthorizedException('Credenciales invalidas.');
        }
        const isPasswordValid = await bcrypt.compare(payload.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Credenciales invalidas.');
        }
        const membership = user.memberships[0];
        if (!membership) {
            throw new common_1.UnauthorizedException('El usuario no tiene empresas activas.');
        }
        return this.createSessionResponse(user.id, user.email, membership, this.prisma, user.nombreCompleto ?? null);
    }
    async logout(auth) {
        await this.prisma.authSession.update({
            where: { id: auth.sessionId },
            data: { revokedAt: new Date() },
        });
    }
    async getInvitation(token) {
        const invitation = await this.findInvitationOrThrow(token);
        return {
            email: invitation.email,
            tenantNombre: invitation.tenant.nombre,
            rol: this.fromPrismaRol(invitation.rol),
            requiresPasswordSetup: !invitation.user?.passwordHash,
        };
    }
    async acceptInvitation(token, payload) {
        const invitation = await this.findInvitationOrThrow(token);
        const normalizedEmail = invitation.email.trim().toLowerCase();
        return this.prisma.$transaction(async (tx) => {
            let user = invitation.user ??
                (await tx.user.findUnique({
                    where: { email: normalizedEmail },
                }));
            if (!user) {
                if (!payload.password) {
                    throw new common_1.BadRequestException('Debes definir una clave para activar el acceso.');
                }
                user = await tx.user.create({
                    data: {
                        email: normalizedEmail,
                        passwordHash: await bcrypt.hash(payload.password, 10),
                        activo: true,
                    },
                });
            }
            else if (!user.passwordHash) {
                if (!payload.password) {
                    throw new common_1.BadRequestException('Debes definir una clave para activar el acceso.');
                }
                user = await tx.user.update({
                    where: { id: user.id },
                    data: {
                        passwordHash: await bcrypt.hash(payload.password, 10),
                    },
                });
            }
            const membership = await tx.membership.upsert({
                where: {
                    userId_tenantId: {
                        userId: user.id,
                        tenantId: invitation.tenantId,
                    },
                },
                update: {
                    rol: invitation.rol,
                    activa: true,
                },
                create: {
                    userId: user.id,
                    tenantId: invitation.tenantId,
                    rol: invitation.rol,
                    activa: true,
                },
                include: {
                    tenant: true,
                },
            });
            if (invitation.empleadoId) {
                await tx.empleado.update({
                    where: { id: invitation.empleadoId },
                    data: { userId: user.id },
                });
            }
            await tx.invitation.update({
                where: { id: invitation.id },
                data: {
                    userId: user.id,
                    acceptedAt: new Date(),
                },
            });
            return this.createSessionResponse(user.id, user.email, membership, tx, user.nombreCompleto ?? null);
        });
    }
    async getCurrentContext(auth) {
        const user = await this.prisma.user.findUnique({
            where: { id: auth.userId },
            include: {
                memberships: {
                    where: {
                        activa: true,
                        tenant: {
                            activo: true,
                        },
                    },
                    include: {
                        tenant: true,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
            },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Usuario no encontrado.');
        }
        const currentMembership = user.memberships.find((membership) => membership.id === auth.membershipId);
        if (!currentMembership) {
            throw new common_1.UnauthorizedException('La empresa seleccionada ya no esta disponible.');
        }
        return this.buildAuthResponse(auth.sessionId, user.id, user.email, user.nombreCompleto ?? null, currentMembership, user.memberships, null);
    }
    async switchTenant(auth, tenantId) {
        const membership = await this.prisma.membership.findUnique({
            where: {
                userId_tenantId: {
                    userId: auth.userId,
                    tenantId,
                },
            },
            include: {
                tenant: true,
            },
        });
        if (!membership?.activa || !membership.tenant.activo) {
            throw new common_1.NotFoundException('No tienes acceso a esa empresa.');
        }
        await this.prisma.authSession.update({
            where: { id: auth.sessionId },
            data: {
                currentTenantId: membership.tenantId,
                currentMembershipId: membership.id,
            },
        });
        const allMemberships = await this.prisma.membership.findMany({
            where: {
                userId: auth.userId,
                activa: true,
                tenant: {
                    activo: true,
                },
            },
            include: {
                tenant: true,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
        const token = await this.issueToken({
            sub: auth.userId,
            sessionId: auth.sessionId,
            tenantId: membership.tenantId,
            membershipId: membership.id,
            role: membership.rol,
            email: auth.email,
        });
        const user = await this.prisma.user.findUnique({
            where: { id: auth.userId },
            select: { nombreCompleto: true },
        });
        return this.buildAuthResponse(auth.sessionId, auth.userId, auth.email, user?.nombreCompleto ?? null, membership, allMemberships, token);
    }
    async provisionEmployeeAccess(auth, empleadoId, email, rol) {
        const empleado = await this.prisma.empleado.findFirst({
            where: {
                id: empleadoId,
                tenantId: auth.tenantId,
            },
        });
        if (!empleado) {
            throw new common_1.NotFoundException(`No existe el empleado ${empleadoId}`);
        }
        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        const membership = existingUser
            ? await this.prisma.membership.findUnique({
                where: {
                    userId_tenantId: {
                        userId: existingUser.id,
                        tenantId: auth.tenantId,
                    },
                },
            })
            : null;
        if (membership?.activa &&
            membership.rol === rol &&
            empleado.userId === existingUser?.id) {
            return {
                invitationState: 'active',
                invitationUrl: null,
            };
        }
        const rawToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const tokenHash = this.hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
        const invitation = await this.prisma.$transaction(async (tx) => {
            const user = existingUser ??
                (await tx.user.create({
                    data: {
                        email: normalizedEmail,
                        activo: true,
                    },
                }));
            await tx.membership.upsert({
                where: {
                    userId_tenantId: {
                        userId: user.id,
                        tenantId: auth.tenantId,
                    },
                },
                update: {
                    rol,
                    activa: true,
                },
                create: {
                    userId: user.id,
                    tenantId: auth.tenantId,
                    rol,
                    activa: true,
                },
            });
            await tx.empleado.update({
                where: { id: empleadoId },
                data: {
                    userId: user.id,
                },
            });
            await tx.invitation.updateMany({
                where: {
                    tenantId: auth.tenantId,
                    empleadoId,
                    acceptedAt: null,
                    revokedAt: null,
                },
                data: {
                    revokedAt: new Date(),
                },
            });
            return tx.invitation.create({
                data: {
                    tenantId: auth.tenantId,
                    userId: user.id,
                    empleadoId,
                    invitedByMembershipId: auth.membershipId,
                    email: normalizedEmail,
                    rol,
                    tokenHash,
                    expiresAt,
                },
            });
        });
        const invitationUrl = `${process.env.FRONTEND_URL?.split(',')[0]?.trim() ?? 'http://localhost:3000'}/aceptar-invitacion?token=${rawToken}`;
        console.info(`[gdi-auth] Invitacion creada para ${normalizedEmail} (${invitation.id}): ${invitationUrl}`);
        return {
            invitationState: existingUser?.passwordHash
                ? 'pending_existing_user'
                : 'pending_setup',
            invitationUrl,
        };
    }
    async revokeEmployeeAccess(auth, empleadoId) {
        const empleado = await this.prisma.empleado.findFirst({
            where: {
                id: empleadoId,
                tenantId: auth.tenantId,
            },
        });
        if (!empleado?.userId) {
            return;
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.membership.updateMany({
                where: {
                    userId: empleado.userId,
                    tenantId: auth.tenantId,
                },
                data: {
                    activa: false,
                },
            });
            await tx.empleado.update({
                where: { id: empleadoId },
                data: {
                    userId: null,
                },
            });
            await tx.invitation.updateMany({
                where: {
                    tenantId: auth.tenantId,
                    empleadoId,
                    acceptedAt: null,
                    revokedAt: null,
                },
                data: {
                    revokedAt: new Date(),
                },
            });
        });
    }
    async createSessionResponse(userId, email, membership, db = this.prisma, nombreCompleto = null) {
        const session = await db.authSession.create({
            data: {
                userId,
                currentTenantId: membership.tenantId,
                currentMembershipId: membership.id,
                expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
            },
        });
        const memberships = await db.membership.findMany({
            where: {
                userId,
                activa: true,
                tenant: {
                    activo: true,
                },
            },
            include: {
                tenant: true,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
        const token = await this.issueToken({
            sub: userId,
            sessionId: session.id,
            tenantId: membership.tenantId,
            membershipId: membership.id,
            role: membership.rol,
            email,
        });
        return this.buildAuthResponse(session.id, userId, email, nombreCompleto, membership, memberships, token);
    }
    async issueToken(payload) {
        return this.jwtService.signAsync(payload, {
            secret: process.env.JWT_SECRET ?? 'gdi-dev-secret',
            expiresIn: '7d',
        });
    }
    async findInvitationOrThrow(token) {
        const invitation = await this.prisma.invitation.findUnique({
            where: {
                tokenHash: this.hashToken(token),
            },
            include: {
                tenant: true,
                user: true,
            },
        });
        if (!invitation ||
            invitation.revokedAt ||
            invitation.expiresAt <= new Date()) {
            throw new common_1.NotFoundException('La invitacion no existe o expiro.');
        }
        if (invitation.acceptedAt) {
            throw new common_1.BadRequestException('La invitacion ya fue utilizada.');
        }
        return invitation;
    }
    buildAuthResponse(sessionId, userId, email, nombreCompleto, currentMembership, memberships, accessToken) {
        return {
            accessToken,
            sessionId,
            currentUser: {
                id: userId,
                email,
                nombreCompleto,
                tenantActual: {
                    id: currentMembership.tenant.id,
                    nombre: currentMembership.tenant.nombre,
                    slug: currentMembership.tenant.slug,
                    rol: this.fromPrismaRol(currentMembership.rol),
                },
                tenants: memberships.map((membership) => ({
                    id: membership.tenant.id,
                    nombre: membership.tenant.nombre,
                    slug: membership.tenant.slug,
                    rol: this.fromPrismaRol(membership.rol),
                })),
            },
        };
    }
    hashToken(token) {
        return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
    }
    fromPrismaRol(rol) {
        const mapping = {
            [client_1.RolSistema.ADMINISTRADOR]: 'administrador',
            [client_1.RolSistema.SUPERVISOR]: 'supervisor',
            [client_1.RolSistema.OPERADOR]: 'operador',
        };
        return mapping[rol];
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map