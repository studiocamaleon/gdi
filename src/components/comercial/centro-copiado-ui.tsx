"use client";

import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { Input as BrandInput } from "@heroui/react";
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
      data-slot="button"
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
      data-slot="input"
      className={cn(focus.singleBorder, s.input, className)}
    />
  );
}

type Box = HTMLAttributes<HTMLDivElement>;
export function Card({ className, ...props }: Box) {
  return <div {...props} data-slot="card" className={cn(s.card, className)} />;
}
export function CardHeader({ className, ...props }: Box) {
  return (
    <div
      {...props}
      data-slot="card-header"
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
      data-slot="card-title"
      className={cn(s.cardTitle, className)}
    />
  );
}
export function CardDescription({ className, ...props }: Box) {
  return (
    <div
      {...props}
      data-slot="card-description"
      className={cn(s.description, className)}
    />
  );
}
export function CardContent({ className, ...props }: Box) {
  return (
    <div
      {...props}
      data-slot="card-content"
      className={cn(s.cardContent, className)}
    />
  );
}
export function CardAction({ className, ...props }: Box) {
  return (
    <div
      {...props}
      data-slot="card-action"
      className={cn(s.cardAction, className)}
    />
  );
}
export function CardFooter({ className, ...props }: Box) {
  return (
    <div
      {...props}
      data-slot="card-footer"
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
