"use client";
import { useEffect, useState } from "react";
import { cargarArchivoInbox } from "@/lib/inbox-archivo-temporal";
import type { AbrirAdjuntoInbox, ArchivoInbox } from "@/lib/meta-inbox-api";
const inicial = { archivo: null, url: null, error: false, progreso: 0 };
export function useInboxArchivo(
  mensajeId: string,
  abrir: AbrirAdjuntoInbox,
  mimeEsperado?: string,
) {
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState<{
    archivo: ArchivoInbox | null;
    url: string | null;
    error: boolean;
    progreso: number;
    mensajeId: string;
    abrir: AbrirAdjuntoInbox;
    mimeEsperado?: string;
    intento: number;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    const base = { ...inicial, mensajeId, abrir, mimeEsperado, intento };
    const cargar = async () => {
      try {
        const result = await cargarArchivoInbox(
          mensajeId,
          abrir,
          AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]),
          (progreso) => {
            if (!controller.signal.aborted) setEstado({ ...base, progreso });
          },
          mimeEsperado,
        );
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(result.blob);
        setEstado({ ...base, archivo: result.archivo, url, progreso: 100 });
      } catch {
        if (!controller.signal.aborted) setEstado({ ...base, error: true });
      }
    };
    void cargar();
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [mensajeId, abrir, intento, mimeEsperado]);
  // Nunca mostrar el archivo de otra solicitud durante una transición.
  const actual =
    estado?.mensajeId === mensajeId &&
    estado.abrir === abrir &&
    estado.mimeEsperado === mimeEsperado &&
    estado.intento === intento
      ? estado
      : inicial;
  return { ...actual, reintentar: () => setIntento((i) => i + 1) };
}
