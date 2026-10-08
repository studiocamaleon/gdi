"use client";
import { ArrowLeftIcon } from "lucide-react";
import { FacturacionLotes } from "./facturacion-lotes";
import { ActionLink } from "@/components/design-system/action-link";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import list from "@/components/design-system/list-page.module.css";
import s from "./facturacion.module.css";

export function FacturacionHistorial() {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  return (
    <section {...scope} className={`${theme} ${list.page} ${s.page}`}>
      <header className={list.header}>
        <div>
          <p className={s.eyebrow}>
            Administración · Seguimiento de facturación
          </p>
          <h1>
            Historial de lotes<span className={s.dot}>.</span>
          </h1>
          <p className={list.subtitle}>
            Tus facturas, sus envíos y cualquier observación, en un solo lugar.
          </p>
        </div>
        <ActionLink variant="outline" href="/administracion/facturacion">
          <ArrowLeftIcon aria-hidden /> Volver a facturar
        </ActionLink>
      </header>
      <FacturacionLotes historial />
    </section>
  );
}
