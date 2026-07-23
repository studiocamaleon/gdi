/**
 * Configuración › Integraciones.
 *
 * El diseño trae un marketplace de diez integraciones con contadores de
 * instalaciones ("Slack · 6.3k instalaciones · Conectar"). Eso es una maqueta:
 * mostrar un botón "Conectar" que no conecta nada, con un número inventado al
 * lado, es mentirle al usuario. Acá van sólo las que existen o están
 * decididas, y el estado dice la verdad.
 *
 * Google Drive quedó descartado (decisión 2026-07-22).
 *
 * Ver docs/integraciones-wati-diseno.md
 */

export type ProveedorIntegracion = "WATI" | "AFIP" | "MERCADOPAGO";

export type EstadoIntegracion = "DESCONECTADA" | "CONECTADA" | "ERROR";

export type Integracion = {
  proveedor: ProveedorIntegracion;
  estado: EstadoIntegracion;
  /** Últimos caracteres del token. El completo no vuelve nunca del API. */
  pista: string | null;
  metadata: Record<string, unknown> | null;
  ultimoChequeoEl: string | null;
  ultimoErrorTexto: string | null;
  conectadaEl: string | null;
};

export type CatalogoItem = {
  proveedor: ProveedorIntegracion;
  nombre: string;
  categoria: string;
  descripcion: string;
  color: string;
  /** false = todavía no se puede conectar desde acá. */
  disponible: boolean;
};

export const CATALOGO: CatalogoItem[] = [
  {
    proveedor: "WATI",
    nombre: "Wati",
    categoria: "Mensajería",
    descripcion:
      "WhatsApp Business API · avisá a tus clientes cuando su trabajo avanza",
    color: "#25d366",
    disponible: true,
  },
  {
    proveedor: "AFIP",
    nombre: "ARCA",
    categoria: "Facturación",
    descripcion:
      "Facturación electrónica por delegación · verificá que tu CUIT esté habilitado",
    color: "#0066b2",
    disponible: false,
  },
  {
    proveedor: "MERCADOPAGO",
    nombre: "Mercado Pago",
    categoria: "Cobros",
    descripcion: "Links de pago y conciliación automática de cobros",
    color: "#009ee3",
    disponible: false,
  },
];

export const ETIQUETA_ESTADO: Record<EstadoIntegracion, string> = {
  CONECTADA: "Conectada",
  ERROR: "Con problemas",
  DESCONECTADA: "Sin conectar",
};

export function itemDe(proveedor: ProveedorIntegracion): CatalogoItem {
  return CATALOGO.find((c) => c.proveedor === proveedor)!;
}

export function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Estado de las plantillas: el catálogo canónico de Grafo cruzado con lo que
 * hay de verdad en la cuenta de Wati del tenant.
 */
export type PlantillaGestionada = {
  evento: string;
  codigo: string;
  titulo: string;
  cuando: string;
  activoPorDefecto: boolean;
  /** La categoría que Grafo le pide a Meta. */
  categoriaPedida: string;
  /** La que Meta asignó. Distinta = el texto se leyó como promoción. */
  categoriaAsignada: string | null;
  estado: string;
  calidad: string | null;
  idRemoto: string | null;
  parametros: string[];
  cuerpo: string;
};

export type PlantillaPropia = {
  codigo: string;
  estado: string;
  categoria: string | null;
  idioma: string | null;
  calidad: string | null;
  parametros: string[];
  cuerpo: string | null;
  footer: string | null;
};

export type EstadoPlantillas = {
  gestionadas: PlantillaGestionada[];
  propias: PlantillaPropia[];
  resumen: {
    total: number;
    aprobadas: number;
    pendientes: number;
    conProblema: number;
    sinSometer: number;
    recategorizadas: number;
  };
};

/* ─────────────── Notificaciones por WhatsApp ─────────────── */

export type ConfigNotificaciones = {
  /** Freno de mano: corta todos los envíos sin perder la configuración. */
  pausado: boolean;
  /** Cortesía, para todos los mensajes. */
  horaDesde: string;
  horaHasta: string;
  /**
   * Días con el local abierto al público, ISO (1 = lunes … 7 = domingo).
   * Sólo lo respetan los avisos que invitan al cliente a venir a retirar.
   */
  diasAtencion: string;
};

export type EventoNotificacion = {
  evento: string;
  titulo: string;
  cuando: string;
  categoria: string;
  codigo: string;
  activo: boolean;
  /** true = el tenant nunca lo tocó y está en el default de Grafo. */
  porDefecto: boolean;
  /** false = todavía no hay nada en el sistema que lo dispare. */
  cableado: boolean;
};

export type ResumenConsentimiento = {
  total: number;
  aceptaron: number;
  rechazaron: number;
  sinPreguntar: number;
};

export type EstadoNotificaciones = {
  configuracion: ConfigNotificaciones;
  eventos: EventoNotificacion[];
  consentimiento: ResumenConsentimiento;
};

export type LineaLog = {
  id: string;
  evento: string;
  titulo: string;
  estado: string;
  cliente: string | null;
  telefono: string;
  motivo: string | null;
  intentos: number;
  programadaPara: string | null;
  enviadaEl: string | null;
  createdAt: string;
};

export const DIAS_SEMANA = [
  { iso: 1, label: "Lun" },
  { iso: 2, label: "Mar" },
  { iso: 3, label: "Mié" },
  { iso: 4, label: "Jue" },
  { iso: 5, label: "Vie" },
  { iso: 6, label: "Sáb" },
  { iso: 7, label: "Dom" },
] as const;
