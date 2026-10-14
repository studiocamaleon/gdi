import { describe, expect, it } from "vitest";

import {
  createEmptyCondition,
  estadoPasoRuleFields,
  findRuleField,
  jsonLogicToRuleGroup,
  ruleGroupToJsonLogic,
  rulePasoDeFieldKey,
  summarizeCondition,
  validateRuleGroup,
  type RuleFieldDefinition,
} from "./rule-builder";

/**
 * Variables de regla POR PASO ("Si <Tecnología> de <Paso>"): la definición
 * lleva el prefijo en `key` y la lista de pasos; la clave persistida en
 * jsonLogic es `prefijo + pasoId` — compatible con las reglas guardadas por
 * el builder viejo (un item plano por paso con esa misma clave).
 */
const PASOS = [
  { value: "cp-1", label: "Paso 1 · Impresión" },
  { value: "cp-2", label: "Paso 2 · Estructura" },
];

const CAMPOS: RuleFieldDefinition[] = [
  {
    key: "tecnologia_",
    label: "Tecnología",
    kind: "select",
    valueKind: "string",
    operators: ["=", "!="],
    options: [{ value: "laser", label: "Láser" }],
    pasos: PASOS,
  },
  {
    key: "quienHace_",
    label: "Quién hace el paso",
    kind: "select",
    valueKind: "string",
    operators: ["=", "!="],
    options: [
      { value: "empresa", label: "Lo produce la empresa" },
      { value: "proveedor", label: "La hace un proveedor" },
    ],
    pasos: PASOS,
  },
];

describe("campos de regla por paso", () => {
  it("findRuleField resuelve prefijo + pasoId (y rechaza pasos ajenos)", () => {
    expect(findRuleField(CAMPOS, "tecnologia_cp-2")?.label).toBe("Tecnología");
    expect(findRuleField(CAMPOS, "quienHace_cp-1")?.label).toBe(
      "Quién hace el paso",
    );
    expect(findRuleField(CAMPOS, "tecnologia_otro")).toBeUndefined();
    expect(rulePasoDeFieldKey(CAMPOS[0], "tecnologia_cp-2")?.label).toBe(
      "Paso 2 · Estructura",
    );
  });

  it("condición nueva arranca apuntando al primer paso", () => {
    const condicion = createEmptyCondition(CAMPOS[1]);
    expect(condicion.fieldKey).toBe("quienHace_cp-1");
    expect(condicion.value).toBe("empresa");
  });

  it("round-trip jsonLogic conserva la clave por paso (compat reglas viejas)", () => {
    const rule = { "==": [{ var: "quienHace_cp-2" }, "proveedor"] };
    const parsed = jsonLogicToRuleGroup(rule, CAMPOS);
    expect(parsed.supported).toBe(true);
    if (!parsed.supported) return;
    expect(parsed.group.conditions[0].fieldKey).toBe("quienHace_cp-2");
    expect(validateRuleGroup(parsed.group, CAMPOS).ok).toBe(true);
    expect(ruleGroupToJsonLogic(parsed.group, CAMPOS)).toEqual(rule);
  });

  it("el resumen dice la variable Y el paso", () => {
    const rule = { "==": [{ var: "quienHace_cp-2" }, "proveedor"] };
    const parsed = jsonLogicToRuleGroup(rule, CAMPOS);
    if (!parsed.supported) throw new Error("no parseó");
    expect(summarizeCondition(parsed.group.conditions[0], CAMPOS)).toBe(
      "Quién hace el paso de Paso 2 · Estructura es La hace un proveedor",
    );
  });
});

describe("estado de otro paso", () => {
  it("permite elegir activo/inactivo, excluye al propio paso y conserva la regla guardada", () => {
    const fields = estadoPasoRuleFields([
      { value: "rp-preprensa", label: "Preprensa" },
      { value: "rp-diseno", label: "Diseño gráfico" },
    ], "rp-preprensa");
    expect(fields[0].pasos).toEqual([{ value: "rp-diseno", label: "Diseño gráfico" }]);
    const rule = { "==": [{ var: "pasoActivo_rp-diseno" }, 0] };
    const parsed = jsonLogicToRuleGroup(rule, fields);
    if (!parsed.supported) throw new Error("La regla debe ser editable visualmente");
    expect(validateRuleGroup(parsed.group, fields).ok).toBe(true);
    expect(ruleGroupToJsonLogic(parsed.group, fields)).toEqual(rule);
    expect(summarizeCondition(parsed.group.conditions[0], fields)).toBe("Estado de otro paso de Diseño gráfico es Inactivo");
    parsed.group.conditions[0].value = "1";
    expect(ruleGroupToJsonLogic(parsed.group, fields)).toEqual({ "==": [{ var: "pasoActivo_rp-diseno" }, 1] });
  });
});
