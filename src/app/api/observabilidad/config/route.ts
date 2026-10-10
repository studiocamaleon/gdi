import { configurarMonitoreo } from "../../../../../apps/api/src/common/observabilidad-segura";

// El DSN es público: sólo permite recibir errores, nunca leerlos ni administrar Sentry.
// Se resuelve al ejecutar para poder promover la MISMA imagen de staging a producción.
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json(configurarMonitoreo(process.env), {
    headers: { "Cache-Control": "no-store" },
  });
}
