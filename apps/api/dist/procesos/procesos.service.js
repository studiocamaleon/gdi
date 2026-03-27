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
var ProcesosService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcesosService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const prisma_service_1 = require("../prisma/prisma.service");
const upsert_proceso_dto_1 = require("./dto/upsert-proceso.dto");
const proceso_productividad_engine_1 = require("./proceso-productividad.engine");
const DEFAULT_PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
let ProcesosService = class ProcesosService {
    static { ProcesosService_1 = this; }
    prisma;
    static CODIGO_PREFIX = 'PRO';
    static CODIGO_MAX_RETRIES = 5;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(auth) {
        const procesos = await this.prisma.procesoDefinicion.findMany({
            where: {
                tenantId: auth.tenantId,
            },
            include: {
                operaciones: {
                    include: {
                        centroCosto: true,
                        maquina: true,
                        perfilOperativo: true,
                    },
                    orderBy: {
                        orden: 'asc',
                    },
                },
            },
            orderBy: [{ nombre: 'asc' }],
        });
        return procesos.map((proceso) => this.toProcesoResponse(proceso));
    }
    async findAllBibliotecaOperaciones(auth) {
        try {
            const plantillas = await this.prisma.procesoOperacionPlantilla.findMany({
                where: {
                    tenantId: auth.tenantId,
                },
                include: {
                    centroCosto: true,
                    maquina: true,
                    perfilOperativo: true,
                },
                orderBy: [{ nombre: 'asc' }],
            });
            return plantillas.map((item) => this.toBibliotecaOperacionResponse(item));
        }
        catch (error) {
            if (this.isBibliotecaStorageMissingError(error)) {
                return [];
            }
            throw error;
        }
    }
    async createBibliotecaOperacion(auth, payload) {
        this.validateBibliotecaOperacionPayload(payload);
        await this.validateBibliotecaOperacionNivelReferences(auth, payload.niveles ?? []);
        const refs = await this.resolveBibliotecaOperacionReferences(auth, payload);
        let created;
        try {
            created = await this.prisma.procesoOperacionPlantilla.create({
                data: this.buildBibliotecaOperacionData(auth.tenantId, payload, refs),
                select: { id: true },
            });
        }
        catch (error) {
            this.handleBibliotecaWriteError(error);
        }
        const saved = await this.findBibliotecaOperacionOrThrow(auth, created.id);
        return this.toBibliotecaOperacionResponse(saved);
    }
    async updateBibliotecaOperacion(auth, id, payload) {
        await this.findBibliotecaOperacionOrThrow(auth, id);
        this.validateBibliotecaOperacionPayload(payload);
        await this.validateBibliotecaOperacionNivelReferences(auth, payload.niveles ?? []);
        const refs = await this.resolveBibliotecaOperacionReferences(auth, payload);
        let updated;
        try {
            updated = await this.prisma.procesoOperacionPlantilla.update({
                where: { id },
                data: this.buildBibliotecaOperacionData(auth.tenantId, payload, refs),
                select: { id: true },
            });
        }
        catch (error) {
            this.handleBibliotecaWriteError(error);
        }
        const saved = await this.findBibliotecaOperacionOrThrow(auth, updated.id);
        return this.toBibliotecaOperacionResponse(saved);
    }
    async toggleBibliotecaOperacion(auth, id) {
        const item = await this.findBibliotecaOperacionOrThrow(auth, id);
        let updated;
        try {
            updated = await this.prisma.procesoOperacionPlantilla.update({
                where: { id },
                data: {
                    activo: !item.activo,
                },
                select: { id: true },
            });
        }
        catch (error) {
            this.handleBibliotecaWriteError(error);
        }
        const saved = await this.findBibliotecaOperacionOrThrow(auth, updated.id);
        return this.toBibliotecaOperacionResponse(saved);
    }
    async findOne(auth, id) {
        const proceso = await this.findProcesoOrThrow(auth, id);
        return this.toProcesoResponse(proceso);
    }
    async getVersiones(auth, id) {
        await this.findProcesoBaseOrThrow(auth, id);
        const versiones = await this.prisma.procesoVersion.findMany({
            where: {
                tenantId: auth.tenantId,
                procesoDefinicionId: id,
            },
            orderBy: [{ version: 'desc' }],
        });
        return versiones.map((version) => ({
            id: version.id,
            version: version.version,
            data: version.dataJson,
            createdAt: version.createdAt.toISOString(),
        }));
    }
    async snapshotCosto(auth, id, periodo) {
        return this.evaluarCostoInterno(auth, id, {
            periodo,
            cantidadObjetivo: 1,
            contexto: {},
        });
    }
    async evaluarCosto(auth, id, payload) {
        return this.evaluarCostoInterno(auth, id, payload);
    }
    async evaluarCostoInterno(auth, id, payload) {
        const normalizedPeriodo = this.normalizePeriodo(payload.periodo);
        const cantidadObjetivo = Number(payload.cantidadObjetivo);
        if (!Number.isFinite(cantidadObjetivo) || cantidadObjetivo <= 0) {
            throw new common_1.BadRequestException('La cantidad objetivo debe ser mayor a 0.');
        }
        const contexto = payload.contexto ?? {};
        const proceso = await this.findProcesoOrThrow(auth, id);
        const centroIds = Array.from(new Set(proceso.operaciones.map((operacion) => operacion.centroCostoId)));
        const tarifas = await this.prisma.centroCostoTarifaPeriodo.findMany({
            where: {
                tenantId: auth.tenantId,
                estado: client_1.EstadoTarifaCentroCostoPeriodo.PUBLICADA,
                periodo: normalizedPeriodo,
                centroCostoId: {
                    in: centroIds,
                },
            },
            select: {
                centroCostoId: true,
                tarifaCalculada: true,
            },
        });
        const tarifaByCentroId = new Map(tarifas.map((tarifa) => [tarifa.centroCostoId, tarifa.tarifaCalculada]));
        const operationSnapshots = proceso.operaciones.map((operacion) => {
            const derived = this.deriveOperationDefaultsFromPersisted(operacion);
            const setupMin = this.decimalToNumber(derived.setupMin);
            const cleanupMin = this.decimalToNumber(operacion.cleanupMin);
            const tiempoFijoMin = this.decimalToNumber(operacion.tiempoFijoMin);
            const tarifa = tarifaByCentroId.get(operacion.centroCostoId);
            const tarifaNumero = tarifa ? Number(tarifa) : null;
            const usarTiempoFijoManual = operacion.modoProductividad === client_1.ModoProductividadProceso.FIJA &&
                tiempoFijoMin > 0;
            let runMin = this.decimalToNumber(operacion.runMin);
            const productividadWarnings = [];
            let productividadAplicada = null;
            let cantidadRun = 0;
            let mermaSetupAplicada = this.decimalToNumber(operacion.mermaSetup);
            let mermaRunPctAplicada = this.decimalToNumber(operacion.mermaRunPct);
            if (!usarTiempoFijoManual) {
                const productividad = (0, proceso_productividad_engine_1.evaluateProductividad)({
                    modoProductividad: client_1.ModoProductividadProceso.FIJA,
                    productividadBase: derived.productividadBase,
                    reglaVelocidadJson: null,
                    reglaMermaJson: operacion.reglaMermaJson,
                    runMin: operacion.runMin,
                    unidadTiempo: derived.unidadTiempo,
                    mermaRunPct: operacion.mermaRunPct,
                    mermaSetup: operacion.mermaSetup,
                    cantidadObjetivoSalida: cantidadObjetivo,
                    contexto,
                });
                runMin = productividad.runMin;
                productividadAplicada = productividad.productividadAplicada;
                cantidadRun = productividad.cantidadRun;
                mermaSetupAplicada = productividad.mermaSetupAplicada;
                mermaRunPctAplicada = productividad.mermaRunPctAplicada;
                productividadWarnings.push(...productividad.warnings);
            }
            const totalMin = setupMin + runMin + cleanupMin + tiempoFijoMin;
            const horasEfectivas = totalMin / 60;
            const costoTiempo = tarifa
                ? Number(tarifa.mul(horasEfectivas).toFixed(2))
                : 0;
            const warnings = [
                ...productividadWarnings,
                ...derived.warnings,
            ];
            if (!tarifa) {
                warnings.push(`No hay tarifa PUBLICADA para ${operacion.centroCosto.nombre} en ${normalizedPeriodo}.`);
            }
            if (operacion.maquina?.centroCostoPrincipalId &&
                operacion.maquina.centroCostoPrincipalId !== operacion.centroCostoId) {
                warnings.push(`La maquina ${operacion.maquina.nombre} tiene otro centro principal; se usa el centro configurado en la operacion.`);
            }
            const unitWarning = this.getCentroUnidadCompatibilityWarning(operacion);
            if (unitWarning) {
                warnings.push(unitWarning);
            }
            return {
                operacionId: operacion.id,
                orden: operacion.orden,
                codigo: operacion.codigo,
                nombre: operacion.nombre,
                centroCostoId: operacion.centroCostoId,
                centroCostoNombre: operacion.centroCosto.nombre,
                maquinaId: operacion.maquinaId,
                maquinaNombre: operacion.maquina?.nombre ?? '',
                setupMin,
                runMin,
                cleanupMin,
                tiempoFijoMin,
                totalMin: Number(totalMin.toFixed(2)),
                horasEfectivas: Number(horasEfectivas.toFixed(2)),
                tarifaCentro: tarifaNumero,
                costoTiempo,
                productividadAplicada,
                cantidadRun,
                mermaSetupAplicada,
                mermaRunPctAplicada,
                modoProductividad: this.toApiModoProductividad(operacion.modoProductividad),
                warnings: Array.from(new Set(warnings)),
            };
        });
        const totalCostoTiempo = Number(operationSnapshots
            .reduce((acc, item) => acc + item.costoTiempo, 0)
            .toFixed(2));
        const advertencias = Array.from(new Set(operationSnapshots.flatMap((item) => item.warnings)));
        return {
            procesoId: proceso.id,
            procesoCodigo: proceso.codigo,
            procesoNombre: proceso.nombre,
            version: proceso.currentVersion,
            periodo: normalizedPeriodo,
            cantidadObjetivo,
            contexto,
            costoTiempoTotal: totalCostoTiempo,
            operaciones: operationSnapshots,
            advertencias,
            validaParaCotizar: advertencias.length === 0,
        };
    }
    async create(auth, payload) {
        const references = await this.resolveReferenceContext(auth, payload);
        this.validateBusinessRules(payload, references);
        for (let attempt = 0; attempt < ProcesosService_1.CODIGO_MAX_RETRIES; attempt += 1) {
            const generatedCodigo = this.generateCodigoProceso();
            try {
                const proceso = await this.createWithCodigo(auth, payload, references, generatedCodigo);
                return this.toProcesoResponse(proceso);
            }
            catch (error) {
                if (this.isCodigoConflictError(error)) {
                    continue;
                }
                this.handleWriteError(error);
            }
        }
        throw new common_1.ConflictException('No se pudo generar un codigo unico para el proceso.');
    }
    async update(auth, id, payload) {
        const base = await this.findProcesoBaseOrThrow(auth, id);
        const references = await this.resolveReferenceContext(auth, payload);
        this.validateBusinessRules(payload, references);
        try {
            const proceso = await this.prisma.$transaction(async (tx) => {
                const codigoToPersist = base.codigo;
                const nextVersion = base.currentVersion + 1;
                await tx.procesoDefinicion.update({
                    where: { id },
                    data: this.buildProcesoWriteData(auth, payload, references, codigoToPersist, nextVersion),
                });
                await this.replaceOperaciones(tx, auth.tenantId, id, payload.operaciones, references);
                const updated = await tx.procesoDefinicion.findUniqueOrThrow({
                    where: { id },
                    include: {
                        operaciones: {
                            include: {
                                centroCosto: true,
                                maquina: true,
                                perfilOperativo: true,
                            },
                            orderBy: {
                                orden: 'asc',
                            },
                        },
                    },
                });
                await tx.procesoVersion.create({
                    data: {
                        tenantId: auth.tenantId,
                        procesoDefinicionId: id,
                        version: nextVersion,
                        dataJson: this.toVersionSnapshot(updated),
                    },
                });
                return updated;
            });
            return this.toProcesoResponse(proceso);
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async toggle(auth, id) {
        const proceso = await this.findProcesoBaseOrThrow(auth, id);
        const updated = await this.prisma.procesoDefinicion.update({
            where: { id },
            data: {
                activo: !proceso.activo,
            },
            include: {
                operaciones: {
                    include: {
                        centroCosto: true,
                        maquina: true,
                        perfilOperativo: true,
                    },
                    orderBy: {
                        orden: 'asc',
                    },
                },
            },
        });
        return this.toProcesoResponse(updated);
    }
    async createWithCodigo(auth, payload, references, codigo) {
        return this.prisma.$transaction(async (tx) => {
            const created = await tx.procesoDefinicion.create({
                data: this.buildProcesoWriteData(auth, payload, references, codigo, 1),
            });
            await this.replaceOperaciones(tx, auth.tenantId, created.id, payload.operaciones, references);
            const hydrated = await tx.procesoDefinicion.findUniqueOrThrow({
                where: { id: created.id },
                include: {
                    operaciones: {
                        include: {
                            centroCosto: true,
                            maquina: true,
                            perfilOperativo: true,
                        },
                        orderBy: {
                            orden: 'asc',
                        },
                    },
                },
            });
            await tx.procesoVersion.create({
                data: {
                    tenantId: auth.tenantId,
                    procesoDefinicionId: created.id,
                    version: 1,
                    dataJson: this.toVersionSnapshot(hydrated),
                },
            });
            return hydrated;
        });
    }
    async replaceOperaciones(tx, tenantId, procesoId, operaciones, references) {
        await tx.procesoOperacion.deleteMany({
            where: {
                tenantId,
                procesoDefinicionId: procesoId,
            },
        });
        await Promise.all(operaciones.map((operacion, index) => tx.procesoOperacion.create({
            data: this.buildOperacionData(tenantId, procesoId, operacion, index + 1, references),
        })));
    }
    buildProcesoWriteData(auth, payload, references, forcedCodigo, forcedVersion) {
        const plantillaMaquinaria = this.getPlantillaFromPayload(payload);
        const estadoConfiguracion = this.getDerivedEstadoConfiguracion(payload, references);
        return {
            tenantId: auth.tenantId,
            codigo: forcedCodigo,
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
            plantillaMaquinaria: plantillaMaquinaria
                ? this.toPrismaEnum(plantillaMaquinaria)
                : null,
            currentVersion: forcedVersion,
            estadoConfiguracion: this.toPrismaEnum(estadoConfiguracion),
            activo: payload.activo,
            observaciones: payload.observaciones?.trim() || null,
        };
    }
    buildOperacionData(tenantId, procesoId, payload, orden, references) {
        const codigo = `OP-${String(orden).padStart(3, '0')}`;
        const centroCostoId = this.resolveCentroCostoIdForOperation(payload, references);
        const derived = this.deriveOperationDefaultsFromPayload(payload, references);
        return {
            tenantId,
            procesoDefinicionId: procesoId,
            orden,
            codigo,
            nombre: payload.nombre.trim(),
            tipoOperacion: this.toPrismaTipoOperacion(payload.tipoOperacion),
            centroCostoId,
            maquinaId: payload.maquinaId ?? null,
            perfilOperativoId: payload.perfilOperativoId ?? null,
            setupMin: derived.setupMin,
            runMin: this.toDecimal(payload.runMin),
            cleanupMin: derived.cleanupMin,
            tiempoFijoMin: this.toDecimal(payload.tiempoFijoMin),
            modoProductividad: this.resolveModoProductividadFromPayload(payload),
            productividadBase: derived.productividadBase,
            unidadEntrada: this.toPrismaEnum(payload.unidadEntrada ?? upsert_proceso_dto_1.UnidadProcesoDto.ninguna),
            unidadSalida: derived.unidadSalida,
            unidadTiempo: derived.unidadTiempo,
            mermaSetup: this.toDecimal(payload.mermaSetup),
            mermaRunPct: this.toDecimal(payload.mermaRunPct),
            reglaVelocidadJson: undefined,
            reglaMermaJson: this.toNullableJson(payload.reglaMerma),
            detalleJson: this.buildOperacionDetalleJson(payload.detalle, payload.niveles, payload.baseCalculoProductividad),
            activo: payload.activo,
        };
    }
    buildBibliotecaOperacionData(tenantId, payload, refs) {
        return {
            tenantId,
            nombre: payload.nombre.trim(),
            tipoOperacion: this.toPrismaTipoOperacion(payload.tipoOperacion),
            centroCostoId: refs.centroCostoId,
            maquinaId: refs.maquinaId,
            perfilOperativoId: refs.perfilOperativoId,
            setupMin: this.toDecimal(payload.setupMin),
            cleanupMin: this.toDecimal(payload.cleanupMin),
            tiempoFijoMin: this.toDecimal(payload.tiempoFijoMin),
            modoProductividad: this.resolveModoProductividadFromBibliotecaPayload(payload),
            productividadBase: this.toDecimal(payload.productividadBase),
            unidadEntrada: this.toPrismaEnum(payload.unidadEntrada ?? upsert_proceso_dto_1.UnidadProcesoDto.ninguna),
            unidadSalida: this.toPrismaEnum(payload.unidadSalida ?? upsert_proceso_dto_1.UnidadProcesoDto.ninguna),
            unidadTiempo: this.toPrismaEnum(payload.unidadTiempo ?? upsert_proceso_dto_1.UnidadProcesoDto.minuto),
            mermaRunPct: this.toDecimal(payload.mermaRunPct),
            reglaVelocidadJson: undefined,
            reglaMermaJson: this.toNullableJson(payload.reglaMerma),
            detalleJson: this.buildOperacionDetalleJson(undefined, payload.niveles, payload.baseCalculoProductividad),
            observaciones: payload.observaciones?.trim() || null,
            activo: payload.activo,
        };
    }
    toPrismaTipoOperacion(value) {
        switch (value) {
            case upsert_proceso_dto_1.TipoOperacionProcesoDto.preprensa:
                return client_1.TipoOperacionProceso.PREPRENSA;
            case upsert_proceso_dto_1.TipoOperacionProcesoDto.prensa:
                return client_1.TipoOperacionProceso.IMPRESION;
            case upsert_proceso_dto_1.TipoOperacionProcesoDto.postprensa:
                return client_1.TipoOperacionProceso.TERMINACION;
            case upsert_proceso_dto_1.TipoOperacionProcesoDto.acabado:
                return client_1.TipoOperacionProceso.LAMINADO;
            case upsert_proceso_dto_1.TipoOperacionProcesoDto.servicio:
                return client_1.TipoOperacionProceso.OTRO;
            case upsert_proceso_dto_1.TipoOperacionProcesoDto.instalacion:
                return client_1.TipoOperacionProceso.LOGISTICA;
            default:
                return client_1.TipoOperacionProceso.OTRO;
        }
    }
    fromPrismaTipoOperacion(value) {
        switch (value) {
            case client_1.TipoOperacionProceso.PREPRENSA:
            case client_1.TipoOperacionProceso.PREFLIGHT:
                return upsert_proceso_dto_1.TipoOperacionProcesoDto.preprensa;
            case client_1.TipoOperacionProceso.IMPRESION:
                return upsert_proceso_dto_1.TipoOperacionProcesoDto.prensa;
            case client_1.TipoOperacionProceso.LOGISTICA:
                return upsert_proceso_dto_1.TipoOperacionProcesoDto.instalacion;
            case client_1.TipoOperacionProceso.LAMINADO:
            case client_1.TipoOperacionProceso.CORTE:
            case client_1.TipoOperacionProceso.MECANIZADO:
            case client_1.TipoOperacionProceso.GRABADO:
            case client_1.TipoOperacionProceso.CURADO:
            case client_1.TipoOperacionProceso.TRANSFERENCIA:
                return upsert_proceso_dto_1.TipoOperacionProcesoDto.acabado;
            case client_1.TipoOperacionProceso.TERMINACION:
            case client_1.TipoOperacionProceso.CONTROL_CALIDAD:
            case client_1.TipoOperacionProceso.EMPAQUE:
            case client_1.TipoOperacionProceso.TERCERIZADO:
                return upsert_proceso_dto_1.TipoOperacionProcesoDto.postprensa;
            case client_1.TipoOperacionProceso.OTRO:
            default:
                return upsert_proceso_dto_1.TipoOperacionProcesoDto.servicio;
        }
    }
    buildOperacionDetalleJson(detalle, niveles = [], baseCalculoProductividad) {
        const base = detalle && typeof detalle === 'object' && !Array.isArray(detalle) ? { ...detalle } : {};
        if (baseCalculoProductividad) {
            base.baseCalculoProductividad = baseCalculoProductividad;
        }
        const nivelesSanitizados = niveles
            .filter((nivel) => nivel.nombre?.trim())
            .map((nivel, index) => {
            const modoProductividadNivel = nivel.modoProductividadNivel === 'variable_manual' ||
                nivel.modoProductividadNivel === 'variable_perfil'
                ? nivel.modoProductividadNivel
                : 'fija';
            const sanitized = {
                id: nivel.id?.trim() || (0, node_crypto_1.randomUUID)(),
                nombre: nivel.nombre.trim(),
                orden: nivel.orden ?? index + 1,
                activo: nivel.activo ?? true,
                modoProductividadNivel,
                tiempoFijoMin: nivel.tiempoFijoMin === undefined || nivel.tiempoFijoMin === null
                    ? null
                    : Number(nivel.tiempoFijoMin),
                productividadBase: nivel.productividadBase === undefined || nivel.productividadBase === null
                    ? null
                    : Number(nivel.productividadBase),
                unidadSalida: nivel.unidadSalida?.trim() || null,
                unidadTiempo: nivel.unidadTiempo?.trim() || null,
                maquinaId: nivel.maquinaId?.trim() || null,
                perfilOperativoId: nivel.perfilOperativoId?.trim() || null,
                setupMin: nivel.setupMin === undefined || nivel.setupMin === null
                    ? null
                    : Number(nivel.setupMin),
                cleanupMin: nivel.cleanupMin === undefined || nivel.cleanupMin === null
                    ? null
                    : Number(nivel.cleanupMin),
                resumen: this.buildNivelResumen({
                    nombre: nivel.nombre.trim(),
                    modoProductividadNivel,
                    tiempoFijoMin: nivel.tiempoFijoMin === undefined || nivel.tiempoFijoMin === null
                        ? null
                        : Number(nivel.tiempoFijoMin),
                    productividadBase: nivel.productividadBase === undefined || nivel.productividadBase === null
                        ? null
                        : Number(nivel.productividadBase),
                    unidadSalida: nivel.unidadSalida?.trim() || null,
                    unidadTiempo: nivel.unidadTiempo?.trim() || null,
                    perfilOperativoNombre: '',
                }),
                detalle: nivel.detalle && typeof nivel.detalle === 'object' && !Array.isArray(nivel.detalle)
                    ? nivel.detalle
                    : null,
            };
            return sanitized;
        });
        return this.toNullableJson({
            ...base,
            niveles: nivelesSanitizados,
        });
    }
    getOperacionDetalle(detalleJson) {
        if (!detalleJson || typeof detalleJson !== 'object' || Array.isArray(detalleJson)) {
            return null;
        }
        const detalle = { ...detalleJson };
        delete detalle.niveles;
        return Object.keys(detalle).length > 0 ? detalle : null;
    }
    getOperacionNiveles(detalleJson) {
        if (!detalleJson || typeof detalleJson !== 'object' || Array.isArray(detalleJson)) {
            return [];
        }
        const raw = detalleJson.niveles;
        if (!Array.isArray(raw)) {
            return [];
        }
        return raw
            .map((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                return null;
            }
            const nivel = item;
            const nombre = String(nivel.nombre ?? '').trim();
            if (!nombre) {
                return null;
            }
            return {
                id: String(nivel.id ?? (0, node_crypto_1.randomUUID)()),
                nombre,
                orden: Number(nivel.orden ?? index + 1),
                activo: nivel.activo !== false,
                modoProductividadNivel: nivel.modoProductividadNivel === 'variable_manual' ||
                    nivel.modoProductividadNivel === 'variable_perfil'
                    ? nivel.modoProductividadNivel
                    : 'fija',
                tiempoFijoMin: typeof nivel.tiempoFijoMin === 'number'
                    ? nivel.tiempoFijoMin
                    : nivel.tiempoFijoMin == null
                        ? null
                        : Number(nivel.tiempoFijoMin),
                productividadBase: typeof nivel.productividadBase === 'number'
                    ? nivel.productividadBase
                    : nivel.productividadBase == null
                        ? null
                        : Number(nivel.productividadBase),
                unidadSalida: typeof nivel.unidadSalida === 'string' && nivel.unidadSalida.trim().length
                    ? nivel.unidadSalida.trim()
                    : null,
                unidadTiempo: typeof nivel.unidadTiempo === 'string' && nivel.unidadTiempo.trim().length
                    ? nivel.unidadTiempo.trim()
                    : null,
                maquinaId: typeof nivel.maquinaId === 'string' && nivel.maquinaId.trim().length
                    ? nivel.maquinaId.trim()
                    : null,
                maquinaNombre: typeof nivel.maquinaNombre === 'string' && nivel.maquinaNombre.trim().length
                    ? nivel.maquinaNombre.trim()
                    : '',
                perfilOperativoId: typeof nivel.perfilOperativoId === 'string' && nivel.perfilOperativoId.trim().length
                    ? nivel.perfilOperativoId.trim()
                    : null,
                perfilOperativoNombre: typeof nivel.perfilOperativoNombre === 'string' && nivel.perfilOperativoNombre.trim().length
                    ? nivel.perfilOperativoNombre.trim()
                    : '',
                setupMin: typeof nivel.setupMin === 'number'
                    ? nivel.setupMin
                    : nivel.setupMin == null
                        ? null
                        : Number(nivel.setupMin),
                cleanupMin: typeof nivel.cleanupMin === 'number'
                    ? nivel.cleanupMin
                    : nivel.cleanupMin == null
                        ? null
                        : Number(nivel.cleanupMin),
                resumen: typeof nivel.resumen === 'string' && nivel.resumen.trim().length
                    ? nivel.resumen.trim()
                    : this.buildNivelResumen({
                        nombre,
                        modoProductividadNivel: nivel.modoProductividadNivel === 'variable_manual' ||
                            nivel.modoProductividadNivel === 'variable_perfil'
                            ? nivel.modoProductividadNivel
                            : 'fija',
                        tiempoFijoMin: typeof nivel.tiempoFijoMin === 'number'
                            ? nivel.tiempoFijoMin
                            : nivel.tiempoFijoMin == null
                                ? null
                                : Number(nivel.tiempoFijoMin),
                        productividadBase: typeof nivel.productividadBase === 'number'
                            ? nivel.productividadBase
                            : nivel.productividadBase == null
                                ? null
                                : Number(nivel.productividadBase),
                        unidadSalida: typeof nivel.unidadSalida === 'string' ? nivel.unidadSalida : null,
                        unidadTiempo: typeof nivel.unidadTiempo === 'string' ? nivel.unidadTiempo : null,
                        perfilOperativoNombre: typeof nivel.perfilOperativoNombre === 'string'
                            ? nivel.perfilOperativoNombre
                            : '',
                    }),
                detalle: nivel.detalle && typeof nivel.detalle === 'object' && !Array.isArray(nivel.detalle)
                    ? nivel.detalle
                    : null,
            };
        })
            .filter((item) => Boolean(item))
            .sort((a, b) => a.orden - b.orden);
    }
    validateBibliotecaOperacionPayload(payload) {
        if (!payload.nombre?.trim()) {
            throw new common_1.BadRequestException('La plantilla de operacion requiere nombre.');
        }
        if (payload.setupMin !== undefined && payload.setupMin < 0) {
            throw new common_1.BadRequestException('Setup no puede ser negativo.');
        }
        if (payload.cleanupMin !== undefined && payload.cleanupMin < 0) {
            throw new common_1.BadRequestException('Cleanup no puede ser negativo.');
        }
        if (payload.tiempoFijoMin !== undefined && payload.tiempoFijoMin < 0) {
            throw new common_1.BadRequestException('Tiempo fijo no puede ser negativo.');
        }
        if (payload.productividadBase !== undefined &&
            payload.productividadBase < 0) {
            throw new common_1.BadRequestException('Productividad base no puede ser negativa.');
        }
        if (payload.mermaRunPct !== undefined &&
            (payload.mermaRunPct < 0 || payload.mermaRunPct > 100)) {
            throw new common_1.BadRequestException('Merma debe estar entre 0 y 100.');
        }
        if (!payload.maquinaId && payload.perfilOperativoId) {
            throw new common_1.BadRequestException('No se puede definir perfil operativo sin maquina.');
        }
        if (!payload.maquinaId && !payload.centroCostoId) {
            throw new common_1.BadRequestException('Define un centro de costo cuando la plantilla no tiene maquina.');
        }
        this.validateBaseCalculoProductividad({
            operationName: payload.nombre.trim(),
            baseCalculoProductividad: payload.baseCalculoProductividad,
            unidadSalida: payload.unidadSalida ?? upsert_proceso_dto_1.UnidadProcesoDto.ninguna,
        });
        this.validateOperacionNivelesPayload(payload.niveles ?? [], payload.nombre.trim());
    }
    validateBaseCalculoProductividad(input) {
        const baseCalculoProductividad = input.baseCalculoProductividad;
        if (!baseCalculoProductividad) {
            return;
        }
        const requiereMetroLineal = baseCalculoProductividad === upsert_proceso_dto_1.BaseCalculoProductividadDto.metro_lineal_total ||
            baseCalculoProductividad === upsert_proceso_dto_1.BaseCalculoProductividadDto.perimetro_total_ml;
        if (requiereMetroLineal &&
            input.unidadSalida !== upsert_proceso_dto_1.UnidadProcesoDto.metro_lineal) {
            throw new common_1.BadRequestException(`La operacion ${input.operationName} usa Base de calculo lineal y requiere Unidad de productividad en metro lineal.`);
        }
        if (baseCalculoProductividad === upsert_proceso_dto_1.BaseCalculoProductividadDto.area_total_m2 &&
            input.unidadSalida !== upsert_proceso_dto_1.UnidadProcesoDto.m2) {
            throw new common_1.BadRequestException(`La operacion ${input.operationName} usa Base de calculo por area y requiere Unidad de productividad en m2.`);
        }
    }
    resolveModoProductividadFromPayload(payload) {
        if (payload.modoProductividad === upsert_proceso_dto_1.ModoProductividadProcesoDto.fija) {
            return client_1.ModoProductividadProceso.FIJA;
        }
        return client_1.ModoProductividadProceso.FORMULA;
    }
    resolveModoProductividadFromBibliotecaPayload(payload) {
        if (payload.modoProductividad === upsert_proceso_dto_1.ModoProductividadProcesoDto.fija) {
            return client_1.ModoProductividadProceso.FIJA;
        }
        return client_1.ModoProductividadProceso.FORMULA;
    }
    deriveOperationDefaultsFromPayload(payload, references) {
        const maquina = payload.maquinaId
            ? (references.maquinasById.get(payload.maquinaId) ?? null)
            : null;
        const perfil = payload.perfilOperativoId
            ? (references.perfilesById.get(payload.perfilOperativoId) ?? null)
            : null;
        const perfilDetalle = perfil?.detalleJson && typeof perfil.detalleJson === 'object' && !Array.isArray(perfil.detalleJson)
            ? perfil.detalleJson
            : null;
        const velocidadTrabajoMmSegPerfil = typeof perfilDetalle?.velocidadTrabajoMmSeg === 'number' &&
            Number.isFinite(perfilDetalle.velocidadTrabajoMmSeg)
            ? perfilDetalle.velocidadTrabajoMmSeg
            : null;
        const machineUnit = this.mapProfileProductivityUnitToProceso(perfil?.productivityUnit ?? maquina?.unidadProduccionPrincipal ?? null);
        const explicitUnidadSalida = this.toPrismaEnum(payload.unidadSalida ?? upsert_proceso_dto_1.UnidadProcesoDto.ninguna);
        const explicitUnidadTiempo = this.toPrismaEnum(payload.unidadTiempo ?? upsert_proceso_dto_1.UnidadProcesoDto.minuto);
        const shouldAbsorbUnits = Boolean(machineUnit) && explicitUnidadSalida === client_1.UnidadProceso.NINGUNA;
        const unidadSalida = shouldAbsorbUnits
            ? (machineUnit?.unidadSalida ?? explicitUnidadSalida)
            : explicitUnidadSalida;
        const unidadTiempo = shouldAbsorbUnits
            ? (machineUnit?.unidadTiempo ?? explicitUnidadTiempo)
            : explicitUnidadTiempo;
        const setupMin = this.toDecimal(payload.setupMin) ??
            this.getSetupFromPerfilReference(perfil) ??
            null;
        const cleanupMin = this.toDecimal(payload.cleanupMin) ??
            perfil?.cleanupMin ??
            null;
        const productividadBase = this.toDecimal(payload.productividadBase) ??
            perfil?.productivityValue ??
            (maquina?.plantilla === client_1.PlantillaMaquinaria.LAMINADORA_BOPP_ROLLO &&
                velocidadTrabajoMmSegPerfil !== null
                ? new client_1.Prisma.Decimal(velocidadTrabajoMmSegPerfil)
                : null) ??
            null;
        return {
            perfil,
            unidadSalida,
            unidadTiempo,
            setupMin,
            cleanupMin,
            productividadBase,
        };
    }
    deriveOperationDefaultsFromPersisted(operacion) {
        const perfilDetalle = operacion.perfilOperativo?.detalleJson &&
            typeof operacion.perfilOperativo.detalleJson === 'object' &&
            !Array.isArray(operacion.perfilOperativo.detalleJson)
            ? operacion.perfilOperativo.detalleJson
            : null;
        const velocidadTrabajoMmSegPerfil = typeof perfilDetalle?.velocidadTrabajoMmSeg === 'number' &&
            Number.isFinite(perfilDetalle.velocidadTrabajoMmSeg)
            ? perfilDetalle.velocidadTrabajoMmSeg
            : null;
        const machineUnit = this.mapProfileProductivityUnitToProceso(operacion.perfilOperativo?.productivityUnit ??
            operacion.maquina?.unidadProduccionPrincipal ??
            null);
        const shouldAbsorbUnits = Boolean(machineUnit) && operacion.unidadSalida === client_1.UnidadProceso.NINGUNA;
        const unidadSalida = shouldAbsorbUnits
            ? (machineUnit?.unidadSalida ?? operacion.unidadSalida)
            : operacion.unidadSalida;
        const unidadTiempo = shouldAbsorbUnits
            ? (machineUnit?.unidadTiempo ?? operacion.unidadTiempo)
            : operacion.unidadTiempo;
        const productividadBase = operacion.productividadBase ??
            operacion.perfilOperativo?.productivityValue ??
            (operacion.maquina?.plantilla === client_1.PlantillaMaquinaria.LAMINADORA_BOPP_ROLLO &&
                velocidadTrabajoMmSegPerfil !== null
                ? new client_1.Prisma.Decimal(velocidadTrabajoMmSegPerfil)
                : null) ??
            null;
        const fallbackSetup = this.getSetupFromPerfilPersisted(operacion.perfilOperativo);
        const setupMin = operacion.setupMin ?? fallbackSetup ?? null;
        const cleanupMin = operacion.cleanupMin ?? operacion.perfilOperativo?.cleanupMin ?? null;
        const absorptionWarnings = [];
        if (!operacion.productividadBase &&
            (operacion.perfilOperativo?.productivityValue ||
                (operacion.maquina?.plantilla === client_1.PlantillaMaquinaria.LAMINADORA_BOPP_ROLLO &&
                    velocidadTrabajoMmSegPerfil !== null &&
                    velocidadTrabajoMmSegPerfil > 0))) {
            absorptionWarnings.push(`Se uso productividad del perfil operativo ${operacion.perfilOperativo?.nombre ?? 'sin nombre'}.`);
        }
        if (operacion.setupMin === null &&
            fallbackSetup !== null &&
            operacion.perfilOperativo) {
            absorptionWarnings.push(`Se uso setup del perfil operativo ${operacion.perfilOperativo.nombre}.`);
        }
        if (operacion.cleanupMin === null &&
            cleanupMin !== null &&
            operacion.perfilOperativo) {
            absorptionWarnings.push(`Se uso cleanup del perfil operativo ${operacion.perfilOperativo.nombre}.`);
        }
        if (shouldAbsorbUnits && operacion.perfilOperativo?.productivityUnit) {
            absorptionWarnings.push(`Se usaron unidades del perfil operativo ${operacion.perfilOperativo.nombre}.`);
        }
        else if (shouldAbsorbUnits &&
            operacion.maquina?.unidadProduccionPrincipal) {
            absorptionWarnings.push(`Se usaron unidades de la maquina ${operacion.maquina.nombre}.`);
        }
        return {
            unidadSalida,
            unidadTiempo,
            productividadBase,
            setupMin,
            cleanupMin,
            warnings: absorptionWarnings,
        };
    }
    mapProfileProductivityUnitToProceso(unit) {
        if (!unit) {
            return null;
        }
        if (unit === client_1.UnidadProduccionMaquina.PPM) {
            return {
                unidadSalida: client_1.UnidadProceso.COPIA,
                unidadTiempo: client_1.UnidadProceso.MINUTO,
            };
        }
        if (unit === client_1.UnidadProduccionMaquina.M2_H) {
            return {
                unidadSalida: client_1.UnidadProceso.M2,
                unidadTiempo: client_1.UnidadProceso.HORA,
            };
        }
        if (unit === client_1.UnidadProduccionMaquina.PIEZAS_H) {
            return {
                unidadSalida: client_1.UnidadProceso.PIEZA,
                unidadTiempo: client_1.UnidadProceso.HORA,
            };
        }
        if (unit === client_1.UnidadProduccionMaquina.CORTES_MIN) {
            return {
                unidadSalida: client_1.UnidadProceso.CORTE,
                unidadTiempo: client_1.UnidadProceso.MINUTO,
            };
        }
        if (unit === client_1.UnidadProduccionMaquina.GOLPES_MIN) {
            return {
                unidadSalida: client_1.UnidadProceso.CICLO,
                unidadTiempo: client_1.UnidadProceso.MINUTO,
            };
        }
        if (unit === client_1.UnidadProduccionMaquina.PLIEGOS_MIN) {
            return {
                unidadSalida: client_1.UnidadProceso.HOJA,
                unidadTiempo: client_1.UnidadProceso.MINUTO,
            };
        }
        if (unit === client_1.UnidadProduccionMaquina.M_MIN) {
            return {
                unidadSalida: client_1.UnidadProceso.METRO_LINEAL,
                unidadTiempo: client_1.UnidadProceso.MINUTO,
            };
        }
        return null;
    }
    getSetupFromPerfilReference(perfil) {
        if (!perfil) {
            return null;
        }
        const timeParts = [
            ...this.collectSetupDetailParts(perfil.detalleJson),
            perfil.setupMin,
        ].filter((value) => value !== null && value !== undefined);
        if (!timeParts.length) {
            return null;
        }
        return timeParts.reduce((acc, value) => acc.add(value), new client_1.Prisma.Decimal(0));
    }
    getSetupFromPerfilPersisted(perfil) {
        if (!perfil) {
            return null;
        }
        const timeParts = [
            ...this.collectSetupDetailParts(perfil.detalleJson),
            perfil.setupMin,
        ].filter((value) => value !== null && value !== undefined);
        if (!timeParts.length) {
            return null;
        }
        return timeParts.reduce((acc, value) => acc.add(value), new client_1.Prisma.Decimal(0));
    }
    collectSetupDetailParts(detalleJson) {
        if (!detalleJson || typeof detalleJson !== 'object' || Array.isArray(detalleJson)) {
            return [];
        }
        const detalle = detalleJson;
        const values = [];
        const pushIfFinite = (value) => {
            const parsed = this.parseFiniteNumber(value);
            if (parsed !== null && parsed > 0) {
                values.push(parsed);
            }
        };
        const objectCandidates = [
            detalle.setupComponentesMin,
            detalle.setupExtraComponentesMin,
            detalle.tiemposSetupExtraMin,
        ];
        for (const candidate of objectCandidates) {
            if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
                continue;
            }
            for (const value of Object.values(candidate)) {
                pushIfFinite(value);
            }
        }
        const arrayCandidates = [detalle.setupExtrasMin, detalle.tiemposExtraSetupMin];
        for (const candidate of arrayCandidates) {
            if (!Array.isArray(candidate)) {
                continue;
            }
            for (const value of candidate) {
                pushIfFinite(value);
            }
        }
        return values.map((item) => new client_1.Prisma.Decimal(item));
    }
    getPlantillaFromPayload(payload) {
        return payload.plantillaMaquinaria ?? null;
    }
    getDerivedEstadoConfiguracion(payload, references) {
        if (!payload.nombre?.trim()) {
            return upsert_proceso_dto_1.EstadoConfiguracionProcesoDto.borrador;
        }
        if (!payload.operaciones.length) {
            return upsert_proceso_dto_1.EstadoConfiguracionProcesoDto.incompleta;
        }
        const hasAllCenters = payload.operaciones.every((operacion) => {
            if (operacion.centroCostoId) {
                return true;
            }
            if (!operacion.maquinaId) {
                return false;
            }
            const maquina = references.maquinasById.get(operacion.maquinaId);
            return Boolean(maquina?.centroCostoPrincipalId);
        });
        if (!hasAllCenters) {
            return upsert_proceso_dto_1.EstadoConfiguracionProcesoDto.incompleta;
        }
        const hasAllOperationsCostingSignals = payload.operaciones.every((operacion) => {
            const derived = this.deriveOperationDefaultsFromPayload(operacion, references);
            return (derived.setupMin !== null ||
                operacion.runMin !== undefined ||
                operacion.tiempoFijoMin !== undefined ||
                derived.productividadBase !== null);
        });
        if (!hasAllOperationsCostingSignals) {
            return upsert_proceso_dto_1.EstadoConfiguracionProcesoDto.incompleta;
        }
        return upsert_proceso_dto_1.EstadoConfiguracionProcesoDto.lista;
    }
    resolveCentroCostoIdForOperation(operacion, references) {
        if (operacion.centroCostoId) {
            return operacion.centroCostoId;
        }
        if (!operacion.maquinaId) {
            throw new common_1.BadRequestException(`La operacion ${operacion.nombre.trim()} requiere centro de costo o maquina con centro principal.`);
        }
        const maquina = references.maquinasById.get(operacion.maquinaId);
        if (!maquina?.centroCostoPrincipalId) {
            throw new common_1.BadRequestException(`La maquina seleccionada para ${operacion.nombre.trim()} no tiene centro de costo principal configurado.`);
        }
        return maquina.centroCostoPrincipalId;
    }
    validateBusinessRules(payload, references) {
        const operaciones = payload.operaciones ?? [];
        const operationOrders = new Set();
        for (const [index, operacion] of operaciones.entries()) {
            if (!operacion.nombre?.trim()) {
                throw new common_1.BadRequestException('Todas las operaciones requieren nombre.');
            }
            const orden = operacion.orden ?? index + 1;
            if (operationOrders.has(orden)) {
                throw new common_1.BadRequestException(`El orden ${orden} esta repetido dentro del proceso.`);
            }
            operationOrders.add(orden);
        }
        for (const operacion of operaciones) {
            this.validateOperacionNivelesBusinessRules(operacion.nombre.trim(), operacion.niveles ?? [], references);
            if (!operacion.perfilOperativoId) {
                continue;
            }
            if (!operacion.maquinaId) {
                throw new common_1.BadRequestException(`La operacion ${operacion.nombre.trim()} no puede tener perfil operativo sin maquina asociada.`);
            }
            const perfil = references.perfilesById.get(operacion.perfilOperativoId);
            if (!perfil) {
                throw new common_1.BadRequestException(`El perfil operativo seleccionado para ${operacion.nombre.trim()} no existe.`);
            }
            if (perfil.maquinaId !== operacion.maquinaId) {
                throw new common_1.BadRequestException(`El perfil operativo de ${operacion.nombre.trim()} no pertenece a la maquina seleccionada.`);
            }
        }
        if (payload.plantillaMaquinaria) {
            for (const operacion of operaciones) {
                if (!operacion.maquinaId) {
                    continue;
                }
                const maquina = references.maquinasById.get(operacion.maquinaId);
                if (!maquina) {
                    continue;
                }
                if (maquina.plantilla !==
                    this.toPrismaEnum(payload.plantillaMaquinaria)) {
                    throw new common_1.BadRequestException(`La maquina ${maquina.nombre} no coincide con la plantilla seleccionada del proceso.`);
                }
            }
        }
        for (const operacion of operaciones) {
            if (operacion.centroCostoId &&
                !references.centrosById.has(operacion.centroCostoId)) {
                throw new common_1.BadRequestException(`El centro de costo de ${operacion.nombre.trim()} no existe.`);
            }
            if (operacion.maquinaId &&
                !references.maquinasById.has(operacion.maquinaId)) {
                throw new common_1.BadRequestException(`La maquina seleccionada para ${operacion.nombre.trim()} no existe.`);
            }
            const modoProductividad = this.resolveModoProductividadFromPayload(operacion);
            const derived = this.deriveOperationDefaultsFromPayload(operacion, references);
            if (modoProductividad === client_1.ModoProductividadProceso.FIJA &&
                (!operacion.tiempoFijoMin || operacion.tiempoFijoMin <= 0)) {
                throw new common_1.BadRequestException(`La operacion ${operacion.nombre.trim()} en modo fija requiere Tiempo fijo (min) mayor a 0.`);
            }
            if (modoProductividad === client_1.ModoProductividadProceso.FORMULA &&
                (!derived.productividadBase || Number(derived.productividadBase) <= 0)) {
                throw new common_1.BadRequestException(`La operacion ${operacion.nombre.trim()} en modo variable requiere Productividad base mayor a 0 (manual o desde perfil).`);
            }
            this.validateBaseCalculoProductividad({
                operationName: operacion.nombre.trim(),
                baseCalculoProductividad: operacion.baseCalculoProductividad,
                unidadSalida: this.toApiEnum(derived.unidadSalida),
            });
            const centroRef = this.getCentroRefForOperacionPayload(operacion, references);
            if (centroRef) {
                const unidadError = this.getCentroUnidadCompatibilityErrorForPayload({
                    unidadEntrada: this.toPrismaEnum(operacion.unidadEntrada ?? upsert_proceso_dto_1.UnidadProcesoDto.ninguna),
                    unidadSalida: derived.unidadSalida,
                    unidadTiempo: derived.unidadTiempo,
                }, centroRef);
                if (unidadError) {
                    throw new common_1.BadRequestException(unidadError);
                }
            }
        }
    }
    async resolveReferenceContext(auth, payload) {
        const operaciones = payload.operaciones ?? [];
        const centerIds = Array.from(new Set(operaciones
            .map((operacion) => operacion.centroCostoId)
            .filter((value) => Boolean(value))));
        const machineIds = Array.from(new Set(operaciones
            .flatMap((operacion) => [
            operacion.maquinaId,
            ...(operacion.niveles ?? []).map((nivel) => nivel.maquinaId),
        ])
            .filter((value) => Boolean(value))));
        const perfilIds = Array.from(new Set(operaciones
            .flatMap((operacion) => [
            operacion.perfilOperativoId,
            ...(operacion.niveles ?? []).map((nivel) => nivel.perfilOperativoId),
        ])
            .filter((value) => Boolean(value))));
        const [centros, maquinas, perfiles] = await Promise.all([
            centerIds.length
                ? this.prisma.centroCosto.findMany({
                    where: {
                        tenantId: auth.tenantId,
                        id: { in: centerIds },
                    },
                    select: {
                        id: true,
                        nombre: true,
                        unidadBaseFutura: true,
                    },
                })
                : Promise.resolve([]),
            machineIds.length
                ? this.prisma.maquina.findMany({
                    where: {
                        tenantId: auth.tenantId,
                        id: { in: machineIds },
                    },
                    select: {
                        id: true,
                        nombre: true,
                        plantilla: true,
                        centroCostoPrincipalId: true,
                        unidadProduccionPrincipal: true,
                    },
                })
                : Promise.resolve([]),
            perfilIds.length
                ? this.prisma.maquinaPerfilOperativo.findMany({
                    where: {
                        tenantId: auth.tenantId,
                        id: { in: perfilIds },
                    },
                    select: {
                        id: true,
                        nombre: true,
                        maquinaId: true,
                        productivityValue: true,
                        productivityUnit: true,
                        setupMin: true,
                        cleanupMin: true,
                        detalleJson: true,
                    },
                })
                : Promise.resolve([]),
        ]);
        const centroPrincipalIds = Array.from(new Set(maquinas
            .map((maquina) => maquina.centroCostoPrincipalId)
            .filter((value) => Boolean(value)))).filter((id) => !centros.some((centro) => centro.id === id));
        const centrosPrincipales = centroPrincipalIds.length
            ? await this.prisma.centroCosto.findMany({
                where: {
                    tenantId: auth.tenantId,
                    id: { in: centroPrincipalIds },
                },
                select: {
                    id: true,
                    nombre: true,
                    unidadBaseFutura: true,
                },
            })
            : [];
        const centrosConsolidados = [...centros, ...centrosPrincipales];
        if (centros.length !== centerIds.length) {
            throw new common_1.BadRequestException('Al menos un centro de costo asociado al proceso no existe.');
        }
        if (maquinas.length !== machineIds.length) {
            throw new common_1.BadRequestException('Al menos una maquina asociada al proceso no existe.');
        }
        if (perfiles.length !== perfilIds.length) {
            throw new common_1.BadRequestException('Al menos un perfil operativo asociado al proceso no existe.');
        }
        return {
            centrosById: new Map(centrosConsolidados.map((centro) => [centro.id, centro])),
            maquinasById: new Map(maquinas.map((maquina) => [maquina.id, maquina])),
            perfilesById: new Map(perfiles.map((perfil) => [perfil.id, perfil])),
        };
    }
    async findBibliotecaOperacionOrThrow(auth, id) {
        const item = await this.prisma.procesoOperacionPlantilla.findFirst({
            where: {
                id,
                tenantId: auth.tenantId,
            },
            include: {
                centroCosto: true,
                maquina: true,
                perfilOperativo: true,
            },
        });
        if (!item) {
            throw new common_1.NotFoundException('La plantilla de operacion no existe.');
        }
        return item;
    }
    async resolveBibliotecaOperacionReferences(auth, payload) {
        const resolveCentro = async (centroCostoId) => {
            if (!centroCostoId) {
                return null;
            }
            const centro = await this.prisma.centroCosto.findFirst({
                where: {
                    id: centroCostoId,
                    tenantId: auth.tenantId,
                },
                select: {
                    id: true,
                },
            });
            if (!centro) {
                throw new common_1.BadRequestException('El centro de costo seleccionado no existe para este tenant.');
            }
            return centro.id;
        };
        if (!payload.maquinaId) {
            const centroCostoId = await resolveCentro(payload.centroCostoId);
            return {
                centroCostoId,
                maquinaId: null,
                perfilOperativoId: null,
            };
        }
        const maquina = await this.prisma.maquina.findFirst({
            where: {
                id: payload.maquinaId,
                tenantId: auth.tenantId,
            },
            select: {
                id: true,
                centroCostoPrincipalId: true,
            },
        });
        if (!maquina) {
            throw new common_1.BadRequestException('La maquina seleccionada no existe para este tenant.');
        }
        const centroCostoId = maquina.centroCostoPrincipalId
            ? maquina.centroCostoPrincipalId
            : await resolveCentro(payload.centroCostoId);
        if (!payload.perfilOperativoId) {
            return {
                centroCostoId,
                maquinaId: payload.maquinaId,
                perfilOperativoId: null,
            };
        }
        const perfil = await this.prisma.maquinaPerfilOperativo.findFirst({
            where: {
                id: payload.perfilOperativoId,
                maquinaId: payload.maquinaId,
                tenantId: auth.tenantId,
            },
            select: {
                id: true,
            },
        });
        if (!perfil) {
            throw new common_1.BadRequestException('El perfil operativo no existe o no pertenece a la maquina seleccionada.');
        }
        return {
            centroCostoId,
            maquinaId: payload.maquinaId,
            perfilOperativoId: payload.perfilOperativoId,
        };
    }
    validateOperacionNivelesPayload(niveles, operationName) {
        for (const nivel of niveles) {
            const nombre = nivel.nombre?.trim();
            if (!nombre) {
                throw new common_1.BadRequestException(`Todos los niveles de ${operationName} requieren nombre.`);
            }
            const modo = nivel.modoProductividadNivel === 'variable_manual' ||
                nivel.modoProductividadNivel === 'variable_perfil'
                ? nivel.modoProductividadNivel
                : 'fija';
            if (nivel.setupMin !== undefined && nivel.setupMin < 0) {
                throw new common_1.BadRequestException(`El setup del nivel ${nombre} no puede ser negativo.`);
            }
            if (nivel.cleanupMin !== undefined && nivel.cleanupMin < 0) {
                throw new common_1.BadRequestException(`El cleanup del nivel ${nombre} no puede ser negativo.`);
            }
            if (modo === 'fija') {
                if (nivel.tiempoFijoMin === undefined || Number(nivel.tiempoFijoMin) <= 0) {
                    throw new common_1.BadRequestException(`El nivel ${nombre} debe definir Tiempo total (min).`);
                }
                if (nivel.maquinaId || nivel.perfilOperativoId) {
                    throw new common_1.BadRequestException(`El nivel ${nombre} en modo fija no puede usar máquina ni perfil.`);
                }
            }
            if (modo === 'variable_manual') {
                if (nivel.productividadBase === undefined || Number(nivel.productividadBase) <= 0) {
                    throw new common_1.BadRequestException(`El nivel ${nombre} debe definir Valor productividad.`);
                }
                if (!nivel.unidadSalida || !nivel.unidadTiempo) {
                    throw new common_1.BadRequestException(`El nivel ${nombre} debe definir Unidad de productividad.`);
                }
                if (nivel.maquinaId || nivel.perfilOperativoId) {
                    throw new common_1.BadRequestException(`El nivel ${nombre} en modo variable manual no puede usar máquina ni perfil.`);
                }
            }
            if (modo === 'variable_perfil') {
                if (!nivel.maquinaId || !nivel.perfilOperativoId) {
                    throw new common_1.BadRequestException(`El nivel ${nombre} debe definir máquina y perfil operativo.`);
                }
            }
        }
    }
    validateOperacionNivelesBusinessRules(operationName, niveles, references) {
        for (const nivel of niveles) {
            const modo = nivel.modoProductividadNivel === 'variable_manual' ||
                nivel.modoProductividadNivel === 'variable_perfil'
                ? nivel.modoProductividadNivel
                : 'fija';
            if (modo !== 'variable_perfil') {
                continue;
            }
            const nivelNombre = nivel.nombre?.trim() || 'sin nombre';
            const maquina = nivel.maquinaId ? references.maquinasById.get(nivel.maquinaId) : null;
            if (!maquina) {
                throw new common_1.BadRequestException(`La máquina del nivel ${nivelNombre} (${operationName}) no existe.`);
            }
            const perfil = nivel.perfilOperativoId
                ? references.perfilesById.get(nivel.perfilOperativoId)
                : null;
            if (!perfil) {
                throw new common_1.BadRequestException(`El perfil operativo del nivel ${nivelNombre} (${operationName}) no existe.`);
            }
            if (perfil.maquinaId !== maquina.id) {
                throw new common_1.BadRequestException(`El perfil operativo del nivel ${nivelNombre} (${operationName}) no pertenece a la máquina seleccionada.`);
            }
        }
    }
    async validateBibliotecaOperacionNivelReferences(auth, niveles) {
        const machineIds = Array.from(new Set(niveles
            .filter((nivel) => nivel.modoProductividadNivel === 'variable_perfil')
            .map((nivel) => nivel.maquinaId)
            .filter((value) => Boolean(value))));
        const perfilIds = Array.from(new Set(niveles
            .filter((nivel) => nivel.modoProductividadNivel === 'variable_perfil')
            .map((nivel) => nivel.perfilOperativoId)
            .filter((value) => Boolean(value))));
        if (!machineIds.length && !perfilIds.length) {
            return;
        }
        const [maquinas, perfiles] = await Promise.all([
            machineIds.length
                ? this.prisma.maquina.findMany({
                    where: { tenantId: auth.tenantId, id: { in: machineIds } },
                    select: { id: true },
                })
                : Promise.resolve([]),
            perfilIds.length
                ? this.prisma.maquinaPerfilOperativo.findMany({
                    where: { tenantId: auth.tenantId, id: { in: perfilIds } },
                    select: { id: true, maquinaId: true },
                })
                : Promise.resolve([]),
        ]);
        const machineSet = new Set(maquinas.map((item) => item.id));
        const perfilesMap = new Map(perfiles.map((item) => [item.id, item.maquinaId]));
        for (const nivel of niveles) {
            if (nivel.modoProductividadNivel !== 'variable_perfil') {
                continue;
            }
            const nivelNombre = nivel.nombre?.trim() || 'sin nombre';
            if (!nivel.maquinaId || !machineSet.has(nivel.maquinaId)) {
                throw new common_1.BadRequestException(`La máquina del nivel ${nivelNombre} no existe para este tenant.`);
            }
            const perfilMaquinaId = nivel.perfilOperativoId ? perfilesMap.get(nivel.perfilOperativoId) : null;
            if (!perfilMaquinaId) {
                throw new common_1.BadRequestException(`El perfil operativo del nivel ${nivelNombre} no existe para este tenant.`);
            }
            if (perfilMaquinaId !== nivel.maquinaId) {
                throw new common_1.BadRequestException(`El perfil operativo del nivel ${nivelNombre} no pertenece a la máquina seleccionada.`);
            }
        }
    }
    buildNivelResumen(input) {
        if (input.modoProductividadNivel === 'fija') {
            return `${input.nombre} · Fija · ${input.tiempoFijoMin ?? 0} min`;
        }
        if (input.modoProductividadNivel === 'variable_manual') {
            const unidad = [input.unidadSalida, input.unidadTiempo].filter(Boolean).join('/');
            return `${input.nombre} · Variable manual · ${input.productividadBase ?? 0} ${unidad}`.trim();
        }
        return `${input.nombre} · Variable por perfil${input.perfilOperativoNombre ? ` · ${input.perfilOperativoNombre}` : ''}`;
    }
    async findProcesoOrThrow(auth, id) {
        const proceso = await this.prisma.procesoDefinicion.findFirst({
            where: {
                id,
                tenantId: auth.tenantId,
            },
            include: {
                operaciones: {
                    include: {
                        centroCosto: true,
                        maquina: true,
                        perfilOperativo: true,
                    },
                    orderBy: {
                        orden: 'asc',
                    },
                },
            },
        });
        if (!proceso) {
            throw new common_1.NotFoundException('El proceso no existe.');
        }
        return proceso;
    }
    async findProcesoBaseOrThrow(auth, id) {
        const proceso = await this.prisma.procesoDefinicion.findFirst({
            where: {
                id,
                tenantId: auth.tenantId,
            },
            select: {
                id: true,
                codigo: true,
                activo: true,
                currentVersion: true,
            },
        });
        if (!proceso) {
            throw new common_1.NotFoundException('El proceso no existe.');
        }
        return proceso;
    }
    toProcesoResponse(proceso) {
        return {
            id: proceso.id,
            codigo: proceso.codigo,
            nombre: proceso.nombre,
            descripcion: proceso.descripcion ?? '',
            plantillaMaquinaria: proceso.plantillaMaquinaria
                ? this.toApiEnum(proceso.plantillaMaquinaria)
                : null,
            currentVersion: proceso.currentVersion,
            estadoConfiguracion: this.toApiEnum(proceso.estadoConfiguracion),
            activo: proceso.activo,
            observaciones: proceso.observaciones ?? '',
            advertencias: this.getProcessWarnings(proceso),
            operaciones: proceso.operaciones.map((operacion) => ({
                id: operacion.id,
                orden: operacion.orden,
                codigo: operacion.codigo,
                nombre: operacion.nombre,
                tipoOperacion: this.fromPrismaTipoOperacion(operacion.tipoOperacion),
                centroCostoId: operacion.centroCostoId,
                centroCostoNombre: operacion.centroCosto.nombre,
                maquinaId: operacion.maquinaId ?? '',
                maquinaNombre: operacion.maquina?.nombre ?? '',
                perfilOperativoId: operacion.perfilOperativoId ?? '',
                perfilOperativoNombre: operacion.perfilOperativo?.nombre ?? '',
                setupMin: this.decimalToNumberOrNull(operacion.setupMin),
                runMin: this.decimalToNumberOrNull(operacion.runMin),
                cleanupMin: this.decimalToNumberOrNull(operacion.cleanupMin),
                tiempoFijoMin: this.decimalToNumberOrNull(operacion.tiempoFijoMin),
                modoProductividad: this.toApiModoProductividad(operacion.modoProductividad),
                productividadBase: this.decimalToNumberOrNull(operacion.productividadBase),
                unidadEntrada: this.toApiEnum(operacion.unidadEntrada),
                unidadSalida: this.toApiEnum(operacion.unidadSalida),
                unidadTiempo: this.toApiEnum(operacion.unidadTiempo),
                mermaSetup: this.decimalToNumberOrNull(operacion.mermaSetup),
                mermaRunPct: this.decimalToNumberOrNull(operacion.mermaRunPct),
                reglaVelocidad: operacion.reglaVelocidadJson ??
                    null,
                reglaMerma: operacion.reglaMermaJson ?? null,
                detalle: this.getOperacionDetalle(operacion.detalleJson),
                baseCalculoProductividad: this.getOperacionDetalle(operacion.detalleJson)?.baseCalculoProductividad ??
                    null,
                niveles: this.getOperacionNiveles(operacion.detalleJson),
                activo: operacion.activo,
                warnings: this.getOperationWarnings(operacion),
            })),
            createdAt: proceso.createdAt.toISOString(),
            updatedAt: proceso.updatedAt.toISOString(),
        };
    }
    toBibliotecaOperacionResponse(item) {
        const detalleJson = item.detalleJson ?? null;
        return {
            id: item.id,
            nombre: item.nombre,
            tipoOperacion: this.fromPrismaTipoOperacion(item.tipoOperacion),
            centroCostoId: item.centroCostoId ?? null,
            centroCostoNombre: item.centroCosto?.nombre ?? '',
            maquinaId: item.maquinaId ?? null,
            maquinaNombre: item.maquina?.nombre ?? '',
            perfilOperativoId: item.perfilOperativoId ?? null,
            perfilOperativoNombre: item.perfilOperativo?.nombre ?? '',
            setupMin: this.decimalToNumberOrNull(item.setupMin),
            cleanupMin: this.decimalToNumberOrNull(item.cleanupMin),
            tiempoFijoMin: this.decimalToNumberOrNull(item.tiempoFijoMin),
            modoProductividad: this.toApiModoProductividad(item.modoProductividad),
            productividadBase: this.decimalToNumberOrNull(item.productividadBase),
            unidadEntrada: this.toApiEnum(item.unidadEntrada),
            unidadSalida: this.toApiEnum(item.unidadSalida),
            unidadTiempo: this.toApiEnum(item.unidadTiempo),
            mermaRunPct: this.decimalToNumberOrNull(item.mermaRunPct),
            reglaVelocidad: item.reglaVelocidadJson ?? null,
            reglaMerma: item.reglaMermaJson ?? null,
            detalle: this.getOperacionDetalle(detalleJson),
            baseCalculoProductividad: this.getOperacionDetalle(detalleJson)?.baseCalculoProductividad ?? null,
            observaciones: item.observaciones ?? '',
            niveles: this.getOperacionNiveles(detalleJson),
            activo: item.activo,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        };
    }
    getCentroRefForOperacionPayload(operacion, references) {
        if (operacion.centroCostoId) {
            return references.centrosById.get(operacion.centroCostoId) ?? null;
        }
        if (!operacion.maquinaId) {
            return null;
        }
        const maquina = references.maquinasById.get(operacion.maquinaId);
        if (!maquina?.centroCostoPrincipalId) {
            return null;
        }
        return references.centrosById.get(maquina.centroCostoPrincipalId) ?? null;
    }
    getCentroUnidadCompatibilityErrorForPayload(unidades, centro) {
        return this.getCentroUnidadCompatibilityMessage({
            centroNombre: centro.nombre,
            unidadBaseCentro: centro.unidadBaseFutura,
            unidadEntrada: unidades.unidadEntrada,
            unidadSalida: unidades.unidadSalida,
            unidadTiempo: unidades.unidadTiempo,
            mode: 'error',
        });
    }
    getCentroUnidadCompatibilityWarning(operacion) {
        return this.getCentroUnidadCompatibilityMessage({
            centroNombre: operacion.centroCosto.nombre,
            unidadBaseCentro: operacion.centroCosto.unidadBaseFutura,
            unidadEntrada: operacion.unidadEntrada,
            unidadSalida: operacion.unidadSalida,
            unidadTiempo: operacion.unidadTiempo,
            mode: 'warning',
        });
    }
    getCentroUnidadCompatibilityMessage(args) {
        if (args.unidadBaseCentro === client_1.UnidadBaseCentroCosto.NINGUNA) {
            return null;
        }
        const unidadesProceso = [args.unidadEntrada, args.unidadSalida];
        const hasUnidad = (allowed) => unidadesProceso.some((item) => allowed.includes(item));
        let isCompatible = true;
        if (args.unidadBaseCentro === client_1.UnidadBaseCentroCosto.HORA_HOMBRE ||
            args.unidadBaseCentro === client_1.UnidadBaseCentroCosto.HORA_MAQUINA) {
            isCompatible =
                args.unidadTiempo === client_1.UnidadProceso.HORA ||
                    args.unidadTiempo === client_1.UnidadProceso.MINUTO;
        }
        else if (args.unidadBaseCentro === client_1.UnidadBaseCentroCosto.PLIEGO) {
            isCompatible = hasUnidad([client_1.UnidadProceso.HOJA, client_1.UnidadProceso.A4_EQUIV]);
        }
        else if (args.unidadBaseCentro === client_1.UnidadBaseCentroCosto.UNIDAD) {
            isCompatible = hasUnidad([
                client_1.UnidadProceso.UNIDAD,
                client_1.UnidadProceso.PIEZA,
                client_1.UnidadProceso.CORTE,
                client_1.UnidadProceso.LOTE,
                client_1.UnidadProceso.CICLO,
            ]);
        }
        else if (args.unidadBaseCentro === client_1.UnidadBaseCentroCosto.M2) {
            isCompatible = hasUnidad([client_1.UnidadProceso.M2]);
        }
        else if (args.unidadBaseCentro === client_1.UnidadBaseCentroCosto.KG) {
            isCompatible = hasUnidad([client_1.UnidadProceso.KG]);
        }
        if (isCompatible) {
            return null;
        }
        if (args.mode === 'error') {
            return `La unidad del centro ${args.centroNombre} no es compatible con la unidad de la operacion.`;
        }
        return `Advertencia: la unidad del centro ${args.centroNombre} no coincide con la unidad operativa configurada.`;
    }
    getOperationWarnings(operacion) {
        const warnings = [];
        if (operacion.maquina?.centroCostoPrincipalId &&
            operacion.maquina.centroCostoPrincipalId !== operacion.centroCostoId) {
            warnings.push(`La maquina ${operacion.maquina.nombre} tiene otro centro principal; se usa el centro configurado en la operacion.`);
        }
        const unitWarning = this.getCentroUnidadCompatibilityWarning(operacion);
        if (unitWarning) {
            warnings.push(unitWarning);
        }
        return warnings;
    }
    getProcessWarnings(proceso) {
        return Array.from(new Set(proceso.operaciones.flatMap((operacion) => this.getOperationWarnings(operacion))));
    }
    toVersionSnapshot(proceso) {
        return {
            proceso: {
                id: proceso.id,
                codigo: proceso.codigo,
                nombre: proceso.nombre,
                descripcion: proceso.descripcion,
                plantillaMaquinaria: proceso.plantillaMaquinaria,
                currentVersion: proceso.currentVersion,
                estadoConfiguracion: proceso.estadoConfiguracion,
                activo: proceso.activo,
                observaciones: proceso.observaciones,
            },
            operaciones: proceso.operaciones.map((operacion) => ({
                id: operacion.id,
                orden: operacion.orden,
                codigo: operacion.codigo,
                nombre: operacion.nombre,
                tipoOperacion: this.fromPrismaTipoOperacion(operacion.tipoOperacion),
                centroCostoId: operacion.centroCostoId,
                maquinaId: operacion.maquinaId,
                perfilOperativoId: operacion.perfilOperativoId,
                setupMin: this.decimalToNumberOrNull(operacion.setupMin),
                runMin: this.decimalToNumberOrNull(operacion.runMin),
                cleanupMin: this.decimalToNumberOrNull(operacion.cleanupMin),
                tiempoFijoMin: this.decimalToNumberOrNull(operacion.tiempoFijoMin),
                modoProductividad: operacion.modoProductividad,
                productividadBase: this.decimalToNumberOrNull(operacion.productividadBase),
                unidadEntrada: operacion.unidadEntrada,
                unidadSalida: operacion.unidadSalida,
                unidadTiempo: operacion.unidadTiempo,
                mermaSetup: this.decimalToNumberOrNull(operacion.mermaSetup),
                mermaRunPct: this.decimalToNumberOrNull(operacion.mermaRunPct),
                reglaVelocidadJson: operacion.reglaVelocidadJson,
                reglaMermaJson: operacion.reglaMermaJson,
                detalleJson: operacion.detalleJson,
                activo: operacion.activo,
            })),
            createdAt: new Date().toISOString(),
        };
    }
    handleWriteError(error) {
        if (error instanceof library_1.PrismaClientKnownRequestError &&
            error.code === 'P2002') {
            throw new common_1.ConflictException('Ya existe un proceso con ese codigo.');
        }
        if (error instanceof library_1.PrismaClientKnownRequestError &&
            error.code === 'P2000') {
            throw new common_1.BadRequestException('Al menos un valor cargado supera el formato permitido.');
        }
        if (error instanceof library_1.PrismaClientKnownRequestError &&
            (error.code === 'P2005' ||
                error.code === 'P2006' ||
                error.code === 'P2009')) {
            throw new common_1.BadRequestException('Hay datos invalidos en la carga. Revisa campos numericos y opciones seleccionadas.');
        }
        throw error;
    }
    handleBibliotecaWriteError(error) {
        if (this.isBibliotecaStorageMissingError(error)) {
            throw new common_1.BadRequestException('La base actual no tiene la estructura de Biblioteca de operaciones. Ejecuta las migraciones pendientes del API.');
        }
        this.handleWriteError(error);
    }
    isBibliotecaStorageMissingError(error) {
        return (error instanceof library_1.PrismaClientKnownRequestError &&
            (error.code === 'P2021' || error.code === 'P2022'));
    }
    isCodigoConflictError(error) {
        return (error instanceof library_1.PrismaClientKnownRequestError &&
            error.code === 'P2002' &&
            Array.isArray(error.meta?.target) &&
            error.meta?.target.includes('tenantId') &&
            error.meta?.target.includes('codigo'));
    }
    generateCodigoProceso() {
        const randomChunk = (0, node_crypto_1.randomUUID)()
            .replace(/-/g, '')
            .slice(0, 8)
            .toUpperCase();
        return `${ProcesosService_1.CODIGO_PREFIX}-${randomChunk}`;
    }
    normalizePeriodo(periodo) {
        if (!periodo || !DEFAULT_PERIOD_REGEX.test(periodo)) {
            throw new common_1.BadRequestException('El periodo debe tener formato YYYY-MM.');
        }
        return periodo;
    }
    toDecimal(value) {
        if (value === undefined || value === null) {
            return null;
        }
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            return null;
        }
        return new client_1.Prisma.Decimal(numeric);
    }
    decimalToNumber(value) {
        return value === null || value === undefined ? 0 : Number(value);
    }
    decimalToNumberOrNull(value) {
        return value === null || value === undefined ? null : Number(value);
    }
    toNullableJson(value) {
        if (!value) {
            return client_1.Prisma.JsonNull;
        }
        return value;
    }
    toPrismaEnum(value) {
        return value.toUpperCase();
    }
    toApiEnum(value) {
        return value.toLowerCase();
    }
    toApiModoProductividad(value) {
        if (value === client_1.ModoProductividadProceso.FIJA) {
            return upsert_proceso_dto_1.ModoProductividadProcesoDto.fija;
        }
        return upsert_proceso_dto_1.ModoProductividadProcesoDto.variable;
    }
    parseFiniteNumber(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim().length > 0) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }
};
exports.ProcesosService = ProcesosService;
exports.ProcesosService = ProcesosService = ProcesosService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProcesosService);
//# sourceMappingURL=procesos.service.js.map