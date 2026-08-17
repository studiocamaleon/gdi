"use client";

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
import { ArrowRightIcon, CircleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmacionSalida } from "@/components/ui/confirmacion-salida";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const TABS: Array<{ id: TabFicha; label: string }> = [
  { id: "descripcion", label: "Descripción" },
  { id: "ajustes", label: "Ajustes" },
  { id: "historial", label: "Historial" },
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
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as TabFicha)}
      className="maq-ficha"
    >
      <div className="maq-ficha-top">
        <div className="page-head">
          <div className="title-block">
            <h1>{nombreGuardado}</h1>
            <nav className="maq-migas" aria-label="Ubicación">
              <button
                type="button"
                onClick={() => salir("/costos/centros-de-costo")}
              >
                Costos
              </button>
              <span className="sep">/</span>
              <button type="button" onClick={() => salir("/costos/maquinaria")}>
                Maquinaria
              </button>
              <span className="sep">/</span>
              <span aria-current="page">{nombreGuardado}</span>
            </nav>
          </div>
        </div>

        <TabsList variant="line" className="maq-ficha-tabs">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="maq-ficha-tab">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <div className="maq-ficha-cuerpo">
        {tab !== "historial" &&
        maquina.diagnosticoConfiguracion.faltantes.length > 0 ? (
          <Alert>
            <CircleAlertIcon />
            <AlertTitle>
              {maquina.diagnosticoConfiguracion.faltantes.length === 1
                ? "Falta 1 dato para activar esta máquina"
                : `Faltan ${maquina.diagnosticoConfiguracion.faltantes.length} datos para activar esta máquina`}
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <ul className="list-disc pl-4">
                {maquina.diagnosticoConfiguracion.faltantes.map((faltante) => (
                  <li key={faltante.codigo}>{faltante.mensaje}</li>
                ))}
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
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <TabsContent value="descripcion">
          <fieldset disabled={!puedeGestionar} className="flex flex-col gap-4">
            <MaquinaEditorIdentidad
              editor={editor}
              plantas={plantas}
              centrosCosto={centrosCosto}
            />
          </fieldset>
        </TabsContent>

        <TabsContent value="ajustes">
          <fieldset disabled={!puedeGestionar} className="flex flex-col gap-4">
            <MaquinaEditorSecciones editor={editor} />
          </fieldset>
        </TabsContent>

        <TabsContent value="historial">
          <div className="card maq-historial space-y-5">
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
              <h2 className="text-sm font-semibold">Actividad registrada</h2>
              {historial.length > 0 ? (
                <ol className="mt-3 divide-y" aria-label="Historial de cambios">
                  {historial.map((evento) => (
                    <li key={evento.id} className="flex gap-3 py-3 first:pt-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {evento.accion}
                          </Badge>
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
                <p className="mt-2 text-sm text-muted-foreground">
                  Todavía no hay cambios registrados. La auditoría comienza con
                  la próxima edición o cambio de disponibilidad.
                </p>
              )}
            </div>
          </div>
        </TabsContent>
      </div>

      {tab !== "historial" && puedeGestionar ? (
        <div className="maq-ficha-pie">
          <Button variant="outline" onClick={() => salir("/costos/maquinaria")}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleGuardar()}
            disabled={saving || !editor.hayCambios}
            title={
              editor.hayCambios ? undefined : "No hay cambios para guardar"
            }
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      ) : null}

      {!puedeGestionar && tab !== "historial" ? (
        <div className="maq-ficha-pie">
          <Badge variant="secondary">Sólo lectura</Badge>
          <Button variant="outline" onClick={() => salir("/costos/maquinaria")}>
            Volver
          </Button>
        </div>
      ) : null}

      <ConfirmacionSalida
        open={salidaPendiente !== null}
        cambios={1}
        donde="esta máquina"
        guardando={saving}
        onGuardarYSalir={async () => {
          const destino = salidaPendiente;
          const ok = await handleGuardar();
          setSalidaPendiente(null);
          if (ok && destino) router.push(destino);
        }}
        onDescartarYSalir={() => {
          const destino = salidaPendiente;
          setSalidaPendiente(null);
          if (destino) router.push(destino);
        }}
        onSeguirEditando={() => setSalidaPendiente(null)}
      />
    </Tabs>
  );
}
