"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  BookOpenIcon,
  BoxesIcon,
  CircleDotIcon,
  CopyIcon,
  FactoryIcon,
  GitBranchIcon,
  LayersIcon,
  LayoutDashboardIcon,
  Layers3Icon,
  Loader2Icon,
  PackageIcon,
  PaintbrushIcon,
  PlusIcon,
  PrinterIcon,
  RouteIcon,
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FamiliaListItem, RutaListItem } from "@/lib/productos-servicios";
import {
  duplicarRuta,
  getCatalogoFamilias,
} from "@/lib/productos-servicios-api";

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

function RoutePreview({
  ruta,
  familiaLabel,
}: {
  ruta: RutaListItem;
  familiaLabel: (codigo: string) => string;
}) {
  const nodos =
    ruta.workflow?.nodos.slice().sort((a, b) => a.orden - b.orden) ??
    ruta.pasos.map((paso, index) => ({
      clave: paso.id,
      tipo: "PASO" as const,
      orden: index,
      familiaCodigo: paso.familiaCodigo,
      nombreVisible: paso.nombreVisible,
      icono: paso.icono,
    }));
  const topologia = ruta.workflow?.topologia ?? "LINEAL";
  return (
    <Tooltip>
      <TooltipTrigger
        render={(props) => (
          <Button
            {...props}
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Ver Workflow de ${ruta.nombre}: ${nodos.length} ${nodos.length === 1 ? "nodo" : "nodos"}`}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <RouteIcon data-icon="inline-start" />
            {nodos.length} {nodos.length === 1 ? "nodo" : "nodos"} · {topologia}
          </Button>
        )}
      />
      <TooltipContent
        side="bottom"
        align="start"
        className="block w-80 max-w-[calc(100vw-2rem)] p-3"
      >
        <p className="mb-2 font-medium">Workflow reusable</p>
        <ol className="grid gap-1.5">
          {nodos.map((nodo, index) => {
            const StepIcon =
              nodo.tipo === "COMPONENTE"
                ? BoxesIcon
                : nodo.tipo === "ETAPA"
                  ? Layers3Icon
                  : getStepIcon(nodo.icono);
            const nombre =
              nodo.tipo === "COMPONENTE"
                ? nodo.nombre
                : nodo.nombreVisible?.trim() ||
                  familiaLabel(nodo.familiaCodigo);
            return (
              <li key={nodo.clave} className="flex min-w-0 items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background/15 text-[10px] font-semibold">
                  {index + 1}
                </span>
                <StepIcon className="size-3.5 shrink-0 opacity-75" />
                <span className="min-w-0 truncate">{nombre}</span>
                <small className="ml-auto opacity-60">{nodo.tipo}</small>
              </li>
            );
          })}
        </ol>
      </TooltipContent>
    </Tooltip>
  );
}

type EstadoFiltro = "activas" | "inactivas" | "todas";

export function RutasTable({
  initialRutas,
  puedeGestionar,
}: {
  initialRutas: RutaListItem[];
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const rutas = initialRutas;
  const [familias, setFamilias] = React.useState<FamiliaListItem[]>([]);
  const [search, setSearch] = React.useState("");
  const [estadoFiltro, setEstadoFiltro] =
    React.useState<EstadoFiltro>("activas");
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
    return rutas.filter((r) => {
      if (estadoFiltro === "activas" && !r.activo) return false;
      if (estadoFiltro === "inactivas" && r.activo) return false;
      if (!term) return true;
      const nombresNodos = (r.workflow?.nodos ?? r.pasos)
        .map((nodo) =>
          "tipo" in nodo && nodo.tipo === "COMPONENTE"
            ? nodo.nombre.toLowerCase()
            : familiaLabel(nodo.familiaCodigo).toLowerCase(),
        )
        .join(" ");
      const haystack =
        `${r.codigo} ${r.nombre} ${r.descripcion ?? ""} ${nombresNodos}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [rutas, search, familiaLabel, estadoFiltro]);

  const openRuta = (id: string) => {
    router.push(`/productos-servicios/rutas/${id}`);
  };

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
            {rutas.length} rutas reusables. Cada ruta versiona un Workflow de
            pasos, etapas y componentes que distintos productos pueden usar.
          </div>
        </div>
        {puedeGestionar ? (
          <Link
            href="/productos-servicios/rutas/nueva"
            className="btn btn-primary"
          >
            <PlusIcon size={14} />
            Nueva ruta
          </Link>
        ) : null}
      </div>

      {rutas.length === 0 ? (
        <EstadoVacio
          titulo="Sin rutas cargadas"
          descripcion="Las rutas son los caminos de producción reusables. Empezá creando una desde cero o ejecutá el seed."
          cta={
            puedeGestionar
              ? {
                  label: "Crear ruta",
                  href: "/productos-servicios/rutas/nueva",
                  icon: PlusIcon,
                }
              : undefined
          }
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
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={1}
              value={[estadoFiltro]}
              onValueChange={(values) => {
                const value = values[0] as EstadoFiltro | undefined;
                if (value) setEstadoFiltro(value);
              }}
              aria-label="Filtrar rutas por estado"
            >
              <ToggleGroupItem value="activas">Activas</ToggleGroupItem>
              <ToggleGroupItem value="inactivas">Inactivas</ToggleGroupItem>
              <ToggleGroupItem value="todas">Todas</ToggleGroupItem>
            </ToggleGroup>
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
            <div className="overflow-x-auto">
              <TooltipProvider delay={200}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th style={{ width: 140 }}>Recorrido</th>
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
                        role={puedeGestionar ? "link" : undefined}
                        tabIndex={puedeGestionar ? 0 : undefined}
                        onClick={() => {
                          if (puedeGestionar) openRuta(ruta.id);
                        }}
                        onKeyDown={(event) => {
                          if (!puedeGestionar) return;
                          if (event.key !== "Enter" && event.key !== " ")
                            return;
                          event.preventDefault();
                          openRuta(ruta.id);
                        }}
                      >
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="name">{ruta.nombre}</div>
                            {!ruta.activo ? (
                              <Badge variant="secondary">Inactiva</Badge>
                            ) : null}
                          </div>
                          {ruta.descripcion ? (
                            <div className="desc">{ruta.descripcion}</div>
                          ) : null}
                        </td>
                        <td>
                          <RoutePreview
                            ruta={ruta}
                            familiaLabel={familiaLabel}
                          />
                        </td>
                        <td className="right">
                          <span className="tag version">
                            v{ruta.versionActual}
                          </span>
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
                          {puedeGestionar ? (
                            <span className="actions">
                              <button
                                type="button"
                                className="link-action"
                                aria-label={`Duplicar ${ruta.nombre}`}
                                title="Duplicar"
                                disabled={duplicandoId === ruta.id}
                                onClick={(event) =>
                                  abrirDuplicarRuta(event, ruta)
                                }
                              >
                                {duplicandoId === ruta.id ? (
                                  <Loader2Icon
                                    size={13}
                                    className="animate-spin"
                                  />
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
                                <ArrowRightIcon className="size-3.5" />
                              </Link>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              Solo lectura
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TooltipProvider>
            </div>
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
                Definí el nombre de la copia. Se copiará el Workflow completo de
                la versión actual —incluidos etapas, componentes y paralelismos—
                para que puedas revisarlo antes de usarlo.
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
