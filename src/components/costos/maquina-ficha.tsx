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
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmacionSalida } from "@/components/ui/confirmacion-salida";
import type { CentroCosto, Planta } from "@/lib/costos";
import { fechaHora } from "@/lib/fecha";
import {
  getEstadoMaquinaLabel,
  type Maquina,
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
  plantas: Planta[];
  centrosCosto: CentroCosto[];
};

export function MaquinaFicha({ maquina, plantas, centrosCosto }: MaquinaFichaProps) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabFicha>("descripcion");
  const [saving, setSaving] = React.useState(false);
  // El nombre del header no sigue al input: es el de la máquina guardada.
  const [nombreGuardado, setNombreGuardado] = React.useState(maquina.nombre);

  const editor = useMaquinaEditor({ maquina });

  const handleGuardar = async (): Promise<boolean> => {
    if (!editor.form.nombre.trim()) {
      toast.error("La máquina necesita un nombre");
      return false;
    }
    setSaving(true);
    try {
      const payload = editor.buildPayload();
      const esBorrador = payload.estadoConfiguracion === "borrador";
      let updated;
      if (!esBorrador) {
        updated = await updateMaquina(maquina.id, payload);
      } else {
        // Un borrador intenta graduarse: sin la marca, el API deriva el
        // estado (incompleta/lista) validando los campos de la plantilla.
        // Si todavía faltan, se guarda igual COMO borrador — la gracia del
        // flujo es poder completar la ficha de a poco.
        try {
          updated = await updateMaquina(maquina.id, {
            ...payload,
            estadoConfiguracion: undefined,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (!msg.includes("debe completar los campos")) throw err;
          updated = await updateMaquina(maquina.id, payload);
          toast.info(
            `Guardada como borrador. ${msg.replace("La maquina debe", "Para dejarla operativa debe")}`,
          );
        }
      }
      setNombreGuardado(updated.nombre);
      // Lo guardado pasa a ser el nuevo punto de comparación.
      editor.marcarGuardado(payload);
      if (updated.estadoConfiguracion !== "borrador") {
        toast.success(`"${updated.nombre}" actualizada`);
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
    <div className="maq-ficha">
      <div className="maq-ficha-top">
        <div className="page-head">
          <div className="title-block">
            <h1>{nombreGuardado}</h1>
            <nav className="maq-migas" aria-label="Ubicación">
              <button type="button" onClick={() => salir("/costos/centros-de-costo")}>
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

        <div className="maq-ficha-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`maq-ficha-tab ${tab === t.id ? "activo" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="maq-ficha-cuerpo">
        {tab === "descripcion" ? (
          <div className="space-y-4">
            <MaquinaEditorIdentidad
              editor={editor}
              plantas={plantas}
              centrosCosto={centrosCosto}
            />
          </div>
        ) : null}

        {tab === "ajustes" ? (
          <div className="space-y-4">
            <MaquinaEditorSecciones editor={editor} />
          </div>
        ) : null}

        {tab === "historial" ? (
          <div className="card maq-historial">
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
            <p className="nota">
              Todavía no se registra el detalle de cambios campo por campo; acá
              van a aparecer cuando exista esa auditoría.
            </p>
          </div>
        ) : null}
      </div>

      {tab !== "historial" ? (
        <div className="maq-ficha-pie">
          <Button variant="outline" onClick={() => salir("/costos/maquinaria")}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleGuardar()}
            disabled={saving || !editor.hayCambios}
            title={editor.hayCambios ? undefined : "No hay cambios para guardar"}
          >
            {saving ? "Guardando..." : "Guardar"}
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
    </div>
  );
}
