"use client";

import * as React from "react";
import { GlobeIcon, PackageIcon, MailIcon, MessageCircleIcon, SmartphoneIcon, StoreIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { CANALES_VENTA, esCanalVentaActivo, nombreCanalVenta } from "@/lib/canales-venta";
import theme from "@/components/ui/workspace-theme.module.css";
import { OrdenCampoLabel } from "./orden-workspace";
import { cn } from "@/lib/utils";
import s from "./canal-venta-selector.module.css";

const iconos = {
  whatsapp: MessageCircleIcon,
  mostrador: StoreIcon,
  email: MailIcon,
  web: GlobeIcon,
  app_movil: SmartphoneIcon,
};

export function CanalVentaSelector({ id, value, onChange, invalid = false }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const labelId = `${id}-label`;
  const historicoId = `${id}-historico`;
  const esHistorico = !!value && !esCanalVentaActivo(value);
  const errorId = `${id}-error`;
  return (
    <Field className={cn(theme.theme, s.field)} data-invalid={invalid || undefined}>
      <OrdenCampoLabel id={labelId} icon={<PackageIcon />}>Canal de venta</OrdenCampoLabel>
      <ToggleGroup id={id} value={esCanalVentaActivo(value) ? [value] : []}
        onValueChange={(values) => { if (values[0]) onChange(values[0]); }}
        multiple={false} variant="outline" size="lg" spacing={1}
        aria-labelledby={labelId} aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : esHistorico ? historicoId : undefined}
        className={s.options}>
        {CANALES_VENTA.map((canal) => {
          const Icon = iconos[canal.value];
          return (
            <Tooltip key={canal.value}>
              <TooltipTrigger render={<ToggleGroupItem value={canal.value} aria-label={canal.label} />}>
                <Icon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>{canal.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </ToggleGroup>
      {invalid ? (
        <FieldError id={errorId}>Elegí un canal de venta para guardar.</FieldError>
      ) : esHistorico ? (
        <FieldDescription id={historicoId}>
          {nombreCanalVenta(value)} · Canal histórico
        </FieldDescription>
      ) : null}
    </Field>
  );
}
