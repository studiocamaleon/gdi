/** Unidades monetarias de destino por 1 USD. Registro inmutable del servidor. */
export type TipoCambioSnapshot = {
  version: 1;
  id: string;
  monedaOrigen: 'USD';
  monedaDestino: string;
  paisCodigo: string;
  modo: 'automatico' | 'manual' | 'misma_moneda';
  origen: 'empresa' | 'documento';
  tasa: number | null;
  referencia: string;
  fuente: string;
  fechaFuente: string | null;
  capturadoEn: string;
  usuarioId: string | null;
  observacion: string | null;
};

export type TipoCambioConfig = {
  modo: 'automatico' | 'manual';
  referencia: string | null;
  tasaManual: number | null;
  monedaDestino: string;
};

export type SolicitudTipoCambio = {
  modo?: 'automatico' | 'manual';
  tasa?: number;
  referencia?: string;
};

export type CostoMaterialMoneda = {
  varianteId: string;
  sku: string;
  monedaOrigen: string;
  monedaDestino: string;
  precioOriginal: number;
  unidadPrecio: string;
  unidadUso: string;
  unidadStock?: string;
  unidadCompra?: string;
  conversionStock?: import('../inventario/material-units').UnitConversion;
  equivalencias?: import('../inventario/material-units').MaterialEquivalence[];
  conversionPrecio?: import('../inventario/material-units').UnitConversion;
  precioPorUnidadUsoOrigen: number;
  costoUnitarioDestino: number;
  factorCambio: number;
};
