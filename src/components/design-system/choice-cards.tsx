"use client";

import type { ReactNode } from "react";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Check } from "lucide-react";
import styles from "./choice-cards.module.css";

export type ChoiceCardOption = {
  value: string;
  label: string;
  accessibleLabel?: string;
  illustration?: ReactNode;
  description?: ReactNode;
  annotation?: ReactNode;
};

/** Selección única por ID, compartida por los selectores visuales de materiales. */
export function ChoiceCards({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly ChoiceCardOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      isDetached
      className={styles.grid}
      selectedKeys={new Set(options.some((o) => o.value === value) ? [value] : [])}
      onSelectionChange={(keys) => {
        const key = [...keys][0];
        if (typeof key === "string" && key !== value && options.some((o) => o.value === key)) onChange(key);
      }}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          id={option.value}
          aria-label={option.accessibleLabel ?? option.label}
          className={styles.card}
        >
          <span className={styles.top} aria-hidden="true">
            <span className={styles.illustration}>{option.illustration}</span>
            <span className={styles.indicator}><Check size={11} strokeWidth={3} /></span>
          </span>
          <span className={styles.title}>{option.label}</span>
          {option.description ? <span className={styles.description}>{option.description}</span> : null}
          {option.annotation ? <span className={styles.annotation}>{option.annotation}</span> : null}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
