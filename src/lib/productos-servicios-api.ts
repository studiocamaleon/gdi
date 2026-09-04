/**
 * Cliente API del módulo Productos & Servicios — Modelo Universal V2.
 *
 * Endpoints respaldados por `apps/api/src/productos-servicios/productos-servicios.controller.ts`.
 */

import { apiRequest } from "@/lib/api";
import type {
  CargoDirectoCatalogo,
  CatalogoFamilias,
  PasoTenant,
  PlantillaPaso,
  UpsertPasoTenantInput,
  MedidaPredefinidaProducto,
  DimensionProducto,
  EstructuraProducto,
  ModoMedidasProducto,
  ProductoCategoriaComercial,
  ProductoDetalle,
  ProductoListItem,
  MinimoComercialBase,
  MinimoComercialPolitica,
  RutaListItem,
} from "@/lib/productos-servicios";

export interface ProductosListParams {
  page?: number;
  limit?: number;
  search?: string;
  activo?: boolean;
  unidadComercial?: "unidad" | "m2" | "metro_lineal";
  subcategoriaCodigo?: string;
  categoriaCodigo?: string;
  orden?: "recientes" | "nombre_asc" | "nombre_desc";
  composicion?: "simple" | "compuesto";
}

export interface ProductosListResponse {
  data: ProductoListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

function buildProductosPath(params: ProductosListParams = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.search?.trim()) sp.set("search", params.search.trim());
  if (params.activo !== undefined) sp.set("activo", String(params.activo));
  if (params.unidadComercial) sp.set("unidadComercial", params.unidadComercial);
  if (params.subcategoriaCodigo) {
    sp.set("subcategoriaCodigo", params.subcategoriaCodigo);
  }
  if (params.categoriaCodigo) sp.set("categoriaCodigo", params.categoriaCodigo);
  if (params.orden) sp.set("orden", params.orden);
  if (params.composicion) sp.set("composicion", params.composicion);
  const qs = sp.toString();
  return `/productos-servicios/productos${qs ? `?${qs}` : ""}`;
}

/** Listado paginado (envelope) para la tabla de catálogo. */
export async function listProductos(
  params: ProductosListParams = {},
): Promise<ProductosListResponse> {
  return apiRequest<ProductosListResponse>(buildProductosPath(params));
}

/**
 * Devuelve TODOS los productos (recorriendo páginas). Para selectores/pickers
 * que necesitan el catálogo completo; cada query queda acotada por el límite.
 */
export async function getProductos(
  activo?: boolean,
): Promise<ProductoListItem[]> {
  const limit = 200;
  const all: ProductoListItem[] = [];
  let page = 1;
  for (;;) {
    const res = await listProductos({ page, limit, activo });
    all.push(...res.data);
    if (page >= res.pages || res.data.length === 0) break;
    page += 1;
  }
  // Los selectores comerciales no deben ofrecer productos publicados de forma
  // histórica que hoy ya no pasan la validación mínima del catálogo. Los
  // productos nuevos, además, sólo pueden publicarse tras la validación
  // completa del backend.
  return activo === true
    ? all.filter((producto) => producto.listoParaCotizar === true)
    : all;
}

export async function getProductoById(id: string): Promise<ProductoDetalle> {
  return apiRequest<ProductoDetalle>(`/productos-servicios/productos/${id}`);
}

export interface ProductoRecetaMaterial {
  id: string;
  pasoClave: string;
  pasoNombre: string;
  slotCodigo: string;
  slotNombre?: string | null;
  rol?: string | null;
  modoSeleccion: string;
  materialVarianteId?: string | null;
  materialSku?: string | null;
  materialNombre?: string | null;
  unidad?: string | null;
  formula: string;
  cantidadBase?: string | null;
  cantidadFactor?: number | null;
  fuenteMedida?: string | null;
  mermaAdicionalPct: number;
  aplicaMultiCaras: boolean;
  orden: number;
}

export type BomTotalesNodo = {
  materialesDirectos: number;
  materialesAcumulados: number;
  recursosDirectos: number;
  recursosAcumulados: number;
  documentosDirectos: number;
  documentosAcumulados: number;
  componentesDirectos: number;
  componentesAcumulados: number;
  nivelesDescendientes: number;
};

export type BomNodoMultinivel = {
  ocurrenciaId: string;
  nivel: number;
  productoId: string;
  productoCodigo: string;
  productoNombre: string;
  unidadComercial: string;
  recetaId: string;
  revisionId: string;
  revisionNumero: number;
  revisionEstado: "BORRADOR" | "PUBLICADA" | "DEPRECADA";
  revisionHuella: string;
  rutaAlternativaId: string;
  rutaNombre: string;
  relacion: null | {
    codigo: string;
    nombre: string;
    formula: string;
    cantidad: number;
    unidad: string;
    requerido: boolean;
    politicaEjecucion: "INLINE" | "INDEPENDIENTE";
    configuracionJson?: ConfiguracionComponenteFabricado | null;
    nodoIncorporacionClave?: string | null;
  };
  factorReferencia: number;
  materialesDirectos: ProductoRecetaMaterial[];
  recursosDirectos: Array<{
    id: string;
    pasoClave: string;
    pasoNombre: string;
    familiaCodigo: string;
    maquinaNombre?: string | null;
    estacionNombre?: string | null;
    perfilNombre?: string | null;
    centroCostoNombre?: string | null;
    dotacionOperarios: number;
    tercerizado: boolean;
    proveedorNombre?: string | null;
    orden: number;
  }>;
  documentosDirectos: Array<{
    id: string;
    alcance: string;
    pasoClave?: string | null;
    codigo: string;
    nombre: string;
    proposito: string;
    etapa: string;
    requerido: boolean;
    orden: number;
  }>;
  hijos: BomNodoMultinivel[];
  totales: BomTotalesNodo;
};

export type BomMaterialConsolidado = {
  clave: string;
  nombre: string;
  sku?: string | null;
  unidad?: string | null;
  formula: string;
  cantidadFactorReferencia: number | null;
  ocurrencias: Array<{
    ocurrenciaId: string;
    productoId: string;
    productoNombre: string;
    pasoNombre: string;
    nivel: number;
    rutaProductos: string[];
    factorReferencia: number;
    cantidadFactor: number | null;
  }>;
};

export type BomMultinivel = {
  revisionRaizId: string;
  generadoDesdeRevision: {
    numero: number;
    estado: "BORRADOR" | "PUBLICADA" | "DEPRECADA";
    huellaConfiguracion: string;
  };
  resumen: {
    niveles: number;
    productosFabricados: number;
    materialesDirectos: number;
    materialesAcumulados: number;
    recursosDirectos: number;
    recursosAcumulados: number;
    documentosDirectos: number;
    documentosAcumulados: number;
  };
  raiz: BomNodoMultinivel;
  materialesConsolidados: BomMaterialConsolidado[];
};

export interface ProductoRecetaRevision {
  id: string;
  numero: number;
  estado: "BORRADOR" | "PUBLICADA" | "DEPRECADA";
  rutaAlternativaId: string;
  rutaVersion: number;
  huellaConfiguracion: string;
  topologiaProduccion: "LINEAL" | "DAG";
  grafoProduccionJson?: {
    topologia: "LINEAL" | "DAG";
    nodos: Array<{
      clave: string;
      indice: number;
      gates?: Array<"MATERIAL" | "CALIDAD">;
    }>;
    aristas: Array<{ desdeClave: string; haciaClave: string }>;
    raices: string[];
    terminales: string[];
  } | null;
  pasosCompuestosJson?: ConfiguracionPasoCompuesto[] | null;
  cambios?: string | null;
  creadaPorNombre: string;
  publicadaPorNombre?: string | null;
  publicadaEl?: string | null;
  deprecadaPorNombre?: string | null;
  deprecadaEl?: string | null;
  createdAt: string;
  updatedAt: string;
  materiales: ProductoRecetaMaterial[];
  recursos: Array<{
    id: string;
    pasoClave: string;
    pasoNombre: string;
    familiaCodigo: string;
    maquinaCodigo?: string | null;
    maquinaNombre?: string | null;
    estacionId?: string | null;
    estacionNombre?: string | null;
    perfilNombre?: string | null;
    centroCostoNombre?: string | null;
    dotacionOperarios: number;
    habilidadesRequeridas?: string[];
    capacidadesSnapshotJson?: unknown;
    tercerizado: boolean;
    proveedorNombre?: string | null;
    orden: number;
  }>;
  componentes: Array<{
    id: string;
    productoComponenteId: string;
    recetaRevisionId: string;
    recetaVersion: number;
    recetaHuella: string;
    codigo: string;
    nombre: string;
    politicaEjecucion: "INLINE" | "INDEPENDIENTE";
    formula: string;
    cantidad: number;
    unidad: string;
    requerido: boolean;
    configuracionJson?: ConfiguracionComponenteFabricado | null;
    nodoIncorporacionClave?: string | null;
    nodosPredecesoresClaves?: string[];
    orden: number;
  }>;
  documentos: Array<{
    id: string;
    alcance: "ORDEN" | "ITEM" | "PASO";
    pasoClave?: string | null;
    codigo: string;
    nombre: string;
    proposito: string;
    etapa: string;
    tipoAprobacion?: string | null;
    requerido: boolean;
    descripcion?: string | null;
    orden: number;
  }>;
}

export type ProductoRecetaDocumentoInput = {
  codigo: string;
  nombre: string;
  alcance?: "ORDEN" | "ITEM" | "PASO";
  pasoClave?: string | null;
  proposito: "PRINT" | "CUT" | "RENDER" | "PLANO" | "INSTRUCTIVO" | "OTRO";
  etapa: "BRIEF" | "DISENO" | "PROTOTIPO" | "MUESTRA" | "PRODUCCION";
  tipoAprobacion?:
    | "CLIENTE"
    | "DISENO"
    | "COLOR_MUESTRA"
    | "INGENIERIA"
    | "LIBERACION_PRODUCTIVA"
    | null;
  requerido?: boolean;
  descripcion?: string | null;
  orden?: number;
};

export type ProductoRecetaComponenteInput = {
  productoComponenteId: string;
  codigo: string;
  nombre: string;
  politicaEjecucion?: "INLINE" | "INDEPENDIENTE";
  formula?: string;
  cantidad: number;
  unidad?: string;
  requerido?: boolean;
  configuracionJson?: ConfiguracionComponenteFabricado | null;
  nodoIncorporacionClave?: string | null;
  nodosPredecesoresClaves?: string[];
  orden?: number;
};

export type OrigenParametroComponente =
  | "DEFAULT_HIJO"
  | "FIJO"
  | "PADRE"
  | "FORMULA"
  | "COTIZACION";

export type BindingParametroComponente = {
  clave: string;
  etiqueta: string;
  tipoDato: string;
  unidad?: string | null;
  requerido?: boolean;
  origen: OrigenParametroComponente;
  valor?: unknown;
  padreClave?: string | null;
  expresion?: string | null;
  regla?: {
    campoPadre: string;
    operador: "COPIAR" | "SUMAR" | "RESTAR" | "MULTIPLICAR" | "DIVIDIR";
    valor?: number | null;
    fuente?: {
      tipo: "PADRE" | "COMPONENTE";
      campo: string;
      componenteCodigo?: string | null;
    } | null;
  } | null;
  opciones?: Array<{ valor: string; etiqueta: string }>;
};

export type ConfiguracionComponenteFabricado = {
  version: 1 | 2;
  bindings: BindingParametroComponente[];
  operacionesIncorporacion?: OperacionIncorporacion[];
  repeticion?: {
    version: 1;
    permitida: boolean;
    /** 1 incluye la ocurrencia declarada; 0 empieza vacío al cotizar. */
    minimo: 0 | 1;
    /** Máximo total de ocurrencias cotizadas. */
    maximo: number;
    etiquetaAgregar?: string | null;
  };
  pricing?: PoliticaPricingComponente;
  nestingCompuesto?: {
    version: 1;
    excluido: boolean;
    motivo?: string | null;
  };
};

export type PoliticaNestingCompuesto =
  | "INDEPENDIENTE"
  | "CONSOLIDAR_COMPATIBLES";

export type ModoPricingComponente =
  | "HEREDAR_PADRE"
  | "USAR_PRODUCTO_HIJO"
  | "OVERRIDE";

export type PrecioConfigComponente = {
  metodoCalculo: string;
  detalle: Record<string, unknown>;
};

export type PoliticaPricingComponente = {
  version: 1;
  modo: ModoPricingComponente;
  precioConfigOverride?: PrecioConfigComponente;
  precioConfigSnapshot?: PrecioConfigComponente;
};

export type FuenteOperacionIncorporacion = {
  tipo: "PADRE" | "COMPONENTE" | "COMPONENTES";
  campo: string;
  componenteCodigo?: string | null;
  componentesCodigos?: string[];
  agregacion?: "SUM";
};

export type OperacionIncorporacion = {
  codigo: string;
  nombre: string;
  modoTiempo: "FIJO" | "POR_UNIDAD";
  fuenteCantidad?: FuenteOperacionIncorporacion | null;
  factorConversionFuente?: number;
  unidadCantidad?: string | null;
  minutosFijos?: number | null;
  minutosPorUnidad?: number | null;
  dotacionOperarios?: number;
  orden?: number;
};

export type ConfiguracionOperacionCompuesta = OperacionIncorporacion & {
  activa: boolean;
  componentesCodigos: string[];
};

export type ConfiguracionPasoCompuesto = {
  version: 1 | 2;
  nodoClave: string;
  pasoTenantId: string;
  pasoNombre: string;
  operaciones: ConfiguracionOperacionCompuesta[];
  pasos?: ConfiguracionPasoInternoCompuesto[];
};

export type ConfiguracionPasoInternoCompuesto = {
  codigo: string;
  familiaCodigo: string;
  nombre: string;
  activa: boolean;
  componentesCodigos: string[];
  requiereCodigos: string[];
  configuracion: UpsertConfigPasoPayload;
  orden: number;
};

export type FormularioCotizacionProducto = {
  producto: {
    id: string;
    codigo: string;
    nombre: string;
    unidadComercial: string;
  };
  cantidad: {
    jobContextKey: "cantidad";
    unidad: string;
    minimo: Record<string, unknown> | null;
  };
  medidas: {
    modo: string;
    ejes: DimensionProducto[];
    instruccion: string;
    unidadEntrada: "mm";
    jobContextKeys: string[];
    predefinidas: Array<{
      id: string;
      nombre: string;
      anchoMm: number;
      altoMm: number;
      profundidadMm?: number | null;
      esDefault: boolean;
    }>;
    default: {
      anchoMm: number;
      altoMm: number;
      profundidadMm?: number | null;
    } | null;
  };
  geometrias?: {
    version: 1;
    modo: "RECTANGULAR" | "VECTORIAL" | "AMBAS";
    fuentes: Array<{
      id: string;
      nombre: string;
      requerida: boolean;
    }>;
  };
  preguntas: Array<
    Record<string, unknown> & { tipo: string; jobContextKey: string }
  >;
  herramientas?: Array<{
    tipo: "diseno_vectorial";
    jobContextKey: "disenoVectorialFuente";
    etiqueta: string;
    requerido: boolean;
  }>;
  adicionales: Array<
    Record<string, unknown> & {
      id: string;
      tipo: "paso" | "paso_condicional" | "cargo_paso" | "cargo_cotizacion";
      nombre: string;
      jobContextKey: string;
      condicionadoPor?: string[];
      requiereIds?: string[];
    }
  >;
  outputsPublicos: Array<{
    clave: string;
    etiqueta: string;
    tipoDato: "number";
    unidad: string | null;
    unidadVisible: string | null;
    familiaCodigo: string;
    pasoNombre: string;
  }>;
};

export interface ProductoReceta {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  revisionPublicadaId?: string | null;
  rutaAlternativa: {
    id: string;
    nombre: string;
    rutaVersion: number;
    activo: boolean;
  };
  revisionPublicada?: ProductoRecetaRevision | null;
  revisiones: ProductoRecetaRevision[];
}

export type EstadoRutaPublicacionReceta =
  | "SIN_RECETA"
  | "BORRADOR_INICIAL"
  | "VIGENTE"
  | "VIGENTE_CON_BORRADOR"
  | "DESACTUALIZADA"
  | "BLOQUEADA";

export type EstadoDependenciaReceta =
  | "VIGENTE"
  | "ACTUALIZACION_DISPONIBLE"
  | "SIN_PUBLICACION"
  | "AMBIGUA";

export interface EstadoPublicacionProducto {
  producto: { id: string; nombre: string };
  resumen: {
    rutasTotales: number;
    rutasVigentes: number;
    rutasConAtencion: number;
    productosPadreAfectados: number;
  };
  rutas: Array<{
    ruta: {
      id: string;
      nombre: string;
      version: number;
      esPreferida: boolean;
    };
    estado: EstadoRutaPublicacionReceta;
    cotizableConReceta: boolean;
    revisionPublicada: {
      id: string;
      version: number;
      publicadaEl?: string | null;
      publicadaPorNombre?: string | null;
    } | null;
    borrador: {
      id: string;
      numero: number;
      updatedAt: string;
    } | null;
    motivos: Array<{
      codigo: string;
      titulo: string;
      detalle: string;
    }>;
    dependencias: Array<{
      ocurrencia: { id: string; nombre: string; productoId: string };
      rutaCongelada: { id: string; nombre: string } | null;
      revisionCongelada: { id: string; version: number };
      revisionDisponible: {
        id: string;
        version: number;
        publicadaEl?: string | null;
      } | null;
      estado: EstadoDependenciaReceta;
      publicacionesDisponibles: Array<{
        ruta: { id: string; nombre: string };
        revisionId: string;
        version: number;
      }>;
    }>;
  }>;
  usadoPor: Array<{
    productoPadre: { id: string; nombre: string };
    rutaPadre: { id: string; nombre: string };
    revisionPublicadaPadre: { id: string; version: number };
    ocurrencias: Array<{
      id: string;
      nombre: string;
      revisionCongelada: { id: string; version: number };
      revisionDisponible: { id: string; version: number } | null;
      estado: "VIGENTE" | "ACTUALIZACION_DISPONIBLE" | "SIN_PUBLICACION";
    }>;
  }>;
}

export function getRecetasProducto(id: string): Promise<ProductoReceta[]> {
  return apiRequest<ProductoReceta[]>(
    `/productos-servicios/productos/${id}/receta`,
  );
}

export function getEstadoPublicacionProducto(
  id: string,
): Promise<EstadoPublicacionProducto> {
  return apiRequest<EstadoPublicacionProducto>(
    `/productos-servicios/productos/${id}/receta/estado-publicacion`,
  );
}

export function getBomMultinivelRevision(
  revisionId: string,
): Promise<BomMultinivel> {
  return apiRequest<BomMultinivel>(
    `/productos-servicios/recetas/revisiones/${revisionId}/bom-multinivel`,
  );
}

export function getFormularioCotizacionProducto(
  id: string,
  rutaAlternativaId?: string,
): Promise<FormularioCotizacionProducto> {
  const query = rutaAlternativaId
    ? `?rutaAlternativaId=${encodeURIComponent(rutaAlternativaId)}`
    : "";
  return apiRequest<FormularioCotizacionProducto>(
    `/productos-servicios/productos/${id}/formulario-cotizacion${query}`,
  );
}

export function guardarBorradorReceta(
  productoId: string,
  payload: {
    rutaAlternativaId: string;
    cambios?: string;
    expectedUpdatedAt?: string;
    documentos?: ProductoRecetaDocumentoInput[];
    componentes?: ProductoRecetaComponenteInput[];
    pasosCompuestos?: ConfiguracionPasoCompuesto[];
    dependencias?: Array<{ desdeClave: string; haciaClave: string }>;
    gates?: Array<{
      nodoClave: string;
      tipo: "MATERIAL" | "CALIDAD";
    }>;
  },
): Promise<ProductoRecetaRevision> {
  return apiRequest<ProductoRecetaRevision>(
    `/productos-servicios/productos/${productoId}/receta/borrador`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export function publicarReceta(
  revisionId: string,
  payload: { expectedUpdatedAt: string; cambios?: string },
): Promise<ProductoRecetaRevision> {
  return apiRequest<ProductoRecetaRevision>(
    `/productos-servicios/recetas/revisiones/${revisionId}/publicar`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export function descartarBorradorReceta(
  revisionId: string,
  payload: { expectedUpdatedAt: string },
): Promise<{
  id: string;
  numero: number;
  descartada: true;
  recetaEliminada: boolean;
}> {
  return apiRequest(
    `/productos-servicios/recetas/revisiones/${revisionId}/borrador`,
    {
      method: "DELETE",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export function deprecarReceta(
  revisionId: string,
  payload: { expectedUpdatedAt: string; motivo?: string },
): Promise<ProductoRecetaRevision> {
  return apiRequest<ProductoRecetaRevision>(
    `/productos-servicios/recetas/revisiones/${revisionId}/deprecar`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function getCatalogoComercial(): Promise<
  ProductoCategoriaComercial[]
> {
  return apiRequest<ProductoCategoriaComercial[]>(
    "/productos-servicios/catalogo-comercial",
  );
}

export interface ValidacionProducto {
  exitoso: boolean;
  errores: Array<{
    severidad: "ERROR" | "WARNING";
    codigo: string;
    mensaje: string;
    ubicacion?: {
      rutaAltId?: string;
      rutaPasoId?: string;
      slotCodigo?: string;
    };
  }>;
}

export async function validarProducto(id: string): Promise<ValidacionProducto> {
  return apiRequest<ValidacionProducto>(
    `/productos-servicios/productos/${id}/validar`,
  );
}

export interface CrearProductoPayload {
  codigo?: string;
  nombre: string;
  descripcion?: string;
  estructuraProducto?: EstructuraProducto;
  subcategoriaComercialCodigo: string;
  atributosComercialesJson?: Record<string, unknown>;
  unidadComercial: "unidad" | "m2" | "metro_lineal";
  modoMedidas: ModoMedidasProducto;
  dimensionesRequeridas: DimensionProducto[];
  minimoComercialPolitica?: MinimoComercialPolitica;
  minimoComercialCantidad?: number | null;
  minimoComercialBase?: MinimoComercialBase;
  medidaDefaultAnchoMm?: number;
  medidaDefaultAltoMm?: number;
  medidaDefaultProfundidadMm?: number;
  medidasPredefinidasJson?: MedidaPredefinidaProducto[];
  personalizacionesJson?: Record<string, unknown>[];
  precioConfigJson?: Record<string, unknown>;
}

export async function crearProducto(payload: CrearProductoPayload) {
  return apiRequest("/productos-servicios/productos", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

export interface ActualizarProductoPayload {
  expectedUpdatedAt?: string;
  nombre?: string;
  descripcion?: string;
  estructuraProducto?: EstructuraProducto;
  subcategoriaComercialCodigo?: string;
  atributosComercialesJson?: Record<string, unknown>;
  unidadComercial?: "unidad" | "m2" | "metro_lineal";
  modoMedidas?: ModoMedidasProducto;
  dimensionesRequeridas?: DimensionProducto[];
  minimoComercialPolitica?: MinimoComercialPolitica;
  minimoComercialCantidad?: number | null;
  minimoComercialBase?: MinimoComercialBase;
  medidaDefaultAnchoMm?: number | null;
  medidaDefaultAltoMm?: number | null;
  medidaDefaultProfundidadMm?: number | null;
  medidasPredefinidasJson?: MedidaPredefinidaProducto[] | null;
  personalizacionesJson?: Record<string, unknown>[] | null;
  precioConfigJson?: Record<string, unknown>;
  activo?: boolean;
}

export async function actualizarProducto(
  id: string,
  payload: ActualizarProductoPayload,
): Promise<{
  updatedAt: string;
  atributosComercialesJson: Record<string, unknown> | null;
}> {
  return apiRequest<{
    updatedAt: string;
    atributosComercialesJson: Record<string, unknown> | null;
  }>(`/productos-servicios/productos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

export interface DuplicarProductoPayload {
  codigo?: string;
  nombre?: string;
  activo?: boolean;
}

export async function duplicarProducto(
  id: string,
  payload: DuplicarProductoPayload = {},
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(
    `/productos-servicios/productos/${id}/duplicar`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function eliminarProducto(id: string) {
  return apiRequest(`/productos-servicios/productos/${id}`, {
    method: "DELETE",
  });
}

export async function getRutas(options?: {
  incluirInactivas?: boolean;
}): Promise<RutaListItem[]> {
  const query = options?.incluirInactivas ? "?incluirInactivas=true" : "";
  return apiRequest<RutaListItem[]>(`/productos-servicios/rutas${query}`);
}

export async function getRutaById(id: string) {
  return apiRequest(`/productos-servicios/rutas/${id}`);
}

export interface PasoRutaPayload {
  orden: number;
  familiaCodigo: string;
  nombreVisible?: string | null;
  icono?: string;
}

export interface CrearRutaPayload {
  codigo?: string;
  nombre: string;
  descripcion?: string;
  pasos?: PasoRutaPayload[];
  workflow?: import("@/lib/productos-servicios").RutaWorkflow;
}

export async function crearRuta(payload: CrearRutaPayload) {
  return apiRequest("/productos-servicios/rutas", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

export interface ActualizarRutaPayload {
  nombre?: string;
  descripcion?: string;
  activo?: boolean;
  pasos?: PasoRutaPayload[];
  workflow?: import("@/lib/productos-servicios").RutaWorkflow;
  nuevaVersion?: boolean;
  cambios?: string;
}

export async function actualizarRuta(
  id: string,
  payload: ActualizarRutaPayload,
) {
  return apiRequest(`/productos-servicios/rutas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

export interface DuplicarRutaPayload {
  codigo?: string;
  nombre?: string;
  activo?: boolean;
}

export async function duplicarRuta(
  id: string,
  payload: DuplicarRutaPayload = {},
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(
    `/productos-servicios/rutas/${id}/duplicar`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function eliminarRuta(id: string) {
  return apiRequest(`/productos-servicios/rutas/${id}`, { method: "DELETE" });
}

export async function migrarProductosRuta(
  id: string,
  rutaAlternativaIds: string[],
): Promise<{ migradas: number; requierenConfiguracion: number }> {
  return apiRequest(`/productos-servicios/rutas/${id}/migrar-productos`, {
    method: "POST",
    body: JSON.stringify({ rutaAlternativaIds }),
    headers: { "Content-Type": "application/json" },
  });
}

// ============================================================================
// PRODUCTO ↔ RUTAS ALTERNATIVAS
// ============================================================================

export interface CrearProductoRutaAltPayload {
  rutaId: string;
  rutaVersion: number;
  nombre: string;
  esPreferida?: boolean;
  reglaAutoSeleccionJson?: Record<string, unknown>;
  orden?: number;
}

export async function crearProductoRutaAlt(
  productoId: string,
  payload: CrearProductoRutaAltPayload,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(
    `/productos-servicios/productos/${productoId}/rutas-alternativas`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export interface ActualizarProductoRutaAltPayload {
  nombre?: string;
  esPreferida?: boolean;
  reglaAutoSeleccionJson?: Record<string, unknown>;
  orden?: number;
  activo?: boolean;
}

export async function actualizarProductoRutaAlt(
  rutaAltId: string,
  payload: ActualizarProductoRutaAltPayload,
) {
  return apiRequest(
    `/productos-servicios/productos/rutas-alternativas/${rutaAltId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function reordenarPasosRutaAlt(
  rutaAltId: string,
  pasoIds: string[],
) {
  return apiRequest(
    `/productos-servicios/productos/rutas-alternativas/${rutaAltId}/orden-pasos`,
    {
      method: "PATCH",
      body: JSON.stringify({ pasoIds }),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export interface DuplicarProductoRutaAltPayload {
  nombre?: string;
}

export async function duplicarProductoRutaAlt(
  rutaAltId: string,
  payload: DuplicarProductoRutaAltPayload = {},
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(
    `/productos-servicios/productos/rutas-alternativas/${rutaAltId}/duplicar`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function eliminarProductoRutaAlt(rutaAltId: string) {
  return apiRequest(
    `/productos-servicios/productos/rutas-alternativas/${rutaAltId}`,
    {
      method: "DELETE",
    },
  );
}

// ============================================================================
// CONFIG PASO (upsert)
// ============================================================================

export interface UpsertSlotMaterialPayload {
  slotCodigo: string;
  slotNombre?: string | null;
  slotRol?: "SUSTRATO" | "COMPONENTE" | "CONSUMIBLE" | "PACKAGING" | null;
  modoSeleccion:
    | "HARDCODED"
    | "COMERCIAL_ELIGE"
    | "MOTOR_ELIGE_AUTO"
    | "HEREDA_DE_PASO";
  heredaDeRutaPasoId?: string | null;
  heredaDeSlotCodigo?: string | null;
  criterioMotorAuto?: string | null;
  criterioInputCampo?: string | null;
  criterioMaterialCampo?: string | null;
  materialVarianteId?: string | null;
  candidatos?: Array<{
    materiaPrimaId: string;
    defaultVarianteId?: string | null;
    orden?: number;
    varianteIds: string[];
    /** true = usa todas las variantes activas del material (absorbe las nuevas). */
    todasLasVariantes?: boolean;
  }>;
  formula?: string;
  cantidadFactor?: number | null;
  mermaAdicionalPct?: number;
  cantidadBase?: string | null;
  /** Fuente de medida del consumo de este slot (override del default a nivel
   *  paso): 'piezas_visibles' | 'piezas_jobcontext' | 'output:<clave>'.
   *  docs/fuente-de-medida-de-consumo-diseno.md §8. */
  fuenteMedida?: string | null;
  aplicaMultiCaras?: boolean;
}

export interface UpsertMaquinaCandidataPayload {
  maquinaId: string;
  perfilDefaultId?: string | null;
  /** Desempate del perfil POR MODO de color habilitado
   *  ({ "CMYK+blanco": perfilId }). Con varios modos, el default global
   *  sólo cubre su modo — el resto necesita el suyo. Claves normalizadas. */
  perfilDefaultPorModo?: Record<string, string> | null;
  modoColorAllowedModes?: string[];
  esPreferida?: boolean;
  orden?: number;
}

export interface UpsertConfigPasoPayload {
  rutaPasoId: string;
  modoActivacion?: string | null;
  condicionActivacionJson?: Record<string, unknown> | null;
  modoTiempo?: string | null;
  mecanismoCantidad?: string | null;
  mecanismoCantidadConfigJson?: Record<string, unknown> | null;
  multiplicadoresActivos?: string[];
  paramsPasoJson?: Record<string, unknown> | null;
  nombreVisible?: string | null;
  maquinaM1Id?: string | null;
  perfilM1Id?: string | null;
  centroCostoId?: string | null;
  setupOverrideMin?: number | null;
  cleanupOverrideMin?: number | null;
  tiempoFijoOverrideMin?: number | null;
  dotacionOperarios?: number;
  /** rutaPasoId de los pasos que este paso enciende al activarse. */
  requiereRutaPasoIds?: string[];
  slotsMateriales?: UpsertSlotMaterialPayload[];
  maquinasCandidatas?: UpsertMaquinaCandidataPayload[];
  // === Tercerización (docs/productos-tercerizados-diseno.md) ===
  tercerizado?: boolean;
  proveedorId?: string | null;
  /** 'tarifa_magnitud' | 'matriz' | 'fijo'. */
  fuenteCostoTercerizado?: string | null;
  tercerizadoConfigJson?: Record<string, unknown> | null;
  plazoProveedorDias?: number | null;
  /** Filas de la matriz (fuente 'matriz'); el claveMatch lo deriva el server. */
  tercerizadoEntradas?: TercerizadoEntradaPayload[];
}

export interface TercerizadoEntradaPayload {
  valores: Record<string, unknown>;
  cantidad: number;
  costo: number;
}

/** Un eje de la matriz de un paso tercerizado. */
export interface TercerizadoEje {
  clave: string;
  label: string;
  orden: number;
  valores: Array<{ clave: string; label: string }>;
}

export async function upsertConfigPaso(
  rutaAltId: string,
  payload: UpsertConfigPasoPayload,
) {
  return apiRequest(
    `/productos-servicios/productos/rutas-alternativas/${rutaAltId}/config-pasos`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function getCatalogoFamilias(): Promise<CatalogoFamilias> {
  return apiRequest<CatalogoFamilias>("/productos-servicios/familias");
}

// === Pasos del tenant (instancias de plantilla) ===

export async function getPasosTenant(): Promise<PasoTenant[]> {
  return apiRequest<PasoTenant[]>("/productos-servicios/pasos-tenant");
}

/** Las plantillas que ofrece el modal de alta. */
export async function getPlantillasPaso(): Promise<PlantillaPaso[]> {
  return apiRequest<PlantillaPaso[]>(
    "/productos-servicios/pasos-tenant/plantillas",
  );
}

export async function crearPasoTenant(
  input: UpsertPasoTenantInput,
): Promise<PasoTenant> {
  return apiRequest<PasoTenant>("/productos-servicios/pasos-tenant", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function actualizarPasoTenant(
  id: string,
  input: Partial<UpsertPasoTenantInput>,
): Promise<PasoTenant> {
  return apiRequest<PasoTenant>(`/productos-servicios/pasos-tenant/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function guardarConfiguracionBasePasoTenant(
  id: string,
  input: UpsertConfigPasoPayload,
): Promise<PasoTenant> {
  return apiRequest<PasoTenant>(
    `/productos-servicios/pasos-tenant/${id}/configuracion-base`,
    {
      method: "PUT",
      body: JSON.stringify({ ...input, rutaPasoId: id }),
    },
  );
}

export async function guardarConfiguracionBaseFamiliaSistema(
  codigo: string,
  input: UpsertConfigPasoPayload,
): Promise<{ familiaCodigo: string; configBase: Record<string, unknown> }> {
  const { rutaPasoId: _rutaPasoId, ...configuracion } = input;
  void _rutaPasoId;
  return apiRequest(
    `/productos-servicios/familias/${encodeURIComponent(codigo)}/configuracion-base`,
    {
      method: "PUT",
      body: JSON.stringify(configuracion),
    },
  );
}

export async function eliminarPasoTenant(id: string): Promise<void> {
  await apiRequest(`/productos-servicios/pasos-tenant/${id}`, {
    method: "DELETE",
  });
}

export async function getCargosDirectosCatalogo(
  soloActivos = true,
): Promise<CargoDirectoCatalogo[]> {
  const qs = soloActivos ? "" : "?soloActivos=false";
  return apiRequest<CargoDirectoCatalogo[]>(
    `/productos-servicios/cargos-directos${qs}`,
  );
}

export interface CrearCargoDirectoPayload {
  codigo: string;
  nombre: string;
  descripcion?: string;
  modoCalculo:
    | "MONTO_FIJO_PLANO"
    | "PORCENTAJE_SOBRE_BASE"
    | "POR_UNIDAD_INPUT";
  modosActivacionSoportados?: string[];
  configJson?: Record<string, unknown>;
  aplicaMargen?: boolean;
}

export async function crearCargoDirecto(payload: CrearCargoDirectoPayload) {
  return apiRequest("/productos-servicios/cargos-directos", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

export interface ActualizarCargoDirectoPayload {
  nombre?: string;
  descripcion?: string;
  modoCalculo?:
    | "MONTO_FIJO_PLANO"
    | "PORCENTAJE_SOBRE_BASE"
    | "POR_UNIDAD_INPUT";
  modosActivacionSoportados?: string[];
  configJson?: Record<string, unknown>;
  aplicaMargen?: boolean;
  activo?: boolean;
}

export async function actualizarCargoDirecto(
  id: string,
  payload: ActualizarCargoDirectoPayload,
) {
  return apiRequest(`/productos-servicios/cargos-directos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

export async function eliminarCargoDirecto(id: string) {
  return apiRequest(`/productos-servicios/cargos-directos/${id}`, {
    method: "DELETE",
  });
}

// === Asociación cargos ↔ producto/paso (F.3.10) ===

export interface AsociarCargoCotizacionPayload {
  cargoDirectoCatalogoId: string;
  modoActivacion: "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL";
  condicionActivacionJson?: Record<string, unknown>;
  configOverrideJson?: Record<string, unknown> | null;
  aplicaMargenOverride?: boolean | null;
}

export async function asociarCargoCotizacion(
  productoId: string,
  payload: AsociarCargoCotizacionPayload,
) {
  return apiRequest(
    `/productos-servicios/productos/${productoId}/cargos-cotizacion`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function desasociarCargoCotizacion(asociacionId: string) {
  return apiRequest(
    `/productos-servicios/productos/cargos-cotizacion/${asociacionId}`,
    {
      method: "DELETE",
    },
  );
}

export interface AsociarCargoPasoPayload {
  cargoDirectoCatalogoId: string;
  nivelCodigo?: string;
  modoActivacion: "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL";
  condicionActivacionJson?: Record<string, unknown>;
  configOverrideJson?: Record<string, unknown> | null;
  aplicaMargenOverride?: boolean | null;
}

export async function asociarCargoPaso(
  configPasoId: string,
  payload: AsociarCargoPasoPayload,
) {
  return apiRequest(
    `/productos-servicios/productos/config-pasos/${configPasoId}/cargos`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function desasociarCargoPaso(asociacionId: string) {
  return apiRequest(
    `/productos-servicios/productos/config-pasos/cargos/${asociacionId}`,
    {
      method: "DELETE",
    },
  );
}

export async function distribuirCargoPasoPorNiveles(asociacionId: string) {
  return apiRequest(
    `/productos-servicios/productos/config-pasos/cargos/${asociacionId}/distribuir-niveles`,
    { method: "POST" },
  );
}

export type ActualizarAsociacionCargoPayload = Partial<
  Omit<AsociarCargoPasoPayload, "cargoDirectoCatalogoId">
>;

export async function actualizarCargoPaso(
  asociacionId: string,
  payload: ActualizarAsociacionCargoPayload,
) {
  return apiRequest(
    `/productos-servicios/productos/config-pasos/cargos/${asociacionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function actualizarCargoCotizacion(
  asociacionId: string,
  payload: ActualizarAsociacionCargoPayload,
) {
  return apiRequest(
    `/productos-servicios/productos/cargos-cotizacion/${asociacionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

// === G-F3: Pasos extras inline ===

export interface AgregarPasoExtraPayload {
  familiaCodigo: string;
  /** Ruta alternativa del producto a la que aplica (scope por ruta). */
  rutaAlternativaId?: string | null;
  insertarDespuesDeRutaPasoId?: string | null;
  ordenInterno?: number;
  modoActivacion?: "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL";
  condicionActivacionJson?: Record<string, unknown> | null;
  modoTiempo?: "T-1" | "T-2" | "T-3" | "T-4";
  mecanismoCantidad?: "DIRECT_FROM_JOBCONTEXT" | "CONVERSION";
  paramsPasoJson?: Record<string, unknown>;
  maquinaM1Id?: string;
  perfilM1Id?: string;
  centroCostoId?: string;
}

/** Campos actualizables de un paso extra (PATCH — sólo se aplican los presentes). */
export interface ActualizarPasoExtraPayload {
  insertarDespuesDeRutaPasoId?: string | null;
  ordenInterno?: number;
  nombreVisible?: string | null;
  /** OBLIGATORIO | OPCIONAL | CONDICIONAL | NO_EJECUTAR. */
  modoActivacion?: string;
  condicionActivacionJson?: Record<string, unknown> | null;
  /** T-1 | T-2 | T-3 | T-4. */
  modoTiempo?: string;
  mecanismoCantidad?: string;
  mecanismoCantidadConfigJson?: Record<string, unknown> | null;
  multiplicadoresActivos?: string[];
  paramsPasoJson?: Record<string, unknown>;
  maquinaM1Id?: string | null;
  perfilM1Id?: string | null;
  centroCostoId?: string | null;
  setupOverrideMin?: number | null;
  cleanupOverrideMin?: number | null;
  tiempoFijoOverrideMin?: number | null;
  /** Sub-fase 3: slots de material del extra (mismo shape que pasos normales). */
  configSlotsMaterialesJson?: UpsertSlotMaterialPayload[];
  configCargosDirectosJson?: Array<{
    cargoDirectoCatalogoId: string;
    nivelCodigo?: string | null;
    modoActivacion: string;
    condicionActivacionJson?: Record<string, unknown> | null;
    configOverrideJson?: Record<string, unknown> | null;
    aplicaMargenOverride?: boolean | null;
  }>;
  /** M-2: candidatas del extra (mismo shape que en pasos normales). */
  configMaquinasCandidatasJson?: UpsertMaquinaCandidataPayload[];
  activo?: boolean;
}

export async function agregarPasoExtra(
  productoId: string,
  payload: AgregarPasoExtraPayload,
) {
  return apiRequest(
    `/productos-servicios/productos/${productoId}/pasos-extras`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function actualizarPasoExtra(
  pasoExtraId: string,
  payload: ActualizarPasoExtraPayload,
) {
  return apiRequest(
    `/productos-servicios/productos/pasos-extras/${pasoExtraId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function eliminarPasoExtra(pasoExtraId: string) {
  return apiRequest(
    `/productos-servicios/productos/pasos-extras/${pasoExtraId}`,
    {
      method: "DELETE",
    },
  );
}

export interface LookupsConfigPaso {
  maquinas: Array<{
    id: string;
    codigo: string;
    nombre: string;
    plantilla: string;
    parametrosTecnicosJson?: Record<string, unknown> | null;
    centroCostoPrincipalId?: string | null;
    centroCostoPrincipal?: {
      id: string;
      codigo: string;
      nombre: string;
    } | null;
    perfilesOperativos: Array<{
      id: string;
      nombre: string;
      tipoPerfil?: string | null;
      productivityValue: string | null;
      productivityUnit: string | null;
      detalleJson?: Record<string, unknown> | null;
    }>;
  }>;
  centrosCosto: Array<{
    id: string;
    codigo: string;
    nombre: string;
    unidadBaseFutura: string;
  }>;
  materiasPrimas: Array<{
    id: string;
    codigo: string;
    nombre: string;
    familia: string;
    subfamilia: string;
    templateId: string;
    variantes: Array<{
      id: string;
      sku: string;
      nombreVariante: string | null;
      precioReferencia: string | null;
      /** ISO 4217 del precio del material; ausente = la del tenant (hoy ARS). */
      moneda?: string;
      atributosVarianteJson?: Record<string, unknown> | null;
    }>;
  }>;
}

export async function getLookupsConfigPaso(): Promise<LookupsConfigPaso> {
  return apiRequest<LookupsConfigPaso>(
    "/productos-servicios/lookups-config-paso",
  );
}

export interface BuscarMateriasPrimasParams {
  q?: string;
  familias?: string[];
  subfamilias?: string[];
  templateIds?: string[];
  tipoTecnico?: string[];
  ids?: string[];
  varianteIds?: string[];
  limit?: number;
}

export interface MateriaPrimaBusquedaItem {
  id: string;
  codigo: string;
  nombre: string;
  familia: string;
  subfamilia: string;
  tipoTecnico: string;
  templateId: string;
  variantes: Array<{
    id: string;
    sku: string;
    nombreVariante: string | null;
    precioReferencia: string | null;
    /** ISO 4217 del precio del material; ausente = la del tenant (hoy ARS). */
    moneda?: string;
    atributosVarianteJson?: Record<string, unknown> | null;
  }>;
}

export async function buscarMateriasPrimasConfigPaso(
  params: BuscarMateriasPrimasParams,
): Promise<MateriaPrimaBusquedaItem[]> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.familias?.length)
    search.set("familias", params.familias.join(","));
  if (params.subfamilias?.length)
    search.set("subfamilias", params.subfamilias.join(","));
  if (params.templateIds?.length)
    search.set("templateIds", params.templateIds.join(","));
  if (params.tipoTecnico?.length)
    search.set("tipoTecnico", params.tipoTecnico.join(","));
  if (params.ids?.length) search.set("ids", params.ids.join(","));
  if (params.varianteIds?.length)
    search.set("varianteIds", params.varianteIds.join(","));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return apiRequest<MateriaPrimaBusquedaItem[]>(
    `/productos-servicios/materias-primas/buscar${qs ? `?${qs}` : ""}`,
  );
}

// ============================================================================
// MOTOR — invocación de cotización
// ============================================================================

/**
 * Input compartido del NestingViewer (G-M1).
 *
 * Replica el shape `NestingEjecutado` del backend
 * (`apps/api/src/motor-universal/tipos.ts`) para que el frontend lo consuma sin
 * duplicar lógica. Cualquier algoritmo soportado produce este mismo shape, lo
 * que permite que `<NestingViewer>` sea único para todos.
 */
export interface NestingViewerInput {
  algorithm:
    | "shelf-rollo"
    | "maxrects-rollo"
    | "secuencial-rollo"
    | "grid-2d-single"
    | "grid-2d-multi"
    | "irregular-2d-bottom-left-v1"
    | "manual-vector-estimate-v1";
  algorithmPolicy?:
    | "auto"
    | "shelf-rollo"
    | "maxrects-rollo"
    | "grid-2d-single"
    | "grid-2d-multi";
  cantidadCalculada: number;
  unidad: "m_lineales" | "pliegos" | "pouches" | "m2" | "piezas";
  aprovechamientoPct: number;
  maquina?: { id: string; nombre: string };
  sustrato?: { materialVarianteId: string; nombre: string };
  substrates: Array<
    | { kind: "sheet"; count: number; widthMm: number; heightMm: number }
    | { kind: "roll"; lengthMm: number; widthMm: number }
  >;
  placements: Array<{
    pieceId: string;
    substrateIndex?: number;
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
    rotated: boolean;
    panelIndex?: number;
    panelCount?: number;
    panelAxis?: "vertical" | "horizontal";
    usefulWidthMm?: number;
    usefulHeightMm?: number;
    overlapStartMm?: number;
    overlapEndMm?: number;
    meta?: unknown;
  }>;
  piezasPorPliego?: number;
  piezasPorPouch?: number;
  consumedLengthMm?: number;
  machineRunLengthMm?: number;
  piezasAcomodadas: number;
  estrategiaDisposicion?: "composicion_original" | "nesting_optimizado";
  layoutVinculadoGeometriaVectorial?: boolean;
  outputsCanonicos?: Record<string, unknown>;
  metricasRaw?: Record<string, unknown>;
  visualConfig?: {
    margins: {
      leftMm: number;
      rightMm: number;
      topMm: number;
      bottomMm: number;
    };
    spacing: {
      horizontalMm: number;
      verticalMm: number;
    };
    pieceBleedMm?: number;
    allowRotation: boolean;
    substrateLabel?: string;
    centerPlacements?: boolean;
    usableArea: {
      xMm: number;
      yMm: number;
      widthMm: number;
      heightMm: number;
    };
    printableArea?: {
      xMm: number;
      yMm: number;
      widthMm: number;
      heightMm: number;
    };
    panelizado?: {
      enabled: boolean;
      mode: "automatic" | "manual";
      axis: "automatic" | "vertical" | "horizontal" | null;
      overlapMm: number | null;
      maxPanelWidthMm: number | null;
      distribution: "equilibrada" | "libre" | null;
      widthInterpretation: "total" | "util" | null;
      panelCount: number;
    };
    /** Máquina del paso (rollo): alimenta la boca de impresora del viewer. */
    maquina?: {
      nombre: string;
      anchoUtilMm: number | null;
      tecnologia: string | null;
    };
  };
  costingPreview?: {
    strategy: "simple" | "m2-exact" | "consumed-length" | "plate-segments";
    label: string;
    chargedRatio?: number;
    chargedLengthMm?: number;
    chargedAreaMm2?: number;
    chargedBounds?: {
      xMm: number;
      yMm: number;
      widthMm: number;
      heightMm: number;
    };
    wasteAreaMm2?: number;
    segmentAppliedPct?: number | null;
    perSubstrate?: Array<{
      index: number;
      chargedRatio?: number;
      chargedLengthMm?: number;
      chargedAreaMm2?: number;
      chargedBounds?: {
        xMm: number;
        yMm: number;
        widthMm: number;
        heightMm: number;
      };
      wasteAreaMm2?: number;
      segmentAppliedPct?: number | null;
    }>;
  };
  pliegoImpresionSeleccionado?: {
    id: string;
    nombre: string;
    anchoMm: number;
    altoMm: number;
    criterio: string;
    candidatosEvaluados: number;
    /** Área comprada (mm²) en 'menor_costo_sustrato'; $ en 'menor_costo_real'. */
    costoEstimadoMm2: number;
    pliegosImpresion: number;
    pliegosComprados: number;
    aprovechamientoPct: number;
    /** Origen de costo 'por_candidato': MP propia del candidato ganador. */
    materiaPrima?: {
      varianteId: string;
      sku: string;
      nombre: string;
      precioReferencia: number | null;
    };
  };
  /** v3.1: solo cuando se aplicó talonario-grouping. */
  talonarioGrouping?: {
    talonariosEfectivos: number;
    talonariosPedidos: number;
    posesXPliego: number;
    talonariosPorGrupo: number;
    gruposCompletos: number;
    talonariosResiduo: number;
    pliegosXCapa: number;
    /** Pilas que se abrochan/cortan juntas (base de insumos por pila). */
    pilas?: number;
    posesDesperdicio: number;
    numerosXTalonario: number;
    modoIncompleto: string;
  };
  /**
   * Metadatos de presentación agregados por el frontend cuando varios
   * componentes comparten un único lote de nesting aplicado. No forma parte
   * del resultado individual del motor: permite que el visor explique por qué
   * ya no muestra una pestaña por componente.
   */
  composicionCompuesta?: {
    participantes: number;
    sustratosIndependientes: number;
    sustratosConsolidados: number;
    ahorroPct: number;
  };
}

export interface AnalisisNestingCompuestoInput {
  version: 1;
  modo: "SOMBRA" | "APLICADO";
  politica: "CONSOLIDAR_COMPATIBLES";
  aplicadoACostos: boolean;
  grupos: Array<{
    id: string;
    firmaVersion: 1;
    firmaCompatibilidad: string;
    participantes: Array<{
      componenteCodigo: string;
      productoId: string;
      pasoClave: string;
      rutaPasoId: string;
      pasoNombre: string;
      piezas: string[];
    }>;
    independiente: {
      sustratos: number;
      largoMm?: number;
      areaMm2?: number;
      aprovechamientoPct: number;
    };
    consolidado: {
      algoritmo:
        | "grid-2d-multi"
        | "shelf-rollo"
        | "maxrects-rollo"
        | "irregular-2d-bottom-left-v1";
      sustratos: number;
      largoMm?: number;
      areaMm2?: number;
      aprovechamientoPct: number;
      substrates: NestingViewerInput["substrates"];
      placements: NestingViewerInput["placements"];
    };
    diferencia: {
      sustratos: number;
      largoMm?: number;
      areaMm2?: number;
      ahorroPct: number;
      ahorroPotencial: boolean;
    };
    aplicacion?: {
      aplicado: boolean;
      motivoNoAplicado?: string;
      costoMaterialIndependiente: number;
      costoMaterialConsolidado: number;
      costoPreparacionIndependiente: number;
      costoPreparacionConsolidado: number;
      ahorroCostoTotal: number;
    };
    lote?: {
      id: string;
      versionContrato: 1;
      estado: "CONGELADO";
      firmaCompatibilidad: string;
      materialVarianteId: string;
      materialNombre: string;
      participantes: Array<{
        componenteCodigo: string;
        productoId: string;
        pasoClave: string;
        rutaPasoId: string;
        piezas: string[];
        areaUtilMm2: number;
        porcentajeAsignacion: number;
        costoMaterialAsignado: number;
        costoPreparacionAsignado: number;
        esPasoOperativo: boolean;
      }>;
      /** Snapshot autoritativo del mismo resultado utilizado para costear. */
      nestingResult: Partial<NestingViewerInput> &
        Pick<
          NestingViewerInput,
          "algorithm" | "substrates" | "placements" | "aprovechamientoPct"
        >;
      costeoSustrato?: {
        strategy: "simple" | "m2-exact" | "consumed-length" | "plate-segments";
        /** Costo geométrico antes de la merma operativa. */
        totalCost: number;
        unitPrice: number;
        pricePerM2: number;
        fullUnits: number;
        fullUnitsCost: number;
        lastUnit: {
          occupationPct: number;
          segmentApplied: number | null;
          cost: number;
        } | null;
        units: Array<{
          index: number;
          occupationPct: number;
          segmentApplied: number | null;
          cost: number;
        }>;
        mermaOperativa?: {
          porcentaje: number;
          costoBase: number;
          costoMerma: number;
          costoTotal: number;
        };
      };
      costoMaterialTotal: number;
      costoPreparacionTotal: number;
      costoTotalAsignado: number;
      duracionEstimadaMin: number;
    };
  }>;
  exclusiones: Array<{
    componenteCodigo: string;
    pasoClave?: string;
    codigo: string;
    motivo: string;
  }>;
}

export interface MermaAdicionalMaterialInput {
  porcentaje: number;
  cantidadTrabajo: number;
  cantidadMerma: number;
}

/**
 * Desglose económico congelado de una operación privada de etapa compuesta.
 * Tiene identidad propia para explicar el costo, aunque la OT materialice un
 * único estado operativo para toda la etapa.
 */
export interface OperacionInternaCosteadaInput {
  codigo: string;
  nombre: string;
  familiaCodigo: string;
  activada: boolean;
  duracionMin: number;
  costoTotal: number;
  configPasoId?: string;
  rutaPasoId?: string;
  rutaPasoOrden?: number;
  razonNoActivado?: string;
  activadoPorDependencia?: { requeridoPorNombre: string } | null;
  centroCostoId?: string | null;
  centroCostoNombre?: string | null;
  tiempo?: {
    totalMin: number;
    setupMin?: number;
    runMin?: number;
    runTrabajoMin?: number;
    runMermaMin?: number;
    cleanupMin?: number;
    tiempoFijoMin?: number;
    mermaOperativaPct?: number;
    centroCostoId?: string | null;
    centroCostoNombre?: string | null;
    maquinaId?: string | null;
    tarifaHora?: number;
    dotacionOperarios?: number;
    costo: number;
    origenTiempo?: "manual_comercial" | "calculado";
    extraMin?: number;
    tiemposExtra?: Array<{
      id: string;
      etiqueta: string;
      minutos: number;
      centroCostoId?: string | null;
      centroCostoNombre?: string | null;
      tarifaHora: number;
      dotacionOperarios: number;
      costo: number;
    }>;
  };
  materiales?: Array<{
    slotCodigo: string;
    slotNombre?: string | null;
    slotRol?: string | null;
    materialVarianteId: string;
    materialNombre: string;
    materialSku: string;
    materialDisplayName: string;
    materiaPrimaNombre?: string | null;
    materiaPrimaTemplateId?: string | null;
    materiaPrimaTipoTecnico?: string | null;
    atributosVarianteJson?: Record<string, unknown> | null;
    tipoLineaCosto: "MATERIAL" | "CONSUMIBLE_MAQUINA" | "DESGASTE_MAQUINA";
    cantidad: number;
    unidad: string;
    precioUnitario: number;
    costoTotal: number;
    mermaAdicional?: MermaAdicionalMaterialInput;
    estrategiaCosto: string;
    modoSeleccion:
      | "HARDCODED"
      | "COMERCIAL_ELIGE"
      | "MOTOR_ELIGE_AUTO"
      | "MAQUINA_CONSUMIBLE"
      | "MAQUINA_DESGASTE";
    detalleCosteoNesting?: {
      strategy: string;
      totalCost: number;
      unitPrice: number;
      pricePerM2: number;
      fullUnits: number;
      fullUnitsCost: number;
      lastUnit: {
        occupationPct: number;
        segmentApplied: number | null;
        cost: number;
      } | null;
      units?: Array<{
        index: number;
        occupationPct: number;
        segmentApplied: number | null;
        cost: number;
      }>;
    };
    asignacionNestingCompuesto?: {
      loteId: string;
      costoIndependiente: number;
      costoAsignado: number;
      porcentajeAsignacion: number;
    };
  }>;
  cargosDirectosPaso?: Array<{
    cargoCodigo: string;
    cargoNombre: string;
    monto: number;
    modoCalculo: string;
    aplicaMargen?: boolean;
  }>;
  mutacionAplicada?: {
    nombrePaso: string;
    subTipo?: string;
    lados: string[];
    demasiaMm: number;
    deltaAnchoMm: number;
    deltaAltoMm: number;
    metrosLinealesUnion: number;
    piezas: Array<{
      antes: { anchoMm: number; altoMm: number };
      despues: { anchoMm: number; altoMm: number };
    }>;
  } | null;
  componentesCodigos?: string[];
  nestingResult?: NestingViewerInput;
}

export interface CotizarRequest {
  productoId: string;
  rutaAlternativaId?: string | null;
  /** Cliente de la OT: habilita el override de precios especiales por cliente. */
  clienteId?: string | null;
  /** Descuento comercial de la línea (sobre el neto, antes del IVA). */
  descuento?: { tipo: "PORCENTAJE" | "MONTO"; valor: number } | null;
  jobContext: {
    cantidad: number;
    caras?: 1 | 2;
    tipoCopia?: 1 | 2 | 3;
    numerosXTalonario?: number;
    piezas?: Array<{
      cantidad: number;
      anchoMm: number;
      altoMm: number;
      perimetroMm?: number;
    }>;
    medidaCustomMm?: { anchoMm: number; altoMm: number };
    tecnologia?: string;
    tintasAdicionales?: string[];
    modoColor?: string;
    distanciaKm?: number;
    m2_instalados?: number;
    piezaAreaTotalM2?: number;
    piezaPerimetroTotalM?: number;
    metrosLineales?: number;
    metroLineal?: number;
    ml?: number;
    cantidadComercial?: number;
    cantidadComercialPricing?: number;
    zonaInstalacion?: string;
    opcionalesActivados?: Record<string, boolean>;
    slotMateriales?: Record<string, string>;
    [key: string]: unknown;
  };
  periodo?: string | null;
}

export interface CotizarResponse {
  exitoso: boolean;
  metadata?: {
    quoteRunId: string;
    motorVersion: string;
    durationMs: number;
    vectorCacheHit?: boolean;
  };
  errores: Array<{
    codigo: string;
    severidad: string;
    mensaje: string;
    rutaPasoId?: string;
    contexto?: Record<string, unknown>;
  }>;
  cotizacion?: {
    productoId: string;
    productoNombre: string;
    rutaAlternativaId?: string | null;
    rutaNombre: string;
    cantidadEfectiva: number;
    cantidadPedida: number;
    cantidadComercialReal?: number;
    cantidadComercialPricing?: number;
    unidadComercialPricing?: string;
    grafoProduccion?: {
      topologia?: "LINEAL" | "DAG";
      nodos?: Array<{ clave: string; indice?: number }>;
      aristas?: Array<{ desdeClave: string; haciaClave: string }>;
    } | null;
    minimoComercialAplicado?: {
      base: MinimoComercialBase;
      cantidadMinima: number;
      cantidadReal: number;
      cantidadPricing: number;
      aplicado: boolean;
      unidadLabel: string;
      politica: MinimoComercialPolitica;
    } | null;
    costos: {
      tiempoTotal: number;
      /**
       * Bloques de tiempo extra de los pasos (preparación, traslados). Opcional:
       * los snapshots anteriores a la feature no lo traen.
       */
      tiempoExtraTotal?: number;
      materialesTotal: number;
      cargosDirectosTotal: number;
      cargosSinMargenTotal?: number;
      /** Costo de pasos tercerizados (lo que se paga al proveedor). */
      tercerizadoTotal?: number;
      /** Costo productivo de subproductos fabricados de la receta. */
      componentesFabricadosTotal?: number;
      /** Mano de obra para incorporar componentes al producto padre. */
      incorporacionComponentesTotal?: number;
      total: number;
      unitario: number;
    };
    componentesFabricados?: Array<{
      productoId: string;
      codigo: string;
      plantillaCodigo?: string;
      ocurrenciaId?: string;
      nombre: string;
      politicaEjecucion: "INLINE" | "INDEPENDIENTE";
      cantidad: number;
      unidad: string;
      jobContext?: Record<string, unknown>;
      /** Valores efectivos del componente, congelados junto con la cotización. */
      especificacionesEfectivas?: Array<{
        clave: string;
        etiqueta: string;
        tipoDato: string;
        unidad?: string | null;
        requerido: boolean;
        origen: "DEFAULT_HIJO" | "FIJO" | "PADRE" | "FORMULA" | "COTIZACION";
        valor: unknown;
        valorTexto: string;
      }>;
      recetaRevisionId: string;
      recetaVersion: number;
      recetaHuella: string;
      costoUnitario: number;
      costoTotal: number;
      nodosPredecesoresClaves?: string[];
      nodoIncorporacionClave?: string | null;
      grafoProduccion?: {
        topologia?: "LINEAL" | "DAG";
        nodos?: Array<{ clave: string; indice?: number }>;
        aristas?: Array<{ desdeClave: string; haciaClave: string }>;
      } | null;
      /** Ruta real ejecutada para fabricar esta rama del BOM. */
      pasos?: Array<{
        configPasoId?: string;
        rutaPasoId?: string;
        rutaPasoOrden: number;
        familiaCodigo: string;
        nombreVisible?: string | null;
        activado: boolean;
        costoTotal: number;
        tercerizado?: boolean;
        proveedorId?: string | null;
        plazoProveedorDias?: number | null;
        tercerizadoDetalle?: {
          fuente: string;
          magnitud?: string;
          valorMagnitud?: number;
          tarifa?: number;
          entradaClave?: string;
        };
        tiempo?: {
          totalMin: number;
          setupMin?: number;
          runMin?: number;
          runTrabajoMin?: number;
          runMermaMin?: number;
          cleanupMin?: number;
          tiempoFijoMin?: number;
          mermaOperativaPct?: number;
          centroCostoId?: string | null;
          centroCostoNombre?: string | null;
          tarifaHora?: number;
          costo?: number;
          origenTiempo?: "manual_comercial" | "calculado";
          tiemposExtra?: Array<{
            id: string;
            etiqueta: string;
            minutos: number;
            centroCostoId?: string | null;
            centroCostoNombre?: string | null;
            tarifaHora: number;
            dotacionOperarios: number;
            costo: number;
          }>;
        };
        materiales?: Array<{
          slotCodigo: string;
          slotNombre?: string | null;
          materialVarianteId: string;
          materialNombre: string;
          materialSku: string;
          materialDisplayName: string;
          cantidad: number;
          unidad: string;
          precioUnitario: number;
          costoTotal: number;
          mermaAdicional?: MermaAdicionalMaterialInput;
        }>;
        nestingResult?: NestingViewerInput;
        operacionesInternas?: OperacionInternaCosteadaInput[];
      }>;
      componentes?: Array<Record<string, unknown>>;
      operacionesIncorporacion?: Array<{
        codigo: string;
        nombre: string;
        nodoDestinoClave: string;
        cantidadResuelta: number;
        unidadCantidad?: string | null;
        duracionMin: number;
        dotacionOperarios: number;
        tarifaHora: number;
        costo: number;
      }>;
    }>;
    precio?: {
      precioUnitario: number;
      precioTotal: number;
      margenAplicadoPct?: number;
      margenNegativo: boolean;
      mensaje?: string;
    };
    /** Sprint 5.a — desglose con impuestos + comisiones + override cliente. */
    desglosePrecio?: {
      precioConfig: { metodoCalculo: string; detalle: Record<string, unknown> };
      impuestos: Array<{
        catalogoId: string;
        codigo: string;
        nombre: string;
        porcentaje: number;
        orden: number;
        /** NETO | BRUTO_COBRADO (default NETO). */
        baseCalculo?: string;
        /** POR_FUERA (IVA, se agrega al neto) | POR_DENTRO (default: embebido). */
        traslado?: string;
        desglosarCliente?: boolean;
      }>;
      comisiones: Array<{
        catalogoId: string;
        codigo: string;
        nombre: string;
        porcentaje: number;
        orden: number;
        /** NETO (vendedor) | BRUTO_COBRADO (pasarela de pago). */
        baseCalculo?: string;
      }>;
      precioEspecialCliente: {
        precioEspecialId: string;
        clienteId: string;
      } | null;
      precioBase: number;
      totalComisiones: number;
      totalImpuestos: number;
      margenEfectivoPct: number;
      trasladoSinMargenUnitario?: number;
      precioNetoUnitario: number;
      precioBrutoUnitario: number;
      precioNetoTotal: number;
      precioBrutoTotal: number;
      /** Efecto del descuento comercial (montos en 0 si no hubo). */
      descuento: {
        aplicado: boolean;
        montoUnitario: number;
        montoTotal: number;
        netoListaUnitario: number;
        netoListaTotal: number;
      };
    };
    /** Resultado del análisis/aplicación de nesting compartido en compuestos. */
    analisisNestingCompuesto?: AnalisisNestingCompuestoInput;
    pasos: Array<{
      /**
       * Paso de la ruta que originó este renglón de costeo. El motor lo emite
       * siempre; se declara opcional porque los snapshots viejos guardados en
       * `CotizacionItem.trazabilidadJson` pueden no tenerlo. Es la clave con la
       * que Costos cruza el costo cotizado contra el tiempo real del paso
       * materializado (`TableroPasoData.rutaPasoId`).
       */
      rutaPasoId?: string;
      rutaPasoOrden: number;
      familiaCodigo: string;
      nombreVisible?: string | null;
      contenedorClave?: string | null;
      contenedorNombre?: string | null;
      pasoInternoCodigo?: string | null;
      componentesCodigos?: string[];
      operacionesInternas?: OperacionInternaCosteadaInput[];
      configPasoId?: string;
      activado: boolean;
      razonNoActivado?: string;
      /** Outputs canónicos publicados por el paso (imposicion_calculada,
       *  pliegos_impresos…). El sheet lee de acá "entran N por plancha". */
      outputsCanonicos?: Record<string, unknown>;
      /** El paso se encendió porque otro lo exige (ojales arrastra refuerzo). */
      activadoPorDependencia?: { requeridoPorNombre: string } | null;
      /**
       * Un paso que EXIGE material extra (tensar, coser un bolsillo): qué
       * medida agrandó y en cuánto. El cliente pidió la medida `antes`, el
       * taller corta la `despues`. Ver docs/efectos-de-paso-diseno.md.
       */
      mutacionAplicada?: {
        nombrePaso: string;
        /** LEGACY: el preset de las cotizaciones viejas. */
        subTipo?: string;
        lados: string[];
        demasiaMm: number;
        deltaAnchoMm: number;
        deltaAltoMm: number;
        metrosLinealesUnion: number;
        piezas: Array<{
          antes: { anchoMm: number; altoMm: number };
          despues: { anchoMm: number; altoMm: number };
        }>;
      } | null;
      /**
       * Sólo pasos `colocacion_ojales`: dónde va cada ojal, en coordenadas de
       * la medida VISIBLE. Lo dibuja el visor de nesting.
       */
      ojalesLayout?: Array<{
        anchoMm: number;
        altoMm: number;
        cantidad: number;
        posiciones: Array<{
          xMm: number;
          yMm: number;
          lado: "superior" | "inferior" | "izquierdo" | "derecho";
        }>;
      }> | null;
      /** Sólo `colocacion_ojales`: cómo se pidieron (describe el paso). */
      ojalesConfig?: {
        modoDistribucion?: "por_separacion" | "solo_esquinas";
        separacionMaxMm: number;
        lados: string[];
        esquinasSiempre: boolean;
      } | null;
      tiempo?: {
        /** Incluye los minutos de `tiemposExtra` (la ETA los cuenta). */
        totalMin: number;
        setupMin?: number;
        runMin?: number;
        runTrabajoMin?: number;
        runMermaMin?: number;
        cleanupMin?: number;
        tiempoFijoMin?: number;
        mermaOperativaPct?: number;
        centroCostoId?: string | null;
        centroCostoNombre?: string | null;
        tarifaHora: number;
        /** Sólo el TRABAJO del paso; los bloques extra tienen su propio costo. */
        costo: number;
        /** "manual_comercial" cuando el comercial estimó el tiempo al cotizar. */
        origenTiempo?: "manual_comercial" | "calculado";
        /** Minutos de los bloques de tiempo extra (dentro de `totalMin`). */
        extraMin?: number;
        /**
         * Preparación, traslado: tiempo que no depende de la cantidad y puede
         * tarifarse en otro centro. Se muestra en la columna "Cargos" del paso.
         * Ver docs/cargos-por-paso-analisis-y-plan.md §7.
         */
        tiemposExtra?: Array<{
          id: string;
          etiqueta: string;
          minutos: number;
          centroCostoId?: string | null;
          centroCostoNombre?: string | null;
          tarifaHora: number;
          dotacionOperarios: number;
          costo: number;
        }>;
      };
      materiales?: Array<{
        slotCodigo: string;
        slotNombre?: string | null;
        slotRol?: string | null;
        materialVarianteId: string;
        materialNombre: string;
        materialSku: string;
        materialDisplayName: string;
        materiaPrimaNombre?: string | null;
        materiaPrimaTemplateId?: string | null;
        materiaPrimaTipoTecnico?: string | null;
        atributosVarianteJson?: Record<string, unknown> | null;
        tipoLineaCosto: "MATERIAL" | "CONSUMIBLE_MAQUINA" | "DESGASTE_MAQUINA";
        cantidad: number;
        unidad: string;
        precioUnitario: number;
        costoTotal: number;
        mermaAdicional?: MermaAdicionalMaterialInput;
        estrategiaCosto: string;
        modoSeleccion:
          | "HARDCODED"
          | "COMERCIAL_ELIGE"
          | "MOTOR_ELIGE_AUTO"
          | "MAQUINA_CONSUMIBLE"
          | "MAQUINA_DESGASTE";
        detalleCosteoNesting?: {
          strategy: string;
          totalCost: number;
          unitPrice: number;
          pricePerM2: number;
          fullUnits: number;
          fullUnitsCost: number;
          lastUnit: {
            occupationPct: number;
            segmentApplied: number | null;
            cost: number;
          } | null;
          units?: Array<{
            index: number;
            occupationPct: number;
            segmentApplied: number | null;
            cost: number;
          }>;
        };
        asignacionNestingCompuesto?: {
          loteId: string;
          costoIndependiente: number;
          costoAsignado: number;
          porcentajeAsignacion: number;
        };
      }>;
      cargosDirectosPaso?: Array<{
        cargoCodigo: string;
        cargoNombre: string;
        monto: number;
        modoCalculo: string;
        aplicaMargen?: boolean;
      }>;
      costoTotal: number;
      /** G-M1 — Resultado del nesting cuando el paso lo invoca. */
      nestingResult?: NestingViewerInput;
      /**
       * Sólo pasos con derivador de bastidor (cartelería): la estructura a
       * fabricar. La dibuja el visor 3D directamente desde la cotización en
       * memoria (sin esperar a que el ítem se persista).
       */
      estructuraBastidor?: import("@/lib/estructura-bastidor-api").EstructuraBastidor;
      // === Tercerización ===
      tercerizado?: boolean;
      /** Atributos elegidos (eje→valor) con etiquetas, para Especificaciones. */
      tercerizadoEtiquetas?: Array<{ eje: string; valor: string }>;
      /** Tecnología asignada al paso tercerizado (para reportes). */
      tecnologiaTercerizado?: string | null;
      /** Lead time del proveedor: lo que este paso le suma a la ETA. */
      plazoProveedorDias?: number | null;
    }>;
    cargosDirectosCotizacion: Array<{
      cargoCodigo: string;
      cargoNombre: string;
      monto: number;
      aplicaMargen?: boolean;
    }>;
  };
}

export async function cotizar(
  req: CotizarRequest,
  signal?: AbortSignal,
): Promise<CotizarResponse> {
  return apiRequest<CotizarResponse>("/motor-universal/cotizar", {
    method: "POST",
    body: JSON.stringify(req),
    headers: { "Content-Type": "application/json" },
    signal,
  });
}

export type ConfiguracionEncastresVectoriales = {
  tipoUnion: "cola_milano" | "recta";
  anchoEncastreMm: number;
  profundidadEncastreMm: number;
  modoCantidad: "por_distancia" | "cantidad_fija";
  distanciaMaximaMm: number;
  cantidadFija: number;
  cantidadMinima: number;
  cantidadMaxima: number;
  kerfMm: number;
};

export const CONFIGURACION_ENCASTRES_VECTORIALES_DEFAULT: ConfiguracionEncastresVectoriales =
  {
    tipoUnion: "cola_milano",
    anchoEncastreMm: 30,
    profundidadEncastreMm: 30,
    modoCantidad: "por_distancia",
    distanciaMaximaMm: 100,
    cantidadFija: 1,
    cantidadMinima: 1,
    cantidadMaxima: 100,
    kerfMm: 0.3,
  };

export function resolverConfiguracionEncastresVectoriales(
  value: Record<string, unknown> | null | undefined,
): ConfiguracionEncastresVectoriales {
  const defaults = CONFIGURACION_ENCASTRES_VECTORIALES_DEFAULT;
  const cantidadMinima = Math.round(
    numeroConfiguracion(
      value?.cantidadMinimaEncastres ?? value?.cantidadMinima,
      defaults.cantidadMinima,
      1,
      100,
    ),
  );
  return {
    tipoUnion:
      value?.tipoUnionVectorial === "recta" || value?.tipoUnion === "recta"
        ? "recta"
        : "cola_milano",
    anchoEncastreMm: numeroConfiguracion(
      value?.anchoEncastreMm,
      defaults.anchoEncastreMm,
      1,
      500,
    ),
    profundidadEncastreMm: numeroConfiguracion(
      value?.profundidadEncastreMm,
      defaults.profundidadEncastreMm,
      1,
      500,
    ),
    modoCantidad:
      value?.modoCantidadEncastres === "cantidad_fija" ||
      value?.modoCantidad === "cantidad_fija"
        ? "cantidad_fija"
        : "por_distancia",
    distanciaMaximaMm: numeroConfiguracion(
      value?.distanciaMaximaEncastresMm ?? value?.distanciaMaximaMm,
      defaults.distanciaMaximaMm,
      10,
      10_000,
    ),
    cantidadFija: Math.round(
      numeroConfiguracion(
        value?.cantidadFijaEncastres ?? value?.cantidadFija,
        defaults.cantidadFija,
        1,
        100,
      ),
    ),
    cantidadMinima,
    cantidadMaxima: Math.round(
      numeroConfiguracion(
        value?.cantidadMaximaEncastres ?? value?.cantidadMaxima,
        defaults.cantidadMaxima,
        cantidadMinima,
        100,
      ),
    ),
    kerfMm: numeroConfiguracion(
      value?.kerfEncastreMm ?? value?.kerfMm,
      defaults.kerfMm,
      0,
      10,
    ),
  };
}

function numeroConfiguracion(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(min, Math.min(max, parsed))
    : fallback;
}

export interface ConfiguracionCapasVectoriales {
  schemaVersion: 1;
  niveles: Array<{
    id: string;
    nombre: string;
    orden: number;
    colorVisual: number;
  }>;
  asignaciones: Array<{
    objetoId: string;
    nivelId: string;
    modo: "pieza" | "encastre";
  }>;
}

export interface AnalisisSvgFabricacion {
  nombreArchivo: string;
  /** Identificador del resultado cacheado en el API; no contiene métricas confiadas. */
  cacheKey?: string;
  cacheHit?: boolean;
  configuracionCapas?: ConfiguracionCapasVectoriales;
  configuracionEncastres: ConfiguracionEncastresVectoriales;
  geometria: {
    schemaVersion: 1;
    anchoMm: number;
    altoMm: number;
    areaTotalMm2: number;
    perimetroTotalMm: number;
    hashFuente: string;
    piezas: Array<{
      id: string;
      objetoFuente?: {
        id: string;
        etiqueta?: string;
        grupoRuta: string[];
        colorRelleno?: string;
        orden: number;
      };
      origenXmm?: number;
      origenYmm?: number;
      anchoMm: number;
      altoMm: number;
      areaMm2: number;
      perimetroMm: number;
      contornos: Array<{
        esHueco: boolean;
        puntos: Array<{ x: number; y: number }>;
      }>;
      cortesInternos?: Array<{
        esHueco: boolean;
        puntos: Array<{ x: number; y: number }>;
      }>;
    }>;
  };
  nesting: {
    algorithm: "irregular-2d-bottom-left-v1";
    placas: number;
    anchoPlacaMm: number;
    altoPlacaMm: number;
    anchoUtilMm: number;
    altoUtilMm: number;
    aprovechamientoPct: number;
    areaPiezasMm2: number;
    areaCompradaMm2: number;
    placements: Array<{
      pieceId: string;
      copyIndex: number;
      substrateIndex: number;
      xMm: number;
      yMm: number;
      rotacion: number;
      anchoMm: number;
      altoMm: number;
      contornos: Array<{
        esHueco: boolean;
        puntos: Array<{ x: number; y: number }>;
      }>;
      cortesInternos?: Array<{
        esHueco: boolean;
        puntos: Array<{ x: number; y: number }>;
      }>;
      segmentacion?: {
        piezaOrigenId: string;
        indice: number;
        total: number;
        origenXmm: number;
        origenYmm: number;
        unionesIds: string[];
      };
    }>;
    perimetroCorteMm?: number;
    piezasOriginales?: number;
    segmentos?: number;
    unionesFisicas?: number;
    uniones?: Array<{
      id: string;
      piezaOrigenId: string;
      tipoEncastre: "cola_milano" | "recta";
      eje: "vertical" | "horizontal";
      posicionMm: number;
      largoMm: number;
      cantidadEncastres: number;
      anchoEncastreMm: number;
      profundidadEncastreMm: number;
      kerfMm: number;
      anguloGrados?: number;
      inicio?: { x: number; y: number };
      fin?: { x: number; y: number };
    }>;
    estrategiaDisposicion?: "composicion_original" | "nesting_optimizado";
  };
  diagnosticos: Array<{
    codigo: string;
    mensaje: string;
    severidad: "ERROR" | "WARNING";
  }>;
}

export async function analizarSvgFabricacion(req: {
  svg: string;
  nombreArchivo: string;
  anchoFinalMm: number;
  altoFinalMm?: number;
  cantidad: number;
  anchoPlacaMm: number;
  altoPlacaMm: number;
  margenMm?: number;
  separacionMm?: number;
  permitirRotacion?: boolean;
  permitirSegmentacion?: boolean;
  preservarComposicionOriginalSiEntra?: boolean;
  configuracionEncastres?: ConfiguracionEncastresVectoriales;
  configuracionCapas?: ConfiguracionCapasVectoriales;
}): Promise<AnalisisSvgFabricacion> {
  return apiRequest<AnalisisSvgFabricacion>(
    "/motor-universal/geometria-vectorial/analizar",
    {
      method: "POST",
      body: JSON.stringify(req),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function medirSvgFabricacion(req: {
  svg: string;
  nombreArchivo: string;
}): Promise<{
  nombreArchivo: string;
  relacionAltoAncho: number;
  diagnosticos: Array<{
    codigo: string;
    mensaje: string;
    severidad: "ERROR" | "WARNING";
  }>;
}> {
  return apiRequest("/motor-universal/geometria-vectorial/medir", {
    method: "POST",
    body: JSON.stringify(req),
    headers: { "Content-Type": "application/json" },
  });
}

export interface CotizarYGuardarResponse {
  result: CotizarResponse;
  cotizacionId?: string;
  cotizacionItemId?: string;
}

export async function cotizarYGuardar(
  req: CotizarRequest & { cotizacionId?: string },
): Promise<CotizarYGuardarResponse> {
  return apiRequest<CotizarYGuardarResponse>(
    "/motor-universal/cotizar-y-guardar",
    {
      method: "POST",
      body: JSON.stringify(req),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function recotizarCotizacionItem(
  id: string,
  req: Omit<CotizarRequest, "productoId">,
): Promise<CotizarYGuardarResponse> {
  return apiRequest<CotizarYGuardarResponse>(
    `/motor-universal/cotizacion-items/${id}/recotizar`,
    {
      method: "PATCH",
      body: JSON.stringify(req),
      headers: { "Content-Type": "application/json" },
    },
  );
}

// ================================================================================
// SPRINT 5.a — Tab Precio v2: catálogos + aplicaciones + precios especiales
// ================================================================================

// ── Catálogo de Impuestos del tenant ────────────────────────────────────────────

export type ImpuestoBaseCalculo = "NETO" | "BRUTO_COBRADO";
export type ImpuestoTraslado = "POR_FUERA" | "POR_DENTRO";
export type ImpuestoAlcance = "PRODUCTO" | "TENANT";

export interface ImpuestoCatalogoItem {
  id: string;
  codigo: string;
  nombre: string;
  porcentaje: number;
  /** NETO (IVA, IIBB) | BRUTO_COBRADO (imp. al cheque). */
  baseCalculo: ImpuestoBaseCalculo;
  /** POR_FUERA (IVA: se agrega y discrimina) | POR_DENTRO (costo embebido). */
  traslado: ImpuestoTraslado;
  /** PRODUCTO (se asocia por producto) | TENANT (aplica a todo el tenant). */
  alcance: ImpuestoAlcance;
  detalleJson: unknown | null;
  activo: boolean;
  _count?: { productosAplicados: number };
}

export interface CrearImpuestoCatalogoPayload {
  codigo: string;
  nombre: string;
  porcentaje: number;
  baseCalculo?: ImpuestoBaseCalculo;
  traslado?: ImpuestoTraslado;
  alcance?: ImpuestoAlcance;
  detalleJson?: Record<string, unknown>;
}

export interface ActualizarImpuestoCatalogoPayload {
  nombre?: string;
  porcentaje?: number;
  baseCalculo?: ImpuestoBaseCalculo;
  traslado?: ImpuestoTraslado;
  alcance?: ImpuestoAlcance;
  detalleJson?: Record<string, unknown>;
  activo?: boolean;
}

export async function getImpuestosCatalogo(
  soloActivos = true,
): Promise<ImpuestoCatalogoItem[]> {
  const qs = soloActivos ? "" : "?soloActivos=false";
  return apiRequest<ImpuestoCatalogoItem[]>(
    `/productos-servicios/impuestos-catalogo${qs}`,
  );
}

export async function getImpuestoCatalogoById(
  id: string,
): Promise<ImpuestoCatalogoItem> {
  return apiRequest<ImpuestoCatalogoItem>(
    `/productos-servicios/impuestos-catalogo/${id}`,
  );
}

export async function crearImpuestoCatalogo(
  payload: CrearImpuestoCatalogoPayload,
) {
  return apiRequest<ImpuestoCatalogoItem>(
    "/productos-servicios/impuestos-catalogo",
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function actualizarImpuestoCatalogo(
  id: string,
  payload: ActualizarImpuestoCatalogoPayload,
) {
  return apiRequest<ImpuestoCatalogoItem>(
    `/productos-servicios/impuestos-catalogo/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function eliminarImpuestoCatalogo(id: string) {
  return apiRequest<{ tipo: "soft" | "hard"; item: ImpuestoCatalogoItem }>(
    `/productos-servicios/impuestos-catalogo/${id}`,
    { method: "DELETE" },
  );
}

// ── Catálogo de Comisiones del tenant ───────────────────────────────────────────

export interface ComisionCatalogoItem {
  id: string;
  codigo: string;
  nombre: string;
  porcentaje: number;
  /** NETO (vendedor, sobre el precio sin IVA) | BRUTO_COBRADO (pasarela, sobre lo cobrado). */
  baseCalculo: ImpuestoBaseCalculo;
  /** PRODUCTO (vendedor, se asigna por producto) | TENANT (pasarela, a todo). */
  alcance: ImpuestoAlcance;
  detalleJson: unknown | null;
  activo: boolean;
  _count?: { productosAplicados: number };
}

export interface CrearComisionCatalogoPayload {
  codigo: string;
  nombre: string;
  porcentaje: number;
  baseCalculo?: ImpuestoBaseCalculo;
  alcance?: ImpuestoAlcance;
  detalleJson?: Record<string, unknown>;
}

export interface ActualizarComisionCatalogoPayload {
  nombre?: string;
  porcentaje?: number;
  baseCalculo?: ImpuestoBaseCalculo;
  alcance?: ImpuestoAlcance;
  detalleJson?: Record<string, unknown>;
  activo?: boolean;
}

export async function getComisionesCatalogo(
  soloActivos = true,
): Promise<ComisionCatalogoItem[]> {
  const qs = soloActivos ? "" : "?soloActivos=false";
  return apiRequest<ComisionCatalogoItem[]>(
    `/productos-servicios/comisiones-catalogo${qs}`,
  );
}

export async function getComisionCatalogoById(
  id: string,
): Promise<ComisionCatalogoItem> {
  return apiRequest<ComisionCatalogoItem>(
    `/productos-servicios/comisiones-catalogo/${id}`,
  );
}

export async function crearComisionCatalogo(
  payload: CrearComisionCatalogoPayload,
) {
  return apiRequest<ComisionCatalogoItem>(
    "/productos-servicios/comisiones-catalogo",
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function actualizarComisionCatalogo(
  id: string,
  payload: ActualizarComisionCatalogoPayload,
) {
  return apiRequest<ComisionCatalogoItem>(
    `/productos-servicios/comisiones-catalogo/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function eliminarComisionCatalogo(id: string) {
  return apiRequest<{ tipo: "soft" | "hard"; item: ComisionCatalogoItem }>(
    `/productos-servicios/comisiones-catalogo/${id}`,
    { method: "DELETE" },
  );
}

// ── Aplicaciones (pivot Producto ⇄ Catálogo) ────────────────────────────────────

export interface ImpuestoAplicado {
  id: string;
  productoId: string;
  impuestoCatalogoId: string;
  orden: number;
  impuestoCatalogo: ImpuestoCatalogoItem;
}

export interface ComisionAplicada {
  id: string;
  productoId: string;
  comisionCatalogoId: string;
  orden: number;
  comisionCatalogo: ComisionCatalogoItem;
}

export interface AsignarBatchItem {
  catalogoId: string;
  orden?: number;
}

export async function getImpuestosAplicados(
  productoId: string,
): Promise<ImpuestoAplicado[]> {
  return apiRequest<ImpuestoAplicado[]>(
    `/productos-servicios/productos/${productoId}/precio/impuestos`,
  );
}

/** Categoría fiscal del producto: 'general' | 'exento' (Fase 2). El IVA se
 *  resuelve en el motor por categoría × régimen del emisor. */
export async function getCategoriaFiscal(
  productoId: string,
): Promise<{ categoriaFiscal: string }> {
  return apiRequest<{ categoriaFiscal: string }>(
    `/productos-servicios/productos/${productoId}/precio/categoria-fiscal`,
  );
}

export async function setCategoriaFiscal(
  productoId: string,
  categoriaFiscal: string,
): Promise<{ categoriaFiscal: string }> {
  return apiRequest<{ categoriaFiscal: string }>(
    `/productos-servicios/productos/${productoId}/precio/categoria-fiscal`,
    {
      method: "PUT",
      body: JSON.stringify({ categoriaFiscal }),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function setImpuestosAplicados(
  productoId: string,
  items: Array<{ impuestoCatalogoId: string; orden?: number }>,
) {
  return apiRequest<ImpuestoAplicado[]>(
    `/productos-servicios/productos/${productoId}/precio/impuestos`,
    {
      method: "PUT",
      body: JSON.stringify({ items }),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function quitarImpuestoAplicado(
  productoId: string,
  impuestoCatalogoId: string,
) {
  return apiRequest(
    `/productos-servicios/productos/${productoId}/precio/impuestos/${impuestoCatalogoId}`,
    { method: "DELETE" },
  );
}

export async function getComisionesAplicadas(
  productoId: string,
): Promise<ComisionAplicada[]> {
  return apiRequest<ComisionAplicada[]>(
    `/productos-servicios/productos/${productoId}/precio/comisiones`,
  );
}

export async function setComisionesAplicadas(
  productoId: string,
  items: Array<{ comisionCatalogoId: string; orden?: number }>,
) {
  return apiRequest<ComisionAplicada[]>(
    `/productos-servicios/productos/${productoId}/precio/comisiones`,
    {
      method: "PUT",
      body: JSON.stringify({ items }),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function quitarComisionAplicada(
  productoId: string,
  comisionCatalogoId: string,
) {
  return apiRequest(
    `/productos-servicios/productos/${productoId}/precio/comisiones/${comisionCatalogoId}`,
    { method: "DELETE" },
  );
}

// ── Precios especiales por cliente ──────────────────────────────────────────────

export interface PrecioEspecialClienteItem {
  id: string;
  productoId: string;
  clienteId: string;
  configJson: unknown;
  activo: boolean;
  cliente: { id: string; nombre: string; razonSocial: string | null };
}

export interface CrearPrecioEspecialClientePayload {
  clienteId: string;
  configJson: Record<string, unknown>;
}

export interface ActualizarPrecioEspecialClientePayload {
  configJson?: Record<string, unknown>;
  activo?: boolean;
}

export async function getPreciosEspecialesProducto(
  productoId: string,
): Promise<PrecioEspecialClienteItem[]> {
  return apiRequest<PrecioEspecialClienteItem[]>(
    `/productos-servicios/productos/${productoId}/precios-especiales`,
  );
}

export async function crearPrecioEspecialCliente(
  productoId: string,
  payload: CrearPrecioEspecialClientePayload,
) {
  return apiRequest<PrecioEspecialClienteItem>(
    `/productos-servicios/productos/${productoId}/precios-especiales`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function actualizarPrecioEspecialCliente(
  id: string,
  payload: ActualizarPrecioEspecialClientePayload,
) {
  return apiRequest<PrecioEspecialClienteItem>(
    `/productos-servicios/precios-especiales/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function eliminarPrecioEspecialCliente(id: string) {
  return apiRequest(`/productos-servicios/precios-especiales/${id}`, {
    method: "DELETE",
  });
}
