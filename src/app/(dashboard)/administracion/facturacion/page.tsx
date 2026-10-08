import { FacturacionView } from "@/components/administracion/facturacion-view";
import { getFacturacionPendientes } from "@/lib/administracion-api";
import {
  parametrosFacturacion,
  type FiltrosFacturacion,
} from "@/lib/facturacion-filtros";

export const dynamic = "force-dynamic";

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filtros: FiltrosFacturacion = {
    cobro:
      params.cobro === "cobradas_sin_facturar"
        ? "cobradas_sin_facturar"
        : undefined,
    emisionDesde:
      typeof params.emisionDesde === "string" && params.emisionDesde
        ? params.emisionDesde
        : undefined,
    emisionHasta:
      typeof params.emisionHasta === "string" && params.emisionHasta
        ? params.emisionHasta
        : undefined,
  };
  const ordenes = await getFacturacionPendientes(filtros);
  // Al aplicar filtros se descarta la selección anterior: nunca emitir un
  // lote con órdenes que dejaron de estar visibles por estos filtros.
  return (
    <FacturacionView
      key={parametrosFacturacion(filtros)}
      initialOrdenes={ordenes}
      initialFiltros={filtros}
    />
  );
}
