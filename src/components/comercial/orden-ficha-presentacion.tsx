"use client";

import * as React from "react";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import {
  ContactRoundIcon,
  FileCheck2Icon,
  FileIcon,
  PackageIcon,
  FactoryIcon,
  CreditCardIcon,
  ReceiptTextIcon,
  FolderIcon,
  CircleDollarSignIcon,
  HistoryIcon,
  BoxesIcon,
} from "lucide-react";
import { OrdenCampoLabel } from "./orden-workspace";

export type OrdenTab =
  | "datos"
  | "productos"
  | "produccion"
  | "materiales"
  | "pagos"
  | "comprobantes"
  | "archivos"
  | "costos"
  | "historial";

export function OrdenSegmented({
  value,
  onChange,
}: {
  value: "orden" | "presupuesto";
  onChange: (value: "orden" | "presupuesto") => void;
}) {
  return (
    <SegmentedControl
      value={value}
      onChange={(next) => {
        if (next === "orden" || next === "presupuesto") onChange(next);
      }}
      aria-label="Tipo de documento"
      options={[
        {
          value: "orden",
          label: "Orden de trabajo",
          icon: <FileCheck2Icon aria-hidden />,
        },
        {
          value: "presupuesto",
          label: "Presupuesto",
          icon: <FileIcon aria-hidden />,
        },
      ]}
    />
  );
}

export function OrdenTabs({
  count,
  clientePendiente,
  verMargenes,
  historialCount,
  comprobantesCount,
  archivosCount,
  archivosPendientesCount = 0,
  mostrarMateriales = false,
}: {
  count: number;
  clientePendiente: boolean;
  verMargenes: boolean;
  /** Presente sólo en modo orden: agrega el tab Historial. */
  historialCount?: number;
  /** Presente sólo en modo orden: agrega el tab Comprobantes. */
  comprobantesCount?: number;
  /** null hasta que el tab de Archivos se abre y los cuenta. */
  archivosCount?: number | null;
  archivosPendientesCount?: number;
  mostrarMateriales?: boolean;
}) {
  const tabs: Array<{
    key: OrdenTab;
    label: string;
    count?: number;
    icon: React.ReactNode;
  }> = [
    { key: "datos", label: "Datos", icon: <ContactRoundIcon /> },
    { key: "productos", label: "Productos", count, icon: <PackageIcon /> },
    { key: "produccion", label: "Producción", icon: <FactoryIcon /> },
    ...(mostrarMateriales
      ? [
          {
            key: "materiales" as const,
            label: "Materiales",
            icon: <BoxesIcon />,
          },
        ]
      : []),
    { key: "pagos", label: "Pagos", icon: <CreditCardIcon /> },
    ...(comprobantesCount !== undefined
      ? [
          {
            key: "comprobantes" as const,
            label: "Comprobantes",
            icon: <ReceiptTextIcon />,
          },
        ]
      : []),
    {
      key: "archivos",
      label: "Archivos",
      // Sin badge hasta que se sepa el número de verdad: un contador que
      // miente es peor que no tenerlo.
      count: archivosCount ?? undefined,
      icon: <FolderIcon />,
    },
    // El tab Costos es el desglose de lo que le sale a la imprenta: material,
    // máquina, mano de obra. Quien no puede ver márgenes tampoco lo ve — y el
    // API ya le manda la orden sin esos campos, así que el tab estaría vacío.
    ...(verMargenes
      ? [
          {
            key: "costos" as const,
            label: "Costos",
            icon: <CircleDollarSignIcon />,
          },
        ]
      : []),
    ...(historialCount !== undefined
      ? [
          {
            key: "historial" as const,
            label: "Historial",
            count: historialCount,
            icon: <HistoryIcon />,
          },
        ]
      : []),
  ];

  return (
    <NavigationTabList
      variant="detailed"
      tone="graphite"
      label="Secciones de la orden"
      items={tabs.map(({ key, ...item }) => ({
        id: key,
        ...item,
        count: item.count || undefined,
        warning:
          key === "datos" && clientePendiente
            ? "Falta seleccionar un cliente"
            : key === "archivos" && archivosPendientesCount > 0
              ? `${archivosPendientesCount} controles de archivos pendientes`
              : undefined,
        description: {
          datos: "Cliente y entrega",
          productos: "Ítems y cantidades",
          produccion: "Rutas y procesos",
          materiales: "Necesidades del trabajo",
          pagos: "Cobros y facturación",
          archivos: "Adjuntos y versiones",
          costos: "Resumen y margen",
          comprobantes: "Facturas y notas",
          historial: "Actividad de la orden",
        }[key],
      }))}
    />
  );
}

export function FieldCard({
  label,
  icon,
  children,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <OrdenCampoLabel icon={icon}>{label}</OrdenCampoLabel>
      <div className="min-w-0">{children}</div>
      {hint ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}
