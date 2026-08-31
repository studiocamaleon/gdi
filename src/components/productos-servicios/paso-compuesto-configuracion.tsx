"use client";

import * as React from "react";
import { BoxesIcon, CheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type {
  DefinicionPasoInternoCompuesto,
  FamiliaListItem,
  PasoTenant,
} from "@/lib/productos-servicios";
import {
  actualizarPasoTenant,
  getCatalogoFamilias,
  getPasosTenant,
} from "@/lib/productos-servicios-api";
import styles from "./paso-compuesto-configuracion.module.css";

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

function siguienteCodigoOperacion(
  operaciones: DefinicionPasoInternoCompuesto[],
) {
  let numero = operaciones.length + 1;
  while (operaciones.some((item) => item.codigo === `operacion_${numero}`)) {
    numero += 1;
  }
  return `operacion_${numero}`;
}

export function PasoCompuestoConfiguracion({ paso }: { paso: PasoTenant }) {
  const [operaciones, setOperaciones] = React.useState<
    DefinicionPasoInternoCompuesto[]
  >(() =>
    (paso.pasosInternos ?? paso.operacionesCompuestas ?? []).map((item) => ({
      ...item,
      familiaCodigo: item.familiaCodigo ?? "",
      requiereCodigos: item.requiereCodigos ?? [],
    })),
  );
  const [familias, setFamilias] = React.useState<FamiliaListItem[]>([]);
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    Promise.all([getCatalogoFamilias(), getPasosTenant()])
      .then(([catalogo, pasos]) => {
        const compuestos = new Set(
          pasos
            .filter((item) => item.tipoPaso === "COMPUESTO")
            .map((item) => item.id),
        );
        setFamilias(
          catalogo.familias.filter(
            (item) =>
              item.visibleEnSelector !== false &&
              item.codigo !== paso.id &&
              !compuestos.has(item.codigo),
          ),
        );
      })
      .catch(() => toast.error("No se pudo cargar el catálogo de pasos."));
  }, [paso.id]);

  const cambiar = (
    index: number,
    patch: Partial<DefinicionPasoInternoCompuesto>,
  ) =>
    setOperaciones((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );

  const guardar = async () => {
    if (
      operaciones.some((item) => !item.familiaCodigo || !item.nombre.trim())
    ) {
      toast.error(
        "Todos los pasos internos deben elegir un paso real y un nombre.",
      );
      return;
    }
    setGuardando(true);
    try {
      await actualizarPasoTenant(paso.id, {
        tipoPaso: "COMPUESTO",
        pasosInternos: operaciones.map((item, index) => ({
          ...item,
          codigo: item.codigo || slug(item.nombre),
          orden: index,
        })),
      });
      toast.success("Subruta del paso actualizada");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la subruta.",
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <BoxesIcon />
        <div>
          <span className={styles.eyebrow}>Etapa compuesta reutilizable</span>
          <h1>{paso.nombre}</h1>
          <p>
            Definí las operaciones internas que calculan esta etapa. Cada una
            conserva materiales, parámetros, recursos y tiempos, pero la OT
            mostrará un único paso operativo.
          </p>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <strong>Operaciones internas</strong>
            <span>
              Calculan el trabajo sin crear estados separados en producción.
            </span>
          </div>
          <button
            type="button"
            className={styles.addButton}
            onClick={() =>
              setOperaciones((current) => [
                ...current,
                {
                  codigo: siguienteCodigoOperacion(current),
                  nombre: "",
                  familiaCodigo: "",
                  descripcion: null,
                  dimension: "CANTIDAD",
                  requerida: true,
                  requiereCodigos: [],
                  orden: current.length,
                },
              ])
            }
          >
            <PlusIcon />
            <span>Agregar operación</span>
          </button>
        </div>
        {!operaciones.length ? (
          <div className={styles.empty}>
            Agregá la primera operación que formará parte de esta etapa.
          </div>
        ) : (
          <div className={styles.rows}>
            <div className={styles.rowHead} aria-hidden="true">
              <span />
              <span>Familia de cálculo</span>
              <span>Nombre de la operación</span>
              <span />
              <span />
            </div>
            {operaciones.map((operacion, index) => (
              <div className={styles.row} key={operacion.codigo}>
                <span className={styles.index}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <label>
                  <span className={styles.rowLabel}>Familia de cálculo</span>
                  <select
                    aria-label={`Paso real ${index + 1}`}
                    value={operacion.familiaCodigo}
                    onChange={(event) => {
                      const familia = familias.find(
                        (item) => item.codigo === event.target.value,
                      );
                      cambiar(index, {
                        familiaCodigo: event.target.value,
                        nombre: operacion.nombre || familia?.nombre || "",
                      });
                    }}
                  >
                    <option value="">Elegir paso…</option>
                    {familias.map((familia) => (
                      <option key={familia.codigo} value={familia.codigo}>
                        {familia.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={styles.rowLabel}>
                    Nombre de la operación
                  </span>
                  <input
                    aria-label={`Nombre del paso ${index + 1}`}
                    value={operacion.nombre}
                    placeholder="Ej. Tensado de lona"
                    onChange={(event) =>
                      cambiar(index, { nombre: event.target.value })
                    }
                  />
                </label>
                <button
                  type="button"
                  className={styles.required}
                  aria-pressed={operacion.requerida}
                  onClick={() =>
                    cambiar(index, { requerida: !operacion.requerida })
                  }
                >
                  <span className={styles.check} aria-hidden="true">
                    {operacion.requerida ? <CheckIcon /> : null}
                  </span>
                  <span>Obligatoria</span>
                </button>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Quitar ${operacion.nombre || "paso"}`}
                  onClick={() =>
                    setOperaciones((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2Icon />
                </button>
              </div>
            ))}
          </div>
        )}
        <footer className={styles.footer}>
          <button type="button" onClick={() => history.back()}>
            Volver
          </button>
          <button type="button" disabled={guardando} onClick={guardar}>
            {guardando ? "Guardando…" : "Guardar operaciones"}
          </button>
        </footer>
      </section>
    </main>
  );
}
