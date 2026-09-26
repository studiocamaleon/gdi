"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** El alta de Meta todavía no está implementada. No simular una conexión
 * ni enviar a la configuración de Wati desde este acceso de Meta directo. */
export function InboxBienvenida() {
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
      <EmptyContent>
        <Button size="lg" disabled aria-describedby="inbox-conexion-pendiente">
          <MessageCircle data-icon="inline-start" />
          Conectar WhatsApp
        </Button>
        <p id="inbox-conexion-pendiente" className="text-muted-foreground">
          La conexión de números estará disponible próximamente.
        </p>
      </EmptyContent>
    </Empty>
  );
}
