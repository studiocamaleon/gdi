import type { SVGProps } from "react";
import { GrafoprintIsologo } from "./grafoprint-isologo";
import { cn } from "@/lib/utils";
import styles from "./grafoprint-loading.module.css";

export function GrafoprintAnimatedIsologo({
  className, accentNodes = false, ...props
}: SVGProps<SVGSVGElement> & { size?: number; accentNodes?: boolean }) {
  return <GrafoprintIsologo {...props} className={cn(styles.mark, accentNodes && styles.accentNodes, className)} />;
}

export function GrafoprintLoadingIndicator() {
  return <div role="status" aria-live="polite" className={styles.indicator}>
    <div className={styles.signal} aria-hidden="true">
      <span className={styles.halo} />
      <span className={styles.halo} />
      <GrafoprintAnimatedIsologo size={120} accentNodes className={styles.largeLogo} />
    </div>
    <span className={styles.label}>Cargando vista…</span>
  </div>;
}
