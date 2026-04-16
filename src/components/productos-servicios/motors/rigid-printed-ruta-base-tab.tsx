"use client";

import * as React from "react";
import { InfoIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import {
  getProductoMotorConfig,
  upsertProductoMotorConfig,
  updateProductoRutaPolicy,
} from "@/lib/productos-servicios-api";
import type { Proceso } from "@/lib/procesos";
import type { Maquina } from "@/lib/maquinaria";
import { getOperacionSummary } from "@/lib/proceso-operacion-values";

const PLANTILLAS_DIRECTA = new Set([
  "impresora_uv_mesa_extensora",
  "impresora_uv_flatbed",
]);

const PLANTILLAS_FLEXIBLE = new Set([
  "impresora_uv_mesa_extensora",
  "impresora_uv_flatbed",
  "impresora_uv_rollo",
  "impresora_solvente",
  "impresora_latex",
  "impresora_inyeccion_tinta",
  "impresora_sublimacion_gran_formato",
  "plotter_de_corte",
  "mesa_de_corte",
]);

type RigidPrintedConfig = {
  tiposImpresion: string[];
  rutaImpresionDirectaId: string | null;
  rutaFlexibleMontadoId: string | null;
  [key: string]: unknown;
};

const TIPO_LABELS: Record<string, string> = {
  directa: "Impresión directa",
  flexible_montado: "Sustrato flexible montado",
};

export function RigidPrintedRutaBaseTab(props: ProductTabProps) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [config, setConfig] = React.useState<RigidPrintedConfig | null>(null);
  const [rutaDirectaId, setRutaDirectaId] = React.useState<string>("");
  const [rutaFlexibleId, setRutaFlexibleId] = React.useState<string>("");

  const procesos = (props.procesos ?? []) as Proceso[];
  const maquinas = (props.maquinas ?? []) as Maquina[];

  const maquinaPlantillaMap = React.useMemo(
    () => new Map(maquinas.map((m) => [m.id, m.plantilla])),
    [maquinas],
  );

  const procesoItems = React.useMemo(
    () => procesos.filter((p) => p.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [procesos],
  );

  const procesosDirecta = React.useMemo(
    () => procesoItems.filter((p) =>
      p.operaciones.some((op) => {
        const summary = getOperacionSummary(op);
        return summary.maquinaIdsDistintos.some((mid) => {
          const plantilla = maquinaPlantillaMap.get(mid);
          return plantilla && PLANTILLAS_DIRECTA.has(plantilla);
        });
      }),
    ),
    [procesoItems, maquinaPlantillaMap],
  );

  const procesosFlexible = React.useMemo(
    () => procesoItems.filter((p) =>
      p.operaciones.some((op) => {
        const summary = getOperacionSummary(op);
        return summary.maquinaIdsDistintos.some((mid) => {
          const plantilla = maquinaPlantillaMap.get(mid);
          return plantilla && PLANTILLAS_FLEXIBLE.has(plantilla);
        });
      }),
    ),
    [procesoItems, maquinaPlantillaMap],
  );

  const loadConfig = React.useCallback(async () => {
    try {
      setLoading(true);
      const result = await getProductoMotorConfig(props.producto.id);
      const params = (result?.parametros ?? {}) as RigidPrintedConfig;
      setConfig(params);
      setRutaDirectaId(params.rutaImpresionDirectaId ?? "");
      setRutaFlexibleId(params.rutaFlexibleMontadoId ?? "");
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar configuración.");
    } finally {
      setLoading(false);
    }
  }, [props.producto.id]);

  React.useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = React.useCallback(async () => {
    if (!config) return;
    try {
      setSaving(true);
      // Guardar las rutas en el motor config
      await upsertProductoMotorConfig(props.producto.id, {
        ...config,
        rutaImpresionDirectaId: rutaDirectaId || null,
        rutaFlexibleMontadoId: rutaFlexibleId || null,
      });
      // También asignar la ruta principal del producto (la de directa o la primera disponible)
      const rutaPrincipal = rutaDirectaId || rutaFlexibleId || null;
      await updateProductoRutaPolicy(props.producto.id, {
        usarRutaComunVariantes: true,
        procesoDefinicionDefaultId: rutaPrincipal,
      });
      await loadConfig();
      await props.refreshProducto();
      await props.refreshMotorConfig();
      toast.success("Rutas guardadas.");
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar.");
    } finally {
      setSaving(false);
    }
  }, [config, rutaDirectaId, rutaFlexibleId, props.producto.id, loadConfig, props.refreshProducto, props.refreshMotorConfig]);

  const tiposActivos = config?.tiposImpresion ?? [];
  const tieneDirecta = tiposActivos.includes("directa");
  const tieneFlexible = tiposActivos.includes("flexible_montado");
  const soloUnTipo = tiposActivos.length === 1;

  const procesoDirecta = procesoItems.find((p) => p.id === rutaDirectaId);
  const procesoFlexible = procesoItems.find((p) => p.id === rutaFlexibleId);

  if (loading) {
    return <GdiSpinner />;
  }

  if (tiposActivos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ruta base</CardTitle>
          <CardDescription>
            Primero activá al menos un tipo de impresión en el tab Tecnologías.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ruta base</CardTitle>
        <CardDescription>
          {soloUnTipo
            ? "Ruta de producción para este producto."
            : "Una ruta de producción por cada tipo de impresión."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Impresión directa */}
        {tieneDirecta && (
          <ProductoTabSection
            title={soloUnTipo ? "Ruta de producción" : "Ruta — Impresión directa"}
            description={soloUnTipo ? "Ruta de producción asignado al producto." : "Ruta cuando se imprime directo sobre el rígido."}
            icon={InfoIcon}
          >
            <div className="space-y-3">
              <div>
                <Label>Ruta de producción</Label>
                <Select
                  value={rutaDirectaId}
                  onValueChange={(v) => setRutaDirectaId(v ?? "")}
                >
                  <SelectTrigger className="mt-1 max-w-md">
                    <SelectValue placeholder="Seleccionar ruta">
                      {procesoDirecta?.nombre ?? "Seleccionar ruta"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {procesosDirecta.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {procesosDirecta.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">No hay rutas con máquinas de impresión directa configuradas.</p>
                )}
              </div>
              {procesoDirecta && (
                <ProcesoOperacionesPreview proceso={procesoDirecta} />
              )}
            </div>
          </ProductoTabSection>
        )}

        {/* Sustrato flexible montado */}
        {tieneFlexible && (
          <ProductoTabSection
            title={soloUnTipo ? "Ruta de producción" : "Ruta — Sustrato flexible montado"}
            description={soloUnTipo ? "Ruta de producción asignado al producto." : "Ruta cuando se imprime en sustrato flexible y se monta."}
            icon={InfoIcon}
          >
            <div className="space-y-3">
              <div>
                <Label>Ruta de producción</Label>
                <Select
                  value={rutaFlexibleId}
                  onValueChange={(v) => setRutaFlexibleId(v ?? "")}
                >
                  <SelectTrigger className="mt-1 max-w-md">
                    <SelectValue placeholder="Seleccionar ruta">
                      {procesoFlexible?.nombre ?? "Seleccionar ruta"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {procesosFlexible.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {procesosFlexible.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">No hay rutas con máquinas de impresión en sustrato flexible configuradas.</p>
                )}
              </div>
              {procesoFlexible && (
                <ProcesoOperacionesPreview proceso={procesoFlexible} />
              )}
            </div>
          </ProductoTabSection>
        )}

        {/* Guardar */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>Guardando...</>
            ) : (
              <><SaveIcon className="h-4 w-4 mr-1" /> Guardar rutas</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Preview de operaciones del proceso ────────────────────────────

function ProcesoOperacionesPreview({ proceso }: { proceso: Proceso }) {
  const operaciones = proceso.operaciones ?? [];
  if (operaciones.length === 0) {
    return <p className="text-xs text-muted-foreground">Este proceso no tiene operaciones definidas.</p>;
  }

  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-muted-foreground mb-1">Operaciones:</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Operación</TableHead>
            <TableHead>Centro de costo</TableHead>
            <TableHead className="w-20 text-right">Mult. DF</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {operaciones.map((op) => (
            <TableRow key={op.id}>
              <TableCell className="text-xs">{op.orden}</TableCell>
              <TableCell className="text-xs">{op.nombre}</TableCell>
              <TableCell className="text-xs">{op.centroCostoNombre ?? "—"}</TableCell>
              <TableCell className="text-xs text-right">
                {op.multiplicadorDobleFaz != null && op.multiplicadorDobleFaz !== 1
                  ? `×${op.multiplicadorDobleFaz}`
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
