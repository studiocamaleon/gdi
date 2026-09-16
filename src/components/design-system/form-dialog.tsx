"use client";

import { useId, type ReactNode } from "react";
import { Modal } from "@heroui/react";
import { useDesignScope, useDesignTheme } from "@/components/design-system/appearance";
import styles from "./form-dialog.module.css";
import { cn } from "@/lib/utils";

/** Presentación común de los formularios; sus estados y envíos siguen en cada vista. */
export function FormDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  isDismissable = true,
  className,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  isDismissable?: boolean;
  className?: string;
}) {
  const scope = useDesignScope();
  const themeClass = useDesignTheme();
  const descriptionId = useId();
  return (
    <Modal.Backdrop
      {...scope}
      className={themeClass}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={!isDismissable}
    >
      <Modal.Container size="lg" className={styles.container}>
        <Modal.Dialog
          className={cn(styles.dialog, className)}
          aria-describedby={descriptionId}
        >
          <Modal.CloseTrigger
            aria-label="Cerrar"
            className={styles.close}
            isDisabled={!isDismissable}
          />
          <Modal.Header className={styles.header}>
            <Modal.Heading>{title}</Modal.Heading>
            <p id={descriptionId}>{description}</p>
          </Modal.Header>
          {children}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
