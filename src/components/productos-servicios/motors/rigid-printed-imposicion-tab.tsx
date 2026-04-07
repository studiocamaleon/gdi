"use client";

import * as React from "react";
import { toast } from "sonner";
import { InfoIcon, PlusIcon, Trash2Icon } from "lucide-react";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
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
import type { Maquina } from "@/lib/maquinaria";
import {
  nestMultiMedida,
  calcularCosteoFromNesting,
  type CosteoPreview,
  type MultiMedidaNestingResult,
  MEDIDA_COLORS,
} from "./rigid-printed-nesting.helpers";

// ── Tipos ─────────────────────────────────────────────────────────

type ImposicionConfig = {
  estrategiaCosteo: string;
  segmentosPlaca: number[];
  separacionHorizontalMm: number;
  separacionVerticalMm: number;
  permitirRotacion: boolean;
  prioridadNesting: string;
  orientacionPlaca: 'usar_lado_corto' | 'usar_lado_largo';
  /** Márgenes no imprimibles de la máquina (mm). Override sobre defaults de la máquina. */
  margenMaquina: {
    arriba: number;
    abajo: number;
    izquierda: number;
    derecha: number;
  };
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
  permitirRotacion: true,
  prioridadNesting: "rigido_manda",
  orientacionPlaca: "usar_lado_corto",
  margenMaquina: { arriba: 0, abajo: 0, izquierda: 0, derecha: 0 },
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

const ORIENTACION_OPTIONS = [
  { value: "usar_lado_corto", label: "Aprovechar ancho (lado corto)" },
  { value: "usar_lado_largo", label: "Aprovechar largo (lado largo)" },
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

  // Simulación — medidas dinámicas (mismo patrón que Simular Costo)
  type MedidaRow = { anchoMm: number | null; altoMm: number | null; cantidad: number };
  const [medidas, setMedidas] = React.useState<MedidaRow[]>([{ anchoMm: null, altoMm: null, cantidad: 1 }]);
  const fmtMmAsCm = (v: number | null) => (v != null && Number.isFinite(v) ? String(Number((v / 10).toFixed(2))) : "");

  const materiasPrimas = (props.materiasPrimas ?? []) as MateriaPrima[];
  const maquinas = (props.maquinas ?? []) as Maquina[];

  const loadConfig = React.useCallback(async () => {
    try {
      setLoading(true);
      const result = await getProductoMotorConfig(props.producto.id);
      const params = (result?.parametros ?? {}) as RigidPrintedConfig;
      setConfig(params);

      let imp = params.imposicion ?? DEFAULT_IMPOSICION;

      // Auto-completar márgenes de máquina si son todos 0
      const mg = imp.margenMaquina;
      const todosEnCero = !mg || (mg.arriba === 0 && mg.abajo === 0 && mg.izquierda === 0 && mg.derecha === 0);
      if (todosEnCero) {
        const directaCfg = (params as Record<string, unknown>).impresionDirecta as Record<string, unknown> | undefined;
        const maquinaId = (directaCfg?.maquinaDefaultId ?? ((directaCfg?.maquinasCompatibles as string[]) ?? [])[0]) as string | undefined;
        if (maquinaId) {
          const maquina = maquinas.find((m) => m.id === maquinaId);
          const pt = (maquina?.parametrosTecnicos ?? {}) as Record<string, unknown>;
          // Márgenes de máquina están en cm → convertir a mm
        const mgDefault = {
            arriba: Math.round(Number(pt.margenSuperior ?? 0) * 10),
            abajo: Math.round(Number(pt.margenInferior ?? 0) * 10),
            izquierda: Math.round(Number(pt.margenIzquierdo ?? 0) * 10),
            derecha: Math.round(Number(pt.margenDerecho ?? 0) * 10),
          };
          if (mgDefault.arriba > 0 || mgDefault.abajo > 0 || mgDefault.izquierda > 0 || mgDefault.derecha > 0) {
            imp = { ...imp, margenMaquina: mgDefault };
          }
        }
      }

      setImposicion(imp);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar configuración.");
    } finally {
      setLoading(false);
    }
  }, [props.producto.id, maquinas]);

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
    multiNesting: MultiMedidaNestingResult;
    placaAnchoTrabajo: number;
    placaLargoTrabajo: number;
    margenMaquina: { arriba: number; abajo: number; izquierda: number; derecha: number };
    costeo: CosteoPreview;
  } | null>(() => {
    const validMedidas = medidas.filter((m) => m.anchoMm && m.anchoMm > 0 && m.altoMm && m.altoMm > 0);
    if (!placaInfo || validMedidas.length === 0) return null;

    // Orientación de placa: el "ancho de trabajo" es el lado elegido por el admin
    const ladoCorto = Math.min(placaInfo.anchoMm, placaInfo.altoMm);
    const ladoLargo = Math.max(placaInfo.anchoMm, placaInfo.altoMm);
    const placaAnchoTrabajo = imposicion.orientacionPlaca === "usar_lado_largo" ? ladoLargo : ladoCorto;
    const placaLargoTrabajo = imposicion.orientacionPlaca === "usar_lado_largo" ? ladoCorto : ladoLargo;

    const mg = imposicion.margenMaquina ?? { arriba: 0, abajo: 0, izquierda: 0, derecha: 0 };
    const areaImprimibleAncho = placaAnchoTrabajo - mg.izquierda - mg.derecha;
    const areaImprimibleAlto = placaLargoTrabajo - mg.arriba - mg.abajo;

    // Multi-medida nesting
    const multiNesting = nestMultiMedida(
      validMedidas.map((m) => ({ anchoMm: m.anchoMm!, altoMm: m.altoMm!, cantidad: m.cantidad })),
      areaImprimibleAncho,
      areaImprimibleAlto,
      imposicion.separacionHorizontalMm,
      imposicion.separacionVerticalMm,
      0,
      imposicion.permitirRotacion,
      imposicion.orientacionPlaca ?? 'usar_lado_corto',
    );

    // Desplazar posiciones por márgenes de máquina
    const desplazadas: MultiMedidaNestingResult = {
      ...multiNesting,
      posiciones: multiNesting.posiciones.map((pos) => ({
        ...pos,
        x: pos.x + mg.izquierda,
        y: pos.y + mg.arriba,
      })),
      placaLayouts: multiNesting.placaLayouts.map((pl) => ({
        ...pl,
        posiciones: pl.posiciones.map((pos) => ({
          ...pos,
          x: pos.x + mg.izquierda,
          y: pos.y + mg.arriba,
        })),
      })),
    };

    // Costeo basado en resultado real del nesting
    const costeo = calcularCosteoFromNesting(
      imposicion.estrategiaCosteo,
      placaInfo.precio,
      placaAnchoTrabajo,
      placaLargoTrabajo,
      multiNesting,
      imposicion.segmentosPlaca,
    );

    return {
      multiNesting: desplazadas,
      costeo, placaAnchoTrabajo, placaLargoTrabajo,
      margenMaquina: mg,
    };
  }, [placaInfo, medidas, imposicion]);

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
            <SegmentosChipEditor
              valores={imposicion.segmentosPlaca}
              onChange={(vals) => setImposicion((prev) => ({ ...prev, segmentosPlaca: vals }))}
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
          <div className="col-span-2 flex items-center gap-2">
            <Switch checked={imposicion.permitirRotacion}
              onCheckedChange={(v) => setImposicion((prev) => ({ ...prev, permitirRotacion: v }))} />
            <Label>Permitir rotación 90°</Label>
          </div>
        </div>

        <div className="mt-4">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Márgenes no imprimibles de máquina (mm)
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            Override sobre los defaults de la máquina. Define el área que la máquina no puede imprimir.
          </p>
          <div className="grid grid-cols-4 gap-3 max-w-lg">
            <div>
              <Label className="text-xs">Arriba</Label>
              <Input type="number" className="mt-1" value={imposicion.margenMaquina?.arriba ?? 0}
                onChange={(e) => setImposicion((prev) => ({
                  ...prev,
                  margenMaquina: { ...(prev.margenMaquina ?? { arriba: 0, abajo: 0, izquierda: 0, derecha: 0 }), arriba: Number(e.target.value) || 0 },
                }))} />
            </div>
            <div>
              <Label className="text-xs">Abajo</Label>
              <Input type="number" className="mt-1" value={imposicion.margenMaquina?.abajo ?? 0}
                onChange={(e) => setImposicion((prev) => ({
                  ...prev,
                  margenMaquina: { ...(prev.margenMaquina ?? { arriba: 0, abajo: 0, izquierda: 0, derecha: 0 }), abajo: Number(e.target.value) || 0 },
                }))} />
            </div>
            <div>
              <Label className="text-xs">Izquierda</Label>
              <Input type="number" className="mt-1" value={imposicion.margenMaquina?.izquierda ?? 0}
                onChange={(e) => setImposicion((prev) => ({
                  ...prev,
                  margenMaquina: { ...(prev.margenMaquina ?? { arriba: 0, abajo: 0, izquierda: 0, derecha: 0 }), izquierda: Number(e.target.value) || 0 },
                }))} />
            </div>
            <div>
              <Label className="text-xs">Derecha</Label>
              <Input type="number" className="mt-1" value={imposicion.margenMaquina?.derecha ?? 0}
                onChange={(e) => setImposicion((prev) => ({
                  ...prev,
                  margenMaquina: { ...(prev.margenMaquina ?? { arriba: 0, abajo: 0, izquierda: 0, derecha: 0 }), derecha: Number(e.target.value) || 0 },
                }))} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-lg mt-4">
          <div>
            <Label>Aprovechamiento de placa</Label>
            <Select
              value={imposicion.orientacionPlaca ?? "usar_lado_corto"}
              onValueChange={(v) => setImposicion((prev) => ({ ...prev, orientacionPlaca: (v || "usar_lado_corto") as ImposicionConfig["orientacionPlaca"] }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue>
                  {ORIENTACION_OPTIONS.find((o) => o.value === (imposicion.orientacionPlaca ?? "usar_lado_corto"))?.label ?? "Aprovechar ancho"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ORIENTACION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Aprovechar ancho = llenar el lado corto primero. Aprovechar largo = llenar el lado largo primero.</p>
          </div>

          {tieneFlexible && (
            <div>
              <Label>Prioridad de nesting</Label>
              <Select
                value={imposicion.prioridadNesting}
                onValueChange={(v) => setImposicion((prev) => ({ ...prev, prioridadNesting: v || prev.prioridadNesting }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue>
                    {PRIORIDADES.find((p) => p.value === imposicion.prioridadNesting)?.label ?? "Rígido manda"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Cuál layout se prioriza cuando hay rígido + flexible.</p>
            </div>
          )}
        </div>

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
            {/* Medidas dinámicas (mismo layout que Simular Costo) */}
            <div className="rounded-lg border p-3 mb-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Medidas del trabajo</p>
              </div>
              <div className="space-y-2">
                <div className="hidden gap-2 px-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_40px_40px]">
                  <span>Ancho (cm)</span>
                  <span>Alto (cm)</span>
                  <span>Cantidad</span>
                  <span />
                  <span />
                </div>
                {medidas.map((medida, index) => (
                  <div key={`imp-medida-${index}`} className="grid gap-2 rounded-lg border p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_40px_40px]">
                    <Field>
                      <Input
                        aria-label={`Ancho (cm) fila ${index + 1}`}
                        placeholder="30"
                        value={fmtMmAsCm(medida.anchoMm)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMedidas((prev) => prev.map((item, i) =>
                            i === index ? { ...item, anchoMm: v.trim() ? Math.round(Number(v) * 10) : null } : item));
                        }}
                      />
                    </Field>
                    <Field>
                      <Input
                        aria-label={`Alto (cm) fila ${index + 1}`}
                        placeholder="40"
                        value={fmtMmAsCm(medida.altoMm)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMedidas((prev) => prev.map((item, i) =>
                            i === index ? { ...item, altoMm: v.trim() ? Math.round(Number(v) * 10) : null } : item));
                        }}
                      />
                    </Field>
                    <Field>
                      <Input
                        aria-label={`Cantidad fila ${index + 1}`}
                        type="number"
                        min={1}
                        value={medida.cantidad}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setMedidas((prev) => prev.map((item, i) =>
                            i === index ? { ...item, cantidad: Number.isFinite(v) && v > 0 ? v : 1 } : item));
                        }}
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button type="button" variant="ghost" size="icon" aria-label="Agregar medida"
                        onClick={() => setMedidas((prev) => [...prev, { anchoMm: null, altoMm: null, cantidad: 1 }])}>
                        <PlusIcon className="size-4" />
                      </Button>
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="ghost" size="icon" disabled={medidas.length === 1}
                        onClick={() => setMedidas((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== index))}>
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {preview && (
              <>
                {/* Indicadores */}
                <div className="flex gap-3 mb-4 flex-wrap">
                  <Badge className="text-sm py-1 px-3">
                    {preview.multiNesting.placas} placa{preview.multiNesting.placas !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="secondary" className="text-sm py-1 px-3">
                    {preview.multiNesting.totalPiezas} piezas
                  </Badge>
                  {preview.costeo.costoTotal > 0 && (
                    <Badge variant="default" className="text-sm py-1 px-3 bg-emerald-600">
                      Material: ${preview.costeo.costoTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </Badge>
                  )}
                </div>

                {/* Leyenda de medidas */}
                {medidas.filter((m) => m.anchoMm && m.altoMm).length > 1 && (
                  <div className="flex gap-3 mb-3 flex-wrap text-xs">
                    {medidas.filter((m) => m.anchoMm && m.altoMm).map((m, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: MEDIDA_COLORS[i % MEDIDA_COLORS.length], opacity: 0.85 }} />
                        <span>{(m.anchoMm! / 10)} × {(m.altoMm! / 10)} cm × {m.cantidad}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* SVG por placa */}
                {preview.multiNesting.placaLayouts.map((layout, pi) => (
                  <div key={pi} className={preview.multiNesting.placas > 1 ? "mb-4" : ""}>
                    {preview.multiNesting.placas > 1 && (
                      <p className="text-xs text-muted-foreground mb-1">Placa {pi + 1}</p>
                    )}
                    <MultiMedidaPlacaSvg
                      placaAnchoMm={preview.placaAnchoTrabajo}
                      placaAltoMm={preview.placaLargoTrabajo}
                      posiciones={layout.posiciones}
                      largoConsumidoMm={layout.largoConsumidoMm}
                      estrategia={imposicion.estrategiaCosteo}
                      segmentoAplicadoPct={preview.costeo.segmentoAplicado}
                      margenMaquina={preview.margenMaquina}
                    />
                  </div>
                ))}

                {preview.multiNesting.totalPiezas === 0 && (
                  <p className="text-sm text-destructive">Las piezas no caben en la placa.</p>
                )}
              </>
            )}
          </>
        )}
      </ProductoTabSection>
    </div>
  );
}

// ── Chip editor para segmentos ─────────────────────────────────────

function SegmentosChipEditor({
  valores,
  onChange,
}: {
  valores: number[];
  onChange: (vals: number[]) => void;
}) {
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const sorted = React.useMemo(() => [...valores].sort((a, b) => a - b), [valores]);

  const addValue = React.useCallback(() => {
    const num = Number(inputValue.trim());
    if (num > 0 && num <= 100 && !valores.includes(num)) {
      onChange([...valores, num].sort((a, b) => a - b));
    }
    setInputValue("");
    inputRef.current?.focus();
  }, [inputValue, valores, onChange]);

  const removeValue = React.useCallback((val: number) => {
    onChange(valores.filter((v) => v !== val));
  }, [valores, onChange]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      addValue();
    }
    if (e.key === "Backspace" && inputValue === "" && valores.length > 0) {
      onChange(valores.slice(0, -1));
    }
  }, [addValue, inputValue, valores, onChange]);

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 mt-1 p-2 rounded-md border bg-background min-h-[40px] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {sorted.map((val) => (
        <span
          key={val}
          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-sm font-medium"
        >
          {val}%
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeValue(val); }}
            className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="number"
        min={1}
        max={100}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputValue.trim()) addValue(); }}
        placeholder={sorted.length === 0 ? "Ingresá un % y presioná Enter" : "Agregar %"}
        className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}

// ── SVG de placa ──────────────────────────────────────────────────

function MultiMedidaPlacaSvg({
  placaAnchoMm,
  placaAltoMm,
  posiciones,
  largoConsumidoMm,
  estrategia,
  segmentoAplicadoPct,
  margenMaquina,
}: {
  placaAnchoMm: number;
  placaAltoMm: number;
  posiciones: Array<{ x: number; y: number; anchoMm: number; altoMm: number; medidaIndex: number }>;
  largoConsumidoMm: number;
  estrategia: string;
  segmentoAplicadoPct: number | null;
  margenMaquina: { arriba: number; abajo: number; izquierda: number; derecha: number };
}) {
  const needsRotate = placaAltoMm > placaAnchoMm;
  const displayW = needsRotate ? placaAltoMm : placaAnchoMm;
  const displayH = needsRotate ? placaAnchoMm : placaAltoMm;
  const maxWidth = 600;
  const scale = maxWidth / displayW;
  const svgW = displayW * scale;
  const svgH = displayH * scale;

  const mg = needsRotate
    ? { arriba: margenMaquina.izquierda, abajo: margenMaquina.derecha, izquierda: margenMaquina.abajo, derecha: margenMaquina.arriba }
    : margenMaquina;

  const displayPositions = needsRotate
    ? posiciones.map((pos) => ({ ...pos, x: pos.y, y: placaAnchoMm - pos.x - pos.anchoMm, anchoMm: pos.altoMm, altoMm: pos.anchoMm }))
    : posiciones;

  // Área cobrada
  let cobradoW = 0, cobradoH = 0;
  if (estrategia === "largo_consumido") {
    if (needsRotate) { cobradoW = Math.min(largoConsumidoMm, displayW); cobradoH = displayH; }
    else { cobradoW = displayW; cobradoH = Math.min(largoConsumidoMm, displayH); }
  } else if (estrategia === "segmentos_placa" && segmentoAplicadoPct != null) {
    const f = segmentoAplicadoPct / 100;
    if (needsRotate) { cobradoW = displayW * f; cobradoH = displayH; }
    else { cobradoW = displayW; cobradoH = displayH * f; }
  }

  const MARGEN_COLOR = "#fecaca";
  const LIBRE_COLOR = "#e0e7ef";
  const DESPERDICIO_COLOR = "#fbbf24";

  return (
    <div className="space-y-2">
      <svg width={svgW} height={svgH} viewBox={`0 0 ${displayW} ${displayH}`} className="border rounded bg-white">
        <rect x={0} y={0} width={displayW} height={displayH} fill={LIBRE_COLOR} stroke="#94a3b8" strokeWidth={1} />
        {mg.arriba > 0 && <rect x={0} y={0} width={displayW} height={mg.arriba} fill={MARGEN_COLOR} opacity={0.8} />}
        {mg.abajo > 0 && <rect x={0} y={displayH - mg.abajo} width={displayW} height={mg.abajo} fill={MARGEN_COLOR} opacity={0.8} />}
        {mg.izquierda > 0 && <rect x={0} y={0} width={mg.izquierda} height={displayH} fill={MARGEN_COLOR} opacity={0.8} />}
        {mg.derecha > 0 && <rect x={displayW - mg.derecha} y={0} width={mg.derecha} height={displayH} fill={MARGEN_COLOR} opacity={0.8} />}
        {cobradoW > 0 && cobradoH > 0 && (
          <rect x={0} y={0} width={cobradoW} height={cobradoH} fill={DESPERDICIO_COLOR} opacity={0.5} stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="4 2" />
        )}
        {displayPositions.map((pos, i) => (
          <rect key={i} x={pos.x} y={pos.y} width={pos.anchoMm} height={pos.altoMm}
            fill={MEDIDA_COLORS[pos.medidaIndex % MEDIDA_COLORS.length]}
            stroke={MEDIDA_COLORS[pos.medidaIndex % MEDIDA_COLORS.length]}
            strokeWidth={0.5} opacity={0.85} />
        ))}
        {(mg.arriba > 0 || mg.abajo > 0 || mg.izquierda > 0 || mg.derecha > 0) && (
          <rect x={mg.izquierda} y={mg.arriba}
            width={displayW - mg.izquierda - mg.derecha} height={displayH - mg.arriba - mg.abajo}
            fill="none" stroke="#64748b" strokeWidth={0.5} strokeDasharray="2 2" />
        )}
      </svg>
      <div className="flex gap-4 flex-wrap text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: DESPERDICIO_COLOR, opacity: 0.5 }} /><span>Desperdicio cobrado</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: LIBRE_COLOR }} /><span>Espacio libre</span></div>
        {(mg.arriba > 0 || mg.abajo > 0 || mg.izquierda > 0 || mg.derecha > 0) && (
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: MARGEN_COLOR }} /><span>Margen no imprimible</span></div>
        )}
      </div>
    </div>
  );
}

function PlacaSvg({
  placaAnchoMm,
  placaAltoMm,
  posiciones,
  cantidadPedida,
  estrategia,
  largoConsumidoMm,
  segmentoAplicadoPct,
  margenMaquina,
}: {
  placaAnchoMm: number;
  placaAltoMm: number;
  posiciones: Array<{ x: number; y: number; anchoMm: number; altoMm: number }>;
  cantidadPedida: number;
  estrategia: string;
  largoConsumidoMm: number;
  segmentoAplicadoPct: number | null;
  margenMaquina: { arriba: number; abajo: number; izquierda: number; derecha: number };
}) {
  // Siempre dibujar lado largo horizontal
  const needsRotate = placaAltoMm > placaAnchoMm;
  const displayW = needsRotate ? placaAltoMm : placaAnchoMm;
  const displayH = needsRotate ? placaAnchoMm : placaAltoMm;

  const maxWidth = 600;
  const scale = maxWidth / displayW;
  const svgW = displayW * scale;
  const svgH = displayH * scale;

  // Rotar posiciones y márgenes si la placa se muestra rotada
  const mg = needsRotate
    ? { arriba: margenMaquina.izquierda, abajo: margenMaquina.derecha, izquierda: margenMaquina.abajo, derecha: margenMaquina.arriba }
    : margenMaquina;

  const displayPositions = needsRotate
    ? posiciones.map((pos) => ({
        x: pos.y,
        y: placaAnchoMm - pos.x - pos.anchoMm,
        anchoMm: pos.altoMm,
        altoMm: pos.anchoMm,
      }))
    : posiciones;

  // Bounding box de las piezas pedidas (para mostrar área de trabajo)
  const piezasPedidas = displayPositions.slice(0, cantidadPedida);
  const trabajoMaxX = piezasPedidas.reduce((max, p) => Math.max(max, p.x + p.anchoMm), 0);
  const trabajoMaxY = piezasPedidas.reduce((max, p) => Math.max(max, p.y + p.altoMm), 0);

  // Área cobrada según estrategia
  let cobradoW = 0;
  let cobradoH = 0;
  if (estrategia === "largo_consumido") {
    // Se cobra todo el ancho, hasta el largo consumido
    if (needsRotate) {
      cobradoW = Math.min(largoConsumidoMm, displayW);
      cobradoH = displayH;
    } else {
      cobradoW = displayW;
      cobradoH = Math.min(largoConsumidoMm, displayH);
    }
  } else if (estrategia === "segmentos_placa" && segmentoAplicadoPct != null) {
    // Se cobra un % de la placa → mostrar ese % como área
    // Distribuir proporcionalmente: cobrar desde el inicio hasta el % del largo
    const fraccion = segmentoAplicadoPct / 100;
    if (needsRotate) {
      cobradoW = displayW * fraccion;
      cobradoH = displayH;
    } else {
      cobradoW = displayW;
      cobradoH = displayH * fraccion;
    }
  } else if (estrategia === "m2_exacto") {
    // M² exacto: no hay desperdicio cobrado — solo se cobran las piezas
    // No mostrar área amarilla, las piezas azules son lo que se cobra
    cobradoW = 0;
    cobradoH = 0;
  }

  const MARGEN_COLOR = "#fecaca";     // rojo claro — no imprimible (consistente con otros módulos)
  const LIBRE_COLOR = "#e0e7ef";       // gris claro — espacio libre reutilizable
  const DESPERDICIO_COLOR = "#fbbf24"; // amarillo brillante — desperdicio cobrado
  const TRABAJO_COLOR = "#dbeafe";     // azul muy claro — zona de trabajo

  return (
    <div className="space-y-2">
      <svg width={svgW} height={svgH} viewBox={`0 0 ${displayW} ${displayH}`} className="border rounded bg-white">
        {/* 1. Placa completa (espacio libre reutilizable) */}
        <rect x={0} y={0} width={displayW} height={displayH}
          fill={LIBRE_COLOR} stroke="#94a3b8" strokeWidth={1} />

        {/* 2. Márgenes no imprimibles */}
        {mg.arriba > 0 && <rect x={0} y={0} width={displayW} height={mg.arriba} fill={MARGEN_COLOR} opacity={0.8} />}
        {mg.abajo > 0 && <rect x={0} y={displayH - mg.abajo} width={displayW} height={mg.abajo} fill={MARGEN_COLOR} opacity={0.8} />}
        {mg.izquierda > 0 && <rect x={0} y={0} width={mg.izquierda} height={displayH} fill={MARGEN_COLOR} opacity={0.8} />}
        {mg.derecha > 0 && <rect x={displayW - mg.derecha} y={0} width={mg.derecha} height={displayH} fill={MARGEN_COLOR} opacity={0.8} />}

        {/* 3. Área cobrada (desperdicio incluido) */}
        {cobradoW > 0 && cobradoH > 0 && (
          <rect x={0} y={0} width={cobradoW} height={cobradoH}
            fill={DESPERDICIO_COLOR} opacity={0.5} stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="4 2" />
        )}

        {/* 4. Piezas del trabajo (azul) */}
        {piezasPedidas.map((pos, i) => (
          <rect key={`work-${i}`} x={pos.x} y={pos.y} width={pos.anchoMm} height={pos.altoMm}
            fill={PIEZA_COLOR} stroke={PIEZA_STROKE} strokeWidth={0.5} opacity={0.85} />
        ))}

        {/* Línea de corte (largo consumido) */}
        {estrategia === "largo_consumido" && (
          needsRotate ? (
            cobradoW < displayW && (
              <line x1={cobradoW} y1={0} x2={cobradoW} y2={displayH}
                stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" />
            )
          ) : (
            cobradoH < displayH && (
              <line x1={0} y1={cobradoH} x2={displayW} y2={cobradoH}
                stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" />
            )
          )
        )}

        {/* Borde de márgenes de máquina */}
        {(mg.arriba > 0 || mg.abajo > 0 || mg.izquierda > 0 || mg.derecha > 0) && (
          <rect x={mg.izquierda} y={mg.arriba}
            width={displayW - mg.izquierda - mg.derecha}
            height={displayH - mg.arriba - mg.abajo}
            fill="none" stroke="#64748b" strokeWidth={0.5} strokeDasharray="2 2" />
        )}
      </svg>

      {/* Leyenda */}
      <div className="flex gap-4 flex-wrap text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PIEZA_COLOR, opacity: 0.85 }} />
          <span>Piezas del trabajo</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: DESPERDICIO_COLOR, opacity: 0.5 }} />
          <span>Desperdicio cobrado</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: LIBRE_COLOR }} />
          <span>Espacio libre (otro trabajo)</span>
        </div>
        {(mg.arriba > 0 || mg.abajo > 0 || mg.izquierda > 0 || mg.derecha > 0) && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: MARGEN_COLOR }} />
            <span>Margen no imprimible</span>
          </div>
        )}
      </div>
    </div>
  );
}
