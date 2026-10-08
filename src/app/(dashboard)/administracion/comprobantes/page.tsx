import { ComprobantesView } from "@/components/administracion/comprobantes-view";
import { getComprobantesPagina } from "@/lib/administracion-api";
import { paginaDe } from "@/lib/listado-fiscal";
export const dynamic = "force-dynamic";
export default async function ComprobantesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filtros = {
    q: typeof params.q === "string" ? params.q.slice(0, 200) : "",
    estado: typeof params.estado === "string" ? params.estado : "todos",
    tipo: typeof params.tipo === "string" ? params.tipo : "todos",
  };
  const resultado = await getComprobantesPagina({
    ...filtros,
    pagina: paginaDe(params.pagina),
  });
  return (
    <ComprobantesView
      key={JSON.stringify(filtros)}
      initialComprobantes={resultado.items}
      paginacion={resultado}
      initialFiltros={filtros}
    />
  );
}
