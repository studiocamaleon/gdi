import { EgresosView } from "@/components/administracion/egresos-view";
import { getCuentasFondos, getMetodosPago } from "@/lib/administracion-api";
import {
  getCategoriasEgreso,
  getEgresos,
  getResumenEgresos,
} from "@/lib/egresos-api";
import { getProveedores } from "@/lib/proveedores-api";
import { getGastosFijos } from "@/lib/gastos-fijos-api";

export const dynamic = "force-dynamic";

/**
 * Egresos: todo lo que sale de la caja, pagado en el momento o a plazo.
 *
 * Lo que se debe y todavía no se pagó vive en su propia ruta
 * (`/administracion/cuentas-por-pagar`), que es el MISMO módulo con otro
 * filtro. Ver `ModoEgresos`.
 */
export default async function EgresosPage({
  searchParams,
}: {
  searchParams: Promise<{ accion?: string }>;
}) {
  const params = await searchParams;
  // Todo en paralelo y tolerante: una lista vacía muestra el estado vacío, que
  // es mejor que una pantalla de error por un catálogo sin cargar.
  const [
    egresos,
    resumen,
    categorias,
    proveedores,
    metodosPago,
    cuentas,
    gastosFijos,
  ] =
    await Promise.all([
      getEgresos({}).then((r) => r.egresos),
      getResumenEgresos(),
      getCategoriasEgreso(),
      getProveedores(),
      getMetodosPago(),
      getCuentasFondos(),
      getGastosFijos(),
    ]);

  return (
    <EgresosView
      initialEgresos={egresos}
      initialResumen={resumen}
      categorias={categorias}
      proveedores={proveedores}
      metodosPago={metodosPago.filter((m) => m.activo)}
      cuentas={cuentas}
      gastosFijos={gastosFijos}
      altaInicial={params.accion === "nuevo"}
    />
  );
}
