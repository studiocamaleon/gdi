"use client";
import { createContext, useContext } from "react";
export const ContextoImpresion = createContext<{
  tenantId: string;
  abrir: (id: string, enviar?: boolean) => void;
}>({ tenantId: "", abrir: () => {} });
export const useImpresionDocumentos = () => useContext(ContextoImpresion);
