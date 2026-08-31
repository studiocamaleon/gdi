"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  BoxesIcon,
  CheckIcon,
  Settings2Icon,
  WorkflowIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ConfigPasosEditorView } from "@/components/productos-servicios/config-pasos-editor-view";
import type {
  CatalogoFamilias,
  DefinicionPasoInternoCompuesto,
  ProductoDetalle,
  RutaAlternativaDetalle,
} from "@/lib/productos-servicios";
import {
  getCatalogoFamilias,
  getLookupsConfigPaso,
  type ConfiguracionPasoCompuesto,
  type ConfiguracionPasoInternoCompuesto,
  type LookupsConfigPaso,
  type ProductoRecetaComponenteInput,
  type UpsertConfigPasoPayload,
} from "@/lib/productos-servicios-api";
import styles from "./configurar-incorporacion-workspace.module.css";

function configuracionInicial(
  codigo: string,
  familiaCodigo: string,
): UpsertConfigPasoPayload {
  return {
    rutaPasoId: codigo,
    modoActivacion: "OBLIGATORIO",
    condicionActivacionJson: null,
    modoTiempo: null,
    mecanismoCantidad: null,
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: null,
    nombreVisible: null,
    maquinaM1Id: null,
    perfilM1Id: null,
    centroCostoId: null,
    setupOverrideMin: null,
    cleanupOverrideMin: null,
    tiempoFijoOverrideMin: null,
    dotacionOperarios: 1,
    requiereRutaPasoIds: [],
    maquinasCandidatas: [],
    slotsMateriales: [],
    tercerizado: false,
    proveedorId: null,
    fuenteCostoTercerizado: null,
    tercerizadoConfigJson: null,
    plazoProveedorDias: null,
    tercerizadoEntradas: [],
    familiaCodigo,
  } as UpsertConfigPasoPayload;
}

export function ConfigurarIncorporacionWorkspace({
  paso,
  definiciones,
  producto,
  componentes,
  onCancel,
  onSave,
}: {
  paso: ConfiguracionPasoCompuesto;
  definiciones: DefinicionPasoInternoCompuesto[];
  producto: ProductoDetalle;
  componentes: ProductoRecetaComponenteInput[];
  onCancel: () => void;
  onSave: (configuracion: ConfiguracionPasoCompuesto) => void;
}) {
  const [catalogo, setCatalogo] = React.useState<CatalogoFamilias | null>(null);
  const [lookups, setLookups] = React.useState<LookupsConfigPaso | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editando, setEditando] = React.useState<string | null>(null);
  const [pasos, setPasos] = React.useState<ConfiguracionPasoInternoCompuesto[]>(
    () =>
      definiciones.map((definicion, index) => {
        const existente = paso.pasos?.find(
          (item) => item.codigo === definicion.codigo,
        );
        return (
          existente ?? {
            codigo: definicion.codigo,
            familiaCodigo: definicion.familiaCodigo,
            nombre: definicion.nombre,
            activa: definicion.requerida,
            componentesCodigos: [],
            requiereCodigos: definicion.requiereCodigos ?? [],
            configuracion: configuracionInicial(
              definicion.codigo,
              definicion.familiaCodigo,
            ),
            orden: index,
          }
        );
      }),
  );

  React.useEffect(() => {
    let activo = true;
    Promise.all([getCatalogoFamilias(), getLookupsConfigPaso()])
      .then(([catalogoCargado, lookupsCargados]) => {
        if (!activo) return;
        setCatalogo(catalogoCargado);
        setLookups(lookupsCargados);
      })
      .catch((reason) => {
        if (!activo) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "No se pudo cargar el editor de pasos.",
        );
      });
    return () => {
      activo = false;
    };
  }, []);

  const cambiarPaso = (
    codigo: string,
    patch: Partial<ConfiguracionPasoInternoCompuesto>,
  ) =>
    setPasos((actuales) =>
      actuales.map((item) =>
        item.codigo === codigo ? { ...item, ...patch } : item,
      ),
    );

  const pasoActivo = pasos.find((item) => item.codigo === editando) ?? null;
  const definicionActiva = definiciones.find(
    (item) => item.codigo === editando,
  );

  if (pasoActivo && definicionActiva && catalogo && lookups) {
    const rutaSintetica: RutaAlternativaDetalle = {
      id: `compuesto:${paso.nodoClave}`,
      nombre: paso.pasoNombre,
      esPreferida: true,
      rutaVersion: 1,
      reglaAutoSeleccionJson: null,
      ruta: {
        id: `compuesto:${paso.nodoClave}`,
        codigo: "SUBRUTA_COMPUESTA",
        nombre: paso.pasoNombre,
        pasos: [
          {
            id: pasoActivo.codigo,
            orden: 1,
            familiaCodigo: pasoActivo.familiaCodigo,
            familiaNombre:
              catalogo.familias.find(
                (item) => item.codigo === pasoActivo.familiaCodigo,
              )?.nombre ?? pasoActivo.nombre,
            nombreVisible: pasoActivo.nombre,
            activo: true,
          },
        ],
      },
      configPasos: [],
      pasosExtras: [],
    };
    return (
      <div className={styles.backdrop} role="dialog" aria-modal="true">
        <div className={`${styles.workspace} ${styles.editorWorkspace}`}>
          <header className={styles.header}>
            <button
              type="button"
              onClick={() => setEditando(null)}
              aria-label="Volver a la etapa"
            >
              <ArrowLeftIcon />
            </button>
            <div>
              <span>Producción · BOM · {paso.pasoNombre}</span>
              <h2>{pasoActivo.nombre}</h2>
              <p>
                Paso productivo completo: configurá parámetros, materiales,
                recursos, tiempos o tercerización como en una ruta normal.
              </p>
            </div>
          </header>
          <div className={styles.fullEditor}>
            <ConfigPasosEditorView
              embedded
              producto={producto}
              rutaAlternativa={rutaSintetica}
              catalogoFamilias={catalogo}
              lookups={lookups}
              configuracionContextual={{
                iniciales: {
                  [pasoActivo.codigo]: {
                    ...pasoActivo.configuracion,
                    rutaPasoId: pasoActivo.codigo,
                  },
                },
                guardar: async (_, configuracion) => {
                  cambiarPaso(pasoActivo.codigo, { configuracion });
                  toast.success("Paso guardado dentro de la etapa");
                },
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.workspace}>
        <header className={styles.header}>
          <button type="button" onClick={onCancel} aria-label="Volver a la BOM">
            <ArrowLeftIcon />
          </button>
          <div>
            <span>Producción · BOM · Etapa compuesta</span>
            <h2>{paso.pasoNombre}</h2>
            <p>
              Configurá pasos internos reales. La etapa no agrega tiempo ni
              materiales: consolida el trabajo de sus hijos.
            </p>
          </div>
        </header>
        <main className={styles.body}>
          <div className={styles.contextCard}>
            <BoxesIcon />
            <div>
              <strong>Subruta contextual del producto</strong>
              <span>
                {pasos.filter((item) => item.activa).length} pasos activos ·{" "}
                {componentes.length} componentes disponibles
              </span>
            </div>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          {!catalogo && !error ? (
            <p className={styles.message}>Cargando editor productivo…</p>
          ) : null}
          <div className={styles.stepList}>
            {pasos.map((item, index) => {
              const definicion = definiciones.find(
                (candidate) => candidate.codigo === item.codigo,
              );
              const obligatoria = definicion?.requerida === true;
              return (
                <section className={styles.stepCard} key={item.codigo}>
                  <div className={styles.stepIdentity}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <WorkflowIcon />
                    <div>
                      <strong>{item.nombre}</strong>
                      <small>
                        {catalogo?.familias.find(
                          (familia) => familia.codigo === item.familiaCodigo,
                        )?.nombre ??
                          (item.familiaCodigo
                            ? "Paso real"
                            : "Falta elegir el paso real")}
                      </small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.activeButton}
                    aria-pressed={item.activa}
                    disabled={obligatoria}
                    onClick={() =>
                      cambiarPaso(item.codigo, { activa: !item.activa })
                    }
                  >
                    <span>{item.activa ? <CheckIcon /> : null}</span>
                    {obligatoria
                      ? "Obligatorio"
                      : item.activa
                        ? "Incluido"
                        : "No incluido"}
                  </button>
                  <div className={styles.componentLinks}>
                    <span>Componentes involucrados</span>
                    {componentes.length ? (
                      componentes.map((componente) => (
                        <label key={componente.codigo}>
                          <input
                            type="checkbox"
                            checked={item.componentesCodigos.includes(
                              componente.codigo,
                            )}
                            onChange={(event) =>
                              cambiarPaso(item.codigo, {
                                componentesCodigos: event.target.checked
                                  ? [
                                      ...item.componentesCodigos,
                                      componente.codigo,
                                    ]
                                  : item.componentesCodigos.filter(
                                      (codigo) => codigo !== componente.codigo,
                                    ),
                              })
                            }
                          />
                          {componente.nombre}
                        </label>
                      ))
                    ) : (
                      <small>
                        Trabajo general del producto, sin componente.
                      </small>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.configureButton}
                    disabled={
                      !item.activa ||
                      !item.familiaCodigo ||
                      !catalogo ||
                      !lookups
                    }
                    onClick={() => setEditando(item.codigo)}
                  >
                    <Settings2Icon /> Configurar paso
                  </button>
                </section>
              );
            })}
          </div>
        </main>
        <footer className={styles.footer}>
          <p>
            Los pasos se versionarán con la receta y la OT conservará su
            configuración, materiales y recursos.
          </p>
          <div>
            <button type="button" onClick={onCancel}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={
                !pasos.length || pasos.some((item) => !item.familiaCodigo)
              }
              onClick={() =>
                onSave({
                  ...paso,
                  version: 2,
                  operaciones: [],
                  pasos: pasos.map((item, index) => ({
                    ...item,
                    orden: index,
                  })),
                })
              }
            >
              Aplicar etapa
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
