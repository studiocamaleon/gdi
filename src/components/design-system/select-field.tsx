"use client";

import { useState } from "react";
import { Select, ListBox } from "@heroui/react";
import { useDesignScope } from "./appearance";
import theme from "./theme.module.css";
import focus from "./field-focus.module.css";
import styles from "./select-field.module.css";

type Option = { value: string; label: string; disabled?: boolean };

/** Selector de una opción. Conserva valores vacíos y FormData sin exponer claves de UI. */
export function SelectField({
  options,
  value,
  defaultValue,
  onChange,
  name,
  id,
  required,
  disabled,
  className,
  "aria-label": label,
}: {
  options: readonly Option[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label": string;
}) {
  const scope = useDesignScope();
  const [localValue, setLocalValue] = useState(
    defaultValue ?? options[0]?.value ?? "",
  );
  const selected = value ?? localValue;
  const emptyOption = options.find((option) => option.value === "");
  return (
    <>
      <Select
        aria-label={label}
        value={required && !selected ? null : `option:${selected}`}
        onChange={(key) => {
          const next = key == null ? "" : String(key).slice("option:".length);
          if (value === undefined) setLocalValue(next);
          onChange?.(next);
        }}
        placeholder={emptyOption?.label ?? "Seleccionar…"}
        isRequired={required}
        isDisabled={disabled}
        disabledKeys={options
          .filter((item) => item.disabled)
          .map((item) => `option:${item.value}`)}
        validationBehavior="native"
        className={[styles.root, className].filter(Boolean).join(" ")}
        fullWidth
      >
        <Select.Trigger id={id} className={focus.singleBorder}>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover {...scope} className={theme.theme}>
          <ListBox>
            {options.map((option) => (
              <ListBox.Item
                key={option.value}
                id={`option:${option.value}`}
                textValue={option.label}
              >
                {option.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      {name && (
        <input type="hidden" name={name} value={selected} disabled={disabled} />
      )}
    </>
  );
}
