"use client";

import { useId, type ReactNode } from "react";
import { Modal } from "@heroui/react";
import { useDesignScope } from "@/components/design-system/appearance";
import theme from "@/components/design-system/theme.module.css";
import styles from "./form-dialog.module.css";

/** Presentación común de los formularios; sus estados y envíos siguen en cada vista. */
export function FormDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  isDismissable = true,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  isDismissable?: boolean;
}) {
  const scope = useDesignScope();
  const descriptionId = useId();
  return (
    <Modal.Backdrop
      {...scope}
      className={theme.theme}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={!isDismissable}
    >
      <Modal.Container size="lg" className={styles.container}>
        <Modal.Dialog
          className={styles.dialog}
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
