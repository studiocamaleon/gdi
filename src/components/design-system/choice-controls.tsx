"use client";

import type { AriaAttributes, ReactNode } from "react";
import { ToggleButton, ToggleButtonGroup, Tooltip } from "@heroui/react";
import { useDesignScope, useDesignTheme } from "./appearance";
import styles from "./choice-controls.module.css";

type ChoiceProps = Pick<
  AriaAttributes,
  "aria-label" | "aria-labelledby" | "aria-describedby" | "aria-invalid"
> & {
  options: readonly { value: string; label: string; icon: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
};

/** G4: selección única con segmento activo en degradado. */
export function SegmentedControl({
  options,
  value,
  onChange,
  tone = "default",
  ...props
}: ChoiceProps & { tone?: "default" | "graphite" }) {
  return (
    <ToggleButtonGroup
      {...props}
      selectionMode="single"
      disallowEmptySelection
      size="sm"
      className={styles.segmented}
      data-tone={tone}
      selectedKeys={new Set([value])}
      onSelectionChange={(keys) => {
        const key = [...keys][0];
        if (
          typeof key === "string" &&
          options.some((option) => option.value === key)
        )
          onChange(key);
      }}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          id={option.value}
          className={styles.choice}
        >
          {option.icon}
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/** C2: opciones con icono, contorno y nombres accesibles también en portales. */
export function IconChoiceGroup({
  options,
  value,
  onChange,
  ...props
}: ChoiceProps) {
  const scope = useDesignScope();
  const themeClass = useDesignTheme();
  return (
    <ToggleButtonGroup
      {...props}
      selectionMode="single"
      disallowEmptySelection
      isDetached
      size="sm"
      className={styles.icons}
      selectedKeys={
        new Set(options.some((option) => option.value === value) ? [value] : [])
      }
      onSelectionChange={(keys) => {
        const key = [...keys][0];
        if (
          typeof key === "string" &&
          options.some((option) => option.value === key)
        )
          onChange(key);
      }}
    >
      {options.map((option) => (
        <Tooltip key={option.value} delay={350}>
          <ToggleButton
            id={option.value}
            aria-label={option.label}
            className={styles.choice}
          >
            {option.icon}
          </ToggleButton>
          <Tooltip.Content {...scope} className={themeClass}>
            {option.label}
          </Tooltip.Content>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}
