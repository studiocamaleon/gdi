import { redirect } from "next/navigation";

import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

/**
 * "Reportes" a secas no es una pantalla: es un grupo. Manda al primer reporte
 * que la persona puede ver — el Resumen ejecutivo si lo tiene, y si no el
 * Comercial, que es lo que ve todo el que entra al módulo.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const destino = (await tienePermiso("reportes.ver_resumen"))
    ? "/reportes/resumen"
    : "/reportes/comercial";
  redirect(periodo ? `${destino}?periodo=${periodo}` : destino);
}
