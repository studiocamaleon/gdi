"use client";

import * as React from "react";
import {
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
import { ModeloProductivoConfigShell } from "./modelo-productivo-config-shell";
import styles from "./configurar-incorporacion-workspace.module.css";

function configuracionInicial(
  codigo: string,
  familiaCodigo: string,
  nombreVisible: string,
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
    nombreVisible,
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
  embedded = false,
}: {
  paso: ConfiguracionPasoCompuesto;
  definiciones: DefinicionPasoInternoCompuesto[];
  producto: ProductoDetalle;
  componentes: ProductoRecetaComponenteInput[];
  onCancel: () => void;
  onSave: (configuracion: ConfiguracionPasoCompuesto) => void;
  embedded?: boolean;
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
              definicion.nombre,
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
      <ModeloProductivoConfigShell
        tipo="PASO"
        eyebrow={`Producción · Etapa ${paso.pasoNombre} · Paso interno`}
        titulo={pasoActivo.nombre}
        descripcion="Configurá parámetros, materiales, recursos y tiempos como en un paso normal. Este paso calcula el trabajo, pero no tendrá un estado independiente en la OT."
        onBack={() => setEditando(null)}
        backLabel="Volver a la etapa"
        embedded={embedded}
        wide
        contentClassName={styles.fullEditor}
      >
        <ConfigPasosEditorView
          embedded
          modoFocoNodo
          producto={producto}
          rutaAlternativa={rutaSintetica}
          catalogoFamilias={catalogo}
          lookups={lookups}
          configuracionContextual={{
            iniciales: {
              [pasoActivo.codigo]: {
                ...pasoActivo.configuracion,
                rutaPasoId: pasoActivo.codigo,
                nombreVisible:
                  pasoActivo.configuracion.nombreVisible?.trim() ||
                  pasoActivo.nombre,
              },
            },
            guardar: async (_, configuracion) => {
              cambiarPaso(pasoActivo.codigo, { configuracion });
              toast.success("Paso guardado dentro de la etapa");
            },
          }}
        />
      </ModeloProductivoConfigShell>
    );
  }

  return (
    <ModeloProductivoConfigShell
      tipo="ETAPA"
      eyebrow="Producción · Etapa compuesta"
      titulo={paso.pasoNombre}
      descripcion="Configurá las operaciones que determinan el tiempo, los materiales y el costo. En producción se ejecutará una sola etapa."
      onBack={onCancel}
      backLabel="Volver a la ruta de producción"
      embedded={embedded}
      pinFooterToViewport
      contentClassName={styles.body}
      footerNote="El desglose se versionará con la receta. La OT recibirá una sola etapa con tiempo, materiales y costo consolidados."
      primaryLabel="Aplicar etapa"
      primaryDisabled={
        !pasos.length || pasos.some((item) => !item.familiaCodigo)
      }
      onPrimary={() =>
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
      <div className={styles.contextCard}>
        <BoxesIcon />
        <div>
          <strong>Desglose interno de la etapa</strong>
          <span>
            {pasos.filter((item) => item.activa).length} operaciones activas ·{" "}
            {componentes.length} componentes disponibles en este producto
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
                <span>Componentes sobre los que trabaja</span>
                {componentes.length ? (
                  componentes.map((componente) => (
                    <label
                      key={componente.codigo}
                      title={
                        componente.configuracionJson?.repeticion?.permitida
                          ? "Incluye también las ocurrencias agregadas al cotizar."
                          : undefined
                      }
                    >
                      <input
                        type="checkbox"
                        checked={item.componentesCodigos.includes(
                          componente.codigo,
                        )}
                        onChange={(event) =>
                          cambiarPaso(item.codigo, {
                            componentesCodigos: event.target.checked
                              ? [...item.componentesCodigos, componente.codigo]
                              : item.componentesCodigos.filter(
                                  (codigo) => codigo !== componente.codigo,
                                ),
                          })
                        }
                      />
                      {componente.nombre}
                      {componente.configuracionJson?.repeticion?.permitida
                        ? " · repetible"
                        : ""}
                    </label>
                  ))
                ) : (
                  <small>
                    Trabajo general de la etapa, sin componente específico.
                  </small>
                )}
              </div>
              <button
                type="button"
                className={styles.configureButton}
                disabled={
                  !item.activa || !item.familiaCodigo || !catalogo || !lookups
                }
                onClick={() => setEditando(item.codigo)}
              >
                <Settings2Icon /> Configurar operación
              </button>
            </section>
          );
        })}
      </div>
    </ModeloProductivoConfigShell>
  );
}
