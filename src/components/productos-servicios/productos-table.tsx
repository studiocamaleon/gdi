"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CopyIcon,
  Grid2X2Icon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  Table2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { duplicarProducto, listProductos } from "@/lib/productos-servicios-api";
import type { ProductoListItem } from "@/lib/productos-servicios";
import { getLabel, modoMedidasLabels, unidadComercialLabels } from "@/lib/labels-humanos";

type OrdenProductos = "recientes" | "nombre_asc" | "nombre_desc";
type VistaProductos = "tabla" | "categorias";

export interface ProductosQueryInicial {
  page: number;
  search: string;
  unidadComercial: "" | "unidad" | "m2" | "metro_lineal";
  subcategoriaCodigo: string;
  categoriaCodigo: string;
  estado: "" | "activo" | "inactivo";
  orden: OrdenProductos;
  vista: VistaProductos;
}

interface SelectOption {
  value: string;
  label: string;
}

interface CategoriaCatalogo {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  subcategorias: number;
  productos: number;
  items: SubcategoriaCatalogo[];
}

interface SubcategoriaCatalogo {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  productos: number;
}

const imagenCategoria: Record<string, string> = {
  impresion_hoja: "/catalogo/categorias/impresion-hoja.jpg",
  editorial_encuadernacion: "/catalogo/categorias/editorial-encuadernacion.jpg",
  gran_formato_flexible: "/catalogo/categorias/gran-formato-flexible.jpg",
  senalectica_rigidos: "/catalogo/categorias/senaletica-rigidos.jpg",
  packaging_pop: "/catalogo/categorias/packaging-pop.jpg",
  textil_personalizacion: "/catalogo/categorias/textil-personalizacion.jpg",
  grabado_corte_decorativo: "/catalogo/categorias/grabado-corte-decorativo.jpg",
  terminaciones_postproduccion: "/catalogo/categorias/terminaciones-postproduccion.jpg",
  carteleria_montaje: "/catalogo/categorias/carteleria-montaje.jpg",
  servicios_logistica: "/catalogo/categorias/servicios-logistica.jpg",
  sellos: "/catalogo/categorias/sellos.jpg",
};

function imagenSubcategoria(codigo: string) {
  return `/catalogo/subcategorias/${codigo.replaceAll("_", "-")}.jpg`;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;
  const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const tokenSet = new Set(tokens);
  return text.split(regex).map((part, index) =>
    part && tokenSet.has(part.toLowerCase()) ? (
      <mark key={index} className="rounded bg-primary/15 px-0.5 text-inherit">{part}</mark>
    ) : part,
  );
}

function estadoProducto(producto: ProductoListItem) {
  switch (producto.estadoCatalogo) {
    case "activo": return { label: "Activo", variant: "default" as const };
    case "incompleto": return { label: "Incompleto", variant: "destructive" as const };
    case "listo": return { label: "Listo", variant: "outline" as const };
    default: return { label: "Borrador", variant: "secondary" as const };
  }
}

function queryString(query: ProductosQueryInicial) {
  const params = new URLSearchParams();
  if (query.page > 1) params.set("page", String(query.page));
  if (query.search.trim()) params.set("search", query.search.trim());
  if (query.unidadComercial) params.set("unidad", query.unidadComercial);
  if (query.subcategoriaCodigo) params.set("categoria", query.subcategoriaCodigo);
  if (query.categoriaCodigo) params.set("categoriaGrupo", query.categoriaCodigo);
  if (query.estado) params.set("estado", query.estado);
  if (query.orden !== "recientes") params.set("orden", query.orden);
  if (query.vista === "categorias") params.set("vista", "categorias");
  return params.toString();
}

export function ProductosServiciosTable({
  initialProductos,
  initialTotal,
  initialPages,
  pageSize,
  initialQuery,
  subcategorias,
  categorias,
  canManage,
}: {
  initialProductos: ProductoListItem[];
  initialTotal: number;
  initialPages: number;
  pageSize: number;
  initialQuery: ProductosQueryInicial;
  subcategorias: SelectOption[];
  categorias: CategoriaCatalogo[];
  canManage: boolean;
}) {
  const [productos, setProductos] = React.useState(initialProductos);
  const [total, setTotal] = React.useState(initialTotal);
  const [pages, setPages] = React.useState(initialPages);
  const [query, setQuery] = React.useState(initialQuery);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [productoADuplicar, setProductoADuplicar] = React.useState<ProductoListItem | null>(null);
  const [nombreCopia, setNombreCopia] = React.useState("");
  const [duplicando, setDuplicando] = React.useState(false);
  const mounted = React.useRef(false);
  const requestId = React.useRef(0);
  const categoriaSeleccionada = categorias.find(
    (categoria) => categoria.codigo === query.categoriaCodigo,
  );

  const updateQuery = React.useCallback((patch: Partial<ProductosQueryInicial>) => {
    setQuery((current) => ({ ...current, ...patch }));
  }, []);

  React.useEffect(() => {
    const qs = queryString(query);
    window.history.replaceState(null, "", `/productos-servicios${qs ? `?${qs}` : ""}`);
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await listProductos({
          page: query.page,
          limit: pageSize,
          search: query.search,
          activo: query.estado === "activo" ? true : query.estado === "inactivo" ? false : undefined,
          unidadComercial: query.unidadComercial || undefined,
          subcategoriaCodigo: query.subcategoriaCodigo || undefined,
          categoriaCodigo: query.categoriaCodigo || undefined,
          orden: query.orden,
        });
        if (id !== requestId.current) return;
        setProductos(response.data);
        setTotal(response.total);
        setPages(response.pages);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : "No se pudo actualizar el catálogo.");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, query.search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [pageSize, query]);

  const codigoPreview = React.useMemo(() => {
    const codigo = nombreCopia.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-").toUpperCase();
    return codigo || "PRODUCTO-COPIA";
  }, [nombreCopia]);

  const duplicar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!productoADuplicar || duplicando || !nombreCopia.trim()) return;
    setDuplicando(true);
    try {
      const copia = await duplicarProducto(productoADuplicar.id, { nombre: nombreCopia.trim() });
      toast.success(`Producto "${productoADuplicar.nombre}" duplicado como borrador`);
      window.location.assign(`/productos-servicios/${copia.id}?tab=identidad`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo duplicar el producto");
      setDuplicando(false);
    }
  };

  return (
    <div className="content">
      <div className="page-head">
        <div className="title-block">
          <h1>Catálogo de productos</h1>
          <div className="sub">{total} productos encontrados.</div>
        </div>
        {canManage ? (
          <Link
            href="/productos-servicios/nuevo"
            className={buttonVariants()}
          >
            <PlusIcon data-icon="inline-start" />
            Nuevo producto
          </Link>
        ) : null}
      </div>

      <div className="toolbar flex-wrap">
        <div className="search min-w-64 flex-1">
          <SearchIcon aria-hidden="true" />
          <input value={query.search} onChange={(event) => updateQuery({ search: event.target.value, page: 1 })}
            placeholder="Buscar por nombre o código…" aria-label="Buscar productos por nombre o código" />
        </div>
        <CatalogSelect label="Cobro" value={query.unidadComercial || "all"}
          onChange={(value) => updateQuery({ unidadComercial: value === "all" ? "" : value as ProductosQueryInicial["unidadComercial"], page: 1 })}
          options={[{ value: "all", label: "Todos" }, { value: "unidad", label: "Por unidad" }, { value: "m2", label: "Por metro cuadrado" }, { value: "metro_lineal", label: "Por metro lineal" }]} />
        <CatalogSelect label="Categoría" value={query.categoriaCodigo || "all"}
          onChange={(value) => updateQuery({ categoriaCodigo: value === "all" ? "" : value, subcategoriaCodigo: "", page: 1 })}
          options={[{ value: "all", label: "Todas" }, ...categorias.map((categoria) => ({ value: categoria.codigo, label: categoria.nombre }))]} />
        <CatalogSelect label="Subcategoría" value={query.subcategoriaCodigo || "all"}
          onChange={(value) => updateQuery({ subcategoriaCodigo: value === "all" ? "" : value, categoriaCodigo: "", page: 1 })}
          options={[{ value: "all", label: "Todas" }, ...subcategorias]} />
        <CatalogSelect label="Estado" value={query.estado || "all"}
          onChange={(value) => updateQuery({ estado: value === "all" ? "" : value as ProductosQueryInicial["estado"], page: 1 })}
          options={[{ value: "all", label: "Todos" }, { value: "activo", label: "Publicados" }, { value: "inactivo", label: "Borradores" }]} />
        <CatalogSelect label="Orden" value={query.orden}
          onChange={(value) => updateQuery({ orden: value as OrdenProductos, page: 1 })}
          options={[{ value: "recientes", label: "Más recientes" }, { value: "nombre_asc", label: "Nombre A–Z" }, { value: "nombre_desc", label: "Nombre Z–A" }]} />
        <ToggleGroup
          multiple={false}
          variant="outline"
          size="sm"
          spacing={0}
          value={[query.vista]}
          onValueChange={(values) => {
            const vista = values.at(-1) as VistaProductos | undefined;
            if (vista) {
              updateQuery({
                vista,
                page: 1,
                ...(vista === "categorias"
                  ? { categoriaCodigo: "", subcategoriaCodigo: "" }
                  : {}),
              });
            }
          }}
          aria-label="Cambiar vista del catálogo"
        >
          <ToggleGroupItem value="tabla" aria-label="Vista de tabla">
            <Table2Icon />
            Tabla
          </ToggleGroupItem>
          <ToggleGroupItem value="categorias" aria-label="Vista por categorías">
            <Grid2X2Icon />
            Categorías
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>No se pudo actualizar el catálogo</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {query.vista === "categorias" ? (
        <div aria-busy={loading}>
          <div className="mb-4 flex items-end justify-between gap-4">
            {categoriaSeleccionada ? (
              <div className="flex items-start gap-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Volver a todas las categorías"
                  onClick={() => updateQuery({ categoriaCodigo: "", page: 1 })}
                >
                  <ArrowLeftIcon />
                </Button>
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-medium">{categoriaSeleccionada.nombre}</h2>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    {categoriaSeleccionada.descripcion}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-medium">Explorar por categoría</h2>
                <p className="text-sm text-muted-foreground">
                  Elegí una categoría y después la subcategoría específica.
                </p>
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              {categoriaSeleccionada
                ? `${categoriaSeleccionada.subcategorias} subcategorías`
                : `${categorias.length} categorías`}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {categoriaSeleccionada ? categoriaSeleccionada.items.map((subcategoria) => {
              const hrefQuery: ProductosQueryInicial = {
                ...query,
                page: 1,
                categoriaCodigo: "",
                subcategoriaCodigo: subcategoria.codigo,
                vista: "tabla",
              };
              const href = queryString(hrefQuery);
              return (
                <Link
                  key={subcategoria.codigo}
                  href={`/productos-servicios${href ? `?${href}` : ""}`}
                  onClick={() => setQuery(hrefQuery)}
                  className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Card className="h-full gap-0 py-0 transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
                    <Image
                      src={imagenSubcategoria(subcategoria.codigo)}
                      alt=""
                      width={960}
                      height={768}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <CardHeader className="py-4">
                      <CardTitle className="pr-7">{subcategoria.nombre}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {subcategoria.descripcion}
                      </CardDescription>
                      <CardAction className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground">
                        <ArrowRightIcon aria-hidden="true" />
                      </CardAction>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {subcategoria.productos} {subcategoria.productos === 1 ? "producto" : "productos"}
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              );
            }) : categorias.map((categoria) => {
              const hrefQuery: ProductosQueryInicial = {
                ...query,
                page: 1,
                categoriaCodigo: categoria.codigo,
                subcategoriaCodigo: "",
                vista: "categorias",
              };
              const href = queryString(hrefQuery);
              return (
                <Link
                  key={categoria.codigo}
                  href={`/productos-servicios${href ? `?${href}` : ""}`}
                  onClick={() => setQuery(hrefQuery)}
                  className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Card className="h-full gap-0 py-0 transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
                    <Image
                      src={imagenCategoria[categoria.codigo]}
                      alt=""
                      width={960}
                      height={768}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <CardHeader className="py-4">
                      <CardTitle className="pr-7">{categoria.nombre}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {categoria.descripcion}
                      </CardDescription>
                      <CardAction className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground">
                        <ArrowRightIcon aria-hidden="true" />
                      </CardAction>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{categoria.productos} {categoria.productos === 1 ? "producto" : "productos"}</span>
                        <span aria-hidden="true">·</span>
                        <span>{categoria.subcategorias} subcategorías</span>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ) : total === 0 && !query.search ? (
        <EstadoVacio titulo="Sin productos cargados"
          descripcion="Empezá creando un producto. Se guardará como borrador hasta que esté listo para publicar."
          cta={canManage ? { label: "Crear producto", href: "/productos-servicios/nuevo", icon: PlusIcon } : undefined} />
      ) : (
        <div className="card" aria-busy={loading}>
          <div className="card-head">
            <span className="title">Productos</span>
            <span className="count">{productos.length} en esta página · {total} en total{loading ? " · actualizando…" : ""}</span>
          </div>
          {productos.length === 0 ? (
            <div className="p-8"><EstadoVacio variant="compacto" titulo="No hay productos que coincidan" descripcion="Probá ajustar la búsqueda o limpiar los filtros." /></div>
          ) : (
            <Table className="tbl table-fixed">
              <TableHeader><TableRow>
                <TableHead className="w-[34%]">Nombre</TableHead>
                <TableHead className="w-[14%]">Categoría</TableHead>
                <TableHead className="w-[16%]">¿Cómo se cobra?</TableHead>
                <TableHead className="w-[19%]">Manejo de medidas</TableHead>
                <TableHead className="w-[9%]">Estado</TableHead>
                {canManage ? <TableHead className="w-[8%] text-right">Acciones</TableHead> : null}
              </TableRow></TableHeader>
              <TableBody>{productos.map((producto) => {
                const unidad = getLabel(unidadComercialLabels, producto.unidadComercial);
                const medidas = getLabel(modoMedidasLabels, producto.modoMedidas);
                const estado = estadoProducto(producto);
                return (
                  <TableRow key={producto.id}>
                    <TableCell title={producto.descripcion ?? undefined}>
                      <Link className="name hover:underline" href={`/productos-servicios/${producto.id}?tab=identidad`}>{highlightMatch(producto.nombre, query.search)}</Link>
                      {producto.tercerizado ? <Badge variant="outline" className="ml-2">Tercerizado</Badge> : null}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{producto.subcategoriaComercial?.nombre ?? "Sin categoría"}</Badge></TableCell>
                    <TableCell title={unidad.descripcion}><Badge variant="secondary">{unidad.label}</Badge></TableCell>
                    <TableCell title={medidas.descripcion}><Badge variant="outline">{medidas.label}</Badge></TableCell>
                    <TableCell><Badge variant={estado.variant}>{estado.label}</Badge></TableCell>
                    {canManage ? <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" aria-label={`Duplicar ${producto.nombre}`} title="Duplicar como borrador"
                        onClick={() => { setProductoADuplicar(producto); setNombreCopia(`${producto.nombre} copia`); }}><CopyIcon /></Button>
                    </TableCell> : null}
                  </TableRow>
                );
              })}</TableBody>
            </Table>
          )}
        </div>
      )}

      {query.vista === "tabla" ? (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Página {query.page} de {Math.max(1, pages)} · {total} productos</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={query.page <= 1 || loading} onClick={() => updateQuery({ page: Math.max(1, query.page - 1) })}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={query.page >= pages || loading} onClick={() => updateQuery({ page: query.page + 1 })}>Siguiente</Button>
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(productoADuplicar)} onOpenChange={(open) => {
        if (!open && !duplicando) { setProductoADuplicar(null); setNombreCopia(""); }
      }}>
        <DialogContent><form onSubmit={duplicar} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Duplicar producto</DialogTitle>
            <DialogDescription>La copia conservará su configuración y se guardará como borrador para revisarla antes de publicarla.</DialogDescription>
          </DialogHeader>
          <FieldGroup><Field>
            <FieldLabel htmlFor="nombre-copia-producto">Nombre de la copia</FieldLabel>
            <Input id="nombre-copia-producto" autoFocus value={nombreCopia} onChange={(event) => setNombreCopia(event.target.value)} disabled={duplicando} />
            <FieldDescription>Código sugerido: <span className="font-mono text-foreground">{codigoPreview}</span></FieldDescription>
          </Field></FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={duplicando} onClick={() => setProductoADuplicar(null)}>Cancelar</Button>
            <Button type="submit" disabled={duplicando || !nombreCopia.trim()}>
              {duplicando ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : <CopyIcon data-icon="inline-start" />}
              {duplicando ? "Duplicando…" : "Duplicar como borrador"}
            </Button>
          </DialogFooter>
        </form></DialogContent>
      </Dialog>
    </div>
  );
}

function CatalogSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <Select items={options} value={value} onValueChange={(next) => next && onChange(next)}>
      <SelectTrigger size="sm" aria-label={label} className="min-w-36">
        <span className="text-muted-foreground">{label}:</span><SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}><SelectGroup>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectGroup></SelectContent>
    </Select>
  );
}
