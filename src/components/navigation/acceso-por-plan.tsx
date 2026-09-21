"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { capacidadDeRuta } from "@/lib/capacidades";
import { useFuncionesPlan } from "./capacidades-provider";
import { FuncionNoIncluida } from "./funcion-no-incluida";

export function AccesoPorPlan({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const funciones = useFuncionesPlan();
  const clave = capacidadDeRuta(ruta);
  if (!clave || funciones[clave]) return children;
  return <FuncionNoIncluida />;
}
