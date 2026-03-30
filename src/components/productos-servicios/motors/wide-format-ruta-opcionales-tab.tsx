"use client";

import * as React from "react";
import { CpuIcon, GitBranchIcon, Layers3Icon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { ProductoRutaOpcionalesShell } from "@/components/productos-servicios/producto-ruta-opcionales-shell";
import { ProductoServicioChecklistEditor } from "@/components/productos-servicios/producto-servicio-checklist";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getMaquinaTecnologia, tecnologiaMaquinaItems } from "@/lib/maquinaria";
import type { Proceso, ProcesoOperacionPlantilla } from "@/lib/procesos";
import {
  getGranFormatoChecklist,
  getGranFormatoConfig,
  getGranFormatoRutaBase,
  updateGranFormatoChecklist,
} from "@/lib/productos-servicios-api";
import type {
  GranFormatoChecklistConfig,
  GranFormatoRutaBase,
  ProductoChecklist,
  ProductoChecklistPayload,
} from "@/lib/productos-servicios";

const technologyOrder = tecnologiaMaquinaItems.map((item) => item.value);
const technologyLabels: Record<string, string> = Object.fromEntries(
  tecnologiaMaquinaItems.map((item) => [item.value, item.label]),
);

function createEmptyChecklist(productoId: string): ProductoChecklist {
  return {
    productoId,
    activo: true,
    preguntas: [],
    createdAt: null,
    updatedAt: null,
  };
}

function toChecklistPayload(checklist: ProductoChecklist): ProductoChecklistPayload {
  return {
    activo: checklist.activo,
    preguntas: checklist.preguntas.map((pregunta) => ({
      id: pregunta.id,
      texto: pregunta.texto,
      tipoPregunta: pregunta.tipoPregunta,
      orden: pregunta.orden,
      activo: pregunta.activo,
      respuestas: pregunta.respuestas.map((respuesta) => ({
        id: respuesta.id,
        texto: respuesta.texto,
        codigo: respuesta.codigo ?? undefined,
        preguntaSiguienteId: respuesta.preguntaSiguienteId ?? undefined,
        orden: respuesta.orden,
        activo: respuesta.activo,
        reglas: respuesta.reglas.map((regla) => ({
          id: regla.id,
          accion: regla.accion,
          orden: regla.orden,
          activo: regla.activo,
          pasoPlantillaId: regla.pasoPlantillaId ?? undefined,
          variantePasoId: regla.variantePasoId ?? undefined,
          costoRegla: regla.costoRegla ?? undefined,
          costoValor: regla.costoValor ?? undefined,
          costoCentroCostoId: regla.costoCentroCostoId ?? undefined,
          materiaPrimaVarianteId: regla.materiaPrimaVarianteId ?? undefined,
          tipoConsumo: regla.tipoConsumo ?? undefined,
          factorConsumo: regla.factorConsumo ?? undefined,
          mermaPct: regla.mermaPct ?? undefined,
          detalle: regla.detalle ?? undefined,
        })),
      })),
    })),
  };
}

function normalizePasoNombreBase(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) return "";
  const colonIndex = normalized.indexOf(":");
  if (colonIndex <= 0) return normalized;
  return normalized.slice(0, colonIndex).trim();
}

function resolveProcesoOperacionPlantilla(
  operacion: Pick<Proceso["operaciones"][number], "nombre" | "maquinaId" | "perfilOperativoId" | "detalle">,
  plantillasPaso: ProcesoOperacionPlantilla[],
) {
  const operationName = operacion.nombre.trim().toLowerCase();
  const operationBaseName = normalizePasoNombreBase(operacion.nombre);
  const detalle = operacion.detalle && typeof operacion.detalle === "object" ? (operacion.detalle as Record<string, unknown>) : {};
  const pasoPlantillaId = typeof detalle.pasoPlantillaId === "string" && detalle.pasoPlantillaId.trim().length ? detalle.pasoPlantillaId.trim() : null;
  if (pasoPlantillaId) {
    return plantillasPaso.find((item) => item.id === pasoPlantillaId && item.activo) ?? null;
  }
  const exactWithProfile =
    plantillasPaso.find(
      (item) =>
        item.activo &&
        item.perfilOperativoId &&
        item.perfilOperativoId === (operacion.perfilOperativoId ?? "") &&
        (item.maquinaId ?? "") === (operacion.maquinaId ?? ""),
    ) ?? null;
  if (exactWithProfile) return exactWithProfile;
  return (
    plantillasPaso.find(
      (item) =>
        item.activo &&
        item.nombre.trim().toLowerCase() === operationName &&
        (item.maquinaId ?? "") === (operacion.maquinaId ?? ""),
    ) ??
    plantillasPaso.find(
      (item) =>
        item.activo &&
        normalizePasoNombreBase(item.nombre) === operationBaseName &&
        (item.maquinaId ?? "") === (operacion.maquinaId ?? ""),
    ) ??
    plantillasPaso.find((item) => item.activo && item.nombre.trim().toLowerCase() === operationName) ??
    plantillasPaso.find((item) => item.activo && normalizePasoNombreBase(item.nombre) === operationBaseName) ??
    null
  );
}

export function WideFormatRutaOpcionalesTab(props: ProductTabProps) {
  const [isLoadingChecklist, setIsLoadingChecklist] = React.useState(true);
  const [isSavingChecklistScope, startSavingChecklistScope] = React.useTransition();
  const [aplicaChecklistATodasLasTecnologias, setAplicaChecklistATodasLasTecnologias] = React.useState(true);
  const [checklistComun, setChecklistComun] = React.useState<ProductoChecklist>(createEmptyChecklist(props.producto.id));
  const [checklistsPorTecnologia, setChecklistsPorTecnologia] = React.useState<Record<string, ProductoChecklist>>({});
  const [tecnologiaChecklistSeleccionada, setTecnologiaChecklistSeleccionada] = React.useState("");
  const [checklistDirty, setChecklistDirty] = React.useState(false);
  const [granFormatoConfig, setGranFormatoConfig] = React.useState<{ tecnologiasCompatibles: string[] }>({ tecnologiasCompatibles: [] });
  const [rutaBase, setRutaBase] = React.useState<GranFormatoRutaBase | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoadingChecklist(true);
    Promise.all([
      getGranFormatoChecklist(props.producto.id),
      getGranFormatoConfig(props.producto.id),
      getGranFormatoRutaBase(props.producto.id),
    ])
      .then(([checklistConfig, config, ruta]) => {
        if (cancelled) return;
        setAplicaChecklistATodasLasTecnologias(checklistConfig.aplicaATodasLasTecnologias);
        setChecklistComun(
          checklistConfig.checklistComun?.preguntas.length
            ? checklistConfig.checklistComun
            : createEmptyChecklist(props.producto.id),
        );
        setChecklistsPorTecnologia(
          Object.fromEntries(checklistConfig.checklistsPorTecnologia.map((item) => [item.tecnologia, item.checklist])),
        );
        setGranFormatoConfig({ tecnologiasCompatibles: config.tecnologiasCompatibles });
        setRutaBase(ruta);
        setChecklistDirty(false);
      })
      .catch((error) => {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo cargar la ruta de opcionales.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingChecklist(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.producto.id]);

  const tecnologiasChecklistDisponibles = React.useMemo(
    () =>
      technologyOrder.filter((value) => granFormatoConfig.tecnologiasCompatibles.includes(value)) as string[],
    [granFormatoConfig.tecnologiasCompatibles],
  );

  React.useEffect(() => {
    if (!tecnologiasChecklistDisponibles.length) {
      if (tecnologiaChecklistSeleccionada) setTecnologiaChecklistSeleccionada("");
      return;
    }
    setTecnologiaChecklistSeleccionada((prev) =>
      prev && tecnologiasChecklistDisponibles.includes(prev) ? prev : tecnologiasChecklistDisponibles[0],
    );
  }, [tecnologiaChecklistSeleccionada, tecnologiasChecklistDisponibles]);

  const checklistActivo = React.useMemo(() => {
    if (aplicaChecklistATodasLasTecnologias) return checklistComun;
    return checklistsPorTecnologia[tecnologiaChecklistSeleccionada] ?? createEmptyChecklist(props.producto.id);
  }, [
    aplicaChecklistATodasLasTecnologias,
    checklistComun,
    checklistsPorTecnologia,
    tecnologiaChecklistSeleccionada,
    props.producto.id,
  ]);

  const routeBaseProceso = React.useMemo(
    () => props.procesos.find((item) => item.id === rutaBase?.procesoDefinicionId) ?? null,
    [props.procesos, rutaBase?.procesoDefinicionId],
  );
  const routeBasePlantillaById = React.useMemo(
    () => new Map(props.plantillasPaso.filter((item) => item.activo).map((item) => [item.id, item])),
    [props.plantillasPaso],
  );

  const checklistRutaPasoOptions = React.useMemo(() => {
    if (!routeBaseProceso) return [];
    const baseSteps = routeBaseProceso.operaciones
      .map((operation) =>
        resolveProcesoOperacionPlantilla(
          {
            nombre: operation.nombre,
            maquinaId: operation.maquinaId,
            perfilOperativoId: operation.perfilOperativoId,
            detalle: (operation.detalle ?? null) as Record<string, unknown> | null,
          },
          props.plantillasPaso,
        ),
      )
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({ id: item.id, label: item.nombre }));

    const rulesToUse = aplicaChecklistATodasLasTecnologias
      ? rutaBase?.reglasImpresion ?? []
      : (rutaBase?.reglasImpresion ?? []).filter((item) => item.tecnologia === tecnologiaChecklistSeleccionada);
    const ruleSteps = rulesToUse
      .map((item) => routeBasePlantillaById.get(item.pasoPlantillaId) ?? null)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({ id: item.id, label: item.nombre }));

    return Array.from(new Map([...baseSteps, ...ruleSteps].map((item) => [item.id, item])).values());
  }, [
    aplicaChecklistATodasLasTecnologias,
    props.plantillasPaso,
    routeBasePlantillaById,
    routeBaseProceso,
    rutaBase?.reglasImpresion,
    tecnologiaChecklistSeleccionada,
  ]);
  const preguntasActivas = checklistActivo.preguntas.filter((item) => item.activo);
  const respuestasConAccion = preguntasActivas.reduce(
    (count, pregunta) =>
      count +
      pregunta.respuestas.filter((respuesta) => respuesta.activo && respuesta.reglas.some((regla) => regla.activo)).length,
    0,
  );
  const summaryTecnologia = aplicaChecklistATodasLasTecnologias
    ? "Todas las tecnologías"
    : technologyLabels[tecnologiaChecklistSeleccionada] ?? "Sin tecnología";

  const handleSaveGranFormatoChecklist = React.useCallback(
    async (payload: ProductoChecklistPayload) => {
      const nextChecklistsPorTecnologia = { ...checklistsPorTecnologia };
      if (!aplicaChecklistATodasLasTecnologias && tecnologiaChecklistSeleccionada) {
        nextChecklistsPorTecnologia[tecnologiaChecklistSeleccionada] = {
          ...checklistActivo,
          activo: payload.activo ?? true,
          preguntas: checklistActivo.preguntas,
        };
      }

      const updated = await updateGranFormatoChecklist(props.producto.id, {
        aplicaATodasLasTecnologias: aplicaChecklistATodasLasTecnologias,
        checklistComun: aplicaChecklistATodasLasTecnologias ? payload : undefined,
        checklistsPorTecnologia: tecnologiasChecklistDisponibles.map((tecnologia) => ({
          tecnologia,
          checklist:
            tecnologia === tecnologiaChecklistSeleccionada && !aplicaChecklistATodasLasTecnologias
              ? payload
              : toChecklistPayload(nextChecklistsPorTecnologia[tecnologia] ?? createEmptyChecklist(props.producto.id)),
        })),
      });

      setAplicaChecklistATodasLasTecnologias(updated.aplicaATodasLasTecnologias);
      setChecklistComun(updated.checklistComun);
      setChecklistsPorTecnologia(
        Object.fromEntries(updated.checklistsPorTecnologia.map((item) => [item.tecnologia, item.checklist])),
      );
      setChecklistDirty(false);
      return updated.aplicaATodasLasTecnologias
        ? updated.checklistComun
        : updated.checklistsPorTecnologia.find((item) => item.tecnologia === tecnologiaChecklistSeleccionada)?.checklist ??
            createEmptyChecklist(props.producto.id);
    },
    [
      aplicaChecklistATodasLasTecnologias,
      checklistActivo,
      checklistsPorTecnologia,
      props.producto.id,
      tecnologiaChecklistSeleccionada,
      tecnologiasChecklistDisponibles,
    ],
  );

  const handleToggleChecklistScope = React.useCallback(
    (checked: boolean) => {
      if (checklistDirty) {
        toast.error("Guardá primero los cambios del checklist antes de cambiar el alcance.");
        return;
      }
      startSavingChecklistScope(async () => {
        try {
          const updated = await updateGranFormatoChecklist(props.producto.id, {
            aplicaATodasLasTecnologias: checked,
            checklistComun: toChecklistPayload(checklistComun),
            checklistsPorTecnologia: tecnologiasChecklistDisponibles.map((tecnologia) => ({
              tecnologia,
              checklist: toChecklistPayload(checklistsPorTecnologia[tecnologia] ?? createEmptyChecklist(props.producto.id)),
            })),
          });
          setAplicaChecklistATodasLasTecnologias(updated.aplicaATodasLasTecnologias);
          setChecklistComun(updated.checklistComun);
          setChecklistsPorTecnologia(
            Object.fromEntries(updated.checklistsPorTecnologia.map((item) => [item.tecnologia, item.checklist])),
          );
          setChecklistDirty(false);
          toast.success("Alcance de la ruta de opcionales guardado.");
        } catch (error) {
          console.error(error);
          toast.error(error instanceof Error ? error.message : "No se pudo guardar el alcance del checklist.");
        }
      });
    },
    [
      checklistComun,
      checklistDirty,
      checklistsPorTecnologia,
      props.producto.id,
      tecnologiasChecklistDisponibles,
    ],
  );

  return (
    <ProductoRutaOpcionalesShell
      summaryItems={[
        { label: "Alcance", value: aplicaChecklistATodasLasTecnologias ? "Todas las tecnologías" : "Una tecnología" },
        { label: "Tecnología activa", value: summaryTecnologia },
        { label: "Preguntas activas", value: preguntasActivas.length },
        { label: "Respuestas con acción", value: respuestasConAccion },
      ]}
      context={
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <Layers3Icon className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Alcance del checklist</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {aplicaChecklistATodasLasTecnologias
                  ? "Estás editando un checklist común que aplica a todas las tecnologías compatibles."
                  : "Estás editando un checklist específico para una sola tecnología. Cambiar de tecnología cambia el configurador activo."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={aplicaChecklistATodasLasTecnologias} onCheckedChange={(checked) => handleToggleChecklistScope(Boolean(checked))} />
                  <p className="text-sm font-medium">Aplicar a todas las tecnologías</p>
                </div>
                {isSavingChecklistScope ? <p className="text-xs text-muted-foreground">Guardando alcance...</p> : null}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <CpuIcon className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Tecnología en edición</p>
              </div>
              {!aplicaChecklistATodasLasTecnologias ? (
                <div className="mt-3 min-w-[260px]">
                  <Select
                    value={tecnologiaChecklistSeleccionada || "__none__"}
                    onValueChange={(value) => {
                      if (checklistDirty) {
                        toast.error("Guardá primero los cambios del checklist antes de cambiar de tecnología.");
                        return;
                      }
                      setTecnologiaChecklistSeleccionada(value === "__none__" ? "" : String(value ?? ""));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar tecnología">
                        {technologyLabels[tecnologiaChecklistSeleccionada] ?? "Seleccionar tecnología"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Seleccionar tecnología</SelectItem>
                      {tecnologiasChecklistDisponibles.map((item) => (
                        <SelectItem key={item} value={item}>
                          {technologyLabels[item] ?? item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tecnologiasChecklistDisponibles.map((item) => (
                    <Badge key={item} variant="outline">
                      {technologyLabels[item] ?? item}
                    </Badge>
                  ))}
                </div>
              )}
              {checklistDirty ? (
                <p className="mt-2 text-xs text-orange-700">
                  Guardá primero los cambios del checklist antes de cambiar el alcance o la tecnología.
                </p>
              ) : null}
            </div>
          </div>

          {!rutaBase?.procesoDefinicionId ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              Primero seleccioná una ruta de producción base para definir la preview de la ruta de opcionales.
            </div>
          ) : null}

          {!aplicaChecklistATodasLasTecnologias && !tecnologiaChecklistSeleccionada ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              Seleccioná una tecnología para configurar su ruta de opcionales.
            </div>
          ) : null}
        </div>
      }
      editor={
        isLoadingChecklist ? (
          <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
            <GdiSpinner className="size-4" />
            Cargando ruta de opcionales...
          </div>
        ) : !rutaBase?.procesoDefinicionId ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            Cuando exista una ruta base, acá vas a poder configurar preguntas, servicios y pasos opcionales sobre esa secuencia.
          </div>
        ) : !aplicaChecklistATodasLasTecnologias && !tecnologiaChecklistSeleccionada ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            Seleccioná una tecnología para configurar su ruta de opcionales.
          </div>
        ) : (
          <ProductoServicioChecklistEditor
            initialChecklist={checklistActivo}
            plantillasPaso={props.plantillasPaso}
            materiasPrimas={props.materiasPrimas}
            routeStepOptions={checklistRutaPasoOptions}
            onSaved={(saved) => {
              if (aplicaChecklistATodasLasTecnologias) {
                setChecklistComun(saved);
              } else if (tecnologiaChecklistSeleccionada) {
                setChecklistsPorTecnologia((prev) => ({ ...prev, [tecnologiaChecklistSeleccionada]: saved }));
              }
            }}
            onSaveChecklist={handleSaveGranFormatoChecklist}
            onDirtyChange={setChecklistDirty}
          />
        )
      }
    />
  );
}
