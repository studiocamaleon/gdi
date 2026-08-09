import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { IntegracionesView } from "@/components/integraciones/integraciones-view";
import { CredencialesMcp } from "@/components/integraciones/credenciales-mcp";
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
  return (
    <>
      <IntegracionesView inicial={inicial} />
      {puedeGestionar ? <CredencialesMcp inicial={credenciales} /> : null}
    </>
  );
}
