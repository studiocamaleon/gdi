"use client";

import { useMemo } from "react";
import { Autocomplete, SearchField, ListBox } from "@heroui/react";
import type { ClienteDetalle } from "@/lib/clientes";
import theme from "@/components/design-system/theme.module.css";
import fieldFocus from "@/components/design-system/field-focus.module.css";
import { useDesignScope } from "@/components/design-system/appearance";

type ClienteOpcion = Pick<
  ClienteDetalle,
  "id" | "nombre" | "razonSocial" | "email"
> &
  Partial<Pick<ClienteDetalle, "contacto">>;

/** Vista accesible reutilizable; no conoce APIs ni permisos comerciales. */
export function ClienteLista({
  value,
  onChange,
  options,
  loading,
  error,
  onInputChange,
  onOpenChange,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ClienteOpcion[];
  loading?: boolean;
  error?: string | null;
  onInputChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const scope = useDesignScope();
  const searchText = useMemo(() => {
    const byName = new Map<string, string>();
    for (const option of options) {
      byName.set(
        option.nombre,
        [
          byName.get(option.nombre),
          option.nombre,
          option.razonSocial,
          option.email,
          option.contacto,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase(),
      );
    }
    return byName;
  }, [options]);
  return (
    <Autocomplete<ClienteOpcion>
      aria-label="Cliente"
      value={value || null}
      onChange={(key) => {
        if (key !== null && String(key) !== value) onChange(String(key));
      }}
      onOpenChange={(open) => {
        onOpenChange?.(open);
        if (open) onInputChange?.("");
      }}
      placeholder="Seleccionar cliente"
      allowsEmptyCollection
      fullWidth
    >
      <Autocomplete.Trigger
        aria-label="Seleccionar cliente"
        className={`${fieldFocus.singleBorder} [&>button]:absolute [&>button]:inset-0 [&>button]:rounded-field`}
      >
        <Autocomplete.Value>
          {({ isPlaceholder, defaultChildren, selectedText }) =>
            isPlaceholder ? defaultChildren : selectedText
          }
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover {...scope} className={theme.theme}>
        <Autocomplete.Filter
          onInputChange={onInputChange}
          filter={(text, query) =>
            (searchText.get(text) ?? text.toLocaleLowerCase()).includes(
              query.trim().toLocaleLowerCase(),
            )
          }
        >
          <SearchField aria-label="Buscar cliente" className="px-2 pt-2">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar cliente…" />
            </SearchField.Group>
          </SearchField>
          <ListBox<ClienteOpcion>
            items={options}
            renderEmptyState={() => (
              <p className="px-3 py-5 text-sm text-muted-foreground">
                {loading
                  ? "Buscando clientes…"
                  : "Sin clientes para esta búsqueda."}
              </p>
            )}
          >
            {(cliente) => (
              <ListBox.Item id={cliente.id} textValue={cliente.nombre}>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-medium">
                    {cliente.nombre}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[cliente.razonSocial, cliente.email]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos adicionales"}
                  </span>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </ListBox>
        </Autocomplete.Filter>
        <p
          role="status"
          className={`border-t border-border px-3 py-2 text-xs ${error ? "text-danger" : "text-muted-foreground"}`}
        >
          {error ||
            (loading
              ? "Buscando clientes…"
              : `${options.length} ${options.length === 1 ? "cliente cargado" : "clientes cargados"}`)}
        </p>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
