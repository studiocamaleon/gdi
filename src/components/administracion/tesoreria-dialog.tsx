"use client";

import type { ReactNode } from "react";
import { FormDialog } from "@/components/design-system/form-dialog";
import styles from "./tesoreria-view.module.css";
import { cn } from "@/lib/utils";

/** La misma identidad y estructura para las operaciones de fondos y valores. */
export function TesoreriaDialog({
  open,
  onOpenChange,
  title,
  description,
  seccion = "Administración · Tesorería",
  children,
  className,
  isDismissable = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  seccion?: string;
  children: ReactNode;
  className?: string;
  isDismissable?: boolean;
}) {
  return (
    <FormDialog
      isOpen={open}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      title={
        <>
          <span className={styles.dialogEyebrow}>{seccion}</span>
          {title}
          <span className={styles.titleDot} aria-hidden="true">
            .
          </span>
        </>
      }
      description={description}
      className={cn(styles.dialog, className)}
    >
      {children}
    </FormDialog>
  );
}
