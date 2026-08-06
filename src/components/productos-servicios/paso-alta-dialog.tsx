"use client";

/**
 * Alta de paso propio, calcada del alta de máquina
 * (costos/maquina-editor/maquina-alta-dialog.tsx): un diálogo chico que pide
 * lo mínimo —nombre y plantilla— y crea el paso heredando la ficha entera de
 * esa plantilla. Los defaults del taller se completan después, en la ficha.
 *
 * Reemplaza al wizard de 13 pantallas que pedía declarar la FORMA (mecanismo
 * de cantidad, superficie de acomodo, outputs canónicos…): con el modelo de
 * instancias eso ya no se escribe, se hereda.
 * docs/pasos-tenant-por-plantilla-diseno.md
 */

import * as React from "react";
import { CheckIcon, SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import type { PasoTenant, PlantillaPaso } from "@/lib/productos-servicios";
import { crearPasoTenant } from "@/lib/productos-servicios-api";
import { categoriaFamiliaLabels, getLabel } from "@/lib/labels-humanos";

type Props = {
  open: boolean;
  plantillas: PlantillaPaso[];
  onClose: () => void;
  onCreado: (paso: PasoTenant) => void;
};

export function PasoAltaDialog({ open, plantillas, onClose, onCreado }: Props) {
  const [nombre, setNombre] = React.useState("");
  const [plantilla, setPlantilla] = React.useState<string | null>(null);
  const [busqueda, setBusqueda] = React.useState("");
  const [creando, setCreando] = React.useState(false);

  // Cada apertura arranca limpia.
  React.useEffect(() => {
    if (open) {
      setNombre("");
      setPlantilla(null);
      setBusqueda("");
      setCreando(false);
    }
  }, [open]);

  const filtradas = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return plantillas;
    return plantillas.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        getLabel(categoriaFamiliaLabels, p.categoria)
          .label.toLowerCase()
          .includes(q),
    );
  }, [busqueda, plantillas]);

  const puedeGuardar = nombre.trim().length > 0 && plantilla !== null && !creando;

  const handleCrear = async () => {
    if (!puedeGuardar || !plantilla) return;
    setCreando(true);
    try {
      const creado = await crearPasoTenant({
        nombre: nombre.trim(),
        plantillaCodigo: plantilla,
      });
      toast.success(`"${creado.nombre}" creado`);
      onCreado(creado);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error creando el paso");
      setCreando(false);
    }
  };

  if (!open) return null;

  return (
    <div className="maq-backdrop show" onClick={onClose}>
      <div
        className="maq-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo paso"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="maq-modal-head">
          <h2>Nuevo paso</h2>
          <button
            type="button"
            className="maq-modal-cerrar"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <XIcon />
          </button>
        </div>

        <div className="maq-modal-body">
          <div className="maq-alta-campo">
            <label htmlFor="paso-alta-nombre">Nombre del paso *</label>
            <input
              id="paso-alta-nombre"
              value={nombre}
              autoFocus
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Bordado"
            />
          </div>

          <div className="maq-alta-campo">
            <label htmlFor="paso-alta-busqueda">Tipo (plantilla de paso) *</label>
            <div className="maq-alta-buscador">
              <SearchIcon />
              <input
                id="paso-alta-busqueda"
                type="search"
                placeholder="Búsqueda"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <ul
              className="maq-alta-lista"
              role="listbox"
              aria-label="Tipos de paso"
            >
              {filtradas.length === 0 ? (
                <li className="vacio">Ningún tipo coincide con la búsqueda.</li>
              ) : null}
              {filtradas.map((p) => (
                <li key={p.codigo}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={plantilla === p.codigo}
                    className={plantilla === p.codigo ? "activo" : ""}
                    onClick={() => setPlantilla(p.codigo)}
                  >
                    <span>{p.nombre}</span>
                    <CheckIcon className="tilde" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="maq-modal-foot">
          <button type="button" className="maq-btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="maq-btn maq-btn-primario"
            disabled={!puedeGuardar}
            onClick={handleCrear}
          >
            {creando ? "Creando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
