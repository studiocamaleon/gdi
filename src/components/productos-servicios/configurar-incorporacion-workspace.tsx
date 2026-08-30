"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  BoxesIcon,
  PlusIcon,
  Trash2Icon,
  WorkflowIcon,
} from "lucide-react";
import {
  getFormularioCotizacionProducto,
  type ConfiguracionComponenteFabricado,
  type FuenteOperacionIncorporacion,
  type OperacionIncorporacion,
  type ProductoRecetaComponenteInput,
} from "@/lib/productos-servicios-api";
import styles from "./configurar-incorporacion-workspace.module.css";

type FuenteVisible = {
  id: string;
  etiqueta: string;
  fuente: FuenteOperacionIncorporacion;
  unidadTecnica: string | null;
  unidadVisible: string | null;
  factor: number;
};

function factorUnidad(tecnica: string | null, visible: string | null) {
  if (tecnica === "mm" && visible === "cm") return 0.1;
  if (tecnica === "mm" && visible === "m") return 0.001;
  if (tecnica === "mm2" && visible === "m2") return 0.000001;
  return 1;
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

function idFuente(fuente?: FuenteOperacionIncorporacion | null) {
  if (!fuente) return "";
  return fuente.tipo === "COMPONENTE"
    ? `COMPONENTE:${fuente.componenteCodigo}:${fuente.campo}`
    : `PADRE:${fuente.campo}`;
}

export function ConfigurarIncorporacionWorkspace({
  componente,
  productoPadreId,
  productoPadreNombre,
  componentes,
  nodoNombre,
  onCancel,
  onSave,
}: {
  componente: ProductoRecetaComponenteInput;
  productoPadreId: string;
  productoPadreNombre: string;
  componentes: ProductoRecetaComponenteInput[];
  nodoNombre: string;
  onCancel: () => void;
  onSave: (configuracion: ConfiguracionComponenteFabricado) => void;
}) {
  const [fuentes, setFuentes] = React.useState<FuenteVisible[]>([]);
  const [operaciones, setOperaciones] = React.useState<
    OperacionIncorporacion[]
  >(componente.configuracionJson?.operacionesIncorporacion ?? []);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      getFormularioCotizacionProducto(productoPadreId),
      Promise.all(
        componentes.map(async (item) => ({
          item,
          formulario: await getFormularioCotizacionProducto(
            item.productoComponenteId,
          ),
        })),
      ),
    ])
      .then(([padre, hijos]) => {
        if (!active) return;
        const disponibles: FuenteVisible[] = [
          {
            id: "PADRE:cantidad",
            etiqueta: `Cantidad de ${productoPadreNombre}`,
            fuente: { tipo: "PADRE", campo: "cantidad" },
            unidadTecnica: padre.cantidad.unidad,
            unidadVisible: padre.cantidad.unidad,
            factor: 1,
          },
          {
            id: "PADRE:medidaCustomMm.anchoMm",
            etiqueta: `Ancho de ${productoPadreNombre}`,
            fuente: { tipo: "PADRE", campo: "medidaCustomMm.anchoMm" },
            unidadTecnica: "mm",
            unidadVisible: "cm",
            factor: 0.1,
          },
          {
            id: "PADRE:medidaCustomMm.altoMm",
            etiqueta: `Alto de ${productoPadreNombre}`,
            fuente: { tipo: "PADRE", campo: "medidaCustomMm.altoMm" },
            unidadTecnica: "mm",
            unidadVisible: "cm",
            factor: 0.1,
          },
          ...padre.outputsPublicos.map((output) => ({
            id: `PADRE:${output.clave}`,
            etiqueta: `${productoPadreNombre} · ${output.etiqueta}`,
            fuente: { tipo: "PADRE" as const, campo: output.clave },
            unidadTecnica: output.unidad,
            unidadVisible: output.unidadVisible ?? output.unidad,
            factor: factorUnidad(
              output.unidad,
              output.unidadVisible ?? output.unidad,
            ),
          })),
          ...hijos.flatMap(({ item, formulario }) =>
            formulario.outputsPublicos.map((output) => ({
              id: `COMPONENTE:${item.codigo}:${output.clave}`,
              etiqueta: `${item.nombre} · ${output.etiqueta}`,
              fuente: {
                tipo: "COMPONENTE" as const,
                componenteCodigo: item.codigo,
                campo: output.clave,
              },
              unidadTecnica: output.unidad,
              unidadVisible: output.unidadVisible ?? output.unidad,
              factor: factorUnidad(
                output.unidad,
                output.unidadVisible ?? output.unidad,
              ),
            })),
          ),
        ];
        setFuentes(
          disponibles.filter(
            (item, index, all) =>
              all.findIndex((candidate) => candidate.id === item.id) === index,
          ),
        );
      })
      .catch(
        (reason) =>
          active &&
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudieron cargar los datos disponibles.",
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [componentes, productoPadreId, productoPadreNombre]);

  const cambiar = (index: number, patch: Partial<OperacionIncorporacion>) =>
    setOperaciones((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );

  const puedeGuardar = operaciones.every(
    (item) =>
      item.nombre.trim() &&
      (item.modoTiempo === "FIJO"
        ? Number(item.minutosFijos) > 0
        : Boolean(item.fuenteCantidad) && Number(item.minutosPorUnidad) > 0),
  );

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.workspace}>
        <header className={styles.header}>
          <button type="button" onClick={onCancel} aria-label="Volver a la BOM">
            <ArrowLeftIcon />
          </button>
          <div>
            <span>Producción · BOM · Incorporación</span>
            <h2>{componente.nombre}</h2>
            <p>
              Definí el trabajo que agrega este componente dentro de{" "}
              {productoPadreNombre}. Su fabricación continúa en su propia ruta.
            </p>
          </div>
        </header>

        <main className={styles.body}>
          <div className={styles.contextCard}>
            <BoxesIcon />
            <div>
              <strong>Paso compuesto: {nodoNombre}</strong>
              <span>
                {operaciones.length}{" "}
                {operaciones.length === 1 ? "operación" : "operaciones"}
                {" · "}se ejecutan después de recibir los componentes
              </span>
            </div>
          </div>
          {loading ? (
            <p className={styles.message}>Cargando datos publicados…</p>
          ) : null}
          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.operations}>
            {operaciones.map((operacion, index) => {
              const fuente = fuentes.find(
                (item) => item.id === idFuente(operacion.fuenteCantidad),
              );
              return (
                <section
                  className={styles.operation}
                  key={`${operacion.codigo}-${index}`}
                >
                  <div className={styles.operationHead}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <WorkflowIcon />
                    <strong>{operacion.nombre || "Nueva operación"}</strong>
                    <button
                      type="button"
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
                  <div className={styles.fields}>
                    <label>
                      <span>Tarea de incorporación</span>
                      <input
                        value={operacion.nombre}
                        placeholder="Ej. Tensar lona"
                        onChange={(event) =>
                          cambiar(index, {
                            nombre: event.target.value,
                            codigo:
                              slug(event.target.value) || operacion.codigo,
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>Forma de estimar</span>
                      <select
                        value={operacion.modoTiempo}
                        onChange={(event) =>
                          cambiar(index, {
                            modoTiempo: event.target.value as
                              | "FIJO"
                              | "POR_UNIDAD",
                          })
                        }
                      >
                        <option value="POR_UNIDAD">Según una cantidad</option>
                        <option value="FIJO">Tiempo fijo</option>
                      </select>
                    </label>
                    {operacion.modoTiempo === "POR_UNIDAD" ? (
                      <>
                        <label className={styles.sourceField}>
                          <span>Dato que determina el trabajo</span>
                          <select
                            value={idFuente(operacion.fuenteCantidad)}
                            onChange={(event) => {
                              const elegida = fuentes.find(
                                (item) => item.id === event.target.value,
                              );
                              if (!elegida) return;
                              cambiar(index, {
                                fuenteCantidad: elegida.fuente,
                                factorConversionFuente: elegida.factor,
                                unidadCantidad:
                                  elegida.unidadVisible ?? "unidad",
                              });
                            }}
                          >
                            <option value="">Elegir dato publicado…</option>
                            {fuentes.map((item) => (
                              <option value={item.id} key={item.id}>
                                {item.etiqueta}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Ritmo</span>
                          <div className={styles.numberWithUnit}>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={operacion.minutosPorUnidad ?? ""}
                              onChange={(event) =>
                                cambiar(index, {
                                  minutosPorUnidad: Number(event.target.value),
                                })
                              }
                            />
                            <em>min / {fuente?.unidadVisible ?? "unidad"}</em>
                          </div>
                        </label>
                      </>
                    ) : (
                      <label className={styles.sourceField}>
                        <span>Duración</span>
                        <div className={styles.numberWithUnit}>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={operacion.minutosFijos ?? ""}
                            onChange={(event) =>
                              cambiar(index, {
                                minutosFijos: Number(event.target.value),
                              })
                            }
                          />
                          <em>minutos</em>
                        </div>
                      </label>
                    )}
                    <label>
                      <span>Personas</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={operacion.dotacionOperarios ?? 1}
                        onChange={(event) =>
                          cambiar(index, {
                            dotacionOperarios: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                </section>
              );
            })}
          </div>
          <button
            type="button"
            className={styles.addOperation}
            onClick={() =>
              setOperaciones((current) => [
                ...current,
                {
                  codigo: `operacion_${current.length + 1}`,
                  nombre: "",
                  modoTiempo: "POR_UNIDAD",
                  minutosPorUnidad: 1,
                  dotacionOperarios: 1,
                  orden: current.length,
                },
              ])
            }
          >
            <PlusIcon /> Agregar operación de incorporación
          </button>
        </main>

        <footer className={styles.footer}>
          <p>
            El costo usa la tarifa del centro asignado a {nodoNombre}. No vuelve
            a sumar la fabricación de {componente.nombre}.
          </p>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading || !puedeGuardar}
            onClick={() =>
              onSave({
                version: 2,
                bindings: componente.configuracionJson?.bindings ?? [],
                operacionesIncorporacion: operaciones.map((item, index) => ({
                  ...item,
                  codigo: item.codigo || slug(item.nombre),
                  orden: index,
                })),
              })
            }
          >
            Aplicar incorporación
          </button>
        </footer>
      </div>
    </div>
  );
}
