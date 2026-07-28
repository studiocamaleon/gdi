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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

  const editor = useMaquinaEditor({
    defaultPlantaId: maquina.plantaId,
    activo: true,
    initialMaquina: maquina,
  });

  const handleGuardar = async () => {
    if (!editor.form.nombre.trim()) {
      toast.error("La máquina necesita un nombre");
      return;
    }
    setSaving(true);
    try {
      const payload = editor.buildPayload();
      const updated = await updateMaquina(maquina.id, payload);
      setNombreGuardado(updated.nombre);
      toast.success(`"${updated.nombre}" actualizada`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="content maq-ficha">
      <div className="page-head">
        <div className="title-block">
          <h1>{nombreGuardado}</h1>
          <nav className="maq-migas" aria-label="Ubicación">
            <Link href="/costos/centros-de-costo">Costos</Link>
            <span className="sep">/</span>
            <Link href="/costos/maquinaria">Maquinaria</Link>
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

      <div className="maq-ficha-cuerpo">
        {tab === "descripcion" ? (
          <div className="space-y-4">
            <MaquinaEditorIdentidad
              editor={editor}
              plantas={plantas}
              centrosCosto={centrosCosto}
              variante="ficha"
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
          <Button
            variant="outline"
            onClick={() => router.push("/costos/maquinaria")}
          >
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
