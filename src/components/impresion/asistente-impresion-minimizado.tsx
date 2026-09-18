"use client";

import { ArrowUpRight, Bot } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { cn } from "@/lib/utils";
import s from "./colas-impresion.module.css";

/** El provider aporta contexto; esta superficie aplica sus tokens al DOM. */
export function AsistenteImpresionMinimizado({
  total,
  ocupado,
  requiereAtencion,
  onAbrir,
}: {
  total: number;
  ocupado: boolean;
  requiereAtencion: boolean;
  onAbrir: () => void;
}) {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  return (
    <div {...scope} className={cn(theme, s.widget)}>
      <ActionButton
        tone="neutral"
        className={s.widgetTrigger}
        aria-label={`Colas de impresión${total ? ` · ${total}` : ""}`}
        aria-haspopup="dialog"
        onPress={onAbrir}
      >
        <span className={cn(s.bot, s.widgetBot)} data-enviando={ocupado}>
          <Bot aria-hidden="true" />
        </span>
        <span className={s.widgetTexto}>
          <strong>Asistente Grafo</strong>
          <span aria-live="polite">
            {ocupado
              ? "Enviando a las impresoras…"
              : requiereAtencion
                ? "Hay trabajos para revisar"
                : total
                  ? `${total} ${total === 1 ? "trabajo en la cola" : "trabajos en la cola"}`
                  : "Cola de impresión al día"}
          </span>
        </span>
        {total > 0 && <span className={s.widgetCantidad}>{total}</span>}
        <ArrowUpRight aria-hidden="true" className={s.widgetAbrir} />
      </ActionButton>
    </div>
  );
}
