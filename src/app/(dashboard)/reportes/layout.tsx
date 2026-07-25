import { Suspense } from "react";

import { ReportesShell } from "@/components/panel/reportes-shell";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";

/**
 * Puerta del módulo + cromo compartido. El sidebar ya esconde Reportes para
 * quien no lo tiene, pero una URL pegada en un chat no pasa por el sidebar.
 *
 * El shell va acá y no en cada página para que el título, el período y la tira
 * de reportes no se remonten al saltar de un reporte a otro.
 * Ver docs/usuarios-roles-permisos-diseno.md
 */
export default async function ReportesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await tienePermiso("reportes.ver"))) {
    return <SinPermiso modulo="Reportes" />;
  }

  return (
    // `useSearchParams` del shell obliga a un límite de Suspense.
    <Suspense fallback={null}>
      <ReportesShell>{children}</ReportesShell>
    </Suspense>
  );
}
