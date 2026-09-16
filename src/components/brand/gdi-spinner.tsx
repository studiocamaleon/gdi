import type { SVGProps } from "react";
import { cn } from "@/lib/utils";
import { GrafoprintAnimatedIsologo } from "./grafoprint-loading";

/** Alias para los consumidores anteriores: todos usan el isologo de Grafoprint. */
export function GdiSpinner({ className, size = 16, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return <GrafoprintAnimatedIsologo size={size} className={cn("size-4", className)} {...props} />;
}
