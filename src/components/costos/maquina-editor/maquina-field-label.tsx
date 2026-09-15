"use client";
import type { ReactNode } from "react";
import { Tooltip } from "@heroui/react";
import { InfoIcon } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { useDesignScope } from "@/components/design-system/appearance";
import theme from "@/components/design-system/theme.module.css";

export function MaquinaFieldLabel({
  label,
  required,
  tooltip,
  htmlFor,
  iconSize = "sm",
}: {
  label: ReactNode;
  required?: boolean;
  tooltip?: string;
  htmlFor?: string;
  iconSize?: "sm" | "md";
}) {
  const scope = useDesignScope();
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {tooltip && (
        <Tooltip delay={200}>
          <ActionButton
            variant="ghost"
            isIconOnly
            aria-label={`Información sobre ${label}`}
            className="!size-5 !min-w-5"
          >
            <InfoIcon size={iconSize === "md" ? 16 : 14} />
          </ActionButton>
          <Tooltip.Content
            {...scope}
            className={`${theme.theme} max-w-xs text-xs leading-relaxed`}
          >
            {tooltip}
          </Tooltip.Content>
        </Tooltip>
      )}
    </div>
  );
}
