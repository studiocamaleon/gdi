"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuperMotorModule = void 0;
const common_1 = require("@nestjs/common");
const proceso_productividad_engine_1 = require("../../procesos/proceso-productividad.engine");
const client_1 = require("@prisma/client");
const familias_1 = require("../pasos/familias");
const nesting_runner_1 = require("../engine/nesting-runner");
const material_plantillas_1 = require("../pasos/material-plantillas");
const maquina_consumibles_1 = require("../pasos/maquina-consumibles");
const evaluador_1 = require("../reglas-seleccion/evaluador");
function roundMoney(n) {
    return Math.round(n * 100) / 100;
}
class SuperMotorModule {
    service;
    constructor(service) {
        this.service = service;
    }
    getDefinition() {
        return {
            code: 'universal',
            version: 1,
            label: 'Super motor (modelo universal)',
            category: 'digital_sheet',
            capabilities: {
                hasProductConfig: false,
                hasVariantOverride: false,
                hasPreview: false,
                hasQuote: true,
            },
            schema: {},
            exposedInCatalog: false,
        };
    }
    async getProductConfig(_auth, _productoId) {
        throw new common_1.BadRequestException('super motor: sin config propia.');
    }
    async upsertProductConfig(_auth, _productoId, _payload) {
        throw new common_1.BadRequestException('super motor: sin config propia.');
    }
    async getVariantOverride(_auth, _varianteId) {
        throw new common_1.BadRequestException('super motor: sin overrides.');
    }
    async upsertVariantOverride(_auth, _varianteId, _payload) {
        throw new common_1.BadRequestException('super motor: sin overrides.');
    }
    async previewVariant(_auth, _varianteId, _payload) {
        throw new common_1.BadRequestException('super motor: preview no implementado.');
    }
    async quoteVariant(auth, varianteId, payload) {
        return this.quoteInternal(auth, varianteId, payload, new Set());
    }
    async quoteInternal(auth, varianteId, payload, visited) {
        const periodo = String(payload.periodo ?? '2026-04');
        const cantidad = Math.max(1, Math.floor(Number(payload.cantidad ?? 1)));
        const runtime = await this.service.loadSuperMotorRuntime(auth, varianteId, periodo);
        const { variante, proceso, tarifaByCentro } = runtime;
        if (visited.has(variante.productoServicioId)) {
            throw new common_1.BadRequestException(`Ciclo detectado en sub-productos: el producto ${variante.productoServicioId} se consume recursivamente a sí mismo.`);
        }
        const visitedChild = new Set(visited);
        visitedChild.add(variante.productoServicioId);
        if (!proceso) {
            throw new common_1.BadRequestException('El producto no tiene ruta de producción asignada — el super motor necesita una ruta.');
        }
        const opcionalesSeleccionados = new Set(payload.opcionalesSeleccionados ?? []);
        const warnings = [];
        const parametros = (payload.parametros ?? {});
        const selecciones = {};
        for (const s of payload.seleccionesBase ?? []) {
            selecciones[String(s.dimension)] = String(s.valor);
        }
        const jobContext = {
            cantidad,
            varianteId,
            parametros,
            selecciones,
            variante: {
                anchoMm: Number(variante.anchoMm ?? 0),
                altoMm: Number(variante.altoMm ?? 0),
            },
            opcionalesSeleccionados: Array.from(opcionalesSeleccionados),
        };
        const operacionesAEjecutar = proceso.operaciones.filter((op) => {
            if (!op.activo)
                return false;
            const activacion = op.activacionV2 ?? null;
            if (activacion === 'OPCIONAL') {
                return opcionalesSeleccionados.has(op.id);
            }
            if (activacion === 'CONDICIONAL') {
                const condicion = op.condicionV2;
                if (condicion != null) {
                    try {
                        return (0, evaluador_1.evaluarBool)(condicion, jobContext);
                    }
                    catch (err) {
                        warnings.push(`Paso "${op.nombre}": condición CONDICIONAL inválida (${err instanceof Error ? err.message : String(err)}). Se omite el paso.`);
                        return false;
                    }
                }
                return opcionalesSeleccionados.has(op.id);
            }
            if (activacion === 'OBLIGATORIO') {
                return true;
            }
            if (op.esOpcional && !opcionalesSeleccionados.has(op.id))
                return false;
            return true;
        });
        if (operacionesAEjecutar.length === 0) {
            throw new common_1.BadRequestException('La ruta no tiene operaciones activas/seleccionadas para cotizar.');
        }
        const pasos = [];
        const subProductos = [];
        const opcionesSeleccionadasMap = new Map((payload
            .opcionesSeleccionadas ?? []).map((o) => [o.pasoId, o.alternativaId]));
        const tieneCortePosterior = operacionesAEjecutar.some((op) => {
            const fam = op.familiaV2 ?? inferirFamiliaDesdeTipo(op.tipoOperacion, op.nombre);
            return fam === 'corte' || fam === 'corte_volumetrico';
        });
        const demasiaMm = tieneCortePosterior
            ? Number(runtime.configProducto?.demasiaCorteMm ?? 0)
            : 0;
        const lineaCorteMm = tieneCortePosterior
            ? Number(runtime.configProducto?.lineaCorteMm ?? 0)
            : 0;
        const expansionPorLado = demasiaMm + lineaCorteMm;
        const trabajoMedidas = this.resolverMedidasTrabajo(payload, variante, cantidad).map((m) => ({
            ...m,
            anchoMm: m.anchoMm + 2 * expansionPorLado,
            altoMm: m.altoMm + 2 * expansionPorLado,
        }));
        const materialMaquina = this.resolverMaterialMaquinaContext(runtime, operacionesAEjecutar);
        const pasosRuntime = operacionesAEjecutar
            .map((op) => ({
            id: op.id,
            familiaCodigo: op.familiaV2 ?? inferirFamiliaDesdeTipo(op.tipoOperacion, op.nombre),
            configNesting: op.configNestingV2 ?? null,
            materialesConsumidos: extractMaterialesParaRunner(op),
        }))
            .filter((p) => familias_1.FAMILIAS_PASO[p.familiaCodigo] != null);
        const nestingOutput = pasosRuntime.length > 0
            ? (0, nesting_runner_1.runNestingPipeline)({
                pasos: pasosRuntime,
                familiasMap: familias_1.FAMILIAS_PASO,
                trabajo: { medidas: trabajoMedidas, cantidadTotal: cantidad },
                materialMaquina,
            })
            : null;
        for (const opOriginal of operacionesAEjecutar) {
            const alternativaIdSel = opcionesSeleccionadasMap.get(opOriginal.id);
            const alternativas = (opOriginal.alternativas ?? []);
            const alternativaElegida = alternativaIdSel
                ? alternativas.find((a) => a.id === alternativaIdSel) ?? null
                : alternativas.find((a) => a.esDefault) ?? null;
            const opAfterAlternativa = alternativaElegida
                ? {
                    ...opOriginal,
                    maquinaId: alternativaElegida.maquinaId,
                    perfilOperativoId: alternativaElegida.perfilOperativoId ?? null,
                    maquina: alternativaElegida.maquina,
                    perfilOperativo: alternativaElegida.perfilOperativo,
                    setupMin: alternativaElegida.setupMin != null
                        ? alternativaElegida.setupMin
                        : opOriginal.setupMin,
                    cleanupMin: alternativaElegida.cleanupMin != null
                        ? alternativaElegida.cleanupMin
                        : opOriginal.cleanupMin,
                    tiempoFijoMin: alternativaElegida.tiempoFijoMin != null
                        ? alternativaElegida.tiempoFijoMin
                        : opOriginal.tiempoFijoMin,
                    productividadBase: alternativaElegida.productividadBase != null
                        ? alternativaElegida.productividadBase
                        : opOriginal.productividadBase,
                    configNestingV2: alternativaElegida.configNestingV2 != null
                        ? alternativaElegida.configNestingV2
                        : opOriginal.configNestingV2,
                }
                : opOriginal;
            const plantillaOrigen = (opOriginal.plantillaOrigen) ?? null;
            const op = plantillaOrigen
                ? {
                    ...opAfterAlternativa,
                    productividadBase: opAfterAlternativa.productividadBase ??
                        (plantillaOrigen.productividadBase ?? null),
                    setupMin: opAfterAlternativa.setupMin ??
                        (plantillaOrigen.setupMin ?? null),
                    cleanupMin: opAfterAlternativa.cleanupMin ??
                        (plantillaOrigen.cleanupMin ?? null),
                    tiempoFijoMin: opAfterAlternativa.tiempoFijoMin ??
                        (plantillaOrigen.tiempoFijoMin ?? null),
                    unidadTiempo: opAfterAlternativa.unidadTiempo === 'NINGUNA' && plantillaOrigen.unidadTiempo
                        ? plantillaOrigen.unidadTiempo
                        : opAfterAlternativa.unidadTiempo,
                    centroCostoId: opAfterAlternativa.centroCostoId ??
                        plantillaOrigen.centroCostoId ??
                        opAfterAlternativa.centroCostoId,
                    centroCosto: opAfterAlternativa.centroCosto ??
                        (plantillaOrigen.centroCosto ?? null),
                    maquinaId: opAfterAlternativa.maquinaId ??
                        plantillaOrigen.maquinaId ??
                        null,
                    maquina: opAfterAlternativa.maquina ??
                        (plantillaOrigen.maquina ?? null),
                    perfilOperativoId: opAfterAlternativa.perfilOperativoId ??
                        plantillaOrigen.perfilOperativoId ??
                        null,
                    perfilOperativo: opAfterAlternativa.perfilOperativo ??
                        (plantillaOrigen.perfilOperativo ?? null),
                    familiaV2: opAfterAlternativa.familiaV2 ??
                        plantillaOrigen.familiaV2 ??
                        null,
                    unidadProductivaV2: (opAfterAlternativa
                        .unidadProductivaV2 ?? null) ??
                        plantillaOrigen.unidadProductivaV2 ??
                        null,
                }
                : opAfterAlternativa;
            const tarifaHora = op.centroCostoId && tarifaByCentro.get(op.centroCostoId) != null
                ? tarifaByCentro.get(op.centroCostoId)
                : 0;
            if (tarifaHora === 0 && op.centroCostoId) {
                warnings.push(`Paso "${op.nombre}": el centro de costo ${op.centroCosto?.nombre ?? op.centroCostoId} no tiene tarifa publicada para el período ${periodo}.`);
            }
            const familiaCodigo = op.familiaV2 ?? inferirFamiliaDesdeTipo(op.tipoOperacion, op.nombre);
            const familia = familias_1.FAMILIAS_PASO[familiaCodigo] ?? null;
            const nestingPropio = nestingOutput?.layoutsPorPasoId.get(op.id) ?? null;
            const nestingHeredado = nestingOutput && familia?.modoNesting === 'consume'
                ? (0, nesting_runner_1.getLayoutHeredado)(nestingOutput, op.id)
                : null;
            const layoutAplicable = nestingPropio ?? nestingHeredado;
            const unidadProductivaPaso = (op.unidadProductivaV2 ?? null) || null;
            const cantidadObjetivoSalida = resolverCantidadObjetivoSalida({
                unidadProductiva: unidadProductivaPaso,
                layout: layoutAplicable,
                cantidadPedida: cantidad,
                familiaModoNesting: familia?.modoNesting ?? 'none',
            });
            const productividad = (0, proceso_productividad_engine_1.evaluateProductividad)({
                modoProductividad: op.modoProductividad ?? client_1.ModoProductividadProceso.FIJA,
                productividadBase: op.productividadBase,
                reglaVelocidadJson: op.reglaVelocidadJson,
                reglaMermaJson: op.reglaMermaJson,
                runMin: op.runMin,
                tiempoFijoMin: op.tiempoFijoMin,
                unidadTiempo: op.unidadTiempo,
                mermaRunPct: op.mermaRunPct,
                mermaSetup: op.mermaSetup,
                cantidadObjetivoSalida,
                contexto: { cantidad, varianteId },
                perfilProductivityValue: op.perfilOperativo
                    ?.productivityValue,
            });
            if (productividad.warnings.length > 0) {
                warnings.push(...productividad.warnings.map((w) => `Paso "${op.nombre}": ${w}`));
            }
            const setupMin = Number(op.setupMin ?? 0);
            const cleanupMin = Number(op.cleanupMin ?? 0);
            const tiempoFijoMin = Number(op.tiempoFijoMin ?? 0);
            const totalMin = setupMin + cleanupMin + tiempoFijoMin + productividad.runMin;
            const costoCentroCosto = roundMoney((totalMin / 60) * tarifaHora);
            const selecciones = new Map((payload.seleccionesBase ?? []).map((s) => [String(s.dimension), String(s.valor)]));
            const materialesDeclarados = Array.isArray(op.materialesConsumidos)
                ? (op
                    .materialesConsumidos)
                : [];
            const matsStock = [];
            const matsSubProducto = [];
            for (const m of materialesDeclarados) {
                if (m.productoComponenteId != null)
                    matsSubProducto.push(m);
                else
                    matsStock.push(m);
            }
            const materialesStock = matsStock.length > 0
                ? calcularMaterialesDeclarados(matsStock, {
                    cantidadPedida: cantidad,
                    layout: layoutAplicable,
                    selecciones,
                })
                : [];
            const materialesSubProductos = await this.resolverMaterialesSubProducto(auth, matsSubProducto, {
                cantidadPedida: cantidad,
                layout: layoutAplicable,
                selecciones,
                periodo,
                visited: visitedChild,
                subProductos,
            });
            const materialesDelPasoBase = materialesDeclarados.length > 0
                ? [...materialesStock, ...materialesSubProductos]
                : (0, material_plantillas_1.calcularMaterialesDelPaso)(familiaCodigo, {
                    cantidadPedida: cantidad,
                    layout: layoutAplicable,
                    configPaso: op.configNestingV2 ?? null,
                    variante: {
                        anchoMm: variante.anchoMm,
                        altoMm: variante.altoMm,
                        papelVariante: variante.papelVariante
                            ? {
                                id: variante.papelVariante.id,
                                sku: variante.papelVariante.sku,
                                precioReferencia: variante.papelVariante.precioReferencia,
                                atributosVarianteJson: variante.papelVariante.atributosVarianteJson,
                            }
                            : null,
                    },
                    configProducto: runtime.configProducto ?? {},
                    selecciones,
                });
            const opMaquina = op.maquina ?? null;
            const opPerfil = op
                .perfilOperativo ?? null;
            const consumiblesCtx = {
                cantidadPedida: cantidad,
                layout: layoutAplicable,
                perfil: opPerfil
                    ? {
                        id: String(opPerfil.id),
                        dobleFaz: Boolean(opPerfil.dobleFaz),
                        productivityUnit: opPerfil.productivityUnit ?? null,
                    }
                    : null,
            };
            const consumiblesAuto = (0, maquina_consumibles_1.construirConsumiblesDelPerfil)(opMaquina?.consumibles, consumiblesCtx);
            const desgasteAuto = (0, maquina_consumibles_1.construirDesgasteDelPaso)(opMaquina?.componentesDesgaste, consumiblesCtx);
            const materialesConsumidos = [
                ...materialesDelPasoBase,
                ...consumiblesAuto,
                ...desgasteAuto,
            ];
            const costoMateriasPrimas = roundMoney(materialesConsumidos.reduce((acc, m) => acc + m.costo, 0));
            pasos.push({
                id: `P-${String(op.orden).padStart(2, '0')}-${op.codigo}`,
                tipo: familiaCodigo,
                nombre: op.nombre,
                costoCentroCosto,
                costoMateriasPrimas,
                cargosFlat: 0,
                trazabilidad: {
                    operacionId: op.id,
                    orden: op.orden,
                    codigo: op.codigo,
                    familia: familia
                        ? { codigo: familia.codigo, nombre: familia.nombre, modoNesting: familia.modoNesting }
                        : null,
                    esOpcional: op.esOpcional,
                    activacionV2: op.activacionV2 ?? null,
                    unidadProductivaV2: op.unidadProductivaV2 ?? null,
                    maquina: op.maquina
                        ? { id: op.maquina.id, nombre: op.maquina.nombre }
                        : null,
                    perfilOperativo: op.perfilOperativo
                        ? { id: op.perfilOperativo.id, nombre: op.perfilOperativo.nombre }
                        : null,
                    centroCosto: op.centroCosto
                        ? { id: op.centroCosto.id, nombre: op.centroCosto.nombre }
                        : null,
                    tarifaHora,
                    setupMin,
                    cleanupMin,
                    tiempoFijoMin,
                    productivoMin: roundMoney(productividad.runMin),
                    totalMin: roundMoney(totalMin),
                    cantidadObjetivoSalida,
                    productividadAplicada: productividad.productividadAplicada,
                    mermaRunPctAplicada: productividad.mermaRunPctAplicada,
                    mermaSetupAplicada: productividad.mermaSetupAplicada,
                    alternativaSeleccionada: alternativaElegida
                        ? {
                            id: alternativaElegida.id,
                            label: alternativaElegida.label,
                            esDefault: alternativaElegida.esDefault,
                            fuente: alternativaIdSel ? 'cliente' : 'default',
                        }
                        : null,
                    alternativasDisponibles: alternativas.map((a) => ({
                        id: a.id,
                        label: a.label,
                        esDefault: a.esDefault,
                    })),
                    nesting: layoutAplicable
                        ? summarizeLayout(layoutAplicable, Boolean(nestingHeredado), materialMaquina)
                        : null,
                    materiales: materialesConsumidos,
                },
            });
        }
        const centroCosto = roundMoney(pasos.reduce((a, p) => a + p.costoCentroCosto, 0));
        const materiasPrimas = roundMoney(pasos.reduce((a, p) => a + p.costoMateriasPrimas, 0));
        const cargosFlat = roundMoney(pasos.reduce((a, p) => a + p.cargosFlat, 0));
        const total = roundMoney(centroCosto + materiasPrimas + cargosFlat);
        const unitario = cantidad > 0 ? roundMoney(total / cantidad) : 0;
        const opcionalesDisponibles = proceso.operaciones
            .filter((op) => {
            if (!op.activo)
                return false;
            const activacion = op.activacionV2 ?? null;
            if (activacion === 'OPCIONAL' || activacion === 'CONDICIONAL')
                return true;
            if (activacion === 'OBLIGATORIO')
                return false;
            return op.esOpcional;
        })
            .map((op) => ({
            id: op.id,
            orden: op.orden,
            codigo: op.codigo,
            nombre: op.nombre,
            familiaV2: op.familiaV2 ?? null,
            activacionV2: op.activacionV2 ?? null,
            seleccionado: opcionalesSeleccionados.has(op.id),
        }));
        return {
            motorCodigo: 'universal',
            motorVersion: 1,
            periodo,
            cantidad,
            total,
            unitario,
            subtotales: { centroCosto, materiasPrimas, cargosFlat },
            pasos,
            subProductos,
            warnings,
            trazabilidad: {
                varianteId,
                productoServicioId: variante.productoServicioId,
                procesoDefinicionId: proceso.id,
                procesoNombre: proceso.nombre,
                opcionalesDisponibles,
                nestingRuta: nestingOutput
                    ? {
                        pasosProduce: Array.from(nestingOutput.layoutsPorPasoId.keys()),
                        consumeMap: Array.from(nestingOutput.consumeMap.entries()).map(([consumerId, produceId]) => ({ consumerId, produceId })),
                        consumersSinProduce: nestingOutput.consumersSinProduce,
                    }
                    : null,
            },
        };
    }
    resolverMedidasTrabajo(payload, variante, cantidad) {
        const params = (payload.parametros ?? {});
        if (Array.isArray(params.medidas) && params.medidas.length > 0) {
            return params.medidas
                .map((m) => ({
                anchoMm: Number(m.anchoMm ?? 0),
                altoMm: Number(m.altoMm ?? 0),
                cantidad: Math.max(1, Math.floor(Number(m.cantidad ?? 1))),
            }))
                .filter((m) => m.anchoMm > 0 && m.altoMm > 0);
        }
        const anchoPayload = Number(params.anchoMm ?? 0);
        const altoPayload = Number(params.altoMm ?? 0);
        if (anchoPayload > 0 && altoPayload > 0) {
            return [{ anchoMm: anchoPayload, altoMm: altoPayload, cantidad }];
        }
        const anchoV = Number(variante.anchoMm ?? 0);
        const altoV = Number(variante.altoMm ?? 0);
        if (anchoV > 0 && altoV > 0) {
            return [{ anchoMm: anchoV, altoMm: altoV, cantidad }];
        }
        return [];
    }
    async resolverMaterialesSubProducto(auth, declarados, ctx) {
        const resultado = [];
        for (const m of declarados) {
            const productoComponenteId = String(m.productoComponenteId ?? '');
            const varianteComponenteIdExplicito = m.varianteComponenteId != null ? String(m.varianteComponenteId) : null;
            if (!productoComponenteId)
                continue;
            const formula = String(m.formula ?? 'fijo');
            const cantidadPorUnidad = Number(m.cantidadPorUnidad ?? 0);
            const aplicaMultiCaras = Boolean(m.aplicaMultiCaras ?? false);
            const caras = (ctx.selecciones.get('caras') ?? 'simple_faz').toLowerCase();
            const multCaras = caras === 'doble_faz' ? 2 : 1;
            let unidadesBase = 0;
            if (formula === 'por_unidad_productiva') {
                if (ctx.layout?.algoritmo === 'nesting-hoja')
                    unidadesBase = ctx.layout.result.pliegosNecesarios;
                else if (ctx.layout?.algoritmo === 'nesting-rollo')
                    unidadesBase = ctx.layout.result.consumedLengthMm / 1000;
                else if (ctx.layout?.algoritmo === 'nesting-placa-rigida')
                    unidadesBase = Math.ceil(ctx.cantidadPedida / (ctx.layout.result.piezasPorPlaca || 1));
                else
                    unidadesBase = ctx.cantidadPedida;
            }
            else if (formula === 'por_m2') {
                if (ctx.layout?.algoritmo === 'nesting-hoja') {
                    const r = ctx.layout.result;
                    unidadesBase = (r.pliegoElegido.anchoMm * r.pliegoElegido.altoMm * r.pliegosNecesarios) / 1_000_000;
                }
                else if (ctx.layout?.algoritmo === 'nesting-rollo') {
                    unidadesBase = ctx.layout.result.usefulAreaM2;
                }
            }
            else if (formula === 'por_pieza') {
                unidadesBase = ctx.cantidadPedida;
            }
            else if (formula === 'por_metro_lineal') {
                if (ctx.layout?.algoritmo === 'nesting-rollo')
                    unidadesBase = ctx.layout.result.consumedLengthMm / 1000;
            }
            else {
                unidadesBase = 1;
            }
            const cantidadRealFloat = unidadesBase * cantidadPorUnidad * (aplicaMultiCaras ? multCaras : 1);
            if (cantidadRealFloat <= 0)
                continue;
            const cantidadSubProducto = Math.max(1, Math.ceil(cantidadRealFloat));
            let varianteComponenteId = varianteComponenteIdExplicito;
            if (!varianteComponenteId) {
                const fallback = await this.service.findDefaultVarianteDeProducto(auth, productoComponenteId);
                if (!fallback) {
                    resultado.push({
                        nombre: String(m.nombre ?? 'Sub-producto'),
                        cantidad: cantidadSubProducto,
                        unidad: 'unidad',
                        precioUnitario: 0,
                        costo: 0,
                        fuente: 'SubProducto (sin variante — no se pudo cotizar)',
                    });
                    continue;
                }
                varianteComponenteId = fallback;
            }
            const subCotizacion = await this.quoteInternal(auth, varianteComponenteId, {
                periodo: ctx.periodo,
                cantidad: cantidadSubProducto,
            }, ctx.visited);
            ctx.subProductos.push(subCotizacion);
            resultado.push({
                nombre: String(m.nombre ?? 'Sub-producto'),
                cantidad: cantidadSubProducto,
                unidad: 'unidad',
                precioUnitario: subCotizacion.unitario,
                costo: subCotizacion.total,
                fuente: `SubProducto ${subCotizacion.motorCodigo}@${subCotizacion.motorVersion}`,
            });
        }
        return resultado;
    }
    resolverMaterialMaquinaContext(_runtime, operacionesAEjecutar) {
        const opImpresion = operacionesAEjecutar.find((op) => {
            if (!op.familiaV2)
                return false;
            const f = familias_1.FAMILIAS_PASO[op.familiaV2];
            return f?.modoNesting === 'produce';
        });
        if (!opImpresion?.maquina?.parametrosTecnicosJson)
            return undefined;
        const p = opImpresion.maquina.parametrosTecnicosJson;
        const cmToMm = (v) => {
            const n = Number(v);
            return Number.isFinite(n) && n > 0 ? n * 10 : undefined;
        };
        const anchoMaxMm = cmToMm(p.anchoImprimibleMaximo) ??
            cmToMm(p.anchoBoca) ??
            cmToMm(p.anchoCama) ??
            cmToMm(p.anchoMaxHoja);
        const marginLeftMm = cmToMm(p.margenLateralIzquierdoNoImprimible) ??
            cmToMm(p.margenIzquierdo) ??
            0;
        const marginRightMm = cmToMm(p.margenLateralDerechoNoImprimible) ??
            cmToMm(p.margenDerecho) ??
            0;
        const marginStartMm = cmToMm(p.margenInicioNoImprimible) ?? cmToMm(p.margenSuperior) ?? 0;
        const marginEndMm = cmToMm(p.margenFinalNoImprimible) ?? cmToMm(p.margenInferior) ?? 0;
        const printableWidthMm = anchoMaxMm != null
            ? Math.max(0, anchoMaxMm - marginLeftMm - marginRightMm)
            : undefined;
        return {
            maquinaAnchoTotalMm: anchoMaxMm,
            maquinaPrintableWidthMm: printableWidthMm || undefined,
            maquinaMarginLeftMm: marginLeftMm || undefined,
            maquinaMarginRightMm: marginRightMm || undefined,
            maquinaMarginStartMm: marginStartMm || undefined,
            maquinaMarginEndMm: marginEndMm || undefined,
        };
    }
}
exports.SuperMotorModule = SuperMotorModule;
function resolverCantidadObjetivoSalida(args) {
    const { unidadProductiva, layout, cantidadPedida, familiaModoNesting } = args;
    const unidad = (unidadProductiva ?? '').toLowerCase();
    if (unidad === 'pliego' || unidad === 'pliegos' || unidad === 'hoja' || unidad === 'hojas') {
        if (layout?.algoritmo === 'nesting-hoja')
            return layout.result.pliegosNecesarios;
        return cantidadPedida;
    }
    if (unidad === 'placa' || unidad === 'placas') {
        if (layout?.algoritmo === 'nesting-placa-rigida') {
            if (layout.result.piezasPorPlaca === 0)
                return 0;
            return Math.max(1, Math.ceil(cantidadPedida / layout.result.piezasPorPlaca));
        }
        return cantidadPedida;
    }
    if (unidad === 'metro_lineal' || unidad === 'metros_lineales') {
        if (layout?.algoritmo === 'nesting-rollo') {
            return Math.ceil(layout.result.consumedLengthMm / 1000);
        }
        return cantidadPedida;
    }
    if (unidad === 'm2') {
        if (layout?.algoritmo === 'nesting-rollo')
            return layout.result.usefulAreaM2;
        if (layout?.algoritmo === 'nesting-hoja') {
            const r = layout.result;
            return (r.pliegoElegido.anchoMm * r.pliegoElegido.altoMm * r.pliegosNecesarios) / 1_000_000;
        }
        return cantidadPedida;
    }
    if (unidad === 'unidad' ||
        unidad === 'unidades' ||
        unidad === 'pieza' ||
        unidad === 'piezas' ||
        unidad === 'letra' ||
        unidad === 'letras' ||
        unidad === 'modulo' ||
        unidad === 'modulos' ||
        unidad === 'módulo' ||
        unidad === 'módulos') {
        return cantidadPedida;
    }
    if (unidad === 'corrida' || unidad === 'corridas') {
        return 1;
    }
    if (unidad === 'hora' || unidad === 'horas') {
        return 1;
    }
    if (familiaModoNesting === 'produce' || familiaModoNesting === 'consume') {
        return layoutToCantidadObjetivo(layout) ?? cantidadPedida;
    }
    return cantidadPedida;
}
function layoutToCantidadObjetivo(layout) {
    if (!layout)
        return null;
    if (layout.algoritmo === 'nesting-hoja')
        return layout.result.pliegosNecesarios;
    if (layout.algoritmo === 'nesting-rollo') {
        return Math.ceil(layout.result.consumedLengthMm / 1000);
    }
    if (layout.algoritmo === 'nesting-placa-rigida') {
        if (layout.result.piezasPorPlaca === 0)
            return 0;
        return Math.max(1, Math.ceil(1 / layout.result.piezasPorPlaca));
    }
    return null;
}
function calcularMaterialesDeclarados(declarados, ctx) {
    const caras = (ctx.selecciones.get('caras') ?? 'simple_faz').toLowerCase();
    const multCaras = caras === 'doble_faz' ? 2 : 1;
    return declarados
        .map((m) => {
        const formula = String(m.formula ?? 'fijo');
        const cantidadPorUnidad = Number(m.cantidadPorUnidad ?? 0);
        const aplicaMultiCaras = Boolean(m.aplicaMultiCaras ?? false);
        let unidadesBase = 0;
        if (formula === 'por_unidad_productiva') {
            if (ctx.layout?.algoritmo === 'nesting-hoja')
                unidadesBase = ctx.layout.result.pliegosNecesarios;
            else if (ctx.layout?.algoritmo === 'nesting-rollo')
                unidadesBase = ctx.layout.result.consumedLengthMm / 1000;
            else if (ctx.layout?.algoritmo === 'nesting-placa-rigida')
                unidadesBase = Math.ceil(ctx.cantidadPedida / (ctx.layout.result.piezasPorPlaca || 1));
            else
                unidadesBase = ctx.cantidadPedida;
        }
        else if (formula === 'por_m2') {
            if (ctx.layout?.algoritmo === 'nesting-hoja') {
                const r = ctx.layout.result;
                unidadesBase = (r.pliegoElegido.anchoMm * r.pliegoElegido.altoMm * r.pliegosNecesarios) / 1_000_000;
            }
            else if (ctx.layout?.algoritmo === 'nesting-rollo') {
                unidadesBase = ctx.layout.result.usefulAreaM2;
            }
        }
        else if (formula === 'por_pieza') {
            unidadesBase = ctx.cantidadPedida;
        }
        else if (formula === 'por_metro_lineal') {
            if (ctx.layout?.algoritmo === 'nesting-rollo')
                unidadesBase = ctx.layout.result.consumedLengthMm / 1000;
        }
        else {
            unidadesBase = 1;
        }
        const cantidadReal = unidadesBase * cantidadPorUnidad * (aplicaMultiCaras ? multCaras : 1);
        if (cantidadReal <= 0)
            return null;
        const variante = m.materiaPrimaVariante;
        const precioUnitario = Number(variante?.precioReferencia ?? 0) > 0
            ? Number(variante.precioReferencia)
            : Number(m.precioManual ?? 0);
        return {
            nombre: String(m.nombre ?? 'Material'),
            cantidad: Math.round(cantidadReal * 1000) / 1000,
            unidad: String(m.unidad ?? 'unidad'),
            precioUnitario,
            costo: cantidadReal * precioUnitario,
            fuente: 'ProcesoOperacionMaterial',
        };
    })
        .filter((m) => m !== null && m.costo > 0);
}
function inferirFamiliaDesdeTipo(tipoOperacion, nombre) {
    const low = nombre.toLowerCase();
    switch (tipoOperacion) {
        case 'PREPRENSA':
            return 'pre_prensa';
        case 'IMPRESION':
            if (low.includes('rollo') || low.includes('latex') || low.includes('solvente')) {
                return 'impresion_por_area';
            }
            if (low.includes('uv') || low.includes('pieza') || low.includes('cnc')) {
                return 'impresion_por_pieza';
            }
            return 'impresion_por_hoja';
        case 'TERMINACION':
            if (low.includes('laminado') || low.includes('plastif'))
                return 'laminado';
            if (low.includes('corte') || low.includes('guillot') || low.includes('plotter'))
                return 'corte';
            if (low.includes('encuadern') || low.includes('anillado') || low.includes('espiral'))
                return 'encuadernado';
            if (low.includes('foil') || low.includes('relieve') || low.includes('hot-stamp'))
                return 'acabado_decorativo';
            if (low.includes('troquelado'))
                return 'troquelado';
            if (low.includes('perforado'))
                return 'perforado';
            if (low.includes('plegado'))
                return 'plegado';
            return 'operacion_manual';
        case 'EMPAQUE':
        case 'LOGISTICA':
            return 'operacion_manual';
        default:
            return 'operacion_manual';
    }
}
function extractMaterialesParaRunner(op) {
    const raw = op.materialesConsumidos;
    if (!Array.isArray(raw))
        return undefined;
    const result = [];
    for (const m of raw) {
        if (!m || typeof m !== 'object')
            continue;
        const mat = m;
        if (!mat.esSustratoNesting)
            continue;
        const variantesRaw = Array.isArray(mat.variantesHabilitadas)
            ? mat.variantesHabilitadas
            : [];
        const variantes = variantesRaw
            .filter((v) => v && typeof v === 'object' && v.activo !== false)
            .map((v) => {
            const mp = v
                .materiaPrimaVariante ?? null;
            return {
                materiaPrimaVarianteId: String(mp?.id ?? v.materiaPrimaVarianteId ?? ''),
                sku: String(mp?.sku ?? ''),
                nombreVariante: mp?.nombreVariante ?? null,
                atributosVariante: mp?.atributosVarianteJson ?? null,
                precioReferencia: mp?.precioReferencia != null ? Number(mp.precioReferencia) : null,
            };
        })
            .filter((v) => v.materiaPrimaVarianteId.length > 0);
        if (variantes.length === 0)
            continue;
        result.push({
            id: String(mat.id),
            nombre: String(mat.nombre ?? ''),
            esSustratoNesting: true,
            variantesHabilitadas: variantes,
        });
    }
    return result.length > 0 ? result : undefined;
}
function summarizeLayout(layout, heredado, materialMaquina) {
    const base = { algoritmo: layout.algoritmo, heredado };
    if (layout.algoritmo === 'nesting-hoja') {
        return {
            ...base,
            pliegoElegido: layout.result.pliegoElegido,
            pliegosNecesarios: layout.result.pliegosNecesarios,
            piezasPorPliego: layout.result.piezasPorPliego,
            columnas: layout.result.columnas,
            filas: layout.result.filas,
            aprovechamientoPct: layout.result.aprovechamientoPct,
            placements: layout.result.placements,
        };
    }
    if (layout.algoritmo === 'nesting-rollo') {
        const elegido = layout.evaluacion?.materialElegido;
        const rolloAnchoFromEleccion = elegido?.rolloAnchoMm ?? null;
        const rolloAnchoTotal = layout.rolloAnchoTotalMm ??
            rolloAnchoFromEleccion ??
            materialMaquina?.maquinaAnchoTotalMm ??
            materialMaquina?.maquinaPrintableWidthMm ??
            null;
        const marginLeft = layout.marginLeftMm ?? 0;
        const marginRight = layout.marginRightMm ?? 0;
        const printableEfectivo = rolloAnchoTotal != null
            ? Math.max(0, rolloAnchoTotal - marginLeft - marginRight)
            : (materialMaquina?.maquinaPrintableWidthMm ?? null);
        const areaConsumidaM2 = printableEfectivo != null && layout.result.consumedLengthMm > 0
            ? (printableEfectivo * layout.result.consumedLengthMm) / 1_000_000
            : 0;
        const aprovechamientoPct = elegido?.aprovechamientoPct ??
            (areaConsumidaM2 > 0
                ? Math.round((layout.result.usefulAreaM2 / areaConsumidaM2) * 10000) / 100
                : 0);
        return {
            ...base,
            rolloAnchoMm: rolloAnchoTotal,
            printableWidthMm: printableEfectivo,
            marginLeftMm: layout.marginLeftMm ?? 0,
            marginRightMm: layout.marginRightMm ?? 0,
            marginStartMm: layout.marginStartMm ?? 0,
            marginEndMm: layout.marginEndMm ?? 0,
            consumedLengthMm: layout.result.consumedLengthMm,
            largoConsumidoMm: layout.result.consumedLengthMm,
            usefulAreaM2: layout.result.usefulAreaM2,
            areaUtilizadaM2: layout.result.usefulAreaM2,
            aprovechamientoPct,
            porcentajeAprovechamiento: aprovechamientoPct,
            areaConsumidaM2,
            panelCount: layout.result.panelCount,
            orientacion: layout.result.orientacion,
            placements: layout.result.placements,
            materialElegido: elegido ?? null,
            criterioAplicado: layout.evaluacion?.criterio ?? null,
            materialesEvaluados: layout.evaluacion?.materialesEvaluados ?? null,
            materialesDescartados: layout.evaluacion?.materialesDescartados ?? null,
        };
    }
    return {
        ...base,
        piezasPorPlaca: layout.result.piezasPorPlaca,
        columnas: layout.result.columnas,
        filas: layout.result.filas,
        rotada: layout.result.rotada,
        placements: layout.result.placements,
    };
}
//# sourceMappingURL=super-motor.js.map