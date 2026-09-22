import { DeudoresView } from "@/components/administracion/deudores-view";
import { getDeudores } from "@/lib/administracion-api";
import { tieneCapacidad } from "@/lib/capacidades-server";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";

export const dynamic = "force-dynamic";

export default async function DeudoresPage() {
  if (!(await tieneCapacidad("cuentas_cobrar"))) return <FuncionNoIncluida />;
  const filas = await getDeudores();
  return <DeudoresView initialFilas={filas} />;
}
