"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveXIcon,
  BoxesIcon,
  FactoryIcon,
  FileCheck2Icon,
  GitCommitHorizontalIcon,
  PencilLineIcon,
  PlusIcon,
  RefreshCwIcon,
  RocketIcon,
  ShieldCheckIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import type { ProductoDetalle } from "@/lib/productos-servicios";
import {
  deprecarReceta,
  guardarBorradorReceta,
  getProductos,
  publicarReceta,
  type ProductoRecetaComponenteInput,
  type ProductoRecetaDocumentoInput,
  type ProductoReceta,
  type ProductoRecetaRevision,
} from "@/lib/productos-servicios-api";
import styles from "./receta-producto-tab.module.css";

function fecha(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  })
    .format(new Date(value))
    .replace(/\s+/g, " ");
}

function etiquetaRol(rol?: string | null) {
  const labels: Record<string, string> = {
    SUSTRATO: "Sustrato",
    COMPONENTE: "Componente comprado",
    CONSUMIBLE: "Consumible",
    PACKAGING: "Packaging",
  };
  return rol ? (labels[rol] ?? rol) : "Material";
}

function EditorDefiniciones({
  productoId,
  rutaAlternativaId,
  ruta,
  revision,
  onClose,
}: {
  productoId: string;
  rutaAlternativaId: string;
  ruta: ProductoDetalle["rutasAlternativas"][number];
  revision: ProductoRecetaRevision;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [productos, setProductos] = React.useState<
    Array<{ id: string; codigo: string; nombre: string }>
  >([]);
  const [documentos, setDocumentos] = React.useState<
    ProductoRecetaDocumentoInput[]
  >(() =>
    revision.documentos.map((item) => ({
      codigo: item.codigo,
      nombre: item.nombre,
      pasoClave: item.pasoClave,
      proposito: item.proposito as ProductoRecetaDocumentoInput["proposito"],
      etapa: item.etapa as ProductoRecetaDocumentoInput["etapa"],
      tipoAprobacion:
        item.tipoAprobacion as ProductoRecetaDocumentoInput["tipoAprobacion"],
      requerido: item.requerido,
      descripcion: item.descripcion,
      orden: item.orden,
    })),
  );
  const [componentes, setComponentes] = React.useState<
    ProductoRecetaComponenteInput[]
  >(() =>
    revision.componentes.map((item) => ({
      productoComponenteId: item.productoComponenteId,
      codigo: item.codigo,
      nombre: item.nombre,
      politicaEjecucion: item.politicaEjecucion,
      formula: item.formula,
      cantidad: Number(item.cantidad),
      unidad: item.unidad,
      requerido: item.requerido,
      orden: item.orden,
    })),
  );
  const pasosDocumento = React.useMemo(
    () => [
      ...ruta.ruta.pasos
        .filter((paso) => paso.activo)
        .map((paso) => ({
          value: `ruta:${paso.id}`,
          label:
            paso.nombreVisible || paso.familiaNombre || paso.familiaCodigo,
        })),
      ...(ruta.pasosExtras ?? [])
        .filter((paso) => paso.activo)
        .map((paso) => ({
          value: `extra:${paso.id}`,
          label: paso.nombreVisible || paso.familiaCodigo,
        })),
    ],
    [ruta],
  );

  React.useEffect(() => {
    void getProductos(true)
      .then((items) =>
        setProductos(
          items
            .filter((item) => item.id !== productoId)
            .map((item) => ({
              id: item.id,
              codigo: item.codigo,
              nombre: item.nombre,
            })),
        ),
      )
      .catch(() => setProductos([]));
  }, [productoId]);

  const guardarDefiniciones = async () => {
    setSaving(true);
    try {
      await guardarBorradorReceta(productoId, {
        rutaAlternativaId,
        expectedUpdatedAt: revision.updatedAt,
        cambios: "Requisitos documentales y componentes actualizados",
        documentos: documentos.map((item, orden) => ({ ...item, orden })),
        componentes: componentes.map((item, orden) => ({ ...item, orden })),
      });
      toast.success("Las definiciones quedaron guardadas en el borrador.");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar las definiciones.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.editor}>
      <header className={styles.editorHeader}>
        <div>
          <span>Edición de V{revision.numero}</span>
          <h4>Requisitos de entrega y componentes fabricados</h4>
          <p>
            Los insumos comprados se configuran en los slots de materiales. Acá
            sólo van entregables controlables y productos que se fabrican
            aparte.
          </p>
        </div>
        <button type="button" aria-label="Cerrar editor" onClick={onClose}>
          <XIcon />
        </button>
      </header>

      <div className={styles.editorColumns}>
        <section className={styles.editorSection}>
          <div className={styles.editorTitle}>
            <div>
              <strong>Documentos y aprobaciones</strong>
              <span>
                Arte, plano, muestra o instructivo exigido por la receta.
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setDocumentos((prev) => [
                  ...prev,
                  {
                    codigo: `DOC-${prev.length + 1}`,
                    nombre: "Nuevo documento",
                    proposito: "PRINT",
                    etapa: "DISENO",
                    tipoAprobacion: "CLIENTE",
                    requerido: true,
                  },
                ])
              }
            >
              <PlusIcon /> Agregar
            </button>
          </div>
          <div className={styles.editorRows}>
            {documentos.map((item, index) => (
              <div
                className={styles.definitionRow}
                key={`${item.codigo}-${index}`}
              >
                <input
                  aria-label={`Nombre del documento ${index + 1}`}
                  value={item.nombre}
                  onChange={(event) =>
                    setDocumentos((prev) =>
                      prev.map((value, i) =>
                        i === index
                          ? { ...value, nombre: event.target.value }
                          : value,
                      ),
                    )
                  }
                />
                <select
                  aria-label={`Propósito del documento ${index + 1}`}
                  value={item.proposito}
                  onChange={(event) =>
                    setDocumentos((prev) =>
                      prev.map((value, i) =>
                        i === index
                          ? {
                              ...value,
                              proposito: event.target
                                .value as ProductoRecetaDocumentoInput["proposito"],
                            }
                          : value,
                      ),
                    )
                  }
                >
                  <option value="PRINT">Arte de impresión</option>
                  <option value="CUT">Archivo de corte</option>
                  <option value="RENDER">Render</option>
                  <option value="PLANO">Plano técnico</option>
                  <option value="INSTRUCTIVO">Instructivo</option>
                  <option value="OTRO">Otro</option>
                </select>
                <select
                  aria-label={`Aprobación del documento ${index + 1}`}
                  value={item.tipoAprobacion ?? ""}
                  onChange={(event) =>
                    setDocumentos((prev) =>
                      prev.map((value, i) =>
                        i === index
                          ? {
                              ...value,
                              tipoAprobacion: (event.target.value ||
                                null) as ProductoRecetaDocumentoInput["tipoAprobacion"],
                            }
                          : value,
                      ),
                    )
                  }
                >
                  <option value="">Sin aprobación</option>
                  <option value="CLIENTE">Cliente</option>
                  <option value="DISENO">Diseño</option>
                  <option value="COLOR_MUESTRA">Color / muestra</option>
                  <option value="INGENIERIA">Ingeniería</option>
                  <option value="LIBERACION_PRODUCTIVA">
                    Liberación productiva
                  </option>
                </select>
                <div className={styles.definitionSubrow}>
                  <select
                    aria-label={`Etapa del documento ${index + 1}`}
                    value={item.etapa}
                    onChange={(event) =>
                      setDocumentos((prev) =>
                        prev.map((value, i) =>
                          i === index
                            ? {
                                ...value,
                                etapa:
                                  event.target.value as ProductoRecetaDocumentoInput["etapa"],
                              }
                            : value,
                        ),
                      )
                    }
                  >
                    <option value="BRIEF">Brief</option>
                    <option value="DISENO">Diseño</option>
                    <option value="PROTOTIPO">Prototipo</option>
                    <option value="MUESTRA">Muestra</option>
                    <option value="PRODUCCION">Producción</option>
                  </select>
                  <select
                    aria-label={`Paso protegido por el documento ${index + 1}`}
                    value={item.pasoClave ?? ""}
                    onChange={(event) =>
                      setDocumentos((prev) =>
                        prev.map((value, i) =>
                          i === index
                            ? {
                                ...value,
                                pasoClave: event.target.value || null,
                              }
                            : value,
                        ),
                      )
                    }
                  >
                    <option value="">Toda la orden</option>
                    {pasosDocumento.map((paso) => (
                      <option value={paso.value} key={paso.value}>
                        Antes de {paso.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  aria-label={`Quitar documento ${index + 1}`}
                  onClick={() =>
                    setDocumentos((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <Trash2Icon />
                </button>
              </div>
            ))}
            {!documentos.length ? <p>Sin documentos declarados.</p> : null}
          </div>
        </section>

        <section className={styles.editorSection}>
          <div className={styles.editorTitle}>
            <div>
              <strong>Componentes fabricados</strong>
              <span>
                Subproductos con receta propia; la Fase 4 coordinará su red.
              </span>
            </div>
            <button
              type="button"
              disabled={!productos.length}
              onClick={() => {
                const child = productos[0];
                if (!child) return;
                setComponentes((prev) => [
                  ...prev,
                  {
                    productoComponenteId: child.id,
                    codigo: child.codigo,
                    nombre: child.nombre,
                    politicaEjecucion: "INDEPENDIENTE",
                    formula: "por_unidad",
                    cantidad: 1,
                    unidad: "unidad",
                    requerido: true,
                  },
                ]);
              }}
            >
              <PlusIcon /> Agregar
            </button>
          </div>
          <div className={styles.editorRows}>
            {componentes.map((item, index) => (
              <div
                className={styles.definitionRow}
                key={`${item.productoComponenteId}-${index}`}
              >
                <select
                  aria-label={`Producto componente ${index + 1}`}
                  value={item.productoComponenteId}
                  onChange={(event) => {
                    const child = productos.find(
                      (value) => value.id === event.target.value,
                    );
                    if (!child) return;
                    setComponentes((prev) =>
                      prev.map((value, i) =>
                        i === index
                          ? {
                              ...value,
                              productoComponenteId: child.id,
                              codigo: child.codigo,
                              nombre: child.nombre,
                            }
                          : value,
                      ),
                    );
                  }}
                >
                  {productos.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Cantidad del componente ${index + 1}`}
                  type="number"
                  min={0.000001}
                  step={0.01}
                  value={item.cantidad}
                  onChange={(event) =>
                    setComponentes((prev) =>
                      prev.map((value, i) =>
                        i === index
                          ? { ...value, cantidad: Number(event.target.value) }
                          : value,
                      ),
                    )
                  }
                />
                <select
                  aria-label={`Política del componente ${index + 1}`}
                  value={item.politicaEjecucion ?? "INDEPENDIENTE"}
                  onChange={(event) =>
                    setComponentes((prev) =>
                      prev.map((value, i) =>
                        i === index
                          ? {
                              ...value,
                              politicaEjecucion: event.target.value as
                                "INLINE" | "INDEPENDIENTE",
                            }
                          : value,
                      ),
                    )
                  }
                >
                  <option value="INDEPENDIENTE">OT independiente</option>
                  <option value="INLINE">Dentro de la OT principal</option>
                </select>
                <button
                  type="button"
                  aria-label={`Quitar componente ${index + 1}`}
                  onClick={() =>
                    setComponentes((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <Trash2Icon />
                </button>
              </div>
            ))}
            {!componentes.length ? <p>Sin componentes fabricados.</p> : null}
          </div>
        </section>
      </div>

      <footer className={styles.editorFooter}>
        <span>Guardar no publica: primero queda como borrador revisable.</span>
        <button type="button" disabled={saving} onClick={guardarDefiniciones}>
          {saving ? "Guardando…" : "Guardar definiciones"}
        </button>
      </footer>
    </div>
  );
}

function RevisionResumen({ revision }: { revision: ProductoRecetaRevision }) {
  return (
    <div className={styles.revisionBody}>
      <div className={styles.metrics}>
        <div>
          <span>Materiales</span>
          <strong>{revision.materiales.length}</strong>
        </div>
        <div>
          <span>Recursos</span>
          <strong>{revision.recursos.length}</strong>
        </div>
        <div>
          <span>Componentes fabricados</span>
          <strong>{revision.componentes.length}</strong>
        </div>
        <div>
          <span>Documentos requeridos</span>
          <strong>{revision.documentos.length}</strong>
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.block}>
          <header>
            <BoxesIcon />
            <div>
              <h4>BOM de materiales</h4>
              <p>Consumos consolidados desde los pasos de esta vía.</p>
            </div>
          </header>
          {revision.materiales.length ? (
            <div className={styles.rows}>
              {revision.materiales.map((material) => (
                <div className={styles.row} key={material.id}>
                  <div>
                    <strong>
                      {material.materialNombre ||
                        material.slotNombre ||
                        material.slotCodigo}
                    </strong>
                    <span>
                      {material.pasoNombre} · {etiquetaRol(material.rol)}
                    </span>
                  </div>
                  <div className={styles.rowMeta}>
                    <span>{material.formula.replaceAll("_", " ")}</span>
                    {Number(material.mermaAdicionalPct) > 0 ? (
                      <b>+{Number(material.mermaAdicionalPct)}% merma</b>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              Esta vía todavía no declara materiales.
            </p>
          )}
        </section>

        <section className={styles.block}>
          <header>
            <FactoryIcon />
            <div>
              <h4>Recursos productivos</h4>
              <p>Máquinas, perfiles, centros y trabajo humano.</p>
            </div>
          </header>
          {revision.recursos.length ? (
            <div className={styles.rows}>
              {revision.recursos.map((recurso) => (
                <div className={styles.row} key={recurso.id}>
                  <div>
                    <strong>{recurso.pasoNombre}</strong>
                    <span>
                      {recurso.tercerizado
                        ? recurso.proveedorNombre || "Proceso tercerizado"
                        : recurso.maquinaNombre ||
                          recurso.centroCostoNombre ||
                          "Recurso manual"}
                    </span>
                  </div>
                  <div className={styles.rowMeta}>
                    {recurso.perfilNombre ? (
                      <span>{recurso.perfilNombre}</span>
                    ) : null}
                    {recurso.dotacionOperarios > 1 ? (
                      <b>{recurso.dotacionOperarios} personas</b>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>No hay recursos configurados.</p>
          )}
        </section>
      </div>

      <div className={styles.secondaryGrid}>
        <section className={styles.secondaryBlock}>
          <FileCheck2Icon />
          <div>
            <strong>Documentos requeridos</strong>
            <span>
              {revision.documentos.length
                ? revision.documentos.map((item) => item.nombre).join(" · ")
                : "Sin requisitos documentales de plantilla"}
            </span>
          </div>
        </section>
        <section className={styles.secondaryBlock}>
          <GitCommitHorizontalIcon />
          <div>
            <strong>Huella de configuración</strong>
            <span className={styles.hash}>
              {revision.huellaConfiguracion.slice(0, 16)}…
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

export function RecetaProductoTab({
  producto,
  recetas,
  canManage,
}: {
  producto: ProductoDetalle;
  recetas: ProductoReceta[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [revisionARetirar, setRevisionARetirar] =
    React.useState<ProductoRecetaRevision | null>(null);

  const guardar = async (
    rutaAlternativaId: string,
    draft?: ProductoRecetaRevision,
  ) => {
    setWorking(`draft:${rutaAlternativaId}`);
    try {
      await guardarBorradorReceta(producto.id, {
        rutaAlternativaId,
        expectedUpdatedAt: draft?.updatedAt,
        cambios: draft
          ? "Configuración productiva actualizada"
          : "Primera receta importada desde la configuración productiva",
      });
      toast.success(
        draft
          ? "El borrador se actualizó con la configuración actual."
          : "Se creó el primer borrador de receta.",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la receta.",
      );
    } finally {
      setWorking(null);
    }
  };

  const publicar = async (revision: ProductoRecetaRevision) => {
    setWorking(`publish:${revision.id}`);
    try {
      await publicarReceta(revision.id, {
        expectedUpdatedAt: revision.updatedAt,
        cambios:
          revision.cambios || `Publicación de receta V${revision.numero}`,
      });
      toast.success(`La receta V${revision.numero} quedó publicada.`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo publicar la receta.",
      );
    } finally {
      setWorking(null);
    }
  };

  const retirarPublicada = async () => {
    if (!revisionARetirar) return;
    setWorking(`deprecate:${revisionARetirar.id}`);
    try {
      await deprecarReceta(revisionARetirar.id, {
        expectedUpdatedAt: revisionARetirar.updatedAt,
        motivo: "Versión retirada desde el workspace de Producción",
      });
      toast.success(`La versión V${revisionARetirar.numero} fue retirada.`);
      setRevisionARetirar(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo retirar la versión publicada.",
      );
    } finally {
      setWorking(null);
    }
  };

  if (!producto.rutasAlternativas.length) {
    return (
      <div className={styles.noRoutes}>
        <FactoryIcon />
        <h3>Primero configurá una ruta productiva</h3>
        <p>La receta se publica sobre una vía de fabricación concreta.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroIcon}>
          <ShieldCheckIcon />
        </div>
        <div>
          <span className={styles.eyebrow}>BOM versionada</span>
          <h2>Materiales, documentos y versiones</h2>
          <p>
            Esta vista consolida lo configurado en los pasos. Al publicar una
            versión, cotizaciones y OTs conservarán exactamente esa composición.
          </p>
        </div>
      </header>

      <div className={styles.routes}>
        {producto.rutasAlternativas.map((ruta) => {
          const receta = recetas.find(
            (item) => item.rutaAlternativa.id === ruta.id,
          );
          const draft = receta?.revisiones.find(
            (item) => item.estado === "BORRADOR",
          );
          const published = receta?.revisionPublicada ?? null;
          const visible = draft ?? published;
          return (
            <article className={styles.recipe} key={ruta.id}>
              <header className={styles.recipeHeader}>
                <div>
                  <span className={styles.routeCode}>
                    {ruta.ruta.codigo} · ruta V{ruta.rutaVersion}
                  </span>
                  <h3>{ruta.nombre}</h3>
                  <p>{ruta.ruta.nombre}</p>
                </div>
                <div className={styles.headerRight}>
                  {draft ? (
                    <span className={styles.status} data-state="draft">
                      V{draft.numero} · cambios sin publicar
                    </span>
                  ) : published ? (
                    <span className={styles.status} data-state="published">
                      V{published.numero} · publicada
                    </span>
                  ) : (
                    <span className={styles.status}>Sin receta</span>
                  )}
                  {canManage ? (
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        disabled={working !== null}
                        onClick={() => guardar(ruta.id, draft)}
                      >
                        <RefreshCwIcon />
                        {draft
                          ? `Sincronizar borrador V${draft.numero}`
                          : published
                            ? `Crear revisión V${published.numero + 1}`
                            : "Crear primera versión"}
                      </button>
                      {draft ? (
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          disabled={working !== null}
                          onClick={() =>
                            setEditing(editing === draft.id ? null : draft.id)
                          }
                        >
                          <PencilLineIcon />
                          Documentos y componentes
                        </button>
                      ) : null}
                      {published ? (
                        <button
                          type="button"
                          className={styles.dangerButton}
                          disabled={working !== null}
                          onClick={() => setRevisionARetirar(published)}
                        >
                          <ArchiveXIcon />
                          Retirar V{published.numero}
                        </button>
                      ) : null}
                      {draft ? (
                        <button
                          type="button"
                          className={styles.primaryButton}
                          disabled={working !== null}
                          onClick={() => publicar(draft)}
                        >
                          <RocketIcon />
                          Publicar V{draft.numero}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </header>

              {visible ? (
                <>
                  {draft && editing === draft.id ? (
                    <EditorDefiniciones
                      productoId={producto.id}
                      rutaAlternativaId={ruta.id}
                      ruta={ruta}
                      revision={draft}
                      onClose={() => setEditing(null)}
                    />
                  ) : null}
                  <RevisionResumen revision={visible} />
                  <footer className={styles.audit}>
                    <span>
                      {visible.estado === "PUBLICADA"
                        ? `Publicada por ${visible.publicadaPorNombre || visible.creadaPorNombre}`
                        : `Borrador de ${visible.creadaPorNombre}`}
                    </span>
                    <span>
                      {fecha(visible.publicadaEl || visible.updatedAt)}
                    </span>
                  </footer>
                  {receta && receta.revisiones.length > 1 ? (
                    <div className={styles.history}>
                      <span>Historial</span>
                      {receta.revisiones.map((revision) => (
                        <div key={revision.id} data-state={revision.estado.toLowerCase()}>
                          <strong>V{revision.numero}</strong>
                          <span>{revision.estado.toLowerCase()}</span>
                          <time>
                            {fecha(
                              revision.deprecadaEl ||
                                revision.publicadaEl ||
                                revision.updatedAt,
                            )}
                          </time>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className={styles.emptyRecipe}>
                  <BoxesIcon />
                  <div>
                    <strong>Esta vía todavía trabaja en modo compatible</strong>
                    <span>
                      Puede seguir cotizando como hasta ahora. Creá el borrador
                      cuando quieras comenzar a controlar sus revisiones.
                    </span>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <ConfirmacionDestructiva
        open={revisionARetirar !== null}
        onOpenChange={(open) => {
          if (!open) setRevisionARetirar(null);
        }}
        titulo="Retirar versión productiva"
        descripcion={
          revisionARetirar
            ? `La versión V${revisionARetirar.numero} dejará de estar disponible para nuevas cotizaciones.`
            : null
        }
        impacto={[
          "Las cotizaciones y órdenes existentes conservarán esta versión.",
          "El producto volverá al modo compatible hasta publicar otra versión.",
        ]}
        nombreItem={
          revisionARetirar ? `V${revisionARetirar.numero}` : undefined
        }
        requiereTipear={false}
        accionLabel="Retirar versión"
        onConfirmar={retirarPublicada}
      />
    </div>
  );
}
