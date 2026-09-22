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
  if (/^\/(?:crm\/)?clientes\/[^/]+\/cuenta-corriente(?:\/|$)/.test(ruta))
    return "cuentas_cobrar";
  const rutas: Array<[string, ClaveCapacidad]> = [
    ["/configuracion/metodos-pago", "cobros"],
    ["/administracion/metodos-pago", "cobros"],
    ["/crm/clientes/nuevo", "clientes"],
    ["/clientes/nuevo", "clientes"],
    ["/empleados/nuevo", "empleados"],
    ["/inventario/materias-primas/costos", "materiales"],
    ["/inventario/materias-primas/biblioteca", "materiales"],
    ["/productos-servicios/nuevo", "productos"],
    ["/productos-servicios/rutas/nueva", "procesos"],
    ["/costos/maquinaria/nueva", "maquinaria"],
    ["/configuracion/impuestos", "reglas_precio"],
    ["/configuracion/comisiones", "reglas_precio"],
    ["/productos-servicios/impuestos-catalogo", "reglas_precio"],
    ["/productos-servicios/comisiones-catalogo", "reglas_precio"],
    ["/productos-servicios/cargos-directos", "reglas_precio"],
    ["/administracion/deudores", "cuentas_cobrar"],
    ["/comercial/crear-propuesta", "cotizacion"],
    ["/configuracion/centro-copiado", "centro_copiado"],
    ["/configuracion/impresoras", "impresion_directa"],
    // Fidelización conserva saldos e historial; las escrituras requieren R03.
    // Cupones conserva la consulta histórica; aplicar y gestionar requieren R02.
    // Campañas conserva el historial; sus páginas y API restringen las escrituras.
    ["/produccion/planificacion", "planificacion_avanzada"],
    ["/produccion/colas", "colas_produccion"],
    // Compras conserva la consulta histórica; su panel limita las acciones y la API revalida.
    ["/proveedores", "proveedores"],
    // Egresos, Tesorería y Valores conservan lectura histórica; la gestión exige su función.
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
