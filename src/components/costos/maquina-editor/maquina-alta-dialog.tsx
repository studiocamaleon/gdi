"use client";

/**
 * Alta de máquina estilo Holdprint (Fase D): un diálogo chico que pide lo
 * mínimo —nombre y tipo (plantilla)— y crea la máquina con los defaults de
 * la plantilla. El resto se completa en la ficha, a donde te lleva al
 * guardar. Reemplaza al sheet gigante de alta.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import type { Planta } from "@/lib/costos";
import type { MaquinaPayload, PlantillaMaquinaria } from "@/lib/maquinaria";
import { createMaquina } from "@/lib/maquinaria-api";
import {
  getMaquinariaTemplate,
  maquinariaTemplates,
} from "@/lib/maquinaria-templates";

import { emptyMaquina } from "./helpers";

type MaquinaAltaDialogProps = {
  open: boolean;
  onClose: () => void;
  plantas: Planta[];
};

export function MaquinaAltaDialog({ open, onClose, plantas }: MaquinaAltaDialogProps) {
  const router = useRouter();
  const [nombre, setNombre] = React.useState("");
  const [plantilla, setPlantilla] = React.useState<PlantillaMaquinaria | null>(null);
  const [busqueda, setBusqueda] = React.useState("");
  const [creando, setCreando] = React.useState(false);

  // Cada apertura arranca limpia.
  React.useEffect(() => {
    if (open) {
      setNombre("");
      setPlantilla(null);
      setBusqueda("");
    }
  }, [open]);

  const plantillasFiltradas = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return maquinariaTemplates;
    return maquinariaTemplates.filter((t) => t.label.toLowerCase().includes(q));
  }, [busqueda]);

  const puedeGuardar = nombre.trim().length > 0 && plantilla !== null && !creando;

  const handleCrear = async () => {
    if (!puedeGuardar || !plantilla) return;
    setCreando(true);
    try {
      const template = getMaquinariaTemplate(plantilla);
      const base = emptyMaquina(plantas[0]?.id ?? "");
      const payload: MaquinaPayload = {
        ...base,
        nombre: nombre.trim(),
        plantilla,
        geometriaTrabajo: template?.geometry ?? base.geometriaTrabajo,
        unidadProduccionPrincipal:
          template?.defaultProductionUnit ?? base.unidadProduccionPrincipal,
        // Nace como BORRADOR explícito: el API sólo saltea la validación de
        // campos requeridos de la plantilla con esta marca. La ficha lo
        // "gradúa" cuando esos campos se completan (ver maquina-ficha).
        estadoConfiguracion: "borrador",
      };
      const created = await createMaquina(payload);
      toast.success(`"${created.nombre}" creada — completá su ficha`);
      router.push(`/costos/maquinaria/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error creando la máquina");
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
        aria-label="Nueva máquina"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="maq-modal-head">
          <h2>Nueva máquina</h2>
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
            <label htmlFor="maq-alta-nombre">Nombre de la máquina *</label>
            <input
              id="maq-alta-nombre"
              value={nombre}
              autoFocus
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Impresora láser color"
            />
          </div>

          <div className="maq-alta-campo">
            <label htmlFor="maq-alta-busqueda">Tipo (plantilla de máquina) *</label>
            <div className="maq-alta-buscador">
              <SearchIcon />
              <input
                id="maq-alta-busqueda"
                type="search"
                placeholder="Búsqueda"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <ul className="maq-alta-lista" role="listbox" aria-label="Tipos de máquina">
              {plantillasFiltradas.length === 0 ? (
                <li className="vacio">Ningún tipo coincide con la búsqueda.</li>
              ) : null}
              {plantillasFiltradas.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={plantilla === t.id}
                    className={plantilla === t.id ? "activo" : ""}
                    onClick={() => setPlantilla(t.id)}
                  >
                    <span>{t.label}</span>
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
