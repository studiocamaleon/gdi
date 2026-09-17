"use client";

import type { ReactNode } from "react";
import {
  Avatar,
  Button,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  type ButtonProps,
} from "@heroui/react";
import {
  CreditCard,
  Factory,
  File,
  FileCheck2,
  Folder,
  Globe,
  Mail,
  MessageCircle,
  Package,
  Smartphone,
  Store,
  User,
  Wallet,
} from "lucide-react";
import { NavigationTabList } from "../navigation-tab-list";
import { IdentityAvatar } from "../identity-avatar";
import { IconChoiceGroup, SegmentedControl } from "../choice-controls";
import actionStyles from "../action-button.module.css";
import { ActionButton } from "../action-button";
import { useDesignScope } from "../appearance";
import theme from "../theme.module.css";
import styles from "./component-design-samples.module.css";
import type { ComponentLook } from "./component-design-options";

export const sampleTabs = [
  {
    id: "productos",
    label: "Productos",
    icon: Package,
    description: "3 productos · Cantidades y precios de la orden.",
  },
  {
    id: "produccion",
    label: "Producción",
    icon: Factory,
    description: "2 etapas · Impresión y terminación pendientes.",
  },
  {
    id: "pagos",
    label: "Pagos",
    icon: CreditCard,
    description: "Sin pagos registrados · Saldo de muestra: $ 248.655.",
  },
  {
    id: "archivos",
    label: "Archivos",
    icon: Folder,
    description: "2 archivos de muestra · Arte y prueba de impresión.",
  },
  {
    id: "costos",
    label: "Costos",
    icon: Wallet,
    description: "Materiales, producción y margen del trabajo.",
  },
] as const;

export function SampleTabs({
  look,
  value,
  onChange,
  label,
  children,
  disabled = false,
}: {
  look: ComponentLook;
  value: string;
  onChange: (value: string) => void;
  label: string;
  children?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tabs
      className={styles.tabs}
      data-look={look}
      variant={look === "2" ? "secondary" : "primary"}
      selectedKey={value}
      onSelectionChange={(key) => onChange(String(key))}
      isDisabled={disabled}
    >
      {look === "2" ? (
        <NavigationTabList
          label={label}
          items={sampleTabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            icon: <tab.icon aria-hidden />,
            count: tab.id === "productos" ? 3 : undefined,
          }))}
        />
      ) : (
        <Tabs.ListContainer className={styles.tabsContainer}>
          <Tabs.List aria-label={label} className={styles.tabsList}>
            {sampleTabs.map((tab) => (
              <Tabs.Tab key={tab.id} id={tab.id} className={styles.tab}>
                <tab.icon aria-hidden />
                <span>{tab.label}</span>
                {tab.id === "productos" && (
                  <span className={styles.count}>3</span>
                )}
                <Tabs.Indicator className={styles.indicator} />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      )}
      <Tabs.Panel key={value} id={value} className={styles.panel}>
        {children ?? (
          <p className="text-xs leading-5 text-muted-foreground">
            {sampleTabs.find((tab) => tab.id === value)?.description}
          </p>
        )}
      </Tabs.Panel>
    </Tabs>
  );
}

export function SampleAvatar({
  look,
  initials = "LU",
  name = "Lucas Gómez",
}: {
  look: ComponentLook;
  initials?: string;
  name?: string;
}) {
  if (look === "3") return <IdentityAvatar name={name} initials={initials} />;
  return (
    <Avatar
      size="sm"
      className={styles.avatar}
      data-look={look}
      role="img"
      aria-label={name}
    >
      <Avatar.Fallback className={styles.avatarFallback}>
        {initials || <User size={15} aria-hidden />}
      </Avatar.Fallback>
    </Avatar>
  );
}

export function SampleSecondary({
  look,
  ...props
}: ButtonProps & { look: ComponentLook }) {
  if (look === "2") return <ActionButton {...props} variant="outline" />;
  return (
    <Button
      {...props}
      size="sm"
      variant="tertiary"
      className={`${actionStyles.button} ${styles.secondary}`}
      data-look={look}
    />
  );
}

export function SampleSegmented({
  look,
  value,
  onChange,
  label,
  disabled = false,
}: {
  look: ComponentLook;
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  if (look === "4")
    return (
      <SegmentedControl
        value={value}
        onChange={onChange}
        aria-label={label}
        isDisabled={disabled}
        options={[
          {
            value: "orden",
            label: "Orden de trabajo",
            icon: <FileCheck2 aria-hidden />,
          },
          {
            value: "presupuesto",
            label: "Presupuesto",
            icon: <File aria-hidden />,
          },
        ]}
      />
    );
  return (
    <ToggleButtonGroup
      selectionMode="single"
      disallowEmptySelection
      size="sm"
      isDisabled={disabled}
      aria-label={label}
      className={styles.segmented}
      data-look={look}
      selectedKeys={new Set([value])}
      onSelectionChange={(keys) => {
        const key = [...keys][0];
        if (key === "orden" || key === "presupuesto") onChange(key);
      }}
    >
      <ToggleButton id="orden" className={styles.choice}>
        <FileCheck2 aria-hidden /> Orden de trabajo
      </ToggleButton>
      <ToggleButton id="presupuesto" className={styles.choice}>
        <File aria-hidden /> Presupuesto
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

const channels = [
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "presencial", label: "Presencial", icon: Store },
  { id: "email", label: "Correo", icon: Mail },
  { id: "web", label: "Web", icon: Globe },
  { id: "app", label: "App móvil", icon: Smartphone },
];

export function SampleChannels({
  look,
  value,
  onChange,
  label,
  disabled = false,
}: {
  look: ComponentLook;
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const scope = useDesignScope();
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      {look === "2" ? (
        <IconChoiceGroup
          value={value}
          onChange={onChange}
          aria-label={label}
          isDisabled={disabled}
          options={channels.map((channel) => ({
            value: channel.id,
            label: channel.label,
            icon: <channel.icon aria-hidden />,
          }))}
        />
      ) : (
        <ToggleButtonGroup
          selectionMode="single"
          disallowEmptySelection
          size="sm"
          isDetached
          isDisabled={disabled}
          aria-label={label}
          className={styles.channels}
          data-look={look}
          selectedKeys={new Set([value])}
          onSelectionChange={(keys) => {
            const key = [...keys][0];
            if (typeof key === "string") onChange(key);
          }}
        >
          {channels.map((channel) => (
            <Tooltip key={channel.id} delay={350}>
              <ToggleButton
                id={channel.id}
                aria-label={channel.label}
                className={styles.choice}
              >
                <channel.icon aria-hidden />
                {look === "4" && channel.label}
              </ToggleButton>
              <Tooltip.Content {...scope} className={theme.theme}>
                {channel.label}
              </Tooltip.Content>
            </Tooltip>
          ))}
        </ToggleButtonGroup>
      )}
      <p className="text-xs text-muted-foreground">
        {channels.find((channel) => channel.id === value)?.label}
      </p>
    </div>
  );
}
