"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProductividadRulesByMode = validateProductividadRulesByMode;
exports.evaluateProductividad = evaluateProductividad;
const client_1 = require("@prisma/client");
const FORMULA_OPERATORS = new Set([
    'add',
    'sub',
    'mul',
    'div',
    'min',
    'max',
    'pow',
]);
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function toFiniteNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim().length) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}
function decimalToNumberOrNull(value) {
    if (!value) {
        return null;
    }
    return Number(value);
}
function parseFormulaExprNode(value) {
    if (!isObject(value)) {
        return null;
    }
    if ('const' in value) {
        const numeric = toFiniteNumber(value.const);
        if (numeric === null) {
            return null;
        }
        return { const: numeric };
    }
    if ('var' in value &&
        typeof value.var === 'string' &&
        value.var.trim().length) {
        return { var: value.var };
    }
    if ('op' in value &&
        typeof value.op === 'string' &&
        FORMULA_OPERATORS.has(value.op) &&
        Array.isArray(value.args)) {
        const args = value.args
            .map((item) => parseFormulaExprNode(item))
            .filter((item) => Boolean(item));
        if (!args.length) {
            return null;
        }
        return {
            op: value.op,
            args,
        };
    }
    return null;
}
function parseFormulaRule(value) {
    if (!isObject(value) || value.tipo !== 'formula_v1') {
        return null;
    }
    const expresion = parseFormulaExprNode(value.expresion);
    if (!expresion) {
        return null;
    }
    const variables = {};
    if (isObject(value.variables)) {
        for (const [key, item] of Object.entries(value.variables)) {
            if (!isObject(item) || typeof item.source !== 'string') {
                return null;
            }
            const source = item.source;
            if (source !== 'context' &&
                source !== 'const' &&
                source !== 'productividad_base' &&
                source !== 'cantidad_objetivo' &&
                source !== 'merma_run_pct' &&
                source !== 'merma_setup') {
                return null;
            }
            variables[key] = {
                source,
                key: typeof item.key === 'string' ? item.key : undefined,
                value: toFiniteNumber(item.value) ?? undefined,
                default: toFiniteNumber(item.default) ?? undefined,
            };
        }
    }
    const bounds = isObject(value.bounds)
        ? {
            min: toFiniteNumber(value.bounds.min) ?? undefined,
            max: toFiniteNumber(value.bounds.max) ?? undefined,
        }
        : undefined;
    return {
        tipo: 'formula_v1',
        expresion,
        variables,
        bounds,
    };
}
function parseTablaRule(value) {
    if (!isObject(value) || value.tipo !== 'tabla_v1') {
        return null;
    }
    if (!Array.isArray(value.ejes) || !Array.isArray(value.filas)) {
        return null;
    }
    const ejes = [];
    for (const axis of value.ejes) {
        if (!isObject(axis) ||
            typeof axis.key !== 'string' ||
            typeof axis.type !== 'string') {
            return null;
        }
        if (axis.type !== 'number_range' && axis.type !== 'enum') {
            return null;
        }
        ejes.push({
            key: axis.key,
            type: axis.type,
        });
    }
    const filas = [];
    for (const row of value.filas) {
        if (!isObject(row)) {
            return null;
        }
        filas.push(row);
    }
    let fallback;
    if (isObject(value.fallback) && typeof value.fallback.type === 'string') {
        if (value.fallback.type === 'productividad_base') {
            fallback = { type: 'productividad_base' };
        }
        else if (value.fallback.type === 'const') {
            const numeric = toFiniteNumber(value.fallback.value);
            if (numeric === null) {
                return null;
            }
            fallback = { type: 'const', value: numeric };
        }
        else if (value.fallback.type === 'none') {
            fallback = { type: 'none' };
        }
        else {
            return null;
        }
    }
    return {
        tipo: 'tabla_v1',
        ejes,
        filas,
        fallback,
    };
}
function parseMermaRule(value) {
    const formula = parseFormulaRule(value);
    if (formula) {
        const typed = value;
        return {
            ...formula,
            target: typed.target === 'merma_setup' || typed.target === 'merma_run_pct'
                ? typed.target
                : undefined,
        };
    }
    const tabla = parseTablaRule(value);
    if (!tabla) {
        return null;
    }
    const typed = value;
    return {
        ...tabla,
        target: typed.target === 'merma_setup' || typed.target === 'merma_run_pct'
            ? typed.target
            : undefined,
    };
}
function resolvePath(contexto, key) {
    return key.split('.').reduce((acc, segment) => {
        if (!isObject(acc) && !Array.isArray(acc)) {
            return undefined;
        }
        if (Array.isArray(acc)) {
            const index = Number(segment);
            if (!Number.isInteger(index)) {
                return undefined;
            }
            return acc[index];
        }
        return acc[segment];
    }, contexto);
}
function applyBounds(value, bounds) {
    if (!bounds) {
        return value;
    }
    if (bounds.min !== undefined && value < bounds.min) {
        return bounds.min;
    }
    if (bounds.max !== undefined && value > bounds.max) {
        return bounds.max;
    }
    return value;
}
function evaluateFormulaExpr(node, env) {
    if ('const' in node) {
        return node.const;
    }
    if ('var' in node) {
        return env[node.var] ?? 0;
    }
    const args = node.args.map((arg) => evaluateFormulaExpr(arg, env));
    if (node.op === 'add') {
        return args.reduce((acc, val) => acc + val, 0);
    }
    if (node.op === 'sub') {
        if (args.length === 1) {
            return -args[0];
        }
        return args.slice(1).reduce((acc, val) => acc - val, args[0] ?? 0);
    }
    if (node.op === 'mul') {
        return args.reduce((acc, val) => acc * val, 1);
    }
    if (node.op === 'div') {
        if (!args.length) {
            return 0;
        }
        return args.slice(1).reduce((acc, val) => {
            if (val === 0) {
                return acc;
            }
            return acc / val;
        }, args[0] ?? 0);
    }
    if (node.op === 'pow') {
        if (!args.length) {
            return 0;
        }
        return args.slice(1).reduce((acc, val) => Math.pow(acc, val), args[0] ?? 0);
    }
    if (node.op === 'min') {
        return Math.min(...args);
    }
    return Math.max(...args);
}
function matchesTablaRow(row, ejes, contexto) {
    for (const axis of ejes) {
        const value = resolvePath(contexto, axis.key);
        if (axis.type === 'enum') {
            if (row[axis.key] !== value) {
                return false;
            }
            continue;
        }
        const range = row[axis.key];
        if (!isObject(range)) {
            return false;
        }
        const numericValue = toFiniteNumber(value);
        if (numericValue === null) {
            return false;
        }
        const min = toFiniteNumber(range.min);
        const max = toFiniteNumber(range.max);
        if (min !== null && numericValue < min) {
            return false;
        }
        if (max !== null && numericValue > max) {
            return false;
        }
    }
    return true;
}
function evaluateFormulaRule(rule, args) {
    const env = {
        PB: args.productividadBase,
        QTY: args.cantidadObjetivo,
        MERMA_RUN_PCT: args.mermaRunPct,
        MERMA_SETUP: args.mermaSetup,
    };
    for (const [name, config] of Object.entries(rule.variables ?? {})) {
        const fallback = config.default ?? 0;
        if (config.source === 'const') {
            env[name] = config.value ?? fallback;
            continue;
        }
        if (config.source === 'productividad_base') {
            env[name] = args.productividadBase;
            continue;
        }
        if (config.source === 'cantidad_objetivo') {
            env[name] = args.cantidadObjetivo;
            continue;
        }
        if (config.source === 'merma_run_pct') {
            env[name] = args.mermaRunPct;
            continue;
        }
        if (config.source === 'merma_setup') {
            env[name] = args.mermaSetup;
            continue;
        }
        const fromContext = config.key
            ? resolvePath(args.contexto, config.key)
            : undefined;
        env[name] = toFiniteNumber(fromContext) ?? fallback;
    }
    const raw = evaluateFormulaExpr(rule.expresion, env);
    return applyBounds(raw, rule.bounds);
}
function evaluateVelocidadTablaRule(rule, args) {
    const matched = rule.filas.find((row) => matchesTablaRow(row, rule.ejes, args.contexto));
    if (matched) {
        return toFiniteNumber(matched.productividad);
    }
    if (rule.fallback?.type === 'const') {
        return rule.fallback.value;
    }
    if (!rule.fallback || rule.fallback.type === 'productividad_base') {
        return args.productividadBase;
    }
    return null;
}
function evaluateMermaTablaRule(rule, args) {
    const matched = rule.filas.find((row) => matchesTablaRow(row, rule.ejes, args.contexto));
    if (!matched) {
        return {};
    }
    const result = {};
    const run = toFiniteNumber(matched.mermaRunPct);
    if (run !== null) {
        result.mermaRunPct = run;
    }
    const setup = toFiniteNumber(matched.mermaSetup);
    if (setup !== null) {
        result.mermaSetup = setup;
    }
    return result;
}
function validateProductividadRulesByMode(args) {
    const errors = [];
    const productividadBase = decimalToNumberOrNull(args.productividadBase);
    if (args.modoProductividad === client_1.ModoProductividadProceso.FIJA) {
        if (productividadBase === null || productividadBase <= 0) {
            errors.push({
                field: 'productividadBase',
                message: 'Modo fija requiere Productividad base mayor a 0.',
            });
        }
    }
    if (args.modoProductividad === client_1.ModoProductividadProceso.FORMULA) {
        if (productividadBase === null || productividadBase <= 0) {
            errors.push({
                field: 'productividadBase',
                message: 'Modo formula requiere Productividad base mayor a 0.',
            });
        }
        if (!parseFormulaRule(args.reglaVelocidadJson)) {
            errors.push({
                field: 'reglaVelocidad',
                message: 'Modo formula requiere una Regla de velocidad valida con tipo formula_v1.',
            });
        }
    }
    if (args.modoProductividad === client_1.ModoProductividadProceso.TABLA) {
        if (!parseTablaRule(args.reglaVelocidadJson)) {
            errors.push({
                field: 'reglaVelocidad',
                message: 'Modo tabla requiere una Regla de velocidad valida con tipo tabla_v1.',
            });
        }
    }
    if (args.reglaMermaJson && !parseMermaRule(args.reglaMermaJson)) {
        errors.push({
            field: 'reglaMerma',
            message: 'Regla de merma invalida. Debe respetar esquema formula_v1 o tabla_v1.',
        });
    }
    return errors;
}
function evaluateProductividad(input) {
    const warnings = [];
    const productividadBase = decimalToNumberOrNull(input.productividadBase) ?? 0;
    const runMinFallback = decimalToNumberOrNull(input.runMin) ?? 0;
    let mermaRunPctAplicada = decimalToNumberOrNull(input.mermaRunPct) ?? 0;
    let mermaSetupAplicada = decimalToNumberOrNull(input.mermaSetup) ?? 0;
    const mermaRule = parseMermaRule(input.reglaMermaJson);
    if (mermaRule) {
        if (mermaRule.tipo === 'formula_v1') {
            const formulaResult = evaluateFormulaRule(mermaRule, {
                productividadBase,
                cantidadObjetivo: input.cantidadObjetivoSalida,
                mermaRunPct: mermaRunPctAplicada,
                mermaSetup: mermaSetupAplicada,
                contexto: input.contexto,
            });
            if (mermaRule.target === 'merma_setup') {
                mermaSetupAplicada = formulaResult;
            }
            else {
                mermaRunPctAplicada = formulaResult;
            }
        }
        else {
            const tablaResult = evaluateMermaTablaRule(mermaRule, {
                contexto: input.contexto,
            });
            if (tablaResult.mermaRunPct !== undefined) {
                mermaRunPctAplicada = tablaResult.mermaRunPct;
            }
            if (tablaResult.mermaSetup !== undefined) {
                mermaSetupAplicada = tablaResult.mermaSetup;
            }
        }
    }
    if (mermaRunPctAplicada < 0) {
        warnings.push('La merma run calculada fue negativa, se fuerza a 0.');
        mermaRunPctAplicada = 0;
    }
    if (mermaSetupAplicada < 0) {
        warnings.push('La merma setup calculada fue negativa, se fuerza a 0.');
        mermaSetupAplicada = 0;
    }
    let productividadAplicada = null;
    if (input.modoProductividad === client_1.ModoProductividadProceso.FIJA) {
        if (productividadBase > 0) {
            productividadAplicada = productividadBase;
        }
        else {
            warnings.push('Modo fija sin Productividad base valida. Se usa run manual como fallback.');
        }
    }
    else if (input.modoProductividad === client_1.ModoProductividadProceso.FORMULA) {
        const rule = parseFormulaRule(input.reglaVelocidadJson);
        if (rule) {
            productividadAplicada = evaluateFormulaRule(rule, {
                productividadBase,
                cantidadObjetivo: input.cantidadObjetivoSalida,
                mermaRunPct: mermaRunPctAplicada,
                mermaSetup: mermaSetupAplicada,
                contexto: input.contexto,
            });
        }
        else {
            warnings.push('Regla de velocidad formula invalida. Se usa run manual como fallback.');
        }
    }
    else {
        const rule = parseTablaRule(input.reglaVelocidadJson);
        if (rule) {
            productividadAplicada = evaluateVelocidadTablaRule(rule, {
                productividadBase,
                contexto: input.contexto,
            });
            if (productividadAplicada === null) {
                warnings.push('La tabla de velocidad no encontro coincidencia ni fallback valido. Se usa run manual.');
            }
        }
        else {
            warnings.push('Regla de velocidad tabla invalida. Se usa run manual como fallback.');
        }
    }
    const cantidadRun = input.cantidadObjetivoSalida * (1 + mermaRunPctAplicada / 100) +
        mermaSetupAplicada;
    if (cantidadRun < 0) {
        warnings.push('La cantidad de corrida calculada fue negativa, se fuerza a 0.');
    }
    let runMin = runMinFallback;
    if (productividadAplicada !== null && productividadAplicada > 0) {
        const cantidadNormalizada = Math.max(cantidadRun, 0);
        const tiempoEnUnidadBase = cantidadNormalizada / productividadAplicada;
        if (input.unidadTiempo === client_1.UnidadProceso.HORA) {
            runMin = tiempoEnUnidadBase * 60;
        }
        else {
            runMin = tiempoEnUnidadBase;
        }
    }
    else if (runMinFallback <= 0) {
        warnings.push('No se pudo calcular run por productividad ni existe run manual. Se asume 0.');
        runMin = 0;
    }
    if (!Number.isFinite(runMin) || runMin < 0) {
        warnings.push('El run calculado resulto invalido. Se fuerza a 0.');
        runMin = 0;
    }
    return {
        runMin: Number(runMin.toFixed(4)),
        productividadAplicada: productividadAplicada === null
            ? null
            : Number(productividadAplicada.toFixed(6)),
        cantidadRun: Number(Math.max(cantidadRun, 0).toFixed(4)),
        mermaRunPctAplicada: Number(mermaRunPctAplicada.toFixed(4)),
        mermaSetupAplicada: Number(mermaSetupAplicada.toFixed(4)),
        warnings,
    };
}
//# sourceMappingURL=proceso-productividad.engine.js.map