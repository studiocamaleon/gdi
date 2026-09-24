import { tieneCapacidad } from "@/lib/capacidades-server";
import { tienePermiso } from "@/lib/permisos-server";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { ProgramacionesAnterioresView } from "@/components/administracion/programaciones-anteriores-view";
import { getCategoriasEgreso, getRecurrentes } from "@/lib/egresos-api";
import { getGastosFijos } from "@/lib/gastos-fijos-api";
import { getProveedores } from "@/lib/proveedores-api";

export const dynamic = "force-dynamic";

export default async function ProgramacionesAnterioresPage() {
  if (!(await tienePermiso("administracion.ver")))
    return <SinPermiso modulo="Programaciones anteriores" />;
  const [conCuentas, conFijos, configurar] = await Promise.all([
    tieneCapacidad("cuentas_pagar"),
    tieneCapacidad("gastos_fijos"),
    tienePermiso("administracion.configurar"),
  ]);
  // La consulta del historial sigue disponible cuando cambia el plan.
  const [lista, categorias, proveedores, gastosFijos] = await Promise.all([
    getRecurrentes(),
    getCategoriasEgreso(),
    conCuentas ? getProveedores() : Promise.resolve([]),
    conFijos && configurar ? getGastosFijos() : Promise.resolve([]),
  ]);
  return (
    <ProgramacionesAnterioresView
      initialRecurrentes={lista.recurrentes}
      categorias={categorias}
      proveedores={proveedores}
      gastosFijos={gastosFijos}
    />
  );
}
