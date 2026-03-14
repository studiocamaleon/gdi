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
var MaquinariaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaquinariaService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const prisma_service_1 = require("../prisma/prisma.service");
const upsert_maquina_dto_1 = require("./dto/upsert-maquina.dto");
const maquinaria_template_machine_rules_1 = require("./maquinaria-template-machine-rules");
const maquinaria_template_profile_rules_1 = require("./maquinaria-template-profile-rules");
const TEMPLATE_CATALOG_RULES = {
    router_cnc: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.volumen,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.hora,
    },
    corte_laser: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.plano,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.hora,
    },
    impresora_3d: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.volumen,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.pieza,
    },
    impresora_dtf: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.rollo,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.m2,
    },
    impresora_dtf_uv: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.rollo,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.m2,
    },
    impresora_uv_mesa_extensora: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.plano,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.m2,
    },
    impresora_uv_cilindrica: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.cilindrico,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.pieza,
    },
    impresora_uv_flatbed: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.plano,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.m2,
    },
    impresora_uv_rollo: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.rollo,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.m2,
    },
    impresora_solvente: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.rollo,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.m2,
    },
    impresora_inyeccion_tinta: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.rollo,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.m2,
    },
    impresora_latex: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.rollo,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.m2,
    },
    impresora_sublimacion_gran_formato: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.rollo,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.m2,
    },
    impresora_laser: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.pliego,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.copia,
    },
    plotter_cad: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.rollo,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.metro_lineal,
    },
    mesa_de_corte: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.plano,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.m2,
    },
    plotter_de_corte: {
        geometry: upsert_maquina_dto_1.GeometriaTrabajoMaquinaDto.rollo,
        defaultProductionUnit: upsert_maquina_dto_1.UnidadProduccionMaquinaDto.metro_lineal,
    },
};
const TEMPLATE_ALLOWED_TECHNICAL_KEYS = new Set([
    'altoMaxHoja',
    'altoMinHoja',
    'alturaMaximaCapa',
    'alturaMaximaObjeto',
    'alturaMinimaCapa',
    'anchoCama',
    'anchoMaxHoja',
    'anchoMinHoja',
    'anchoUtil',
    'areaImprimibleMaxima',
    'bannerSoportado',
    'barnizDisponible',
    'blancoDisponible',
    'cambiadorAutomatico',
    'cantidadExtrusores',
    'cantidadHerramientas',
    'configuracionCanales',
    'configuracionColor',
    'configuracionTintas',
    'controladorRip',
    'despejeZ',
    'diametroBoquilla',
    'diametroMaximo',
    'diametroMaximoBobina',
    'diametroMinimo',
    'duplexSoportado',
    'ejeXUtil',
    'ejeYUtil',
    'ejeZUtil',
    'espesorMaximo',
    'espesorMaximoFilm',
    'espesorMaximoPorMaterial',
    'espesorMaximoMaterial',
    'extraccionAsistida',
    'gramajeMaximo',
    'gramajeMinimo',
    'herramientasCompatibles',
    'largoCama',
    'largoMaximoBanner',
    'largoUtil',
    'margenDerecho',
    'margenFinalNoImprimible',
    'margenInferior',
    'margenInicioNoImprimible',
    'margenIzquierdo',
    'margenSuperior',
    'materialesCompatibles',
    'objetosCompatibles',
    'pesoMaximoBobina',
    'pesoMaximoObjeto',
    'pesoMaximoSoportado',
    'potenciaLaser',
    'potenciaSpindle',
    'primerDisponible',
    'resolucionNominal',
    'rotacionControlada',
    'rpmMaxima',
    'rpmMinima',
    'sistemaCurado',
    'sistemaSecadoCurado',
    'sistemaLaminacionTransferencia',
    'tecnologia',
    'tipoFilm',
    'tipoLaser',
    'tipoMesa',
    'vacioSujecion',
    'velocidadAvance',
    'velocidadCorte',
    'velocidadDesplazamiento',
    'velocidadGrabado',
    'volumenX',
    'volumenY',
    'volumenZ',
    'zonasVacio',
    'anguloConicidadMaxima',
    'anchoImprimibleMaximo',
    'altoImprimibleMaximo',
]);
const ALLOWED_CONSUMABLE_DETAIL_KEYS = new Set(['dependePerfilOperativo', 'color']);
const ALLOWED_WEAR_DETAIL_KEYS = new Set();
const PRINTER_TEMPLATES_WITH_INK_CONSUMPTION = new Set([
    upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_dtf,
    upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_dtf_uv,
    upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_uv_mesa_extensora,
    upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_uv_cilindrica,
    upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_uv_flatbed,
    upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_uv_rollo,
    upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_solvente,
    upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_inyeccion_tinta,
    upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_latex,
    upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_sublimacion_gran_formato,
    upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_laser,
]);
let MaquinariaService = class MaquinariaService {
    static { MaquinariaService_1 = this; }
    prisma;
    static CODIGO_PREFIX = 'MAQ';
    static CODIGO_MAX_RETRIES = 5;
    static COMBINED_PRODUCTIVITY_UNITS = new Set([
        upsert_maquina_dto_1.UnidadProduccionMaquinaDto.ppm,
        upsert_maquina_dto_1.UnidadProduccionMaquinaDto.m2_h,
        upsert_maquina_dto_1.UnidadProduccionMaquinaDto.piezas_h,
    ]);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(auth) {
        const maquinas = await this.prisma.maquina.findMany({
            where: { tenantId: auth.tenantId },
            include: {
                planta: true,
                centroCostoPrincipal: true,
                perfilesOperativos: true,
                consumibles: {
                    include: {
                        perfilOperativo: true,
                        materiaPrimaVariante: {
                            include: {
                                materiaPrima: true,
                            },
                        },
                    },
                },
                componentesDesgaste: {
                    include: {
                        materiaPrimaVariante: {
                            include: {
                                materiaPrima: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ nombre: 'asc' }],
        });
        return maquinas.map((maquina) => this.toMaquinaResponse(maquina));
    }
    async findOne(auth, id) {
        const maquina = await this.findMaquinaOrThrow(auth, id);
        return this.toMaquinaResponse(maquina);
    }
    async create(auth, payload) {
        await this.validateReferences(auth, payload);
        for (let attempt = 0; attempt < MaquinariaService_1.CODIGO_MAX_RETRIES; attempt += 1) {
            const generatedCodigo = this.generateCodigoMaquina();
            try {
                const maquina = await this.prisma.$transaction(async (tx) => {
                    const created = await tx.maquina.create({
                        data: this.buildMaquinaWriteData(auth, payload, generatedCodigo),
                    });
                    await this.replaceNestedData(tx, auth.tenantId, created.id, payload);
                    return tx.maquina.findUniqueOrThrow({
                        where: { id: created.id },
                        include: {
                            planta: true,
                            centroCostoPrincipal: true,
                            perfilesOperativos: true,
                            consumibles: {
                                include: {
                                    perfilOperativo: true,
                                    materiaPrimaVariante: {
                                        include: {
                                            materiaPrima: true,
                                        },
                                    },
                                },
                            },
                            componentesDesgaste: {
                                include: {
                                    materiaPrimaVariante: {
                                        include: {
                                            materiaPrima: true,
                                        },
                                    },
                                },
                            },
                        },
                    });
                });
                return this.toMaquinaResponse(maquina);
            }
            catch (error) {
                if (this.isCodigoConflictError(error)) {
                    continue;
                }
                this.handleWriteError(error);
            }
        }
        throw new common_1.ConflictException('No se pudo generar un codigo unico para la maquina.');
    }
    async update(auth, id, payload) {
        await this.findMaquinaOrThrow(auth, id);
        await this.validateReferences(auth, payload);
        if (!payload.codigo?.trim()) {
            throw new common_1.BadRequestException('El codigo de la maquina es obligatorio para actualizar.');
        }
        try {
            const maquina = await this.prisma.$transaction(async (tx) => {
                await tx.maquina.update({
                    where: { id },
                    data: this.buildMaquinaWriteData(auth, payload),
                });
                await this.replaceNestedData(tx, auth.tenantId, id, payload);
                return tx.maquina.findUniqueOrThrow({
                    where: { id },
                    include: {
                        planta: true,
                        centroCostoPrincipal: true,
                        perfilesOperativos: true,
                        consumibles: {
                            include: {
                                perfilOperativo: true,
                                materiaPrimaVariante: {
                                    include: {
                                        materiaPrima: true,
                                    },
                                },
                            },
                        },
                        componentesDesgaste: {
                            include: {
                                materiaPrimaVariante: {
                                    include: {
                                        materiaPrima: true,
                                    },
                                },
                            },
                        },
                    },
                });
            });
            return this.toMaquinaResponse(maquina);
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async toggle(auth, id) {
        const maquina = await this.findMaquinaBaseOrThrow(auth, id);
        const updated = await this.prisma.maquina.update({
            where: { id },
            data: {
                activo: !maquina.activo,
            },
            include: {
                planta: true,
                centroCostoPrincipal: true,
                perfilesOperativos: true,
                consumibles: {
                    include: {
                        perfilOperativo: true,
                        materiaPrimaVariante: {
                            include: {
                                materiaPrima: true,
                            },
                        },
                    },
                },
                componentesDesgaste: {
                    include: {
                        materiaPrimaVariante: {
                            include: {
                                materiaPrima: true,
                            },
                        },
                    },
                },
            },
        });
        return this.toMaquinaResponse(updated);
    }
    async replaceNestedData(tx, tenantId, maquinaId, payload) {
        await tx.maquinaConsumible.deleteMany({ where: { tenantId, maquinaId } });
        await tx.maquinaComponenteDesgaste.deleteMany({
            where: { tenantId, maquinaId },
        });
        await tx.maquinaPerfilOperativo.deleteMany({
            where: { tenantId, maquinaId },
        });
        const perfiles = await Promise.all(payload.perfilesOperativos.map((perfil) => tx.maquinaPerfilOperativo.create({
            data: this.buildPerfilData(tenantId, maquinaId, perfil),
        })));
        const perfilIdByName = new Map(perfiles.map((perfil) => [perfil.nombre, perfil.id]));
        for (const consumible of payload.consumibles) {
            const perfilOperativoId = consumible.perfilOperativoNombre
                ? perfilIdByName.get(consumible.perfilOperativoNombre.trim())
                : undefined;
            if (consumible.perfilOperativoNombre && !perfilOperativoId) {
                throw new common_1.BadRequestException(`El consumible ${consumible.nombre.trim()} referencia un perfil operativo inexistente.`);
            }
            await tx.maquinaConsumible.create({
                data: this.buildConsumibleData(tenantId, maquinaId, consumible, perfilOperativoId),
            });
        }
        await Promise.all(payload.componentesDesgaste.map((componente) => tx.maquinaComponenteDesgaste.create({
            data: this.buildComponenteDesgasteData(tenantId, maquinaId, componente),
        })));
    }
    buildMaquinaWriteData(auth, payload, forcedCodigo) {
        const estadoConfiguracion = this.getDerivedEstadoConfiguracion(payload);
        const parametrosTecnicos = this.withDerivedTemplateParams(payload);
        const dimensionesDerivadas = this.getDerivedMachineDimensions(payload, parametrosTecnicos);
        return {
            tenantId: auth.tenantId,
            codigo: (forcedCodigo ?? payload.codigo ?? '').trim().toUpperCase(),
            nombre: payload.nombre.trim(),
            plantilla: this.toPrismaEnum(payload.plantilla),
            plantillaVersion: payload.plantillaVersion ?? 1,
            fabricante: payload.fabricante?.trim() || null,
            modelo: payload.modelo?.trim() || null,
            numeroSerie: payload.numeroSerie?.trim() || null,
            plantaId: payload.plantaId,
            centroCostoPrincipalId: payload.centroCostoPrincipalId ?? null,
            estado: this.toPrismaEnum(payload.estado),
            estadoConfiguracion: this.toPrismaEnum(estadoConfiguracion),
            geometriaTrabajo: this.toPrismaEnum(payload.geometriaTrabajo),
            unidadProduccionPrincipal: this.toPrismaEnum(payload.unidadProduccionPrincipal),
            anchoUtil: this.toDecimal(dimensionesDerivadas.anchoUtil),
            largoUtil: this.toDecimal(dimensionesDerivadas.largoUtil),
            altoUtil: this.toDecimal(payload.altoUtil),
            espesorMaximo: this.toDecimal(payload.espesorMaximo),
            pesoMaximo: this.toDecimal(payload.pesoMaximo),
            fechaAlta: payload.fechaAlta ? new Date(payload.fechaAlta) : null,
            activo: payload.activo,
            observaciones: payload.observaciones?.trim() || null,
            parametrosTecnicosJson: this.toNullableJson(parametrosTecnicos),
            capacidadesAvanzadasJson: this.toNullableJson(payload.capacidadesAvanzadas),
        };
    }
    buildPerfilData(tenantId, maquinaId, payload) {
        return {
            tenantId,
            maquinaId,
            nombre: payload.nombre.trim(),
            tipoPerfil: this.toPrismaEnum(payload.tipoPerfil),
            activo: payload.activo,
            anchoAplicable: this.toDecimal(payload.anchoAplicable),
            altoAplicable: this.toDecimal(payload.altoAplicable),
            modoTrabajo: payload.modoTrabajo?.trim() || null,
            productividad: this.toDecimal(payload.productividad),
            unidadProductividad: payload.unidadProductividad
                ? this.toPrismaEnum(payload.unidadProductividad)
                : null,
            tiempoPreparacionMin: this.toDecimal(payload.tiempoPreparacionMin),
            tiempoRipMin: this.toDecimal(payload.tiempoRipMin),
            cantidadPasadas: payload.cantidadPasadas !== undefined
                ? Math.round(payload.cantidadPasadas)
                : null,
            dobleFaz: payload.dobleFaz ?? false,
            detalleJson: this.toNullableJson(payload.detalle),
        };
    }
    buildConsumibleData(tenantId, maquinaId, payload, perfilOperativoId) {
        return {
            tenantId,
            maquinaId,
            perfilOperativoId: perfilOperativoId ?? null,
            materiaPrimaVarianteId: payload.materiaPrimaVarianteId,
            nombre: payload.nombre.trim(),
            tipo: this.toPrismaEnum(payload.tipo),
            unidad: this.toPrismaEnum(payload.unidad),
            rendimientoEstimado: this.toDecimal(payload.rendimientoEstimado),
            consumoBase: this.toDecimal(payload.consumoBase),
            activo: payload.activo,
            detalleJson: this.toNullableJson(payload.detalle),
            observaciones: payload.observaciones?.trim() || null,
        };
    }
    buildComponenteDesgasteData(tenantId, maquinaId, payload) {
        return {
            tenantId,
            maquinaId,
            materiaPrimaVarianteId: payload.materiaPrimaVarianteId,
            nombre: payload.nombre.trim(),
            tipo: this.toPrismaEnum(payload.tipo),
            vidaUtilEstimada: this.toDecimal(payload.vidaUtilEstimada),
            unidadDesgaste: this.toPrismaEnum(payload.unidadDesgaste),
            modoProrrateo: payload.modoProrrateo?.trim() || null,
            activo: payload.activo,
            detalleJson: this.toNullableJson(payload.detalle),
            observaciones: payload.observaciones?.trim() || null,
        };
    }
    getDerivedEstadoConfiguracion(payload) {
        if (!this.hasMinimumBaseData(payload)) {
            return upsert_maquina_dto_1.EstadoConfiguracionMaquinaDto.borrador;
        }
        if (!this.hasCoreCostingData(payload)) {
            return upsert_maquina_dto_1.EstadoConfiguracionMaquinaDto.incompleta;
        }
        if (!this.hasTemplateSpecificData(payload)) {
            return upsert_maquina_dto_1.EstadoConfiguracionMaquinaDto.incompleta;
        }
        return upsert_maquina_dto_1.EstadoConfiguracionMaquinaDto.lista;
    }
    hasMinimumBaseData(payload) {
        return Boolean(payload.nombre?.trim() &&
            payload.plantaId &&
            payload.plantilla &&
            payload.estado &&
            payload.unidadProduccionPrincipal);
    }
    hasCoreCostingData(payload) {
        const hasPerfilValido = payload.perfilesOperativos.some((perfil) => Boolean(perfil.nombre?.trim()) &&
            perfil.productividad !== undefined &&
            Boolean(perfil.unidadProductividad));
        const requireConsumibles = PRINTER_TEMPLATES_WITH_INK_CONSUMPTION.has(payload.plantilla);
        const hasConsumibleValido = payload.consumibles.some((consumible) => Boolean(consumible.nombre?.trim()) &&
            Boolean(consumible.tipo) &&
            Boolean(consumible.unidad));
        const hasDesgasteValido = payload.componentesDesgaste.some((componente) => Boolean(componente.nombre?.trim()) &&
            Boolean(componente.tipo) &&
            Boolean(componente.unidadDesgaste) &&
            componente.vidaUtilEstimada !== undefined);
        return (hasPerfilValido &&
            (!requireConsumibles || hasConsumibleValido) &&
            hasDesgasteValido);
    }
    hasTemplateSpecificData(payload) {
        if (!(0, maquinaria_template_machine_rules_1.hasRequiredMachineDataByTemplate)(payload)) {
            return false;
        }
        return true;
    }
    async validateReferences(auth, payload) {
        const templateRule = TEMPLATE_CATALOG_RULES[payload.plantilla];
        if (!templateRule) {
            throw new common_1.BadRequestException(`La plantilla ${payload.plantilla} no existe en el catalogo del sistema.`);
        }
        if (payload.geometriaTrabajo !== templateRule.geometry) {
            throw new common_1.BadRequestException(`La geometria ${payload.geometriaTrabajo} no coincide con la plantilla ${payload.plantilla}. Debe ser ${templateRule.geometry}.`);
        }
        if (payload.unidadProduccionPrincipal !== templateRule.defaultProductionUnit) {
            throw new common_1.BadRequestException(`La unidad ${payload.unidadProduccionPrincipal} no coincide con la plantilla ${payload.plantilla}. Debe ser ${templateRule.defaultProductionUnit}.`);
        }
        this.validateTechnicalPayload(payload);
        try {
            (0, maquinaria_template_machine_rules_1.validateMachinePayloadByTemplate)(payload);
        }
        catch (error) {
            throw new common_1.BadRequestException(error instanceof Error
                ? error.message
                : `Maquina invalida para la plantilla ${payload.plantilla}.`);
        }
        const planta = await this.prisma.planta.findFirst({
            where: {
                id: payload.plantaId,
                tenantId: auth.tenantId,
            },
            select: { id: true },
        });
        if (!planta) {
            throw new common_1.BadRequestException('La planta seleccionada no existe.');
        }
        if (payload.centroCostoPrincipalId) {
            const centro = await this.prisma.centroCosto.findFirst({
                where: {
                    id: payload.centroCostoPrincipalId,
                    tenantId: auth.tenantId,
                },
                select: {
                    id: true,
                    plantaId: true,
                },
            });
            if (!centro) {
                throw new common_1.BadRequestException('El centro de costo principal no existe.');
            }
            if (centro.plantaId !== payload.plantaId) {
                throw new common_1.BadRequestException('La maquina y el centro de costo principal deben pertenecer a la misma planta.');
            }
        }
        const normalizedPerfilNames = new Set();
        for (const perfil of payload.perfilesOperativos) {
            const key = perfil.nombre.trim().toLowerCase();
            if (normalizedPerfilNames.has(key)) {
                throw new common_1.BadRequestException(`El perfil operativo ${perfil.nombre.trim()} esta duplicado.`);
            }
            if (perfil.unidadProductividad &&
                !MaquinariaService_1.COMBINED_PRODUCTIVITY_UNITS.has(perfil.unidadProductividad)) {
                throw new common_1.BadRequestException(`El perfil operativo ${perfil.nombre.trim()} debe usar una unidad de productividad combinada (pag/min, m2/h o piezas/h).`);
            }
            try {
                (0, maquinaria_template_profile_rules_1.validatePerfilOperativoByTemplate)(payload.plantilla, perfil);
            }
            catch (error) {
                throw new common_1.BadRequestException(error instanceof Error
                    ? error.message
                    : `Perfil operativo invalido para la plantilla ${payload.plantilla}.`);
            }
            normalizedPerfilNames.add(key);
        }
        const varianteIds = Array.from(new Set([
            ...payload.consumibles.map((item) => item.materiaPrimaVarianteId),
            ...payload.componentesDesgaste.map((item) => item.materiaPrimaVarianteId),
        ]));
        const variantesMateriaPrima = await this.prisma.materiaPrimaVariante.findMany({
            where: {
                tenantId: auth.tenantId,
                id: { in: varianteIds },
            },
            include: {
                materiaPrima: {
                    select: {
                        id: true,
                        nombre: true,
                        activo: true,
                        esConsumible: true,
                        esRepuesto: true,
                    },
                },
            },
        });
        const varianteById = new Map(variantesMateriaPrima.map((variante) => [variante.id, variante]));
        for (const consumible of payload.consumibles) {
            const consumibleName = consumible.nombre.trim() || 'sin nombre';
            const variante = varianteById.get(consumible.materiaPrimaVarianteId);
            if (!variante) {
                throw new common_1.BadRequestException(`El consumible ${consumibleName} referencia una variante de materia prima inexistente.`);
            }
            if (!variante.activo || !variante.materiaPrima.activo) {
                throw new common_1.BadRequestException(`El consumible ${consumibleName} referencia una variante/materia prima inactiva.`);
            }
            if (!variante.materiaPrima.esConsumible) {
                throw new common_1.BadRequestException(`La materia prima ${variante.materiaPrima.nombre} no esta habilitada como consumible.`);
            }
            for (const detailKey of Object.keys(consumible.detalle ?? {})) {
                if (!ALLOWED_CONSUMABLE_DETAIL_KEYS.has(detailKey)) {
                    throw new common_1.BadRequestException(`El consumible ${consumibleName} incluye el campo ${detailKey}, que no corresponde a la plantilla ${payload.plantilla}.`);
                }
            }
        }
        for (const componente of payload.componentesDesgaste) {
            const componenteName = componente.nombre.trim() || 'sin nombre';
            const variante = varianteById.get(componente.materiaPrimaVarianteId);
            if (!variante) {
                throw new common_1.BadRequestException(`El componente ${componenteName} referencia una variante de materia prima inexistente.`);
            }
            if (!variante.activo || !variante.materiaPrima.activo) {
                throw new common_1.BadRequestException(`El componente ${componenteName} referencia una variante/materia prima inactiva.`);
            }
            if (!variante.materiaPrima.esRepuesto) {
                throw new common_1.BadRequestException(`La materia prima ${variante.materiaPrima.nombre} no esta habilitada como repuesto.`);
            }
            for (const detailKey of Object.keys(componente.detalle ?? {})) {
                if (!ALLOWED_WEAR_DETAIL_KEYS.has(detailKey)) {
                    throw new common_1.BadRequestException(`El componente de desgaste ${componenteName} incluye el campo ${detailKey}, que no corresponde a la plantilla ${payload.plantilla}.`);
                }
            }
        }
    }
    validateTechnicalPayload(payload) {
        if (!payload.parametrosTecnicos) {
            return;
        }
        for (const [key, value] of Object.entries(payload.parametrosTecnicos)) {
            if (!TEMPLATE_ALLOWED_TECHNICAL_KEYS.has(key)) {
                throw new common_1.BadRequestException(`El parametro tecnico ${key} no corresponde al catalogo de plantillas.`);
            }
            if (value === null || value === undefined) {
                continue;
            }
            if (typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean') {
                continue;
            }
            if (Array.isArray(value)) {
                const isValidArray = value.every((item) => typeof item === 'string' ||
                    typeof item === 'number' ||
                    typeof item === 'boolean');
                if (!isValidArray) {
                    throw new common_1.BadRequestException(`El parametro tecnico ${key} contiene un formato invalido.`);
                }
                continue;
            }
            throw new common_1.BadRequestException(`El parametro tecnico ${key} contiene un formato invalido.`);
        }
    }
    async findMaquinaOrThrow(auth, id) {
        const maquina = await this.prisma.maquina.findFirst({
            where: {
                id,
                tenantId: auth.tenantId,
            },
            include: {
                planta: true,
                centroCostoPrincipal: true,
                perfilesOperativos: true,
                consumibles: {
                    include: {
                        perfilOperativo: true,
                        materiaPrimaVariante: {
                            include: {
                                materiaPrima: true,
                            },
                        },
                    },
                },
                componentesDesgaste: {
                    include: {
                        materiaPrimaVariante: {
                            include: {
                                materiaPrima: true,
                            },
                        },
                    },
                },
            },
        });
        if (!maquina) {
            throw new common_1.NotFoundException('La maquina no existe.');
        }
        return maquina;
    }
    async findMaquinaBaseOrThrow(auth, id) {
        const maquina = await this.prisma.maquina.findFirst({
            where: {
                id,
                tenantId: auth.tenantId,
            },
        });
        if (!maquina) {
            throw new common_1.NotFoundException('La maquina no existe.');
        }
        return maquina;
    }
    toMaquinaResponse(maquina) {
        return {
            id: maquina.id,
            codigo: maquina.codigo,
            nombre: maquina.nombre,
            plantilla: this.toApiEnum(maquina.plantilla),
            plantillaVersion: maquina.plantillaVersion,
            fabricante: maquina.fabricante ?? '',
            modelo: maquina.modelo ?? '',
            numeroSerie: maquina.numeroSerie ?? '',
            plantaId: maquina.plantaId,
            plantaNombre: maquina.planta.nombre,
            centroCostoPrincipalId: maquina.centroCostoPrincipalId ?? '',
            centroCostoPrincipalNombre: maquina.centroCostoPrincipal?.nombre ?? '',
            estado: this.toApiEnum(maquina.estado),
            estadoConfiguracion: this.toApiEnum(maquina.estadoConfiguracion),
            geometriaTrabajo: this.toApiEnum(maquina.geometriaTrabajo),
            unidadProduccionPrincipal: this.toApiEnum(maquina.unidadProduccionPrincipal),
            anchoUtil: this.toNumber(maquina.anchoUtil),
            largoUtil: this.toNumber(maquina.largoUtil),
            altoUtil: this.toNumber(maquina.altoUtil),
            espesorMaximo: this.toNumber(maquina.espesorMaximo),
            pesoMaximo: this.toNumber(maquina.pesoMaximo),
            fechaAlta: maquina.fechaAlta?.toISOString().slice(0, 10) ?? '',
            activo: maquina.activo,
            observaciones: maquina.observaciones ?? '',
            parametrosTecnicos: maquina.parametrosTecnicosJson ??
                null,
            capacidadesAvanzadas: maquina.capacidadesAvanzadasJson ??
                null,
            perfilesOperativos: maquina.perfilesOperativos.map((perfil) => ({
                id: perfil.id,
                nombre: perfil.nombre,
                tipoPerfil: this.toApiEnum(perfil.tipoPerfil),
                activo: perfil.activo,
                anchoAplicable: this.toNumber(perfil.anchoAplicable),
                altoAplicable: this.toNumber(perfil.altoAplicable),
                modoTrabajo: perfil.modoTrabajo ?? '',
                productividad: this.toNumber(perfil.productividad),
                unidadProductividad: perfil.unidadProductividad
                    ? this.toApiEnum(perfil.unidadProductividad)
                    : '',
                tiempoPreparacionMin: this.toNumber(perfil.tiempoPreparacionMin),
                tiempoRipMin: this.toNumber(perfil.tiempoRipMin),
                setupEstimadoMin: this.computeSetupEstimadoPerfil(perfil),
                cantidadPasadas: perfil.cantidadPasadas ?? null,
                dobleFaz: perfil.dobleFaz,
                detalle: perfil.detalleJson ?? null,
            })),
            consumibles: maquina.consumibles.map((consumible) => ({
                id: consumible.id,
                materiaPrimaVarianteId: consumible.materiaPrimaVarianteId,
                materiaPrimaVarianteSku: consumible.materiaPrimaVariante.sku,
                materiaPrimaVarianteNombre: consumible.materiaPrimaVariante.nombreVariante ?? '',
                materiaPrimaNombre: consumible.materiaPrimaVariante.materiaPrima.nombre,
                materiaPrimaPrecioReferencia: this.toNumber(consumible.materiaPrimaVariante.precioReferencia),
                nombre: consumible.nombre,
                tipo: this.toApiEnum(consumible.tipo),
                unidad: this.toApiEnum(consumible.unidad),
                rendimientoEstimado: this.toNumber(consumible.rendimientoEstimado),
                consumoBase: this.toNumber(consumible.consumoBase),
                perfilOperativoNombre: consumible.perfilOperativo?.nombre ?? '',
                activo: consumible.activo,
                detalle: consumible.detalleJson ?? null,
                observaciones: consumible.observaciones ?? '',
            })),
            componentesDesgaste: maquina.componentesDesgaste.map((componente) => ({
                id: componente.id,
                materiaPrimaVarianteId: componente.materiaPrimaVarianteId,
                materiaPrimaVarianteSku: componente.materiaPrimaVariante.sku,
                materiaPrimaVarianteNombre: componente.materiaPrimaVariante.nombreVariante ?? '',
                materiaPrimaNombre: componente.materiaPrimaVariante.materiaPrima.nombre,
                materiaPrimaPrecioReferencia: this.toNumber(componente.materiaPrimaVariante.precioReferencia),
                nombre: componente.nombre,
                tipo: this.toApiEnum(componente.tipo),
                vidaUtilEstimada: this.toNumber(componente.vidaUtilEstimada),
                unidadDesgaste: this.toApiEnum(componente.unidadDesgaste),
                modoProrrateo: componente.modoProrrateo ?? '',
                activo: componente.activo,
                detalle: componente.detalleJson ?? null,
                observaciones: componente.observaciones ?? '',
            })),
            createdAt: maquina.createdAt.toISOString(),
            updatedAt: maquina.updatedAt.toISOString(),
        };
    }
    handleWriteError(error) {
        if (error instanceof library_1.PrismaClientKnownRequestError &&
            error.code === 'P2002') {
            throw new common_1.ConflictException('Ya existe una maquina con ese codigo.');
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
        if (error instanceof library_1.PrismaClientUnknownRequestError) {
            throw new common_1.BadRequestException('Hay un dato incompatible con la base. Revisa unidades, tipos y campos numericos.');
        }
        throw error;
    }
    isCodigoConflictError(error) {
        return (error instanceof library_1.PrismaClientKnownRequestError &&
            error.code === 'P2002' &&
            Array.isArray(error.meta?.target) &&
            error.meta?.target.includes('tenantId') &&
            error.meta?.target.includes('codigo'));
    }
    generateCodigoMaquina() {
        const randomChunk = (0, node_crypto_1.randomUUID)()
            .replace(/-/g, '')
            .slice(0, 8)
            .toUpperCase();
        return `${MaquinariaService_1.CODIGO_PREFIX}-${randomChunk}`;
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
    toNumber(value) {
        return value === null || value === undefined ? null : Number(value);
    }
    parseFiniteNumber(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim().length > 0) {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? numeric : null;
        }
        return null;
    }
    computeSetupEstimadoPerfil(perfil) {
        const detalle = perfil.detalleJson &&
            typeof perfil.detalleJson === 'object' &&
            !Array.isArray(perfil.detalleJson)
            ? perfil.detalleJson
            : {};
        const setupDirecto = this.toNumber(perfil.tiempoPreparacionMin) ??
            this.parseFiniteNumber(detalle.tiempoPreparacionMin) ??
            this.parseFiniteNumber(detalle.tiempoSetupMin) ??
            this.parseFiniteNumber(detalle.setupMin) ??
            this.parseFiniteNumber(detalle.setup);
        if (setupDirecto !== null) {
            return setupDirecto;
        }
        const partes = [
            this.toNumber(perfil.tiempoRipMin) ??
                this.parseFiniteNumber(detalle.tiempoRipMin),
        ].filter((value) => value !== null);
        if (!partes.length) {
            return null;
        }
        return Number(partes.reduce((acc, item) => acc + item, 0).toFixed(4));
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
    withDerivedTemplateParams(payload) {
        if (!payload.parametrosTecnicos) {
            return undefined;
        }
        const params = { ...(payload.parametrosTecnicos ?? {}) };
        if (!payload.plantilla.startsWith('impresora_')) {
            return params;
        }
        const anchoMaxHoja = this.toNumeric(params.anchoMaxHoja);
        const altoMaxHoja = this.toNumeric(params.altoMaxHoja);
        const margenSuperior = this.toNumeric(params.margenSuperior) ?? 0;
        const margenInferior = this.toNumeric(params.margenInferior) ?? 0;
        const margenIzquierdo = this.toNumeric(params.margenIzquierdo) ?? 0;
        const margenDerecho = this.toNumeric(params.margenDerecho) ?? 0;
        if (anchoMaxHoja === null || altoMaxHoja === null) {
            return params;
        }
        const anchoImprimible = Number((anchoMaxHoja - margenIzquierdo - margenDerecho).toFixed(2));
        const altoImprimible = Number((altoMaxHoja - margenSuperior - margenInferior).toFixed(2));
        if (anchoImprimible <= 0 || altoImprimible <= 0) {
            return params;
        }
        return {
            ...params,
            anchoImprimibleMaximo: anchoImprimible,
            altoImprimibleMaximo: altoImprimible,
            areaImprimibleMaxima: Number(((anchoImprimible * altoImprimible) / 10000).toFixed(4)),
        };
    }
    toNumeric(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    getDerivedMachineDimensions(payload, parametrosTecnicos) {
        if (payload.plantilla !== upsert_maquina_dto_1.PlantillaMaquinariaDto.impresora_laser ||
            !parametrosTecnicos) {
            return {
                anchoUtil: payload.anchoUtil,
                largoUtil: payload.largoUtil,
            };
        }
        const ancho = this.toNumeric(parametrosTecnicos.anchoImprimibleMaximo);
        const largo = this.toNumeric(parametrosTecnicos.altoImprimibleMaximo);
        return {
            anchoUtil: ancho ?? payload.anchoUtil,
            largoUtil: largo ?? payload.largoUtil,
        };
    }
};
exports.MaquinariaService = MaquinariaService;
exports.MaquinariaService = MaquinariaService = MaquinariaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MaquinariaService);
//# sourceMappingURL=maquinaria.service.js.map