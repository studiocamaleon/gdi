"use client";
import { createContext, useContext, type ReactNode } from "react";
import { funcionesCompatibles, type ClaveCapacidad } from "@/lib/capacidades";
export type Capacidades = {
  impresionDirecta?: boolean;
  funciones?: Record<string, boolean>;
};
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
export function useFuncionesPlan() {
  return useContext(Contexto).funciones ?? funcionesCompatibles;
}
export function useCapacidad(clave: ClaveCapacidad) {
  return useFuncionesPlan()[clave] === true;
}
