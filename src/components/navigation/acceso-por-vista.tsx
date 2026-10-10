"use client";
import { usePathname } from "next/navigation";
import { vistaDeRuta } from "@/lib/permisos-rutas";
import { usePuedeFn } from "./permisos-provider";
import { SinPermiso } from "./sin-permiso";
export function AccesoPorVista({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  const vista = vistaDeRuta(ruta);
  const puede = usePuedeFn();
  if (ruta === "/comercial/crear-propuesta")
    return puede("comercial.ordenes.gestionar") ||
      puede("comercial.presupuestos.gestionar") ? (
      <>{children}</>
    ) : (
      <SinPermiso modulo="crear órdenes o presupuestos" />
    );
  if (
    ruta.startsWith("/produccion/ordenes/") &&
    puede("produccion.tablero.ver")
  )
    return <>{children}</>;
  return vista && !puede(`${vista}.ver`) ? (
    <SinPermiso modulo="esta vista" />
  ) : (
    <>{children}</>
  );
}
