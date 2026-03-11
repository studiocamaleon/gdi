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
exports.ProveedoresService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const direccion_dto_1 = require("./dto/direccion.dto");
let ProveedoresService = class ProveedoresService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(auth) {
        const proveedores = await this.prisma.proveedor.findMany({
            where: {
                tenantId: auth.tenantId,
            },
            include: {
                contactos: {
                    orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
                },
                direcciones: {
                    orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
                },
            },
            orderBy: {
                nombre: 'asc',
            },
        });
        return proveedores.map((proveedor) => this.toResponse(proveedor));
    }
    async findOne(auth, id) {
        const proveedor = await this.findProveedorOrThrow(auth, id, this.prisma);
        return this.toResponse(proveedor);
    }
    async create(auth, payload) {
        const normalized = this.normalizePayload(payload);
        const proveedor = await this.prisma.proveedor.create({
            data: {
                tenantId: auth.tenantId,
                nombre: normalized.nombre,
                razonSocial: normalized.razonSocial,
                emailPrincipal: normalized.email,
                telefonoCodigo: normalized.telefonoCodigo,
                telefonoNumero: normalized.telefonoNumero,
                paisCodigo: normalized.pais,
                contactos: {
                    create: normalized.contactos.map((contacto) => ({
                        tenantId: auth.tenantId,
                        nombre: contacto.nombre,
                        cargo: contacto.cargo,
                        email: contacto.email,
                        telefonoCodigo: contacto.telefonoCodigo,
                        telefonoNumero: contacto.telefonoNumero,
                        principal: contacto.principal,
                    })),
                },
                direcciones: {
                    create: normalized.direcciones.map((direccion) => ({
                        tenantId: auth.tenantId,
                        descripcion: direccion.descripcion,
                        paisCodigo: direccion.pais,
                        codigoPostal: direccion.codigoPostal,
                        direccion: direccion.direccion,
                        numero: direccion.numero,
                        ciudad: direccion.ciudad,
                        tipo: this.toPrismaTipoDireccion(direccion.tipo),
                        principal: direccion.principal,
                    })),
                },
            },
            include: {
                contactos: true,
                direcciones: true,
            },
        });
        return this.toResponse(proveedor);
    }
    async update(auth, id, payload) {
        const normalized = this.normalizePayload(payload);
        return this.prisma.$transaction(async (tx) => {
            await this.findProveedorOrThrow(auth, id, tx);
            await tx.proveedor.update({
                where: { id },
                data: {
                    nombre: normalized.nombre,
                    razonSocial: normalized.razonSocial,
                    emailPrincipal: normalized.email,
                    telefonoCodigo: normalized.telefonoCodigo,
                    telefonoNumero: normalized.telefonoNumero,
                    paisCodigo: normalized.pais,
                },
            });
            await tx.proveedorContacto.deleteMany({
                where: { proveedorId: id, tenantId: auth.tenantId },
            });
            await tx.proveedorDireccion.deleteMany({
                where: { proveedorId: id, tenantId: auth.tenantId },
            });
            if (normalized.contactos.length > 0) {
                await tx.proveedorContacto.createMany({
                    data: normalized.contactos.map((contacto) => ({
                        tenantId: auth.tenantId,
                        proveedorId: id,
                        nombre: contacto.nombre,
                        cargo: contacto.cargo,
                        email: contacto.email,
                        telefonoCodigo: contacto.telefonoCodigo,
                        telefonoNumero: contacto.telefonoNumero,
                        principal: contacto.principal,
                    })),
                });
            }
            if (normalized.direcciones.length > 0) {
                await tx.proveedorDireccion.createMany({
                    data: normalized.direcciones.map((direccion) => ({
                        tenantId: auth.tenantId,
                        proveedorId: id,
                        descripcion: direccion.descripcion,
                        paisCodigo: direccion.pais,
                        codigoPostal: direccion.codigoPostal,
                        direccion: direccion.direccion,
                        numero: direccion.numero,
                        ciudad: direccion.ciudad,
                        tipo: this.toPrismaTipoDireccion(direccion.tipo),
                        principal: direccion.principal,
                    })),
                });
            }
            const proveedor = await this.findProveedorOrThrow(auth, id, tx);
            return this.toResponse(proveedor);
        });
    }
    async remove(auth, id) {
        await this.findProveedorOrThrow(auth, id, this.prisma);
        await this.prisma.proveedor.delete({
            where: { id },
        });
    }
    async findProveedorOrThrow(auth, id, db) {
        const proveedor = await db.proveedor.findFirst({
            where: {
                id,
                tenantId: auth.tenantId,
            },
            include: {
                contactos: {
                    orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
                },
                direcciones: {
                    orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
                },
            },
        });
        if (!proveedor) {
            throw new common_1.NotFoundException(`No existe el proveedor ${id}`);
        }
        return proveedor;
    }
    normalizePayload(payload) {
        return {
            ...payload,
            nombre: payload.nombre.trim(),
            razonSocial: payload.razonSocial?.trim() || null,
            email: payload.email.trim().toLowerCase(),
            pais: payload.pais.trim().toUpperCase(),
            telefonoCodigo: payload.telefonoCodigo.trim(),
            telefonoNumero: payload.telefonoNumero.trim(),
            contactos: this.normalizeContactos(payload.contactos),
            direcciones: this.normalizeDirecciones(payload.direcciones),
        };
    }
    normalizeContactos(contactos) {
        if (contactos.length === 0) {
            return [];
        }
        const base = contactos.map((contacto) => ({
            ...contacto,
            nombre: contacto.nombre.trim(),
            cargo: contacto.cargo?.trim() || null,
            email: contacto.email?.trim().toLowerCase() || null,
            telefonoCodigo: contacto.telefonoCodigo?.trim() || null,
            telefonoNumero: contacto.telefonoNumero?.trim() || null,
            principal: contacto.principal,
        }));
        const principalIndex = base.findIndex((contacto) => contacto.principal);
        return base.map((contacto, index) => ({
            ...contacto,
            principal: principalIndex === -1 ? index === 0 : index === principalIndex,
        }));
    }
    normalizeDirecciones(direcciones) {
        if (direcciones.length === 0) {
            return [];
        }
        const base = direcciones.map((direccion) => ({
            ...direccion,
            descripcion: direccion.descripcion.trim(),
            pais: direccion.pais.trim().toUpperCase(),
            codigoPostal: direccion.codigoPostal?.trim() || null,
            direccion: direccion.direccion.trim(),
            numero: direccion.numero?.trim() || null,
            ciudad: direccion.ciudad.trim(),
            principal: direccion.principal,
        }));
        const principalIndex = base.findIndex((direccion) => direccion.principal);
        return base.map((direccion, index) => ({
            ...direccion,
            principal: principalIndex === -1 ? index === 0 : index === principalIndex,
        }));
    }
    toResponse(proveedor) {
        const contactoPrincipal = proveedor.contactos.find((contacto) => contacto.principal) ?? null;
        const direccionPrincipal = proveedor.direcciones.find((direccion) => direccion.principal) ?? null;
        return {
            id: proveedor.id,
            nombre: proveedor.nombre,
            razonSocial: proveedor.razonSocial ?? '',
            email: proveedor.emailPrincipal,
            telefonoCodigo: proveedor.telefonoCodigo,
            telefonoNumero: proveedor.telefonoNumero,
            pais: proveedor.paisCodigo,
            contacto: contactoPrincipal?.nombre ?? '',
            ciudad: direccionPrincipal?.ciudad ?? '',
            contactos: proveedor.contactos.map((contacto) => ({
                id: contacto.id,
                nombre: contacto.nombre,
                cargo: contacto.cargo ?? '',
                email: contacto.email ?? '',
                telefonoCodigo: contacto.telefonoCodigo ?? '',
                telefonoNumero: contacto.telefonoNumero ?? '',
                principal: contacto.principal,
            })),
            direcciones: proveedor.direcciones.map((direccion) => ({
                id: direccion.id,
                descripcion: direccion.descripcion,
                pais: direccion.paisCodigo,
                codigoPostal: direccion.codigoPostal ?? '',
                direccion: direccion.direccion,
                numero: direccion.numero ?? '',
                ciudad: direccion.ciudad,
                tipo: this.fromPrismaTipoDireccion(direccion.tipo),
                principal: direccion.principal,
            })),
        };
    }
    toPrismaTipoDireccion(tipo) {
        const mapping = {
            [direccion_dto_1.TipoDireccionDto.principal]: client_1.TipoDireccion.PRINCIPAL,
            [direccion_dto_1.TipoDireccionDto.facturacion]: client_1.TipoDireccion.FACTURACION,
            [direccion_dto_1.TipoDireccionDto.entrega]: client_1.TipoDireccion.ENTREGA,
        };
        return mapping[tipo];
    }
    fromPrismaTipoDireccion(tipo) {
        const mapping = {
            [client_1.TipoDireccion.PRINCIPAL]: direccion_dto_1.TipoDireccionDto.principal,
            [client_1.TipoDireccion.FACTURACION]: direccion_dto_1.TipoDireccionDto.facturacion,
            [client_1.TipoDireccion.ENTREGA]: direccion_dto_1.TipoDireccionDto.entrega,
        };
        return mapping[tipo];
    }
};
exports.ProveedoresService = ProveedoresService;
exports.ProveedoresService = ProveedoresService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProveedoresService);
//# sourceMappingURL=proveedores.service.js.map