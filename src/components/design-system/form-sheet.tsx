"use client";

import { useId, type ReactNode } from "react";
import { Drawer } from "@heroui/react";
import { X } from "lucide-react";
import { ActionButton } from "./action-button";
import { useDesignScope, useDesignTheme } from "./appearance";
import { cn } from "@/lib/utils";
import s from "./form-sheet.module.css";

/** Hoja lateral de formularios: alcance visual y acciones siempre visibles. */
export function FormSheet({
  title,
  description,
  children,
  footer,
  onClose,
  busy = false,
  className,
}: {
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  busy?: boolean;
  className?: string;
}) {
  const scope = useDesignScope();
  const themeClass = useDesignTheme();
  const descriptionId = useId();
  return (
    <Drawer.Backdrop
      {...scope}
      className={themeClass}
      isOpen
      variant="opaque"
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
    >
      <Drawer.Content placement="right">
        <Drawer.Dialog className={cn(s.dialog, className)} aria-describedby={descriptionId}>
          <Drawer.Header className={s.header}>
            <div>
              <Drawer.Heading>{title}</Drawer.Heading>
              <p id={descriptionId}>{description}</p>
            </div>
            <ActionButton
              variant="ghost"
              isIconOnly
              aria-label="Cerrar"
              isDisabled={busy}
              onPress={onClose}
            >
              <X />
            </ActionButton>
          </Drawer.Header>
          <Drawer.Body className={s.body}>{children}</Drawer.Body>
          {footer && (
            <Drawer.Footer className={s.footer}>{footer}</Drawer.Footer>
          )}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
