"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

const AmbitoCargasOt = createContext("");

export function useAmbitoCargasOt() {
  return useContext(AmbitoCargasOt);
}

export function CargasOtProvider({
  ambito,
  children,
}: {
  ambito: string;
  children: ReactNode;
}) {
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
  return (
    <AmbitoCargasOt.Provider value={ambito}>{children}</AmbitoCargasOt.Provider>
  );
}
