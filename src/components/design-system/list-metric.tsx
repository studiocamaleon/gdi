"use client";

import { Card } from "@heroui/react";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import s from "./list-page.module.css";

/** Indicador visual compartido: la vista calcula el valor y define la acción. */
export function ListMetric({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  onClick,
  selected,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  tone?: "neutral" | "danger" | "brand";
  onClick?: () => void;
  selected?: boolean;
}) {
  const content = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className={s.kpiLabel}>{label}</span>
        <span className={s.kpiIcon}>
          <Icon size={17} aria-hidden />
        </span>
      </span>
      <strong className={s.kpiValue}>{value}</strong>
      <span className={s.kpiHint}>
        {hint}
        {onClick && <ArrowUpRight size={14} aria-hidden />}
      </span>
    </>
  );
  return onClick ? (
    <Card<"button">
      render={(props) => <button {...props} />}
      type="button"
      className={s.kpi}
      data-tone={tone}
      aria-pressed={selected}
      onClick={onClick}
    >
      {content}
    </Card>
  ) : (
    <Card className={s.kpi} data-tone={tone}>
      {content}
    </Card>
  );
}
