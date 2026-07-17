import { MetodosPagoView } from "@/components/administracion/metodos-pago-view";
import type {
  CuentaFondosResumen,
  MetodoPago,
} from "@/lib/administracion";
import { getCuentasFondos, getMetodosPago } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function MetodosPagoPage() {
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
