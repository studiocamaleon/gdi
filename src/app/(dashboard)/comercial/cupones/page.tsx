import { CuponesView } from "@/components/comercial/cupones-view";
import { getCurrentUserCached } from "@/lib/auth-server";
import { listarCupones, type Cupon } from "@/lib/cupones-api";

export const dynamic = "force-dynamic";

export default async function CuponesPage() {
  let cupones: Cupon[] = [];
  // Crear/editar cupones es de SUPERVISOR/ADMIN (el cupón autoriza el
  // descuento); el resto ve el listado y los QR.
  let puedeEditar = false;
  try {
    const [datos, current] = await Promise.all([
      listarCupones(),
      getCurrentUserCached(),
    ]);
    cupones = datos;
    puedeEditar = current.currentUser.tenantActual.rol !== "operador";
  } catch {
    // La vista muestra su estado vacío.
  }
  return <CuponesView initial={cupones} puedeEditar={puedeEditar} />;
}
