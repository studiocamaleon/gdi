"use client";

/**
 * <LabelConTooltip /> — Label con icono ⓘ que muestra una descripción al hover.
 *
 * Uso:
 *   <LabelConTooltip
 *     label="Activación"
 *     tooltip="Decide cuándo se ejecuta el paso..."
 *     ejemplo="Pre-prensa siempre va, laminado lo elige el comercial."
 *     htmlFor="modo-activacion"
 *   />
 *
 * Si solo pasás `label`, se renderiza como un Label normal (compat con shadcn).
 * Si pasás `tooltip`, agrega el icono y el popover con el texto.
 */

import * as React from "react";
import { InfoIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LabelConTooltipProps extends React.ComponentProps<typeof Label> {
  /** Texto visible al lado del control. */
  label: React.ReactNode;
  /** Descripción larga que se muestra al pasar el cursor por el icono ⓘ. */
  tooltip?: string;
  /** Caso de uso concreto para que el modelador entienda cuándo usar. */
  ejemplo?: string;
  /** Marca el campo como obligatorio (asterisco rojo). */
  required?: boolean;
  /** Tamaño del icono. */
  iconSize?: "sm" | "md";
}

export function LabelConTooltip({
  label,
  tooltip,
  ejemplo,
  required,
  iconSize = "sm",
  className,
  ...labelProps
}: LabelConTooltipProps) {
  const sizeClass = iconSize === "md" ? "size-4" : "size-3.5";

  if (!tooltip) {
    return (
      <Label className={className} {...labelProps}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <Label {...labelProps}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <TooltipProvider delay={150}>
        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <button
                {...props}
                type="button"
                className="text-muted-foreground hover:text-foreground inline-flex items-center"
                aria-label="Más información"
              >
                <InfoIcon className={sizeClass} />
              </button>
            )}
          />
          <TooltipContent side="top" className="max-w-xs space-y-1.5 p-3 text-xs leading-snug">
            <p>{tooltip}</p>
            {ejemplo && (
              <p className="text-muted-foreground border-t pt-1.5 italic">
                <strong className="not-italic">Ejemplo:</strong> {ejemplo}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
