"use client";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
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
  PackageCheckIcon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
  ShapesIcon,
  Table2Icon,
  TagsIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Alert,
  Card,
  Chip,
  Input,
  Modal,
  SearchField,
  Tabs,
  Tooltip,
} from "@heroui/react";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import { ListMetric } from "@/components/design-system/list-metric";
import { SelectField } from "@/components/design-system/select-field";
import { FormDialog } from "@/components/design-system/form-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useDesignScope } from "@/components/design-system/appearance";
import theme from "@/components/design-system/theme.module.css";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
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
        description:
          "La configuración está completa, pero aún no fue publicada.",
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
  const scope = useDesignScope();
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
    <main
      {...scope}
      className={`${theme.theme} ${listPage.page} ${styles.page}`}
    >
      <header className={listPage.header}>
        <div>
          <h1>Catálogo de productos</h1>
          <p className={listPage.subtitle}>
            Organizá la oferta comercial, su forma de cobro y la configuración
            productiva de cada producto.
          </p>
        </div>
        {canManage ? (
          <ActionLink href="/productos-servicios/nuevo">
            <PlusIcon data-icon="inline-start" />
            Nuevo producto
          </ActionLink>
        ) : null}
      </header>

      <section className={styles.metrics} aria-label="Resumen del catálogo">
        <ListMetric
          label="Resultados"
          value={total}
          hint="Según los filtros actuales"
          icon={PackageIcon}
          tone="brand"
        />
        <ListMetric
          label="Categorías"
          value={categorias.length}
          hint="Familias comerciales"
          icon={ShapesIcon}
        />
        <ListMetric
          label="Subcategorías"
          value={subcategorias.length}
          hint="Segmentos configurados"
          icon={TagsIcon}
        />
        <ListMetric
          label="Vista actual"
          value={productos.length}
          hint="Productos en esta página"
          icon={PackageCheckIcon}
        />
      </section>

      <Tabs
        selectedKey={query.composicion || "todos"}
        onSelectionChange={(key) =>
          updateQuery({
            composicion: key === "todos" ? "" : (key as ComposicionProductos),
            page: 1,
          })
        }
      >
        <NavigationTabList
          className={styles.compositionNav}
          label="Tipo de producto"
          variant="detailed"
          items={[
            {
              id: "todos",
              label: "Todos",
              description: "Catálogo completo",
              icon: <PackageIcon />,
            },
            {
              id: "simple",
              label: "Productos simples",
              description: "Se fabrican con su propia ruta",
              icon: <ShapesIcon />,
            },
            {
              id: "compuesto",
              label: "Productos compuestos",
              description: "Integran componentes fabricados",
              icon: <BoxesIcon />,
            },
          ]}
        />
      </Tabs>

      <Card className={styles.filterBar} aria-label="Filtros del catálogo">
        <SearchField
          className={styles.search}
          aria-label="Buscar productos por nombre o código"
          value={query.search}
          onChange={(value) => updateQuery({ search: value, page: 1 })}
        >
          <SearchField.Group className={listPage.searchGroup}>
            <SearchField.SearchIcon>
              <SearchIcon size={16} />
            </SearchField.SearchIcon>
            <SearchField.Input placeholder="Buscar por nombre o código…" />
            <SearchField.ClearButton aria-label="Limpiar búsqueda" />
          </SearchField.Group>
        </SearchField>
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
        <div className={styles.viewToggle}>
          <SegmentedControl
            aria-label="Cambiar vista del catálogo"
            value={query.vista}
            onChange={(value) => {
              const vista = value as VistaProductos;
              updateQuery({
                vista,
                page: 1,
                ...(vista === "categorias"
                  ? { categoriaCodigo: "", subcategoriaCodigo: "" }
                  : {}),
              });
            }}
            options={[
              { value: "tabla", label: "Tabla", icon: <Table2Icon /> },
              {
                value: "categorias",
                label: "Categorías",
                icon: <Grid2X2Icon />,
              },
            ]}
          />
        </div>
      </Card>

      {error ? (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>No se pudo actualizar el catálogo</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {query.vista === "categorias" ? (
        <Card
          className={`${listPage.results} ${styles.explorer}`}
          aria-busy={loading}
        >
          <header className={styles.explorerHeader}>
            {categoriaSeleccionada ? (
              <div className="flex items-start gap-3">
                <Button
                  variant="outline"
                  isIconOnly
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
                        <Card.Header className={styles.categoryCardHeader}>
                          <Card.Title>{subcategoria.nombre}</Card.Title>
                          <Card.Description>
                            {subcategoria.descripcion}
                          </Card.Description>
                          <span className={styles.categoryArrow}>
                            <ArrowRightIcon aria-hidden="true" />
                          </span>
                          <div className={styles.categoryMeta}>
                            {subcategoria.productos}{" "}
                            {subcategoria.productos === 1
                              ? "producto"
                              : "productos"}
                          </div>
                        </Card.Header>
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
                        <Card.Header className={styles.categoryCardHeader}>
                          <Card.Title>{categoria.nombre}</Card.Title>
                          <Card.Description>
                            {categoria.descripcion}
                          </Card.Description>
                          <span className={styles.categoryArrow}>
                            <ArrowRightIcon aria-hidden="true" />
                          </span>
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
                        </Card.Header>
                      </Card>
                    </Link>
                  );
                })}
          </div>
        </Card>
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
        <Card className={listPage.results} aria-busy={loading}>
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
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className="w-[31%]">Nombre</th>
                    <th className="w-[14%]">Tipo</th>
                    <th className="w-[14%]">Categoría</th>
                    <th className="w-[16%]">Unidad de venta</th>
                    <th className="w-[17%]">Definición de medida</th>
                    {canManage ? (
                      <th className="w-[8%] text-right">Acciones</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
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
                      <tr
                        key={producto.id}
                        data-state={producto.estadoCatalogo}
                      >
                        <td
                          className={styles.productCell}
                          title={producto.descripcion ?? undefined}
                        >
                          <span className={styles.productIdentity}>
                            <Tooltip delay={180}>
                              <Button
                                variant="ghost"
                                isIconOnly
                                className={styles.statusIcon}
                                data-state={producto.estadoCatalogo}
                                aria-label={`Estado: ${estado.label}`}
                              >
                                <EstadoIcon />
                              </Button>
                              <Tooltip.Content
                                {...scope}
                                placement="right"
                                className={`${theme.theme} ${styles.statusTooltip}`}
                              >
                                <strong>{estado.label}</strong>
                                <span>{estado.description}</span>
                              </Tooltip.Content>
                            </Tooltip>
                            <Link
                              className={styles.productName}
                              href={`/productos-servicios/${producto.id}?tab=identidad`}
                            >
                              {highlightMatch(producto.nombre, query.search)}
                            </Link>
                          </span>
                        </td>
                        <td>
                          <Chip
                            size="sm"
                            variant="soft"
                            className={styles.typePill}
                            data-kind={
                              producto.esCompuesto ? "compuesto" : "simple"
                            }
                          >
                            {producto.esCompuesto
                              ? "Producto compuesto"
                              : "Producto simple"}
                          </Chip>
                        </td>
                        <td>
                          <span className={styles.categoryPill}>
                            {producto.subcategoriaComercial?.nombre ??
                              "Sin categoría"}
                          </span>
                        </td>
                        <td title={unidad.descripcion}>
                          <span className={styles.chargePill}>
                            {unidad.label}
                          </span>
                        </td>
                        <td title={medidas.descripcion}>
                          <span className={styles.measurePill}>
                            {medidas.label}
                          </span>
                        </td>
                        {canManage ? (
                          <td className="text-right">
                            <Button
                              variant="outline"
                              isIconOnly
                              aria-label={`Duplicar ${producto.nombre}`}
                              title="Duplicar como borrador"
                              onClick={() => {
                                setProductoADuplicar(producto);
                                setNombreCopia(`${producto.nombre} copia`);
                              }}
                            >
                              <CopyIcon />
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
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
              isDisabled={query.page <= 1 || loading}
              onClick={() => updateQuery({ page: Math.max(1, query.page - 1) })}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={query.page >= pages || loading}
              onClick={() => updateQuery({ page: query.page + 1 })}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      <FormDialog
        isOpen={Boolean(productoADuplicar)}
        isDismissable={!duplicando}
        onOpenChange={(open) => {
          if (!open && !duplicando) {
            setProductoADuplicar(null);
            setNombreCopia("");
          }
        }}
        title="Duplicar producto"
        description="La copia conservará su configuración y se guardará como borrador para revisarla antes de publicarla."
      >
        <form onSubmit={duplicar} className={styles.dialogForm}>
          <Modal.Body className={styles.dialogBody}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="nombre-copia-producto">
                  Nombre de la copia
                </FieldLabel>
                <Input
                  className={focus.singleBorder}
                  id="nombre-copia-producto"
                  autoFocus
                  value={nombreCopia}
                  onChange={(event) => setNombreCopia(event.target.value)}
                  disabled={duplicando}
                />
              </Field>
            </FieldGroup>
          </Modal.Body>
          <Modal.Footer className={styles.dialogFooter}>
            <Button
              type="button"
              variant="outline"
              isDisabled={duplicando}
              onPress={() => setProductoADuplicar(null)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              isDisabled={duplicando || !nombreCopia.trim()}
            >
              {duplicando ? (
                <GdiSpinner data-icon="inline-start" className="size-4" />
              ) : (
                <CopyIcon data-icon="inline-start" />
              )}
              {duplicando ? "Duplicando…" : "Duplicar como borrador"}
            </Button>
          </Modal.Footer>
        </form>
      </FormDialog>
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
    <div className={styles.filterSelect}>
      <span>{label}</span>
      <SelectField
        aria-label={label}
        options={options}
        value={value}
        onChange={(next) => next && onChange(next)}
      />
    </div>
  );
}

function EstadoVacio({
  titulo,
  descripcion,
  cta,
}: {
  titulo: string;
  descripcion: string;
  variant?: "compacto";
  cta?: { label: string; href: string; icon: React.ElementType };
}) {
  return (
    <div className={listPage.empty}>
      <PackageIcon size={28} aria-hidden />
      <strong>{titulo}</strong>
      <p>{descripcion}</p>
      {cta && (
        <ActionLink href={cta.href}>
          <cta.icon />
          {cta.label}
        </ActionLink>
      )}
    </div>
  );
}
