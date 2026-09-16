"use client";

import { ListBox, Select } from "@heroui/react";
import { useDesignScope, useDesignTheme } from "@/components/design-system/appearance";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./materiales.module.css";

/** Selector visual para los atributos que admiten varias máquinas o plantillas. */
export function MaterialMultiSelect({
  label,
  placeholder,
  options,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const themeClass = useDesignTheme();
  const scope = useDesignScope();
  return (
    <Select
      aria-label={label}
      selectionMode="multiple"
      value={values}
      onChange={(keys) => onChange(keys.map(String))}
      placeholder={placeholder}
      fullWidth
      className={styles.multiSelect}
    >
      <Select.Trigger className={focus.singleBorder}>
        <Select.Value>
          {values.length
            ? `${values.length} seleccionada${values.length > 1 ? "s" : ""}`
            : placeholder}
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover
        {...scope}
        className={`${themeClass} ${styles.multiPopover}`}
      >
        <ListBox>
          {options.map((option) => (
            <ListBox.Item
              key={option.value}
              id={option.value}
              textValue={option.label}
            >
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
