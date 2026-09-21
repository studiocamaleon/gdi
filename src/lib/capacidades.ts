import { apiRequest } from "./api";
import {
  contratoCompatible,
  type ClaveCapacidad,
} from "../../apps/api/src/suscripciones/evaluador-capacidades";
export type { ClaveCapacidad };
export const funcionesCompatibles = contratoCompatible(null).funciones;
export const consultarCapacidades = () =>
  apiRequest<{ funciones: Record<string, boolean> }>("/capacidades", {
    cache: "no-store",
  });

/** Compartido por navegación y acceso directo. No reemplaza los guards API. */
export function capacidadDeRuta(ruta: string): ClaveCapacidad | null {
  const rutas: Array<[string, ClaveCapacidad]> = [
    ["/crm/fidelizacion", "fidelizacion"],
    ["/crm/cupones", "cupones"],
    ["/comercial/campanas", "proyectos"],
    ["/produccion/planificacion", "planificacion_avanzada"],
    ["/produccion/colas", "colas_produccion"],
    ["/inventario/compras", "compras"],
    ["/proveedores", "proveedores"],
    ["/administracion/tesoreria", "tesoreria"],
    ["/administracion/cuentas-por-pagar", "cuentas_pagar"],
    ["/administracion/egresos", "cuentas_pagar"],
    ["/administracion/gastos-fijos", "gastos_fijos"],
    ["/reportes/resumen", "reportes_resumen"],
    ["/reportes/comercial", "reportes_resumen"],
    ["/reportes/embudo", "reportes_resumen"],
    ["/reportes/finanzas", "reportes_finanzas"],
    ["/reportes/producto", "reportes_comerciales"],
    ["/reportes/clientes", "reportes_comerciales"],
    ["/reportes/produccion", "reportes_produccion"],
    ["/reportes/equipo", "reportes_produccion"],
    ["/reportes/salud-eta", "reportes_produccion"],
  ];
  return (
    rutas.find(
      ([prefijo]) => ruta === prefijo || ruta.startsWith(prefijo + "/"),
    )?.[1] ?? null
  );
}
