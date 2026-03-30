"use client";

import * as React from "react";
import Link from "next/link";
import { EyeIcon, InfoIcon, MapIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Maquina } from "@/lib/maquinaria";
import type { Proceso, ProcesoOperacionPlantilla } from "@/lib/procesos";
import type {
  CarasProductoVariante,
  DimensionOpcionProductiva,
  ProductoServicio,
  ProductoVariante,
  TipoImpresionProductoVariante,
  ValorOpcionProductiva,
} from "@/lib/productos-servicios";
import { assignProductoVarianteRuta, updateProductoRutaPolicy } from "@/lib/productos-servicios-api";

type RutaBaseMatchingDraft = {
  tipoImpresion: TipoImpresionProductoVariante | null;
  caras: CarasProductoVariante | null;
  pasoPlantillaId: string;
  perfilOperativoId: string;
};

type RutaBasePasoFijoDraft = {
  pasoPlantillaId: string;
  perfilOperativoId: string;
};

const dimensionBaseLabelByValue: Record<DimensionOpcionProductiva, string> = {
  tipo_impresion: "Tipo de impresión",
  caras: "Caras",
};

const valorOpcionBaseLabelByValue: Record<ValorOpcionProductiva, string> = {
  bn: "Escala de grises",
  cmyk: "CMYK",
  simple_faz: "Simple faz",
  doble_faz: "Doble faz",
};

function buildRutaBaseMatchingDraft(producto: ProductoServicio, variantes: ProductoVariante[]) {
  const current = new Map(
    (producto.matchingBasePorVariante ?? []).map((item) => [
      item.varianteId,
      item.matching.map((row) => ({
        tipoImpresion: row.tipoImpresion,
        caras: row.caras,
        pasoPlantillaId: row.pasoPlantillaId,
        perfilOperativoId: row.perfilOperativoId,
      })),
    ]),
  );
  const next: Record<string, RutaBaseMatchingDraft[]> = {};
  for (const variante of variantes) {
    next[variante.id] = current.get(variante.id) ?? [];
  }
  return next;
}

function buildRutaBasePasosFijosDraft(producto: ProductoServicio, variantes: ProductoVariante[]) {
  const current = new Map(
    (producto.pasosFijosPorVariante ?? []).map((item) => [
      item.varianteId,
      item.pasos.map((row) => ({
        pasoPlantillaId: row.pasoPlantillaId,
        perfilOperativoId: row.perfilOperativoId,
      })),
    ]),
  );
  const next: Record<string, RutaBasePasoFijoDraft[]> = {};
  for (const variante of variantes) {
    next[variante.id] = current.get(variante.id) ?? [];
  }
  return next;
}

function buildDimensionesBaseConsumidasDraft(producto: ProductoServicio) {
  return producto.dimensionesBaseConsumidas ?? [];
}

function getValoresOpcionesBase(variante: ProductoVariante, dimension: DimensionOpcionProductiva) {
  if (dimension === "tipo_impresion") {
    return (
      variante.opcionesProductivas?.find((item) => item.dimension === "tipo_impresion")?.valores.filter(
        (value): value is "bn" | "cmyk" => value === "bn" || value === "cmyk",
      ) ?? [variante.tipoImpresion]
    );
  }
  return (
    variante.opcionesProductivas?.find((item) => item.dimension === "caras")?.valores.filter(
      (value): value is "simple_faz" | "doble_faz" => value === "simple_faz" || value === "doble_faz",
    ) ?? [variante.caras]
  );
}

function buildMatchingRowsForVariante(
  variante: ProductoVariante,
  dimensionesConsumidas: DimensionOpcionProductiva[],
  currentMatching: RutaBaseMatchingDraft[],
  defaultPasoPlantillaId?: string,
) {
  const tipos = dimensionesConsumidas.includes("tipo_impresion")
    ? getValoresOpcionesBase(variante, "tipo_impresion").filter(
        (value): value is "bn" | "cmyk" => value === "bn" || value === "cmyk",
      )
    : [null];
  const caras = dimensionesConsumidas.includes("caras")
    ? getValoresOpcionesBase(variante, "caras").filter(
        (value): value is "simple_faz" | "doble_faz" => value === "simple_faz" || value === "doble_faz",
      )
    : [null];

  return tipos.flatMap((tipoImpresion) =>
    caras.map((carasValue) => {
      const current =
        currentMatching.find((item) => item.tipoImpresion === tipoImpresion && item.caras === carasValue) ?? null;
      return {
        key: `${tipoImpresion ?? "na"}-${carasValue ?? "na"}`,
        tipoImpresion,
        caras: carasValue,
        pasoPlantillaId: current?.pasoPlantillaId ?? defaultPasoPlantillaId ?? "",
        perfilOperativoId: current?.perfilOperativoId ?? "",
      };
    }),
  );
}

function normalizeRutaBaseMatchingDraftForVariantes(
  nextMatchingDraft: Record<string, RutaBaseMatchingDraft[]>,
  variantes: ProductoVariante[],
  dimensionesConsumidas: DimensionOpcionProductiva[],
) {
  const normalized: Record<string, RutaBaseMatchingDraft[]> = {};
  for (const variante of variantes) {
    const rows = buildMatchingRowsForVariante(variante, dimensionesConsumidas, nextMatchingDraft[variante.id] ?? []);
    normalized[variante.id] = rows.map((row) => ({
      tipoImpresion: row.tipoImpresion,
      caras: row.caras,
      pasoPlantillaId: row.pasoPlantillaId,
      perfilOperativoId: row.perfilOperativoId,
    }));
  }
  return normalized;
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
  const exactWithProfile =
    plantillasPaso.find(
      (item) =>
        item.activo &&
        item.perfilOperativoId &&
        item.perfilOperativoId === (operacion.perfilOperativoId ?? "") &&
        (item.maquinaId ?? "") === (operacion.maquinaId ?? ""),
    ) ?? null;
  if (exactWithProfile) return exactWithProfile;
  return (
    plantillasPaso.find(
      (item) =>
        item.activo &&
        item.nombre.trim().toLowerCase() === operationName &&
        (item.maquinaId ?? "") === (operacion.maquinaId ?? ""),
    ) ??
    plantillasPaso.find(
      (item) =>
        item.activo &&
        normalizePasoNombreBase(item.nombre) === operationBaseName &&
        (item.maquinaId ?? "") === (operacion.maquinaId ?? ""),
    ) ??
    plantillasPaso.find((item) => item.activo && item.nombre.trim().toLowerCase() === operationName) ??
    plantillasPaso.find((item) => item.activo && normalizePasoNombreBase(item.nombre) === operationBaseName) ??
    null
  );
}

function isPerfilCompatibleWithMatchingRow(
  perfil: Maquina["perfilesOperativos"][number],
  row: { tipoImpresion: "bn" | "cmyk" | null; caras: "simple_faz" | "doble_faz" | null },
) {
  const normalizedPrintMode = perfil.printMode || null;
  const normalizedPrintSides = perfil.printSides || null;
  if (row.tipoImpresion && normalizedPrintMode && normalizedPrintMode !== row.tipoImpresion) {
    return false;
  }
  if (row.caras && normalizedPrintSides && normalizedPrintSides !== row.caras) {
    return false;
  }
  return true;
}

function getRutaBasePasoOptions(
  procesoId: string | null | undefined,
  procesos: Proceso[],
  plantillasPaso: ProcesoOperacionPlantilla[],
  maquinas: Maquina[],
  dimensionesConsumidas: DimensionOpcionProductiva[],
) {
  const proceso = procesos.find((item) => item.id === procesoId) ?? null;
  if (!proceso) return [];
  const maquinaById = new Map(maquinas.map((item) => [item.id, item]));
  const requiresBasePrintMatching =
    dimensionesConsumidas.includes("tipo_impresion") || dimensionesConsumidas.includes("caras");
  const matches = proceso.operaciones
    .map((op) => resolveProcesoOperacionPlantilla(op, plantillasPaso))
    .filter((item): item is ProcesoOperacionPlantilla => Boolean(item))
    .filter((item) => {
      if (!requiresBasePrintMatching) return true;
      if (!item.maquinaId) return false;
      const maquina = maquinaById.get(item.maquinaId);
      if (!maquina) return false;
      return maquina.plantilla === "impresora_laser";
    });

  return Array.from(new Map(matches.map((item) => [item.id, item])).values());
}

function getRutaBasePasoFijoOptions(
  procesoId: string | null | undefined,
  procesos: Proceso[],
  plantillasPaso: ProcesoOperacionPlantilla[],
  maquinas: Maquina[],
  dimensionesConsumidas: DimensionOpcionProductiva[],
) {
  const matchingIds = new Set(
    getRutaBasePasoOptions(procesoId, procesos, plantillasPaso, maquinas, dimensionesConsumidas).map((item) => item.id),
  );
  const proceso = procesos.find((item) => item.id === procesoId) ?? null;
  if (!proceso) return [];
  const matches = proceso.operaciones
    .map((op) => resolveProcesoOperacionPlantilla(op, plantillasPaso))
    .filter((item): item is ProcesoOperacionPlantilla => Boolean(item))
    .filter((item) => !matchingIds.has(item.id));

  return Array.from(new Map(matches.map((item) => [item.id, item])).values());
}

function getModoProductividadLabel(value: string) {
  if (value === "fija") return "Fija";
  if (value === "variable") return "Variable";
  return value;
}

function getUnidadProcesoLabel(value: string) {
  if (value === "copia") return "Copia";
  if (value === "hoja") return "Hoja";
  if (value === "m2") return "Metro cuadrado";
  if (value === "metro_lineal") return "Metro lineal";
  if (value === "pieza") return "Pieza";
  if (value === "unidad") return "Unidad";
  if (value === "minuto") return "Minuto";
  if (value === "hora") return "Hora";
  return value;
}

function getUnidadProductividadCompuestaLabel(unidadSalida: string, unidadTiempo: string) {
  const key = `${unidadSalida}/${unidadTiempo}`;
  const labels: Record<string, string> = {
    "copia/minuto": "Páginas por minuto (pag/min)",
    "hoja/minuto": "Hojas por minuto (hoja/min)",
    "m2/hora": "Metros cuadrados por hora (m2/h)",
    "metro_lineal/hora": "Metros lineales por hora (ml/h)",
    "pieza/hora": "Piezas por hora (pieza/h)",
    "unidad/hora": "Unidades por hora (unidad/h)",
  };
  return labels[key] ?? `${getUnidadProcesoLabel(unidadSalida)} por ${getUnidadProcesoLabel(unidadTiempo)}`;
}

function buildDigitalRutaBaseDraftSnapshot(input: {
  usarRutaComunVariantes: boolean;
  rutaDefaultProductoId: string;
  rutasPorVarianteDraft: Record<string, string>;
  dimensionesBaseConsumidasDraft: DimensionOpcionProductiva[];
  rutaBaseMatchingDraft: Record<string, RutaBaseMatchingDraft[]>;
  rutaBasePasosFijosDraft: Record<string, RutaBasePasoFijoDraft[]>;
}) {
  return JSON.stringify({
    usarRutaComunVariantes: input.usarRutaComunVariantes,
    rutaDefaultProductoId: input.rutaDefaultProductoId || "",
    rutasPorVarianteDraft: Object.entries(input.rutasPorVarianteDraft)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([varianteId, procesoDefinicionId]) => ({
        varianteId,
        procesoDefinicionId: procesoDefinicionId || "",
      })),
    dimensionesBaseConsumidasDraft: [...input.dimensionesBaseConsumidasDraft].sort(),
    rutaBaseMatchingDraft: Object.entries(input.rutaBaseMatchingDraft)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([varianteId, rows]) => ({
        varianteId,
        rows: [...rows]
          .map((row) => ({
            tipoImpresion: row.tipoImpresion ?? null,
            caras: row.caras ?? null,
            pasoPlantillaId: row.pasoPlantillaId || "",
            perfilOperativoId: row.perfilOperativoId || "",
          }))
          .sort((a, b) =>
            `${a.tipoImpresion ?? ""}:${a.caras ?? ""}:${a.pasoPlantillaId}:${a.perfilOperativoId}`.localeCompare(
              `${b.tipoImpresion ?? ""}:${b.caras ?? ""}:${b.pasoPlantillaId}:${b.perfilOperativoId}`,
            ),
          ),
      })),
    rutaBasePasosFijosDraft: Object.entries(input.rutaBasePasosFijosDraft)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([varianteId, rows]) => ({
        varianteId,
        rows: [...rows]
          .map((row) => ({
            pasoPlantillaId: row.pasoPlantillaId,
            perfilOperativoId: row.perfilOperativoId || "",
          }))
          .sort((a, b) => `${a.pasoPlantillaId}:${a.perfilOperativoId}`.localeCompare(`${b.pasoPlantillaId}:${b.perfilOperativoId}`)),
      })),
  });
}

export function DigitalRutaBaseTab(props: ProductTabProps) {
  const [usarRutaComunVariantes, setUsarRutaComunVariantes] = React.useState(props.producto.usarRutaComunVariantes);
  const [rutaDefaultProductoId, setRutaDefaultProductoId] = React.useState(props.producto.procesoDefinicionDefaultId ?? "");
  const [variantes, setVariantes] = React.useState(props.variantes);
  const [rutasPorVarianteDraft, setRutasPorVarianteDraft] = React.useState<Record<string, string>>(
    () => Object.fromEntries(props.variantes.map((item) => [item.id, item.procesoDefinicionId ?? ""])),
  );
  const [dimensionesBaseConsumidasDraft, setDimensionesBaseConsumidasDraft] = React.useState<DimensionOpcionProductiva[]>(
    () => buildDimensionesBaseConsumidasDraft(props.producto),
  );
  const [rutaBaseMatchingDraft, setRutaBaseMatchingDraft] = React.useState<Record<string, RutaBaseMatchingDraft[]>>(
    () => buildRutaBaseMatchingDraft(props.producto, props.variantes),
  );
  const [rutaBasePasosFijosDraft, setRutaBasePasosFijosDraft] = React.useState<Record<string, RutaBasePasoFijoDraft[]>>(
    () => buildRutaBasePasosFijosDraft(props.producto, props.variantes),
  );
  const [savedDraftSnapshot, setSavedDraftSnapshot] = React.useState(() =>
    buildDigitalRutaBaseDraftSnapshot({
      usarRutaComunVariantes: props.producto.usarRutaComunVariantes,
      rutaDefaultProductoId: props.producto.procesoDefinicionDefaultId ?? "",
      rutasPorVarianteDraft: Object.fromEntries(props.variantes.map((item) => [item.id, item.procesoDefinicionId ?? ""])),
      dimensionesBaseConsumidasDraft: buildDimensionesBaseConsumidasDraft(props.producto),
      rutaBaseMatchingDraft: buildRutaBaseMatchingDraft(props.producto, props.variantes),
      rutaBasePasosFijosDraft: buildRutaBasePasosFijosDraft(props.producto, props.variantes),
    }),
  );
  const [isSaving, startSaving] = React.useTransition();

  React.useEffect(() => {
    const nextUsarRutaComunVariantes = props.producto.usarRutaComunVariantes;
    const nextRutaDefaultProductoId = props.producto.procesoDefinicionDefaultId ?? "";
    const nextDimensiones = buildDimensionesBaseConsumidasDraft(props.producto);
    const nextMatching = buildRutaBaseMatchingDraft(props.producto, props.variantes);
    const nextPasosFijos = buildRutaBasePasosFijosDraft(props.producto, props.variantes);
    const nextRutasPorVariante = Object.fromEntries(props.variantes.map((item) => [item.id, item.procesoDefinicionId ?? ""]));

    setUsarRutaComunVariantes(nextUsarRutaComunVariantes);
    setRutaDefaultProductoId(nextRutaDefaultProductoId);
    setDimensionesBaseConsumidasDraft(nextDimensiones);
    setRutaBaseMatchingDraft(nextMatching);
    setRutaBasePasosFijosDraft(nextPasosFijos);
    setVariantes(props.variantes);
    setRutasPorVarianteDraft(nextRutasPorVariante);
    setSavedDraftSnapshot(
      buildDigitalRutaBaseDraftSnapshot({
        usarRutaComunVariantes: nextUsarRutaComunVariantes,
        rutaDefaultProductoId: nextRutaDefaultProductoId,
        rutasPorVarianteDraft: nextRutasPorVariante,
        dimensionesBaseConsumidasDraft: nextDimensiones,
        rutaBaseMatchingDraft: nextMatching,
        rutaBasePasosFijosDraft: nextPasosFijos,
      }),
    );
  }, [
    props.producto.usarRutaComunVariantes,
    props.producto.procesoDefinicionDefaultId,
    props.producto.dimensionesBaseConsumidas,
    props.producto.matchingBasePorVariante,
    props.producto.pasosFijosPorVariante,
    props.variantes,
  ]);

  const rutaLabelById = React.useMemo(
    () => new Map(props.procesos.map((item) => [item.id, `${item.codigo} · ${item.nombre}`])),
    [props.procesos],
  );
  const rutaNombreById = React.useMemo(() => new Map(props.procesos.map((item) => [item.id, item.nombre])), [props.procesos]);
  const maquinaById = React.useMemo(() => new Map(props.maquinas.map((item) => [item.id, item])), [props.maquinas]);
  const rutaDefaultGuardadaId = props.producto.procesoDefinicionDefaultId ?? "";
  const procesoSeleccionado = React.useMemo(
    () => props.procesos.find((item) => item.id === rutaDefaultProductoId) ?? null,
    [props.procesos, rutaDefaultProductoId],
  );
  const handleToggleRutasPorVariante = (checked: boolean) => {
    const nextUsarRutaComunVariantes = !checked;
    setUsarRutaComunVariantes(nextUsarRutaComunVariantes);
    if (nextUsarRutaComunVariantes && !rutaDefaultProductoId) {
      const fallbackRutaDefaultId =
        rutaDefaultGuardadaId ||
        Object.values(rutasPorVarianteDraft).find((id) => Boolean(id)) ||
        variantes.find((item) => Boolean(item.procesoDefinicionId))?.procesoDefinicionId ||
        "";
      setRutaDefaultProductoId(fallbackRutaDefaultId);
    }
  };

  const handleRutaBaseMatchingChange = (
    varianteId: string,
    key: { tipoImpresion: "bn" | "cmyk" | null; caras: "simple_faz" | "doble_faz" | null },
    patch: Partial<RutaBaseMatchingDraft>,
  ) => {
    let nextState: Record<string, RutaBaseMatchingDraft[]> | null = null;
    setRutaBaseMatchingDraft((prev) => {
      const current = prev[varianteId] ?? [];
      const nextRow: RutaBaseMatchingDraft = {
        tipoImpresion: key.tipoImpresion,
        caras: key.caras,
        pasoPlantillaId: "",
        perfilOperativoId: "",
        ...current.find((item) => item.tipoImpresion === key.tipoImpresion && item.caras === key.caras),
        ...patch,
      };
      const nextRows = current.filter((item) => !(item.tipoImpresion === key.tipoImpresion && item.caras === key.caras));
      nextRows.push(nextRow);
      nextState = { ...prev, [varianteId]: nextRows };
      return nextState;
    });
  };

  const handleRutaBasePasoFijoChange = (varianteId: string, pasoPlantillaId: string, perfilOperativoId: string) => {
    let nextState: Record<string, RutaBasePasoFijoDraft[]> | null = null;
    setRutaBasePasosFijosDraft((prev) => {
      const current = prev[varianteId] ?? [];
      const nextRows = current.filter((item) => item.pasoPlantillaId !== pasoPlantillaId);
      if (perfilOperativoId) nextRows.push({ pasoPlantillaId, perfilOperativoId });
      nextState = { ...prev, [varianteId]: nextRows };
      return nextState;
    });
  };

  const handleToggleDimensionConsumida = (dimension: DimensionOpcionProductiva, checked: boolean) => {
    const nextDimensiones = checked
      ? Array.from(new Set([...dimensionesBaseConsumidasDraft, dimension]))
      : dimensionesBaseConsumidasDraft.filter((item) => item !== dimension);
    setDimensionesBaseConsumidasDraft(nextDimensiones);
  };

  const currentDraftSnapshot = React.useMemo(
    () =>
      buildDigitalRutaBaseDraftSnapshot({
        usarRutaComunVariantes,
        rutaDefaultProductoId,
        rutasPorVarianteDraft,
        dimensionesBaseConsumidasDraft,
        rutaBaseMatchingDraft,
        rutaBasePasosFijosDraft,
      }),
    [
      usarRutaComunVariantes,
      rutaDefaultProductoId,
      rutasPorVarianteDraft,
      dimensionesBaseConsumidasDraft,
      rutaBaseMatchingDraft,
      rutaBasePasosFijosDraft,
    ],
  );
  const isDirty = currentDraftSnapshot !== savedDraftSnapshot;
  const variantesAfectadas = usarRutaComunVariantes
    ? variantes.length
    : variantes.filter((item) => Boolean(rutasPorVarianteDraft[item.id] ?? item.procesoDefinicionId ?? "")).length;

  const handleSave = () =>
    startSaving(async () => {
      try {
        const normalizedDraft = normalizeRutaBaseMatchingDraftForVariantes(
          rutaBaseMatchingDraft,
          variantes,
          dimensionesBaseConsumidasDraft,
        );
        await updateProductoRutaPolicy(props.producto.id, {
          usarRutaComunVariantes,
          procesoDefinicionDefaultId: rutaDefaultProductoId || null,
          dimensionesBaseConsumidas: dimensionesBaseConsumidasDraft,
          matchingBasePorVariante: variantes.map((variante) => ({
            varianteId: variante.id,
            matching: (normalizedDraft[variante.id] ?? [])
              .filter((row) => row.pasoPlantillaId && row.perfilOperativoId)
              .map((row) => ({
                tipoImpresion: row.tipoImpresion ?? undefined,
                caras: row.caras ?? undefined,
                pasoPlantillaId: row.pasoPlantillaId,
                perfilOperativoId: row.perfilOperativoId,
              })),
          })),
          pasosFijosPorVariante: variantes.map((variante) => ({
            varianteId: variante.id,
            pasos: (rutaBasePasosFijosDraft[variante.id] ?? [])
              .filter((row) => row.pasoPlantillaId && row.perfilOperativoId)
              .map((row) => ({
                pasoPlantillaId: row.pasoPlantillaId,
                perfilOperativoId: row.perfilOperativoId,
              })),
          })),
        });

        if (!usarRutaComunVariantes) {
          await Promise.all(
            variantes.map((variante) =>
              assignProductoVarianteRuta(variante.id, (rutasPorVarianteDraft[variante.id] ?? "") || null),
            ),
          );
        }

        const refreshedProducto = await props.refreshProducto();
        const refreshedVariantes = await props.refreshVariantes();
        setVariantes(refreshedVariantes);
        const nextSnapshot = buildDigitalRutaBaseDraftSnapshot({
          usarRutaComunVariantes: refreshedProducto?.usarRutaComunVariantes ?? usarRutaComunVariantes,
          rutaDefaultProductoId: refreshedProducto?.procesoDefinicionDefaultId ?? rutaDefaultProductoId,
          rutasPorVarianteDraft: Object.fromEntries(refreshedVariantes.map((item) => [item.id, item.procesoDefinicionId ?? ""])),
          dimensionesBaseConsumidasDraft: buildDimensionesBaseConsumidasDraft(refreshedProducto ?? props.producto),
          rutaBaseMatchingDraft: buildRutaBaseMatchingDraft(refreshedProducto ?? props.producto, refreshedVariantes),
          rutaBasePasosFijosDraft: buildRutaBasePasosFijosDraft(refreshedProducto ?? props.producto, refreshedVariantes),
        });
        setSavedDraftSnapshot(nextSnapshot);
        toast.success("Ruta base actualizada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la ruta base.");
      }
    });

  const routePreviewRows = React.useMemo(
    () =>
      variantes.map((item) => {
        const procesoId = usarRutaComunVariantes
          ? rutaDefaultProductoId
          : (rutasPorVarianteDraft[item.id] ?? item.procesoDefinicionId ?? "");
        const proceso = props.procesos.find((candidate) => candidate.id === procesoId) ?? null;
        return {
          varianteId: item.id,
          varianteNombre: item.nombre,
          proceso,
        };
      }),
    [props.procesos, rutaDefaultProductoId, rutasPorVarianteDraft, usarRutaComunVariantes, variantes],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ruta base</CardTitle>
        <CardDescription>Define la ruta principal del producto, el modo de resolución y las reglas técnicas de impresión.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProductoTabSection
          title="Resumen de configuración"
          description="Lectura rápida del modo de resolución, la ruta principal y el alcance de las reglas activas."
          icon={InfoIcon}
          contentClassName="grid gap-3 md:grid-cols-4"
        >
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Modo actual</p>
            <p className="mt-1 text-sm font-medium">{usarRutaComunVariantes ? "Ruta única para todo el producto" : "Ruta por variante"}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Ruta principal</p>
            <p className="mt-1 text-sm font-medium">{rutaNombreById.get(rutaDefaultProductoId) ?? rutaLabelById.get(rutaDefaultProductoId) ?? "Sin ruta"}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Variantes afectadas</p>
            <p className="mt-1 text-sm font-medium">{variantesAfectadas}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Estado</p>
            <p className="mt-1 text-sm font-medium">{isDirty ? "Hay cambios pendientes" : "Sin cambios pendientes"}</p>
          </div>
        </ProductoTabSection>

        <ProductoTabSection
          title="Ruta principal"
          description="Definí la ruta base del producto y revisá sus pasos antes de resolver la lógica por variante o por impresión."
          icon={MapIcon}
          actions={
            <Link href="/costos/procesos" className={buttonVariants({ variant: "outline" })}>
              Ir al módulo Rutas
            </Link>
          }
        >
          <div className="space-y-4">
            <Field className="max-w-[520px]">
              <FieldLabel>Ruta principal del producto</FieldLabel>
              <Select value={rutaDefaultProductoId || "__none__"} onValueChange={(value) => setRutaDefaultProductoId(value === "__none__" ? "" : value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccioná ruta">
                    <span className="block max-w-[44vw] truncate">
                      {rutaNombreById.get(rutaDefaultProductoId) ?? rutaLabelById.get(rutaDefaultProductoId) ?? ""}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="min-w-[460px] max-w-[80vw]">
                  <SelectItem value="__none__">Sin ruta</SelectItem>
                  {props.procesos.map((proceso) => (
                    <SelectItem key={proceso.id} value={proceso.id}>
                      {proceso.codigo} · {proceso.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="rounded-lg border">
              <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">Pasos de la ruta seleccionada</div>
              {procesoSeleccionado ? (
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="w-[56px]">#</TableHead>
                      <TableHead>Paso</TableHead>
                      <TableHead>Centro de costo</TableHead>
                      <TableHead>Máquina</TableHead>
                      <TableHead>Modo / Productividad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {procesoSeleccionado.operaciones.map((op) => {
                      const unidadProductividad = getUnidadProductividadCompuestaLabel(op.unidadSalida, op.unidadTiempo);
                      const modoLabel = getModoProductividadLabel(op.modoProductividad);
                      const detalleModo =
                        op.modoProductividad === "fija"
                          ? op.tiempoFijoMin != null && op.tiempoFijoMin > 0
                            ? `${op.tiempoFijoMin} min`
                            : "-"
                          : op.productividadBase != null
                            ? `${op.productividadBase} ${unidadProductividad}`
                            : "-";
                      return (
                        <TableRow key={op.id}>
                          <TableCell>{op.orden}</TableCell>
                          <TableCell>{op.nombre}</TableCell>
                          <TableCell>{op.centroCostoNombre}</TableCell>
                          <TableCell>{op.maquinaNombre || "-"}</TableCell>
                          <TableCell>{modoLabel} · {detalleModo}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Seleccioná una ruta para ver su secuencia operativa.
                </div>
              )}
            </div>
          </div>
        </ProductoTabSection>

        <ProductoTabSection
          title="Modo de resolución"
          description="Definí si el producto comparte una ruta para todas las variantes o si cada variante resuelve la suya."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <Switch checked={!usarRutaComunVariantes} onCheckedChange={(checked) => handleToggleRutasPorVariante(Boolean(checked))} />
                <p className="text-sm font-medium">Rutas por variante</p>
                <Tooltip>
                  <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                    <InfoIcon className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    OFF: usa la ruta principal para todo el producto. ON: cada variante puede tener su propia ruta.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {usarRutaComunVariantes ? (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Variante</TableHead>
                      <TableHead>Ruta efectiva</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variantes.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.nombre}</TableCell>
                        <TableCell>{rutaLabelById.get(rutaDefaultProductoId) ?? "Sin ruta"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="space-y-3">
                {variantes.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
                      <div>
                        <p className="text-sm font-medium">{item.nombre}{item.activo ? "" : " (inactiva)"}</p>
                      </div>
                      <div className="space-y-3">
                        <Field className="max-w-[420px]">
                          <FieldLabel>Ruta de la variante</FieldLabel>
                          <Select
                            value={rutasPorVarianteDraft[item.id] || "__none__"}
                            onValueChange={(value) => {
                              const next = value === "__none__" ? "" : value ?? "";
                              setRutasPorVarianteDraft((prev) => ({ ...prev, [item.id]: next }));
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccioná ruta">
                                <span className="block max-w-[44vw] truncate">
                                  {rutaNombreById.get(rutasPorVarianteDraft[item.id] ?? "") ??
                                    rutaLabelById.get(rutasPorVarianteDraft[item.id] ?? "") ??
                                    ""}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="min-w-[460px] max-w-[80vw]">
                              <SelectItem value="__none__">Sin ruta</SelectItem>
                              {props.procesos.map((proceso) => (
                                <SelectItem key={proceso.id} value={proceso.id}>
                                  {proceso.codigo} · {proceso.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        {(() => {
                          const procesoVariante =
                            props.procesos.find((p) => p.id === (rutasPorVarianteDraft[item.id] ?? item.procesoDefinicionId ?? "")) ?? null;
                          return procesoVariante ? (
                            <div className="rounded border">
                              <Table>
                                <TableHeader className="bg-muted/40">
                                  <TableRow>
                                    <TableHead className="w-[56px]">#</TableHead>
                                    <TableHead>Paso</TableHead>
                                    <TableHead>Centro</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {procesoVariante.operaciones.map((op) => (
                                    <TableRow key={`${item.id}-${op.id}`}>
                                      <TableCell>{op.orden}</TableCell>
                                      <TableCell>{resolveProcesoOperacionPlantilla(op, props.plantillasPaso)?.nombre ?? op.nombre}</TableCell>
                                      <TableCell>{op.centroCostoNombre}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Sin ruta asignada.</p>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ProductoTabSection>

        <ProductoTabSection
          title="Resolución técnica de impresión"
          description="Definí qué opciones técnicas cambian la ruta y cómo se asignan paso y perfil operativo por variante."
        >
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Opciones técnicas que cambian la ruta</p>
                <p className="text-xs text-muted-foreground">
                  Marcá qué opciones obligan a resolver un paso y un perfil operativo específicos.
                </p>
              </div>
              <div className="flex flex-wrap gap-4 rounded-md border p-3">
            {(["tipo_impresion", "caras"] as const).map((dimension) => (
              <label key={dimension} className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={dimensionesBaseConsumidasDraft.includes(dimension)}
                  onCheckedChange={(checked) => handleToggleDimensionConsumida(dimension, checked === true)}
                />
                <span>{dimensionBaseLabelByValue[dimension]}</span>
              </label>
            ))}
              </div>
            </div>

            <div className="space-y-4">
            {variantes.map((variante) => {
              const procesoIdRutaBase = usarRutaComunVariantes
                ? rutaDefaultProductoId
                : (rutasPorVarianteDraft[variante.id] ?? variante.procesoDefinicionId ?? "");
              const pasosRutaBaseDisponibles = getRutaBasePasoOptions(
                procesoIdRutaBase,
                props.procesos,
                props.plantillasPaso,
                props.maquinas,
                dimensionesBaseConsumidasDraft,
              );
              const pasoDefaultUnico = pasosRutaBaseDisponibles.length === 1 ? pasosRutaBaseDisponibles[0]?.id ?? "" : "";
              const pasosFijosRutaBase = getRutaBasePasoFijoOptions(
                procesoIdRutaBase,
                props.procesos,
                props.plantillasPaso,
                props.maquinas,
                dimensionesBaseConsumidasDraft,
              );
              const rows = buildMatchingRowsForVariante(
                variante,
                dimensionesBaseConsumidasDraft,
                rutaBaseMatchingDraft[variante.id] ?? [],
                pasoDefaultUnico,
              );
              return (
                <React.Fragment key={`base-rules-${variante.id}`}>
                  <div className="rounded-md border">
                    <div className="border-b bg-muted/30 px-3 py-2">
                      <p className="text-sm font-medium">{variante.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        Reglas de asignación por impresión para esta variante.
                      </p>
                    </div>
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow>
                          {dimensionesBaseConsumidasDraft.includes("tipo_impresion") ? (
                            <TableHead className="w-[180px]">Tipo de impresión</TableHead>
                          ) : null}
                          {dimensionesBaseConsumidasDraft.includes("caras") ? <TableHead className="w-[180px]">Caras</TableHead> : null}
                          <TableHead className="w-[320px]">Paso</TableHead>
                          <TableHead>Perfil operativo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.length ? (
                          rows.map((row) => {
                            const plantilla = pasosRutaBaseDisponibles.find((item) => item.id === row.pasoPlantillaId) ?? null;
                            const perfilesDisponibles = plantilla?.maquinaId
                              ? (maquinaById.get(plantilla.maquinaId)?.perfilesOperativos ?? [])
                                  .filter((item) => item.activo)
                                  .filter((item) => isPerfilCompatibleWithMatchingRow(item, row))
                              : [];
                            return (
                              <TableRow key={`${variante.id}-${row.key}`}>
                                {dimensionesBaseConsumidasDraft.includes("tipo_impresion") ? (
                                  <TableCell>{row.tipoImpresion ? valorOpcionBaseLabelByValue[row.tipoImpresion] : "-"}</TableCell>
                                ) : null}
                                {dimensionesBaseConsumidasDraft.includes("caras") ? (
                                  <TableCell>{row.caras ? valorOpcionBaseLabelByValue[row.caras] : "-"}</TableCell>
                                ) : null}
                                <TableCell>
                                  <Select
                                    value={row.pasoPlantillaId || "__none__"}
                                    onValueChange={(next) => {
                                      const nextPasoPlantillaId = next === "__none__" ? "" : next ?? "";
                                      const nextPlantilla =
                                        pasosRutaBaseDisponibles.find((item) => item.id === nextPasoPlantillaId) ?? null;
                                      handleRutaBaseMatchingChange(
                                        variante.id,
                                        { tipoImpresion: row.tipoImpresion, caras: row.caras },
                                        {
                                          pasoPlantillaId: nextPasoPlantillaId,
                                          perfilOperativoId:
                                            (nextPlantilla?.maquinaId
                                              ? (maquinaById.get(nextPlantilla.maquinaId)?.perfilesOperativos ?? [])
                                                  .filter((item) => item.activo)
                                                  .filter((item) => isPerfilCompatibleWithMatchingRow(item, row))[0]?.id
                                              : "") ?? "",
                                        },
                                      );
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccioná paso">{plantilla?.nombre ?? "Seleccioná paso"}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">Seleccioná paso</SelectItem>
                                      {pasosRutaBaseDisponibles.map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                          {item.nombre}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={row.perfilOperativoId || "__none__"}
                                    onValueChange={(next) =>
                                      handleRutaBaseMatchingChange(
                                        variante.id,
                                        { tipoImpresion: row.tipoImpresion, caras: row.caras },
                                        {
                                          pasoPlantillaId: row.pasoPlantillaId,
                                          perfilOperativoId: next === "__none__" ? "" : next ?? "",
                                        },
                                      )
                                    }
                                    disabled={!plantilla?.maquinaId}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccioná perfil">
                                        {perfilesDisponibles.find((item) => item.id === row.perfilOperativoId)?.nombre ?? "Seleccioná perfil"}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">Seleccioná perfil</SelectItem>
                                      {perfilesDisponibles.map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                          {item.nombre}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={Math.max(2, dimensionesBaseConsumidasDraft.length + 2)}
                              className="text-center text-sm text-muted-foreground"
                            >
                              Marcá al menos una dimensión consumida en la configuración de arriba.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {pasosFijosRutaBase.length ? (
                    <div className="rounded-md border">
                      <div className="border-b bg-muted/30 px-3 py-2">
                        <p className="text-sm font-medium">Pasos fijos</p>
                        <p className="text-xs text-muted-foreground">Pasos que siempre forman parte de la ruta y requieren perfil operativo.</p>
                      </div>
                      <Table>
                        <TableHeader className="bg-muted/20">
                          <TableRow>
                            <TableHead className="w-[320px]">Paso</TableHead>
                            <TableHead>Perfil operativo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pasosFijosRutaBase.map((pasoFijo) => {
                            const perfilesDisponibles = pasoFijo.maquinaId
                              ? (maquinaById.get(pasoFijo.maquinaId)?.perfilesOperativos ?? []).filter((item) => item.activo)
                              : [];
                            const currentPerfilId =
                              (rutaBasePasosFijosDraft[variante.id] ?? []).find((item) => item.pasoPlantillaId === pasoFijo.id)
                                ?.perfilOperativoId ??
                              pasoFijo.perfilOperativoId ??
                              "";
                            return (
                              <TableRow key={`${variante.id}-fijo-${pasoFijo.id}`}>
                                <TableCell>{pasoFijo.nombre}</TableCell>
                                <TableCell>
                                  <Select
                                    value={currentPerfilId || "__none__"}
                                    onValueChange={(next) =>
                                      handleRutaBasePasoFijoChange(variante.id, pasoFijo.id, next === "__none__" ? "" : next ?? "")
                                    }
                                    disabled={!pasoFijo.maquinaId}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccioná perfil">
                                        {perfilesDisponibles.find((item) => item.id === currentPerfilId)?.nombre ?? "Seleccioná perfil"}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">Seleccioná perfil</SelectItem>
                                      {perfilesDisponibles.map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                          {item.nombre}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                </React.Fragment>
              );
            })}
            </div>
          </div>
        </ProductoTabSection>

        <ProductoTabSection
          title="Preview de ruta efectiva"
          description="Validá rápidamente cómo queda resuelta la ruta final por variante antes de guardar."
          icon={EyeIcon}
        >
          <div className="space-y-3">
            {routePreviewRows.map((item) => (
              <div key={`preview-${item.varianteId}`} className="rounded-lg border p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{item.varianteNombre}</p>
                  <span className="text-xs text-muted-foreground">
                    {item.proceso ? `${item.proceso.codigo} · ${item.proceso.nombre}` : "Sin ruta efectiva"}
                  </span>
                </div>
                {item.proceso ? (
                  <div className="rounded border">
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow>
                          <TableHead className="w-[56px]">#</TableHead>
                          <TableHead>Paso</TableHead>
                          <TableHead>Centro de costo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {item.proceso.operaciones.map((op) => (
                          <TableRow key={`${item.varianteId}-preview-${op.id}`}>
                            <TableCell>{op.orden}</TableCell>
                            <TableCell>{resolveProcesoOperacionPlantilla(op, props.plantillasPaso)?.nombre ?? op.nombre}</TableCell>
                            <TableCell>{op.centroCostoNombre}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Sin ruta efectiva para esta variante.</div>
                )}
              </div>
            ))}
          </div>
        </ProductoTabSection>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Acción final</p>
            <p className="text-xs text-muted-foreground">
              Guardá todos los cambios del tab cuando termines de revisar la ruta principal, el modo y las reglas técnicas.
            </p>
          </div>
          <Button type="button" onClick={handleSave} disabled={isSaving || !isDirty}>
            {isSaving ? <GdiSpinner className="size-4" data-icon="inline-start" /> : <SaveIcon className="size-4" data-icon="inline-start" />}
            Guardar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
