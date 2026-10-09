export type FiltrosFacturacion = {
  cobro?: "cobradas_sin_facturar";
  emisionDesde?: string;
  emisionHasta?: string;
};

export function parametrosFacturacion(filtros: FiltrosFacturacion): string {
  const params = new URLSearchParams();
  if (filtros.cobro) params.set("cobro", filtros.cobro);
  if (filtros.emisionDesde) params.set("emisionDesde", filtros.emisionDesde);
  if (filtros.emisionHasta) params.set("emisionHasta", filtros.emisionHasta);
  return params.toString();
}
