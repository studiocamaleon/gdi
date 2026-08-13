/**
 * Órdenes de Trabajo — contrato de datos.
 *
 * Este archivo ES el contrato entre la vista y el backend de persistencia:
 * la fase de vista (Producción → Órdenes de trabajo) se construye contra
 * estos tipos usando `MOCK_ORDENES_TRABAJO`; la fase de backend implementa
 * exactamente estas formas, y conectar es reemplazar el mock por fetch sin
 * tocar la vista.
 *
 * Decisión de modelo (2026-07-15): la OT es una entidad DISTINTA de
 * `Cotizacion` (presupuesto). El presupuesto vence (`fechaValidez`); la OT
 * se produce y se entrega (`fechaEntrega`, `progresoPct`, eventos). El
 * snapshot de items viaja del presupuesto a la OT al aprobar.
 */

import { formatearMoneda, type Moneda } from "@/lib/moneda";

export type OrdenTrabajoEstado =
  | "borrador"
  | "pendiente"
  | "produccion"
  | "finalizada"
  | "entregada"
  | "cancelada";

/**
 * Ciclo de vida en orden. `cancelada` NO está: no es una etapa más adelante
 * sino una salida lateral, y el stepper del detalle recorre este array — una
 * cancelada no tiene que dibujarse como si le faltara llegar a algún lado.
 */
export const ORDEN_TRABAJO_FLOW: OrdenTrabajoEstado[] = [
  "borrador",
  "pendiente",
  "produccion",
  "finalizada",
  "entregada",
];

/** Terminal y fuera del flujo: se llega por la acción de cancelar. */
export const ESTADO_CANCELADA = "cancelada" as const;

/**
 * Desde dónde ofrece cancelar la UI: mientras el trabajo todavía no está
 * hecho. Espejo de ESTADOS_CANCELABLES del API.
 *
 * Una finalizada no se cancela —el trabajo existe, el material se consumió y
 * las horas se pagaron—; si se finalizó por error, se reabre un paso desde el
 * tablero y se cancela desde producción.
 */
export function esCancelable(estado: OrdenTrabajoEstado): boolean {
  return (
    estado === "borrador" ||
    estado === "pendiente" ||
    estado === "produccion"
  );
}

export const ORDEN_TRABAJO_ESTADOS: Record<
  OrdenTrabajoEstado,
  { label: string; fg: string; bg: string; dot: string }
> = {
  borrador: { label: "Borrador", fg: "#6e6e76", bg: "#f0efec", dot: "#92929b" },
  pendiente: { label: "Pendiente", fg: "#c2410c", bg: "#fef3ed", dot: "#e8802a" },
  produccion: {
    label: "En producción",
    fg: "#1d4ed8",
    bg: "#eef2ff",
    dot: "#3b6fe0",
  },
  finalizada: {
    label: "Finalizada",
    fg: "#16794a",
    bg: "#e9f4ee",
    dot: "#1f9d6b",
  },
  entregada: { label: "Entregada", fg: "#2c2c33", bg: "#e8e6e1", dot: "#4a4a52" },
  // Apagada a propósito: no es un error (rojo) ni un logro (verde), es un
  // trabajo que no va a pasar. Tiene que leerse como cerrado, no como alarma.
  cancelada: { label: "Cancelada", fg: "#7a7a82", bg: "#f4f3f1", dot: "#a8a8b0" },
};

/**
 * Fila del listado de OT. Es lo que devuelve `GET /produccion/ordenes`.
 *
 * Fechas: ISO date (`YYYY-MM-DD`) o datetime ISO completo; la vista formatea.
 */
export type OrdenTrabajoListItem = {
  id: string;
  /** Número visible, p.ej. "OT-2026-0184". Lo asigna el backend al emitir. */
  numero: string;
  clienteId: string | null;
  clienteNombre: string;
  vendedorEmpleadoId: string | null;
  vendedorNombre: string;
  estado: OrdenTrabajoEstado;
  /** Fecha de creación (ISO). */
  creadaEl: string;
  /** Fecha comprometida de entrega (ISO date) o null si no se pactó. */
  fechaEntrega: string | null;
  /** Cantidad de items (productos) de la orden. */
  itemsCount: number;
  /** Total bruto ARS de la orden. */
  total: number;
  /**
   * Avance de producción 0–100. Hasta que exista el tablero real el backend
   * lo deriva del estado (borrador/pendiente → 0 · finalizada/entregada →
   * 100 · produccion → lo que informe producción, o null si no hay dato).
   * null ⇒ la vista muestra "—".
   */
  progresoPct: number | null;
  /** Resumen corto de contenido: "Tarjetas · Vinilo c/ instalación". */
  resumen: string;
};

/** Evento del timeline de auditoría de una OT. */
export type OrdenTrabajoEventoTipo =
  | "emision"
  | "numero_asignado"
  | "borrador"
  | "productos"
  | "estado"
  | "modificacion"
  | "item_agregado"
  | "item_modificado"
  | "item_quitado"
  | "paso"
  | "nota";

export type OrdenTrabajoEvento = {
  /** ISO datetime. */
  fecha: string;
  tipo: OrdenTrabajoEventoTipo;
  descripcion: string;
  usuarioNombre: string;
  /** Diff estructurado { campo, antes, despues } u otros payloads por tipo. */
  datosJson?: unknown;
  /** 'usuario' | 'sistema'. */
  origen?: string;
};

/** Spec visible de un producto dentro de la OT (del snapshot del item). */
export type OrdenTrabajoProductoSpec = { etiqueta: string; valor: string };

/**
 * Payload de rehidratación del item (del CotizacionItem persistido): permite
 * que la vista de la OT emitida sea la MISMA ficha de creación. `resumen` es
 * el snapshotJson {producto, ruta, ejecucion}; `trazabilidad` trae los pasos
 * ejecutados completos {pasos, cargosDirectosCotizacion}.
 */
export type OrdenTrabajoItemSnapshot = {
  productoId: string;
  rutaAlternativaId: string | null;
  jobContext: unknown;
  resumen: unknown;
  trazabilidad: unknown;
  costoUnitario: number | null;
  costoTotal: number | null;
  precioUnitario: number | null;
  precioTotal: number | null;
  precioSnapshots: {
    precioConfig: unknown;
    impuestos: unknown;
    comisiones: unknown;
    precioEspecialCliente: unknown;
  };
};

/** Producto (item) de la OT — proyección del snapshot de CotizacionItem. */
export type OrdenTrabajoProducto = {
  /** Id del OrdenTrabajoItem persistido (para editar/quitar). */
  id?: string;
  cotizacionItemId?: string | null;
  /**
   * Descuento comercial persistido en el `OrdenTrabajoItem` (F1 descuentos).
   * `tipo`/`valor` = lo que pidió el vendedor; `monto` = lo que resolvió el
   * motor (ya restado dentro de `subtotal`). Para rehidratar la ficha.
   */
  descuentoTipo?: "PORCENTAJE" | "MONTO" | null;
  descuentoValor?: number | null;
  descuentoMonto?: number | null;
  /** Cupón que originó el descuento (F4). */
  descuentoCuponId?: string | null;
  codigo: string;
  nombre: string;
  /** Etiqueta corta legada (subcategoría). Preferir los campos de abajo. */
  familia: string;
  /** "Gran formato flexible" / "Vinilos impresos" — como en la creación. */
  categoriaComercial?: string;
  subcategoriaComercial?: string;
  cantidad: number;
  cantidadUnidad: string;
  subtotal: number;
  impuestos: number;
  total: number;
  specs: OrdenTrabajoProductoSpec[];
  adicionales: string[];
  snapshot?: OrdenTrabajoItemSnapshot | null;
};

export type OrdenTrabajoCuotaEstado =
  | "pagado"
  | "parcial"
  | "pendiente"
  | "vencido";

/**
 * Plan de pagos de la OT — PREVIEW del módulo de pagos (diseño Grafo V2).
 * Cuando diseñemos ese módulo esto migra a su propio contrato; por ahora
 * define lo que la vista de detalle necesita mostrar.
 */
export type OrdenTrabajoPago = {
  plan: string;
  condicion: string;
  cuotas: Array<{
    concepto: string;
    /** ISO date. */
    vence: string;
    monto: number;
    estado: OrdenTrabajoCuotaEstado;
  }>;
  movimientos: Array<{
    /** ISO date. */
    fecha: string;
    metodo: string;
    referencia: string;
    monto: number;
    comprobante: string;
    usuarioNombre: string;
  }>;
};

/**
 * Detalle de una OT (vista individual). Los productos con sus specs salen
 * del snapshot de `CotizacionItem` referenciado.
 */
export type OrdenTrabajoDetalle = OrdenTrabajoListItem & {
  cotizacionId: string | null;
  observaciones: string | null;
  /** 'mostrador' | 'web' | 'vendedor_externo' | 'telefono' o null. */
  canalVenta: string | null;
  /** Cargos directos a nivel orden (viático, flete…). */
  cargosDirectos: number;
  /** Tratamiento fiscal: 'FISCAL' (con IVA y comprobante) | 'SIN_COMPROBANTE'
   *  (IVA oculto, `total` = neto, fuera de la cola de facturar). §6 del
   *  cuaderno docs/margen-y-decisiones-de-precio.md. */
  tratamientoFiscal: "FISCAL" | "SIN_COMPROBANTE";
  /** Token del link público de seguimiento del cliente (/track/<token>). */
  publicToken: string | null;
  /** Eje fiscal: cuánto de la orden pasó por factura (las NC restan). */
  facturadoTotal: number;
  /** Eje de cobranza: bruto cobrado de la orden. */
  cobradoTotal: number;
  /** Sólo si está cancelada: por qué, quién y con cuánto trabajo encima. */
  cancelacion: OrdenTrabajoCancelacion | null;
  productos: OrdenTrabajoProducto[];
  eventos: OrdenTrabajoEvento[];
  /** Fecha (ISO) en que la orden alcanzó cada estado. Para el stepper (hover).
   *  Sólo trae los alcanzados; los futuros no están. El API real siempre lo
   *  manda; opcional para no obligar a los mocks. */
  fechasEstado?: Partial<Record<OrdenTrabajoEstado, string>>;
  pago: OrdenTrabajoPago | null;
};

export type OrdenTrabajoCancelacion = {
  /** ISO. */
  fecha: string;
  /** En qué etapa estaba: no es lo mismo morir en borrador que en producción. */
  estadoAlCancelar: string | null;
  motivo: string;
  por: string | null;
  pasosHechos: number;
  pasosTotal: number;
  minutosReales: number;
};

/**
 * KPIs y contadores del listado, calculados por el BACKEND sobre el tenant
 * completo. Antes se derivaban de las filas cargadas y mentían en cuanto
 * había más órdenes que el límite de la página.
 */
export type OrdenesTrabajoStats = {
  porEstado: Record<OrdenTrabajoEstado, number>;
  totalOrdenes: number;
  activas: number;
  valorEnCurso: number;
  proximasEntregar: number;
  emitidasHoy: number;
};

/** Progreso derivado del estado cuando producción no informa un valor real. */
export function progresoDerivado(
  estado: OrdenTrabajoEstado,
): number | null {
  switch (estado) {
    case "borrador":
      return null;
    case "pendiente":
      return 0;
    case "produccion":
      return null;
    case "finalizada":
    case "entregada":
      return 100;
    // Quedó donde quedó: mostrar un avance invitaría a leerlo como algo que
    // todavía puede terminar.
    case "cancelada":
      return null;
  }
}

/** "$ 220.298" — redondeado, sin decimales (formato del listado). */
export function formatMonedaOrden(value: number, moneda: Moneda): string {
  return formatearMoneda(value, moneda, { decimales: 0 });
}

/**
 * "YYYY-MM-DD…" → "dd/mm/yyyy" sin pasar por Date (evita el corrimiento de
 * día de las fechas date-only parseadas como UTC en zona AR).
 */
export function formatFechaOrden(iso: string | null): string {
  if (!iso) return "—";
  const [datePart] = iso.split("T");
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Date local a partir del date-part de un ISO (para diffs de días). */
export function fechaLocalDesdeIso(iso: string): Date | null {
  const [datePart] = iso.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// ─────────────────────────────────────────────────────────────────────────
// MOCK — datos de la fase de vista. Se reemplaza por el fetch al backend en
// la fase de conexión; nada fuera de la vista debe importar esto.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Detalle mock: la OT-0184 tiene el detalle completo (productos + eventos +
 * pago); el resto usa el fallback "sin detalle" que también contempla la
 * vista (órdenes históricas sin snapshot).
 */
export function getMockOrdenDetalle(id: string): OrdenTrabajoDetalle | null {
  const item = MOCK_ORDENES_TRABAJO.find((o) => o.id === id);
  if (!item) return null;
  if (id !== "mock-0184") {
    return {
      ...item,
      cotizacionId: null,
      observaciones: null,
      canalVenta: null,
      cargosDirectos: 0,
      tratamientoFiscal: "FISCAL",
      publicToken: null,
      facturadoTotal: 0,
      cobradoTotal: 0,
      cancelacion: null,
      productos: [],
      eventos: [],
      pago: null,
    };
  }
  return {
    ...item,
    cotizacionId: null,
    observaciones: null,
    canalVenta: "mostrador",
    cargosDirectos: 8500,
    tratamientoFiscal: "FISCAL",
    publicToken: null,
    facturadoTotal: 0,
    cobradoTotal: 0,
    cancelacion: null,
    productos: [
      {
        codigo: "TAR-001",
        nombre: "Tarjetas personales",
        familia: "Digital",
        cantidad: 500,
        cantidadUnidad: "u.",
        subtotal: 34000,
        impuestos: 7140,
        total: 41140,
        specs: [
          { etiqueta: "Material", valor: "Papel ilustración 300g" },
          { etiqueta: "Medidas", valor: "9 × 5 cm" },
          { etiqueta: "Color", valor: "4/4 + barniz" },
          { etiqueta: "Acabado", valor: "Mate" },
        ],
        adicionales: ["Cantos redondeados", "Empaque premium"],
      },
      {
        codigo: "VIN-120",
        nombre: "Vinilo impreso con instalación",
        familia: "Gran formato",
        cantidad: 3.84,
        cantidadUnidad: "m²",
        subtotal: 71040,
        impuestos: 14918,
        total: 85958,
        specs: [
          { etiqueta: "Material", valor: "Vinilo blanco brillante" },
          { etiqueta: "Medidas", valor: "120 × 80 cm × 4" },
          { etiqueta: "Tecnología", valor: "Solvente" },
          { etiqueta: "Instalación", valor: "CABA" },
        ],
        adicionales: ["Viático CABA", "Laminado brillo"],
      },
      {
        codigo: "TAL-050",
        nombre: "Talonarios numerados",
        familia: "Talonario",
        cantidad: 25,
        cantidadUnidad: "u.",
        subtotal: 70000,
        impuestos: 14700,
        total: 84700,
        specs: [
          { etiqueta: "Material", valor: "Autocopiativo 3 hojas" },
          { etiqueta: "Medidas", valor: "15 × 21 cm" },
          { etiqueta: "Numeración", valor: "0001 – 2500" },
          { etiqueta: "Encuadernado", valor: "Engomado + tapa" },
        ],
        adicionales: ["Perforado", "Talón desprendible"],
      },
    ],
    eventos: [
      {
        fecha: "2026-07-15T02:04:00",
        tipo: "emision",
        descripcion: "OT emitida al taller",
        usuarioNombre: "Lucas G. Gomez",
      },
      {
        fecha: "2026-07-15T02:04:00",
        tipo: "numero_asignado",
        descripcion: "Nº asignado OT-2026-0184",
        usuarioNombre: "Sistema",
      },
      {
        fecha: "2026-07-15T02:03:00",
        tipo: "borrador",
        descripcion: "Borrador guardado",
        usuarioNombre: "Lucas G. Gomez",
      },
      {
        fecha: "2026-07-15T01:58:00",
        tipo: "productos",
        descripcion: "3 productos agregados a la cotización",
        usuarioNombre: "Lucas G. Gomez",
      },
    ],
    pago: {
      plan: "50% anticipo · saldo contra entrega",
      condicion: "Cuenta corriente · 15 días",
      cuotas: [
        {
          concepto: "Anticipo (50%)",
          vence: "2026-07-15",
          monto: 110149,
          estado: "pagado",
        },
        {
          concepto: "Saldo contra entrega",
          vence: "2026-07-21",
          monto: 110149,
          estado: "parcial",
        },
      ],
      movimientos: [
        {
          fecha: "2026-07-15",
          metodo: "Transferencia",
          referencia: "Banco Galicia · CBU ****4471",
          monto: 110149,
          comprobante: "REC-0021",
          usuarioNombre: "Lucas G. Gomez",
        },
        {
          fecha: "2026-07-16",
          metodo: "Efectivo",
          referencia: "Caja mostrador",
          monto: 40000,
          comprobante: "REC-0037",
          usuarioNombre: "Marina Ruiz",
        },
      ],
    },
  };
}

export const MOCK_ORDENES_TRABAJO: OrdenTrabajoListItem[] = [
  {
    id: "mock-0184",
    numero: "OT-2026-0184",
    clienteId: null,
    clienteNombre: "Estudio Méndez",
    vendedorEmpleadoId: null,
    vendedorNombre: "Lucas G. Gomez",
    estado: "pendiente",
    creadaEl: "2026-07-15",
    fechaEntrega: "2026-07-21",
    itemsCount: 3,
    total: 220298,
    progresoPct: 0,
    resumen: "Tarjetas · Vinilo c/ instalación · Talonarios",
  },
  {
    id: "mock-0183",
    numero: "OT-2026-0183",
    clienteId: null,
    clienteNombre: "Bodega Trapiche",
    vendedorEmpleadoId: null,
    vendedorNombre: "Marina Ruiz",
    estado: "produccion",
    creadaEl: "2026-07-14",
    fechaEntrega: "2026-07-19",
    itemsCount: 2,
    total: 184500,
    progresoPct: 42,
    resumen: "Gráfica PDV · Etiquetas premium",
  },
  {
    id: "mock-0182",
    numero: "OT-2026-0182",
    clienteId: null,
    clienteNombre: "Clínica Mayo",
    vendedorEmpleadoId: null,
    vendedorNombre: "Lucas G. Gomez",
    estado: "produccion",
    creadaEl: "2026-07-14",
    fechaEntrega: "2026-07-17",
    itemsCount: 5,
    total: 96200,
    progresoPct: 68,
    resumen: "Señalética interna · Cartelería direccional",
  },
  {
    id: "mock-0181",
    numero: "OT-2026-0181",
    clienteId: null,
    clienteNombre: "Municipalidad Rosario",
    vendedorEmpleadoId: null,
    vendedorNombre: "Diego Sosa",
    estado: "pendiente",
    creadaEl: "2026-07-13",
    fechaEntrega: "2026-07-20",
    itemsCount: 6,
    total: 341000,
    progresoPct: 0,
    resumen: "Cartelería vía pública · Banners evento",
  },
  {
    id: "mock-0180",
    numero: "OT-2026-0180",
    clienteId: null,
    clienteNombre: "Café Atlántico",
    vendedorEmpleadoId: null,
    vendedorNombre: "Marina Ruiz",
    estado: "finalizada",
    creadaEl: "2026-07-12",
    fechaEntrega: "2026-07-15",
    itemsCount: 2,
    total: 58400,
    progresoPct: 100,
    resumen: "Stickers mesa · Menú plastificado",
  },
  {
    id: "mock-0179",
    numero: "OT-2026-0179",
    clienteId: null,
    clienteNombre: "Bar 9 de Julio",
    vendedorEmpleadoId: null,
    vendedorNombre: "Lucas G. Gomez",
    estado: "entregada",
    creadaEl: "2026-07-11",
    fechaEntrega: "2026-07-14",
    itemsCount: 1,
    total: 42300,
    progresoPct: 100,
    resumen: "Ploteo de barra",
  },
  {
    id: "mock-0178",
    numero: "OT-2026-0178",
    clienteId: null,
    clienteNombre: "Hotel Savoy",
    vendedorEmpleadoId: null,
    vendedorNombre: "Diego Sosa",
    estado: "produccion",
    creadaEl: "2026-07-10",
    fechaEntrega: "2026-07-16",
    itemsCount: 4,
    total: 128900,
    progresoPct: 25,
    resumen: "Señalética pisos · Displays recepción",
  },
  {
    id: "mock-0177",
    numero: "OT-2026-0177",
    clienteId: null,
    clienteNombre: "Distribuidora Sur",
    vendedorEmpleadoId: null,
    vendedorNombre: "Marina Ruiz",
    estado: "entregada",
    creadaEl: "2026-07-09",
    fechaEntrega: "2026-07-13",
    itemsCount: 1,
    total: 74600,
    progresoPct: 100,
    resumen: "Lona frente depósito",
  },
  {
    id: "mock-0176",
    numero: "OT-2026-0176",
    clienteId: null,
    clienteNombre: "Farmacia Central",
    vendedorEmpleadoId: null,
    vendedorNombre: "Lucas G. Gomez",
    estado: "borrador",
    creadaEl: "2026-07-08",
    fechaEntrega: "2026-07-12",
    itemsCount: 2,
    total: 39800,
    progresoPct: null,
    resumen: "Vidriera local · Cruz LED (cotizando)",
  },
];
