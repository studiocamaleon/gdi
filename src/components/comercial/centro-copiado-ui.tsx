"use client";

import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { Input as BrandInput, Alert as BrandAlert, Chip } from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import { DialogContent as PrimitiveDialogContent } from "@/components/ui/dialog";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { cn } from "@/lib/utils";
import focus from "@/components/design-system/field-focus.module.css";
import s from "./centro-copiado-ui.module.css";

type ButtonProps = Omit<
  ComponentProps<typeof ActionButton>,
  | "variant"
  | "size"
  | "isDisabled"
  | "isIconOnly"
  | "className"
  | "children"
  | "onClick"
  | "render"
> & {
  variant?:
    | "default"
    | "brand"
    | "outline"
    | "secondary"
    | "ghost"
    | "destructive"
    | "link"
    | "sidebar";
  size?:
    | "default"
    | "sm"
    | "lg"
    | "xs"
    | "icon"
    | "icon-sm"
    | "icon-lg"
    | "icon-xs";
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  onClick?: () => void;
};

/** Acciones de la marca conservando el contrato de los editores de copiado. */
export function Button({
  variant = "default",
  size = "default",
  disabled,
  loading,
  loadingText,
  children,
  onClick,
  className,
  ...props
}: ButtonProps) {
  return (
    <ActionButton
      {...props}
      variant={
        variant === "default" || variant === "brand"
          ? "primary"
          : variant === "destructive"
            ? "danger-soft"
            : variant === "link"
              ? "ghost"
              : variant === "sidebar"
                ? "outline"
                : variant
      }
      size={size === "lg" || size === "icon-lg" ? "md" : "sm"}
      isIconOnly={size.startsWith("icon")}
      isDisabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
      className={className}
    >
      {loading && <GdiSpinner />}
      {loading && loadingText ? loadingText : children}
    </ActionButton>
  );
}

export function Input({
  className,
  ...props
}: ComponentProps<typeof BrandInput>) {
  return (
    <BrandInput
      {...props}
      className={cn(focus.singleBorder, s.input, className)}
    />
  );
}

type Box = HTMLAttributes<HTMLDivElement>;
export function Card({ className, ...props }: Box) {
  return (
    <div {...props} data-copiado="card" className={cn(s.card, className)} />
  );
}
export function CardHeader({ className, ...props }: Box) {
  return (
    <div
      {...props}
      data-copiado="card-header"
      className={cn(s.cardHeader, className)}
    />
  );
}
export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      {...props}
      data-copiado="card-title"
      className={cn(s.cardTitle, className)}
    />
  );
}
export function CardDescription({ className, ...props }: Box) {
  return (
    <div
      {...props}
      data-copiado="card-description"
      className={cn(s.description, className)}
    />
  );
}
export function CardContent({ className, ...props }: Box) {
  return (
    <div
      {...props}
      data-copiado="card-content"
      className={cn(s.cardContent, className)}
    />
  );
}
export function CardAction({ className, ...props }: Box) {
  return (
    <div
      {...props}
      data-copiado="card-action"
      className={cn(s.cardAction, className)}
    />
  );
}
export function CardFooter({ className, ...props }: Box) {
  return (
    <div
      {...props}
      data-copiado="card-footer"
      className={cn(s.cardFooter, className)}
    />
  );
}

/** El portal recibe su propio alcance visual; no depende del CSS de la página. */
export function DialogContent({
  className,
  ...props
}: ComponentProps<typeof PrimitiveDialogContent>) {
  return (
    <PrimitiveDialogContent {...props} className={cn(s.dialog, className)} />
  );
}

/** Avisos con jerarquía y acción propia, dentro del sistema visual de GRAFO. */
export function AvisoCopiado({
  titulo,
  children,
  icono,
  accion,
  tono = "neutral",
}: {
  titulo: ReactNode;
  children: ReactNode;
  icono: ReactNode;
  accion?: ReactNode;
  tono?: "neutral" | "brand" | "warning" | "danger";
}) {
  return (
    <BrandAlert
      status={
        tono === "danger"
          ? "danger"
          : tono === "warning"
            ? "warning"
            : "default"
      }
      className={s.notice}
      data-tone={tono}
    >
      <BrandAlert.Indicator className={s.noticeIcon}>
        {icono}
      </BrandAlert.Indicator>
      <BrandAlert.Content className={s.noticeContent}>
        <BrandAlert.Title className={s.noticeTitle}>{titulo}</BrandAlert.Title>
        <BrandAlert.Description className={s.noticeDescription}>
          {children}
        </BrandAlert.Description>
      </BrandAlert.Content>
      {accion && <div className={s.noticeAction}>{accion}</div>}
    </BrandAlert>
  );
}
export function EstadoCopiado({
  children,
  tono = "neutral",
}: {
  children: ReactNode;
  tono?: "neutral" | "brand" | "warning" | "success";
}) {
  return (
    <Chip size="sm" variant="soft" className={s.status} data-tone={tono}>
      <Chip.Label>{children}</Chip.Label>
    </Chip>
  );
}
