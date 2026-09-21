"use client";

import type { ReactNode } from "react";
import { FormDialog } from "@/components/design-system/form-dialog";
import styles from "./tesoreria-view.module.css";

/** La misma identidad y estructura para las operaciones de fondos y valores. */
export function TesoreriaDialog({
  open,
  onOpenChange,
  title,
  description,
  seccion = "Administración · Tesorería",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  seccion?: string;
  children: ReactNode;
}) {
  return (
    <FormDialog
      isOpen={open}
      onOpenChange={onOpenChange}
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
      className={styles.dialog}
    >
      {children}
    </FormDialog>
  );
}
