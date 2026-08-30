"use client";

import * as React from "react";
import { BoxesIcon, CheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type {
  DefinicionOperacionCompuesta,
  PasoTenant,
} from "@/lib/productos-servicios";
import { actualizarPasoTenant } from "@/lib/productos-servicios-api";
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

function siguienteCodigoOperacion(operaciones: DefinicionOperacionCompuesta[]) {
  let numero = operaciones.length + 1;
  while (operaciones.some((item) => item.codigo === `operacion_${numero}`)) {
    numero += 1;
  }
  return `operacion_${numero}`;
}

export function PasoCompuestoConfiguracion({ paso }: { paso: PasoTenant }) {
  const [operaciones, setOperaciones] = React.useState<
    DefinicionOperacionCompuesta[]
  >(paso.operacionesCompuestas ?? []);
  const [guardando, setGuardando] = React.useState(false);

  const cambiar = (
    index: number,
    patch: Partial<DefinicionOperacionCompuesta>,
  ) =>
    setOperaciones((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );

  const guardar = async () => {
    if (operaciones.some((item) => !item.nombre.trim())) {
      toast.error("Todas las operaciones necesitan un nombre.");
      return;
    }
    setGuardando(true);
    try {
      await actualizarPasoTenant(paso.id, {
        tipoPaso: "COMPUESTO",
        operacionesCompuestas: operaciones.map((item, index) => ({
          ...item,
          codigo: item.codigo || slug(item.nombre),
          orden: index,
        })),
      });
      toast.success("Operaciones del paso actualizadas");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar las operaciones.",
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
          <span className={styles.eyebrow}>Paso compuesto reutilizable</span>
          <h1>{paso.nombre}</h1>
          <p>
            Definí qué operaciones puede contener. Los componentes, outputs,
            cantidades y tiempos se configurarán en la BOM de cada producto.
          </p>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <strong>Operaciones posibles</strong>
            <span>
              Son el contrato reutilizable del paso, no una cotización.
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
                  descripcion: null,
                  dimension: "CANTIDAD",
                  requerida: true,
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
            Agregá la primera operación que podrá configurarse al usar este
            paso.
          </div>
        ) : (
          <div className={styles.rows}>
            <div className={styles.rowHead} aria-hidden="true">
              <span />
              <span>Operación</span>
              <span>Magnitud esperada</span>
              <span />
              <span />
            </div>
            {operaciones.map((operacion, index) => (
              <div className={styles.row} key={operacion.codigo}>
                <span className={styles.index}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <label>
                  <span className={styles.rowLabel}>Operación</span>
                  <input
                    aria-label={`Nombre de la operación ${index + 1}`}
                    value={operacion.nombre}
                    placeholder="Ej. Tensar lona"
                    onChange={(event) =>
                      cambiar(index, {
                        nombre: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  <span className={styles.rowLabel}>Magnitud esperada</span>
                  <select
                    aria-label={`Magnitud esperada de la operación ${index + 1}`}
                    value={operacion.dimension}
                    onChange={(event) =>
                      cambiar(index, {
                        dimension: event.target
                          .value as DefinicionOperacionCompuesta["dimension"],
                      })
                    }
                  >
                    <option value="FIJO">Tiempo fijo</option>
                    <option value="UNIDAD">Unidades</option>
                    <option value="CANTIDAD">Cantidad publicada</option>
                    <option value="LONGITUD">Longitud</option>
                    <option value="SUPERFICIE">Superficie</option>
                  </select>
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
                  aria-label={`Quitar ${operacion.nombre || "operación"}`}
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
