"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitBranchIcon, PlusIcon, SearchIcon } from "lucide-react";

import { EstadoVacio } from "@/components/ui/estado-vacio";
import type { FamiliaListItem, RutaListItem } from "@/lib/productos-servicios";
import { getCatalogoFamilias } from "@/lib/productos-servicios-api";

function StepChain({
  pasos,
  familiaLabel,
}: {
  pasos: RutaListItem["pasos"];
  familiaLabel: (codigo: string) => string;
}) {
  return (
    <div className="step-chain">
      {pasos.map((paso, index) => (
        <React.Fragment key={paso.id}>
          <span className="step-chip" title={paso.familiaCodigo}>
            <span className="ix">{index + 1}.</span>
            <span className="truncate">{familiaLabel(paso.familiaCodigo)}</span>
          </span>
          {index < pasos.length - 1 ? (
            <span className="step-arrow" aria-hidden="true">→</span>
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}

export function RutasTable({ initialRutas }: { initialRutas: RutaListItem[] }) {
  const router = useRouter();
  const rutas = initialRutas;
  const [familias, setFamilias] = React.useState<FamiliaListItem[]>([]);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    getCatalogoFamilias()
      .then((cat) => setFamilias(cat.familias))
      .catch(() => setFamilias([]));
  }, []);

  const familiaLabel = React.useCallback(
    (codigo: string): string => {
      const f = familias.find((x) => x.codigo === codigo);
      return f?.nombre ?? codigo;
    },
    [familias],
  );

  const rutasFiltradas = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rutas;
    return rutas.filter((r) => {
      const nombresPasos = r.pasos.map((p) => familiaLabel(p.familiaCodigo).toLowerCase()).join(" ");
      const haystack = `${r.codigo} ${r.nombre} ${r.descripcion ?? ""} ${nombresPasos}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [rutas, search, familiaLabel]);

  const openRuta = (id: string) => {
    router.push(`/productos-servicios/rutas/${id}`);
  };

  return (
    <div className="content">
      <div className="page-head">
        <div className="title-block">
          <h1>Rutas de producción</h1>
          <div className="sub">
            {rutas.length} rutas reusables. Cada ruta es un esqueleto de pasos que los productos pueden referenciar.
          </div>
        </div>
        <button className="btn">Importar</button>
        <Link href="/productos-servicios/rutas/nueva" className="btn btn-primary">
          <PlusIcon size={14} />
          Nueva ruta
        </Link>
      </div>

      {rutas.length === 0 ? (
        <EstadoVacio
          titulo="Sin rutas cargadas"
          descripcion="Las rutas son los caminos de producción reusables. Empezá creando una desde cero o ejecutá el seed."
          cta={{ label: "Crear ruta", href: "/productos-servicios/rutas/nueva", icon: PlusIcon }}
        />
      ) : (
        <div className="card">
          <div className="search-card-head">
            <div className="ttl-block">
              <span className="title">Rutas</span>
              <span className="count">{rutasFiltradas.length} de {rutas.length}</span>
            </div>
            <label className="search-inline">
              <SearchIcon size={14} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar ruta o paso..."
              />
              <span className="kbd">/</span>
            </label>
          </div>

          {rutasFiltradas.length === 0 ? (
            <div className="p-8">
              <EstadoVacio
                variant="compacto"
                titulo="Ninguna ruta coincide"
                descripcion="Probá con otros términos de búsqueda."
              />
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th style={{ width: "38%" }}>Pasos</th>
                  <th className="right" style={{ width: 90 }}>Versión</th>
                  <th className="right" style={{ width: 150 }}>Productos que la usan</th>
                  <th className="right" style={{ width: 110 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rutasFiltradas.map((ruta) => (
                  <tr
                    key={ruta.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => openRuta(ruta.id)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      openRuta(ruta.id);
                    }}
                  >
                    <td>
                      <div className="name">{ruta.nombre}</div>
                      {ruta.descripcion ? <div className="desc">{ruta.descripcion}</div> : null}
                    </td>
                    <td>
                      <StepChain pasos={ruta.pasos} familiaLabel={familiaLabel} />
                    </td>
                    <td className="right">
                      <span className="tag version">v{ruta.versionActual}</span>
                    </td>
                    <td className="right">
                      <span className={`tag usage ${ruta._count.productosAlternativas === 0 ? "zero" : ""}`}>
                        <GitBranchIcon size={12} />
                        {ruta._count.productosAlternativas}
                      </span>
                    </td>
                    <td className="right">
                      <Link
                        href={`/productos-servicios/rutas/${ruta.id}`}
                        className="inline-flex items-center gap-2 text-[12.5px] font-medium text-[var(--ink)]"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Ver / editar
                        <span aria-hidden="true">→</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
