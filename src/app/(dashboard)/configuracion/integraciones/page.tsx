import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { IntegracionesView } from "@/components/integraciones/integraciones-view";
import {
  getIntegraciones,
  type EstadoIntegraciones,
} from "@/lib/integraciones-api";

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
  return <IntegracionesView inicial={inicial} />;
}
