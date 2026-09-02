"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BadgeCheckIcon,
  BoxesIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CopyIcon,
  Grid2X2Icon,
  Loader2Icon,
  PackageCheckIcon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
  ShapesIcon,
  Table2Icon,
  TagsIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { duplicarProducto, listProductos } from "@/lib/productos-servicios-api";
import type { ProductoListItem } from "@/lib/productos-servicios";
import {
  getLabel,
  modoMedidasLabels,
  unidadComercialLabels,
} from "@/lib/labels-humanos";

import styles from "./productos-table.module.css";

type OrdenProductos = "recientes" | "nombre_asc" | "nombre_desc";
type VistaProductos = "tabla" | "categorias";
type ComposicionProductos = "" | "simple" | "compuesto";

export interface ProductosQueryInicial {
  page: number;
  search: string;
  unidadComercial: "" | "unidad" | "m2" | "metro_lineal";
  subcategoriaCodigo: string;
  categoriaCodigo: string;
  estado: "" | "activo" | "inactivo";
  orden: OrdenProductos;
  vista: VistaProductos;
  composicion: ComposicionProductos;
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
  terminaciones_postproduccion:
    "/catalogo/categorias/terminaciones-postproduccion.jpg",
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
  const escaped = tokens.map((token) =>
    token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const tokenSet = new Set(tokens);
  return text.split(regex).map((part, index) =>
    part && tokenSet.has(part.toLowerCase()) ? (
      <mark key={index} className="rounded bg-primary/15 px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function estadoProducto(producto: ProductoListItem) {
  switch (producto.estadoCatalogo) {
    case "activo":
      return {
        label: "Activo",
        description: "Publicado y disponible para cotizar.",
      };
    case "incompleto":
      return {
        label: "Incompleto",
        description: "Falta completar su configuración antes de publicarlo.",
      };
    case "listo":
      return {
        label: "Listo para publicar",
        description: "La configuración está completa, pero aún no fue publicada.",
      };
    default:
      return {
        label: "Borrador",
        description: "Todavía está en preparación y no puede cotizarse.",
      };
  }
}

function queryString(query: ProductosQueryInicial) {
  const params = new URLSearchParams();
  if (query.page > 1) params.set("page", String(query.page));
  if (query.search.trim()) params.set("search", query.search.trim());
  if (query.unidadComercial) params.set("unidad", query.unidadComercial);
  if (query.subcategoriaCodigo)
    params.set("categoria", query.subcategoriaCodigo);
  if (query.categoriaCodigo)
    params.set("categoriaGrupo", query.categoriaCodigo);
  if (query.estado) params.set("estado", query.estado);
  if (query.orden !== "recientes") params.set("orden", query.orden);
  if (query.vista === "categorias") params.set("vista", "categorias");
  if (query.composicion) params.set("composicion", query.composicion);
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
  const [productoADuplicar, setProductoADuplicar] =
    React.useState<ProductoListItem | null>(null);
  const [nombreCopia, setNombreCopia] = React.useState("");
  const [duplicando, setDuplicando] = React.useState(false);
  const mounted = React.useRef(false);
  const requestId = React.useRef(0);
  const categoriaSeleccionada = categorias.find(
    (categoria) => categoria.codigo === query.categoriaCodigo,
  );

  const updateQuery = React.useCallback(
    (patch: Partial<ProductosQueryInicial>) => {
      setQuery((current) => ({ ...current, ...patch }));
    },
    [],
  );

  React.useEffect(() => {
    const qs = queryString(query);
    window.history.replaceState(
      null,
      "",
      `/productos-servicios${qs ? `?${qs}` : ""}`,
    );
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    const id = ++requestId.current;
    const timer = window.setTimeout(
      async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await listProductos({
            page: query.page,
            limit: pageSize,
            search: query.search,
            activo:
              query.estado === "activo"
                ? true
                : query.estado === "inactivo"
                  ? false
                  : undefined,
            unidadComercial: query.unidadComercial || undefined,
            subcategoriaCodigo: query.subcategoriaCodigo || undefined,
            categoriaCodigo: query.categoriaCodigo || undefined,
            orden: query.orden,
            composicion: query.composicion || undefined,
          });
          if (id !== requestId.current) return;
          setProductos(response.data);
          setTotal(response.total);
          setPages(response.pages);
        } catch (err) {
          if (id !== requestId.current) return;
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo actualizar el catálogo.",
          );
        } finally {
          if (id === requestId.current) setLoading(false);
        }
      },
      query.search ? 250 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [pageSize, query]);

  const duplicar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!productoADuplicar || duplicando || !nombreCopia.trim()) return;
    setDuplicando(true);
    try {
      const copia = await duplicarProducto(productoADuplicar.id, {
        nombre: nombreCopia.trim(),
      });
      toast.success(
        `Producto "${productoADuplicar.nombre}" duplicado como borrador`,
      );
      window.location.assign(`/productos-servicios/${copia.id}?tab=identidad`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo duplicar el producto",
      );
      setDuplicando(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Productos y servicios</span>
          <h1>Catálogo de productos</h1>
          <p>
            Organizá la oferta comercial, su forma de cobro y la configuración
            productiva de cada producto.
          </p>
        </div>
        {canManage ? (
          <Link
            href="/productos-servicios/nuevo"
            className={`${buttonVariants()} ${styles.primaryAction}`}
          >
            <PlusIcon data-icon="inline-start" />
            Nuevo producto
          </Link>
        ) : null}
      </header>

      <section className={styles.metrics} aria-label="Resumen del catálogo">
        <article className={`${styles.metric} ${styles.metricPrimary}`}>
          <span className={styles.metricIcon} aria-hidden="true">
            <PackageIcon />
          </span>
          <div>
            <span>Resultados</span>
            <strong>{total}</strong>
            <small>según los filtros actuales</small>
          </div>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricIcon} aria-hidden="true">
            <ShapesIcon />
          </span>
          <div>
            <span>Categorías</span>
            <strong>{categorias.length}</strong>
            <small>familias comerciales</small>
          </div>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricIcon} aria-hidden="true">
            <TagsIcon />
          </span>
          <div>
            <span>Subcategorías</span>
            <strong>{subcategorias.length}</strong>
            <small>segmentos configurados</small>
          </div>
        </article>
        <article className={styles.metric}>
          <span className={styles.metricIcon} aria-hidden="true">
            <PackageCheckIcon />
          </span>
          <div>
            <span>Vista actual</span>
            <strong>{productos.length}</strong>
            <small>productos en esta página</small>
          </div>
        </article>
      </section>

      <nav className={styles.compositionNav} aria-label="Tipo de producto">
        <button
          type="button"
          data-active={!query.composicion}
          onClick={() => updateQuery({ composicion: "", page: 1 })}
        >
          <PackageIcon aria-hidden="true" />
          <span>
            <strong>Todos</strong>
            <small>Catálogo completo</small>
          </span>
        </button>
        <button
          type="button"
          data-active={query.composicion === "simple"}
          onClick={() => updateQuery({ composicion: "simple", page: 1 })}
        >
          <ShapesIcon aria-hidden="true" />
          <span>
            <strong>Productos simples</strong>
            <small>Se fabrican con su propia ruta</small>
          </span>
        </button>
        <button
          type="button"
          data-active={query.composicion === "compuesto"}
          onClick={() => updateQuery({ composicion: "compuesto", page: 1 })}
        >
          <BoxesIcon aria-hidden="true" />
          <span>
            <strong>Productos compuestos</strong>
            <small>Integran componentes fabricados</small>
          </span>
        </button>
      </nav>

      <section className={styles.filterBar} aria-label="Filtros del catálogo">
        <div className={styles.search}>
          <SearchIcon aria-hidden="true" />
          <input
            value={query.search}
            onChange={(event) =>
              updateQuery({ search: event.target.value, page: 1 })
            }
            placeholder="Buscar por nombre o código…"
            aria-label="Buscar productos por nombre o código"
          />
        </div>
        <CatalogSelect
          label="Cobro"
          value={query.unidadComercial || "all"}
          onChange={(value) =>
            updateQuery({
              unidadComercial:
                value === "all"
                  ? ""
                  : (value as ProductosQueryInicial["unidadComercial"]),
              page: 1,
            })
          }
          options={[
            { value: "all", label: "Todos" },
            { value: "unidad", label: "Por unidad" },
            { value: "m2", label: "Por metro cuadrado" },
            { value: "metro_lineal", label: "Por metro lineal" },
          ]}
        />
        <CatalogSelect
          label="Categoría"
          value={query.categoriaCodigo || "all"}
          onChange={(value) =>
            updateQuery({
              categoriaCodigo: value === "all" ? "" : value,
              subcategoriaCodigo: "",
              page: 1,
            })
          }
          options={[
            { value: "all", label: "Todas" },
            ...categorias.map((categoria) => ({
              value: categoria.codigo,
              label: categoria.nombre,
            })),
          ]}
        />
        <CatalogSelect
          label="Subcategoría"
          value={query.subcategoriaCodigo || "all"}
          onChange={(value) =>
            updateQuery({
              subcategoriaCodigo: value === "all" ? "" : value,
              categoriaCodigo: "",
              page: 1,
            })
          }
          options={[{ value: "all", label: "Todas" }, ...subcategorias]}
        />
        <CatalogSelect
          label="Estado"
          value={query.estado || "all"}
          onChange={(value) =>
            updateQuery({
              estado:
                value === "all"
                  ? ""
                  : (value as ProductosQueryInicial["estado"]),
              page: 1,
            })
          }
          options={[
            { value: "all", label: "Todos" },
            { value: "activo", label: "Publicados" },
            { value: "inactivo", label: "Borradores" },
          ]}
        />
        <CatalogSelect
          label="Orden"
          value={query.orden}
          onChange={(value) =>
            updateQuery({ orden: value as OrdenProductos, page: 1 })
          }
          options={[
            { value: "recientes", label: "Más recientes" },
            { value: "nombre_asc", label: "Nombre A–Z" },
            { value: "nombre_desc", label: "Nombre Z–A" },
          ]}
        />
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
          className={styles.viewToggle}
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
      </section>

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>No se pudo actualizar el catálogo</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {query.vista === "categorias" ? (
        <section className={styles.explorer} aria-busy={loading}>
          <header className={styles.explorerHeader}>
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
                <div>
                  <h2>{categoriaSeleccionada.nombre}</h2>
                  <p>{categoriaSeleccionada.descripcion}</p>
                </div>
              </div>
            ) : (
              <div>
                <h2>Explorar por categoría</h2>
                <p>Elegí una categoría y después la subcategoría específica.</p>
              </div>
            )}
            <span className={styles.explorerCount}>
              {categoriaSeleccionada
                ? `${categoriaSeleccionada.subcategorias} subcategorías`
                : `${categorias.length} categorías`}
            </span>
          </header>
          <div className={styles.categoryGrid}>
            {categoriaSeleccionada
              ? categoriaSeleccionada.items.map((subcategoria) => {
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
                      className={styles.categoryLink}
                    >
                      <Card className={styles.categoryCard}>
                        <Image
                          src={imagenSubcategoria(subcategoria.codigo)}
                          alt=""
                          width={960}
                          height={768}
                          className={styles.categoryImage}
                        />
                        <CardHeader className={styles.categoryCardHeader}>
                          <CardTitle>{subcategoria.nombre}</CardTitle>
                          <CardDescription>
                            {subcategoria.descripcion}
                          </CardDescription>
                          <CardAction className={styles.categoryArrow}>
                            <ArrowRightIcon aria-hidden="true" />
                          </CardAction>
                          <div className={styles.categoryMeta}>
                            {subcategoria.productos}{" "}
                            {subcategoria.productos === 1
                              ? "producto"
                              : "productos"}
                          </div>
                        </CardHeader>
                      </Card>
                    </Link>
                  );
                })
              : categorias.map((categoria) => {
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
                      className={styles.categoryLink}
                    >
                      <Card className={styles.categoryCard}>
                        <Image
                          src={imagenCategoria[categoria.codigo]}
                          alt=""
                          width={960}
                          height={768}
                          className={styles.categoryImage}
                        />
                        <CardHeader className={styles.categoryCardHeader}>
                          <CardTitle>{categoria.nombre}</CardTitle>
                          <CardDescription>
                            {categoria.descripcion}
                          </CardDescription>
                          <CardAction className={styles.categoryArrow}>
                            <ArrowRightIcon aria-hidden="true" />
                          </CardAction>
                          <div className={styles.categoryMeta}>
                            <span>
                              {categoria.productos}{" "}
                              {categoria.productos === 1
                                ? "producto"
                                : "productos"}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{categoria.subcategorias} subcategorías</span>
                          </div>
                        </CardHeader>
                      </Card>
                    </Link>
                  );
                })}
          </div>
        </section>
      ) : total === 0 && !query.search ? (
        <EstadoVacio
          titulo={
            query.composicion === "compuesto"
              ? "Todavía no hay productos compuestos"
              : query.composicion === "simple"
                ? "Todavía no hay productos simples"
                : "Sin productos cargados"
          }
          descripcion={
            query.composicion === "compuesto"
              ? "Un producto aparecerá acá cuando su receta incorpore al menos un componente fabricado."
              : query.composicion === "simple"
                ? "Los productos sin componentes fabricados aparecerán en esta sección."
                : "Empezá creando un producto. Se guardará como borrador hasta que esté listo para publicar."
          }
          cta={
            canManage
              ? {
                  label: "Crear producto",
                  href: "/productos-servicios/nuevo",
                  icon: PlusIcon,
                }
              : undefined
          }
        />
      ) : (
        <section className={styles.catalogPanel} aria-busy={loading}>
          <header className={styles.catalogHeader}>
            <div>
              <span className={styles.catalogIcon} aria-hidden="true">
                <PackageIcon />
              </span>
              <div>
                <h2>Productos</h2>
                <p>Configuración comercial y productiva del catálogo.</p>
              </div>
            </div>
            <span className={styles.catalogCount}>
              {productos.length} en esta página · {total} en total
              {loading ? " · actualizando…" : ""}
            </span>
          </header>
          {productos.length === 0 ? (
            <div className="p-8">
              <EstadoVacio
                variant="compacto"
                titulo="No hay productos que coincidan"
                descripcion="Probá ajustar la búsqueda o limpiar los filtros."
              />
            </div>
          ) : (
            <div className={styles.tableFrame}>
              <TooltipProvider delay={180}>
                <Table className={styles.table}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[31%]">Nombre</TableHead>
                    <TableHead className="w-[14%]">Tipo</TableHead>
                    <TableHead className="w-[14%]">Categoría</TableHead>
                    <TableHead className="w-[16%]">Unidad de venta</TableHead>
                    <TableHead className="w-[17%]">
                      Definición de medida
                    </TableHead>
                    {canManage ? (
                      <TableHead className="w-[8%] text-right">
                        Acciones
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productos.map((producto) => {
                    const unidad = getLabel(
                      unidadComercialLabels,
                      producto.unidadComercial,
                    );
                    const medidas = getLabel(
                      modoMedidasLabels,
                      producto.modoMedidas,
                    );
                    const estado = estadoProducto(producto);
                    const EstadoIcon =
                      producto.estadoCatalogo === "activo"
                        ? BadgeCheckIcon
                        : producto.estadoCatalogo === "incompleto"
                          ? CircleAlertIcon
                          : producto.estadoCatalogo === "listo"
                            ? CircleCheckIcon
                            : CircleDashedIcon;
                    return (
                      <TableRow
                        key={producto.id}
                        data-state={producto.estadoCatalogo}
                      >
                        <TableCell
                          className={styles.productCell}
                          title={producto.descripcion ?? undefined}
                        >
                          <span className={styles.productIdentity}>
                            <Tooltip>
                              <TooltipTrigger
                                render={(props) => (
                                  <button
                                    {...props}
                                    type="button"
                                    className={styles.statusIcon}
                                    data-state={producto.estadoCatalogo}
                                    aria-label={`Estado: ${estado.label}`}
                                  >
                                    <EstadoIcon />
                                  </button>
                                )}
                              />
                              <TooltipContent
                                side="right"
                                align="center"
                                className={styles.statusTooltip}
                              >
                                <strong>{estado.label}</strong>
                                <span>{estado.description}</span>
                              </TooltipContent>
                            </Tooltip>
                            <Link
                              className={styles.productName}
                              href={`/productos-servicios/${producto.id}?tab=identidad`}
                            >
                              {highlightMatch(producto.nombre, query.search)}
                            </Link>
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={styles.typePill}
                            data-kind={
                              producto.esCompuesto ? "compuesto" : "simple"
                            }
                          >
                            {producto.esCompuesto
                              ? "Producto compuesto"
                              : "Producto simple"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={styles.categoryPill}>
                            {producto.subcategoriaComercial?.nombre ??
                              "Sin categoría"}
                          </span>
                        </TableCell>
                        <TableCell title={unidad.descripcion}>
                          <span className={styles.chargePill}>
                            {unidad.label}
                          </span>
                        </TableCell>
                        <TableCell title={medidas.descripcion}>
                          <span className={styles.measurePill}>
                            {medidas.label}
                          </span>
                        </TableCell>
                        {canManage ? (
                          <TableCell className="text-right">
                            <Button
                              className={styles.rowAction}
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Duplicar ${producto.nombre}`}
                              title="Duplicar como borrador"
                              onClick={() => {
                                setProductoADuplicar(producto);
                                setNombreCopia(`${producto.nombre} copia`);
                              }}
                            >
                              <CopyIcon />
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          )}
        </section>
      )}

      {query.vista === "tabla" ? (
        <div className={styles.pagination}>
          <span>
            Página {query.page} de {Math.max(1, pages)} · {total} productos
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={query.page <= 1 || loading}
              onClick={() => updateQuery({ page: Math.max(1, query.page - 1) })}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={query.page >= pages || loading}
              onClick={() => updateQuery({ page: query.page + 1 })}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={Boolean(productoADuplicar)}
        onOpenChange={(open) => {
          if (!open && !duplicando) {
            setProductoADuplicar(null);
            setNombreCopia("");
          }
        }}
      >
        <DialogContent
          className="gp-modal gp-modal-compact"
          overlayClassName="gp-modal-overlay"
        >
          <form onSubmit={duplicar} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Duplicar producto</DialogTitle>
              <DialogDescription>
                La copia conservará su configuración y se guardará como borrador
                para revisarla antes de publicarla.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="nombre-copia-producto">
                  Nombre de la copia
                </FieldLabel>
                <Input
                  id="nombre-copia-producto"
                  autoFocus
                  value={nombreCopia}
                  onChange={(event) => setNombreCopia(event.target.value)}
                  disabled={duplicando}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={duplicando}
                onClick={() => setProductoADuplicar(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={duplicando || !nombreCopia.trim()}
              >
                {duplicando ? (
                  <Loader2Icon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <CopyIcon data-icon="inline-start" />
                )}
                {duplicando ? "Duplicando…" : "Duplicar como borrador"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function CatalogSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next) => next && onChange(next)}
    >
      <SelectTrigger
        size="sm"
        aria-label={label}
        className={styles.filterSelect}
      >
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
