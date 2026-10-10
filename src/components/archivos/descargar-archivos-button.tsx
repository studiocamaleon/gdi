"use client";

import { useRef, useState } from "react";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { apiRequest } from "@/lib/api";

export function DescargarArchivosButton({
  tipo,
  id,
  disabled = false,
}: {
  tipo: "orden" | "item";
  id: string;
  disabled?: boolean;
}) {
  const [preparando, setPreparando] = useState(false);
  const ocupado = useRef(false);
  async function descargar() {
    if (ocupado.current || disabled) return;
    ocupado.current = true;
    setPreparando(true);
    const ruta = `/archivos/de-${tipo}/${encodeURIComponent(id)}/zip`;
    try {
      await apiRequest(`${ruta}?comprobar=1`);
      // El navegador escribe el stream a disco; no retenemos el ZIP en RAM.
      const link = document.createElement("a");
      link.href = `/api/backend${ruta}`;
      link.download = "archivos.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(
        "Descarga iniciada. Podés seguirla en las descargas del navegador.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo preparar la descarga.",
      );
    } finally {
      ocupado.current = false;
      setPreparando(false);
    }
  }
  return (
    <ActionButton
      variant="outline"
      isDisabled={disabled || preparando}
      onPress={() => void descargar()}
    >
      <DownloadIcon /> {preparando ? "Preparando descarga…" : "Descargar todo"}
    </ActionButton>
  );
}
