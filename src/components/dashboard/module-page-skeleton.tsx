"use client";

import { GrafoprintLoadingIndicator } from "@/components/brand/grafoprint-loading";
import { useNavigationPending } from "@/components/navigation/navigation-feedback";
import theme from "@/components/design-system/theme.module.css";
import styles from "./module-page-skeleton.module.css";

type ModulePageSkeletonProps = { variant?: "table" | "workspace" | "detail" };

export function ModulePageSkeleton({ variant = "table" }: ModulePageSkeletonProps) {
  const navigationPending = useNavigationPending();
  return <section data-ui="heroui" data-appearance="light" className={`${theme.theme} ${styles.page}`}
    aria-label={variant === "detail" ? "Cargando detalle" : "Cargando vista"} aria-busy="true">
    {!navigationPending && <GrafoprintLoadingIndicator />}
  </section>;
}
