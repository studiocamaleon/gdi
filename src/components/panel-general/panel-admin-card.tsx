"use client";
import type { ReactNode } from "react";
import { Card } from "@heroui/react";
import { CheckCircle2, type LucideIcon } from "lucide-react";
import s from "./panel-admin-view.module.css";

export function PanelCard({
  titulo,
  descripcion,
  icono: Icono,
  accion,
  className,
  children,
}: {
  titulo: string;
  descripcion?: string;
  icono?: LucideIcon;
  accion?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={[s.card, className].filter(Boolean).join(" ")}
      aria-label={titulo}
    >
      <div className={s.cardHead}>
        {Icono && <Icono size={19} aria-hidden />}
        <div className="min-w-0 flex-1">
          <h2>{titulo}</h2>
          {descripcion && <p>{descripcion}</p>}
        </div>
        {accion}
      </div>
      {children}
    </Card>
  );
}

export function Empty({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className={s.empty}>
      <CheckCircle2 size={24} aria-hidden />
      <strong>{titulo}</strong>
      <p>{children}</p>
    </div>
  );
}
