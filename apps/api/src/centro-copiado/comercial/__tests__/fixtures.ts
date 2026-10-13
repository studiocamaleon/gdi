import {
  REGLAS_COMERCIALES_HOJAS_INICIALES,
  type CombinacionComercialHojas,
  type DocumentoCalculoHojas,
  type FilaMatrizHojas,
  type PedidoCalculoHojas,
  type TarifarioCalculoHojas,
} from '../tipos';

export const combinacion: CombinacionComercialHojas = {
  papelMateriaPrimaId: 'papel-ficticio',
  gramaje: 80,
  tamano: 'A4',
  color: 'BN',
  faz: 1,
  cobertura: null,
};

export function documento(
  id: string,
  cambios: Partial<DocumentoCalculoHojas> = {},
): DocumentoCalculoHojas {
  return {
    id,
    archivoNombre: `${id}.pdf`,
    paginas: 1,
    copias: 1,
    papelMateriaPrimaId: 'papel-ficticio',
    gramaje: 80,
    tamano: 'A4',
    tamanoAnchoMm: 210,
    tamanoAltoMm: 297,
    color: 'BN',
    faz: 1,
    ...cambios,
  };
}

export function fila(
  cambios: Partial<CombinacionComercialHojas> = {},
  precios: FilaMatrizHojas['precios'] = [
    { desdeCantidad: 1, precioUnitario: '100' },
    { desdeCantidad: 100, precioUnitario: '80' },
  ],
): FilaMatrizHojas {
  return { combinacion: { ...combinacion, ...cambios }, precios };
}

export function tarifario(
  cambios: Partial<TarifarioCalculoHojas> = {},
): TarifarioCalculoHojas {
  return {
    tenantId: 'empresa-demo',
    tarifarioId: 'mostrador-demo',
    versionId: 'version-1',
    reglas: { ...REGLAS_COMERCIALES_HOJAS_INICIALES },
    rangosGenerales: [1, 100],
    filas: [
      fila(),
      fila({ faz: 2 }, [
        { desdeCantidad: 1, precioUnitario: '160' },
        { desdeCantidad: 100, precioUnitario: '130' },
      ]),
    ],
    ...cambios,
  };
}

export function pedido(
  documentos: readonly DocumentoCalculoHojas[],
  cambios: Partial<PedidoCalculoHojas> = {},
): PedidoCalculoHojas {
  return {
    tenantId: 'empresa-demo',
    pedidoId: 'pedido-demo',
    cargas: [{ id: 'carga-1', documentos }],
    ...cambios,
  };
}
