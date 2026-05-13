"use client";

import * as React from "react";
import { AlertCircleIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HumanSelect, type HumanSelectOption } from "@/components/ui/human-select";
import { Input } from "@/components/ui/input";
import {
  createEmptyCondition,
  createEmptyRuleGroup,
  getRuleFields,
  jsonLogicToRuleGroup,
  operatorLabel,
  ruleGroupToJsonLogic,
  summarizeRuleGroup,
  type RuleConditionUI,
  type RuleGroupUI,
} from "@/lib/rule-builder";

interface RuleBuilderProps {
  value: Record<string, unknown> | null | undefined;
  includeMeasureFields?: boolean;
  onChange: (value: Record<string, unknown> | null) => void;
}

const COMBINATOR_OPTIONS: HumanSelectOption[] = [
  {
    value: "and",
    label: "Todas",
    description: "El paso se ejecuta sólo si todas las condiciones se cumplen.",
  },
  {
    value: "or",
    label: "Cualquiera",
    description: "El paso se ejecuta si al menos una condición se cumple.",
  },
];

export function RuleBuilder({
  value,
  includeMeasureFields,
  onChange,
}: RuleBuilderProps) {
  const fields = React.useMemo(
    () => getRuleFields({ includeMeasureFields }),
    [includeMeasureFields],
  );
  const parsed = React.useMemo(() => jsonLogicToRuleGroup(value, fields), [fields, value]);

  if (!parsed.supported) {
    return (
      <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <div className="font-medium">
              Esta regla es avanzada y no se puede editar visualmente todavía.
            </div>
            <div className="text-xs text-amber-800">
              Se va a preservar al guardar mientras no la reemplaces.
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
          onClick={() => onChange(ruleGroupToJsonLogic(createEmptyRuleGroup(fields), fields))}
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
        const nextField = fields.find((field) => field.key === patch.fieldKey);
        if (nextField) {
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
      conditions: conditions.length > 0 ? conditions : [createEmptyCondition(fields[0])],
    });
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-medium">Regla de activación</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Ejecutar si se cumple:</span>
          <HumanSelect
            value={group.combinator}
            onValueChange={(next) =>
              updateGroup({ ...group, combinator: next === "or" ? "or" : "and" })
            }
            options={COMBINATOR_OPTIONS}
            triggerClassName="h-8 w-32 text-xs"
            contentClassName="min-w-48"
          />
        </div>
      </div>

      <div className="space-y-2">
        {group.conditions.map((condition, idx) => {
          const field = fields.find((item) => item.key === condition.fieldKey) ?? fields[0];
          const fieldOptions = fields.map<HumanSelectOption>((item) => ({
            value: item.key,
            label: item.label,
            description: item.key,
          }));
          const operatorOptions = field.operators.map<HumanSelectOption>((operator) => ({
            value: operator,
            label: operatorLabel(operator, field.kind),
            code: operator,
          }));
          return (
            <div
              key={condition.id}
              className="grid grid-cols-1 gap-2 rounded border bg-background p-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_2rem]"
            >
              <HumanSelect
                value={condition.fieldKey}
                onValueChange={(next) => updateCondition(idx, { fieldKey: next })}
                options={fieldOptions}
                triggerClassName="h-8 text-xs"
                contentClassName="min-w-60"
              />
              <HumanSelect
                value={condition.operator}
                onValueChange={(next) =>
                  updateCondition(idx, { operator: next as RuleConditionUI["operator"] })
                }
                options={operatorOptions}
                triggerClassName="h-8 text-xs"
                contentClassName="min-w-56"
              />
              {field.options ? (
                <HumanSelect
                  value={condition.value}
                  onValueChange={(next) => updateCondition(idx, { value: next })}
                  options={field.options.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  triggerClassName="h-8 text-xs"
                  contentClassName="min-w-48"
                />
              ) : (
                <Input
                  type="number"
                  step="any"
                  value={condition.value}
                  onChange={(event) => updateCondition(idx, { value: event.target.value })}
                  placeholder="Valor"
                  className="h-8 text-xs"
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeCondition(idx)}
                title="Quitar condición"
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-fit text-xs"
          onClick={addCondition}
        >
          <PlusIcon className="mr-1 size-3" />
          Agregar condición
        </Button>
        <Badge variant="outline" className="w-fit justify-start whitespace-normal text-left">
          {summarizeRuleGroup(group, fields)}
        </Badge>
      </div>
    </div>
  );
}
