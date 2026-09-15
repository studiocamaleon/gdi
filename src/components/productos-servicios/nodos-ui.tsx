"use client";

import * as React from "react";
import {
  Autocomplete,
  Chip,
  Input as HeroInput,
  ListBox,
  SearchField,
  Select,
  Switch as HeroSwitch,
  Tooltip,
} from "@heroui/react";
import { InfoIcon } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { useDesignScope } from "@/components/design-system/appearance";
import theme from "@/components/design-system/theme.module.css";
import selectField from "@/components/design-system/select-field.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import { Button as LegacyButton } from "@/components/ui/button";
import { Input as LegacyInput } from "@/components/ui/input";
import { Switch as LegacySwitch } from "@/components/ui/switch";
import { Badge as LegacyBadge } from "@/components/ui/badge";
import { LabelConTooltip as LegacyLabelConTooltip } from "@/components/ui/label-con-tooltip";
import {
  HumanSelect as LegacyHumanSelect,
  ensureSelectedOption,
} from "@/components/ui/human-select";
import {
  SelectBuscable as LegacySelectBuscable,
  filtrarOpciones,
} from "@/components/ui/select-buscable";
import s from "./nodos-editor.module.css";

// El editor se comparte con Productos. Sólo la ficha de Nodos activa HeroUI.
const NodosVisual = React.createContext(false);
export const useNodosVisual = () => React.useContext(NodosVisual);
export function NodosVisualProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NodosVisual.Provider value>{children}</NodosVisual.Provider>;
}

export function Button(props: React.ComponentProps<typeof LegacyButton>) {
  const activo = useNodosVisual();
  if (!activo) return <LegacyButton {...props} />;
  const {
    variant,
    size,
    disabled,
    loading,
    loadingText,
    children,
    render,
    nativeButton,
    ...rest
  } = props;
  // Los render props pertenecen a disparadores compartidos de Base UI.
  if (render || nativeButton === false) return <LegacyButton {...props} />;
  return (
    <ActionButton
      {...(rest as React.ComponentProps<typeof ActionButton>)}
      variant={
        variant === "outline" || variant === "ghost" || variant === "secondary"
          ? variant
          : variant === "destructive"
            ? "danger-soft"
            : variant === "link"
              ? "ghost"
              : "primary"
      }
      size={size === "lg" || size === "icon-lg" ? "lg" : "sm"}
      isIconOnly={size?.startsWith("icon")}
      isDisabled={disabled || loading}
      isPending={loading}
    >
      {loading && loadingText ? loadingText : children}
    </ActionButton>
  );
}
export function NativeButton(props: React.ComponentProps<"button">) {
  const activo = useNodosVisual();
  if (!activo) return <button {...props} />;
  const { disabled, className = "", value, ...rest } = props;
  const primary = /\bbtn-primary\b/.test(className);
  return (
    <ActionButton
      {...(rest as React.ComponentProps<typeof ActionButton>)}
      value={value == null ? undefined : String(value)}
      className={`${s.nativeButton} ${className
        .split(/\s+/)
        .filter(
          (token) =>
            !/^btn(?:-(?:primary|outline|ghost|secondary|sm|lg|xs))?$/.test(
              token,
            ),
        )
        .join(" ")}`}
      isIconOnly={
        Boolean(props["aria-label"]) && React.isValidElement(props.children)
      }
      isDisabled={disabled}
      variant={
        primary
          ? "primary"
          : /\bactive\b/.test(className)
            ? "secondary"
            : className.split(/\s+/).includes("btn-ghost")
              ? "ghost"
              : "outline"
      }
    />
  );
}
export function Input(props: React.ComponentProps<typeof LegacyInput>) {
  const activo = useNodosVisual();
  return activo ? (
    <HeroInput
      {...props}
      className={`${focus.singleBorder} ${props.className ?? ""}`}
    />
  ) : (
    <LegacyInput {...props} />
  );
}
export function Switch(
  props: Omit<React.ComponentProps<typeof LegacySwitch>, "onCheckedChange"> & {
    onCheckedChange?: (value: boolean) => void;
  },
) {
  const activo = useNodosVisual();
  if (!activo) return <LegacySwitch {...props} />;
  const {
    checked,
    defaultChecked,
    onCheckedChange,
    disabled,
    id,
    name,
    className,
    "aria-label": label,
  } = props;
  return (
    <HeroSwitch
      isSelected={checked}
      defaultSelected={defaultChecked}
      onChange={(value) => onCheckedChange?.(value)}
      isDisabled={disabled}
      id={id}
      name={name}
      aria-label={label ?? "Habilitar opción"}
      className={typeof className === "string" ? className : undefined}
      size="sm"
    >
      <HeroSwitch.Content>
        <HeroSwitch.Control>
          <HeroSwitch.Thumb />
        </HeroSwitch.Control>
      </HeroSwitch.Content>
    </HeroSwitch>
  );
}
export function Badge(props: React.ComponentProps<typeof LegacyBadge>) {
  const activo = useNodosVisual();
  if (!activo) return <LegacyBadge {...props} />;
  return (
    <Chip
      size="sm"
      variant="soft"
      color={props.variant === "destructive" ? "danger" : "default"}
      className={props.className}
    >
      {props.children}
    </Chip>
  );
}
export function LabelConTooltip(
  props: React.ComponentProps<typeof LegacyLabelConTooltip>,
) {
  const activo = useNodosVisual();
  const scope = useDesignScope();
  if (!activo) return <LegacyLabelConTooltip {...props} />;
  return (
    <div className={`flex items-center gap-1.5 ${props.className ?? ""}`}>
      <label htmlFor={props.htmlFor}>
        {props.label}
        {props.required && <span className="text-danger"> *</span>}
      </label>
      {props.tooltip && (
        <Tooltip delay={150}>
          <ActionButton
            variant="ghost"
            isIconOnly
            aria-label={`Información sobre ${typeof props.label === "string" ? props.label : "este campo"}`}
          >
            <InfoIcon />
          </ActionButton>
          <Tooltip.Content
            {...scope}
            className={`${theme.theme} max-w-xs text-xs`}
          >
            <p>{props.tooltip}</p>
            {props.ejemplo && <p className="mt-2">Ejemplo: {props.ejemplo}</p>}
          </Tooltip.Content>
        </Tooltip>
      )}
    </div>
  );
}
function OptionDetails({
  option,
  showCode = false,
}: {
  option: React.ComponentProps<typeof LegacyHumanSelect>["options"][number];
  showCode?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      {!option.hideLabelInItem && (
        <span className="font-medium">
          {option.label} {option.badge && <small>{option.badge}</small>}
        </span>
      )}
      {showCode && option.code && <small>{option.code}</small>}
      {option.description && (
        <small className="text-muted-foreground">{option.description}</small>
      )}
      {option.details?.length ? (
        <span className="flex flex-wrap gap-1">
          {option.details.map((detail) => (
            <Chip
              key={`${detail.label}:${detail.value}`}
              size="sm"
              variant="soft"
            >
              {detail.label}: {detail.value}
            </Chip>
          ))}
        </span>
      ) : null}
    </span>
  );
}
export function HumanSelect(
  props: React.ComponentProps<typeof LegacyHumanSelect>,
) {
  const activo = useNodosVisual();
  return activo ? (
    <NodoHumanSelect {...props} />
  ) : (
    <LegacyHumanSelect {...props} />
  );
}
function NodoHumanSelect({
  value,
  options,
  includeSelectedFallback = true,
  onValueChange,
  placeholder = "Elegir",
  disabled,
  id,
  triggerClassName,
  contentClassName,
  itemClassName,
  showCode,
}: React.ComponentProps<typeof LegacyHumanSelect>) {
  const scope = useDesignScope();
  const available = includeSelectedFallback
    ? ensureSelectedOption(options, value ?? "")
    : options;
  const selected = available.find((o) => o.value === (value ?? ""));
  return (
    <Select
      className={selectField.root}
      aria-label={placeholder}
      value={selected ? `option:${selected.value}` : null}
      onChange={(key) => {
        if (key != null) onValueChange(String(key).slice(7));
      }}
      isDisabled={disabled}
      fullWidth
      placeholder={placeholder}
      disabledKeys={available
        .filter((o) => o.disabled)
        .map((o) => `option:${o.value}`)}
    >
      <Select.Trigger
        id={id}
        className={`${focus.singleBorder} ${triggerClassName ?? ""}`}
      >
        <Select.Value>
          {selected?.hideLabelInItem && selected.details?.length ? (
            <OptionDetails option={selected} />
          ) : (
            (selected?.label ?? placeholder)
          )}
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover
        {...scope}
        className={`${theme.theme} ${s.popover} ${contentClassName ?? ""}`}
      >
        <ListBox>
          {available.map((option) => (
            <ListBox.Item
              key={option.value}
              id={`option:${option.value}`}
              textValue={option.label}
              className={itemClassName}
            >
              {option.group && (
                <small className="text-muted-foreground">{option.group}</small>
              )}
              <OptionDetails option={option} showCode={showCode} />
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
export function SelectBuscable(
  props: React.ComponentProps<typeof LegacySelectBuscable>,
) {
  const activo = useNodosVisual();
  return activo ? (
    <NodoSelectBuscable {...props} />
  ) : (
    <LegacySelectBuscable {...props} />
  );
}
function NodoSelectBuscable({
  value,
  onChange,
  opciones,
  placeholder = "Elegir…",
  placeholderBusqueda = "Buscar…",
  vacio = "No hay nada que coincida.",
  disabled,
  id,
  ariaLabel,
  className,
  minimoParaBuscar = 7,
  onBuscar,
}: React.ComponentProps<typeof LegacySelectBuscable>) {
  const scope = useDesignScope();
  const [query, setQuery] = React.useState("");
  const conBusqueda = opciones.length >= minimoParaBuscar;
  const visible = filtrarOpciones(opciones, conBusqueda ? query : "");
  const selected = opciones.find((o) => o.value === value);
  return (
    <Autocomplete
      aria-label={ariaLabel ?? placeholder}
      value={selected ? `option:${value}` : null}
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
        <Autocomplete.Value>
          {selected?.label ?? placeholder}
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover
        {...scope}
        className={`${theme.theme} ${s.popover}`}
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
              className="p-2"
            >
              <SearchField.Group className={focus.singleBorder}>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={placeholderBusqueda} />
              </SearchField.Group>
            </SearchField>
          )}
          <ListBox
            renderEmptyState={() => <p className="p-4 text-xs">{vacio}</p>}
          >
            {visible.map((o) => (
              <ListBox.Item
                key={o.value}
                id={`option:${o.value}`}
                textValue={o.label}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span>{o.label}</span>
                  {(o.grupo || o.detalle) && (
                    <small className="text-muted-foreground">
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
export function NativeInput(props: React.ComponentProps<"input">) {
  const activo = useNodosVisual();
  return activo ? (
    <HeroInput
      {...props}
      className={`${focus.singleBorder} ${props.className ?? ""}`}
    />
  ) : (
    <input {...props} />
  );
}
