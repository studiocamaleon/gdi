"use client";

/**
 * Escucha el lector 2D en TODA la zona autenticada: el cliente llega al
 * mostrador con su QR, el operador escanea esté donde esté en el sistema y
 * se abre la entrega encima de lo que estaba haciendo.
 *
 * Sólo reacciona a códigos con forma de número de orden (OT-2026-0184). Ese
 * filtro es lo que evita pisarse con el escaneo de CUPONES, que vive en la
 * ficha de la propuesta y usa códigos libres: los dos listeners escuchan el
 * mismo teclado y cada uno se queda con lo suyo.
 */

import * as React from "react";

import { useEscaneoCodigo } from "@/lib/use-escaneo-codigo";
import { EntregaModal } from "./entrega-modal";

/** OT-2026-0184. Tolera minúsculas y espacios de más del lector. */
const NUMERO_ORDEN = /^OT-\d{4}-\d+$/i;

export function EntregaEscaneoWatcher() {
  const [codigo, setCodigo] = React.useState<string | null>(null);

  useEscaneoCodigo({
    // Con el modal abierto se apaga: el segundo escaneo tendría que
    // reemplazar la orden en pantalla y eso confunde más de lo que ayuda.
    activo: codigo == null,
    onCodigo: (leido) => {
      const limpio = leido.trim().toUpperCase();
      if (!NUMERO_ORDEN.test(limpio)) return;
      setCodigo(limpio);
    },
  });

  if (!codigo) return null;
  return <EntregaModal codigo={codigo} onClose={() => setCodigo(null)} />;
}
