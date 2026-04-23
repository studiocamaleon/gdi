"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluarCondicion = evaluarCondicion;
exports.evaluarBool = evaluarBool;
exports.resolverRegla = resolverRegla;
const json_logic_js_1 = __importDefault(require("json-logic-js"));
function evaluarCondicion(expr, context) {
    return json_logic_js_1.default.apply(expr, context);
}
function evaluarBool(expr, context) {
    return Boolean(evaluarCondicion(expr, context));
}
function resolverRegla(casos, defaultDecision, context) {
    for (const caso of casos) {
        if (evaluarBool(caso.condicion, context)) {
            return caso.decision;
        }
    }
    return defaultDecision;
}
//# sourceMappingURL=evaluador.js.map