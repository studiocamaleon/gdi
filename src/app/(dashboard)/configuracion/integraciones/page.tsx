import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { IntegracionesView } from "@/components/integraciones/integraciones-view";
import {
  getIntegraciones,
  type EstadoIntegraciones,
} from "@/lib/integraciones-api";
import { getCredencialesMcp } from "@/lib/credenciales-mcp-api";

export const dynamic = "force-dynamic";

const VACIO: EstadoIntegraciones = {
  integraciones: [],
  // Ante un fallo del API se asume que NO se puede cifrar: la vista avisa y
  // no invita a pegar un token que quizás no se guarde.
  cifradoDisponible: false,
};

export default async function IntegracionesPage() {
  if (!(await tienePermiso("configuracion.ver"))) {
    return <SinPermiso modulo="Integraciones" />;
  }

  const inicial = await getIntegraciones().catch(() => VACIO);
  // La gestión de credenciales exige configuracion.gestionar en el API; acá
  // sólo decide si se RENDERIZA la sección (un supervisor con .ver no la ve).
  const puedeGestionar = await tienePermiso("configuracion.gestionar");
  const credenciales = puedeGestionar
    ? await getCredencialesMcp().catch(() => [])
    : [];
  // La URL del MCP es la del API (no la del front): se resuelve en el server
  // desde el env — calcularla en el cliente con window fue el bug de
  // hidratación y encima apuntaba al puerto del front.
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_URL ??
    "http://localhost:3001/api";
  return (
    <IntegracionesView
      inicial={inicial}
      mcp={
        puedeGestionar
          ? { inicial: credenciales, mcpUrl: `${apiBase}/mcp` }
          : undefined
      }
    />
  );
}
