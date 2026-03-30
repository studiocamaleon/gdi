"use client";

import * as React from "react";
import { RefreshCcwIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import type {
  ProductMotorUiContract,
  ProductTabProps,
} from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { VinylCutNestingWorkspace } from "@/components/vinyl-cut-nesting-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  cotizarProductoVariante,
  getProductoMotorConfig,
  previewImposicionProductoVariante,
  upsertProductoMotorConfig,
} from "@/lib/productos-servicios-api";

type MedidaDraft = {
  anchoMm: number;
  altoMm: number;
  cantidad: number;
};

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function buildPreviewPieces(preview: Record<string, unknown> | null) {
  const items = Array.isArray(preview?.items) ? preview.items : [];
  const best = (items[0] ?? null) as Record<string, unknown> | null;
  const nestingPreview = asRecord(best?.nestingPreview);
  const pieces = Array.isArray(nestingPreview.pieces) ? nestingPreview.pieces : [];
  return {
    best,
    machineLabel: String(best?.maquinaNombre ?? "Plotter"),
    rollWidthCm: Number(nestingPreview.rollWidth ?? 0),
    rollLengthCm: Number(nestingPreview.rollLength ?? 0),
    pieces: pieces.map((item) => {
      const row = asRecord(item);
      const w = Number(row.w ?? 0);
      const h = Number(row.h ?? 0);
      const cx = Number(row.cx ?? 0);
      const cy = Number(row.cy ?? 0);
      const rollWidth = Number(nestingPreview.rollWidth ?? 0);
      return {
        id: String(row.id ?? crypto.randomUUID()),
        label: String(row.label ?? `${w}x${h}`),
        widthCm: w,
        heightCm: h,
        xCm: cx + rollWidth / 2 - w / 2,
        yCm: cy - h / 2,
        rotated: Boolean(row.rotated),
      };
    }),
  };
}

function useVinylCutMotorState(props: ProductTabProps) {
  const [config, setConfig] = React.useState<Record<string, unknown>>(props.motorConfig?.parametros ?? {});
  const [isLoadingConfig, setIsLoadingConfig] = React.useState(false);
  const [isSavingConfig, startSavingConfig] = React.useTransition();
  const [previewResult, setPreviewResult] = React.useState<Record<string, unknown> | null>(null);
  const [quoteResult, setQuoteResult] = React.useState<Record<string, unknown> | null>(null);
  const [isPreviewing, startPreviewing] = React.useTransition();
  const [isQuoting, startQuoting] = React.useTransition();
  const [cantidadTrabajo, setCantidadTrabajo] = React.useState("1");

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

  const medidas = React.useMemo(() => {
    const raw = Array.isArray(config.medidas) ? config.medidas : [];
    if (!raw.length) return [{ anchoMm: 1000, altoMm: 300, cantidad: 1 }];
    return raw.map((item) => {
      const row = asRecord(item);
      return {
        anchoMm: Number(row.anchoMm ?? 1000),
        altoMm: Number(row.altoMm ?? 300),
        cantidad: Number(row.cantidad ?? 1),
      };
    });
  }, [config.medidas]);

  const vinylMaterials = React.useMemo(
    () =>
      props.materiasPrimas.filter(
        (item) =>
          item.activo &&
          item.subfamilia === "sustrato_rollo_flexible" &&
          (item.templateId === "vinilo_de_corte_rollo_v1" || item.tipoTecnico === "vinilo_de_corte_rollo"),
      ),
    [props.materiasPrimas],
  );
  const plotters = React.useMemo(
    () => props.maquinas.filter((item) => item.activo && item.plantilla === "plotter_de_corte"),
    [props.maquinas],
  );
  const selectedMachineIds = React.useMemo(() => new Set(toStringArray(config.plottersCompatibles)), [config.plottersCompatibles]);
  const selectedMaterialIds = React.useMemo(() => new Set(toStringArray(config.materialesCompatibles)), [config.materialesCompatibles]);
  const selectedProfileIds = React.useMemo(() => new Set(toStringArray(config.perfilesCompatibles)), [config.perfilesCompatibles]);
  const compatibleProfiles = React.useMemo(
    () =>
      plotters
        .filter((machine) => selectedMachineIds.size === 0 || selectedMachineIds.has(machine.id))
        .flatMap((machine) =>
          machine.perfilesOperativos
            .filter((profile) => profile.activo)
            .map((profile) => ({ machineId: machine.id, machineName: machine.nombre, profile })),
        ),
    [plotters, selectedMachineIds],
  );

  const updateMeasure = (index: number, patch: Partial<MedidaDraft>) => {
    setConfig((prev) => {
      const next = Array.isArray(prev.medidas) ? [...(prev.medidas as MedidaDraft[])] : [...medidas];
      next[index] = { ...next[index], ...patch };
      return { ...prev, medidas: next };
    });
  };

  const addMeasure = () =>
    setConfig((prev) => ({
      ...prev,
      medidas: [...medidas, { anchoMm: 1000, altoMm: 300, cantidad: 1 }],
    }));

  const toggleArrayId = (key: string, id: string) =>
    setConfig((prev) => {
      const current = new Set(toStringArray(prev[key]));
      if (current.has(id)) current.delete(id);
      else current.add(id);
      return { ...prev, [key]: Array.from(current) };
    });

  const saveConfig = () =>
    startSavingConfig(async () => {
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

  const preview = () => {
    if (!props.selectedVariantId) return;
    startPreviewing(async () => {
      try {
        const result = await previewImposicionProductoVariante(props.selectedVariantId, config);
        setPreviewResult(result);
      } catch (error) {
        console.error(error);
        toast.error("No se pudo simular la imposición.");
      }
    });
  };

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

  return {
    config,
    setConfig,
    isLoadingConfig,
    isSavingConfig,
    previewResult,
    quoteResult,
    isPreviewing,
    isQuoting,
    cantidadTrabajo,
    setCantidadTrabajo,
    vinylMaterials,
    plotters,
    selectedMachineIds,
    selectedMaterialIds,
    selectedProfileIds,
    compatibleProfiles,
    medidas,
    updateMeasure,
    addMeasure,
    toggleArrayId,
    saveConfig,
    preview,
    quote,
  };
}

function useVinylCutTabState(props: ProductTabProps) {
  return useVinylCutMotorState(props);
}

function VinylCutNoVariantNotice({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function VinylCutImposicionTab(props: ProductTabProps) {
  const state = useVinylCutTabState(props);
  const bestPreview = React.useMemo(() => buildPreviewPieces(state.previewResult), [state.previewResult]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Imposición</CardTitle>
        <CardDescription>Nesting sobre rollo y configuración técnica del plotter.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!props.selectedVariant ? (
          <VinylCutNoVariantNotice text="Creá y seleccioná una variante para habilitar la simulación de nesting." />
        ) : null}
        {state.isLoadingConfig ? <GdiSpinner /> : null}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold">Plotters compatibles</p>
            {state.plotters.map((machine) => (
              <label key={machine.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                <Checkbox checked={state.selectedMachineIds.has(machine.id)} onCheckedChange={() => state.toggleArrayId("plottersCompatibles", machine.id)} />
                <span>{machine.nombre}</span>
              </label>
            ))}
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold">Materiales compatibles</p>
            {state.vinylMaterials.map((material) => (
              <label key={material.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                <Checkbox checked={state.selectedMaterialIds.has(material.id)} onCheckedChange={() => state.toggleArrayId("materialesCompatibles", material.id)} />
                <span>{material.nombre}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold">Perfiles compatibles</p>
          <div className="grid gap-3 md:grid-cols-2">
            {state.compatibleProfiles.map((item) => (
              <label key={item.profile.id} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                <Checkbox checked={state.selectedProfileIds.has(item.profile.id)} onCheckedChange={() => state.toggleArrayId("perfilesCompatibles", item.profile.id)} />
                <span>{item.machineName} · {item.profile.nombre}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field>
            <FieldLabel>Plotter por defecto</FieldLabel>
            <Select value={String(state.config.maquinaDefaultId ?? "__none__")} onValueChange={(value) => state.setConfig((prev) => ({ ...prev, maquinaDefaultId: value === "__none__" ? null : value ?? null }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Automático</SelectItem>
                {state.plotters.filter((item) => state.selectedMachineIds.size === 0 || state.selectedMachineIds.has(item.id)).map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Perfil por defecto</FieldLabel>
            <Select value={String(state.config.perfilDefaultId ?? "__none__")} onValueChange={(value) => state.setConfig((prev) => ({ ...prev, perfilDefaultId: value === "__none__" ? null : value ?? null }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Automático</SelectItem>
                {state.compatibleProfiles.map((item) => (
                  <SelectItem key={item.profile.id} value={item.profile.id}>{item.machineName} · {item.profile.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Material override</FieldLabel>
            <Select value={String(state.config.materialOverrideId ?? "__none__")} onValueChange={(value) => state.setConfig((prev) => ({ ...prev, materialOverrideId: value === "__none__" ? null : value ?? null }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Automático</SelectItem>
                {state.vinylMaterials.flatMap((material) => material.variantes.filter((variant) => variant.activo).map((variant) => (
                  <SelectItem key={variant.id} value={variant.id}>{material.nombre} · {variant.sku}</SelectItem>
                )))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ancho (mm)</TableHead>
              <TableHead>Alto (mm)</TableHead>
              <TableHead>Cantidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.medidas.map((medida, index) => (
              <TableRow key={index}>
                <TableCell><Input type="number" value={String(medida.anchoMm)} onChange={(e) => state.updateMeasure(index, { anchoMm: Number(e.target.value || 0) })} /></TableCell>
                <TableCell><Input type="number" value={String(medida.altoMm)} onChange={(e) => state.updateMeasure(index, { altoMm: Number(e.target.value || 0) })} /></TableCell>
                <TableCell><Input type="number" value={String(medida.cantidad)} onChange={(e) => state.updateMeasure(index, { cantidad: Number(e.target.value || 1) })} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex gap-3">
          <Button variant="outline" onClick={state.addMeasure}>Agregar medida</Button>
          <Button variant="outline" onClick={state.saveConfig} disabled={state.isSavingConfig}>
            {state.isSavingConfig ? <GdiSpinner className="mr-2 size-4" /> : <SaveIcon className="mr-2 size-4" />}
            Guardar configuración
          </Button>
          <Button onClick={state.preview} disabled={state.isPreviewing || !props.selectedVariantId}>
            {state.isPreviewing ? <GdiSpinner className="mr-2 size-4" /> : <RefreshCcwIcon className="mr-2 size-4" />}
            Simular nesting
          </Button>
        </div>

        {bestPreview.best ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Plotter</p><p className="font-semibold">{String(bestPreview.best.maquinaNombre ?? "-")}</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Perfil</p><p className="font-semibold">{String(bestPreview.best.perfilNombre ?? "-")}</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Largo consumido</p><p className="font-semibold">{(Number(asRecord(bestPreview.best.resumenTecnico).largoConsumidoMm ?? 0) / 1000).toLocaleString("es-AR", { maximumFractionDigits: 3 })} m</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Desperdicio</p><p className="font-semibold">{Number(asRecord(bestPreview.best.resumenTecnico).desperdicioPct ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%</p></CardContent></Card>
            </div>
            <VinylCutNestingWorkspace
              machineLabel={bestPreview.machineLabel}
              rollWidthCm={bestPreview.rollWidthCm}
              rollLengthCm={bestPreview.rollLengthCm}
              pieces={bestPreview.pieces}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function VinylCutSimularCostoTab(props: ProductTabProps) {
  const state = useVinylCutTabState(props);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Simular costo</CardTitle>
        <CardDescription>Calcula materiales y centros de costo desde el nesting configurado.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!props.selectedVariant ? (
          <VinylCutNoVariantNotice text="Creá y seleccioná una variante para habilitar la simulación de costos." />
        ) : null}
        <Field>
          <FieldLabel>Cantidad de trabajos</FieldLabel>
          <Input type="number" value={state.cantidadTrabajo} onChange={(e) => state.setCantidadTrabajo(e.target.value)} />
        </Field>
        <Button onClick={state.quote} disabled={state.isQuoting || !props.selectedVariantId}>
          {state.isQuoting ? <GdiSpinner className="mr-2 size-4" /> : <RefreshCcwIcon className="mr-2 size-4" />}
          Simular costo
        </Button>
        {state.quoteResult ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold">${Number(state.quoteResult.total ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Unitario ML</p><p className="font-semibold">${Number(state.quoteResult.unitario ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Procesos</p><p className="font-semibold">${Number(asRecord(state.quoteResult.subtotales).procesos ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</p></CardContent></Card>
              <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Materiales</p><p className="font-semibold">${Number(asRecord(state.quoteResult.subtotales).papel ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</p></CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Materiales</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Cantidad</TableHead><TableHead>Costo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(asRecord(state.quoteResult.bloques).materiales as Array<Record<string, unknown>> | undefined)?.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{String(item.nombre ?? "-")}</TableCell>
                        <TableCell>{Number(item.cantidad ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 3 })} {String(item.unidad ?? "")}</TableCell>
                        <TableCell>${Number(item.costo ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    )) ?? null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export const vinylCutMotorUi: ProductMotorUiContract = {
  key: "vinilo_de_corte@1",
  tabOrder: [
    "general",
    "variantes",
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
};
