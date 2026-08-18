import { TesoreriaView } from "@/components/administracion/tesoreria-view";
import { getTesoreria } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function TesoreriaPage() {
  const data = await getTesoreria();
  return (
    <TesoreriaView
      initialCuentas={data.cuentas}
      initialKpis={data.kpis}
      monedaLocal={data.monedaLocal}
    />
  );
}
