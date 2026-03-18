import { apiRequest } from '@/lib/api';
import {
  CarasProductoVariante,
  DimensionOpcionProductiva,
  PliegoImpresionCatalogItem,
  CotizacionProductoSnapshotResumen,
  ProductoChecklist,
  CotizacionProductoVariante,
  EstadoProductoServicio,
  FamiliaProducto,
  MotorCostoCatalogItem,
  ProductoMotorConfig,
  ProductoRutaPolicy,
  ProductoVariante,
  ProductoServicio,
  SubfamiliaProducto,
  VarianteOpcionesProductivas,
  ValorOpcionProductiva,
  TipoImpresionProductoVariante,
  TipoProductoServicio,
  VarianteMotorOverride,
} from '@/lib/productos-servicios';

export async function getCatalogoPliegosImpresion() {
  return apiRequest<PliegoImpresionCatalogItem[]>('/productos-servicios/catalogos/pliegos-impresion');
}

export async function getMotoresCostoCatalogo() {
  return apiRequest<MotorCostoCatalogItem[]>('/productos-servicios/motores');
}

export async function getFamiliasProducto() {
  return apiRequest<FamiliaProducto[]>('/productos-servicios/familias');
}

export async function createFamiliaProducto(payload: {
  codigo: string;
  nombre: string;
  activo: boolean;
}) {
  return apiRequest<FamiliaProducto>('/productos-servicios/familias', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateFamiliaProducto(
  familiaId: string,
  payload: {
    codigo: string;
    nombre: string;
    activo: boolean;
  },
) {
  return apiRequest<FamiliaProducto>(`/productos-servicios/familias/${familiaId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getSubfamiliasProducto(familiaId?: string) {
  const suffix = familiaId ? `?familiaId=${encodeURIComponent(familiaId)}` : '';
  return apiRequest<SubfamiliaProducto[]>(`/productos-servicios/subfamilias${suffix}`);
}

export async function createSubfamiliaProducto(payload: {
  familiaProductoId: string;
  codigo: string;
  nombre: string;
  unidadComercial?: string;
  activo: boolean;
}) {
  return apiRequest<SubfamiliaProducto>('/productos-servicios/subfamilias', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSubfamiliaProducto(
  subfamiliaId: string,
  payload: {
    familiaProductoId: string;
    codigo: string;
    nombre: string;
    unidadComercial?: string;
    activo: boolean;
  },
) {
  return apiRequest<SubfamiliaProducto>(`/productos-servicios/subfamilias/${subfamiliaId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getProductosServicios() {
  return apiRequest<ProductoServicio[]>('/productos-servicios');
}

export async function getProductoServicio(productoId: string) {
  return apiRequest<ProductoServicio>(`/productos-servicios/${productoId}`);
}

export async function createProductoServicio(payload: {
  tipo?: TipoProductoServicio;
  nombre: string;
  descripcion?: string;
  motorCodigo: string;
  motorVersion: number;
  familiaProductoId: string;
  subfamiliaProductoId?: string;
  estado: EstadoProductoServicio;
  activo: boolean;
}) {
  return apiRequest<ProductoServicio>('/productos-servicios', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProductoServicio(
  productoId: string,
  payload: {
    tipo?: TipoProductoServicio;
    codigo?: string;
    nombre: string;
    descripcion?: string;
    motorCodigo?: string;
    motorVersion?: number;
    familiaProductoId: string;
    subfamiliaProductoId?: string;
    estado: EstadoProductoServicio;
    activo: boolean;
  },
) {
  return apiRequest<ProductoServicio>(`/productos-servicios/${productoId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getProductoVariantes(productoId: string) {
  return apiRequest<ProductoVariante[]>(`/productos-servicios/${productoId}/variantes`);
}

export async function getProductoChecklist(productoId: string) {
  return apiRequest<ProductoChecklist>(`/productos-servicios/${productoId}/checklist`);
}

export async function upsertProductoChecklist(
  productoId: string,
  payload: {
    activo?: boolean;
    preguntas: Array<{
      id?: string;
      texto: string;
      tipoPregunta?: 'binaria' | 'single_select';
      orden?: number;
      activo?: boolean;
      respuestas: Array<{
        id?: string;
        texto: string;
        codigo?: string;
        orden?: number;
        activo?: boolean;
        reglas?: Array<{
          id?: string;
          accion:
            | 'activar_paso'
            | 'seleccionar_variante_paso'
            | 'costo_extra'
            | 'material_extra';
          orden?: number;
          activo?: boolean;
          pasoPlantillaId?: string;
          variantePasoId?: string;
          costoRegla?: 'tiempo_min' | 'flat' | 'por_unidad' | 'por_pliego' | 'porcentaje_sobre_total';
          costoValor?: number;
          costoCentroCostoId?: string;
          materiaPrimaVarianteId?: string;
          tipoConsumo?: 'por_unidad' | 'por_pliego' | 'por_m2';
          factorConsumo?: number;
          mermaPct?: number;
          detalle?: Record<string, unknown>;
        }>;
      }>;
    }>;
  },
) {
  return apiRequest<ProductoChecklist>(`/productos-servicios/${productoId}/checklist`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function createProductoVariante(
  productoId: string,
  payload: {
    nombre: string;
    anchoMm: number;
    altoMm: number;
    papelVarianteId?: string;
    tipoImpresion: TipoImpresionProductoVariante;
    caras: CarasProductoVariante;
    procesoDefinicionId?: string;
    activo?: boolean;
  },
) {
  return apiRequest<ProductoVariante>(`/productos-servicios/${productoId}/variantes`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProductoVariante(
  varianteId: string,
  payload: {
    nombre?: string;
    anchoMm?: number;
    altoMm?: number;
    papelVarianteId?: string;
    tipoImpresion?: TipoImpresionProductoVariante;
    caras?: CarasProductoVariante;
    procesoDefinicionId?: string;
    activo?: boolean;
  },
) {
  return apiRequest<ProductoVariante>(`/productos-servicios/variantes/${varianteId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getVarianteOpcionesProductivas(varianteId: string) {
  return apiRequest<VarianteOpcionesProductivas>(
    `/productos-servicios/variantes/${varianteId}/opciones-productivas`,
  );
}

export async function updateVarianteOpcionesProductivas(
  varianteId: string,
  payload: {
    dimensiones: Array<{
      dimension: DimensionOpcionProductiva;
      valores: ValorOpcionProductiva[];
    }>;
  },
) {
  return apiRequest<VarianteOpcionesProductivas>(
    `/productos-servicios/variantes/${varianteId}/opciones-productivas`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteProductoVariante(varianteId: string) {
  return apiRequest<{ id: string; deleted: boolean }>(`/productos-servicios/variantes/${varianteId}`, {
    method: 'DELETE',
  });
}

export async function assignProductoVarianteRuta(
  varianteId: string,
  procesoDefinicionId: string | null,
) {
  return apiRequest<ProductoVariante>(
    `/productos-servicios/variantes/${varianteId}/ruta`,
    {
      method: 'PUT',
      body: JSON.stringify({ procesoDefinicionId }),
    },
  );
}

export async function updateProductoRutaPolicy(
  productoId: string,
  payload: {
    usarRutaComunVariantes: boolean;
    procesoDefinicionDefaultId?: string | null;
    dimensionesBaseConsumidas?: DimensionOpcionProductiva[];
    matchingBasePorVariante?: Array<{
      varianteId: string;
      matching: Array<{
        tipoImpresion?: TipoImpresionProductoVariante | null;
        caras?: CarasProductoVariante | null;
        pasoPlantillaId: string;
        perfilOperativoId: string;
      }>;
    }>;
    pasosFijosPorVariante?: Array<{
      varianteId: string;
      pasos: Array<{
        pasoPlantillaId: string;
        perfilOperativoId: string;
      }>;
    }>;
  },
) {
  return apiRequest<ProductoRutaPolicy>(
    `/productos-servicios/${productoId}/ruta-policy`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}

export async function assignProductoVariantesRutaMasiva(
  productoId: string,
  payload: {
    procesoDefinicionId: string;
    incluirInactivas?: boolean;
  },
) {
  return apiRequest<{
    productoId: string;
    updatedCount: number;
    procesoDefinicionId: string;
    incluirInactivas: boolean;
  }>(`/productos-servicios/${productoId}/variantes/ruta-masiva`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function assignProductoMotor(
  productoId: string,
  payload: {
    motorCodigo: string;
    motorVersion: number;
  },
) {
  return apiRequest<ProductoServicio>(`/productos-servicios/${productoId}/motor`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getProductoMotorConfig(productoId: string) {
  return apiRequest<ProductoMotorConfig>(
    `/productos-servicios/${productoId}/motor-config`,
  );
}

export async function upsertProductoMotorConfig(
  productoId: string,
  parametros: Record<string, unknown>,
) {
  return apiRequest<ProductoMotorConfig>(
    `/productos-servicios/${productoId}/motor-config`,
    {
      method: 'PUT',
      body: JSON.stringify({ parametros }),
    },
  );
}

export async function getVarianteMotorOverride(varianteId: string) {
  return apiRequest<VarianteMotorOverride>(
    `/productos-servicios/variantes/${varianteId}/motor-override`,
  );
}

export async function upsertVarianteMotorOverride(
  varianteId: string,
  parametros: Record<string, unknown>,
) {
  return apiRequest<VarianteMotorOverride>(
    `/productos-servicios/variantes/${varianteId}/motor-override`,
    {
      method: 'PUT',
      body: JSON.stringify({ parametros }),
    },
  );
}

export async function cotizarProductoVariante(
  varianteId: string,
  payload: {
    cantidad: number;
    periodo?: string;
    seleccionesBase?: Array<{ dimension: DimensionOpcionProductiva; valor: ValorOpcionProductiva }>;
    checklistRespuestas?: Array<{ preguntaId: string; respuestaId: string }>;
  },
) {
  return apiRequest<CotizacionProductoVariante>(
    `/productos-servicios/variantes/${varianteId}/cotizar`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function previewImposicionProductoVariante(
  varianteId: string,
  parametros: Record<string, unknown>,
) {
  return apiRequest<Record<string, unknown>>(
    `/productos-servicios/variantes/${varianteId}/imposicion-preview`,
    {
      method: 'POST',
      body: JSON.stringify({ parametros }),
    },
  );
}

export async function getCotizacionesProductoVariante(varianteId: string) {
  return apiRequest<CotizacionProductoSnapshotResumen[]>(
    `/productos-servicios/variantes/${varianteId}/cotizaciones`,
  );
}

export async function getCotizacionProductoById(snapshotId: string) {
  return apiRequest<{
    id: string;
    cantidad: number;
    periodoTarifa: string;
    motorCodigo: string;
    motorVersion: number;
    configVersionBase: number | null;
    configVersionOverride: number | null;
    total: number;
    resultado: Record<string, unknown>;
    createdAt: string;
  }>(`/productos-servicios/cotizaciones/${snapshotId}`);
}
