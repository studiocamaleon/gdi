import { cn } from "@/lib/utils";
import s from "./grafoprint-brand.module.css";

/** Misma marca de tres nodos, proporciones y punto que apps/marketing. */
export function GrafoprintBrand({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn(s.brand, className)} role="img" aria-label="Grafoprint">
      <span className={s.mark}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5.5 6.5H18L12 17.5Z" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="5.5" cy="6.5" r="2.2" fill="currentColor" />
          <circle cx="18" cy="6.5" r="2.2" fill="currentColor" />
          <circle cx="12" cy="17.5" r="2.2" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span aria-hidden="true">grafoprint<span className={s.period}>.</span></span>
      )}
    </span>
  );
}
