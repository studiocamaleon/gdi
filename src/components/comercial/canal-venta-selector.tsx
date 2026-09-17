"use client";

import { IconChoiceGroup } from "@/components/design-system/choice-controls";
import {
  GlobeIcon,
  PackageIcon,
  MailIcon,
  MessageCircleIcon,
  SmartphoneIcon,
  StoreIcon,
} from "lucide-react";
import {
  CANALES_VENTA,
  esCanalVentaActivo,
  nombreCanalVenta,
} from "@/lib/canales-venta";
import { OrdenCampoLabel } from "./orden-workspace";

const iconos = {
  whatsapp: MessageCircleIcon,
  mostrador: StoreIcon,
  email: MailIcon,
  web: GlobeIcon,
  app_movil: SmartphoneIcon,
};
export function CanalVentaSelector({
  id,
  value,
  onChange,
  invalid = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const historical = !!value && !esCanalVentaActivo(value);
  return (
    <div id={id} className="flex flex-col gap-2">
      <OrdenCampoLabel id={labelId} icon={<PackageIcon />}>
        Canal de venta
      </OrdenCampoLabel>
      <IconChoiceGroup
        value={value}
        onChange={onChange}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        aria-invalid={invalid || undefined}
        options={CANALES_VENTA.map((canal) => {
          const Icon = iconos[canal.value];
          return { ...canal, icon: <Icon aria-hidden /> };
        })}
      />
      <p
        id={descriptionId}
        role={invalid ? "alert" : undefined}
        className={
          invalid ? "text-xs text-danger" : "text-xs text-muted-foreground"
        }
      >
        {invalid
          ? "Elegí un canal de venta para guardar."
          : historical
            ? `${nombreCanalVenta(value)} · Canal histórico`
            : value
              ? nombreCanalVenta(value)
              : "Elegí por dónde llegó el pedido."}
      </p>
    </div>
  );
}
