"use client";
import styles from "./maquinaria.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import { SelectField } from "@/components/design-system/select-field";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FilterIcon,
  ArrowUpRightIcon,
  CogIcon,
  CircleCheckIcon,
  ClipboardListIcon,
  SearchXIcon,
  PowerIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { MaquinaAltaDialog } from "./maquina-editor/maquina-alta-dialog";
import { MaquinariaPlantillaGlyph } from "./maquinaria-plantilla-glyph";

import { Card, Chip, SearchField, Modal } from "@heroui/react";
import { ActionLink } from "@/components/design-system/action-link";
import { FormDialog } from "@/components/design-system/form-dialog";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import brand from "@/components/crm/contactos-workspace.module.css";
import { ListMetric } from "@/components/design-system/list-metric";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import listPage from "@/components/design-system/list-page.module.css";
import { ActionButton as Button } from "@/components/design-system/action-button";

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
  const scope = useDesignScope();
  const theme = useDesignTheme();
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
    <section
      {...scope}
      data-visual="brand"
      className={`${theme} ${listPage.page} ${styles.page}`}
    >
      <header className={listPage.header}>
        <div>
          <p className={brand.eyebrow}>Costos · Equipamiento del taller</p>
          <h1>
            Maquinaria<span className={brand.titleDot}>.</span>
          </h1>
          <p className={listPage.subtitle}>
            Equipos del taller, perfiles operativos y consumos que intervienen
            en cada proceso.
          </p>
        </div>
        {puedeGestionar ? (
          <Button type="button" onPress={abrirAlta}>
            <ArrowUpRightIcon />
            Nueva máquina
          </Button>
        ) : null}
      </header>
      <div className={brand.metrics} aria-label="Resumen de maquinaria">
        <ListMetric
          label="Máquinas"
          value={initialPage.total}
          hint="En el listado filtrado"
          icon={CogIcon}
        />
        <ListMetric
          label="Activas"
          value={
            maquinas.filter((item) => item.activo && item.estado === "activa")
              .length
          }
          hint="En esta página"
          icon={CircleCheckIcon}
        />
        <ListMetric
          label="Por completar"
          value={
            maquinas.filter((item) => item.estadoConfiguracion !== "lista")
              .length
          }
          hint="En esta página"
          icon={ClipboardListIcon}
        />
      </div>
      <Card className={listPage.results}>
        <Card.Header className={brand.directoryHeader}>
          <div className={brand.directoryTitle}>
            <span className={brand.directoryIcon} aria-hidden="true">
              <CogIcon />
            </span>
            <div>
              <Card.Title className={brand.directoryHeading}>
                Equipos y configuración
              </Card.Title>
              <Card.Description>
                Estado, perfiles y centro de costo de cada máquina.
              </Card.Description>
            </div>
          </div>
        </Card.Header>
        <div className={listPage.toolbar}>
          <SearchField
            aria-label="Buscar máquina"
            value={filterText}
            onChange={setFilterText}
            className={styles.search}
          >
            <SearchField.Group
              className={`${listPage.searchGroup} ${focus.singleBorder}`}
            >
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar por nombre, fabricante, modelo o ubicación" />
              <SearchField.ClearButton aria-label="Limpiar búsqueda" />
            </SearchField.Group>
          </SearchField>
          <div className={`${styles["maq-acciones"]}`}>
            <Button
              type="button"
              variant="outline"
              aria-expanded={filtroAbierto}
              onClick={() => setFiltroAbierto((current) => !current)}
            >
              <FilterIcon data-icon="inline-start" />
              Filtrar
            </Button>
          </div>
        </div>

        {filtroAbierto ? (
          <div className={`${styles["maq-filtros"]}`}>
            <div className={`${styles["maq-filtros-grupo"]}`}>
              <SelectField
                value={filterPlantilla}
                onChange={(value) => {
                  const plantilla = (value ?? ALL) as
                    | PlantillaMaquinaria
                    | typeof ALL;
                  setFilterPlantilla(plantilla);
                  navegarConFiltros({
                    ...filtrosActuales(),
                    plantilla: plantilla === ALL ? undefined : plantilla,
                  });
                }}
                aria-label="Tipo de máquina"
                options={[
                  { value: ALL, label: "Todos los tipos" },
                  ...(maquinariaTemplates.map((template) => ({
                    value: template.id,
                    label: template.label,
                  })) ?? []),
                ]}
              />

              <SelectField
                value={filterEstado}
                onChange={(value) => {
                  const estado = (value ?? ALL) as EstadoMaquina | typeof ALL;
                  setFilterEstado(estado);
                  navegarConFiltros({
                    ...filtrosActuales(),
                    estado: estado === ALL ? undefined : estado,
                  });
                }}
                aria-label="Estado operativo"
                options={[
                  { value: ALL, label: "Todos los estados" },
                  ...(estadoMaquinaItems.map((item) => ({
                    value: item.value,
                    label: item.label,
                  })) ?? []),
                ]}
              />

              <SelectField
                value={filterConfiguracion}
                onChange={(value) => {
                  const config = (value ?? ALL) as
                    | EstadoConfiguracionMaquina
                    | typeof ALL;
                  setFilterConfiguracion(config);
                  navegarConFiltros({
                    ...filtrosActuales(),
                    estadoConfiguracion: config === ALL ? undefined : config,
                  });
                }}
                aria-label="Estado de configuración"
                options={[
                  { value: ALL, label: "Cualquier configuración" },
                  ...(estadoConfiguracionMaquinaItems.map((item) => ({
                    value: item.value,
                    label: item.label,
                  })) ?? []),
                ]}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              isIconOnly
              aria-label="Quitar filtros"
              onClick={limpiarFiltros}
            >
              <XIcon />
            </Button>
          </div>
        ) : null}

        {maquinas.length === 0 ? (
          <Empty className={brand.empty}>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {sinResultadosPorFiltros ? <SearchXIcon /> : <CogIcon />}
              </EmptyMedia>
              <EmptyTitle>
                {sinResultadosPorFiltros
                  ? "No encontramos máquinas"
                  : "Tu equipamiento empieza acá"}
              </EmptyTitle>
              <EmptyDescription>
                {sinResultadosPorFiltros
                  ? "Probá con otro nombre o ajustá los filtros."
                  : "Registrá los equipos del taller para configurar sus perfiles y consumos."}
              </EmptyDescription>
            </EmptyHeader>
            {sinResultadosPorFiltros || puedeGestionar ? (
              <EmptyContent>
                <Button
                  variant="outline"
                  onClick={sinResultadosPorFiltros ? limpiarFiltros : abrirAlta}
                >
                  {sinResultadosPorFiltros
                    ? "Quitar filtros"
                    : "Crear la primera máquina"}
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        ) : (
          <div className={styles.tableScroll}>
            <table className={`${styles["maq-tabla"]}`}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Centro de costos</th>
                  <th>Estado</th>
                  <th>Configuración</th>
                  <th className="text-right">Perfiles</th>
                  <th className="sticky-right text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {maquinas.map((maquina) => (
                  <tr
                    key={maquina.id}
                    className={cn(!maquina.activo && styles["maq-inactiva"])}
                  >
                    <td>
                      <div className={styles.machineIdentity}>
                        <span
                          className={styles.machineIllustration}
                          aria-hidden="true"
                        >
                          <MaquinariaPlantillaGlyph
                            plantilla={maquina.plantilla}
                          />
                        </span>
                        <div>
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
                        </div>
                      </div>
                    </td>
                    <td
                      className={`${styles["maq-tipo"]}`}
                      title={getMachineTechnologyLabel(maquina)}
                    >
                      <span
                        className={`${styles["maq-punto"]}`}
                        style={{ background: getMachineTechColor(maquina) }}
                      />
                      {getPlantillaMaquinariaLabel(maquina.plantilla)}
                    </td>
                    <td>{maquina.centroCostoPrincipalNombre || "—"}</td>
                    <td>
                      <Chip
                        size="sm"
                        color={
                          maquina.estado === "activa" ? "success" : "default"
                        }
                      >
                        {getEstadoMaquinaLabel(maquina.estado)}
                      </Chip>
                    </td>
                    <td>
                      <div
                        className="flex flex-col items-start gap-1"
                        title={maquina.diagnosticoConfiguracion.faltantes
                          .map((faltante) => faltante.mensaje)
                          .join("\n")}
                      >
                        <Chip
                          size="sm"
                          color={
                            maquina.estadoConfiguracion === "lista"
                              ? "success"
                              : "warning"
                          }
                        >
                          {getEstadoConfiguracionMaquinaLabel(
                            maquina.estadoConfiguracion,
                          )}
                        </Chip>
                        {maquina.diagnosticoConfiguracion.faltantes.length >
                        0 ? (
                          <span className="text-xs text-muted-foreground">
                            {maquina.diagnosticoConfiguracion.faltantes.length}{" "}
                            {maquina.diagnosticoConfiguracion.faltantes
                              .length === 1
                              ? "pendiente"
                              : "pendientes"}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="text-right numeric">
                      {maquina.perfilesCount}
                    </td>
                    <td className="sticky-right text-right">
                      <div className={styles.actions}>
                        <ActionLink
                          href={`/costos/maquinaria/${maquina.id}`}
                          variant="outline"
                        >
                          {puedeGestionar ? "Editar" : "Ver"}
                        </ActionLink>
                        {puedeGestionar ? (
                          maquina.activo ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              isIconOnly
                              aria-label={`Desactivar ${maquina.nombre}`}
                              title="Desactivar"
                              isDisabled={cambiandoId === maquina.id}
                              onClick={() => setMaquinaADesactivar(maquina)}
                            >
                              <PowerIcon />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              isIconOnly
                              aria-label={`Activar ${maquina.nombre}`}
                              title={
                                maquina.estadoConfiguracion === "lista"
                                  ? "Activar"
                                  : (maquina.diagnosticoConfiguracion
                                      .faltantes[0]?.mensaje ??
                                    "Completá la configuración antes de activar")
                              }
                              isDisabled={
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
              isDisabled={initialPage.page <= 1}
              onClick={() =>
                navegarConFiltros(filtrosActuales(), initialPage.page - 1)
              }
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={initialPage.page >= initialPage.pages}
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
      <FormDialog
        isOpen={maquinaADesactivar !== null}
        onOpenChange={(open) => {
          if (!open) setMaquinaADesactivar(null);
        }}
        className={brand.dialog}
        title="Desactivar máquina"
        description={`¿Desactivar "${maquinaADesactivar?.nombre ?? ""}"? Dejará de estar disponible para productos y producción.`}
      >
        <Modal.Footer className={styles.modalFooter}>
          <Button variant="outline" onPress={() => setMaquinaADesactivar(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onPress={async () => {
              const maquina = maquinaADesactivar;
              if (!maquina) return;
              setMaquinaADesactivar(null);
              await cambiarActivo(maquina, false);
            }}
          >
            Desactivar
          </Button>
        </Modal.Footer>
      </FormDialog>
    </section>
  );
}
