"use client";

/**
 * Panel de gestión de máquinas — lista estilo Holdprint + editor en sheet.
 *
 * Fase B de la migración de UI (2026-07-28): el editor (estado, helpers y
 * cuerpo del form) vive en ./maquina-editor/ para que la ficha por máquina
 * de la Fase C use exactamente el mismo. Acá queda la lista, el shell del
 * sheet y las llamadas al API.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  CircleIcon,
  FilterIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  createMaquina,
  toggleMaquina,
  updateMaquina,
} from "@/lib/maquinaria-api";
import type { CentroCosto, Planta } from "@/lib/costos";
import {
  getEstadoMaquinaLabel,
  type Maquina,
  type PlantillaMaquinaria,
} from "@/lib/maquinaria";
import {
  getPlantillaMaquinariaLabel,
  maquinariaTemplates,
} from "@/lib/maquinaria-templates";

import {
  getMachineTechColor,
  getMachineTechnologyLabel,
} from "./maquina-editor/helpers";
import { MaquinaEditorForm } from "./maquina-editor/maquina-editor-form";
import { useMaquinaEditor } from "./maquina-editor/use-maquina-editor";

// ─── Props ──────────────────────────────────────────────────────────

type MaquinariaPanelProps = {
  initialMaquinas: Maquina[];
  plantas: Planta[];
  centrosCosto: CentroCosto[];
  initialEditingId?: string;
  initialCreate?: boolean;
};

// ─── Componente principal ──────────────────────────────────────────

export function MaquinariaPanel({
  initialMaquinas,
  plantas,
  centrosCosto,
  initialEditingId,
  initialCreate = false,
}: MaquinariaPanelProps) {
  const router = useRouter();
  const [maquinas, setMaquinas] = React.useState(initialMaquinas);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [filterText, setFilterText] = React.useState("");
  const [filterPlantilla, setFilterPlantilla] = React.useState<PlantillaMaquinaria | "all">("all");
  const [filterEstado, setFilterEstado] = React.useState<"todas" | "activas" | "inactivas">("todas");
  const [filtroAbierto, setFiltroAbierto] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [maquinaADesactivar, setMaquinaADesactivar] = React.useState<Maquina | null>(null);

  const editor = useMaquinaEditor({
    defaultPlantaId: plantas[0]?.id ?? "",
    activo: isSheetOpen,
  });
  const { initNueva, initDesdeMaquina } = editor;

  React.useEffect(() => {
    setMaquinas(initialMaquinas);
  }, [initialMaquinas]);

  // Filtros aplicados. La tabla lista alfabético (como Holdprint): el
  // agrupado por plantilla que tenían las cards ahora es la columna Tipo.
  const filteredMaquinas = React.useMemo(() => {
    let result = maquinas;
    if (filterText) {
      const q = filterText.toLowerCase();
      result = result.filter(
        (m) =>
          m.nombre.toLowerCase().includes(q),
      );
    }
    if (filterPlantilla !== "all") {
      result = result.filter((m) => m.plantilla === filterPlantilla);
    }
    if (filterEstado !== "todas") {
      result = result.filter((m) =>
        filterEstado === "activas" ? m.activo : !m.activo,
      );
    }
    return [...result].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
    );
  }, [maquinas, filterText, filterPlantilla, filterEstado]);

  const openNueva = React.useCallback(() => {
    setEditingId(null);
    initNueva();
    setIsSheetOpen(true);
  }, [initNueva]);

  const openEditar = React.useCallback((maquina: Maquina) => {
    setEditingId(maquina.id);
    initDesdeMaquina(maquina);
    setIsSheetOpen(true);
  }, [initDesdeMaquina]);

  const updateMaquinariaUrl = React.useCallback((path: string) => {
    window.history.pushState(null, "", path);
  }, []);

  React.useEffect(() => {
    if (initialCreate) {
      openNueva();
      return;
    }
    if (initialEditingId) {
      const maquina = maquinas.find((item) => item.id === initialEditingId);
      if (maquina) openEditar(maquina);
    }
  }, [initialCreate, initialEditingId, maquinas, openEditar, openNueva]);

  const handleNueva = () => {
    openNueva();
    updateMaquinariaUrl("/costos/maquinaria/nueva");
  };

  const handleEditar = (maquina: Maquina) => {
    openEditar(maquina);
    updateMaquinariaUrl(`/costos/maquinaria/${maquina.id}`);
  };

  const handleGuardar = async () => {
    if (!editor.form.nombre.trim()) {
      toast.error("La máquina necesita un nombre");
      return;
    }
    setSaving(true);
    try {
      const payload = editor.buildPayload();
      if (editingId) {
        const updated = await updateMaquina(editingId, payload);
        setMaquinas((prev) => prev.map((m) => (m.id === editingId ? updated : m)));
        toast.success(`"${updated.nombre}" actualizada`);
      } else {
        const created = await createMaquina(payload);
        setMaquinas((prev) => [...prev, created]);
        toast.success(`"${created.nombre}" creada`);
      }
      setIsSheetOpen(false);
      updateMaquinariaUrl("/costos/maquinaria");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (maquina: Maquina) => {
    try {
      const updated = await toggleMaquina(maquina.id);
      setMaquinas((prev) => prev.map((m) => (m.id === maquina.id ? updated : m)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  };

  const handleDesactivar = (maquina: Maquina) => {
    setMaquinaADesactivar(maquina);
  };

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
          <input
            type="search"
            placeholder="Búsqueda"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            aria-label="Buscar máquina"
          />
        </div>
        <div className="maq-acciones">
          <button
            type="button"
            className={`maq-btn ${filtroAbierto ? "activo" : ""}`}
            onClick={() => setFiltroAbierto((v) => !v)}
          >
            <FilterIcon />
            Filtrar
          </button>
          <button
            type="button"
            className="maq-btn maq-btn-primario"
            onClick={handleNueva}
          >
            <PlusIcon />
            Nueva máquina
          </button>
        </div>
      </div>

      {filtroAbierto ? (
        <div className="maq-filtros">
          <div className="maq-filtros-grupo">
            <label className="maq-chip">
              <span>Tipo</span>
              <select
                value={filterPlantilla}
                onChange={(event) =>
                  setFilterPlantilla(event.target.value as PlantillaMaquinaria | "all")
                }
              >
                <option value="all">Todos</option>
                {maquinariaTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="maq-chip">
              <span>Estado</span>
              <select
                value={filterEstado}
                onChange={(e) =>
                  setFilterEstado(e.target.value as "todas" | "activas" | "inactivas")
                }
              >
                <option value="todas">Todas</option>
                <option value="activas">Activas</option>
                <option value="inactivas">Inactivas</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            className="maq-cerrar-filtros"
            aria-label="Quitar filtros"
            onClick={() => {
              setFilterPlantilla("all");
              setFilterEstado("todas");
              setFiltroAbierto(false);
            }}
          >
            <XIcon />
          </button>
        </div>
      ) : null}

      <div className="card tbl-scroll">
        <table className="tbl maq-tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Planta</th>
              <th>Centro de costos</th>
              <th>Estado</th>
              <th className="right">Perfiles</th>
              <th className="right sticky-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredMaquinas.length === 0 ? (
              <tr>
                <td colSpan={7} className="maq-vacio">
                  <div>No hay máquinas registradas</div>
                  <button type="button" onClick={handleNueva}>
                    Haga clic aquí
                  </button>{" "}
                  para añadir
                </td>
              </tr>
            ) : null}
            {filteredMaquinas.map((m) => {
              const makeModel = [m.fabricante, m.modelo].filter(Boolean).join(" · ");
              return (
                <tr
                  key={m.id}
                  className={m.activo ? "" : "maq-inactiva"}
                  onClick={() => handleEditar(m)}
                >
                  <td>
                    <div className="name">{m.nombre}</div>
                    {makeModel ? <div className="desc">{makeModel}</div> : null}
                  </td>
                  <td className="maq-tipo" title={getMachineTechnologyLabel(m)}>
                    <span
                      className="maq-punto"
                      style={{ background: getMachineTechColor(m) }}
                    />
                    {getPlantillaMaquinariaLabel(m.plantilla)}
                  </td>
                  <td>{m.plantaNombre || "—"}</td>
                  <td>{m.centroCostoPrincipalNombre || "—"}</td>
                  <td>
                    <span
                      className={m.estado === "activa" ? "tag ok" : "tag muted"}
                      title={`código: ${m.estado}`}
                    >
                      <span className="d" />
                      {getEstadoMaquinaLabel(m.estado)}
                    </span>
                  </td>
                  <td className="right numeric">{m.perfilesOperativos.length}</td>
                  <td className="right sticky-right">
                    <span
                      className="centros-actions"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleEditar(m)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title={m.activo ? "Desactivar rápido" : "Activar rápido"}
                        aria-label={
                          m.activo
                            ? `Desactivar ${m.nombre}`
                            : `Activar ${m.nombre}`
                        }
                        onClick={() => handleToggle(m)}
                      >
                        {m.activo ? (
                          <CheckCircle2Icon size={14} />
                        ) : (
                          <CircleIcon size={14} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Desactivar"
                        aria-label={`Desactivar ${m.nombre}`}
                        onClick={() => handleDesactivar(m)}
                      >
                        <Trash2Icon size={14} />
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sheet editor */}
      <Sheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) {
            updateMaquinariaUrl("/costos/maquinaria");
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:!w-[min(92vw,56rem)] sm:!max-w-4xl">
          <SheetHeader>
            <SheetTitle>{editingId ? "Editar máquina" : "Nueva máquina"}</SheetTitle>
            <SheetDescription>
              Completá los campos según la plantilla elegida. Los discriminantes
              específicos se editan en cada perfil operativo.
            </SheetDescription>
          </SheetHeader>

          <MaquinaEditorForm
            editor={editor}
            plantas={plantas}
            centrosCosto={centrosCosto}
            saving={saving}
            esEdicion={editingId !== null}
            onGuardar={handleGuardar}
            onCancelar={() => {
              setIsSheetOpen(false);
              updateMaquinariaUrl("/costos/maquinaria");
            }}
          />
        </SheetContent>
      </Sheet>

      <ConfirmacionDestructiva
        open={maquinaADesactivar !== null}
        onOpenChange={(open) => {
          if (!open) setMaquinaADesactivar(null);
        }}
        titulo="Desactivar máquina"
        descripcion={`¿Desactivar "${maquinaADesactivar?.nombre ?? ""}"? (no se elimina, queda inactiva)`}
        nombreItem={maquinaADesactivar?.nombre}
        requiereTipear={false}
        accionLabel="Desactivar"
        onConfirmar={async () => {
          if (!maquinaADesactivar) return;
          try {
            const updated = await toggleMaquina(maquinaADesactivar.id);
            setMaquinas((prev) =>
              prev.map((m) => (m.id === maquinaADesactivar.id ? updated : m)),
            );
            toast.success("Máquina desactivada");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error");
          }
          setMaquinaADesactivar(null);
        }}
      />
    </div>
  );
}
