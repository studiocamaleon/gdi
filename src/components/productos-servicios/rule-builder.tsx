"use client";

import * as React from "react";
import { AlertCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HumanSelect, type HumanSelectOption } from "@/components/ui/human-select";
import {
  createEmptyCondition,
  createEmptyRuleGroup,
  findRuleField,
  getRuleFields,
  jsonLogicToRuleGroup,
  operatorLabel,
  ruleGroupToJsonLogic,
  rulePasoDeFieldKey,
  type RuleConditionUI,
  type RuleFieldDefinition,
  type RuleGroupUI,
} from "@/lib/rule-builder";

interface RuleBuilderProps {
  value: Record<string, unknown> | null | undefined;
  includeMeasureFields?: boolean;
  extraFields?: RuleFieldDefinition[];
  onChange: (value: Record<string, unknown> | null) => void;
}

/**
 * Constructor visual de la regla de activación, con la forma del diseño de
 * referencia (pasos/Cuándo se ejecuta.html): una fila por condición —campo ·
 * operador · valor con su unidad · quitar—, un conector Y/O entre filas, y el
 * "Agregar condición" punteado. El valor vacío tiñe su caja de ámbar, que es
 * el aviso de que la condición todavía no cierra.
 *
 * La lógica (parseo desde/hacia jsonLogic, campos disponibles, operadores) vive
 * en `@/lib/rule-builder` — acá queda sólo el render.
 */
const CAJA: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 34,
  border: "1px solid var(--hairline, #e5e2db)",
  borderRadius: 7,
  background: "var(--surface, #fff)",
  padding: "0 9px",
  gap: 6,
  minWidth: 0,
};

const CAJA_VACIA: React.CSSProperties = {
  ...CAJA,
  borderColor: "#dcbc6a",
  background: "#fffdf6",
};

export function RuleBuilder({
  value,
  includeMeasureFields,
  extraFields,
  onChange,
}: RuleBuilderProps) {
  const fields = React.useMemo(
    () => getRuleFields({ includeMeasureFields, extraFields }),
    [extraFields, includeMeasureFields],
  );
  const parsed = React.useMemo(
    () => jsonLogicToRuleGroup(value, fields),
    [fields, value],
  );

  if (!parsed.supported) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          border: "1px solid #e8d7a6",
          background: "#fdf7e6",
          borderRadius: 8,
          padding: 12,
          color: "#7a5a10",
          fontSize: 12.5,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertCircleIcon
            className="size-4"
            style={{ marginTop: 1, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontWeight: 500 }}>
              Esta regla es avanzada y no se puede editar visualmente todavía.
            </div>
            <div style={{ fontSize: 11.5, marginTop: 2 }}>
              Se va a preservar al guardar mientras no la reemplaces.
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-fit border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
          onClick={() =>
            onChange(ruleGroupToJsonLogic(createEmptyRuleGroup(fields), fields))
          }
        >
          Crear regla visual nueva
        </Button>
      </div>
    );
  }

  const group = parsed.group;

  const updateGroup = (next: RuleGroupUI) => {
    onChange(ruleGroupToJsonLogic(next, fields));
  };

  const updateCondition = (idx: number, patch: Partial<RuleConditionUI>) => {
    const conditions = group.conditions.map((condition, itemIdx) => {
      if (itemIdx !== idx) return condition;
      const next = { ...condition, ...patch };
      if (patch.fieldKey && patch.fieldKey !== condition.fieldKey) {
        const prevField = findRuleField(fields, condition.fieldKey);
        const nextField = findRuleField(fields, patch.fieldKey);
        // Cambiar SOLO el paso de la misma variable conserva operador y
        // valor; cambiar de variable resetea ambos.
        if (nextField && nextField !== prevField) {
          next.operator = nextField.operators[0] ?? "=";
          next.value = nextField.options?.[0]?.value ?? "";
        }
      }
      return next;
    });
    updateGroup({ ...group, conditions });
  };

  const addCondition = () => {
    const field = fields[0];
    if (!field) return;
    updateGroup({
      ...group,
      conditions: [...group.conditions, createEmptyCondition(field)],
    });
  };

  const removeCondition = (idx: number) => {
    const conditions = group.conditions.filter((_, itemIdx) => itemIdx !== idx);
    updateGroup({
      ...group,
      conditions:
        conditions.length > 0 ? conditions : [createEmptyCondition(fields[0])],
    });
  };

  const fieldOptions: HumanSelectOption[] = fields.map((item) => ({
    value: item.key,
    label: item.label,
    description: item.key,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {group.conditions.map((condition, idx) => {
        const field = findRuleField(fields, condition.fieldKey) ?? fields[0];
        const pasoActual = rulePasoDeFieldKey(field, condition.fieldKey);
        const operatorOptions: HumanSelectOption[] = field.operators.map(
          (operator) => ({
            value: operator,
            label: operatorLabel(operator, field.kind),
            code: operator,
          }),
        );
        const vacia = condition.value.trim() === "" && !field.options;
        return (
          <React.Fragment key={condition.id}>
            {/* Conector Y/O: uno solo para todo el grupo, en la línea que
                separa cada condición de la anterior. */}
            {idx > 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  margin: "7px 0",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    background: "var(--surface-2, #f3f1ec)",
                    border: "1px solid var(--hairline, #e5e2db)",
                    borderRadius: 6,
                    padding: 2,
                    gap: 2,
                  }}
                >
                  {(["and", "or"] as const).map((c) => {
                    const activo = group.combinator === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateGroup({ ...group, combinator: c })}
                        style={{
                          border: 0,
                          background: activo
                            ? "var(--fg, #14141a)"
                            : "transparent",
                          color: activo ? "#fff" : "var(--muted-text, #6e6e76)",
                          padding: "2.5px 10px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: "0.02em",
                          cursor: "pointer",
                        }}
                      >
                        {c === "and" ? "Y" : "O"}
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "var(--hairline, #eeebe4)",
                  }}
                />
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: field.pasos
                  ? "1fr 1fr 1fr 1.15fr 30px"
                  : "1fr 1fr 1.15fr 30px",
                gap: 8,
                alignItems: "center",
              }}
            >
              <HumanSelect
                value={field.key}
                onValueChange={(nextKey) => {
                  const nextField = fields.find(
                    (item) => item.key === nextKey,
                  );
                  if (!nextField) return;
                  // Variable por paso: conserva el paso elegido si la nueva
                  // variable también lo tiene; si no, el primero.
                  const fieldKey = nextField.pasos?.length
                    ? nextField.key +
                      (pasoActual &&
                      nextField.pasos.some(
                        (p) => p.value === pasoActual.value,
                      )
                        ? pasoActual.value
                        : nextField.pasos[0].value)
                    : nextField.key;
                  updateCondition(idx, { fieldKey });
                }}
                options={fieldOptions}
                triggerClassName="h-[34px] text-[13px]"
                contentClassName="min-w-60"
              />
              {field.pasos ? (
                <HumanSelect
                  value={pasoActual?.value ?? field.pasos[0]?.value ?? ""}
                  onValueChange={(pasoId) =>
                    updateCondition(idx, { fieldKey: field.key + pasoId })
                  }
                  options={field.pasos.map((paso) => ({
                    value: paso.value,
                    label: paso.label,
                  }))}
                  triggerClassName="h-[34px] text-[13px]"
                  contentClassName="min-w-60"
                />
              ) : null}
              <HumanSelect
                value={condition.operator}
                onValueChange={(next) =>
                  updateCondition(idx, {
                    operator: next as RuleConditionUI["operator"],
                  })
                }
                options={operatorOptions}
                triggerClassName="h-[34px] text-[13px]"
                contentClassName="min-w-56"
              />
              {field.options ? (
                <HumanSelect
                  value={condition.value}
                  onValueChange={(next) =>
                    updateCondition(idx, { value: next })
                  }
                  options={field.options.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  triggerClassName="h-[34px] text-[13px]"
                  contentClassName="min-w-48"
                />
              ) : (
                <div style={vacia ? CAJA_VACIA : CAJA}>
                  <input
                    inputMode="decimal"
                    value={condition.value}
                    onChange={(event) =>
                      updateCondition(idx, { value: event.target.value })
                    }
                    placeholder="—"
                    style={{
                      border: 0,
                      outline: 0,
                      background: "transparent",
                      width: "100%",
                      minWidth: 0,
                      fontSize: 13,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  />
                  {field.unidad ? (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--muted-text-2, #92929b)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {field.unidad}
                    </span>
                  ) : null}
                </div>
              )}
              <button
                type="button"
                title="Quitar condición"
                disabled={group.conditions.length < 2}
                onClick={() => removeCondition(idx)}
                style={{
                  width: 30,
                  height: 30,
                  display: "grid",
                  placeItems: "center",
                  border: 0,
                  background: "transparent",
                  borderRadius: 6,
                  color: "var(--muted-text-2, #92929b)",
                  cursor:
                    group.conditions.length < 2 ? "not-allowed" : "pointer",
                  opacity: group.conditions.length < 2 ? 0.3 : 1,
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                </svg>
              </button>
            </div>
          </React.Fragment>
        );
      })}

      <button
        type="button"
        onClick={addCondition}
        style={{
          marginTop: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 30,
          padding: "0 11px",
          width: "fit-content",
          background: "var(--surface, #fff)",
          border: "1px dashed var(--hairline-strong, #c8c4ba)",
          borderRadius: 7,
          fontSize: 12.5,
          fontWeight: 500,
          color: "var(--fg-2, #2c2c33)",
          cursor: "pointer",
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Agregar condición
      </button>
    </div>
  );
}
