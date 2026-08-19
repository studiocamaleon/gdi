import { PresupuestosView } from "@/components/comercial/presupuestos-view";
import { getCurrentUserCached } from "@/lib/auth-server";
import type { MembershipRole } from "@/lib/auth";
import {
  listarPresupuestos,
  type PresupuestoEstado,
  type PresupuestosListado,
} from "@/lib/presupuestos-api";

export const dynamic = "force-dynamic";

const ESTADOS = new Set<PresupuestoEstado>([
  "borrador",
  "pendiente_aprobacion",
  "enviado",
  "aprobado",
  "rechazado",
  "vencido",
  "convertido",
]);

export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const params = await searchParams;
  const estado =
    params.estado && ESTADOS.has(params.estado as PresupuestoEstado)
      ? (params.estado as PresupuestoEstado)
      : undefined;
  let listado: PresupuestosListado = {
    presupuestos: [],
    stats: [],
    paginacion: { skip: 0, limit: 50, total: 0, hayMas: false },
  };
  // El rol decide qué acciones ve el drawer (aprobación interna, config).
  // Ante la duda, el rol más restrictivo.
  let rol: MembershipRole = "operador";
  try {
    const [datos, current] = await Promise.all([
      listarPresupuestos({ estado }),
      getCurrentUserCached(),
    ]);
    listado = datos;
    rol = current.currentUser.tenantActual.rol;
  } catch {
    // La vista muestra su estado vacío.
  }
  return <PresupuestosView initial={listado} rol={rol} filtroInicial={estado} />;
}
