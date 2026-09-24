// Salud del servidor Next. La disponibilidad de PostgreSQL se comprueba en Nest.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { status: "ok", service: "grafoprint-web" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
