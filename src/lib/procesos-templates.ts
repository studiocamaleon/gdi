import type { PlantillaMaquinaria } from "@/lib/maquinaria";
import type {
  ProcesoOperacionPayload,
  TipoOperacionProceso,
  UnidadProceso,
} from "@/lib/procesos";

export type ProcesoTemplateOperation = Pick<
  ProcesoOperacionPayload,
  "codigo" | "nombre" | "tipoOperacion" | "unidadEntrada" | "unidadSalida" | "modoProductividad" | "activo"
>;

export type ProcesoTemplateDefinition = {
  id: string;
  plantillaMaquinaria: PlantillaMaquinaria;
  label: string;
  description: string;
  operations: ProcesoTemplateOperation[];
};

export type ProcesoOperacionTemplateDefinition = {
  id: string;
  label: string;
  description: string;
  plantillaMaquinaria: PlantillaMaquinaria;
  operation: ProcesoTemplateOperation;
};

function op(
  codigo: string,
  nombre: string,
  tipoOperacion: TipoOperacionProceso,
  unidadEntrada: UnidadProceso,
  unidadSalida: UnidadProceso,
): ProcesoTemplateOperation {
  return {
    codigo,
    nombre,
    tipoOperacion,
    unidadEntrada,
    unidadSalida,
    modoProductividad: "fija",
    activo: true,
  };
}

const templates: ProcesoTemplateDefinition[] = [
  {
    id: "router_cnc_base",
    plantillaMaquinaria: "router_cnc",
    label: "CNC corte/perfilado",
    description: "Flujo base para mecanizado y corte CNC.",
    operations: [
      op("PRE-001", "Preflight archivo", "preflight", "ninguna", "ninguna"),
      op("CNC-010", "Nesting", "preprensa", "ninguna", "hoja"),
      op("CNC-020", "Mecanizado", "mecanizado", "m2", "pieza"),
      op("CNC-030", "Control dimensional", "control_calidad", "pieza", "pieza"),
    ],
  },
  {
    id: "corte_laser_base",
    plantillaMaquinaria: "corte_laser",
    label: "Laser corte/grabado",
    description: "Flujo base para corte o grabado laser.",
    operations: [
      op("PRE-001", "Preflight vector", "preflight", "ninguna", "ninguna"),
      op("LAS-020", "Corte/Grabado laser", "corte", "m2", "pieza"),
      op("LAS-030", "Control y limpieza", "control_calidad", "pieza", "pieza"),
    ],
  },
  {
    id: "impresora_3d_base",
    plantillaMaquinaria: "impresora_3d",
    label: "Impresion 3D base",
    description: "Flujo base para fabricacion aditiva.",
    operations: [
      op("PRE-001", "Preparacion modelo", "preprensa", "ninguna", "ninguna"),
      op("ADD-020", "Impresion 3D", "impresion", "pieza", "pieza"),
      op("ADD-030", "Postproceso", "terminacion", "pieza", "pieza"),
    ],
  },
  {
    id: "impresora_dtf_base",
    plantillaMaquinaria: "impresora_dtf",
    label: "DTF textil base",
    description: "Impresion DTF con curado y transferencia.",
    operations: [
      op("PRE-001", "Preflight", "preflight", "ninguna", "ninguna"),
      op("DTF-020", "Impresion film", "impresion", "m2", "m2"),
      op("DTF-030", "Curado", "curado", "m2", "m2"),
      op("DTF-040", "Transferencia", "transferencia", "unidad", "unidad"),
    ],
  },
  {
    id: "impresora_dtf_uv_base",
    plantillaMaquinaria: "impresora_dtf_uv",
    label: "DTF UV sticker transfer",
    description: "Impresion UV sobre film con transferencia.",
    operations: [
      op("PRE-001", "Preflight capas", "preflight", "ninguna", "ninguna"),
      op("DUV-020", "Impresion UV film", "impresion", "m2", "m2"),
      op("DUV-030", "Laminado transfer", "laminado", "m2", "m2"),
      op("DUV-040", "Corte contorno", "corte", "m2", "unidad"),
    ],
  },
  {
    id: "impresora_uv_mesa_extensora_base",
    plantillaMaquinaria: "impresora_uv_mesa_extensora",
    label: "UV mesa extensora",
    description: "Flujo base para UV en rigidos con mesa extendida.",
    operations: [
      op("PRE-001", "Preflight capas", "preflight", "ninguna", "ninguna"),
      op("UVM-020", "Impresion UV", "impresion", "m2", "m2"),
      op("UVM-030", "Control calidad", "control_calidad", "m2", "m2"),
    ],
  },
  {
    id: "impresora_uv_cilindrica_base",
    plantillaMaquinaria: "impresora_uv_cilindrica",
    label: "UV cilindrica 360",
    description: "Flujo base para objetos cilindricos.",
    operations: [
      op("PRE-001", "Preflight", "preflight", "ninguna", "ninguna"),
      op("UVC-020", "Impresion cilindrica", "impresion", "pieza", "pieza"),
      op("UVC-030", "Curado/control", "curado", "pieza", "pieza"),
    ],
  },
  {
    id: "impresora_uv_flatbed_base",
    plantillaMaquinaria: "impresora_uv_flatbed",
    label: "UV flatbed",
    description: "Flujo base para impresion UV plana.",
    operations: [
      op("PRE-001", "Preflight capas", "preflight", "ninguna", "ninguna"),
      op("UVF-020", "Impresion UV flatbed", "impresion", "m2", "m2"),
      op("UVF-030", "Control calidad", "control_calidad", "m2", "m2"),
    ],
  },
  {
    id: "impresora_uv_rollo_base",
    plantillaMaquinaria: "impresora_uv_rollo",
    label: "UV rollo print&cut",
    description: "Flujo base UV rollo con corte.",
    operations: [
      op("PRE-001", "Preflight", "preflight", "ninguna", "ninguna"),
      op("UVR-020", "Impresion UV rollo", "impresion", "m2", "m2"),
      op("UVR-030", "Corte contorno", "corte", "m2", "unidad"),
    ],
  },
  {
    id: "impresora_solvente_base",
    plantillaMaquinaria: "impresora_solvente",
    label: "Solvente rollo",
    description: "Impresion solvente con secado y terminacion.",
    operations: [
      op("PRE-001", "Preflight", "preflight", "ninguna", "ninguna"),
      op("SOL-020", "Impresion solvente", "impresion", "m2", "m2"),
      op("SOL-030", "Secado/estabilizacion", "curado", "m2", "m2"),
      op("SOL-040", "Laminado/corte", "terminacion", "m2", "unidad"),
    ],
  },
  {
    id: "impresora_inyeccion_tinta_base",
    plantillaMaquinaria: "impresora_inyeccion_tinta",
    label: "Inkjet estandar",
    description: "Flujo base para inkjet rollo/hoja.",
    operations: [
      op("PRE-001", "Preflight", "preflight", "ninguna", "ninguna"),
      op("INK-020", "Impresion inkjet", "impresion", "m2", "m2"),
      op("INK-030", "Terminacion", "terminacion", "m2", "unidad"),
    ],
  },
  {
    id: "impresora_latex_base",
    plantillaMaquinaria: "impresora_latex",
    label: "Latex print&cut",
    description: "Flujo base latex con registro para corte.",
    operations: [
      op("PRE-001", "Preflight", "preflight", "ninguna", "ninguna"),
      op("LAT-020", "Impresion latex", "impresion", "m2", "m2"),
      op("LAT-030", "Corte contorno", "corte", "m2", "unidad"),
    ],
  },
  {
    id: "impresora_sublimacion_gran_formato_base",
    plantillaMaquinaria: "impresora_sublimacion_gran_formato",
    label: "Sublimacion transfer",
    description: "Impresion transfer y planchado/calandra.",
    operations: [
      op("PRE-001", "Diseno espejado", "preprensa", "ninguna", "ninguna"),
      op("SUB-020", "Impresion transfer", "impresion", "m2", "m2"),
      op("SUB-030", "Transferencia termica", "transferencia", "m2", "m2"),
    ],
  },
  {
    id: "impresora_laser_base",
    plantillaMaquinaria: "impresora_laser",
    label: "Digital hoja",
    description: "Flujo base para impresion digital hoja a hoja.",
    operations: [
      op("PRE-001", "Preflight PDF", "preflight", "ninguna", "ninguna"),
      op("DIG-020", "Impresion digital", "impresion", "hoja", "hoja"),
      op("DIG-030", "Terminacion", "terminacion", "hoja", "unidad"),
    ],
  },
  {
    id: "plotter_cad_base",
    plantillaMaquinaria: "plotter_cad",
    label: "Plot CAD",
    description: "Flujo base para lote de planos.",
    operations: [
      op("PRE-001", "Recepcion archivo", "preflight", "ninguna", "ninguna"),
      op("CAD-020", "Ploteo", "impresion", "hoja", "hoja"),
      op("CAD-030", "Corte formato", "terminacion", "hoja", "unidad"),
    ],
  },
  {
    id: "mesa_de_corte_base",
    plantillaMaquinaria: "mesa_de_corte",
    label: "Mesa de corte digital",
    description: "Corte, hendido o perforado en mesa.",
    operations: [
      op("PRE-001", "Import corte", "preflight", "ninguna", "ninguna"),
      op("MDC-020", "Registro marcas", "control_calidad", "m2", "m2"),
      op("MDC-030", "Corte/Hendido", "corte", "m2", "unidad"),
    ],
  },
  {
    id: "plotter_de_corte_base",
    plantillaMaquinaria: "plotter_de_corte",
    label: "Plotter de corte",
    description: "Corte de contorno o vinilo.",
    operations: [
      op("PRE-001", "Carga contornos", "preflight", "ninguna", "ninguna"),
      op("PDC-020", "Lectura marcas", "control_calidad", "m2", "m2"),
      op("PDC-030", "Corte", "corte", "m2", "unidad"),
      op("PDC-040", "Pelado", "terminacion", "unidad", "unidad"),
    ],
  },
];

const templateByMachine = new Map(
  templates.map((template) => [template.plantillaMaquinaria, template]),
);

const operationTemplates: ProcesoOperacionTemplateDefinition[] = templates.flatMap(
  (template) =>
    template.operations.map((operation, index) => ({
      id: `${template.id}::${index + 1}`,
      label: operation.nombre,
      description: `${template.label} · ${operation.tipoOperacion}`,
      plantillaMaquinaria: template.plantillaMaquinaria,
      operation,
    })),
);

export function getProcesoTemplateBase(plantilla: PlantillaMaquinaria) {
  return templateByMachine.get(plantilla) ?? null;
}

export function getProcesoTemplateItems() {
  return templates;
}

export function getProcesoOperacionTemplateItems(
  plantilla?: PlantillaMaquinaria | null,
) {
  if (!plantilla) {
    return operationTemplates;
  }

  return operationTemplates.filter(
    (item) => item.plantillaMaquinaria === plantilla,
  );
}
