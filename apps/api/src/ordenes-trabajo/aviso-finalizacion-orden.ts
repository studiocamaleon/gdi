/** Resumen operativo del cierre que produjo ESTA acción; no es el detalle comercial. */
export type AvisoFinalizacionOrden = {
  despachoLocalidad?: string | null;
  ordenId: string;
  ordenNumero: string;
  clienteNombre: string;
  fechaEntrega: string | null;
  finalizadaEl: string;
  trabajos: Array<{
    id: string;
    nombre: string;
    cantidad: number;
    unidad: string;
  }>;
};
