"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BanknoteIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  FactoryIcon,
  FolderIcon,
  GridIcon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  type TipoPropuesta,
  type PropuestaItem,
  MOCK_CLIENTES,
  MOCK_VENDEDOR,
  CANALES_VENTA,
  MOCK_ITEMS,
  calcularResumen,
  formatCurrency,
  offsetDate,
} from "@/lib/propuestas";
import { AgregarProductoSheet } from "@/components/comercial/agregar-producto-sheet";
import { ImposicionPreviewDialog } from "@/components/comercial/imposicion-preview-dialog";
import { Badge } from "@/components/ui/badge";
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
}: {
  item: PropuestaItem;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [imposicionOpen, setImposicionOpen] = React.useState(false);
  const isDigital = item.motorCodigo === "impresion_digital_laser";

  return (
    <>
      <TableRow
        className="cursor-pointer transition-colors hover:bg-muted/50"
        onClick={onToggle}
      >
        <TableCell className="w-10 pl-4 font-medium text-muted-foreground">
          {index + 1}
        </TableCell>
        <TableCell className="font-medium">
          <div className="flex flex-col">
            <span>{item.productoNombre}</span>
            <span className="text-xs text-muted-foreground">
              {item.productoCodigo}
            </span>
          </div>
        </TableCell>
        <TableCell>{item.unidadMedida}</TableCell>
        <TableCell className="text-right tabular-nums">
          {item.cantidad.toLocaleString("es-AR")}
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
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={8} className="px-6 py-4">
            <div className="flex items-start gap-6">
              {/* Especificaciones */}
              <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
                {Object.entries(item.especificaciones).map(([key, val]) => (
                  <div key={key} className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      {key}
                    </span>
                    <span className="font-medium">{val}</span>
                  </div>
                ))}
              </div>

              {/* Imposicion button */}
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
            </div>
          </TableCell>
        </TableRow>
      )}

      {/* Imposicion preview dialog */}
      {isDigital && imposicionOpen && (
        <ImposicionPreviewDialog
          open={imposicionOpen}
          onOpenChange={setImposicionOpen}
          productoId={item.productoId}
          varianteId={item.varianteId}
          varianteNombre={item.varianteNombre}
          anchoMm={item.anchoMm}
          altoMm={item.altoMm}
        />
      )}
    </>
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

export function PropuestaFicha() {
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
    () => MOCK_CLIENTES.map((c) => ({ value: c.id, label: c.nombre })),
    [],
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
                        <TableHead>U. Medida</TableHead>
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
          {items.length === 0 || items.every((i) => !i.cotizacion) ? (
            <TabPlaceholder icon={FactoryIcon} title="Produccion" />
          ) : (
            <div className="flex flex-col gap-4">
              {items
                .filter((i) => i.cotizacion)
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
                          {item.varianteNombre} &middot;{" "}
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
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10 pl-4">#</TableHead>
                            <TableHead>Paso</TableHead>
                            <TableHead>Area</TableHead>
                            <TableHead className="text-right pr-4">
                              Tiempo est.
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {item.cotizacion!.bloques.procesos.map(
                            (paso, idx) => (
                              <TableRow key={`${paso.codigo}-${idx}`}>
                                <TableCell className="w-10 pl-4 text-muted-foreground">
                                  {idx + 1}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">
                                      {paso.nombre}
                                    </span>
                                    {(() => {
                                      const o = String(paso.origen ?? "")
                                        .trim()
                                        .toLowerCase();
                                      return (
                                        o !== "" &&
                                        o !== "base" &&
                                        o !== "producto base" &&
                                        !o.startsWith("base") &&
                                        !o.startsWith("producto base")
                                      );
                                    })() && (
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
                                  {paso.centroCostoNombre}
                                </TableCell>
                                <TableCell className="text-right tabular-nums pr-4">
                                  {paso.totalMin > 0
                                    ? `${paso.totalMin.toFixed(1)} min`
                                    : "—"}
                                </TableCell>
                              </TableRow>
                            ),
                          )}
                        </TableBody>
                      </Table>
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
