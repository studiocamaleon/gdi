"use client";

import * as React from "react";
import { toast } from "sonner";
import { GitBranchIcon, MapIcon } from "lucide-react";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { ProductoRutaOpcionalesShell } from "@/components/productos-servicios/producto-ruta-opcionales-shell";
import { ProductoServicioChecklistEditor } from "@/components/productos-servicios/producto-servicio-checklist";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import type { Proceso, ProcesoOperacionPlantilla } from "@/lib/procesos";
import type { ProductoChecklist, ProductoChecklistPayload, RigidPrintedChecklistConfig } from "@/lib/productos-servicios";
import {
  getProductoMotorConfig,
  getRigidPrintedChecklist,
  updateRigidPrintedChecklist,
} from "@/lib/productos-servicios-api";

// ── Helpers ──────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  directa: "Impresión directa",
  flexible_montado: "Sustrato flexible montado",
};

function createEmptyChecklist(productoId: string): ProductoChecklist {
  return { id: undefined, productoId, activo: true, preguntas: [], createdAt: null, updatedAt: null };
}

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

// ── Componente ───────────────────────────────────────────────────

export function RigidPrintedRutaOpcionalesTab(props: ProductTabProps) {
  const [loading, setLoading] = React.useState(true);
  const [tiposImpresion, setTiposImpresion] = React.useState<string[]>([]);
  const [rutaDirectaId, setRutaDirectaId] = React.useState<string | null>(null);
  const [rutaFlexibleId, setRutaFlexibleId] = React.useState<string | null>(null);

  // Checklist state
  const [aplicaATodos, setAplicaATodos] = React.useState(true);
  const [checklistComun, setChecklistComun] = React.useState<ProductoChecklist>(
    createEmptyChecklist(props.producto.id),
  );
  const [checklistsPorTipo, setChecklistsPorTipo] = React.useState<Record<string, ProductoChecklist>>({});
  const [tipoSeleccionado, setTipoSeleccionado] = React.useState<string>("");
  const [dirty, setDirty] = React.useState(false);

  // Load config + checklist
  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [configResult, checklistResult] = await Promise.all([
          getProductoMotorConfig(props.producto.id),
          getRigidPrintedChecklist(props.producto.id),
        ]);

        const params = (configResult?.parametros ?? {}) as Record<string, unknown>;
        const tipos = Array.isArray(params.tiposImpresion) ? params.tiposImpresion as string[] : [];
        setTiposImpresion(tipos);
        setRutaDirectaId(params.rutaImpresionDirectaId ? String(params.rutaImpresionDirectaId) : null);
        setRutaFlexibleId(params.rutaFlexibleMontadoId ? String(params.rutaFlexibleMontadoId) : null);

        if (checklistResult) {
          setAplicaATodos(checklistResult.aplicaATodosLosTiposImpresion !== false);
          setChecklistComun(checklistResult.checklistComun ?? createEmptyChecklist(props.producto.id));
          const byTipo: Record<string, ProductoChecklist> = {};
          for (const item of checklistResult.checklistsPorTipoImpresion ?? []) {
            const t = (item as { tipoImpresion?: string }).tipoImpresion;
            if (t) byTipo[t] = (item as { checklist: ProductoChecklist }).checklist;
          }
          setChecklistsPorTipo(byTipo);
        }

        if (tipos.length > 0) setTipoSeleccionado(tipos[0]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [props.producto.id]);

  // Route step options per tipo
  const pasosDirecta = React.useMemo(
    () => getRutaPasoOptions(rutaDirectaId, props.procesos, props.plantillasPaso).map((p) => ({ id: p.id, label: p.nombre })),
    [rutaDirectaId, props.procesos, props.plantillasPaso],
  );
  const pasosFlexible = React.useMemo(
    () => getRutaPasoOptions(rutaFlexibleId, props.procesos, props.plantillasPaso).map((p) => ({ id: p.id, label: p.nombre })),
    [rutaFlexibleId, props.procesos, props.plantillasPaso],
  );
  const pasosCombinados = React.useMemo(() => {
    const map = new Map([...pasosDirecta, ...pasosFlexible].map((p) => [p.id, p]));
    return Array.from(map.values());
  }, [pasosDirecta, pasosFlexible]);

  // Active checklist for editor
  const checklistActivo = React.useMemo(() => {
    if (aplicaATodos) return checklistComun;
    return checklistsPorTipo[tipoSeleccionado] ?? createEmptyChecklist(props.producto.id);
  }, [aplicaATodos, checklistComun, checklistsPorTipo, tipoSeleccionado, props.producto.id]);

  const routeStepOptions = React.useMemo(() => {
    if (aplicaATodos) return pasosCombinados;
    if (tipoSeleccionado === "directa") return pasosDirecta;
    if (tipoSeleccionado === "flexible_montado") return pasosFlexible;
    return pasosCombinados;
  }, [aplicaATodos, tipoSeleccionado, pasosCombinados, pasosDirecta, pasosFlexible]);

  // Convert ProductoChecklist → ProductoChecklistPayload
  const toPayload = (cl: ProductoChecklist): ProductoChecklistPayload => ({
    activo: cl.activo,
    preguntas: cl.preguntas as unknown as ProductoChecklistPayload["preguntas"],
  });

  // Save handler (used by onSaveChecklist)
  const handleSave = React.useCallback(async (payload: ProductoChecklistPayload): Promise<ProductoChecklist> => {
    const nextPorTipo = { ...checklistsPorTipo };
    if (!aplicaATodos && tipoSeleccionado) {
      nextPorTipo[tipoSeleccionado] = { ...checklistActivo, preguntas: payload.preguntas as unknown as ProductoChecklist["preguntas"] };
    }

    const result = await updateRigidPrintedChecklist(props.producto.id, {
      aplicaATodosLosTiposImpresion: aplicaATodos,
      checklistComun: aplicaATodos ? payload : undefined,
      checklistsPorTipoImpresion: tiposImpresion.map((tipo) => ({
        tipoImpresion: tipo,
        checklist: tipo === tipoSeleccionado && !aplicaATodos
          ? payload
          : toPayload(nextPorTipo[tipo] ?? createEmptyChecklist(props.producto.id)),
      })),
    });

    setChecklistComun(result.checklistComun ?? createEmptyChecklist(props.producto.id));
    const byTipo: Record<string, ProductoChecklist> = {};
    for (const item of result.checklistsPorTipoImpresion ?? []) {
      const t = (item as { tipoImpresion?: string }).tipoImpresion;
      if (t) byTipo[t] = (item as { checklist: ProductoChecklist }).checklist;
    }
    setChecklistsPorTipo(byTipo);
    setDirty(false);

    return aplicaATodos
      ? result.checklistComun
      : byTipo[tipoSeleccionado] ?? createEmptyChecklist(props.producto.id);
  }, [aplicaATodos, tipoSeleccionado, checklistActivo, checklistsPorTipo, tiposImpresion, props.producto.id]);

  // Toggle scope
  const handleToggleScope = React.useCallback(async (newValue: boolean) => {
    if (dirty) {
      toast.warning("Guardá los cambios antes de cambiar el alcance.");
      return;
    }
    setAplicaATodos(newValue);
    try {
      const result = await updateRigidPrintedChecklist(props.producto.id, {
        aplicaATodosLosTiposImpresion: newValue,
        checklistComun: newValue ? { preguntas: checklistComun.preguntas as ProductoChecklistPayload["preguntas"] } : undefined,
        checklistsPorTipoImpresion: tiposImpresion.map((tipo) => ({
          tipoImpresion: tipo,
          checklist: { preguntas: (checklistsPorTipo[tipo]?.preguntas ?? []) as ProductoChecklistPayload["preguntas"] },
        })),
      });
      if (result) {
        setChecklistComun(result.checklistComun ?? createEmptyChecklist(props.producto.id));
        const byTipo: Record<string, ProductoChecklist> = {};
        for (const item of result.checklistsPorTipoImpresion ?? []) {
          const t = (item as { tipoImpresion?: string }).tipoImpresion;
          if (t) byTipo[t] = (item as { checklist: ProductoChecklist }).checklist;
        }
        setChecklistsPorTipo(byTipo);
      }
      toast.success(newValue ? "Checklist unificado para todos los tipos." : "Checklist separado por tipo de impresión.");
    } catch (err) {
      console.error(err);
      toast.error("Error al cambiar alcance.");
      setAplicaATodos(!newValue); // revert
    }
  }, [dirty, checklistComun, checklistsPorTipo, tiposImpresion, props.producto.id]);

  const hasRoute = Boolean(rutaDirectaId || rutaFlexibleId);
  const tieneMasDeUnTipo = tiposImpresion.length > 1;
  const preguntasActivas = checklistActivo.preguntas.filter((p) => p.activo);

  if (loading) return <GdiSpinner />;

  return (
    <ProductoRutaOpcionalesShell
      summaryItems={[
        { label: "Rutas configuradas", value: (rutaDirectaId ? 1 : 0) + (rutaFlexibleId ? 1 : 0) },
        { label: "Alcance", value: aplicaATodos || !tieneMasDeUnTipo ? "Todos los tipos" : TIPO_LABELS[tipoSeleccionado] ?? tipoSeleccionado },
        { label: "Preguntas activas", value: preguntasActivas.length },
        { label: "Pasos opcionales", value: routeStepOptions.length },
      ]}
      context={
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <MapIcon className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Rutas de producción</p>
              </div>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {rutaDirectaId && (
                  <p>Directa: {props.procesos.find((p) => p.id === rutaDirectaId)?.nombre ?? "—"}</p>
                )}
                {rutaFlexibleId && (
                  <p>Flexible: {props.procesos.find((p) => p.id === rutaFlexibleId)?.nombre ?? "—"}</p>
                )}
                {!rutaDirectaId && !rutaFlexibleId && <p>Sin ruta configurada</p>}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <GitBranchIcon className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Alcance del checklist</p>
              </div>
              {tieneMasDeUnTipo ? (
                <div className="mt-2 flex items-center gap-2">
                  <Switch
                    checked={aplicaATodos}
                    onCheckedChange={handleToggleScope}
                  />
                  <Label className="text-sm">Aplica a todos los tipos de impresión</Label>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Un solo tipo de impresión activo.</p>
              )}
            </div>
          </div>
          {!hasRoute && (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              Primero configurá una ruta base en el tab Ruta Base para habilitar los opcionales.
            </div>
          )}
        </div>
      }
      editor={
        !hasRoute ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            Cuando exista una ruta base, acá vas a poder definir preguntas, respuestas y acciones opcionales.
          </div>
        ) : aplicaATodos || !tieneMasDeUnTipo ? (
          /* Modo unificado: un solo editor */
          <ProductoServicioChecklistEditor
            productoId={props.producto.id}
            initialChecklist={checklistActivo}
            plantillasPaso={props.plantillasPaso}
            materiasPrimas={props.materiasPrimas}
            routeStepOptions={routeStepOptions}
            onSaved={() => {}}
            onSaveChecklist={handleSave}
            onDirtyChange={setDirty}
          />
        ) : (
          /* Modo por tipo: tabs */
          <Tabs value={tipoSeleccionado} onValueChange={(v) => {
            if (dirty) {
              toast.warning("Guardá los cambios antes de cambiar de tipo.");
              return;
            }
            setTipoSeleccionado(v);
          }}>
            <TabsList>
              {tiposImpresion.map((tipo) => (
                <TabsTrigger key={tipo} value={tipo}>
                  {TIPO_LABELS[tipo] ?? tipo}
                </TabsTrigger>
              ))}
            </TabsList>
            {tiposImpresion.map((tipo) => (
              <TabsContent key={tipo} value={tipo}>
                <ProductoServicioChecklistEditor
                  key={`checklist-${tipo}`}
                  productoId={props.producto.id}
                  initialChecklist={checklistsPorTipo[tipo] ?? createEmptyChecklist(props.producto.id)}
                  plantillasPaso={props.plantillasPaso}
                  materiasPrimas={props.materiasPrimas}
                  routeStepOptions={tipo === "directa" ? pasosDirecta : tipo === "flexible_montado" ? pasosFlexible : pasosCombinados}
                  onSaved={() => {}}
                  onSaveChecklist={handleSave}
                  onDirtyChange={setDirty}
                />
              </TabsContent>
            ))}
          </Tabs>
        )
      }
    />
  );
}
