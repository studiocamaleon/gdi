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
        className={cn("h-9 w-full py-1.5", triggerClassName)}
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
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium">{option.label}</span>
        {option.badge && (
          <span className="rounded border bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
            {option.badge}
          </span>
        )}
      </span>
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
        <span className="flex min-w-0 flex-wrap gap-1 pt-0.5">
          {option.details.map((detail) => (
            <span
              key={`${detail.label}:${detail.value}`}
              className="rounded border bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground"
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
