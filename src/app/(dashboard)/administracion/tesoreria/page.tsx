import { TesoreriaView } from "@/components/administracion/tesoreria-view";
import type { CuentaFondos, TesoreriaKpis } from "@/lib/administracion";
import { getTesoreria } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

const KPIS_VACIOS: TesoreriaKpis = {
  posicionArs: 0,
  posicionUsd: 0,
  efectivo: 0,
  bancos: 0,
  cajasActivas: 0,
  cuentasArs: 0,
  aAcreditar: 0,
};

export default async function TesoreriaPage() {
  let cuentas: CuentaFondos[] = [];
  let kpis: TesoreriaKpis = KPIS_VACIOS;
  try {
    const data = await getTesoreria();
    cuentas = data.cuentas;
    kpis = data.kpis;
  } catch {
    cuentas = [];
    kpis = KPIS_VACIOS;
  }
  return <TesoreriaView initialCuentas={cuentas} initialKpis={kpis} />;
}
