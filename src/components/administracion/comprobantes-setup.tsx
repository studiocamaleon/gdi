"use client";
import { Settings2Icon } from "lucide-react";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { ActionLink } from "@/components/design-system/action-link";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import listPage from "@/components/design-system/list-page.module.css";
import s from "./comprobantes.module.css";

export function ComprobantesSetup({
  motivo,
  cta,
}: {
  motivo: string;
  cta: string;
}) {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  return (
    <section {...scope} className={`${theme} ${listPage.page} ${s.page}`}>
      <Empty className={s.empty}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Settings2Icon />
          </EmptyMedia>
          <EmptyTitle>Falta configurar la facturación</EmptyTitle>
          <EmptyDescription>{motivo}</EmptyDescription>
        </EmptyHeader>
        <ActionLink href="/configuracion/datos-fiscales">{cta}</ActionLink>
      </Empty>
    </section>
  );
}
