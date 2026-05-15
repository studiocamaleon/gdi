"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { PlusIcon } from "lucide-react";

import { EstadoVacio } from "@/components/ui/estado-vacio";
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
                    <th className="right" style={{ width: 110 }}>Acciones</th>
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
                            <a
                              onClick={(event) => {
                                event.stopPropagation();
                                openProduct(p.id);
                              }}
                            >
                              Ver detalle
                            </a>
                            <Ico.Arrow />
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
    </div>
  );
}
