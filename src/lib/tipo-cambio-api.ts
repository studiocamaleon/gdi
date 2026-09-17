import { apiRequest } from "@/lib/api";
export type {
  TipoCambioSnapshot,
  TipoCambioConfig,
  SolicitudTipoCambio,
  CostoMaterialMoneda,
} from "../../apps/api/src/cotizaciones/tipo-cambio.types";
import type {
  TipoCambioSnapshot,
  TipoCambioConfig,
  SolicitudTipoCambio,
} from "../../apps/api/src/cotizaciones/tipo-cambio.types";
export const crearTipoCambio = (input: SolicitudTipoCambio = {}) =>
  apiRequest<TipoCambioSnapshot>("/cotizaciones/tipo-cambio", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const getTipoCambioConfig = () =>
  apiRequest<TipoCambioConfig>("/cotizaciones/tipo-cambio/configuracion");
export const guardarTipoCambioConfig = (input: SolicitudTipoCambio) =>
  apiRequest<TipoCambioConfig>("/cotizaciones/tipo-cambio/configuracion", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
