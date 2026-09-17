"use client";

import { Button, Tooltip, type ButtonProps } from "@heroui/react";
import styles from "./action-button.module.css";
import { useDesignScope, useDesignTheme } from "./appearance";

/** Base aprobada C/suave/compacto y tooltip con tema incluso en portales.
 * Conserva variantes, estados, refs y className dinámico de HeroUI.
 */
export function ActionButton({
  title,
  className,
  size = "sm",
  variant = "primary",
  isIconOnly,
  tone = "brand",
  ...props
}: ButtonProps & { title?: string; tone?: "brand" | "neutral" }) {
  const scope = useDesignScope();
  const themeClass = useDesignTheme();
  const button = (
    <Button
      {...props}
      size={size}
      variant={variant}
      isIconOnly={isIconOnly}
      data-gdi-tone={tone}
      data-gdi-size={size}
      data-gdi-variant={variant}
      data-gdi-icon-only={isIconOnly || undefined}
      className={(state) =>
        [
          styles.button,
          typeof className === "function" ? className(state) : className,
        ]
          .filter(Boolean)
          .join(" ")
      }
    />
  );
  if (!title) return button;
  return (
    <Tooltip delay={450}>
      {button}
      <Tooltip.Content {...scope} className={themeClass}>
        {title}
      </Tooltip.Content>
    </Tooltip>
  );
}
