"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FilterIcon,
  PlusIcon,
  PowerIcon,
  RotateCcwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { MaquinaAltaDialog } from "./maquina-editor/maquina-alta-dialog";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Planta } from "@/lib/costos";
import {
  estadoConfiguracionMaquinaItems,
  estadoMaquinaItems,
  getEstadoConfiguracionMaquinaLabel,
  getEstadoMaquinaLabel,
  type EstadoConfiguracionMaquina,
  type EstadoMaquina,
  type MaquinaResumen,
  type MaquinasPage,
  type PlantillaMaquinaria,
} from "@/lib/maquinaria";
import { setMaquinaActiva } from "@/lib/maquinaria-api";
import {
  getPlantillaMaquinariaLabel,
  maquinariaTemplates,
} from "@/lib/maquinaria-templates";
import { cn } from "@/lib/utils";
import {
  getMachineTechColor,
  getMachineTechnologyLabel,
  SelectDisplay,
} from "./maquina-editor/helpers";

type MaquinariaFilters = {
  search?: string;
  plantilla?: PlantillaMaquinaria;
  estado?: EstadoMaquina;
  estadoConfiguracion?: EstadoConfiguracionMaquina;
};

type MaquinariaPanelProps = {
  initialPage: MaquinasPage;
  plantas: Planta[];
  puedeGestionar: boolean;
  initialFilters: MaquinariaFilters;
  initialCreate?: boolean;
};

const ALL = "all";

export function MaquinariaPanel({
  initialPage,
  plantas,
  puedeGestionar,
  initialFilters,
  initialCreate = false,
}: MaquinariaPanelProps) {
  const router = useRouter();
  const [maquinas, setMaquinas] = React.useState(initialPage.data);
  const [altaAbierta, setAltaAbierta] = React.useState(initialCreate);
  const [filterText, setFilterText] = React.useState(
    initialFilters.search ?? "",
  );
  const [filterPlantilla, setFilterPlantilla] = React.useState<
    PlantillaMaquinaria | typeof ALL
  >(initialFilters.plantilla ?? ALL);
  const [filterEstado, setFilterEstado] = React.useState<
    EstadoMaquina | typeof ALL
  >(initialFilters.estado ?? ALL);
  const [filterConfiguracion, setFilterConfiguracion] = React.useState<
    EstadoConfiguracionMaquina | typeof ALL
  >(initialFilters.estadoConfiguracion ?? ALL);
  const [filtroAbierto, setFiltroAbierto] = React.useState(
    Boolean(
      initialFilters.plantilla ||
      initialFilters.estado ||
      initialFilters.estadoConfiguracion,
    ),
  );
  const [maquinaADesactivar, setMaquinaADesactivar] =
    React.useState<MaquinaResumen | null>(null);
  const [cambiandoId, setCambiandoId] = React.useState<string | null>(null);
  const firstSearchRender = React.useRef(true);

  React.useEffect(() => setMaquinas(initialPage.data), [initialPage.data]);

  const navegarConFiltros = React.useCallback(
    (next: MaquinariaFilters, page = 1) => {
      const params = new URLSearchParams();
      if (next.search?.trim()) params.set("search", next.search.trim());
      if (next.plantilla) params.set("plantilla", next.plantilla);
      if (next.estado) params.set("estado", next.estado);
      if (next.estadoConfiguracion)
        params.set("config", next.estadoConfiguracion);
      if (page > 1) params.set("page", String(page));
      const query = params.toString();
      router.replace(`/costos/maquinaria${query ? `?${query}` : ""}`);
    },
    [router],
  );

  const filtrosActuales = React.useCallback(
    (search = filterText): MaquinariaFilters => ({
      search: search.trim() || undefined,
      plantilla: filterPlantilla === ALL ? undefined : filterPlantilla,
      estado: filterEstado === ALL ? undefined : filterEstado,
      estadoConfiguracion:
        filterConfiguracion === ALL ? undefined : filterConfiguracion,
    }),
    [filterConfiguracion, filterEstado, filterPlantilla, filterText],
  );

  React.useEffect(() => {
    if (firstSearchRender.current) {
      firstSearchRender.current = false;
      return;
    }
    const timeout = window.setTimeout(
      () => navegarConFiltros(filtrosActuales(filterText)),
      350,
    );
    return () => window.clearTimeout(timeout);
  }, [filterText, filtrosActuales, navegarConFiltros]);

  const abrirAlta = () => {
    if (puedeGestionar) setAltaAbierta(true);
  };

  const cerrarAlta = () => {
    setAltaAbierta(false);
    if (initialCreate) navegarConFiltros(filtrosActuales());
  };

  const cambiarActivo = async (maquina: MaquinaResumen, activo: boolean) => {
    setCambiandoId(maquina.id);
    try {
      const updated = await setMaquinaActiva(maquina.id, activo);
      setMaquinas((current) =>
        current.map((item) =>
          item.id === maquina.id
            ? {
                ...item,
                activo: updated.activo,
                estado: updated.estado,
                estadoConfiguracion: updated.estadoConfiguracion,
                updatedAt: updated.updatedAt,
              }
            : item,
        ),
      );
      toast.success(
        activo
          ? `"${updated.nombre}" activada`
          : `"${updated.nombre}" desactivada`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar la máquina",
      );
    } finally {
      setCambiandoId(null);
    }
  };

  const limpiarFiltros = () => {
    setFilterPlantilla(ALL);
    setFilterEstado(ALL);
    setFilterConfiguracion(ALL);
    setFilterText("");
    setFiltroAbierto(false);
    navegarConFiltros({});
  };

  const sinResultadosPorFiltros = Boolean(
    filterText.trim() ||
    filterPlantilla !== ALL ||
    filterEstado !== ALL ||
    filterConfiguracion !== ALL,
  );

  return (
    <div className="content">
      <div className="page-head">
        <div className="title-block">
          <h1>Maquinaria</h1>
          <div className="sub">
            Catálogo de máquinas y sus perfiles operativos.
          </div>
        </div>
      </div>

      <div className="maq-toolbar">
        <div className="maq-buscador">
          <SearchIcon />
          <Input
            type="search"
            placeholder="Buscar por nombre, código, fabricante, modelo o ubicación"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            aria-label="Buscar máquina"
          />
        </div>
        <div className="maq-acciones">
          <Button
            type="button"
            variant="outline"
            aria-expanded={filtroAbierto}
            onClick={() => setFiltroAbierto((current) => !current)}
          >
            <FilterIcon data-icon="inline-start" />
            Filtrar
          </Button>
          {puedeGestionar ? (
            <Button type="button" onClick={abrirAlta}>
              <PlusIcon data-icon="inline-start" />
              Nueva máquina
            </Button>
          ) : null}
        </div>
      </div>

      {filtroAbierto ? (
        <div className="maq-filtros">
          <div className="maq-filtros-grupo">
            <Select
              value={filterPlantilla}
              onValueChange={(value) => {
                const plantilla = (value ?? ALL) as
                  PlantillaMaquinaria | typeof ALL;
                setFilterPlantilla(plantilla);
                navegarConFiltros({
                  ...filtrosActuales(),
                  plantilla: plantilla === ALL ? undefined : plantilla,
                });
              }}
            >
              <SelectTrigger aria-label="Tipo de máquina">
                <SelectDisplay
                  label={
                    filterPlantilla === ALL
                      ? "Todos los tipos"
                      : getPlantillaMaquinariaLabel(filterPlantilla)
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={ALL}>Todos los tipos</SelectItem>
                  {maquinariaTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              value={filterEstado}
              onValueChange={(value) => {
                const estado = (value ?? ALL) as EstadoMaquina | typeof ALL;
                setFilterEstado(estado);
                navegarConFiltros({
                  ...filtrosActuales(),
                  estado: estado === ALL ? undefined : estado,
                });
              }}
            >
              <SelectTrigger aria-label="Estado operativo">
                <SelectDisplay
                  label={
                    filterEstado === ALL
                      ? "Todos los estados"
                      : getEstadoMaquinaLabel(filterEstado)
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={ALL}>Todos los estados</SelectItem>
                  {estadoMaquinaItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              value={filterConfiguracion}
              onValueChange={(value) => {
                const config = (value ?? ALL) as
                  EstadoConfiguracionMaquina | typeof ALL;
                setFilterConfiguracion(config);
                navegarConFiltros({
                  ...filtrosActuales(),
                  estadoConfiguracion: config === ALL ? undefined : config,
                });
              }}
            >
              <SelectTrigger aria-label="Estado de configuración">
                <SelectDisplay
                  label={
                    filterConfiguracion === ALL
                      ? "Cualquier configuración"
                      : getEstadoConfiguracionMaquinaLabel(filterConfiguracion)
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={ALL}>Cualquier configuración</SelectItem>
                  {estadoConfiguracionMaquinaItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Quitar filtros"
            onClick={limpiarFiltros}
          >
            <XIcon />
          </Button>
        </div>
      ) : null}

      <div className="card">
        <Table className="maq-tabla">
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Centro de costos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Configuración</TableHead>
              <TableHead className="text-right">Perfiles</TableHead>
              <TableHead className="sticky-right text-right">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {maquinas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="maq-vacio">
                  <div>
                    {sinResultadosPorFiltros
                      ? "Ninguna máquina coincide con los filtros."
                      : "Todavía no hay máquinas registradas."}
                  </div>
                  {sinResultadosPorFiltros ? (
                    <Button variant="link" onClick={limpiarFiltros}>
                      Quitar filtros
                    </Button>
                  ) : puedeGestionar ? (
                    <Button variant="link" onClick={abrirAlta}>
                      Crear la primera máquina
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ) : null}
            {maquinas.map((maquina) => (
              <TableRow
                key={maquina.id}
                className={cn(!maquina.activo && "maq-inactiva")}
              >
                <TableCell>
                  <Link
                    href={`/costos/maquinaria/${maquina.id}`}
                    className="name hover:underline"
                  >
                    {maquina.nombre}
                  </Link>
                  {maquina.fabricante || maquina.modelo ? (
                    <div className="text-xs text-muted-foreground">
                      {[maquina.fabricante, maquina.modelo]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell
                  className="maq-tipo"
                  title={getMachineTechnologyLabel(maquina)}
                >
                  <span
                    className="maq-punto"
                    style={{ background: getMachineTechColor(maquina) }}
                  />
                  {getPlantillaMaquinariaLabel(maquina.plantilla)}
                </TableCell>
                <TableCell>
                  {maquina.centroCostoPrincipalNombre || "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      maquina.estado === "activa" ? "secondary" : "outline"
                    }
                  >
                    {getEstadoMaquinaLabel(maquina.estado)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div
                    className="flex flex-col items-start gap-1"
                    title={maquina.diagnosticoConfiguracion.faltantes
                      .map((faltante) => faltante.mensaje)
                      .join("\n")}
                  >
                    <Badge
                      variant={
                        maquina.estadoConfiguracion === "lista"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {getEstadoConfiguracionMaquinaLabel(
                        maquina.estadoConfiguracion,
                      )}
                    </Badge>
                    {maquina.diagnosticoConfiguracion.faltantes.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {maquina.diagnosticoConfiguracion.faltantes.length}{" "}
                        {maquina.diagnosticoConfiguracion.faltantes.length === 1
                          ? "pendiente"
                          : "pendientes"}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right numeric">
                  {maquina.perfilesCount}
                </TableCell>
                <TableCell className="sticky-right text-right">
                  <div className="centros-actions justify-end">
                    <Link
                      href={`/costos/maquinaria/${maquina.id}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      {puedeGestionar ? "Editar" : "Ver"}
                    </Link>
                    {puedeGestionar ? (
                      maquina.activo ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Desactivar ${maquina.nombre}`}
                          title="Desactivar"
                          disabled={cambiandoId === maquina.id}
                          onClick={() => setMaquinaADesactivar(maquina)}
                        >
                          <PowerIcon />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Activar ${maquina.nombre}`}
                          title={
                            maquina.estadoConfiguracion === "lista"
                              ? "Activar"
                              : (maquina.diagnosticoConfiguracion.faltantes[0]
                                  ?.mensaje ??
                                "Completá la configuración antes de activar")
                          }
                          disabled={
                            cambiandoId === maquina.id ||
                            maquina.estadoConfiguracion !== "lista"
                          }
                          onClick={() => void cambiarActivo(maquina, true)}
                        >
                          <RotateCcwIcon />
                        </Button>
                      )
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {initialPage.pages > 1 ? (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {initialPage.total} máquinas · página {initialPage.page} de{" "}
            {initialPage.pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={initialPage.page <= 1}
              onClick={() =>
                navegarConFiltros(filtrosActuales(), initialPage.page - 1)
              }
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={initialPage.page >= initialPage.pages}
              onClick={() =>
                navegarConFiltros(filtrosActuales(), initialPage.page + 1)
              }
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      <MaquinaAltaDialog
        open={altaAbierta}
        onClose={cerrarAlta}
        plantas={plantas}
      />
      <ConfirmacionDestructiva
        open={maquinaADesactivar !== null}
        onOpenChange={(open) => {
          if (!open) setMaquinaADesactivar(null);
        }}
        titulo="Desactivar máquina"
        descripcion={`¿Desactivar "${maquinaADesactivar?.nombre ?? ""}"? Dejará de estar disponible para productos y producción.`}
        nombreItem={maquinaADesactivar?.nombre}
        requiereTipear={false}
        accionLabel="Desactivar"
        onConfirmar={async () => {
          const maquina = maquinaADesactivar;
          if (!maquina) return;
          setMaquinaADesactivar(null);
          await cambiarActivo(maquina, false);
        }}
      />
    </div>
  );
}
