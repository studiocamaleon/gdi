"use client";

import * as React from "react";
import { PlusIcon, RefreshCcwIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import type {
  ProductMotorUiContract,
  ProductTabProps,
} from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { VinylCutNestingWorkspace } from "@/components/vinyl-cut-nesting-workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { getVarianteOptionChips } from "@/lib/materias-primas-variantes-display";

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
  materialVarianteId: string | null;
  medidas: Array<{ anchoMm: number; altoMm: number; cantidad: number }>;
};

function configToColores(config: Record<string, unknown>): ColorDraft[] {
  if (Array.isArray(config.colores) && config.colores.length > 0) {
    return (config.colores as VinylCutColorEntry[]).map((entry) => ({
      id: entry.id ?? newColorId(),
      label: entry.label ?? "Color",
      materialVarianteId: entry.materialVarianteId ?? null,
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
        medidas: (config.medidas as Array<Record<string, unknown>>).map((m) => ({
          anchoMm: Number(m.anchoMm ?? 0),
          altoMm: Number(m.altoMm ?? 0),
          cantidad: Number(m.cantidad ?? 1),
        })),
      },
    ];
  }
  return [{ id: newColorId(), label: "Color 1", materialVarianteId: null, medidas: [{ anchoMm: 0, altoMm: 0, cantidad: 1 }] }];
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
  const [anchoUnit, setAnchoUnit] = React.useState<MedidaUnit>("mm");
  const [altoUnit, setAltoUnit] = React.useState<MedidaUnit>("mm");
  const cycleAnchoUnit = () =>
    setAnchoUnit((u) => MEDIDA_UNITS[(MEDIDA_UNITS.indexOf(u) + 1) % MEDIDA_UNITS.length]);
  const cycleAltoUnit = () =>
    setAltoUnit((u) => MEDIDA_UNITS[(MEDIDA_UNITS.indexOf(u) + 1) % MEDIDA_UNITS.length]);

  // Helpers: convert mm ↔ display unit
  const toDisplay = (mm: number, unit: MedidaUnit) =>
    unit === "mm" ? mm : convertUnitValue(mm, "mm", unit);
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
            .map((v) => ({ variantId: v.id, label: `${m.nombre} · ${v.sku}` })),
        ),
    [props.materiasPrimas, enabledVariantIds],
  );

  const addColor = () =>
    setColores((prev) => [
      ...prev,
      {
        id: newColorId(),
        label: `Color ${prev.length + 1}`,
        materialVarianteId: null,
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
                  <div className="flex items-center gap-3">
                    <div className="flex-1 grid gap-3 sm:grid-cols-2">
                      <Field>
                        <FieldLabel>Nombre del color</FieldLabel>
                        <Input
                          value={color.label}
                          onChange={(e) => updateColor(color.id, { label: e.target.value })}
                          placeholder={`Color ${colorIdx + 1}`}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Material (variante)</FieldLabel>
                        <Select
                          value={color.materialVarianteId ?? "__global__"}
                          onValueChange={(v) =>
                            updateColor(color.id, {
                              materialVarianteId: v === "__global__" ? null : v,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__global__">Pool global de materiales</SelectItem>
                            {vinylMaterialVariants.map((v) => (
                              <SelectItem key={v.variantId} value={v.variantId}>
                                {v.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 mt-5"
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
  const [quoteResult, setQuoteResult] = React.useState<Record<string, unknown> | null>(null);
  const [cantidadTrabajo, setCantidadTrabajo] = React.useState("1");

  const quote = () => {
    if (!props.selectedVariantId) return;
    startQuoting(async () => {
      try {
        const result = await cotizarProductoVariante(props.selectedVariantId, {
          cantidad: Math.max(1, Number(cantidadTrabajo || 1)),
          parametros: config,
        });
        setQuoteResult(result as Record<string, unknown>);
      } catch (error) {
        console.error(error);
        toast.error("No se pudo simular el costo.");
      }
    });
  };

  const coloresResumen = React.useMemo(
    () =>
      Array.isArray(asRecord(quoteResult?.trazabilidad).coloresResumen)
        ? (asRecord(quoteResult?.trazabilidad).coloresResumen as Array<Record<string, unknown>>)
        : [],
    [quoteResult],
  );

  const procesos = React.useMemo(
    () =>
      Array.isArray(asRecord(quoteResult?.bloques).procesos)
        ? (asRecord(quoteResult?.bloques).procesos as Array<Record<string, unknown>>)
        : [],
    [quoteResult],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simular costo</CardTitle>
        <CardDescription>
          Calcula materiales y centros de costo desde el nesting configurado. Cada color se simula
          independientemente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!props.selectedVariant ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Creá y seleccioná una variante para habilitar la simulación de costos.
          </div>
        ) : null}

        <div className="flex items-end gap-4">
          <Field className="max-w-xs">
            <FieldLabel>Cantidad de trabajos</FieldLabel>
            <Input
              type="number"
              value={cantidadTrabajo}
              onChange={(e) => setCantidadTrabajo(e.target.value)}
            />
          </Field>
          <Button onClick={quote} disabled={isQuoting || !props.selectedVariantId}>
            {isQuoting ? (
              <GdiSpinner className="mr-2 size-4" />
            ) : (
              <RefreshCcwIcon className="mr-2 size-4" />
            )}
            Simular costo
          </Button>
        </div>

        {quoteResult ? (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-semibold">
                    ${Number(quoteResult.total ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Unitario ML</p>
                  <p className="font-semibold">
                    ${Number(quoteResult.unitario ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Procesos</p>
                  <p className="font-semibold">
                    ${Number(asRecord(quoteResult.subtotales).procesos ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Materiales</p>
                  <p className="font-semibold">
                    ${Number(asRecord(quoteResult.subtotales).papel ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Per-color material breakdown */}
            {coloresResumen.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm font-semibold">Materiales por color</p>
                {coloresResumen.map((cr, idx) => {
                  const colorMateriales = Array.isArray(cr.materiasPrimas)
                    ? (cr.materiasPrimas as Array<Record<string, unknown>>)
                    : [];
                  const colorTotales = asRecord(cr.totales);
                  return (
                    <Card key={String(cr.colorId ?? idx)}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{String(cr.colorLabel ?? `Color ${idx + 1}`)}</CardTitle>
                          <span className="text-sm text-muted-foreground">
                            Materiales: $
                            {Number(colorTotales.materiales ?? 0).toLocaleString("es-AR", {
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Material</TableHead>
                              <TableHead>Cantidad</TableHead>
                              <TableHead>Costo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {colorMateriales.map((item, mIdx) => (
                              <TableRow key={mIdx}>
                                <TableCell>{String(item.nombre ?? "-")}</TableCell>
                                <TableCell>
                                  {Number(item.cantidad ?? 0).toLocaleString("es-AR", {
                                    maximumFractionDigits: 3,
                                  })}{" "}
                                  {String(item.unidad ?? "")}
                                </TableCell>
                                <TableCell>
                                  $
                                  {Number(item.costo ?? 0).toLocaleString("es-AR", {
                                    maximumFractionDigits: 2,
                                  })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : null}

            {/* Procesos (single merged block) */}
            {procesos.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Procesos de corte</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Paso</TableHead>
                        <TableHead>Centro de costo</TableHead>
                        <TableHead>Minutos</TableHead>
                        <TableHead>Costo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {procesos.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{String(item.nombre ?? "-")}</TableCell>
                          <TableCell>{String(item.centroCostoNombre ?? "-")}</TableCell>
                          <TableCell>
                            {Number(item.runMin ?? 0).toLocaleString("es-AR", {
                              maximumFractionDigits: 1,
                            })}
                          </TableCell>
                          <TableCell>
                            $
                            {Number(item.costo ?? 0).toLocaleString("es-AR", {
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </CardContent>
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
