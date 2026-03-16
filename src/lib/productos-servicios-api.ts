import { apiRequest } from '@/lib/api';
import {
  CarasProductoVariante,
  DimensionOpcionProductiva,
  PliegoImpresionCatalogItem,
  CotizacionProductoSnapshotResumen,
  CotizacionProductoVariante,
  AddonEffect,
  ReglaCostoAdicionalEfecto,
  ProductoAdicional,
  ProductoAdicionalAsignado,
  EstadoProductoServicio,
  FamiliaProducto,
  MotorCostoCatalogItem,
  ProductoMotorConfig,
  ProductoRutaPolicy,
  ProductoVariante,
  ProductoServicio,
  SubfamiliaProducto,
  TipoProductoAdicionalEfecto,
  VarianteAdicionalRestriccion,
  VarianteOpcionesProductivas,
  ValorOpcionProductiva,
  TipoImpresionProductoVariante,
  TipoConsumoAdicionalMaterial,
  TipoProductoAdicional,
  MetodoCostoProductoAdicional,
  TipoProductoServicio,
  VarianteMotorOverride,
} from '@/lib/productos-servicios';

export async function getCatalogoPliegosImpresion() {
  return apiRequest<PliegoImpresionCatalogItem[]>('/productos-servicios/catalogos/pliegos-impresion');
}

export async function getMotoresCostoCatalogo() {
  return apiRequest<MotorCostoCatalogItem[]>('/productos-servicios/motores');
}

export async function getAdicionalesCatalogo() {
  return apiRequest<ProductoAdicional[]>('/productos-servicios/adicionales');
}

export async function createAdicionalCatalogo(payload: {
  codigo?: string;
  nombre: string;
  descripcion?: string;
  tipo: TipoProductoAdicional;
  metodoCosto: MetodoCostoProductoAdicional;
  centroCostoId?: string;
  activo: boolean;
  metadata?: Record<string, unknown>;
  materiales: Array<{
    materiaPrimaVarianteId: string;
    tipoConsumo: TipoConsumoAdicionalMaterial;
    factorConsumo: number;
    mermaPct?: number;
    activo: boolean;
    detalle?: Record<string, unknown>;
  }>;
}) {
  return apiRequest<ProductoAdicional>('/productos-servicios/adicionales', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdicionalCatalogo(
  adicionalId: string,
  payload: {
    codigo?: string;
    nombre: string;
    descripcion?: string;
    tipo: TipoProductoAdicional;
    metodoCosto: MetodoCostoProductoAdicional;
    centroCostoId?: string;
    activo: boolean;
    metadata?: Record<string, unknown>;
    materiales: Array<{
      materiaPrimaVarianteId: string;
      tipoConsumo: TipoConsumoAdicionalMaterial;
      factorConsumo: number;
      mermaPct?: number;
      activo: boolean;
      detalle?: Record<string, unknown>;
    }>;
  },
) {
  return apiRequest<ProductoAdicional>(`/productos-servicios/adicionales/${adicionalId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function toggleAdicionalCatalogo(adicionalId: string) {
  return apiRequest<ProductoAdicional>(`/productos-servicios/adicionales/${adicionalId}/toggle`, {
    method: 'PUT',
  });
}

export async function getAdicionalEfectos(adicionalId: string) {
  return apiRequest<AddonEffect[]>(`/productos-servicios/adicionales/${adicionalId}/efectos`);
}

export async function createAdicionalEfecto(
  adicionalId: string,
  payload: {
    tipo: TipoProductoAdicionalEfecto;
    nombre?: string;
    activo?: boolean;
    scopes?: Array<{
      varianteId?: string;
      dimension?: DimensionOpcionProductiva;
      valor?: ValorOpcionProductiva;
    }>;
    routeEffect?: {
      pasos: Array<{
        orden?: number;
        nombre: string;
        centroCostoId: string;
        maquinaId?: string;
        perfilOperativoId?: string;
        setupMin?: number;
        runMin?: number;
        cleanupMin?: number;
        tiempoFijoMin?: number;
      }>;
    };
    costEffect?: {
      regla: ReglaCostoAdicionalEfecto;
      valor: number;
      centroCostoId?: string;
      detalle?: Record<string, unknown>;
    };
    materialEffect?: {
      materiaPrimaVarianteId: string;
      tipoConsumo: TipoConsumoAdicionalMaterial;
      factorConsumo: number;
      mermaPct?: number;
      detalle?: Record<string, unknown>;
    };
  },
) {
  return apiRequest<AddonEffect>(`/productos-servicios/adicionales/${adicionalId}/efectos`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdicionalEfecto(
  adicionalId: string,
  efectoId: string,
  payload: {
    tipo: TipoProductoAdicionalEfecto;
    nombre?: string;
    activo?: boolean;
    scopes?: Array<{
      varianteId?: string;
      dimension?: DimensionOpcionProductiva;
      valor?: ValorOpcionProductiva;
    }>;
    routeEffect?: {
      pasos: Array<{
        orden?: number;
        nombre: string;
        centroCostoId: string;
        maquinaId?: string;
        perfilOperativoId?: string;
        setupMin?: number;
        runMin?: number;
        cleanupMin?: number;
        tiempoFijoMin?: number;
      }>;
    };
    costEffect?: {
      regla: ReglaCostoAdicionalEfecto;
      valor: number;
      centroCostoId?: string;
      detalle?: Record<string, unknown>;
    };
    materialEffect?: {
      materiaPrimaVarianteId: string;
      tipoConsumo: TipoConsumoAdicionalMaterial;
      factorConsumo: number;
      mermaPct?: number;
      detalle?: Record<string, unknown>;
    };
  },
) {
  return apiRequest<AddonEffect>(`/productos-servicios/adicionales/${adicionalId}/efectos/${efectoId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function toggleAdicionalEfecto(adicionalId: string, efectoId: string) {
  return apiRequest<AddonEffect>(`/productos-servicios/adicionales/${adicionalId}/efectos/${efectoId}/toggle`, {
    method: 'PUT',
  });
}

export async function deleteAdicionalEfecto(adicionalId: string, efectoId: string) {
  return apiRequest<{ adicionalId: string; efectoId: string; deleted: boolean }>(
    `/productos-servicios/adicionales/${adicionalId}/efectos/${efectoId}`,
    { method: 'DELETE' },
  );
}

export async function getAdicionalServicioPricing(adicionalId: string) {
  return apiRequest<{
    niveles: Array<{ id: string; nombre: string; orden: number; activo: boolean }>;
    reglas: Array<{
      id: string;
      nivelId: string;
      tiempoMin: number;
    }>;
  }>(`/productos-servicios/adicionales/${adicionalId}/servicio-pricing`);
}

export async function updateAdicionalServicioPricing(
  adicionalId: string,
  payload: {
    niveles: Array<{ id?: string; nombre: string; orden?: number; activo?: boolean }>;
    reglas: Array<{
      nivelId: string;
      tiempoMin: number;
    }>;
  },
) {
  return apiRequest<{
    niveles: Array<{ id: string; nombre: string; orden: number; activo: boolean }>;
    reglas: Array<{
      id: string;
      nivelId: string;
      tiempoMin: number;
    }>;
  }>(`/productos-servicios/adicionales/${adicionalId}/servicio-pricing`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
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

export async function getProductoAdicionales(productoId: string) {
  return apiRequest<ProductoAdicionalAsignado[]>(`/productos-servicios/${productoId}/adicionales`);
}

export async function assignProductoAdicional(
  productoId: string,
  payload: {
    adicionalId: string;
    activo?: boolean;
  },
) {
  return apiRequest<ProductoAdicionalAsignado>(`/productos-servicios/${productoId}/adicionales`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function removeProductoAdicional(
  productoId: string,
  adicionalId: string,
) {
  return apiRequest<{ productoServicioId: string; adicionalId: string; removed: boolean }>(
    `/productos-servicios/${productoId}/adicionales/${adicionalId}`,
    {
      method: 'DELETE',
    },
  );
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

export async function getVarianteAdicionalesRestricciones(varianteId: string) {
  return apiRequest<VarianteAdicionalRestriccion[]>(
    `/productos-servicios/variantes/${varianteId}/adicionales/restricciones`,
  );
}

export async function setVarianteAdicionalRestriccion(
  varianteId: string,
  payload: {
    adicionalId: string;
    permitido: boolean;
  },
) {
  return apiRequest<VarianteAdicionalRestriccion>(
    `/productos-servicios/variantes/${varianteId}/adicionales/restricciones`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
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
    addonsSeleccionados?: string[];
    addonsConfig?: Array<{ addonId: string; nivelId?: string }>;
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
