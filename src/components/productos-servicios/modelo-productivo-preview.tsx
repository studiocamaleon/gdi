"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BlocksIcon,
  BoxesIcon,
  GitCommitHorizontalIcon,
  Maximize2Icon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";

import {
  construirColumnasProductivas,
  reducirAristasProductivas,
  type AristaProductivaVisual,
  type TipoNodoProductivoVisual,
} from "@/lib/modelo-productivo-layout";
import type { ProductoRecetaRevision } from "@/lib/productos-servicios-api";
import type {
  CatalogoFamilias,
  ProductoDetalle,
} from "@/lib/productos-servicios";

import styles from "./modelo-productivo-preview.module.css";

type RutaProductiva = ProductoDetalle["rutasAlternativas"][number];

type NodoPreview = {
  clave: string;
  tipo: TipoNodoProductivoVisual;
  orden: number;
  nombre: string;
  descripcion: string;
  activacion?: "OPCIONAL" | "CONDICIONAL";
};

type CamaraPreview = {
  x: number;
  y: number;
  zoom: number;
};

const ZOOM_MINIMO = 0.52;
const ZOOM_MAXIMO = 1.18;
const PASO_ZOOM = 0.1;

function limitar(valor: number, minimo: number, maximo: number) {
  return Math.min(maximo, Math.max(minimo, valor));
}

function nombreHumano(value?: string | null) {
  if (!value) return "Paso sin nombre";
  const limpio = value.replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  if (!limpio) return "Paso sin nombre";
  return limpio.charAt(0).toLocaleUpperCase("es-AR") + limpio.slice(1);
}

function etiquetaTipo(tipo: TipoNodoProductivoVisual) {
  if (tipo === "COMPONENTE") return "Subruta fabricada";
  if (tipo === "ETAPA") return "Etapa consolidada";
  return "Paso de producción";
}

function iconoNodo(tipo: TipoNodoProductivoVisual) {
  if (tipo === "COMPONENTE") return <BoxesIcon />;
  if (tipo === "ETAPA") return <BlocksIcon />;
  return <GitCommitHorizontalIcon />;
}

function seleccionEditor(nodo: NodoPreview) {
  if (nodo.tipo === "COMPONENTE") return nodo.clave;
  if (nodo.tipo === "ETAPA") return `etapa:${nodo.clave}`;
  return `paso:${nodo.clave}`;
}

function ContenidoNodo({ nodo }: { nodo: NodoPreview }) {
  return (
    <>
      <span className={styles.nodeIcon}>{iconoNodo(nodo.tipo)}</span>
      <span className={styles.nodeMain}>
        <small>{etiquetaTipo(nodo.tipo)}</small>
        <strong>{nodo.nombre}</strong>
        <span>{nodo.descripcion}</span>
      </span>
      {nodo.activacion ? (
        <span className={styles.activation}>
          {nodo.activacion === "OPCIONAL" ? "Opcional" : "Condicional"}
        </span>
      ) : null}
    </>
  );
}

function construirModeloPreview({
  ruta,
  revision,
  catalogoFamilias,
}: {
  ruta: RutaProductiva;
  revision?: ProductoRecetaRevision;
  catalogoFamilias?: CatalogoFamilias;
}) {
  const etapas = new Set(
    (revision?.pasosCompuestosJson ?? []).map((item) => item.nodoClave),
  );
  const pasosBase = ruta.ruta.pasos
    .filter((paso) => paso.activo)
    .map((paso) => {
      const configuracion = ruta.configPasos.find(
        (item) => item.rutaPasoId === paso.id,
      );
      return {
        clave: `ruta:${paso.id}`,
        orden: paso.orden,
        nombre: nombreHumano(
          configuracion?.nombreVisible ||
            paso.nombreVisible ||
            paso.familiaNombre ||
            catalogoFamilias?.familias.find(
              (familia) => familia.codigo === paso.familiaCodigo,
            )?.nombre ||
            paso.familiaCodigo,
        ),
        familiaCodigo: paso.familiaCodigo,
        modoActivacion: configuracion?.modoActivacion,
        recurso:
          configuracion?.maquinaM1?.nombre ||
          configuracion?.centroCosto?.nombre ||
          "Sin centro asignado",
      };
    });
  const pasosExtra = (ruta.pasosExtras ?? [])
    .filter((paso) => paso.activo)
    .map((paso, index) => ({
      clave: `extra:${paso.id}`,
      orden: paso.ordenFlujo ?? 1_000 + index,
      nombre: nombreHumano(
        paso.nombreVisible ||
          catalogoFamilias?.familias.find(
            (familia) => familia.codigo === paso.familiaCodigo,
          )?.nombre ||
          paso.familiaCodigo,
      ),
      familiaCodigo: paso.familiaCodigo,
      modoActivacion: paso.modoActivacion,
      recurso:
        paso.maquinaM1?.nombre ||
        (paso.centroCostoId ? "Centro productivo configurado" : null) ||
        "Sin centro asignado",
    }));
  const pasosCompletos = [...pasosBase, ...pasosExtra];
  const omitidos = pasosCompletos.filter(
    (paso) => paso.modoActivacion === "NO_EJECUTAR",
  ).length;
  const pasos = pasosCompletos
    .filter((paso) => paso.modoActivacion !== "NO_EJECUTAR")
    .sort((a, b) => a.orden - b.orden);
  const nodosPaso: NodoPreview[] = pasos.map((paso, index) => {
    const esEtapa = etapas.has(paso.clave);
    return {
      clave: paso.clave,
      tipo: esEtapa ? "ETAPA" : "PASO",
      orden: 100 + index,
      nombre: paso.nombre,
      descripcion: esEtapa ? "Un estado en producción" : paso.recurso,
      activacion:
        paso.modoActivacion === "OPCIONAL" ||
        paso.modoActivacion === "CONDICIONAL"
          ? paso.modoActivacion
          : undefined,
    };
  });
  const nodosComponente: NodoPreview[] = (revision?.componentes ?? []).map(
    (componente, index) => ({
      clave: `componente:${componente.codigo}`,
      tipo: "COMPONENTE",
      orden: componente.orden ?? index,
      nombre: componente.nombre,
      descripcion:
        componente.politicaEjecucion === "INDEPENDIENTE"
          ? "Flujo propio en producción"
          : "Receta y ruta propias",
      activacion: componente.requerido ? undefined : "OPCIONAL",
    }),
  );
  const nodos = [...nodosPaso, ...nodosComponente];
  const clavesValidas = new Set(nodos.map((nodo) => nodo.clave));
  const pasosClaves = nodosPaso.map((nodo) => nodo.clave);
  const aristasGuardadas = revision?.grafoProduccionJson?.aristas;
  const aristasBase: AristaProductivaVisual[] =
    aristasGuardadas !== undefined && aristasGuardadas !== null
      ? aristasGuardadas
      : pasosClaves.slice(1).map((haciaClave, index) => ({
          desdeClave: pasosClaves[index],
          haciaClave,
        }));
  const aristasComponentes = (revision?.componentes ?? []).flatMap(
    (componente) => {
      const claveComponente = `componente:${componente.codigo}`;
      return [
        ...(componente.nodosPredecesoresClaves ?? []).map((desdeClave) => ({
          desdeClave,
          haciaClave: claveComponente,
        })),
        ...(componente.nodoIncorporacionClave
          ? [
              {
                desdeClave: claveComponente,
                haciaClave: componente.nodoIncorporacionClave,
              },
            ]
          : []),
      ];
    },
  );
  const aristas = reducirAristasProductivas(
    [...aristasBase, ...aristasComponentes],
    clavesValidas,
  );

  return {
    nodos,
    aristas,
    omitidos,
    columnas: construirColumnasProductivas(nodos, aristas),
  };
}

export function ModeloProductivoPreview({
  ruta,
  revision,
  catalogoFamilias,
  editorHref,
  onOpenEditor,
}: {
  ruta: RutaProductiva;
  revision?: ProductoRecetaRevision;
  catalogoFamilias?: CatalogoFamilias;
  editorHref: string;
  onOpenEditor?: (nodoSeleccionado?: string) => void;
}) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const paneoRef = React.useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    cameraX: number;
    cameraY: number;
  } | null>(null);
  const [camara, setCamara] = React.useState<CamaraPreview>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const [desplazando, setDesplazando] = React.useState(false);
  const modelo = React.useMemo(
    () => construirModeloPreview({ ruta, revision, catalogoFamilias }),
    [catalogoFamilias, revision, ruta],
  );

  const ajustar = React.useCallback(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;
    const anchoLienzo = canvas.offsetWidth;
    const altoLienzo = canvas.offsetHeight;
    const zoom = limitar(
      Math.min(
        1,
        (viewport.clientWidth - 36) / Math.max(anchoLienzo, 1),
        (viewport.clientHeight - 36) / Math.max(altoLienzo, 1),
      ),
      ZOOM_MINIMO,
      ZOOM_MAXIMO,
    );
    setCamara({
      zoom,
      x: Math.max(18, (viewport.clientWidth - anchoLienzo * zoom) / 2),
      y: Math.max(18, (viewport.clientHeight - altoLienzo * zoom) / 2),
    });
  }, []);

  React.useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(ajustar);
    return () => window.cancelAnimationFrame(frame);
  }, [ajustar, modelo.columnas]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => ajustar());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [ajustar]);

  const cambiarZoom = (delta: number) => {
    setCamara((actual) => ({
      ...actual,
      zoom: limitar(actual.zoom + delta, ZOOM_MINIMO, ZOOM_MAXIMO),
    }));
  };

  const iniciarPaneo = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest("a, button")
    ) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    paneoRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      cameraX: camara.x,
      cameraY: camara.y,
    };
    setDesplazando(true);
  };

  const mover = (event: React.PointerEvent<HTMLDivElement>) => {
    const paneo = paneoRef.current;
    if (!paneo || paneo.pointerId !== event.pointerId) return;
    setCamara((actual) => ({
      ...actual,
      x: paneo.cameraX + event.clientX - paneo.clientX,
      y: paneo.cameraY + event.clientY - paneo.clientY,
    }));
  };

  const terminarPaneo = (event: React.PointerEvent<HTMLDivElement>) => {
    if (paneoRef.current?.pointerId !== event.pointerId) return;
    paneoRef.current = null;
    setDesplazando(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (!modelo.nodos.length) {
    return (
      <div className={styles.empty}>
        <GitCommitHorizontalIcon />
        <strong>Esta ruta de producción todavía no tiene nodos.</strong>
        {onOpenEditor ? (
          <button type="button" onClick={() => onOpenEditor("ruta")}>
            Editar ruta
          </button>
        ) : (
          <Link href={editorHref}>Editar ruta</Link>
        )}
      </div>
    );
  }

  const componentes = modelo.nodos.filter(
    (nodo) => nodo.tipo === "COMPONENTE",
  ).length;
  const etapas = modelo.nodos.filter((nodo) => nodo.tipo === "ETAPA").length;
  const esDag = modelo.columnas.some((columna) => columna.length > 1);

  return (
    <div className={styles.preview}>
      <div className={styles.toolbar}>
        <p>
          {modelo.nodos.length} nodos activos · {componentes} componentes ·{" "}
          {etapas} {etapas === 1 ? "etapa" : "etapas"}
          {modelo.omitidos > 0
            ? ` · ${modelo.omitidos} omitido${modelo.omitidos === 1 ? "" : "s"}`
            : ""}
        </p>
        <div className={styles.toolbarActions}>
          <div className={styles.zoomControls} aria-label="Zoom de la ruta">
            <button
              type="button"
              aria-label="Alejar la ruta"
              title="Alejar"
              disabled={camara.zoom <= ZOOM_MINIMO}
              onClick={() => cambiarZoom(-PASO_ZOOM)}
            >
              <MinusIcon />
            </button>
            <span>{Math.round(camara.zoom * 100)}%</span>
            <button
              type="button"
              aria-label="Acercar la ruta"
              title="Acercar"
              disabled={camara.zoom >= ZOOM_MAXIMO}
              onClick={() => cambiarZoom(PASO_ZOOM)}
            >
              <PlusIcon />
            </button>
            <button type="button" onClick={ajustar} title="Ver toda la ruta">
              <Maximize2Icon />
              Ajustar
            </button>
          </div>
          <span className={styles.topology}>
            {esDag ? "Ruta DAG" : "Ruta lineal"}
          </span>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={styles.viewport}
        data-panning={desplazando}
        aria-label="Vista de la ruta de producción. Arrastrá el fondo para desplazarte."
        onPointerDown={iniciarPaneo}
        onPointerMove={mover}
        onPointerUp={terminarPaneo}
        onPointerCancel={terminarPaneo}
        style={
          {
            "--preview-grid-size": `${28 * camara.zoom}px`,
            "--preview-grid-x": `${camara.x}px`,
            "--preview-grid-y": `${camara.y}px`,
          } as React.CSSProperties
        }
      >
        <div
          ref={canvasRef}
          className={styles.canvas}
          style={{
            transform: `translate3d(${camara.x}px, ${camara.y}px, 0) scale(${camara.zoom})`,
          }}
        >
          <div className={styles.boundary}>
            <span />
            <strong>Inicio</strong>
          </div>

          {modelo.columnas.map((columna, columnaIndex) => (
            <React.Fragment key={`momento-${columnaIndex}`}>
              <div className={styles.connector} aria-hidden="true">
                <span />
                <ArrowRightIcon />
              </div>
              <section
                className={styles.column}
                data-parallel={columna.length > 1}
              >
                <header>
                  <span>
                    Momento {String(columnaIndex + 1).padStart(2, "0")}
                  </span>
                  {columna.length > 1 ? (
                    <small>{columna.length} en paralelo</small>
                  ) : null}
                </header>
                <div className={styles.nodeStack}>
                  {columna.map((nodo) =>
                    onOpenEditor ? (
                      <button
                        key={nodo.clave}
                        type="button"
                        className={styles.node}
                        data-node-type={nodo.tipo.toLowerCase()}
                        aria-label={`${nodo.nombre}. ${etiquetaTipo(nodo.tipo)}. Abrir editor.`}
                        onClick={() => onOpenEditor(seleccionEditor(nodo))}
                      >
                        <ContenidoNodo nodo={nodo} />
                      </button>
                    ) : (
                      <Link
                        key={nodo.clave}
                        href={`${editorHref}?nodo=${encodeURIComponent(seleccionEditor(nodo))}`}
                        className={styles.node}
                        data-node-type={nodo.tipo.toLowerCase()}
                        aria-label={`${nodo.nombre}. ${etiquetaTipo(nodo.tipo)}. Abrir editor.`}
                      >
                        <ContenidoNodo nodo={nodo} />
                      </Link>
                    ),
                  )}
                </div>
              </section>
            </React.Fragment>
          ))}

          <div className={styles.connector} aria-hidden="true">
            <span />
            <ArrowRightIcon />
          </div>
          <div className={`${styles.boundary} ${styles.end}`}>
            <span />
            <strong>Fin</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
