"use client";

import * as React from "react";
import {
  Select as HeroSelect,
  ListBox,
  Card as HeroCard,
  Checkbox as HeroCheckbox,
  Modal,
  Tabs as HeroTabs,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { ActionLink } from "@/components/design-system/action-link";
import * as Alta from "./producto-alta-ui";
import * as Nodos from "./nodos-ui";
import * as LegacyCard from "@/components/ui/card";
import * as LegacyDialog from "@/components/ui/dialog";
import * as LegacyTabs from "@/components/ui/tabs";
import * as LegacyToggle from "@/components/ui/toggle-group";
import { Checkbox as LegacyCheckbox } from "@/components/ui/checkbox";
import { ConfirmacionDestructiva as LegacyConfirmacion } from "@/components/ui/confirmacion-destructiva";
import * as LegacySelect from "@/components/ui/select";
import focus from "@/components/design-system/field-focus.module.css";
import selectField from "@/components/design-system/select-field.module.css";
import s from "./producto-ui.module.css";

// Estos editores también se usan fuera de la ficha: el cambio visual es optativo.
const ProductoVisual = React.createContext(false);
const EdicionDeshabilitada = React.createContext(false);
export const useProductoVisual = () => React.useContext(ProductoVisual);
export function ProductoVisualProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProductoVisual.Provider value>
      <Alta.AltaVisualProvider enabled>
        <Nodos.NodosVisualProvider>{children}</Nodos.NodosVisualProvider>
      </Alta.AltaVisualProvider>
    </ProductoVisual.Provider>
  );
}
export function ProductoEdicion({
  disabled,
  children,
}: {
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <EdicionDeshabilitada.Provider value={disabled}>
      <fieldset disabled={disabled} className={s.fieldset}>
        {children}
      </fieldset>
    </EdicionDeshabilitada.Provider>
  );
}
export function Button(props: React.ComponentProps<typeof Nodos.Button>) {
  const disabled = React.useContext(EdicionDeshabilitada);
  const enabled = useProductoVisual();
  if (
    enabled &&
    React.isValidElement<React.ComponentProps<typeof ActionLink>>(
      props.render,
    ) &&
    props.render.props.href
  ) {
    return (
      <ActionLink
        {...props.render.props}
        variant={
          props.variant === "outline" ||
          props.variant === "ghost" ||
          props.variant === "secondary"
            ? props.variant
            : "primary"
        }
        className={
          typeof props.className === "string" ? props.className : undefined
        }
      >
        {props.children}
      </ActionLink>
    );
  }
  return <Nodos.Button {...props} disabled={disabled || props.disabled} />;
}
export function NativeButton(props: React.ComponentProps<"button">) {
  const disabled = React.useContext(EdicionDeshabilitada);
  return (
    <Nodos.NativeButton {...props} disabled={disabled || props.disabled} />
  );
}
export function ChoiceButton(props: React.ComponentProps<"button">) {
  const disabled = React.useContext(EdicionDeshabilitada);
  const { className, children, ...rest } = props;
  return (
    <ToggleButton
      {...(rest as React.ComponentProps<typeof ToggleButton>)}
      isDisabled={disabled || props.disabled}
      isSelected={className?.split(/\s+/).includes("on")}
      className={s.choice}
    >
      {children}
    </ToggleButton>
  );
}
export function Input(props: React.ComponentProps<typeof Alta.Input>) {
  const disabled = React.useContext(EdicionDeshabilitada);
  return <Alta.Input {...props} disabled={disabled || props.disabled} />;
}
export function Textarea(props: React.ComponentProps<typeof Alta.Textarea>) {
  const disabled = React.useContext(EdicionDeshabilitada);
  return <Alta.Textarea {...props} disabled={disabled || props.disabled} />;
}
export function Switch(props: React.ComponentProps<typeof Nodos.Switch>) {
  const disabled = React.useContext(EdicionDeshabilitada);
  return <Nodos.Switch {...props} disabled={disabled || props.disabled} />;
}
export function HumanSelect(
  props: React.ComponentProps<typeof Nodos.HumanSelect>,
) {
  const disabled = React.useContext(EdicionDeshabilitada);
  return <Nodos.HumanSelect {...props} disabled={disabled || props.disabled} />;
}
export { optionFromLabel } from "@/components/ui/human-select";
export const Badge = Nodos.Badge;
export const LabelConTooltip = Nodos.LabelConTooltip;
export const Card = Alta.Card;
export const CardHeader = Alta.CardHeader;
export const CardTitle = Alta.CardTitle;
export const CardDescription = Alta.CardDescription;
export const CardContent = Alta.CardContent;
export function CardFooter(
  props: React.ComponentProps<typeof LegacyCard.CardFooter>,
) {
  const enabled = useProductoVisual();
  return enabled ? (
    <HeroCard.Footer
      {...props}
      className={`${s.cardFooter} ${props.className ?? ""}`}
    />
  ) : (
    <LegacyCard.CardFooter {...props} />
  );
}
export function CardAction(
  props: React.ComponentProps<typeof LegacyCard.CardAction>,
) {
  const enabled = useProductoVisual();
  return enabled ? <div {...props} /> : <LegacyCard.CardAction {...props} />;
}
export function Checkbox(props: React.ComponentProps<typeof LegacyCheckbox>) {
  const enabled = useProductoVisual();
  const disabled = React.useContext(EdicionDeshabilitada);
  if (!enabled) return <LegacyCheckbox {...props} />;
  return (
    <HeroCheckbox
      id={props.id}
      aria-label={props["aria-label"] ?? "Seleccionar opción"}
      isSelected={props.checked === true}
      isIndeterminate={props.indeterminate}
      isDisabled={disabled || props.disabled}
      onChange={(value) => props.onCheckedChange?.(value, {} as never)}
      className={s.checkbox}
    >
      <HeroCheckbox.Content>
        <HeroCheckbox.Control>
          <HeroCheckbox.Indicator />
        </HeroCheckbox.Control>
      </HeroCheckbox.Content>
    </HeroCheckbox>
  );
}

// Mantiene los estados y callbacks del editor; sólo reemplaza las superficies.
const DialogState = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  descriptionId?: string;
}>({ open: false, onOpenChange: () => {} });
export function Dialog({
  open = false,
  onOpenChange = () => {},
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const enabled = useProductoVisual();
  const descriptionId = React.useId();
  return enabled ? (
    <DialogState.Provider value={{ open, onOpenChange, descriptionId }}>
      {children}
    </DialogState.Provider>
  ) : (
    <LegacyDialog.Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </LegacyDialog.Dialog>
  );
}
export function DialogContent(
  props: React.ComponentProps<typeof LegacyDialog.DialogContent>,
) {
  const enabled = useProductoVisual();
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const state = React.useContext(DialogState);
  React.useEffect(() => {
    if (!enabled || !state.open) return;
    const frame = requestAnimationFrame(() => {
      const target = props.initialFocus;
      if (target && typeof target === "object" && "current" in target) {
        target.current?.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [enabled, state.open, props.initialFocus]);
  if (!enabled) return <LegacyDialog.DialogContent {...props} />;
  const className =
    typeof props.className === "string"
      ? props.className
          .split(/\s+/)
          .filter((c) => !c.startsWith("gp-modal"))
          .join(" ")
      : "";
  return (
    <Modal.Backdrop
      {...scope}
      className={theme}
      isOpen={state.open}
      onOpenChange={state.onOpenChange}
    >
      <Modal.Container size="lg" className={s.modalContainer}>
        <Modal.Dialog
          data-producto-dialog
          className={`${s.dialog} ${className}`}
          aria-label={props["aria-label"]}
          aria-describedby={state.descriptionId}
        >
          {props.showCloseButton !== false && (
            <Modal.CloseTrigger aria-label="Cerrar" className={s.close} />
          )}
          {props.children}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
export function DialogHeader(
  props: React.ComponentProps<typeof LegacyDialog.DialogHeader>,
) {
  const enabled = useProductoVisual();
  return enabled ? (
    <Modal.Header
      {...props}
      className={`${s.dialogHeader} ${props.className ?? ""}`}
    />
  ) : (
    <LegacyDialog.DialogHeader {...props} />
  );
}
export function DialogTitle(
  props: React.ComponentProps<typeof LegacyDialog.DialogTitle>,
) {
  const enabled = useProductoVisual();
  return enabled ? (
    <Modal.Heading className={s.dialogTitle}>{props.children}</Modal.Heading>
  ) : (
    <LegacyDialog.DialogTitle {...props} />
  );
}
export function DialogDescription(
  props: React.ComponentProps<typeof LegacyDialog.DialogDescription>,
) {
  const enabled = useProductoVisual();
  const state = React.useContext(DialogState);
  return enabled ? (
    <p id={state.descriptionId} className={s.description}>
      {props.children}
    </p>
  ) : (
    <LegacyDialog.DialogDescription {...props} />
  );
}
export function DialogFooter(
  props: React.ComponentProps<typeof LegacyDialog.DialogFooter>,
) {
  const enabled = useProductoVisual();
  return enabled ? (
    <Modal.Footer
      {...props}
      className={`${s.dialogFooter} ${props.className ?? ""}`}
    />
  ) : (
    <LegacyDialog.DialogFooter {...props} />
  );
}
export function Tabs({
  value,
  onValueChange,
  children,
  className,
  ...props
}: React.ComponentProps<typeof LegacyTabs.Tabs>) {
  const enabled = useProductoVisual();
  if (!enabled)
    return (
      <LegacyTabs.Tabs
        {...props}
        value={value}
        onValueChange={onValueChange}
        className={className}
      >
        {children}
      </LegacyTabs.Tabs>
    );
  return (
    <HeroTabs
      selectedKey={value == null ? undefined : String(value)}
      onSelectionChange={(key) => onValueChange?.(key, {} as never)}
      className={`${s.tabs} ${typeof className === "string" ? className : ""}`}
      variant="secondary"
    >
      {children}
    </HeroTabs>
  );
}
export function TabsList({
  variant,
  ...props
}: React.ComponentProps<typeof LegacyTabs.TabsList>) {
  const enabled = useProductoVisual();
  if (!enabled) return <LegacyTabs.TabsList {...props} variant={variant} />;
  return (
    <HeroTabs.List
      className={`${s.tabList} ${typeof props.className === "string" ? props.className : ""}`}
      aria-label={props["aria-label"] ?? "Opciones"}
    >
      {props.children}
    </HeroTabs.List>
  );
}
export function TabsTrigger(
  props: React.ComponentProps<typeof LegacyTabs.TabsTrigger>,
) {
  const enabled = useProductoVisual();
  if (!enabled) return <LegacyTabs.TabsTrigger {...props} />;
  return (
    <HeroTabs.Tab
      id={String(props.value)}
      isDisabled={props.disabled}
      className={`${s.tab} ${typeof props.className === "string" ? props.className : ""}`}
    >
      {props.children}
      <HeroTabs.Indicator />
    </HeroTabs.Tab>
  );
}
export function TabsContent(
  props: React.ComponentProps<typeof LegacyTabs.TabsContent>,
) {
  const enabled = useProductoVisual();
  return enabled ? (
    <HeroTabs.Panel
      id={String(props.value)}
      className={`${s.tabPanel} ${typeof props.className === "string" ? props.className : ""}`}
    >
      {props.children}
    </HeroTabs.Panel>
  ) : (
    <LegacyTabs.TabsContent {...props} />
  );
}
export function ToggleGroup(
  props: React.ComponentProps<typeof LegacyToggle.ToggleGroup>,
) {
  const enabled = useProductoVisual();
  const disabled = React.useContext(EdicionDeshabilitada);
  if (!enabled) return <LegacyToggle.ToggleGroup {...props} />;
  return (
    <ToggleButtonGroup
      selectionMode={props.multiple ? "multiple" : "single"}
      selectedKeys={new Set(props.value ?? [])}
      onSelectionChange={(keys) =>
        props.onValueChange?.([...keys].map(String), {} as never)
      }
      isDisabled={disabled || props.disabled}
      isDetached
      size="sm"
      aria-label={props["aria-label"] ?? "Opciones de configuración"}
      className={`${s.toggleGroup} ${typeof props.className === "string" ? props.className : ""}`}
    >
      {props.children}
    </ToggleButtonGroup>
  );
}
export function ToggleGroupItem(
  props: React.ComponentProps<typeof LegacyToggle.ToggleGroupItem>,
) {
  const enabled = useProductoVisual();
  if (!enabled) return <LegacyToggle.ToggleGroupItem {...props} />;
  return (
    <ToggleButton
      id={String(props.value)}
      isDisabled={props.disabled}
      className={`${s.choice} ${typeof props.className === "string" ? props.className : ""}`}
    >
      {props.children}
    </ToggleButton>
  );
}

export function ConfirmacionDestructiva(
  props: React.ComponentProps<typeof LegacyConfirmacion>,
) {
  const enabled = useProductoVisual();
  return (
    <LegacyConfirmacion
      {...props}
      apariencia={enabled ? "heroui" : props.apariencia}
    />
  );
}

// Selectores compuestos del importador vectorial, con la misma selección original.
export function Select(props: {
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const enabled = useProductoVisual();
  const disabled = React.useContext(EdicionDeshabilitada);
  if (!enabled) return <LegacySelect.Select {...props} />;
  return (
    <HeroSelect
      className={selectField.root}
      fullWidth
      aria-label="Seleccionar opción"
      value={props.value ? `option:${props.value}` : null}
      onChange={(key) =>
        props.onValueChange?.(key == null ? null : String(key).slice(7))
      }
      isDisabled={disabled || props.disabled}
    >
      {props.children}
    </HeroSelect>
  );
}
export function SelectTrigger({
  ref,
  ...props
}: React.ComponentProps<typeof LegacySelect.SelectTrigger>) {
  const enabled = useProductoVisual();
  if (!enabled) return <LegacySelect.SelectTrigger {...props} ref={ref} />;
  return (
    <HeroSelect.Trigger id={props.id} ref={ref} className={focus.singleBorder}>
      {props.children}
      <HeroSelect.Indicator />
    </HeroSelect.Trigger>
  );
}
export function SelectValue(
  props: React.ComponentProps<typeof LegacySelect.SelectValue>,
) {
  const enabled = useProductoVisual();
  return enabled ? (
    <HeroSelect.Value>{props.children}</HeroSelect.Value>
  ) : (
    <LegacySelect.SelectValue {...props} />
  );
}
export function SelectContent(
  props: React.ComponentProps<typeof LegacySelect.SelectContent>,
) {
  const enabled = useProductoVisual();
  const scope = useDesignScope();
  const theme = useDesignTheme();
  if (!enabled) return <LegacySelect.SelectContent {...props} />;
  return (
    <HeroSelect.Popover {...scope} className={theme}>
      <ListBox>{props.children}</ListBox>
    </HeroSelect.Popover>
  );
}
export function SelectGroup(
  props: React.ComponentProps<typeof LegacySelect.SelectGroup>,
) {
  const enabled = useProductoVisual();
  return enabled ? (
    <ListBox.Section>{props.children}</ListBox.Section>
  ) : (
    <LegacySelect.SelectGroup {...props} />
  );
}
function textoOpcion(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : React.isValidElement<{ children?: React.ReactNode }>(child)
          ? textoOpcion(child.props.children)
          : "",
    )
    .join("");
}
export function SelectItem(
  props: React.ComponentProps<typeof LegacySelect.SelectItem>,
) {
  const enabled = useProductoVisual();
  return enabled ? (
    <ListBox.Item
      id={`option:${props.value}`}
      textValue={textoOpcion(props.children)}
      isDisabled={props.disabled}
    >
      {props.children}
      <ListBox.ItemIndicator />
    </ListBox.Item>
  ) : (
    <LegacySelect.SelectItem {...props} />
  );
}

export function MedidaInput({
  label,
  ...props
}: React.ComponentProps<typeof Input> & { label: string }) {
  return (
    <label className={s.measureValue}>
      <span>{label}</span>
      <Input {...props} />
    </label>
  );
}
