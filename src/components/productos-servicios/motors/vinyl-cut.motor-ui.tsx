"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronRightIcon, EyeIcon, InfoIcon, PlusIcon, RefreshCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import type {
  ProductMotorUiContract,
  ProductTabProps,
} from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { VinylCutNestingWorkspace } from "@/components/vinyl-cut-nesting-workspace";
import { VinylCutRutaOpcionalesTab } from "@/components/productos-servicios/motors/vinyl-cut-ruta-opcionales-tab";
import { formatCurrency, formatNumber } from "@/components/productos-servicios/producto-comercial.helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { convertUnitValue } from "@/lib/unidades";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  cotizarProductoVariante,
  getProductoMotorConfig,
  previewVinylCutImposicionByProducto,
  upsertProductoMotorConfig,
} from "@/lib/productos-servicios-api";
import type { VinylCutColorEntry, VinylCutConfig } from "@/lib/productos-servicios";
import { getMateriaPrimaVarianteLabel, getVarianteOptionChips } from "@/lib/materias-primas-variantes-display";

// ─── Constants ──────────────────────────────────────────────────────────────

const CRITERIO_LABELS: Record<string, string> = {
  menor_costo_total: "Menor costo total",
  menor_largo_consumido: "Menor largo consumido",
  menor_desperdicio: "Menor desperdicio",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function newColorId() {
  return crypto.randomUUID();
}

function formatOrigenProcesoLabel(origen: unknown) {
  const raw = String(origen ?? "Base").trim();
  if (!raw) return "Producto base";
  const normalized = raw.toLowerCase();
  if (normalized === "base" || normalized === "producto base") return "Producto base";
  if (normalized.startsWith("adicional")) return "Adicional";
  return raw;
}

function getMaterialTipoLabel(tipo: unknown) {
  const raw = String(tipo ?? "").trim().toUpperCase();
  if (raw === "SUSTRATO") return "Sustrato";
  if (raw === "VINILO" || raw === "VINILO_DE_CORTE") return "Vinilo de corte";
  if (raw === "PAPEL") return "Papel";
  if (raw === "TONER") return "Tóner";
  if (raw === "FILM") return "Film";
  if (raw === "DESGASTE") return "Desgaste";
  if (raw === "CONSUMIBLE_FILM") return "Consumibles de terminación";
  if (raw === "ADDITIONAL_MATERIAL_EFFECT") return "Material adicional";
  return raw || "Otros";
}

function formatDetalleTecnico(detalle: Record<string, unknown> | null | undefined) {
  if (!detalle || typeof detalle !== "object") return "";
  return Object.entries(detalle)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join("\n");
}

// ─── Shared state hook ───────────────────────────────────────────────────────

function useVinylCutConfig(props: ProductTabProps) {
  const [config, setConfig] = React.useState<Record<string, unknown>>(
    props.motorConfig?.parametros ?? {},
  );
  const [isLoadingConfig, setIsLoadingConfig] = React.useState(false);

  React.useEffect(() => {
    setConfig(props.motorConfig?.parametros ?? {});
  }, [props.motorConfig?.updatedAt, props.motorConfig?.versionConfig]);

  const ensureConfigLoaded = React.useCallback(async () => {
    if (props.motorConfig) return props.motorConfig.parametros ?? {};
    setIsLoadingConfig(true);
    try {
      const motorConfig = await getProductoMotorConfig(props.producto.id);
      await props.refreshMotorConfig();
      const parametros = motorConfig.parametros ?? {};
      setConfig(parametros);
      return parametros;
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cargar la configuración del motor.");
      return {};
    } finally {
      setIsLoadingConfig(false);
    }
  }, [props.motorConfig, props.producto.id, props.refreshMotorConfig]);

  React.useEffect(() => {
    void ensureConfigLoaded();
  }, [ensureConfigLoaded]);

  return { config, setConfig, isLoadingConfig };
}

// ─── Tab: Equipos y materiales ───────────────────────────────────────────────

function VinylCutEquiposMaterialesTab(props: ProductTabProps) {
  const { config, setConfig, isLoadingConfig } = useVinylCutConfig(props);
  const [isSaving, startSaving] = React.useTransition();

  const savedJson = React.useMemo(
    () => JSON.stringify(props.motorConfig?.parametros ?? {}),
    [props.motorConfig?.parametros, props.motorConfig?.updatedAt],
  );
  const isDirty = React.useMemo(
    () => JSON.stringify(config) !== savedJson,
    [config, savedJson],
  );

  const plotters = React.useMemo(
    () => props.maquinas.filter((m) => m.activo && m.plantilla === "plotter_de_corte"),
    [props.maquinas],
  );
  const vinylMaterials = React.useMemo(
    () =>
      props.materiasPrimas.filter(
        (m) =>
          m.activo &&
          m.subfamilia === "sustrato_rollo_flexible" &&
          (m.templateId === "vinilo_de_corte_rollo_v1" || m.tipoTecnico === "vinilo_de_corte_rollo"),
      ),
    [props.materiasPrimas],
  );

  const selectedMachineIds = React.useMemo(
    () => new Set(toStringArray(config.plottersCompatibles)),
    [config.plottersCompatibles],
  );
  const selectedMaterialIds = React.useMemo(
    () => new Set(toStringArray(config.materialesCompatibles)),
    [config.materialesCompatibles],
  );
  const selectedVariantIds = React.useMemo(
    () => new Set(toStringArray(config.variantesCompatibles)),
    [config.variantesCompatibles],
  );
  const selectedProfileIds = React.useMemo(
    () => new Set(toStringArray(config.perfilesCompatibles)),
    [config.perfilesCompatibles],
  );
  const compatibleProfiles = React.useMemo(
    () =>
      plotters
        .filter((m) => selectedMachineIds.size === 0 || selectedMachineIds.has(m.id))
        .flatMap((m) =>
          m.perfilesOperativos
            .filter((p) => p.activo)
            .map((p) => ({ machineId: m.id, machineName: m.nombre, profile: p })),
        ),
    [plotters, selectedMachineIds],
  );

  const toggleArrayId = (key: string, id: string) =>
    setConfig((prev) => {
      const current = new Set(toStringArray(prev[key]));
      if (current.has(id)) current.delete(id);
      else current.add(id);
      return { ...prev, [key]: Array.from(current) };
    });

  const toggleMaterial = (material: (typeof vinylMaterials)[number]) => {
    const materialVariantIds = (material.variantes ?? [])
      .filter((v) => v.activo)
      .map((v) => v.id);
    setConfig((prev) => {
      const materials = new Set(toStringArray(prev.materialesCompatibles));
      const variants = new Set(toStringArray(prev.variantesCompatibles));
      if (materials.has(material.id)) {
        materials.delete(material.id);
        materialVariantIds.forEach((id) => variants.delete(id));
      } else {
        materials.add(material.id);
        materialVariantIds.forEach((id) => variants.add(id));
      }
      return {
        ...prev,
        materialesCompatibles: Array.from(materials),
        variantesCompatibles: Array.from(variants),
      };
    });
  };

  const saveConfig = () =>
    startSaving(async () => {
      try {
        const saved = await upsertProductoMotorConfig(props.producto.id, config);
        setConfig(saved.parametros ?? {});
        await props.refreshMotorConfig();
        toast.success("Configuración guardada.");
      } catch (error) {
        console.error(error);
        toast.error("No se pudo guardar la configuración.");
      }
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Equipos y materiales</CardTitle>
            <CardDescription>
              Configurá los plotters, perfiles operativos, materiales compatibles y parámetros de corte.
            </CardDescription>
          </div>
          {isDirty && <Badge variant="outline">Cambios sin guardar</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {isLoadingConfig ? <GdiSpinner /> : null}

        {/* Plotters + Perfiles + Defaults */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            <p className="text-sm font-semibold">Plotters compatibles</p>
            {plotters.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay plotters de corte cargados.</p>
            )}
            {plotters.map((machine) => (
              <label
                key={machine.id}
                className="flex items-center gap-3 rounded-md border p-3 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={selectedMachineIds.has(machine.id)}
                  onCheckedChange={() => toggleArrayId("plottersCompatibles", machine.id)}
                />
                <span>{machine.nombre}</span>
              </label>
            ))}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Perfiles operativos compatibles</p>
            {compatibleProfiles.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Seleccioná plotters para ver sus perfiles.
              </p>
            )}
            {compatibleProfiles.map((item) => (
              <label
                key={item.profile.id}
                className="flex items-center gap-3 rounded-md border p-3 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={selectedProfileIds.has(item.profile.id)}
                  onCheckedChange={() => toggleArrayId("perfilesCompatibles", item.profile.id)}
                />
                <span>
                  {item.machineName} · {item.profile.nombre}
                </span>
              </label>
            ))}
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold">Selección por defecto</p>
            <Field>
              <FieldLabel>Plotter por defecto</FieldLabel>
              <Select
                value={String(config.maquinaDefaultId ?? "__none__")}
                onValueChange={(v) =>
                  setConfig((prev) => ({ ...prev, maquinaDefaultId: v === "__none__" ? null : v }))
                }
              >
                <SelectTrigger>
                  <span className="truncate text-sm">
                    {config.maquinaDefaultId
                      ? (plotters.find((m) => m.id === config.maquinaDefaultId)?.nombre ?? "Automático")
                      : "Automático"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Automático</SelectItem>
                  {plotters.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Perfil por defecto</FieldLabel>
              <Select
                value={String(config.perfilDefaultId ?? "__none__")}
                onValueChange={(v) =>
                  setConfig((prev) => ({ ...prev, perfilDefaultId: v === "__none__" ? null : v }))
                }
              >
                <SelectTrigger>
                  <span className="truncate text-sm">
                    {(() => {
                      if (!config.perfilDefaultId) return "Automático";
                      for (const m of plotters) {
                        const p = m.perfilesOperativos.find((p) => p.id === config.perfilDefaultId);
                        if (p) return `${m.nombre} · ${p.nombre}`;
                      }
                      return "Automático";
                    })()}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Automático</SelectItem>
                  {plotters.flatMap((m) =>
                    m.perfilesOperativos
                      .filter((p) => p.activo)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {m.nombre} · {p.nombre}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        {/* Materials + Variants */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">Materiales compatibles</p>
          <p className="text-xs text-muted-foreground">
            Seleccioná los materiales disponibles. Podés habilitar o deshabilitar variantes individuales (anchos de rollo).
          </p>
          {vinylMaterials.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay materias primas de tipo vinilo de corte cargadas.
            </p>
          )}
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            {/* Left: material toggles */}
            <div className="rounded-lg border bg-background p-4 space-y-3">
              <p className="text-sm font-medium">Materiales</p>
              {vinylMaterials.map((material) => (
                <label
                  key={material.id}
                  className="flex items-center gap-3 rounded-md border p-3 text-sm cursor-pointer hover:bg-muted/20 transition-colors"
                >
                  <Checkbox
                    checked={selectedMaterialIds.has(material.id)}
                    onCheckedChange={() => toggleMaterial(material)}
                  />
                  <span>{material.nombre}</span>
                </label>
              ))}
            </div>

            {/* Right: variant toggles for selected materials */}
            <div className="rounded-lg border bg-background p-4 space-y-4">
              <p className="text-sm font-medium">Variantes de rollo habilitadas</p>
              {selectedMaterialIds.size === 0 ? (
                <p className="text-sm text-muted-foreground">Seleccioná un material para ver sus variantes.</p>
              ) : (
                vinylMaterials
                  .filter((m) => selectedMaterialIds.has(m.id))
                  .map((material) => {
                    const activeVariants = (material.variantes ?? []).filter((v) => v.activo);
                    return (
                      <div key={material.id} className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{material.nombre}</p>
                        {activeVariants.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sin variantes activas.</p>
                        ) : (
                          activeVariants.map((variant) => {
                            const chips = getVarianteOptionChips(material, variant);
                            return (
                              <label
                                key={variant.id}
                                className="flex items-start gap-3 rounded-lg border p-3 text-sm cursor-pointer hover:bg-muted/20 transition-colors"
                              >
                                <Checkbox
                                  checked={selectedVariantIds.has(variant.id)}
                                  onCheckedChange={() => toggleArrayId("variantesCompatibles", variant.id)}
                                />
                                <div className="space-y-1">
                                  {chips.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {chips.map((chip) => (
                                        <span key={chip.key} className="rounded border px-2 py-0.5 text-xs">
                                          {chip.label}: {chip.value}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>

        {/* Nesting settings */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">Parámetros de nesting</p>
          <div className="grid gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel>Criterio de selección</FieldLabel>
              <Select
                value={String(config.criterioSeleccionMaterial ?? "menor_costo_total")}
                onValueChange={(v) => setConfig((prev) => ({ ...prev, criterioSeleccionMaterial: v }))}
              >
                <SelectTrigger>
                  <span className="truncate text-sm">
                    {CRITERIO_LABELS[String(config.criterioSeleccionMaterial ?? "menor_costo_total")] ?? "Menor costo total"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="menor_costo_total">Menor costo total</SelectItem>
                  <SelectItem value="menor_largo_consumido">Menor largo consumido</SelectItem>
                  <SelectItem value="menor_desperdicio">Menor desperdicio</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Separación horizontal (mm)</FieldLabel>
              <Input
                type="number"
                value={String(config.separacionHorizontalMm ?? 10)}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    separacionHorizontalMm: Number(e.target.value || 0),
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel>Separación vertical (mm)</FieldLabel>
              <Input
                type="number"
                value={String(config.separacionVerticalMm ?? 10)}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    separacionVerticalMm: Number(e.target.value || 0),
                  }))
                }
              />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="permitirRotacion"
              checked={config.permitirRotacion !== false}
              onCheckedChange={(checked) =>
                setConfig((prev) => ({ ...prev, permitirRotacion: Boolean(checked) }))
              }
            />
            <label htmlFor="permitirRotacion" className="text-sm cursor-pointer">
              Permitir rotación de piezas
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={saveConfig} disabled={isSaving || !isDirty}>
            {isSaving ? (
              <GdiSpinner className="mr-2 size-4" />
            ) : (
              <SaveIcon className="mr-2 size-4" />
            )}
            Guardar configuración
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Imposición (multi-color) ───────────────────────────────────────────

type ColorDraft = {
  id: string;
  label: string;
  materialVarianteId: string | null; // retrocompat
  colorFiltro: string | null;        // nuevo campo principal
  medidas: Array<{ anchoMm: number; altoMm: number; cantidad: number }>;
};

function configToColores(config: Record<string, unknown>): ColorDraft[] {
  if (Array.isArray(config.colores) && config.colores.length > 0) {
    return (config.colores as VinylCutColorEntry[]).map((entry) => ({
      id: entry.id ?? newColorId(),
      label: entry.label ?? "Color",
      materialVarianteId: entry.materialVarianteId ?? null,
      colorFiltro: entry.colorFiltro ?? null,
      medidas:
        Array.isArray(entry.medidas) && entry.medidas.length > 0
          ? entry.medidas.map((m) => ({
              anchoMm: Number(m.anchoMm ?? 0),
              altoMm: Number(m.altoMm ?? 0),
              cantidad: Number(m.cantidad ?? 1),
            }))
          : [{ anchoMm: 0, altoMm: 0, cantidad: 1 }],
    }));
  }
  // Legacy fallback
  if (Array.isArray(config.medidas) && config.medidas.length > 0) {
    return [
      {
        id: "legacy",
        label: "Color 1",
        materialVarianteId: null,
        colorFiltro: null,
        medidas: (config.medidas as Array<Record<string, unknown>>).map((m) => ({
          anchoMm: Number(m.anchoMm ?? 0),
          altoMm: Number(m.altoMm ?? 0),
          cantidad: Number(m.cantidad ?? 1),
        })),
      },
    ];
  }
  return [{ id: newColorId(), label: "Color 1", materialVarianteId: null, colorFiltro: null, medidas: [{ anchoMm: 0, altoMm: 0, cantidad: 1 }] }];
}

function buildColorNestingPreview(colorResult: Record<string, unknown> | null) {
  if (!colorResult) return null;
  const winner = asRecord(colorResult.winner ?? null);
  if (!winner || Object.keys(winner).length === 0) return null;
  const nestingPreview = asRecord(winner.nestingPreview);
  const pieces = Array.isArray(nestingPreview.pieces) ? nestingPreview.pieces : [];
  const rollWidth = Number(nestingPreview.rollWidth ?? 0);
  return {
    winner,
    machineLabel: String(winner.maquinaNombre ?? "Plotter"),
    rollWidthCm: rollWidth,
    rollLengthCm: Number(nestingPreview.rollLength ?? 0),
    marginLeftCm: Number(nestingPreview.marginLeft ?? 0),
    marginRightCm: Number(nestingPreview.marginRight ?? 0),
    marginTopCm: Number(nestingPreview.marginStart ?? 0),
    marginBottomCm: Number(nestingPreview.marginEnd ?? 0),
    separacionHorizontalCm: Number(nestingPreview.separacionHorizontalCm ?? 0),
    separacionVerticalCm: Number(nestingPreview.separacionVerticalCm ?? 0),
    pieces: pieces.map((item) => {
      const row = asRecord(item);
      const w = Number(row.w ?? 0);
      const h = Number(row.h ?? 0);
      const cx = Number(row.cx ?? 0);
      const cy = Number(row.cy ?? 0);
      // originalW/originalH are the unrotated piece dimensions (for the label)
      const originalW = Number(row.originalW ?? w);
      const originalH = Number(row.originalH ?? h);
      return {
        id: String(row.id ?? crypto.randomUUID()),
        label: String(row.label ?? ""),
        widthCm: w,
        heightCm: h,
        originalWidthCm: originalW,
        originalHeightCm: originalH,
        xCm: cx + rollWidth / 2 - w / 2,
        yCm: cy - h / 2,
        rotated: Boolean(row.rotated),
      };
    }),
  };
}

function VinylCutImposicionTab(props: ProductTabProps) {
  const { config, setConfig, isLoadingConfig } = useVinylCutConfig(props);
  const [isSaving, startSaving] = React.useTransition();
  const [isPreviewing, startPreviewing] = React.useTransition();
  const [previewResult, setPreviewResult] = React.useState<Record<string, unknown> | null>(null);

  // Column-level unit display state (shared across all color blocks)
  const MEDIDA_UNITS = ["mm", "cm"] as const;
  type MedidaUnit = (typeof MEDIDA_UNITS)[number];
  const [anchoUnit, setAnchoUnit] = React.useState<MedidaUnit>("cm");
  const [altoUnit, setAltoUnit] = React.useState<MedidaUnit>("cm");
  const cycleAnchoUnit = () =>
    setAnchoUnit((u) => MEDIDA_UNITS[(MEDIDA_UNITS.indexOf(u) + 1) % MEDIDA_UNITS.length]);
  const cycleAltoUnit = () =>
    setAltoUnit((u) => MEDIDA_UNITS[(MEDIDA_UNITS.indexOf(u) + 1) % MEDIDA_UNITS.length]);

  // Helpers: convert mm ↔ display unit
  // parseFloat(toPrecision(8)) elimina artefactos de punto flotante (ej: 570*0.1 = 57.00000000000001)
  const toDisplay = (mm: number, unit: MedidaUnit) => {
    const raw = unit === "mm" ? mm : convertUnitValue(mm, "mm", unit);
    return parseFloat(raw.toPrecision(8));
  };
  const toMm = (display: number, unit: MedidaUnit) =>
    unit === "mm" ? display : convertUnitValue(display, unit, "mm");

  // Local colores draft state
  const [colores, setColores] = React.useState<ColorDraft[]>(() => configToColores(config));
  React.useEffect(() => {
    setColores(configToColores(config));
  }, [props.motorConfig?.updatedAt, props.motorConfig?.versionConfig]);

  // Compatible variant IDs from config
  const enabledVariantIds = React.useMemo(
    () => new Set(toStringArray(config.variantesCompatibles)),
    [config.variantesCompatibles],
  );

  // All material variants, filtered to only those enabled in Equipos y materiales
  const vinylMaterialVariants = React.useMemo(
    () =>
      props.materiasPrimas
        .filter(
          (m) =>
            m.activo &&
            m.subfamilia === "sustrato_rollo_flexible" &&
            (m.templateId === "vinilo_de_corte_rollo_v1" || m.tipoTecnico === "vinilo_de_corte_rollo"),
        )
        .flatMap((m) =>
          (m.variantes ?? [])
            .filter((v) => v.activo && (enabledVariantIds.size === 0 || enabledVariantIds.has(v.id)))
            .map((v) => ({ variantId: v.id, label: getMateriaPrimaVarianteLabel(m, v) })),
        ),
    [props.materiasPrimas, enabledVariantIds],
  );

  // Unique colors available from enabled vinyl variants
  const vinylColorOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ color: string }> = [];
    props.materiasPrimas
      .filter(
        (m) =>
          m.activo &&
          m.subfamilia === "sustrato_rollo_flexible" &&
          (m.templateId === "vinilo_de_corte_rollo_v1" || m.tipoTecnico === "vinilo_de_corte_rollo"),
      )
      .forEach((m) => {
        (m.variantes ?? [])
          .filter((v) => v.activo && (enabledVariantIds.size === 0 || enabledVariantIds.has(v.id)))
          .forEach((v) => {
            const color =
              typeof (v.atributosVariante as Record<string, unknown>)?.color === "string"
                ? ((v.atributosVariante as Record<string, unknown>).color as string).trim()
                : "";
            if (color && !seen.has(color.toLowerCase())) {
              seen.add(color.toLowerCase());
              options.push({ color });
            }
          });
      });
    return options.sort((a, b) => a.color.localeCompare(b.color));
  }, [props.materiasPrimas, enabledVariantIds]);

  const addColor = () =>
    setColores((prev) => [
      ...prev,
      {
        id: newColorId(),
        label: `Color ${prev.length + 1}`,
        materialVarianteId: null,
        colorFiltro: null,
        medidas: [{ anchoMm: 0, altoMm: 0, cantidad: 1 }],
      },
    ]);

  const removeColor = (colorId: string) =>
    setColores((prev) => prev.filter((c) => c.id !== colorId));

  const updateColor = (colorId: string, patch: Partial<Omit<ColorDraft, "id" | "medidas">>) =>
    setColores((prev) => prev.map((c) => (c.id === colorId ? { ...c, ...patch } : c)));

  const addMedida = (colorId: string) =>
    setColores((prev) =>
      prev.map((c) =>
        c.id === colorId
          ? { ...c, medidas: [...c.medidas, { anchoMm: 0, altoMm: 0, cantidad: 1 }] }
          : c,
      ),
    );

  const removeMedida = (colorId: string, index: number) =>
    setColores((prev) =>
      prev.map((c) =>
        c.id === colorId ? { ...c, medidas: c.medidas.filter((_, i) => i !== index) } : c,
      ),
    );

  const updateMedida = (
    colorId: string,
    index: number,
    patch: Partial<{ anchoMm: number; altoMm: number; cantidad: number }>,
  ) =>
    setColores((prev) =>
      prev.map((c) =>
        c.id === colorId
          ? { ...c, medidas: c.medidas.map((m, i) => (i === index ? { ...m, ...patch } : m)) }
          : c,
      ),
    );

  const buildConfigWithColores = () => ({ ...config, colores });

  const saveConfig = () =>
    startSaving(async () => {
      try {
        const next = buildConfigWithColores();
        const saved = await upsertProductoMotorConfig(props.producto.id, next);
        setConfig(saved.parametros ?? {});
        await props.refreshMotorConfig();
        toast.success("Configuración guardada.");
      } catch (error) {
        console.error(error);
        toast.error("No se pudo guardar la configuración.");
      }
    });

  const preview = () => {
    if (enabledVariantIds.size === 0) return;
    startPreviewing(async () => {
      try {
        const result = await previewVinylCutImposicionByProducto(
          props.producto.id,
          buildConfigWithColores(),
        );
        setPreviewResult(result as Record<string, unknown>);
      } catch (error) {
        console.error(error);
        toast.error("No se pudo simular el nesting.");
      }
    });
  };

  const colorResults = React.useMemo(
    () =>
      Array.isArray(previewResult?.colorResults)
        ? (previewResult.colorResults as Array<Record<string, unknown>>)
        : [],
    [previewResult],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Imposición</CardTitle>
        <CardDescription>
          Definí las medidas por color. Cada color se nestea independientemente en su propio rollo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {enabledVariantIds.size === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Seleccioná materiales y variantes de rollo en la pestaña <strong>Equipos y materiales</strong> para habilitar la simulación de nesting.
          </div>
        ) : null}
        {isLoadingConfig ? <GdiSpinner /> : null}

        {/* Color cards */}
        <div className="space-y-4">
          {colores.map((color, colorIdx) => {
            const colorResult = colorResults.find((cr) => cr.colorId === color.id) ?? null;
            const nestingData = buildColorNestingPreview(colorResult);
            return (
              <Card key={color.id} className="border-l-4 border-l-primary/40">
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Color {colorIdx + 1}{color.colorFiltro ? ` — ${color.colorFiltro}` : ""}
                      </p>
                      <Field>
                        <FieldLabel>Color del vinilo</FieldLabel>
                        <Select
                          value={color.colorFiltro ?? "__sin_filtro__"}
                          onValueChange={(v) => {
                            const newColor = v === "__sin_filtro__" ? null : v;
                            updateColor(color.id, {
                              colorFiltro: newColor,
                              label: newColor ?? `Color ${colorIdx + 1}`,
                              materialVarianteId: null,
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {color.colorFiltro ?? "Sin filtro (todos los rollos)"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__sin_filtro__">Sin filtro (todos los rollos)</SelectItem>
                            {vinylColorOptions.length === 0 ? (
                              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                                No hay colores definidos.<br />
                                Cargá el atributo "Color" en tus rollos de vinilo desde Materias primas.
                              </div>
                            ) : (
                              vinylColorOptions.map((opt) => (
                                <SelectItem key={opt.color} value={opt.color}>
                                  {opt.color}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 mt-7"
                      onClick={() => removeColor(color.id)}
                      disabled={colores.length <= 1}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <div className="flex items-center gap-1.5">
                            Ancho
                            <button
                              type="button"
                              onClick={cycleAnchoUnit}
                              title="Cambiar unidad de ancho"
                              className="rounded border border-input bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              {anchoUnit}
                            </button>
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1.5">
                            Alto
                            <button
                              type="button"
                              onClick={cycleAltoUnit}
                              title="Cambiar unidad de alto"
                              className="rounded border border-input bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              {altoUnit}
                            </button>
                          </div>
                        </TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {color.medidas.map((medida, mIdx) => (
                        <TableRow key={mIdx}>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={anchoUnit === "mm" ? 1 : 0.1}
                              value={toDisplay(medida.anchoMm, anchoUnit)}
                              onChange={(e) =>
                                updateMedida(color.id, mIdx, {
                                  anchoMm: Math.round(toMm(Number(e.target.value || 0), anchoUnit)),
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={altoUnit === "mm" ? 1 : 0.1}
                              value={toDisplay(medida.altoMm, altoUnit)}
                              onChange={(e) =>
                                updateMedida(color.id, mIdx, {
                                  altoMm: Math.round(toMm(Number(e.target.value || 0), altoUnit)),
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={String(medida.cantidad)}
                              onChange={(e) =>
                                updateMedida(color.id, mIdx, { cantidad: Number(e.target.value || 1) })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMedida(color.id, mIdx)}
                              disabled={color.medidas.length <= 1}
                            >
                              <Trash2Icon className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Button variant="outline" size="sm" onClick={() => addMedida(color.id)}>
                    <PlusIcon className="mr-2 size-4" />
                    Agregar medida
                  </Button>

                  {/* Per-color nesting preview */}
                  {nestingData ? (
                    <div className="space-y-3 pt-2">
                      <div className="grid gap-3 sm:grid-cols-4">
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Plotter</p>
                            <p className="font-semibold text-sm">{nestingData.machineLabel}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Perfil</p>
                            <p className="font-semibold text-sm">
                              {String(nestingData.winner.perfilNombre ?? "-")}
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Largo consumido</p>
                            <p className="font-semibold text-sm">
                              {Number(
                                asRecord(nestingData.winner.resumenTecnico).largoConsumidoMl ?? 0,
                              ).toLocaleString("es-AR", { maximumFractionDigits: 3 })}{" "}
                              m
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground">Desperdicio</p>
                            <p className="font-semibold text-sm">
                              {Number(
                                asRecord(nestingData.winner.resumenTecnico).wastePct ?? 0,
                              ).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                              %
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                      <VinylCutNestingWorkspace
                        machineLabel={nestingData.machineLabel}
                        rollWidthCm={nestingData.rollWidthCm}
                        rollLengthCm={nestingData.rollLengthCm}
                        pieces={nestingData.pieces}
                        marginLeftCm={nestingData.marginLeftCm}
                        marginRightCm={nestingData.marginRightCm}
                        marginTopCm={nestingData.marginTopCm}
                        marginBottomCm={nestingData.marginBottomCm}
                        separacionHorizontalCm={nestingData.separacionHorizontalCm}
                        separacionVerticalCm={nestingData.separacionVerticalCm}
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" onClick={addColor}>
            <PlusIcon className="mr-2 size-4" />
            Agregar color
          </Button>
          <Button variant="outline" onClick={saveConfig} disabled={isSaving}>
            {isSaving ? (
              <GdiSpinner className="mr-2 size-4" />
            ) : (
              <SaveIcon className="mr-2 size-4" />
            )}
            Guardar configuración
          </Button>
          <Button
            onClick={preview}
            disabled={isPreviewing || enabledVariantIds.size === 0}
          >
            {isPreviewing ? (
              <GdiSpinner className="mr-2 size-4" />
            ) : (
              <RefreshCcwIcon className="mr-2 size-4" />
            )}
            Simular nesting
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Simular costo ──────────────────────────────────────────────────────

function VinylCutSimularCostoTab(props: ProductTabProps) {
  const { config } = useVinylCutConfig(props);
  const [isQuoting, startQuoting] = React.useTransition();
  const [result, setResult] = React.useState<Record<string, unknown> | null>(null);
  const [cantidadTrabajo, setCantidadTrabajo] = React.useState("1");
  const [materialesOpen, setMaterialesOpen] = React.useState<Record<string, boolean>>({});
  const [materialesMermaOpen, setMaterialesMermaOpen] = React.useState<Record<string, boolean>>({});
  const [nestingColorId, setNestingColorId] = React.useState<string | null>(null);

  // ── Local colores draft (same pattern as imposición tab) ──
  const [colores, setColores] = React.useState<ColorDraft[]>(() => configToColores(config));
  React.useEffect(() => {
    setColores(configToColores(config));
  }, [props.motorConfig?.updatedAt, props.motorConfig?.versionConfig]);

  const enabledVariantIds = React.useMemo(
    () => new Set(toStringArray(config.variantesCompatibles)),
    [config.variantesCompatibles],
  );

  const vinylColorOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ color: string }> = [];
    props.materiasPrimas
      .filter(
        (m) =>
          m.activo &&
          m.subfamilia === "sustrato_rollo_flexible" &&
          (m.templateId === "vinilo_de_corte_rollo_v1" || m.tipoTecnico === "vinilo_de_corte_rollo"),
      )
      .forEach((m) => {
        (m.variantes ?? [])
          .filter((v) => v.activo && (enabledVariantIds.size === 0 || enabledVariantIds.has(v.id)))
          .forEach((v) => {
            const color =
              typeof (v.atributosVariante as Record<string, unknown>)?.color === "string"
                ? ((v.atributosVariante as Record<string, unknown>).color as string).trim()
                : "";
            if (color && !seen.has(color.toLowerCase())) {
              seen.add(color.toLowerCase());
              options.push({ color });
            }
          });
      });
    return options.sort((a, b) => a.color.localeCompare(b.color));
  }, [props.materiasPrimas, enabledVariantIds]);

  // ── Color CRUD helpers ──
  const addColor = () =>
    setColores((prev) => [
      ...prev,
      { id: newColorId(), label: `Color ${prev.length + 1}`, materialVarianteId: null, colorFiltro: null, medidas: [{ anchoMm: 0, altoMm: 0, cantidad: 1 }] },
    ]);
  const removeColor = (colorId: string) => setColores((prev) => prev.filter((c) => c.id !== colorId));
  const updateColor = (colorId: string, patch: Partial<Omit<ColorDraft, "id" | "medidas">>) =>
    setColores((prev) => prev.map((c) => (c.id === colorId ? { ...c, ...patch } : c)));
  const addMedida = (colorId: string) =>
    setColores((prev) =>
      prev.map((c) => (c.id === colorId ? { ...c, medidas: [...c.medidas, { anchoMm: 0, altoMm: 0, cantidad: 1 }] } : c)),
    );
  const removeMedida = (colorId: string, index: number) =>
    setColores((prev) =>
      prev.map((c) => (c.id === colorId ? { ...c, medidas: c.medidas.filter((_, i) => i !== index) } : c)),
    );
  const updateMedida = (colorId: string, index: number, patch: Partial<{ anchoMm: number; altoMm: number; cantidad: number }>) =>
    setColores((prev) =>
      prev.map((c) => (c.id === colorId ? { ...c, medidas: c.medidas.map((m, i) => (i === index ? { ...m, ...patch } : m)) } : c)),
    );

  // ── Unit toggle (cm default) ──
  const MEDIDA_UNITS = ["mm", "cm"] as const;
  type MedidaUnit = (typeof MEDIDA_UNITS)[number];
  const [anchoUnit, setAnchoUnit] = React.useState<MedidaUnit>("cm");
  const [altoUnit, setAltoUnit] = React.useState<MedidaUnit>("cm");
  const cycleAnchoUnit = () => setAnchoUnit((u) => MEDIDA_UNITS[(MEDIDA_UNITS.indexOf(u) + 1) % MEDIDA_UNITS.length]);
  const cycleAltoUnit = () => setAltoUnit((u) => MEDIDA_UNITS[(MEDIDA_UNITS.indexOf(u) + 1) % MEDIDA_UNITS.length]);
  const toDisplay = (mm: number, unit: MedidaUnit) => {
    const raw = unit === "mm" ? mm : convertUnitValue(mm, "mm", unit);
    return parseFloat(raw.toPrecision(8));
  };
  const toMm = (display: number, unit: MedidaUnit) => (unit === "mm" ? display : convertUnitValue(display, unit, "mm"));

  // ── API call using product-level endpoint (same as imposición) ──
  const quote = () =>
    startQuoting(async () => {
      try {
        const payload = { ...config, colores };
        const res = await previewVinylCutImposicionByProducto(props.producto.id, payload);
        setResult(res as Record<string, unknown>);
      } catch (error) {
        console.error(error);
        toast.error("No se pudo simular el costo.");
      }
    });

  // ── Derived data from result ──
  const aggregated = React.useMemo(() => asRecord(result?.aggregated), [result]);
  const colorResults = React.useMemo(
    () => (Array.isArray(result?.colorResults) ? (result.colorResults as Array<Record<string, unknown>>) : []),
    [result],
  );
  const procesosCotizados = React.useMemo(
    () => (Array.isArray(aggregated.centrosCosto) ? (aggregated.centrosCosto as Array<Record<string, unknown>>) : []),
    [aggregated],
  );
  const materialesCotizados = React.useMemo(
    () => (Array.isArray(aggregated.materiasPrimas) ? (aggregated.materiasPrimas as Array<Record<string, unknown>>) : []),
    [aggregated],
  );

  const materialesAgrupados = React.useMemo(() => {
    const groups = new Map<string, { tipo: string; label: string; items: Array<Record<string, unknown>>; mermaOperativa: Array<Record<string, unknown>>; totalMermaCantidad: number; totalMermaCosto: number; totalCantidad: number; totalCosto: number }>();
    for (const item of materialesCotizados) {
      const tipo = String(item.tipo ?? "");
      const current = groups.get(tipo) ?? { tipo, label: getMaterialTipoLabel(tipo), items: [], mermaOperativa: [], totalMermaCantidad: 0, totalMermaCosto: 0, totalCantidad: 0, totalCosto: 0 };
      const cantidad = Number(item.cantidad ?? 0) || 0;
      const costo = Number(item.costo ?? 0) || 0;
      const origen = String(item.origen ?? "Base").trim().toLowerCase();
      if (origen === "merma operativa") {
        current.mermaOperativa.push(item);
        current.totalMermaCantidad += cantidad;
        current.totalMermaCosto += costo;
      } else {
        current.items.push(item);
      }
      current.totalCantidad += cantidad;
      current.totalCosto += costo;
      groups.set(tipo, current);
    }
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [materialesCotizados]);

  const totalCentroCostos = procesosCotizados.reduce((acc, item) => acc + (Number(item.costo ?? 0) || 0), 0);
  const totalMaterialesCosto = materialesCotizados.reduce((acc, item) => acc + (Number(item.costo ?? 0) || 0), 0);
  const totalCostoGeneral = totalCentroCostos + totalMaterialesCosto;

  // ── Warnings ──
  const warnings = React.useMemo(
    () => (Array.isArray(result?.warnings) ? (result.warnings as string[]) : []),
    [result],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simular costo</CardTitle>
        <CardDescription>
          Definí los colores y medidas del trabajo, luego simulá el costo completo con desglose de materiales y centros de costo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Color cards (input) ── */}
        <div className="space-y-4">
          {colores.map((color, colorIdx) => (
            <Card key={color.id} className="border-l-4 border-l-primary/40">
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Color {colorIdx + 1}{color.colorFiltro ? ` — ${color.colorFiltro}` : ""}
                    </p>
                    <Field>
                      <FieldLabel>Color del vinilo</FieldLabel>
                      <Select
                        value={color.colorFiltro ?? "__sin_filtro__"}
                        onValueChange={(v) => {
                          const newColor = v === "__sin_filtro__" ? null : v;
                          updateColor(color.id, { colorFiltro: newColor, label: newColor ?? `Color ${colorIdx + 1}`, materialVarianteId: null });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue>{color.colorFiltro ?? "Sin filtro (todos los rollos)"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__sin_filtro__">Sin filtro (todos los rollos)</SelectItem>
                          {vinylColorOptions.map((opt) => (
                            <SelectItem key={opt.color} value={opt.color}>{opt.color}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 mt-7" onClick={() => removeColor(color.id)} disabled={colores.length <= 1}>
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center gap-1.5">
                          Ancho
                          <button type="button" onClick={cycleAnchoUnit} title="Cambiar unidad de ancho" className="rounded border border-input bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">{anchoUnit}</button>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1.5">
                          Alto
                          <button type="button" onClick={cycleAltoUnit} title="Cambiar unidad de alto" className="rounded border border-input bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">{altoUnit}</button>
                        </div>
                      </TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {color.medidas.map((medida, mIdx) => (
                      <TableRow key={mIdx}>
                        <TableCell>
                          <Input type="number" min={0} step={anchoUnit === "mm" ? 1 : 0.1} value={toDisplay(medida.anchoMm, anchoUnit)} onChange={(e) => updateMedida(color.id, mIdx, { anchoMm: Math.round(toMm(Number(e.target.value || 0), anchoUnit)) })} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" min={0} step={altoUnit === "mm" ? 1 : 0.1} value={toDisplay(medida.altoMm, altoUnit)} onChange={(e) => updateMedida(color.id, mIdx, { altoMm: Math.round(toMm(Number(e.target.value || 0), altoUnit)) })} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={String(medida.cantidad)} onChange={(e) => updateMedida(color.id, mIdx, { cantidad: Number(e.target.value || 1) })} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeMedida(color.id, mIdx)} disabled={color.medidas.length <= 1}>
                            <Trash2Icon className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button variant="outline" size="sm" onClick={() => addMedida(color.id)}>
                  <PlusIcon className="mr-2 size-4" />
                  Agregar medida
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 flex-wrap items-end">
          <Button variant="outline" onClick={addColor}>
            <PlusIcon className="mr-2 size-4" />
            Agregar color
          </Button>
          <Field className="max-w-[160px]">
            <FieldLabel>Cantidad de trabajos</FieldLabel>
            <Input type="number" value={cantidadTrabajo} onChange={(e) => setCantidadTrabajo(e.target.value)} />
          </Field>
          <Button onClick={quote} disabled={isQuoting}>
            {isQuoting ? <GdiSpinner className="mr-2 size-4" /> : <RefreshCcwIcon className="mr-2 size-4" />}
            Simular costo
          </Button>
        </div>

        {/* ── Results ── */}
        {result ? (
          <div className="space-y-6">
            {/* Warnings */}
            {warnings.length > 0 ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                {warnings.map((w, i) => (<p key={i}>{w}</p>))}
              </div>
            ) : null}

            {/* Summary cards */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-3xl font-semibold">{formatCurrency(Number(aggregated.totalTecnico ?? 0))}</p>
                <p className="mt-1 text-sm text-muted-foreground">Costo técnico total</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-3xl font-semibold">{formatCurrency(Number(aggregated.totalMateriales ?? 0))}</p>
                <p className="mt-1 text-sm text-muted-foreground">Materiales</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 text-center">
                <p className="text-3xl font-semibold">{formatCurrency(Number(aggregated.totalCentrosCosto ?? 0))}</p>
                <p className="mt-1 text-sm text-muted-foreground">Centros de costo</p>
              </div>
            </div>

            {/* Centro de costos */}
            {procesosCotizados.length > 0 ? (
              <div className="rounded-xl border bg-muted/10 p-4">
                <div className="mb-4">
                  <h4 className="text-sm font-semibold">Centro de costos</h4>
                </div>
                <Table>
                  <TableHeader className="bg-muted/50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]">
                    <TableRow className="border-b border-border/70">
                      <TableHead>#</TableHead>
                      <TableHead>Paso</TableHead>
                      <TableHead>Centro</TableHead>
                      <TableHead className="w-[180px]">Origen</TableHead>
                      <TableHead className="w-[140px] text-right">Minutos</TableHead>
                      <TableHead className="w-[140px] text-right">Tarifa/h</TableHead>
                      <TableHead className="w-[140px] text-right">Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {procesosCotizados.map((item, idx) => (
                      <TableRow key={`${String(item.codigo)}-${idx}`}>
                        <TableCell>{String(item.orden ?? idx + 1)}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1">
                            <span>{String(item.paso ?? item.nombre ?? "-")}</span>
                            {item.detalleTecnico ? (
                              <Tooltip>
                                <TooltipTrigger className="inline-flex size-5 items-center justify-center rounded border border-border/60 text-muted-foreground transition-colors hover:bg-muted" aria-label="Ver detalle técnico">
                                  <InfoIcon className="size-3.5" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[360px] whitespace-pre-wrap text-xs">
                                  {formatDetalleTecnico(item.detalleTecnico as Record<string, unknown>)}
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell>{String(item.centroCostoNombre ?? "-")}</TableCell>
                        <TableCell>{formatOrigenProcesoLabel(item.origen)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(Number(item.minutos ?? item.totalMin ?? 0))}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.tarifaHora ?? 0))}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.costo ?? 0))}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={6} className="text-right font-medium">Total</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(totalCentroCostos)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {/* Materias primas */}
            {materialesAgrupados.length > 0 ? (
              <div className="rounded-xl border bg-muted/10 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold">Materias primas</h4>
                  {colorResults.length > 0 ? (
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => setNestingColorId(String(colorResults[0]?.colorId ?? "0"))}
                    >
                      <EyeIcon className="mr-1.5 size-3.5" />
                      Ver nesting
                    </Button>
                  ) : null}
                </div>
                <div className="space-y-3">
                  {materialesAgrupados.map((grupo) => (
                    <Collapsible key={grupo.tipo} open={materialesOpen[grupo.tipo] ?? false} onOpenChange={(open) => setMaterialesOpen((prev) => ({ ...prev, [grupo.tipo]: open }))}>
                      <div className="rounded-lg border bg-background">
                        <div className="flex items-center gap-2 px-3 py-3 transition-colors hover:bg-muted/60">
                          <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between text-left">
                            <div className="grid flex-1 gap-1 md:grid-cols-[minmax(0,1fr)_140px_140px] md:items-center">
                              <div>
                                <p className="font-medium">{grupo.label}</p>
                                <p className="text-xs text-muted-foreground">{grupo.items.length} componente{grupo.items.length === 1 ? "" : "s"}</p>
                              </div>
                              <div className="text-left md:text-right">
                                <p className="text-xs text-muted-foreground">Cantidad total</p>
                                <p className="tabular-nums">{formatNumber(grupo.totalCantidad)}</p>
                              </div>
                              <div className="text-left md:text-right">
                                <p className="text-xs text-muted-foreground">Costo total</p>
                                <p className="font-medium tabular-nums">{formatCurrency(grupo.totalCosto)}</p>
                              </div>
                            </div>
                            <span className="ml-3 inline-flex items-center text-muted-foreground">
                              {materialesOpen[grupo.tipo] ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                            </span>
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                          <div className="border-t">
                            <Table>
                              <TableHeader className="bg-muted/50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]">
                                <TableRow className="border-b border-border/70">
                                  <TableHead>Componente</TableHead>
                                  <TableHead className="w-[180px]">Origen</TableHead>
                                  <TableHead className="w-[140px] text-right">Cantidad</TableHead>
                                  <TableHead className="w-[140px] text-right">Costo unitario</TableHead>
                                  <TableHead className="w-[140px] text-right">Costo</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {grupo.items.map((item, idx) => {
                                  const nombre = String(item.nombre ?? "Componente");
                                  const chips = Array.isArray(item.variantChips)
                                    ? (item.variantChips as Array<{ label: string; value: string }>)
                                        .map((c) => c.value)
                                        .join(" · ")
                                    : "";
                                  const displayLabel = chips ? `${nombre} · ${chips}` : nombre;
                                  return (
                                    <TableRow key={`${grupo.tipo}-${idx}`}>
                                      <TableCell>{displayLabel}</TableCell>
                                      <TableCell>{formatOrigenProcesoLabel(item.origen)}</TableCell>
                                      <TableCell className="text-right tabular-nums">{formatNumber(Number(item.cantidad ?? 0))} {String(item.unidad ?? "").replace("metro_lineal", "ml").replace("m2", "m²")}</TableCell>
                                      <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.costoUnitario ?? 0))}</TableCell>
                                      <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.costo ?? 0))}</TableCell>
                                    </TableRow>
                                  );
                                })}
                                {grupo.mermaOperativa.length > 0 ? (
                                  <>
                                    <TableRow className="cursor-pointer bg-amber-50/60 hover:bg-amber-50" onClick={() => setMaterialesMermaOpen((prev) => ({ ...prev, [grupo.tipo]: !(prev[grupo.tipo] ?? false) }))}>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          {materialesMermaOpen[grupo.tipo] ? <ChevronDownIcon className="size-4 text-muted-foreground" /> : <ChevronRightIcon className="size-4 text-muted-foreground" />}
                                          <span className="font-medium">Merma operativa</span>
                                        </div>
                                      </TableCell>
                                      <TableCell>Producto base</TableCell>
                                      <TableCell className="text-right tabular-nums">{formatNumber(grupo.totalMermaCantidad)}</TableCell>
                                      <TableCell className="text-right tabular-nums">-</TableCell>
                                      <TableCell className="text-right tabular-nums">{formatCurrency(grupo.totalMermaCosto)}</TableCell>
                                    </TableRow>
                                    {materialesMermaOpen[grupo.tipo]
                                      ? grupo.mermaOperativa.map((item, idx) => (
                                          <TableRow key={`${grupo.tipo}-merma-${idx}`} className="bg-muted/20">
                                            <TableCell className="pl-10">{(() => { const n = String(item.nombre ?? "Componente"); const c = Array.isArray(item.variantChips) ? (item.variantChips as Array<{ label: string; value: string }>).map((ch) => ch.value).join(" · ") : ""; return c ? `${n} · ${c}` : n; })()}</TableCell>
                                            <TableCell>Merma operativa</TableCell>
                                            <TableCell className="text-right tabular-nums">{formatNumber(Number(item.cantidad ?? 0))} {String(item.unidad ?? "").replace("metro_lineal", "ml").replace("m2", "m²")}</TableCell>
                                            <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.costoUnitario ?? 0))}</TableCell>
                                            <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.costo ?? 0))}</TableCell>
                                          </TableRow>
                                        ))
                                      : null}
                                  </>
                                ) : null}
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}

                  {/* Totales generales */}
                  <div className="rounded-lg border bg-background">
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell colSpan={4} className="text-right font-medium">Total materiales</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(totalMaterialesCosto)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-amber-100/60">
                          <TableCell colSpan={4} className="text-right font-semibold">Total costo</TableCell>
                          <TableCell className="text-right font-bold tabular-nums">{formatCurrency(totalCostoGeneral)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            ) : null}

          </div>
        ) : null}
      </CardContent>

      {/* Nesting Sheet */}
      <Sheet open={nestingColorId != null} onOpenChange={(open) => { if (!open) setNestingColorId(null); }}>
        <SheetContent side="right" className="!w-[72vw] !max-w-none md:!w-[68vw] lg:!w-[64vw] xl:!w-[62vw] sm:!max-w-none flex flex-col overflow-hidden">
          <SheetHeader>
            <SheetTitle>Nesting</SheetTitle>
            <SheetDescription>
              Visualización del acomodamiento de piezas en el rollo.
            </SheetDescription>
          </SheetHeader>

          {/* Color tabs */}
          {colorResults.length > 1 ? (
            <div className="flex gap-1.5 border-b px-4 pb-3">
              {colorResults.map((cr, idx) => {
                const colorId = String(cr.colorId ?? idx);
                const isActive = nestingColorId === colorId;
                return (
                  <button
                    key={colorId}
                    type="button"
                    onClick={() => setNestingColorId(colorId)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
                  >
                    {String(cr.colorLabel ?? `Color ${idx + 1}`)}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Nesting content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {(() => {
              if (nestingColorId == null) return null;
              const colorResult = colorResults.find((cr) => String(cr.colorId) === nestingColorId) ?? null;
              const nestingData = buildColorNestingPreview(colorResult);
              if (!nestingData) return <p className="text-sm text-muted-foreground">No hay datos de nesting para este color.</p>;
              return (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Plotter</p>
                        <p className="font-semibold text-sm">{nestingData.machineLabel}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Perfil</p>
                        <p className="font-semibold text-sm">{String(nestingData.winner.perfilNombre ?? "-")}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Largo consumido</p>
                        <p className="font-semibold text-sm">
                          {Number(asRecord(nestingData.winner.resumenTecnico).largoConsumidoMl ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 3 })} m
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs text-muted-foreground">Desperdicio</p>
                        <p className="font-semibold text-sm">
                          {Number(asRecord(nestingData.winner.resumenTecnico).wastePct ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="max-h-[calc(100vh-320px)]">
                    <VinylCutNestingWorkspace
                      machineLabel={nestingData.machineLabel}
                      rollWidthCm={nestingData.rollWidthCm}
                      rollLengthCm={nestingData.rollLengthCm}
                      pieces={nestingData.pieces}
                      marginLeftCm={nestingData.marginLeftCm}
                      marginRightCm={nestingData.marginRightCm}
                      marginTopCm={nestingData.marginTopCm}
                      marginBottomCm={nestingData.marginBottomCm}
                      separacionHorizontalCm={nestingData.separacionHorizontalCm}
                      separacionVerticalCm={nestingData.separacionVerticalCm}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}

// ─── Motor UI Contract ───────────────────────────────────────────────────────

export const vinylCutMotorUi: ProductMotorUiContract = {
  key: "vinilo_de_corte@1",
  hiddenTabs: ["variantes"],
  tabOrder: [
    "general",
    "equipos_materiales",
    "ruta_base",
    "ruta_opcionales",
    "imposicion",
    "simular_costo",
    "precio",
    "simular_venta",
  ],
  tabs: {
    ruta_opcionales: VinylCutRutaOpcionalesTab,
    imposicion: VinylCutImposicionTab,
    simular_costo: VinylCutSimularCostoTab,
  },
  extraTabs: [
    {
      key: "equipos_materiales",
      label: "Equipos y materiales",
      render: VinylCutEquiposMaterialesTab,
    },
  ],
};
