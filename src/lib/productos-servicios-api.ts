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
  orden?: "recientes" | "nombre_asc" | "nombre_desc";
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
  if (params.orden) sp.set("orden", params.orden);
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
  subcategoriaComercialCodigo: string;
  atributosComercialesJson?: Record<string, unknown>;
  unidadComercial: "unidad" | "m2" | "metro_lineal";
  modoMedidas: ModoMedidasProducto;
  minimoComercialPolitica?: MinimoComercialPolitica;
  minimoComercialCantidad?: number | null;
  minimoComercialBase?: MinimoComercialBase;
  medidaDefaultAnchoMm?: number;
  medidaDefaultAltoMm?: number;
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
  subcategoriaComercialCodigo?: string;
  atributosComercialesJson?: Record<string, unknown>;
  unidadComercial?: "unidad" | "m2" | "metro_lineal";
  modoMedidas?: ModoMedidasProducto;
  minimoComercialPolitica?: MinimoComercialPolitica;
  minimoComercialCantidad?: number | null;
  minimoComercialBase?: MinimoComercialBase;
  medidaDefaultAnchoMm?: number | null;
  medidaDefaultAltoMm?: number | null;
  medidasPredefinidasJson?: MedidaPredefinidaProducto[] | null;
  personalizacionesJson?: Record<string, unknown>[] | null;
  precioConfigJson?: Record<string, unknown>;
  activo?: boolean;
}

export async function actualizarProducto(
  id: string,
  payload: ActualizarProductoPayload,
) {
  return apiRequest(`/productos-servicios/productos/${id}`, {
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

export async function getRutas(): Promise<RutaListItem[]> {
  return apiRequest<RutaListItem[]>("/productos-servicios/rutas");
}

export async function getRutaById(id: string) {
  return apiRequest(`/productos-servicios/rutas/${id}`);
}

export interface PasoRutaPayload {
  orden: number;
  familiaCodigo: string;
  icono?: string;
}

export interface CrearRutaPayload {
  codigo?: string;
  nombre: string;
  descripcion?: string;
  pasos: PasoRutaPayload[];
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
) {
  return apiRequest(
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

export interface DuplicarProductoRutaAltPayload {
  nombre?: string;
}

export async function duplicarProductoRutaAlt(
  rutaAltId: string,
  payload: DuplicarProductoRutaAltPayload = {},
) {
  return apiRequest(
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
  modoSeleccion: "HARDCODED" | "COMERCIAL_ELIGE" | "MOTOR_ELIGE_AUTO";
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
  return apiRequest(
    `/productos-servicios/familias/${encodeURIComponent(codigo)}/configuracion-base`,
    {
      method: "PUT",
      body: JSON.stringify({ ...input, rutaPasoId: codigo }),
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
    "MONTO_FIJO_PLANO" | "PORCENTAJE_SOBRE_BASE" | "POR_UNIDAD_INPUT";
  modosActivacionSoportados?: string[];
  configJson?: Record<string, unknown>;
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
    "MONTO_FIJO_PLANO" | "PORCENTAJE_SOBRE_BASE" | "POR_UNIDAD_INPUT";
  modosActivacionSoportados?: string[];
  configJson?: Record<string, unknown>;
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
  configOverrideJson?: Record<string, unknown>;
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
  modoActivacion: "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL";
  condicionActivacionJson?: Record<string, unknown>;
  configOverrideJson?: Record<string, unknown>;
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
    modoActivacion: string;
    condicionActivacionJson?: Record<string, unknown> | null;
    configOverrideJson?: Record<string, unknown> | null;
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
    | "grid-2d-multi";
  cantidadCalculada: number;
  unidad: "m_lineales" | "pliegos" | "pouches" | "m2" | "piezas";
  aprovechamientoPct: number;
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
  piezasAcomodadas: number;
  outputsCanonicos?: Record<string, unknown>;
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
      /** Costo de pasos tercerizados (lo que se paga al proveedor). */
      tercerizadoTotal?: number;
      total: number;
      unitario: number;
    };
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
        separacionMaxMm: number;
        lados: string[];
        esquinasSiempre: boolean;
      } | null;
      tiempo?: {
        /** Incluye los minutos de `tiemposExtra` (la ETA los cuenta). */
        totalMin: number;
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
        };
      }>;
      cargosDirectosPaso?: Array<{
        cargoCodigo: string;
        cargoNombre: string;
        monto: number;
        modoCalculo: string;
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
    }>;
  };
}

export async function cotizar(req: CotizarRequest): Promise<CotizarResponse> {
  return apiRequest<CotizarResponse>("/motor-universal/cotizar", {
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
