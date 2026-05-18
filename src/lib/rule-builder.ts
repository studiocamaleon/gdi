export type RuleCombinator = "and" | "or";
export type RuleFieldKind = "number" | "select";
export type RuleOperator = "=" | "!=" | ">" | ">=" | "<" | "<=";

export interface RuleOption {
  value: string;
  label: string;
}

export interface RuleFieldDefinition {
  key: string;
  label: string;
  kind: RuleFieldKind;
  valueKind: "number" | "string";
  operators: RuleOperator[];
  options?: RuleOption[];
}

export interface RuleConditionUI {
  id: string;
  fieldKey: string;
  operator: RuleOperator;
  value: string;
}

export interface RuleGroupUI {
  combinator: RuleCombinator;
  conditions: RuleConditionUI[];
}

export type RuleParseResult =
  | { supported: true; group: RuleGroupUI }
  | { supported: false; reason: string };

export interface RuleValidationResult {
  ok: boolean;
  error?: string;
}

const NUMBER_OPERATORS: RuleOperator[] = ["=", "!=", ">", ">=", "<", "<="];
const SELECT_OPERATORS: RuleOperator[] = ["=", "!="];

export const RULE_FIELD_DEFINITIONS: RuleFieldDefinition[] = [
  {
    key: "cantidad",
    label: "Cantidad pedida",
    kind: "number",
    valueKind: "number",
    operators: NUMBER_OPERATORS,
  },
  {
    key: "caras",
    label: "Caras",
    kind: "select",
    valueKind: "number",
    operators: SELECT_OPERATORS,
    options: [
      { value: "1", label: "Simple faz" },
      { value: "2", label: "Doble faz" },
    ],
  },
  {
    key: "tipoCopia",
    label: "Tipo de copia",
    kind: "select",
    valueKind: "number",
    operators: SELECT_OPERATORS,
    options: [
      { value: "1", label: "Simple" },
      { value: "2", label: "Duplicado" },
      { value: "3", label: "Triplicado" },
    ],
  },
  {
    key: "zonaInstalacion",
    label: "Zona de instalación",
    kind: "select",
    valueKind: "string",
    operators: SELECT_OPERATORS,
    options: [
      { value: "CABA", label: "CABA" },
      { value: "GBA_NORTE", label: "GBA Norte" },
      { value: "GBA_OESTE", label: "GBA Oeste" },
      { value: "GBA_SUR", label: "GBA Sur" },
      { value: "FUERA_AMBA", label: "Fuera AMBA" },
    ],
  },
  {
    key: "m2_instalados",
    label: "m² instalados",
    kind: "number",
    valueKind: "number",
    operators: NUMBER_OPERATORS,
  },
  {
    key: "piezaAnchoMaxMm",
    label: "Ancho máximo",
    kind: "number",
    valueKind: "number",
    operators: NUMBER_OPERATORS,
  },
  {
    key: "piezaAltoMaxMm",
    label: "Alto máximo",
    kind: "number",
    valueKind: "number",
    operators: NUMBER_OPERATORS,
  },
  {
    key: "piezaAreaTotalM2",
    label: "Área total m²",
    kind: "number",
    valueKind: "number",
    operators: NUMBER_OPERATORS,
  },
];

export function getRuleFields(options?: {
  includeMeasureFields?: boolean;
  extraFields?: RuleFieldDefinition[];
}) {
  const base = options?.includeMeasureFields
    ? RULE_FIELD_DEFINITIONS
    : RULE_FIELD_DEFINITIONS.filter(
        (field) =>
          !["piezaAnchoMaxMm", "piezaAltoMaxMm", "piezaAreaTotalM2"].includes(field.key),
      );
  return [...base, ...(options?.extraFields ?? [])];
}

export function createEmptyRuleGroup(fields = RULE_FIELD_DEFINITIONS): RuleGroupUI {
  const first = fields[0] ?? RULE_FIELD_DEFINITIONS[0];
  return {
    combinator: "and",
    conditions: [createEmptyCondition(first)],
  };
}

export function createEmptyCondition(field: RuleFieldDefinition): RuleConditionUI {
  return {
    id: createRuleConditionId(),
    fieldKey: field.key,
    operator: field.operators[0] ?? "=",
    value: field.options?.[0]?.value ?? "",
  };
}

export function createRuleConditionId() {
  return `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function validateRuleGroup(
  group: RuleGroupUI,
  fields = RULE_FIELD_DEFINITIONS,
): RuleValidationResult {
  if (group.conditions.length === 0) {
    return { ok: false, error: "Agregá al menos una condición." };
  }
  for (const condition of group.conditions) {
    const field = fields.find((item) => item.key === condition.fieldKey);
    if (!field) return { ok: false, error: "Hay una condición con un campo no disponible." };
    if (!field.operators.includes(condition.operator)) {
      return { ok: false, error: `El operador no es válido para ${field.label}.` };
    }
    if (condition.value.trim() === "") {
      return { ok: false, error: `Completá el valor de ${field.label}.` };
    }
    if (field.valueKind === "number" && !Number.isFinite(Number(condition.value))) {
      return { ok: false, error: `${field.label} debe ser un número.` };
    }
  }
  return { ok: true };
}

export function ruleGroupToJsonLogic(
  group: RuleGroupUI,
  fields = RULE_FIELD_DEFINITIONS,
): Record<string, unknown> | null {
  const rules = group.conditions.map((condition) => conditionToJsonLogic(condition, fields));
  if (rules.length === 0) return null;
  if (rules.length === 1) return rules[0];
  return { [group.combinator]: rules };
}

export function jsonLogicToRuleGroup(
  rule: unknown,
  fields = RULE_FIELD_DEFINITIONS,
): RuleParseResult {
  if (!isPlainObject(rule) || Object.keys(rule).length === 0) {
    return { supported: true, group: createEmptyRuleGroup(fields) };
  }

  const keys = Object.keys(rule);
  if (keys.length !== 1) {
    return { supported: false, reason: "La regla tiene más de un operador raíz." };
  }

  const [rootOperator] = keys;
  if (rootOperator === "and" || rootOperator === "or") {
    const rawConditions = rule[rootOperator];
    if (!Array.isArray(rawConditions) || rawConditions.length === 0) {
      return { supported: false, reason: "La regla compuesta no tiene condiciones." };
    }
    const conditions: RuleConditionUI[] = [];
    for (const rawCondition of rawConditions) {
      const parsed = jsonLogicConditionToUI(rawCondition, fields);
      if (!parsed) return { supported: false, reason: "La regla usa una condición avanzada." };
      conditions.push(parsed);
    }
    return { supported: true, group: { combinator: rootOperator, conditions } };
  }

  const condition = jsonLogicConditionToUI(rule, fields);
  if (!condition) return { supported: false, reason: "La regla usa un operador avanzado." };
  return { supported: true, group: { combinator: "and", conditions: [condition] } };
}

export function summarizeRuleGroup(
  group: RuleGroupUI,
  fields = RULE_FIELD_DEFINITIONS,
) {
  if (group.conditions.length === 0) return "Sin condiciones configuradas.";
  const joiner = group.combinator === "and" ? " y " : " o ";
  return group.conditions
    .map((condition) => summarizeCondition(condition, fields))
    .join(joiner);
}

export function summarizeCondition(
  condition: RuleConditionUI,
  fields = RULE_FIELD_DEFINITIONS,
) {
  const field = fields.find((item) => item.key === condition.fieldKey);
  if (!field) return "condición no disponible";
  const operator = operatorLabel(condition.operator, field.kind).toLocaleLowerCase("es-AR");
  const rawValue = condition.value.trim();
  const value =
    field.options?.find((option) => option.value === rawValue)?.label ?? rawValue;
  return `${field.label} ${operator} ${value}`;
}

export function operatorLabel(operator: RuleOperator, kind: RuleFieldKind) {
  if (kind === "select") {
    if (operator === "=") return "Es";
    if (operator === "!=") return "No es";
  }
  switch (operator) {
    case "=":
      return "Es igual a";
    case "!=":
      return "No es igual a";
    case ">":
      return "Es mayor que";
    case ">=":
      return "Es mayor o igual que";
    case "<":
      return "Es menor que";
    case "<=":
      return "Es menor o igual que";
  }
}

function conditionToJsonLogic(
  condition: RuleConditionUI,
  fields: RuleFieldDefinition[],
): Record<string, unknown> {
  const field = fields.find((item) => item.key === condition.fieldKey);
  const trimmedValue = condition.value.trim();
  const value =
    trimmedValue === ""
      ? null
      : field?.valueKind === "number"
        ? Number(trimmedValue)
        : trimmedValue;
  const jsonOperator = condition.operator === "=" ? "==" : condition.operator;
  return { [jsonOperator]: [{ var: condition.fieldKey }, value] };
}

function jsonLogicConditionToUI(
  raw: unknown,
  fields: RuleFieldDefinition[],
): RuleConditionUI | null {
  if (!isPlainObject(raw)) return null;
  const keys = Object.keys(raw);
  if (keys.length !== 1) return null;
  const [rawOperator] = keys;
  const operator = rawOperator === "==" ? "=" : rawOperator;
  if (!isRuleOperator(operator)) return null;
  const operands = raw[rawOperator];
  if (!Array.isArray(operands) || operands.length !== 2) return null;
  const variable = operands[0];
  if (!isPlainObject(variable) || typeof variable.var !== "string") return null;
  const field = fields.find((item) => item.key === variable.var);
  if (!field || !field.operators.includes(operator)) return null;
  const rawValue = operands[1];
  if (rawValue === null) {
    return {
      id: createRuleConditionId(),
      fieldKey: field.key,
      operator,
      value: "",
    };
  }
  if (field.valueKind === "number" && typeof rawValue !== "number") return null;
  if (field.valueKind === "string" && typeof rawValue !== "string") return null;
  return {
    id: createRuleConditionId(),
    fieldKey: field.key,
    operator,
    value: String(rawValue),
  };
}

function isRuleOperator(value: string): value is RuleOperator {
  return ["=", "!=", ">", ">=", "<", "<="].includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
