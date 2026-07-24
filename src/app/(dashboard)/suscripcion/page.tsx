import { SuscripcionView } from "@/components/suscripcion/suscripcion-view";
import { getSuscripcion, type EstadoSuscripcion } from "@/lib/suscripcion-api";
import { ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * La suscripción del tenant. Sólo ADMINISTRADOR: el API responde 403 a
 * cualquier otro rol, y acá se traduce a un mensaje en vez de una pantalla
 * rota. El try envuelve SÓLO el fetch —el JSX queda afuera— para no tragarse
 * un error de render. Ver docs/suscripciones-cobro-diseno.md
 */
export default async function SuscripcionPage() {
  let datos: EstadoSuscripcion | null = null;
  let sinPermiso = false;
  try {
    datos = await getSuscripcion();
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      sinPermiso = true;
    } else {
      throw error;
    }
  }

  if (sinPermiso || !datos) {
    return (
      <main className="sus-wrap">
        <header className="sus-head">
          <div className="eyebrow">Configuración</div>
          <h1>Suscripción</h1>
        </header>
        <div className="sus-aviso">
          Sólo un administrador de la empresa puede ver y cambiar el plan
          contratado.
        </div>
      </main>
    );
  }

  return <SuscripcionView inicial={datos} />;
}
