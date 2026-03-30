"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ProductoTabSectionProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function ProductoTabSection({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  contentClassName,
}: ProductoTabSectionProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-slate-300/80 bg-background shadow-[0_10px_30px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      <div className="relative border-b border-slate-300/80 bg-[linear-gradient(135deg,rgba(248,250,252,0.96)_0%,rgba(226,232,240,0.92)_36%,rgba(241,245,249,0.94)_100%)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(148,163,184,0.18)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(0,0,0,0)_0%,rgba(255,255,255,0.95)_22%,rgba(255,255,255,0.95)_78%,rgba(0,0,0,0)_100%)]" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-[linear-gradient(180deg,rgba(0,173,239,0.95)_0%,rgba(237,28,36,0.9)_34%,rgba(255,242,0,0.88)_67%,rgba(0,0,0,0.75)_100%)]" />
        <div className="pointer-events-none absolute right-3 top-2 h-10 w-24 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0.16)_48%,rgba(255,255,255,0)_74%)] blur-md" />
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              {Icon ? <Icon className="size-4 text-slate-700" /> : null}
              <h3 className="text-sm font-semibold tracking-[0.01em] text-slate-900">{title}</h3>
            </div>
            {description ? <p className="text-sm text-slate-600">{description}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
      <div className={cn("p-4", contentClassName)}>{children}</div>
    </section>
  );
}
