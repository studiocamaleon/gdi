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
const pagination_dto_1 = require("../common/dto/pagination.dto");
const prisma_service_1 = require("../prisma/prisma.service");
const familias_1 = require("../productos-servicios/pasos/familias");
const upsert_proceso_dto_1 = require("./dto/upsert-proceso.dto");
const proceso_productividad_engine_1 = require("./proceso-productividad.engine");
const MATERIAL_INCLUDE = {
    materiaPrimaVariante: {
        select: {
            id: true,
            sku: true,
            nombreVariante: true,
            precioReferencia: true,
        },
    },
    productoComponente: {
        select: {
            id: true,
            codigo: true,
            nombre: true,
            modoMedidas: true,
        },
    },
    varianteComponente: {
        select: {
            id: true,
            nombre: true,
            anchoMm: true,
            altoMm: true,
        },
    },
    variantesHabilitadas: {
        where: { activo: true },
        orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
        include: {
            materiaPrimaVariante: {
                select: {
                    id: true,
                    sku: true,
                    nombreVariante: true,
                    precioReferencia: true,
                    atributosVarianteJson: true,
                    activo: true,
                    materiaPrimaId: true,
                },
            },
        },
    },
};
const MATERIAL_INCLUDE_PAYLOAD = { include: MATERIAL_INCLUDE };
const OPERACION_INCLUDE = {
    centroCosto: true,
    maquina: true,
    perfilOperativo: true,
    plantillaOrigen: true,
};
const DEFAULT_PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
function mapModoProductividadDto(dto) {
    if (dto === upsert_proceso_dto_1.ModoProductividadProcesoDto.tiempo_fijo) {
        return client_1.ModoProductividadProceso.TIEMPO_FIJO;
    }
    if (dto === upsert_proceso_dto_1.ModoProductividadProcesoDto.productividad_maquina) {
        return client_1.ModoProductividadProceso.PRODUCTIVIDAD_MAQUINA;
    }
    if (dto === upsert_proceso_dto_1.ModoProductividadProcesoDto.formula) {
        return client_1.ModoProductividadProceso.FORMULA;
    }
    return client_1.ModoProductividadProceso.FIJA;
}
let ProcesosService = class ProcesosService {
    static { ProcesosService_1 = this; }
    prisma;
    static CODIGO_PREFIX = 'PRO';
    static CODIGO_MAX_RETRIES = 5;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(auth, pagination) {
        const where = { tenantId: auth.tenantId };
        const [procesos, total] = await this.prisma.$transaction([
            this.prisma.procesoDefinicion.findMany({
                where,
                include: {
                    operaciones: {
                        include: {
                            centroCosto: true,
                            maquina: true,
                            perfilOperativo: true,
                            plantillaOrigen: true,
                        },
                        orderBy: { orden: 'asc' },
                    },
                },
                orderBy: [{ nombre: 'asc' }],
                skip: pagination.skip,
                take: pagination.limit,
            }),
            this.prisma.procesoDefinicion.count({ where }),
        ]);
        return (0, pagination_dto_1.paginatedResponse)(procesos.map((proceso) => this.toProcesoResponse(proceso)), total, pagination);
    }
    findAllFamilias() {
        return Object.values(familias_1.FAMILIAS_PASO).map((f) => ({
            codigo: f.codigo,
            nombre: f.nombre,
            descripcion: f.descripcion,
            categoria: f.categoria,
            ejemplos: f.ejemplos,
            modoNesting: f.modoNesting,
            nestingAlgoritmo: f.nestingAlgoritmo,
            dimensionProductivaCanonica: f.dimensionProductivaCanonica,
            dimensionDisplay: f.dimensionDisplay,
            outputsCanonicos: f.outputsCanonicos,
            requiereCentroCosto: f.requiereCentroCosto,
        }));
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
                    estacion: true,
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
    async bulkAssignEstacionPlantillas(auth, dto) {
        if (dto.estacionId) {
            const estacion = await this.prisma.estacion.findFirst({
                where: { id: dto.estacionId, tenantId: auth.tenantId },
            });
            if (!estacion) {
                throw new common_1.BadRequestException('La estacion seleccionada no existe.');
            }
        }
        await this.prisma.procesoOperacionPlantilla.updateMany({
            where: {
                id: { in: dto.ids },
                tenantId: auth.tenantId,
            },
            data: {
                estacionId: dto.estacionId ?? null,
            },
        });
        return this.findAllBibliotecaOperaciones(auth);
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
            const cleanupMin = this.decimalToNumber(derived.cleanupMin);
            const tiempoFijoMin = this.decimalToNumber(derived.tiempoFijoMin);
            const tarifa = tarifaByCentroId.get(operacion.centroCostoId);
            const tarifaNumero = tarifa ? Number(tarifa) : null;
            const usarTiempoFijoManual = (operacion.modoProductividad === client_1.ModoProductividadProceso.TIEMPO_FIJO ||
                operacion.modoProductividad === client_1.ModoProductividadProceso.FIJA) &&
                tiempoFijoMin > 0 &&
                (derived.productividadBase == null ||
                    this.decimalToNumber(derived.productividadBase) <= 0);
            let runMin = this.decimalToNumber(operacion.runMin);
            const productividadWarnings = [];
            let productividadAplicada = null;
            let cantidadRun = 0;
            let mermaSetupAplicada = this.decimalToNumber(operacion.mermaSetup);
            let mermaRunPctAplicada = this.decimalToNumber(operacion.mermaRunPct);
            if (!usarTiempoFijoManual) {
                const productividad = (0, proceso_productividad_engine_1.evaluateProductividad)({
                    modoProductividad: operacion.modoProductividad ?? client_1.ModoProductividadProceso.FIJA,
                    productividadBase: derived.productividadBase,
                    reglaVelocidadJson: null,
                    reglaMermaJson: operacion.reglaMermaJson,
                    runMin: operacion.runMin,
                    tiempoFijoMin: operacion.tiempoFijoMin,
                    unidadTiempo: derived.unidadTiempo,
                    mermaRunPct: operacion.mermaRunPct,
                    mermaSetup: operacion.mermaSetup,
                    cantidadObjetivoSalida: cantidadObjetivo,
                    contexto,
                    perfilProductivityValue: operacion.perfilOperativo?.productivityValue ?? null,
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
                                plantillaOrigen: true,
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
                        plantillaOrigen: true,
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
                            plantillaOrigen: true,
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
        const estadoConfiguracion = this.getDerivedEstadoConfiguracion(payload, references);
        return {
            tenantId: auth.tenantId,
            codigo: forcedCodigo,
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
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
            multiplicadorDobleFaz: this.toDecimal(payload.multiplicadorDobleFaz),
            modoProductividad: this.resolveModoProductividadFromPayload(payload),
            productividadBase: derived.productividadBase,
            unidadEntrada: this.toPrismaEnum(payload.unidadEntrada ?? upsert_proceso_dto_1.UnidadProcesoDto.ninguna),
            unidadSalida: derived.unidadSalida,
            unidadTiempo: derived.unidadTiempo,
            mermaSetup: this.toDecimal(payload.mermaSetup),
            mermaRunPct: this.toDecimal(payload.mermaRunPct),
            reglaVelocidadJson: undefined,
            reglaMermaJson: this.toNullableJson(payload.reglaMerma),
            detalleJson: this.buildOperacionDetalleJson(payload.detalle, payload.baseCalculoProductividad),
            rol: payload.rol ? this.toPrismaRol(payload.rol) : null,
            esOpcional: payload.esOpcional ?? false,
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
            estacionId: refs.estacionId,
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
            detalleJson: this.buildOperacionDetalleJson(undefined, payload.baseCalculoProductividad),
            observaciones: payload.observaciones?.trim() || null,
            familiaV2: payload.familiaV2?.trim() || null,
            unidadProductivaV2: payload.unidadProductivaV2?.trim() || null,
            activacionV2: payload.activacionV2 ?? null,
            condicionV2: payload.condicionV2 != null ? payload.condicionV2 : client_1.Prisma.JsonNull,
            leeDelTrabajoV2: payload.leeDelTrabajoV2 != null ? payload.leeDelTrabajoV2 : client_1.Prisma.JsonNull,
            leeDePasosV2: payload.leeDePasosV2 != null ? payload.leeDePasosV2 : client_1.Prisma.JsonNull,
            produceV2: payload.produceV2 != null ? payload.produceV2 : client_1.Prisma.JsonNull,
            configNestingV2: payload.configNestingV2 != null ? payload.configNestingV2 : client_1.Prisma.JsonNull,
            activo: payload.activo,
        };
    }
    toPrismaTipoOperacion(value) {
        switch (value) {
            case upsert_proceso_dto_1.TipoOperacionProcesoDto.preprensa:
            case upsert_proceso_dto_1.TipoOperacionProcesoDto.servicio:
                return client_1.TipoOperacionProceso.PREPRENSA;
            case upsert_proceso_dto_1.TipoOperacionProcesoDto.prensa:
                return client_1.TipoOperacionProceso.IMPRESION;
            case upsert_proceso_dto_1.TipoOperacionProcesoDto.postprensa:
            case upsert_proceso_dto_1.TipoOperacionProcesoDto.acabado:
                return client_1.TipoOperacionProceso.TERMINACION;
            case upsert_proceso_dto_1.TipoOperacionProcesoDto.instalacion:
                return client_1.TipoOperacionProceso.LOGISTICA;
            case upsert_proceso_dto_1.TipoOperacionProcesoDto.entrega_despacho:
                return client_1.TipoOperacionProceso.EMPAQUE;
            default:
                return client_1.TipoOperacionProceso.PREPRENSA;
        }
    }
    fromPrismaTipoOperacion(value) {
        switch (value) {
            case client_1.TipoOperacionProceso.PREPRENSA:
                return upsert_proceso_dto_1.TipoOperacionProcesoDto.preprensa;
            case client_1.TipoOperacionProceso.IMPRESION:
                return upsert_proceso_dto_1.TipoOperacionProcesoDto.prensa;
            case client_1.TipoOperacionProceso.TERMINACION:
                return upsert_proceso_dto_1.TipoOperacionProcesoDto.postprensa;
            case client_1.TipoOperacionProceso.LOGISTICA:
                return upsert_proceso_dto_1.TipoOperacionProcesoDto.instalacion;
            case client_1.TipoOperacionProceso.EMPAQUE:
                return upsert_proceso_dto_1.TipoOperacionProcesoDto.entrega_despacho;
            default:
                return upsert_proceso_dto_1.TipoOperacionProcesoDto.preprensa;
        }
    }
    toPrismaRol(value) {
        switch (value) {
            case upsert_proceso_dto_1.RolProcesoOperacionDto.impresion:
                return client_1.RolProcesoOperacion.IMPRESION;
            default:
                return client_1.RolProcesoOperacion.IMPRESION;
        }
    }
    fromPrismaRol(value) {
        switch (value) {
            case client_1.RolProcesoOperacion.IMPRESION:
                return upsert_proceso_dto_1.RolProcesoOperacionDto.impresion;
            default:
                return upsert_proceso_dto_1.RolProcesoOperacionDto.impresion;
        }
    }
    buildOperacionDetalleJson(detalle, baseCalculoProductividad) {
        const base = detalle && typeof detalle === 'object' && !Array.isArray(detalle) ? { ...detalle } : {};
        if (baseCalculoProductividad) {
            base.baseCalculoProductividad = baseCalculoProductividad;
        }
        return this.toNullableJson(base);
    }
    getOperacionDetalle(detalleJson) {
        if (!detalleJson || typeof detalleJson !== 'object' || Array.isArray(detalleJson)) {
            return null;
        }
        const detalle = { ...detalleJson };
        return Object.keys(detalle).length > 0 ? detalle : null;
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
        return mapModoProductividadDto(payload.modoProductividad);
    }
    resolveModoProductividadFromBibliotecaPayload(payload) {
        return mapModoProductividadDto(payload.modoProductividad);
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
        const plantilla = operacion.plantillaOrigen ?? null;
        const productividadBase = operacion.productividadBase ??
            plantilla?.productividadBase ??
            operacion.perfilOperativo?.productivityValue ??
            (operacion.maquina?.plantilla === client_1.PlantillaMaquinaria.LAMINADORA_BOPP_ROLLO &&
                velocidadTrabajoMmSegPerfil !== null
                ? new client_1.Prisma.Decimal(velocidadTrabajoMmSegPerfil)
                : null) ??
            null;
        const fallbackSetup = this.getSetupFromPerfilPersisted(operacion.perfilOperativo);
        const setupMin = operacion.setupMin ?? plantilla?.setupMin ?? fallbackSetup ?? null;
        const cleanupMin = operacion.cleanupMin ??
            plantilla?.cleanupMin ??
            operacion.perfilOperativo?.cleanupMin ??
            null;
        const tiempoFijoMin = operacion.tiempoFijoMin ?? plantilla?.tiempoFijoMin ?? null;
        const absorptionWarnings = [];
        if (operacion.productividadBase === null && plantilla?.productividadBase) {
            absorptionWarnings.push(`Se uso productividad heredada de la plantilla "${plantilla.nombre}".`);
        }
        else if (!operacion.productividadBase &&
            (operacion.perfilOperativo?.productivityValue ||
                (operacion.maquina?.plantilla === client_1.PlantillaMaquinaria.LAMINADORA_BOPP_ROLLO &&
                    velocidadTrabajoMmSegPerfil !== null &&
                    velocidadTrabajoMmSegPerfil > 0))) {
            absorptionWarnings.push(`Se uso productividad del perfil operativo ${operacion.perfilOperativo?.nombre ?? 'sin nombre'}.`);
        }
        if (operacion.setupMin === null && plantilla?.setupMin !== null && plantilla?.setupMin !== undefined) {
            absorptionWarnings.push(`Se uso setup heredado de la plantilla "${plantilla.nombre}".`);
        }
        else if (operacion.setupMin === null &&
            fallbackSetup !== null &&
            operacion.perfilOperativo) {
            absorptionWarnings.push(`Se uso setup del perfil operativo ${operacion.perfilOperativo.nombre}.`);
        }
        if (operacion.cleanupMin === null && plantilla?.cleanupMin !== null && plantilla?.cleanupMin !== undefined) {
            absorptionWarnings.push(`Se uso cleanup heredado de la plantilla "${plantilla.nombre}".`);
        }
        else if (operacion.cleanupMin === null &&
            cleanupMin !== null &&
            operacion.perfilOperativo) {
            absorptionWarnings.push(`Se uso cleanup del perfil operativo ${operacion.perfilOperativo.nombre}.`);
        }
        if (operacion.tiempoFijoMin === null &&
            plantilla?.tiempoFijoMin !== null &&
            plantilla?.tiempoFijoMin !== undefined) {
            absorptionWarnings.push(`Se uso tiempo fijo heredado de la plantilla "${plantilla.nombre}".`);
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
            tiempoFijoMin,
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
            .map((operacion) => operacion.maquinaId)
            .filter((value) => Boolean(value))));
        const perfilIds = Array.from(new Set(operaciones
            .map((operacion) => operacion.perfilOperativoId)
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
                estacion: true,
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
        const resolveEstacion = async (estacionId) => {
            if (!estacionId) {
                return null;
            }
            const estacion = await this.prisma.estacion.findFirst({
                where: {
                    id: estacionId,
                    tenantId: auth.tenantId,
                },
                select: { id: true },
            });
            if (!estacion) {
                throw new common_1.BadRequestException('La estacion seleccionada no existe para este tenant.');
            }
            return estacion.id;
        };
        const estacionId = await resolveEstacion(payload.estacionId);
        if (!payload.maquinaId) {
            const centroCostoId = await resolveCentro(payload.centroCostoId);
            return {
                centroCostoId,
                maquinaId: null,
                perfilOperativoId: null,
                estacionId,
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
                estacionId,
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
            estacionId,
        };
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
                        plantillaOrigen: true,
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
                multiplicadorDobleFaz: this.decimalToNumberOrNull(operacion.multiplicadorDobleFaz),
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
                rol: operacion.rol ? this.fromPrismaRol(operacion.rol) : null,
                esOpcional: operacion.esOpcional,
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
            maquinaPlantilla: item.maquina?.plantilla ?? null,
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
            estacionId: item.estacionId ?? null,
            estacionNombre: item.estacion?.nombre ?? '',
            familiaV2: item.familiaV2 ?? null,
            unidadProductivaV2: item.unidadProductivaV2 ?? null,
            activacionV2: item.activacionV2 ?? null,
            condicionV2: item.condicionV2 ?? null,
            leeDelTrabajoV2: item.leeDelTrabajoV2 ?? null,
            leeDePasosV2: item.leeDePasosV2 ?? null,
            produceV2: item.produceV2 ?? null,
            configNestingV2: item.configNestingV2 ?? null,
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
                multiplicadorDobleFaz: this.decimalToNumberOrNull(operacion.multiplicadorDobleFaz),
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
        if (value === client_1.ModoProductividadProceso.TIEMPO_FIJO) {
            return upsert_proceso_dto_1.ModoProductividadProcesoDto.tiempo_fijo;
        }
        if (value === client_1.ModoProductividadProceso.PRODUCTIVIDAD_MAQUINA) {
            return upsert_proceso_dto_1.ModoProductividadProcesoDto.productividad_maquina;
        }
        if (value === client_1.ModoProductividadProceso.FORMULA) {
            return upsert_proceso_dto_1.ModoProductividadProcesoDto.formula;
        }
        return upsert_proceso_dto_1.ModoProductividadProcesoDto.fija;
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
    async listAlternativas(auth, operacionId) {
        await this.findOperacionOrThrow(auth, operacionId);
        const alternativas = await this.prisma.procesoOperacionAlternativa.findMany({
            where: { tenantId: auth.tenantId, procesoOperacionId: operacionId },
            include: { maquina: true, perfilOperativo: true },
            orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
        });
        return alternativas.map((a) => this.toAlternativaResponse(a));
    }
    async createAlternativa(auth, operacionId, payload) {
        await this.findOperacionOrThrow(auth, operacionId);
        await this.validateAlternativaReferences(auth, payload);
        if (payload.esDefault) {
            await this.clearEsDefault(auth.tenantId, operacionId);
        }
        const created = await this.prisma.procesoOperacionAlternativa.create({
            data: {
                tenantId: auth.tenantId,
                procesoOperacionId: operacionId,
                maquinaId: payload.maquinaId ?? null,
                perfilOperativoId: payload.perfilOperativoId ?? null,
                label: payload.label.trim(),
                esDefault: Boolean(payload.esDefault),
                orden: typeof payload.orden === 'number' ? payload.orden : 0,
                activo: payload.activo ?? true,
                setupMin: payload.setupMin != null ? new client_1.Prisma.Decimal(payload.setupMin) : null,
                cleanupMin: payload.cleanupMin != null ? new client_1.Prisma.Decimal(payload.cleanupMin) : null,
                tiempoFijoMin: payload.tiempoFijoMin != null ? new client_1.Prisma.Decimal(payload.tiempoFijoMin) : null,
                productividadBase: payload.productividadBase != null
                    ? new client_1.Prisma.Decimal(payload.productividadBase)
                    : null,
                configNestingV2: payload.configNestingV2 != null
                    ? payload.configNestingV2
                    : client_1.Prisma.JsonNull,
            },
            include: { maquina: true, perfilOperativo: true },
        });
        return this.toAlternativaResponse(created);
    }
    async updateAlternativa(auth, operacionId, alternativaId, payload) {
        await this.findAlternativaOrThrow(auth, operacionId, alternativaId);
        await this.validateAlternativaReferences(auth, payload);
        if (payload.esDefault) {
            await this.clearEsDefault(auth.tenantId, operacionId, alternativaId);
        }
        const updated = await this.prisma.procesoOperacionAlternativa.update({
            where: { id: alternativaId },
            data: {
                maquinaId: payload.maquinaId ?? null,
                perfilOperativoId: payload.perfilOperativoId ?? null,
                label: payload.label.trim(),
                esDefault: Boolean(payload.esDefault),
                orden: typeof payload.orden === 'number' ? payload.orden : 0,
                activo: payload.activo ?? true,
                setupMin: payload.setupMin != null ? new client_1.Prisma.Decimal(payload.setupMin) : null,
                cleanupMin: payload.cleanupMin != null ? new client_1.Prisma.Decimal(payload.cleanupMin) : null,
                tiempoFijoMin: payload.tiempoFijoMin != null ? new client_1.Prisma.Decimal(payload.tiempoFijoMin) : null,
                productividadBase: payload.productividadBase != null
                    ? new client_1.Prisma.Decimal(payload.productividadBase)
                    : null,
                configNestingV2: payload.configNestingV2 != null
                    ? payload.configNestingV2
                    : client_1.Prisma.JsonNull,
            },
            include: { maquina: true, perfilOperativo: true },
        });
        return this.toAlternativaResponse(updated);
    }
    async deleteAlternativa(auth, operacionId, alternativaId) {
        await this.findAlternativaOrThrow(auth, operacionId, alternativaId);
        await this.prisma.procesoOperacionAlternativa.delete({
            where: { id: alternativaId },
        });
        return { ok: true };
    }
    async findOperacionOrThrow(auth, operacionId) {
        const op = await this.prisma.procesoOperacion.findFirst({
            where: { id: operacionId, tenantId: auth.tenantId },
            select: { id: true },
        });
        if (!op) {
            throw new common_1.NotFoundException('La operación del proceso no existe.');
        }
        return op;
    }
    async findAlternativaOrThrow(auth, operacionId, alternativaId) {
        const alt = await this.prisma.procesoOperacionAlternativa.findFirst({
            where: {
                id: alternativaId,
                tenantId: auth.tenantId,
                procesoOperacionId: operacionId,
            },
        });
        if (!alt) {
            throw new common_1.NotFoundException('La alternativa no existe para esta operación.');
        }
        return alt;
    }
    async validateAlternativaReferences(auth, payload) {
        if (payload.maquinaId) {
            const maquina = await this.prisma.maquina.findFirst({
                where: { id: payload.maquinaId, tenantId: auth.tenantId },
                select: { id: true },
            });
            if (!maquina) {
                throw new common_1.BadRequestException('La máquina indicada no existe.');
            }
        }
        else if (payload.perfilOperativoId) {
            throw new common_1.BadRequestException('No se puede asignar un perfil operativo a una alternativa sin máquina.');
        }
        if (payload.perfilOperativoId && payload.maquinaId) {
            const perfil = await this.prisma.maquinaPerfilOperativo.findFirst({
                where: {
                    id: payload.perfilOperativoId,
                    tenantId: auth.tenantId,
                    maquinaId: payload.maquinaId,
                },
                select: { id: true },
            });
            if (!perfil) {
                throw new common_1.BadRequestException('El perfil operativo no existe o no pertenece a la máquina indicada.');
            }
        }
    }
    async clearEsDefault(tenantId, operacionId, excludeId) {
        await this.prisma.procesoOperacionAlternativa.updateMany({
            where: {
                tenantId,
                procesoOperacionId: operacionId,
                esDefault: true,
                ...(excludeId ? { NOT: { id: excludeId } } : {}),
            },
            data: { esDefault: false },
        });
    }
    toAlternativaResponse(a) {
        return {
            id: a.id,
            procesoOperacionId: a.procesoOperacionId,
            label: a.label,
            esDefault: a.esDefault,
            orden: a.orden,
            activo: a.activo,
            maquinaId: a.maquinaId,
            perfilOperativoId: a.perfilOperativoId,
            maquina: a.maquina
                ? { id: a.maquina.id, nombre: a.maquina.nombre, plantilla: a.maquina.plantilla }
                : null,
            perfilOperativo: a.perfilOperativo
                ? { id: a.perfilOperativo.id, nombre: a.perfilOperativo.nombre }
                : null,
            setupMin: a.setupMin != null ? Number(a.setupMin) : null,
            cleanupMin: a.cleanupMin != null ? Number(a.cleanupMin) : null,
            tiempoFijoMin: a.tiempoFijoMin != null ? Number(a.tiempoFijoMin) : null,
            productividadBase: a.productividadBase != null ? Number(a.productividadBase) : null,
            configNestingV2: a.configNestingV2 ?? null,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
        };
    }
    async listMateriales(auth, operacionId) {
        await this.findOperacionOrThrow(auth, operacionId);
        const materiales = await this.prisma.procesoOperacionMaterial.findMany({
            where: { tenantId: auth.tenantId, procesoOperacionId: operacionId },
            include: MATERIAL_INCLUDE,
            orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
        });
        return materiales.map((m) => this.toMaterialResponse(m));
    }
    async createMaterial(auth, operacionId, payload) {
        await this.findOperacionOrThrow(auth, operacionId);
        await this.validateMaterialReferences(auth, payload);
        await this.validateUniqueSustratoPorPaso(auth, operacionId, payload, null);
        const created = await this.prisma.$transaction(async (tx) => {
            const row = await tx.procesoOperacionMaterial.create({
                data: {
                    tenantId: auth.tenantId,
                    procesoOperacionId: operacionId,
                    materiaPrimaVarianteId: payload.materiaPrimaVarianteId ?? null,
                    productoComponenteId: payload.productoComponenteId ?? null,
                    varianteComponenteId: payload.varianteComponenteId ?? null,
                    nombre: payload.nombre.trim(),
                    formula: payload.formula,
                    cantidadPorUnidad: new client_1.Prisma.Decimal(payload.cantidadPorUnidad),
                    unidad: payload.unidad.trim(),
                    precioManual: payload.precioManual != null
                        ? new client_1.Prisma.Decimal(payload.precioManual)
                        : null,
                    aplicaMultiCaras: Boolean(payload.aplicaMultiCaras),
                    esSustratoNesting: Boolean(payload.esSustratoNesting),
                    orden: typeof payload.orden === 'number' ? payload.orden : 0,
                    activo: payload.activo ?? true,
                },
            });
            await this.syncVariantesHabilitadas(tx, auth, row.id, payload);
            return tx.procesoOperacionMaterial.findUniqueOrThrow({
                where: { id: row.id },
                include: MATERIAL_INCLUDE,
            });
        });
        return this.toMaterialResponse(created);
    }
    async updateMaterial(auth, operacionId, materialId, payload) {
        await this.findMaterialOrThrow(auth, operacionId, materialId);
        await this.validateMaterialReferences(auth, payload);
        await this.validateUniqueSustratoPorPaso(auth, operacionId, payload, materialId);
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.procesoOperacionMaterial.update({
                where: { id: materialId },
                data: {
                    materiaPrimaVarianteId: payload.materiaPrimaVarianteId ?? null,
                    productoComponenteId: payload.productoComponenteId ?? null,
                    varianteComponenteId: payload.varianteComponenteId ?? null,
                    nombre: payload.nombre.trim(),
                    formula: payload.formula,
                    cantidadPorUnidad: new client_1.Prisma.Decimal(payload.cantidadPorUnidad),
                    unidad: payload.unidad.trim(),
                    precioManual: payload.precioManual != null
                        ? new client_1.Prisma.Decimal(payload.precioManual)
                        : null,
                    aplicaMultiCaras: Boolean(payload.aplicaMultiCaras),
                    esSustratoNesting: Boolean(payload.esSustratoNesting),
                    orden: typeof payload.orden === 'number' ? payload.orden : 0,
                    activo: payload.activo ?? true,
                },
            });
            await this.syncVariantesHabilitadas(tx, auth, materialId, payload);
            return tx.procesoOperacionMaterial.findUniqueOrThrow({
                where: { id: materialId },
                include: MATERIAL_INCLUDE,
            });
        });
        return this.toMaterialResponse(updated);
    }
    async deleteMaterial(auth, operacionId, materialId) {
        await this.findMaterialOrThrow(auth, operacionId, materialId);
        await this.prisma.procesoOperacionMaterial.delete({ where: { id: materialId } });
        return { ok: true };
    }
    async findMaterialOrThrow(auth, operacionId, materialId) {
        const mat = await this.prisma.procesoOperacionMaterial.findFirst({
            where: {
                id: materialId,
                tenantId: auth.tenantId,
                procesoOperacionId: operacionId,
            },
        });
        if (!mat) {
            throw new common_1.NotFoundException('El material no existe para esta operación.');
        }
        return mat;
    }
    async validateMaterialReferences(auth, payload) {
        if (payload.materiaPrimaVarianteId && payload.productoComponenteId) {
            throw new common_1.BadRequestException('Un material no puede ser a la vez materia prima y sub-producto.');
        }
        if (!payload.productoComponenteId && payload.varianteComponenteId) {
            throw new common_1.BadRequestException('La varianteComponente solo es válida si hay productoComponente.');
        }
        if (payload.materiaPrimaVarianteId) {
            const mp = await this.prisma.materiaPrimaVariante.findFirst({
                where: { id: payload.materiaPrimaVarianteId, tenantId: auth.tenantId },
                select: { id: true },
            });
            if (!mp) {
                throw new common_1.BadRequestException('La variante de materia prima no existe.');
            }
        }
        if (payload.productoComponenteId) {
            const comp = await this.prisma.productoServicio.findFirst({
                where: { id: payload.productoComponenteId, tenantId: auth.tenantId },
                select: { id: true },
            });
            if (!comp) {
                throw new common_1.BadRequestException('El producto componente no existe.');
            }
            if (payload.varianteComponenteId) {
                const v = await this.prisma.productoVariante.findFirst({
                    where: {
                        id: payload.varianteComponenteId,
                        tenantId: auth.tenantId,
                        productoServicioId: payload.productoComponenteId,
                    },
                    select: { id: true },
                });
                if (!v) {
                    throw new common_1.BadRequestException('La variante del componente no existe o no pertenece al producto indicado.');
                }
            }
        }
        if (payload.esSustratoNesting) {
            if (payload.productoComponenteId) {
                throw new common_1.BadRequestException('Un sub-producto no puede declararse como sustrato del nesting.');
            }
            const variantes = payload.variantesHabilitadas ?? [];
            if (variantes.length === 0) {
                throw new common_1.BadRequestException('Un material declarado como sustrato del nesting requiere al menos una variante habilitada.');
            }
            const ids = variantes.map((v) => v.materiaPrimaVarianteId);
            const rows = await this.prisma.materiaPrimaVariante.findMany({
                where: { id: { in: ids }, tenantId: auth.tenantId },
                select: { id: true, materiaPrimaId: true },
            });
            if (rows.length !== ids.length) {
                throw new common_1.BadRequestException('Una o más variantes habilitadas no existen.');
            }
            const materiaPrimaIds = new Set(rows.map((r) => r.materiaPrimaId));
            if (materiaPrimaIds.size > 1) {
                throw new common_1.BadRequestException('Todas las variantes habilitadas deben pertenecer a la misma materia prima.');
            }
        }
    }
    async validateUniqueSustratoPorPaso(auth, procesoOperacionId, payload, currentMaterialId) {
        if (!payload.esSustratoNesting)
            return;
        const otroSustrato = await this.prisma.procesoOperacionMaterial.findFirst({
            where: {
                tenantId: auth.tenantId,
                procesoOperacionId,
                esSustratoNesting: true,
                ...(currentMaterialId ? { id: { not: currentMaterialId } } : {}),
            },
            select: { id: true, nombre: true },
        });
        if (otroSustrato) {
            throw new common_1.BadRequestException(`Solo un material por paso puede ser sustrato del nesting. El paso ya tiene "${otroSustrato.nombre}" como sustrato.`);
        }
    }
    async syncVariantesHabilitadas(tx, auth, procesoOperacionMaterialId, payload) {
        await tx.procesoOperacionMaterialVariante.deleteMany({
            where: { procesoOperacionMaterialId },
        });
        if (!payload.esSustratoNesting)
            return;
        const variantes = payload.variantesHabilitadas ?? [];
        if (variantes.length === 0)
            return;
        await tx.procesoOperacionMaterialVariante.createMany({
            data: variantes.map((v, idx) => ({
                tenantId: auth.tenantId,
                procesoOperacionMaterialId,
                materiaPrimaVarianteId: v.materiaPrimaVarianteId,
                orden: typeof v.orden === 'number' ? v.orden : idx,
                activo: v.activo ?? true,
            })),
        });
    }
    toMaterialResponse(m) {
        return {
            id: m.id,
            procesoOperacionId: m.procesoOperacionId,
            materiaPrimaVarianteId: m.materiaPrimaVarianteId,
            productoComponenteId: m.productoComponenteId,
            varianteComponenteId: m.varianteComponenteId,
            nombre: m.nombre,
            formula: m.formula,
            cantidadPorUnidad: Number(m.cantidadPorUnidad),
            unidad: m.unidad,
            precioManual: m.precioManual != null ? Number(m.precioManual) : null,
            aplicaMultiCaras: m.aplicaMultiCaras,
            esSustratoNesting: m.esSustratoNesting,
            orden: m.orden,
            activo: m.activo,
            materiaPrimaVariante: m.materiaPrimaVariante
                ? {
                    id: m.materiaPrimaVariante.id,
                    sku: m.materiaPrimaVariante.sku,
                    nombreVariante: m.materiaPrimaVariante.nombreVariante,
                    precioReferencia: m.materiaPrimaVariante.precioReferencia != null
                        ? Number(m.materiaPrimaVariante.precioReferencia)
                        : null,
                }
                : null,
            productoComponente: m.productoComponente
                ? {
                    id: m.productoComponente.id,
                    codigo: m.productoComponente.codigo,
                    nombre: m.productoComponente.nombre,
                    modoMedidas: m.productoComponente.modoMedidas,
                }
                : null,
            varianteComponente: m.varianteComponente
                ? {
                    id: m.varianteComponente.id,
                    nombre: m.varianteComponente.nombre,
                    anchoMm: Number(m.varianteComponente.anchoMm),
                    altoMm: Number(m.varianteComponente.altoMm),
                }
                : null,
            variantesHabilitadas: m.variantesHabilitadas.map((v) => ({
                id: v.id,
                materiaPrimaVarianteId: v.materiaPrimaVarianteId,
                orden: v.orden,
                activo: v.activo,
                materiaPrimaVariante: {
                    id: v.materiaPrimaVariante.id,
                    sku: v.materiaPrimaVariante.sku,
                    nombreVariante: v.materiaPrimaVariante.nombreVariante,
                    materiaPrimaId: v.materiaPrimaVariante.materiaPrimaId,
                    precioReferencia: v.materiaPrimaVariante.precioReferencia != null
                        ? Number(v.materiaPrimaVariante.precioReferencia)
                        : null,
                    atributosVariante: v.materiaPrimaVariante.atributosVarianteJson,
                    activo: v.materiaPrimaVariante.activo,
                },
            })),
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
        };
    }
    async updateOperacion(auth, operacionId, payload) {
        const op = await this.prisma.procesoOperacion.findFirst({
            where: { id: operacionId, tenantId: auth.tenantId },
        });
        if (!op) {
            throw new common_1.NotFoundException('La operación del proceso no existe.');
        }
        if (payload.centroCostoId !== undefined) {
            const cc = await this.prisma.centroCosto.findFirst({
                where: { id: payload.centroCostoId, tenantId: auth.tenantId },
                select: { id: true },
            });
            if (!cc) {
                throw new common_1.BadRequestException('El centro de costo indicado no existe.');
            }
        }
        if (payload.maquinaId) {
            const maq = await this.prisma.maquina.findFirst({
                where: { id: payload.maquinaId, tenantId: auth.tenantId },
                select: { id: true },
            });
            if (!maq) {
                throw new common_1.BadRequestException('La máquina indicada no existe.');
            }
        }
        if (payload.perfilOperativoId) {
            const maquinaId = payload.maquinaId !== undefined ? payload.maquinaId : op.maquinaId;
            if (!maquinaId) {
                throw new common_1.BadRequestException('No se puede asignar un perfil operativo a un paso sin máquina.');
            }
            const perfil = await this.prisma.maquinaPerfilOperativo.findFirst({
                where: {
                    id: payload.perfilOperativoId,
                    tenantId: auth.tenantId,
                    maquinaId,
                },
                select: { id: true },
            });
            if (!perfil) {
                throw new common_1.BadRequestException('El perfil operativo no existe o no pertenece a la máquina indicada.');
            }
        }
        const data = {};
        if (payload.nombre !== undefined)
            data.nombre = payload.nombre.trim();
        if (payload.esOpcional !== undefined)
            data.esOpcional = payload.esOpcional;
        if (payload.activacionV2 !== undefined)
            data.activacionV2 = payload.activacionV2;
        if (payload.familiaV2 !== undefined)
            data.familiaV2 = payload.familiaV2.trim() || null;
        if (payload.unidadProductivaV2 !== undefined)
            data.unidadProductivaV2 = payload.unidadProductivaV2.trim() || null;
        if (payload.centroCostoId !== undefined)
            data.centroCosto = { connect: { id: payload.centroCostoId } };
        if (payload.maquinaId !== undefined) {
            data.maquina = payload.maquinaId
                ? { connect: { id: payload.maquinaId } }
                : { disconnect: true };
            if (!payload.maquinaId && payload.perfilOperativoId === undefined) {
                data.perfilOperativo = { disconnect: true };
            }
        }
        if (payload.perfilOperativoId !== undefined) {
            data.perfilOperativo = payload.perfilOperativoId
                ? { connect: { id: payload.perfilOperativoId } }
                : { disconnect: true };
        }
        if (payload.plantillaOrigenId !== undefined) {
            if (payload.plantillaOrigenId) {
                const plantilla = await this.prisma.procesoOperacionPlantilla.findFirst({
                    where: { id: payload.plantillaOrigenId, tenantId: auth.tenantId },
                    select: { id: true },
                });
                if (!plantilla) {
                    throw new common_1.BadRequestException('La plantilla origen indicada no existe.');
                }
                data.plantillaOrigen = { connect: { id: payload.plantillaOrigenId } };
            }
            else {
                data.plantillaOrigen = { disconnect: true };
            }
        }
        if (payload.setupMin !== undefined)
            data.setupMin = payload.setupMin === null ? null : new client_1.Prisma.Decimal(payload.setupMin);
        if (payload.cleanupMin !== undefined)
            data.cleanupMin = payload.cleanupMin === null ? null : new client_1.Prisma.Decimal(payload.cleanupMin);
        if (payload.tiempoFijoMin !== undefined)
            data.tiempoFijoMin = payload.tiempoFijoMin === null ? null : new client_1.Prisma.Decimal(payload.tiempoFijoMin);
        if (payload.productividadBase !== undefined)
            data.productividadBase =
                payload.productividadBase === null ? null : new client_1.Prisma.Decimal(payload.productividadBase);
        if (payload.unidadTiempo !== undefined) {
            data.unidadTiempo = payload.unidadTiempo;
        }
        if (payload.condicionV2 !== undefined) {
            data.condicionV2 =
                payload.condicionV2 === null
                    ? client_1.Prisma.JsonNull
                    : payload.condicionV2;
        }
        if (payload.configNestingV2 !== undefined) {
            data.configNestingV2 =
                payload.configNestingV2 === null
                    ? client_1.Prisma.JsonNull
                    : payload.configNestingV2;
        }
        const updated = await this.prisma.procesoOperacion.update({
            where: { id: operacionId },
            data,
            include: { centroCosto: true, maquina: true, perfilOperativo: true },
        });
        return this.toOperacionSummaryResponse(updated);
    }
    async moveOperacion(auth, operacionId, direction) {
        const op = await this.prisma.procesoOperacion.findFirst({
            where: { id: operacionId, tenantId: auth.tenantId },
        });
        if (!op) {
            throw new common_1.NotFoundException('La operación del proceso no existe.');
        }
        const neighborOrden = direction === 'up' ? op.orden - 1 : op.orden + 1;
        const neighbor = await this.prisma.procesoOperacion.findFirst({
            where: {
                tenantId: auth.tenantId,
                procesoDefinicionId: op.procesoDefinicionId,
                orden: neighborOrden,
            },
        });
        if (!neighbor) {
            throw new common_1.BadRequestException(direction === 'up'
                ? 'El paso ya está en la primera posición.'
                : 'El paso ya está en la última posición.');
        }
        const temp = -1 * (Math.abs(op.orden) + Math.abs(neighbor.orden) + 1);
        await this.prisma.$transaction([
            this.prisma.procesoOperacion.update({
                where: { id: op.id },
                data: { orden: temp },
            }),
            this.prisma.procesoOperacion.update({
                where: { id: neighbor.id },
                data: { orden: op.orden },
            }),
            this.prisma.procesoOperacion.update({
                where: { id: op.id },
                data: { orden: neighbor.orden },
            }),
        ]);
        return { ok: true, moved: { id: op.id, fromOrden: op.orden, toOrden: neighbor.orden } };
    }
    toOperacionSummaryResponse(op) {
        return {
            id: op.id,
            orden: op.orden,
            codigo: op.codigo,
            nombre: op.nombre,
            familiaV2: op.familiaV2,
            unidadProductivaV2: op.unidadProductivaV2,
            activacionV2: op.activacionV2,
            esOpcional: op.esOpcional,
            setupMin: op.setupMin != null ? Number(op.setupMin) : null,
            cleanupMin: op.cleanupMin != null ? Number(op.cleanupMin) : null,
            tiempoFijoMin: op.tiempoFijoMin != null ? Number(op.tiempoFijoMin) : null,
            productividadBase: op.productividadBase != null ? Number(op.productividadBase) : null,
            centroCosto: op.centroCosto
                ? { id: op.centroCosto.id, nombre: op.centroCosto.nombre }
                : null,
            maquina: op.maquina
                ? { id: op.maquina.id, nombre: op.maquina.nombre, plantilla: op.maquina.plantilla }
                : null,
            perfilOperativo: op.perfilOperativo
                ? { id: op.perfilOperativo.id, nombre: op.perfilOperativo.nombre }
                : null,
        };
    }
};
exports.ProcesosService = ProcesosService;
exports.ProcesosService = ProcesosService = ProcesosService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProcesosService);
//# sourceMappingURL=procesos.service.js.map