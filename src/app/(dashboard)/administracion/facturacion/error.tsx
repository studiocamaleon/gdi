"use client";

import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import listPage from "@/components/design-system/list-page.module.css";
import s from "@/components/administracion/facturacion.module.css";

export default function FacturacionError({ reset }: { reset: () => void }) {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  return (
    <section {...scope} className={`${theme} ${listPage.page} ${s.page}`}>
      <Empty className={s.empty} role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircleIcon />
          </EmptyMedia>
          <EmptyTitle>No pudimos cargar las órdenes para facturar</EmptyTitle>
          <EmptyDescription>
            Reintentá para consultar los importes actualizados.
          </EmptyDescription>
        </EmptyHeader>
        <ActionButton variant="outline" onPress={reset}>
          <RefreshCwIcon aria-hidden />
          Reintentar
        </ActionButton>
      </Empty>
    </section>
  );
}
