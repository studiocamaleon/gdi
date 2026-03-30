"use client";

import * as React from "react";
import { GitBranchIcon, MapIcon } from "lucide-react";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { ProductoRutaOpcionalesShell } from "@/components/productos-servicios/producto-ruta-opcionales-shell";
import { ProductoServicioChecklistEditor } from "@/components/productos-servicios/producto-servicio-checklist";
import { Badge } from "@/components/ui/badge";
import type { Proceso, ProcesoOperacionPlantilla } from "@/lib/procesos";
import type { ProductoChecklist } from "@/lib/productos-servicios";

function normalizePasoNombreBase(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
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
  const pasoPlantillaId =
    operacion.detalle && typeof operacion.detalle === "object"
      ? String((operacion.detalle as Record<string, unknown>).pasoPlantillaId ?? "").trim()
      : "";
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

function getRutaPasoOptions(
  procesoId: string | null | undefined,
  procesos: Proceso[],
  plantillasPaso: ProcesoOperacionPlantilla[],
) {
  const proceso = procesos.find((item) => item.id === procesoId) ?? null;
  if (!proceso) return [];
  const matches = proceso.operaciones
    .map((op) => resolveProcesoOperacionPlantilla(op, plantillasPaso))
    .filter((item): item is ProcesoOperacionPlantilla => Boolean(item));

  return Array.from(new Map(matches.map((item) => [item.id, item])).values());
}

export function DigitalRutaOpcionalesTab(props: ProductTabProps) {
  const [productoChecklist, setProductoChecklist] = React.useState<ProductoChecklist>(props.checklist);

  React.useEffect(() => {
    setProductoChecklist(props.checklist);
  }, [props.checklist]);

  const pasosRutaOpcionales = React.useMemo(() => {
    const processIds = new Set<string>();
    if (props.producto.usarRutaComunVariantes) {
      if (props.producto.procesoDefinicionDefaultId) processIds.add(props.producto.procesoDefinicionDefaultId);
    } else {
      for (const variante of props.variantes) {
        if (variante.procesoDefinicionId) processIds.add(variante.procesoDefinicionId);
      }
    }
    const options = Array.from(processIds).flatMap((procesoId) =>
      getRutaPasoOptions(procesoId, props.procesos, props.plantillasPaso).map((paso) => ({
        id: paso.id,
        label: paso.nombre,
      })),
    );
    return Array.from(new Map(options.map((item) => [item.id, item])).values());
  }, [
    props.plantillasPaso,
    props.procesos,
    props.producto.procesoDefinicionDefaultId,
    props.producto.usarRutaComunVariantes,
    props.variantes,
  ]);

  const hasRouteConfigured = props.producto.usarRutaComunVariantes
    ? Boolean(props.producto.procesoDefinicionDefaultId)
    : props.variantes.some((item) => Boolean(item.procesoDefinicionId));
  const preguntasActivas = productoChecklist.preguntas.filter((item) => item.activo);
  const respuestasConAccion = preguntasActivas.reduce(
    (count, pregunta) =>
      count +
      pregunta.respuestas.filter((respuesta) => respuesta.activo && respuesta.reglas.some((regla) => regla.activo)).length,
    0,
  );
  const routeBaseSummary = props.producto.usarRutaComunVariantes
    ? props.procesos.find((item) => item.id === props.producto.procesoDefinicionDefaultId)?.nombre ?? "Sin ruta base"
    : `${props.variantes.filter((item) => item.procesoDefinicionId).length} variante(s) con ruta`;

  return (
    <ProductoRutaOpcionalesShell
      summaryItems={[
        { label: "Alcance", value: props.producto.usarRutaComunVariantes ? "Ruta común del producto" : "Ruta por variante" },
        { label: "Preguntas activas", value: preguntasActivas.length },
        { label: "Respuestas con acción", value: respuestasConAccion },
        { label: "Pasos opcionales detectados", value: pasosRutaOpcionales.length },
      ]}
      context={
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <MapIcon className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Ruta base que alimenta el preview</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{routeBaseSummary}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <GitBranchIcon className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Contexto del configurador</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">
                  {props.producto.usarRutaComunVariantes ? "Ruta común" : "Ruta por variante"}
                </Badge>
                <Badge variant="outline">{pasosRutaOpcionales.length} paso(s) base en preview</Badge>
              </div>
            </div>
          </div>
          {!hasRouteConfigured ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              Primero configurá una ruta base para habilitar la preview y el orden de los opcionales.
            </div>
          ) : null}
        </div>
      }
      editor={
        !hasRouteConfigured ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            Cuando exista una ruta base, acá vas a poder definir preguntas, respuestas y acciones opcionales sin salir del tab.
          </div>
        ) : (
          <ProductoServicioChecklistEditor
            productoId={props.producto.id}
            initialChecklist={productoChecklist}
            plantillasPaso={props.plantillasPaso}
            materiasPrimas={props.materiasPrimas}
            routeStepOptions={pasosRutaOpcionales}
            onSaved={setProductoChecklist}
          />
        )
      }
    />
  );
}
