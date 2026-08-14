"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import type { DiccionarioLabels } from "@/lib/labels-humanos";
import { getLabel } from "@/lib/labels-humanos";
import { cn } from "@/lib/utils";

export interface HumanSelectOption {
  value: string;
  label: string;
  code?: string | null;
  description?: string | null;
  details?: Array<{ label: string; value: string }>;
  disabled?: boolean;
  badge?: string | null;
  group?: string | null;
  /** No repetir el `label` dentro del ítem cuando ya lo dicen los `details`
   *  (los tags). El trigger sí lo usa. */
  hideLabelInItem?: boolean;
}

interface HumanSelectProps {
  value?: string | null;
  onValueChange: (value: string) => void;
  options: HumanSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  triggerClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
  includeSelectedFallback?: boolean;
}

export function optionFromLabel(
  value: string,
  dict: DiccionarioLabels,
  overrides: Partial<Omit<HumanSelectOption, "value">> = {},
): HumanSelectOption {
  const label = getLabel(dict, value);
  return {
    value,
    label: label.label,
    code: value,
    description: label.descripcion,
    ...overrides,
  };
}

export function optionsFromLabels(values: readonly string[], dict: DiccionarioLabels) {
  return values.map((value) => optionFromLabel(value, dict));
}

export function unknownHumanOption(value: string): HumanSelectOption {
  return {
    value,
    label: "Valor no disponible",
    code: value,
    description: "El valor guardado ya no está disponible en este catálogo.",
    badge: "guardado",
  };
}

export function ensureSelectedOption(
  options: HumanSelectOption[],
  value?: string | null,
  fallback?: HumanSelectOption,
) {
  if (!value || options.some((option) => option.value === value)) return options;
  return [...options, fallback ?? unknownHumanOption(value)];
}

export function HumanSelect({
  value,
  onValueChange,
  options,
  placeholder = "Elegir",
  disabled,
  id,
  triggerClassName,
  contentClassName,
  itemClassName,
  includeSelectedFallback = true,
}: HumanSelectProps) {
  const normalizedValue = value ?? "";
  const normalizedOptions = React.useMemo(
    () =>
      includeSelectedFallback
        ? ensureSelectedOption(options, normalizedValue)
        : options,
    [includeSelectedFallback, normalizedValue, options],
  );
  const selected = normalizedOptions.find((option) => option.value === normalizedValue);
  const groupedOptions = React.useMemo(() => groupOptions(normalizedOptions), [normalizedOptions]);

  // Cuando el valor elegido se pinta como chips (variantes de material), el
  // trigger deja de ser una sola línea fija: afloja el line-clamp, el alto y
  // el nowrap para que los chips envuelvan como las "opciones" del inventario.
  const triggerConChips =
    !!selected?.hideLabelInItem &&
    !!selected?.details &&
    selected.details.length > 0;

  return (
    <Select
      value={normalizedValue}
      onValueChange={(next) => {
        if (typeof next === "string") onValueChange(next);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={cn(
          "w-full py-1.5",
          // Con chips el trigger deja de ser una línea fija: sin `h-9` que
          // compita, alto automático (anulando también la variante de tamaño
          // `data-[size]:h-8`) y el select-value envuelve en vez de recortar.
          triggerConChips
            ? "h-auto min-h-9 items-start py-2 whitespace-normal data-[size=default]:h-auto *:data-[slot=select-value]:flex-wrap *:data-[slot=select-value]:items-start *:data-[slot=select-value]:line-clamp-none"
            : "h-9",
          triggerClassName,
        )}
      >
        <HumanSelectTriggerValue option={selected} placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={cn("min-w-64", contentClassName)}>
        {groupedOptions.map((group) => (
          <SelectGroup key={group.key}>
            {group.label && <SelectLabel>{group.label}</SelectLabel>}
            {group.options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                title={option.description ?? option.code ?? option.label}
                className={cn("py-2", itemClassName)}
              >
                <HumanSelectItem option={option} />
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

function HumanSelectTriggerValue({
  option,
  placeholder,
}: {
  option?: HumanSelectOption;
  placeholder: string;
}) {
  if (!option) {
    return (
      <span
        data-slot="select-value"
        className="text-muted-foreground flex min-w-0 flex-1 text-left"
      >
        {placeholder}
      </span>
    );
  }

  // Variantes de material: el ítem del dropdown esconde el label crudo y pinta
  // los atributos como chips ("Ancho: …", "Acabado: …") — como las "opciones"
  // de un material en Inventario. El trigger hace lo mismo: los MISMOS chips,
  // envueltos, en vez del nombre plano. (El trigger deja crecer su alto: ver
  // HumanSelect, que afloja line-clamp/alto cuando hay chips.)
  if (option.hideLabelInItem && option.details && option.details.length > 0) {
    return (
      <span
        data-slot="select-value"
        className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left"
      >
        {option.details.map((detail) => (
          <span
            key={`${detail.label}:${detail.value}`}
            className="shrink-0 rounded border bg-muted px-2 py-1 text-[11.5px] leading-none text-muted-foreground"
          >
            <span className="font-medium text-foreground">{detail.label}:</span>{" "}
            {detail.value}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span
      data-slot="select-value"
      className="flex min-w-0 flex-1 items-center justify-center text-center leading-tight"
    >
      <span className="flex max-w-full items-center justify-center gap-1.5">
        <span className="truncate font-medium">{option.label}</span>
        {option.badge && (
          <span className="rounded border bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
            {option.badge}
          </span>
        )}
      </span>
    </span>
  );
}

function HumanSelectItem({ option }: { option: HumanSelectOption }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
      {option.hideLabelInItem && option.details && option.details.length > 0 ? null : (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{option.label}</span>
          {option.badge && (
            <span className="rounded border bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
              {option.badge}
            </span>
          )}
        </span>
      )}
      {option.code && (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-mono text-[10px] text-muted-foreground">
            {option.code}
          </span>
        </span>
      )}
      {option.description && (
        <span className="truncate text-[10px] text-muted-foreground">
          {option.description}
        </span>
      )}
      {option.details && option.details.length > 0 && (
        <span className="flex min-w-0 flex-wrap gap-1.5 pt-0.5">
          {option.details.map((detail) => (
            <span
              key={`${detail.label}:${detail.value}`}
              className="rounded border bg-muted px-2 py-1 text-[11.5px] leading-none text-muted-foreground"
            >
              <span className="font-medium text-foreground">{detail.label}:</span>{" "}
              {detail.value}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

function groupOptions(options: HumanSelectOption[]) {
  const groups: Array<{ key: string; label: string | null; options: HumanSelectOption[] }> = [];
  for (const option of options) {
    const key = option.group ?? "__ungrouped";
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, label: option.group ?? null, options: [] };
      groups.push(group);
    }
    group.options.push(option);
  }
  return groups;
}
