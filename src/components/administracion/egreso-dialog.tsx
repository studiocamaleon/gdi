"use client";

import * as React from "react";
import { Autocomplete, SearchField, ListBox } from "@heroui/react";
import { FormDialog } from "@/components/design-system/form-dialog";
import { ActionButton } from "@/components/design-system/action-button";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import {
  SelectBuscable as LegacySelect,
  filtrarOpciones,
} from "@/components/ui/select-buscable";
import { ConfirmacionSalida as LegacyConfirmacionSalida } from "@/components/ui/confirmacion-salida";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./cuentas-pagar.module.css";

export const EgresosBrand = React.createContext(false);
export const EgresosArea = React.createContext("Cuentas por pagar");
export const useEgresosBrand = () => React.useContext(EgresosBrand);

/** Sólo cambia la presentación; los borradores y envíos pertenecen a EgresosView. */
export function EgresoDialog({
  title,
  description,
  onCerrar,
  children,
  bloqueado = false,
  compact = false,
  legacySubtitle,
}: {
  title: React.ReactNode;
  description: string;
  onCerrar: () => void;
  children: React.ReactNode;
  bloqueado?: boolean;
  compact?: boolean;
  legacySubtitle?: string;
}) {
  const brand = useEgresosBrand();
  const area = React.useContext(EgresosArea);
  if (!brand)
    return (
      <div className="mod-bg" role="dialog" aria-modal="true">
        <div className={compact ? "mod mod-sm" : "mod"}>
          <div className="mod-head">
            <h2>
              {title}
              {legacySubtitle && (
                <span className="egr-sub mono">{legacySubtitle}</span>
              )}
            </h2>
            <button type="button" className="mod-x" onClick={onCerrar}>
              ×
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onCerrar();
      }}
      isDismissable={!bloqueado}
      title={
        <>
          <span className={styles.eyebrow}>Administración · {area}</span>
          {title}
          <span className={styles.dot}>.</span>
        </>
      }
      description={description}
      className={styles.dialog}
    >
      {children}
    </FormDialog>
  );
}

export function EgresoButton({
  className,
  disabled,
  ...props
}: Pick<
  React.ComponentProps<"button">,
  "children" | "type" | "className" | "disabled" | "aria-label" | "aria-pressed"
> & { onClick?: () => void }) {
  const brand = useEgresosBrand();
  if (!brand)
    return <button className={className} disabled={disabled} {...props} />;
  return (
    <ActionButton
      {...props}
      isDisabled={disabled}
      className={
        className?.includes("egr-ret-quitar")
          ? styles.removeRetention
          : undefined
      }
      variant={
        className?.includes("btn-primary")
          ? "primary"
          : className?.includes("btn-danger")
            ? "danger-soft"
            : "outline"
      }
    />
  );
}

export function EgresoSelect(props: React.ComponentProps<typeof LegacySelect>) {
  const brand = useEgresosBrand();
  return brand ? <EgresoBrandSelect {...props} /> : <LegacySelect {...props} />;
}

function EgresoBrandSelect({
  opciones,
  value,
  onChange,
  disabled,
  ariaLabel,
  placeholder = "Elegir…",
  placeholderBusqueda = "Buscar…",
  id,
  vacio = "No hay opciones que coincidan.",
  minimoParaBuscar = 7,
  onBuscar,
  className,
}: React.ComponentProps<typeof LegacySelect>) {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const [query, setQuery] = React.useState("");
  const conBusqueda = opciones.length >= minimoParaBuscar;
  const visibles = filtrarOpciones(opciones, conBusqueda ? query : "");
  const elegida = opciones.find((o) => o.value === value);
  return (
    <Autocomplete
      aria-label={ariaLabel ?? placeholder}
      value={elegida ? `option:${value}` : null}
      onChange={(key) => {
        if (key != null) onChange(String(key).slice(7));
      }}
      onOpenChange={() => {
        setQuery("");
        onBuscar?.("");
      }}
      isDisabled={disabled}
      placeholder={placeholder}
      fullWidth
      allowsEmptyCollection
      className={className}
      disabledKeys={opciones
        .filter((o) => o.disabled)
        .map((o) => `option:${o.value}`)}
    >
      <Autocomplete.Trigger
        id={id}
        className={`${focus.singleBorder} [&>button]:absolute [&>button]:inset-0 [&>button]:rounded-field`}
      >
        <Autocomplete.Value>{elegida?.label ?? placeholder}</Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover
        {...scope}
        className={`${theme} ${styles.selectPopover}`}
      >
        <Autocomplete.Filter filter={() => true}>
          {conBusqueda && (
            <SearchField
              aria-label={placeholderBusqueda}
              value={query}
              onChange={(next) => {
                setQuery(next);
                onBuscar?.(next);
              }}
              className={styles.selectSearch}
            >
              <SearchField.Group className={focus.singleBorder}>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={placeholderBusqueda} />
              </SearchField.Group>
            </SearchField>
          )}
          <ListBox
            className={styles.selectOptions}
            renderEmptyState={() => (
              <p className={styles.optionEmpty}>{vacio}</p>
            )}
          >
            {visibles.map((o) => (
              <ListBox.Item
                key={o.value}
                id={`option:${o.value}`}
                textValue={o.label}
              >
                <div>
                  {o.label}
                  {(o.grupo || o.detalle) && (
                    <small className={styles.optionDetail}>
                      {[o.grupo, o.detalle].filter(Boolean).join(" · ")}
                    </small>
                  )}
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}

export function EgresoConfirmacionSalida(
  props: React.ComponentProps<typeof LegacyConfirmacionSalida>,
) {
  const brand = useEgresosBrand();
  if (!brand) return <LegacyConfirmacionSalida {...props} />;
  return (
    <FormDialog
      isOpen={props.open}
      onOpenChange={(v) => {
        if (!v && !props.guardando) props.onSeguirEditando();
      }}
      title="Cambios sin guardar"
      description={`Tenés cambios sin guardar en ${props.donde}. Elegí cómo continuar.`}
      isDismissable={!props.guardando}
      className={`${styles.dialog} ${styles.confirmDialog}`}
    >
      <div className={styles.confirmActions}>
        <ActionButton
          variant="outline"
          onPress={props.onSeguirEditando}
          isDisabled={props.guardando}
        >
          Seguir editando
        </ActionButton>
        <ActionButton
          variant="outline"
          onPress={props.onDescartarYSalir}
          isDisabled={props.guardando}
        >
          Descartar y salir
        </ActionButton>
        <ActionButton
          onPress={() => void props.onGuardarYSalir()}
          isDisabled={props.guardando}
        >
          {props.guardando ? "Guardando…" : "Guardar y salir"}
        </ActionButton>
      </div>
    </FormDialog>
  );
}
