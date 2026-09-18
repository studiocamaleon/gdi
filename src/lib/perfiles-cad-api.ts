import { apiRequest } from "./api";
import type { TrabajoQz } from "./impresion-api";
import type { planPruebaCad } from "../../apps/api/src/impresion/cad.domain";
export { enlacePerfilCad } from "../../apps/api/src/impresion/perfiles-cad.domain";

export type OpcionPerfilCad = {
  rutaAlternativaId: string;
  productoId: string;
  productoNombre: string;
  rutaNombre: string;
  configPasoId: string;
  materialVarianteId: string;
  papelMateriaPrimaId: string;
  materialNombre: string;
  papelNombre: string;
  anchoMm: number;
  gramaje: number | null;
  colores: ("BN" | "COLOR")[];
};
export type DatosPerfilCad = {
  destinoId: string;
  versionDestino: number;
  version?: number;
  nombre: string;
  rutaAlternativaId: string;
  materialVarianteId: string;
  gramaje: number;
  color: "BN" | "COLOR";
  modo: string;
  activo: boolean;
  probado: boolean;
  prioridad: number;
};
export type PruebaPerfilCad = {
  version: number;
  versionDestino: number;
  formato: "A1" | "PERSONALIZADO";
};
export type CotizacionMuestraCad = {
  productoNombre: string;
  materialNombre: string;
  color: string;
  formato: string;
  subtotal: number;
  impuestos: number;
  total: number;
  plan: ReturnType<typeof planPruebaCad>;
};
export const opcionesPerfilCad = (destinoId: string) =>
  apiRequest<{ opciones: OpcionPerfilCad[] }>(
    `/impresion/cad/destinos/${destinoId}/opciones`,
  );
export const guardarPerfilCad = (datos: DatosPerfilCad, id?: string) =>
  apiRequest(`/impresion/cad/perfiles${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(datos),
  });
export const cotizarMuestraCad = (id: string, datos: PruebaPerfilCad) =>
  apiRequest<CotizacionMuestraCad>(
    `/impresion/cad/perfiles/${id}/cotizar-muestra`,
    { method: "POST", body: JSON.stringify(datos) },
  );
export const prepararPruebaPerfilCad = (id: string, datos: PruebaPerfilCad) =>
  apiRequest<TrabajoQz>(`/impresion/cad/perfiles/${id}/prueba`, {
    method: "POST",
    body: JSON.stringify(datos),
  });
