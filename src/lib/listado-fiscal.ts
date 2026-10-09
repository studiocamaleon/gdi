import type { Comprobante, OrdenFacturable } from "./administracion";
export type PaginaFiscal<T, R> = {
  items: T[];
  total: number;
  pagina: number;
  tamanoPagina: number;
  resumen: R;
};
export type PaginaFacturacion = PaginaFiscal<
  OrdenFacturable,
  { importe: number; clientes: number }
>;
export type PaginaComprobantes = PaginaFiscal<
  Comprobante,
  {
    facturado: number;
    pendiente: number;
    facturasMes: number;
    notasMes: number;
  }
>;
export function paginaDe(valor: unknown): number {
  return typeof valor === "string" && /^[1-9]\d{0,5}$/.test(valor)
    ? Number(valor)
    : 1;
}
