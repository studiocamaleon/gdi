import { EgresosView } from "@/components/administracion/egresos-view";
import { getCuentasFondos, getMetodosPago } from "@/lib/administracion-api";
import { getCategoriasEgreso, getEgresos, getResumenEgresos } from "@/lib/egresos-api";
import { getProveedores } from "@/lib/proveedores-api";

export const dynamic = "force-dynamic";

/**
 * Egresos y Cuentas por pagar. La vista arranca en "Por pagar" porque es la
 * pregunta del lunes a la mañana; el listado completo es el otro tab.
 */
export default async function EgresosPage() {
  // Todo en paralelo y tolerante: una lista vacía muestra el estado vacío, que
  // es mejor que una pantalla de error por un catálogo sin cargar.
  const [egresos, resumen, categorias, proveedores, metodosPago, cuentas] =
    await Promise.all([
      getEgresos({ soloPendientes: true }).then(
        (r) => r.egresos,
        () => [],
      ),
      getResumenEgresos().then(
        (r) => r,
        () => null,
      ),
      getCategoriasEgreso().then(
        (r) => r,
        () => [],
      ),
      getProveedores().then(
        (r) => r,
        () => [],
      ),
      getMetodosPago().then(
        (r) => r,
        () => [],
      ),
      getCuentasFondos().then(
        (r) => r,
        () => [],
      ),
    ]);

  return (
    <EgresosView
      initialEgresos={egresos}
      initialResumen={resumen}
      categorias={categorias}
      proveedores={proveedores}
      metodosPago={metodosPago.filter((m) => m.activo)}
      cuentas={cuentas}
    />
  );
}
