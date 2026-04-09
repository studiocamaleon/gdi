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
exports.ProduccionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ProduccionService = class ProduccionService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findEstaciones(auth) {
        const rows = await this.prisma.estacion.findMany({
            where: { tenantId: auth.tenantId },
            orderBy: [{ nombre: 'asc' }],
        });
        return rows.map((item) => ({
            id: item.id,
            nombre: item.nombre,
            descripcion: item.descripcion ?? '',
            activo: item.activo,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        }));
    }
    async createEstacion(auth, payload) {
        try {
            const created = await this.prisma.estacion.create({
                data: {
                    tenantId: auth.tenantId,
                    nombre: payload.nombre.trim(),
                    descripcion: payload.descripcion?.trim() || null,
                    activo: payload.activo ?? true,
                },
            });
            return {
                id: created.id,
                nombre: created.nombre,
                descripcion: created.descripcion ?? '',
                activo: created.activo,
                createdAt: created.createdAt.toISOString(),
                updatedAt: created.updatedAt.toISOString(),
            };
        }
        catch (error) {
            if (error?.code === 'P2002') {
                throw new common_1.ConflictException('Ya existe una estación con ese nombre.');
            }
            throw error;
        }
    }
    async updateEstacion(auth, id, payload) {
        const existing = await this.prisma.estacion.findFirst({
            where: { id, tenantId: auth.tenantId },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Estación no encontrada.');
        }
        try {
            const updated = await this.prisma.estacion.update({
                where: { id },
                data: {
                    nombre: payload.nombre.trim(),
                    descripcion: payload.descripcion?.trim() || null,
                    activo: payload.activo,
                },
            });
            return {
                id: updated.id,
                nombre: updated.nombre,
                descripcion: updated.descripcion ?? '',
                activo: updated.activo,
                createdAt: updated.createdAt.toISOString(),
                updatedAt: updated.updatedAt.toISOString(),
            };
        }
        catch (error) {
            if (error?.code === 'P2002') {
                throw new common_1.ConflictException('Ya existe una estación con ese nombre.');
            }
            throw error;
        }
    }
    async toggleEstacion(auth, id) {
        const existing = await this.prisma.estacion.findFirst({
            where: { id, tenantId: auth.tenantId },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Estación no encontrada.');
        }
        const updated = await this.prisma.estacion.update({
            where: { id },
            data: { activo: !existing.activo },
        });
        return {
            id: updated.id,
            nombre: updated.nombre,
            descripcion: updated.descripcion ?? '',
            activo: updated.activo,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
        };
    }
};
exports.ProduccionService = ProduccionService;
exports.ProduccionService = ProduccionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProduccionService);
//# sourceMappingURL=produccion.service.js.map