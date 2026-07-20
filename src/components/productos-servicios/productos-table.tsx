"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { CopyIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { duplicarProducto, listProductos } from "@/lib/productos-servicios-api";
import type { ProductoListItem } from "@/lib/productos-servicios";
import {
  getLabel,
  modoMedidasLabels,
  unidadComercialLabels,
} from "@/lib/labels-humanos";

const Ico = {
  Search: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  ),
  Chev: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  Arrow: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
};

// Resalta con marcador las palabras de la búsqueda dentro del texto.
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
      <span
        key={index}
        style={{
          background: "rgba(255, 106, 43, 0.22)",
          color: "inherit",
          borderRadius: "3px",
          padding: "0 1px",
          boxShadow: "0 0 0 1px rgba(255, 106, 43, 0.28)",
        }}
      >
        {part}
      </span>
    ) : (
      part
    ),
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
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="catalog-select">
      <button
        type="button"
        className="select"
        onClick={() => setOpen((current) => !current)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      >
        <span className="lbl">{label}</span>
        {selected.label}
        <Ico.Chev style={{ transform: "rotate(90deg)" }} />
      </button>
      {open ? (
        <div className="catalog-select-menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === value ? "active" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProductosServiciosTable({
  initialProductos,
  initialTotal,
  initialPages,
  pageSize,
}: {
  initialProductos: ProductoListItem[];
  initialTotal: number;
  initialPages: number;
  pageSize: number;
}) {
  const router = useRouter();
  // Datos de la página actual (server-driven). La búsqueda y el estado se
  // resuelven en el servidor; unidad/subcategoría son facetas de esta página.
  const [productos, setProductos] = React.useState(initialProductos);
  const [total, setTotal] = React.useState(initialTotal);
  const [pages, setPages] = React.useState(initialPages);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [filtroUnidad, setFiltroUnidad] = React.useState("");
  const [filtroSubcategoria, setFiltroSubcategoria] = React.useState("");
  const [filtroEstado, setFiltroEstado] = React.useState("");
  const [duplicandoId, setDuplicandoId] = React.useState<string | null>(null);
  const [productoADuplicar, setProductoADuplicar] =
    React.useState<ProductoListItem | null>(null);
  const [nombreCopia, setNombreCopia] = React.useState("");
  const subcategoriaOptions = React.useMemo(() => {
    const byCodigo = new Map<string, { value: string; label: string }>();
    for (const producto of productos) {
      const subcategoria = producto.subcategoriaComercial;
      if (!subcategoria) continue;
      byCodigo.set(subcategoria.codigo, {
        value: subcategoria.codigo,
        label: `${subcategoria.categoria.nombre} · ${subcategoria.nombre}`,
      });
    }
    return [{ value: "", label: "todas" }, ...Array.from(byCodigo.values())];
  }, [productos]);

  // Facetas client-side sobre la página actual (unidad/subcategoría). La
  // búsqueda por texto y el estado (activo/inactivo) los resuelve el servidor.
  const productosFiltrados = React.useMemo(() => {
    return productos.filter((p) => {
      if (filtroUnidad && p.unidadComercial !== filtroUnidad) return false;
      if (filtroSubcategoria && p.subcategoriaComercial?.codigo !== filtroSubcategoria)
        return false;
      return true;
    });
  }, [productos, filtroUnidad, filtroSubcategoria]);

  // Refetch server-side al cambiar búsqueda, estado o página (con debounce).
  const mounted = React.useRef(false);
  const reqId = React.useRef(0);
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return; // los datos iniciales ya vienen del server (SSR).
    }
    const id = ++reqId.current;
    const activo =
      filtroEstado === "activo"
        ? true
        : filtroEstado === "inactivo"
          ? false
          : undefined;
    setLoading(true);
    const timer = setTimeout(() => {
      listProductos({ page, limit: pageSize, search, activo })
        .then((res) => {
          if (id !== reqId.current) return;
          setProductos(res.data);
          setTotal(res.total);
          setPages(res.pages);
        })
        .catch(() => {})
        .finally(() => {
          if (id === reqId.current) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [page, pageSize, search, filtroEstado]);

  const openProduct = (id: string) => {
    router.push(`/productos-servicios/${id}?tab=identidad`);
  };

  const codigoPreview = React.useMemo(() => {
    const codigo = nombreCopia
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .toUpperCase();
    return codigo || "PRODUCTO-COPIA";
  }, [nombreCopia]);

  const abrirDuplicarProducto = (
    event: React.MouseEvent<HTMLButtonElement>,
    producto: ProductoListItem,
  ) => {
    event.stopPropagation();
    if (duplicandoId) return;
    setProductoADuplicar(producto);
    setNombreCopia(`${producto.nombre} copia`);
  };

  const handleDuplicarProducto = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!productoADuplicar || duplicandoId) return;
    const nombre = nombreCopia.trim();
    if (!nombre) {
      toast.error("Ingresá un nombre para la copia");
      return;
    }
    setDuplicandoId(productoADuplicar.id);
    try {
      const duplicado = await duplicarProducto(productoADuplicar.id, { nombre });
      toast.success(`Producto "${productoADuplicar.nombre}" duplicado`);
      setProductoADuplicar(null);
      setNombreCopia("");
      router.refresh();
      router.push(`/productos-servicios/${duplicado.id}?tab=identidad`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo duplicar el producto");
    } finally {
      setDuplicandoId(null);
    }
  };

  return (
    <div className="content">
      <div className="page-head">
        <div className="title-block">
          <h1>Catálogo de productos</h1>
          <div className="sub">
            {total} productos en el catálogo (modelo universal por pasos).
          </div>
        </div>
        <button className="btn">Importar</button>
        <Link href="/productos-servicios/nuevo" className="btn btn-primary">
          <PlusIcon size={14} />
          Nuevo producto
        </Link>
      </div>

      {total === 0 && !search && !filtroEstado ? (
        <EstadoVacio
          titulo="Sin productos cargados"
          descripcion="Empezá creando tu primer producto desde el wizard, o ejecutá el seed para cargar los productos validados."
          cta={{ label: "Crear producto", href: "/productos-servicios/nuevo", icon: PlusIcon }}
        />
      ) : (
        <>
          <div className="toolbar">
            <div className="search">
              <Ico.Search />
              <input
                autoFocus
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por nombre o código…"
              />
              <span className="kbd">/</span>
            </div>
            <CatalogSelect
              label="Cobro"
              value={filtroUnidad}
              onChange={setFiltroUnidad}
              options={[
                { value: "", label: "todos" },
                { value: "unidad", label: "Por unidad" },
                { value: "m2", label: "Por metro cuadrado" },
                { value: "metro_lineal", label: "Por metro lineal" },
              ]}
            />
            <CatalogSelect
              label="Categoría"
              value={filtroSubcategoria}
              onChange={setFiltroSubcategoria}
              options={subcategoriaOptions}
            />
            <CatalogSelect
              label="Estado"
              value={filtroEstado}
              onChange={(value) => {
                setFiltroEstado(value);
                setPage(1);
              }}
              options={[
                { value: "", label: "todos" },
                { value: "activo", label: "activos" },
                { value: "inactivo", label: "inactivos" },
              ]}
            />
          </div>

          <div className="card">
            <div className="card-head">
              <span className="title">Productos</span>
              <span className="count">
                {productosFiltrados.length} en esta página · {total} en total
                {loading ? " · actualizando…" : ""}
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, color: "var(--muted-text)" } as CSSProperties}>
                <span style={{ fontSize: 12 }}>Ordenar por</span>
                <div className="select" style={{ height: 28 } as CSSProperties}>
                  Recientes
                  <Ico.Chev style={{ transform: "rotate(90deg)" }} />
                </div>
              </div>
            </div>
            {productosFiltrados.length === 0 ? (
              <div className="p-8">
                <EstadoVacio
                  variant="compacto"
                  titulo="No hay productos que coincidan"
                  descripcion="Probá ajustar la búsqueda o limpiar los filtros."
                />
              </div>
            ) : (
              /* `fixed`: los anchos los mandan los % de abajo y no el contenido.
                 Con el auto-layout la columna Nombre quedaba en ~140px, y ponerle
                 un min-width subía el min-content de la tabla (1089→1209px), que
                 los ancestros flex (`.content`, `.gp-main`, con min-width:auto) no
                 pueden encoger — la vista terminaba más ancha que el viewport. */
              <table className="tbl" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th style={{ width: "34%" }}>Nombre</th>
                    <th style={{ width: "14%" }}>Categoría</th>
                    <th style={{ width: "16%" }}>¿Cómo se cobra?</th>
                    <th style={{ width: "19%" }}>Manejo de medidas</th>
                    <th style={{ width: "9%" }}>Estado</th>
                    <th className="right" style={{ width: "8%" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map((p) => {
                    const lblUnidad = getLabel(unidadComercialLabels, p.unidadComercial);
                      const lblMedidas = getLabel(modoMedidasLabels, p.modoMedidas);
                      return (
                        <tr key={p.id} onClick={() => openProduct(p.id)}>
                        <td>
                          <div className="name">
                            {highlightMatch(p.nombre, search)}
                            {p.tercerizado ? (
                              <span
                                className="tag"
                                style={{
                                  marginLeft: 8,
                                  background: "var(--ps-blue-bg)",
                                  color: "var(--ps-blue)",
                                  borderColor: "var(--ps-blue-bord)",
                                }}
                                title="Tiene al menos un paso que compra a un proveedor"
                              >
                                Tercerizado
                              </span>
                            ) : null}
                          </div>
                          <div className="desc">{p.descripcion ?? ""}</div>
                        </td>
                        <td>
                          <span className="tag muted">
                            <span className="d" />
                            {p.subcategoriaComercial?.nombre ?? "Sin categoría"}
                          </span>
                        </td>
                        <td>
                          <span className="tag muted" title={lblUnidad.descripcion}>
                            <span className="d" />
                            {lblUnidad.label}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`tag ${p.modoMedidas === "FIJA" ? "" : "warm"}`}
                            title={lblMedidas.descripcion}
                          >
                            <span className="d" />
                            {lblMedidas.label}
                          </span>
                        </td>
                        <td>
                          <span className={p.activo ? "tag ok" : "tag muted"}>
                            <span className="d" />
                            {p.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="right">
                          <span className="actions">
                            <button
                              type="button"
                              className="link-action"
                              aria-label={`Duplicar ${p.nombre}`}
                              title="Duplicar"
                              disabled={duplicandoId === p.id}
                              onClick={(event) => abrirDuplicarProducto(event, p)}
                            >
                              {duplicandoId === p.id ? (
                                <Loader2Icon size={13} className="animate-spin" />
                              ) : (
                                <CopyIcon size={13} />
                              )}
                            </button>
                            <button
                              type="button"
                              className="link-action"
                              aria-label={`Ver detalle de ${p.nombre}`}
                              title="Ver detalle"
                              onClick={(event) => {
                                event.stopPropagation();
                                openProduct(p.id);
                              }}
                            >
                              <Ico.Arrow />
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ marginTop: 14, color: "var(--muted-text)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "space-between" } as CSSProperties}>
            <span>
              Página {page} de {Math.max(1, pages)} · {total} productos
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" } as CSSProperties}>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}

      <AlertDialog
        open={Boolean(productoADuplicar)}
        onOpenChange={(open) => {
          if (duplicandoId) return;
          if (!open) {
            setProductoADuplicar(null);
            setNombreCopia("");
          }
        }}
      >
        <AlertDialogContent>
          <form onSubmit={handleDuplicarProducto}>
            <AlertDialogHeader>
              <AlertDialogTitle>Duplicar producto</AlertDialogTitle>
              <AlertDialogDescription>
                Definí el nombre de la copia. El sistema va a generar el código del producto
                automáticamente desde ese nombre.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="nombre-copia-producto">Nombre de la copia</Label>
                <Input
                  id="nombre-copia-producto"
                  autoFocus
                  value={nombreCopia}
                  onChange={(event) => setNombreCopia(event.target.value)}
                  placeholder="Nombre del nuevo producto"
                  disabled={Boolean(duplicandoId)}
                />
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Código sugerido: <span className="font-mono text-foreground">{codigoPreview}</span>
              </div>
            </div>
            <AlertDialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(duplicandoId)}
                onClick={() => {
                  setProductoADuplicar(null);
                  setNombreCopia("");
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={Boolean(duplicandoId)}
                disabled={!nombreCopia.trim()}
              >
                Duplicar producto
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
