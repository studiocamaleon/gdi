import type { ContenidoTarifario } from './contenido-tarifario';
import type { CentroCopiadoCobertura } from '../centro-copiado.domain';

export type CeldaSimulacion = {
  seccion: 'hojas' | 'cad';
  fila: number;
  tramo: number;
  cantidadReferencia?: string;
  perfilCadId?: string;
  geometriaCad?: { anchoMm: number; altoMm: number; copias: number };
};
export type SolicitudSimulacion = {
  revision?: number;
  versionId?: string;
  celdas: CeldaSimulacion[];
};
export type GrupoReferenciaSimulacion = {
  fila: number;
  desdeCantidad: string;
  cantidadFacturable: string;
};
export type EscenarioSimulado = {
  cobertura: CentroCopiadoCobertura;
  calculadoEl: string;
  estado: 'CALCULADO';
  costoTotal: string;
  costoUnitario: string;
  cantidadReferencia: string;
  cantidadFacturable: string;
  unidad: 'HOJA' | 'CARILLA' | 'ML';
  referencia: string;
  grupos: GrupoReferenciaSimulacion[];
  ivaPorcentaje: string;
  decimalesPrecio: number;
  trazas: {
    productoId: string;
    rutaId: string;
    periodo: string;
    tipoCambioId: string | null;
  }[];
  avisos: string[];
};
export type ResultadoCeldaSimulacion = {
  celda: CeldaSimulacion;
  escenarios: (
    | EscenarioSimulado
    | {
        cobertura: CentroCopiadoCobertura;
        calculadoEl: string;
        estado: 'ERROR';
        motivo: string;
      }
  )[];
};

/** Firma legible, estable ante edición de precios y composición comercial.
 * No es una firma de autorización ni certifica que los costos sigan vigentes.
 */
export function estructuraSimulacion(contenido: ContenidoTarifario) {
  const matriz = (m: ContenidoTarifario['hojas'] | ContenidoTarifario['cad']) =>
    m && {
      reglas: m.reglas,
      rangosGenerales: m.rangosGenerales,
      filas: m.filas.map((f) => ({
        combinacion: f.combinacion,
        rangosPropios: f.rangosPropios ?? null,
      })),
    };
  return JSON.stringify({
    monedaCodigo: contenido.monedaCodigo,
    hojas: matriz(contenido.hojas),
    cad: matriz(contenido.cad),
  });
}

export const claveCeldaSimulacion = (c: CeldaSimulacion) =>
  `${c.seccion}:${c.fila}:${c.tramo}`;
