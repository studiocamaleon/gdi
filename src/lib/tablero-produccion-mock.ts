export type TableroStepKey =
  | "diseno"
  | "verif"
  | "ctp"
  | "impresion_of"
  | "impresion_dg"
  | "ploteo"
  | "vinilo_corte"
  | "laminado"
  | "secado"
  | "guillotina"
  | "troquel"
  | "plegado"
  | "cnc"
  | "laser"
  | "encuad"
  | "armado"
  | "qa"
  | "empaque"
  | "despacho"
  | "instalacion";

export type TableroStepStatus = "done" | "current" | "pending" | "blocked";
export type TableroPriority = "urgent" | "high" | "normal";

export type TableroStepMeta = {
  nm: string;
  tec: string;
  ico: string;
};

export type TableroStep = {
  key: TableroStepKey;
  status: TableroStepStatus;
  end?: string;
  dur?: string;
  machine?: string;
  op?: string;
  progress?: number;
  sub?: string;
};

export type TableroItem = {
  code: string;
  otCode: string;
  customer: string;
  vendedor: string;
  product: string;
  spec: string;
  qty: number;
  priority: TableroPriority;
  dueDate: string;
  dueIn: string;
  onTrack: boolean;
  progressPct: number;
  statusLine: string;
  blocked?: boolean;
  blockedReason?: string;
  operator: {
    iniciales: string;
    nombre: string;
    role: string;
  };
  machine: string;
  steps: TableroStep[];
};

export type TableroActivity = {
  t: string;
  who: string;
  what: string;
  kind: "progress" | "step" | "comment" | "block" | "";
};

export type TableroStation = {
  key: string;
  nm: string;
  desc: string;
  icon: string;
};

export const PROD_STEPS: Record<TableroStepKey, TableroStepMeta> = {
  diseno: { nm: "Diseño", tec: "Diseño gráfico y maqueta", ico: "Layout" },
  verif: { nm: "Verificación", tec: "Pre-flight técnico", ico: "Check" },
  ctp: { nm: "CTP", tec: "Imposición + plancha CTP", ico: "Layers" },
  impresion_of: { nm: "Impresión", tec: "Impresión offset 4/4", ico: "Printer" },
  impresion_dg: { nm: "Impresión", tec: "Impresión digital", ico: "Printer" },
  ploteo: { nm: "Ploteo", tec: "Plotter gran formato Latex", ico: "Plot" },
  vinilo_corte: { nm: "Corte vinilo", tec: "Plotter de corte de vinilo", ico: "Cut" },
  laminado: { nm: "Laminado", tec: "Laminado UV mate / brillo", ico: "Brush" },
  secado: { nm: "Secado", tec: "Secado y estabilización", ico: "Sun" },
  guillotina: { nm: "Guillotinado", tec: "Corte en guillotina Polar", ico: "Scissors" },
  troquel: { nm: "Troquelado", tec: "Troquel mecánico", ico: "Stamp" },
  plegado: { nm: "Plegado", tec: "Plegado en línea", ico: "Fold" },
  cnc: { nm: "Corte CNC", tec: "Corte router CNC", ico: "Cnc" },
  laser: { nm: "Corte láser", tec: "Corte láser CO2", ico: "Beam" },
  encuad: { nm: "Encuad.", tec: "Anillado / cosido / hot-melt", ico: "Book" },
  armado: { nm: "Armado", tec: "Armado mecánico + cableado", ico: "Tool" },
  qa: { nm: "QA", tec: "Control de calidad final", ico: "Shield" },
  empaque: { nm: "Empaque", tec: "Embalaje y rotulación", ico: "Package" },
  despacho: { nm: "Despacho", tec: "Despacho / retiro en planta", ico: "Truck" },
  instalacion: { nm: "Instalación", tec: "Instalación en obra", ico: "Wrench" },
};

export const PROD_ITEMS: TableroItem[] = [
  {
    code: "ITEM-2487-A",
    otCode: "OT-2487",
    customer: "Municipalidad de Rosario",
    vendedor: "DS",
    product: "Boletas A4 duplicadas",
    spec: "Carbónico 50g · 12.000 u",
    qty: 12000,
    priority: "high",
    dueDate: "Vie 30 may",
    dueIn: "2d 4h",
    onTrack: true,
    progressPct: 36,
    statusLine: "Imprimiendo · pliego 168 de 250 · 38 min restantes",
    operator: { iniciales: "DS", nombre: "Daniel Sosa", role: "Maquinista offset" },
    machine: "Heidelberg GTO · PR-01",
    steps: [
      { key: "diseno", status: "done", end: "Lun 12·09:30", dur: "2h 10m" },
      { key: "verif", status: "done", end: "Lun 12·11:32", dur: "32 min" },
      { key: "ctp", status: "done", end: "Mar 13·09:20", dur: "25 min" },
      { key: "impresion_of", status: "current", machine: "Heidelberg GTO", op: "DS", progress: 0.67, sub: "Pliego 168/250" },
      { key: "secado", status: "pending", dur: "12 h" },
      { key: "guillotina", status: "pending", dur: "1 h" },
      { key: "qa", status: "pending", dur: "30 min" },
      { key: "empaque", status: "pending", dur: "30 min" },
      { key: "despacho", status: "pending" },
    ],
  },
  {
    code: "ITEM-2491-A",
    otCode: "OT-2491",
    customer: "Clínica Mayo",
    vendedor: "MP",
    product: "Vinilo gran formato impreso",
    spec: "Vinilo blanco · 4,2 m2 · montaje en sala",
    qty: 6,
    priority: "high",
    dueDate: "Hoy",
    dueIn: "5h",
    onTrack: false,
    progressPct: 78,
    statusLine: "Laminando · barniz UV mate frente",
    operator: { iniciales: "PR", nombre: "Pablo Rivero", role: "Operario laminado" },
    machine: "Laminadora Flexa · DG-04",
    steps: [
      { key: "diseno", status: "done", end: "Vie 23·14:00", dur: "1h 45m" },
      { key: "verif", status: "done", end: "Vie 23·15:20", dur: "20 min" },
      { key: "ploteo", status: "done", end: "Lun 26·11:40", dur: "1h 12m" },
      { key: "laminado", status: "current", machine: "Laminadora Flexa", op: "PR", progress: 0.55, sub: "Cara A laminada · falta cara B" },
      { key: "vinilo_corte", status: "pending", dur: "40 min" },
      { key: "qa", status: "pending", dur: "20 min" },
      { key: "empaque", status: "pending", dur: "15 min" },
      { key: "instalacion", status: "pending", dur: "3 h" },
    ],
  },
  {
    code: "ITEM-2484-C",
    otCode: "OT-2484",
    customer: "Bodega Trapiche",
    vendedor: "MP",
    product: "Tarjetas Premium 300gr",
    spec: "Opalina 300gr · 4/4 · laminado mate frente · 2.500 u",
    qty: 2500,
    priority: "urgent",
    dueDate: "Hoy",
    dueIn: "1h 20m",
    onTrack: false,
    progressPct: 62,
    statusLine: "Esperando 4hs de secado para guillotinar",
    operator: { iniciales: "JS", nombre: "Julián Sandoval", role: "Pre-prensa" },
    machine: "Sala de secado",
    steps: [
      { key: "diseno", status: "done", end: "Lun 26·10:00", dur: "1h" },
      { key: "verif", status: "done", end: "Lun 26·10:45", dur: "12 min" },
      { key: "ctp", status: "done", end: "Lun 26·14:30", dur: "22 min" },
      { key: "impresion_of", status: "done", end: "Mar 27·11:20", dur: "1h 30m" },
      { key: "secado", status: "current", machine: "Sala secado", op: "—", progress: 0.4, sub: "4h restantes de 10h" },
      { key: "laminado", status: "pending", dur: "45 min" },
      { key: "guillotina", status: "pending", dur: "30 min" },
      { key: "qa", status: "pending", dur: "20 min" },
      { key: "empaque", status: "pending", dur: "15 min" },
      { key: "despacho", status: "pending" },
    ],
  },
  {
    code: "ITEM-2492-A",
    otCode: "OT-2492",
    customer: "Editorial El Norte",
    vendedor: "MP",
    product: "Talonario duplicado A4",
    spec: "Autocopiativo CB+CFB · 50 sets x 200 talonarios",
    qty: 200,
    priority: "normal",
    dueDate: "Lun 2 jun",
    dueIn: "5d",
    onTrack: true,
    progressPct: 18,
    statusLine: "Plancha CTP montada · próximo paso impresión",
    operator: { iniciales: "JS", nombre: "Julián Sandoval", role: "Pre-prensa" },
    machine: "—",
    steps: [
      { key: "diseno", status: "done", end: "Lun 26·09:00", dur: "45 min" },
      { key: "verif", status: "done", end: "Lun 26·09:50", dur: "10 min" },
      { key: "ctp", status: "current", machine: "CTP-01", op: "JS", progress: 0.9, sub: "Esperando liberación de prensa" },
      { key: "impresion_of", status: "pending", dur: "2h" },
      { key: "secado", status: "pending", dur: "8 h" },
      { key: "plegado", status: "pending", dur: "1 h" },
      { key: "encuad", status: "pending", dur: "3 h" },
      { key: "qa", status: "pending", dur: "30 min" },
      { key: "empaque", status: "pending", dur: "30 min" },
    ],
  },
  {
    code: "ITEM-2479-B",
    otCode: "OT-2479",
    customer: "Café Atlántico",
    vendedor: "SM",
    product: "Letras corpóreas · logo",
    spec: "PVC 10mm + frente acrílico 3mm + vinilo · 6 letras",
    qty: 6,
    priority: "high",
    dueDate: "Jue 29 may",
    dueIn: "1d 6h",
    onTrack: false,
    progressPct: 52,
    statusLine: "Bloqueado · esperando entrega de acrílico opal 3mm",
    blocked: true,
    blockedReason: "Esperando reposición de acrílico opal 3mm del proveedor.",
    operator: { iniciales: "RT", nombre: "Roberto Tévez", role: "Armado corpóreas" },
    machine: "—",
    steps: [
      { key: "diseno", status: "done", end: "Mié 21·14:00", dur: "2h" },
      { key: "verif", status: "done", end: "Mié 21·16:00", dur: "20 min" },
      { key: "cnc", status: "done", end: "Vie 23·11:30", dur: "1h 20m" },
      { key: "laser", status: "done", end: "Vie 23·15:00", dur: "45 min" },
      { key: "vinilo_corte", status: "blocked", machine: "—", sub: "Esperando acrílico opal 3mm" },
      { key: "armado", status: "pending", dur: "3 h" },
      { key: "qa", status: "pending", dur: "30 min" },
      { key: "empaque", status: "pending", dur: "20 min" },
      { key: "instalacion", status: "pending", dur: "4 h" },
    ],
  },
  {
    code: "ITEM-2486-A",
    otCode: "OT-2486",
    customer: "Clínica Mayo",
    vendedor: "MP",
    product: "Cartel backlight",
    spec: "240 x 120cm · estructura + lona PVC + LED",
    qty: 1,
    priority: "normal",
    dueDate: "Mié 4 jun",
    dueIn: "7d",
    onTrack: true,
    progressPct: 14,
    statusLine: "Armando estructura metálica · 12 m soldados de 28 m",
    operator: { iniciales: "HC", nombre: "Hugo Cabrera", role: "Herrero" },
    machine: "Sector herrería",
    steps: [
      { key: "diseno", status: "done", end: "Lun 26·12:00", dur: "1h 30m" },
      { key: "verif", status: "done", end: "Lun 26·14:00", dur: "30 min" },
      { key: "armado", status: "current", machine: "Sector herrería", op: "HC", progress: 0.45, sub: "12/28 m soldados" },
      { key: "ploteo", status: "pending", dur: "1h 45m" },
      { key: "qa", status: "pending", dur: "30 min" },
      { key: "empaque", status: "pending", dur: "30 min" },
      { key: "despacho", status: "pending" },
      { key: "instalacion", status: "pending", dur: "4 h" },
    ],
  },
  {
    code: "ITEM-2477-D",
    otCode: "OT-2477",
    customer: "Estudio Méndez",
    vendedor: "SM",
    product: "Flyers A5 full color",
    spec: "Ilustración 170g · 4/4 · 5.000 u",
    qty: 5000,
    priority: "normal",
    dueDate: "Mié 28 may",
    dueIn: "Hoy 17h",
    onTrack: true,
    progressPct: 94,
    statusLine: "QA OK · esperando empaque y aviso de retiro",
    operator: { iniciales: "LM", nombre: "Lucas Méndez", role: "QA y empaque" },
    machine: "Sala QA",
    steps: [
      { key: "diseno", status: "done", end: "Vie 23·11:00", dur: "40 min" },
      { key: "verif", status: "done", end: "Vie 23·11:50", dur: "8 min" },
      { key: "impresion_dg", status: "done", end: "Lun 26·09:30", dur: "1h 50m" },
      { key: "guillotina", status: "done", end: "Lun 26·11:40", dur: "25 min" },
      { key: "qa", status: "done", end: "Lun 26·12:30", dur: "20 min" },
      { key: "empaque", status: "current", machine: "Empaque", op: "LM", progress: 0.3, sub: "1500 / 5000 embolsados" },
      { key: "despacho", status: "pending" },
    ],
  },
  {
    code: "ITEM-2473-B",
    otCode: "OT-2473",
    customer: "Editorial El Norte",
    vendedor: "MP",
    product: "Manual escolar · interior",
    spec: "Bond 80g · 64 págs · 2.000 u · cosido hot-melt",
    qty: 2000,
    priority: "normal",
    dueDate: "Vie 6 jun",
    dueIn: "9d",
    onTrack: true,
    progressPct: 44,
    statusLine: "Plegando pliegos · 8 de 16 plegados",
    operator: { iniciales: "RG", nombre: "Ricardo Genaro", role: "Acabado" },
    machine: "Plegadora Stahl · AC-02",
    steps: [
      { key: "diseno", status: "done", end: "Lun 19·14:00", dur: "4 h" },
      { key: "verif", status: "done", end: "Mar 20·09:30", dur: "1 h" },
      { key: "ctp", status: "done", end: "Mar 20·14:00", dur: "2 h" },
      { key: "impresion_of", status: "done", end: "Jue 22·17:00", dur: "6 h" },
      { key: "secado", status: "done", end: "Vie 23·11:00", dur: "12 h" },
      { key: "plegado", status: "current", machine: "Plegadora Stahl", op: "RG", progress: 0.5, sub: "Pliego 8 de 16" },
      { key: "encuad", status: "pending", dur: "5 h" },
      { key: "guillotina", status: "pending", dur: "1 h" },
      { key: "qa", status: "pending", dur: "45 min" },
      { key: "empaque", status: "pending", dur: "1 h" },
    ],
  },
  {
    code: "ITEM-2493-A",
    otCode: "OT-2493",
    customer: "Bar 9 de Julio",
    vendedor: "JR",
    product: "Stickers troquelados redondos",
    spec: "Vinilo brillante · 8 cm Ø · 600 u",
    qty: 600,
    priority: "normal",
    dueDate: "Vie 30 may",
    dueIn: "2d 8h",
    onTrack: true,
    progressPct: 28,
    statusLine: "Esperando aprobación de arte por parte del cliente",
    operator: { iniciales: "AC", nombre: "Ana Cardozo", role: "Diseño" },
    machine: "—",
    steps: [
      { key: "diseno", status: "current", machine: "—", op: "AC", progress: 0.8, sub: "Esperando aprobación cliente" },
      { key: "verif", status: "pending", dur: "10 min" },
      { key: "impresion_dg", status: "pending", dur: "1 h" },
      { key: "laminado", status: "pending", dur: "30 min" },
      { key: "troquel", status: "pending", dur: "45 min" },
      { key: "qa", status: "pending", dur: "15 min" },
      { key: "empaque", status: "pending", dur: "15 min" },
    ],
  },
  {
    code: "ITEM-2475-A",
    otCode: "OT-2475",
    customer: "Distribuidora Sur",
    vendedor: "JR",
    product: "Cajas microcorrugado",
    spec: "Microcorrugado E · 25 x 18 x 12 cm · 400 u",
    qty: 400,
    priority: "normal",
    dueDate: "Vie 6 jun",
    dueIn: "9d 4h",
    onTrack: true,
    progressPct: 8,
    statusLine: "Diseño aprobado · entra a CNC mañana",
    operator: { iniciales: "AC", nombre: "Ana Cardozo", role: "Diseño" },
    machine: "—",
    steps: [
      { key: "diseno", status: "done", end: "Mar 27·15:00", dur: "1h 30m" },
      { key: "verif", status: "done", end: "Mar 27·16:30", dur: "10 min" },
      { key: "cnc", status: "pending", dur: "2 h" },
      { key: "impresion_dg", status: "pending", dur: "1h 30m" },
      { key: "plegado", status: "pending", dur: "1 h" },
      { key: "qa", status: "pending", dur: "20 min" },
      { key: "empaque", status: "pending", dur: "30 min" },
      { key: "despacho", status: "pending" },
    ],
  },
];

export const PROD_ACTIVITY: Record<string, TableroActivity[]> = {
  "ITEM-2487-A": [
    { t: "hace 12s", who: "Sistema", what: "168 de 250 pliegos impresos.", kind: "progress" },
    { t: "hace 38m", who: "Daniel Sosa", what: "Inició la impresión en Heidelberg GTO.", kind: "step" },
    { t: "hace 1h", who: "Julián S.", what: "Plancha CTP lista y montada.", kind: "step" },
    { t: "Ayer", who: "Mariana P.", what: "Aprobó la prueba de color al cliente.", kind: "comment" },
    { t: "Ayer", who: "Sistema", what: "Archivo PDF pasó la verificación técnica.", kind: "step" },
  ],
  "ITEM-2479-B": [
    { t: "hace 2h", who: "Roberto T.", what: "Reportó faltante de acrílico opal 3mm.", kind: "block" },
    { t: "hace 2h", who: "Sistema", what: "Item marcado como BLOQUEADO.", kind: "block" },
    { t: "Vie", who: "Sistema", what: "Pasó corte láser y router CNC.", kind: "step" },
    { t: "Mié", who: "Sofía M.", what: "Cliente aprobó la maqueta final.", kind: "comment" },
  ],
};

export const STATIONS: TableroStation[] = [
  { key: "diseno", nm: "Diseño y verificación", desc: "Diseño gráfico y pre-flight de archivos", icon: "Layout" },
  { key: "ctp", nm: "CTP y planchas", desc: "Imposición y montaje de plancha CTP", icon: "Layers" },
  { key: "offset", nm: "Impresión Offset", desc: "Heidelberg GTO y SM 52", icon: "Printer" },
  { key: "digital", nm: "Impresión Digital", desc: "Impresión digital pliego", icon: "Printer" },
  { key: "latex", nm: "Plotter Latex - Gran formato", desc: "HP Latex 365 - vinilo, lona y rígidos", icon: "Plot" },
  { key: "vinilo_cut", nm: "Plotter de corte vinilo", desc: "Corte de vinilo autoadhesivo", icon: "Cut" },
  { key: "cnc", nm: "Router CNC", desc: "Corte de placas y materiales rígidos", icon: "Cnc" },
  { key: "laser", nm: "Láser CO2", desc: "Corte y grabado láser", icon: "Beam" },
  { key: "guillotina", nm: "Guillotina y plegado", desc: "Refilado, corte final y plegado en línea", icon: "Scissors" },
  { key: "laminado", nm: "Laminado y troquel", desc: "Laminado UV y troquelado mecánico", icon: "Brush" },
  { key: "armado", nm: "Armado y encuadernación", desc: "Armado, cableado y encuadernación", icon: "Tool" },
  { key: "qa-empaque", nm: "QA + Empaque", desc: "Control de calidad y embalaje final", icon: "Shield" },
  { key: "despacho", nm: "Despacho", desc: "Retiro, flete e instalación en obra", icon: "Truck" },
];

export const STEP_TO_STATION: Record<TableroStepKey, string> = {
  diseno: "diseno",
  verif: "diseno",
  ctp: "ctp",
  impresion_of: "offset",
  impresion_dg: "digital",
  ploteo: "latex",
  vinilo_corte: "vinilo_cut",
  cnc: "cnc",
  laser: "laser",
  laminado: "laminado",
  guillotina: "guillotina",
  plegado: "guillotina",
  troquel: "laminado",
  secado: "armado",
  encuad: "armado",
  armado: "armado",
  qa: "qa-empaque",
  empaque: "qa-empaque",
  despacho: "despacho",
  instalacion: "despacho",
};

export const STATION_CATEGORIES = [
  { key: "preprensa", nm: "Pre-prensa", stations: ["diseno", "ctp"] },
  { key: "impresion", nm: "Impresión", stations: ["offset", "digital", "latex"] },
  { key: "corte", nm: "Corte y router", stations: ["vinilo_cut", "cnc", "laser"] },
  { key: "acabado", nm: "Acabado", stations: ["guillotina", "laminado", "armado"] },
  { key: "post", nm: "QA y despacho", stations: ["qa-empaque", "despacho"] },
] as const;
