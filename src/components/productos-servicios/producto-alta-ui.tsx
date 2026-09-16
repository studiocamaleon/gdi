"use client";

import * as React from "react";
import {
  Card as HeroCard,
  Chip,
  Input as HeroInput,
  ListBox,
  Select,
  TextArea,
  Tooltip,
} from "@heroui/react";
import { InfoIcon } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import focus from "@/components/design-system/field-focus.module.css";
import selectField from "@/components/design-system/select-field.module.css";
import { Button as LegacyButton } from "@/components/ui/button";
import { Badge as LegacyBadge } from "@/components/ui/badge";
import {
  Card as LegacyCard,
  CardHeader as LegacyHeader,
  CardTitle as LegacyTitle,
  CardDescription as LegacyDescription,
  CardContent as LegacyContent,
} from "@/components/ui/card";
import { Input as LegacyInput } from "@/components/ui/input";
import { Textarea as LegacyTextarea } from "@/components/ui/textarea";
import { Label as LegacyLabel } from "@/components/ui/label";
import { LabelConTooltip as LegacyLabelConTooltip } from "@/components/ui/label-con-tooltip";
import {
  HumanSelect as LegacyHumanSelect,
  ensureSelectedOption,
} from "@/components/ui/human-select";
import s from "./producto-alta.module.css";

// El alta comparte el controlador del wizard. El modo edición conserva su UI.
const AltaVisual = React.createContext(false);
export const useAltaVisual = () => React.useContext(AltaVisual);
export function AltaVisualProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return <AltaVisual.Provider value={enabled}>{children}</AltaVisual.Provider>;
}
export function Button(props: React.ComponentProps<typeof LegacyButton>) {
  const enabled = useAltaVisual();
  if (!enabled) return <LegacyButton {...props} />;
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
  if (render || nativeButton === false) return <LegacyButton {...props} />;
  return (
    <ActionButton
      {...(rest as React.ComponentProps<typeof ActionButton>)}
      variant={
        variant === "outline" || variant === "ghost" || variant === "secondary"
          ? variant
          : variant === "destructive"
            ? "danger-soft"
            : "primary"
      }
      isIconOnly={size?.startsWith("icon")}
      isDisabled={disabled || loading}
      isPending={loading}
    >
      {loading && loadingText ? loadingText : children}
    </ActionButton>
  );
}
export function StepButton(props: React.ComponentProps<"button">) {
  const enabled = useAltaVisual();
  if (!enabled) return <button {...props} />;
  const { disabled, ...rest } = props;
  return (
    <ActionButton
      {...(rest as React.ComponentProps<typeof ActionButton>)}
      variant="ghost"
      isDisabled={disabled}
    />
  );
}
export function Input(props: React.ComponentProps<typeof LegacyInput>) {
  const enabled = useAltaVisual();
  return enabled ? (
    <HeroInput
      {...props}
      className={`${focus.singleBorder} ${s.input} ${props.className ?? ""}`}
    />
  ) : (
    <LegacyInput {...props} />
  );
}
export function Textarea(props: React.ComponentProps<typeof LegacyTextarea>) {
  const enabled = useAltaVisual();
  return enabled ? (
    <TextArea
      {...props}
      className={`${focus.singleBorder} ${s.input} ${props.className ?? ""}`}
    />
  ) : (
    <LegacyTextarea {...props} />
  );
}
export function MedidaInput({
  label,
  ...props
}: React.ComponentProps<typeof LegacyInput> & { label: string }) {
  const enabled = useAltaVisual();
  if (!enabled) return <LegacyInput {...props} />;
  return (
    <label className={s.measureField}>
      <span>{label}</span>
      <Input {...props} />
    </label>
  );
}
export function Label(props: React.ComponentProps<typeof LegacyLabel>) {
  const enabled = useAltaVisual();
  return enabled ? (
    <label
      {...props}
      id={props.id ?? (props.htmlFor ? `${props.htmlFor}-label` : undefined)}
      className={`${s.label} ${props.className ?? ""}`}
    />
  ) : (
    <LegacyLabel {...props} />
  );
}
export function Card(props: React.ComponentProps<typeof LegacyCard>) {
  const enabled = useAltaVisual();
  return enabled ? (
    <HeroCard {...props} className={`${s.card} ${props.className ?? ""}`}>
      {props.children}
    </HeroCard>
  ) : (
    <LegacyCard {...props} />
  );
}
export function CardHeader(props: React.ComponentProps<typeof LegacyHeader>) {
  const enabled = useAltaVisual();
  return enabled ? (
    <HeroCard.Header
      {...props}
      className={`${s.cardHeader} ${props.className ?? ""}`}
    />
  ) : (
    <LegacyHeader {...props} />
  );
}
export function CardTitle(props: React.ComponentProps<typeof LegacyTitle>) {
  const enabled = useAltaVisual();
  return enabled ? <HeroCard.Title {...props} /> : <LegacyTitle {...props} />;
}
export function CardDescription(
  props: React.ComponentProps<typeof LegacyDescription>,
) {
  const enabled = useAltaVisual();
  return enabled ? (
    <HeroCard.Description {...props} />
  ) : (
    <LegacyDescription {...props} />
  );
}
export function CardContent(props: React.ComponentProps<typeof LegacyContent>) {
  const enabled = useAltaVisual();
  return enabled ? (
    <HeroCard.Content
      {...props}
      className={`${s.cardBody} ${props.className ?? ""}`}
    />
  ) : (
    <LegacyContent {...props} />
  );
}
export function Badge(props: React.ComponentProps<typeof LegacyBadge>) {
  const enabled = useAltaVisual();
  return enabled ? (
    <Chip
      size="sm"
      variant="soft"
      color={props.variant === "destructive" ? "danger" : "default"}
    >
      {props.children}
    </Chip>
  ) : (
    <LegacyBadge {...props} />
  );
}
export function LabelConTooltip(
  props: React.ComponentProps<typeof LegacyLabelConTooltip>,
) {
  const enabled = useAltaVisual();
  const scope = useDesignScope();
  const theme = useDesignTheme();
  if (!enabled) return <LegacyLabelConTooltip {...props} />;
  return (
    <div className={s.labelHelp}>
      <Label htmlFor={props.htmlFor}>
        {props.label}
        {props.required && <span className="text-danger"> *</span>}
      </Label>
      {props.tooltip && (
        <Tooltip delay={150}>
          <ActionButton
            variant="ghost"
            isIconOnly
            className={s.helpButton}
            aria-label={`Información sobre ${props.label}`}
          >
            <InfoIcon />
          </ActionButton>
          <Tooltip.Content {...scope} className={`${theme} ${s.tooltip}`}>
            <p>{props.tooltip}</p>
            {props.ejemplo && <p>Ejemplo: {props.ejemplo}</p>}
          </Tooltip.Content>
        </Tooltip>
      )}
    </div>
  );
}
export function HumanSelect(
  props: React.ComponentProps<typeof LegacyHumanSelect>,
) {
  const enabled = useAltaVisual();
  const scope = useDesignScope();
  const theme = useDesignTheme();
  if (!enabled) return <LegacyHumanSelect {...props} />;
  const {
    value,
    options,
    onValueChange,
    id,
    disabled,
    placeholder = "Elegir",
    includeSelectedFallback = true,
  } = props;
  const available = includeSelectedFallback
    ? ensureSelectedOption(options, value)
    : options;
  return (
    <Select
      className={selectField.root}
      fullWidth
      value={value ? `option:${value}` : null}
      onChange={(key) => {
        if (key != null) onValueChange(String(key).slice(7));
      }}
      isDisabled={disabled}
      placeholder={placeholder}
      aria-labelledby={id ? `${id}-label` : undefined}
      aria-label={id ? undefined : placeholder}
      disabledKeys={available
        .filter((option) => option.disabled)
        .map((option) => `option:${option.value}`)}
    >
      <Select.Trigger id={id} className={focus.singleBorder}>
        <Select.Value>
          {available.find((option) => option.value === value)?.label ??
            placeholder}
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover {...scope} className={`${theme} ${s.selectPopover}`}>
        <ListBox>
          {available.map((option) => (
            <ListBox.Item
              key={option.value}
              id={`option:${option.value}`}
              textValue={option.label}
            >
              <span className={s.option}>
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
