"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonVariants, type ButtonVariants } from "@heroui/react";
import styles from "./action-button.module.css";

/** Navegación con la misma base visual de ActionButton, conservando un enlace. */
export function ActionLink({
  className,
  size = "sm",
  variant = "primary",
  ...props
}: ComponentProps<typeof Link> & Pick<ButtonVariants, "size" | "variant">) {
  return (
    <Link
      {...props}
      data-gdi-tone="brand"
      data-gdi-size={size}
      data-gdi-variant={variant}
      className={[buttonVariants({ size, variant }), styles.button, className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
