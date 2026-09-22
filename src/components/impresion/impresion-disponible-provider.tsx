"use client";
import type { ReactNode } from "react";
import { useColasImpresion } from "@/components/navigation/capacidades-provider";
import { DocumentosImpresionProvider } from "./documentos-impresion-provider";
/** Sin capacidad no se monta la cola ni se carga su transporte QZ. */
export function ImpresionDisponibleProvider({
  tenantId,
  children,
}: {
  tenantId: string;
  children: ReactNode;
}) {
  const habilitada = useColasImpresion();
  return habilitada ? (
    <DocumentosImpresionProvider key={tenantId} tenantId={tenantId}>
      {children}
    </DocumentosImpresionProvider>
  ) : (
    children
  );
}
