"use client";
import { useId, type ReactNode } from "react";
import { Modal } from "@heroui/react";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import styles from "../maquinaria.module.css";

export function MaquinariaDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  isDismissable = true,
  wide = false,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  isDismissable?: boolean;
  wide?: boolean;
}) {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const descriptionId = useId();
  return (
    <Modal.Backdrop
      {...scope}
      className={theme}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={!isDismissable}
    >
      <Modal.Container
        size="lg"
        className={wide ? styles.wideModal : styles.modalContainer}
      >
        <Modal.Dialog
          className={`${styles.modal} ${wide ? styles.modalWideDialog : ""}`}
          aria-describedby={descriptionId}
        >
          <Modal.CloseTrigger
            className={styles.modalClose}
            aria-label="Cerrar"
            isDisabled={!isDismissable}
          />
          <Modal.Header className={styles.modalHeader}>
            <span className={styles.dialogEyebrow}>
              Maquinaria · Configuración
            </span>
            <Modal.Heading>
              {title}
              <span className={styles.titleDot}>.</span>
            </Modal.Heading>
            <p id={descriptionId}>{description}</p>
          </Modal.Header>
          {children}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
