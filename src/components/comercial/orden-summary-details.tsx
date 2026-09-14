"use client";

import { CalendarDays, Folder, Pencil, User } from "lucide-react";
import { Avatar } from "@heroui/react";
import type { ReactNode } from "react";
import { ActionButton } from "@/components/design-system/action-button";
import s from "./orden-summary-details.module.css";

/** Resumen de lectura: la edición mantiene sus controles en Datos. */
export function OrdenSummaryDetails({
  cliente,
  campana,
  fecha,
  vendedor,
  onShowData,
  children,
}: {
  cliente?: string;
  campana?: string;
  fecha: string;
  vendedor: string;
  onShowData: () => void;
  children: ReactNode;
}) {
  const initials = vendedor
    .split(/\s+/)
    .filter(Boolean)
    .filter((_, i, parts) => i === 0 || i === parts.length - 1)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <>
      <h2 className={s.title}>Resumen de la orden</h2>
      <dl className={s.details}>
        <div className={s.field}>
          <User aria-hidden />
          <div>
            <dt>Cliente</dt>
            <dd>{cliente || "—"}</dd>
          </div>
        </div>
        {campana && (
          <div className={s.field}>
            <Folder aria-hidden />
            <div>
              <dt>Campaña</dt>
              <dd>{campana}</dd>
            </div>
          </div>
        )}
        <div className={s.field}>
          <CalendarDays aria-hidden />
          <div>
            <dt>Fecha de entrega</dt>
            <dd className={s.date}>
              <span>{fecha}</span>
              <ActionButton
                variant="ghost"
                isIconOnly
                aria-label="Ver datos de entrega"
                onPress={onShowData}
              >
                <Pencil />
              </ActionButton>
            </dd>
          </div>
        </div>
        <div className={s.field}>
          <User aria-hidden />
          <div>
            <dt>Vendedor</dt>
            <dd className={s.seller}>
              <Avatar size="sm" className={s.avatar}>
                <Avatar.Fallback>{initials}</Avatar.Fallback>
              </Avatar>
              <span>{vendedor}</span>
            </dd>
          </div>
        </div>
      </dl>
      {children}
    </>
  );
}
