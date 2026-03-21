"use client";

import * as React from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  GitBranchIcon,
  GripVerticalIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import type { MateriaPrima } from "@/lib/materias-primas";
import type { ProcesoOperacionPlantilla } from "@/lib/procesos";
import { upsertProductoChecklist } from "@/lib/productos-servicios-api";
import type {
  ProductoChecklist,
  ProductoChecklistPregunta,
  ProductoChecklistRegla,
  ProductoChecklistRespuesta,
  ReglaCostoChecklist,
  TipoChecklistAccionRegla,
  TipoChecklistPregunta,
} from "@/lib/productos-servicios";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const tipoPreguntaItems: Array<{ value: TipoChecklistPregunta; label: string }> = [
  { value: "binaria", label: "Sí o no" },
  { value: "single_select", label: "Lista de opción única" },
];

const accionItems: Array<{ value: TipoChecklistAccionRegla; label: string }> = [
  { value: "activar_paso", label: "Activar paso" },
  { value: "seleccionar_variante_paso", label: "Seleccionar variante de paso" },
  { value: "costo_extra", label: "Costo extra" },
  { value: "material_extra", label: "Material extra" },
];

const reglaCostoItems: Array<{ value: ReglaCostoChecklist; label: string }> = [
  { value: "tiempo_min", label: "Tiempo (min)" },
  { value: "flat", label: "Importe fijo" },
  { value: "por_unidad", label: "Por unidad" },
  { value: "por_pliego", label: "Por pliego" },
  { value: "porcentaje_sobre_total", label: "Porcentaje sobre total" },
];

const tipoConsumoItems = [
  { value: "por_unidad", label: "Por unidad" },
  { value: "por_pliego", label: "Por pliego" },
  { value: "por_m2", label: "Por m2" },
] as const;

function normalizePreguntaRespuestasByTipo(
  pregunta: ProductoChecklistPregunta,
  tipoPregunta: TipoChecklistPregunta,
): ProductoChecklistPregunta {
  if (tipoPregunta === "binaria") {
    const yes = pregunta.respuestas[0] ?? buildDefaultRespuesta("Sí", "si");
    const no = pregunta.respuestas[1] ?? buildDefaultRespuesta("No", "no");
    return {
      ...pregunta,
      tipoPregunta,
      respuestas: [
        {
          ...yes,
          texto: "Sí",
          codigo: "si",
          orden: 1,
          activo: true,
        },
        {
          ...no,
          texto: "No",
          codigo: "no",
          orden: 2,
          activo: true,
        },
      ],
    };
  }

  return {
    ...pregunta,
    tipoPregunta,
    respuestas:
      pregunta.respuestas.length > 0
        ? pregunta.respuestas
        : [
            {
              ...buildDefaultRespuesta("", ""),
              orden: 1,
            },
          ],
  };
}

function getRespuestaTitulo(
  pregunta: ProductoChecklistPregunta,
  respuesta: ProductoChecklistRespuesta,
  respuestaIndex: number,
) {
  if (pregunta.tipoPregunta === "binaria") {
    return respuestaIndex === 0 ? "Si" : "No";
  }

  return respuesta.texto.trim() || `Opción ${respuestaIndex + 1}`;
}

function getAccionLabel(value: TipoChecklistAccionRegla) {
  return accionItems.find((item) => item.value === value)?.label ?? value;
}

function getReglaCostoLabel(value: ReglaCostoChecklist | null | undefined) {
  if (!value) return "Regla de costo";
  return reglaCostoItems.find((item) => item.value === value)?.label ?? value;
}

function getTipoConsumoLabel(value: "por_unidad" | "por_pliego" | "por_m2" | null | undefined) {
  if (!value) return "Consumo";
  return tipoConsumoItems.find((item) => item.value === value)?.label ?? value;
}

function getVarianteChecklistLabel(
  nivel: ProductoChecklistRegla["nivelesDisponibles"][number],
) {
  return nivel.resumen?.trim() || nivel.nombre;
}

function isReglaIncomplete(regla: ProductoChecklistRegla) {
  if (regla.accion === "activar_paso") {
    return !regla.pasoPlantillaId;
  }
  if (regla.accion === "seleccionar_variante_paso") {
    return !regla.pasoPlantillaId || !regla.variantePasoId;
  }
  if (regla.accion === "costo_extra") {
    return !regla.costoRegla || regla.costoValor === null;
  }
  if (regla.accion === "material_extra") {
    return !regla.materiaPrimaVarianteId || !regla.tipoConsumo || regla.factorConsumo === null;
  }
  return false;
}

function getReglaResumen(regla: ProductoChecklistRegla) {
  if (regla.accion === "activar_paso") {
    return regla.pasoPlantillaNombre || "Sin paso";
  }
  if (regla.accion === "seleccionar_variante_paso") {
    const paso = regla.pasoPlantillaNombre || "Sin paso";
    const variante = regla.variantePasoResumen || regla.variantePasoNombre || "Sin variante";
    return `${paso} · ${variante}`;
  }
  if (regla.accion === "costo_extra") {
    return `${getReglaCostoLabel(regla.costoRegla)} · ${regla.costoValor ?? 0}`;
  }
  if (regla.accion === "material_extra") {
    return `${regla.materiaPrimaNombre || "Sin material"} · ${getTipoConsumoLabel(regla.tipoConsumo)}`;
  }
  return getAccionLabel(regla.accion);
}

function buildId() {
  return crypto.randomUUID();
}

function buildCodigoRespuesta(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildDefaultRegla(accion: TipoChecklistAccionRegla): ProductoChecklistRegla {
  return {
    id: buildId(),
    accion,
    orden: 1,
    activo: true,
    pasoPlantillaId: null,
    pasoPlantillaNombre: "",
    centroCostoId: null,
    centroCostoNombre: "",
    maquinaNombre: "",
    perfilOperativoNombre: "",
    setupMin: null,
    runMin: null,
    cleanupMin: null,
    tiempoFijoMin: null,
    variantePasoId: null,
    variantePasoNombre: "",
    variantePasoResumen: "",
    nivelesDisponibles: [],
    costoRegla: accion === "costo_extra" ? "tiempo_min" : null,
    costoValor: null,
    costoCentroCostoId: null,
    costoCentroCostoNombre: "",
    materiaPrimaVarianteId: null,
    materiaPrimaNombre: "",
    materiaPrimaSku: "",
    tipoConsumo: accion === "material_extra" ? "por_unidad" : null,
    factorConsumo: null,
    mermaPct: null,
    detalle: null,
  };
}

function buildDefaultRespuesta(texto: string, codigo: string): ProductoChecklistRespuesta {
  return {
    id: buildId(),
    texto,
    codigo,
    orden: 1,
    activo: true,
    preguntaSiguienteId: null,
    reglas: [],
  };
}

function buildDefaultPregunta(): ProductoChecklistPregunta {
  return {
    id: buildId(),
    texto: "",
    tipoPregunta: "binaria",
    orden: 1,
    activo: true,
    respuestas: [buildDefaultRespuesta("Sí", "si"), buildDefaultRespuesta("No", "no")],
  };
}

function getPreguntaTitulo(pregunta: ProductoChecklistPregunta, index?: number) {
  const texto = pregunta.texto.trim();
  if (texto.length > 0) return texto;
  if (typeof index === "number") return `Pregunta ${index + 1}`;
  return "Pregunta sin texto";
}

function buildChecklistQuestionGraph(checklist: ProductoChecklist) {
  const graph = new Map<string, Set<string>>();
  for (const pregunta of checklist.preguntas) {
    for (const respuesta of pregunta.respuestas) {
      if (!respuesta.activo || !respuesta.preguntaSiguienteId) continue;
      const set = graph.get(pregunta.id) ?? new Set<string>();
      set.add(respuesta.preguntaSiguienteId);
      graph.set(pregunta.id, set);
    }
  }
  return graph;
}

function wouldCreateChecklistCycle(
  checklist: ProductoChecklist,
  preguntaId: string,
  preguntaSiguienteId: string,
) {
  if (preguntaId === preguntaSiguienteId) return true;
  const graph = buildChecklistQuestionGraph(checklist);
  const visited = new Set<string>();
  const stack = [preguntaSiguienteId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || visited.has(currentId)) continue;
    if (currentId === preguntaId) return true;
    visited.add(currentId);
    for (const nextId of graph.get(currentId) ?? []) {
      stack.push(nextId);
    }
  }

  return false;
}

function resolveReachableChecklistQuestionIds(checklist: ProductoChecklist) {
  const activeQuestions = checklist.preguntas.filter((pregunta) => pregunta.activo);
  const questionMap = new Map(activeQuestions.map((pregunta) => [pregunta.id, pregunta]));
  const referencedQuestionIds = new Set<string>();

  for (const pregunta of activeQuestions) {
    for (const respuesta of pregunta.respuestas) {
      if (!respuesta.activo || !respuesta.preguntaSiguienteId) continue;
      if (questionMap.has(respuesta.preguntaSiguienteId)) {
        referencedQuestionIds.add(respuesta.preguntaSiguienteId);
      }
    }
  }

  const queue = activeQuestions.filter((pregunta) => !referencedQuestionIds.has(pregunta.id));
  const reachable = new Set<string>();

  while (queue.length > 0) {
    const pregunta = queue.shift();
    if (!pregunta || reachable.has(pregunta.id)) continue;
    reachable.add(pregunta.id);
    for (const respuesta of pregunta.respuestas) {
      if (!respuesta.activo || !respuesta.preguntaSiguienteId) continue;
      const child = questionMap.get(respuesta.preguntaSiguienteId);
      if (child && !reachable.has(child.id)) {
        queue.push(child);
      }
    }
  }

  return reachable;
}

function collectChecklistDescendantQuestionIds(
  checklist: ProductoChecklist,
  preguntaId: string,
) {
  const questionMap = new Map(checklist.preguntas.map((pregunta) => [pregunta.id, pregunta]));
  const descendants = new Set<string>();
  const queue = [preguntaId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;
    const pregunta = questionMap.get(currentId);
    if (!pregunta) continue;
    for (const respuesta of pregunta.respuestas) {
      const childId = respuesta.preguntaSiguienteId;
      if (!childId || descendants.has(childId)) continue;
      descendants.add(childId);
      queue.push(childId);
    }
  }

  return descendants;
}

function resolveVisibleChecklistQuestionIds(
  checklist: ProductoChecklist,
  value: Record<string, { respuestaId: string }>,
) {
  const activeQuestions = checklist.preguntas.filter((pregunta) => pregunta.activo);
  const questionMap = new Map(activeQuestions.map((pregunta) => [pregunta.id, pregunta]));
  const referencedQuestionIds = new Set<string>();

  for (const pregunta of activeQuestions) {
    for (const respuesta of pregunta.respuestas) {
      if (!respuesta.activo || !respuesta.preguntaSiguienteId) continue;
      if (questionMap.has(respuesta.preguntaSiguienteId)) {
        referencedQuestionIds.add(respuesta.preguntaSiguienteId);
      }
    }
  }

  const queue = activeQuestions.filter((pregunta) => !referencedQuestionIds.has(pregunta.id));
  const visible = new Set<string>();

  while (queue.length > 0) {
    const pregunta = queue.shift();
    if (!pregunta || visible.has(pregunta.id)) continue;
    visible.add(pregunta.id);
    const selectedRespuestaId = value[pregunta.id]?.respuestaId;
    if (!selectedRespuestaId) continue;
    const selectedRespuesta = pregunta.respuestas.find(
      (respuesta) => respuesta.id === selectedRespuestaId && respuesta.activo,
    );
    if (!selectedRespuesta?.preguntaSiguienteId) continue;
    const child = questionMap.get(selectedRespuesta.preguntaSiguienteId);
    if (child && !visible.has(child.id)) {
      queue.push(child);
    }
  }

  return visible;
}

function pruneChecklistSelections(
  checklist: ProductoChecklist,
  value: Record<string, { respuestaId: string }>,
) {
  const visibleQuestionIds = resolveVisibleChecklistQuestionIds(checklist, value);
  const nextEntries = Object.entries(value).filter(([preguntaId]) => visibleQuestionIds.has(preguntaId));
  if (nextEntries.length === Object.keys(value).length) {
    return value;
  }
  return Object.fromEntries(nextEntries);
}

function buildChecklistQuestionDependencyMeta(checklist: ProductoChecklist) {
  const meta = new Map<
    string,
    {
      parentQuestionId: string;
      parentQuestionTitle: string;
      parentResponseText: string;
    }
  >();

  for (const pregunta of checklist.preguntas) {
    const parentQuestionTitle = getPreguntaTitulo(
      pregunta,
      checklist.preguntas.findIndex((item) => item.id === pregunta.id),
    );
    for (const respuesta of pregunta.respuestas) {
      const childId = respuesta.preguntaSiguienteId;
      if (!childId || meta.has(childId)) continue;
      meta.set(childId, {
        parentQuestionId: pregunta.id,
        parentQuestionTitle,
        parentResponseText: respuesta.texto.trim() || getRespuestaTitulo(pregunta, respuesta, 0),
      });
    }
  }

  return meta;
}

function buildReglaActivarPasoPorVariante(
  selected: {
    id: string;
    label: string;
    centroCostoId: string | null;
    centroCostoNombre: string;
    niveles: ProductoChecklistRegla["nivelesDisponibles"];
  },
  variante: ProductoChecklistRegla["nivelesDisponibles"][number],
): ProductoChecklistRegla {
  return {
    ...buildDefaultRegla("seleccionar_variante_paso"),
    pasoPlantillaId: selected.id,
    pasoPlantillaNombre: selected.label,
    centroCostoId: selected.centroCostoId,
    centroCostoNombre: selected.centroCostoNombre,
    nivelesDisponibles: selected.niveles,
    variantePasoId: variante.id,
    variantePasoNombre: variante.nombre,
    variantePasoResumen: variante.resumen ?? "",
  };
}

function buildPreguntaRespuestasPorVariantes(
  pregunta: ProductoChecklistPregunta,
  selected: {
    id: string;
    label: string;
    centroCostoId: string | null;
    centroCostoNombre: string;
    niveles: ProductoChecklistRegla["nivelesDisponibles"];
  },
  variantes: ProductoChecklistRegla["nivelesDisponibles"],
): ProductoChecklistPregunta {
  const activas = variantes
    .filter((item) => item.activo)
    .sort((a, b) => a.orden - b.orden);

  return {
    ...pregunta,
    tipoPregunta: "single_select",
    respuestas: activas.map((variante, index) => ({
      id: buildId(),
      texto: variante.nombre || `Opción ${index + 1}`,
      codigo: buildCodigoRespuesta(variante.nombre || `opcion_${index + 1}`),
      orden: index + 1,
      activo: true,
      preguntaSiguienteId: null,
      reglas: [buildReglaActivarPasoPorVariante(selected, variante)],
    })),
  };
}

function getRequiredTipoPreguntaForVariantes(count: number): TipoChecklistPregunta | null {
  if (count >= 3) {
    return "single_select";
  }
  return null;
}

function normalizeChecklistForSave(checklist: ProductoChecklist) {
  return {
    activo: true,
    preguntas: checklist.preguntas.map((pregunta, preguntaIndex) => ({
      id: pregunta.id,
      texto: pregunta.texto.trim(),
      tipoPregunta: pregunta.tipoPregunta,
      orden: preguntaIndex + 1,
      activo: pregunta.activo,
      respuestas: pregunta.respuestas.map((respuesta, respuestaIndex) => ({
        id: respuesta.id,
        texto: respuesta.texto.trim(),
        codigo: respuesta.codigo?.trim() || undefined,
        orden: respuestaIndex + 1,
        activo: respuesta.activo,
        preguntaSiguienteId: respuesta.preguntaSiguienteId || undefined,
        reglas: respuesta.reglas.map((regla, reglaIndex) => ({
          id: regla.id,
          accion: regla.accion,
          orden: reglaIndex + 1,
          activo: regla.activo,
          pasoPlantillaId: regla.pasoPlantillaId || undefined,
          variantePasoId: regla.variantePasoId || undefined,
          costoRegla: regla.costoRegla || undefined,
          costoValor: regla.costoValor ?? undefined,
          costoCentroCostoId: regla.costoCentroCostoId || undefined,
          materiaPrimaVarianteId: regla.materiaPrimaVarianteId || undefined,
          tipoConsumo: regla.tipoConsumo || undefined,
          factorConsumo: regla.factorConsumo ?? undefined,
          mermaPct: regla.mermaPct ?? undefined,
          detalle: regla.detalle ?? undefined,
        })),
      })),
    })),
  };
}

type ChecklistEditorProps = {
  productoId: string;
  initialChecklist: ProductoChecklist;
  plantillasPaso: ProcesoOperacionPlantilla[];
  materiasPrimas: MateriaPrima[];
  routeStepOptions: Array<{ id: string; label: string }>;
  onSaved: (checklist: ProductoChecklist) => void;
};

type RouteInsertionMode = "append" | "before_step" | "after_step";

type ChecklistRoutePreviewItem =
  | {
      key: string;
      kind: "base";
      stepId: string;
      label: string;
    }
  | {
      key: string;
      kind: "optional";
      stepId: string;
      label: string;
      questionLabels: string[];
      responseLabels: string[];
      ruleCount: number;
      insertion: { modo: RouteInsertionMode; pasoPlantillaId: string | null; orden: number | null };
    };

function getReglaRouteInsertion(
  regla: ProductoChecklistRegla,
): { modo: RouteInsertionMode; pasoPlantillaId: string | null; orden: number | null } {
  const detalle =
    regla.detalle && typeof regla.detalle === "object" && !Array.isArray(regla.detalle)
      ? (regla.detalle as Record<string, unknown>)
      : {};
  const raw =
    detalle.routeInsertion && typeof detalle.routeInsertion === "object" && !Array.isArray(detalle.routeInsertion)
      ? (detalle.routeInsertion as Record<string, unknown>)
      : {};
  const modo =
    raw.modo === "before_step" || raw.modo === "after_step" ? raw.modo : "append";
  const pasoPlantillaId =
    typeof raw.pasoPlantillaId === "string" && raw.pasoPlantillaId.trim().length
      ? raw.pasoPlantillaId.trim()
      : null;
  const orden =
    typeof raw.orden === "number" && Number.isFinite(raw.orden) ? raw.orden : null;
  return { modo, pasoPlantillaId, orden };
}

function patchReglaRouteInsertion(
  regla: ProductoChecklistRegla,
  patch: Partial<{ modo: RouteInsertionMode; pasoPlantillaId: string | null; orden: number | null }>,
): ProductoChecklistRegla {
  const current = getReglaRouteInsertion(regla);
  const next = { ...current, ...patch };
  if (next.modo === "append") {
    next.pasoPlantillaId = null;
  }
  const detalle =
    regla.detalle && typeof regla.detalle === "object" && !Array.isArray(regla.detalle)
      ? { ...(regla.detalle as Record<string, unknown>) }
      : {};
  detalle.routeInsertion = next;
  return {
    ...regla,
    detalle,
  };
}

function sanitizeRouteInsertionForStep(
  stepId: string,
  insertion: { modo: RouteInsertionMode; pasoPlantillaId: string | null; orden: number | null },
) {
  if (
    (insertion.modo === "before_step" || insertion.modo === "after_step") &&
    insertion.pasoPlantillaId === stepId
  ) {
    return {
      modo: "append" as RouteInsertionMode,
      pasoPlantillaId: null,
      orden: insertion.orden,
    };
  }
  return insertion;
}

function normalizeChecklistRouteInsertions(checklist: ProductoChecklist) {
  const canonicalByStepId = new Map<
    string,
    { modo: RouteInsertionMode; pasoPlantillaId: string | null; orden: number | null }
  >();

  for (const pregunta of checklist.preguntas) {
    for (const respuesta of pregunta.respuestas) {
      for (const regla of respuesta.reglas) {
        if (!isStepRule(regla) || !regla.pasoPlantillaId) continue;
        const candidate = sanitizeRouteInsertionForStep(
          regla.pasoPlantillaId,
          getReglaRouteInsertion(regla),
        );
        const current = canonicalByStepId.get(regla.pasoPlantillaId);
        if (!current) {
          canonicalByStepId.set(regla.pasoPlantillaId, candidate);
          continue;
        }
        const currentOrden = current.orden ?? Number.MAX_SAFE_INTEGER;
        const candidateOrden = candidate.orden ?? Number.MAX_SAFE_INTEGER;
        if (candidateOrden < currentOrden) {
          canonicalByStepId.set(regla.pasoPlantillaId, candidate);
        }
      }
    }
  }

  return {
    ...checklist,
    preguntas: checklist.preguntas.map((pregunta) => ({
      ...pregunta,
      respuestas: pregunta.respuestas.map((respuesta) => ({
        ...respuesta,
        reglas: respuesta.reglas.map((regla) => {
          if (!isStepRule(regla) || !regla.pasoPlantillaId) {
            return regla;
          }
          const canonical = canonicalByStepId.get(regla.pasoPlantillaId);
          if (!canonical) {
            return regla;
          }
          return patchReglaRouteInsertion(regla, canonical);
        }),
      })),
    })),
  };
}

function isStepRule(regla: ProductoChecklistRegla) {
  return regla.accion === "activar_paso" || regla.accion === "seleccionar_variante_paso";
}

export function ProductoServicioChecklistEditor({
  productoId,
  initialChecklist,
  plantillasPaso,
  materiasPrimas,
  routeStepOptions,
  onSaved,
}: ChecklistEditorProps) {
  const [draft, setDraft] = React.useState<ProductoChecklist>(initialChecklist);
  const [isSaving, startSaving] = React.useTransition();
  const [preguntasAbiertas, setPreguntasAbiertas] = React.useState<Record<string, boolean>>({});
  const [reglasAbiertas, setReglasAbiertas] = React.useState<Record<string, boolean>>({});
  const [draggedRouteItemKey, setDraggedRouteItemKey] = React.useState<string | null>(null);
  const [pointerDraggingRouteItemKey, setPointerDraggingRouteItemKey] = React.useState<string | null>(null);
  const [routeDropIndicator, setRouteDropIndicator] = React.useState<{
    targetKey: string;
    position: "before" | "after";
  } | null>(null);

  React.useEffect(() => {
    setDraft(normalizeChecklistRouteInsertions(initialChecklist));
    setPreguntasAbiertas(
      Object.fromEntries(initialChecklist.preguntas.map((pregunta) => [pregunta.id, true])),
    );
    setReglasAbiertas({});
  }, [initialChecklist]);

  const operaciones = React.useMemo(
    () =>
      plantillasPaso
        .filter((plantilla) => plantilla.activo)
        .map((plantilla) => ({
          id: plantilla.id,
          label: plantilla.nombre,
          centroCostoId: plantilla.centroCostoId || null,
          centroCostoNombre: plantilla.centroCostoNombre || "",
          niveles: plantilla.niveles ?? [],
        })),
    [plantillasPaso],
  );

  const centrosCosto = React.useMemo(() => {
    const map = new Map<string, { id: string; nombre: string }>();
    for (const operacion of operaciones) {
      if (!operacion.centroCostoId) continue;
      map.set(operacion.centroCostoId, {
        id: operacion.centroCostoId,
        nombre: operacion.centroCostoNombre,
      });
    }
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [operaciones]);

  const materiales = React.useMemo(
    () =>
      materiasPrimas.flatMap((materiaPrima) =>
        materiaPrima.variantes.map((variante) => ({
          id: variante.id,
          label: `${materiaPrima.nombre} · ${variante.sku}`,
        })),
      ),
    [materiasPrimas],
  );

  const isDirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initialChecklist),
    [draft, initialChecklist],
  );

  const reachableQuestionIds = React.useMemo(() => resolveReachableChecklistQuestionIds(draft), [draft]);
  const questionDependencyMeta = React.useMemo(
    () => buildChecklistQuestionDependencyMeta(draft),
    [draft],
  );

  const updatePregunta = (preguntaId: string, updater: (pregunta: ProductoChecklistPregunta) => ProductoChecklistPregunta) => {
    setDraft((prev) => ({
      ...prev,
      preguntas: prev.preguntas.map((pregunta) => (pregunta.id === preguntaId ? updater(pregunta) : pregunta)),
    }));
  };

  const updateRespuesta = (
    preguntaId: string,
    respuestaId: string,
    updater: (respuesta: ProductoChecklistRespuesta) => ProductoChecklistRespuesta,
  ) => {
    updatePregunta(preguntaId, (pregunta) => ({
      ...pregunta,
      respuestas: pregunta.respuestas.map((respuesta) =>
        respuesta.id === respuestaId ? updater(respuesta) : respuesta,
      ),
    }));
  };

  const updateRegla = (
    preguntaId: string,
    respuestaId: string,
    reglaId: string,
    updater: (regla: ProductoChecklistRegla) => ProductoChecklistRegla,
  ) => {
    updateRespuesta(preguntaId, respuestaId, (respuesta) => ({
      ...respuesta,
      reglas: respuesta.reglas.map((regla) => (regla.id === reglaId ? updater(regla) : regla)),
    }));
  };

  const togglePregunta = (preguntaId: string) => {
    setPreguntasAbiertas((prev) => ({
      ...prev,
      [preguntaId]: !(prev[preguntaId] ?? true),
    }));
  };

  const createChildQuestion = (preguntaId: string, respuestaId: string) => {
    const nuevaPregunta = {
      ...buildDefaultPregunta(),
      texto: "Nueva pregunta hija",
    };

    setDraft((prev) => {
      const parentIndex = prev.preguntas.findIndex((item) => item.id === preguntaId);
      const preguntas = [...prev.preguntas];
      const insertIndex = parentIndex >= 0 ? parentIndex + 1 : preguntas.length;
      preguntas.splice(insertIndex, 0, nuevaPregunta);

      return {
        ...prev,
        preguntas: preguntas.map((pregunta, index) => {
          if (pregunta.id !== preguntaId) {
            return { ...pregunta, orden: index + 1 };
          }
          return {
            ...pregunta,
            orden: index + 1,
            respuestas: pregunta.respuestas.map((respuesta) =>
              respuesta.id === respuestaId
                ? { ...respuesta, preguntaSiguienteId: nuevaPregunta.id }
                : respuesta,
            ),
          };
        }),
      };
    });

    setPreguntasAbiertas((prev) => ({
      ...prev,
      [preguntaId]: true,
      [nuevaPregunta.id]: true,
    }));
  };

  const handleSave = () => {
    startSaving(async () => {
      try {
        const normalizedDraft = normalizeChecklistRouteInsertions(draft);
        const saved = await upsertProductoChecklist(
          productoId,
          normalizeChecklistForSave(normalizedDraft),
        );
        const normalizedSaved = normalizeChecklistRouteInsertions(saved);
        setDraft(normalizedSaved);
        onSaved(normalizedSaved);
        toast.success("Configurador guardado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar el configurador.");
      }
    });
  };

  const routePreviewItems = React.useMemo<ChecklistRoutePreviewItem[]>(() => {
    const aggregated = new Map<
      string,
      Extract<ChecklistRoutePreviewItem, { kind: "optional" }>
    >();
    for (const pregunta of draft.preguntas) {
      if (!reachableQuestionIds.has(pregunta.id)) continue;
      for (const respuesta of pregunta.respuestas) {
        for (const regla of respuesta.reglas) {
          if (!isStepRule(regla) || !regla.pasoPlantillaId) continue;
          const questionLabel = pregunta.texto.trim() || "Pregunta sin texto";
          const responseLabel = respuesta.texto.trim() || "Opción sin texto";
          const existing = aggregated.get(regla.pasoPlantillaId);
          if (existing) {
            if (!existing.questionLabels.includes(questionLabel)) {
              existing.questionLabels.push(questionLabel);
            }
            if (!existing.responseLabels.includes(responseLabel)) {
              existing.responseLabels.push(responseLabel);
            }
            existing.ruleCount += 1;
            if (existing.insertion.orden === null) {
              existing.insertion = getReglaRouteInsertion(regla);
            }
            continue;
          }
          aggregated.set(regla.pasoPlantillaId, {
            key: `optional:${regla.pasoPlantillaId}`,
            kind: "optional",
            stepId: regla.pasoPlantillaId,
            label:
              regla.pasoPlantillaNombre ||
              operaciones.find((item) => item.id === regla.pasoPlantillaId)?.label ||
              "Paso opcional",
            questionLabels: [questionLabel],
            responseLabels: [responseLabel],
            ruleCount: 1,
            insertion: getReglaRouteInsertion(regla),
          });
        }
      }
    }

    const ordered: ChecklistRoutePreviewItem[] = routeStepOptions.map((item) => ({
      key: `base:${item.id}`,
      kind: "base",
      stepId: item.id,
      label: item.label,
    }));

    const optionalItems = Array.from(aggregated.values()).sort((a, b) => {
      const ordenA = a.insertion.orden ?? Number.MAX_SAFE_INTEGER;
      const ordenB = b.insertion.orden ?? Number.MAX_SAFE_INTEGER;
      if (ordenA !== ordenB) return ordenA - ordenB;
      return a.label.localeCompare(b.label);
    });

    for (const item of optionalItems) {
      let insertIndex = ordered.length;
      const anchorIndex =
        item.insertion.pasoPlantillaId
          ? ordered.findIndex((entry) => entry.stepId === item.insertion.pasoPlantillaId)
          : -1;
      if (item.insertion.modo === "before_step" && anchorIndex >= 0) {
        insertIndex = anchorIndex;
      } else if (item.insertion.modo === "after_step" && anchorIndex >= 0) {
        insertIndex = anchorIndex + 1;
      }
      ordered.splice(insertIndex, 0, item);
    }

    return ordered;
  }, [draft.preguntas, operaciones, reachableQuestionIds, routeStepOptions]);

  const applyPreviewOrder = (nextPreviewItems: ChecklistRoutePreviewItem[]) => {
    const nextConfigs = new Map<
      string,
      { modo: RouteInsertionMode; pasoPlantillaId: string | null; orden: number }
    >();
    let optionalOrder = 1;

    for (let index = 0; index < nextPreviewItems.length; index += 1) {
      const item = nextPreviewItems[index];
      if (item.kind !== "optional") continue;

      const previous = nextPreviewItems.slice(0, index).reverse().find((entry) => entry.stepId);
      if (previous) {
        nextConfigs.set(item.stepId, {
          modo: "after_step",
          pasoPlantillaId: previous.stepId,
          orden: optionalOrder,
        });
      } else {
        const nextBase = nextPreviewItems
          .slice(index + 1)
          .find((entry): entry is Extract<ChecklistRoutePreviewItem, { kind: "base" }> => entry.kind === "base");
        nextConfigs.set(item.stepId, {
          modo: nextBase ? "before_step" : "append",
          pasoPlantillaId: nextBase?.stepId ?? null,
          orden: optionalOrder,
        });
      }

      optionalOrder += 1;
    }

    setDraft((prev) => ({
      ...prev,
      preguntas: prev.preguntas.map((pregunta) => ({
        ...pregunta,
        respuestas: pregunta.respuestas.map((respuesta) => ({
          ...respuesta,
          reglas: respuesta.reglas.map((regla) => {
            if (!isStepRule(regla) || !regla.pasoPlantillaId) {
              return regla;
            }
            const config = nextConfigs.get(regla.pasoPlantillaId);
            if (!config) {
              return regla;
            }
            return {
              ...patchReglaRouteInsertion(regla, config),
              orden: config.orden,
            };
          }),
        })),
      })),
    }));
  };

  const moveRoutePreviewItem = (
    draggedItemKey: string,
    targetKey: string,
    position: "before" | "after",
  ) => {
    const currentOptional = routePreviewItems.find(
      (item): item is Extract<ChecklistRoutePreviewItem, { kind: "optional" }> =>
        item.kind === "optional" && item.key === draggedItemKey,
    );
    if (!currentOptional) return;
    const withoutDragged = routePreviewItems.filter(
      (item) => item.key !== draggedItemKey,
    );
    const targetIndex = withoutDragged.findIndex((item) => item.key === targetKey);
    if (targetIndex === -1) return;
    const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
    const next = [...withoutDragged];
    next.splice(insertIndex, 0, currentOptional);
    applyPreviewOrder(next);
  };

  const getPreviewPointerPosition = (
    event: React.PointerEvent<HTMLDivElement>,
  ): "before" | "after" => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY - bounds.top < bounds.height / 2 ? "before" : "after";
  };

  React.useEffect(() => {
    if (!pointerDraggingRouteItemKey) return;
    const clear = () => {
      if (
        pointerDraggingRouteItemKey &&
        routeDropIndicator &&
        routeDropIndicator.targetKey !== "__end__"
      ) {
        moveRoutePreviewItem(
          pointerDraggingRouteItemKey,
          routeDropIndicator.targetKey,
          routeDropIndicator.position,
        );
      } else if (pointerDraggingRouteItemKey && routeDropIndicator?.targetKey === "__end__") {
        const withoutDragged = routePreviewItems.filter(
          (item) => item.key !== pointerDraggingRouteItemKey,
        );
        const draggedItem = routePreviewItems.find(
          (item): item is Extract<ChecklistRoutePreviewItem, { kind: "optional" }> =>
            item.kind === "optional" && item.key === pointerDraggingRouteItemKey,
        );
        if (draggedItem) {
          applyPreviewOrder([...withoutDragged, draggedItem]);
        }
      }
      setPointerDraggingRouteItemKey(null);
      setRouteDropIndicator(null);
    };
    window.addEventListener("pointerup", clear);
    window.addEventListener("pointercancel", clear);
    return () => {
      window.removeEventListener("pointerup", clear);
      window.removeEventListener("pointercancel", clear);
    };
  }, [applyPreviewOrder, moveRoutePreviewItem, pointerDraggingRouteItemKey, routeDropIndicator, routePreviewItems]);

  const renderRuleControls = (
    pregunta: ProductoChecklistPregunta,
    respuesta: ProductoChecklistRespuesta,
    regla: ProductoChecklistRegla,
    compact = false,
  ) => {
    if (regla.accion === "activar_paso" || regla.accion === "seleccionar_variante_paso") {
      return (
        <div className="grid gap-2">
          <div className={cn("grid gap-2", regla.accion === "seleccionar_variante_paso" ? "md:grid-cols-2" : "md:grid-cols-1")}>
          <div className="grid gap-1">
            {!compact ? <FieldLabel>Paso</FieldLabel> : null}
            <Select
              value={regla.pasoPlantillaId ?? "__none__"}
              onValueChange={(value) => {
                const selected = operaciones.find((item) => item.id === value);
                const variantes = selected?.niveles ?? [];
                const varianteDefault = variantes.find((item) => item.activo)?.id ?? null;
                const forcedTipoPregunta = getRequiredTipoPreguntaForVariantes(
                  variantes.filter((item) => item.activo).length,
                );
                if (selected && forcedTipoPregunta === "single_select") {
                  toast.info("Este paso tiene 3 o más variantes. Se generó una opción por variante.");
                  updatePregunta(
                    pregunta.id,
                    (current) => buildPreguntaRespuestasPorVariantes(current, selected, variantes),
                  );
                  return;
                }
                updateRegla(pregunta.id, respuesta.id, regla.id, (current) => ({
                  ...current,
                  pasoPlantillaId: value === "__none__" ? null : value,
                  pasoPlantillaNombre: selected?.label ?? "",
                  centroCostoId: selected?.centroCostoId ?? null,
                  centroCostoNombre: selected?.centroCostoNombre ?? "",
                  nivelesDisponibles: variantes,
                  variantePasoId:
                    current.accion === "seleccionar_variante_paso" && variantes.length
                      ? varianteDefault
                      : null,
                  variantePasoNombre:
                    current.accion === "seleccionar_variante_paso"
                      ? variantes.find((item) => item.id === varianteDefault)?.nombre ?? ""
                      : "",
                  variantePasoResumen:
                    current.accion === "seleccionar_variante_paso"
                      ? variantes.find((item) => item.id === varianteDefault)?.resumen ?? ""
                      : "",
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Paso">
                  {regla.pasoPlantillaId
                    ? operaciones.find((item) => item.id === regla.pasoPlantillaId)?.label ??
                      regla.pasoPlantillaNombre ??
                      "Paso de biblioteca"
                    : "Sin paso"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin paso</SelectItem>
                {operaciones.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
              </Select>
            </div>
          {regla.accion === "seleccionar_variante_paso" ? (
            <div className="grid gap-1">
              {!compact ? <FieldLabel>Variante</FieldLabel> : null}
              <Select
                value={regla.variantePasoId ?? "__none__"}
                onValueChange={(value) =>
                  updateRegla(pregunta.id, respuesta.id, regla.id, (current) => {
                    const variante =
                      current.nivelesDisponibles.find((item) => item.id === value) ?? null;
                    return {
                      ...current,
                      variantePasoId: value === "__none__" ? null : value,
                      variantePasoNombre: variante?.nombre ?? "",
                      variantePasoResumen: variante?.resumen ?? "",
                    };
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Variante">
                    {regla.variantePasoId
                      ? regla.nivelesDisponibles.find((item) => item.id === regla.variantePasoId)?.resumen ??
                        regla.variantePasoResumen ??
                        "Variante"
                      : "Selecciona variante"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin variante</SelectItem>
                  {regla.nivelesDisponibles
                    .filter((item) => item.activo)
                    .sort((a, b) => a.orden - b.orden)
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {getVarianteChecklistLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
              </Select>
            </div>
          ) : null}
          </div>
        </div>
      );
    }

    if (regla.accion === "costo_extra") {
      return (
        <div className="grid gap-2 md:grid-cols-3">
          <div className="grid gap-1">
            {!compact ? <FieldLabel>Regla de costo</FieldLabel> : null}
            <Select
              value={regla.costoRegla ?? "tiempo_min"}
              onValueChange={(value) =>
                updateRegla(pregunta.id, respuesta.id, regla.id, (current) => ({
                  ...current,
                  costoRegla: (value as ReglaCostoChecklist) ?? "tiempo_min",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Regla">{getReglaCostoLabel(regla.costoRegla)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {reglaCostoItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            {!compact ? <FieldLabel>Valor</FieldLabel> : null}
            <Input
              type="number"
              min="0"
              step="0.01"
              aria-label="Valor"
              placeholder="Valor"
              value={regla.costoValor ?? ""}
              onChange={(event) =>
                updateRegla(pregunta.id, respuesta.id, regla.id, (current) => ({
                  ...current,
                  costoValor: Number(event.target.value || 0),
                }))
              }
            />
          </div>
          <div className="grid gap-1">
            {!compact ? <FieldLabel>Centro</FieldLabel> : null}
            <Select
              value={regla.costoCentroCostoId ?? "__none__"}
              onValueChange={(value) => {
                const selected = centrosCosto.find((item) => item.id === value);
                updateRegla(pregunta.id, respuesta.id, regla.id, (current) => ({
                  ...current,
                  costoCentroCostoId: value === "__none__" ? null : value,
                  costoCentroCostoNombre: selected?.nombre ?? "",
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Centro">
                  {regla.costoCentroCostoId
                    ? centrosCosto.find((item) => item.id === regla.costoCentroCostoId)?.nombre ??
                      regla.costoCentroCostoNombre ??
                      "Centro de costo"
                    : "Sin centro"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin centro</SelectItem>
                {centrosCosto.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-2 md:grid-cols-4">
        <div className="grid gap-1 md:col-span-2">
          {!compact ? <FieldLabel>Materia prima</FieldLabel> : null}
          <Select
            value={regla.materiaPrimaVarianteId ?? "__none__"}
            onValueChange={(value) => {
              const selected = materiales.find((item) => item.id === value);
              updateRegla(pregunta.id, respuesta.id, regla.id, (current) => ({
                ...current,
                materiaPrimaVarianteId: value === "__none__" ? null : value,
                materiaPrimaNombre: selected?.label ?? "",
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Materia prima">
                {regla.materiaPrimaVarianteId
                  ? materiales.find((item) => item.id === regla.materiaPrimaVarianteId)?.label ??
                    regla.materiaPrimaNombre ??
                    "Materia prima"
                  : "Sin material"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin material</SelectItem>
              {materiales.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          {!compact ? <FieldLabel>Consumo</FieldLabel> : null}
          <Select
            value={regla.tipoConsumo ?? "por_unidad"}
            onValueChange={(value) =>
              updateRegla(pregunta.id, respuesta.id, regla.id, (current) => ({
                ...current,
                tipoConsumo: value as "por_unidad" | "por_pliego" | "por_m2",
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Consumo">
                {getTipoConsumoLabel(regla.tipoConsumo)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {tipoConsumoItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          {!compact ? <FieldLabel>Factor</FieldLabel> : null}
          <Input
            type="number"
            min="0"
            step="0.0001"
            aria-label="Factor"
            placeholder="Factor"
            value={regla.factorConsumo ?? ""}
            onChange={(event) =>
              updateRegla(pregunta.id, respuesta.id, regla.id, (current) => ({
                ...current,
                factorConsumo: Number(event.target.value || 0),
              }))
            }
          />
        </div>
        <div className="grid gap-1">
          {!compact ? <FieldLabel>Merma %</FieldLabel> : null}
          <Input
            type="number"
            min="0"
            step="0.01"
            aria-label="Merma"
            placeholder="Merma %"
            value={regla.mermaPct ?? ""}
            onChange={(event) =>
              updateRegla(pregunta.id, respuesta.id, regla.id, (current) => ({
                ...current,
                mermaPct: Number(event.target.value || 0),
              }))
            }
          />
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
      <div className="space-y-4">
        {draft.preguntas.map((pregunta, preguntaIndex) => {
        const dependencyMeta = questionDependencyMeta.get(pregunta.id) ?? null;
        return (
        <div
          key={pregunta.id}
          className={cn("relative", dependencyMeta ? "ml-8 pl-6" : "")}
        >
          {dependencyMeta ? (
            <>
              <div className="absolute left-2 top-0 bottom-5 w-px rounded-full bg-orange-200" />
              <div className="absolute left-2 top-10 h-px w-4 bg-orange-200" />
              <div className="absolute left-0 top-8 size-4 rounded-full border-2 border-orange-500 bg-background shadow-sm" />
            </>
          ) : null}
        <div
          className={cn(
            "overflow-hidden rounded-lg border",
            dependencyMeta ? "border-orange-200 bg-orange-50/20" : "",
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
            <button
              type="button"
              className="flex flex-1 items-center gap-2 text-left"
              onClick={() => togglePregunta(pregunta.id)}
            >
              {preguntasAbiertas[pregunta.id] ?? true ? (
                <ChevronDownIcon className="size-4 text-muted-foreground" />
              ) : (
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Pregunta {preguntaIndex + 1}</p>
                  {dependencyMeta ? (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                      Pregunta hija
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pregunta.texto.trim() || "Sin texto todavía"}
                </p>
                {dependencyMeta ? (
                  <p className="mt-1 text-[11px] text-orange-700/90">
                    Se muestra si: {dependencyMeta.parentQuestionTitle} → {dependencyMeta.parentResponseText}
                  </p>
                ) : null}
              </div>
            </button>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() =>
                  setDraft((prev) => {
                    const descendantIds = collectChecklistDescendantQuestionIds(prev, pregunta.id);
                    const idsToRemove = new Set([pregunta.id, ...descendantIds]);
                    return {
                      ...prev,
                      preguntas: prev.preguntas
                        .filter((item) => !idsToRemove.has(item.id))
                        .map((item) => ({
                          ...item,
                          respuestas: item.respuestas.map((respuesta) =>
                            respuesta.preguntaSiguienteId && idsToRemove.has(respuesta.preguntaSiguienteId)
                              ? { ...respuesta, preguntaSiguienteId: null }
                              : respuesta,
                          ),
                        })),
                    };
                  })
                }
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          </div>

          {(preguntasAbiertas[pregunta.id] ?? true) ? (
            <div className="space-y-4 p-4">
              <div className="grid gap-3 rounded-md border bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_220px_140px] md:items-end">
                <Field>
                  <FieldLabel>Pregunta</FieldLabel>
                  <Input
                    value={pregunta.texto}
                    onChange={(event) =>
                      updatePregunta(pregunta.id, (current) => ({ ...current, texto: event.target.value }))
                    }
                    placeholder="¿Cuál es la pregunta?"
                  />
                </Field>
                <Field>
                  <FieldLabel>Tipo</FieldLabel>
                  <Select
                    value={pregunta.tipoPregunta}
                    onValueChange={(value) =>
                      updatePregunta(
                        pregunta.id,
                        (current) =>
                          normalizePreguntaRespuestasByTipo(
                            current,
                            (value as TipoChecklistPregunta) ?? "binaria",
                          ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {tipoPreguntaItems.find((item) => item.value === pregunta.tipoPregunta)?.label ?? "Tipo de respuesta"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {tipoPreguntaItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2 md:justify-center md:gap-2">
                  <span className="text-sm text-muted-foreground">Activa</span>
                  <Switch
                    checked={pregunta.activo}
                    onCheckedChange={(checked) =>
                      updatePregunta(pregunta.id, (current) => ({ ...current, activo: Boolean(checked) }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Respuestas</p>
                    {!reachableQuestionIds.has(pregunta.id) ? (
                      <p className="text-xs text-muted-foreground">
                        Esta pregunta no se activa desde ninguna respuesta anterior.
                      </p>
                    ) : null}
                  </div>
                  {pregunta.tipoPregunta === "single_select" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        updatePregunta(pregunta.id, (current) => ({
                          ...current,
                          respuestas: [
                            ...current.respuestas,
                            {
                              ...buildDefaultRespuesta("", ""),
                              orden: current.respuestas.length + 1,
                            },
                          ],
                        }))
                      }
                    >
                      <PlusIcon className="size-4" />
                      Agregar opción
                    </Button>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[240px] text-xs uppercase tracking-wide text-muted-foreground">Respuesta</TableHead>
                        <TableHead className="w-[360px] text-xs uppercase tracking-wide text-muted-foreground">Acción</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Configuración</TableHead>
                        <TableHead className="w-[96px] text-right text-xs uppercase tracking-wide text-muted-foreground">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                  {pregunta.respuestas.map((respuesta, respuestaIndex) => {
                      const reglaPrincipal = respuesta.reglas[0] ?? null;
                      const reglasSecundarias = respuesta.reglas.slice(1);
                      const childQuestion = respuesta.preguntaSiguienteId
                        ? draft.preguntas.find((item) => item.id === respuesta.preguntaSiguienteId) ?? null
                        : null;
                      const childQuestionOptions = draft.preguntas
                        .filter((item) => item.id !== pregunta.id)
                        .filter(
                          (item) =>
                            item.id === respuesta.preguntaSiguienteId ||
                            !wouldCreateChecklistCycle(draft, pregunta.id, item.id),
                        )
                        .sort((a, b) => a.orden - b.orden);
                      return (
                      <React.Fragment key={respuesta.id}>
                        <TableRow className="hover:bg-transparent">
                          <TableCell className="align-top">
                            {pregunta.tipoPregunta === "binaria" ? (
                              <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm font-medium">
                                  {getRespuestaTitulo(pregunta, respuesta, respuestaIndex)}
                              </div>
                            ) : (
                              <Input
                                aria-label="Respuesta"
                                value={respuesta.texto}
                                onChange={(event) =>
                                  updateRespuesta(pregunta.id, respuesta.id, (current) => ({
                                    ...current,
                                    texto: event.target.value,
                                  }))
                                }
                                placeholder="Texto de opción"
                              />
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            {reglaPrincipal ? (
                              <Select
                                value={reglaPrincipal.accion}
                                onValueChange={(value) =>
                                  updateRegla(pregunta.id, respuesta.id, reglaPrincipal.id, () =>
                                    buildDefaultRegla((value as TipoChecklistAccionRegla) ?? "activar_paso"),
                                  )
                                }
                              >
                                <SelectTrigger className="w-full min-w-0">
                                  <SelectValue>{getAccionLabel(reglaPrincipal.accion)}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {accionItems.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="h-10 rounded-md border border-dashed bg-muted/10" />
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-2">
                              {reglaPrincipal ? (
                                <div>{renderRuleControls(pregunta, respuesta, reglaPrincipal, true)}</div>
                              ) : (
                                <div className="flex h-10 items-center text-sm text-muted-foreground">
                                  Sin acción principal
                                </div>
                              )}
                              {childQuestion ? (
                                <p className="text-[11px] text-muted-foreground">
                                  Abre:{" "}
                                  {getPreguntaTitulo(
                                    childQuestion,
                                    draft.preguntas.findIndex((item) => item.id === childQuestion.id),
                                  )}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex items-start justify-end gap-1">
                              <DropdownMenu>
                                <Tooltip>
                                  <TooltipTrigger render={
                                    <DropdownMenuTrigger
                                      render={
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          aria-label="Configurar pregunta hija"
                                          title="Configurar pregunta hija"
                                          className={cn(
                                            childQuestion ? "text-orange-600" : "text-muted-foreground",
                                          )}
                                        >
                                          <GitBranchIcon className="size-4" />
                                        </Button>
                                      }
                                    />
                                  } />
                                  <TooltipContent>
                                    {childQuestion ? "Editar pregunta hija" : "Vincular pregunta hija"}
                                  </TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent align="end" className="w-72">
                                  <DropdownMenuGroup>
                                    <DropdownMenuLabel>Pregunta siguiente</DropdownMenuLabel>
                                  </DropdownMenuGroup>
                                  <DropdownMenuItem
                                    onClick={() => createChildQuestion(pregunta.id, respuesta.id)}
                                  >
                                    Crear pregunta hija
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuGroup>
                                    <DropdownMenuLabel>Vincular pregunta existente</DropdownMenuLabel>
                                  </DropdownMenuGroup>
                                  <DropdownMenuRadioGroup
                                    value={respuesta.preguntaSiguienteId ?? "__none__"}
                                    onValueChange={(value) =>
                                      updateRespuesta(pregunta.id, respuesta.id, (current) => ({
                                        ...current,
                                        preguntaSiguienteId: value === "__none__" ? null : value,
                                      }))
                                    }
                                  >
                                    <DropdownMenuRadioItem value="__none__">
                                      Sin pregunta hija
                                    </DropdownMenuRadioItem>
                                    {childQuestionOptions.map((item) => (
                                      <DropdownMenuRadioItem key={item.id} value={item.id}>
                                        {getPreguntaTitulo(
                                          item,
                                          draft.preguntas.findIndex((entry) => entry.id === item.id),
                                        )}
                                      </DropdownMenuRadioItem>
                                    ))}
                                  </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  updateRespuesta(pregunta.id, respuesta.id, (current) => ({
                                    ...current,
                                    reglas: [
                                      ...current.reglas,
                                      {
                                        ...buildDefaultRegla("activar_paso"),
                                        orden: current.reglas.length + 1,
                                      },
                                    ],
                                  }))
                                }
                                aria-label={reglaPrincipal ? "Agregar regla adicional" : "Agregar acción"}
                                title={reglaPrincipal ? "Agregar regla adicional" : "Agregar acción"}
                              >
                                <PlusIcon className="size-4" />
                              </Button>
                              {pregunta.tipoPregunta === "single_select" ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    updatePregunta(pregunta.id, (current) => ({
                                      ...current,
                                      respuestas: current.respuestas.filter((item) => item.id !== respuesta.id),
                                    }))
                                  }
                                  disabled={pregunta.respuestas.length <= 1}
                                  aria-label="Eliminar respuesta"
                                  title="Eliminar respuesta"
                                >
                                  <Trash2Icon className="size-4" />
                                </Button>
                              ) : reglaPrincipal ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    updateRespuesta(pregunta.id, respuesta.id, (current) => ({
                                      ...current,
                                      reglas: current.reglas.filter((item) => item.id !== reglaPrincipal.id),
                                    }))
                                  }
                                  aria-label="Eliminar acción principal"
                                  title="Eliminar acción principal"
                                >
                                  <Trash2Icon className="size-4" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>

                        {reglaPrincipal && reglasSecundarias.length > 0 ? (
                          <TableRow className="bg-muted/10 hover:bg-muted/10">
                            <TableCell colSpan={4} className="p-0">
                              <Collapsible
                                open={reglasAbiertas[respuesta.id] ?? false}
                                onOpenChange={(nextOpen) =>
                                  setReglasAbiertas((prev) => ({ ...prev, [respuesta.id]: nextOpen }))
                                }
                              >
                                <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-sm">
                                  <span>Reglas adicionales ({reglasSecundarias.length})</span>
                                  {reglasAbiertas[respuesta.id] ? (
                                    <ChevronDownIcon className="size-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                                  )}
                                </CollapsibleTrigger>
                                <CollapsibleContent className="border-t bg-background px-3 py-3">
                                  <div className="space-y-2">
                                    {reglasSecundarias.map((regla) => (
                                      <div
                                        key={regla.id}
                                        className="grid gap-2 rounded-md border bg-background p-2 md:grid-cols-[220px_minmax(0,1fr)_36px] md:items-start"
                                      >
                                        <Select
                                          value={regla.accion}
                                          onValueChange={(value) =>
                                            updateRegla(pregunta.id, respuesta.id, regla.id, () =>
                                              buildDefaultRegla((value as TipoChecklistAccionRegla) ?? "activar_paso"),
                                            )
                                          }
                                        >
                                          <SelectTrigger className="w-full min-w-0">
                                            <SelectValue>{getAccionLabel(regla.accion)}</SelectValue>
                                          </SelectTrigger>
                                          <SelectContent>
                                            {accionItems.map((item) => (
                                              <SelectItem key={item.value} value={item.value}>
                                                {item.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <div>{renderRuleControls(pregunta, respuesta, regla)}</div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() =>
                                            updateRespuesta(pregunta.id, respuesta.id, (current) => ({
                                              ...current,
                                              reglas: current.reglas.filter((item) => item.id !== regla.id),
                                            }))
                                          }
                                          aria-label="Eliminar regla adicional"
                                          title="Eliminar regla adicional"
                                        >
                                          <Trash2Icon className="size-4" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </React.Fragment>
                    )})}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        </div>
      )})}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                preguntas: [...prev.preguntas, { ...buildDefaultPregunta(), orden: prev.preguntas.length + 1 }],
              }))
            }
          >
            <PlusIcon className="size-4" />
            Agregar pregunta
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !isDirty}>
            {isSaving ? <GdiSpinner className="size-4" /> : <SaveIcon />}
            Guardar configurador
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/10 xl:sticky xl:top-4">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">Preview de ruta</p>
          <p className="text-xs text-muted-foreground">
            Simula la ruta con todos los pasos opcionales y arrastrá cada contenedor para definir el orden final.
          </p>
        </div>
        <div className="space-y-2 p-3">
          {routePreviewItems.length === 0 ? (
            <div className="rounded-md border border-dashed bg-background px-3 py-6 text-center text-sm text-muted-foreground">
              Todavía no hay pasos para previsualizar.
            </div>
          ) : (
            <>
              {routePreviewItems.map((item) => {
                const isOptional = item.kind === "optional";
                const isDragged =
                  isOptional &&
                  (draggedRouteItemKey === item.key || pointerDraggingRouteItemKey === item.key);
                const dropBefore = routeDropIndicator?.targetKey === item.key && routeDropIndicator.position === "before";
                const dropAfter = routeDropIndicator?.targetKey === item.key && routeDropIndicator.position === "after";

                return (
                  <div key={item.key} className="space-y-1">
                    {dropBefore ? <div className="h-1 rounded-full bg-orange-500" /> : null}
                    <div
                      className={cn(
                        "rounded-md border bg-background px-3 py-2 transition-transform transition-shadow",
                        isOptional ? "cursor-grab touch-none select-none" : "border-dashed bg-muted/20",
                        isDragged && "scale-[1.01] border-orange-300 shadow-lg ring-2 ring-orange-200",
                      )}
                      draggable={isOptional}
                      onPointerDown={(event) => {
                        if (!isOptional) return;
                        event.preventDefault();
                        setPointerDraggingRouteItemKey(item.key);
                        setDraggedRouteItemKey(null);
                      }}
                      onPointerMove={(event) => {
                        if (!pointerDraggingRouteItemKey || pointerDraggingRouteItemKey === item.key) return;
                        setRouteDropIndicator({
                          targetKey: item.key,
                          position: getPreviewPointerPosition(event),
                        });
                      }}
                      onPointerUp={(event) => {
                        if (!pointerDraggingRouteItemKey || pointerDraggingRouteItemKey === item.key) return;
                        moveRoutePreviewItem(
                          pointerDraggingRouteItemKey,
                          item.key,
                          getPreviewPointerPosition(event),
                        );
                        setPointerDraggingRouteItemKey(null);
                        setRouteDropIndicator(null);
                      }}
                      onDragStart={(event) => {
                        if (!isOptional) return;
                        event.dataTransfer.setData("text/plain", item.key);
                        event.dataTransfer.effectAllowed = "move";
                        setDraggedRouteItemKey(item.key);
                      }}
                      onDragEnd={() => {
                        setDraggedRouteItemKey(null);
                        setRouteDropIndicator(null);
                      }}
                      onDragOver={(event) => {
                        if (!draggedRouteItemKey || draggedRouteItemKey === item.key) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        const bounds = event.currentTarget.getBoundingClientRect();
                        const position =
                          event.clientY - bounds.top < bounds.height / 2 ? "before" : "after";
                        setRouteDropIndicator({ targetKey: item.key, position });
                      }}
                      onDrop={(event) => {
                        if (!draggedRouteItemKey || draggedRouteItemKey === item.key) return;
                        event.preventDefault();
                        const bounds = event.currentTarget.getBoundingClientRect();
                        const position =
                          event.clientY - bounds.top < bounds.height / 2 ? "before" : "after";
                        moveRoutePreviewItem(draggedRouteItemKey, item.key, position);
                        setDraggedRouteItemKey(null);
                        setRouteDropIndicator(null);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-0.5 text-muted-foreground">
                          {isOptional ? (
                            <GripVerticalIcon className={cn("size-4", isDragged && "text-orange-600")} />
                          ) : (
                            <span className="block size-4 rounded-full bg-muted-foreground/30" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{item.label}</p>
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[11px]",
                              isOptional ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground",
                            )}>
                              {isOptional ? "Opcional" : "Base"}
                            </span>
                          </div>
                          {isOptional ? (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">
                                {item.questionLabels.slice(0, 2).join(" · ")}
                                {item.questionLabels.length > 2 ? ` +${item.questionLabels.length - 2}` : ""}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {item.responseLabels.length} respuesta(s) usan este paso
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Paso de la ruta base</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {dropAfter ? <div className="h-1 rounded-full bg-orange-500" /> : null}
                  </div>
                );
              })}
              <div
                className="rounded-md border border-dashed px-3 py-2 text-center text-xs text-muted-foreground"
                onPointerMove={() => {
                  if (!pointerDraggingRouteItemKey) return;
                  setRouteDropIndicator({ targetKey: "__end__", position: "after" });
                }}
                onPointerUp={() => {
                  if (!pointerDraggingRouteItemKey) return;
                  const withoutDragged = routePreviewItems.filter(
                    (item) => item.key !== pointerDraggingRouteItemKey,
                  );
                  const draggedItem = routePreviewItems.find(
                    (item): item is Extract<ChecklistRoutePreviewItem, { kind: "optional" }> =>
                      item.kind === "optional" && item.key === pointerDraggingRouteItemKey,
                  );
                  if (!draggedItem) return;
                  applyPreviewOrder([...withoutDragged, draggedItem]);
                  setPointerDraggingRouteItemKey(null);
                  setRouteDropIndicator(null);
                }}
                onDragOver={(event) => {
                  if (!draggedRouteItemKey) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setRouteDropIndicator({ targetKey: "__end__", position: "after" });
                }}
                onDrop={(event) => {
                  if (!draggedRouteItemKey) return;
                  event.preventDefault();
                  const withoutDragged = routePreviewItems.filter(
                    (item) => item.key !== draggedRouteItemKey,
                  );
                  const draggedItem = routePreviewItems.find(
                    (item): item is Extract<ChecklistRoutePreviewItem, { kind: "optional" }> =>
                      item.kind === "optional" && item.key === draggedRouteItemKey,
                  );
                  if (!draggedItem) return;
                  applyPreviewOrder([...withoutDragged, draggedItem]);
                  setDraggedRouteItemKey(null);
                  setRouteDropIndicator(null);
                }}
              >
                Soltar al final de la ruta
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type ChecklistCotizadorProps = {
  checklist: ProductoChecklist;
  value: Record<string, { respuestaId: string }>;
  onChange: (value: Record<string, { respuestaId: string }>) => void;
};

export function ProductoServicioChecklistCotizador({
  checklist,
  value,
  onChange,
}: ChecklistCotizadorProps) {
  const questionDependencyMeta = React.useMemo(
    () => buildChecklistQuestionDependencyMeta(checklist),
    [checklist],
  );
  const visibleQuestionIds = React.useMemo(
    () => resolveVisibleChecklistQuestionIds(checklist, value),
    [checklist, value],
  );

  React.useEffect(() => {
    const nextValue = pruneChecklistSelections(checklist, value);
    if (JSON.stringify(nextValue) !== JSON.stringify(value)) {
      onChange(nextValue);
    }
  }, [checklist, onChange, value]);

  if (!checklist.activo || checklist.preguntas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este producto no tiene configurador definido.
      </p>
    );
  }

  const visiblePreguntas = checklist.preguntas
        .filter((pregunta) => pregunta.activo && visibleQuestionIds.has(pregunta.id))
        .sort((a, b) => a.orden - b.orden);

  return (
    <div className="space-y-3">
      {visiblePreguntas.map((pregunta) => {
          const dependencyMeta = questionDependencyMeta.get(pregunta.id) ?? null;
          const selected = value[pregunta.id];
          const respuestasActivas = pregunta.respuestas
            .filter((respuesta) => respuesta.activo)
            .sort((a, b) => a.orden - b.orden);
          const useMiniCards = respuestasActivas.length > 0 && respuestasActivas.length <= 4;
          const selectedLabel =
            respuestasActivas.find((respuesta) => respuesta.id === selected?.respuestaId)?.texto ??
            "Sin seleccionar";
          const handleSelectRespuesta = (respuestaId: string | null) => {
            const next = { ...value };
            if (!respuestaId) {
              delete next[pregunta.id];
            } else {
              next[pregunta.id] = { respuestaId };
            }
            onChange(next);
          };
          return (
            <div
              key={pregunta.id}
              className={cn("relative", dependencyMeta ? "ml-5 pl-5" : "")}
            >
              {dependencyMeta ? (
                <>
                  <div className="absolute left-1 top-0 bottom-4 w-px rounded-full bg-orange-200" />
                  <div className="absolute left-1 top-8 h-px w-3 bg-orange-200" />
                  <div className="absolute -left-1 top-6 size-3 rounded-full border-2 border-orange-500 bg-background" />
                </>
              ) : null}
              <div
                className={cn(
                  "space-y-2 rounded-md border p-3",
                  dependencyMeta ? "border-orange-200 bg-orange-50/20" : "",
                )}
              >
              <Field>
                <FieldLabel>
                  <span className="inline-flex items-center gap-2">
                    <span>{pregunta.texto}</span>
                    {dependencyMeta ? (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                        Hija
                      </span>
                    ) : null}
                  </span>
                </FieldLabel>
                {dependencyMeta ? (
                  <p className="mb-2 text-[11px] text-orange-700/90">
                    Depende de: {dependencyMeta.parentQuestionTitle} → {dependencyMeta.parentResponseText}
                  </p>
                ) : null}
                {useMiniCards ? (
                  <div className="flex flex-wrap gap-2">
                    {respuestasActivas.map((respuesta) => {
                      const isSelected = selected?.respuestaId === respuesta.id;
                      return (
                        <button
                          key={respuesta.id}
                          type="button"
                          onClick={() => handleSelectRespuesta(isSelected ? null : respuesta.id)}
                          className={cn(
                            "inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-sm transition-colors",
                            isSelected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-background hover:border-primary/40 hover:bg-muted/50",
                          )}
                        >
                          <span className="font-medium">{respuesta.texto}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Select
                    value={selected?.respuestaId ?? "__none__"}
                    onValueChange={(respuestaId) => {
                      handleSelectRespuesta(
                        respuestaId && respuestaId !== "__none__" ? respuestaId : null,
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una respuesta">
                        {selectedLabel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin seleccionar</SelectItem>
                      {respuestasActivas.map((respuesta) => (
                        <SelectItem key={respuesta.id} value={respuesta.id}>
                          {respuesta.texto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                    </Select>
                )}
              </Field>
              </div>
            </div>
          );
        })}
    </div>
  );
}
