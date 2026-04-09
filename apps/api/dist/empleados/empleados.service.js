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
exports.EmpleadosService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const auth_service_1 = require("../auth/auth.service");
const pagination_dto_1 = require("../common/dto/pagination.dto");
const prisma_service_1 = require("../prisma/prisma.service");
const comision_dto_1 = require("./dto/comision.dto");
const direccion_dto_1 = require("./dto/direccion.dto");
const upsert_empleado_dto_1 = require("./dto/upsert-empleado.dto");
let EmpleadosService = class EmpleadosService {
    prisma;
    authService;
    constructor(prisma, authService) {
        this.prisma = prisma;
        this.authService = authService;
    }
    async findAll(auth, pagination) {
        const where = { tenantId: auth.tenantId };
        const [empleados, total] = await this.prisma.$transaction([
            this.prisma.empleado.findMany({
                where,
                include: {
                    direcciones: {
                        orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
                    },
                    comisiones: {
                        orderBy: { createdAt: 'asc' },
                    },
                    user: {
                        include: {
                            memberships: {
                                where: { tenantId: auth.tenantId },
                            },
                        },
                    },
                },
                orderBy: { nombreCompleto: 'asc' },
                skip: pagination.skip,
                take: pagination.limit,
            }),
            this.prisma.empleado.count({ where }),
        ]);
        return (0, pagination_dto_1.paginatedResponse)(empleados.map((empleado) => this.toResponse(empleado)), total, pagination);
    }
    async findOne(auth, id) {
        const empleado = await this.findEmpleadoOrThrow(auth, id, this.prisma);
        return this.toResponse(empleado);
    }
    async create(auth, payload) {
        const normalized = this.normalizePayload(payload);
        const empleado = await this.prisma.empleado.create({
            data: {
                tenantId: auth.tenantId,
                nombreCompleto: normalized.nombreCompleto,
                emailPrincipal: normalized.email,
                telefonoCodigo: normalized.telefonoCodigo,
                telefonoNumero: normalized.telefonoNumero,
                sector: normalized.sector,
                ocupacion: normalized.ocupacion,
                sexo: normalized.sexo,
                fechaIngreso: normalized.fechaIngreso,
                fechaNacimiento: normalized.fechaNacimiento,
                comisionesHabilitadas: normalized.comisionesHabilitadas,
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
                comisiones: {
                    create: normalized.comisiones.map((comision) => ({
                        tenantId: auth.tenantId,
                        descripcion: comision.descripcion,
                        tipo: this.toPrismaTipoComision(comision.tipo),
                        valor: new client_1.Prisma.Decimal(comision.valor),
                    })),
                },
            },
            include: {
                direcciones: true,
                comisiones: true,
                user: {
                    include: {
                        memberships: {
                            where: { tenantId: auth.tenantId },
                        },
                    },
                },
            },
        });
        await this.syncAccess(auth, empleado.id, normalized);
        const fresh = await this.findEmpleadoOrThrow(auth, empleado.id, this.prisma);
        return this.toResponse(fresh);
    }
    async update(auth, id, payload) {
        const normalized = this.normalizePayload(payload);
        await this.prisma.$transaction(async (tx) => {
            await this.findEmpleadoOrThrow(auth, id, tx);
            await tx.empleado.update({
                where: { id },
                data: {
                    nombreCompleto: normalized.nombreCompleto,
                    emailPrincipal: normalized.email,
                    telefonoCodigo: normalized.telefonoCodigo,
                    telefonoNumero: normalized.telefonoNumero,
                    sector: normalized.sector,
                    ocupacion: normalized.ocupacion,
                    sexo: normalized.sexo,
                    fechaIngreso: normalized.fechaIngreso,
                    fechaNacimiento: normalized.fechaNacimiento,
                    comisionesHabilitadas: normalized.comisionesHabilitadas,
                },
            });
            await tx.empleadoDireccion.deleteMany({
                where: { empleadoId: id, tenantId: auth.tenantId },
            });
            await tx.empleadoComision.deleteMany({
                where: { empleadoId: id, tenantId: auth.tenantId },
            });
            if (normalized.direcciones.length > 0) {
                await tx.empleadoDireccion.createMany({
                    data: normalized.direcciones.map((direccion) => ({
                        tenantId: auth.tenantId,
                        empleadoId: id,
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
            if (normalized.comisiones.length > 0) {
                await tx.empleadoComision.createMany({
                    data: normalized.comisiones.map((comision) => ({
                        tenantId: auth.tenantId,
                        empleadoId: id,
                        descripcion: comision.descripcion,
                        tipo: this.toPrismaTipoComision(comision.tipo),
                        valor: new client_1.Prisma.Decimal(comision.valor),
                    })),
                });
            }
        });
        await this.syncAccess(auth, id, normalized);
        const empleado = await this.findEmpleadoOrThrow(auth, id, this.prisma);
        return this.toResponse(empleado);
    }
    async invitarAcceso(auth, id, payload) {
        await this.findEmpleadoOrThrow(auth, id, this.prisma);
        return this.authService.provisionEmployeeAccess(auth, id, payload.email, this.toPrismaRol(payload.rolSistema));
    }
    async remove(auth, id) {
        await this.findEmpleadoOrThrow(auth, id, this.prisma);
        await this.authService.revokeEmployeeAccess(auth, id);
        await this.prisma.empleado.delete({
            where: { id },
        });
    }
    async syncAccess(auth, empleadoId, normalized) {
        if (!normalized.usuarioSistema ||
            !normalized.emailAcceso ||
            !normalized.rolSistema) {
            await this.authService.revokeEmployeeAccess(auth, empleadoId);
            return;
        }
        await this.authService.provisionEmployeeAccess(auth, empleadoId, normalized.emailAcceso, normalized.rolSistema);
    }
    async findEmpleadoOrThrow(auth, id, db) {
        const empleado = await db.empleado.findFirst({
            where: {
                id,
                tenantId: auth.tenantId,
            },
            include: {
                direcciones: {
                    orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }],
                },
                comisiones: {
                    orderBy: { createdAt: 'asc' },
                },
                user: {
                    include: {
                        memberships: {
                            where: { tenantId: auth.tenantId },
                        },
                    },
                },
            },
        });
        if (!empleado) {
            throw new common_1.NotFoundException(`No existe el empleado ${id}`);
        }
        return empleado;
    }
    normalizePayload(payload) {
        return {
            ...payload,
            nombreCompleto: payload.nombreCompleto.trim(),
            email: payload.email.trim().toLowerCase(),
            telefonoCodigo: payload.telefonoCodigo.trim(),
            telefonoNumero: payload.telefonoNumero.trim(),
            sector: payload.sector.trim(),
            ocupacion: payload.ocupacion?.trim() || null,
            sexo: payload.sexo ? this.toPrismaSexo(payload.sexo) : null,
            fechaIngreso: new Date(payload.fechaIngreso),
            fechaNacimiento: payload.fechaNacimiento
                ? new Date(payload.fechaNacimiento)
                : null,
            usuarioSistema: payload.usuarioSistema,
            emailAcceso: payload.usuarioSistema
                ? payload.emailAcceso?.trim().toLowerCase() || null
                : null,
            rolSistema: payload.usuarioSistema && payload.rolSistema
                ? this.toPrismaRol(payload.rolSistema)
                : null,
            comisionesHabilitadas: payload.comisionesHabilitadas,
            direcciones: this.normalizeDirecciones(payload.direcciones),
            comisiones: payload.comisionesHabilitadas
                ? this.normalizeComisiones(payload.comisiones)
                : [],
        };
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
    normalizeComisiones(comisiones) {
        return comisiones.map((comision) => ({
            ...comision,
            descripcion: comision.descripcion.trim(),
            valor: comision.valor.trim(),
        }));
    }
    toResponse(empleado) {
        const direccionPrincipal = empleado.direcciones.find((direccion) => direccion.principal) ?? null;
        const membership = empleado.user?.memberships[0] ?? null;
        return {
            id: empleado.id,
            nombreCompleto: empleado.nombreCompleto,
            email: empleado.emailPrincipal,
            telefonoCodigo: empleado.telefonoCodigo,
            telefonoNumero: empleado.telefonoNumero,
            sector: empleado.sector,
            ocupacion: empleado.ocupacion ?? '',
            sexo: empleado.sexo ? this.fromPrismaSexo(empleado.sexo) : '',
            fechaIngreso: this.toDateInput(empleado.fechaIngreso),
            fechaNacimiento: empleado.fechaNacimiento
                ? this.toDateInput(empleado.fechaNacimiento)
                : '',
            usuarioSistema: Boolean(empleado.user && membership?.activa),
            emailAcceso: empleado.user?.email ?? '',
            rolSistema: membership ? this.fromPrismaRol(membership.rol) : '',
            comisionesHabilitadas: empleado.comisionesHabilitadas,
            ciudad: direccionPrincipal?.ciudad ?? '',
            direcciones: empleado.direcciones.map((direccion) => ({
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
            comisiones: empleado.comisiones.map((comision) => ({
                id: comision.id,
                descripcion: comision.descripcion,
                tipo: this.fromPrismaTipoComision(comision.tipo),
                valor: comision.valor.toString(),
            })),
        };
    }
    toDateInput(date) {
        return date.toISOString().slice(0, 10);
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
    toPrismaSexo(sexo) {
        const mapping = {
            [upsert_empleado_dto_1.SexoEmpleadoDto.masculino]: client_1.SexoEmpleado.MASCULINO,
            [upsert_empleado_dto_1.SexoEmpleadoDto.femenino]: client_1.SexoEmpleado.FEMENINO,
            [upsert_empleado_dto_1.SexoEmpleadoDto.no_binario]: client_1.SexoEmpleado.NO_BINARIO,
            [upsert_empleado_dto_1.SexoEmpleadoDto.prefiero_no_decir]: client_1.SexoEmpleado.PREFIERO_NO_DECIR,
        };
        return mapping[sexo];
    }
    fromPrismaSexo(sexo) {
        const mapping = {
            [client_1.SexoEmpleado.MASCULINO]: upsert_empleado_dto_1.SexoEmpleadoDto.masculino,
            [client_1.SexoEmpleado.FEMENINO]: upsert_empleado_dto_1.SexoEmpleadoDto.femenino,
            [client_1.SexoEmpleado.NO_BINARIO]: upsert_empleado_dto_1.SexoEmpleadoDto.no_binario,
            [client_1.SexoEmpleado.PREFIERO_NO_DECIR]: upsert_empleado_dto_1.SexoEmpleadoDto.prefiero_no_decir,
        };
        return mapping[sexo];
    }
    toPrismaRol(rol) {
        const mapping = {
            [upsert_empleado_dto_1.RolSistemaDto.administrador]: client_1.RolSistema.ADMINISTRADOR,
            [upsert_empleado_dto_1.RolSistemaDto.supervisor]: client_1.RolSistema.SUPERVISOR,
            [upsert_empleado_dto_1.RolSistemaDto.operador]: client_1.RolSistema.OPERADOR,
        };
        return mapping[rol];
    }
    fromPrismaRol(rol) {
        const mapping = {
            [client_1.RolSistema.ADMINISTRADOR]: upsert_empleado_dto_1.RolSistemaDto.administrador,
            [client_1.RolSistema.SUPERVISOR]: upsert_empleado_dto_1.RolSistemaDto.supervisor,
            [client_1.RolSistema.OPERADOR]: upsert_empleado_dto_1.RolSistemaDto.operador,
        };
        return mapping[rol];
    }
    toPrismaTipoComision(tipo) {
        const mapping = {
            [comision_dto_1.TipoComisionDto.porcentaje]: client_1.TipoComision.PORCENTAJE,
            [comision_dto_1.TipoComisionDto.fijo]: client_1.TipoComision.FIJO,
        };
        return mapping[tipo];
    }
    fromPrismaTipoComision(tipo) {
        const mapping = {
            [client_1.TipoComision.PORCENTAJE]: comision_dto_1.TipoComisionDto.porcentaje,
            [client_1.TipoComision.FIJO]: comision_dto_1.TipoComisionDto.fijo,
        };
        return mapping[tipo];
    }
};
exports.EmpleadosService = EmpleadosService;
exports.EmpleadosService = EmpleadosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_service_1.AuthService])
], EmpleadosService);
//# sourceMappingURL=empleados.service.js.map