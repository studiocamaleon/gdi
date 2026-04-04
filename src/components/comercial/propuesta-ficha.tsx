"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BanknoteIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  CoinsIcon,
  FactoryIcon,
  FolderIcon,
  GridIcon,
  PackageIcon,
  PlusCircleIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Cell, Pie, PieChart } from "recharts";

import type { ClienteDetalle } from "@/lib/clientes";
import { simularPrecioComercial } from "@/lib/productos-servicios-simulacion";
import {
  type TipoPropuesta,
  type PropuestaItem,
  MOCK_VENDEDOR,
  CANALES_VENTA,
  MOCK_ITEMS,
  calcularResumen,
  formatCurrency,
  offsetDate,
} from "@/lib/propuestas";
import { AgregarProductoSheet } from "@/components/comercial/agregar-producto-sheet";
import { CostosProductoDialog } from "@/components/comercial/costos-producto-dialog";
import { ImposicionPreviewDialog } from "@/components/comercial/imposicion-preview-dialog";
import { GranFormatoNestingDialog } from "@/components/comercial/gran-formato-nesting-dialog";
import { VinylCutNestingDialog } from "@/components/comercial/vinyl-cut-nesting-dialog";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ---------------------------------------------------------------------------
// Segmented toggle for proposal type
// ---------------------------------------------------------------------------

function TipoToggle({
  value,
  onChange,
}: {
  value: TipoPropuesta;
  onChange: (v: TipoPropuesta) => void;
}) {
  const options: { key: TipoPropuesta; label: string }[] = [
    { key: "orden_trabajo", label: "Orden de trabajo" },
    { key: "presupuesto", label: "Presupuesto" },
  ];

  return (
    <div className="inline-flex items-center rounded-lg border border-input bg-muted p-0.5">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            value === opt.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Highlight matching text
// ---------------------------------------------------------------------------

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <span>{text}</span>;

  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <span>{text}</span>;

  return (
    <span>
      {text.slice(0, idx)}
      <span className="font-semibold text-foreground">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Searchable select (combobox)
// ---------------------------------------------------------------------------

function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Buscar...",
}: {
  id?: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 0 });

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  // Position the dropdown relative to the trigger
  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 220),
    });
  }, []);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      )
        return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Reposition on scroll / resize while open
  React.useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setSearch("");
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
      >
        <span
          className={
            value
              ? "truncate text-left"
              : "truncate text-left text-muted-foreground"
          }
        >
          {value ? selectedLabel : placeholder}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-50 overflow-hidden rounded-lg bg-popover shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 duration-100"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
            }}
          >
            <div className="flex items-center gap-2 border-b px-2.5 py-2">
              <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="h-auto w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter" && filtered.length === 1) {
                    onChange(filtered[0].value);
                    setOpen(false);
                  }
                }}
              />
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                  Sin resultados
                </p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <CheckIcon
                      className={`size-3.5 shrink-0 ${
                        value === opt.value
                          ? "text-foreground"
                          : "text-transparent"
                      }`}
                    />
                    <HighlightMatch text={opt.label} query={search} />
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Expandable item row
// ---------------------------------------------------------------------------

function ItemRow({
  item,
  index,
  isExpanded,
  onToggle,
  isOrdenTrabajo,
  fechaEstimada,
  onFechaEntregaChange,
}: {
  item: PropuestaItem;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  isOrdenTrabajo: boolean;
  fechaEstimada: string;
  onFechaEntregaChange: (fecha: string | undefined) => void;
}) {
  const [imposicionOpen, setImposicionOpen] = React.useState(false);
  const [nestingOpen, setNestingOpen] = React.useState(false);
  const [vinylNestingOpen, setVinylNestingOpen] = React.useState(false);
  const [costosOpen, setCostosOpen] = React.useState(false);
  const [fechaPopoverOpen, setFechaPopoverOpen] = React.useState(false);
  const fechaBtnRef = React.useRef<HTMLButtonElement>(null);
  const isDigital = item.motorCodigo === "impresion_digital_laser" || item.motorCodigo === "talonario";
  const isGranFormato = item.motorCodigo === "gran_formato";
  const isViniloCut = item.motorCodigo === "vinilo_de_corte";
  const hasVinylNesting = isViniloCut && !!(item.viniloCut?.costosResponse?.colorResults);
  const hasCostData = !!(item.cotizacion || item.granFormato?.costosResponse || item.viniloCut?.costosResponse);
  const gfMedidas = item.granFormato?.medidas;
  const hasNesting = isGranFormato && !!item.granFormato?.costosResponse?.nestingPreview;

  // Extract adicionales (non-base steps from cotización + terminaciones configuradas)
  const adicionales = React.useMemo(() => {
    const vcAgg = item.viniloCut?.costosResponse?.aggregated as Record<string, unknown> | undefined;
    const pasos = item.cotizacion?.bloques.procesos
      ?? item.granFormato?.costosResponse?.centrosCosto
      ?? (vcAgg?.centrosCosto as Array<Record<string, unknown>> | undefined)
      ?? [];
    const fromPasos = pasos
      .filter((p) => {
        const o = String((p as Record<string, unknown>).origen ?? "").trim().toLowerCase();
        return o !== "" && !o.startsWith("base") && !o.startsWith("producto base");
      })
      .map((p) => {
        const obj = p as Record<string, unknown>;
        return String(obj.nombre ?? obj.paso ?? "");
      })
      .filter((name) => name.length > 0);
    // Terminaciones configuradas (from checklist CONFIGURAR_TERMINACION)
    const traz = item.cotizacion?.trazabilidad as Record<string, unknown> | undefined;
    const terminaciones = Array.isArray(traz?.terminacionesConfiguradas)
      ? (traz.terminacionesConfiguradas as Array<Record<string, unknown>>)
      : [];
    const TERMINACION_LABELS: Record<string, string> = {
      perforacion: "Perforación",
      puntas_redondeadas: "Puntas redondeadas",
    };
    const fromTerminaciones = terminaciones
      .map((t) => TERMINACION_LABELS[String(t.tipoTerminacion ?? "")] ?? "")
      .filter((name) => name.length > 0);
    return [...fromPasos, ...fromTerminaciones];
  }, [item.cotizacion, item.granFormato]);
  const hasAdicionales = adicionales.length > 0;

  return (
    <>
      <TableRow
        className={`cursor-pointer transition-colors hover:bg-muted/50 ${
          isExpanded
            ? "bg-primary/5 border-l-2 border-l-primary"
            : ""
        }`}
        onClick={onToggle}
      >
        <TableCell className="w-10 pl-4 font-medium text-muted-foreground">
          {index + 1}
        </TableCell>
        <TableCell className="font-medium">
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5">
              {item.productoNombre}
              {hasAdicionales && !isExpanded && (
                <span title={`${adicionales.length} adicional${adicionales.length > 1 ? "es" : ""} incluido${adicionales.length > 1 ? "s" : ""}`}>
                  <PlusCircleIcon className="size-3.5 text-primary/70" />
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {item.productoCodigo}
            </span>
          </div>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {item.cantidad.toLocaleString("es-AR")}{" "}
          <span className="text-muted-foreground">
            {item.unidadMedida === "unidad"
              ? item.cantidad === 1 ? "un." : "un."
              : item.unidadMedida}
          </span>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatCurrency(item.subtotal)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {item.impuestoPorcentaje}%
        </TableCell>
        <TableCell className="text-right tabular-nums font-medium">
          {formatCurrency(item.total)}
        </TableCell>
        <TableCell className="w-10 pr-4">
          {isExpanded ? (
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          )}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="border-l-2 border-l-primary bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={7} className="px-6 py-4">
            <div className="flex items-start justify-between gap-8">
              {/* Especificaciones */}
              <div className="flex min-w-0 text-sm">
                {(() => {
                  const specs = Object.entries(item.especificaciones)
                    .filter(([key]) => !(isGranFormato && key === "Medidas"));
                  const hasGfMedidas = isGranFormato && gfMedidas && gfMedidas.length > 0;
                  return (
                    <>
                      {specs.map(([key, val], i) => (
                        <div
                          key={key}
                          className={`flex min-w-[120px] flex-col gap-0.5 px-4 ${i > 0 ? "border-l border-border/40" : "pl-0"}`}
                        >
                          <span className="text-xs text-muted-foreground">{key}</span>
                          <span className="font-medium">{val}</span>
                        </div>
                      ))}
                      {hasGfMedidas && (
                        <div className={`flex min-w-[140px] flex-col gap-0.5 px-4 ${specs.length > 0 ? "border-l border-border/40" : "pl-0"}`}>
                          <span className="text-xs text-muted-foreground">Medidas</span>
                          {gfMedidas!.map((m, i) => (
                            <span key={i} className="font-medium tabular-nums">
                              {m.anchoMm / 10} × {m.altoMm / 10} cm{" "}
                              <span className="text-muted-foreground">×{m.cantidad}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {isViniloCut && item.viniloCut?.colores.map((color, ci) => (
                        <div
                          key={color.id}
                          className={`flex min-w-[140px] flex-col gap-0.5 px-4 ${ci > 0 || specs.length > 0 ? "border-l border-border/40" : "pl-0"}`}
                        >
                          <span className="text-xs text-muted-foreground">{color.colorFiltro || color.label}</span>
                          {color.medidas.map((m, j) => (
                            <span key={j} className="font-medium tabular-nums">
                              {m.anchoMm / 10} × {m.altoMm / 10} cm{" "}
                              <span className="text-muted-foreground">×{m.cantidad}</span>
                            </span>
                          ))}
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>

              {/* Action buttons */}
              <div className="flex shrink-0 items-center gap-2">
              {hasCostData && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCostosOpen(true);
                  }}
                >
                  <CoinsIcon />
                  Costos
                </Button>
              )}
              {isDigital && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImposicionOpen(true);
                  }}
                >
                  <GridIcon />
                  Imposicion
                </Button>
              )}
              {hasNesting && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNestingOpen(true);
                  }}
                >
                  <GridIcon />
                  Imposicion
                </Button>
              )}
              {hasVinylNesting && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setVinylNestingOpen(true);
                  }}
                >
                  <GridIcon />
                  Imposicion
                </Button>
              )}
              {/* Fecha de entrega individual */}
              {isOrdenTrabajo && (
                <div className="relative shrink-0">
                  <Button
                    ref={fechaBtnRef}
                    variant="outline"
                    size="sm"
                    className={item.fechaEntrega ? "border-primary text-primary" : ""}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFechaPopoverOpen((prev) => !prev);
                    }}
                  >
                    <CalendarIcon />
                    {item.fechaEntrega
                      ? new Date(item.fechaEntrega + "T12:00:00").toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                        })
                      : new Date(fechaEstimada + "T12:00:00").toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                        })}
                  </Button>
                  {fechaPopoverOpen &&
                    createPortal(
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setFechaPopoverOpen(false)}
                        />
                        <div
                          className="fixed z-50 rounded-lg border bg-popover p-3 shadow-md"
                          style={{
                            top: (fechaBtnRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                            right: window.innerWidth - (fechaBtnRef.current?.getBoundingClientRect().right ?? 0),
                          }}
                        >
                          <div className="flex flex-col gap-2">
                            <label className="text-xs font-medium text-muted-foreground">
                              Fecha de entrega
                            </label>
                            <Input
                              type="date"
                              value={item.fechaEntrega ?? fechaEstimada}
                              onChange={(e) => {
                                onFechaEntregaChange(e.target.value || undefined);
                              }}
                              onClick={(e) =>
                                (e.currentTarget as HTMLInputElement).showPicker?.()
                              }
                              className="w-[160px] cursor-pointer"
                            />
                            {item.fechaEntrega && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="justify-start text-xs text-muted-foreground"
                                onClick={() => {
                                  onFechaEntregaChange(undefined);
                                  setFechaPopoverOpen(false);
                                }}
                              >
                                <XIcon />
                                Usar fecha de la orden
                              </Button>
                            )}
                            {!item.fechaEntrega && (
                              <p className="text-xs text-muted-foreground">
                                Hereda fecha de la orden
                              </p>
                            )}
                          </div>
                        </div>
                      </>,
                      document.body,
                    )}
                </div>
              )}
              </div>
            </div>

            {/* Adicionales incluidos */}
            {hasAdicionales && (
              <div className="mt-3 flex items-start gap-2 border-t border-border/50 pt-3">
                <PlusCircleIcon className="mt-0.5 size-3.5 shrink-0 text-primary/70" />
                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    Adicionales incluidos
                  </span>
                  {adicionales.map((nombre, i) => (
                    <span key={i} className="font-medium">{nombre}</span>
                  ))}
                </div>
              </div>
            )}
          </TableCell>
        </TableRow>
      )}

      {/* Imposicion preview dialog — Digital */}
      {isDigital && imposicionOpen && item.varianteId && item.anchoMm && item.altoMm && (
        <ImposicionPreviewDialog
          open={imposicionOpen}
          onOpenChange={setImposicionOpen}
          productoId={item.productoId}
          varianteId={item.varianteId}
          varianteNombre={item.varianteNombre ?? ""}
          anchoMm={item.anchoMm}
          altoMm={item.altoMm}
          terminacionesConfiguradas={
            (item.cotizacion?.trazabilidad as Record<string, unknown> | undefined)
              ?.terminacionesConfiguradas as Array<Record<string, unknown>> | undefined
          }
        />
      )}

      {/* Nesting preview dialog — Gran Formato (always mounted to avoid 3D re-init glitch) */}
      {hasNesting && (
        <GranFormatoNestingDialog
          open={nestingOpen}
          onOpenChange={setNestingOpen}
          productoNombre={item.productoNombre}
          costosResponse={item.granFormato!.costosResponse}
        />
      )}

      {/* Vinyl cut nesting dialog */}
      {hasVinylNesting && vinylNestingOpen && (
        <VinylCutNestingDialog
          open={vinylNestingOpen}
          onOpenChange={setVinylNestingOpen}
          productoNombre={item.productoNombre}
          costosResponse={item.viniloCut!.costosResponse}
        />
      )}

      {/* Costos dialog */}
      {hasCostData && costosOpen && (
        <CostosProductoDialog
          open={costosOpen}
          onOpenChange={setCostosOpen}
          item={item}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Costos orden tab
// ---------------------------------------------------------------------------

const COSTOS_PIE_CONFIG: ChartConfig = { value: { label: "Valor" } };

const COMPOSICION_COLORS = [
  "hsl(220 70% 55%)", // costo
  "hsl(35 80% 55%)",  // impuestos
  "hsl(280 55% 55%)", // comisiones
  "hsl(160 60% 45%)", // margen
];

const DISTRIBUCION_COLORS = [
  "hsl(220 70% 55%)", // procesos
  "hsl(40 90% 55%)",  // materiales
];

function CostosOrdenTab({ items }: { items: PropuestaItem[] }) {
  const itemsConCosto = items.filter(
    (i) => i.cotizacion || i.granFormato?.costosResponse || i.viniloCut?.costosResponse,
  );

  const filas = React.useMemo(() => {
    return itemsConCosto.map((item) => {
      const isDigital = item.motorCodigo === "impresion_digital_laser" || item.motorCodigo === "talonario";
      const isGf = item.motorCodigo === "gran_formato";
      const isVc = item.motorCodigo === "vinilo_de_corte";
      const vcAggItem = item.viniloCut?.costosResponse?.aggregated as Record<string, unknown> | undefined;
      const costoTotal = isDigital
        ? item.cotizacion?.total ?? 0
        : isGf
          ? item.granFormato?.costosResponse?.totales.tecnico ?? 0
          : isVc
            ? Number(vcAggItem?.totalTecnico ?? 0)
            : 0;
      const sim = item.precioConfig
        ? simularPrecioComercial({ precio: item.precioConfig, costoTotal, cantidad: item.cantidad })
        : null;
      const precioFinal = sim?.precioFinal ?? item.total;
      const impuestos = sim?.impuestosMonto ?? item.impuestoMonto;
      const comisiones = sim?.comisionesMonto ?? 0;
      const margen = sim?.margenRealMonto ?? (item.subtotal - impuestos - costoTotal);
      const margenPct = sim?.margenRealPct ?? (precioFinal > 0 ? (margen / precioFinal) * 100 : 0);

      // Para distribucion del costo
      const costoProcesos = isDigital
        ? item.cotizacion?.subtotales.procesos ?? 0
        : isGf
          ? item.granFormato?.costosResponse?.totales.centrosCosto ?? 0
          : isVc
            ? Number(vcAggItem?.totalCentrosCosto ?? 0)
            : 0;
      const costoMateriales = costoTotal - costoProcesos;

      return {
        item,
        costoTotal,
        precioFinal,
        impuestos,
        comisiones,
        margen,
        margenPct,
        costoProcesos,
        costoMateriales,
      };
    });
  }, [itemsConCosto]);

  const totales = React.useMemo(() => {
    const costo = filas.reduce((s, f) => s + f.costoTotal, 0);
    const precio = filas.reduce((s, f) => s + f.precioFinal, 0);
    const imp = filas.reduce((s, f) => s + f.impuestos, 0);
    const com = filas.reduce((s, f) => s + f.comisiones, 0);
    const margen = filas.reduce((s, f) => s + f.margen, 0);
    const margenPct = precio > 0 ? (margen / precio) * 100 : 0;
    const procesos = filas.reduce((s, f) => s + f.costoProcesos, 0);
    const materiales = filas.reduce((s, f) => s + f.costoMateriales, 0);
    return { costo, precio, imp, com, margen, margenPct, procesos, materiales };
  }, [filas]);

  if (itemsConCosto.length === 0) {
    return (
      <Empty className="border py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CoinsIcon />
          </EmptyMedia>
          <EmptyTitle>Sin datos de costos</EmptyTitle>
          <EmptyDescription>
            Agrega productos con cotizacion para ver el desglose de costos de la
            orden.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const composicionSlices = [
    ...(totales.costo > 0 ? [{ name: "Costo", value: totales.costo }] : []),
    ...(totales.imp > 0 ? [{ name: "Impuestos", value: totales.imp }] : []),
    ...(totales.com > 0 ? [{ name: "Comisiones", value: totales.com }] : []),
    ...(totales.margen > 0 ? [{ name: "Margen", value: totales.margen }] : []),
  ];

  const distribucionSlices = [
    ...(totales.procesos > 0 ? [{ name: "Procesos", value: totales.procesos }] : []),
    ...(totales.materiales > 0 ? [{ name: "Materiales", value: totales.materiales }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Resumen global */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <CostoMetricCard label="Costo total" value={formatCurrency(totales.costo)} />
        <CostoMetricCard label="Precio total" value={formatCurrency(totales.precio)} />
        <CostoMetricCard
          label="Margen neto"
          value={formatCurrency(totales.margen)}
          subtitle={`${totales.margenPct.toFixed(1)}%`}
          accent={totales.margen >= 0 ? "positive" : "negative"}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <CostoMetricCard
          label="Impuestos"
          value={formatCurrency(totales.imp)}
        />
        <CostoMetricCard
          label="Comisiones"
          value={formatCurrency(totales.com)}
        />
        <CostoMetricCard
          label="Cargos totales"
          value={formatCurrency(totales.imp + totales.com)}
        />
      </div>

      {/* Graficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {composicionSlices.length > 0 && (
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Composicion del precio
              </p>
              <ChartContainer config={COSTOS_PIE_CONFIG} className="mx-auto aspect-square max-h-[200px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
                  <Pie data={composicionSlices} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {composicionSlices.map((_, i) => (
                      <Cell key={i} fill={COMPOSICION_COLORS[i % COMPOSICION_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {composicionSlices.map((s, i) => (
                  <span key={s.name} className="flex items-center gap-1.5 text-xs">
                    <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: COMPOSICION_COLORS[i % COMPOSICION_COLORS.length] }} />
                    {s.name} {formatCurrency(s.value)}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {distribucionSlices.length > 0 && (
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Distribucion del costo
              </p>
              <ChartContainer config={COSTOS_PIE_CONFIG} className="mx-auto aspect-square max-h-[200px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
                  <Pie data={distribucionSlices} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {distribucionSlices.map((_, i) => (
                      <Cell key={i} fill={DISTRIBUCION_COLORS[i % DISTRIBUCION_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {distribucionSlices.map((s, i) => (
                  <span key={s.name} className="flex items-center gap-1.5 text-xs">
                    <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: DISTRIBUCION_COLORS[i % DISTRIBUCION_COLORS.length] }} />
                    {s.name} {formatCurrency(s.value)}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabla por producto */}
      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="w-24 text-right">Costo</TableHead>
                  <TableHead className="w-24 text-right">Precio</TableHead>
                  <TableHead className="w-24 text-right">Impuestos</TableHead>
                  <TableHead className="w-24 text-right">Comisiones</TableHead>
                  <TableHead className="w-24 text-right">Margen</TableHead>
                  <TableHead className="w-20 text-right">Margen %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => (
                  <TableRow key={f.item.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{f.item.productoNombre}</span>
                        <span className="text-xs text-muted-foreground">
                          {f.item.cantidad.toLocaleString("es-AR")}{" "}
                          {f.item.unidadMedida === "unidad" ? "un." : f.item.unidadMedida}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(f.costoTotal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(f.precioFinal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(f.impuestos)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(f.comisiones)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${f.margen >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatCurrency(f.margen)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${f.margenPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {f.margenPct.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-medium">
                  <TableCell>Total ({filas.length} productos)</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totales.costo)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totales.precio)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totales.imp)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totales.com)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${totales.margen >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(totales.margen)}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${totales.margenPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {totales.margenPct.toFixed(1)}%
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CostoMetricCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string;
  subtitle?: string;
  accent?: "positive" | "negative";
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="px-4 py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`text-lg font-semibold tabular-nums ${
            accent === "positive"
              ? "text-emerald-600"
              : accent === "negative"
                ? "text-red-600"
                : ""
          }`}
        >
          {value}
        </p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Placeholder tab content
// ---------------------------------------------------------------------------

function TabPlaceholder({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <Empty className="border py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>
          Esta seccion estara disponible proximamente.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PropuestaFicha({
  initialClientes,
}: {
  initialClientes: ClienteDetalle[];
}) {
  const [tipo, setTipo] = React.useState<TipoPropuesta>("orden_trabajo");
  const [clienteId, setClienteId] = React.useState("");
  const [canalVenta, setCanalVenta] = React.useState("");
  const [fechaEstimada, setFechaEstimada] = React.useState(offsetDate(7));
  const [items, setItems] = React.useState<PropuestaItem[]>(MOCK_ITEMS);
  const [expandedItemId, setExpandedItemId] = React.useState<string | null>(
    null,
  );
  const [activeTab, setActiveTab] = React.useState("productos");
  const [sheetOpen, setSheetOpen] = React.useState(false);

  function handleAddItem(item: PropuestaItem) {
    setItems((prev) => [...prev, item]);
    setSheetOpen(false);
    toast.success(`${item.productoNombre} agregado a la propuesta.`);
  }

  const resumen = React.useMemo(() => calcularResumen(items), [items]);

  const clienteItems = React.useMemo(
    () =>
      [...initialClientes]
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((c) => ({ value: c.id, label: c.nombre })),
    [initialClientes],
  );

  const canalItems = React.useMemo(
    () => CANALES_VENTA.map((c) => ({ value: c.value, label: c.label })),
    [],
  );

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Back button */}
      <Button
        variant="sidebar"
        size="sm"
        className="w-fit"
        render={<Link href="/" />}
      >
        <ArrowLeftIcon />
        Volver
      </Button>

      {/* Title + tipo toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {tipo === "orden_trabajo"
              ? "Nueva orden de trabajo"
              : "Nuevo presupuesto"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tipo === "orden_trabajo"
              ? "Crea una orden de trabajo con los productos y servicios requeridos."
              : "Genera un presupuesto para enviar al cliente."}
          </p>
        </div>
        <TipoToggle value={tipo} onChange={setTipo} />
      </div>

      {/* Header fields */}
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Cliente */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="propuesta-cliente"
              className="text-xs font-medium text-muted-foreground"
            >
              Cliente
            </label>
            <SearchableSelect
              id="propuesta-cliente"
              options={clienteItems}
              value={clienteId}
              onChange={setClienteId}
              placeholder="Seleccionar cliente"
            />
          </div>

          {/* Vendedor */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="propuesta-vendedor"
              className="text-xs font-medium text-muted-foreground"
            >
              Vendedor
            </label>
            <Input
              id="propuesta-vendedor"
              value={MOCK_VENDEDOR.nombreCompleto}
              disabled
              className="w-full"
            />
          </div>

          {/* Canal de venta */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="propuesta-canal"
              className="text-xs font-medium text-muted-foreground"
            >
              Canal de venta
            </label>
            <Select
              items={canalItems}
              value={canalVenta}
              onValueChange={(v) => v && setCanalVenta(v)}
            >
              <SelectTrigger id="propuesta-canal" className="w-full">
                <SelectValue placeholder="Seleccionar canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {canalItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Fecha estimada */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="propuesta-fecha"
              className="text-xs font-medium text-muted-foreground"
            >
              Fecha estimada
            </label>
            <Input
              id="propuesta-fecha"
              type="date"
              value={fechaEstimada}
              onChange={(e) => setFechaEstimada(e.target.value)}
              onClick={(e) =>
                (e.currentTarget as HTMLInputElement).showPicker?.()
              }
              className="w-full cursor-pointer"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs + products */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList variant="line">
            <TabsTrigger value="productos">
              <PackageIcon />
              Productos
            </TabsTrigger>
            <TabsTrigger value="produccion">
              <FactoryIcon />
              Produccion
            </TabsTrigger>
            <TabsTrigger value="pagos">
              <BanknoteIcon />
              Pagos
            </TabsTrigger>
            <TabsTrigger value="archivos">
              <FolderIcon />
              Archivos
            </TabsTrigger>
            <TabsTrigger value="costos">
              <CoinsIcon />
              Costos
            </TabsTrigger>
          </TabsList>

          <Button
            variant="default"
            size="sm"
            onClick={() => setSheetOpen(true)}
          >
            <PlusIcon />
            Agregar producto
          </Button>
        </div>

        {/* Productos tab */}
        <TabsContent value="productos">
          {items.length === 0 ? (
            <Empty className="border py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardListIcon />
                </EmptyMedia>
                <EmptyTitle>Sin productos</EmptyTitle>
                <EmptyDescription>
                  Agrega productos del catalogo para comenzar a armar la
                  propuesta.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 pl-4">#</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-right">Imp.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-10 pr-4" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          index={idx}
                          isExpanded={expandedItemId === item.id}
                          onToggle={() =>
                            setExpandedItemId((prev) =>
                              prev === item.id ? null : item.id,
                            )
                          }
                          isOrdenTrabajo={tipo === "orden_trabajo"}
                          fechaEstimada={fechaEstimada}
                          onFechaEntregaChange={(fecha) =>
                            setItems((prev) =>
                              prev.map((i) =>
                                i.id === item.id
                                  ? { ...i, fechaEntrega: fecha }
                                  : i,
                              ),
                            )
                          }
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Produccion tab */}
        <TabsContent value="produccion">
          {items.length === 0 || items.every((i) => !i.cotizacion && !i.granFormato?.costosResponse && !i.viniloCut?.costosResponse) ? (
            <TabPlaceholder icon={FactoryIcon} title="Produccion" />
          ) : (
            <div className="flex flex-col gap-4">
              {items
                .filter((i) => i.cotizacion || i.granFormato?.costosResponse)
                .map((item) => (
                  <Card
                    key={item.id}
                    className="overflow-hidden rounded-2xl border-border/70 shadow-sm"
                  >
                    <CardHeader className="border-b border-border/70">
                      <div>
                        <CardTitle className="text-sm">
                          {item.productoNombre}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {item.varianteNombre
                            ? `${item.varianteNombre} · `
                            : ""}
                          {item.cantidad.toLocaleString("es-AR")}{" "}
                          {item.unidadMedida === "unidad"
                            ? "u."
                            : item.unidadMedida}
                          {item.cotizacion &&
                            ` · ${item.cotizacion.pliegos} pliego${item.cotizacion.pliegos !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {(() => {
                        // Normalize production steps from any motor
                        const vcAggProd = item.viniloCut?.costosResponse?.aggregated as Record<string, unknown> | undefined;
                        const vcCentros = (vcAggProd?.centrosCosto ?? []) as Array<Record<string, unknown>>;
                        const pasos = item.cotizacion
                          ? item.cotizacion.bloques.procesos.map((p) => ({
                              key: `${p.codigo}-${p.orden}`,
                              nombre: p.nombre,
                              area: p.centroCostoNombre,
                              minutos: p.totalMin,
                              origen: p.origen,
                            }))
                          : item.granFormato?.costosResponse?.centrosCosto?.map(
                              (c, idx) => ({
                                key: `${c.centroCostoId ?? idx}`,
                                nombre: c.paso,
                                area: c.centroCostoNombre,
                                minutos: c.minutos,
                                origen: c.origen,
                              }),
                            )
                          ?? vcCentros.map(
                              (c, idx) => ({
                                key: `${c.centroCostoId ?? idx}`,
                                nombre: String(c.paso ?? c.nombre ?? ""),
                                area: String(c.centroCostoNombre ?? ""),
                                minutos: Number(c.minutos ?? 0),
                                origen: String(c.origen ?? ""),
                              }),
                            );

                        return (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10 pl-4">#</TableHead>
                                <TableHead className="w-[40%]">Paso</TableHead>
                                <TableHead className="w-[30%]">Centro de costos</TableHead>
                                <TableHead className="w-28 pr-4 text-right">
                                  Tiempo est.
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pasos.map((paso, idx) => {
                                const o = String(paso.origen ?? "")
                                  .trim()
                                  .toLowerCase();
                                const esOpcional =
                                  o !== "" &&
                                  !o.startsWith("base") &&
                                  !o.startsWith("producto base");
                                return (
                                  <TableRow key={paso.key}>
                                    <TableCell className="w-10 pl-4 text-muted-foreground">
                                      {idx + 1}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">
                                          {paso.nombre}
                                        </span>
                                        {esOpcional && (
                                          <Badge
                                            variant="secondary"
                                            className="px-1.5 py-0 text-[10px]"
                                          >
                                            Opcional
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {paso.area}
                                    </TableCell>
                                    <TableCell className="pr-4 text-right tabular-nums">
                                      {paso.minutos > 0
                                        ? `${paso.minutos.toFixed(1)} min`
                                        : "—"}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        );
                      })()}
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="pagos">
          <TabPlaceholder icon={BanknoteIcon} title="Pagos" />
        </TabsContent>
        <TabsContent value="archivos">
          <TabPlaceholder icon={FolderIcon} title="Archivos" />
        </TabsContent>
        <TabsContent value="costos">
          <CostosOrdenTab items={items} />
        </TabsContent>
      </Tabs>

      {/* Resumen financiero */}
      <Card className="rounded-2xl border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Resumen financiero</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="ml-auto flex w-full max-w-xs flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">
                {formatCurrency(resumen.subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Impuestos</span>
              <span className="tabular-nums">
                {formatCurrency(resumen.impuestos)}
              </span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {formatCurrency(resumen.total)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {resumen.cantidadItems}{" "}
              {resumen.cantidadItems === 1 ? "producto" : "productos"} en esta
              propuesta
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sheet para agregar producto */}
      <AgregarProductoSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onAddItem={handleAddItem}
      />
    </section>
  );
}
