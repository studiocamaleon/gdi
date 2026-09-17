"use client";
import { Autocomplete, SearchField, ListBox } from "@heroui/react";
import { useDesignScope, useDesignTheme } from "@/components/design-system/appearance";
import focus from "@/components/design-system/field-focus.module.css";
export type OpcionAsignacion = {
  value: string;
  label: string;
  detalle?: string | null;
  grupo?: string | null;
  disabled?: boolean;
};
/** Selector buscable de recursos: conserva bloqueos y avisos de asignación. */
export function EstacionAsignacionSelect({
  opciones,
  onChange,
  placeholder,
  placeholderBusqueda,
  vacio,
  ariaLabel,
  className,
  isDisabled = false,
}: {
  opciones: OpcionAsignacion[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  placeholderBusqueda: string;
  vacio: string;
  ariaLabel: string;
  className?: string;
  isDisabled?: boolean;
}) {
  const scope = useDesignScope();
  const themeClass = useDesignTheme();
  return (
    <Autocomplete
      aria-label={ariaLabel}
      isDisabled={isDisabled}
      value={null}
      onChange={(id) => {
        if (id != null) onChange(String(id));
      }}
      placeholder={placeholder}
      allowsEmptyCollection
      fullWidth
      className={className}
      disabledKeys={opciones.filter((o) => o.disabled).map((o) => o.value)}
    >
      <Autocomplete.Trigger
        aria-label={ariaLabel}
        className={`${focus.singleBorder} [&>button]:absolute [&>button]:inset-0 [&>button]:rounded-field`}
      >
        <Autocomplete.Value />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover {...scope} className={themeClass}>
        <Autocomplete.Filter>
          <SearchField aria-label={placeholderBusqueda} className="px-2 pt-2">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={placeholderBusqueda} />
            </SearchField.Group>
          </SearchField>
          <ListBox
            items={opciones}
            renderEmptyState={() => (
              <p className="px-3 py-4 text-xs">{vacio}</p>
            )}
          >
            {(o) => (
              <ListBox.Item
                id={o.value}
                textValue={`${o.label} ${o.grupo ?? ""}`}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span>{o.label}</span>
                  {(o.detalle || o.grupo) && (
                    <small className="text-muted-foreground">
                      {[o.grupo, o.detalle].filter(Boolean).join(" · ")}
                    </small>
                  )}
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
