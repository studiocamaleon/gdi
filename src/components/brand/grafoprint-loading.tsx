import type { SVGProps } from "react";
import { GrafoprintIsologo } from "./grafoprint-isologo";
import { cn } from "@/lib/utils";
import styles from "./grafoprint-loading.module.css";

export function GrafoprintAnimatedIsologo({
  className,
  accentNodes = false,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number; accentNodes?: boolean }) {
  return (
    <GrafoprintIsologo
      {...props}
      className={cn(styles.mark, accentNodes && styles.accentNodes, className)}
    />
  );
}

export function GrafoprintLoadingIndicator() {
  return (
    <div role="status" aria-live="polite" className={styles.indicator}>
      <GrafoprintAnimatedIsologo
        size={56}
        accentNodes
        className={styles.pageLogo}
      />
      <span className="sr-only">Cargando vista…</span>
    </div>
  );
}
