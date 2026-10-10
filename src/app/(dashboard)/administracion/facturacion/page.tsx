import { paginaDe } from "@/lib/listado-fiscal";
import { redirect } from "next/navigation";
import { FacturacionView } from "@/components/administracion/facturacion-view";
import { getFacturacionPagina } from "@/lib/administracion-api";
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
  if (typeof params.lote === "string" && /^[a-f0-9-]{36}$/i.test(params.lote))
    redirect(`/administracion/facturacion/lotes?lote=${params.lote}`);
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
  const q = typeof params.q === "string" ? params.q.slice(0, 200) : "";
  const resultado = await getFacturacionPagina(
    filtros,
    paginaDe(params.pagina),
    q,
  );
  // Al aplicar filtros se descarta la selección anterior: nunca emitir un
  // lote con órdenes que dejaron de estar visibles por estos filtros.
  return (
    <FacturacionView
      key={`${parametrosFacturacion(filtros)}&q=${encodeURIComponent(q)}`}
      initialOrdenes={resultado.items}
      paginacion={resultado}
      initialQ={q}
      initialFiltros={filtros}
    />
  );
}
