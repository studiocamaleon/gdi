import { MiDesempeno } from "@/components/produccion/mi-desempeno";
import { getMiDesempeno } from "@/lib/panel-api";
import type { MiDesempenoPanel } from "@/lib/panel-api";

export const dynamic = "force-dynamic";

/**
 * Mi desempeño: la devolución del sistema al propio operario — siempre
 * scoped al usuario logueado (el backend usa auth.userId, acá no viaja
 * ningún parámetro de persona).
 */
export default async function MiDesempenoPage() {
  let datos: MiDesempenoPanel | null = null;
  try {
    datos = await getMiDesempeno();
  } catch {
    // La vista muestra su estado de error.
  }
  return <MiDesempeno datos={datos} />;
}
