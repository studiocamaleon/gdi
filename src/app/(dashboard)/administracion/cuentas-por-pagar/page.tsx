import { EgresosView } from "@/components/administracion/egresos-view";
import { getCuentasFondos, getMetodosPago } from "@/lib/administracion-api";
import {
  getCategoriasEgreso,
  getEgresos,
  getResumenEgresos,
} from "@/lib/egresos-api";
import { getProveedores } from "@/lib/proveedores-api";

export const dynamic = "force-dynamic";

/**
 * Cuentas por pagar: lo que se debe y todavía no se pagó.
 *
 * Es el MISMO módulo que Egresos con otro filtro —ver `ModoEgresos`— y no una
 * vista aparte: el registro es uno solo y duplicarlo abriría la puerta a que
 * los dos lados digan cosas distintas. Lo que cambia es qué tabs se ofrecen y
 * con qué pregunta se entra.
 *
 * Ruta propia y no un `?tab=`: se linkea, se comparte y el sidebar la marca
 * como activa, igual que Cuentas por cobrar.
 */
export default async function CuentasPorPagarPage({
  searchParams,
}: {
  searchParams: Promise<{ endosarValorId?: string }>;
}) {
  const { endosarValorId } = await searchParams;
  const [egresos, resumen, categorias, proveedores, metodosPago, cuentas] =
    await Promise.all([
      getEgresos({ soloPendientes: true }).then((r) => r.egresos),
      getResumenEgresos(),
      getCategoriasEgreso(),
      getProveedores(),
      getMetodosPago(),
      getCuentasFondos(),
    ]);

  return (
    <EgresosView
      modo="cuentas-por-pagar"
      initialEgresos={egresos}
      initialResumen={resumen}
      categorias={categorias}
      proveedores={proveedores}
      metodosPago={metodosPago.filter((m) => m.activo)}
      cuentas={cuentas}
      valorEndosoInicialId={endosarValorId}
    />
  );
}
