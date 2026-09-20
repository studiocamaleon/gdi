"use client";

import { Autocomplete, ListBox, SearchField } from "@heroui/react";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./movimientos-kardex.module.css";

export function InventoryVariantPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (id: string) => void;
}) {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  return (
    <Autocomplete
      aria-label={label}
      value={value || null}
      onChange={(id) => onChange(id == null ? "" : String(id))}
      fullWidth
      allowsEmptyCollection
      placeholder="Seleccionar variante…"
    >
      <Autocomplete.Trigger
        className={`${focus.singleBorder} [&>button]:absolute [&>button]:inset-0 [&>button]:rounded-field`}
      >
        <Autocomplete.Value>
          {options.find((item) => item.id === value)?.label ??
            (value ? "Variante no disponible" : "Seleccionar variante…")}
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover
        {...scope}
        className={`${theme} ${styles.filterPopover}`}
      >
        <Autocomplete.Filter
          filter={(text, query) => {
            const normalize = (s: string) =>
              s
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .trim();
            return normalize(text).includes(normalize(query));
          }}
        >
          <SearchField
            aria-label={`Buscar en ${label}`}
            className={styles.filterSearch}
          >
            <SearchField.Group className={focus.singleBorder}>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar material o variante…" />
            </SearchField.Group>
          </SearchField>
          <ListBox
            items={options}
            renderEmptyState={() => (
              <p className={styles.noOptions}>Sin coincidencias.</p>
            )}
          >
            {(item) => (
              <ListBox.Item id={item.id} textValue={item.label}>
                <span className={styles.optionLabel}>{item.label}</span>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
