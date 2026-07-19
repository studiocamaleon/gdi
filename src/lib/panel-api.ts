import { apiRequest } from "@/lib/api";

/**
 * Panel general (Inteligencia de negocio) — contrato con /reportes/panel.
 * Cimientos: tipos compartidos (rango, meta honesta) y un fetch por tab.
 * Los payloads de cada tab se completan a medida que aterriza su service
 * de dominio. Ver docs/reportes-plan-backend.md
 */

export type GranularidadPanel = "dia" | "semana" | "mes";

/** La honestidad viaja del backend: fuente, límites y si hay comparativa. */
export type MetaPanel = {
  fuente: string;
  limites: string[];
  sinComparativa: boolean;
  rango: { desde: string; hasta: string };
  rangoAnterior: { desde: string; hasta: string };
  granularidad: GranularidadPanel;
};

export type RangoPanel = { desde?: string; hasta?: string };

/** Gasto fijo de estructura por categoría (donut de Finanzas). */
export type CategoriaGastoPanel = { categoria: string; monto: number; pct: number };

/**
 * Bloque de rentabilidad: márgenes y PUNTO DE EQUILIBRIO. Resumen trae un
 * subconjunto; Finanzas suma costos variables/fijos y el gasto por centro.
 * Deltas: ventas en % vs. período anterior; márgenes en PUNTOS. null =
 * sin comparativa (el período anterior no tuvo ventas).
 */
export type RentabilidadPanel = {
  ventas: number;
  ventasDeltaPct: number | null;
  margenBruto: number;
  margenBrutoPct: number;
  margenBrutoDeltaPts?: number | null;
  contribucion: number;
  contribucionPct: number;
  contribucionDeltaPts?: number | null;
  /** null cuando no se puede calcular (sin fijos o contribución no positiva). */
  puntoEquilibrio: number | null;
  avancePct: number | null;
  costoTotal?: number;
  costosVariables?: number;
  costosFijos?: number;
  gastoPorCategoria?: CategoriaGastoPanel[];
};

/** Respuesta base de un tab (mientras se construye, `pendiente: true`). */
export type TabPanel<T = Record<string, never>> = {
  meta: MetaPanel;
  pendiente?: boolean;
} & Partial<T>;

function qs(rango?: RangoPanel): string {
  const params = new URLSearchParams();
  if (rango?.desde) params.set("desde", rango.desde);
  if (rango?.hasta) params.set("hasta", rango.hasta);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** Ventas (tab Comercial + top clientes del Resumen). */
export type RankingPanel = { id: string | null; nombre: string; ordenes: number; facturado: number };
export type MixPanel = { nombre: string; monto: number; pct: number };
export type ClienteDormidoPanel = {
  clienteId: string | null;
  cliente: string;
  ultimaCompra: string;
  diasSinComprar: number;
  historico: number;
};
export type PuntoTicketPanel = {
  fecha: string;
  ordenes: number;
  ticketPromedio: number;
  ticketMediana: number;
};
/** Celda del heatmap categoría × mes (últimos 12 meses). */
export type CeldaEstacionalidadPanel = { categoria: string; mes: string; monto: number };
export type ComercialPanel = {
  kpis: {
    ventas: number;
    ventasDeltaPct: number | null;
    /** vs. mismo período del año anterior; null hasta tener esa historia. */
    ventasDeltaAnualPct: number | null;
    ordenes: number;
    ordenesDeltaPct: number | null;
    ticketPromedio: number;
    itemsPorOrden: number;
    nuevosClientes: number;
    clientesDormidos: number;
  };
  serie: Array<{ fecha: string; monto: number }>;
  /** Evolución del ticket por orden: promedio y mediana por bucket. */
  serieTicket: PuntoTicketPanel[];
  estacionalidad: CeldaEstacionalidadPanel[];
  granularidad: GranularidadPanel;
  rankingClientes: RankingPanel[];
  rankingVendedores: RankingPanel[];
  mixCategoria: MixPanel[];
  mixTecnologia: MixPanel[];
  dormidos: ClienteDormidoPanel[];
};

/** Embudo comercial: cohorte de presupuestos emitidos → aprobados → producción → entrega. */
export type EmbudoEtapaPanel = {
  clave: "emitidas" | "aprobadas" | "produccion" | "entregadas";
  label: string;
  cantidad: number;
  monto: number;
  /** Etapa / cohorte total (barra). */
  sharePct: number;
  /** Etapa / etapa anterior (paso a paso); null en la 1ª. */
  conversionPct: number | null;
};
export type EmbudoFugaPanel = { motivo: string; cantidad: number; monto: number };
export type EmbudoVelocidadPanel = { tramo: string; diasPromedio: number | null };
export type EmbudoPanel = {
  sinComparativa: boolean;
  kpis: {
    tasaAprobacion: number;
    tasaAprobacionDeltaPct: number | null;
    tasaEntrega: number;
    pipelineAbiertoCantidad: number;
    pipelineAbiertoMonto: number;
    cicloPromedioDias: number | null;
  };
  funnel: EmbudoEtapaPanel[];
  fugas: EmbudoFugaPanel[];
  velocidad: EmbudoVelocidadPanel[];
};

/** Alertas: la capa de inteligencia — avisos accionables con severidad. */
export type SeveridadPanel = "critico" | "atencion" | "info";
export type AlertaPanel = {
  id: string;
  severidad: SeveridadPanel;
  titulo: string;
  detalle: string;
  reporte: "finanzas" | "comercial" | "produccion" | "producto";
};
export type UmbralesPanel = {
  diasClienteDormido: number;
  deudaVencidaPctMax: number;
  concentracionPctMax: number;
  mesesTarifaVieja: number;
  razonTiemposPctMax: number;
  utilizacionPctMin: number;
  margenPctMin: number;
};

/** Producción (mirada de gerencia): OTD, eficiencia de tiempo, utilización. */
export type ProduccionPanel = {
  kpis: {
    otdPct: number | null;
    atrasoPromedioDias: number;
    leadTimeDias: number | null;
    eficienciaPct: number | null;
    bloqueados: number;
    utilizacionPct: number | null;
    trabajosEnCola: number;
    diasDeCarga: number | null;
  };
  otd: {
    total: number;
    aTiempo: number;
    tarde: number;
    sinFecha: number;
    otdPct: number | null;
    atrasoPromedioDias: number;
    leadTimeDias: number | null;
    atrasadas: Array<{ numero: string; cliente: string; fechaEntrega: string; diasAtraso: number }>;
  };
  eficiencia: {
    /** >100% = tarda MÁS que lo cotizado. */
    eficienciaPct: number | null;
    porFamilia: Array<{ familia: string; estimadoMin: number; realMin: number; razon: number | null; muestras: number }>;
    atipicosExcluidos: number;
  };
  utilizacion: Array<{ centro: string; horasReales: number; capacidadPractica: number; pct: number | null }>;
  throughput: Array<{ fecha: string; cantidad: number }>;
  bloqueos: Array<{ motivo: string; veces: number }>;
  /** Registro de tiempos (docs/registro-tiempos-produccion-diseno.md §9). */
  registroTiempos: {
    totalPasos: number;
    /** % de pasos del período cuyo tiempo es una medición real. */
    confiablePct: number | null;
    fuentes: Array<{ fuente: string; pasos: number; pct: number }>;
    pausas: Array<{ motivo: string; veces: number }>;
    operadores: Array<{ operador: string; minutos: number; pasos: number }>;
  };
  /** Ahorro de material por consolidar tandas (simulador gran formato). */
  ahorros: {
    periodo: { tandas: number; jobs: number; ahorroMl: number; ahorroPesos: number };
    historico: { tandas: number; jobs: number; ahorroMl: number; ahorroPesos: number };
    porMaterial: Array<{ material: string; tecnologia: string | null; tandas: number; ahorroMl: number; ahorroPesos: number }>;
  };
};

/** Ventas & Producto: márgenes por categoría/producto, uso de papel, medidas. */
export type ProductoMargenPanel = {
  nombre: string;
  ventas: number;
  costo: number;
  margen: number;
  margenPct: number;
  /** Costos variables (material + consumibles) y margen de contribución. */
  costosVariables: number;
  contribucion: number;
  contribucionPct: number;
  items: number;
};
export type MaterialUsoPanel = {
  material: string;
  /** Unidad canónica: unidad, hoja, m2, metro_lineal, ml, gramo. */
  unidad: string;
  /** Formato comercial de la hoja (SRA3, A3+…) cuando la variante lo trae. */
  formato: string | null;
  cantidad: number;
  costo: number;
  items: number;
};
export type MedidasModoProductoPanel = {
  nombre: string;
  items: number;
  estandar: number;
  personalizada: number;
  pctEstandar: number;
};
/** Medida estándar (predefinida del producto) vs. a medida (personalizada). */
export type MedidasResumenPanel = {
  items: number;
  estandar: number;
  personalizada: number;
  pctEstandar: number | null;
  sinDato: number;
  porProducto: MedidasModoProductoPanel[];
  topEstandar: Array<{ nombre: string; items: number }>;
};
/** Punto de la serie evolutiva del mix (bucket × categoría o producto). */
export type PuntoMixPanel = { fecha: string; nombre: string; monto: number };
export type AdicionalUsoPanel = {
  etiqueta: string;
  items: number;
  pctItems: number;
  ventas: number;
};
export type ProductoAdicionalesPanel = {
  nombre: string;
  items: number;
  itemsCon: number;
  pctCon: number;
};
/** Attach rate de adicionales (pasos opcionales) — v1 sin economía por adicional. */
export type AdicionalesPanel = {
  itemsTotales: number;
  itemsCon: number;
  pctCon: number;
  ticketItemCon: number;
  ticketItemSin: number;
  porAdicional: AdicionalUsoPanel[];
  porProducto: ProductoAdicionalesPanel[];
};
export type ProductoPanel = {
  porCategoria: ProductoMargenPanel[];
  porProducto: ProductoMargenPanel[];
  /** Consumo de sustrato (papel/vinilo/film) — teórico, del snapshot. */
  porPapel: MaterialUsoPanel[];
  /** Consumo de tintas/tóner — teórico, del snapshot. */
  consumoTintas: MaterialUsoPanel[];
  /** Medida estándar vs. a medida, global y por producto. */
  medidas: MedidasResumenPanel;
  totalM2: number;
  porTecnologia: MixPanel[];
  /** Mix evolutivo por categoría (el front pivota por `nombre`). */
  mixEvolutivo: PuntoMixPanel[];
  adicionales: AdicionalesPanel;
};
/** Drill del mix: serie por producto dentro de una categoría + su margen. */
export type MixCategoriaPanel = {
  categoria: string;
  serie: PuntoMixPanel[];
  productos: ProductoMargenPanel[];
};

/** Tab Clientes: cartera, retención, RFM y margen por cliente. */
export type SegmentoRfmPanel =
  | "campeones"
  | "leales"
  | "nuevos"
  | "en_riesgo"
  | "perdidos"
  | "ocasionales";
export type ClienteRfmPanel = {
  clienteId: string;
  cliente: string;
  ordenes: number;
  facturadoHistorico: number;
  ultimaCompra: string;
  diasSinComprar: number;
};
export type ParetoClientePanel = {
  clienteId: string;
  cliente: string;
  ordenes: number;
  facturado: number;
  pct: number;
  pctAcumulado: number;
};
export type MargenClientePanel = {
  clienteId: string | null;
  cliente: string;
  ordenes: number;
  ventas: number;
  margen: number;
  margenPct: number | null;
  itemsSinCosto: number;
};
/** Tab Equipo: por persona, con las guardas del estudio (sin rankings). */
export type PersonaProduccionPanel = {
  id: string | null;
  nombre: string;
  minutos: number;
  pasos: number;
  dias: number;
  familias: number;
  autoPausas: number;
};
export type PersonaEficienciaPanel = {
  id: string | null;
  nombre: string;
  muestras: number;
  /** null = muestra insuficiente (no se muestra número). */
  desvioPct: number | null;
  serie: Array<{ semana: string; desvioPct: number; muestras: number }>;
};
export type PersonaDisciplinaPanel = {
  id: string | null;
  nombre: string;
  pasos: number;
  medidos: number;
  declarados: number;
  estimados: number;
  invalidos: number;
  medidoPct: number;
  autoPausas: number;
};
export type CeldaPolivalenciaPanel = {
  nombre: string;
  familia: string;
  minutos: number;
  pasos: number;
};
export type VendedorEquipoPanel = {
  empleadoId: string | null;
  nombre: string;
  ordenes: number;
  facturado: number;
  ticketPromedio: number;
  margen: number | null;
  margenPct: number | null;
  itemsSinCosto: number;
  comisionEstimada: number | null;
};
export type EquipoPanel = {
  kpis: {
    personasActivas: number;
    minutosProductivos: number;
    pasosCompletados: number;
    medidoPct: number | null;
    vendedoresActivos: number;
  };
  personas: PersonaProduccionPanel[];
  eficiencia: PersonaEficienciaPanel[];
  muestraMinima: number;
  disciplina: PersonaDisciplinaPanel[];
  polivalencia: CeldaPolivalenciaPanel[];
  familiasSinRespaldo: Array<{ familia: string; persona: string }>;
  vendedores: VendedorEquipoPanel[];
};

export type ClientesPanel = {
  kpis: {
    activos: number;
    nuevos: number;
    recurrentes: number;
    retencionPct: number | null;
    frecuenciaMedianaDias: number | null;
    concentracionTop3Pct: number | null;
  };
  pareto: ParetoClientePanel[];
  serieNuevosRecurrentes: Array<{ fecha: string; nuevos: number; recurrentes: number }>;
  rfm: {
    diasActivo: number;
    segmentos: Array<{ segmento: SegmentoRfmPanel; clientes: number; facturado: number }>;
    enRiesgo: ClienteRfmPanel[];
  };
  margenClientes: MargenClientePanel[];
  granularidad: GranularidadPanel;
};

/** Cobranza (tab Finanzas): aging, costo de cobrar, DSO, cheques, fondos. */
export type FranjaAgingPanel = "0-30" | "31-60" | "61-90" | "+90";
export type DeudorPanel = {
  clienteId: string | null;
  cliente: string;
  saldo: number;
  diasMax: number;
  porFranja: Record<FranjaAgingPanel, number>;
};
export type CostoCobrarMetodoPanel = {
  metodo: string;
  cantidad: number;
  bruto: number;
  comision: number;
  neto: number;
  pct: number;
};
export type CobranzaPanel = {
  facturado: number;
  cobrado: number;
  brecha: number;
  /** Días de facturación inmovilizados en la deuda; null si sin facturación. */
  dso: number | null;
  aging: Array<{ franja: FranjaAgingPanel; monto: number }>;
  agingTotal: number;
  vencido: number;
  deudores: DeudorPanel[];
  costoCobrar: CostoCobrarMetodoPanel[];
  comisionTotal: number;
  cheques: Array<{ estado: string; cantidad: number; importe: number; proximoVencimiento: string | null }>;
  fondos: Array<{ cuenta: string; saldo: number }>;
};

export type ResumenProduccionKpis = {
  otdPct: number | null;
  utilizacionPct: number | null;
  trabajosEnCola: number;
  diasDeCarga: number | null;
};

export function getPanelResumen(rango?: RangoPanel) {
  return apiRequest<
    TabPanel<{
      rentabilidad: RentabilidadPanel;
      produccion: ResumenProduccionKpis;
      serie: Array<{ fecha: string; monto: number; costo: number }>;
      topClientes: RankingPanel[];
      topProductos: ProductoMargenPanel[];
      alertas: AlertaPanel[];
    }>
  >(`/reportes/panel/resumen${qs(rango)}`);
}

export function getPanelAlertas(rango?: RangoPanel) {
  return apiRequest<TabPanel<{ activas: AlertaPanel[] }>>(`/reportes/panel/alertas${qs(rango)}`);
}
export function getPanelUmbrales() {
  return apiRequest<UmbralesPanel>(`/reportes/panel/umbrales`);
}
export function actualizarPanelUmbrales(payload: Partial<UmbralesPanel>) {
  return apiRequest<UmbralesPanel>(`/reportes/panel/umbrales`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
export function getPanelComercial(rango?: RangoPanel) {
  return apiRequest<TabPanel<ComercialPanel>>(`/reportes/panel/comercial${qs(rango)}`);
}
export function getPanelEmbudo(rango?: RangoPanel) {
  return apiRequest<TabPanel<EmbudoPanel>>(`/reportes/panel/embudo${qs(rango)}`);
}
export function getPanelFinanzas(rango?: RangoPanel) {
  return apiRequest<TabPanel<{ rentabilidad: RentabilidadPanel; cobranza: CobranzaPanel }>>(
    `/reportes/panel/finanzas${qs(rango)}`,
  );
}
export function getPanelProduccion(rango?: RangoPanel) {
  return apiRequest<TabPanel<ProduccionPanel>>(`/reportes/panel/produccion${qs(rango)}`);
}
export function getPanelProducto(rango?: RangoPanel) {
  return apiRequest<TabPanel<ProductoPanel>>(`/reportes/panel/producto${qs(rango)}`);
}
export function getPanelClientes(rango?: RangoPanel) {
  return apiRequest<TabPanel<ClientesPanel>>(`/reportes/panel/clientes${qs(rango)}`);
}
export function getPanelEquipo(rango?: RangoPanel) {
  return apiRequest<TabPanel<EquipoPanel>>(`/reportes/panel/equipo${qs(rango)}`);
}

/** "Mi desempeño": la vista del propio operario — siempre scoped al user logueado. */
export type MiDesempenoPanel = {
  limites: string[];
  ventana: { desde: string; hasta: string; semanas: number };
  hoy: { minutos: number; pasos: number };
  semanaActual: {
    minutos: number;
    pasos: number;
    dias: number;
    /** vs. el promedio de TUS semanas previas con actividad; null sin historia. */
    vsPromedioPct: number | null;
  };
  serieSemanal: Array<{ semana: string; minutos: number; pasos: number; dias: number }>;
  eficiencia: {
    muestras: number;
    muestraMinima: number;
    desvioPct: number | null;
    serie: Array<{ semana: string; desvioPct: number; muestras: number }>;
  };
  disciplina: {
    pasos: number;
    medidos: number;
    declarados: number;
    estimados: number;
    invalidos: number;
    medidoPct: number | null;
    autoPausas: number;
  };
  familias: Array<{ familia: string; minutos: number; pasos: number; nueva: boolean }>;
  pausas: Array<{ motivo: string; veces: number }>;
};
export function getMiDesempeno() {
  return apiRequest<MiDesempenoPanel>(`/reportes/panel/mi-desempeno`);
}
export function getPanelMixCategoria(categoria: string, rango?: RangoPanel) {
  const params = new URLSearchParams();
  if (rango?.desde) params.set("desde", rango.desde);
  if (rango?.hasta) params.set("hasta", rango.hasta);
  params.set("categoria", categoria);
  return apiRequest<TabPanel<MixCategoriaPanel>>(
    `/reportes/panel/producto/mix-categoria?${params.toString()}`,
  );
}
