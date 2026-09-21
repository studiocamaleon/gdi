import { tieneCapacidad } from "@/lib/capacidades-server";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { AcreditacionesView } from "@/components/administracion/acreditaciones-view";
import {
  getCobrosPendientesAcreditacion,
  getTesoreria,
  getValoresTesoreria,
} from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function AcreditacionesPage() {
  if (!(await tieneCapacidad("tesoreria"))) return <FuncionNoIncluida />;
  const [filas, valores, tesoreria] = await Promise.all([
    getCobrosPendientesAcreditacion(),
    getValoresTesoreria(),
    getTesoreria(),
  ]);
  return (
    <AcreditacionesView
      initialFilas={filas}
      initialValores={valores}
      cuentas={tesoreria.cuentas.filter((cuenta) => cuenta.activo)}
    />
  );
}
