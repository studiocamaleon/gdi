"use client";
import * as React from "react";
import { Drawer } from "@heroui/react";
import { XIcon } from "lucide-react";
import * as Legacy from "@/components/ui/sheet";
import { ActionButton } from "@/components/design-system/action-button";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { useNodosVisual } from "./nodos-ui";
import s from "./nodos-editor.module.css";
const SheetContext = React.createContext({
  close: () => {},
  descriptionId: "",
});
export function Sheet({
  open,
  onOpenChange,
  disablePointerDismissal,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disablePointerDismissal?: boolean;
  children: React.ReactNode;
}) {
  const enabled = useNodosVisual();
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const descriptionId = React.useId();
  if (!enabled)
    return (
      <Legacy.Sheet
        open={open}
        onOpenChange={onOpenChange}
        disablePointerDismissal={disablePointerDismissal}
      >
        {children}
      </Legacy.Sheet>
    );
  return (
    <SheetContext.Provider
      value={{ close: () => onOpenChange?.(false), descriptionId }}
    >
      <Drawer.Backdrop
        {...scope}
        className={theme}
        isOpen={open}
        onOpenChange={onOpenChange}
        isDismissable={!disablePointerDismissal}
        variant="opaque"
      >
        {children}
      </Drawer.Backdrop>
    </SheetContext.Provider>
  );
}
export function SheetContent({
  brandClassName,
  ...props
}: React.ComponentProps<typeof Legacy.SheetContent> & {
  brandClassName?: string;
}) {
  const enabled = useNodosVisual();
  const ctx = React.useContext(SheetContext);
  if (!enabled) return <Legacy.SheetContent {...props} />;
  return (
    <Drawer.Content placement="right">
      <Drawer.Dialog
        className={`${s.sheet} ${brandClassName ?? ""}`}
        aria-describedby={ctx.descriptionId}
      >
        {props.children as React.ReactNode}
        {props.showCloseButton !== false && (
          <ActionButton
            className={s.sheetClose}
            variant="ghost"
            isIconOnly
            aria-label="Cerrar"
            onPress={ctx.close}
          >
            <XIcon />
          </ActionButton>
        )}
      </Drawer.Dialog>
    </Drawer.Content>
  );
}
export function SheetHeader(
  props: React.ComponentProps<typeof Legacy.SheetHeader>,
) {
  return useNodosVisual() ? (
    <Drawer.Header {...props} className={s.sheetHeader} />
  ) : (
    <Legacy.SheetHeader {...props} />
  );
}
export function SheetFooter(
  props: React.ComponentProps<typeof Legacy.SheetFooter>,
) {
  return useNodosVisual() ? (
    <Drawer.Footer {...props} className={s.sheetFooter} />
  ) : (
    <Legacy.SheetFooter {...props} />
  );
}
export function SheetTitle(
  props: React.ComponentProps<typeof Legacy.SheetTitle>,
) {
  return useNodosVisual() ? (
    <Drawer.Heading>{props.children as React.ReactNode}</Drawer.Heading>
  ) : (
    <Legacy.SheetTitle {...props} />
  );
}
export function SheetDescription(
  props: React.ComponentProps<typeof Legacy.SheetDescription>,
) {
  const enabled = useNodosVisual();
  const ctx = React.useContext(SheetContext);
  return enabled ? (
    <p id={ctx.descriptionId} className={s.sheetDescription}>
      {props.children as React.ReactNode}
    </p>
  ) : (
    <Legacy.SheetDescription {...props} />
  );
}
