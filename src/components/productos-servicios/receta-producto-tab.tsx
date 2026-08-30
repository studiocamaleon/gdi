"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveXIcon,
  BadgeCheckIcon,
  BlocksIcon,
  BoxesIcon,
  CopyPlusIcon,
  FactoryIcon,
  FileCheck2Icon,
  FilePlus2Icon,
  GitCommitHorizontalIcon,
  PencilLineIcon,
  PlusIcon,
  RefreshCwIcon,
  RocketIcon,
  Settings2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProductoDetalle } from "@/lib/productos-servicios";
import {
  descartarBorradorReceta,
  deprecarReceta,
  guardarBorradorReceta,
  getProductos,
  publicarReceta,
  type ProductoRecetaComponenteInput,
  type ProductoRecetaDocumentoInput,
  type ProductoReceta,
  type ProductoRecetaRevision,
} from "@/lib/productos-servicios-api";
import { ConfigurarComponenteWorkspace } from "./configurar-componente-workspace";
import { ConfigurarIncorporacionWorkspace } from "./configurar-incorporacion-workspace";
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

function nombreHumano(value?: string | null) {
  if (!value) return "—";
  let limpio = value.replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  if (!limpio) return "—";
  const correcciones: Array<[RegExp, string]> = [
    [/\bimpresion\b/gi, "impresión"],
    [/\bproduccion\b/gi, "producción"],
    [/\bpreparacion\b/gi, "preparación"],
    [/\bcolocacion\b/gi, "colocación"],
    [/\bacrilico\b/gi, "acrílico"],
    [/\bceramico\b/gi, "cerámico"],
    [/\bplastico\b/gi, "plástico"],
    [/\biman\b/gi, "imán"],
    [/\blaser\b/gi, "láser"],
  ];
  for (const [patron, reemplazo] of correcciones) {
    limpio = limpio.replace(patron, reemplazo);
  }
  return limpio.charAt(0).toLocaleUpperCase("es-AR") + limpio.slice(1);
}

function EditorDefiniciones({
  productoId,
  productoNombre,
  rutaAlternativaId,
  ruta,
  revision,
  onClose,
}: {
  productoId: string;
  productoNombre: string;
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
      configuracionJson: item.configuracionJson,
      nodoIncorporacionClave: item.nodoIncorporacionClave,
      orden: item.orden,
    })),
  );
  const [componenteConfigurando, setComponenteConfigurando] = React.useState<
    number | null
  >(null);
  const [incorporacionConfigurando, setIncorporacionConfigurando] =
    React.useState<number | null>(null);
  const pasosDocumento = React.useMemo(
    () => [
      ...ruta.ruta.pasos
        .filter((paso) => paso.activo)
        .map((paso) => {
          const config = ruta.configPasos.find(
            (item) => item.rutaPasoId === paso.id,
          );
          return {
            value: `ruta:${paso.id}`,
            label: nombreHumano(
              config?.nombreVisible ||
                paso.nombreVisible ||
                paso.familiaNombre ||
                paso.familiaCodigo,
            ),
          };
        }),
      ...(ruta.pasosExtras ?? [])
        .filter((paso) => paso.activo)
        .map((paso) => ({
          value: `extra:${paso.id}`,
          label: nombreHumano(paso.nombreVisible || paso.familiaCodigo),
        })),
    ],
    [ruta],
  );
  const [dependencias, setDependencias] = React.useState<
    Array<{ desdeClave: string; haciaClave: string }>
  >(() => {
    const publicadas = revision.grafoProduccionJson?.aristas;
    if (publicadas?.length || revision.grafoProduccionJson?.nodos.length === 1)
      return publicadas ?? [];
    const claves = [
      ...ruta.ruta.pasos
        .filter((paso) => paso.activo)
        .map((paso) => `ruta:${paso.id}`),
      ...(ruta.pasosExtras ?? [])
        .filter((paso) => paso.activo)
        .map((paso) => `extra:${paso.id}`),
    ];
    return claves.slice(1).map((haciaClave, index) => ({
      desdeClave: claves[index],
      haciaClave,
    }));
  });
  const [gates, setGates] = React.useState<
    Array<{ nodoClave: string; tipo: "MATERIAL" | "CALIDAD" }>
  >(() =>
    (revision.grafoProduccionJson?.nodos ?? []).flatMap((nodo) =>
      (nodo.gates ?? []).map((tipo) => ({ nodoClave: nodo.clave, tipo })),
    ),
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
        dependencias,
        gates,
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
        <section className={`${styles.editorSection} ${styles.flowSection}`}>
          <div className={styles.editorTitle}>
            <div>
              <strong>Dependencias del flujo</strong>
              <span>
                Marcá qué pasos deben terminar antes de habilitar cada nodo.
                Varias marcas crean una convergencia; un mismo antecesor puede
                liberar ramas paralelas.
              </span>
            </div>
            <span className={styles.topologyBadge}>
              {dependencias.length === Math.max(0, pasosDocumento.length - 1) &&
              pasosDocumento
                .slice(1)
                .every((paso, index) =>
                  dependencias.some(
                    (dependencia) =>
                      dependencia.desdeClave === pasosDocumento[index].value &&
                      dependencia.haciaClave === paso.value,
                  ),
                )
                ? "Ruta lineal"
                : "Ruta con ramas"}
            </span>
          </div>
          <div className={styles.flowRows}>
            {pasosDocumento.map((paso, index) => {
              const anteriores = pasosDocumento.slice(0, index);
              return (
                <div className={styles.flowRow} key={paso.value}>
                  <div className={styles.flowNode}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{paso.label}</strong>
                  </div>
                  <div className={styles.predecessors}>
                    {anteriores.length ? (
                      anteriores.map((anterior) => {
                        const activo = dependencias.some(
                          (dependencia) =>
                            dependencia.desdeClave === anterior.value &&
                            dependencia.haciaClave === paso.value,
                        );
                        return (
                          <button
                            type="button"
                            key={anterior.value}
                            data-active={activo}
                            onClick={() =>
                              setDependencias((actuales) =>
                                activo
                                  ? actuales.filter(
                                      (dependencia) =>
                                        !(
                                          dependencia.desdeClave ===
                                            anterior.value &&
                                          dependencia.haciaClave === paso.value
                                        ),
                                    )
                                  : [
                                      ...actuales,
                                      {
                                        desdeClave: anterior.value,
                                        haciaClave: paso.value,
                                      },
                                    ],
                              )
                            }
                          >
                            {activo ? "✓ " : "+ "}
                            {anterior.label}
                          </button>
                        );
                      })
                    ) : (
                      <span className={styles.rootNode}>Inicio de la ruta</span>
                    )}
                  </div>
                  <div className={styles.predecessors}>
                    {(
                      [
                        ["MATERIAL", "Material disponible"],
                        ["CALIDAD", "Control de calidad"],
                      ] as const
                    ).map(([tipo, etiqueta]) => {
                      const activo = gates.some(
                        (gate) =>
                          gate.nodoClave === paso.value && gate.tipo === tipo,
                      );
                      return (
                        <button
                          type="button"
                          key={tipo}
                          data-active={activo}
                          title={`Exigir ${etiqueta.toLowerCase()} antes de ejecutar ${paso.label}`}
                          onClick={() =>
                            setGates((actuales) =>
                              activo
                                ? actuales.filter(
                                    (gate) =>
                                      !(
                                        gate.nodoClave === paso.value &&
                                        gate.tipo === tipo
                                      ),
                                  )
                                : [
                                    ...actuales,
                                    { nodoClave: paso.value, tipo },
                                  ],
                            )
                          }
                        >
                          {activo ? "✓ " : "+ "}
                          {etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

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
                                etapa: event.target
                                  .value as ProductoRecetaDocumentoInput["etapa"],
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
                Subproductos con receta propia y el punto exacto donde se
                incorporan al flujo principal.
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
                    nodoIncorporacionClave:
                      pasosDocumento.at(-1)?.value ?? null,
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
                                | "INLINE"
                                | "INDEPENDIENTE",
                            }
                          : value,
                      ),
                    )
                  }
                >
                  <option value="INDEPENDIENTE">Fabricación separada</option>
                  <option value="INLINE">Integrado al producto</option>
                </select>
                <select
                  aria-label={`Nodo de incorporación ${index + 1}`}
                  value={item.nodoIncorporacionClave ?? ""}
                  onChange={(event) =>
                    setComponentes((prev) =>
                      prev.map((value, i) =>
                        i === index
                          ? {
                              ...value,
                              nodoIncorporacionClave:
                                event.target.value || null,
                            }
                          : value,
                      ),
                    )
                  }
                >
                  <option value="">Elegir incorporación…</option>
                  {pasosDocumento.map((paso) => (
                    <option value={paso.value} key={paso.value}>
                      Antes de {paso.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.configureUsage}
                  onClick={() => setComponenteConfigurando(index)}
                >
                  <Settings2Icon />
                  {item.configuracionJson?.bindings?.length
                    ? `${item.configuracionJson.bindings.length} parámetros configurados`
                    : "Configurar uso"}
                </button>
                <button
                  type="button"
                  className={styles.configureIncorporation}
                  disabled={
                    !item.nodoIncorporacionClave ||
                    !item.configuracionJson?.bindings?.some(
                      (binding) => binding.clave === "cantidad",
                    )
                  }
                  title={
                    !item.nodoIncorporacionClave
                      ? "Primero elegí el paso de incorporación"
                      : item.configuracionJson?.bindings?.some(
                            (binding) => binding.clave === "cantidad",
                          )
                        ? "Configurar las tareas necesarias para incorporar este componente"
                        : "Primero configurá el uso del componente"
                  }
                  onClick={() => setIncorporacionConfigurando(index)}
                >
                  <BlocksIcon />
                  {item.configuracionJson?.operacionesIncorporacion?.length
                    ? `${item.configuracionJson.operacionesIncorporacion.length} operaciones de ensamblaje`
                    : "Configurar incorporación"}
                </button>
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
      {componenteConfigurando !== null &&
      componentes[componenteConfigurando] ? (
        <ConfigurarComponenteWorkspace
          componente={componentes[componenteConfigurando]}
          productoPadreId={productoId}
          productoPadreNombre={productoNombre}
          componentesHermanos={componentes.filter(
            (_, index) => index !== componenteConfigurando,
          )}
          onCancel={() => setComponenteConfigurando(null)}
          onSave={(configuracionJson, unidad) => {
            setComponentes((current) =>
              current.map((item, index) =>
                index === componenteConfigurando
                  ? { ...item, configuracionJson, unidad }
                  : item,
              ),
            );
            setComponenteConfigurando(null);
          }}
        />
      ) : null}
      {incorporacionConfigurando !== null &&
      componentes[incorporacionConfigurando] ? (
        <ConfigurarIncorporacionWorkspace
          componente={componentes[incorporacionConfigurando]}
          productoPadreId={productoId}
          productoPadreNombre={productoNombre}
          componentes={componentes}
          nodoNombre={
            pasosDocumento.find(
              (paso) =>
                paso.value ===
                componentes[incorporacionConfigurando].nodoIncorporacionClave,
            )?.label ?? "Paso de incorporación"
          }
          onCancel={() => setIncorporacionConfigurando(null)}
          onSave={(configuracionJson) => {
            setComponentes((current) =>
              current.map((item, index) =>
                index === incorporacionConfigurando
                  ? { ...item, configuracionJson }
                  : item,
              ),
            );
            setIncorporacionConfigurando(null);
          }}
        />
      ) : null}
    </div>
  );
}

function RevisionResumen({ revision }: { revision: ProductoRecetaRevision }) {
  const grafo = revision.grafoProduccionJson;
  const nombreNodo = (clave: string) =>
    nombreHumano(
      revision.recursos.find((recurso) => recurso.pasoClave === clave)
        ?.pasoNombre ?? clave.replace(/^(ruta|extra):/, ""),
    );
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

      {grafo?.nodos.length ? (
        <section className={styles.flowOverview}>
          <header>
            <div>
              <GitCommitHorizontalIcon />
              <div>
                <h4>Flujo y precedencias</h4>
                <p>
                  {grafo.topologia === "LINEAL"
                    ? "Recorrido lineal compatible"
                    : `${grafo.raices.length} inicio(s), ${grafo.terminales.length} terminal(es) y ramas paralelas`}
                </p>
              </div>
            </div>
            <span>{grafo.topologia}</span>
          </header>
          <div className={styles.flowOverviewRows}>
            {grafo.nodos.map((nodo, index) => {
              const previos = grafo.aristas
                .filter((arista) => arista.haciaClave === nodo.clave)
                .map((arista) => arista.desdeClave);
              const operaciones = revision.componentes.flatMap((componente) =>
                componente.nodoIncorporacionClave === nodo.clave
                  ? (componente.configuracionJson?.operacionesIncorporacion ??
                    [])
                  : [],
              );
              return (
                <div key={nodo.clave}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <strong>{nombreNodo(nodo.clave)}</strong>
                  <span>
                    {previos.length
                      ? `Después de ${previos.map(nombreNodo).join(" + ")}`
                      : "Inicio disponible"}
                    {operaciones.length
                      ? ` · Paso compuesto con ${operaciones.length} ${operaciones.length === 1 ? "operación" : "operaciones"}`
                      : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

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
                      {nombreHumano(
                        material.materialNombre ||
                          material.slotNombre ||
                          material.slotCodigo,
                      )}
                    </strong>
                    <span>
                      {nombreHumano(material.pasoNombre)} ·{" "}
                      {etiquetaRol(material.rol)}
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
                    <strong>{nombreHumano(recurso.pasoNombre)}</strong>
                    <span>
                      {recurso.tercerizado
                        ? recurso.proveedorNombre || "Proceso tercerizado"
                        : recurso.maquinaNombre ||
                          recurso.centroCostoNombre ||
                          "Recurso manual"}
                    </span>
                  </div>
                  <div className={styles.rowMeta}>
                    {recurso.estacionNombre ? (
                      <span>Estación {recurso.estacionNombre}</span>
                    ) : null}
                    {recurso.perfilNombre ? (
                      <span>{recurso.perfilNombre}</span>
                    ) : null}
                    {recurso.dotacionOperarios > 1 ? (
                      <b>{recurso.dotacionOperarios} personas</b>
                    ) : null}
                    {recurso.habilidadesRequeridas?.length ? (
                      <b>
                        Habilidades:{" "}
                        {recurso.habilidadesRequeridas
                          .map(nombreHumano)
                          .join(", ")}
                      </b>
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

      {revision.componentes.length ? (
        <section className={styles.block}>
          <header>
            <BlocksIcon />
            <div>
              <h4>Componentes fabricados</h4>
              <p>Productos con receta propia incluidos en esta versión.</p>
            </div>
          </header>
          <div className={styles.rows}>
            {revision.componentes.map((componente) => (
              <div className={styles.row} key={componente.id}>
                <div>
                  <strong>{nombreHumano(componente.nombre)}</strong>
                  <span>
                    Receta V{componente.recetaVersion} ·{" "}
                    {componente.politicaEjecucion === "INDEPENDIENTE"
                      ? "fabricación separada"
                      : "integrado al producto"}
                    {componente.nodoIncorporacionClave
                      ? ` · se incorpora antes de ${nombreNodo(componente.nodoIncorporacionClave)}`
                      : ""}
                    {componente.configuracionJson?.operacionesIncorporacion
                      ?.length
                      ? ` · ${componente.configuracionJson.operacionesIncorporacion.length} operaciones de incorporación`
                      : ""}
                  </span>
                </div>
                <div className={styles.rowMeta}>
                  <span>
                    {Number(componente.cantidad)}{" "}
                    {nombreHumano(componente.unidad).toLocaleLowerCase("es-AR")}
                  </span>
                  <b>{componente.requerido ? "Requerido" : "Opcional"}</b>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
  const [revisionADescartar, setRevisionADescartar] =
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

  const descartarBorrador = async () => {
    if (!revisionADescartar) return;
    setWorking(`discard:${revisionADescartar.id}`);
    try {
      await descartarBorradorReceta(revisionADescartar.id, {
        expectedUpdatedAt: revisionADescartar.updatedAt,
      });
      toast.success(
        `El borrador V${revisionADescartar.numero} fue descartado.`,
      );
      setRevisionADescartar(null);
      setEditing(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo descartar el borrador.",
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
    <TooltipProvider delay={180}>
      <div className={styles.page}>
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
                      <Tooltip>
                        <TooltipTrigger
                          render={(props) => (
                            <span
                              {...props}
                              className={styles.statusIcon}
                              data-state="published"
                              tabIndex={0}
                              aria-label={`Receta V${published.numero} publicada`}
                            >
                              <BadgeCheckIcon />
                            </span>
                          )}
                        />
                        <TooltipContent>
                          Receta V{published.numero} publicada
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className={styles.status}>Sin receta</span>
                    )}
                    {canManage ? (
                      <div className={styles.actions}>
                        <Tooltip>
                          <TooltipTrigger
                            render={(props) => (
                              <button
                                {...props}
                                type="button"
                                className={`${styles.secondaryButton} ${styles.iconButton}`}
                                disabled={working !== null}
                                aria-label={
                                  draft
                                    ? `Sincronizar borrador V${draft.numero}`
                                    : published
                                      ? `Crear revisión V${published.numero + 1}`
                                      : "Crear primera versión"
                                }
                                onClick={() => guardar(ruta.id, draft)}
                              >
                                {draft ? (
                                  <RefreshCwIcon />
                                ) : published ? (
                                  <CopyPlusIcon />
                                ) : (
                                  <FilePlus2Icon />
                                )}
                              </button>
                            )}
                          />
                          <TooltipContent>
                            {draft
                              ? `Actualizar el borrador V${draft.numero} con rutas y pasos actuales`
                              : published
                                ? `Crear borrador V${published.numero + 1} para editar documentos y componentes`
                                : "Crear la primera versión de la receta"}
                          </TooltipContent>
                        </Tooltip>
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
                            Editar receta
                          </button>
                        ) : null}
                        {draft ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={(props) => (
                                <button
                                  {...props}
                                  type="button"
                                  className={`${styles.dangerButton} ${styles.iconButton}`}
                                  disabled={working !== null}
                                  aria-label={`Descartar borrador V${draft.numero}`}
                                  onClick={() => setRevisionADescartar(draft)}
                                >
                                  <Trash2Icon />
                                </button>
                              )}
                            />
                            <TooltipContent>
                              Descartar borrador V{draft.numero}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                        {published ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={(props) => (
                                <button
                                  {...props}
                                  type="button"
                                  className={`${styles.dangerButton} ${styles.iconButton}`}
                                  disabled={working !== null}
                                  aria-label={`Retirar receta V${published.numero}`}
                                  onClick={() => setRevisionARetirar(published)}
                                >
                                  <ArchiveXIcon />
                                </button>
                              )}
                            />
                            <TooltipContent>
                              Retirar receta V{published.numero}
                            </TooltipContent>
                          </Tooltip>
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
                        productoNombre={producto.nombre}
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
                          <div
                            key={revision.id}
                            data-state={revision.estado.toLowerCase()}
                          >
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
                      <strong>
                        Esta vía todavía trabaja en modo compatible
                      </strong>
                      <span>
                        Puede seguir cotizando como hasta ahora. Creá el
                        borrador cuando quieras comenzar a controlar sus
                        revisiones.
                      </span>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <ConfirmacionDestructiva
          open={revisionADescartar !== null}
          onOpenChange={(open) => {
            if (!open) setRevisionADescartar(null);
          }}
          titulo="Descartar borrador"
          descripcion={
            revisionADescartar
              ? `Se eliminarán los cambios sin publicar de la versión V${revisionADescartar.numero}.`
              : null
          }
          impacto={[
            "La receta publicada vigente permanecerá sin cambios.",
            "Los documentos y componentes agregados sólo a este borrador se perderán.",
          ]}
          nombreItem={
            revisionADescartar
              ? `Borrador V${revisionADescartar.numero}`
              : undefined
          }
          requiereTipear={false}
          accionLabel="Descartar borrador"
          onConfirmar={descartarBorrador}
        />
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
    </TooltipProvider>
  );
}
