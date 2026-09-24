import { tieneCapacidad } from "@/lib/capacidades-server";
import { EgresosView } from "@/components/administracion/egresos-view";
import { getCuentasFondos, getMetodosPago } from "@/lib/administracion-api";
import { getCategoriasEgreso, getEgresos } from "@/lib/egresos-api";
import { getProveedores } from "@/lib/proveedores-api";

export const dynamic = "force-dynamic";

/**
 * Egresos: registro y clasificación por competencia, pagados o pendientes.
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
  const conEgresos = await tieneCapacidad("cuentas_pagar");
  const params = await searchParams;
  // El historial no depende de catálogos opcionales para nuevas operaciones.
  const [egresos, categorias, proveedores, metodosPago, cuentas] =
    await Promise.all([
      getEgresos({}).then((r) => r.egresos),
      getCategoriasEgreso(),
      conEgresos ? getProveedores() : Promise.resolve([]),
      conEgresos ? getMetodosPago() : Promise.resolve([]),
      conEgresos ? getCuentasFondos() : Promise.resolve([]),
    ]);

  return (
    <EgresosView
      initialEgresos={egresos}
      initialResumen={null}
      categorias={categorias}
      proveedores={proveedores}
      metodosPago={metodosPago.filter((m) => m.activo)}
      cuentas={cuentas}
      altaInicial={conEgresos && params.accion === "nuevo"}
    />
  );
}
