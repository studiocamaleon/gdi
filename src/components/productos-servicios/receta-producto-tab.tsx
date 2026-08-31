"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  ArchiveXIcon,
  BadgeCheckIcon,
  BoxIcon,
  BlocksIcon,
  BoxesIcon,
  CopyPlusIcon,
  FactoryIcon,
  FileCheck2Icon,
  FilePlus2Icon,
  GitCommitHorizontalIcon,
  GripVerticalIcon,
  PencilLineIcon,
  PlusIcon,
  RefreshCwIcon,
  RocketIcon,
  Settings2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  CatalogoFamilias,
  PasoExtra,
  PasoTenant,
  ProductoDetalle,
} from "@/lib/productos-servicios";
import {
  construirColumnasProductivas,
  insertarNodoProductivo,
  moverNodoProductivo,
} from "@/lib/modelo-productivo-layout";
import {
  agregarPasoExtra,
  descartarBorradorReceta,
  deprecarReceta,
  eliminarPasoExtra,
  guardarBorradorReceta,
  getProductos,
  getPasosTenant,
  publicarReceta,
  type ProductoRecetaComponenteInput,
  type ProductoRecetaDocumentoInput,
  type ProductoReceta,
  type ProductoRecetaRevision,
  type ConfiguracionPasoCompuesto,
} from "@/lib/productos-servicios-api";
import { ConfigurarComponenteWorkspace } from "./configurar-componente-workspace";
import { ConfigurarIncorporacionWorkspace } from "./configurar-incorporacion-workspace";
import styles from "./receta-producto-tab.module.css";

type ContextoAltaNodo =
  | { tipo: "SECUENCIAL"; posicion: number }
  | { tipo: "PARALELO"; columna: number };

type TipoAltaNodo = "PASO" | "COMPONENTE" | "ETAPA";

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

export function EditorDefiniciones({
  producto,
  catalogoFamilias,
  rutaAlternativaId,
  ruta,
  revision,
  onClose,
  embedded = false,
  nodoSeleccionado = "ruta",
  onSeleccionarNodo,
  onEditarPaso,
}: {
  producto: ProductoDetalle;
  catalogoFamilias?: CatalogoFamilias;
  rutaAlternativaId: string;
  ruta: ProductoDetalle["rutasAlternativas"][number];
  revision: ProductoRecetaRevision;
  onClose: () => void;
  embedded?: boolean;
  nodoSeleccionado?: string;
  onSeleccionarNodo?: (nodoClave: string) => void;
  onEditarPaso?: (nodoClave: string) => void;
}) {
  const productoId = producto.id;
  const productoNombre = producto.nombre;
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [productos, setProductos] = React.useState<
    Array<{ id: string; codigo: string; nombre: string }>
  >([]);
  const [pasosTenant, setPasosTenant] = React.useState<PasoTenant[]>([]);
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
      nodosPredecesoresClaves: item.nodosPredecesoresClaves ?? [],
      orden: item.orden,
    })),
  );
  const [pasosCompuestos, setPasosCompuestos] = React.useState<
    ConfiguracionPasoCompuesto[]
  >(revision.pasosCompuestosJson ?? []);
  const [componenteConfigurando, setComponenteConfigurando] = React.useState<
    number | null
  >(null);
  const [pasoCompuestoConfigurando, setPasoCompuestoConfigurando] =
    React.useState<string | null>(null);
  const [productoNuevoId, setProductoNuevoId] = React.useState("");
  const [nodoArrastrado, setNodoArrastrado] = React.useState<string | null>(
    null,
  );
  const [destinoArrastre, setDestinoArrastre] = React.useState<string | null>(
    null,
  );
  const [contextoAltaNodo, setContextoAltaNodo] =
    React.useState<ContextoAltaNodo | null>(null);
  const [tipoAltaNodo, setTipoAltaNodo] = React.useState<TipoAltaNodo | null>(
    null,
  );
  const [busquedaAltaNodo, setBusquedaAltaNodo] = React.useState("");
  const [creandoNodo, setCreandoNodo] = React.useState(false);
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

  const componenteSeleccionado = nodoSeleccionado.startsWith("componente:")
    ? nodoSeleccionado.slice("componente:".length)
    : null;
  const etapaSeleccionada = nodoSeleccionado.startsWith("etapa:")
    ? nodoSeleccionado.slice("etapa:".length)
    : null;
  const pasoSeleccionado = nodoSeleccionado.startsWith("paso:")
    ? nodoSeleccionado.slice("paso:".length)
    : null;
  const detallePasoSeleccionado = pasoSeleccionado
    ? pasosDocumento.find((item) => item.value === pasoSeleccionado)
    : null;
  const creandoComponente = nodoSeleccionado === "nuevo-componente";
  const productosDisponibles = productos.filter(
    (productoDisponible) =>
      !componentes.some(
        (componente) =>
          componente.productoComponenteId === productoDisponible.id,
      ),
  );
  const idsEtapas = React.useMemo(
    () =>
      new Set(
        pasosTenant
          .filter((paso) => paso.tipoPaso === "COMPUESTO")
          .map((paso) => paso.id),
      ),
    [pasosTenant],
  );
  const pasosDisponibles = React.useMemo(
    () =>
      (catalogoFamilias?.familias ?? []).filter(
        (familia) =>
          familia.visibleEnSelector !== false && !idsEtapas.has(familia.codigo),
      ),
    [catalogoFamilias?.familias, idsEtapas],
  );
  const etapasDisponibles = React.useMemo(
    () => pasosTenant.filter((paso) => paso.tipoPaso === "COMPUESTO"),
    [pasosTenant],
  );
  const nodosHojaRuta = React.useMemo(
    () => [
      ...pasosDocumento.map((paso, index) => {
        const esEtapa = pasosCompuestos.some(
          (item) => item.nodoClave === paso.value,
        );
        return {
          clave: paso.value,
          tipo: esEtapa ? ("ETAPA" as const) : ("PASO" as const),
          orden: 100 + index,
          nombre: paso.label,
          seleccion: esEtapa ? `etapa:${paso.value}` : `paso:${paso.value}`,
        };
      }),
      ...componentes.map((componente, index) => ({
        clave: `componente:${componente.codigo}`,
        tipo: "COMPONENTE" as const,
        orden: index,
        nombre: componente.nombre,
        seleccion: `componente:${componente.codigo}`,
      })),
    ],
    [componentes, pasosCompuestos, pasosDocumento],
  );
  const aristasHojaRuta = React.useMemo(
    () => [
      ...dependencias,
      ...componentes.flatMap((componente) => {
        const nodoComponente = `componente:${componente.codigo}`;
        return [
          ...(componente.nodosPredecesoresClaves ?? []).map((desdeClave) => ({
            desdeClave,
            haciaClave: nodoComponente,
          })),
          ...(componente.nodoIncorporacionClave
            ? [
                {
                  desdeClave: nodoComponente,
                  haciaClave: componente.nodoIncorporacionClave,
                },
              ]
            : []),
        ];
      }),
    ],
    [componentes, dependencias],
  );
  const columnasHojaRuta = React.useMemo(
    () => construirColumnasProductivas(nodosHojaRuta, aristasHojaRuta),
    [aristasHojaRuta, nodosHojaRuta],
  );

  const resolverOrdenHojaRuta = (
    columnas: string[][],
    componentesBase = componentes,
    clavesPasoBase = pasosDocumento.map((paso) => paso.value),
  ) => {
    const clavesPaso = new Set(clavesPasoBase);
    const clavesComponente = new Set(
      componentesBase.map((componente) => `componente:${componente.codigo}`),
    );

    for (let index = 0; index < columnas.length; index += 1) {
      const actuales = columnas[index];
      const anteriores = columnas[index - 1] ?? [];
      const siguientes = columnas[index + 1] ?? [];
      const componentesActuales = actuales.filter((clave) =>
        clavesComponente.has(clave),
      );
      if (!componentesActuales.length) continue;

      if (anteriores.some((clave) => clavesComponente.has(clave))) {
        return {
          ok: false as const,
          error:
            "Dos componentes no pueden encadenarse directamente todavía. Ubicalos en paralelo o separalos con un paso del producto padre.",
        };
      }
      const pasosSiguientes = siguientes.filter((clave) =>
        clavesPaso.has(clave),
      );
      if (pasosSiguientes.length !== 1) {
        return {
          ok: false as const,
          error:
            "Cada bloque de componentes debe converger en un único paso o etapa del producto padre.",
        };
      }
    }

    const nuevasDependencias = columnas.flatMap((columna, index) => {
      if (index === 0) return [];
      const pasosAnteriores = columnas[index - 1].filter((clave) =>
        clavesPaso.has(clave),
      );
      const pasosActuales = columna.filter((clave) => clavesPaso.has(clave));
      return pasosAnteriores.flatMap((desdeClave) =>
        pasosActuales.map((haciaClave) => ({ desdeClave, haciaClave })),
      );
    });

    const componentesActualizados = componentesBase.map((componente) => {
      const clave = `componente:${componente.codigo}`;
      const posicion = columnas.findIndex((columna) => columna.includes(clave));
      const predecesores = (columnas[posicion - 1] ?? []).filter((item) =>
        clavesPaso.has(item),
      );
      const incorporacion = (columnas[posicion + 1] ?? []).find((item) =>
        clavesPaso.has(item),
      );
      return {
        ...componente,
        nodosPredecesoresClaves: predecesores,
        nodoIncorporacionClave: incorporacion ?? null,
      };
    });

    return {
      ok: true as const,
      dependencias: nuevasDependencias,
      componentes: componentesActualizados,
    };
  };

  const aplicarOrdenHojaRuta = (columnas: string[][]) => {
    const resultado = resolverOrdenHojaRuta(columnas);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return false;
    }
    setDependencias(resultado.dependencias);
    setComponentes(resultado.componentes);
    return true;
  };

  const soltarNodo = (
    nodoClave: string,
    destino:
      | { tipo: "PARALELO"; columna: number }
      | { tipo: "SECUENCIAL"; posicion: number },
  ) => {
    const columnas = columnasHojaRuta.map((columna) =>
      columna.map((nodo) => nodo.clave),
    );
    aplicarOrdenHojaRuta(moverNodoProductivo(columnas, nodoClave, destino));
    setNodoArrastrado(null);
    setDestinoArrastre(null);
  };

  const abrirAltaNodo = (contexto: ContextoAltaNodo) => {
    setContextoAltaNodo(contexto);
    setTipoAltaNodo(null);
    setBusquedaAltaNodo("");
  };

  const cerrarAltaNodo = () => {
    if (creandoNodo) return;
    setContextoAltaNodo(null);
    setTipoAltaNodo(null);
    setBusquedaAltaNodo("");
  };

  const agregarComponente = (productoId?: string) => {
    const contexto = contextoAltaNodo ?? {
      tipo: "SECUENCIAL" as const,
      posicion: Math.max(0, columnasHojaRuta.length - 1),
    };
    const child =
      productosDisponibles.find((item) => item.id === productoId) ??
      productosDisponibles[0];
    if (!child) return;
    const nuevoComponente: ProductoRecetaComponenteInput = {
      productoComponenteId: child.id,
      codigo: child.codigo,
      nombre: child.nombre,
      politicaEjecucion: "INDEPENDIENTE",
      formula: "por_unidad",
      cantidad: 1,
      unidad: "unidad",
      requerido: true,
      nodosPredecesoresClaves: [],
      nodoIncorporacionClave: null,
    };
    const componentesSiguientes = [...componentes, nuevoComponente];
    const columnas = insertarNodoProductivo(
      columnasHojaRuta.map((columna) => columna.map((nodo) => nodo.clave)),
      `componente:${child.codigo}`,
      contexto,
    );
    const resultado = resolverOrdenHojaRuta(columnas, componentesSiguientes);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    setDependencias(resultado.dependencias);
    setComponentes(resultado.componentes);
    setProductoNuevoId("");
    cerrarAltaNodo();
    onSeleccionarNodo?.(`componente:${child.codigo}`);
    toast.success("Componente agregado en la posición elegida.");
  };

  React.useEffect(() => {
    void Promise.all([getProductos(true), getPasosTenant()])
      .then(([items, pasos]) => {
        setProductos(
          items
            .filter((item) => item.id !== productoId)
            .map((item) => ({
              id: item.id,
              codigo: item.codigo,
              nombre: item.nombre,
            })),
        );
        setPasosTenant(pasos);
        setPasosCompuestos((current) => {
          const existentes = new Set(current.map((item) => item.nodoClave));
          const nuevos = pasosDocumento.flatMap((nodo) => {
            if (existentes.has(nodo.value)) return [];
            const rutaPaso = ruta.ruta.pasos.find(
              (item) => `ruta:${item.id}` === nodo.value,
            );
            const extra = (ruta.pasosExtras ?? []).find(
              (item) => `extra:${item.id}` === nodo.value,
            );
            const familiaCodigo =
              rutaPaso?.familiaCodigo ?? extra?.familiaCodigo;
            const plantilla = pasos.find(
              (item) =>
                item.id === familiaCodigo && item.tipoPaso === "COMPUESTO",
            );
            return plantilla
              ? [
                  {
                    version: 2 as const,
                    nodoClave: nodo.value,
                    pasoTenantId: plantilla.id,
                    pasoNombre: nodo.label,
                    operaciones: [],
                    pasos: [],
                  },
                ]
              : [];
          });
          return [...current, ...nuevos];
        });
      })
      .catch(() => {
        setProductos([]);
        setPasosTenant([]);
      });
  }, [pasosDocumento, productoId, ruta]);

  const crearPasoEnContexto = async ({
    familiaCodigo,
    nombre,
    etapa,
  }: {
    familiaCodigo: string;
    nombre: string;
    etapa?: PasoTenant;
  }) => {
    if (!contextoAltaNodo || creandoNodo) return;
    setCreandoNodo(true);
    let creado: PasoExtra | null = null;
    try {
      const columnasActuales = columnasHojaRuta.map((columna) =>
        columna.map((nodo) => nodo.clave),
      );
      const posicionSecuencial =
        contextoAltaNodo.tipo === "SECUENCIAL"
          ? contextoAltaNodo.posicion
          : contextoAltaNodo.columna;
      const anterior = (columnasActuales[posicionSecuencial - 1] ?? []).find(
        (clave) => clave.startsWith("ruta:"),
      );
      creado = (await agregarPasoExtra(productoId, {
        familiaCodigo,
        rutaAlternativaId,
        insertarDespuesDeRutaPasoId: anterior
          ? anterior.slice("ruta:".length)
          : null,
        ordenInterno: (ruta.pasosExtras?.length ?? 0) + 1,
      })) as PasoExtra;

      const nodoClave = `extra:${creado.id}`;
      const columnasSiguientes = insertarNodoProductivo(
        columnasActuales,
        nodoClave,
        contextoAltaNodo,
      );
      const resultado = resolverOrdenHojaRuta(columnasSiguientes, componentes, [
        ...pasosDocumento.map((paso) => paso.value),
        nodoClave,
      ]);
      if (!resultado.ok) throw new Error(resultado.error);

      const pasosCompuestosSiguientes = etapa
        ? [
            ...pasosCompuestos,
            {
              version: 2 as const,
              nodoClave,
              pasoTenantId: etapa.id,
              pasoNombre: nombre,
              operaciones: [],
              pasos: [],
            },
          ]
        : pasosCompuestos;

      await guardarBorradorReceta(productoId, {
        rutaAlternativaId,
        expectedUpdatedAt: revision.updatedAt,
        cambios: etapa
          ? `Etapa ${nombre} agregada a la hoja de ruta`
          : `Paso ${nombre} agregado a la hoja de ruta`,
        documentos: documentos.map((item, orden) => ({ ...item, orden })),
        componentes: resultado.componentes.map((item, orden) => ({
          ...item,
          orden,
        })),
        pasosCompuestos: pasosCompuestosSiguientes,
        dependencias: resultado.dependencias,
        gates,
      });

      setDependencias(resultado.dependencias);
      setComponentes(resultado.componentes);
      setPasosCompuestos(pasosCompuestosSiguientes);
      setContextoAltaNodo(null);
      setTipoAltaNodo(null);
      setBusquedaAltaNodo("");
      onSeleccionarNodo?.(etapa ? `etapa:${nodoClave}` : `paso:${nodoClave}`);
      toast.success(
        etapa
          ? "Etapa agregada en la posición elegida."
          : "Paso agregado en la posición elegida.",
      );
      router.refresh();
    } catch (error) {
      if (creado) {
        try {
          await eliminarPasoExtra(creado.id);
        } catch {
          // El refresh permite recuperar el alta si el rollback también falla.
        }
      }
      toast.error(
        error instanceof Error ? error.message : "No se pudo agregar el nodo.",
      );
    } finally {
      setCreandoNodo(false);
    }
  };

  const guardarDefiniciones = async () => {
    setSaving(true);
    try {
      await guardarBorradorReceta(productoId, {
        rutaAlternativaId,
        expectedUpdatedAt: revision.updatedAt,
        cambios: "Modelo productivo actualizado",
        documentos: documentos.map((item, orden) => ({ ...item, orden })),
        componentes: componentes.map((item, orden) => ({ ...item, orden })),
        pasosCompuestos,
        dependencias,
        gates,
      });
      toast.success("El modelo productivo quedó guardado en el borrador.");
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

  const componenteEnEdicion =
    componenteConfigurando !== null
      ? componentes[componenteConfigurando]
      : null;
  const etapaEnEdicion = pasoCompuestoConfigurando
    ? pasosCompuestos.find(
        (item) => item.nodoClave === pasoCompuestoConfigurando,
      )
    : null;

  if (componenteEnEdicion && componenteConfigurando !== null) {
    return (
      <ConfigurarComponenteWorkspace
        embedded
        componente={componenteEnEdicion}
        productoPadreId={productoId}
        productoPadreNombre={productoNombre}
        componentesHermanos={componentes.filter(
          (_, index) => index !== componenteConfigurando,
        )}
        onCancel={() => setComponenteConfigurando(null)}
        onSave={(configuracionJson, unidad, politicaEjecucion) => {
          setComponentes((current) =>
            current.map((item, index) =>
              index === componenteConfigurando
                ? {
                    ...item,
                    configuracionJson,
                    unidad,
                    politicaEjecucion,
                  }
                : item,
            ),
          );
          setComponenteConfigurando(null);
        }}
      />
    );
  }

  if (etapaEnEdicion) {
    return (
      <ConfigurarIncorporacionWorkspace
        embedded
        paso={etapaEnEdicion}
        definiciones={
          pasosTenant.find((item) => item.id === etapaEnEdicion.pasoTenantId)
            ?.pasosInternos ?? []
        }
        producto={producto}
        componentes={componentes}
        onCancel={() => setPasoCompuestoConfigurando(null)}
        onSave={(configuracion) => {
          setPasosCompuestos((current) =>
            current.map((item) =>
              item.nodoClave === configuracion.nodoClave ? configuracion : item,
            ),
          );
          setPasoCompuestoConfigurando(null);
        }}
      />
    );
  }

  return (
    <div
      className={`${styles.editor} ${embedded ? styles.editorEmbedded : ""}`}
    >
      <header className={styles.editorHeader}>
        <div>
          <span>Vía productiva · Borrador V{revision.numero}</span>
          <h4>Hoja de ruta · {ruta.nombre}</h4>
          <p>
            Pasos, etapas y componentes forman un único recorrido. Seleccioná un
            nodo para configurar su participación en esta vía.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" aria-label="Cerrar flujo" onClick={onClose}>
            <XIcon />
          </button>
        </div>
      </header>

      <div className={styles.editorColumns}>
        <section className={`${styles.editorSection} ${styles.flowSection}`}>
          <div className={styles.editorTitle}>
            <div>
              <strong>Hoja de ruta</strong>
              <span>
                Arrastrá horizontalmente para ordenar. Soltá sobre una columna
                para ejecutar nodos en paralelo.
              </span>
            </div>
            <span className={styles.topologyBadge}>
              {columnasHojaRuta.some((columna) => columna.length > 1)
                ? "Ruta DAG"
                : "Ruta lineal"}
            </span>
          </div>
          <div className={styles.roadmapViewport}>
            <div className={styles.roadmapCanvas}>
              <div className={styles.routeBoundary}>
                <span className={styles.boundaryDot} />
                <strong>Inicio</strong>
              </div>

              {columnasHojaRuta.map((columna, columnaIndex) => (
                <React.Fragment key={`momento-${columnaIndex}`}>
                  <div
                    className={styles.sequentialDrop}
                    data-active={
                      destinoArrastre === `secuencial:${columnaIndex}`
                    }
                    onDragEnter={() =>
                      setDestinoArrastre(`secuencial:${columnaIndex}`)
                    }
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const clave =
                        nodoArrastrado ||
                        event.dataTransfer.getData(
                          "application/x-grafoprint-node",
                        );
                      if (clave)
                        soltarNodo(clave, {
                          tipo: "SECUENCIAL",
                          posicion: columnaIndex,
                        });
                    }}
                  >
                    <span />
                    <ArrowRightIcon />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className={styles.sequentialAdd}
                      aria-label={
                        columnaIndex === 0
                          ? "Agregar un nodo al inicio"
                          : `Agregar un nodo antes del momento ${columnaIndex + 1}`
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        abrirAltaNodo({
                          tipo: "SECUENCIAL",
                          posicion: columnaIndex,
                        });
                      }}
                    >
                      <PlusIcon />
                    </Button>
                  </div>

                  <section
                    className={styles.roadmapColumn}
                    data-parallel={columna.length > 1}
                    data-active={destinoArrastre === `paralelo:${columnaIndex}`}
                    onDragEnter={() =>
                      setDestinoArrastre(`paralelo:${columnaIndex}`)
                    }
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const clave =
                        nodoArrastrado ||
                        event.dataTransfer.getData(
                          "application/x-grafoprint-node",
                        );
                      if (clave)
                        soltarNodo(clave, {
                          tipo: "PARALELO",
                          columna: columnaIndex,
                        });
                    }}
                  >
                    <header className={styles.roadmapColumnHeader}>
                      <span>
                        Momento {String(columnaIndex + 1).padStart(2, "0")}
                      </span>
                      {columna.length > 1 ? (
                        <small>{columna.length} en paralelo</small>
                      ) : null}
                    </header>
                    <div className={styles.roadmapNodeStack}>
                      {columna.map((nodo) => {
                        const seleccionado =
                          nodoSeleccionado === nodo.seleccion;
                        const gateCount = gates.filter(
                          (gate) => gate.nodoClave === nodo.clave,
                        ).length;
                        return (
                          <button
                            type="button"
                            className={styles.roadmapNode}
                            data-node-type={nodo.tipo.toLowerCase()}
                            data-selected={seleccionado}
                            data-dragging={nodoArrastrado === nodo.clave}
                            draggable
                            key={nodo.clave}
                            onClick={() => onSeleccionarNodo?.(nodo.seleccion)}
                            onDragStart={(event) => {
                              setNodoArrastrado(nodo.clave);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData(
                                "application/x-grafoprint-node",
                                nodo.clave,
                              );
                            }}
                            onDragEnd={() => {
                              setNodoArrastrado(null);
                              setDestinoArrastre(null);
                            }}
                          >
                            <span className={styles.nodeDragHandle}>
                              <GripVerticalIcon />
                            </span>
                            <span className={styles.nodeIcon}>
                              {nodo.tipo === "COMPONENTE" ? (
                                <BoxesIcon />
                              ) : nodo.tipo === "ETAPA" ? (
                                <BlocksIcon />
                              ) : (
                                <GitCommitHorizontalIcon />
                              )}
                            </span>
                            <span className={styles.nodeMain}>
                              <small>
                                {nodo.tipo === "COMPONENTE"
                                  ? "Subruta fabricada"
                                  : nodo.tipo === "ETAPA"
                                    ? "Etapa consolidada"
                                    : "Paso de producción"}
                              </small>
                              <strong>{nodo.nombre}</strong>
                              <span>
                                {gateCount
                                  ? `${gateCount} requisito${gateCount === 1 ? "" : "s"} de liberación`
                                  : nodo.tipo === "COMPONENTE"
                                    ? "Receta y ruta propias"
                                    : nodo.tipo === "ETAPA"
                                      ? "Un estado en producción"
                                      : "Operación individual"}
                              </span>
                            </span>
                            <span className={styles.nodeType}>
                              {nodo.tipo === "COMPONENTE"
                                ? "Componente"
                                : nodo.tipo === "ETAPA"
                                  ? "Etapa"
                                  : "Paso"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={styles.parallelAdd}
                      onClick={(event) => {
                        event.stopPropagation();
                        abrirAltaNodo({
                          tipo: "PARALELO",
                          columna: columnaIndex,
                        });
                      }}
                    >
                      <PlusIcon data-icon="inline-start" />
                      Agregar en paralelo
                    </Button>
                  </section>
                </React.Fragment>
              ))}

              <div
                className={styles.sequentialDrop}
                data-active={
                  destinoArrastre === `secuencial:${columnasHojaRuta.length}`
                }
                onDragEnter={() =>
                  setDestinoArrastre(`secuencial:${columnasHojaRuta.length}`)
                }
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const clave =
                    nodoArrastrado ||
                    event.dataTransfer.getData("application/x-grafoprint-node");
                  if (clave)
                    soltarNodo(clave, {
                      tipo: "SECUENCIAL",
                      posicion: columnasHojaRuta.length,
                    });
                }}
              >
                <span />
                <ArrowRightIcon />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className={styles.sequentialAdd}
                  aria-label="Agregar un nodo al final"
                  onClick={(event) => {
                    event.stopPropagation();
                    abrirAltaNodo({
                      tipo: "SECUENCIAL",
                      posicion: columnasHojaRuta.length,
                    });
                  }}
                >
                  <PlusIcon />
                </Button>
              </div>

              <div className={`${styles.routeBoundary} ${styles.routeEnd}`}>
                <span className={styles.boundaryDot} />
                <strong>Fin</strong>
              </div>
            </div>
          </div>
        </section>

        {detallePasoSeleccionado ? (
          <section
            className={`${styles.editorSection} ${styles.nodeInspectorSummary}`}
          >
            <div className={styles.inspectorEyebrow}>Paso de producción</div>
            <BoxIcon />
            <div>
              <strong>{detallePasoSeleccionado.label}</strong>
              <span>
                Es una operación atómica. Sus materiales, recursos, parámetros y
                tiempos se configuran en la ficha del paso.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onEditarPaso?.(detallePasoSeleccionado.value)}
            >
              <Settings2Icon /> Configurar paso
            </button>
            <div className={styles.nodeGateControls}>
              <span>Requisitos para iniciar</span>
              <div>
                {(
                  [
                    ["MATERIAL", "Material disponible"],
                    ["CALIDAD", "Control de calidad"],
                  ] as const
                ).map(([tipo, etiqueta]) => {
                  const activo = gates.some(
                    (gate) =>
                      gate.nodoClave === detallePasoSeleccionado.value &&
                      gate.tipo === tipo,
                  );
                  return (
                    <button
                      type="button"
                      key={tipo}
                      data-active={activo}
                      onClick={() =>
                        setGates((actuales) =>
                          activo
                            ? actuales.filter(
                                (gate) =>
                                  !(
                                    gate.nodoClave ===
                                      detallePasoSeleccionado.value &&
                                    gate.tipo === tipo
                                  ),
                              )
                            : [
                                ...actuales,
                                {
                                  nodoClave: detallePasoSeleccionado.value,
                                  tipo,
                                },
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
          </section>
        ) : null}

        {nodoSeleccionado === "ruta" ? (
          <section className={styles.editorSection}>
            <div className={styles.editorTitle}>
              <div>
                <strong>Requisitos de la vía</strong>
                <span>
                  Documentos y aprobaciones que condicionan el recorrido.
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
                      setDocumentos((prev) =>
                        prev.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2Icon />
                  </button>
                </div>
              ))}
              {!documentos.length ? <p>Sin documentos declarados.</p> : null}
            </div>
          </section>
        ) : null}

        {producto.estructuraProducto === "COMPUESTO" &&
        (componenteSeleccionado || creandoComponente) ? (
          <section className={styles.editorSection}>
            <div className={styles.editorTitle}>
              <div>
                <strong>
                  {creandoComponente
                    ? "Nuevo componente"
                    : "Inspector del componente"}
                </strong>
                <span>
                  Configurá cómo el producto padre alimenta y utiliza esta
                  subruta.
                </span>
              </div>
            </div>
            <div className={styles.editorRows}>
              {creandoComponente ? (
                <div className={styles.newComponentCard}>
                  <label htmlFor="producto-componente-nuevo">
                    Producto fabricado
                  </label>
                  <select
                    id="producto-componente-nuevo"
                    value={productoNuevoId || productosDisponibles[0]?.id || ""}
                    onChange={(event) => setProductoNuevoId(event.target.value)}
                  >
                    {productosDisponibles.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                  </select>
                  <p>
                    Su ruta se incorpora como subgrafo versionado. Después
                    podrás configurar sus medidas, cantidad y parámetros.
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={() => onSeleccionarNodo?.("ruta")}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!productosDisponibles.length}
                      onClick={() => agregarComponente(productoNuevoId)}
                    >
                      <PlusIcon /> Incorporar componente
                    </button>
                  </div>
                </div>
              ) : null}
              {componentes.map((item, index) =>
                item.codigo !== componenteSeleccionado ? null : (
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
                    <div className={styles.routePositionSummary}>
                      <GitCommitHorizontalIcon />
                      <div>
                        <strong>Ubicación definida en la hoja de ruta</strong>
                        <span>
                          Arrastrá el nodo para cambiar cuándo comienza y dónde
                          converge.
                        </span>
                      </div>
                    </div>
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
                    <div className={styles.componentSummary}>
                      <span>
                        {item.configuracionJson?.bindings?.some(
                          (binding) => binding.clave === "cantidad",
                        )
                          ? "Cantidad configurada por regla"
                          : "Falta configurar la cantidad"}
                      </span>
                      <b>
                        {item.politicaEjecucion === "INLINE"
                          ? "Sin seguimiento separado"
                          : "Flujo productivo propio"}
                      </b>
                    </div>
                    <button
                      type="button"
                      aria-label={`Quitar componente ${index + 1}`}
                      onClick={() =>
                        setComponentes((prev) => {
                          const next = prev.filter((_, i) => i !== index);
                          onSeleccionarNodo?.("ruta");
                          return next;
                        })
                      }
                    >
                      <Trash2Icon />
                    </button>
                  </div>
                ),
              )}
              {!componentes.length ? <p>Sin componentes fabricados.</p> : null}
            </div>
          </section>
        ) : producto.estructuraProducto !== "COMPUESTO" &&
          nodoSeleccionado === "ruta" ? (
          <section
            className={`${styles.editorSection} ${styles.simpleProductNotice}`}
          >
            <BoxIcon />
            <div>
              <strong>Producto simple</strong>
              <span>
                Esta vía utiliza pasos propios. Cambiá su estructura en
                Identidad si necesitás incorporar productos fabricados.
              </span>
            </div>
          </section>
        ) : null}

        {pasosCompuestos.length && etapaSeleccionada ? (
          <section
            className={`${styles.editorSection} ${styles.compoundSection}`}
          >
            <div className={styles.editorTitle}>
              <div>
                <strong>Inspector de la etapa</strong>
                <span>
                  Sus pasos internos calculan el trabajo, pero la OT controla un
                  único estado operativo.
                </span>
              </div>
            </div>
            <div className={styles.compoundCards}>
              {pasosCompuestos.map((paso) => {
                if (paso.nodoClave !== etapaSeleccionada) return null;
                const plantilla = pasosTenant.find(
                  (item) => item.id === paso.pasoTenantId,
                );
                const vinculados = componentes.filter(
                  (item) => item.nodoIncorporacionClave === paso.nodoClave,
                );
                const activas = paso.operaciones.filter(
                  (item) => item.activa,
                ).length;
                return (
                  <div className={styles.compoundCard} key={paso.nodoClave}>
                    <BoxesIcon />
                    <div>
                      <strong>{paso.pasoNombre}</strong>
                      <span>
                        {plantilla?.pasosInternos?.length ?? 0} pasos declarados
                        · {vinculados.length} componentes vinculados
                      </span>
                      <small>
                        {(paso.pasos?.filter((item) => item.activa).length ??
                        activas)
                          ? `${paso.pasos?.filter((item) => item.activa).length ?? activas} pasos configurados`
                          : "Pendiente de configuración"}
                      </small>
                    </div>
                    <button
                      type="button"
                      disabled={!plantilla?.pasosInternos?.length}
                      onClick={() =>
                        setPasoCompuestoConfigurando(paso.nodoClave)
                      }
                    >
                      <Settings2Icon /> Configurar etapa
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <Dialog
        open={Boolean(contextoAltaNodo)}
        onOpenChange={(open) => {
          if (!open) cerrarAltaNodo();
        }}
      >
        <DialogContent
          className="h-[min(780px,calc(100dvh-2rem))] overflow-hidden p-0 sm:max-w-3xl"
          showCloseButton={!creandoNodo}
        >
          <div className={styles.addNodeDialog}>
            <DialogHeader className={styles.addNodeHeader}>
              <span>HOJA DE RUTA · NUEVO NODO</span>
              <DialogTitle>¿Qué querés incorporar?</DialogTitle>
              <DialogDescription>
                {contextoAltaNodo?.tipo === "PARALELO"
                  ? `Se ejecutará en paralelo dentro del momento ${contextoAltaNodo.columna + 1}.`
                  : contextoAltaNodo?.posicion === 0
                    ? "Se ubicará al inicio del recorrido."
                    : contextoAltaNodo?.posicion === columnasHojaRuta.length
                      ? "Se ubicará al final del recorrido."
                      : `Se creará un nuevo momento entre el ${contextoAltaNodo?.posicion} y el ${(contextoAltaNodo?.posicion ?? 0) + 1}.`}
              </DialogDescription>
            </DialogHeader>

            <div className={styles.addNodeTypes}>
              <Button
                type="button"
                variant={tipoAltaNodo === "PASO" ? "default" : "outline"}
                className={styles.addNodeTypeCard}
                data-selected={tipoAltaNodo === "PASO"}
                onClick={() => {
                  setTipoAltaNodo("PASO");
                  setBusquedaAltaNodo("");
                }}
              >
                <GitCommitHorizontalIcon data-icon="inline-start" />
                <span>
                  <strong>Paso de producción</strong>
                  <small>Una operación individual de la ruta.</small>
                </span>
              </Button>
              {producto.estructuraProducto === "COMPUESTO" ? (
                <Button
                  type="button"
                  variant={
                    tipoAltaNodo === "COMPONENTE" ? "default" : "outline"
                  }
                  className={styles.addNodeTypeCard}
                  data-selected={tipoAltaNodo === "COMPONENTE"}
                  disabled={!productosDisponibles.length}
                  onClick={() => {
                    setTipoAltaNodo("COMPONENTE");
                    setBusquedaAltaNodo("");
                  }}
                >
                  <BoxesIcon data-icon="inline-start" />
                  <span>
                    <strong>Componente fabricado</strong>
                    <small>Un producto hijo con receta y ruta propias.</small>
                  </span>
                </Button>
              ) : null}
              <Button
                type="button"
                variant={tipoAltaNodo === "ETAPA" ? "default" : "outline"}
                className={styles.addNodeTypeCard}
                data-selected={tipoAltaNodo === "ETAPA"}
                disabled={!etapasDisponibles.length}
                onClick={() => {
                  setTipoAltaNodo("ETAPA");
                  setBusquedaAltaNodo("");
                }}
              >
                <BlocksIcon data-icon="inline-start" />
                <span>
                  <strong>Etapa compuesta</strong>
                  <small>Agrupa subtareas bajo un único estado.</small>
                </span>
              </Button>
            </div>

            {tipoAltaNodo ? (
              <section className={styles.addNodePicker}>
                <div className={styles.addNodePickerHeading}>
                  <div>
                    <strong>
                      {tipoAltaNodo === "PASO"
                        ? "Elegí el paso"
                        : tipoAltaNodo === "COMPONENTE"
                          ? "Elegí el producto componente"
                          : "Elegí la etapa"}
                    </strong>
                    <span>
                      La posición ya quedó definida en la hoja de ruta.
                    </span>
                  </div>
                  <Input
                    type="search"
                    value={busquedaAltaNodo}
                    onChange={(event) =>
                      setBusquedaAltaNodo(event.target.value)
                    }
                    placeholder="Buscar por nombre"
                    aria-label="Buscar nodo"
                  />
                </div>
                <div className={styles.addNodeOptions}>
                  {tipoAltaNodo === "PASO"
                    ? pasosDisponibles
                        .filter((item) =>
                          item.nombre
                            .toLocaleLowerCase("es")
                            .includes(
                              busquedaAltaNodo.trim().toLocaleLowerCase("es"),
                            ),
                        )
                        .map((item) => (
                          <Button
                            type="button"
                            variant="outline"
                            className={styles.addNodeOption}
                            disabled={creandoNodo}
                            key={item.codigo}
                            onClick={() =>
                              void crearPasoEnContexto({
                                familiaCodigo: item.codigo,
                                nombre: item.nombre,
                              })
                            }
                          >
                            <GitCommitHorizontalIcon data-icon="inline-start" />
                            <span>
                              <strong>{item.nombre}</strong>
                              <small>Paso de producción</small>
                            </span>
                            <ArrowRightIcon data-icon="inline-end" />
                          </Button>
                        ))
                    : null}
                  {tipoAltaNodo === "COMPONENTE"
                    ? productosDisponibles
                        .filter((item) =>
                          item.nombre
                            .toLocaleLowerCase("es")
                            .includes(
                              busquedaAltaNodo.trim().toLocaleLowerCase("es"),
                            ),
                        )
                        .map((item) => (
                          <Button
                            type="button"
                            variant="outline"
                            className={styles.addNodeOption}
                            key={item.id}
                            onClick={() => agregarComponente(item.id)}
                          >
                            <BoxesIcon data-icon="inline-start" />
                            <span>
                              <strong>{item.nombre}</strong>
                              <small>
                                Producto con flujo productivo propio
                              </small>
                            </span>
                            <ArrowRightIcon data-icon="inline-end" />
                          </Button>
                        ))
                    : null}
                  {tipoAltaNodo === "ETAPA"
                    ? etapasDisponibles
                        .filter((item) =>
                          item.nombre
                            .toLocaleLowerCase("es")
                            .includes(
                              busquedaAltaNodo.trim().toLocaleLowerCase("es"),
                            ),
                        )
                        .map((item) => (
                          <Button
                            type="button"
                            variant="outline"
                            className={styles.addNodeOption}
                            disabled={creandoNodo}
                            key={item.id}
                            onClick={() =>
                              void crearPasoEnContexto({
                                familiaCodigo: item.id,
                                nombre: item.nombre,
                                etapa: item,
                              })
                            }
                          >
                            <BlocksIcon data-icon="inline-start" />
                            <span>
                              <strong>{item.nombre}</strong>
                              <small>
                                {item.pasosInternos?.length ?? 0} subtareas
                                declaradas
                              </small>
                            </span>
                            <ArrowRightIcon data-icon="inline-end" />
                          </Button>
                        ))
                    : null}
                </div>
              </section>
            ) : (
              <p className={styles.addNodeEmpty}>
                Primero elegí qué clase de nodo querés sumar al recorrido.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <footer className={styles.editorFooter}>
        <span>
          Borrador V{revision.numero} · Guardar conserva la versión publicada.
        </span>
        <button type="button" disabled={saving} onClick={guardarDefiniciones}>
          {saving ? "Guardando…" : "Guardar modelo"}
        </button>
      </footer>
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
              const compuesto = revision.pasosCompuestosJson?.find(
                (paso) => paso.nodoClave === nodo.clave,
              );
              const pasosInternos =
                compuesto?.pasos?.filter((paso) => paso.activa) ?? [];
              const operacionesLegacy =
                compuesto?.operaciones.filter(
                  (operacion) => operacion.activa,
                ) ?? [];
              return (
                <div key={nodo.clave}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <strong>{nombreNodo(nodo.clave)}</strong>
                  <span>
                    {previos.length
                      ? `Después de ${previos.map(nombreNodo).join(" + ")}`
                      : "Inicio disponible"}
                    {pasosInternos.length || operacionesLegacy.length
                      ? ` · Etapa compuesta con ${pasosInternos.length || operacionesLegacy.length} ${pasosInternos.length === 1 || (!pasosInternos.length && operacionesLegacy.length === 1) ? "operación" : "operaciones"}`
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
              <p>Consumos consolidados desde el modelo de esta vía.</p>
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
                      ? "flujo productivo propio"
                      : "sin seguimiento separado"}
                    {componente.nodoIncorporacionClave
                      ? ` · se incorpora antes de ${nombreNodo(componente.nodoIncorporacionClave)}`
                      : ""}
                  </span>
                </div>
                <div className={styles.rowMeta}>
                  <span>
                    {componente.configuracionJson?.bindings?.some(
                      (binding) => binding.clave === "cantidad",
                    )
                      ? "Cantidad configurada"
                      : "Cantidad histórica"}
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
  rutaAlternativaId,
  projectionOnly = false,
}: {
  producto: ProductoDetalle;
  recetas: ProductoReceta[];
  canManage: boolean;
  rutaAlternativaId?: string;
  projectionOnly?: boolean;
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
          {producto.rutasAlternativas
            .filter(
              (ruta) => !rutaAlternativaId || ruta.id === rutaAlternativaId,
            )
            .map((ruta) => {
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
                          {draft && !projectionOnly ? (
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={working !== null}
                              onClick={() =>
                                setEditing(
                                  editing === draft.id ? null : draft.id,
                                )
                              }
                            >
                              <PencilLineIcon />
                              Editar modelo
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
                                    onClick={() =>
                                      setRevisionARetirar(published)
                                    }
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
                          producto={producto}
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
