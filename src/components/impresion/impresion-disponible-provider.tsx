"use client";
import type { ReactNode } from "react";
import { useImpresionDirecta } from "@/components/navigation/capacidades-provider";
import { DocumentosImpresionProvider } from "./documentos-impresion-provider";
/** Sin capacidad no se monta la cola ni se carga su transporte QZ. */
export function ImpresionDisponibleProvider({
  tenantId,
  children,
}: {
  tenantId: string;
  children: ReactNode;
}) {
  const habilitada = useImpresionDirecta();
  return habilitada ? (
    <DocumentosImpresionProvider key={tenantId} tenantId={tenantId}>
      {children}
    </DocumentosImpresionProvider>
  ) : (
    children
  );
}
