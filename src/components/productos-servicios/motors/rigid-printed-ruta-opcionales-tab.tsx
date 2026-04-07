"use client";

import * as React from "react";
import { GitBranchIcon, MapIcon } from "lucide-react";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { ProductoRutaOpcionalesShell } from "@/components/productos-servicios/producto-ruta-opcionales-shell";
import { ProductoServicioChecklistEditor } from "@/components/productos-servicios/producto-servicio-checklist";
import { Badge } from "@/components/ui/badge";
import type { Proceso, ProcesoOperacionPlantilla } from "@/lib/procesos";
import type { ProductoChecklist } from "@/lib/productos-servicios";
import { getProductoMotorConfig } from "@/lib/productos-servicios-api";

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
  return (
    plantillasPaso.find((item) => item.activo && item.nombre.trim().toLowerCase() === operationName && (item.maquinaId ?? "") === (operacion.maquinaId ?? "")) ??
    plantillasPaso.find((item) => item.activo && normalizePasoNombreBase(item.nombre) === operationBaseName && (item.maquinaId ?? "") === (operacion.maquinaId ?? "")) ??
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

export function RigidPrintedRutaOpcionalesTab(props: ProductTabProps) {
  const [productoChecklist, setProductoChecklist] = React.useState<ProductoChecklist>(props.checklist);
  const [rutaIds, setRutaIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    setProductoChecklist(props.checklist);
  }, [props.checklist]);

  // Cargar rutas del motor config
  React.useEffect(() => {
    (async () => {
      try {
        const result = await getProductoMotorConfig(props.producto.id);
        const params = (result?.parametros ?? {}) as Record<string, unknown>;
        const ids: string[] = [];
        if (params.rutaImpresionDirectaId) ids.push(String(params.rutaImpresionDirectaId));
        if (params.rutaFlexibleMontadoId) ids.push(String(params.rutaFlexibleMontadoId));
        if (ids.length === 0 && props.producto.procesoDefinicionDefaultId) {
          ids.push(props.producto.procesoDefinicionDefaultId);
        }
        setRutaIds(ids);
      } catch {
        if (props.producto.procesoDefinicionDefaultId) {
          setRutaIds([props.producto.procesoDefinicionDefaultId]);
        }
      }
    })();
  }, [props.producto.id, props.producto.procesoDefinicionDefaultId]);

  const pasosRutaOpcionales = React.useMemo(() => {
    const options = rutaIds.flatMap((procesoId) =>
      getRutaPasoOptions(procesoId, props.procesos, props.plantillasPaso).map((paso) => ({
        id: paso.id,
        label: paso.nombre,
      })),
    );
    return Array.from(new Map(options.map((item) => [item.id, item])).values());
  }, [rutaIds, props.procesos, props.plantillasPaso]);

  const hasRouteConfigured = rutaIds.length > 0;
  const preguntasActivas = productoChecklist.preguntas.filter((item) => item.activo);
  const respuestasConAccion = preguntasActivas.reduce(
    (count, pregunta) =>
      count + pregunta.respuestas.filter((r) => r.activo && r.reglas.some((regla) => regla.activo)).length,
    0,
  );

  const rutaNames = rutaIds
    .map((id) => props.procesos.find((p) => p.id === id)?.nombre)
    .filter(Boolean)
    .join(" / ");

  return (
    <ProductoRutaOpcionalesShell
      summaryItems={[
        { label: "Rutas configuradas", value: rutaIds.length },
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
                <p className="text-sm font-medium">Rutas de producción</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {rutaNames || "Sin ruta configurada"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <GitBranchIcon className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Contexto del configurador</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{rutaIds.length} ruta(s)</Badge>
                <Badge variant="outline">{pasosRutaOpcionales.length} paso(s) base</Badge>
              </div>
            </div>
          </div>
          {!hasRouteConfigured && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              Primero configurá una ruta base en el tab Ruta Base para habilitar los opcionales.
            </div>
          )}
        </div>
      }
      editor={
        !hasRouteConfigured ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            Cuando exista una ruta base, acá vas a poder definir preguntas, respuestas y acciones opcionales.
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
