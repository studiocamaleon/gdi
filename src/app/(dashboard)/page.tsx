import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

/**
 * Panel general — el home. Vacío a propósito.
 *
 * Hasta hace poco "/" era un módulo entero de ocho reportes disfrazado de home,
 * que además el Operario no podía abrir. Los reportes se mudaron a /reportes;
 * qué va a mostrar esta pantalla —y para quién— se diseña aparte. Mientras
 * tanto dice lo que es, en vez de fingir contenido o dejar la vista en blanco.
 */
export default async function DashboardPage() {
  if (!(await tienePermiso("panel.ver"))) {
    return <SinPermiso modulo="el Panel general" />;
  }

  return (
    <div className="dash-scroll" style={{ padding: "26px 30px 44px" }}>
      <div className="dash">
        <div className="dash-head">
          <div className="title-block">
            <h1>Panel general</h1>
            <div className="sub">La pantalla de inicio de tu taller.</div>
          </div>
        </div>
        <div className="d-empty" style={{ padding: 64 }}>
          Todavía no hay nada acá. Las métricas del negocio viven en Reportes.
        </div>
      </div>
    </div>
  );
}
