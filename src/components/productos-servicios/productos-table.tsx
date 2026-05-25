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
import { duplicarProducto } from "@/lib/productos-servicios-api";
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
  Route: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <path d="M8.5 19H14a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h5.5" />
    </svg>
  ),
  Arrow: (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
};

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
}: {
  initialProductos: ProductoListItem[];
}) {
  const router = useRouter();
  const productos = initialProductos;
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

  const productosFiltrados = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return productos.filter((p) => {
      if (term) {
        const haystack = `${p.codigo} ${p.nombre} ${p.descripcion ?? ""} ${p.subcategoriaComercial?.nombre ?? ""} ${p.subcategoriaComercial?.categoria.nombre ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (filtroUnidad && p.unidadComercial !== filtroUnidad) return false;
      if (filtroSubcategoria && p.subcategoriaComercial?.codigo !== filtroSubcategoria) return false;
      if (filtroEstado === "activo" && !p.activo) return false;
      if (filtroEstado === "inactivo" && p.activo) return false;
      return true;
    });
  }, [productos, search, filtroUnidad, filtroSubcategoria, filtroEstado]);

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
            {productos.length} productos cargados en el modelo universal por pasos.
          </div>
        </div>
        <button className="btn">Importar</button>
        <Link href="/productos-servicios/nuevo" className="btn btn-primary">
          <PlusIcon size={14} />
          Nuevo producto
        </Link>
      </div>

      {productos.length === 0 ? (
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
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por código, nombre o descripción…"
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
              onChange={setFiltroEstado}
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
              <span className="count">{productosFiltrados.length} de {productos.length}</span>
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
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>¿Cómo se cobra?</th>
                    <th>Manejo de medidas</th>
                    <th>Rutas</th>
                    <th>Estado</th>
                    <th className="right" style={{ width: 96 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map((p) => {
                    const lblUnidad = getLabel(unidadComercialLabels, p.unidadComercial);
                      const lblMedidas = getLabel(modoMedidasLabels, p.modoMedidas);
                      return (
                        <tr key={p.id} onClick={() => openProduct(p.id)}>
                        <td>
                          <div className="name">{p.nombre}</div>
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
                          <span className="inline-flex flex-wrap gap-1.5">
                            {p.rutasAlternativas.map((ra) => (
                              <span key={ra.id} className="tag route">
                                <Ico.Route />
                                {ra.nombre}
                              </span>
                            ))}
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

          <div style={{ marginTop: 14, color: "var(--muted-text)", fontSize: 12, display: "flex", justifyContent: "space-between" } as CSSProperties}>
            <span>Mostrando {productosFiltrados.length} de {productos.length} productos</span>
            <span>Última sincronización · hace 2 min</span>
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
