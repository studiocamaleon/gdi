"use client";

import { Chip } from "@heroui/react";
import { estadoVisual, type Comprobante } from "@/lib/administracion";
import s from "./comprobantes.module.css";

export function ComprobanteEstado({
  comprobante,
}: {
  comprobante: Comprobante;
}) {
  const estado = estadoVisual(comprobante);
  return (
    <Chip
      size="sm"
      variant="soft"
      className={s.status}
      data-state={estado.clave}
    >
      <i aria-hidden />
      {estado.label}
    </Chip>
  );
}

export function ComprobanteLetra({
  comprobante,
}: {
  comprobante: Pick<Comprobante, "letra" | "tipo">;
}) {
  return (
    <span className={s.letter} data-type={comprobante.tipo}>
      {comprobante.letra}
    </span>
  );
}
