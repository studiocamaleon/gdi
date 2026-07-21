import { AcreditacionesView } from "@/components/administracion/acreditaciones-view";
import type { CobroPendienteAcreditacion } from "@/lib/administracion";
import { getCobrosPendientesAcreditacion } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function AcreditacionesPage() {
  let filas: CobroPendienteAcreditacion[] = [];
  try {
    filas = await getCobrosPendientesAcreditacion();
  } catch {
    filas = [];
  }
  return <AcreditacionesView initialFilas={filas} />;
}
