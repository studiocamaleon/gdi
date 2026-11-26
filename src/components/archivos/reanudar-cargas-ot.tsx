"use client";

import { useEffect } from "react";

export function ReanudarCargasOt({ ambito }: { ambito: string }) {
  useEffect(() => {
    if (!ambito) return;
    const reanudar = () =>
      void import("@/lib/archivos-emision").then((m) =>
        m.procesarAdjuntos(ambito, true),
      );
    reanudar();
    window.addEventListener("online", reanudar);
    return () => window.removeEventListener("online", reanudar);
  }, [ambito]);
  return null;
}
