import { tieneCapacidad } from "@/lib/capacidades-server";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { MetodosPagoView } from "@/components/administracion/metodos-pago-view";
import type { CuentaFondosResumen, MetodoPago } from "@/lib/administracion";
import { getCuentasFondos, getMetodosPago } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function MetodosPagoPage() {
  if (!(await tieneCapacidad("cobros"))) return <FuncionNoIncluida />;
  if (!(await tienePermiso("administracion.configurar"))) {
    return <SinPermiso modulo="Métodos de pago" />;
  }

  let metodos: MetodoPago[] = [];
  let cuentas: CuentaFondosResumen[] = [];
  try {
    [metodos, cuentas] = await Promise.all([
      getMetodosPago(),
      getCuentasFondos(),
    ]);
  } catch {
    metodos = [];
    cuentas = [];
  }
  return <MetodosPagoView initialMetodos={metodos} initialCuentas={cuentas} />;
}
