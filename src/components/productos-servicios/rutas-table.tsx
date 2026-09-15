"use client";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Card, Chip, Input, Modal, SearchField, Tooltip } from "@heroui/react";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import { FormDialog } from "@/components/design-system/form-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useDesignScope } from "@/components/design-system/appearance";
import theme from "@/components/design-system/theme.module.css";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import styles from "./flujos.module.css";
import * as React from "react";
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
  const scope = useDesignScope();
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
    <Tooltip delay={200}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Ver flujo de producción de ${ruta.nombre}: ${nodos.length} ${nodos.length === 1 ? "nodo" : "nodos"}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <RouteIcon data-icon="inline-start" />
        {nodos.length} {nodos.length === 1 ? "nodo" : "nodos"} · {topologia}
      </Button>
      <Tooltip.Content
        {...scope}
        placement="bottom start"
        className={`${theme.theme} ${styles.preview}`}
      >
        <p className="mb-2 font-medium">Flujo de producción reutilizable</p>
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
      </Tooltip.Content>
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
  const scope = useDesignScope();
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

  const abrirDuplicarRuta = (event: React.MouseEvent, ruta: RutaListItem) => {
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
      toast.success(`Flujo "${rutaADuplicar.nombre}" duplicado`);
      setRutaADuplicar(null);
      setNombreCopia("");
      router.refresh();
      router.push(`/productos-servicios/rutas/${duplicada.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo duplicar el flujo",
      );
    } finally {
      setDuplicandoId(null);
    }
  };

  return (
    <main {...scope} className={`${theme.theme} ${listPage.page}`}>
      <header className={listPage.header}>
        <div>
          <h1>Flujos de producción</h1>
          <p className={listPage.subtitle}>
            {rutas.length} flujos reutilizables. Organizá nodos, componentes y
            secuencias para fabricar tus productos.
          </p>
        </div>
        {puedeGestionar && (
          <ActionLink href="/productos-servicios/rutas/nueva">
            <PlusIcon />
            Nuevo flujo
          </ActionLink>
        )}
      </header>
      <Card className={listPage.results}>
        {rutas.length === 0 ? (
          <div className={listPage.empty}>
            <RouteIcon className="size-7" />
            <h2>Sin flujos cargados</h2>
            <p>
              Los flujos organizan la producción y se pueden reutilizar. Empezá
              creando uno desde cero.
            </p>
            {puedeGestionar && (
              <ActionLink href="/productos-servicios/rutas/nueva">
                <PlusIcon />
                Crear flujo
              </ActionLink>
            )}
          </div>
        ) : (
          <>
            <div className={listPage.toolbar}>
              <div className={styles.listTitle}>
                <strong>Flujos</strong>
                <span>
                  {rutasFiltradas.length} de {rutas.length}
                </span>
              </div>
              <SegmentedControl
                aria-label="Filtrar flujos por estado"
                value={estadoFiltro}
                options={[
                  { value: "activas", label: "Activos", icon: null },
                  { value: "inactivas", label: "Inactivos", icon: null },
                  { value: "todas", label: "Todos", icon: null },
                ]}
                onChange={(value) => setEstadoFiltro(value as EstadoFiltro)}
              />
              <SearchField
                className={styles.search}
                aria-label="Buscar flujo o nodo"
                value={search}
                onChange={setSearch}
              >
                <SearchField.Group className={focus.singleBorder}>
                  <SearchField.SearchIcon>
                    <SearchIcon />
                  </SearchField.SearchIcon>
                  <SearchField.Input placeholder="Buscar flujo o nodo..." />
                  <SearchField.ClearButton aria-label="Limpiar búsqueda" />
                </SearchField.Group>
              </SearchField>
            </div>
            {rutasFiltradas.length === 0 ? (
              <div className={listPage.empty}>
                <SearchIcon className="size-6" />
                <h2>Ningún flujo coincide</h2>
                <p>Probá con otros términos de búsqueda.</p>
              </div>
            ) : (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Recorrido</th>
                      <th className={styles.numeric}>Versión</th>
                      <th className={styles.numeric}>Productos que lo usan</th>
                      <th className={styles.numeric}>Acciones</th>
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
                            <span className={styles.name}>{ruta.nombre}</span>
                            {!ruta.activo && (
                              <Chip size="sm" variant="soft">
                                Inactiva
                              </Chip>
                            )}
                          </div>
                          {ruta.descripcion && (
                            <p className={styles.description}>
                              {ruta.descripcion}
                            </p>
                          )}
                        </td>
                        <td>
                          <RoutePreview
                            ruta={ruta}
                            familiaLabel={familiaLabel}
                          />
                        </td>
                        <td className={styles.numeric}>
                          <Chip size="sm" variant="soft">
                            v{ruta.versionActual}
                          </Chip>
                        </td>
                        <td className={styles.numeric}>
                          <span className={styles.usage}>
                            <GitBranchIcon className="size-3.5" />
                            {ruta._count.productosAlternativas}
                          </span>
                        </td>
                        <td className={styles.numeric}>
                          {puedeGestionar ? (
                            <div className={styles.actions}>
                              <Button
                                variant="ghost"
                                isIconOnly
                                aria-label={`Duplicar ${ruta.nombre}`}
                                title="Duplicar"
                                isDisabled={duplicandoId === ruta.id}
                                onClick={(event) =>
                                  abrirDuplicarRuta(event, ruta)
                                }
                              >
                                {duplicandoId === ruta.id ? (
                                  <GdiSpinner size={13} className="size-4" />
                                ) : (
                                  <CopyIcon />
                                )}
                              </Button>
                              <ActionLink
                                variant="outline"
                                className={styles.iconLink}
                                href={`/productos-servicios/rutas/${ruta.id}`}
                                aria-label={`Ver detalle de ${ruta.nombre}`}
                                title="Ver detalle"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <ArrowRightIcon />
                              </ActionLink>
                            </div>
                          ) : (
                            <span className={styles.description}>
                              Solo lectura
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>
      <FormDialog
        isOpen={Boolean(rutaADuplicar)}
        isDismissable={!duplicandoId}
        onOpenChange={(open) => {
          if (duplicandoId) return;
          if (!open) {
            setRutaADuplicar(null);
            setNombreCopia("");
          }
        }}
        title="Duplicar flujo de producción"
        description="Definí el nombre de la copia. Se copiará el flujo de producción completo de la versión actual, incluidos sus nodos compuestos, componentes y paralelismos, para que puedas revisarlo antes de usarlo."
      >
        <form onSubmit={handleDuplicarRuta} className={styles.dialogForm}>
          <Modal.Body className={styles.dialogBody}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="nombre-copia-ruta">
                  Nombre de la copia
                </FieldLabel>
                <Input
                  className={focus.singleBorder}
                  id="nombre-copia-ruta"
                  autoFocus
                  value={nombreCopia}
                  onChange={(event) => setNombreCopia(event.target.value)}
                  placeholder="Nombre del nuevo flujo"
                  disabled={Boolean(duplicandoId)}
                />
              </Field>
            </FieldGroup>
          </Modal.Body>
          <Modal.Footer className={styles.dialogFooter}>
            <Button
              variant="outline"
              isDisabled={Boolean(duplicandoId)}
              onPress={() => {
                setRutaADuplicar(null);
                setNombreCopia("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              isPending={Boolean(duplicandoId)}
              isDisabled={!nombreCopia.trim() || Boolean(duplicandoId)}
            >
              Duplicar flujo
            </Button>
          </Modal.Footer>
        </form>
      </FormDialog>
    </main>
  );
}
