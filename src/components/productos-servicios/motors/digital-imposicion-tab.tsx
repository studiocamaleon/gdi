"use client";

import * as React from "react";
import { EyeIcon, InfoIcon, Layers3Icon, PrinterIcon, SaveIcon, ScissorsIcon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getMateriaPrimaVarianteLabel } from "@/lib/materias-primas-variantes-display";
import {
  getCatalogoPliegosImpresion,
  getVarianteMotorOverride,
  previewImposicionProductoVariante,
  upsertVarianteMotorOverride,
} from "@/lib/productos-servicios-api";
import type { MateriaPrima, MateriaPrimaVariante } from "@/lib/materias-primas";
import type { PliegoImpresionCatalogItem } from "@/lib/productos-servicios";
import { carasProductoVarianteItems, tipoImpresionProductoVarianteItems } from "@/lib/productos-servicios";

type PapelOption = {
  id: string;
  label: string;
  anchoMm: number | null;
  altoMm: number | null;
};

type PreviewImposicionState = {
  hojaW: number;
  hojaH: number;
  piezaW: number;
  piezaH: number;
  printableW: number;
  printableH: number;
  utilW: number;
  utilH: number;
  effectiveW: number;
  effectiveH: number;
  orientacion: "normal" | "rotada";
  cols: number;
  rows: number;
  cortesGuillotina: number;
  piezasPorPliego: number;
  pliegosPorSustrato: number | null;
  orientacionSustrato: "normal" | "rotada" | null;
  sustratoAnchoMm: number | null;
  sustratoAltoMm: number | null;
  margins: {
    leftMm: number;
    rightMm: number;
    topMm: number;
    bottomMm: number;
  };
};

const tipoCorteItems = [
  {
    value: "sin_demasia",
    label: "Sin demasía",
    help: "Las piezas se acomodan con su medida final. Se recomienda cuando la guillotina puede cortar a línea final.",
  },
  {
    value: "con_demasia",
    label: "Con demasía",
    help: "Agrega demasía perimetral para cortar luego con más margen y precisión.",
  },
] as const;

const fallbackPliegosImpresion: PliegoImpresionCatalogItem[] = [
  { codigo: "A4", nombre: "A4", anchoMm: 210, altoMm: 297, label: "A4 (210 x 297 mm)" },
  { codigo: "A3", nombre: "A3", anchoMm: 297, altoMm: 420, label: "A3 (297 x 420 mm)" },
  { codigo: "SRA3", nombre: "SRA3", anchoMm: 320, altoMm: 450, label: "SRA3 (320 x 450 mm)" },
];

const uuidLikePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
}

function getGuillotinaCutsFromImposicion(cols: number, rows: number, tipoCorte: "sin_demasia" | "con_demasia") {
  const normalizedCols = Math.max(0, Math.floor(cols));
  const normalizedRows = Math.max(0, Math.floor(rows));
  if (normalizedCols <= 0 || normalizedRows <= 0) return 0;
  if (tipoCorte === "con_demasia") {
    return normalizedCols * 2 + normalizedRows * 2;
  }
  return normalizedCols + normalizedRows + 2;
}

function buildPapelOptions(materiasPrimas: MateriaPrima[]): PapelOption[] {
  const items: PapelOption[] = [];
  for (const mp of materiasPrimas) {
    if (mp.subfamilia !== "sustrato_hoja") continue;
    for (const variante of mp.variantes) {
      const varianteNombre = variante.nombreVariante?.trim();
      items.push({
        id: variante.id,
        label: `${mp.nombre}${varianteNombre ? ` · ${varianteNombre}` : ""} · ${variante.sku}`,
        anchoMm: readVariantDimensionMm(variante, "ancho"),
        altoMm: readVariantDimensionMm(variante, "alto"),
      });
    }
  }
  return items.sort((a, b) => a.label.localeCompare(b.label));
}

function getDigitalVariantDisplayLabel(
  variante: ProductTabProps["variantes"][number],
  papelLabelById: Map<string, string>,
) {
  const rawName = variante.nombre?.trim() ?? "";
  if (rawName && !uuidLikePattern.test(rawName)) return rawName;

  const parts: string[] = [`${variante.anchoMm} × ${variante.altoMm} mm`];
  const printModeLabel =
    tipoImpresionProductoVarianteItems.find((item) => item.value === variante.tipoImpresion)?.label ?? null;
  const carasLabel =
    carasProductoVarianteItems.find((item) => item.value === variante.caras)?.label ?? null;
  const papelLabel = variante.papelVarianteId ? papelLabelById.get(variante.papelVarianteId) ?? null : null;

  if (printModeLabel) parts.push(printModeLabel);
  if (carasLabel) parts.push(carasLabel);
  if (papelLabel) parts.push(papelLabel);

  return parts.join(" · ");
}

function readVariantDimensionMm(variante: MateriaPrimaVariante, key: "ancho" | "alto") {
  const raw = variante.atributosVariante?.[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readConfigRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function buildDefaultConfig() {
  return {
    tipoCorte: "sin_demasia",
    demasiaCorteMm: 0,
    lineaCorteMm: 3,
    tamanoPliegoImpresion: {
      codigo: "A4",
      nombre: "A4",
      anchoMm: 210,
      altoMm: 297,
    },
    mermaAdicionalPct: 0,
  } as Record<string, unknown>;
}

function normalizeDigitalImposicionSnapshot(config: Record<string, unknown>) {
  const tamanoRaw = readConfigRecord(config.tamanoPliegoImpresion);
  const tipoCorte = String(config.tipoCorte ?? "sin_demasia") === "con_demasia" ? "con_demasia" : "sin_demasia";
  return JSON.stringify({
    tipoCorte,
    demasiaCorteMm: tipoCorte === "con_demasia" ? Math.max(0, Number(config.demasiaCorteMm ?? 0)) : 0,
    lineaCorteMm: Math.max(0, Number(config.lineaCorteMm ?? 3)),
    mermaAdicionalPct: Math.max(0, Number(config.mermaAdicionalPct ?? 0)),
    tamanoPliegoImpresion: {
      codigo: String(tamanoRaw.codigo ?? "A4"),
      nombre: String(tamanoRaw.nombre ?? "A4"),
      anchoMm: Number(tamanoRaw.anchoMm ?? 210),
      altoMm: Number(tamanoRaw.altoMm ?? 297),
    },
  });
}

function mergeImposicionConfig(baseConfig: Record<string, unknown> | null | undefined, overrideConfig: Record<string, unknown> | null | undefined) {
  const incoming = {
    ...(baseConfig ?? {}),
    ...(overrideConfig ?? {}),
  } as Record<string, unknown>;
  const legacyTipoImposicion = String(incoming.tipoImposicion ?? "");
  const legacyPerimetral = Number(incoming.margenPerimetralCorteMm ?? 0);
  const legacyGap = Math.max(
    Number(incoming.gapHorizontalMm ?? 0),
    Number(incoming.gapVerticalMm ?? 0),
    legacyPerimetral,
  );
  const tipoCorte =
    String(incoming.tipoCorte ?? "") ||
    (legacyTipoImposicion === "doble_calle" ? "con_demasia" : "sin_demasia");
  const demasiaCorteMm =
    tipoCorte === "con_demasia"
      ? Number(incoming.demasiaCorteMm ?? legacyGap ?? 0)
      : 0;
  const lineaCorteMm = Number(incoming.lineaCorteMm ?? 3);
  const tamanoRaw = readConfigRecord(incoming.tamanoPliegoImpresion);
  return {
    ...buildDefaultConfig(),
    ...incoming,
    tipoCorte,
    demasiaCorteMm: Number.isFinite(demasiaCorteMm) ? Math.max(0, demasiaCorteMm) : 0,
    lineaCorteMm: Number.isFinite(lineaCorteMm) ? Math.max(0, lineaCorteMm) : 3,
    tamanoPliegoImpresion: {
      codigo: String(tamanoRaw.codigo ?? "A4"),
      nombre: String(tamanoRaw.nombre ?? "A4"),
      anchoMm: Number(tamanoRaw.anchoMm ?? 210),
      altoMm: Number(tamanoRaw.altoMm ?? 297),
    },
  } as Record<string, unknown>;
}

function buildPreviewImposicion(params: {
  selectedVariante: ProductTabProps["selectedVariant"];
  pliego: PliegoImpresionCatalogItem;
  demasiaCorteMm: number;
  lineaCorteMm: number;
  papelById: Map<string, PapelOption>;
  imposicionPreviewRaw: Record<string, unknown> | null;
  tipoCorteValue: "sin_demasia" | "con_demasia";
}): PreviewImposicionState | null {
  const { selectedVariante, pliego, demasiaCorteMm, lineaCorteMm, papelById, imposicionPreviewRaw, tipoCorteValue } = params;
  if (!selectedVariante) return null;
  const server = imposicionPreviewRaw ?? {};
  const serverImposicion = readConfigRecord(server.imposicion);
  const serverMargins = readConfigRecord(server.machineMargins);
  const serverPliego = readConfigRecord(server.pliegoImpresion);
  const piezaW = Math.max(1, Number(selectedVariante.anchoMm));
  const piezaH = Math.max(1, Number(selectedVariante.altoMm));
  const hojaW = Math.max(1, Number(serverPliego.anchoMm ?? pliego.anchoMm));
  const hojaH = Math.max(1, Number(serverPliego.altoMm ?? pliego.altoMm));
  const effectiveW = piezaW + demasiaCorteMm * 2;
  const effectiveH = piezaH + demasiaCorteMm * 2;
  const margins = {
    leftMm: Math.max(0, Number(serverMargins.leftMm ?? 0)),
    rightMm: Math.max(0, Number(serverMargins.rightMm ?? 0)),
    topMm: Math.max(0, Number(serverMargins.topMm ?? 0)),
    bottomMm: Math.max(0, Number(serverMargins.bottomMm ?? 0)),
  };
  const printableW = Math.max(0, hojaW - margins.leftMm - margins.rightMm);
  const printableH = Math.max(0, hojaH - margins.topMm - margins.bottomMm);
  const utilW = Math.max(0, printableW - lineaCorteMm * 2);
  const utilH = Math.max(0, printableH - lineaCorteMm * 2);
  const normalCols = Math.max(0, Math.floor(utilW / effectiveW));
  const normalRows = Math.max(0, Math.floor(utilH / effectiveH));
  const normal = normalCols * normalRows;
  const rotCols = Math.max(0, Math.floor(utilW / effectiveH));
  const rotRows = Math.max(0, Math.floor(utilH / effectiveW));
  const rotada = rotCols * rotRows;
  const orientacion: "normal" | "rotada" =
    String(serverImposicion.orientacion ?? "") === "rotada" || (rotada > normal && !Object.keys(serverImposicion).length)
      ? "rotada"
      : "normal";
  const cols = Math.max(0, Number(serverImposicion.cols ?? (orientacion === "rotada" ? rotCols : normalCols)));
  const rows = Math.max(0, Number(serverImposicion.rows ?? (orientacion === "rotada" ? rotRows : normalRows)));
  const papelSeleccionado = selectedVariante.papelVarianteId ? papelById.get(selectedVariante.papelVarianteId) : null;
  const sustratoAnchoMm = papelSeleccionado?.anchoMm ?? null;
  const sustratoAltoMm = papelSeleccionado?.altoMm ?? null;
  let pliegosPorSustrato: number | null = null;
  let orientacionSustrato: "normal" | "rotada" | null = null;
  if (sustratoAnchoMm && sustratoAltoMm) {
    const direct = Math.abs(sustratoAnchoMm - hojaW) < 0.01 && Math.abs(sustratoAltoMm - hojaH) < 0.01;
    const directRot = Math.abs(sustratoAnchoMm - hojaH) < 0.01 && Math.abs(sustratoAltoMm - hojaW) < 0.01;
    if (direct || directRot) {
      pliegosPorSustrato = 1;
      orientacionSustrato = direct ? "normal" : "rotada";
    } else {
      const sNormal = Math.floor(sustratoAnchoMm / hojaW) * Math.floor(sustratoAltoMm / hojaH);
      const sRot = Math.floor(sustratoAnchoMm / hojaH) * Math.floor(sustratoAltoMm / hojaW);
      pliegosPorSustrato = Math.max(1, sNormal, sRot);
      orientacionSustrato = sRot > sNormal ? "rotada" : "normal";
    }
  }
  return {
    hojaW,
    hojaH,
    piezaW,
    piezaH,
    printableW,
    printableH,
    utilW,
    utilH,
    effectiveW,
    effectiveH,
    orientacion,
    cols,
    rows,
    cortesGuillotina: getGuillotinaCutsFromImposicion(cols, rows, tipoCorteValue),
    piezasPorPliego: Math.max(normal, rotada),
    pliegosPorSustrato,
    orientacionSustrato,
    sustratoAnchoMm,
    sustratoAltoMm,
    margins,
  };
}

export function DigitalImposicionTab(props: ProductTabProps) {
  const papeles = React.useMemo(() => buildPapelOptions(props.materiasPrimas), [props.materiasPrimas]);
  const papelById = React.useMemo(() => new Map(papeles.map((item) => [item.id, item])), [papeles]);
  const papelLabelById = React.useMemo(() => new Map(papeles.map((item) => [item.id, item.label])), [papeles]);
  const variantesSelect = React.useMemo(
    () => props.variantes.filter((item) => item.activo || item.id === props.selectedVariantId),
    [props.selectedVariantId, props.variantes],
  );

  const [pliegosImpresion, setPliegosImpresion] = React.useState<PliegoImpresionCatalogItem[]>(fallbackPliegosImpresion);
  const [config, setConfig] = React.useState<Record<string, unknown>>(() => mergeImposicionConfig(props.motorConfig?.parametros, null));
  const [savedConfigSnapshot, setSavedConfigSnapshot] = React.useState(() =>
    normalizeDigitalImposicionSnapshot(mergeImposicionConfig(props.motorConfig?.parametros, null)),
  );
  const [imposicionPreviewRaw, setImposicionPreviewRaw] = React.useState<Record<string, unknown> | null>(null);
  const [svgZoom, setSvgZoom] = React.useState({ active: false, x: 50, y: 50 });
  const [isSavingConfig, startSavingConfig] = React.useTransition();

  React.useEffect(() => {
    getCatalogoPliegosImpresion()
      .then((items) => {
        if (items.length > 0) {
          setPliegosImpresion(items);
        }
      })
      .catch(() => {
        setPliegosImpresion(fallbackPliegosImpresion);
      });
  }, []);

  React.useEffect(() => {
    if (!props.selectedVariant) {
      const nextConfig = mergeImposicionConfig(props.motorConfig?.parametros, null);
      setConfig(nextConfig);
      setSavedConfigSnapshot(normalizeDigitalImposicionSnapshot(nextConfig));
      setImposicionPreviewRaw(null);
      return;
    }
    let cancelled = false;
    getVarianteMotorOverride(props.selectedVariant.id)
      .then((overrideConfig) => {
        if (cancelled) return;
        const nextConfig = mergeImposicionConfig(props.motorConfig?.parametros, overrideConfig.parametros ?? null);
        setConfig(nextConfig);
        setSavedConfigSnapshot(normalizeDigitalImposicionSnapshot(nextConfig));
      })
      .catch(() => {
        if (cancelled) return;
        const nextConfig = mergeImposicionConfig(props.motorConfig?.parametros, null);
        setConfig(nextConfig);
        setSavedConfigSnapshot(normalizeDigitalImposicionSnapshot(nextConfig));
      });
    return () => {
      cancelled = true;
    };
  }, [props.motorConfig?.updatedAt, props.motorConfig?.versionConfig, props.selectedVariant?.id]);

  const tipoCorteValue = String(config.tipoCorte ?? "sin_demasia") === "con_demasia" ? "con_demasia" : "sin_demasia";
  const tipoCorteSelected = tipoCorteItems.find((item) => item.value === tipoCorteValue) ?? tipoCorteItems[0];
  const demasiaCorteMm = tipoCorteValue === "con_demasia" ? Math.max(0, Number(config.demasiaCorteMm ?? 0)) : 0;
  const lineaCorteMm = Math.max(0, Number(config.lineaCorteMm ?? 3));
  const tamanoPliegoRaw = readConfigRecord(config.tamanoPliegoImpresion);
  const tamanoPliegoCodigo = String(tamanoPliegoRaw.codigo ?? "A4");
  const tamanoPliegoSeleccionado =
    pliegosImpresion.find((item) => item.codigo === tamanoPliegoCodigo) ??
    ({
      codigo: tamanoPliegoCodigo,
      nombre: String(tamanoPliegoRaw.nombre ?? "Personalizado"),
      anchoMm: Number(tamanoPliegoRaw.anchoMm ?? 210),
      altoMm: Number(tamanoPliegoRaw.altoMm ?? 297),
      label: `${String(tamanoPliegoRaw.nombre ?? "Personalizado")} (${Number(tamanoPliegoRaw.anchoMm ?? 210)} x ${Number(tamanoPliegoRaw.altoMm ?? 297)} mm)`,
    } as PliegoImpresionCatalogItem);

  const imposicionPayloadConfig = React.useMemo(
    () => ({
      tipoCorte: tipoCorteValue,
      demasiaCorteMm: tipoCorteValue === "con_demasia" ? demasiaCorteMm : 0,
      lineaCorteMm,
      tamanoPliegoImpresion: {
        codigo: tamanoPliegoSeleccionado.codigo,
        nombre: tamanoPliegoSeleccionado.nombre,
        anchoMm: tamanoPliegoSeleccionado.anchoMm,
        altoMm: tamanoPliegoSeleccionado.altoMm,
      },
      mermaAdicionalPct: Number(config.mermaAdicionalPct ?? 0),
    }),
    [config.mermaAdicionalPct, demasiaCorteMm, lineaCorteMm, tamanoPliegoSeleccionado, tipoCorteValue],
  );

  React.useEffect(() => {
    const selectedVariant = props.selectedVariant;
    if (!selectedVariant) {
      setImposicionPreviewRaw(null);
      return;
    }
    const timeout = window.setTimeout(() => {
      previewImposicionProductoVariante(selectedVariant.id, imposicionPayloadConfig)
        .then((res) => setImposicionPreviewRaw(res))
        .catch(() => setImposicionPreviewRaw(null));
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [imposicionPayloadConfig, props.selectedVariant]);

  const previewImposicion = React.useMemo(
    () =>
      buildPreviewImposicion({
        selectedVariante: props.selectedVariant,
        pliego: tamanoPliegoSeleccionado,
        demasiaCorteMm,
        lineaCorteMm,
        papelById,
        imposicionPreviewRaw,
        tipoCorteValue,
      }),
    [demasiaCorteMm, imposicionPreviewRaw, lineaCorteMm, papelById, props.selectedVariant, tamanoPliegoSeleccionado, tipoCorteValue],
  );
  const isConfigDirty = normalizeDigitalImposicionSnapshot(imposicionPayloadConfig) !== savedConfigSnapshot;
  const selectedVariantLabel = props.selectedVariant
    ? getDigitalVariantDisplayLabel(props.selectedVariant, papelLabelById)
    : "";

  const handleSaveConfig = () => {
    if (!props.selectedVariant) {
      toast.error("Seleccioná una variante.");
      return;
    }

    startSavingConfig(async () => {
      try {
        const updated = await upsertVarianteMotorOverride(props.selectedVariant!.id, imposicionPayloadConfig);
        const nextConfig = mergeImposicionConfig(props.motorConfig?.parametros, updated.parametros ?? null);
        setConfig(nextConfig);
        setSavedConfigSnapshot(normalizeDigitalImposicionSnapshot(nextConfig));
        toast.success("Configuración de imposición guardada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la imposición.");
      }
    });
  };

  if (!props.variantes.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Imposición</CardTitle>
          <CardDescription>Configura el pliego y el tipo de corte para la variante seleccionada.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Creá al menos una variante para poder definir la imposición.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Imposición</CardTitle>
        <CardDescription>Configura el tipo de corte y visualiza cómo entra la pieza en el pliego de impresión.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProductoTabSection
          title="Resumen de configuración"
          description="Lectura rápida de la variante activa, el pliego base y el estado actual de la imposición."
          icon={InfoIcon}
          contentClassName="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
        >
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Variante activa</p>
            <p className="mt-1 text-sm font-medium">
              {props.selectedVariant ? getDigitalVariantDisplayLabel(props.selectedVariant, papelLabelById) : "Sin variante seleccionada"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Pliego</p>
            <p className="mt-1 text-sm font-medium">{tamanoPliegoSeleccionado.label}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Tipo de corte</p>
            <p className="mt-1 text-sm font-medium">{tipoCorteSelected.label}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Resultado actual</p>
            <p className="mt-1 text-sm font-medium">
              {previewImposicion ? `${previewImposicion.piezasPorPliego} piezas/pliego` : "Todavía sin preview"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Estado</p>
            <p className="mt-1 text-sm font-medium">{isConfigDirty ? "Hay cambios pendientes" : "Sin cambios pendientes"}</p>
          </div>
        </ProductoTabSection>

        <ProductoTabSection
          title="Contexto técnico"
          description="Definí la variante y el pliego base con el que se va a construir la imposición."
          icon={Layers3Icon}
        >
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Field className="min-w-0 space-y-1">
              <FieldLabel className="text-xs text-muted-foreground">Variante</FieldLabel>
              <Select value={props.selectedVariantId || "__none__"} onValueChange={(value) => props.setSelectedVariantId(value === "__none__" ? "" : value ?? "")}>
                <SelectTrigger className="h-9 w-full min-w-0">
                  <SelectValue placeholder="Seleccioná variante">
                    {selectedVariantLabel || "Seleccioná variante"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {variantesSelect.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {getDigitalVariantDisplayLabel(item, papelLabelById)}{item.activo ? "" : " (inactiva)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="min-w-0 space-y-1">
              <FieldLabel className="text-xs text-muted-foreground">Pliego de impresión</FieldLabel>
              <Select
                value={tamanoPliegoSeleccionado.codigo}
                onValueChange={(value) => {
                  const selected = pliegosImpresion.find((item) => item.codigo === value);
                  if (!selected) return;
                  setConfig((prev) => ({
                    ...prev,
                    tamanoPliegoImpresion: {
                      codigo: selected.codigo,
                      nombre: selected.nombre,
                      anchoMm: selected.anchoMm,
                      altoMm: selected.altoMm,
                    },
                  }));
                }}
              >
                <SelectTrigger className="h-9 w-full min-w-0">
                  <SelectValue>{tamanoPliegoSeleccionado.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {pliegosImpresion.map((item) => (
                    <SelectItem key={item.codigo} value={item.codigo}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </ProductoTabSection>

        <ProductoTabSection
          title="Parámetros de imposición"
          description="Ajustá el corte, la demasía y los parámetros que modifican el layout dentro del pliego."
          icon={ScissorsIcon}
        >
          <div className="space-y-5">
            <div className="rounded-xl border bg-muted/10 p-4">
              <div className="mb-4">
                <h4 className="text-sm font-semibold">Configuración de corte</h4>
                <p className="text-sm text-muted-foreground">
                  Elegí cómo querés cortar la pieza y qué margen técnico debe usar la imposición.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                <Field className="min-w-0 space-y-1">
                  <FieldLabel className="flex items-center gap-1 text-xs text-muted-foreground">
                    Tipo de corte
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                        <InfoIcon className="size-3.5" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        {tipoCorteSelected.help}
                      </TooltipContent>
                    </Tooltip>
                  </FieldLabel>
                  <Select
                    value={tipoCorteValue}
                    onValueChange={(value) =>
                      setConfig((prev) => {
                        const demasiaActual = Number(prev.demasiaCorteMm ?? 0);
                        return {
                          ...prev,
                          tipoCorte: value,
                          demasiaCorteMm: value === "con_demasia" ? (demasiaActual > 0 ? demasiaActual : 2) : 0,
                        };
                      })
                    }
                  >
                    <SelectTrigger className="h-9 w-full min-w-0">
                      <SelectValue>{tipoCorteSelected.label}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {tipoCorteItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="min-w-0 space-y-1">
                  <FieldLabel className="flex items-center gap-1 text-xs text-muted-foreground">
                    Demasía
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                        <InfoIcon className="size-3.5" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        Se aplica por igual en los 4 lados de cada pieza cuando el corte es con demasía.
                      </TooltipContent>
                    </Tooltip>
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      className="h-9 w-full min-w-0 pr-9"
                      disabled={tipoCorteValue !== "con_demasia"}
                      value={String(demasiaCorteMm)}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          demasiaCorteMm: Math.max(0, Number(e.target.value || 0)),
                        }))
                      }
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                      mm
                    </span>
                  </div>
                </Field>
                <Field className="min-w-0 space-y-1">
                  <FieldLabel className="flex items-center gap-1 text-xs text-muted-foreground">
                    Línea de corte
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                        <InfoIcon className="size-3.5" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        Define el largo de las marcas de corte de guillotina en el diagrama.
                      </TooltipContent>
                    </Tooltip>
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      className="h-9 w-full min-w-0 pr-9"
                      value={String(lineaCorteMm)}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, lineaCorteMm: Math.max(0, Number(e.target.value || 0)) }))
                      }
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                      mm
                    </span>
                  </div>
                </Field>
                <Field className="min-w-0 space-y-1">
                  <FieldLabel className="text-xs text-muted-foreground">Merma adicional (%)</FieldLabel>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      className="h-9 w-full min-w-0 pr-8"
                      value={String(Math.max(0, Number(config.mermaAdicionalPct ?? 0)))}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          mermaAdicionalPct: Math.max(0, Number(e.target.value || 0)),
                        }))
                      }
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                      %
                    </span>
                  </div>
                </Field>
              </div>
            </div>
          </div>
        </ProductoTabSection>

        <ProductoTabSection
          title="Simulación y resultado"
          description="La vista previa se recalcula automáticamente con los parámetros actuales y muestra cómo queda la pieza en el pliego final."
          icon={EyeIcon}
        >
          {previewImposicion ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                La vista previa se actualiza sola. Guardar persiste esta configuración en la variante seleccionada.
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Piezas por pliego</p>
                  <p className="mt-1 text-sm font-medium">{previewImposicion.piezasPorPliego}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Orientación final</p>
                  <p className="mt-1 text-sm font-medium">{previewImposicion.orientacion === "rotada" ? "Rotada" : "Normal"}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Cortes de guillotina</p>
                  <p className="mt-1 text-sm font-medium">{previewImposicion.cortesGuillotina}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Pliegos por sustrato</p>
                  <p className="mt-1 text-sm font-medium">{previewImposicion.pliegosPorSustrato ?? "-"}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Pliego materia prima</p>
                  <p className="mt-1 text-sm font-medium">
                    {previewImposicion.sustratoAnchoMm && previewImposicion.sustratoAltoMm
                      ? `${previewImposicion.sustratoAnchoMm} × ${previewImposicion.sustratoAltoMm} mm`
                      : "Sin dimensiones"}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="rounded-lg border p-3">
              <div
                className="relative overflow-hidden rounded-md border bg-muted/20"
                onMouseEnter={() => setSvgZoom((prev) => ({ ...prev, active: true }))}
                onMouseLeave={() => setSvgZoom((prev) => ({ ...prev, active: false, x: 50, y: 50 }))}
                onMouseMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = ((event.clientX - rect.left) / rect.width) * 100;
                  const y = ((event.clientY - rect.top) / rect.height) * 100;
                  setSvgZoom({ active: true, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
                }}
              >
                <svg
                  viewBox="0 0 800 520"
                  className="h-[320px] w-full transition-transform duration-150 ease-out"
                  style={{
                    transform: svgZoom.active ? "scale(2.35)" : "scale(1)",
                    transformOrigin: `${svgZoom.x}% ${svgZoom.y}%`,
                  }}
                >
                  {(() => {
                    const canvasW = 800;
                    const canvasH = 520;
                    const pad = 30;
                    const scale = Math.min((canvasW - pad * 2) / previewImposicion.hojaW, (canvasH - pad * 2) / previewImposicion.hojaH);
                    const sheetW = previewImposicion.hojaW * scale;
                    const sheetH = previewImposicion.hojaH * scale;
                    const ox = (canvasW - sheetW) / 2;
                    const oy = (canvasH - sheetH) / 2;
                    const marginLeft = previewImposicion.margins.leftMm * scale;
                    const marginRight = previewImposicion.margins.rightMm * scale;
                    const marginTop = previewImposicion.margins.topMm * scale;
                    const marginBottom = previewImposicion.margins.bottomMm * scale;
                    const printableX = ox + marginLeft;
                    const printableY = oy + marginTop;
                    const printableW = Math.max(0, sheetW - marginLeft - marginRight);
                    const printableH = Math.max(0, sheetH - marginTop - marginBottom);
                    const lineCut = previewImposicion.piezaW > 0 ? lineaCorteMm * scale : 0;
                    const utilX = printableX + lineCut;
                    const utilY = printableY + lineCut;
                    const utilW = Math.max(0, printableW - lineCut * 2);
                    const utilH = Math.max(0, printableH - lineCut * 2);
                    const effectivePieceW = (previewImposicion.orientacion === "rotada" ? previewImposicion.effectiveH : previewImposicion.effectiveW) * scale;
                    const effectivePieceH = (previewImposicion.orientacion === "rotada" ? previewImposicion.effectiveW : previewImposicion.effectiveH) * scale;
                    const demasiaPx = Math.max(0, demasiaCorteMm) * scale;
                    const pieceW = Math.max(0, effectivePieceW - demasiaPx * 2);
                    const pieceH = Math.max(0, effectivePieceH - demasiaPx * 2);
                    const gridW = previewImposicion.cols * effectivePieceW;
                    const gridH = previewImposicion.rows * effectivePieceH;
                    const centeredGridX = utilX + Math.max(0, (utilW - gridW) / 2);
                    const centeredGridY = utilY + Math.max(0, (utilH - gridH) / 2);
                    const blockLeft = centeredGridX;
                    const blockTop = centeredGridY;
                    const blockRight = centeredGridX + gridW;
                    const blockBottom = centeredGridY + gridH;
                    const markLen = Math.max(0, lineaCorteMm * scale);
                    const markOffset = 1.6;

                    // Puntillado config (para motor talonario)
                    // El borde se define en la orientación ORIGINAL de la pieza.
                    // Si la imposición rota la pieza 90° CW, mapeamos el borde:
                    //   original superior → render derecho
                    //   original inferior → render izquierdo
                    //   original izquierdo → render superior
                    //   original derecho → render inferior
                    const puntilladoCfg = readConfigRecord(config.puntillado);
                    const puntilladoHabilitado = puntilladoCfg.habilitado === true;
                    const puntilladoDistMm = Number(puntilladoCfg.distanciaBordeMm ?? 0);
                    const puntilladoBordeOriginal = String(puntilladoCfg.borde ?? "superior");
                    const puntilladoBordeRender = (() => {
                      if (previewImposicion.orientacion !== "rotada") return puntilladoBordeOriginal;
                      const rotMap: Record<string, string> = {
                        superior: "derecho",
                        inferior: "izquierdo",
                        izquierdo: "superior",
                        derecho: "inferior",
                      };
                      return rotMap[puntilladoBordeOriginal] ?? puntilladoBordeOriginal;
                    })();

                    // Encuadernación config (broches para abrochado)
                    const encCfg = readConfigRecord(config.encuadernacion);
                    const esAbrochado = encCfg.tipo === "abrochado";
                    const cantGrapas = Math.max(0, Number(encCfg.cantidadGrapas ?? 0));

                    const cells = [];
                    const cutXMap = new Map<string, number>();
                    const cutYMap = new Map<string, number>();
                    for (let r = 0; r < previewImposicion.rows; r++) {
                      for (let c = 0; c < previewImposicion.cols; c++) {
                        const x = centeredGridX + c * effectivePieceW;
                        const y = centeredGridY + r * effectivePieceH;
                        const trimX = x + demasiaPx;
                        const trimY = y + demasiaPx;
                        cutXMap.set(trimX.toFixed(2), trimX);
                        cutXMap.set((trimX + pieceW).toFixed(2), trimX + pieceW);
                        cutYMap.set(trimY.toFixed(2), trimY);
                        cutYMap.set((trimY + pieceH).toFixed(2), trimY + pieceH);

                        // Línea de puntillado dentro de la pieza
                        // La distancia se mide en mm desde el borde ORIGINAL,
                        // mapeado al borde de render según la orientación.
                        let puntilladoLine: React.ReactNode = null;
                        let puntilladoLinePx: { isHorizontal: boolean; pos: number; edgeStart: number; edgeEnd: number } | null = null;
                        if (puntilladoHabilitado && puntilladoDistMm > 0) {
                          const distPx = puntilladoDistMm * scale;
                          if (puntilladoBordeRender === "superior" || puntilladoBordeRender === "inferior") {
                            const ly = puntilladoBordeRender === "superior" ? trimY + distPx : trimY + pieceH - distPx;
                            puntilladoLinePx = { isHorizontal: true, pos: ly, edgeStart: trimX, edgeEnd: trimX + pieceW };
                            puntilladoLine = (
                              <line x1={trimX} y1={ly} x2={trimX + pieceW} y2={ly}
                                stroke="#d97706" strokeWidth="1.2" strokeDasharray="3 2" />
                            );
                          } else {
                            const lx = puntilladoBordeRender === "izquierdo" ? trimX + distPx : trimX + pieceW - distPx;
                            puntilladoLinePx = { isHorizontal: false, pos: lx, edgeStart: trimY, edgeEnd: trimY + pieceH };
                            puntilladoLine = (
                              <line x1={lx} y1={trimY} x2={lx} y2={trimY + pieceH}
                                stroke="#d97706" strokeWidth="1.2" strokeDasharray="3 2" />
                            );
                          }
                        }

                        // Broches: se dibujan entre el puntillado y el borde de corte
                        // (en la zona del "talón" que queda sujeto)
                        const brochesNodes: React.ReactNode[] = [];
                        if (esAbrochado && cantGrapas > 0 && puntilladoLinePx) {
                          const br = 1.8; // radio visual del broche
                          for (let gi = 0; gi < cantGrapas; gi++) {
                            const t = cantGrapas === 1 ? 0.5 : (gi + 1) / (cantGrapas + 1);
                            if (puntilladoLinePx.isHorizontal) {
                              // Broches entre borde horizontal y línea de puntillado
                              const bx = puntilladoLinePx.edgeStart + (puntilladoLinePx.edgeEnd - puntilladoLinePx.edgeStart) * t;
                              // Punto medio entre la línea de puntillado y el borde de la pieza
                              const byEdge = puntilladoBordeRender === "superior" ? trimY : trimY + pieceH;
                              const by = (puntilladoLinePx.pos + byEdge) / 2;
                              brochesNodes.push(
                                <g key={`broche-${gi}`}>
                                  <circle cx={bx} cy={by} r={br} fill="#7c3aed" fillOpacity="0.85" />
                                  <line x1={bx - br * 0.7} y1={by} x2={bx + br * 0.7} y2={by}
                                    stroke="#fff" strokeWidth="0.5" />
                                </g>,
                              );
                            } else {
                              // Broches entre borde vertical y línea de puntillado
                              const by = puntilladoLinePx.edgeStart + (puntilladoLinePx.edgeEnd - puntilladoLinePx.edgeStart) * t;
                              const bxEdge = puntilladoBordeRender === "izquierdo" ? trimX : trimX + pieceW;
                              const bx = (puntilladoLinePx.pos + bxEdge) / 2;
                              brochesNodes.push(
                                <g key={`broche-${gi}`}>
                                  <circle cx={bx} cy={by} r={br} fill="#7c3aed" fillOpacity="0.85" />
                                  <line x1={bx} y1={by - br * 0.7} x2={bx} y2={by + br * 0.7}
                                    stroke="#fff" strokeWidth="0.5" />
                                </g>,
                              );
                            }
                          }
                        }

                        cells.push(
                          <g key={`cell-${r}-${c}`}>
                            <rect
                              x={x}
                              y={y}
                              width={effectivePieceW}
                              height={effectivePieceH}
                              fill={demasiaCorteMm > 0 ? "#e5e7eb" : "#dcfce7"}
                              stroke={demasiaCorteMm > 0 ? "#9ca3af" : "#16a34a"}
                              strokeWidth="0.8"
                            />
                            <rect x={trimX} y={trimY} width={pieceW} height={pieceH} fill="#22c55e" />
                            {puntilladoLine}
                            {brochesNodes}
                          </g>,
                        );
                      }
                    }

                    const guillotinaMarks: React.ReactNode[] = [];
                    if (markLen > 0) {
                      for (const x of cutXMap.values()) {
                        const topY = blockTop - markOffset;
                        const botY = blockBottom + markOffset;
                        guillotinaMarks.push(
                          <g key={`cut-x-${x.toFixed(2)}`}>
                            <line x1={x} y1={topY - markLen / 2} x2={x} y2={topY + markLen / 2} stroke="#111827" strokeWidth="0.9" />
                            <line x1={x} y1={botY - markLen / 2} x2={x} y2={botY + markLen / 2} stroke="#111827" strokeWidth="0.9" />
                          </g>,
                        );
                      }
                      for (const y of cutYMap.values()) {
                        const leftX = blockLeft - markOffset;
                        const rightX = blockRight + markOffset;
                        guillotinaMarks.push(
                          <g key={`cut-y-${y.toFixed(2)}`}>
                            <line x1={leftX - markLen / 2} y1={y} x2={leftX + markLen / 2} y2={y} stroke="#111827" strokeWidth="0.9" />
                            <line x1={rightX - markLen / 2} y1={y} x2={rightX + markLen / 2} y2={y} stroke="#111827" strokeWidth="0.9" />
                          </g>,
                        );
                      }
                    }

                    return (
                      <>
                        <rect x={ox} y={oy} width={sheetW} height={sheetH} fill="#fecaca" stroke="#7f1d1d" strokeWidth="1.6" />
                        <rect x={printableX} y={printableY} width={printableW} height={printableH} fill="#fff" stroke="#b91c1c" strokeWidth="0.9" />
                        <rect x={utilX} y={utilY} width={utilW} height={utilH} fill="#ecfccb" fillOpacity="0.4" />
                        {cells}
                        {guillotinaMarks}
                      </>
                    );
                  })()}
                </svg>
                <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-background/90 px-2 py-1 text-[11px] text-muted-foreground">
                  Hover para zoom
                </div>
              </div>
            </div>
                <div className="rounded-lg border p-3">
                  <div className="overflow-hidden rounded-md border">
                    <Table>
                      <TableHeader className="bg-muted/50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]">
                        <TableRow className="border-b border-border/70">
                          <TableHead colSpan={2}>Resumen técnico</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="text-muted-foreground">Pliego de impresión</TableCell>
                          <TableCell className="text-right font-medium">{previewImposicion.hojaW} x {previewImposicion.hojaH} mm</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-muted-foreground">Márgenes no imprimibles</TableCell>
                          <TableCell className="text-right font-medium">
                            Izq:{formatNumber(previewImposicion.margins.leftMm)} Der:{formatNumber(previewImposicion.margins.rightMm)} Sup:{formatNumber(previewImposicion.margins.topMm)} Inf:{formatNumber(previewImposicion.margins.bottomMm)} mm
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-muted-foreground">Área imprimible</TableCell>
                          <TableCell className="text-right font-medium">{formatNumber(previewImposicion.printableW)} x {formatNumber(previewImposicion.printableH)} mm</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-muted-foreground">Área útil</TableCell>
                          <TableCell className="text-right font-medium">{formatNumber(previewImposicion.utilW)} x {formatNumber(previewImposicion.utilH)} mm</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-muted-foreground">Tamaño de pieza</TableCell>
                          <TableCell className="text-right font-medium">{formatNumber(previewImposicion.piezaW)} x {formatNumber(previewImposicion.piezaH)} mm</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              Seleccioná una variante y ajustá los parámetros para ver cómo entra la pieza en el pliego.
            </div>
          )}
        </ProductoTabSection>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Acción final</p>
            <p className="text-xs text-muted-foreground">
              Guardar persiste la configuración de imposición de esta variante. La vista previa se actualiza automáticamente mientras editás.
            </p>
          </div>
          <Button type="button" onClick={handleSaveConfig} disabled={isSavingConfig || !props.selectedVariant || !isConfigDirty}>
            {isSavingConfig ? <GdiSpinner className="size-4" data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
            Guardar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
