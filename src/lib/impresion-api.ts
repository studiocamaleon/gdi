import { apiRequest } from "./api";
export type ConfiguracionImpresion = {
  tenantId: string;
  certificado: string | null;
  firmaDisponible: boolean;
  mensaje?: string;
  validoHasta?: string;
};
export type FirmaQz = { timestamp: number; hash: string; firma: string };
export type TrabajoQz = FirmaQz & {
  params: {
    printer: { name: string };
    options: { copies: number; jobName: string };
    data: Array<{ type: string; format: string; flavor: string; data: string }>;
  };
  totalPaginas: number;
};
export type VistaEtiqueta = {
  numero: string;
  anchoMm: number;
  altoMm: number;
  paginas: string[];
};
export const getConfiguracionImpresion = () =>
  apiRequest<ConfiguracionImpresion>("/impresion/configuracion");
export const getFirmaImpresoras = () =>
  apiRequest<FirmaQz>("/impresion/impresoras", { method: "POST" });
export const getVistaEtiqueta = (id: string) =>
  apiRequest<VistaEtiqueta>(
    `/impresion/ordenes/${encodeURIComponent(id)}/etiqueta`,
  );
export const prepararEtiqueta = (
  id: string,
  impresora: string,
  copias: number,
  pagina: number,
) =>
  apiRequest<TrabajoQz>(
    `/impresion/ordenes/${encodeURIComponent(id)}/etiqueta`,
    { method: "POST", body: JSON.stringify({ impresora, copias, pagina }) },
  );
