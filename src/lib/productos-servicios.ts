/**
 * Tipos del Modelo Universal V2 — espejo del schema Prisma para el frontend.
 *
 * Mantiene compatibilidad con el Tab Precio existente (UnidadComercialProducto,
 * MetodoCalculoPrecioProducto, etc.) que se usaba en el modelo viejo.
 */

export type UnidadComercialProducto = "unidad" | "m2" | "metro_lineal";

export const unidadComercialProductoItems: Array<{
  value: UnidadComercialProducto;
  label: string;
}> = [
  { value: "unidad", label: "Unidad" },
  { value: "m2", label: "Metro cuadrado (m²)" },
  { value: "metro_lineal", label: "Metro lineal" },
];

export type ModoMedidasProducto =
  "FIJA" | "LIBRE" | "COMERCIAL_ELIGE" | "MIXTA";

export type MinimoComercialPolitica =
  | "NONE"
  | "ADVERTIR_FACTURAR_MINIMO"
  | "BLOQUEAR";

export type MinimoComercialBase =
  | "cantidad_comercial"
  | "pliegos_impresos";

export interface MedidaPredefinidaProducto {
  id: string;
  nombre: string;
  anchoMm: number;
  altoMm: number;
  esDefault: boolean;
}

export interface AtributoComercialSchema {
  key: string;
  label: string;
  tipo: string;
  visible: boolean;
  orden: number;
}

export interface ProductoCategoriaComercial {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
  subcategorias: ProductoSubcategoriaComercial[];
}

export interface ProductoSubcategoriaComercial {
  id: string;
  categoriaId: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  atributosSchemaJson: AtributoComercialSchema[];
  orden: number;
  activo: boolean;
  categoria?: Omit<ProductoCategoriaComercial, "subcategorias">;
}

// ============================================================================
// MÉTODOS DE CÁLCULO DE PRECIO (Tab Precio preservado)
// ============================================================================

export type MetodoCalculoPrecioProducto =
  | "margen_variable"
  | "por_margen"
  | "precio_fijo"
  | "fijado_por_cantidad"
  | "fijo_con_margen_variable"
  | "variable_por_cantidad"
  | "precio_fijo_para_margen_minimo";

// ============================================================================
// PRODUCTO (modelo nuevo)
// ============================================================================

export interface ProductoListItem {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  atributosComercialesJson: Record<string, unknown> | null;
  medidaDefaultAnchoMm: string | null;
  medidaDefaultAltoMm: string | null;
  medidasPredefinidasJson: MedidaPredefinidaProducto[] | null;
  /** Personalizaciones (áreas de decoración) con medida propia. Raw JSON: usar
   *  getPersonalizaciones() de producto-personalizaciones.ts para parsear. */
  personalizacionesJson: unknown;
  precioConfigJson: unknown;
  unidadComercial: string;
  modoMedidas: ModoMedidasProducto;
  minimoComercialPolitica: MinimoComercialPolitica;
  minimoComercialCantidad: string | null;
  minimoComercialBase: MinimoComercialBase;
  activo: boolean;
  /** Derivado: algún paso de alguna ruta es tercerizado (para el badge). */
  tercerizado?: boolean;
  subcategoriaComercial: ProductoSubcategoriaComercial & {
    categoria: Omit<ProductoCategoriaComercial, "subcategorias">;
  };
  rutasAlternativas: Array<{
    id: string;
    nombre: string;
    esPreferida: boolean;
    ruta: { id: string; codigo: string; nombre: string };
  }>;
}

export interface ProductoDetalle extends Omit<
  ProductoListItem,
  "rutasAlternativas"
> {
  rutasAlternativas: RutaAlternativaDetalle[];
  pasosExtras: PasoExtra[];
  cargosDirectosCotizacion: CargoCotizacionDetalle[];
}

export interface RutaAlternativaDetalle {
  id: string;
  nombre: string;
  esPreferida: boolean;
  rutaVersion: number;
  reglaAutoSeleccionJson: unknown;
  ruta: {
    id: string;
    codigo: string;
    nombre: string;
    pasos: Array<RutaPaso>;
  };
  configPasos: Array<ConfigPasoDetalle>;
  /** G-F3: pasos extras inline de esta ruta (no de la ruta base reusable). */
  pasosExtras?: Array<PasoExtra>;
}

export interface RutaPaso {
  id: string;
  orden: number;
  familiaCodigo: string;
  /** Nombre de la familia resuelto en el server (para familias tenant el
   *  código es un UUID: nunca mostrarlo humanizado). */
  familiaNombre?: string | null;
  icono?: string | null;
  activo: boolean;
}

export interface ConfigPasoDetalle {
  id: string;
  rutaPasoId: string;
  rutaPaso: RutaPaso;
  modoActivacion: string | null;
  condicionActivacionJson: unknown;
  modoTiempo: string | null;
  mecanismoCantidad: string | null;
  mecanismoCantidadConfigJson?: unknown;
  multiplicadoresActivos: string[];
  paramsPasoJson: unknown;
  nombreVisible?: string | null;
  maquinaM1: {
    id: string;
    codigo: string;
    nombre: string;
    plantilla: string;
    anchoUtil?: number | string | null;
    parametrosTecnicosJson?: Record<string, unknown> | null;
    perfilesOperativos?: Array<{
      id: string;
      nombre?: string;
      activo?: boolean;
      tipoPerfil?: string | null;
      detalleJson?: Record<string, unknown> | null;
    }>;
    centroCostoPrincipalId?: string | null;
    centroCostoPrincipal?: {
      id: string;
      codigo: string;
      nombre: string;
    } | null;
  } | null;
  perfilM1: {
    id: string;
    nombre: string;
    tipoPerfil?: string | null;
    detalleJson?: Record<string, unknown> | null;
  } | null;
  modoColorOptions?: Array<{
    value: string;
    label: string;
    perfilIds: string[];
  }>;
  centroCosto: {
    id: string;
    codigo: string;
    nombre: string;
    unidadBaseFutura: string;
  } | null;
  setupOverrideMin?: number | null;
  cleanupOverrideMin?: number | null;
  tiempoFijoOverrideMin?: number | null;
  dotacionOperarios?: number | null;
  /** rutaPasoId de los pasos que este paso enciende al activarse. */
  requiereRutaPasoIds?: string[] | null;
  slotsMateriales: Array<SlotMaterialDetalle>;
  /** G-F2: candidatas M-2; cuando length > 1 el cotizador muestra Select de override. */
  maquinasCandidatas?: Array<{
    id: string;
    maquinaId: string;
    perfilDefaultId?: string | null;
    modoColorAllowedModes?: string[];
    modoColorOptions?: Array<{
      value: string;
      label: string;
      perfilIds: string[];
    }>;
    esPreferida: boolean;
    orden: number;
    perfilDefault?: {
      id: string;
      nombre: string;
      tipoPerfil?: string | null;
      detalleJson?: Record<string, unknown> | null;
    } | null;
    maquina: {
      id: string;
      codigo: string;
      nombre: string;
      plantilla: string;
      anchoUtil?: number | string | null;
      parametrosTecnicosJson?: Record<string, unknown> | null;
      perfilesOperativos?: Array<{
        id: string;
        nombre?: string;
        activo?: boolean;
        tipoPerfil?: string | null;
        productivityValue?: number | string | null;
        productivityUnit?: string | null;
        detalleJson?: Record<string, unknown> | null;
      }>;
      centroCostoPrincipalId?: string | null;
      centroCostoPrincipal?: {
        id: string;
        codigo: string;
        nombre: string;
      } | null;
    };
  }>;
  cargosDirectosPaso: Array<CargoPasoDetalle>;
  // === Tercerización (docs/productos-tercerizados-diseno.md) ===
  tercerizado?: boolean;
  proveedorId?: string | null;
  fuenteCostoTercerizado?: string | null;
  tercerizadoConfigJson?: Record<string, unknown> | null;
  plazoProveedorDias?: number | null;
  tercerizadoEntradas?: Array<{
    id: string;
    valoresJson: Record<string, unknown>;
    claveMatch: string;
    cantidad: number;
    costo: number | string;
  }>;
}

export interface SlotMaterialDetalle {
  id: string;
  slotCodigo: string;
  slotNombre: string | null;
  slotRol: string | null;
  modoSeleccion: string;
  criterioMotorAuto: string | null;
  estrategiaCosto: string;
  formula: string;
  cantidadFactor: string | number | null;
  cantidadBase: string | null;
  aplicaMultiCaras: boolean;
  materialVariante: {
    id: string;
    sku: string;
    nombreVariante: string | null;
    precioReferencia: string | null;
    atributosVarianteJson?: Record<string, unknown> | null;
    materiaPrima: {
      id: string;
      codigo: string;
      nombre: string;
      familia: string;
      subfamilia: string;
      templateId: string;
      variantes?: Array<{
        id: string;
        sku: string;
        nombreVariante: string | null;
        precioReferencia: string | null;
        atributosVarianteJson?: Record<string, unknown> | null;
      }>;
    };
  } | null;
  candidatos: Array<{
    id: string;
    materiaPrimaId: string;
    defaultVarianteId: string | null;
    orden: number;
    /** true = usa todas las variantes activas del material (absorbe las nuevas). */
    todasLasVariantes?: boolean;
    materiaPrima: {
      id: string;
      codigo: string;
      nombre: string;
      familia: string;
      subfamilia: string;
      templateId: string;
      /** Variantes activas del material (para el modo "todas"). */
      variantes?: Array<{
        id: string;
        sku: string;
        nombreVariante: string | null;
        precioReferencia: string | null;
        atributosVarianteJson?: unknown;
      }>;
    };
    defaultVariante: {
      id: string;
      sku: string;
      nombreVariante: string | null;
      precioReferencia: string | null;
    } | null;
    variantes: Array<{
      variante: {
        id: string;
        sku: string;
        nombreVariante: string | null;
        precioReferencia: string | null;
        atributosVarianteJson?: Record<string, unknown> | null;
      };
    }>;
  }>;
}

export interface CargoPasoDetalle {
  id: string;
  modoActivacion: string;
  cargoDirectoCatalogo: CargoDirectoCatalogo;
}

export interface CargoCotizacionDetalle {
  id: string;
  modoActivacion: string;
  cargoDirectoCatalogo: CargoDirectoCatalogo;
}

export interface PasoExtra {
  id: string;
  rutaAlternativaId: string | null;
  insertarDespuesDeRutaPasoId: string | null;
  ordenInterno: number;
  familiaCodigo: string;
  nombreVisible: string | null;
  modoActivacion: string | null;
  condicionActivacionJson: unknown;
  modoTiempo: string | null;
  mecanismoCantidad: string | null;
  mecanismoCantidadConfigJson: unknown;
  multiplicadoresActivos: string[];
  paramsPasoJson: unknown;
  maquinaM1Id: string | null;
  perfilM1Id: string | null;
  centroCostoId: string | null;
  setupOverrideMin: string | null;
  cleanupOverrideMin: string | null;
  tiempoFijoOverrideMin: string | null;
  /** Sub-fase 3: config inline embebida (slots / candidatas / cargos). */
  configSlotsMaterialesJson?: unknown;
  configMaquinasCandidatasJson?: unknown;
  configCargosDirectosJson?: unknown;
  /** M-2: candidatas hidratadas por el detalle (mismo shape que configPasos). */
  maquinasCandidatas?: ConfigPasoDetalle["maquinasCandidatas"];
  /** G-F4: slots de material hidratados por el detalle (mismo shape que configPasos). */
  slotsMateriales?: ConfigPasoDetalle["slotsMateriales"];
  activo: boolean;
  maquinaM1?: {
    id: string;
    codigo: string;
    nombre: string;
    plantilla: string;
  } | null;
  perfilM1?: { id: string; nombre: string } | null;
  centroCosto?: {
    id: string;
    codigo: string;
    nombre: string;
    unidadBaseFutura?: string;
  } | null;
}

// ============================================================================
// RUTA
// ============================================================================

export interface RutaListItem {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  versionActual: number;
  activo: boolean;
  pasos: Array<{
    id: string;
    orden: number;
    familiaCodigo: string;
    icono?: string | null;
  }>;
  _count: { productosAlternativas: number };
}

// ============================================================================
// FAMILIA
// ============================================================================

export interface FamiliaListItem {
  codigo: string;
  nombre: string;
  categoria: string;
  descripcion?: string;
  /** 'sistema' = catálogo fijo; 'tenant' = paso creado por la empresa
   *  (pasos componibles, Etapa C/D). */
  origen?: "sistema" | "tenant";
  visibleEnSelector?: boolean;
  relacionMaquinaSoportada: string[];
  modoActivacionDefault: string;
  modosTiempoSoportados: string[];
  mecanismosCantidadSoportados: string[];
  modosActivacionSoportados: string[];
  multiplicadoresSoportados: string[];
  permiteSlotsAdicionales: boolean;
  slotsRequeridos: Array<{
    codigo: string;
    nombre: string;
    tipo: string;
    requerido: boolean;
    compatibilidadMaterial?: {
      familiasMateriaPrima?: string[];
      subfamiliasMateriaPrima?: string[];
      templateIds?: string[];
      tipoTecnico?: string[];
    };
    /** [Tanda B] Fórmula de consumo que el slot IMPONE (film de laminado =
     *  por_metro_lineal); el editor la muestra resuelta, no la pregunta. */
    formulaForzada?: string;
    /** Derivadores (E2): la cantidad del slot es una magnitud derivada del
     *  paso (cable = cableMl); con despiece + largoBarra → unidades enteras. */
    magnitudDerivada?: string;
    /** Derivadores (E2): consumo fijo por trabajo (la fuente LED: 1). */
    cantidadFija?: number;
    /** Derivadores (E2): selección por capacidad DE FÁBRICA — si el slot no
     *  configura criterio, el motor usa MENOR_CAPACIDAD_QUE_CUMPLA con esto.
     *  El editor debe mostrarlo como resuelto, no como pendiente. */
    criterioCapacidadDefault?: {
      inputMagnitud?: string;
      inputCampo?: string;
      materialCampo: string;
    };
  }>;
  plantillasCompatibles: string[];
  inputsRequeridos: string[];
  outputsCanonicos: string[];
  /** B.3.3 — qué deja este paso (Registro de Capacidades), para el
   *  selector "hereda de" del editor de configuración. */
  capacidades?: Array<{ key: string; nombre: string; heredable: boolean }>;
  /** Las magnitudes publicadas que un paso siguiente puede heredar POR NOMBRE
   *  (mecanismo HEREDAR con `campoOutput`): "puntos de soldadura", "m² a
   *  pintar"… A diferencia de `capacidades`, conserva la identidad de los
   *  outputs derivados en vez de colapsarlos en "unidades procesadas". */
  outputsPublicables?: Array<{ key: string; etiqueta: string }>;
  /** Derivadores: lo mínimo para que el editor NOMBRE la cantidad del paso
   *  ("6 ml de perfil/h" en vez de "6 unid./h" — H1 del relevamiento). */
  /** [Efectos] Qué le puede exigir al trabajo un paso de esta familia
   *  (docs/efectos-de-paso-diseno.md). Gobierna qué ofrece el editor. */
  efectosSoportados?: string[];
  /** [Etapa F3] La familia es de impresión con modos de color: habilita la
   *  pregunta de modo color en el editor. */
  esImpresion?: boolean;
  /** [Tanda B] Tipos de perfil operativo que acepta; null/[] = cualquiera. */
  tiposPerfilCompatibles?: string[] | null;
  /** [Tanda B] Separación entre piezas por defecto (mm) del acomodado. */
  separacionNestingDefaultMm?: number;
  /** [Tanda B] Fuentes de piezas heredadas declaradas (códigos). La pregunta
   *  "¿qué monta?" aparece cuando hay fuentes y el default es el implícito. */
  fuentesPiezasNesting?: string[];
  fuentePiezasDefault?: string | null;
  /** [Tanda B] Output que hereda por default (etiqueta la opción Heredar). */
  outputHeredadoDefault?: string | null;
  /** [Tanda B] Sus params se editan con el editor genérico (antes lista
   *  FAMILIAS_CON_PARAMS_EDITABLES). */
  editorParamsGenerico?: boolean;
  /** [Tanda C] Mecanismo de cantidad con el que arranca el paso en el
   *  editor; null → el primero de los soportados. */
  mecanismoCantidadDefault?: string | null;
  /** [Tanda C] Cómo arranca el ritmo cuando nadie lo configuró. */
  ritmoDefault?: {
    unidad?: string;
    modoCalculo?: string;
    fuenteCantidad?: string;
  } | null;
  /** [Etapa F2] Presente ⇔ la familia acomoda piezas (nesting declarado);
   *  el editor decide la card Acomodado por esto, no por listas de códigos. */
  nestingConfig?: {
    superficie: string;
    estrategia?: string;
    guardSinLayout?: string;
  } | null;
  derivador?: {
    magnitudPrincipal: string;
    unidadPrincipal: string | null;
    /** Magnitudes derivadas ofrecidas como driver del tiempo ("cortes de
     *  hierro") — el menú las muestra como `derivada:<magnitud>`. */
    magnitudesTiempo?: Array<{ magnitud: string; etiqueta: string }>;
  } | null;
  /** [Árbol de tiempo] La familia calcula el run con una primitiva propia
   *  (código del catálogo del motor, ej. guillotina_por_cortes) que
   *  REEMPLAZA la fórmula del perfil — el editor la explica, no la
   *  pregunta. */
  primitivaTiempo?: string | null;
  /** E.1 — defaults declarados del paso (null = sin defaults). */
  defaults?: DefaultsFamiliaPaso | null;
  validaciones: Array<{
    codigo: string;
    tipo: string;
    mensaje: string;
    [key: string]: unknown;
  }>;
  paramsPasoSchema: Array<{
    campo: string;
    etiqueta: string;
    tipo: string;
    valoresPermitidos?: string[];
    default?: unknown;
    requerido?: boolean;
    descripcion?: string;
    /** Editable por el comercial POR DISEÑO de la familia (densidad LED,
     *  refuerzos del bastidor) — el sheet lo ofrece sin que el modelador lo
     *  abra. Espejo de ParamsPasoDeclarado.expuestoAlComercial del API. */
    expuestoAlComercial?: boolean;
  }>;
  productosTipicos?: string[];
}

export interface CategoriaFamilia {
  codigo: string;
  nombre: string;
  descripcion: string;
  orden: number;
}

export interface CatalogoFamilias {
  categorias: CategoriaFamilia[];
  familias: FamiliaListItem[];
}

// ============================================================================
// FAMILIAS DEL TENANT (pasos componibles, Etapa D)
// ============================================================================

/** Fila cruda de FamiliaTenant que devuelve el listado admin. */

/** E.1 — defaults declarados del paso (FamiliaPasoDefaults). */
export interface DefaultsFamiliaPaso {
  centroCostoId: string | null;
  productividadHora: number | null;
  tiempoFijoMin: number | null;
  demasiaMm: number | null;
  solapePanelMm: number | null;
  /** E.2 — tercerización declarada; la grilla sigue por producto. */
  tercerizado?: boolean | null;
  proveedorId?: string | null;
  fuenteCostoTercerizado?: string | null;
  plazoProveedorDias?: number | null;
}

/** Un paso propio del tenant: INSTANCIA de una plantilla del sistema, de la
 *  que hereda la ficha entera. docs/pasos-tenant-por-plantilla-diseno.md */
export interface PasoTenant {
  id: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  activo: boolean;
  /** De qué plantilla del catálogo hereda. */
  plantillaCodigo: string;
  plantillaNombre: string | null;
  categoria: string | null;
  /** false si la plantilla ya no existe en el catálogo. */
  heredaFicha?: boolean;
  estacion: { id: string; nombre: string } | null;
  /** true si la estación viene de la plantilla (no tiene regla propia). */
  estacionHeredada?: boolean;
  defaults?: DefaultsFamiliaPaso | null;
}

/** Plantilla instanciable que ofrece el modal de alta. */
export interface PlantillaPaso {
  codigo: string;
  nombre: string;
  categoria: string;
  descripcion?: string;
}

export interface UpsertPasoTenantInput {
  nombre: string;
  /** FamiliaCodigo del catálogo del que hereda. */
  plantillaCodigo: string;
  descripcion?: string | null;
  icono?: string | null;
  activo?: boolean;
  defaults?: Partial<DefaultsFamiliaPaso> | null;
}

export interface PreviewCosteoFamilia {
  periodo: string;
  centroCostoNombre: string;
  tarifaHora: number;
  tarifaPublicada: boolean;
  totalMin: number;
  dotacion: number;
  costoTiempo: number;
  cantidad: number;
}

// ============================================================================
// CARGO DIRECTO
// ============================================================================

export interface CargoDirectoCatalogo {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  modoCalculo: string;
  modosActivacionSoportados: string[];
  configJson: unknown;
  activo: boolean;
}
