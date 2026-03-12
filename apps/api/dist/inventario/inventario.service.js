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
exports.InventarioService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const library_1 = require("@prisma/client/runtime/library");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const registrar_movimiento_stock_dto_1 = require("./dto/registrar-movimiento-stock.dto");
const unidades_canonicas_1 = require("./unidades-canonicas");
let InventarioService = class InventarioService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAllMateriasPrimas(auth) {
        const items = await this.prisma.materiaPrima.findMany({
            where: {
                tenantId: auth.tenantId,
            },
            include: {
                variantes: {
                    include: {
                        proveedorReferencia: true,
                    },
                    orderBy: [{ createdAt: 'asc' }],
                },
                compatibilidades: {
                    include: {
                        maquina: true,
                        perfilOperativo: true,
                    },
                    orderBy: [{ createdAt: 'asc' }],
                },
            },
            orderBy: [{ nombre: 'asc' }],
        });
        return items.map((item) => this.toResponse(item));
    }
    async findMateriaPrima(auth, id) {
        const item = await this.findMateriaPrimaOrThrow(auth, id, this.prisma);
        return this.toResponse(item);
    }
    async createMateriaPrima(auth, payload) {
        const normalized = this.normalizePayload(payload);
        try {
            const created = await this.prisma.$transaction(async (tx) => {
                const materiaPrima = await tx.materiaPrima.create({
                    data: {
                        tenantId: auth.tenantId,
                        codigo: normalized.codigo,
                        nombre: normalized.nombre,
                        descripcion: normalized.descripcion,
                        familia: this.toPrismaEnum(normalized.familia),
                        subfamilia: this.toPrismaEnum(normalized.subfamilia),
                        tipoTecnico: normalized.tipoTecnico,
                        templateId: normalized.templateId,
                        unidadStock: this.toPrismaEnum(normalized.unidadStock),
                        unidadCompra: this.toPrismaEnum(normalized.unidadCompra),
                        esConsumible: normalized.esConsumible,
                        esRepuesto: normalized.esRepuesto,
                        activo: normalized.activo,
                        atributosTecnicosJson: this.toInputJson(normalized.atributosTecnicos),
                    },
                    select: { id: true },
                });
                if (normalized.variantes.length > 0) {
                    await Promise.all(normalized.variantes.map((variante) => tx.materiaPrimaVariante.create({
                        data: {
                            tenantId: auth.tenantId,
                            materiaPrimaId: materiaPrima.id,
                            sku: variante.sku,
                            nombreVariante: variante.nombreVariante,
                            activo: variante.activo,
                            atributosVarianteJson: this.toInputJson(variante.atributosVariante),
                            unidadStock: variante.unidadStock
                                ? this.toPrismaEnum(variante.unidadStock)
                                : null,
                            unidadCompra: variante.unidadCompra
                                ? this.toPrismaEnum(variante.unidadCompra)
                                : null,
                            precioReferencia: variante.precioReferencia,
                            moneda: variante.moneda,
                            proveedorReferenciaId: variante.proveedorReferenciaId,
                        },
                    })));
                }
                if (normalized.compatibilidades.length > 0) {
                    const variantesGuardadas = await tx.materiaPrimaVariante.findMany({
                        where: {
                            tenantId: auth.tenantId,
                            materiaPrimaId: materiaPrima.id,
                        },
                        select: {
                            id: true,
                            sku: true,
                        },
                    });
                    const skuToVarianteId = new Map(variantesGuardadas.map((variante) => [variante.sku, variante.id]));
                    await Promise.all(normalized.compatibilidades.map((compatibilidad) => {
                        const varianteId = compatibilidad.varianteSku
                            ? skuToVarianteId.get(compatibilidad.varianteSku) ?? null
                            : compatibilidad.varianteId ?? null;
                        return (tx.materiaPrimaCompatibilidadMaquina.create({
                            data: {
                                tenantId: auth.tenantId,
                                materiaPrimaId: materiaPrima.id,
                                varianteId,
                                plantillaMaquinaria: compatibilidad.plantillaMaquinaria
                                    ? this.toPrismaEnum(compatibilidad.plantillaMaquinaria)
                                    : null,
                                maquinaId: compatibilidad.maquinaId,
                                perfilOperativoId: compatibilidad.perfilOperativoId,
                                modoUso: this.toPrismaEnum(compatibilidad.modoUso),
                                consumoBase: compatibilidad.consumoBase,
                                unidadConsumo: compatibilidad.unidadConsumo
                                    ? this.toPrismaEnum(compatibilidad.unidadConsumo)
                                    : null,
                                mermaBasePct: compatibilidad.mermaBasePct,
                                activo: compatibilidad.activo,
                            },
                        }));
                    }));
                }
                return materiaPrima.id;
            });
            const item = await this.findMateriaPrimaOrThrow(auth, created, this.prisma);
            return this.toResponse(item);
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async updateMateriaPrima(auth, id, payload) {
        await this.findMateriaPrimaOrThrow(auth, id, this.prisma);
        const normalized = this.normalizePayload(payload);
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.materiaPrima.update({
                    where: { id },
                    data: {
                        codigo: normalized.codigo,
                        nombre: normalized.nombre,
                        descripcion: normalized.descripcion,
                        familia: this.toPrismaEnum(normalized.familia),
                        subfamilia: this.toPrismaEnum(normalized.subfamilia),
                        tipoTecnico: normalized.tipoTecnico,
                        templateId: normalized.templateId,
                        unidadStock: this.toPrismaEnum(normalized.unidadStock),
                        unidadCompra: this.toPrismaEnum(normalized.unidadCompra),
                        esConsumible: normalized.esConsumible,
                        esRepuesto: normalized.esRepuesto,
                        activo: normalized.activo,
                        atributosTecnicosJson: this.toInputJson(normalized.atributosTecnicos),
                    },
                });
                await tx.materiaPrimaCompatibilidadMaquina.deleteMany({
                    where: {
                        tenantId: auth.tenantId,
                        materiaPrimaId: id,
                    },
                });
                await tx.materiaPrimaVariante.deleteMany({
                    where: {
                        tenantId: auth.tenantId,
                        materiaPrimaId: id,
                    },
                });
                if (normalized.variantes.length > 0) {
                    await Promise.all(normalized.variantes.map((variante) => tx.materiaPrimaVariante.create({
                        data: {
                            tenantId: auth.tenantId,
                            materiaPrimaId: id,
                            sku: variante.sku,
                            nombreVariante: variante.nombreVariante,
                            activo: variante.activo,
                            atributosVarianteJson: this.toInputJson(variante.atributosVariante),
                            unidadStock: variante.unidadStock
                                ? this.toPrismaEnum(variante.unidadStock)
                                : null,
                            unidadCompra: variante.unidadCompra
                                ? this.toPrismaEnum(variante.unidadCompra)
                                : null,
                            precioReferencia: variante.precioReferencia,
                            moneda: variante.moneda,
                            proveedorReferenciaId: variante.proveedorReferenciaId,
                        },
                    })));
                }
                if (normalized.compatibilidades.length > 0) {
                    const skuToVarianteId = new Map();
                    const variantesGuardadas = await tx.materiaPrimaVariante.findMany({
                        where: {
                            tenantId: auth.tenantId,
                            materiaPrimaId: id,
                        },
                        select: {
                            id: true,
                            sku: true,
                        },
                    });
                    for (const variante of variantesGuardadas) {
                        skuToVarianteId.set(variante.sku, variante.id);
                    }
                    await Promise.all(normalized.compatibilidades.map((compatibilidad) => {
                        const varianteId = compatibilidad.varianteSku
                            ? skuToVarianteId.get(compatibilidad.varianteSku) ?? null
                            : compatibilidad.varianteId ?? null;
                        return tx.materiaPrimaCompatibilidadMaquina.create({
                            data: {
                                tenantId: auth.tenantId,
                                materiaPrimaId: id,
                                varianteId,
                                plantillaMaquinaria: compatibilidad.plantillaMaquinaria
                                    ? this.toPrismaEnum(compatibilidad.plantillaMaquinaria)
                                    : null,
                                maquinaId: compatibilidad.maquinaId,
                                perfilOperativoId: compatibilidad.perfilOperativoId,
                                modoUso: this.toPrismaEnum(compatibilidad.modoUso),
                                consumoBase: compatibilidad.consumoBase,
                                unidadConsumo: compatibilidad.unidadConsumo
                                    ? this.toPrismaEnum(compatibilidad.unidadConsumo)
                                    : null,
                                mermaBasePct: compatibilidad.mermaBasePct,
                                activo: compatibilidad.activo,
                            },
                        });
                    }));
                }
            });
            const item = await this.findMateriaPrimaOrThrow(auth, id, this.prisma);
            return this.toResponse(item);
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async toggleMateriaPrima(auth, id) {
        const item = await this.findMateriaPrimaOrThrow(auth, id, this.prisma);
        await this.prisma.materiaPrima.update({
            where: { id },
            data: {
                activo: !item.activo,
            },
        });
        const updated = await this.findMateriaPrimaOrThrow(auth, id, this.prisma);
        return this.toResponse(updated);
    }
    async updateVariantePrecioReferencia(auth, varianteId, payload) {
        await this.findVarianteOrThrow(auth, varianteId, this.prisma);
        try {
            const updated = await this.prisma.materiaPrimaVariante.update({
                where: { id: varianteId },
                data: {
                    precioReferencia: this.toDecimal(payload.precioReferencia),
                    ...(payload.moneda?.trim()
                        ? { moneda: payload.moneda.trim().toUpperCase() }
                        : {}),
                },
                select: {
                    id: true,
                    precioReferencia: true,
                    moneda: true,
                    updatedAt: true,
                },
            });
            return {
                varianteId: updated.id,
                precioReferencia: this.decimalToNumber(updated.precioReferencia),
                moneda: updated.moneda ?? '',
                updatedAt: updated.updatedAt.toISOString(),
            };
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async findAllAlmacenes(auth) {
        const items = await this.prisma.almacenMateriaPrima.findMany({
            where: {
                tenantId: auth.tenantId,
            },
            include: {
                ubicaciones: {
                    orderBy: [{ nombre: 'asc' }],
                },
            },
            orderBy: [{ nombre: 'asc' }],
        });
        return items.map((item) => ({
            id: item.id,
            codigo: item.codigo,
            nombre: item.nombre,
            descripcion: item.descripcion ?? '',
            activo: item.activo,
            ubicaciones: item.ubicaciones.map((ubicacion) => ({
                id: ubicacion.id,
                codigo: ubicacion.codigo,
                nombre: ubicacion.nombre,
                descripcion: ubicacion.descripcion ?? '',
                activo: ubicacion.activo,
            })),
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        }));
    }
    async createAlmacen(auth, payload) {
        const normalized = this.normalizeAlmacenPayload(payload);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const almacen = await tx.almacenMateriaPrima.create({
                    data: {
                        tenantId: auth.tenantId,
                        codigo: normalized.codigo,
                        nombre: normalized.nombre,
                        descripcion: normalized.descripcion,
                        activo: normalized.activo,
                    },
                });
                await tx.almacenMateriaPrimaUbicacion.create({
                    data: {
                        tenantId: auth.tenantId,
                        almacenId: almacen.id,
                        codigo: 'PRINCIPAL',
                        nombre: 'Principal',
                        descripcion: 'Ubicacion interna por defecto',
                        activo: true,
                    },
                });
                return almacen;
            });
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async updateAlmacen(auth, id, payload) {
        await this.findAlmacenOrThrow(auth, id, this.prisma);
        const normalized = this.normalizeAlmacenPayload(payload);
        try {
            return await this.prisma.almacenMateriaPrima.update({
                where: { id },
                data: {
                    codigo: normalized.codigo,
                    nombre: normalized.nombre,
                    descripcion: normalized.descripcion,
                    activo: normalized.activo,
                },
            });
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async toggleAlmacen(auth, id) {
        const current = await this.findAlmacenOrThrow(auth, id, this.prisma);
        return this.prisma.almacenMateriaPrima.update({
            where: { id },
            data: {
                activo: !current.activo,
            },
        });
    }
    async findUbicacionesByAlmacen(auth, almacenId) {
        await this.findAlmacenOrThrow(auth, almacenId, this.prisma);
        const items = await this.prisma.almacenMateriaPrimaUbicacion.findMany({
            where: {
                tenantId: auth.tenantId,
                almacenId,
            },
            orderBy: [{ nombre: 'asc' }],
        });
        return items.map((item) => ({
            id: item.id,
            almacenId: item.almacenId,
            codigo: item.codigo,
            nombre: item.nombre,
            descripcion: item.descripcion ?? '',
            activo: item.activo,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        }));
    }
    async createUbicacion(auth, almacenId, payload) {
        await this.findAlmacenOrThrow(auth, almacenId, this.prisma);
        const normalized = this.normalizeUbicacionPayload(payload);
        try {
            return await this.prisma.almacenMateriaPrimaUbicacion.create({
                data: {
                    tenantId: auth.tenantId,
                    almacenId,
                    codigo: normalized.codigo,
                    nombre: normalized.nombre,
                    descripcion: normalized.descripcion,
                    activo: normalized.activo,
                },
            });
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async updateUbicacion(auth, id, payload) {
        await this.findUbicacionOrThrow(auth, id, this.prisma);
        const normalized = this.normalizeUbicacionPayload(payload);
        try {
            return await this.prisma.almacenMateriaPrimaUbicacion.update({
                where: { id },
                data: {
                    codigo: normalized.codigo,
                    nombre: normalized.nombre,
                    descripcion: normalized.descripcion,
                    activo: normalized.activo,
                },
            });
        }
        catch (error) {
            this.handleWriteError(error);
        }
    }
    async toggleUbicacion(auth, id) {
        const current = await this.findUbicacionOrThrow(auth, id, this.prisma);
        return this.prisma.almacenMateriaPrimaUbicacion.update({
            where: { id },
            data: {
                activo: !current.activo,
            },
        });
    }
    async registrarMovimiento(auth, payload) {
        if (!this.isSupportedSimpleMovement(payload.tipo)) {
            throw new common_1.BadRequestException('Tipo de movimiento no soportado por este endpoint.');
        }
        return this.prisma.$transaction(async (tx) => {
            const cantidad = this.toDecimal(payload.cantidad);
            const variante = await this.findVarianteOrThrow(auth, payload.varianteId, tx);
            const ubicacion = await this.findUbicacionOrThrow(auth, payload.ubicacionId, tx);
            const stockActual = await this.findStockRow(auth, payload.varianteId, payload.ubicacionId, tx);
            let saldoPosterior = stockActual
                ? this.decimalToNumber(stockActual.cantidadDisponible)
                : 0;
            let costoPromedioPosterior = stockActual
                ? this.decimalToNumber(stockActual.costoPromedio)
                : 0;
            const tipo = this.toPrismaEnum(payload.tipo);
            const origen = this.toPrismaEnum(payload.origen);
            const unitCost = payload.costoUnitario ?? null;
            const stockPrevio = stockActual ? this.decimalToNumber(stockActual.cantidadDisponible) : 0;
            const costoPromedioPrevio = stockActual ? this.decimalToNumber(stockActual.costoPromedio) : 0;
            if (tipo === client_1.TipoMovimientoStockMateriaPrima.INGRESO ||
                tipo === client_1.TipoMovimientoStockMateriaPrima.AJUSTE_ENTRADA) {
                const nextQty = stockPrevio + this.decimalToNumber(cantidad);
                const costIn = unitCost ?? costoPromedioPrevio ?? 0;
                const newAvg = nextQty > 0
                    ? ((stockPrevio * costoPromedioPrevio) + (this.decimalToNumber(cantidad) * costIn)) / nextQty
                    : 0;
                saldoPosterior = Number(nextQty.toFixed(4));
                costoPromedioPosterior = Number(newAvg.toFixed(6));
            }
            else {
                const nextQty = stockPrevio - this.decimalToNumber(cantidad);
                if (nextQty < 0) {
                    throw new common_1.BadRequestException(`Stock insuficiente para ${variante.sku} en ${ubicacion.nombre}.`);
                }
                saldoPosterior = Number(nextQty.toFixed(4));
                costoPromedioPosterior = Number(costoPromedioPrevio.toFixed(6));
            }
            const upsertedStock = await tx.stockMateriaPrimaVariante.upsert({
                where: {
                    tenantId_varianteId_ubicacionId: {
                        tenantId: auth.tenantId,
                        varianteId: payload.varianteId,
                        ubicacionId: payload.ubicacionId,
                    },
                },
                update: {
                    cantidadDisponible: new client_1.Prisma.Decimal(saldoPosterior),
                    costoPromedio: new client_1.Prisma.Decimal(costoPromedioPosterior),
                },
                create: {
                    tenantId: auth.tenantId,
                    varianteId: payload.varianteId,
                    ubicacionId: payload.ubicacionId,
                    cantidadDisponible: new client_1.Prisma.Decimal(saldoPosterior),
                    costoPromedio: new client_1.Prisma.Decimal(costoPromedioPosterior),
                },
            });
            const movimiento = await tx.movimientoStockMateriaPrima.create({
                data: {
                    tenantId: auth.tenantId,
                    varianteId: payload.varianteId,
                    ubicacionId: payload.ubicacionId,
                    tipo,
                    origen,
                    cantidad,
                    costoUnitario: unitCost === null ? null : new client_1.Prisma.Decimal(unitCost),
                    saldoPosterior: upsertedStock.cantidadDisponible,
                    costoPromedioPost: upsertedStock.costoPromedio,
                    referenciaTipo: payload.referenciaTipo?.trim() || null,
                    referenciaId: payload.referenciaId?.trim() || null,
                    notas: payload.notas?.trim() || null,
                },
            });
            return this.toMovimientoResponse(movimiento);
        });
    }
    async registrarTransferencia(auth, payload) {
        if (payload.ubicacionOrigenId === payload.ubicacionDestinoId) {
            throw new common_1.BadRequestException('Origen y destino deben ser distintos.');
        }
        return this.prisma.$transaction(async (tx) => {
            const cantidad = this.toDecimal(payload.cantidad);
            const transferenciaId = (0, crypto_1.randomUUID)();
            const variante = await this.findVarianteOrThrow(auth, payload.varianteId, tx);
            await this.findUbicacionOrThrow(auth, payload.ubicacionOrigenId, tx);
            await this.findUbicacionOrThrow(auth, payload.ubicacionDestinoId, tx);
            const stockOrigen = await this.findStockRow(auth, payload.varianteId, payload.ubicacionOrigenId, tx);
            const qtyOrigen = stockOrigen
                ? this.decimalToNumber(stockOrigen.cantidadDisponible)
                : 0;
            const qtyTransfer = this.decimalToNumber(cantidad);
            if (qtyOrigen < qtyTransfer) {
                throw new common_1.BadRequestException(`Stock insuficiente para transferir ${variante.sku}.`);
            }
            const costPromOrigen = stockOrigen
                ? this.decimalToNumber(stockOrigen.costoPromedio)
                : 0;
            const saldoOrigenPost = Number((qtyOrigen - qtyTransfer).toFixed(4));
            const stockOrigenPost = await tx.stockMateriaPrimaVariante.upsert({
                where: {
                    tenantId_varianteId_ubicacionId: {
                        tenantId: auth.tenantId,
                        varianteId: payload.varianteId,
                        ubicacionId: payload.ubicacionOrigenId,
                    },
                },
                update: {
                    cantidadDisponible: new client_1.Prisma.Decimal(saldoOrigenPost),
                    costoPromedio: new client_1.Prisma.Decimal(costPromOrigen),
                },
                create: {
                    tenantId: auth.tenantId,
                    varianteId: payload.varianteId,
                    ubicacionId: payload.ubicacionOrigenId,
                    cantidadDisponible: new client_1.Prisma.Decimal(saldoOrigenPost),
                    costoPromedio: new client_1.Prisma.Decimal(costPromOrigen),
                },
            });
            const movimientoSalida = await tx.movimientoStockMateriaPrima.create({
                data: {
                    tenantId: auth.tenantId,
                    varianteId: payload.varianteId,
                    ubicacionId: payload.ubicacionOrigenId,
                    tipo: client_1.TipoMovimientoStockMateriaPrima.TRANSFERENCIA_SALIDA,
                    origen: client_1.OrigenMovimientoStockMateriaPrima.TRANSFERENCIA,
                    cantidad,
                    costoUnitario: new client_1.Prisma.Decimal(costPromOrigen),
                    saldoPosterior: stockOrigenPost.cantidadDisponible,
                    costoPromedioPost: stockOrigenPost.costoPromedio,
                    referenciaTipo: payload.referenciaTipo?.trim() || 'transferencia',
                    referenciaId: payload.referenciaId?.trim() || null,
                    transferenciaId,
                    notas: payload.notas?.trim() || null,
                },
            });
            const stockDestino = await this.findStockRow(auth, payload.varianteId, payload.ubicacionDestinoId, tx);
            const qtyDestino = stockDestino
                ? this.decimalToNumber(stockDestino.cantidadDisponible)
                : 0;
            const costPromDestino = stockDestino
                ? this.decimalToNumber(stockDestino.costoPromedio)
                : 0;
            const saldoDestinoPost = Number((qtyDestino + qtyTransfer).toFixed(4));
            const costPromDestinoPost = saldoDestinoPost > 0
                ? Number(((qtyDestino * costPromDestino + qtyTransfer * costPromOrigen) /
                    saldoDestinoPost).toFixed(6))
                : 0;
            const stockDestinoPost = await tx.stockMateriaPrimaVariante.upsert({
                where: {
                    tenantId_varianteId_ubicacionId: {
                        tenantId: auth.tenantId,
                        varianteId: payload.varianteId,
                        ubicacionId: payload.ubicacionDestinoId,
                    },
                },
                update: {
                    cantidadDisponible: new client_1.Prisma.Decimal(saldoDestinoPost),
                    costoPromedio: new client_1.Prisma.Decimal(costPromDestinoPost),
                },
                create: {
                    tenantId: auth.tenantId,
                    varianteId: payload.varianteId,
                    ubicacionId: payload.ubicacionDestinoId,
                    cantidadDisponible: new client_1.Prisma.Decimal(saldoDestinoPost),
                    costoPromedio: new client_1.Prisma.Decimal(costPromDestinoPost),
                },
            });
            const movimientoEntrada = await tx.movimientoStockMateriaPrima.create({
                data: {
                    tenantId: auth.tenantId,
                    varianteId: payload.varianteId,
                    ubicacionId: payload.ubicacionDestinoId,
                    tipo: client_1.TipoMovimientoStockMateriaPrima.TRANSFERENCIA_ENTRADA,
                    origen: client_1.OrigenMovimientoStockMateriaPrima.TRANSFERENCIA,
                    cantidad,
                    costoUnitario: new client_1.Prisma.Decimal(costPromOrigen),
                    saldoPosterior: stockDestinoPost.cantidadDisponible,
                    costoPromedioPost: stockDestinoPost.costoPromedio,
                    referenciaTipo: payload.referenciaTipo?.trim() || 'transferencia',
                    referenciaId: payload.referenciaId?.trim() || null,
                    transferenciaId,
                    notas: payload.notas?.trim() || null,
                },
            });
            return {
                transferenciaId,
                salida: this.toMovimientoResponse(movimientoSalida),
                entrada: this.toMovimientoResponse(movimientoEntrada),
            };
        });
    }
    async getStockActual(auth, query) {
        const soloConStock = query.soloConStock === 'true';
        const rows = await this.prisma.stockMateriaPrimaVariante.findMany({
            where: {
                tenantId: auth.tenantId,
                varianteId: query.varianteId,
                ubicacionId: query.ubicacionId,
                ...(soloConStock
                    ? { cantidadDisponible: { gt: new client_1.Prisma.Decimal(0) } }
                    : {}),
                variante: query.materiaPrimaId
                    ? { materiaPrimaId: query.materiaPrimaId }
                    : undefined,
                ubicacion: query.almacenId ? { almacenId: query.almacenId } : undefined,
            },
            include: {
                variante: {
                    include: {
                        materiaPrima: true,
                    },
                },
                ubicacion: {
                    include: {
                        almacen: true,
                    },
                },
            },
            orderBy: [{ updatedAt: 'desc' }],
        });
        return rows.map((row) => {
            const cantidad = this.decimalToNumber(row.cantidadDisponible);
            const costo = this.decimalToNumber(row.costoPromedio);
            return {
                id: row.id,
                varianteId: row.varianteId,
                varianteSku: row.variante.sku,
                materiaPrimaId: row.variante.materiaPrimaId,
                materiaPrimaNombre: row.variante.materiaPrima.nombre,
                ubicacionId: row.ubicacionId,
                ubicacionNombre: row.ubicacion.nombre,
                almacenId: row.ubicacion.almacenId,
                almacenNombre: row.ubicacion.almacen.nombre,
                cantidadDisponible: cantidad,
                costoPromedio: costo,
                valorStock: Number((cantidad * costo).toFixed(4)),
                updatedAt: row.updatedAt.toISOString(),
            };
        });
    }
    async getKardex(auth, query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 50;
        const skip = (page - 1) * pageSize;
        const where = {
            tenantId: auth.tenantId,
            varianteId: query.varianteId,
            ubicacionId: query.ubicacionId,
            createdAt: {
                gte: query.fechaDesde ? new Date(query.fechaDesde) : undefined,
                lte: query.fechaHasta ? new Date(query.fechaHasta) : undefined,
            },
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.movimientoStockMateriaPrima.findMany({
                where,
                include: {
                    ubicacion: true,
                },
                orderBy: [{ createdAt: 'desc' }],
                skip,
                take: pageSize,
            }),
            this.prisma.movimientoStockMateriaPrima.count({ where }),
        ]);
        return {
            items: items.map((item) => ({
                ...this.toMovimientoResponse(item),
                ubicacionNombre: item.ubicacion.nombre,
            })),
            total,
            page,
            pageSize,
        };
    }
    isSupportedSimpleMovement(tipo) {
        return (tipo === registrar_movimiento_stock_dto_1.TipoMovimientoStockMateriaPrimaDto.ingreso ||
            tipo === registrar_movimiento_stock_dto_1.TipoMovimientoStockMateriaPrimaDto.egreso ||
            tipo === registrar_movimiento_stock_dto_1.TipoMovimientoStockMateriaPrimaDto.ajuste_entrada ||
            tipo === registrar_movimiento_stock_dto_1.TipoMovimientoStockMateriaPrimaDto.ajuste_salida);
    }
    normalizeAlmacenPayload(payload) {
        return {
            codigo: payload.codigo.trim(),
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
            activo: payload.activo,
        };
    }
    normalizeUbicacionPayload(payload) {
        return {
            codigo: payload.codigo.trim(),
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
            activo: payload.activo,
        };
    }
    async findAlmacenOrThrow(auth, id, db) {
        const item = await db.almacenMateriaPrima.findFirst({
            where: {
                id,
                tenantId: auth.tenantId,
            },
        });
        if (!item) {
            throw new common_1.NotFoundException(`No existe el almacen ${id}`);
        }
        return item;
    }
    async findUbicacionOrThrow(auth, id, db) {
        const item = await db.almacenMateriaPrimaUbicacion.findFirst({
            where: {
                id,
                tenantId: auth.tenantId,
            },
        });
        if (!item) {
            throw new common_1.NotFoundException(`No existe la ubicacion ${id}`);
        }
        return item;
    }
    async findVarianteOrThrow(auth, varianteId, db) {
        const item = await db.materiaPrimaVariante.findFirst({
            where: {
                id: varianteId,
                tenantId: auth.tenantId,
            },
            select: {
                id: true,
                sku: true,
            },
        });
        if (!item) {
            throw new common_1.NotFoundException(`No existe la variante ${varianteId}`);
        }
        return item;
    }
    async findStockRow(auth, varianteId, ubicacionId, db) {
        return db.stockMateriaPrimaVariante.findFirst({
            where: {
                tenantId: auth.tenantId,
                varianteId,
                ubicacionId,
            },
        });
    }
    toDecimal(value) {
        return new client_1.Prisma.Decimal(value);
    }
    toMovimientoResponse(item) {
        return {
            movimientoId: item.id,
            varianteId: item.varianteId,
            ubicacionId: item.ubicacionId,
            tipo: this.toApiEnum(item.tipo),
            origen: this.toApiEnum(item.origen),
            cantidad: this.decimalToNumber(item.cantidad),
            costoUnitario: item.costoUnitario
                ? this.decimalToNumber(item.costoUnitario)
                : null,
            saldoPosterior: this.decimalToNumber(item.saldoPosterior),
            costoPromedioPost: this.decimalToNumber(item.costoPromedioPost),
            referenciaTipo: item.referenciaTipo,
            referenciaId: item.referenciaId,
            transferenciaId: item.transferenciaId,
            notas: item.notas,
            createdAt: item.createdAt.toISOString(),
        };
    }
    async findMateriaPrimaOrThrow(auth, id, db) {
        const item = await db.materiaPrima.findFirst({
            where: {
                id,
                tenantId: auth.tenantId,
            },
            include: {
                variantes: {
                    include: {
                        proveedorReferencia: true,
                    },
                    orderBy: [{ createdAt: 'asc' }],
                },
                compatibilidades: {
                    include: {
                        maquina: true,
                        perfilOperativo: true,
                    },
                    orderBy: [{ createdAt: 'asc' }],
                },
            },
        });
        if (!item) {
            throw new common_1.NotFoundException(`No existe la materia prima ${id}`);
        }
        return item;
    }
    normalizePayload(payload) {
        if (!(0, unidades_canonicas_1.unitsAreCompatible)(payload.unidadStock, payload.unidadCompra)) {
            throw new common_1.BadRequestException('Unidad de uso y unidad de compra deben ser compatibles para conversion.');
        }
        const variantes = payload.variantes.map((variante) => ({
            ...variante,
            sku: variante.sku.trim(),
            nombreVariante: variante.nombreVariante?.trim() || null,
            moneda: variante.moneda?.trim().toUpperCase() || null,
        }));
        const compatibilidades = payload.compatibilidades.map((compatibilidad) => ({
            ...compatibilidad,
            varianteSku: compatibilidad.varianteSku?.trim() || null,
        }));
        return {
            codigo: payload.codigo.trim(),
            nombre: payload.nombre.trim(),
            descripcion: payload.descripcion?.trim() || null,
            familia: payload.familia,
            subfamilia: payload.subfamilia,
            tipoTecnico: payload.tipoTecnico.trim(),
            templateId: payload.templateId.trim(),
            unidadStock: payload.unidadStock,
            unidadCompra: payload.unidadCompra,
            esConsumible: payload.esConsumible,
            esRepuesto: payload.esRepuesto,
            activo: payload.activo,
            atributosTecnicos: payload.atributosTecnicos,
            variantes,
            compatibilidades,
        };
    }
    toResponse(item) {
        return {
            id: item.id,
            codigo: item.codigo,
            nombre: item.nombre,
            descripcion: item.descripcion ?? '',
            familia: this.toApiEnum(item.familia),
            subfamilia: this.toApiEnum(item.subfamilia),
            tipoTecnico: item.tipoTecnico,
            templateId: item.templateId,
            unidadStock: this.toApiEnum(item.unidadStock),
            unidadCompra: this.toApiEnum(item.unidadCompra),
            esConsumible: item.esConsumible,
            esRepuesto: item.esRepuesto,
            activo: item.activo,
            atributosTecnicos: item.atributosTecnicosJson,
            variantes: item.variantes.map((variante) => ({
                id: variante.id,
                sku: variante.sku,
                nombreVariante: variante.nombreVariante ?? '',
                activo: variante.activo,
                atributosVariante: variante.atributosVarianteJson,
                unidadStock: variante.unidadStock
                    ? this.toApiEnum(variante.unidadStock)
                    : null,
                unidadCompra: variante.unidadCompra
                    ? this.toApiEnum(variante.unidadCompra)
                    : null,
                precioReferencia: variante.precioReferencia
                    ? this.decimalToNumber(variante.precioReferencia)
                    : null,
                moneda: variante.moneda ?? '',
                proveedorReferenciaId: variante.proveedorReferenciaId,
                proveedorReferenciaNombre: variante.proveedorReferencia?.nombre ?? '',
            })),
            compatibilidades: item.compatibilidades.map((compatibilidad) => ({
                id: compatibilidad.id,
                varianteId: compatibilidad.varianteId,
                plantillaMaquinaria: compatibilidad.plantillaMaquinaria
                    ? this.toApiEnum(compatibilidad.plantillaMaquinaria)
                    : null,
                maquinaId: compatibilidad.maquinaId,
                maquinaNombre: compatibilidad.maquina?.nombre ?? '',
                perfilOperativoId: compatibilidad.perfilOperativoId,
                perfilOperativoNombre: compatibilidad.perfilOperativo?.nombre ?? '',
                modoUso: this.toApiEnum(compatibilidad.modoUso),
                consumoBase: compatibilidad.consumoBase
                    ? this.decimalToNumber(compatibilidad.consumoBase)
                    : null,
                unidadConsumo: compatibilidad.unidadConsumo
                    ? this.toApiEnum(compatibilidad.unidadConsumo)
                    : null,
                mermaBasePct: compatibilidad.mermaBasePct
                    ? this.decimalToNumber(compatibilidad.mermaBasePct)
                    : null,
                activo: compatibilidad.activo,
            })),
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        };
    }
    toPrismaEnum(value) {
        return value.toUpperCase();
    }
    toApiEnum(value) {
        return value.toLowerCase();
    }
    decimalToNumber(value) {
        return Number(value);
    }
    toInputJson(value) {
        return value;
    }
    handleWriteError(error) {
        if (error instanceof library_1.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                throw new common_1.ConflictException('Ya existe un registro con uno de los identificadores unicos cargados.');
            }
        }
        throw error;
    }
};
exports.InventarioService = InventarioService;
exports.InventarioService = InventarioService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InventarioService);
//# sourceMappingURL=inventario.service.js.map