"use client";

import * as React from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { WideFormatNestingCard } from "@/components/productos-servicios/motors/wide-format-nesting-card";
import {
  buildManualLayoutFromNestingPieces,
  buildWideFormatSimulatorDataFromPreview,
  cloneWideFormatManualLayout,
} from "@/components/productos-servicios/motors/wide-format-nesting.helpers";
import { WideFormatPanelEditorSheet } from "@/components/productos-servicios/motors/wide-format-panel-editor-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductoServicioChecklistCotizador } from "@/components/productos-servicios/producto-servicio-checklist";
import { getGranFormatoChecklist, getGranFormatoConfig, getCotizacionesProductoServicio, previewGranFormatoCostos } from "@/lib/productos-servicios-api";
import { getVarianteOptionChips } from "@/lib/materias-primas-variantes-display";
import { getMaquinaTecnologia } from "@/lib/maquinaria";
import type { GranFormatoCostosResponse, GranFormatoImposicionConfig, GranFormatoPanelizadoModo, ProductoChecklist } from "@/lib/productos-servicios";

function createGranFormatoImposicionMedida() {
  return {
    anchoMm: null,
    altoMm: null,
    cantidad: 1,
  };
}

const defaultGranFormatoImposicionConfig: GranFormatoImposicionConfig = {
  medidas: [createGranFormatoImposicionMedida()],
  piezaAnchoMm: null,
  piezaAltoMm: null,
  cantidadReferencia: 1,
  tecnologiaDefault: null,
  maquinaDefaultId: null,
  perfilDefaultId: null,
  permitirRotacion: true,
  separacionHorizontalMm: 0,
  separacionVerticalMm: 0,
  margenLateralIzquierdoMmOverride: null,
  margenLateralDerechoMmOverride: null,
  margenInicioMmOverride: null,
  margenFinalMmOverride: null,
  criterioOptimizacion: "menor_costo_total",
  panelizadoActivo: false,
  panelizadoDireccion: "automatica",
  panelizadoSolapeMm: null,
  panelizadoAnchoMaxPanelMm: null,
  panelizadoDistribucion: "equilibrada",
  panelizadoInterpretacionAnchoMaximo: "total",
  panelizadoModo: "automatico",
  panelizadoManualLayout: null,
};

function buildDefaultPeriodo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function createEmptyChecklist(productoId: string): ProductoChecklist {
  return {
    productoId,
    activo: true,
    preguntas: [],
    createdAt: null,
    updatedAt: null,
  };
}

function formatMmAsCm(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return String(Number((value / 10).toFixed(2)));
}

function formatMeasureSummary(medidas: Array<{ anchoMm: number; altoMm: number; cantidad: number }>) {
  if (!medidas.length) return "Sin medidas";
  return medidas.map((item) => `${formatMmAsCm(item.anchoMm)} × ${formatMmAsCm(item.altoMm)} cm × ${item.cantidad}`).join(" · ");
}

function formatChecklistMutationSummary(item: GranFormatoCostosResponse["mutacionesAplicadas"][number]) {
  const delta =
    item.ejes === "ambos"
      ? `${formatMmAsCm(item.deltaAnchoMm)} cm ancho y ${formatMmAsCm(item.deltaAltoMm)} cm alto`
      : item.ejes === "ancho"
        ? `${formatMmAsCm(item.deltaAnchoMm)} cm en ancho`
        : `${formatMmAsCm(item.deltaAltoMm)} cm en alto`;
  return `${item.respuesta}: +${formatMmAsCm(item.valorMmPorLado)} cm por lado (${delta})`;
}

function formatNumber(value: number | null | undefined, decimals = 2) {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function getPanelizadoModoLabel(value: GranFormatoPanelizadoModo | null | undefined) {
  if (value === "manual") return "Manual";
  return "Automático";
}

function getPanelizadoInterpretacionLabel(value: string | null | undefined) {
  if (value === "util") return "Solo ancho útil";
  return "Ancho total del panel";
}

function getWideFormatMaterialLabel(tipo: string) {
  if (tipo === "SUSTRATO") return "Sustrato";
  if (tipo === "TINTA") return "Tinta";
  if (tipo === "CHECKLIST_MATERIAL") return "Materiales opcionales";
  return tipo;
}

function renderGranFormatoMaterialDisplay(item: GranFormatoCostosResponse["materiasPrimas"][number]) {
  if (item.variantChips?.length) {
    return (
      <div className="space-y-1">
        <p>{item.nombre}</p>
        <div className="flex flex-wrap gap-1">
          {item.variantChips.map((chip) => (
            <span key={`${item.nombre}-${chip.label}-${chip.value}`} className="rounded border px-2 py-0.5 text-xs text-muted-foreground">
              {chip.label}: {chip.value}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (item.sku) return `${item.nombre} · ${item.sku}`;
  return item.nombre;
}

export function WideFormatSimularCostoTab(props: ProductTabProps) {
  const [tecnologiasCompatibles, setTecnologiasCompatibles] = React.useState<string[]>([]);
  const [maquinasCompatiblesIds, setMaquinasCompatiblesIds] = React.useState<string[]>([]);
  const [perfilesCompatiblesIds, setPerfilesCompatiblesIds] = React.useState<string[]>([]);
  const [materialBaseId, setMaterialBaseId] = React.useState("");
  const [materialesCompatiblesIds, setMaterialesCompatiblesIds] = React.useState<string[]>([]);
  const [imposicionConfig, setImposicionConfig] = React.useState<GranFormatoImposicionConfig>(defaultGranFormatoImposicionConfig);
  const [persistedImposicionConfig, setPersistedImposicionConfig] = React.useState<GranFormatoImposicionConfig>(defaultGranFormatoImposicionConfig);
  const [aplicaChecklistATodasLasTecnologias, setAplicaChecklistATodasLasTecnologias] = React.useState(true);
  const [checklistComun, setChecklistComun] = React.useState<ProductoChecklist>(createEmptyChecklist(props.producto.id));
  const [checklistsPorTecnologia, setChecklistsPorTecnologia] = React.useState<Record<string, ProductoChecklist>>({});
  const [costosPeriodo, setCostosPeriodo] = React.useState(buildDefaultPeriodo());
  const [costosTecnologia, setCostosTecnologia] = React.useState("");
  const [costosPerfilOverrideId, setCostosPerfilOverrideId] = React.useState("");
  const [costosChecklistRespuestas, setCostosChecklistRespuestas] = React.useState<Record<string, { respuestaId: string }>>({});
  const [costosMedidas, setCostosMedidas] = React.useState<GranFormatoImposicionConfig["medidas"]>([createGranFormatoImposicionMedida()]);
  const [costosPreview, setCostosPreview] = React.useState<GranFormatoCostosResponse | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = React.useState(true);
  const [isCalculatingCosts, startCalculatingCosts] = React.useTransition();
  const [isPanelEditorOpen, setIsPanelEditorOpen] = React.useState(false);
  const [isCostos3dOpen, setIsCostos3dOpen] = React.useState(false);

  const loadConfig = React.useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const [config, checklistConfig] = await Promise.all([
        getGranFormatoConfig(props.producto.id),
        getGranFormatoChecklist(props.producto.id),
      ]);
      setTecnologiasCompatibles(config.tecnologiasCompatibles);
      setMaquinasCompatiblesIds(config.maquinasCompatibles);
      setPerfilesCompatiblesIds(config.perfilesCompatibles);
      setMaterialBaseId(config.materialBaseId ?? "");
      setMaterialesCompatiblesIds(config.materialesCompatibles);
      const nextImposicion = {
        ...(config.imposicion ?? defaultGranFormatoImposicionConfig),
        panelizadoInterpretacionAnchoMaximo: config.imposicion?.panelizadoInterpretacionAnchoMaximo ?? "total",
        medidas:
          config.imposicion?.medidas?.length
            ? config.imposicion.medidas
            : config.imposicion?.piezaAnchoMm && config.imposicion?.piezaAltoMm
              ? [{ anchoMm: config.imposicion.piezaAnchoMm, altoMm: config.imposicion.piezaAltoMm, cantidad: config.imposicion.cantidadReferencia ?? 1 }]
              : [createGranFormatoImposicionMedida()],
      };
      setImposicionConfig(nextImposicion);
      setPersistedImposicionConfig(nextImposicion);
      setCostosMedidas(
        nextImposicion.medidas?.length
          ? nextImposicion.medidas.map((item) => ({
              anchoMm: item.anchoMm ?? null,
              altoMm: item.altoMm ?? null,
              cantidad: item.cantidad ?? 1,
            }))
          : [createGranFormatoImposicionMedida()],
      );
      setAplicaChecklistATodasLasTecnologias(checklistConfig.aplicaATodasLasTecnologias);
      setChecklistComun(
        checklistConfig.checklistComun?.preguntas.length
          ? checklistConfig.checklistComun
          : createEmptyChecklist(props.producto.id),
      );
      setChecklistsPorTecnologia(
        Object.fromEntries(checklistConfig.checklistsPorTecnologia.map((item) => [item.tecnologia, item.checklist])),
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la configuración de costos.");
    } finally {
      setIsLoadingConfig(false);
    }
  }, [props.producto.id]);

  React.useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const availableBaseMaterials = React.useMemo(
    () =>
      props.materiasPrimas.filter(
        (item) => item.activo && item.subfamilia === "sustrato_rollo_flexible" && item.variantes.some((variant) => variant.activo),
      ),
    [props.materiasPrimas],
  );
  const selectedBaseMaterial = React.useMemo(
    () => availableBaseMaterials.find((item) => item.id === materialBaseId) ?? null,
    [availableBaseMaterials, materialBaseId],
  );
  const availableMaterialVariants = React.useMemo(
    () => (selectedBaseMaterial?.variantes ?? []).filter((variant) => variant.activo),
    [selectedBaseMaterial],
  );
  const selectedMachines = React.useMemo(
    () => props.maquinas.filter((machine) => maquinasCompatiblesIds.includes(machine.id)),
    [maquinasCompatiblesIds, props.maquinas],
  );
  const costosTechnologies = React.useMemo(
    () => tecnologiasCompatibles.filter((item) => selectedMachines.some((machine) => getMaquinaTecnologia(machine) === item)),
    [selectedMachines, tecnologiasCompatibles],
  );
  const costosTechnology = React.useMemo(() => {
    if (costosTecnologia && costosTechnologies.includes(costosTecnologia)) return costosTecnologia;
    return costosTechnologies[0] ?? "";
  }, [costosTecnologia, costosTechnologies]);
  const costosProfileOptions = React.useMemo(() => {
    if (!costosTechnology) return [];
    const items = selectedMachines
      .filter((machine) => getMaquinaTecnologia(machine) === costosTechnology)
      .flatMap((machine) =>
        machine.perfilesOperativos.filter((profile) => profile.activo && perfilesCompatiblesIds.includes(profile.id)),
      );
    return items.filter((profile, index, list) => list.findIndex((item) => item.id === profile.id) === index);
  }, [costosTechnology, perfilesCompatiblesIds, selectedMachines]);
  const costosTechnologyLabel = React.useMemo(() => costosTechnology || "Seleccionar tecnología", [costosTechnology]);
  const costosPerfilOverrideLabel = React.useMemo(() => {
    if (!costosPerfilOverrideId) return "Usar perfil default del producto";
    return costosProfileOptions.find((item) => item.id === costosPerfilOverrideId)?.nombre ?? "Usar perfil default del producto";
  }, [costosPerfilOverrideId, costosProfileOptions]);
  const checklistCotizadorGranFormato = React.useMemo(() => {
    if (aplicaChecklistATodasLasTecnologias) return checklistComun;
    return checklistsPorTecnologia[costosTechnology] ?? createEmptyChecklist(props.producto.id);
  }, [
    aplicaChecklistATodasLasTecnologias,
    checklistComun,
    checklistsPorTecnologia,
    costosTechnology,
    props.producto.id,
  ]);
  const costosMaterialesAgrupados = React.useMemo(() => {
    const groups = new Map<
      string,
      {
        tipo: string;
        label: string;
        items: Array<GranFormatoCostosResponse["materiasPrimas"][number]>;
        totalCantidad: number;
        totalCosto: number;
      }
    >();
    for (const item of costosPreview?.materiasPrimas ?? []) {
      const tipo = item.tipo;
      const current =
        groups.get(tipo) ??
        { tipo, label: getWideFormatMaterialLabel(tipo), items: [], totalCantidad: 0, totalCosto: 0 };
      current.items.push(item);
      current.totalCantidad += Number(item.cantidad ?? 0);
      current.totalCosto += Number(item.costo ?? 0);
      groups.set(tipo, current);
    }
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [costosPreview]);

  React.useEffect(() => {
    if (!costosTecnologia && costosTechnologies.length > 0) {
      setCostosTecnologia(costosTechnologies[0]);
    }
  }, [costosTecnologia, costosTechnologies]);

  React.useEffect(() => {
    setCostosChecklistRespuestas({});
  }, [checklistCotizadorGranFormato]);

  React.useEffect(() => {
    if (costosPerfilOverrideId && !costosProfileOptions.some((item) => item.id === costosPerfilOverrideId)) {
      setCostosPerfilOverrideId("");
    }
  }, [costosPerfilOverrideId, costosProfileOptions]);

  const costosManualLayoutActual = React.useMemo(
    () =>
      imposicionConfig.panelizadoModo === "manual" && imposicionConfig.panelizadoManualLayout
        ? cloneWideFormatManualLayout(imposicionConfig.panelizadoManualLayout)
        : buildManualLayoutFromNestingPieces(costosPreview?.nestingPreview?.pieces ?? []),
    [costosPreview?.nestingPreview?.pieces, imposicionConfig.panelizadoManualLayout, imposicionConfig.panelizadoModo],
  );

  const calculateCosts = React.useCallback((config: GranFormatoImposicionConfig) => {
    const medidasValidas = costosMedidas.filter((item) => (item.anchoMm ?? 0) > 0 && (item.altoMm ?? 0) > 0 && (item.cantidad ?? 0) > 0);
    if (!medidasValidas.length) {
      toast.error("Completá al menos una medida válida para calcular costos.");
      return;
    }
    if (!costosTechnology) {
      toast.error("Seleccioná una tecnología para calcular costos.");
      return;
    }

    startCalculatingCosts(async () => {
      try {
        const result = await previewGranFormatoCostos(props.producto.id, {
          periodo: costosPeriodo,
          tecnologia: costosTechnology,
          perfilOverrideId: costosPerfilOverrideId || undefined,
          medidas: medidasValidas.map((item) => ({
            anchoMm: item.anchoMm ?? 0,
            altoMm: item.altoMm ?? 0,
            cantidad: item.cantidad ?? 1,
          })),
          checklistRespuestas: Object.entries(costosChecklistRespuestas)
            .filter(([, value]) => Boolean(value?.respuestaId))
            .map(([preguntaId, value]) => ({
              preguntaId,
              respuestaId: value.respuestaId,
            })),
          panelizado: {
            activo: config.panelizadoActivo,
            modo: config.panelizadoModo === "manual" && config.panelizadoManualLayout ? "manual" : "automatico",
            direccion: config.panelizadoDireccion,
            solapeMm: config.panelizadoSolapeMm,
            anchoMaxPanelMm: config.panelizadoAnchoMaxPanelMm,
            distribucion: config.panelizadoDistribucion,
            interpretacionAnchoMaximo: config.panelizadoInterpretacionAnchoMaximo,
            manualLayout: config.panelizadoModo === "manual" ? config.panelizadoManualLayout : null,
          },
        });
        setCostosPreview(result);
        await getCotizacionesProductoServicio(props.producto.id);
        toast.success("Costos calculados.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo calcular el costo.");
      }
    });
  }, [
    costosChecklistRespuestas,
    costosMedidas,
    costosPeriodo,
    costosPerfilOverrideId,
    costosTechnology,
    props.producto.id,
    startCalculatingCosts,
  ]);

  const handleCalcularCostos = () => {
    void calculateCosts(imposicionConfig);
  };

  const handleOpenPanelEditor = () => {
    if (!costosManualLayoutActual) {
      toast.error("Simulá primero un costo con panelizado para poder editar los paneles.");
      return;
    }
    setIsPanelEditorOpen(true);
  };

  const handleApplyPanelEditor = (layout: NonNullable<typeof costosManualLayoutActual>) => {
    const nextConfig = {
      ...imposicionConfig,
      panelizadoActivo: true,
      panelizadoModo: "manual" as const,
      panelizadoManualLayout: layout,
    };
    setImposicionConfig((prev) => ({
      ...prev,
      panelizadoActivo: true,
      panelizadoModo: "manual",
      panelizadoManualLayout: layout,
    }));
    setIsPanelEditorOpen(false);
    void calculateCosts(nextConfig);
  };

  const handleRestoreAutomaticPanelLayout = () => {
    setImposicionConfig((prev) => ({
      ...prev,
      panelizadoModo: persistedImposicionConfig.panelizadoModo ?? "automatico",
      panelizadoManualLayout: cloneWideFormatManualLayout(persistedImposicionConfig.panelizadoManualLayout),
    }));
    setIsPanelEditorOpen(false);
    void calculateCosts({
      ...imposicionConfig,
      panelizadoModo: persistedImposicionConfig.panelizadoModo ?? "automatico",
      panelizadoManualLayout: cloneWideFormatManualLayout(persistedImposicionConfig.panelizadoManualLayout),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Simulador de costos</CardTitle>
          <CardDescription>
            Ejecuta una simulación operativa del trabajo usando la base técnica definida en Imposición.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingConfig ? (
            <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
              <GdiSpinner className="size-4" />
              Cargando configuración de costos...
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.95fr)]">
                <div className="rounded-lg border p-3">
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
                    {costosMedidas.map((medida, index) => (
                      <div key={`costos-medida-${index}`} className="grid gap-2 rounded-lg border p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_40px_40px]">
                        <Field>
                          <Input
                            aria-label={`Ancho (cm) fila ${index + 1}`}
                            value={formatMmAsCm(medida.anchoMm)}
                            onChange={(event) => {
                              const value = event.target.value;
                              setCostosMedidas((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, anchoMm: value.trim() ? Math.round(Number(value) * 10) : null } : item,
                                ),
                              );
                            }}
                          />
                        </Field>
                        <Field>
                          <Input
                            aria-label={`Alto (cm) fila ${index + 1}`}
                            value={formatMmAsCm(medida.altoMm)}
                            onChange={(event) => {
                              const value = event.target.value;
                              setCostosMedidas((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, altoMm: value.trim() ? Math.round(Number(value) * 10) : null } : item,
                                ),
                              );
                            }}
                          />
                        </Field>
                        <Field>
                          <Input
                            aria-label={`Cantidad fila ${index + 1}`}
                            type="number"
                            min={1}
                            value={medida.cantidad}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setCostosMedidas((prev) =>
                                prev.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, cantidad: Number.isFinite(value) && value > 0 ? value : 1 } : item,
                                ),
                              );
                            }}
                          />
                        </Field>
                        <div className="flex items-end">
                          <Button type="button" variant="ghost" size="icon" aria-label="Agregar nueva medida" onClick={() => setCostosMedidas((prev) => [...prev, createGranFormatoImposicionMedida()])}>
                            <PlusIcon className="size-4" />
                          </Button>
                        </div>
                        <div className="flex items-end">
                          <Button type="button" variant="ghost" size="icon" disabled={costosMedidas.length === 1} onClick={() => setCostosMedidas((prev) => (prev.length === 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index)))}>
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                      <FieldLabel className="sm:mb-0">Tecnología</FieldLabel>
                      <Select value={costosTechnology} onValueChange={(value) => setCostosTecnologia(value ?? "")}>
                        <SelectTrigger>
                          <SelectValue>{costosTechnologyLabel}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {costosTechnologies.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                      <FieldLabel className="sm:mb-0">Perfil operativo</FieldLabel>
                      <Select value={costosPerfilOverrideId || "__default__"} onValueChange={(value) => setCostosPerfilOverrideId(value === "__default__" || value == null ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue>{costosPerfilOverrideLabel}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">Usar perfil default del producto</SelectItem>
                          {costosProfileOptions.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                      <FieldLabel className="sm:mb-0">Período tarifa</FieldLabel>
                      <Input value={costosPeriodo} placeholder="YYYY-MM" onChange={(event) => setCostosPeriodo(event.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">Opcionales para costear</p>
                <ProductoServicioChecklistCotizador checklist={checklistCotizadorGranFormato} value={costosChecklistRespuestas} onChange={setCostosChecklistRespuestas} />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" onClick={handleCalcularCostos} disabled={isCalculatingCosts}>
                  {isCalculatingCosts ? <GdiSpinner className="size-4" data-icon="inline-start" /> : null}
                  Simular costo
                </Button>
              </div>

              {costosPreview?.warnings?.length ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  {costosPreview.warnings.map((warning, index) => (
                    <p key={`costos-warning-${index}`}>{warning}</p>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {costosPreview ? (
        <>
          {costosPreview.nestingPreview ? (
            <div className="space-y-3">
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCostos3dOpen(true)}>
                  Ver nesting 3D
                </Button>
                {costosPreview.resumenTecnico.panelizado ? (
                  <Button type="button" variant="outline" onClick={handleOpenPanelEditor}>
                    Editar paneles
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Resumen técnico</CardTitle>
              <CardDescription>Candidato elegido para costear material, tinta y tiempo operativo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                <p><span className="font-medium">Original:</span> {formatMeasureSummary(costosPreview.medidasOriginales)}</p>
                <p><span className="font-medium">Efectiva:</span> {formatMeasureSummary(costosPreview.medidasEfectivas)}</p>
                {costosPreview.mutacionesAplicadas.length > 0 ? (
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    {costosPreview.mutacionesAplicadas.map((item) => (
                      <p key={`${item.reglaId}-${item.respuestaId}`}>{formatChecklistMutationSummary(item)}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-muted-foreground">No se aplicaron mutaciones sobre la medida.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {costosPreview.resumenTecnico.varianteChips.map((chip) => (
                  <Badge key={`${chip.label}-${chip.value}`} variant="outline">
                    {chip.label}: {chip.value}
                  </Badge>
                ))}
              </div>
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Ancho rollo</TableHead>
                    <TableHead>Ancho imprimible</TableHead>
                    <TableHead>Orientación</TableHead>
                    <TableHead className="text-right">Piezas/fila</TableHead>
                    <TableHead className="text-right">Filas</TableHead>
                    <TableHead className="text-right">Largo consumido</TableHead>
                    <TableHead className="text-right">Desperdicio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>{formatMmAsCm(costosPreview.resumenTecnico.anchoRolloMm)} cm</TableCell>
                    <TableCell>{formatMmAsCm(costosPreview.resumenTecnico.anchoImprimibleMm)} cm</TableCell>
                    <TableCell>
                      <div>
                        <p>
                          {costosPreview.resumenTecnico.orientacion === "mixta"
                            ? "Mixta"
                            : costosPreview.resumenTecnico.orientacion === "rotada"
                              ? "Rotada"
                              : "Normal"}
                        </p>
                        {costosPreview.resumenTecnico.panelizado ? (
                          <p className="text-xs text-muted-foreground">
                            Panelizado {costosPreview.resumenTecnico.panelAxis === "vertical" ? "vertical" : "horizontal"} · {formatNumber(costosPreview.resumenTecnico.panelCount, 0)} paneles · {costosPreview.resumenTecnico.panelDistribution === "libre" ? "Libre" : "Equilibrada"}
                            {costosPreview.resumenTecnico.panelMaxWidthMm != null ? ` · Máx. ${formatMmAsCm(costosPreview.resumenTecnico.panelMaxWidthMm)} cm` : ""}
                            {costosPreview.resumenTecnico.panelWidthInterpretation ? ` · ${getPanelizadoInterpretacionLabel(costosPreview.resumenTecnico.panelWidthInterpretation)}` : ""}
                            {costosPreview.resumenTecnico.panelMode ? ` · ${getPanelizadoModoLabel(costosPreview.resumenTecnico.panelMode)}` : ""}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(costosPreview.resumenTecnico.piezasPorFila, 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(costosPreview.resumenTecnico.filas, 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(costosPreview.resumenTecnico.largoConsumidoMm / 1000, 2)} m</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(costosPreview.resumenTecnico.desperdicioPct, 2)}% · {formatNumber(costosPreview.resumenTecnico.areaDesperdicioM2, 2)} m2
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Centro de costos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Paso</TableHead>
                    <TableHead>Centro</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead className="text-right">Minutos</TableHead>
                    <TableHead className="text-right">Tarifa/h</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costosPreview.centrosCosto.map((item) => (
                    <TableRow key={`${item.codigo}-${item.orden}`}>
                      <TableCell>{item.orden}</TableCell>
                      <TableCell>{item.paso}</TableCell>
                      <TableCell>{item.centroCostoNombre || "-"}</TableCell>
                      <TableCell>{item.origen}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(item.minutos, 2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.tarifaHora)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.costo)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={6} className="text-right font-medium">
                      Total centro de costos
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(costosPreview.totales.centrosCosto)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Materias primas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {costosMaterialesAgrupados.map((grupo) => (
                <div key={grupo.tipo} className="rounded-lg border">
                  <div className="flex items-center justify-between gap-3 border-b px-3 py-3">
                    <div>
                      <p className="font-medium">{grupo.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {grupo.items.length} componente{grupo.items.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Costo total</p>
                      <p className="font-medium tabular-nums">{formatCurrency(grupo.totalCosto)}</p>
                    </div>
                  </div>
                  <Table className="table-fixed">
                    <colgroup>
                      <col className="w-auto" />
                      <col className="w-[140px]" />
                      <col className="w-[140px]" />
                      <col className="w-[160px]" />
                      <col className="w-[160px]" />
                    </colgroup>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Componente</TableHead>
                        <TableHead className="whitespace-nowrap">Origen</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Cantidad</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Costo unitario</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Costo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupo.items.map((item, index) => (
                        <TableRow key={`${grupo.tipo}-${index}`}>
                          <TableCell className="align-top">{renderGranFormatoMaterialDisplay(item)}</TableCell>
                          <TableCell className="align-top whitespace-nowrap">{item.origen}</TableCell>
                          <TableCell className="align-top text-right tabular-nums whitespace-nowrap">
                            {formatNumber(item.cantidad, 2)}{item.unidad ? ` ${item.unidad}` : ""}
                          </TableCell>
                          <TableCell className="align-top text-right tabular-nums whitespace-nowrap">{formatCurrency(item.costoUnitario)}</TableCell>
                          <TableCell className="align-top text-right tabular-nums whitespace-nowrap">{formatCurrency(item.costo)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={4} className="text-right font-medium">
                          Total {grupo.label}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(grupo.totalCosto)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ))}
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total materias primas</span>
                  <span className="font-semibold">{formatCurrency(costosPreview.totales.materiales)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-medium">Costo técnico total</span>
                  <span className="text-lg font-semibold">{formatCurrency(costosPreview.totales.tecnico)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
      <WideFormatPanelEditorSheet
        open={isPanelEditorOpen}
        onOpenChange={setIsPanelEditorOpen}
        context="costos"
        initialLayout={costosManualLayoutActual}
        currentMode={imposicionConfig.panelizadoModo}
        printableWidthMm={costosPreview?.resumenTecnico.anchoImprimibleMm ?? 0}
        panelizadoSolapeMm={imposicionConfig.panelizadoSolapeMm}
        panelizadoDistribucion={imposicionConfig.panelizadoDistribucion}
        panelizadoAnchoMaxPanelMm={imposicionConfig.panelizadoAnchoMaxPanelMm}
        panelizadoInterpretacionAnchoMaximo={imposicionConfig.panelizadoInterpretacionAnchoMaximo}
        onApply={handleApplyPanelEditor}
        onRestoreAutomatic={handleRestoreAutomaticPanelLayout}
      />
      <Sheet open={isCostos3dOpen} onOpenChange={setIsCostos3dOpen}>
        <SheetContent side="right" className="!w-[72vw] !max-w-none md:!w-[68vw] lg:!w-[64vw] xl:!w-[62vw] sm:!max-w-none">
          <SheetHeader>
            <SheetTitle>Visualización 3D del nesting</SheetTitle>
            <SheetDescription>
              Render del candidato técnico elegido para costear el producto, con márgenes y distribución sobre el rollo.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {costosPreview?.nestingPreview ? (
              <WideFormatNestingCard
                title="Vista 3D del nesting"
                description="Representación del candidato técnico elegido para costear el producto."
                simulator={buildWideFormatSimulatorDataFromPreview(costosPreview.nestingPreview)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
