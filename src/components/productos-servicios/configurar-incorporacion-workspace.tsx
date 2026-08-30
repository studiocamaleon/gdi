"use client";

import * as React from "react";
import { ArrowLeftIcon, BoxesIcon, WorkflowIcon } from "lucide-react";
import type { DefinicionOperacionCompuesta } from "@/lib/productos-servicios";
import {
  getFormularioCotizacionProducto,
  type ConfiguracionOperacionCompuesta,
  type ConfiguracionPasoCompuesto,
  type FuenteOperacionIncorporacion,
  type ProductoRecetaComponenteInput,
} from "@/lib/productos-servicios-api";
import styles from "./configurar-incorporacion-workspace.module.css";

type FuenteVisible = {
  id: string;
  etiqueta: string;
  fuente: FuenteOperacionIncorporacion;
  unidadVisible: string | null;
  factor: number;
};

function factorUnidad(tecnica: string | null, visible: string | null) {
  if (tecnica === "mm" && visible === "cm") return 0.1;
  if (tecnica === "mm" && visible === "m") return 0.001;
  if (tecnica === "mm2" && visible === "m2") return 0.000001;
  return 1;
}

function idFuente(fuente?: FuenteOperacionIncorporacion | null) {
  if (!fuente) return "";
  return fuente.tipo === "COMPONENTE"
    ? `COMPONENTE:${fuente.componenteCodigo}:${fuente.campo}`
    : `PADRE:${fuente.campo}`;
}

export function ConfigurarIncorporacionWorkspace({
  paso,
  definiciones,
  productoPadreId,
  productoPadreNombre,
  componentes,
  onCancel,
  onSave,
}: {
  paso: ConfiguracionPasoCompuesto;
  definiciones: DefinicionOperacionCompuesta[];
  productoPadreId: string;
  productoPadreNombre: string;
  componentes: ProductoRecetaComponenteInput[];
  onCancel: () => void;
  onSave: (configuracion: ConfiguracionPasoCompuesto) => void;
}) {
  const [fuentes, setFuentes] = React.useState<FuenteVisible[]>([]);
  const [operaciones, setOperaciones] = React.useState<
    ConfiguracionOperacionCompuesta[]
  >(() =>
    definiciones.map((definicion, index) => {
      const existente = paso.operaciones.find(
        (item) => item.codigo === definicion.codigo,
      );
      return (
        existente ?? {
          codigo: definicion.codigo,
          nombre: definicion.nombre,
          activa: definicion.requerida,
          componentesCodigos: [],
          modoTiempo: definicion.dimension === "FIJO" ? "FIJO" : "POR_UNIDAD",
          minutosFijos: definicion.dimension === "FIJO" ? 1 : null,
          minutosPorUnidad: definicion.dimension === "FIJO" ? null : 1,
          dotacionOperarios: 1,
          orden: index,
        }
      );
    }),
  );
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
            unidadVisible: padre.cantidad.unidad,
            factor: 1,
          },
          {
            id: "PADRE:medidaCustomMm.anchoMm",
            etiqueta: `Ancho de ${productoPadreNombre}`,
            fuente: { tipo: "PADRE", campo: "medidaCustomMm.anchoMm" },
            unidadVisible: "cm",
            factor: 0.1,
          },
          {
            id: "PADRE:medidaCustomMm.altoMm",
            etiqueta: `Alto de ${productoPadreNombre}`,
            fuente: { tipo: "PADRE", campo: "medidaCustomMm.altoMm" },
            unidadVisible: "cm",
            factor: 0.1,
          },
          ...padre.outputsPublicos.map((output) => ({
            id: `PADRE:${output.clave}`,
            etiqueta: `${productoPadreNombre} · ${output.etiqueta}`,
            fuente: { tipo: "PADRE" as const, campo: output.clave },
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

  const cambiar = (
    index: number,
    patch: Partial<ConfiguracionOperacionCompuesta>,
  ) =>
    setOperaciones((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );

  const requeridas = new Set(
    definiciones.filter((item) => item.requerida).map((item) => item.codigo),
  );
  const puedeGuardar = operaciones.every(
    (item) =>
      !item.activa ||
      (item.componentesCodigos.length > 0 &&
        (item.modoTiempo === "FIJO"
          ? Number(item.minutosFijos) > 0
          : Boolean(item.fuenteCantidad) && Number(item.minutosPorUnidad) > 0)),
  );

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.workspace}>
        <header className={styles.header}>
          <button type="button" onClick={onCancel} aria-label="Volver a la BOM">
            <ArrowLeftIcon />
          </button>
          <div>
            <span>Producción · BOM · Paso compuesto</span>
            <h2>{paso.pasoNombre}</h2>
            <p>
              Vinculá los componentes y outputs de este producto con las
              operaciones declaradas por el paso reutilizable.
            </p>
          </div>
        </header>

        <main className={styles.body}>
          <div className={styles.contextCard}>
            <BoxesIcon />
            <div>
              <strong>Configuración contextual del producto</strong>
              <span>
                {operaciones.filter((item) => item.activa).length} operaciones
                activas · {componentes.length} componentes disponibles
              </span>
            </div>
          </div>
          {loading ? <p className={styles.message}>Cargando outputs…</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.operations}>
            {operaciones.map((operacion, index) => {
              const fuente = fuentes.find(
                (item) => item.id === idFuente(operacion.fuenteCantidad),
              );
              const obligatoria = requeridas.has(operacion.codigo);
              return (
                <section className={styles.operation} key={operacion.codigo}>
                  <div className={styles.operationHead}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <WorkflowIcon />
                    <strong>{operacion.nombre}</strong>
                    <label>
                      <input
                        type="checkbox"
                        checked={operacion.activa}
                        disabled={obligatoria}
                        onChange={(event) =>
                          cambiar(index, { activa: event.target.checked })
                        }
                      />
                      {obligatoria ? "Obligatoria" : "Usar operación"}
                    </label>
                  </div>
                  {operacion.activa ? (
                    <div className={styles.fields}>
                      <fieldset className={styles.sourceField}>
                        <legend>Componentes involucrados</legend>
                        <div className={styles.componentChecks}>
                          {componentes.map((componente) => (
                            <label key={componente.codigo}>
                              <input
                                type="checkbox"
                                checked={operacion.componentesCodigos.includes(
                                  componente.codigo,
                                )}
                                onChange={(event) =>
                                  cambiar(index, {
                                    componentesCodigos: event.target.checked
                                      ? [
                                          ...operacion.componentesCodigos,
                                          componente.codigo,
                                        ]
                                      : operacion.componentesCodigos.filter(
                                          (codigo) =>
                                            codigo !== componente.codigo,
                                        ),
                                  })
                                }
                              />
                              {componente.nombre}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <label>
                        <span>Forma de estimar</span>
                        <select
                          value={operacion.modoTiempo}
                          onChange={(event) =>
                            cambiar(index, {
                              modoTiempo: event.target.value as
                                "FIJO" | "POR_UNIDAD",
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
                                    minutosPorUnidad: Number(
                                      event.target.value,
                                    ),
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
                  ) : null}
                </section>
              );
            })}
          </div>
        </main>

        <footer className={styles.footer}>
          <p>
            Las reglas quedan versionadas en la receta. La cotización resolverá
            sus valores y la OT conservará el snapshot resultante.
          </p>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading || !puedeGuardar}
            onClick={() => onSave({ ...paso, operaciones })}
          >
            Aplicar operaciones
          </button>
        </footer>
      </div>
    </div>
  );
}
