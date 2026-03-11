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
exports.CostosService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const prisma_service_1 = require("../prisma/prisma.service");
const upsert_centro_costo_dto_1 = require("./dto/upsert-centro-costo.dto");
const replace_centro_recursos_dto_1 = require("./dto/replace-centro-recursos.dto");
const replace_centro_componentes_costo_dto_1 = require("./dto/replace-centro-componentes-costo.dto");
const DEFAULT_PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
let CostosService = class CostosService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findPlantas(auth) {
        const plantas = await this.prisma.planta.findMany({
            where: { tenantId: auth.tenantId },
            orderBy: { nombre: 'asc' },
        });
        return plantas.map((planta) => this.toPlantaResponse(planta));
    }
    async createPlanta(auth, payload) {
        let planta;
        try {
            planta = await this.prisma.planta.create({
                data: {
                    tenantId: auth.tenantId,
                    codigo: payload.codigo.trim().toUpperCase(),
                    nombre: payload.nombre.trim(),
                    descripcion: payload.descripcion?.trim() || null,
                },
            });
        }
        catch (error) {
            this.handleWriteError(error, 'planta');
        }
        return this.toPlantaResponse(planta);
    }
    async updatePlanta(auth, id, payload) {
        await this.findPlantaOrThrow(auth, id);
        let planta;
        try {
            planta = await this.prisma.planta.update({
                where: { id },
                data: {
                    codigo: payload.codigo.trim().toUpperCase(),
                    nombre: payload.nombre.trim(),
                    descripcion: payload.descripcion?.trim() || null,
                },
            });
        }
        catch (error) {
            this.handleWriteError(error, 'planta');
        }
        return this.toPlantaResponse(planta);
    }
    async togglePlanta(auth, id) {
        const planta = await this.findPlantaOrThrow(auth, id);
        return this.prisma.planta.update({
            where: { id },
            data: { activa: !planta.activa },
        });
    }
    async findAreas(auth) {
        const areas = await this.prisma.areaCosto.findMany({
            where: { tenantId: auth.tenantId },
            include: { planta: true },
            orderBy: [{ planta: { nombre: 'asc' } }, { nombre: 'asc' }],
        });
        return areas.map((area) => this.toAreaResponse(area));
    }
    async createArea(auth, payload) {
        await this.findPlantaOrThrow(auth, payload.plantaId);
        let area;
        try {
            area = await this.prisma.areaCosto.create({
                data: {
                    tenantId: auth.tenantId,
                    plantaId: payload.plantaId,
                    codigo: payload.codigo.trim().toUpperCase(),
                    nombre: payload.nombre.trim(),
                    descripcion: payload.descripcion?.trim() || null,
                },
                include: { planta: true },
            });
        }
        catch (error) {
            this.handleWriteError(error, 'area');
        }
        return this.toAreaResponse(area);
    }
    async updateArea(auth, id, payload) {
        await this.findPlantaOrThrow(auth, payload.plantaId);
        await this.findAreaOrThrow(auth, id);
        let area;
        try {
            area = await this.prisma.areaCosto.update({
                where: { id },
                data: {
                    plantaId: payload.plantaId,
                    codigo: payload.codigo.trim().toUpperCase(),
                    nombre: payload.nombre.trim(),
                    descripcion: payload.descripcion?.trim() || null,
                },
                include: { planta: true },
            });
        }
        catch (error) {
            this.handleWriteError(error, 'area');
        }
        return this.toAreaResponse(area);
    }
    async toggleArea(auth, id) {
        const area = await this.findAreaOrThrow(auth, id);
        return this.prisma.areaCosto.update({
            where: { id },
            data: { activa: !area.activa },
        });
    }
    async findCentros(auth) {
        const centros = await this.prisma.centroCosto.findMany({
            where: { tenantId: auth.tenantId },
            include: {
                planta: true,
                areaCosto: true,
                responsableEmpleado: true,
                proveedorDefault: true,
                tarifasPeriodo: {
                    orderBy: [{ periodo: 'desc' }, { createdAt: 'desc' }],
                    take: 8,
                },
            },
            orderBy: [{ nombre: 'asc' }],
        });
        return centros.map((centro) => this.toCentroResponse(centro));
    }
    async createCentro(auth, payload) {
        await this.validateCentroReferences(auth, payload);
        let centro;
        try {
            centro = await this.prisma.centroCosto.create({
                data: this.buildCreateCentroData(auth, payload),
                include: {
                    planta: true,
                    areaCosto: true,
                    responsableEmpleado: true,
                    proveedorDefault: true,
                    tarifasPeriodo: true,
                },
            });
        }
        catch (error) {
            this.handleWriteError(error, 'centro');
        }
        return this.toCentroResponse(centro);
    }
    async updateCentro(auth, id, payload) {
        await this.findCentroOrThrow(auth, id);
        await this.validateCentroReferences(auth, payload);
        let centro;
        try {
            centro = await this.prisma.centroCosto.update({
                where: { id },
                data: this.buildUpdateCentroData(payload),
                include: {
                    planta: true,
                    areaCosto: true,
                    responsableEmpleado: true,
                    proveedorDefault: true,
                    tarifasPeriodo: true,
                },
            });
        }
        catch (error) {
            this.handleWriteError(error, 'centro');
        }
        return this.toCentroResponse(centro);
    }
    async toggleCentro(auth, id) {
        const centro = await this.findCentroOrThrow(auth, id);
        return this.prisma.centroCosto.update({
            where: { id },
            data: { activo: !centro.activo },
        });
    }
    async getCentroConfiguracion(auth, id, periodo) {
        const normalizedPeriodo = this.normalizePeriodo(periodo);
        const [centro, empleadosDisponibilidad] = await Promise.all([
            this.getCentroConfiguracionEntity(auth, id, normalizedPeriodo),
            this.buildEmpleadosDisponibilidad(auth, normalizedPeriodo, id),
        ]);
        const tarifaBorrador = centro.tarifasPeriodo.find((tarifa) => tarifa.estado === client_1.EstadoTarifaCentroCostoPeriodo.BORRADOR) ?? null;
        const tarifaPublicada = centro.tarifasPeriodo.find((tarifa) => tarifa.estado === client_1.EstadoTarifaCentroCostoPeriodo.PUBLICADA) ?? null;
        return {
            periodo: normalizedPeriodo,
            centro: this.toCentroResponse(centro),
            recursos: centro.recursos.map((recurso) => this.toRecursoResponse(recurso)),
            componentesCosto: centro.componentesCostoPeriodo.map((componente) => this.toComponenteCostoResponse(componente)),
            capacidad: centro.capacidadesPeriodo[0]
                ? this.toCapacidadResponse(centro.capacidadesPeriodo[0])
                : null,
            tarifaBorrador: tarifaBorrador
                ? this.toTarifaResponse(tarifaBorrador)
                : null,
            tarifaPublicada: tarifaPublicada
                ? this.toTarifaResponse(tarifaPublicada)
                : null,
            advertencias: this.buildAdvertencias(centro, normalizedPeriodo),
            empleadosDisponibilidad,
        };
    }
    async updateCentroConfiguracionBase(auth, id, payload) {
        return this.updateCentro(auth, id, payload);
    }
    async replaceCentroRecursos(auth, id, periodo, payload) {
        const normalizedPeriodo = this.normalizePeriodo(periodo);
        await this.findCentroOrThrow(auth, id);
        await this.validateRecursos(auth, id, normalizedPeriodo, payload.recursos);
        const recursos = await this.prisma.$transaction(async (tx) => {
            await tx.centroCostoRecurso.deleteMany({
                where: {
                    tenantId: auth.tenantId,
                    centroCostoId: id,
                    periodo: normalizedPeriodo,
                },
            });
            if (payload.recursos.length > 0) {
                await tx.centroCostoRecurso.createMany({
                    data: payload.recursos.map((recurso) => ({
                        tenantId: auth.tenantId,
                        centroCostoId: id,
                        periodo: normalizedPeriodo,
                        tipoRecurso: this.toPrismaTipoRecurso(recurso.tipoRecurso),
                        empleadoId: recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.empleado
                            ? (recurso.empleadoId ?? null)
                            : null,
                        proveedorId: recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.proveedor
                            ? (recurso.proveedorId ?? null)
                            : null,
                        nombreManual: recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.maquinaria ||
                            recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.gasto_manual
                            ? recurso.nombreManual?.trim() || null
                            : null,
                        descripcion: recurso.descripcion?.trim() || null,
                        porcentajeAsignacion: recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.empleado &&
                            recurso.porcentajeAsignacion !== undefined
                            ? new client_1.Prisma.Decimal(recurso.porcentajeAsignacion)
                            : null,
                        activo: recurso.activo,
                    })),
                });
            }
            return tx.centroCostoRecurso.findMany({
                where: {
                    tenantId: auth.tenantId,
                    centroCostoId: id,
                    periodo: normalizedPeriodo,
                },
                include: {
                    empleado: true,
                    proveedor: true,
                },
                orderBy: [{ createdAt: 'asc' }],
            });
        });
        return recursos.map((recurso) => this.toRecursoResponse(recurso));
    }
    async replaceCentroComponentesCosto(auth, id, periodo, payload) {
        const normalizedPeriodo = this.normalizePeriodo(periodo);
        await this.findCentroOrThrow(auth, id);
        const componentes = await this.prisma.$transaction(async (tx) => {
            await tx.centroCostoComponenteCostoPeriodo.deleteMany({
                where: {
                    tenantId: auth.tenantId,
                    centroCostoId: id,
                    periodo: normalizedPeriodo,
                },
            });
            if (payload.componentes.length > 0) {
                await tx.centroCostoComponenteCostoPeriodo.createMany({
                    data: payload.componentes.map((componente) => ({
                        tenantId: auth.tenantId,
                        centroCostoId: id,
                        periodo: normalizedPeriodo,
                        categoria: this.toPrismaCategoriaComponente(componente.categoria),
                        nombre: componente.nombre.trim(),
                        origen: this.toPrismaOrigenComponente(componente.origen),
                        importeMensual: new client_1.Prisma.Decimal(componente.importeMensual),
                        notas: componente.notas?.trim() || null,
                        detalleJson: componente.detalle
                            ? componente.detalle
                            : client_1.Prisma.JsonNull,
                    })),
                });
            }
            return tx.centroCostoComponenteCostoPeriodo.findMany({
                where: {
                    tenantId: auth.tenantId,
                    centroCostoId: id,
                    periodo: normalizedPeriodo,
                },
                orderBy: [{ createdAt: 'asc' }],
            });
        });
        return componentes.map((componente) => this.toComponenteCostoResponse(componente));
    }
    async upsertCentroCapacidad(auth, id, periodo, payload) {
        const normalizedPeriodo = this.normalizePeriodo(periodo);
        const centro = await this.findCentroOrThrow(auth, id);
        const capacidad = this.computeCapacidad(payload);
        const result = await this.prisma.centroCostoCapacidadPeriodo.upsert({
            where: {
                tenantId_centroCostoId_periodo: {
                    tenantId: auth.tenantId,
                    centroCostoId: id,
                    periodo: normalizedPeriodo,
                },
            },
            create: {
                tenantId: auth.tenantId,
                centroCostoId: id,
                periodo: normalizedPeriodo,
                unidadBase: centro.unidadBaseFutura,
                diasPorMes: capacidad.diasPorMes,
                horasPorDia: capacidad.horasPorDia,
                porcentajeNoProductivo: capacidad.porcentajeNoProductivo,
                capacidadTeorica: capacidad.capacidadTeorica,
                capacidadPractica: capacidad.capacidadPractica,
                overrideManualCapacidad: capacidad.overrideManualCapacidad,
            },
            update: {
                unidadBase: centro.unidadBaseFutura,
                diasPorMes: capacidad.diasPorMes,
                horasPorDia: capacidad.horasPorDia,
                porcentajeNoProductivo: capacidad.porcentajeNoProductivo,
                capacidadTeorica: capacidad.capacidadTeorica,
                capacidadPractica: capacidad.capacidadPractica,
                overrideManualCapacidad: capacidad.overrideManualCapacidad,
            },
        });
        return this.toCapacidadResponse(result);
    }
    async calcularTarifaCentro(auth, id, periodo) {
        const normalizedPeriodo = this.normalizePeriodo(periodo);
        const snapshot = await this.buildTarifaSnapshot(auth, id, normalizedPeriodo);
        const tarifa = await this.prisma.centroCostoTarifaPeriodo.upsert({
            where: {
                tenantId_centroCostoId_periodo_estado: {
                    tenantId: auth.tenantId,
                    centroCostoId: id,
                    periodo: normalizedPeriodo,
                    estado: client_1.EstadoTarifaCentroCostoPeriodo.BORRADOR,
                },
            },
            create: {
                tenantId: auth.tenantId,
                centroCostoId: id,
                periodo: normalizedPeriodo,
                costoMensualTotal: snapshot.costoMensualTotal,
                capacidadPractica: snapshot.capacidadPractica,
                tarifaCalculada: snapshot.tarifaCalculada,
                estado: client_1.EstadoTarifaCentroCostoPeriodo.BORRADOR,
                resumenJson: snapshot.resumenJson,
            },
            update: {
                costoMensualTotal: snapshot.costoMensualTotal,
                capacidadPractica: snapshot.capacidadPractica,
                tarifaCalculada: snapshot.tarifaCalculada,
                resumenJson: snapshot.resumenJson,
            },
        });
        return {
            tarifaBorrador: this.toTarifaResponse(tarifa),
            advertencias: snapshot.advertencias,
        };
    }
    async publicarTarifaCentro(auth, id, periodo) {
        const normalizedPeriodo = this.normalizePeriodo(periodo);
        const snapshot = await this.buildTarifaSnapshot(auth, id, normalizedPeriodo);
        if (!snapshot.validaParaPublicar) {
            throw new common_1.BadRequestException(snapshot.advertencias.join(' '));
        }
        await this.prisma.centroCostoTarifaPeriodo.upsert({
            where: {
                tenantId_centroCostoId_periodo_estado: {
                    tenantId: auth.tenantId,
                    centroCostoId: id,
                    periodo: normalizedPeriodo,
                    estado: client_1.EstadoTarifaCentroCostoPeriodo.BORRADOR,
                },
            },
            create: {
                tenantId: auth.tenantId,
                centroCostoId: id,
                periodo: normalizedPeriodo,
                costoMensualTotal: snapshot.costoMensualTotal,
                capacidadPractica: snapshot.capacidadPractica,
                tarifaCalculada: snapshot.tarifaCalculada,
                estado: client_1.EstadoTarifaCentroCostoPeriodo.BORRADOR,
                resumenJson: snapshot.resumenJson,
            },
            update: {
                costoMensualTotal: snapshot.costoMensualTotal,
                capacidadPractica: snapshot.capacidadPractica,
                tarifaCalculada: snapshot.tarifaCalculada,
                resumenJson: snapshot.resumenJson,
            },
        });
        const publicada = await this.prisma.centroCostoTarifaPeriodo.upsert({
            where: {
                tenantId_centroCostoId_periodo_estado: {
                    tenantId: auth.tenantId,
                    centroCostoId: id,
                    periodo: normalizedPeriodo,
                    estado: client_1.EstadoTarifaCentroCostoPeriodo.PUBLICADA,
                },
            },
            create: {
                tenantId: auth.tenantId,
                centroCostoId: id,
                periodo: normalizedPeriodo,
                costoMensualTotal: snapshot.costoMensualTotal,
                capacidadPractica: snapshot.capacidadPractica,
                tarifaCalculada: snapshot.tarifaCalculada,
                estado: client_1.EstadoTarifaCentroCostoPeriodo.PUBLICADA,
                resumenJson: snapshot.resumenJson,
            },
            update: {
                costoMensualTotal: snapshot.costoMensualTotal,
                capacidadPractica: snapshot.capacidadPractica,
                tarifaCalculada: snapshot.tarifaCalculada,
                resumenJson: snapshot.resumenJson,
            },
        });
        return this.toTarifaResponse(publicada);
    }
    async getCentroTarifas(auth, id) {
        await this.findCentroOrThrow(auth, id);
        const tarifas = await this.prisma.centroCostoTarifaPeriodo.findMany({
            where: {
                tenantId: auth.tenantId,
                centroCostoId: id,
            },
            orderBy: [{ periodo: 'desc' }, { createdAt: 'desc' }],
        });
        return tarifas.map((tarifa) => this.toTarifaResponse(tarifa));
    }
    async buildTarifaSnapshot(auth, centroCostoId, periodo) {
        const centro = await this.getCentroConfiguracionEntity(auth, centroCostoId, periodo);
        const advertencias = this.buildAdvertencias(centro, periodo);
        const costoMensualTotal = centro.componentesCostoPeriodo.reduce((acc, item) => acc.plus(item.importeMensual), new client_1.Prisma.Decimal(0));
        const capacidadPractica = centro.capacidadesPeriodo[0]?.capacidadPractica ?? new client_1.Prisma.Decimal(0);
        const tarifaCalculada = costoMensualTotal.gt(0) && capacidadPractica.gt(0)
            ? costoMensualTotal.div(capacidadPractica)
            : new client_1.Prisma.Decimal(0);
        const tieneProveedorVigente = Boolean(centro.proveedorDefaultId) ||
            centro.recursos.some((recurso) => recurso.tipoRecurso === client_1.TipoRecursoCentroCosto.PROVEEDOR &&
                Boolean(recurso.proveedorId) &&
                recurso.activo);
        const validaParaPublicar = costoMensualTotal.gt(0) &&
            capacidadPractica.gt(0) &&
            !(centro.tipoCentro === client_1.TipoCentroCosto.TERCERIZADO &&
                !tieneProveedorVigente);
        return {
            centro,
            periodo,
            costoMensualTotal,
            capacidadPractica,
            tarifaCalculada,
            advertencias,
            validaParaPublicar,
            resumenJson: {
                periodo,
                centroCodigo: centro.codigo,
                centroNombre: centro.nombre,
                unidadBase: this.fromPrismaUnidadBase(centro.unidadBaseFutura),
                costoMensualTotal: this.decimalToNumber(costoMensualTotal),
                capacidadPractica: this.decimalToNumber(capacidadPractica),
                tarifaCalculada: this.decimalToNumber(tarifaCalculada),
                advertencias,
            },
        };
    }
    async getCentroConfiguracionEntity(auth, id, periodo) {
        const centro = await this.prisma.centroCosto.findFirst({
            where: {
                id,
                tenantId: auth.tenantId,
            },
            include: {
                planta: true,
                areaCosto: true,
                responsableEmpleado: true,
                proveedorDefault: true,
                recursos: {
                    where: { periodo },
                    include: {
                        empleado: true,
                        proveedor: true,
                    },
                    orderBy: [{ createdAt: 'asc' }],
                },
                componentesCostoPeriodo: {
                    where: { periodo },
                    orderBy: [{ createdAt: 'asc' }],
                },
                capacidadesPeriodo: {
                    where: { periodo },
                },
                tarifasPeriodo: {
                    where: { periodo },
                    orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
                },
            },
        });
        if (!centro) {
            throw new common_1.NotFoundException(`No existe el centro de costo ${id}`);
        }
        return centro;
    }
    buildAdvertencias(centro, periodo) {
        const advertencias = [];
        const recursosActivos = centro.recursos.filter((recurso) => recurso.activo);
        const costoMensualTotal = centro.componentesCostoPeriodo.reduce((acc, item) => acc.plus(item.importeMensual), new client_1.Prisma.Decimal(0));
        const capacidad = centro.capacidadesPeriodo[0] ?? null;
        const tieneProveedorVigente = Boolean(centro.proveedorDefaultId) ||
            centro.recursos.some((recurso) => recurso.tipoRecurso === client_1.TipoRecursoCentroCosto.PROVEEDOR &&
                Boolean(recurso.proveedorId) &&
                recurso.activo);
        if (centro.unidadBaseFutura === client_1.UnidadBaseCentroCosto.NINGUNA) {
            advertencias.push('Conviene definir como queres medir este centro para que la tarifa sea util despues.');
        }
        if (recursosActivos.length === 0) {
            advertencias.push('Todavia no cargaste que personas, maquinas o apoyos usa este sector para trabajar.');
        }
        if (centro.componentesCostoPeriodo.length === 0) {
            advertencias.push(`Todavia no cargaste costos mensuales para ${periodo}.`);
        }
        if (!costoMensualTotal.gt(0)) {
            advertencias.push('El costo mensual total debe ser mayor a 0 para calcular una tarifa util.');
        }
        if (!capacidad) {
            advertencias.push('Todavia no definiste cuantas horas o unidades reales puede producir este centro por mes.');
        }
        else if (!capacidad.capacidadPractica.gt(0)) {
            advertencias.push('La capacidad practica debe ser mayor a 0 para poder publicar una tarifa.');
        }
        if (centro.tipoCentro === client_1.TipoCentroCosto.TERCERIZADO &&
            !tieneProveedorVigente) {
            advertencias.push('Los centros tercerizados necesitan un proveedor asignado como referencia o recurso activo.');
        }
        return advertencias;
    }
    async buildEmpleadosDisponibilidad(auth, periodo, centroCostoId) {
        const [empleados, asignaciones] = await Promise.all([
            this.prisma.empleado.findMany({
                where: { tenantId: auth.tenantId },
                orderBy: { nombreCompleto: 'asc' },
                select: {
                    id: true,
                    nombreCompleto: true,
                },
            }),
            this.prisma.centroCostoRecurso.findMany({
                where: {
                    tenantId: auth.tenantId,
                    periodo,
                    tipoRecurso: client_1.TipoRecursoCentroCosto.EMPLEADO,
                    activo: true,
                    empleadoId: { not: null },
                },
                include: {
                    centroCosto: {
                        select: {
                            id: true,
                            codigo: true,
                            nombre: true,
                        },
                    },
                },
            }),
        ]);
        const groupedAssignments = new Map();
        for (const asignacion of asignaciones) {
            if (!asignacion.empleadoId) {
                continue;
            }
            const currentAssignments = groupedAssignments.get(asignacion.empleadoId) ?? [];
            currentAssignments.push({
                centroCostoId: asignacion.centroCostoId,
                centroCodigo: asignacion.centroCosto.codigo,
                centroNombre: asignacion.centroCosto.nombre,
                porcentajeAsignacion: Number(asignacion.porcentajeAsignacion?.toFixed(2) ?? 0),
            });
            groupedAssignments.set(asignacion.empleadoId, currentAssignments);
        }
        return empleados.map((empleado) => {
            const asignacionesEmpleado = groupedAssignments.get(empleado.id) ?? [];
            const asignadoEnEsteCentro = asignacionesEmpleado
                .filter((item) => item.centroCostoId === centroCostoId)
                .reduce((total, item) => total + item.porcentajeAsignacion, 0);
            const asignacionesOtrosCentros = asignacionesEmpleado.filter((item) => item.centroCostoId !== centroCostoId);
            const porcentajeAsignadoEnOtrosCentros = asignacionesOtrosCentros.reduce((total, item) => total + item.porcentajeAsignacion, 0);
            return {
                empleadoId: empleado.id,
                empleadoNombre: empleado.nombreCompleto,
                porcentajeAsignadoEnEsteCentro: Number(asignadoEnEsteCentro.toFixed(2)),
                porcentajeAsignadoEnOtrosCentros: Number(porcentajeAsignadoEnOtrosCentros.toFixed(2)),
                porcentajeDisponible: Number(Math.max(0, 100 - porcentajeAsignadoEnOtrosCentros).toFixed(2)),
                asignacionesOtrosCentros,
            };
        });
    }
    computeCapacidad(payload) {
        const diasPorMes = new client_1.Prisma.Decimal(payload.diasPorMes);
        const horasPorDia = new client_1.Prisma.Decimal(payload.horasPorDia);
        const porcentajeNoProductivo = new client_1.Prisma.Decimal(payload.porcentajeNoProductivo);
        const capacidadTeorica = diasPorMes.mul(horasPorDia);
        const overrideManualCapacidad = payload.overrideManualCapacidad === undefined
            ? null
            : new client_1.Prisma.Decimal(payload.overrideManualCapacidad);
        const capacidadPractica = overrideManualCapacidad ??
            capacidadTeorica.mul(new client_1.Prisma.Decimal(1).minus(porcentajeNoProductivo.div(new client_1.Prisma.Decimal(100))));
        return {
            diasPorMes,
            horasPorDia,
            porcentajeNoProductivo,
            capacidadTeorica,
            capacidadPractica,
            overrideManualCapacidad,
        };
    }
    buildCreateCentroData(auth, payload) {
        return {
            tenantId: auth.tenantId,
            plantaId: payload.plantaId,
            areaCostoId: payload.areaCostoId,
            codigo: payload.codigo.trim().toUpperCase(),
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
            tipoCentro: this.toPrismaTipoCentro(payload.tipoCentro),
            categoriaGrafica: this.toPrismaCategoria(payload.categoriaGrafica),
            imputacionPreferida: this.toPrismaImputacion(payload.imputacionPreferida),
            unidadBaseFutura: this.toPrismaUnidadBase(payload.unidadBaseFutura),
            responsableEmpleadoId: payload.responsableEmpleadoId ?? null,
            proveedorDefaultId: payload.proveedorDefaultId ?? null,
            activo: payload.activo,
        };
    }
    buildUpdateCentroData(payload) {
        return {
            plantaId: payload.plantaId,
            areaCostoId: payload.areaCostoId,
            codigo: payload.codigo.trim().toUpperCase(),
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
            tipoCentro: this.toPrismaTipoCentro(payload.tipoCentro),
            categoriaGrafica: this.toPrismaCategoria(payload.categoriaGrafica),
            imputacionPreferida: this.toPrismaImputacion(payload.imputacionPreferida),
            unidadBaseFutura: this.toPrismaUnidadBase(payload.unidadBaseFutura),
            responsableEmpleadoId: payload.responsableEmpleadoId ?? null,
            proveedorDefaultId: payload.proveedorDefaultId ?? null,
            activo: payload.activo,
        };
    }
    async validateCentroReferences(auth, payload) {
        const [planta, area] = await Promise.all([
            this.prisma.planta.findFirst({
                where: { id: payload.plantaId, tenantId: auth.tenantId },
            }),
            this.prisma.areaCosto.findFirst({
                where: { id: payload.areaCostoId, tenantId: auth.tenantId },
            }),
        ]);
        if (!planta) {
            throw new common_1.NotFoundException('La planta no existe.');
        }
        if (!area) {
            throw new common_1.NotFoundException('El area no existe.');
        }
        if (area.plantaId !== planta.id) {
            throw new common_1.BadRequestException('El area no pertenece a la planta seleccionada.');
        }
        if (payload.responsableEmpleadoId) {
            const empleado = await this.prisma.empleado.findFirst({
                where: {
                    id: payload.responsableEmpleadoId,
                    tenantId: auth.tenantId,
                },
            });
            if (!empleado) {
                throw new common_1.NotFoundException('El responsable seleccionado no existe.');
            }
        }
        if (payload.proveedorDefaultId) {
            const proveedor = await this.prisma.proveedor.findFirst({
                where: {
                    id: payload.proveedorDefaultId,
                    tenantId: auth.tenantId,
                },
            });
            if (!proveedor) {
                throw new common_1.NotFoundException('El proveedor seleccionado no existe.');
            }
        }
        if (payload.tipoCentro !== upsert_centro_costo_dto_1.TipoCentroCostoDto.tercerizado &&
            payload.proveedorDefaultId) {
            throw new common_1.BadRequestException('Solo los centros tercerizados pueden tener proveedor por defecto.');
        }
    }
    async validateRecursos(auth, centroCostoId, periodo, recursos) {
        const recursosActivos = recursos.filter((recurso) => recurso.activo);
        const employeeAssignments = new Map();
        const employeeIds = new Set();
        const providerIds = new Set();
        for (const recurso of recursos) {
            if (recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.empleado &&
                !recurso.empleadoId) {
                throw new common_1.BadRequestException('Los recursos de tipo empleado necesitan un empleado asociado.');
            }
            if (recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.proveedor &&
                !recurso.proveedorId) {
                throw new common_1.BadRequestException('Los recursos de tipo proveedor necesitan un proveedor asociado.');
            }
            if ((recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.maquinaria ||
                recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.gasto_manual) &&
                !recurso.nombreManual?.trim()) {
                throw new common_1.BadRequestException('Las maquinas y gastos manuales necesitan un nombre descriptivo.');
            }
            if (recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.empleado) {
                if (recurso.porcentajeAsignacion === undefined) {
                    throw new common_1.BadRequestException('Cada persona asignada necesita un porcentaje de dedicacion para este mes.');
                }
                if (recurso.porcentajeAsignacion <= 0 ||
                    recurso.porcentajeAsignacion > 100) {
                    throw new common_1.BadRequestException('El porcentaje de dedicacion de una persona debe estar entre 0,01 y 100.');
                }
                if (!recurso.empleadoId) {
                    throw new common_1.BadRequestException('Los recursos de tipo empleado necesitan un empleado asociado.');
                }
                if (employeeAssignments.has(recurso.empleadoId)) {
                    throw new common_1.BadRequestException('No puedes asignar la misma persona dos veces en el mismo centro y mes.');
                }
                employeeAssignments.set(recurso.empleadoId, recurso.activo ? recurso.porcentajeAsignacion : 0);
                employeeIds.add(recurso.empleadoId);
            }
            else if (recurso.porcentajeAsignacion !== undefined) {
                throw new common_1.BadRequestException('Solo las personas pueden llevar porcentaje de dedicacion en esta version.');
            }
            if (recurso.proveedorId) {
                providerIds.add(recurso.proveedorId);
            }
        }
        if (employeeIds.size > 0) {
            const existingEmployees = await this.prisma.empleado.findMany({
                where: {
                    tenantId: auth.tenantId,
                    id: { in: Array.from(employeeIds) },
                },
                select: { id: true },
            });
            const existingEmployeeIds = new Set(existingEmployees.map((item) => item.id));
            for (const empleadoId of employeeIds) {
                if (!existingEmployeeIds.has(empleadoId)) {
                    throw new common_1.NotFoundException('Uno de los empleados asignados no existe en la empresa actual.');
                }
            }
            const allocations = await this.prisma.centroCostoRecurso.groupBy({
                by: ['empleadoId'],
                where: {
                    tenantId: auth.tenantId,
                    periodo,
                    tipoRecurso: client_1.TipoRecursoCentroCosto.EMPLEADO,
                    activo: true,
                    empleadoId: { in: Array.from(employeeIds) },
                    NOT: { centroCostoId },
                },
                _sum: {
                    porcentajeAsignacion: true,
                },
            });
            const allocationMap = new Map(allocations.map((allocation) => [
                allocation.empleadoId ?? '',
                Number(allocation._sum.porcentajeAsignacion?.toFixed(2) ?? 0),
            ]));
            for (const [empleadoId, porcentajeActual] of employeeAssignments) {
                const porcentajeEnOtrosCentros = allocationMap.get(empleadoId) ?? 0;
                if (porcentajeEnOtrosCentros + porcentajeActual > 100) {
                    throw new common_1.BadRequestException(`La persona seleccionada supera el 100% de dedicacion para ${periodo}.`);
                }
            }
        }
        if (providerIds.size > 0) {
            const existingProviders = await this.prisma.proveedor.findMany({
                where: {
                    tenantId: auth.tenantId,
                    id: { in: Array.from(providerIds) },
                },
                select: { id: true },
            });
            const existingProviderIds = new Set(existingProviders.map((item) => item.id));
            for (const proveedorId of providerIds) {
                if (!existingProviderIds.has(proveedorId)) {
                    throw new common_1.NotFoundException('Uno de los proveedores asignados no existe en la empresa actual.');
                }
            }
        }
        if (recursosActivos.length === 0 &&
            recursos.length > 0 &&
            recursos.some((recurso) => recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.empleado)) {
            throw new common_1.BadRequestException('Si asignas personas al centro, al menos una debe quedar activa para el mes.');
        }
    }
    normalizePeriodo(periodo) {
        if (!periodo || !DEFAULT_PERIOD_REGEX.test(periodo)) {
            throw new common_1.BadRequestException('El periodo debe tener formato YYYY-MM.');
        }
        return periodo;
    }
    async findPlantaOrThrow(auth, id, db = this.prisma) {
        const planta = await db.planta.findFirst({
            where: {
                id,
                tenantId: auth.tenantId,
            },
        });
        if (!planta) {
            throw new common_1.NotFoundException(`No existe la planta ${id}`);
        }
        return planta;
    }
    async findAreaOrThrow(auth, id) {
        const area = await this.prisma.areaCosto.findFirst({
            where: {
                id,
                tenantId: auth.tenantId,
            },
            include: { planta: true },
        });
        if (!area) {
            throw new common_1.NotFoundException(`No existe el area ${id}`);
        }
        return area;
    }
    async findCentroOrThrow(auth, id) {
        const centro = await this.prisma.centroCosto.findFirst({
            where: {
                id,
                tenantId: auth.tenantId,
            },
            include: {
                planta: true,
                areaCosto: true,
                responsableEmpleado: true,
                proveedorDefault: true,
                tarifasPeriodo: true,
            },
        });
        if (!centro) {
            throw new common_1.NotFoundException(`No existe el centro de costo ${id}`);
        }
        return centro;
    }
    toPlantaResponse(planta) {
        return {
            id: planta.id,
            codigo: planta.codigo,
            nombre: planta.nombre,
            descripcion: planta.descripcion ?? '',
            activa: planta.activa,
        };
    }
    toAreaResponse(area) {
        return {
            id: area.id,
            plantaId: area.plantaId,
            plantaNombre: area.planta.nombre,
            codigo: area.codigo,
            nombre: area.nombre,
            descripcion: area.descripcion ?? '',
            activa: area.activa,
        };
    }
    toCentroResponse(centro) {
        const tarifas = centro.tarifasPeriodo ?? [];
        const ultimaTarifaPublicada = tarifas.find((tarifa) => tarifa.estado === client_1.EstadoTarifaCentroCostoPeriodo.PUBLICADA);
        const ultimaTarifaBorrador = tarifas.find((tarifa) => tarifa.estado === client_1.EstadoTarifaCentroCostoPeriodo.BORRADOR);
        const estadoConfiguracion = ultimaTarifaPublicada
            ? 'publicado'
            : ultimaTarifaBorrador
                ? 'borrador'
                : 'sin_configurar';
        const ultimoPeriodoConfigurado = ultimaTarifaPublicada?.periodo ?? ultimaTarifaBorrador?.periodo ?? '';
        return {
            id: centro.id,
            plantaId: centro.plantaId,
            plantaNombre: centro.planta.nombre,
            areaCostoId: centro.areaCostoId,
            areaCostoNombre: centro.areaCosto.nombre,
            codigo: centro.codigo,
            nombre: centro.nombre,
            descripcion: centro.descripcion ?? '',
            tipoCentro: this.fromPrismaTipoCentro(centro.tipoCentro),
            categoriaGrafica: this.fromPrismaCategoria(centro.categoriaGrafica),
            imputacionPreferida: this.fromPrismaImputacion(centro.imputacionPreferida),
            unidadBaseFutura: this.fromPrismaUnidadBase(centro.unidadBaseFutura),
            responsableEmpleadoId: centro.responsableEmpleadoId ?? '',
            responsableEmpleadoNombre: centro.responsableEmpleado?.nombreCompleto ?? '',
            proveedorDefaultId: centro.proveedorDefaultId ?? '',
            proveedorDefaultNombre: centro.proveedorDefault?.nombre ?? '',
            activo: centro.activo,
            estadoConfiguracion,
            ultimoPeriodoConfigurado,
            ultimaTarifaPublicada: ultimaTarifaPublicada
                ? this.decimalToNumber(ultimaTarifaPublicada.tarifaCalculada)
                : null,
            unidadTarifaPublicada: ultimaTarifaPublicada
                ? this.fromPrismaUnidadBase(centro.unidadBaseFutura)
                : '',
        };
    }
    toRecursoResponse(recurso) {
        return {
            id: recurso.id,
            periodo: recurso.periodo,
            tipoRecurso: this.fromPrismaTipoRecurso(recurso.tipoRecurso),
            empleadoId: recurso.empleadoId ?? '',
            empleadoNombre: recurso.empleado?.nombreCompleto ?? '',
            proveedorId: recurso.proveedorId ?? '',
            proveedorNombre: recurso.proveedor?.nombre ?? '',
            nombreManual: recurso.nombreManual ?? '',
            descripcion: recurso.descripcion ?? '',
            porcentajeAsignacion: recurso.porcentajeAsignacion
                ? this.decimalToNumber(recurso.porcentajeAsignacion)
                : null,
            activo: recurso.activo,
        };
    }
    toComponenteCostoResponse(componente) {
        return {
            id: componente.id,
            periodo: componente.periodo,
            categoria: this.fromPrismaCategoriaComponente(componente.categoria),
            nombre: componente.nombre,
            origen: this.fromPrismaOrigenComponente(componente.origen),
            importeMensual: this.decimalToNumber(componente.importeMensual),
            notas: componente.notas ?? '',
            detalle: componente.detalleJson ?? null,
        };
    }
    toCapacidadResponse(capacidad) {
        return {
            id: capacidad.id,
            periodo: capacidad.periodo,
            unidadBase: this.fromPrismaUnidadBase(capacidad.unidadBase),
            diasPorMes: this.decimalToNumber(capacidad.diasPorMes),
            horasPorDia: this.decimalToNumber(capacidad.horasPorDia),
            porcentajeNoProductivo: this.decimalToNumber(capacidad.porcentajeNoProductivo),
            capacidadTeorica: this.decimalToNumber(capacidad.capacidadTeorica),
            capacidadPractica: this.decimalToNumber(capacidad.capacidadPractica),
            overrideManualCapacidad: capacidad.overrideManualCapacidad
                ? this.decimalToNumber(capacidad.overrideManualCapacidad)
                : null,
        };
    }
    toTarifaResponse(tarifa) {
        return {
            id: tarifa.id,
            periodo: tarifa.periodo,
            costoMensualTotal: this.decimalToNumber(tarifa.costoMensualTotal),
            capacidadPractica: this.decimalToNumber(tarifa.capacidadPractica),
            tarifaCalculada: this.decimalToNumber(tarifa.tarifaCalculada),
            estado: this.fromPrismaEstadoTarifa(tarifa.estado),
            resumen: tarifa.resumenJson,
            createdAt: tarifa.createdAt.toISOString(),
            updatedAt: tarifa.updatedAt.toISOString(),
        };
    }
    decimalToNumber(value) {
        return Number(value.toFixed(2));
    }
    toPrismaTipoCentro(tipo) {
        const mapping = {
            [upsert_centro_costo_dto_1.TipoCentroCostoDto.productivo]: client_1.TipoCentroCosto.PRODUCTIVO,
            [upsert_centro_costo_dto_1.TipoCentroCostoDto.apoyo]: client_1.TipoCentroCosto.APOYO,
            [upsert_centro_costo_dto_1.TipoCentroCostoDto.administrativo]: client_1.TipoCentroCosto.ADMINISTRATIVO,
            [upsert_centro_costo_dto_1.TipoCentroCostoDto.comercial]: client_1.TipoCentroCosto.COMERCIAL,
            [upsert_centro_costo_dto_1.TipoCentroCostoDto.logistico]: client_1.TipoCentroCosto.LOGISTICO,
            [upsert_centro_costo_dto_1.TipoCentroCostoDto.tercerizado]: client_1.TipoCentroCosto.TERCERIZADO,
        };
        return mapping[tipo];
    }
    fromPrismaTipoCentro(tipo) {
        const mapping = {
            [client_1.TipoCentroCosto.PRODUCTIVO]: upsert_centro_costo_dto_1.TipoCentroCostoDto.productivo,
            [client_1.TipoCentroCosto.APOYO]: upsert_centro_costo_dto_1.TipoCentroCostoDto.apoyo,
            [client_1.TipoCentroCosto.ADMINISTRATIVO]: upsert_centro_costo_dto_1.TipoCentroCostoDto.administrativo,
            [client_1.TipoCentroCosto.COMERCIAL]: upsert_centro_costo_dto_1.TipoCentroCostoDto.comercial,
            [client_1.TipoCentroCosto.LOGISTICO]: upsert_centro_costo_dto_1.TipoCentroCostoDto.logistico,
            [client_1.TipoCentroCosto.TERCERIZADO]: upsert_centro_costo_dto_1.TipoCentroCostoDto.tercerizado,
        };
        return mapping[tipo];
    }
    toPrismaCategoria(categoria) {
        const mapping = {
            [upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.preprensa]: client_1.CategoriaGraficaCentroCosto.PREPRENSA,
            [upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.impresion]: client_1.CategoriaGraficaCentroCosto.IMPRESION,
            [upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.terminacion]: client_1.CategoriaGraficaCentroCosto.TERMINACION,
            [upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.empaque]: client_1.CategoriaGraficaCentroCosto.EMPAQUE,
            [upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.logistica]: client_1.CategoriaGraficaCentroCosto.LOGISTICA,
            [upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.calidad]: client_1.CategoriaGraficaCentroCosto.CALIDAD,
            [upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.mantenimiento]: client_1.CategoriaGraficaCentroCosto.MANTENIMIENTO,
            [upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.administracion]: client_1.CategoriaGraficaCentroCosto.ADMINISTRACION,
            [upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.comercial]: client_1.CategoriaGraficaCentroCosto.COMERCIAL,
            [upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.tercerizado]: client_1.CategoriaGraficaCentroCosto.TERCERIZADO,
        };
        return mapping[categoria];
    }
    fromPrismaCategoria(categoria) {
        const mapping = {
            [client_1.CategoriaGraficaCentroCosto.PREPRENSA]: upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.preprensa,
            [client_1.CategoriaGraficaCentroCosto.IMPRESION]: upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.impresion,
            [client_1.CategoriaGraficaCentroCosto.TERMINACION]: upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.terminacion,
            [client_1.CategoriaGraficaCentroCosto.EMPAQUE]: upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.empaque,
            [client_1.CategoriaGraficaCentroCosto.LOGISTICA]: upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.logistica,
            [client_1.CategoriaGraficaCentroCosto.CALIDAD]: upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.calidad,
            [client_1.CategoriaGraficaCentroCosto.MANTENIMIENTO]: upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.mantenimiento,
            [client_1.CategoriaGraficaCentroCosto.ADMINISTRACION]: upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.administracion,
            [client_1.CategoriaGraficaCentroCosto.COMERCIAL]: upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.comercial,
            [client_1.CategoriaGraficaCentroCosto.TERCERIZADO]: upsert_centro_costo_dto_1.CategoriaGraficaCentroCostoDto.tercerizado,
        };
        return mapping[categoria];
    }
    toPrismaImputacion(imputacion) {
        const mapping = {
            [upsert_centro_costo_dto_1.ImputacionPreferidaCentroCostoDto.directa]: client_1.ImputacionPreferidaCentroCosto.DIRECTA,
            [upsert_centro_costo_dto_1.ImputacionPreferidaCentroCostoDto.indirecta]: client_1.ImputacionPreferidaCentroCosto.INDIRECTA,
            [upsert_centro_costo_dto_1.ImputacionPreferidaCentroCostoDto.reparto]: client_1.ImputacionPreferidaCentroCosto.REPARTO,
        };
        return mapping[imputacion];
    }
    fromPrismaImputacion(imputacion) {
        const mapping = {
            [client_1.ImputacionPreferidaCentroCosto.DIRECTA]: upsert_centro_costo_dto_1.ImputacionPreferidaCentroCostoDto.directa,
            [client_1.ImputacionPreferidaCentroCosto.INDIRECTA]: upsert_centro_costo_dto_1.ImputacionPreferidaCentroCostoDto.indirecta,
            [client_1.ImputacionPreferidaCentroCosto.REPARTO]: upsert_centro_costo_dto_1.ImputacionPreferidaCentroCostoDto.reparto,
        };
        return mapping[imputacion];
    }
    toPrismaUnidadBase(unidad) {
        const mapping = {
            [upsert_centro_costo_dto_1.UnidadBaseCentroCostoDto.ninguna]: client_1.UnidadBaseCentroCosto.NINGUNA,
            [upsert_centro_costo_dto_1.UnidadBaseCentroCostoDto.hora_maquina]: client_1.UnidadBaseCentroCosto.HORA_MAQUINA,
            [upsert_centro_costo_dto_1.UnidadBaseCentroCostoDto.hora_hombre]: client_1.UnidadBaseCentroCosto.HORA_HOMBRE,
            [upsert_centro_costo_dto_1.UnidadBaseCentroCostoDto.pliego]: client_1.UnidadBaseCentroCosto.PLIEGO,
            [upsert_centro_costo_dto_1.UnidadBaseCentroCostoDto.unidad]: client_1.UnidadBaseCentroCosto.UNIDAD,
            [upsert_centro_costo_dto_1.UnidadBaseCentroCostoDto.m2]: client_1.UnidadBaseCentroCosto.M2,
            [upsert_centro_costo_dto_1.UnidadBaseCentroCostoDto.kg]: client_1.UnidadBaseCentroCosto.KG,
        };
        return mapping[unidad];
    }
    fromPrismaUnidadBase(unidad) {
        const mapping = {
            [client_1.UnidadBaseCentroCosto.NINGUNA]: upsert_centro_costo_dto_1.UnidadBaseCentroCostoDto.ninguna,
            [client_1.UnidadBaseCentroCosto.HORA_MAQUINA]: upsert_centro_costo_dto_1.UnidadBaseCentroCostoDto.hora_maquina,
            [client_1.UnidadBaseCentroCosto.HORA_HOMBRE]: upsert_centro_costo_dto_1.UnidadBaseCentroCostoDto.hora_hombre,
            [client_1.UnidadBaseCentroCosto.PLIEGO]: upsert_centro_costo_dto_1.UnidadBaseCentroCostoDto.pliego,
            [client_1.UnidadBaseCentroCosto.UNIDAD]: upsert_centro_costo_dto_1.UnidadBaseCentroCostoDto.unidad,
            [client_1.UnidadBaseCentroCosto.M2]: upsert_centro_costo_dto_1.UnidadBaseCentroCostoDto.m2,
            [client_1.UnidadBaseCentroCosto.KG]: upsert_centro_costo_dto_1.UnidadBaseCentroCostoDto.kg,
        };
        return mapping[unidad];
    }
    toPrismaTipoRecurso(tipo) {
        const mapping = {
            [replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.empleado]: client_1.TipoRecursoCentroCosto.EMPLEADO,
            [replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.maquinaria]: client_1.TipoRecursoCentroCosto.MAQUINARIA,
            [replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.proveedor]: client_1.TipoRecursoCentroCosto.PROVEEDOR,
            [replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.gasto_manual]: client_1.TipoRecursoCentroCosto.GASTO_MANUAL,
        };
        return mapping[tipo];
    }
    fromPrismaTipoRecurso(tipo) {
        const mapping = {
            [client_1.TipoRecursoCentroCosto.EMPLEADO]: replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.empleado,
            [client_1.TipoRecursoCentroCosto.MAQUINARIA]: replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.maquinaria,
            [client_1.TipoRecursoCentroCosto.PROVEEDOR]: replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.proveedor,
            [client_1.TipoRecursoCentroCosto.GASTO_MANUAL]: replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.gasto_manual,
        };
        return mapping[tipo];
    }
    toPrismaCategoriaComponente(categoria) {
        const mapping = {
            [replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.sueldos]: client_1.CategoriaComponenteCostoCentro.SUELDOS,
            [replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.cargas]: client_1.CategoriaComponenteCostoCentro.CARGAS,
            [replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.mantenimiento]: client_1.CategoriaComponenteCostoCentro.MANTENIMIENTO,
            [replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.energia]: client_1.CategoriaComponenteCostoCentro.ENERGIA,
            [replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.alquiler]: client_1.CategoriaComponenteCostoCentro.ALQUILER,
            [replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.amortizacion]: client_1.CategoriaComponenteCostoCentro.AMORTIZACION,
            [replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.tercerizacion]: client_1.CategoriaComponenteCostoCentro.TERCERIZACION,
            [replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.insumos_indirectos]: client_1.CategoriaComponenteCostoCentro.INSUMOS_INDIRECTOS,
            [replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.otros]: client_1.CategoriaComponenteCostoCentro.OTROS,
        };
        return mapping[categoria];
    }
    fromPrismaCategoriaComponente(categoria) {
        const mapping = {
            [client_1.CategoriaComponenteCostoCentro.SUELDOS]: replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.sueldos,
            [client_1.CategoriaComponenteCostoCentro.CARGAS]: replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.cargas,
            [client_1.CategoriaComponenteCostoCentro.MANTENIMIENTO]: replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.mantenimiento,
            [client_1.CategoriaComponenteCostoCentro.ENERGIA]: replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.energia,
            [client_1.CategoriaComponenteCostoCentro.ALQUILER]: replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.alquiler,
            [client_1.CategoriaComponenteCostoCentro.AMORTIZACION]: replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.amortizacion,
            [client_1.CategoriaComponenteCostoCentro.TERCERIZACION]: replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.tercerizacion,
            [client_1.CategoriaComponenteCostoCentro.INSUMOS_INDIRECTOS]: replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.insumos_indirectos,
            [client_1.CategoriaComponenteCostoCentro.OTROS]: replace_centro_componentes_costo_dto_1.CategoriaComponenteCostoCentroDto.otros,
        };
        return mapping[categoria];
    }
    toPrismaOrigenComponente(origen) {
        const mapping = {
            [replace_centro_componentes_costo_dto_1.OrigenComponenteCostoCentroDto.manual]: client_1.OrigenComponenteCostoCentro.MANUAL,
            [replace_centro_componentes_costo_dto_1.OrigenComponenteCostoCentroDto.sugerido]: client_1.OrigenComponenteCostoCentro.SUGERIDO,
        };
        return mapping[origen];
    }
    fromPrismaOrigenComponente(origen) {
        const mapping = {
            [client_1.OrigenComponenteCostoCentro.MANUAL]: replace_centro_componentes_costo_dto_1.OrigenComponenteCostoCentroDto.manual,
            [client_1.OrigenComponenteCostoCentro.SUGERIDO]: replace_centro_componentes_costo_dto_1.OrigenComponenteCostoCentroDto.sugerido,
        };
        return mapping[origen];
    }
    fromPrismaEstadoTarifa(estado) {
        const mapping = {
            [client_1.EstadoTarifaCentroCostoPeriodo.BORRADOR]: 'borrador',
            [client_1.EstadoTarifaCentroCostoPeriodo.PUBLICADA]: 'publicada',
        };
        return mapping[estado];
    }
    handleWriteError(error, entity) {
        if (error instanceof library_1.PrismaClientKnownRequestError &&
            error.code === 'P2002') {
            const messages = {
                planta: 'Ya existe una planta con ese codigo en la empresa actual.',
                area: 'Ya existe un area con ese codigo en la planta seleccionada.',
                centro: 'Ya existe un centro de costo con ese codigo en la empresa actual.',
            };
            throw new common_1.ConflictException(messages[entity]);
        }
        throw error;
    }
};
exports.CostosService = CostosService;
exports.CostosService = CostosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CostosService);
//# sourceMappingURL=costos.service.js.map