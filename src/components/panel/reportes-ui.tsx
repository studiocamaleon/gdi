"use client";

import { useId, type ReactNode } from "react";
import { Card, Tooltip } from "@heroui/react";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ChartNoAxesCombinedIcon,
  CircleHelpIcon,
  InfoIcon,
} from "lucide-react";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { MetaPanel } from "@/lib/panel-api";
import styles from "./reportes.module.css";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatearMoneda } from "@/lib/moneda";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

/** Referencia del mismo alcance comercial. No estima una alícuota faltante. */
export function IvaReference({ value }: { value?: number | null }) {
  const { moneda } = useConfigRegional();
  if (value == null || !Number.isFinite(value)) return null;
  return (
    <small className={styles.ivaReference} data-reporte-iva>
      {" "}
      {formatearMoneda(value, moneda)} con IVA
    </small>
  );
}

export function SalesScopeNote() {
  const descripcion =
    "Ventas y presupuestos: importes de productos sin IVA. Debajo, la referencia con IVA según el tratamiento de cada documento.";
  return (
    <Alert
      role="note"
      className={styles.salesScope}
      data-reporte-alcance
      data-reporte-exportar={`No incluye cargos extra. ${descripcion}`}
    >
      <InfoIcon />
      <AlertTitle>No incluye cargos extra</AlertTitle>
      <AlertDescription>{descripcion}</AlertDescription>
    </Alert>
  );
}

/** No presentar un total parcial si la API anterior aún no envía referencias. */
export function sumarReferencias(
  valores: Array<number | undefined>,
): number | undefined {
  return valores.every(
    (valor): valor is number => valor != null && Number.isFinite(valor),
  )
    ? valores.reduce((total, valor) => total + valor, 0)
    : undefined;
}

export function ReportCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <Card
      className={cn(styles.card, className)}
      data-reporte-seccion
      aria-labelledby={id}
    >
      <Card.Header className={styles.cardHeader}>
        <div>
          <Card.Title id={id} data-reporte-titulo>
            {title}
          </Card.Title>
          {description ? (
            <Card.Description>{description}</Card.Description>
          ) : null}
        </div>
        {action}
      </Card.Header>
      <Card.Content className={styles.cardContent}>{children}</Card.Content>
    </Card>
  );
}

export function Metric({
  label,
  value,
  detail,
  delta,
  deltaUnit = "%",
  icon,
  featured,
  hint,
  children,
}: {
  label: string;
  value: string;
  detail: string;
  delta?: number | null;
  deltaUnit?: "%" | "pts";
  icon: ReactNode;
  featured?: boolean;
  hint?: string;
  children?: ReactNode;
}) {
  const theme = useDesignTheme();
  const scope = useDesignScope();
  const deltaText =
    delta != null
      ? `${delta > 0 ? "+" : ""}${delta.toLocaleString("es-AR", { maximumFractionDigits: 1 })}${deltaUnit === "pts" ? " pts" : "%"}`
      : null;
  return (
    <Card
      className={cn(styles.metric, featured && styles.metricFeatured)}
      data-reporte-indicador
    >
      <Card.Header className={styles.metricHeader}>
        <span className={styles.metricIcon} aria-hidden="true">
          {icon}
        </span>
        <Card.Title data-reporte-etiqueta>{label}</Card.Title>
        {hint ? (
          <Tooltip>
            <ActionButton
              isIconOnly
              variant="ghost"
              aria-label={`Información sobre ${label}`}
            >
              <CircleHelpIcon />
            </ActionButton>
            <Tooltip.Content {...scope} className={cn(theme, styles.hint)}>
              {hint}
            </Tooltip.Content>
          </Tooltip>
        ) : null}
      </Card.Header>
      <Card.Content>
        <strong className={styles.metricValue} data-reporte-valor>
          {value}
        </strong>
        {children}
      </Card.Content>
      <Card.Footer className={styles.metricFooter} data-reporte-detalle>
        {deltaText ? (
          <span className={styles.delta} data-positive={delta! >= 0}>
            {delta! >= 0 ? (
              <ArrowUpRightIcon aria-hidden="true" />
            ) : (
              <ArrowDownRightIcon aria-hidden="true" />
            )}
            {deltaText}
          </span>
        ) : null}
        <span>{detail}</span>
      </Card.Footer>
    </Card>
  );
}

export function NoData({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Empty className={styles.empty}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className={styles.emptyMedia}>
          <ChartNoAxesCombinedIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function ReportSource({ meta }: { meta: MetaPanel }) {
  return (
    <footer className={styles.source} data-reporte-fuente>
      <InfoIcon aria-hidden="true" />
      <p>
        <strong>Fuente: </strong>
        {meta.fuente}. {meta.limites.join(" ")}
        {meta.sinComparativa ? " Sin período anterior para comparar." : ""}
      </p>
    </footer>
  );
}
