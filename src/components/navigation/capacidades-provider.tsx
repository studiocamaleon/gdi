"use client";
import { createContext, useContext, type ReactNode } from "react";
export type Capacidades = { impresionDirecta?: boolean };
const Contexto = createContext<Capacidades>({});
export function CapacidadesProvider({
  capacidades,
  children,
}: {
  capacidades?: Capacidades;
  children: ReactNode;
}) {
  return (
    <Contexto.Provider value={capacidades ?? {}}>{children}</Contexto.Provider>
  );
}
export function useImpresionDirecta() {
  return useContext(Contexto).impresionDirecta === true;
}
