"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useModuleLoading } from "@/components/navigation/navigation-feedback";
import theme from "@/components/design-system/brand-theme.module.css";
import styles from "./module-page-skeleton.module.css";

type ModulePageSkeletonProps = { variant?: "table" | "workspace" | "detail" };

export function ModulePageSkeleton({
  variant = "table",
}: ModulePageSkeletonProps) {
  useModuleLoading();
  return (
    <section
      data-ui="heroui"
      className={`${theme.theme} ${styles.page}`}
      aria-label={variant === "detail" ? "Cargando detalle" : "Cargando vista"}
      aria-busy="true"
    >
      <div aria-hidden="true" className={styles.placeholder}>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton className="mt-6 h-10 w-full" />
        {Array.from({ length: variant === "detail" ? 4 : 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </section>
  );
}
