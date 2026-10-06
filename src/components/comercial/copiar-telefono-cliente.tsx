"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";

export function CopiarTelefonoCliente({
  telefono,
}: {
  telefono?: string | null;
}) {
  if (!telefono?.trim()) return null;
  async function copiar() {
    try {
      await navigator.clipboard.writeText(telefono!.trim());
      toast.success("Teléfono copiado.");
    } catch {
      toast.error("No se pudo copiar el teléfono. Volvé a intentarlo.");
    }
  }
  return (
    <ActionButton
      variant="ghost"
      isIconOnly
      aria-label="Copiar teléfono del cliente"
      title={`Copiar teléfono: ${telefono}`}
      onPress={() => void copiar()}
    >
      <CopyIcon />
    </ActionButton>
  );
}
