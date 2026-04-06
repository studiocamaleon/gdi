"use client";

import * as React from "react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getProductoMotorConfig,
  upsertProductoMotorConfig,
} from "@/lib/productos-servicios-api";

type ImposicionConfig = {
  estrategiaCosteo: string;
  segmentosPlaca: number[];
  separacionHorizontalMm: number;
  separacionVerticalMm: number;
  margenPlacaMm: number;
  permitirRotacion: boolean;
  prioridadNesting: string;
};

type RigidPrintedConfig = {
  tiposImpresion: string[];
  imposicion: ImposicionConfig;
  [key: string]: unknown;
};

const DEFAULT_IMPOSICION: ImposicionConfig = {
  estrategiaCosteo: "segmentos_placa",
  segmentosPlaca: [25, 50, 75, 100],
  separacionHorizontalMm: 3,
  separacionVerticalMm: 3,
  margenPlacaMm: 5,
  permitirRotacion: true,
  prioridadNesting: "rigido_manda",
};

const ESTRATEGIAS = [
  { value: "m2_exacto", label: "M² exacto", desc: "Se cobra solo el área exacta utilizada" },
  { value: "largo_consumido", label: "Largo consumido", desc: "Se usa todo el ancho de placa, se cobra el largo consumido" },
  { value: "segmentos_placa", label: "Segmentos de placa", desc: "Se cobra por fracciones configurables de placa" },
];

const PRIORIDADES = [
  { value: "rigido_manda", label: "Rígido manda", desc: "Layout optimizado para la placa, el flexible se adapta" },
  { value: "flexible_manda", label: "Flexible manda", desc: "Layout optimizado para el rollo, el rígido se adapta" },
  { value: "independientes", label: "Independientes", desc: "Cada material se optimiza por separado" },
];

export function RigidPrintedImposicionTab(props: ProductTabProps) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [config, setConfig] = React.useState<RigidPrintedConfig | null>(null);
  const [imposicion, setImposicion] = React.useState<ImposicionConfig>(DEFAULT_IMPOSICION);

  const loadConfig = React.useCallback(async () => {
    try {
      setLoading(true);
      const result = await getProductoMotorConfig(props.producto.id);
      const params = (result?.parametros ?? {}) as RigidPrintedConfig;
      setConfig(params);
      setImposicion(params.imposicion ?? DEFAULT_IMPOSICION);
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
      await upsertProductoMotorConfig(props.producto.id, { ...config, imposicion });
      await loadConfig();
      toast.success("Configuración de imposición guardada.");
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar.");
    } finally {
      setSaving(false);
    }
  }, [config, imposicion, props.producto.id, loadConfig]);

  const tieneFlexible = (config?.tiposImpresion ?? []).includes("flexible_montado");

  if (loading) {
    return <GdiSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* ── Estrategia de costeo ── */}
      <ProductoTabSection
        title="Estrategia de costeo del material rígido"
        description="Cómo se calcula el costo del sustrato rígido en función del uso de placa."
      >
        <div className="space-y-3">
          {ESTRATEGIAS.map((e) => (
            <div
              key={e.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                imposicion.estrategiaCosteo === e.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
              onClick={() => setImposicion((prev) => ({ ...prev, estrategiaCosteo: e.value }))}
            >
              <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                imposicion.estrategiaCosteo === e.value ? "border-primary" : "border-muted-foreground/30"
              }`}>
                {imposicion.estrategiaCosteo === e.value && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{e.label}</p>
                <p className="text-xs text-muted-foreground">{e.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Segmentos configurables */}
        {imposicion.estrategiaCosteo === "segmentos_placa" && (
          <div className="mt-4">
            <Label className="text-xs">Escalones (%)</Label>
            <div className="flex gap-2 mt-1 items-center">
              {imposicion.segmentosPlaca.map((seg, i) => (
                <Badge key={i} variant="secondary" className="text-sm py-1 px-3">
                  {seg}%
                </Badge>
              ))}
              <Input
                type="text"
                className="w-48"
                placeholder="Ej: 25, 50, 75, 100"
                defaultValue={imposicion.segmentosPlaca.join(", ")}
                onBlur={(e) => {
                  const vals = e.target.value
                    .split(",")
                    .map((s) => Number(s.trim()))
                    .filter((n) => n > 0 && n <= 100)
                    .sort((a, b) => a - b);
                  if (vals.length > 0) {
                    setImposicion((prev) => ({ ...prev, segmentosPlaca: vals }));
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Se cobra el primer escalón ≥ al % de ocupación de la placa.
            </p>
          </div>
        )}
      </ProductoTabSection>

      {/* ── Parámetros de imposición ── */}
      <ProductoTabSection
        title="Parámetros de imposición"
        description="Configuración del acomodamiento de piezas en placa."
      >
        <div className="grid grid-cols-2 gap-4 max-w-lg">
          <div>
            <Label>Separación horizontal (mm)</Label>
            <Input
              type="number"
              className="mt-1"
              value={imposicion.separacionHorizontalMm}
              onChange={(e) =>
                setImposicion((prev) => ({ ...prev, separacionHorizontalMm: Number(e.target.value) || 0 }))
              }
            />
          </div>
          <div>
            <Label>Separación vertical (mm)</Label>
            <Input
              type="number"
              className="mt-1"
              value={imposicion.separacionVerticalMm}
              onChange={(e) =>
                setImposicion((prev) => ({ ...prev, separacionVerticalMm: Number(e.target.value) || 0 }))
              }
            />
          </div>
          <div>
            <Label>Margen de placa (mm)</Label>
            <Input
              type="number"
              className="mt-1"
              value={imposicion.margenPlacaMm}
              onChange={(e) =>
                setImposicion((prev) => ({ ...prev, margenPlacaMm: Number(e.target.value) || 0 }))
              }
            />
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <Switch
                checked={imposicion.permitirRotacion}
                onCheckedChange={(v) => setImposicion((prev) => ({ ...prev, permitirRotacion: v }))}
              />
              <Label>Permitir rotación 90°</Label>
            </div>
          </div>
        </div>
      </ProductoTabSection>

      {/* ── Prioridad de nesting (solo si flexible montado activo) ── */}
      {tieneFlexible && (
        <ProductoTabSection
          title="Prioridad de optimización"
          description="Cuándo hay rígido + sustrato flexible, cuál layout se prioriza."
        >
          <Select
            value={imposicion.prioridadNesting}
            onValueChange={(v) => setImposicion((prev) => ({ ...prev, prioridadNesting: v || prev.prioridadNesting }))}
          >
            <SelectTrigger className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORIDADES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  <div>
                    <span>{p.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">— {p.desc}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ProductoTabSection>
      )}

      {/* ── Simulación visual (TODO: implementar visualización 2D) ── */}
      <ProductoTabSection
        title="Simulación de imposición"
        description="Vista previa del acomodamiento de piezas en placa."
      >
        <p className="text-sm text-muted-foreground italic">
          La simulación visual 2D estará disponible próximamente.
        </p>
      </ProductoTabSection>

      {/* ── Guardar ── */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar configuración"}
        </Button>
      </div>
    </div>
  );
}
