import { apiRequest } from './api';

export type PreparacionNesting = {
  id: string;
  rutaClave: string;
  cantidad: number;
  estado: 'PENDIENTE' | 'PROCESANDO' | 'PREPARADO' | 'FALLIDO';
  error: string | null;
  duracionMs: number | null;
  updatedAt: string;
};

export function leerCantidadesNesting(texto: string): number[] {
  const partes = texto.trim().split(/[\s,;]+/).filter(Boolean);
  if (!partes.length || partes.length > 20 || partes.some(p => !/^\d+$/.test(p) || Number(p) < 1 || Number(p) > 10000)) {
    throw new Error('Ingresá hasta 20 cantidades enteras, entre 1 y 10.000, separadas por comas.');
  }
  return [...new Set(partes.map(Number))].sort((a, b) => a - b);
}

export const listarNestingsProducto = (productoId: string) =>
  apiRequest<PreparacionNesting[]>(`/productos-servicios/productos/${productoId}/nestings`);

export const prepararNestingsProducto = (productoId: string, cantidades: number[], rutaAlternativaId?: string) =>
  apiRequest<PreparacionNesting[]>(`/productos-servicios/productos/${productoId}/nestings`, {
    method: 'POST', body: JSON.stringify({ cantidades, rutaAlternativaId }),
  });
