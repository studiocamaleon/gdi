"use client";

import type { CSSProperties, ReactNode } from "react";
import { Tabs } from "@heroui/react";
import { TriangleAlertIcon } from "lucide-react";
import styles from "./navigation-tab-list.module.css";

/** T2: navegación horizontal. El estado y los permisos pertenecen a la vista. */
export function NavigationTabList({
  items,
  label,
  className,
  variant = "compact",
}: {
  items: readonly {
    id: string;
    label: string;
    icon?: ReactNode;
    count?: number;
    description?: string;
    warning?: string;
  }[];
  label: string;
  className?: string;
  variant?: "compact" | "detailed";
}) {
  // La variante de ficha distribuye las pestañas en filas; no necesita un scroller.
  const Container = variant === "detailed" ? "div" : Tabs.ListContainer;
  return (
    <Container
      data-variant={variant}
      className={[styles.container, className].filter(Boolean).join(" ")}
      style={
        {
          "--tab-count": items.length,
          "--tab-columns-narrow": Math.ceil(items.length / 2),
        } as CSSProperties
      }
    >
      <Tabs.List aria-label={label} className={styles.list}>
        {items.map((item) => (
          <Tabs.Tab
            key={item.id}
            id={item.id}
            aria-label={[
              item.count != null ? `${item.label} ${item.count}` : item.label,
              item.warning,
            ]
              .filter(Boolean)
              .join(" · ")}
            className={styles.tab}
          >
            {item.icon}
            <span className={styles.label}>
              <span>{item.label}</span>
              {variant === "detailed" && item.description && (
                <span className={styles.description}>{item.description}</span>
              )}
            </span>
            {item.warning && (
              <span
                className={styles.warning}
                aria-hidden="true"
                title={item.warning}
              >
                <TriangleAlertIcon />
              </span>
            )}
            {item.count != null && (
              <span className={styles.count}>{item.count}</span>
            )}
            {variant === "compact" && (
              <Tabs.Indicator className={styles.indicator} />
            )}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Container>
  );
}
