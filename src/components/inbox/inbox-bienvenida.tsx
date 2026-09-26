"use client";

import { MessageCircle } from "lucide-react";
import { InboxConexion } from "./inbox-conexion";
import type { InboxIdentidad } from "@/lib/meta-inbox-api";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function InboxBienvenida({ identidad }: { identidad: InboxIdentidad }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageCircle aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle role="heading" aria-level={2}>
          Tu WhatsApp, dentro de Grafo
        </EmptyTitle>
        <EmptyDescription>
          Conectá el número de tu empresa para reunir tus conversaciones y
          atender a tus clientes desde un solo lugar.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-2xl">
        <InboxConexion
          key={`${identidad.empresaId}:${identidad.usuarioId}`}
          identidad={identidad}
        />
      </EmptyContent>
    </Empty>
  );
}
