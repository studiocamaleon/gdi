import {
  REGLAS_COMERCIALES_CAD_INICIALES,
  type CombinacionComercialCad,
  type DocumentoCalculoCad,
  type FilaMatrizCad,
  type PedidoCalculoCad,
  type TarifarioCalculoCad,
} from '../tipos-cad';
import { documento } from './fixtures';

export function documentoCad(
  id: string,
  cambios: Partial<DocumentoCalculoCad> = {},
): DocumentoCalculoCad {
  return {
    ...documento(id),
    modo: 'CAD',
    paginasOriginales: 1,
    tamano: 'CAD',
    tamanoAnchoMm: 600,
    tamanoAltoMm: 1200,
    medidasPaginas: [{ anchoMm: 600, altoMm: 1200 }],
    rolloProduccion: { anchoRolloMm: 610, margenMm: 5 },
    ...cambios,
  };
}

export function filaCad(
  cambios: Partial<CombinacionComercialCad> = {},
  precios: FilaMatrizCad['precios'] = [
    { desdeCantidad: '0', precioUnitario: '5000' },
    { desdeCantidad: '4', precioUnitario: '4000' },
  ],
): FilaMatrizCad {
  return {
    combinacion: {
      papelMateriaPrimaId: 'papel-ficticio',
      gramaje: 80,
      anchoRolloMm: 610,
      color: 'BN',
      cobertura: null,
      ...cambios,
    },
    precios,
  };
}

export function tarifarioCad(
  cambios: Partial<TarifarioCalculoCad> = {},
): TarifarioCalculoCad {
  return {
    tenantId: 'empresa-demo',
    tarifarioId: 'mostrador-demo',
    versionId: 'version-1',
    reglas: { ...REGLAS_COMERCIALES_CAD_INICIALES },
    rangosGenerales: ['0', '4'],
    filas: [filaCad()],
    ...cambios,
  };
}

export function pedidoCad(
  documentos: readonly DocumentoCalculoCad[],
  cambios: Partial<PedidoCalculoCad> = {},
): PedidoCalculoCad {
  return {
    tenantId: 'empresa-demo',
    pedidoId: 'pedido-demo',
    cargas: [{ id: 'carga-cad-1', documentos }],
    ...cambios,
  };
}
