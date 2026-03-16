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
var ProductosServiciosService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductosServiciosService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const proceso_productividad_engine_1 = require("../procesos/proceso-productividad.engine");
const productos_servicios_dto_1 = require("./dto/productos-servicios.dto");
const DEFAULT_PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
let ProductosServiciosService = class ProductosServiciosService {
    static { ProductosServiciosService_1 = this; }
    prisma;
    static CODIGO_PREFIX = 'PRS';
    static CODIGO_MAX_RETRIES = 5;
    static FAMILIA_BASE_CODIGO = 'IMP_DIG';
    static SUBFAMILIA_BASE_CODIGO = 'PA_COM';
    static FAMILIA_BASE_CODIGO_LEGACY = 'IMP_DIG_HOJA';
    static SUBFAMILIA_BASE_CODIGO_LEGACY = 'TARJETAS';
    static MOTOR_DEFAULT = {
        code: 'impresion_digital_laser',
        version: 1,
        label: 'Impresión digital laser · v1',
    };
    static DEFAULT_A4_AREA_M2 = 0.06237;
    static CANONICAL_PLIEGOS_MM = [
        { codigo: 'A6', nombre: 'A6', anchoMm: 105, altoMm: 148 },
        { codigo: 'A5', nombre: 'A5', anchoMm: 148, altoMm: 210 },
        { codigo: 'A4', nombre: 'A4', anchoMm: 210, altoMm: 297 },
        { codigo: 'A3', nombre: 'A3', anchoMm: 297, altoMm: 420 },
        { codigo: 'SRA3', nombre: 'SRA3', anchoMm: 320, altoMm: 450 },
    ];
    constructor(prisma) {
        this.prisma = prisma;
    }
    getCatalogoPliegosImpresion() {
        return ProductosServiciosService_1.CANONICAL_PLIEGOS_MM.map((item) => ({
            ...item,
            label: `${item.nombre} (${item.anchoMm} x ${item.altoMm} mm)`,
        }));
    }
    getMotoresCosto() {
        return [
            {
                code: ProductosServiciosService_1.MOTOR_DEFAULT.code,
                version: ProductosServiciosService_1.MOTOR_DEFAULT.version,
                label: ProductosServiciosService_1.MOTOR_DEFAULT.label,
                schema: this.getDefaultMotorConfig(),
            },
        ];
    }
    async findFamilias(auth) {
        await this.ensureCatalogoInicialImprentaDigital(auth);
        const rows = await this.prisma.familiaProducto.findMany({
            where: { tenantId: auth.tenantId },
            include: {
                subfamilias: {
                    orderBy: [{ nombre: 'asc' }],
                },
            },
            orderBy: [{ nombre: 'asc' }],
        });
        return rows.map((item) => ({
            id: item.id,
            codigo: item.codigo,
            nombre: item.nombre,
            activo: item.activo,
            subfamiliasCount: item.subfamilias.length,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        }));
    }
    async createFamilia(auth, payload) {
        try {
            const created = await this.prisma.familiaProducto.create({
                data: {
                    tenantId: auth.tenantId,
                    codigo: payload.codigo.trim().toUpperCase(),
                    nombre: payload.nombre.trim(),
                    activo: payload.activo,
                },
            });
            return this.toFamiliaResponse(created);
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async updateFamilia(auth, id, payload) {
        await this.findFamiliaOrThrow(auth, id, this.prisma);
        try {
            const updated = await this.prisma.familiaProducto.update({
                where: { id },
                data: {
                    codigo: payload.codigo.trim().toUpperCase(),
                    nombre: payload.nombre.trim(),
                    activo: payload.activo,
                },
            });
            return this.toFamiliaResponse(updated);
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async findSubfamilias(auth, familiaId) {
        await this.ensureCatalogoInicialImprentaDigital(auth);
        const rows = await this.prisma.subfamiliaProducto.findMany({
            where: {
                tenantId: auth.tenantId,
                familiaProductoId: familiaId,
            },
            include: {
                familiaProducto: true,
            },
            orderBy: [{ nombre: 'asc' }],
        });
        return rows.map((item) => this.toSubfamiliaResponse(item));
    }
    async createSubfamilia(auth, payload) {
        await this.findFamiliaOrThrow(auth, payload.familiaProductoId, this.prisma);
        try {
            const created = await this.prisma.subfamiliaProducto.create({
                data: {
                    tenantId: auth.tenantId,
                    familiaProductoId: payload.familiaProductoId,
                    codigo: payload.codigo.trim().toUpperCase(),
                    nombre: payload.nombre.trim(),
                    unidadComercial: payload.unidadComercial?.trim() || null,
                    activo: payload.activo,
                },
                include: {
                    familiaProducto: true,
                },
            });
            return this.toSubfamiliaResponse(created);
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async updateSubfamilia(auth, id, payload) {
        await this.findSubfamiliaOrThrow(auth, id, this.prisma);
        await this.findFamiliaOrThrow(auth, payload.familiaProductoId, this.prisma);
        try {
            const updated = await this.prisma.subfamiliaProducto.update({
                where: { id },
                data: {
                    familiaProductoId: payload.familiaProductoId,
                    codigo: payload.codigo.trim().toUpperCase(),
                    nombre: payload.nombre.trim(),
                    unidadComercial: payload.unidadComercial?.trim() || null,
                    activo: payload.activo,
                },
                include: {
                    familiaProducto: true,
                },
            });
            return this.toSubfamiliaResponse(updated);
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async findProductos(auth) {
        const rows = await this.prisma.productoServicio.findMany({
            where: {
                tenantId: auth.tenantId,
            },
            include: {
                familiaProducto: true,
                subfamiliaProducto: true,
                procesoDefinicionDefault: true,
            },
            orderBy: [{ nombre: 'asc' }],
        });
        return rows.map((item) => ({
            id: item.id,
            tipo: this.fromTipoProducto(item.tipo),
            codigo: item.codigo,
            nombre: item.nombre,
            descripcion: item.descripcion ?? '',
            motorCodigo: item.motorCodigo,
            motorVersion: item.motorVersion,
            usarRutaComunVariantes: item.usarRutaComunVariantes,
            procesoDefinicionDefaultId: item.procesoDefinicionDefaultId,
            procesoDefinicionDefaultNombre: item.procesoDefinicionDefault?.nombre ?? '',
            estado: this.fromEstadoProducto(item.estado),
            activo: item.activo,
            familiaProductoId: item.familiaProductoId,
            familiaProductoNombre: item.familiaProducto.nombre,
            subfamiliaProductoId: item.subfamiliaProductoId,
            subfamiliaProductoNombre: item.subfamiliaProducto?.nombre ?? '',
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        }));
    }
    async findProducto(auth, id) {
        const item = await this.findProductoOrThrow(auth, id, this.prisma);
        return {
            id: item.id,
            tipo: this.fromTipoProducto(item.tipo),
            codigo: item.codigo,
            nombre: item.nombre,
            descripcion: item.descripcion ?? '',
            motorCodigo: item.motorCodigo,
            motorVersion: item.motorVersion,
            usarRutaComunVariantes: item.usarRutaComunVariantes,
            procesoDefinicionDefaultId: item.procesoDefinicionDefaultId,
            procesoDefinicionDefaultNombre: item.procesoDefinicionDefault?.nombre ?? '',
            estado: this.fromEstadoProducto(item.estado),
            activo: item.activo,
            familiaProductoId: item.familiaProductoId,
            familiaProductoNombre: item.familiaProducto.nombre,
            subfamiliaProductoId: item.subfamiliaProductoId,
            subfamiliaProductoNombre: item.subfamiliaProducto?.nombre ?? '',
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        };
    }
    async createProducto(auth, payload) {
        await this.validateProductoRelations(auth, payload, this.prisma);
        try {
            const codigo = payload.codigo?.trim()
                ? payload.codigo.trim().toUpperCase()
                : await this.generateProductoCodigo(auth, this.prisma);
            const motor = this.resolveMotorOrThrow(payload.motorCodigo ?? ProductosServiciosService_1.MOTOR_DEFAULT.code, payload.motorVersion ?? ProductosServiciosService_1.MOTOR_DEFAULT.version);
            const created = await this.prisma.productoServicio.create({
                data: {
                    tenantId: auth.tenantId,
                    tipo: this.toTipoProducto(payload.tipo),
                    codigo,
                    nombre: payload.nombre.trim(),
                    descripcion: payload.descripcion?.trim() || null,
                    motorCodigo: motor.code,
                    motorVersion: motor.version,
                    usarRutaComunVariantes: true,
                    procesoDefinicionDefaultId: null,
                    familiaProductoId: payload.familiaProductoId,
                    subfamiliaProductoId: payload.subfamiliaProductoId || null,
                    estado: this.toEstadoProducto(payload.estado),
                    activo: payload.activo,
                },
            });
            return this.findProducto(auth, created.id);
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async updateProducto(auth, id, payload) {
        const current = await this.findProductoOrThrow(auth, id, this.prisma);
        await this.validateProductoRelations(auth, payload, this.prisma);
        const motor = this.resolveMotorOrThrow(payload.motorCodigo ?? current.motorCodigo, payload.motorVersion ?? current.motorVersion);
        try {
            await this.prisma.productoServicio.update({
                where: { id },
                data: {
                    tipo: this.toTipoProducto(payload.tipo),
                    codigo: payload.codigo?.trim()
                        ? payload.codigo.trim().toUpperCase()
                        : undefined,
                    nombre: payload.nombre.trim(),
                    descripcion: payload.descripcion?.trim() || null,
                    motorCodigo: motor.code,
                    motorVersion: motor.version,
                    familiaProductoId: payload.familiaProductoId,
                    subfamiliaProductoId: payload.subfamiliaProductoId || null,
                    estado: this.toEstadoProducto(payload.estado),
                    activo: payload.activo,
                },
            });
            return this.findProducto(auth, id);
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async assignProductoMotor(auth, productoId, payload) {
        await this.findProductoOrThrow(auth, productoId, this.prisma);
        const motor = this.resolveMotorOrThrow(payload.motorCodigo, payload.motorVersion);
        await this.prisma.productoServicio.update({
            where: { id: productoId },
            data: {
                motorCodigo: motor.code,
                motorVersion: motor.version,
            },
        });
        return this.findProducto(auth, productoId);
    }
    async getProductoMotorConfig(auth, productoId) {
        const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
        const motor = this.resolveMotorOrThrow(producto.motorCodigo, producto.motorVersion);
        const config = await this.prisma.productoMotorConfig.findFirst({
            where: {
                tenantId: auth.tenantId,
                productoServicioId: producto.id,
                motorCodigo: motor.code,
                motorVersion: motor.version,
                activo: true,
            },
            orderBy: [{ versionConfig: 'desc' }],
        });
        return {
            productoId: producto.id,
            motorCodigo: motor.code,
            motorVersion: motor.version,
            parametros: config?.parametrosJson ?? this.getDefaultMotorConfig(),
            versionConfig: config?.versionConfig ?? 1,
            activo: config?.activo ?? true,
            updatedAt: config?.updatedAt?.toISOString() ?? null,
        };
    }
    async upsertProductoMotorConfig(auth, productoId, payload) {
        const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
        const motor = this.resolveMotorOrThrow(producto.motorCodigo, producto.motorVersion);
        const current = await this.prisma.productoMotorConfig.findFirst({
            where: {
                tenantId: auth.tenantId,
                productoServicioId: producto.id,
                motorCodigo: motor.code,
                motorVersion: motor.version,
                activo: true,
            },
            orderBy: [{ versionConfig: 'desc' }],
        });
        const nextVersion = (current?.versionConfig ?? 0) + 1;
        const merged = this.mergeMotorConfig(current?.parametrosJson, payload.parametros);
        const created = await this.prisma.productoMotorConfig.create({
            data: {
                tenantId: auth.tenantId,
                productoServicioId: producto.id,
                motorCodigo: motor.code,
                motorVersion: motor.version,
                parametrosJson: merged,
                versionConfig: nextVersion,
                activo: true,
            },
        });
        return {
            productoId: producto.id,
            motorCodigo: motor.code,
            motorVersion: motor.version,
            parametros: created.parametrosJson,
            versionConfig: created.versionConfig,
            activo: created.activo,
            updatedAt: created.updatedAt.toISOString(),
        };
    }
    async updateProductoRutaPolicy(auth, productoId, payload) {
        const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
        const procesoDefaultId = payload.procesoDefinicionDefaultId ?? null;
        if (procesoDefaultId) {
            await this.findProcesoOrThrow(auth, procesoDefaultId, this.prisma);
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.productoServicio.update({
                where: { id: producto.id },
                data: {
                    usarRutaComunVariantes: payload.usarRutaComunVariantes,
                    procesoDefinicionDefaultId: procesoDefaultId,
                },
            });
            if (payload.usarRutaComunVariantes) {
                await tx.productoVariante.updateMany({
                    where: {
                        tenantId: auth.tenantId,
                        productoServicioId: producto.id,
                        procesoDefinicionId: { not: null },
                    },
                    data: {
                        procesoDefinicionId: null,
                    },
                });
            }
        });
        return this.findProducto(auth, producto.id);
    }
    async assignProductoVariantesRutaMasiva(auth, productoId, payload) {
        const producto = await this.findProductoOrThrow(auth, productoId, this.prisma);
        await this.findProcesoOrThrow(auth, payload.procesoDefinicionId, this.prisma);
        const where = {
            tenantId: auth.tenantId,
            productoServicioId: producto.id,
        };
        if (!payload.incluirInactivas) {
            where.activo = true;
        }
        const updated = await this.prisma.productoVariante.updateMany({
            where,
            data: {
                procesoDefinicionId: payload.procesoDefinicionId,
            },
        });
        return {
            productoId: producto.id,
            updatedCount: updated.count,
            procesoDefinicionId: payload.procesoDefinicionId,
            incluirInactivas: Boolean(payload.incluirInactivas),
        };
    }
    async findVariantes(auth, productoId) {
        await this.findProductoOrThrow(auth, productoId, this.prisma);
        const rows = await this.prisma.productoVariante.findMany({
            where: {
                tenantId: auth.tenantId,
                productoServicioId: productoId,
            },
            include: {
                papelVariante: {
                    include: {
                        materiaPrima: true,
                    },
                },
                procesoDefinicion: true,
            },
            orderBy: [{ nombre: 'asc' }],
        });
        return rows.map((item) => this.toVarianteResponse(item));
    }
    async createVariante(auth, productoId, payload) {
        await this.findProductoOrThrow(auth, productoId, this.prisma);
        await this.validateVarianteRelations(auth, payload.papelVarianteId, payload.procesoDefinicionId, this.prisma);
        try {
            const created = await this.prisma.productoVariante.create({
                data: {
                    tenantId: auth.tenantId,
                    productoServicioId: productoId,
                    nombre: payload.nombre.trim(),
                    anchoMm: payload.anchoMm,
                    altoMm: payload.altoMm,
                    papelVarianteId: payload.papelVarianteId || null,
                    tipoImpresion: this.toTipoImpresion(payload.tipoImpresion),
                    caras: this.toCaras(payload.caras),
                    procesoDefinicionId: payload.procesoDefinicionId || null,
                    activo: payload.activo ?? true,
                },
                include: {
                    papelVariante: {
                        include: {
                            materiaPrima: true,
                        },
                    },
                    procesoDefinicion: true,
                },
            });
            return this.toVarianteResponse(created);
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async updateVariante(auth, varianteId, payload) {
        await this.findVarianteOrThrow(auth, varianteId, this.prisma);
        await this.validateVarianteRelations(auth, payload.papelVarianteId, payload.procesoDefinicionId, this.prisma);
        try {
            const updated = await this.prisma.productoVariante.update({
                where: { id: varianteId },
                data: {
                    nombre: payload.nombre?.trim(),
                    anchoMm: payload.anchoMm,
                    altoMm: payload.altoMm,
                    papelVarianteId: payload.papelVarianteId ?? undefined,
                    tipoImpresion: payload.tipoImpresion
                        ? this.toTipoImpresion(payload.tipoImpresion)
                        : undefined,
                    caras: payload.caras ? this.toCaras(payload.caras) : undefined,
                    procesoDefinicionId: payload.procesoDefinicionId ?? undefined,
                    activo: payload.activo,
                },
                include: {
                    papelVariante: {
                        include: {
                            materiaPrima: true,
                        },
                    },
                    procesoDefinicion: true,
                },
            });
            return this.toVarianteResponse(updated);
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async deleteVariante(auth, varianteId) {
        const variante = await this.findVarianteOrThrow(auth, varianteId, this.prisma);
        await this.prisma.productoVariante.delete({
            where: {
                id: variante.id,
            },
        });
        return {
            id: variante.id,
            deleted: true,
        };
    }
    async assignVarianteRuta(auth, varianteId, payload) {
        const variante = await this.findVarianteOrThrow(auth, varianteId, this.prisma);
        const producto = await this.findProductoOrThrow(auth, variante.productoServicioId, this.prisma);
        if (producto.usarRutaComunVariantes) {
            throw new common_1.BadRequestException('El producto usa una ruta común. Desactiva "misma ruta para variantes" para asignar rutas por variante.');
        }
        if (payload.procesoDefinicionId) {
            await this.findProcesoOrThrow(auth, payload.procesoDefinicionId, this.prisma);
        }
        const updated = await this.prisma.productoVariante.update({
            where: { id: varianteId },
            data: {
                procesoDefinicionId: payload.procesoDefinicionId ?? null,
            },
            include: {
                papelVariante: {
                    include: {
                        materiaPrima: true,
                    },
                },
                procesoDefinicion: true,
            },
        });
        return this.toVarianteResponse(updated);
    }
    async getVarianteMotorOverride(auth, varianteId) {
        const variante = await this.findVarianteOrThrow(auth, varianteId, this.prisma);
        const producto = await this.findProductoOrThrow(auth, variante.productoServicioId, this.prisma);
        const motor = this.resolveMotorOrThrow(producto.motorCodigo, producto.motorVersion);
        const config = await this.prisma.productoVarianteMotorOverride.findFirst({
            where: {
                tenantId: auth.tenantId,
                productoVarianteId: variante.id,
                motorCodigo: motor.code,
                motorVersion: motor.version,
                activo: true,
            },
            orderBy: [{ versionConfig: 'desc' }],
        });
        return {
            varianteId: variante.id,
            motorCodigo: motor.code,
            motorVersion: motor.version,
            parametros: config?.parametrosJson ?? {},
            versionConfig: config?.versionConfig ?? 1,
            activo: config?.activo ?? true,
            updatedAt: config?.updatedAt.toISOString() ?? null,
        };
    }
    async upsertVarianteMotorOverride(auth, varianteId, payload) {
        const variante = await this.findVarianteOrThrow(auth, varianteId, this.prisma);
        const producto = await this.findProductoOrThrow(auth, variante.productoServicioId, this.prisma);
        const motor = this.resolveMotorOrThrow(producto.motorCodigo, producto.motorVersion);
        const current = await this.prisma.productoVarianteMotorOverride.findFirst({
            where: {
                tenantId: auth.tenantId,
                productoVarianteId: variante.id,
                motorCodigo: motor.code,
                motorVersion: motor.version,
                activo: true,
            },
            orderBy: [{ versionConfig: 'desc' }],
        });
        const nextVersion = (current?.versionConfig ?? 0) + 1;
        const merged = this.mergeMotorConfig(current?.parametrosJson, payload.parametros);
        const created = await this.prisma.productoVarianteMotorOverride.create({
            data: {
                tenantId: auth.tenantId,
                productoVarianteId: variante.id,
                motorCodigo: motor.code,
                motorVersion: motor.version,
                parametrosJson: merged,
                versionConfig: nextVersion,
                activo: true,
            },
        });
        return {
            varianteId: variante.id,
            motorCodigo: motor.code,
            motorVersion: motor.version,
            parametros: created.parametrosJson,
            versionConfig: created.versionConfig,
            activo: created.activo,
            updatedAt: created.updatedAt.toISOString(),
        };
    }
    async cotizarVariante(auth, varianteId, payload) {
        const cantidad = Math.floor(Number(payload.cantidad));
        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            throw new common_1.BadRequestException('La cantidad debe ser mayor a 0.');
        }
        const periodo = this.normalizePeriodo(payload.periodo);
        const variante = await this.findVarianteCompletaOrThrow(auth, varianteId, this.prisma);
        if (!variante.papelVariante) {
            throw new common_1.BadRequestException('La variante no tiene papel/sustrato asignado.');
        }
        const procesoDefinicionId = this.resolveRutaEfectivaId(variante);
        if (!procesoDefinicionId) {
            throw new common_1.BadRequestException('No hay ruta de producción efectiva para la variante seleccionada.');
        }
        const motor = this.resolveMotorOrThrow(variante.productoServicio.motorCodigo, variante.productoServicio.motorVersion);
        const { config, configVersionBase, configVersionOverride } = await this.getEffectiveMotorConfig(auth, variante.productoServicio.id, variante.id, motor);
        const proceso = await this.findProcesoConOperacionesOrThrow(auth, procesoDefinicionId, this.prisma);
        if (proceso.operaciones.length === 0) {
            throw new common_1.BadRequestException('La ruta seleccionada no tiene pasos operativos.');
        }
        const centroIds = Array.from(new Set(proceso.operaciones.map((item) => item.centroCostoId)));
        const tarifas = await this.prisma.centroCostoTarifaPeriodo.findMany({
            where: {
                tenantId: auth.tenantId,
                periodo,
                estado: client_1.EstadoTarifaCentroCostoPeriodo.PUBLICADA,
                centroCostoId: { in: centroIds },
            },
            select: {
                centroCostoId: true,
                tarifaCalculada: true,
            },
        });
        const tarifaByCentro = new Map(tarifas.map((item) => [item.centroCostoId, item.tarifaCalculada]));
        for (const op of proceso.operaciones) {
            if (!tarifaByCentro.has(op.centroCostoId)) {
                throw new common_1.BadRequestException(`No hay tarifa PUBLICADA para ${op.centroCosto.nombre} en ${periodo}.`);
            }
        }
        const sustratoDims = this.resolvePapelDimensionesMm(variante.papelVariante.atributosVarianteJson);
        const pliegoImpresion = this.resolvePliegoImpresion(config, sustratoDims);
        const machineMargins = this.resolveMachineMarginsMm(proceso.operaciones);
        const imposicion = this.calculateImposicion({
            varianteAnchoMm: Number(variante.anchoMm),
            varianteAltoMm: Number(variante.altoMm),
            sheetAnchoMm: pliegoImpresion.anchoMm,
            sheetAltoMm: pliegoImpresion.altoMm,
            machineMargins,
            config,
        });
        if (imposicion.piezasPorPliego <= 0) {
            throw new common_1.BadRequestException('No entran piezas en el pliego con la configuracion actual.');
        }
        const mermaPct = Number(config.mermaAdicionalPct ?? 0);
        const cantidadConMerma = Math.ceil(cantidad * (1 + mermaPct / 100));
        const pliegos = Math.ceil(cantidadConMerma / imposicion.piezasPorPliego);
        const precioPapelBase = Number(variante.papelVariante.precioReferencia ?? 0);
        const conversionPapel = this.calculateSustratoToPliegoConversion({
            sustrato: sustratoDims,
            pliegoImpresion,
        });
        const costoPapelUnit = conversionPapel.pliegosPorSustrato > 0
            ? precioPapelBase / conversionPapel.pliegosPorSustrato
            : 0;
        const costoPapel = costoPapelUnit * pliegos;
        const warnings = [];
        if (!variante.papelVariante.precioReferencia) {
            warnings.push('El papel asignado no tiene precio de referencia. Se uso 0 para costo de papel.');
        }
        const materiales = [];
        let costoToner = 0;
        let costoDesgaste = 0;
        const areaPliegoM2 = (pliegoImpresion.anchoMm / 1000) * (pliegoImpresion.altoMm / 1000);
        const a4EqFactor = areaPliegoM2 / ProductosServiciosService_1.DEFAULT_A4_AREA_M2;
        const carasFactor = variante.caras === client_1.CarasProductoVariante.DOBLE_FAZ ? 2 : 1;
        const machineIds = Array.from(new Set(proceso.operaciones
            .map((op) => op.maquinaId)
            .filter((item) => Boolean(item))));
        const [consumibles, desgastes] = await Promise.all([
            this.prisma.maquinaConsumible.findMany({
                where: {
                    tenantId: auth.tenantId,
                    activo: true,
                    tipo: client_1.TipoConsumibleMaquina.TONER,
                    maquinaId: {
                        in: machineIds,
                    },
                },
                include: {
                    perfilOperativo: true,
                    materiaPrimaVariante: {
                        include: {
                            materiaPrima: true,
                        },
                    },
                },
            }),
            this.prisma.maquinaComponenteDesgaste.findMany({
                where: {
                    tenantId: auth.tenantId,
                    activo: true,
                    maquinaId: {
                        in: machineIds,
                    },
                },
                include: {
                    materiaPrimaVariante: {
                        include: {
                            materiaPrima: true,
                        },
                    },
                },
            }),
        ]);
        const pasos = proceso.operaciones.map((op) => {
            const setupMin = Number(op.setupMin ?? this.getSetupFromPerfilOperativo(op.perfilOperativo) ?? 0);
            const cleanupMin = Number(op.cleanupMin ?? 0);
            const tiempoFijoMin = Number(op.tiempoFijoMin ?? 0);
            const usarTiempoFijoManual = tiempoFijoMin > 0;
            const cantidadObjetivoSalida = op.unidadEntrada === client_1.UnidadProceso.HOJA ||
                op.unidadSalida === client_1.UnidadProceso.HOJA
                ? pliegos
                : cantidad;
            let runMin = Number(op.runMin ?? 0);
            if (!usarTiempoFijoManual) {
                const productividad = (0, proceso_productividad_engine_1.evaluateProductividad)({
                    modoProductividad: client_1.ModoProductividadProceso.FIJA,
                    productividadBase: op.productividadBase,
                    reglaVelocidadJson: null,
                    reglaMermaJson: op.reglaMermaJson,
                    runMin: op.runMin,
                    unidadTiempo: op.unidadTiempo,
                    mermaRunPct: op.mermaRunPct,
                    mermaSetup: op.mermaSetup,
                    cantidadObjetivoSalida,
                    contexto: {
                        cantidad,
                        pliegos,
                        piezasPorPliego: imposicion.piezasPorPliego,
                        areaPliegoM2,
                        a4EqFactor,
                        carasFactor,
                    },
                });
                runMin = productividad.runMin;
                for (const warning of productividad.warnings) {
                    warnings.push(`Paso ${op.codigo} (${op.nombre}): ${warning}`);
                }
            }
            if (op.maquinaId) {
                const tonerAndWear = this.calculateMachineConsumables({
                    operation: op,
                    tipoImpresion: variante.tipoImpresion,
                    carasFactor,
                    pliegos,
                    areaPliegoM2,
                    a4EqFactor,
                    warnings,
                    consumibles,
                    desgastes,
                });
                costoToner += tonerAndWear.costoToner;
                costoDesgaste += tonerAndWear.costoDesgaste;
                materiales.push(...tonerAndWear.materiales);
            }
            const totalMin = setupMin + runMin + cleanupMin + tiempoFijoMin;
            const tarifa = tarifaByCentro.get(op.centroCostoId);
            const costoPaso = Number(tarifa.mul(totalMin / 60).toFixed(6));
            return {
                orden: op.orden,
                codigo: op.codigo,
                nombre: op.nombre,
                centroCostoId: op.centroCostoId,
                centroCostoNombre: op.centroCosto.nombre,
                setupMin,
                runMin,
                cleanupMin,
                tiempoFijoMin,
                totalMin: Number(totalMin.toFixed(4)),
                tarifaHora: Number(tarifa),
                costo: costoPaso,
            };
        });
        const costoProcesos = pasos.reduce((acc, item) => acc + item.costo, 0);
        materiales.unshift({
            tipo: 'PAPEL',
            nombre: variante.papelVariante.materiaPrima.nombre,
            sku: variante.papelVariante.sku,
            cantidad: pliegos,
            costoUnitario: costoPapelUnit,
            costo: costoPapel,
            esCostoDerivado: conversionPapel.esDerivado,
            pliegosPorSustrato: conversionPapel.pliegosPorSustrato,
            orientacionConversion: conversionPapel.orientacion,
            sustratoAnchoMm: sustratoDims.anchoMm,
            sustratoAltoMm: sustratoDims.altoMm,
            pliegoImpresionAnchoMm: pliegoImpresion.anchoMm,
            pliegoImpresionAltoMm: pliegoImpresion.altoMm,
        });
        const total = Number((costoPapel + costoToner + costoDesgaste + costoProcesos).toFixed(6));
        const unitario = Number((total / cantidad).toFixed(6));
        const result = {
            varianteId: variante.id,
            productoServicioId: variante.productoServicioId,
            productoNombre: variante.productoServicio.nombre,
            varianteNombre: variante.nombre,
            motorCodigo: motor.code,
            motorVersion: motor.version,
            periodo,
            cantidad,
            piezasPorPliego: imposicion.piezasPorPliego,
            pliegos,
            warnings,
            bloques: {
                procesos: pasos,
                materiales,
            },
            subtotales: {
                procesos: Number(costoProcesos.toFixed(6)),
                papel: Number(costoPapel.toFixed(6)),
                toner: Number(costoToner.toFixed(6)),
                desgaste: Number(costoDesgaste.toFixed(6)),
            },
            total,
            unitario,
            trazabilidad: {
                imposicion,
                conversionPapel,
                config,
                configVersionBase,
                configVersionOverride,
            },
        };
        const snapshot = await this.prisma.cotizacionProductoSnapshot.create({
            data: {
                tenantId: auth.tenantId,
                productoVarianteId: variante.id,
                motorCodigo: motor.code,
                motorVersion: motor.version,
                configVersionBase,
                configVersionOverride,
                cantidad,
                periodoTarifa: periodo,
                inputJson: {
                    cantidad,
                    periodo,
                    config,
                },
                resultadoJson: result,
                total: new client_1.Prisma.Decimal(total),
            },
        });
        return {
            snapshotId: snapshot.id,
            ...result,
            createdAt: snapshot.createdAt.toISOString(),
        };
    }
    async previewVarianteImposicion(auth, varianteId, payload) {
        const variante = await this.findVarianteCompletaOrThrow(auth, varianteId, this.prisma);
        if (!variante.papelVariante) {
            throw new common_1.BadRequestException('La variante no tiene papel/sustrato asignado.');
        }
        const procesoDefinicionId = this.resolveRutaEfectivaId(variante);
        if (!procesoDefinicionId) {
            throw new common_1.BadRequestException('No hay ruta de producción efectiva para la variante seleccionada.');
        }
        const motor = this.resolveMotorOrThrow(variante.productoServicio.motorCodigo, variante.productoServicio.motorVersion);
        const { config: persisted } = await this.getEffectiveMotorConfig(auth, variante.productoServicio.id, variante.id, motor);
        const config = this.mergeMotorConfig(persisted, payload.parametros ?? {});
        const proceso = await this.findProcesoConOperacionesOrThrow(auth, procesoDefinicionId, this.prisma);
        const sustratoDims = this.resolvePapelDimensionesMm(variante.papelVariante.atributosVarianteJson);
        const pliegoImpresion = this.resolvePliegoImpresion(config, sustratoDims);
        const machineMargins = this.resolveMachineMarginsMm(proceso.operaciones);
        const imposicion = this.calculateImposicion({
            varianteAnchoMm: Number(variante.anchoMm),
            varianteAltoMm: Number(variante.altoMm),
            sheetAnchoMm: pliegoImpresion.anchoMm,
            sheetAltoMm: pliegoImpresion.altoMm,
            machineMargins,
            config,
        });
        const conversionPapel = this.calculateSustratoToPliegoConversion({
            sustrato: sustratoDims,
            pliegoImpresion,
        });
        return {
            varianteId: variante.id,
            varianteNombre: variante.nombre,
            pliegoImpresion,
            sustrato: sustratoDims,
            machineMargins,
            imposicion,
            conversionPapel,
            config,
        };
    }
    async getVarianteCotizaciones(auth, varianteId) {
        await this.findVarianteOrThrow(auth, varianteId, this.prisma);
        const rows = await this.prisma.cotizacionProductoSnapshot.findMany({
            where: {
                tenantId: auth.tenantId,
                productoVarianteId: varianteId,
            },
            orderBy: [{ createdAt: 'desc' }],
        });
        return rows.map((item) => ({
            id: item.id,
            cantidad: item.cantidad,
            periodoTarifa: item.periodoTarifa,
            motorCodigo: item.motorCodigo,
            motorVersion: item.motorVersion,
            configVersionBase: item.configVersionBase,
            configVersionOverride: item.configVersionOverride,
            total: Number(item.total),
            unitario: Number(item.total.div(item.cantidad)),
            createdAt: item.createdAt.toISOString(),
        }));
    }
    async getCotizacionById(auth, snapshotId) {
        const item = await this.prisma.cotizacionProductoSnapshot.findFirst({
            where: {
                tenantId: auth.tenantId,
                id: snapshotId,
            },
        });
        if (!item) {
            throw new common_1.NotFoundException('Snapshot de cotizacion no encontrado.');
        }
        return {
            id: item.id,
            cantidad: item.cantidad,
            periodoTarifa: item.periodoTarifa,
            motorCodigo: item.motorCodigo,
            motorVersion: item.motorVersion,
            configVersionBase: item.configVersionBase,
            configVersionOverride: item.configVersionOverride,
            total: Number(item.total),
            resultado: item.resultadoJson,
            createdAt: item.createdAt.toISOString(),
        };
    }
    async validateProductoRelations(auth, payload, tx) {
        await this.findFamiliaOrThrow(auth, payload.familiaProductoId, tx);
        if (payload.subfamiliaProductoId) {
            const sub = await this.findSubfamiliaOrThrow(auth, payload.subfamiliaProductoId, tx);
            if (sub.familiaProductoId !== payload.familiaProductoId) {
                throw new common_1.BadRequestException('La subfamilia no pertenece a la familia seleccionada.');
            }
        }
    }
    async findFamiliaOrThrow(auth, id, tx) {
        const familia = await tx.familiaProducto.findFirst({
            where: {
                tenantId: auth.tenantId,
                id,
            },
        });
        if (!familia) {
            throw new common_1.NotFoundException('Familia de producto no encontrada.');
        }
        return familia;
    }
    async findSubfamiliaOrThrow(auth, id, tx) {
        const item = await tx.subfamiliaProducto.findFirst({
            where: {
                tenantId: auth.tenantId,
                id,
            },
            include: {
                familiaProducto: true,
            },
        });
        if (!item) {
            throw new common_1.NotFoundException('Subfamilia de producto no encontrada.');
        }
        return item;
    }
    async findProductoOrThrow(auth, id, tx) {
        const item = await tx.productoServicio.findFirst({
            where: {
                tenantId: auth.tenantId,
                id,
            },
            include: {
                familiaProducto: true,
                subfamiliaProducto: true,
                procesoDefinicionDefault: true,
            },
        });
        if (!item) {
            throw new common_1.NotFoundException('Producto/servicio no encontrado.');
        }
        return item;
    }
    async findVarianteOrThrow(auth, id, tx) {
        const item = await tx.productoVariante.findFirst({
            where: {
                tenantId: auth.tenantId,
                id,
            },
            include: {
                papelVariante: {
                    include: {
                        materiaPrima: true,
                    },
                },
                procesoDefinicion: true,
            },
        });
        if (!item) {
            throw new common_1.NotFoundException('Variante de producto no encontrada.');
        }
        return item;
    }
    async findPapelVarianteOrThrow(auth, id, tx) {
        const item = await tx.materiaPrimaVariante.findFirst({
            where: {
                tenantId: auth.tenantId,
                id,
            },
            include: {
                materiaPrima: true,
            },
        });
        if (!item) {
            throw new common_1.NotFoundException('Variante de materia prima no encontrada.');
        }
        return item;
    }
    async findProcesoOrThrow(auth, id, tx) {
        const item = await tx.procesoDefinicion.findFirst({
            where: {
                tenantId: auth.tenantId,
                id,
            },
        });
        if (!item) {
            throw new common_1.NotFoundException('Ruta de produccion no encontrada.');
        }
        return item;
    }
    toFamiliaResponse(item) {
        return {
            id: item.id,
            codigo: item.codigo,
            nombre: item.nombre,
            activo: item.activo,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        };
    }
    toSubfamiliaResponse(item) {
        return {
            id: item.id,
            codigo: item.codigo,
            nombre: item.nombre,
            unidadComercial: item.unidadComercial ?? '',
            activo: item.activo,
            familiaProductoId: item.familiaProductoId,
            familiaProductoNombre: item.familiaProducto.nombre,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        };
    }
    async validateVarianteRelations(auth, papelVarianteId, procesoDefinicionId, tx) {
        if (papelVarianteId) {
            await this.findPapelVarianteOrThrow(auth, papelVarianteId, tx);
        }
        if (procesoDefinicionId) {
            await this.findProcesoOrThrow(auth, procesoDefinicionId, tx);
        }
    }
    toVarianteResponse(item) {
        return {
            id: item.id,
            productoServicioId: item.productoServicioId,
            nombre: item.nombre,
            anchoMm: Number(item.anchoMm),
            altoMm: Number(item.altoMm),
            papelVarianteId: item.papelVarianteId,
            papelVarianteSku: item.papelVariante?.sku ?? '',
            papelNombre: item.papelVariante?.materiaPrima.nombre ?? '',
            tipoImpresion: this.fromTipoImpresion(item.tipoImpresion),
            caras: this.fromCaras(item.caras),
            procesoDefinicionId: item.procesoDefinicionId,
            procesoDefinicionCodigo: item.procesoDefinicion?.codigo ?? '',
            procesoDefinicionNombre: item.procesoDefinicion?.nombre ?? '',
            activo: item.activo,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        };
    }
    async generateProductoCodigo(auth, tx) {
        for (let attempt = 0; attempt < ProductosServiciosService_1.CODIGO_MAX_RETRIES; attempt += 1) {
            const count = await tx.productoServicio.count({
                where: {
                    tenantId: auth.tenantId,
                },
            });
            const code = `${ProductosServiciosService_1.CODIGO_PREFIX}-${String(count + attempt + 1).padStart(4, '0')}`;
            const exists = await tx.productoServicio.findFirst({
                where: {
                    tenantId: auth.tenantId,
                    codigo: code,
                },
                select: {
                    id: true,
                },
            });
            if (!exists) {
                return code;
            }
        }
        return `${ProductosServiciosService_1.CODIGO_PREFIX}-${(0, node_crypto_1.randomUUID)().slice(0, 8).toUpperCase()}`;
    }
    async ensureCatalogoInicialImprentaDigital(auth) {
        await this.prisma.$transaction(async (tx) => {
            let familia = await tx.familiaProducto.findFirst({
                where: {
                    tenantId: auth.tenantId,
                    codigo: ProductosServiciosService_1.FAMILIA_BASE_CODIGO,
                },
            });
            if (!familia) {
                const legacy = await tx.familiaProducto.findFirst({
                    where: {
                        tenantId: auth.tenantId,
                        codigo: ProductosServiciosService_1.FAMILIA_BASE_CODIGO_LEGACY,
                    },
                });
                if (legacy) {
                    familia = await tx.familiaProducto.update({
                        where: { id: legacy.id },
                        data: { codigo: ProductosServiciosService_1.FAMILIA_BASE_CODIGO },
                    });
                }
            }
            if (!familia) {
                familia = await tx.familiaProducto.create({
                    data: {
                        tenantId: auth.tenantId,
                        codigo: ProductosServiciosService_1.FAMILIA_BASE_CODIGO,
                        nombre: 'Imprenta digital hoja',
                        activo: true,
                    },
                });
            }
            let subfamilia = await tx.subfamiliaProducto.findFirst({
                where: {
                    tenantId: auth.tenantId,
                    familiaProductoId: familia.id,
                    codigo: ProductosServiciosService_1.SUBFAMILIA_BASE_CODIGO,
                },
            });
            if (!subfamilia) {
                const legacySub = await tx.subfamiliaProducto.findFirst({
                    where: {
                        tenantId: auth.tenantId,
                        familiaProductoId: familia.id,
                        codigo: ProductosServiciosService_1.SUBFAMILIA_BASE_CODIGO_LEGACY,
                    },
                });
                if (legacySub) {
                    subfamilia = await tx.subfamiliaProducto.update({
                        where: { id: legacySub.id },
                        data: { codigo: ProductosServiciosService_1.SUBFAMILIA_BASE_CODIGO },
                    });
                }
            }
            if (!subfamilia) {
                await tx.subfamiliaProducto.create({
                    data: {
                        tenantId: auth.tenantId,
                        familiaProductoId: familia.id,
                        codigo: ProductosServiciosService_1.SUBFAMILIA_BASE_CODIGO,
                        nombre: 'Tarjetas personales',
                        unidadComercial: 'unidad',
                        activo: true,
                    },
                });
            }
        });
    }
    resolveMotorOrThrow(code, version) {
        if (code === ProductosServiciosService_1.MOTOR_DEFAULT.code &&
            version === ProductosServiciosService_1.MOTOR_DEFAULT.version) {
            return {
                code,
                version,
                label: ProductosServiciosService_1.MOTOR_DEFAULT.label,
            };
        }
        throw new common_1.BadRequestException(`Motor no soportado: ${code}@${version}.`);
    }
    getDefaultMotorConfig() {
        return {
            tipoCorte: 'sin_demasia',
            demasiaCorteMm: 0,
            lineaCorteMm: 3,
            tamanoPliegoImpresion: {
                codigo: 'A4',
                nombre: 'A4',
                anchoMm: 210,
                altoMm: 297,
            },
            mermaAdicionalPct: 0,
        };
    }
    mergeMotorConfig(existing, incoming) {
        const base = this.getDefaultMotorConfig();
        const current = (existing && typeof existing === 'object' ? existing : {});
        return {
            ...base,
            ...current,
            ...incoming,
        };
    }
    async getEffectiveMotorConfig(auth, productoId, varianteId, motor) {
        const [baseConfig, overrideConfig] = await Promise.all([
            this.prisma.productoMotorConfig.findFirst({
                where: {
                    tenantId: auth.tenantId,
                    productoServicioId: productoId,
                    motorCodigo: motor.code,
                    motorVersion: motor.version,
                    activo: true,
                },
                orderBy: [{ versionConfig: 'desc' }],
            }),
            this.prisma.productoVarianteMotorOverride.findFirst({
                where: {
                    tenantId: auth.tenantId,
                    productoVarianteId: varianteId,
                    motorCodigo: motor.code,
                    motorVersion: motor.version,
                    activo: true,
                },
                orderBy: [{ versionConfig: 'desc' }],
            }),
        ]);
        const mergedBase = this.mergeMotorConfig(baseConfig?.parametrosJson, {});
        const merged = this.mergeMotorConfig(mergedBase, (overrideConfig?.parametrosJson ?? {}));
        return {
            config: merged,
            configVersionBase: baseConfig?.versionConfig ?? null,
            configVersionOverride: overrideConfig?.versionConfig ?? null,
        };
    }
    resolveRutaEfectivaId(variante) {
        if (variante.productoServicio.usarRutaComunVariantes) {
            return variante.productoServicio.procesoDefinicionDefaultId;
        }
        return variante.procesoDefinicionId;
    }
    normalizePeriodo(periodo) {
        if (!periodo) {
            const now = new Date();
            return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
        }
        if (!DEFAULT_PERIOD_REGEX.test(periodo)) {
            throw new common_1.BadRequestException('El periodo debe tener formato YYYY-MM.');
        }
        return periodo;
    }
    async findVarianteCompletaOrThrow(auth, varianteId, tx) {
        const variante = await tx.productoVariante.findFirst({
            where: {
                tenantId: auth.tenantId,
                id: varianteId,
            },
            include: {
                productoServicio: true,
                papelVariante: {
                    include: {
                        materiaPrima: true,
                    },
                },
            },
        });
        if (!variante) {
            throw new common_1.NotFoundException('Variante de producto no encontrada.');
        }
        return variante;
    }
    async findProcesoConOperacionesOrThrow(auth, procesoId, tx) {
        const proceso = await tx.procesoDefinicion.findFirst({
            where: {
                tenantId: auth.tenantId,
                id: procesoId,
            },
            include: {
                operaciones: {
                    include: {
                        centroCosto: true,
                        maquina: true,
                        perfilOperativo: true,
                    },
                    orderBy: [{ orden: 'asc' }],
                },
            },
        });
        if (!proceso) {
            throw new common_1.NotFoundException('Ruta de produccion no encontrada.');
        }
        return proceso;
    }
    resolvePapelDimensionesMm(atributos) {
        if (!atributos || typeof atributos !== 'object') {
            throw new common_1.BadRequestException('El papel asignado no tiene dimensiones configuradas.');
        }
        const obj = atributos;
        const anchoRaw = Number(obj.ancho);
        const altoRaw = Number(obj.alto);
        if (!Number.isFinite(anchoRaw) || !Number.isFinite(altoRaw) || anchoRaw <= 0 || altoRaw <= 0) {
            throw new common_1.BadRequestException('El papel asignado no tiene ancho/alto validos.');
        }
        return {
            anchoMm: this.normalizeToMm(anchoRaw),
            altoMm: this.normalizeToMm(altoRaw),
        };
    }
    normalizeToMm(value) {
        if (value <= 100) {
            return value * 10;
        }
        return value;
    }
    resolveMachineMarginsMm(operations) {
        const machineOp = operations.find((item) => item.maquina?.parametrosTecnicosJson);
        if (!machineOp?.maquina?.parametrosTecnicosJson || typeof machineOp.maquina.parametrosTecnicosJson !== 'object') {
            return { leftMm: 0, rightMm: 0, topMm: 0, bottomMm: 0 };
        }
        const p = machineOp.maquina.parametrosTecnicosJson;
        return {
            leftMm: this.normalizeToMm(Number(p.margenIzquierdo ?? 0)),
            rightMm: this.normalizeToMm(Number(p.margenDerecho ?? 0)),
            topMm: this.normalizeToMm(Number(p.margenSuperior ?? 0)),
            bottomMm: this.normalizeToMm(Number(p.margenInferior ?? 0)),
        };
    }
    calculateImposicion(input) {
        const tipoCorte = String(input.config.tipoCorte ?? 'sin_demasia');
        const demasiaRaw = Number(input.config.demasiaCorteMm ?? 0);
        const demasiaCorteMm = tipoCorte === 'con_demasia' && Number.isFinite(demasiaRaw) ? Math.max(0, demasiaRaw) : 0;
        const lineaCorteRaw = Number(input.config.lineaCorteMm ?? 3);
        const lineaCorteMm = Number.isFinite(lineaCorteRaw) ? Math.max(0, lineaCorteRaw) : 3;
        const piezaAnchoEfectivoMm = input.varianteAnchoMm + 2 * demasiaCorteMm;
        const piezaAltoEfectivoMm = input.varianteAltoMm + 2 * demasiaCorteMm;
        const anchoImprimible = input.sheetAnchoMm - input.machineMargins.leftMm - input.machineMargins.rightMm;
        const altoImprimible = input.sheetAltoMm - input.machineMargins.topMm - input.machineMargins.bottomMm;
        const anchoDisponible = anchoImprimible - 2 * lineaCorteMm;
        const altoDisponible = altoImprimible - 2 * lineaCorteMm;
        const normalCols = Math.floor(anchoDisponible / piezaAnchoEfectivoMm);
        const normalRows = Math.floor(altoDisponible / piezaAltoEfectivoMm);
        const normal = Math.max(0, normalCols) * Math.max(0, normalRows);
        const rotCols = Math.floor(anchoDisponible / piezaAltoEfectivoMm);
        const rotRows = Math.floor(altoDisponible / piezaAnchoEfectivoMm);
        const rotada = Math.max(0, rotCols) * Math.max(0, rotRows);
        const piezasPorPliego = Math.max(normal, rotada);
        const orientacion = rotada > normal ? 'rotada' : 'normal';
        const cols = orientacion === 'rotada' ? Math.max(0, rotCols) : Math.max(0, normalCols);
        const rows = orientacion === 'rotada' ? Math.max(0, rotRows) : Math.max(0, normalRows);
        return {
            tipoCorte,
            piezasPorPliego,
            orientacion,
            anchoImprimibleMm: Number(anchoImprimible.toFixed(2)),
            altoImprimibleMm: Number(altoImprimible.toFixed(2)),
            anchoDisponibleMm: Number(anchoDisponible.toFixed(2)),
            altoDisponibleMm: Number(altoDisponible.toFixed(2)),
            normal,
            rotada,
            demasiaCorteMm: Number(demasiaCorteMm.toFixed(2)),
            lineaCorteMm: Number(lineaCorteMm.toFixed(2)),
            piezaAnchoMm: input.varianteAnchoMm,
            piezaAltoMm: input.varianteAltoMm,
            piezaAnchoEfectivoMm: Number(piezaAnchoEfectivoMm.toFixed(2)),
            piezaAltoEfectivoMm: Number(piezaAltoEfectivoMm.toFixed(2)),
            cols,
            rows,
            sheetAnchoMm: input.sheetAnchoMm,
            sheetAltoMm: input.sheetAltoMm,
            machineMargins: input.machineMargins,
        };
    }
    resolvePliegoImpresion(config, fallback) {
        const raw = config.tamanoPliegoImpresion;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return {
                codigo: 'CUSTOM',
                nombre: 'Personalizado',
                anchoMm: fallback.anchoMm,
                altoMm: fallback.altoMm,
            };
        }
        const item = raw;
        const anchoMm = Number(item.anchoMm ?? fallback.anchoMm);
        const altoMm = Number(item.altoMm ?? fallback.altoMm);
        if (!Number.isFinite(anchoMm) || !Number.isFinite(altoMm) || anchoMm <= 0 || altoMm <= 0) {
            return {
                codigo: 'CUSTOM',
                nombre: 'Personalizado',
                anchoMm: fallback.anchoMm,
                altoMm: fallback.altoMm,
            };
        }
        return {
            codigo: String(item.codigo ?? 'CUSTOM'),
            nombre: String(item.nombre ?? 'Personalizado'),
            anchoMm: this.normalizeToMm(anchoMm),
            altoMm: this.normalizeToMm(altoMm),
        };
    }
    calculateSustratoToPliegoConversion(input) {
        const direct = this.approxEqualMm(input.sustrato.anchoMm, input.pliegoImpresion.anchoMm) &&
            this.approxEqualMm(input.sustrato.altoMm, input.pliegoImpresion.altoMm);
        const rotatedDirect = this.approxEqualMm(input.sustrato.anchoMm, input.pliegoImpresion.altoMm) &&
            this.approxEqualMm(input.sustrato.altoMm, input.pliegoImpresion.anchoMm);
        if (direct || rotatedDirect) {
            return {
                esDerivado: false,
                pliegosPorSustrato: 1,
                orientacion: direct ? 'normal' : 'rotada',
            };
        }
        const normalCols = Math.floor(input.sustrato.anchoMm / input.pliegoImpresion.anchoMm);
        const normalRows = Math.floor(input.sustrato.altoMm / input.pliegoImpresion.altoMm);
        const normal = Math.max(0, normalCols) * Math.max(0, normalRows);
        const rotCols = Math.floor(input.sustrato.anchoMm / input.pliegoImpresion.altoMm);
        const rotRows = Math.floor(input.sustrato.altoMm / input.pliegoImpresion.anchoMm);
        const rotada = Math.max(0, rotCols) * Math.max(0, rotRows);
        const pliegosPorSustrato = Math.max(normal, rotada);
        return {
            esDerivado: true,
            pliegosPorSustrato: Math.max(1, pliegosPorSustrato),
            orientacion: rotada > normal ? 'rotada' : 'normal',
        };
    }
    approxEqualMm(a, b) {
        return Math.abs(a - b) <= 0.01;
    }
    calculateMachineConsumables(input) {
        if (!input.operation.maquinaId) {
            return { costoToner: 0, costoDesgaste: 0, materiales: [] };
        }
        const materiales = [];
        let costoToner = 0;
        let costoDesgaste = 0;
        const operationProductividad = Number(input.operation.productividadBase ?? 0);
        const machineConsumibles = input.consumibles.filter((item) => item.maquinaId === input.operation.maquinaId);
        const machineDesgastes = input.desgastes.filter((item) => item.maquinaId === input.operation.maquinaId);
        const selectedPerfilId = input.operation.perfilOperativoId ??
            machineConsumibles.find((item) => item.perfilOperativo?.productividad &&
                Number(item.perfilOperativo.productividad) === operationProductividad)?.perfilOperativoId ??
            machineConsumibles[0]?.perfilOperativoId ??
            null;
        const consumibles = selectedPerfilId
            ? machineConsumibles.filter((item) => item.perfilOperativoId === selectedPerfilId)
            : machineConsumibles;
        const consumiblesByColor = new Map();
        for (const item of consumibles) {
            const color = this.normalizeColor(item.detalleJson);
            if (!consumiblesByColor.has(color)) {
                consumiblesByColor.set(color, item);
            }
        }
        const selectedColors = input.tipoImpresion === client_1.TipoImpresionProductoVariante.BN
            ? ['negro']
            : ['cian', 'magenta', 'amarillo', 'negro'];
        for (const color of selectedColors) {
            const item = consumiblesByColor.get(color);
            if (!item) {
                input.warnings.push(`No se encontró consumible de tóner para el canal ${color}.`);
                continue;
            }
            if (item.unidad !== client_1.UnidadConsumoMaquina.GRAMO) {
                input.warnings.push(`Consumible ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) con unidad ${item.unidad}: v1 solo soporta GRAMO.`);
                continue;
            }
            const consumoBase = Number(item.consumoBase ?? 0);
            if (consumoBase <= 0) {
                input.warnings.push(`Consumible ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) sin consumoBase válido.`);
                continue;
            }
            const costoGramo = Number(item.materiaPrimaVariante.precioReferencia ?? 0);
            if (!item.materiaPrimaVariante.precioReferencia) {
                input.warnings.push(`Consumible ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) sin precio de referencia. Se usa 0.`);
            }
            const gramos = consumoBase * input.areaPliegoM2 * input.carasFactor * input.pliegos;
            const costo = gramos * costoGramo;
            costoToner += costo;
            materiales.push({
                tipo: 'TONER',
                canal: color,
                nombre: item.materiaPrimaVariante.materiaPrima.nombre,
                sku: item.materiaPrimaVariante.sku,
                unidad: 'g',
                cantidad: Number(gramos.toFixed(6)),
                costoUnitario: costoGramo,
                costo: Number(costo.toFixed(6)),
            });
        }
        for (const item of machineDesgastes) {
            if (item.unidadDesgaste !== client_1.UnidadDesgasteMaquina.COPIAS_A4_EQUIV) {
                input.warnings.push(`Componente de desgaste ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) con unidad ${item.unidadDesgaste}: v1 solo soporta COPIAS_A4_EQUIV.`);
                continue;
            }
            const vidaUtil = Number(item.vidaUtilEstimada ?? 0);
            if (vidaUtil <= 0) {
                input.warnings.push(`Componente de desgaste ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) sin vida útil estimada válida.`);
                continue;
            }
            const precio = Number(item.materiaPrimaVariante.precioReferencia ?? 0);
            if (!item.materiaPrimaVariante.precioReferencia) {
                input.warnings.push(`Componente de desgaste ${item.materiaPrimaVariante.materiaPrima.nombre} (${item.materiaPrimaVariante.sku}) sin precio de referencia. Se usa 0.`);
            }
            const cantidadA4Eq = input.pliegos * input.a4EqFactor * input.carasFactor;
            const costo = cantidadA4Eq * (precio / vidaUtil);
            costoDesgaste += costo;
            materiales.push({
                tipo: 'DESGASTE',
                nombre: item.materiaPrimaVariante.materiaPrima.nombre,
                sku: item.materiaPrimaVariante.sku,
                unidad: 'a4_eq',
                cantidad: Number(cantidadA4Eq.toFixed(6)),
                costoUnitario: Number((precio / vidaUtil).toFixed(6)),
                costo: Number(costo.toFixed(6)),
            });
        }
        return { costoToner, costoDesgaste, materiales };
    }
    normalizeColor(detalleJson) {
        if (!detalleJson || typeof detalleJson !== 'object') {
            return 'desconocido';
        }
        const color = String(detalleJson.color ?? '').trim().toLowerCase();
        if (!color) {
            return 'desconocido';
        }
        if (color === 'black' || color === 'k') {
            return 'negro';
        }
        return color;
    }
    getSetupFromPerfilOperativo(perfil) {
        if (!perfil) {
            return null;
        }
        const detalle = perfil.detalleJson &&
            typeof perfil.detalleJson === 'object' &&
            !Array.isArray(perfil.detalleJson)
            ? perfil.detalleJson
            : {};
        const values = [];
        const pushIfFinite = (value) => {
            const numeric = typeof value === 'number' ? value : Number(value);
            if (Number.isFinite(numeric) && numeric > 0) {
                values.push(numeric);
            }
        };
        pushIfFinite(detalle.tiempoSetupMin);
        pushIfFinite(detalle.setupMin);
        pushIfFinite(detalle.setup);
        pushIfFinite(perfil.tiempoPreparacionMin ? Number(perfil.tiempoPreparacionMin) : null);
        pushIfFinite(perfil.tiempoRipMin ? Number(perfil.tiempoRipMin) : null);
        pushIfFinite(detalle.tiempoPreparacionMin);
        pushIfFinite(detalle.tiempoRipMin);
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
        if (!values.length) {
            return null;
        }
        return Number(values.reduce((acc, item) => acc + item, 0).toFixed(4));
    }
    toTipoImpresion(value) {
        if (value === productos_servicios_dto_1.TipoImpresionProductoVarianteDto.bn) {
            return client_1.TipoImpresionProductoVariante.BN;
        }
        return client_1.TipoImpresionProductoVariante.CMYK;
    }
    fromTipoImpresion(value) {
        if (value === client_1.TipoImpresionProductoVariante.BN) {
            return productos_servicios_dto_1.TipoImpresionProductoVarianteDto.bn;
        }
        return productos_servicios_dto_1.TipoImpresionProductoVarianteDto.cmyk;
    }
    toCaras(value) {
        if (value === productos_servicios_dto_1.CarasProductoVarianteDto.doble_faz) {
            return client_1.CarasProductoVariante.DOBLE_FAZ;
        }
        return client_1.CarasProductoVariante.SIMPLE_FAZ;
    }
    fromCaras(value) {
        if (value === client_1.CarasProductoVariante.DOBLE_FAZ) {
            return productos_servicios_dto_1.CarasProductoVarianteDto.doble_faz;
        }
        return productos_servicios_dto_1.CarasProductoVarianteDto.simple_faz;
    }
    toTipoProducto(value) {
        if (value === productos_servicios_dto_1.TipoProductoServicioDto.servicio) {
            return client_1.TipoProductoServicio.SERVICIO;
        }
        return client_1.TipoProductoServicio.PRODUCTO;
    }
    fromTipoProducto(value) {
        if (value === client_1.TipoProductoServicio.SERVICIO) {
            return productos_servicios_dto_1.TipoProductoServicioDto.servicio;
        }
        return productos_servicios_dto_1.TipoProductoServicioDto.producto;
    }
    toEstadoProducto(value) {
        if (value === productos_servicios_dto_1.EstadoProductoServicioDto.inactivo) {
            return client_1.EstadoProductoServicio.INACTIVO;
        }
        return client_1.EstadoProductoServicio.ACTIVO;
    }
    fromEstadoProducto(value) {
        if (value === client_1.EstadoProductoServicio.INACTIVO) {
            return productos_servicios_dto_1.EstadoProductoServicioDto.inactivo;
        }
        return productos_servicios_dto_1.EstadoProductoServicioDto.activo;
    }
    handleWriteError(error) {
        if (error instanceof library_1.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                throw new common_1.ConflictException('Ya existe un registro con esa clave unica.');
            }
            if (error.code === 'P2003') {
                throw new common_1.BadRequestException('Referencia invalida para la operacion solicitada.');
            }
        }
        throw error;
    }
};
exports.ProductosServiciosService = ProductosServiciosService;
exports.ProductosServiciosService = ProductosServiciosService = ProductosServiciosService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductosServiciosService);
//# sourceMappingURL=productos-servicios.service.js.map