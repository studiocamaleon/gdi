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
import type { MateriaPrima } from "@/lib/materias-primas";
import {
  nestRectangularGrid,
  calculatePlatesNeeded,
  calcularCosteoPreview,
  type NestingResult,
  type CosteoPreview,
} from "./rigid-printed-nesting.helpers";

// ── Tipos ─────────────────────────────────────────────────────────

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
  materialRigidoId: string | null;
  variantesCompatibles: string[];
  placaVarianteIdDefault: string | null;
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
  { value: "rigido_manda", label: "Rígido manda" },
  { value: "flexible_manda", label: "Flexible manda" },
  { value: "independientes", label: "Independientes" },
];

// ── SVG Colors ────────────────────────────────────────────────────

const PLACA_COLOR = "#e0e7ef";
const PIEZA_COLOR = "#3b82f6";
const PIEZA_STROKE = "#1e40af";
const SOBRANTE_COLOR = "#cbd5e1";
const SOBRANTE_STROKE = "#94a3b8";
const COBRADO_COLOR = "#fef3c7"; // amarillo claro para área cobrada

// ── Componente ────────────────────────────────────────────────────

export function RigidPrintedImposicionTab(props: ProductTabProps) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [config, setConfig] = React.useState<RigidPrintedConfig | null>(null);
  const [imposicion, setImposicion] = React.useState<ImposicionConfig>(DEFAULT_IMPOSICION);

  // Simulación
  const [anchoMm, setAnchoMm] = React.useState<number>(0);
  const [altoMm, setAltoMm] = React.useState<number>(0);
  const [cantidad, setCantidad] = React.useState<number>(10);

  const materiasPrimas = (props.materiasPrimas ?? []) as MateriaPrima[];

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

  // Resolver placa seleccionada
  const placaInfo = React.useMemo(() => {
    if (!config?.materialRigidoId) return null;
    const mat = materiasPrimas.find((m) => m.id === config.materialRigidoId);
    if (!mat) return null;

    const compatibles = new Set(config.variantesCompatibles ?? []);
    const variantes = (mat.variantes ?? []).filter((v) => compatibles.has(v.id));
    // Usar la primera variante compatible o la default
    const defaultId = config.placaVarianteIdDefault;
    const placa = defaultId
      ? variantes.find((v) => v.id === defaultId) ?? variantes[0]
      : variantes[0];
    if (!placa) return null;

    const attrs = (placa.atributosVariante ?? {}) as Record<string, unknown>;
    const anchoRaw = Number(attrs.ancho ?? 0);
    const altoRaw = Number(attrs.alto ?? 0);
    return {
      id: placa.id,
      anchoMm: anchoRaw < 10 ? Math.round(anchoRaw * 1000) : anchoRaw,
      altoMm: altoRaw < 10 ? Math.round(altoRaw * 1000) : altoRaw,
      precio: Number(placa.precioReferencia ?? 0),
      label: `${anchoRaw < 10 ? Math.round(anchoRaw * 1000) : anchoRaw} × ${altoRaw < 10 ? Math.round(altoRaw * 1000) : altoRaw} mm`,
    };
  }, [config, materiasPrimas]);

  // Nesting + costeo preview
  const preview = React.useMemo<{
    nesting: NestingResult;
    plates: { placas: number; sobrantes: number };
    costeo: CosteoPreview;
  } | null>(() => {
    if (!placaInfo || anchoMm <= 0 || altoMm <= 0) return null;

    const nesting = nestRectangularGrid(
      anchoMm, altoMm,
      placaInfo.anchoMm, placaInfo.altoMm,
      imposicion.separacionHorizontalMm,
      imposicion.separacionVerticalMm,
      imposicion.margenPlacaMm,
      imposicion.permitirRotacion,
    );
    const plates = calculatePlatesNeeded(cantidad, nesting.piezasPorPlaca);
    const costeo = calcularCosteoPreview(
      imposicion.estrategiaCosteo,
      placaInfo.precio,
      placaInfo.anchoMm,
      placaInfo.altoMm,
      anchoMm, altoMm,
      cantidad,
      nesting.piezasPorPlaca,
      imposicion.segmentosPlaca,
    );

    return { nesting, plates, costeo };
  }, [placaInfo, anchoMm, altoMm, cantidad, imposicion]);

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
              <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
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

        {imposicion.estrategiaCosteo === "segmentos_placa" && (
          <div className="mt-4">
            <Label className="text-xs">Escalones (%)</Label>
            <div className="flex gap-2 mt-1 items-center flex-wrap">
              {imposicion.segmentosPlaca.map((seg, i) => (
                <Badge key={i} variant="secondary" className="text-sm py-1 px-3">{seg}%</Badge>
              ))}
            </div>
            <Input
              type="text"
              className="w-48 mt-2"
              placeholder="Ej: 25, 50, 75, 100"
              defaultValue={imposicion.segmentosPlaca.join(", ")}
              onBlur={(e) => {
                const vals = e.target.value.split(",").map((s) => Number(s.trim())).filter((n) => n > 0 && n <= 100).sort((a, b) => a - b);
                if (vals.length > 0) setImposicion((prev) => ({ ...prev, segmentosPlaca: vals }));
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">Se cobra el primer escalón ≥ al % de ocupación.</p>
          </div>
        )}
      </ProductoTabSection>

      {/* ── Parámetros ── */}
      <ProductoTabSection
        title="Parámetros de imposición"
        description="Configuración del acomodamiento de piezas en placa."
      >
        <div className="grid grid-cols-2 gap-4 max-w-lg">
          <div>
            <Label>Separación horizontal (mm)</Label>
            <Input type="number" className="mt-1" value={imposicion.separacionHorizontalMm}
              onChange={(e) => setImposicion((prev) => ({ ...prev, separacionHorizontalMm: Number(e.target.value) || 0 }))} />
          </div>
          <div>
            <Label>Separación vertical (mm)</Label>
            <Input type="number" className="mt-1" value={imposicion.separacionVerticalMm}
              onChange={(e) => setImposicion((prev) => ({ ...prev, separacionVerticalMm: Number(e.target.value) || 0 }))} />
          </div>
          <div>
            <Label>Margen de placa (mm)</Label>
            <Input type="number" className="mt-1" value={imposicion.margenPlacaMm}
              onChange={(e) => setImposicion((prev) => ({ ...prev, margenPlacaMm: Number(e.target.value) || 0 }))} />
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <Switch checked={imposicion.permitirRotacion}
                onCheckedChange={(v) => setImposicion((prev) => ({ ...prev, permitirRotacion: v }))} />
              <Label>Permitir rotación 90°</Label>
            </div>
          </div>
        </div>

        {tieneFlexible && (
          <div className="mt-4">
            <Label>Prioridad de optimización</Label>
            <Select value={imposicion.prioridadNesting}
              onValueChange={(v) => setImposicion((prev) => ({ ...prev, prioridadNesting: v || prev.prioridadNesting }))}>
              <SelectTrigger className="max-w-sm mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar configuración"}
          </Button>
        </div>
      </ProductoTabSection>

      {/* ── Simulación visual ── */}
      <ProductoTabSection
        title="Simulación de imposición"
        description={placaInfo ? `Placa: ${placaInfo.label} · $${placaInfo.precio.toLocaleString("es-AR")}` : "Configurá un material en el tab Tecnologías."}
      >
        {!placaInfo ? (
          <p className="text-sm text-muted-foreground">No hay placa configurada.</p>
        ) : (
          <>
            <div className="flex gap-4 items-end mb-4">
              <div>
                <Label>Ancho pieza (cm)</Label>
                <Input type="number" className="mt-1 w-28"
                  value={anchoMm ? anchoMm / 10 : ""}
                  onChange={(e) => setAnchoMm(Math.round((Number(e.target.value) || 0) * 10))} />
              </div>
              <div>
                <Label>Alto pieza (cm)</Label>
                <Input type="number" className="mt-1 w-28"
                  value={altoMm ? altoMm / 10 : ""}
                  onChange={(e) => setAltoMm(Math.round((Number(e.target.value) || 0) * 10))} />
              </div>
              <div>
                <Label>Cantidad</Label>
                <Input type="number" className="mt-1 w-24" value={cantidad}
                  onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))} />
              </div>
            </div>

            {preview && (
              <>
                {/* Indicadores */}
                <div className="flex gap-3 mb-4 flex-wrap">
                  <Badge variant="secondary" className="text-sm py-1 px-3">
                    {preview.nesting.piezasPorPlaca} piezas/placa
                  </Badge>
                  <Badge variant="secondary" className="text-sm py-1 px-3">
                    {preview.nesting.columnas}×{preview.nesting.filas}
                  </Badge>
                  <Badge variant="secondary" className="text-sm py-1 px-3">
                    {preview.nesting.aprovechamientoPct}% aprov.
                  </Badge>
                  {preview.nesting.rotada && (
                    <Badge variant="outline" className="text-sm py-1 px-3">Rotado 90°</Badge>
                  )}
                  <Badge className="text-sm py-1 px-3">
                    {preview.plates.placas} placa{preview.plates.placas !== 1 ? "s" : ""}
                  </Badge>
                  {preview.costeo.costoTotal > 0 && (
                    <Badge variant="default" className="text-sm py-1 px-3 bg-emerald-600">
                      Material: ${preview.costeo.costoTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </Badge>
                  )}
                  {preview.costeo.segmentoAplicado != null && (
                    <Badge variant="outline" className="text-sm py-1 px-3">
                      Última placa: {preview.costeo.ultimaPlacaPct}% → cobra {preview.costeo.segmentoAplicado}%
                    </Badge>
                  )}
                </div>

                {/* SVG */}
                {preview.nesting.piezasPorPlaca > 0 && (
                  <PlacaSvg
                    placaAnchoMm={placaInfo.anchoMm}
                    placaAltoMm={placaInfo.altoMm}
                    posiciones={preview.nesting.posiciones}
                    cantidadPedida={cantidad}
                    estrategia={imposicion.estrategiaCosteo}
                    largoConsumidoMm={preview.nesting.largoConsumidoMm}
                  />
                )}
                {preview.nesting.piezasPorPlaca === 0 && (
                  <p className="text-sm text-destructive">La pieza no cabe en la placa.</p>
                )}
              </>
            )}
          </>
        )}
      </ProductoTabSection>
    </div>
  );
}

// ── SVG de placa ──────────────────────────────────────────────────

function PlacaSvg({
  placaAnchoMm,
  placaAltoMm,
  posiciones,
  cantidadPedida,
  estrategia,
  largoConsumidoMm,
}: {
  placaAnchoMm: number;
  placaAltoMm: number;
  posiciones: Array<{ x: number; y: number; anchoMm: number; altoMm: number }>;
  cantidadPedida: number;
  estrategia: string;
  largoConsumidoMm: number;
}) {
  const maxWidth = 600;
  const scale = maxWidth / placaAnchoMm;
  const svgW = placaAnchoMm * scale;
  const svgH = placaAltoMm * scale;

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${placaAnchoMm} ${placaAltoMm}`} className="border rounded bg-white">
      {/* Placa */}
      <rect x={0} y={0} width={placaAnchoMm} height={placaAltoMm}
        fill={PLACA_COLOR} stroke="#94a3b8" strokeWidth={1} />

      {/* Área cobrada (largo consumido) */}
      {estrategia === "largo_consumido" && largoConsumidoMm > 0 && (
        <rect x={0} y={0} width={placaAnchoMm} height={Math.min(largoConsumidoMm, placaAltoMm)}
          fill={COBRADO_COLOR} stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="4 2" />
      )}

      {/* Piezas */}
      {posiciones.map((pos, i) => {
        const esSobrante = i >= cantidadPedida;
        return (
          <rect key={i} x={pos.x} y={pos.y} width={pos.anchoMm} height={pos.altoMm}
            fill={esSobrante ? SOBRANTE_COLOR : PIEZA_COLOR}
            stroke={esSobrante ? SOBRANTE_STROKE : PIEZA_STROKE}
            strokeWidth={0.5} opacity={esSobrante ? 0.4 : 0.8} />
        );
      })}

      {/* Línea de corte largo consumido */}
      {estrategia === "largo_consumido" && largoConsumidoMm > 0 && largoConsumidoMm < placaAltoMm && (
        <line x1={0} y1={largoConsumidoMm} x2={placaAnchoMm} y2={largoConsumidoMm}
          stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" />
      )}
    </svg>
  );
}
