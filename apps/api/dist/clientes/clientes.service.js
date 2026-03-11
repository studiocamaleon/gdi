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
exports.ClientesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const direccion_dto_1 = require("./dto/direccion.dto");
let ClientesService = class ClientesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(auth) {
        const clientes = await this.prisma.cliente.findMany({
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
        return clientes.map((cliente) => this.toResponse(cliente));
    }
    async findOne(auth, id) {
        const cliente = await this.findClienteOrThrow(auth, id, this.prisma);
        return this.toResponse(cliente);
    }
    async create(auth, payload) {
        const normalized = this.normalizePayload(payload);
        const cliente = await this.prisma.cliente.create({
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
        return this.toResponse(cliente);
    }
    async update(auth, id, payload) {
        const normalized = this.normalizePayload(payload);
        return this.prisma.$transaction(async (tx) => {
            await this.findClienteOrThrow(auth, id, tx);
            await tx.cliente.update({
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
            await tx.clienteContacto.deleteMany({
                where: { clienteId: id, tenantId: auth.tenantId },
            });
            await tx.clienteDireccion.deleteMany({
                where: { clienteId: id, tenantId: auth.tenantId },
            });
            if (normalized.contactos.length > 0) {
                await tx.clienteContacto.createMany({
                    data: normalized.contactos.map((contacto) => ({
                        tenantId: auth.tenantId,
                        clienteId: id,
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
                await tx.clienteDireccion.createMany({
                    data: normalized.direcciones.map((direccion) => ({
                        tenantId: auth.tenantId,
                        clienteId: id,
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
            const cliente = await this.findClienteOrThrow(auth, id, tx);
            return this.toResponse(cliente);
        });
    }
    async remove(auth, id) {
        await this.findClienteOrThrow(auth, id, this.prisma);
        await this.prisma.cliente.delete({
            where: { id },
        });
    }
    async findClienteOrThrow(auth, id, db) {
        const cliente = await db.cliente.findFirst({
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
        if (!cliente) {
            throw new common_1.NotFoundException(`No existe el cliente ${id}`);
        }
        return cliente;
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
    toResponse(cliente) {
        const contactoPrincipal = cliente.contactos.find((contacto) => contacto.principal) ?? null;
        const direccionPrincipal = cliente.direcciones.find((direccion) => direccion.principal) ?? null;
        return {
            id: cliente.id,
            nombre: cliente.nombre,
            razonSocial: cliente.razonSocial ?? '',
            email: cliente.emailPrincipal,
            telefonoCodigo: cliente.telefonoCodigo,
            telefonoNumero: cliente.telefonoNumero,
            pais: cliente.paisCodigo,
            contacto: contactoPrincipal?.nombre ?? '',
            ciudad: direccionPrincipal?.ciudad ?? '',
            contactos: cliente.contactos.map((contacto) => ({
                id: contacto.id,
                nombre: contacto.nombre,
                cargo: contacto.cargo ?? '',
                email: contacto.email ?? '',
                telefonoCodigo: contacto.telefonoCodigo ?? '',
                telefonoNumero: contacto.telefonoNumero ?? '',
                principal: contacto.principal,
            })),
            direcciones: cliente.direcciones.map((direccion) => ({
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
exports.ClientesService = ClientesService;
exports.ClientesService = ClientesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ClientesService);
//# sourceMappingURL=clientes.service.js.map