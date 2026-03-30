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
                capacidadesPeriodo: {
                    orderBy: [{ periodo: 'desc' }, { createdAt: 'desc' }],
                    take: 1,
                },
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
                    capacidadesPeriodo: true,
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
                    capacidadesPeriodo: true,
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
            recursosMaquinaria: centro.recursos
                .filter((recurso) => recurso.tipoRecurso === client_1.TipoRecursoCentroCosto.MAQUINARIA &&
                Boolean(recurso.maquinaId))
                .map((recurso) => this.toRecursoMaquinariaResponse(recurso.maquinariaPeriodo[0], recurso))
                .filter((item) => Boolean(item)),
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
                        maquinaId: recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.maquinaria
                            ? (recurso.maquinaId ?? null)
                            : null,
                        nombreRecurso: recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.gasto_general ||
                            recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.activo_fijo
                            ? recurso.nombreRecurso?.trim() || null
                            : null,
                        tipoGastoGeneral: recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.gasto_general
                            ? this.toPrismaTipoGastoGeneral(recurso.tipoGastoGeneral)
                            : null,
                        valorMensual: recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.gasto_general
                            ? new client_1.Prisma.Decimal(recurso.valorMensual)
                            : null,
                        vidaUtilRestanteMeses: recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.activo_fijo
                            ? recurso.vidaUtilRestanteMeses
                            : null,
                        valorActual: recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.activo_fijo
                            ? new client_1.Prisma.Decimal(recurso.valorActual)
                            : null,
                        valorFinalVida: recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.activo_fijo
                            ? new client_1.Prisma.Decimal(recurso.valorFinalVida)
                            : null,
                        depreciacionMensualCalc: recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.activo_fijo
                            ? this.computeDepreciacionMensual(recurso.valorActual, recurso.valorFinalVida, recurso.vidaUtilRestanteMeses)
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
                    maquina: true,
                    maquinariaPeriodo: true,
                },
                orderBy: [{ createdAt: 'asc' }],
            });
        });
        return recursos.map((recurso) => this.toRecursoResponse(recurso));
    }
    async getCentroRecursosMaquinaria(auth, id, periodo) {
        const normalizedPeriodo = this.normalizePeriodo(periodo);
        await this.findCentroOrThrow(auth, id);
        const recursos = await this.prisma.centroCostoRecurso.findMany({
            where: {
                tenantId: auth.tenantId,
                centroCostoId: id,
                periodo: normalizedPeriodo,
                tipoRecurso: client_1.TipoRecursoCentroCosto.MAQUINARIA,
                maquinaId: { not: null },
            },
            include: {
                maquina: true,
                maquinariaPeriodo: {
                    where: { periodo: normalizedPeriodo },
                    orderBy: [{ createdAt: 'desc' }],
                    take: 1,
                },
            },
            orderBy: [{ createdAt: 'asc' }],
        });
        return recursos
            .map((recurso) => this.toRecursoMaquinariaResponse(recurso.maquinariaPeriodo[0], recurso))
            .filter((item) => Boolean(item));
    }
    async upsertCentroRecursosMaquinaria(auth, id, periodo, payload) {
        const normalizedPeriodo = this.normalizePeriodo(periodo);
        await this.findCentroOrThrow(auth, id);
        const recursos = await this.prisma.centroCostoRecurso.findMany({
            where: {
                tenantId: auth.tenantId,
                centroCostoId: id,
                periodo: normalizedPeriodo,
                tipoRecurso: client_1.TipoRecursoCentroCosto.MAQUINARIA,
            },
            include: {
                maquina: true,
            },
        });
        const recursoById = new Map(recursos.map((item) => [item.id, item]));
        for (const item of payload.recursos) {
            const recurso = recursoById.get(item.centroCostoRecursoId);
            if (!recurso) {
                throw new common_1.BadRequestException('Uno de los recursos de maquinaria no pertenece al centro/período seleccionado.');
            }
            if (!recurso.maquinaId) {
                throw new common_1.BadRequestException('El recurso de maquinaria debe tener una máquina vinculada antes de cargar costeo.');
            }
        }
        await this.prisma.$transaction(async (tx) => {
            const payloadResourceIds = payload.recursos.map((item) => item.centroCostoRecursoId);
            await tx.centroCostoRecursoMaquinaPeriodo.deleteMany({
                where: {
                    tenantId: auth.tenantId,
                    periodo: normalizedPeriodo,
                    centroCostoRecursoId: {
                        in: Array.from(recursoById.keys()),
                        ...(payloadResourceIds.length > 0
                            ? { notIn: payloadResourceIds }
                            : {}),
                    },
                },
            });
            for (const item of payload.recursos) {
                const recurso = recursoById.get(item.centroCostoRecursoId);
                const calculado = this.computeMaquinariaCosteo(item);
                await tx.centroCostoRecursoMaquinaPeriodo.upsert({
                    where: {
                        tenantId_centroCostoRecursoId_periodo: {
                            tenantId: auth.tenantId,
                            centroCostoRecursoId: recurso.id,
                            periodo: normalizedPeriodo,
                        },
                    },
                    create: {
                        tenantId: auth.tenantId,
                        centroCostoRecursoId: recurso.id,
                        maquinaId: recurso.maquinaId,
                        periodo: normalizedPeriodo,
                        metodoDepreciacion: this.toPrismaMetodoDepreciacionMaquina(item.metodoDepreciacion),
                        valorCompra: calculado.valorCompra,
                        valorResidual: calculado.valorResidual,
                        vidaUtilMeses: calculado.vidaUtilMeses,
                        potenciaNominalKw: calculado.potenciaNominalKw,
                        factorCargaPct: calculado.factorCargaPct,
                        tarifaEnergiaKwh: calculado.tarifaEnergiaKwh,
                        horasProgramadasMes: calculado.horasProgramadasMes,
                        disponibilidadPct: calculado.disponibilidadPct,
                        eficienciaPct: calculado.eficienciaPct,
                        mantenimientoMensual: calculado.mantenimientoMensual,
                        segurosMensual: calculado.segurosMensual,
                        otrosFijosMensual: calculado.otrosFijosMensual,
                        amortizacionMensualCalc: calculado.amortizacionMensual,
                        energiaMensualCalc: calculado.energiaMensual,
                        costoMensualTotalCalc: calculado.costoMensualTotal,
                        tarifaHoraCalc: calculado.tarifaHora,
                    },
                    update: {
                        maquinaId: recurso.maquinaId,
                        metodoDepreciacion: this.toPrismaMetodoDepreciacionMaquina(item.metodoDepreciacion),
                        valorCompra: calculado.valorCompra,
                        valorResidual: calculado.valorResidual,
                        vidaUtilMeses: calculado.vidaUtilMeses,
                        potenciaNominalKw: calculado.potenciaNominalKw,
                        factorCargaPct: calculado.factorCargaPct,
                        tarifaEnergiaKwh: calculado.tarifaEnergiaKwh,
                        horasProgramadasMes: calculado.horasProgramadasMes,
                        disponibilidadPct: calculado.disponibilidadPct,
                        eficienciaPct: calculado.eficienciaPct,
                        mantenimientoMensual: calculado.mantenimientoMensual,
                        segurosMensual: calculado.segurosMensual,
                        otrosFijosMensual: calculado.otrosFijosMensual,
                        amortizacionMensualCalc: calculado.amortizacionMensual,
                        energiaMensualCalc: calculado.energiaMensual,
                        costoMensualTotalCalc: calculado.costoMensualTotal,
                        tarifaHoraCalc: calculado.tarifaHora,
                    },
                });
            }
        });
        return this.getCentroRecursosMaquinaria(auth, id, normalizedPeriodo);
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
        const recursos = await this.prisma.centroCostoRecurso.findMany({
            where: {
                tenantId: auth.tenantId,
                centroCostoId: id,
                periodo: normalizedPeriodo,
                activo: true,
            },
            include: {
                maquinariaPeriodo: {
                    where: { periodo: normalizedPeriodo },
                    orderBy: [{ createdAt: 'desc' }],
                    take: 1,
                },
            },
        });
        const capacidad = this.computeCapacidad(payload, centro.unidadBaseFutura, recursos);
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
                porcentajeNoProductivo: new client_1.Prisma.Decimal(0),
                capacidadTeorica: capacidad.capacidadTeorica,
                capacidadPractica: capacidad.capacidadPractica,
                overrideManualCapacidad: capacidad.overrideManualCapacidad,
            },
            update: {
                unidadBase: centro.unidadBaseFutura,
                diasPorMes: capacidad.diasPorMes,
                horasPorDia: capacidad.horasPorDia,
                porcentajeNoProductivo: new client_1.Prisma.Decimal(0),
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
        if (snapshot.centro.imputacionPreferida ===
            client_1.ImputacionPreferidaCentroCosto.REPARTO) {
            await this.republishTarifasCentrosProductivos(auth, normalizedPeriodo);
        }
        return this.toTarifaResponse(publicada);
    }
    async republishTarifasCentrosProductivos(auth, periodo) {
        const centrosProductivos = await this.prisma.centroCosto.findMany({
            where: {
                tenantId: auth.tenantId,
                activo: true,
                tipoCentro: client_1.TipoCentroCosto.PRODUCTIVO,
            },
            select: { id: true },
        });
        for (const centro of centrosProductivos) {
            const snapshot = await this.buildTarifaSnapshot(auth, centro.id, periodo);
            if (!snapshot.validaParaPublicar) {
                continue;
            }
            await this.prisma.centroCostoTarifaPeriodo.upsert({
                where: {
                    tenantId_centroCostoId_periodo_estado: {
                        tenantId: auth.tenantId,
                        centroCostoId: centro.id,
                        periodo,
                        estado: client_1.EstadoTarifaCentroCostoPeriodo.BORRADOR,
                    },
                },
                create: {
                    tenantId: auth.tenantId,
                    centroCostoId: centro.id,
                    periodo,
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
            await this.prisma.centroCostoTarifaPeriodo.upsert({
                where: {
                    tenantId_centroCostoId_periodo_estado: {
                        tenantId: auth.tenantId,
                        centroCostoId: centro.id,
                        periodo,
                        estado: client_1.EstadoTarifaCentroCostoPeriodo.PUBLICADA,
                    },
                },
                create: {
                    tenantId: auth.tenantId,
                    centroCostoId: centro.id,
                    periodo,
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
        }
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
        const repartoPeriodo = await this.computeRepartoPeriodo(auth, periodo);
        const centro = await this.getCentroConfiguracionEntity(auth, centroCostoId, periodo);
        const advertencias = this.buildAdvertencias(centro, periodo);
        const costoMensualBase = centro.componentesCostoPeriodo.reduce((acc, item) => acc.plus(item.importeMensual), new client_1.Prisma.Decimal(0));
        const costoMensualMaquinaria = centro.recursos
            .filter((recurso) => recurso.activo && recurso.tipoRecurso === client_1.TipoRecursoCentroCosto.MAQUINARIA)
            .reduce((acc, recurso) => acc.plus(recurso.maquinariaPeriodo[0]?.costoMensualTotalCalc ?? 0), new client_1.Prisma.Decimal(0));
        const costoMensualGastosGenerales = centro.recursos
            .filter((recurso) => recurso.activo &&
            recurso.tipoRecurso === client_1.TipoRecursoCentroCosto.GASTO_GENERAL)
            .reduce((acc, recurso) => acc.plus(recurso.valorMensual ?? 0), new client_1.Prisma.Decimal(0));
        const costoMensualActivosFijos = centro.recursos
            .filter((recurso) => recurso.activo && recurso.tipoRecurso === client_1.TipoRecursoCentroCosto.ACTIVO_FIJO)
            .reduce((acc, recurso) => acc.plus(recurso.depreciacionMensualCalc ?? 0), new client_1.Prisma.Decimal(0));
        const costoMensualTotal = costoMensualBase
            .plus(costoMensualMaquinaria)
            .plus(costoMensualGastosGenerales)
            .plus(costoMensualActivosFijos);
        const costoMensualAbsorbidoReparto = repartoPeriodo.absorbidoByCentroId.get(centroCostoId) ??
            new client_1.Prisma.Decimal(0);
        const desgloseRepartoAbsorbido = repartoPeriodo.desgloseByCentroId.get(centroCostoId) ?? [];
        const costoMensualTotalConReparto = costoMensualTotal.plus(costoMensualAbsorbidoReparto);
        const capacidadPractica = centro.capacidadesPeriodo[0]?.capacidadPractica ?? new client_1.Prisma.Decimal(0);
        const tarifaCalculada = costoMensualTotalConReparto.gt(0) && capacidadPractica.gt(0)
            ? costoMensualTotalConReparto.div(capacidadPractica)
            : new client_1.Prisma.Decimal(0);
        const tarifaDirectaSinReparto = costoMensualTotal.gt(0) && capacidadPractica.gt(0)
            ? costoMensualTotal.div(capacidadPractica)
            : new client_1.Prisma.Decimal(0);
        const tarifaAbsorbidaReparto = costoMensualAbsorbidoReparto.gt(0) && capacidadPractica.gt(0)
            ? costoMensualAbsorbidoReparto.div(capacidadPractica)
            : new client_1.Prisma.Decimal(0);
        const validaParaPublicar = costoMensualTotalConReparto.gt(0) && capacidadPractica.gt(0);
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
                costoMensualBase: this.decimalToNumber(costoMensualBase),
                costoMensualMaquinaria: this.decimalToNumber(costoMensualMaquinaria),
                costoMensualGastosGenerales: this.decimalToNumber(costoMensualGastosGenerales),
                costoMensualActivosFijos: this.decimalToNumber(costoMensualActivosFijos),
                costoMensualSinReparto: this.decimalToNumber(costoMensualTotal),
                costoMensualAbsorbidoReparto: this.decimalToNumber(costoMensualAbsorbidoReparto),
                desgloseRepartoAbsorbido,
                costoMensualTotal: this.decimalToNumber(costoMensualTotalConReparto),
                tarifaDirectaSinReparto: this.decimalToNumber(tarifaDirectaSinReparto),
                tarifaAbsorbidaReparto: this.decimalToNumber(tarifaAbsorbidaReparto),
                capacidadPractica: this.decimalToNumber(capacidadPractica),
                tarifaCalculada: this.decimalToNumber(tarifaCalculada),
                advertencias,
            },
        };
    }
    async computeRepartoPeriodo(auth, periodo) {
        const centros = await this.prisma.centroCosto.findMany({
            where: {
                tenantId: auth.tenantId,
                activo: true,
            },
            include: {
                recursos: {
                    where: { periodo, activo: true },
                    include: {
                        maquinariaPeriodo: {
                            where: { periodo },
                            orderBy: [{ createdAt: 'desc' }],
                            take: 1,
                        },
                    },
                },
                componentesCostoPeriodo: {
                    where: { periodo },
                },
                capacidadesPeriodo: {
                    where: { periodo },
                    take: 1,
                },
            },
        });
        const centrosObjetivo = centros.filter((item) => item.tipoCentro === client_1.TipoCentroCosto.PRODUCTIVO);
        if (centrosObjetivo.length === 0) {
            return {
                absorbidoByCentroId: new Map(),
                desgloseByCentroId: new Map(),
            };
        }
        const fuentes = centros
            .filter((item) => item.imputacionPreferida === client_1.ImputacionPreferidaCentroCosto.REPARTO)
            .map((item) => ({
            ...item,
            costoMensualDirecto: this.computeCostoMensualDirectoCentro(item),
        }))
            .filter((item) => item.costoMensualDirecto.gt(0));
        if (fuentes.length === 0) {
            return {
                absorbidoByCentroId: new Map(),
                desgloseByCentroId: new Map(),
            };
        }
        const baseByTarget = new Map();
        for (const target of centrosObjetivo) {
            const capacidad = target.capacidadesPeriodo[0]?.capacidadPractica;
            baseByTarget.set(target.id, capacidad && capacidad.gt(0) ? capacidad : new client_1.Prisma.Decimal(0));
        }
        const totalBase = Array.from(baseByTarget.values()).reduce((acc, value) => acc.plus(value), new client_1.Prisma.Decimal(0));
        const useEqualWeights = !totalBase.gt(0);
        const absorbidoByCentroId = new Map();
        const desgloseByCentroId = new Map();
        for (const fuente of fuentes) {
            const divisor = useEqualWeights
                ? new client_1.Prisma.Decimal(centrosObjetivo.length)
                : totalBase;
            if (!divisor.gt(0)) {
                continue;
            }
            let asignadoAcumulado = new client_1.Prisma.Decimal(0);
            for (let index = 0; index < centrosObjetivo.length; index += 1) {
                const target = centrosObjetivo[index];
                const esUltimo = index === centrosObjetivo.length - 1;
                const peso = useEqualWeights
                    ? new client_1.Prisma.Decimal(1)
                    : baseByTarget.get(target.id) ?? new client_1.Prisma.Decimal(0);
                let monto = esUltimo
                    ? fuente.costoMensualDirecto.minus(asignadoAcumulado)
                    : fuente.costoMensualDirecto.mul(peso).div(divisor);
                if (monto.lt(0)) {
                    monto = new client_1.Prisma.Decimal(0);
                }
                asignadoAcumulado = asignadoAcumulado.plus(monto);
                absorbidoByCentroId.set(target.id, (absorbidoByCentroId.get(target.id) ?? new client_1.Prisma.Decimal(0)).plus(monto));
                const desgloseActual = desgloseByCentroId.get(target.id) ?? [];
                desgloseActual.push({
                    desdeCentroCostoId: fuente.id,
                    desdeCentroCodigo: fuente.codigo,
                    desdeCentroNombre: fuente.nombre,
                    monto: this.decimalToNumber(monto),
                });
                desgloseByCentroId.set(target.id, desgloseActual);
            }
        }
        return {
            absorbidoByCentroId,
            desgloseByCentroId,
        };
    }
    computeCostoMensualDirectoCentro(centro) {
        const costoMensualBase = centro.componentesCostoPeriodo.reduce((acc, item) => acc.plus(item.importeMensual), new client_1.Prisma.Decimal(0));
        const costoMensualMaquinaria = centro.recursos
            .filter((recurso) => recurso.tipoRecurso === client_1.TipoRecursoCentroCosto.MAQUINARIA)
            .reduce((acc, recurso) => acc.plus(recurso.maquinariaPeriodo[0]?.costoMensualTotalCalc ?? 0), new client_1.Prisma.Decimal(0));
        const costoMensualGastosGenerales = centro.recursos
            .filter((recurso) => recurso.tipoRecurso === client_1.TipoRecursoCentroCosto.GASTO_GENERAL)
            .reduce((acc, recurso) => acc.plus(recurso.valorMensual ?? 0), new client_1.Prisma.Decimal(0));
        const costoMensualActivosFijos = centro.recursos
            .filter((recurso) => recurso.tipoRecurso === client_1.TipoRecursoCentroCosto.ACTIVO_FIJO)
            .reduce((acc, recurso) => acc.plus(recurso.depreciacionMensualCalc ?? 0), new client_1.Prisma.Decimal(0));
        return costoMensualBase
            .plus(costoMensualMaquinaria)
            .plus(costoMensualGastosGenerales)
            .plus(costoMensualActivosFijos);
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
                recursos: {
                    where: { periodo },
                    include: {
                        empleado: true,
                        maquina: true,
                        maquinariaPeriodo: {
                            where: { periodo },
                            orderBy: [{ createdAt: 'desc' }],
                            take: 1,
                        },
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
        const costoMensualTotal = this.computeCostoMensualDirectoCentro(centro);
        const capacidad = centro.capacidadesPeriodo[0] ?? null;
        const recursosMaquinariaActivos = centro.recursos.filter((recurso) => recurso.activo && recurso.tipoRecurso === client_1.TipoRecursoCentroCosto.MAQUINARIA);
        if (centro.unidadBaseFutura === client_1.UnidadBaseCentroCosto.NINGUNA) {
            advertencias.push('Conviene definir como queres medir este centro para que la tarifa sea util despues.');
        }
        if (recursosActivos.length === 0) {
            advertencias.push('Todavia no cargaste que personas, maquinas, gastos generales o activos fijos usa este sector para trabajar.');
        }
        if (centro.componentesCostoPeriodo.length === 0) {
            advertencias.push(`Todavia no cargaste costos mensuales para ${periodo}.`);
        }
        if (recursosMaquinariaActivos.some((recurso) => !recurso.maquinariaPeriodo[0])) {
            advertencias.push('Hay maquinaria activa en recursos sin parámetros de amortización/energía para este período.');
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
    computeCapacidad(payload, unidadBase, recursos) {
        const diasPorMes = new client_1.Prisma.Decimal(payload.diasPorMes);
        const horasPorDia = new client_1.Prisma.Decimal(payload.horasPorDia);
        const horasBaseMes = diasPorMes.mul(horasPorDia);
        const capacidadTeorica = horasBaseMes;
        const capacidadHoraMaquina = recursos
            .filter((recurso) => recurso.tipoRecurso === client_1.TipoRecursoCentroCosto.MAQUINARIA)
            .reduce((acc, recurso) => {
            const item = recurso.maquinariaPeriodo[0];
            if (!item) {
                return acc;
            }
            const horasProductivas = item.horasProgramadasMes
                .mul(item.disponibilidadPct)
                .mul(item.eficienciaPct)
                .div(new client_1.Prisma.Decimal(10000));
            return acc.plus(horasProductivas);
        }, new client_1.Prisma.Decimal(0));
        const capacidadHoraHombre = recursos
            .filter((recurso) => recurso.tipoRecurso === client_1.TipoRecursoCentroCosto.EMPLEADO)
            .reduce((acc, recurso) => {
            const porcentaje = recurso.porcentajeAsignacion ?? new client_1.Prisma.Decimal(0);
            return acc.plus(horasBaseMes.mul(porcentaje).div(new client_1.Prisma.Decimal(100)));
        }, new client_1.Prisma.Decimal(0));
        const capacidadAuto = unidadBase === client_1.UnidadBaseCentroCosto.HORA_MAQUINA
            ? capacidadHoraMaquina
            : unidadBase === client_1.UnidadBaseCentroCosto.HORA_HOMBRE
                ? capacidadHoraHombre
                : capacidadTeorica;
        const overrideManualCapacidad = payload.overrideManualCapacidad === undefined
            ? null
            : new client_1.Prisma.Decimal(payload.overrideManualCapacidad);
        const capacidadPractica = overrideManualCapacidad ?? capacidadAuto;
        return {
            diasPorMes,
            horasPorDia,
            capacidadTeorica,
            capacidadPractica,
            overrideManualCapacidad,
        };
    }
    computeDepreciacionMensual(valorActual, valorFinalVida, vidaUtilRestanteMeses) {
        const depreciable = Math.max(0, valorActual - valorFinalVida);
        return new client_1.Prisma.Decimal((depreciable / Math.max(1, vidaUtilRestanteMeses)).toFixed(2));
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
    }
    async validateRecursos(auth, centroCostoId, periodo, recursos) {
        const centro = await this.prisma.centroCosto.findFirst({
            where: { id: centroCostoId, tenantId: auth.tenantId },
            select: { id: true, plantaId: true },
        });
        if (!centro) {
            throw new common_1.NotFoundException(`No existe el centro de costo ${centroCostoId}`);
        }
        const recursosActivos = recursos.filter((recurso) => recurso.activo);
        const employeeAssignments = new Map();
        const employeeIds = new Set();
        const machineIds = new Set();
        const machineAssignments = new Set();
        for (const recurso of recursos) {
            if (recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.empleado &&
                !recurso.empleadoId) {
                throw new common_1.BadRequestException('Los recursos de tipo empleado necesitan un empleado asociado.');
            }
            if (recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.maquinaria &&
                !recurso.maquinaId) {
                throw new common_1.BadRequestException('Los recursos de tipo maquinaria necesitan una máquina asociada.');
            }
            if (recurso.tipoRecurso !== replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.maquinaria &&
                recurso.maquinaId) {
                throw new common_1.BadRequestException('Solo los recursos de tipo maquinaria pueden referenciar una máquina.');
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
            if (recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.gasto_general) {
                if (!recurso.nombreRecurso?.trim()) {
                    throw new common_1.BadRequestException('Los gastos generales necesitan un nombre descriptivo.');
                }
                if (!recurso.tipoGastoGeneral) {
                    throw new common_1.BadRequestException('Los gastos generales necesitan un tipo de gasto.');
                }
                if (recurso.valorMensual === undefined ||
                    recurso.valorMensual < 0) {
                    throw new common_1.BadRequestException('Los gastos generales necesitan un valor mensual mayor o igual a 0.');
                }
            }
            if (recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.activo_fijo) {
                if (!recurso.nombreRecurso?.trim()) {
                    throw new common_1.BadRequestException('Los activos fijos necesitan un nombre descriptivo.');
                }
                if (recurso.vidaUtilRestanteMeses === undefined ||
                    recurso.vidaUtilRestanteMeses < 1) {
                    throw new common_1.BadRequestException('Los activos fijos necesitan vida util restante en meses (minimo 1).');
                }
                if (recurso.valorActual === undefined ||
                    recurso.valorActual < 0 ||
                    recurso.valorFinalVida === undefined ||
                    recurso.valorFinalVida < 0) {
                    throw new common_1.BadRequestException('Los activos fijos necesitan valor actual y valor final de vida validos.');
                }
                if (recurso.valorFinalVida > recurso.valorActual) {
                    throw new common_1.BadRequestException('En activos fijos, el valor final de vida no puede ser mayor al valor actual.');
                }
            }
            if (recurso.tipoRecurso === replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.maquinaria &&
                recurso.maquinaId) {
                if (machineAssignments.has(recurso.maquinaId)) {
                    throw new common_1.BadRequestException('No puedes asignar la misma máquina dos veces en el mismo centro y mes.');
                }
                machineAssignments.add(recurso.maquinaId);
                machineIds.add(recurso.maquinaId);
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
        if (machineIds.size > 0) {
            const machines = await this.prisma.maquina.findMany({
                where: {
                    tenantId: auth.tenantId,
                    id: { in: Array.from(machineIds) },
                },
                select: { id: true, plantaId: true },
            });
            const machinesById = new Map(machines.map((item) => [item.id, item]));
            for (const maquinaId of machineIds) {
                const machine = machinesById.get(maquinaId);
                if (!machine) {
                    throw new common_1.NotFoundException('Una de las máquinas asignadas no existe en la empresa actual.');
                }
                if (machine.plantaId !== centro.plantaId) {
                    throw new common_1.BadRequestException('La máquina asignada al centro debe pertenecer a la misma planta.');
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
                capacidadesPeriodo: true,
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
        const tarifaReferencia = ultimaTarifaPublicada ?? ultimaTarifaBorrador;
        const resumen = tarifaReferencia?.resumenJson ?? null;
        const tarifaDirectaSinReparto = typeof resumen?.tarifaDirectaSinReparto === 'number'
            ? resumen.tarifaDirectaSinReparto
            : null;
        const tarifaAbsorbidaReparto = typeof resumen?.tarifaAbsorbidaReparto === 'number'
            ? resumen.tarifaAbsorbidaReparto
            : null;
        const tarifaTotalCalculada = typeof resumen?.tarifaCalculada === 'number'
            ? resumen.tarifaCalculada
            : ultimaTarifaPublicada
                ? this.decimalToNumber(ultimaTarifaPublicada.tarifaCalculada)
                : null;
        const capacidadPracticaResumen = typeof resumen?.capacidadPractica === 'number'
            ? resumen.capacidadPractica
            : null;
        const capacidadPracticaPersistida = centro.capacidadesPeriodo[0]
            ? this.decimalToNumber(centro.capacidadesPeriodo[0].capacidadPractica)
            : null;
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
            activo: centro.activo,
            estadoConfiguracion,
            ultimoPeriodoConfigurado,
            ultimaTarifaPublicada: ultimaTarifaPublicada
                ? this.decimalToNumber(ultimaTarifaPublicada.tarifaCalculada)
                : null,
            unidadTarifaPublicada: ultimaTarifaPublicada
                ? this.fromPrismaUnidadBase(centro.unidadBaseFutura)
                : '',
            ultimaTarifaBase: tarifaDirectaSinReparto,
            ultimaTarifaAbsorbida: tarifaAbsorbidaReparto,
            ultimaTarifaTotal: tarifaTotalCalculada,
            ultimaCapacidadPractica: capacidadPracticaResumen ?? capacidadPracticaPersistida,
        };
    }
    toRecursoResponse(recurso) {
        return {
            id: recurso.id,
            periodo: recurso.periodo,
            tipoRecurso: this.fromPrismaTipoRecurso(recurso.tipoRecurso),
            empleadoId: recurso.empleadoId ?? '',
            empleadoNombre: recurso.empleado?.nombreCompleto ?? '',
            maquinaId: recurso.maquinaId ?? '',
            maquinaNombre: recurso.maquina?.nombre ?? '',
            nombreRecurso: recurso.nombreRecurso ?? '',
            tipoGastoGeneral: recurso.tipoGastoGeneral
                ? this.fromPrismaTipoGastoGeneral(recurso.tipoGastoGeneral)
                : '',
            valorMensual: recurso.valorMensual
                ? this.decimalToNumber(recurso.valorMensual)
                : null,
            vidaUtilRestanteMeses: recurso.vidaUtilRestanteMeses ?? null,
            valorActual: recurso.valorActual
                ? this.decimalToNumber(recurso.valorActual)
                : null,
            valorFinalVida: recurso.valorFinalVida
                ? this.decimalToNumber(recurso.valorFinalVida)
                : null,
            depreciacionMensualCalc: recurso.depreciacionMensualCalc
                ? this.decimalToNumber(recurso.depreciacionMensualCalc)
                : null,
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
    toRecursoMaquinariaResponse(item, recurso) {
        const metodoDepreciacion = item
            ? this.fromPrismaMetodoDepreciacionMaquina(item.metodoDepreciacion)
            : 'lineal';
        const valorCompra = item ? this.decimalToNumber(item.valorCompra) : 0;
        const valorResidual = item ? this.decimalToNumber(item.valorResidual) : 0;
        const vidaUtilMeses = item?.vidaUtilMeses ?? 60;
        const potenciaNominalKw = item ? Number(item.potenciaNominalKw.toFixed(2)) : 0;
        const factorCargaPct = item ? this.decimalToNumber(item.factorCargaPct) : 100;
        const tarifaEnergiaKwh = item ? Number(item.tarifaEnergiaKwh.toFixed(2)) : 0;
        const horasProgramadasMes = item
            ? this.decimalToNumber(item.horasProgramadasMes)
            : 160;
        const disponibilidadPct = item ? this.decimalToNumber(item.disponibilidadPct) : 85;
        const eficienciaPct = item ? this.decimalToNumber(item.eficienciaPct) : 85;
        const mantenimientoMensual = item
            ? this.decimalToNumber(item.mantenimientoMensual)
            : 0;
        const segurosMensual = item ? this.decimalToNumber(item.segurosMensual) : 0;
        const otrosFijosMensual = item ? this.decimalToNumber(item.otrosFijosMensual) : 0;
        const horasProductivas = Number((horasProgramadasMes *
            (disponibilidadPct / 100) *
            (eficienciaPct / 100)).toFixed(2));
        return {
            id: item?.id ?? '',
            centroCostoRecursoId: recurso.id,
            periodo: recurso.periodo,
            maquinaId: recurso.maquinaId ?? '',
            maquinaNombre: recurso.maquina?.nombre ?? '',
            metodoDepreciacion,
            valorCompra,
            valorResidual,
            vidaUtilMeses,
            potenciaNominalKw,
            factorCargaPct,
            tarifaEnergiaKwh,
            horasProgramadasMes,
            disponibilidadPct,
            eficienciaPct,
            horasProductivas,
            mantenimientoMensual,
            segurosMensual,
            otrosFijosMensual,
            amortizacionMensual: item
                ? this.decimalToNumber(item.amortizacionMensualCalc)
                : Number((Math.max(0, valorCompra - valorResidual) / Math.max(1, vidaUtilMeses)).toFixed(2)),
            energiaMensual: item ? this.decimalToNumber(item.energiaMensualCalc) : 0,
            costoMensualTotal: item ? this.decimalToNumber(item.costoMensualTotalCalc) : 0,
            tarifaHora: item ? Number(item.tarifaHoraCalc.toFixed(2)) : 0,
            updatedAt: item?.updatedAt.toISOString() ?? '',
        };
    }
    computeMaquinariaCosteo(item) {
        const valorCompra = new client_1.Prisma.Decimal(item.valorCompra);
        const valorResidual = new client_1.Prisma.Decimal(item.valorResidual);
        const vidaUtilMeses = Math.max(1, Math.round(item.vidaUtilMeses));
        const potenciaNominalKw = new client_1.Prisma.Decimal(item.potenciaNominalKw);
        const factorCargaPct = new client_1.Prisma.Decimal(item.factorCargaPct);
        const tarifaEnergiaKwh = new client_1.Prisma.Decimal(item.tarifaEnergiaKwh);
        const horasProgramadasMes = new client_1.Prisma.Decimal(item.horasProgramadasMes);
        const disponibilidadPct = new client_1.Prisma.Decimal(item.disponibilidadPct);
        const eficienciaPct = new client_1.Prisma.Decimal(item.eficienciaPct);
        const mantenimientoMensual = new client_1.Prisma.Decimal(item.mantenimientoMensual);
        const segurosMensual = new client_1.Prisma.Decimal(item.segurosMensual);
        const otrosFijosMensual = new client_1.Prisma.Decimal(item.otrosFijosMensual);
        const rawBaseDepreciable = valorCompra.minus(valorResidual);
        const baseDepreciable = rawBaseDepreciable.gt(0)
            ? rawBaseDepreciable
            : new client_1.Prisma.Decimal(0);
        const amortizacionMensual = baseDepreciable.div(new client_1.Prisma.Decimal(vidaUtilMeses));
        const horasProductivas = horasProgramadasMes
            .mul(disponibilidadPct.div(new client_1.Prisma.Decimal(100)))
            .mul(eficienciaPct.div(new client_1.Prisma.Decimal(100)));
        const energiaMensual = potenciaNominalKw
            .mul(factorCargaPct.div(new client_1.Prisma.Decimal(100)))
            .mul(horasProductivas)
            .mul(tarifaEnergiaKwh);
        const costoMensualTotal = amortizacionMensual
            .plus(energiaMensual)
            .plus(mantenimientoMensual)
            .plus(segurosMensual)
            .plus(otrosFijosMensual);
        const tarifaHora = horasProductivas.gt(0)
            ? costoMensualTotal.div(horasProductivas)
            : new client_1.Prisma.Decimal(0);
        return {
            valorCompra,
            valorResidual,
            vidaUtilMeses,
            potenciaNominalKw,
            factorCargaPct,
            tarifaEnergiaKwh,
            horasProgramadasMes,
            disponibilidadPct,
            eficienciaPct,
            mantenimientoMensual,
            segurosMensual,
            otrosFijosMensual,
            amortizacionMensual,
            energiaMensual,
            costoMensualTotal,
            tarifaHora,
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
            [replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.gasto_general]: client_1.TipoRecursoCentroCosto.GASTO_GENERAL,
            [replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.activo_fijo]: client_1.TipoRecursoCentroCosto.ACTIVO_FIJO,
        };
        return mapping[tipo];
    }
    fromPrismaTipoRecurso(tipo) {
        const mapping = {
            [client_1.TipoRecursoCentroCosto.EMPLEADO]: replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.empleado,
            [client_1.TipoRecursoCentroCosto.MAQUINARIA]: replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.maquinaria,
            [client_1.TipoRecursoCentroCosto.GASTO_GENERAL]: replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.gasto_general,
            [client_1.TipoRecursoCentroCosto.ACTIVO_FIJO]: replace_centro_recursos_dto_1.TipoRecursoCentroCostoDto.activo_fijo,
        };
        return mapping[tipo];
    }
    toPrismaTipoGastoGeneral(tipo) {
        const mapping = {
            [replace_centro_recursos_dto_1.TipoGastoGeneralCentroCostoDto.limpieza]: client_1.TipoGastoGeneralCentroCosto.LIMPIEZA,
            [replace_centro_recursos_dto_1.TipoGastoGeneralCentroCostoDto.mantenimiento]: client_1.TipoGastoGeneralCentroCosto.MANTENIMIENTO,
            [replace_centro_recursos_dto_1.TipoGastoGeneralCentroCostoDto.servicios]: client_1.TipoGastoGeneralCentroCosto.SERVICIOS,
            [replace_centro_recursos_dto_1.TipoGastoGeneralCentroCostoDto.alquiler]: client_1.TipoGastoGeneralCentroCosto.ALQUILER,
            [replace_centro_recursos_dto_1.TipoGastoGeneralCentroCostoDto.otro]: client_1.TipoGastoGeneralCentroCosto.OTRO,
        };
        return mapping[tipo];
    }
    fromPrismaTipoGastoGeneral(tipo) {
        const mapping = {
            [client_1.TipoGastoGeneralCentroCosto.LIMPIEZA]: replace_centro_recursos_dto_1.TipoGastoGeneralCentroCostoDto.limpieza,
            [client_1.TipoGastoGeneralCentroCosto.MANTENIMIENTO]: replace_centro_recursos_dto_1.TipoGastoGeneralCentroCostoDto.mantenimiento,
            [client_1.TipoGastoGeneralCentroCosto.SERVICIOS]: replace_centro_recursos_dto_1.TipoGastoGeneralCentroCostoDto.servicios,
            [client_1.TipoGastoGeneralCentroCosto.ALQUILER]: replace_centro_recursos_dto_1.TipoGastoGeneralCentroCostoDto.alquiler,
            [client_1.TipoGastoGeneralCentroCosto.OTRO]: replace_centro_recursos_dto_1.TipoGastoGeneralCentroCostoDto.otro,
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
    toPrismaMetodoDepreciacionMaquina(metodo) {
        const mapping = {
            lineal: client_1.MetodoDepreciacionMaquina.LINEAL,
        };
        return mapping[metodo];
    }
    fromPrismaMetodoDepreciacionMaquina(metodo) {
        const mapping = {
            [client_1.MetodoDepreciacionMaquina.LINEAL]: 'lineal',
        };
        return mapping[metodo];
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