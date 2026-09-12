"use client";

import { NestingPatronesView, NestingBalance } from "./nesting-patrones-view";
import {
  crearNavegacionNesting,
  balancePiezasNesting,
} from "@/lib/nesting-vista";
import * as React from "react";
import { formatearMoneda, type Moneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { useCapasFabricacion } from "@/hooks/use-capas-fabricacion";
import { EstadoCapasFabricacion } from "./capas-fabricacion-nesting";
import type { NestingViewerInput } from "@/lib/productos-servicios-api";
import { cn } from "@/lib/utils";
import s from "./nesting-viewer.module.css";
import {
  NestingCanvas,
  type ModificacionesOverlay,
  type PlanImposicionOutput,
  getEffectiveVisualConfig,
  formatNumber,
  formatMm,
  getPieceBleedMm,
  colorForKey,
  type PieceStyle,
  placementGroupKey,
  placementLabel,
  getPlanImposicion,
  placementAreaMm2,
} from "./nesting-canvas";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Scan,
  ListChecks,
  Files,
} from "lucide-react";
import theme from "@/components/ui/workspace-theme.module.css";
import v from "./nesting-explorer.module.css";
export type { ModificacionesOverlay } from "./nesting-canvas";

export interface NestingViewerProps {
  result: NestingViewerInput;
  /**
   * Copias del talonario (1 = simple, 2 = duplicado, 3 = triplicado). El
   * nesting representa UNA copia: los pasos de impresión repiten el mismo
   * acomodo, así que el consumo total del ítem es cantidadCalculada × copias.
   */
  copias?: number;
  costingDetails?: Array<{
    materialNombre: string;
    cantidad: number;
    costoTotal: number;
    detalleCosteoNesting?: {
      strategy: string;
      totalCost: number;
      unitPrice: number;
      pricePerM2: number;
      fullUnits: number;
      fullUnitsCost: number;
      lastUnit: {
        occupationPct: number;
        segmentApplied: number | null;
        cost: number;
      } | null;
      units?: Array<{
        index: number;
        occupationPct: number;
        segmentApplied: number | null;
        cost: number;
      }>;
    };
  }>;
  maxPx?: number;
  showLabels?: boolean;
  className?: string;
  /** Descargas habilitadas por el proceso de corte, dentro del visor. */
  archivos?: React.ReactNode;
  /**
   * Modificaciones físicas a superponer sobre cada pieza: la franja de demasía
   * (bolsillo / refuerzo) y dónde van los ojales. Las posiciones vienen del
   * motor, no se recalculan acá.
   * Ver docs/modificaciones-fisicas-lona-diseno.md.
   */
  modificaciones?: ModificacionesOverlay;
}

function formatM2(mm2: number): string {
  return `${formatNumber(mm2 / 1_000_000, 2)} m²`;
}

function formatMoney(value: number, moneda: Moneda) {
  return formatearMoneda(value, moneda, { decimales: 0 });
}

function labelUnidad(u: NestingViewerInput["unidad"], cantidad = 2): string {
  switch (u) {
    case "m_lineales":
      return "m lineales";
    case "pliegos":
      return cantidad === 1 ? "pliego" : "pliegos";
    case "pouches":
      return cantidad === 1 ? "pouch" : "pouches";
    case "m2":
      return "m²";
    case "piezas":
      return cantidad === 1 ? "pieza" : "piezas";
  }
}

function algorithmLabel(algorithm: NestingViewerInput["algorithm"]): string {
  const labels: Record<NestingViewerInput["algorithm"], string> = {
    "shelf-rollo": "Acomodo en rollo",
    "maxrects-rollo": "Acomodo optimizado en rollo",
    "secuencial-rollo": "Acomodo secuencial en rollo",
    "grid-2d-single": "Acomodo en pliego",
    "grid-2d-multi": "Acomodo multi-placa",
    "irregular-2d-bottom-left-v1": "Acomodo vectorial en placa",
    "manual-vector-estimate-v1": "Estimación manual de corte",
  };
  // Snapshots viejos pueden traer un algoritmo ya retirado.
  return labels[algorithm] ?? "Acomodo";
}

function costingLabel(strategy: string) {
  const labels: Record<string, string> = {
    simple: "simple",
    "m2-exact": "m² exactos",
    "consumed-length": "largo consumido",
    "plate-segments": "segmentos de placa",
  };
  return labels[strategy] ?? strategy;
}

function usePieceGroups(placements: NestingViewerInput["placements"]) {
  return React.useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        count: number;
        style: PieceStyle;
        widthMm: number;
        heightMm: number;
      }
    >();

    placements.forEach((placement) => {
      const key = placementGroupKey(placement);
      const current = map.get(key);
      if (current) {
        current.count += 1;
        return;
      }
      map.set(key, {
        key,
        label: placementLabel(placement),
        count: 1,
        style: colorForKey(key),
        widthMm: placement.usefulWidthMm ?? placement.widthMm,
        heightMm: placement.usefulHeightMm ?? placement.heightMm,
      });
    });

    return Array.from(map.values());
  }, [placements]);
}

function copiasLabel(copias: number) {
  if (copias === 2) return "original + duplicado";
  if (copias === 3) return "original + duplicado + triplicado";
  return `${copias} copias`;
}

export function NestingViewer({
  result: original,
  copias = 1,
  costingDetails = [],
  maxPx = 560,
  showLabels = true,
  className,
  archivos,
  modificaciones,
}: NestingViewerProps) {
  const contenedor = React.useRef<HTMLElement>(null);
  const detalleTab = React.useRef<HTMLButtonElement>(null);
  const { result, ...estadoCapas } = useCapasFabricacion(original);
  const navegacion = React.useMemo(
    () => crearNavegacionNesting(result),
    [result],
  );
  const piezasTotales = React.useMemo(
    () => balancePiezasNesting(result).reduce((n, p) => n + p.colocadas, 0),
    [result],
  );
  const [seleccion, setSeleccion] = React.useState<{
    source: NestingViewerInput;
    tab: string;
    index: number;
  } | null>(null);
  const [verMaquina, setVerMaquina] = React.useState(false);
  const vigente = seleccion?.source === original ? seleccion : null;
  const tab =
    vigente?.tab &&
    (vigente.tab !== "layouts" || navegacion.patrones.length > 0) &&
    (vigente.tab !== "archivos" || archivos)
      ? vigente.tab
      : navegacion.vistaInicial;
  const indice = Math.min(
    vigente?.index ?? 0,
    Math.max(0, result.substrates.length - 1),
  );
  const sustrato = result.substrates[indice];
  const actual = navegacion.sustratos[indice];
  const pieceGroups = usePieceGroups(
    result.placements.filter((p) => (p.substrateIndex ?? 0) === indice),
  );
  function navegar(tab: string, index = indice) {
    setSeleccion({ source: original, tab, index });
  }
  if (!sustrato)
    return (
      <Empty className={cn(theme.theme, className)}>
        <EmptyHeader>
          <EmptyTitle>Sin sustratos para visualizar</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  const alto =
    sustrato.kind === "sheet" ? sustrato.heightMm : sustrato.lengthMm;
  const visual = getEffectiveVisualConfig(
    result.visualConfig,
    sustrato.widthMm,
    alto,
  );
  const areaUtil = visual.usableArea.widthMm * visual.usableArea.heightMm;
  const conImpresora =
    sustrato.kind === "roll" && !!result.visualConfig?.maquina;
  const unidadSustrato = result.algorithm.startsWith("grid-2d")
    ? "pliego"
    : "placa";
  const titulo = result.substrates.every((s) => s.kind === "sheet")
    ? `${formatNumber(navegacion.totalSustratos)} ${unidadSustrato}${navegacion.totalSustratos === 1 ? "" : "s"}${navegacion.patrones.length ? ` · ${navegacion.patrones.length} layout${navegacion.patrones.length === 1 ? "" : "s"}` : ""}`
    : algorithmLabel(result.algorithm);
  return (
    <section
      ref={contenedor}
      className={cn(theme.theme, v.viewer, className)}
      aria-label="Visor de nesting"
    >
      <header className={v.header}>
        <div>
          <h3>{titulo}</h3>
          <p>
            {formatNumber(piezasTotales)} piezas ·{" "}
            {formatNumber(result.aprovechamientoPct, 2)}% de aprovechamiento
          </p>
        </div>
        {result.composicionCompuesta && (
          <Badge variant="secondary">
            {result.composicionCompuesta.participantes} componentes · Acomodo
            consolidado
          </Badge>
        )}
        {result.estrategiaDisposicion === "composicion_original" && (
          <Badge variant="outline">Composición original</Badge>
        )}
      </header>
      <EstadoCapasFabricacion {...estadoCapas} />
      <ManejoPlacaNotice visualConfig={result.visualConfig} />
      <Tabs value={tab} onValueChange={(value) => navegar(String(value))}>
        <div className={v.nav}>
          <TabsList variant="line" aria-label="Vistas del nesting">
            {navegacion.patrones.length > 0 && (
              <TabsTrigger value="layouts">
                <Layers />
                Layouts
              </TabsTrigger>
            )}
            <TabsTrigger ref={detalleTab} value="detalle">
              <Scan />
              Detalle
            </TabsTrigger>
            <TabsTrigger value="balance">
              <ListChecks />
              Balance de piezas
            </TabsTrigger>
            {archivos && (
              <TabsTrigger value="archivos">
                <Files />
                Archivos
              </TabsTrigger>
            )}
          </TabsList>
        </div>
        {navegacion.patrones.length > 0 && (
          <TabsContent value="layouts" className={v.panel}>
            <NestingPatronesView
              result={result}
              patrones={navegacion.patrones}
              modificaciones={modificaciones}
              onVerDetalle={(index) => {
                navegar("detalle", index);
                detalleTab.current?.focus();
              }}
            />
          </TabsContent>
        )}
        <TabsContent value="detalle" className={v.panel}>
          <div className={v.detailToolbar}>
            <div className={v.controls}>
              {navegacion.sustratos.length > 1 ? (
                <>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Sustrato anterior"
                    disabled={indice === 0}
                    onClick={() => navegar("detalle", indice - 1)}
                  >
                    <ChevronLeft />
                  </Button>
                  <Select
                    value={String(indice)}
                    onValueChange={(value) => {
                      if (value !== null) navegar("detalle", Number(value));
                    }}
                    items={navegacion.sustratos.map((s) => ({
                      value: String(s.index),
                      label: s.label,
                    }))}
                  >
                    <SelectTrigger
                      aria-label="Elegir sustrato"
                      className="min-w-40"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      container={contenedor}
                      alignItemWithTrigger={false}
                      className={cn(theme.theme, "max-h-72")}
                    >
                      <SelectGroup>
                        {navegacion.sustratos.map((s) => (
                          <SelectItem key={s.index} value={String(s.index)}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Sustrato siguiente"
                    disabled={indice === navegacion.sustratos.length - 1}
                    onClick={() => navegar("detalle", indice + 1)}
                  >
                    <ChevronRight />
                  </Button>
                </>
              ) : (
                <strong>{actual.label}</strong>
              )}
              {actual.layout && (
                <Badge variant="outline">Layout {actual.layout}</Badge>
              )}
            </div>
            <div className={v.controls}>
              <span className={v.hint}>
                {formatMm(sustrato.widthMm)} × {formatMm(alto)}
              </span>
              {conImpresora && (
                <Button
                  size="sm"
                  variant="outline"
                  aria-pressed={verMaquina}
                  onClick={() => setVerMaquina((v) => !v)}
                >
                  Ver máquina
                </Button>
              )}
            </div>
          </div>
          {actual.cantidad > 1 && (
            <p className={v.hint}>
              {getPlanImposicion(result.outputsCanonicos)
                ? `Esta distribución se usa en ${actual.cantidad} sustratos. Las páginas cambian según el plan de imposición.`
                : `Este dibujo se repite en ${actual.cantidad} sustratos: ${actual.label.toLowerCase()}.`}
            </p>
          )}
          <NestingCanvas
            result={result}
            substrateIndex={indice}
            maxPx={maxPx}
            showLabels={showLabels}
            modificaciones={modificaciones}
            showPrinter={verMaquina}
            accessibleLabel={`Distribución de ${actual.label.toLowerCase()}${actual.layout ? ` · Layout ${actual.layout}` : ""}`}
          />
          <NestingLegend
            pieceGroups={pieceGroups}
            visualConfig={result.visualConfig}
            costingPreview={result.costingPreview}
            modificaciones={modificaciones}
          />
          <PlanImposicionCuadernillo outputs={result.outputsCanonicos} />
          <PliegoSeleccionadoBanner
            seleccion={result.pliegoImpresionSeleccionado}
          />
          <TalonarioGrouping
            grouping={result.talonarioGrouping}
            copias={copias}
          />
          <details className={v.technical}>
            <summary>Medidas, configuración y cálculo</summary>
            <div className={s.stats}>
              <StatBlock
                label={
                  result.unidad === "m_lineales"
                    ? "Largo consumido"
                    : "Cantidad calculada"
                }
                value={`${formatNumber(result.cantidadCalculada * copias)} ${labelUnidad(result.unidad, result.cantidadCalculada * copias)}`}
                hint={
                  copias > 1
                    ? `${formatNumber(result.cantidadCalculada)} por copia × ${copias} (${copiasLabel(copias)})`
                    : undefined
                }
              />
              <StatBlock
                label="Área útil del sustrato"
                value={formatM2(areaUtil)}
              />
              <StatBlock
                label="Desperdicio costeado"
                value={
                  result.costingPreview?.wasteAreaMm2
                    ? formatM2(result.costingPreview.wasteAreaMm2)
                    : "—"
                }
              />
            </div>
            <NestingConfigStrip
              result={{ ...result, substrates: [sustrato] }}
              substrateLabel={
                result.visualConfig?.substrateLabel ??
                `${formatMm(sustrato.widthMm)} × ${formatMm(alto)}`
              }
            />
            <NestingCostingSummary costingDetails={costingDetails} />
            <NestingFooter result={result} />
            <NestingOutputsSummary outputs={result.outputsCanonicos} />
          </details>
        </TabsContent>
        <TabsContent value="balance" className={v.panel}>
          <p className={v.hint}>
            Totales de todo el acomodo, incluidas las repeticiones de cada
            sustrato.
          </p>
          <NestingBalance result={result} />
        </TabsContent>
        {archivos && (
          <TabsContent value="archivos" className={v.panel}>
            {archivos}
          </TabsContent>
        )}
      </Tabs>
    </section>
  );
}

function StatBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className={s.stat}>
      <div className={s.label}>{label}</div>
      <div className={s.value}>{value}</div>
      {hint ? (
        <div className={s.hint} title={hint}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function NestingConfigStrip({
  result,
  substrateLabel,
}: {
  result: NestingViewerInput;
  substrateLabel: string;
}) {
  const sub = result.substrates[0];
  const height = sub?.kind === "sheet" ? sub.heightMm : sub?.lengthMm;
  const visualConfig = sub
    ? getEffectiveVisualConfig(result.visualConfig, sub.widthMm, height ?? 0)
    : null;
  const panelizado = visualConfig?.panelizado;
  const maquina = result.visualConfig?.maquina;
  const configItems = [
    maquina
      ? [
          "Máquina",
          `${maquina.nombre}${maquina.anchoUtilMm ? ` · útil ${formatNumber(maquina.anchoUtilMm / 1000, 2)} m` : ""}`,
        ]
      : null,
    ["Sustrato", substrateLabel],
    visualConfig
      ? [
          "Márgenes",
          `I ${formatMm(visualConfig.margins.leftMm)} · D ${formatMm(visualConfig.margins.rightMm)} · S ${formatMm(visualConfig.margins.topMm)} · Inf ${formatMm(visualConfig.margins.bottomMm)}`,
        ]
      : null,
    visualConfig
      ? ["Demasía", `${formatMm(getPieceBleedMm(visualConfig))} por lado`]
      : null,
    visualConfig
      ? ["Rotación", visualConfig.allowRotation ? "permitida" : "bloqueada"]
      : null,
    visualConfig?.manejoPlaca
      ? [
          "Carga",
          `sobresale ${formatMm(visualConfig.manejoPlaca.excedenteMm)} · eje ${visualConfig.manejoPlaca.eje.toUpperCase()}`,
        ]
      : null,
    result.costingPreview
      ? ["Costeo", costingLabel(result.costingPreview.strategy)]
      : null,
    panelizado?.enabled
      ? [
          "Panelizado",
          `${panelizado.panelCount} paneles · ${panelizado.axis ?? "auto"} · solape ${formatMm(panelizado.overlapMm ?? 0)}`,
        ]
      : null,
  ].filter(Boolean) as Array<[string, string]>;

  return (
    <div className={s.config}>
      {configItems.map(([key, value]) => (
        <div key={key} className={s.group}>
          <span className={s.key}>{key}</span>
          <span className={s.valueSmall}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function ManejoPlacaNotice({
  visualConfig,
}: {
  visualConfig?: NestingViewerInput["visualConfig"];
}) {
  const manejo = visualConfig?.manejoPlaca;
  if (!manejo) return null;

  return (
    <div className={s.sheetHandlingNotice} role="note">
      <span className={s.sheetHandlingMark} aria-hidden="true">
        ↕
      </span>
      <div>
        <strong>Carga especial de placa</strong>
        <span>{manejo.mensaje}</span>
      </div>
    </div>
  );
}

function NestingCostingSummary({
  costingDetails,
}: {
  costingDetails: NonNullable<NestingViewerProps["costingDetails"]>;
}) {
  const { moneda } = useConfigRegional();
  const items = costingDetails.filter((item) => item.detalleCosteoNesting);
  if (items.length === 0) return null;

  return (
    <div className={s.costing}>
      {items.map((item) => {
        const detalle = item.detalleCosteoNesting!;
        return (
          <div key={`${item.materialNombre}-${detalle.strategy}`}>
            <span className="font-semibold">Costeo del sustrato</span>
            <span>{item.materialNombre}</span>
            <span>{costingLabel(detalle.strategy)}</span>
            <span>Total {formatMoney(detalle.totalCost, moneda)}</span>
            {detalle.units && detalle.units.length > 0 ? (
              <span>
                {detalle.units
                  .map(
                    (unit) =>
                      `Placa ${unit.index + 1}: ${formatNumber(unit.occupationPct, 1)}%` +
                      (unit.segmentApplied != null
                        ? ` → cobra ${formatNumber(unit.segmentApplied, 0)}%`
                        : ""),
                  )
                  .join(" · ")}
              </span>
            ) : detalle.lastUnit ? (
              <span>
                Última placa {formatNumber(detalle.lastUnit.occupationPct, 1)}%
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function NestingOutputsSummary({
  outputs,
}: {
  outputs?: NestingViewerInput["outputsCanonicos"];
}) {
  const items = getDisplayableOutputs(outputs);
  if (items.length === 0) return null;

  return (
    <div className={s.outputs}>
      <div className={s.label}>Resultados del cálculo</div>
      <div className={s.items}>
        {items.map(([key, value]) => (
          <div key={key} className={s.output}>
            <span className={s.key} title={key}>
              {humanOutputLabel(key)}
            </span>
            <span className={s.valueSmall} title={value}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getDisplayableOutputs(
  outputs?: NestingViewerInput["outputsCanonicos"],
) {
  if (!outputs) return [];
  const preferred = [
    "pliegos_calculados",
    "poses_por_pliego",
    "cortes_calculados",
    "pliego_impresion_ancho_mm",
    "pliego_impresion_alto_mm",
    "pliego_impresion_area_m2",
  ];
  return preferred
    .filter((key) => outputs[key] != null)
    .map(
      (key) => [key, formatOutputValue(key, outputs[key])] as [string, string],
    )
    .filter(([, value]) => value.length > 0);
}

function formatOutputValue(key: string, value: unknown) {
  if (typeof value === "number") {
    if (key.endsWith("_mm")) return formatMm(value);
    if (key.endsWith("_m2")) return formatM2(value * 1_000_000);
    return formatNumber(value, 2);
  }
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    key === "cortes_calculados"
  ) {
    const cuts = value as {
      cortesTotales?: unknown;
      columnas?: unknown;
      filas?: unknown;
      demasiaMm?: unknown;
      formula?: unknown;
    };
    const total = Number(cuts.cortesTotales ?? 0);
    const columnas = Number(cuts.columnas ?? 0);
    const filas = Number(cuts.filas ?? 0);
    const demasia = Number(cuts.demasiaMm ?? 0);
    const base = `${formatNumber(total, 0)} cortes`;
    const grid =
      columnas > 0 && filas > 0 ? ` · ${columnas} col × ${filas} filas` : "";
    const bleed =
      demasia > 0 ? ` · demasía ${formatMm(demasia)}` : " · sin demasía";
    return `${base}${grid}${bleed}`;
  }
  return "";
}

function humanOutputLabel(key: string) {
  const labels: Record<string, string> = {
    pliegos_calculados: "Pliegos",
    poses_por_pliego: "Poses por pliego",
    cortes_calculados: "Cortes",
    pliego_impresion_ancho_mm: "Ancho pliego",
    pliego_impresion_alto_mm: "Alto pliego",
    pliego_impresion_area_m2: "Área pliego",
    hojas_por_libro: "Hojas por libro",
    paginas_blancas: "Páginas en blanco",
    libros_por_juego: "Libros por juego",
  };
  return labels[key] ?? key.replaceAll("_", " ");
}

/** "Tapa · páginas 1-2, 31-32" — qué parte del libro cubre este paso. */
function describirSeleccion(plan: PlanImposicionOutput): string | null {
  const modo = plan.seleccionHojas?.modo;
  if (!modo || modo === "todas") return null;
  const etiqueta =
    modo === "tapa"
      ? "Tapa"
      : modo === "interior"
        ? "Interior"
        : `Hojas ${plan.seleccionHojas?.desde}–${plan.seleccionHojas?.hasta}`;
  const paginas = plan.paginasDelPaso ?? [];
  if (paginas.length === 0) return etiqueta;
  const rangos: string[] = [];
  let ini = paginas[0];
  let prev = paginas[0];
  for (const p of paginas.slice(1)) {
    if (p === prev + 1) {
      prev = p;
      continue;
    }
    rangos.push(ini === prev ? `${ini}` : `${ini}-${prev}`);
    ini = p;
    prev = p;
  }
  rangos.push(ini === prev ? `${ini}` : `${ini}-${prev}`);
  return `${etiqueta} · páginas ${rangos.join(", ")}`;
}

function PlanImposicionCuadernillo({
  outputs,
}: {
  outputs?: NestingViewerInput["outputsCanonicos"];
}) {
  const plan = getPlanImposicion(outputs);
  if (!plan) return null;
  const seleccion = describirSeleccion(plan);
  const hojasDelPaso = plan.hojasDelPaso ?? plan.plan.length;
  const esBlanca = (pagina: number) => pagina > plan.paginasSolicitadas;
  const celda = (pagina: number) =>
    esBlanca(pagina) ? `${pagina}·bl` : String(pagina);
  return (
    <div className={s.planImposicion}>
      <div className={s.planHead}>
        <span className={s.planTitulo}>Plan de imposición · caballete</span>
        <span className={s.planResumen}>
          {seleccion ? (
            <>
              <strong>{seleccion}</strong>
              {" · "}
            </>
          ) : null}
          {hojasDelPaso} de {plan.hojasPorLibro} hoja
          {plan.hojasPorLibro === 1 ? "" : "s"} del libro
          {plan.librosPorJuego > 1
            ? ` · ${plan.librosPorJuego} libros por juego (cortar al medio)`
            : ""}
          {plan.paginasBlancas > 0
            ? ` · ${plan.paginasBlancas} pág. en blanco al final`
            : ""}
          {" · el gráfico muestra la primera hoja de este paso"}
        </span>
      </div>
      <table className={s.planTabla}>
        <thead>
          <tr>
            <th>Hoja</th>
            <th>Frente</th>
            <th>Dorso</th>
          </tr>
        </thead>
        <tbody>
          {plan.plan.map((h) => (
            <tr key={h.hoja}>
              <td>{h.hoja}</td>
              <td>
                {celda(h.frente[0])} | {celda(h.frente[1])}
              </td>
              <td>
                {celda(h.dorso[0])} | {celda(h.dorso[1])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {plan.paginasBlancas > 0 ? (
        <span className={s.planNota}>·bl = página en blanco de relleno</span>
      ) : null}
    </div>
  );
}

function NestingLegend({
  pieceGroups,
  visualConfig,
  costingPreview,
  modificaciones,
}: {
  pieceGroups: ReturnType<typeof usePieceGroups>;
  visualConfig?: NestingViewerInput["visualConfig"];
  costingPreview?: NestingViewerInput["costingPreview"];
  modificaciones?: ModificacionesOverlay;
}) {
  const hasMargins =
    visualConfig &&
    Object.values(visualConfig.margins).some((value) => value > 0);
  const hasBleed = visualConfig && getPieceBleedMm(visualConfig) > 0;
  const showCosting = costingPreview && costingPreview.strategy !== "simple";
  const hasPanelizado = visualConfig?.panelizado?.enabled === true;
  // OJO: el chip "Demasía" de acá abajo es el SANGRADO de impresión
  // (`pieceBleedMm`), no la demasía de un bolsillo/refuerzo. Son cosas
  // distintas, así que la de modificaciones se llama por su nombre de taller.
  const hasModificacion =
    modificaciones !== undefined &&
    Object.values(modificaciones.demasia).some((mm) => mm > 0);
  const hasOjales = (modificaciones?.ojales.length ?? 0) > 0;

  if (
    pieceGroups.length === 0 &&
    !hasMargins &&
    !hasBleed &&
    !showCosting &&
    !hasPanelizado &&
    !hasModificacion &&
    !hasOjales
  )
    return null;

  return (
    <div className={s.legend}>
      <span className={s.label}>Referencias</span>
      <LegendChip color="#ffffff" border="#b8d8c2" label="Área útil" dashed />
      {hasMargins ? (
        <LegendChip color="#fff4df" border="#e9b978" label="Márgenes" />
      ) : null}
      {showCosting ? (
        <LegendChip color="#fff1c8" border="#e7be58" label="Área costeada" />
      ) : null}
      {costingPreview?.wasteAreaMm2 ? (
        <LegendChip
          color="#fef3ed"
          border="#f4b9a0"
          label="Desperdicio"
          dashed
        />
      ) : null}
      {hasBleed ? (
        <LegendChip color="#e7e5e4" border="#bdb9b4" label="Demasía" />
      ) : null}
      {hasPanelizado ? (
        <LegendChip color="#fef3c7" border="#d97706" label="Solape" />
      ) : null}
      {hasModificacion ? (
        <LegendChip
          color="#fdd2b0"
          border="#c2410c"
          label="Bolsillo / refuerzo"
          dashed
        />
      ) : null}
      {hasOjales ? (
        <LegendChip color="#ffffff" border="#0f766e" label="Ojales" />
      ) : null}
      {pieceGroups.map((piece) => (
        <span key={piece.key} className={s.legendItem}>
          <span
            className={s.swatch}
            style={{
              backgroundColor: piece.style.fill,
              borderColor: piece.style.stroke,
            }}
            aria-hidden
          />
          <span className={s.name}>{piece.label}</span>
          <span className={s.count}>{piece.count}</span>
        </span>
      ))}
    </div>
  );
}

function LegendChip({
  color,
  border,
  label,
  dashed,
}: {
  color: string;
  border: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className={s.legendItem}>
      <span
        className={cn(s.swatch, dashed && s.dashed)}
        style={{ backgroundColor: color, borderColor: border }}
        aria-hidden
      />
      <span className={s.name}>{label}</span>
    </span>
  );
}

function NestingFooter({ result }: { result: NestingViewerInput }) {
  const placedAreaMm2 = result.placements.reduce((acc, placement) => {
    const sub = result.substrates[placement.substrateIndex ?? 0];
    return (
      acc +
      placementAreaMm2(placement) * (sub?.kind === "sheet" ? sub.count : 1)
    );
  }, 0);
  const chargedArea = result.costingPreview?.chargedAreaMm2;
  const chargedLength = result.costingPreview?.chargedLengthMm;

  return (
    <div className={s.footer}>
      <span>
        <span className={s.key}>Área piezas</span>
        <strong className={s.valueSmall}>{formatM2(placedAreaMm2)}</strong>
      </span>
      {chargedArea ? (
        <span>
          <span className={s.key}>Área costeada</span>
          <strong className={s.valueSmall}>{formatM2(chargedArea)}</strong>
        </span>
      ) : null}
      {chargedLength ? (
        <span>
          <span className={s.key}>Largo costeado</span>
          <strong className={s.valueSmall}>{formatMm(chargedLength)}</strong>
        </span>
      ) : null}
      {result.commonLine?.habilitado ? (
        <span>
          <span className={s.key}>Common Line</span>
          <strong className={s.valueSmall}>
            {result.commonLine.aplicado
              ? `${result.commonLine.tramos.length} tramos · ${formatMm(result.commonLine.ahorroRecorridoMm)} menos`
              : "Sin tramos compatibles"}
          </strong>
        </span>
      ) : null}
    </div>
  );
}

function PliegoSeleccionadoBanner({
  seleccion,
}: {
  seleccion?: NestingViewerInput["pliegoImpresionSeleccionado"];
}) {
  if (!seleccion) return null;
  const criterioLabel: Record<string, string> = {
    menor_costo_sustrato: "menor costo de sustrato (derivado)",
    menor_costo_real: "menor costo real de materia prima",
  };
  const esCostoReal = seleccion.criterio === "menor_costo_real";
  return (
    <div className={s.notice}>
      <span className="font-semibold">Pliego automático</span>
      <span>
        ganador: {seleccion.nombre} ({formatMm(seleccion.anchoMm)} ×{" "}
        {formatMm(seleccion.altoMm)})
      </span>
      <span>{seleccion.candidatosEvaluados} candidato(s) evaluados</span>
      <span>
        {seleccion.pliegosImpresion} pliegos impresión →{" "}
        {seleccion.pliegosComprados} comprados
      </span>
      {seleccion.materiaPrima ? (
        <span>
          MP: {seleccion.materiaPrima.nombre} ({seleccion.materiaPrima.sku})
          {seleccion.materiaPrima.precioReferencia != null
            ? ` · $${seleccion.materiaPrima.precioReferencia}`
            : ""}
        </span>
      ) : null}
      {esCostoReal ? (
        <span>costo estimado: ${Math.round(seleccion.costoEstimadoMm2)}</span>
      ) : null}
      <span>
        criterio: {criterioLabel[seleccion.criterio] ?? seleccion.criterio}
      </span>
    </div>
  );
}

function TalonarioGrouping({
  grouping,
  copias = 1,
}: {
  grouping?: NestingViewerInput["talonarioGrouping"];
  copias?: number;
}) {
  if (!grouping) return null;
  const modoIncompletoLabel: Record<string, string> = {
    aprovechar_pliego: "aprovechar papel (acomodado manual)",
    pose_completa: "pose completa (desperdicio en impares)",
  };

  return (
    <div className={s.notice}>
      <span className="font-semibold">Talonario</span>
      <span>
        {grouping.talonariosEfectivos}/{grouping.talonariosPedidos} efectivos
      </span>
      <span>
        {grouping.gruposCompletos} grupo(s) + {grouping.talonariosResiduo}{" "}
        residuo
      </span>
      <span>
        {grouping.pliegosXCapa} pliegos × copia
        {copias > 1
          ? ` · ${copias} copias → ${grouping.pliegosXCapa * copias} pliegos en total`
          : ""}
      </span>
      {grouping.pilas ? <span>{grouping.pilas} pila(s)</span> : null}
      {grouping.posesDesperdicio > 0 ? (
        <span>{grouping.posesDesperdicio} poses vacías</span>
      ) : null}
      <span>
        modo:{" "}
        {modoIncompletoLabel[grouping.modoIncompleto] ??
          grouping.modoIncompleto}
      </span>
    </div>
  );
}
