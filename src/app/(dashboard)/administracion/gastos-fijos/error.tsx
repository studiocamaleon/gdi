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
import styles from "@/components/costos/gastos-fijos.module.css";

export default function GastosFijosError({ reset }: { reset: () => void }) {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  return (
    <section
      {...scope}
      data-visual="brand"
      className={`${theme} ${listPage.page} ${styles.page}`}
    >
      <Empty className={styles.empty} role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircleIcon />
          </EmptyMedia>
          <EmptyTitle>No pudimos cargar los gastos fijos</EmptyTitle>
          <EmptyDescription>
            Reintentá para consultar los importes y las vigencias de tu estructura.
          </EmptyDescription>
        </EmptyHeader>
        <ActionButton variant="outline" onPress={reset}>
          <RefreshCwIcon aria-hidden /> Reintentar
        </ActionButton>
      </Empty>
    </section>
  );
}
