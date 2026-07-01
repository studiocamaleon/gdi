"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpenIcon,
  CircleDotIcon,
  CopyIcon,
  FactoryIcon,
  GitBranchIcon,
  LayersIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  PackageIcon,
  PaintbrushIcon,
  PlusIcon,
  PrinterIcon,
  ScissorsIcon,
  SearchIcon,
  ShieldCheckIcon,
  SunIcon,
  TruckIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";
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
import type { FamiliaListItem, RutaListItem } from "@/lib/productos-servicios";
import {
  duplicarRuta,
  getCatalogoFamilias,
} from "@/lib/productos-servicios-api";

const Ico = {
  Arrow: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
};

const STEP_ICONS = {
  Layout: LayoutDashboardIcon,
  Layers: LayersIcon,
  Printer: PrinterIcon,
  Plot: FactoryIcon,
  Cut: ScissorsIcon,
  Scissors: ScissorsIcon,
  Brush: PaintbrushIcon,
  Stamp: CircleDotIcon,
  Fold: LayersIcon,
  Cnc: FactoryIcon,
  Beam: ZapIcon,
  Book: BookOpenIcon,
  Tool: WrenchIcon,
  Shield: ShieldCheckIcon,
  Package: PackageIcon,
  Truck: TruckIcon,
  Wrench: WrenchIcon,
  Sun: SunIcon,
};

function getStepIcon(icono?: string | null) {
  return STEP_ICONS[icono as keyof typeof STEP_ICONS] ?? LayoutDashboardIcon;
}

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
            {React.createElement(getStepIcon(paso.icono), {
              className: "step-chip-icon",
            })}
            <span className="ix">{index + 1}.</span>
            <span className="truncate">{familiaLabel(paso.familiaCodigo)}</span>
          </span>
          {index < pasos.length - 1 ? (
            <span className="step-arrow" aria-hidden="true">
              →
            </span>
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
  const [duplicandoId, setDuplicandoId] = React.useState<string | null>(null);
  const [rutaADuplicar, setRutaADuplicar] = React.useState<RutaListItem | null>(
    null,
  );
  const [nombreCopia, setNombreCopia] = React.useState("");

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
      const nombresPasos = r.pasos
        .map((p) => familiaLabel(p.familiaCodigo).toLowerCase())
        .join(" ");
      const haystack =
        `${r.codigo} ${r.nombre} ${r.descripcion ?? ""} ${nombresPasos}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [rutas, search, familiaLabel]);

  const openRuta = (id: string) => {
    router.push(`/productos-servicios/rutas/${id}`);
  };

  const codigoPreview = React.useMemo(() => {
    const codigo = nombreCopia
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .toUpperCase();
    return codigo || "RUTA-COPIA";
  }, [nombreCopia]);

  const abrirDuplicarRuta = (
    event: React.MouseEvent<HTMLButtonElement>,
    ruta: RutaListItem,
  ) => {
    event.stopPropagation();
    if (duplicandoId) return;
    setRutaADuplicar(ruta);
    setNombreCopia(`${ruta.nombre} copia`);
  };

  const handleDuplicarRuta = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!rutaADuplicar || duplicandoId) return;
    const nombre = nombreCopia.trim();
    if (!nombre) {
      toast.error("Ingresá un nombre para la copia");
      return;
    }
    setDuplicandoId(rutaADuplicar.id);
    try {
      const duplicada = await duplicarRuta(rutaADuplicar.id, { nombre });
      toast.success(`Ruta "${rutaADuplicar.nombre}" duplicada`);
      setRutaADuplicar(null);
      setNombreCopia("");
      router.refresh();
      router.push(`/productos-servicios/rutas/${duplicada.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo duplicar la ruta",
      );
    } finally {
      setDuplicandoId(null);
    }
  };

  return (
    <div className="content">
      <div className="page-head">
        <div className="title-block">
          <h1>Rutas de producción</h1>
          <div className="sub">
            {rutas.length} rutas reusables. Cada ruta es un esqueleto de pasos
            que los productos pueden referenciar.
          </div>
        </div>
        <button className="btn">Importar</button>
        <Link
          href="/productos-servicios/rutas/nueva"
          className="btn btn-primary"
        >
          <PlusIcon size={14} />
          Nueva ruta
        </Link>
      </div>

      {rutas.length === 0 ? (
        <EstadoVacio
          titulo="Sin rutas cargadas"
          descripcion="Las rutas son los caminos de producción reusables. Empezá creando una desde cero o ejecutá el seed."
          cta={{
            label: "Crear ruta",
            href: "/productos-servicios/rutas/nueva",
            icon: PlusIcon,
          }}
        />
      ) : (
        <div className="card">
          <div className="search-card-head">
            <div className="ttl-block">
              <span className="title">Rutas</span>
              <span className="count">
                {rutasFiltradas.length} de {rutas.length}
              </span>
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
                  <th className="right" style={{ width: 90 }}>
                    Versión
                  </th>
                  <th className="right" style={{ width: 150 }}>
                    Productos que la usan
                  </th>
                  <th className="right" style={{ width: 110 }}>
                    Acciones
                  </th>
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
                      {ruta.descripcion ? (
                        <div className="desc">{ruta.descripcion}</div>
                      ) : null}
                    </td>
                    <td>
                      <StepChain
                        pasos={ruta.pasos}
                        familiaLabel={familiaLabel}
                      />
                    </td>
                    <td className="right">
                      <span className="tag version">v{ruta.versionActual}</span>
                    </td>
                    <td className="right">
                      <span
                        className={`tag usage ${ruta._count.productosAlternativas === 0 ? "zero" : ""}`}
                      >
                        <GitBranchIcon size={12} />
                        {ruta._count.productosAlternativas}
                      </span>
                    </td>
                    <td className="right">
                      <span className="actions">
                        <button
                          type="button"
                          className="link-action"
                          aria-label={`Duplicar ${ruta.nombre}`}
                          title="Duplicar"
                          disabled={duplicandoId === ruta.id}
                          onClick={(event) => abrirDuplicarRuta(event, ruta)}
                        >
                          {duplicandoId === ruta.id ? (
                            <Loader2Icon size={13} className="animate-spin" />
                          ) : (
                            <CopyIcon size={13} />
                          )}
                        </button>
                        <Link
                          href={`/productos-servicios/rutas/${ruta.id}`}
                          className="link-action"
                          aria-label={`Ver detalle de ${ruta.nombre}`}
                          title="Ver detalle"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Ico.Arrow />
                        </Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <AlertDialog
        open={Boolean(rutaADuplicar)}
        onOpenChange={(open) => {
          if (duplicandoId) return;
          if (!open) {
            setRutaADuplicar(null);
            setNombreCopia("");
          }
        }}
      >
        <AlertDialogContent>
          <form onSubmit={handleDuplicarRuta}>
            <AlertDialogHeader>
              <AlertDialogTitle>Duplicar ruta de producción</AlertDialogTitle>
              <AlertDialogDescription>
                Definí el nombre de la copia. Se copiarán los pasos de la
                versión actual y el sistema generará el código automáticamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="nombre-copia-ruta">Nombre de la copia</Label>
                <Input
                  id="nombre-copia-ruta"
                  autoFocus
                  value={nombreCopia}
                  onChange={(event) => setNombreCopia(event.target.value)}
                  placeholder="Nombre de la nueva ruta"
                  disabled={Boolean(duplicandoId)}
                />
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Código sugerido:{" "}
                <span className="font-mono text-foreground">
                  {codigoPreview}
                </span>
              </div>
            </div>
            <AlertDialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(duplicandoId)}
                onClick={() => {
                  setRutaADuplicar(null);
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
                Duplicar ruta
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
