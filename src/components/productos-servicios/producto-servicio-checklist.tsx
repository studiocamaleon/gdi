"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronRightIcon, Loader2Icon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

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
  onSaved: (checklist: ProductoChecklist) => void;
};

export function ProductoServicioChecklistEditor({
  productoId,
  initialChecklist,
  plantillasPaso,
  materiasPrimas,
  onSaved,
}: ChecklistEditorProps) {
  const [draft, setDraft] = React.useState<ProductoChecklist>(initialChecklist);
  const [isSaving, startSaving] = React.useTransition();
  const [preguntasAbiertas, setPreguntasAbiertas] = React.useState<Record<string, boolean>>({});
  const [reglasAbiertas, setReglasAbiertas] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setDraft(initialChecklist);
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

  const handleSave = () => {
    startSaving(async () => {
      try {
        const saved = await upsertProductoChecklist(productoId, normalizeChecklistForSave(draft));
        setDraft(saved);
        onSaved(saved);
        toast.success("Configurador guardado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar el configurador.");
      }
    });
  };

  const renderRuleControls = (
    pregunta: ProductoChecklistPregunta,
    respuesta: ProductoChecklistRespuesta,
    regla: ProductoChecklistRegla,
    compact = false,
  ) => {
    if (regla.accion === "activar_paso" || regla.accion === "seleccionar_variante_paso") {
      return (
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
    <div className="space-y-4">
      {draft.preguntas.map((pregunta, preguntaIndex) => (
        <div key={pregunta.id} className="overflow-hidden rounded-lg border">
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
                <p className="text-sm font-medium">Pregunta {preguntaIndex + 1}</p>
                <p className="text-xs text-muted-foreground">
                  {pregunta.texto.trim() || "Sin texto todavía"}
                </p>
              </div>
            </button>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    preguntas: prev.preguntas.filter((item) => item.id !== pregunta.id),
                  }))
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
                        <TableHead className="w-[220px] text-xs uppercase tracking-wide text-muted-foreground">Acción</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Configuración</TableHead>
                        <TableHead className="w-[96px] text-right text-xs uppercase tracking-wide text-muted-foreground">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                  {pregunta.respuestas.map((respuesta, respuestaIndex) => {
                      const reglaPrincipal = respuesta.reglas[0] ?? null;
                      const reglasSecundarias = respuesta.reglas.slice(1);
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
                                <SelectTrigger>
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
                            {reglaPrincipal ? (
                              <div>{renderRuleControls(pregunta, respuesta, reglaPrincipal, true)}</div>
                            ) : (
                              <div className="flex h-10 items-center text-sm text-muted-foreground">Sin acción principal</div>
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex items-start justify-end gap-1">
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
                                          <SelectTrigger>
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
      ))}

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
          {isSaving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          Guardar configurador
        </Button>
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
  if (!checklist.activo || checklist.preguntas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este producto no tiene configurador definido.
      </p>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {checklist.preguntas
        .filter((pregunta) => pregunta.activo)
        .sort((a, b) => a.orden - b.orden)
        .map((pregunta) => {
          const selected = value[pregunta.id];
          const selectedLabel =
            pregunta.respuestas.find((respuesta) => respuesta.id === selected?.respuestaId)?.texto ??
            "Sin seleccionar";
          return (
            <div key={pregunta.id} className="space-y-3 rounded-md border p-3">
              <Field>
                <FieldLabel>{pregunta.texto}</FieldLabel>
                <Select
                  value={selected?.respuestaId ?? "__none__"}
                  onValueChange={(respuestaId) => {
                    const next = { ...value };
                    const respuestaIdSafe = respuestaId ?? "__none__";
                    if (respuestaIdSafe === "__none__") {
                      delete next[pregunta.id];
                    } else {
                      next[pregunta.id] = { respuestaId: respuestaIdSafe };
                    }
                    onChange(next);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una respuesta">
                      {selectedLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin seleccionar</SelectItem>
                    {pregunta.respuestas
                      .filter((respuesta) => respuesta.activo)
                      .sort((a, b) => a.orden - b.orden)
                      .map((respuesta) => (
                        <SelectItem key={respuesta.id} value={respuesta.id}>
                          {respuesta.texto}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          );
        })}
    </div>
  );
}
