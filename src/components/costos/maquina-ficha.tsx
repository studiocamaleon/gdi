"use client";
import styles from "./maquinaria.module.css";
/**
 * Ficha por máquina — Fase C de la migración de UI de Maquinaria
 * (estilo Holdprint): breadcrumb, tabs Descripción | Ajustes | Historial
 * y botonera fija abajo. Reemplaza al sheet para EDITAR; el alta sigue
 * su propio camino (diálogo en la lista).
 *
 * El estado y el cuerpo del form son los mismos del editor extraído en
 * la Fase B (useMaquinaEditor + MaquinaEditorIdentidad/Secciones).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CircleAlertIcon,
  CogIcon,
  Settings2Icon,
  HistoryIcon,
  FactoryIcon,
  PowerIcon,
  LayersIcon,
  ChevronRightIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ActionButton as Button } from "@/components/design-system/action-button";
import { Card, Chip, Tabs, Modal } from "@heroui/react";
import { FormDialog } from "@/components/design-system/form-dialog";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import brand from "@/components/crm/contactos-workspace.module.css";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import listPage from "@/components/design-system/list-page.module.css";
import { MaquinariaEdicion } from "./maquina-editor/maquinaria-edicion";

import type { CentroCosto, Planta } from "@/lib/costos";
import { fechaHora } from "@/lib/fecha";
import {
  getEstadoMaquinaLabel,
  type Maquina,
  type MaquinaHistorialEvento,
} from "@/lib/maquinaria";
import { updateMaquina } from "@/lib/maquinaria-api";
import { getPlantillaMaquinariaLabel } from "@/lib/maquinaria-templates";

import {
  MaquinaEditorIdentidad,
  MaquinaEditorSecciones,
} from "./maquina-editor/maquina-editor-form";
import { useMaquinaEditor } from "./maquina-editor/use-maquina-editor";

type TabFicha = "descripcion" | "ajustes" | "historial";

const TABS = [
  {
    id: "descripcion",
    label: "Descripción",
    description: "Identidad y vínculo económico",
    icon: <CogIcon />,
  },
  {
    id: "ajustes",
    label: "Ajustes",
    description: "Capacidad, perfiles y consumos",
    icon: <Settings2Icon />,
  },
  {
    id: "historial",
    label: "Historial",
    description: "Actividad del equipo",
    icon: <HistoryIcon />,
  },
];

type MaquinaFichaProps = {
  maquina: Maquina;
  historial: MaquinaHistorialEvento[];
  plantas: Planta[];
  centrosCosto: CentroCosto[];
  puedeGestionar: boolean;
};

export function MaquinaFicha({
  maquina,
  historial,
  plantas,
  centrosCosto,
  puedeGestionar,
}: MaquinaFichaProps) {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const router = useRouter();
  const [tab, setTab] = React.useState<TabFicha>("descripcion");
  const [saving, setSaving] = React.useState(false);
  // El nombre del header no sigue al input: es el de la máquina guardada.
  const [nombreGuardado, setNombreGuardado] = React.useState(maquina.nombre);

  const editor = useMaquinaEditor({
    maquina,
    cargarMaterias: tab === "ajustes",
  });

  const handleGuardar = async (): Promise<boolean> => {
    if (!editor.form.nombre.trim()) {
      toast.error("La máquina necesita un nombre");
      return false;
    }
    setSaving(true);
    try {
      const payload = editor.buildPayload();
      const updated = await updateMaquina(maquina.id, {
        ...payload,
        // El backend deriva incompleta/lista en cada guardado. Así el flujo no
        // depende de interpretar mensajes de error ni necesita dos PUT.
        estadoConfiguracion: undefined,
      });
      setNombreGuardado(updated.nombre);
      // Lo guardado pasa a ser el nuevo punto de comparación.
      editor.marcarGuardado(updated);
      if (updated.estadoConfiguracion === "lista") {
        toast.success(`"${updated.nombre}" actualizada`);
      } else {
        toast.info(
          `"${updated.nombre}" guardada como incompleta. No estará disponible para producción hasta completar su configuración.`,
        );
      }
      router.refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ─── Salir con cambios sin guardar ───────────────────────────────
  const [salidaPendiente, setSalidaPendiente] = React.useState<string | null>(
    null,
  );

  const salir = React.useCallback(
    (destino: string) => {
      if (editor.hayCambios) {
        setSalidaPendiente(destino);
        return;
      }
      router.push(destino);
    },
    [editor.hayCambios, router],
  );

  // La navegación del navegador (cerrar pestaña, atrás) no admite UI propia:
  // el único aviso posible ahí es el nativo.
  React.useEffect(() => {
    if (!editor.hayCambios) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [editor.hayCambios]);

  return (
    // Tres franjas: título+tabs fijos, cuerpo con scroll propio, pie fijo.
    // La barra de acciones NO flota sobre el contenido: el área visible
    // termina justo arriba de ella.
    <>
      <Tabs
        selectedKey={tab}
        onSelectionChange={(value) => setTab(value as TabFicha)}
        {...scope}
        data-visual="brand"
        className={`${theme} ${listPage.page} ${styles.ficha}`}
      >
        <div className={`${styles["maq-ficha-top"]}`}>
          <header className={listPage.header}>
            <div>
              <nav className={styles.breadcrumb} aria-label="Ubicación">
                <button
                  type="button"
                  onClick={() => salir("/costos/centros-de-costo")}
                >
                  Costos
                </button>
                <ChevronRightIcon aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => salir("/costos/maquinaria")}
                >
                  Maquinaria
                </button>
              </nav>
              <h1>
                {nombreGuardado}
                <span className={brand.titleDot}>.</span>
              </h1>
              <p className={listPage.subtitle}>
                {getPlantillaMaquinariaLabel(maquina.plantilla)}
              </p>
            </div>
            <Button
              variant="outline"
              isDisabled={saving}
              onPress={() => salir("/costos/maquinaria")}
            >
              <ArrowLeftIcon />
              Volver a maquinaria
            </Button>
          </header>
          <NavigationTabList
            label="Ficha de máquina"
            items={TABS}
            variant="detailed"
            tone="graphite"
            className={styles.tabs}
          />
        </div>

        <div className={`${styles["maq-ficha-cuerpo"]}`}>
          {tab !== "historial" &&
          maquina.diagnosticoConfiguracion.faltantes.length > 0 ? (
            <Alert className={styles.configurationAlert}>
              <CircleAlertIcon />
              <AlertTitle>
                {maquina.diagnosticoConfiguracion.faltantes.length === 1
                  ? "Falta 1 dato para activar esta máquina"
                  : `Faltan ${maquina.diagnosticoConfiguracion.faltantes.length} datos para activar esta máquina`}
              </AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <ul className="list-disc pl-4">
                  {maquina.diagnosticoConfiguracion.faltantes.map(
                    (faltante) => (
                      <li key={faltante.codigo}>{faltante.mensaje}</li>
                    ),
                  )}
                </ul>
                {tab !== "ajustes" &&
                maquina.diagnosticoConfiguracion.faltantes.some(
                  (faltante) => faltante.seccion === "ajustes",
                ) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => setTab("ajustes")}
                  >
                    Ir a Ajustes
                    <ArrowUpRightIcon data-icon="inline-end" />
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <Tabs.Panel id="descripcion" className={styles.descriptionPanel}>
            <div
              className={`${brand.recordSummary} ${styles.recordSummary}`}
              aria-label="Resumen de la máquina"
            >
              <div>
                <PowerIcon aria-hidden="true" />
                <dl>
                  <dt>Estado del equipo</dt>
                  <dd>{getEstadoMaquinaLabel(editor.form.estado)}</dd>
                </dl>
              </div>
              <div>
                <FactoryIcon aria-hidden="true" />
                <dl>
                  <dt>Centro de costo</dt>
                  <dd>
                    {centrosCosto.find(
                      (centro) =>
                        centro.id === editor.form.centroCostoPrincipalId,
                    )?.nombre || "Sin asignar"}
                  </dd>
                </dl>
              </div>
              <div>
                <LayersIcon aria-hidden="true" />
                <dl>
                  <dt>Perfiles configurados</dt>
                  <dd>{editor.perfiles.length}</dd>
                </dl>
              </div>
            </div>
            <MaquinariaEdicion puedeGestionar={puedeGestionar}>
              <MaquinaEditorIdentidad
                editor={editor}
                plantas={plantas}
                centrosCosto={centrosCosto}
              />
            </MaquinariaEdicion>
          </Tabs.Panel>

          <Tabs.Panel id="ajustes">
            <MaquinariaEdicion puedeGestionar={puedeGestionar}>
              <MaquinaEditorSecciones editor={editor} />
            </MaquinariaEdicion>
          </Tabs.Panel>

          <Tabs.Panel id="historial">
            <Card className={`${styles.card} ${styles.history}`}>
              <Card.Header>
                <Card.Title>
                  <HistoryIcon aria-hidden="true" /> Historial de la máquina
                </Card.Title>
                <Card.Description>
                  Altas, cambios de configuración y disponibilidad del equipo.
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <dl>
                  <div className="fila">
                    <dt>Alta en el sistema</dt>
                    <dd>{fechaHora(maquina.fechaAlta || maquina.createdAt)}</dd>
                  </div>
                  <div className="fila">
                    <dt>Última modificación</dt>
                    <dd>{fechaHora(maquina.updatedAt)}</dd>
                  </div>
                  <div className="fila">
                    <dt>Estado actual</dt>
                    <dd>{getEstadoMaquinaLabel(maquina.estado)}</dd>
                  </div>
                  <div className="fila">
                    <dt>Tipo</dt>
                    <dd>{getPlantillaMaquinariaLabel(maquina.plantilla)}</dd>
                  </div>
                </dl>
                <div>
                  <h2 className={styles.activityTitle}>Actividad registrada</h2>
                  {historial.length > 0 ? (
                    <ol
                      className={brand.historyList}
                      aria-label="Historial de cambios"
                    >
                      {historial.map((evento) => (
                        <li key={evento.id} className={styles.historyEvent}>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Chip
                                size="sm"
                                variant="soft"
                                className="capitalize"
                              >
                                {evento.accion}
                              </Chip>
                              <span className="text-sm font-medium">
                                {evento.actorNombre}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {evento.descripcion}
                            </p>
                          </div>
                          <time
                            dateTime={evento.createdAt}
                            className="shrink-0 text-xs text-muted-foreground"
                          >
                            {fechaHora(evento.createdAt)}
                          </time>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Empty className={styles.sectionEmpty}>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <HistoryIcon />
                        </EmptyMedia>
                        <EmptyTitle>Sin actividad registrada</EmptyTitle>
                        <EmptyDescription>
                          La auditoría comienza con la próxima edición o cambio
                          de disponibilidad.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </div>
              </Card.Content>
            </Card>
          </Tabs.Panel>
        </div>

        {tab !== "historial" && puedeGestionar ? (
          <div className={`${styles["maq-ficha-pie"]}`}>
            <span className={styles.saveState} data-dirty={editor.hayCambios}>
              {saving
                ? "Guardando cambios…"
                : editor.hayCambios
                  ? "Cambios sin guardar"
                  : "Sin cambios pendientes"}
            </span>
            <Button
              variant="outline"
              onClick={() => salir("/costos/maquinaria")}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleGuardar()}
              isDisabled={saving || !editor.hayCambios}
              title={
                editor.hayCambios ? undefined : "No hay cambios para guardar"
              }
            >
              <ArrowUpRightIcon />
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        ) : null}

        {!puedeGestionar && tab !== "historial" ? (
          <div className={`${styles["maq-ficha-pie"]}`}>
            <Chip size="sm">Sólo lectura</Chip>
            <Button
              variant="outline"
              onClick={() => salir("/costos/maquinaria")}
            >
              Volver
            </Button>
          </div>
        ) : null}
      </Tabs>
      {/* El portal queda fuera de Tabs: su colección también renderiza los hijos
          auxiliares y montaría una segunda confirmación invisible. */}
      <FormDialog
        isOpen={salidaPendiente !== null}
        onOpenChange={(open) => {
          if (!open) setSalidaPendiente(null);
        }}
        isDismissable={!saving}
        className={brand.dialog}
        title="Cambios sin guardar"
        description="Tenés cambios sin guardar en esta máquina. Si salís sin guardar, se descartan."
      >
        <Modal.Footer className={styles.modalFooter}>
          <Button
            variant="ghost"
            isDisabled={saving}
            onPress={() => setSalidaPendiente(null)}
          >
            Seguir editando
          </Button>
          <Button
            variant="outline"
            isDisabled={saving}
            onPress={() => {
              const destino = salidaPendiente;
              setSalidaPendiente(null);
              if (destino) router.push(destino);
            }}
          >
            Descartar y salir
          </Button>
          <Button
            isDisabled={saving}
            onPress={async () => {
              const destino = salidaPendiente;
              const ok = await handleGuardar();
              setSalidaPendiente(null);
              if (ok && destino) router.push(destino);
            }}
          >
            {saving ? "Guardando…" : "Guardar y salir"}
          </Button>
        </Modal.Footer>
      </FormDialog>
    </>
  );
}
