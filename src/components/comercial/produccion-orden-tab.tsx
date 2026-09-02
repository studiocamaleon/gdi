"use client";

/**
 * Tab "Producción" del detalle de una OT — ruta de producción por producto
 * + avance general, con el estado EN VIVO de cada paso (mismos datos que el
 * Tablero, sin ir al Tablero). Componentes portados del diseño Grafoprint
 * (`orden-detail.jsx` → ProduccionTab) conectados a `GET /ordenes-trabajo/:id/pasos`.
 */

import * as React from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  NetworkIcon,
  Rows3Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getOrdenPasos } from "@/lib/ordenes-trabajo-api";
import {
  etiquetaDuracion,
  familiaIcono,
  type TableroItemData,
  type TableroPasoEstado,
} from "@/lib/tablero-produccion";
import { PanelComprasOt } from "@/components/comercial/panel-compras-ot";
import {
  construirMomentosWorkflowOrden,
  type NodoWorkflowOrden,
} from "@/lib/workflow-orden";

/* ─── Íconos (set TIco del diseño, verbatim) ─── */
type IcoProps = React.SVGProps<SVGSVGElement>;
const svg = (inner: React.ReactNode, w = 14, sw = 1.7) =>
  function Ico(p: IcoProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={w}
        height={w}
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...p}
      >
        {inner}
      </svg>
    );
  };
const TICO: Record<string, React.FC<IcoProps>> = {
  Layout: svg(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 9v12" />
    </>,
  ),
  Check: svg(<path d="M5 12l4 4 10-10" />, 14, 2.2),
  Layers: svg(
    <>
      <path d="m12 3 9 4.5-9 4.5-9-4.5Z" />
      <path d="m3 12 9 4.5 9-4.5M3 16.5l9 4.5 9-4.5" />
    </>,
  ),
  Printer: svg(
    <>
      <path d="M7 7V3h10v4" />
      <rect x="4" y="7" width="16" height="9" rx="1.5" />
      <path d="M7 14h10v6H7Z" />
    </>,
  ),
  Plot: svg(
    <>
      <rect x="3" y="5" width="18" height="6" rx="1.5" />
      <path d="M5 11v8M19 11v8M5 19h14" />
      <circle cx="9" cy="8" r="1.2" fill="currentColor" />
    </>,
  ),
  Cut: svg(
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="m20 4-12 12M14 14l6 6M14 10 8 4" />
    </>,
  ),
  Sun: svg(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M5 5l1.5 1.5M17.5 17.5 19 19M2 12h2M20 12h2M5 19l1.5-1.5M17.5 6.5 19 5" />
    </>,
  ),
  Brush: svg(
    <>
      <path d="M9 22h6" />
      <path d="M12 18v4" />
      <path d="M5 11l8-8 6 6-8 8Z" />
      <path d="M5 11l-2 6 6-2Z" />
    </>,
  ),
  Scissors: svg(
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" />
    </>,
  ),
  Stamp: svg(
    <>
      <path d="M9 9V4a3 3 0 0 1 6 0v5l3 5H6Z" />
      <rect x="4" y="18" width="16" height="3" rx="1" />
    </>,
  ),
  Fold: svg(
    <>
      <path d="M3 7h18v6H3Z" />
      <path d="M3 13l4 6h10l4-6" />
    </>,
  ),
  Cnc: svg(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18" />
      <circle cx="15" cy="15" r="2" />
    </>,
  ),
  Beam: svg(
    <>
      <path d="M12 2v6M12 22v-4M3 12h6M21 12h-4M5 5l3 3M19 5l-3 3M5 19l3-3" />
      <circle cx="12" cy="12" r="2" />
    </>,
  ),
  Book: svg(
    <>
      <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2Z" />
      <path d="M8 7h6M8 11h6" />
    </>,
  ),
  Tool: svg(
    <>
      <path d="M14 7a3 3 0 1 1 3-3l-3 3 4 4 3-3a3 3 0 1 1-3-3" />
      <path d="m18 12-7 7-4-1-1-4 7-7" />
    </>,
  ),
  Shield: svg(
    <>
      <path d="M12 3 4 6v6c0 5 3 8 8 9 5-1 8-4 8-9V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>,
  ),
  Package: svg(
    <>
      <path d="M12 22V11" />
      <path d="M3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="m3 7 9 4 9-4M7.5 4.5 16 9" />
    </>,
  ),
  Truck: svg(
    <>
      <rect x="1" y="6" width="13" height="11" rx="1" />
      <path d="M14 9h4l3 3v5h-7Z" />
      <circle cx="5.5" cy="18.5" r="2" />
      <circle cx="18.5" cy="18.5" r="2" />
    </>,
  ),
  Wrench: svg(
    <>
      <path d="M14.7 6.3a4 4 0 1 0 5 5l-3.5-1.5-1.5-3.5Z" />
      <path d="m14.7 11.3-10 10 3 3 10-10" />
    </>,
  ),
  Block: svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.5 5.5 13 13" />
    </>,
    14,
    2,
  ),
  Chev: svg(<path d="m9 6 6 6-6 6" />, 12, 2),
  Factory: svg(
    <>
      <path d="M2 20h20M4 20V9l5 3V9l5 3V9l5 3v8" />
    </>,
  ),
};
/* ─── Mapeo estado real → estado visual del diseño ─── */
type VisualStatus = "done" | "current" | "paused" | "pending" | "blocked";
const STATUS_OF: Record<TableroPasoEstado, VisualStatus> = {
  hecho: "done",
  en_curso: "current",
  pausado: "paused",
  bloqueado: "blocked",
  pendiente: "pending",
};
const ST_LBL: Record<VisualStatus, string> = {
  done: "Completo",
  current: "En curso",
  paused: "Pausado",
  pending: "Pendiente",
  blocked: "Bloqueado",
};

function NodoRealWorkflow({ nodo }: { nodo: NodoWorkflowOrden }) {
  const { paso } = nodo;
  const status = STATUS_OF[nodo.estado];
  const esEtapa = nodo.tipo === "ETAPA";
  const IcoC = paso
    ? (TICO[familiaIcono(paso.familiaCodigo, paso.plantillaCodigo)] ??
      TICO.Tool)
    : TICO.Tool;
  const duracion = etiquetaDuracion(nodo.duracionEstimadaMin);
  const operaciones = paso?.operacionesIncorporacionSnapshotJson ?? [];

  return (
    <article
      className={`otp-exploded-node ${status} ${esEtapa ? "stage" : "step"}`}
      title={`${nodo.nombre} · ${ST_LBL[status]}`}
    >
      <span className="otp-exploded-node-icon">
        {status === "done" ? (
          <TICO.Check />
        ) : status === "blocked" ? (
          <TICO.Block />
        ) : (
          <IcoC />
        )}
      </span>
      <div className="otp-exploded-node-body">
        <span>{esEtapa ? "ETAPA CONSOLIDADA" : "PASO DE PRODUCCIÓN"}</span>
        <strong>{nodo.nombre}</strong>
        <small>
          {paso?.centroCostoNombre ??
            (paso?.tipoEjecucion === "tercerizado"
              ? "Tercerizado"
              : "Sin centro asignado")}
          {duracion ? ` · ${duracion}` : ""}
        </small>
        {esEtapa && operaciones.length > 0 ? (
          <small className="otp-exploded-stage-detail">
            {operaciones.length} subtarea{operaciones.length === 1 ? "" : "s"}
          </small>
        ) : null}
      </div>
      <span className={`otp-exploded-status ${status}`}>{ST_LBL[status]}</span>
    </article>
  );
}

type GeometriaParalela = {
  altura: number;
  centros: number[];
};

function CurvasParalelas({ geometria }: { geometria: GeometriaParalela }) {
  const { altura, centros } = geometria;
  if (centros.length < 2 || altura <= 0) return null;

  const centroComun = altura / 2;

  return (
    <>
      <svg
        aria-hidden="true"
        className="otp-exploded-parallel-curves incoming"
        preserveAspectRatio="none"
        viewBox={`0 0 36 ${altura}`}
      >
        {centros.map((destino) => (
          <path
            d={`M 0 ${centroComun} C 18 ${centroComun}, 18 ${destino}, 36 ${destino}`}
            key={`entrada:${destino}`}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <svg
        aria-hidden="true"
        className="otp-exploded-parallel-curves outgoing"
        preserveAspectRatio="none"
        viewBox={`0 0 36 ${altura}`}
      >
        {centros.map((origen) => (
          <path
            d={`M 0 ${origen} C 18 ${origen}, 18 ${centroComun}, 36 ${centroComun}`}
            key={`salida:${origen}`}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </>
  );
}

function PilaWorkflowExplotado({
  items,
  nodos,
}: {
  items: TableroItemData[];
  nodos: NodoWorkflowOrden[];
}) {
  const contenedorRef = React.useRef<HTMLDivElement>(null);
  const [geometria, setGeometria] = React.useState<GeometriaParalela>({
    altura: 0,
    centros: [],
  });
  const esParalela = nodos.length > 1;

  React.useLayoutEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || !esParalela) return;

    let frame = 0;
    const medir = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const contenedorRect = contenedor.getBoundingClientRect();
        const filas = Array.from(
          contenedor.querySelectorAll<HTMLElement>("[data-workflow-row]"),
        );
        const siguiente = {
          altura: contenedorRect.height,
          centros: filas.map((fila) => {
            const rect = fila.getBoundingClientRect();
            return rect.top - contenedorRect.top + rect.height / 2;
          }),
        };

        setGeometria((actual) => {
          const sinCambios =
            Math.abs(actual.altura - siguiente.altura) < 0.5 &&
            actual.centros.length === siguiente.centros.length &&
            actual.centros.every(
              (centro, index) =>
                Math.abs(centro - siguiente.centros[index]) < 0.5,
            );
          return sinCambios ? actual : siguiente;
        });
      });
    };

    const observer = new ResizeObserver(medir);
    observer.observe(contenedor);
    Array.from(
      contenedor.querySelectorAll<HTMLElement>("[data-workflow-row]"),
    ).forEach((fila) => observer.observe(fila));
    medir();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [esParalela, nodos]);

  return (
    <div
      className={`otp-exploded-stack ${esParalela ? "parallel" : ""}`}
      ref={contenedorRef}
    >
      {esParalela ? <CurvasParalelas geometria={geometria} /> : null}
      {nodos.map((nodo) => (
        <div data-workflow-row key={nodo.id}>
          {nodo.tipo === "COMPONENTE" ? (
            <RamaComponenteWorkflow items={items} nodo={nodo} />
          ) : (
            <NodoRealWorkflow nodo={nodo} />
          )}
        </div>
      ))}
    </div>
  );
}

function RamaComponenteWorkflow({
  items,
  nodo,
  profundidad = 0,
}: {
  items: TableroItemData[];
  nodo: NodoWorkflowOrden;
  profundidad?: number;
}) {
  const momentos = construirMomentosWorkflowOrden(items, nodo.item.id);
  const total = nodo.progreso?.total ?? nodo.item.pasos.length;
  const completos = nodo.progreso?.completos ?? 0;

  return (
    <section
      className="otp-exploded-branch"
      style={{ ["--branch-depth" as string]: profundidad }}
    >
      <header className="otp-exploded-branch-label">
        <span>
          <TICO.Package />
        </span>
        <div>
          <small>COMPONENTE FABRICADO</small>
          <strong>{nodo.nombre}</strong>
          <em>
            {completos}/{total} completos
          </em>
        </div>
      </header>
      <div className="otp-exploded-branch-track">
        {momentos.length > 0 ? (
          momentos.map((momento, index) => (
            <React.Fragment key={`${nodo.id}:${momento.nivel}`}>
              {index > 0 ? (
                <div className="otp-exploded-link" aria-hidden="true">
                  <span />
                </div>
              ) : null}
              <div className="otp-exploded-submoment">
                {momento.nodos.map((hijo) =>
                  hijo.tipo === "COMPONENTE" ? (
                    <RamaComponenteWorkflow
                      items={items}
                      key={hijo.id}
                      nodo={hijo}
                      profundidad={profundidad + 1}
                    />
                  ) : (
                    <NodoRealWorkflow key={hijo.id} nodo={hijo} />
                  ),
                )}
              </div>
            </React.Fragment>
          ))
        ) : (
          <div className="otp-exploded-empty">Sin operaciones</div>
        )}
        <span className="otp-exploded-branch-exit" aria-hidden="true" />
      </div>
    </section>
  );
}

function WorkflowOrdenExplotado({
  items,
  raizId,
}: {
  items: TableroItemData[];
  raizId: string;
}) {
  const momentos = React.useMemo(
    () => construirMomentosWorkflowOrden(items, raizId),
    [items, raizId],
  );

  return (
    <div className="otp-workflow-shell exploded">
      <div className="otp-workflow-canvas otp-exploded-canvas">
        <div className="otp-workflow-start" aria-hidden="true">
          <span />
          <small>INICIO</small>
        </div>
        {momentos.map((momento, momentoIndex) => (
          <React.Fragment key={momento.nivel}>
            <div className="otp-workflow-link" aria-hidden="true">
              <span />
            </div>
            <section
              aria-label={`Momento ${momentoIndex + 1}`}
              className="otp-exploded-moment"
            >
              <PilaWorkflowExplotado items={items} nodos={momento.nodos} />
            </section>
          </React.Fragment>
        ))}
        <div className="otp-workflow-link" aria-hidden="true">
          <span />
        </div>
        <div className="otp-workflow-end" aria-hidden="true">
          <span />
          <small>FIN</small>
        </div>
      </div>
    </div>
  );
}

function WorkflowOrden({
  items,
  raizId,
  vista,
  subrutasContraidas,
  onToggleSubruta,
  profundidad = 0,
}: {
  items: TableroItemData[];
  raizId: string;
  vista: "resumen" | "completo";
  subrutasContraidas: ReadonlySet<string>;
  onToggleSubruta: (itemId: string) => void;
  profundidad?: number;
}) {
  const momentos = React.useMemo(
    () => construirMomentosWorkflowOrden(items, raizId),
    [items, raizId],
  );
  const nodosPorId = React.useMemo(
    () =>
      new Map(
        momentos.flatMap((momento) =>
          momento.nodos.map((nodo) => [nodo.id, nodo] as const),
        ),
      ),
    [momentos],
  );

  if (momentos.length === 0) {
    return (
      <div className="otp-workflow-empty">
        Esta subruta no tiene operaciones materializadas.
      </div>
    );
  }

  if (vista === "completo" && profundidad === 0) {
    return <WorkflowOrdenExplotado items={items} raizId={raizId} />;
  }

  return (
    <div className={`otp-workflow-shell ${profundidad > 0 ? "nested" : ""}`}>
      <div className="otp-workflow-canvas">
        <div className="otp-workflow-start" aria-hidden="true">
          <span />
          <small>INICIO</small>
        </div>
        {momentos.map((momento, momentoIndex) => (
          <React.Fragment key={momento.nivel}>
            {momentoIndex > 0 ? (
              <div className="otp-workflow-link" aria-hidden="true">
                <span />
              </div>
            ) : null}
            <section
              className={`otp-workflow-moment ${
                vista === "completo" &&
                momento.nodos.some(
                  (nodo) =>
                    nodo.tipo === "COMPONENTE" &&
                    !subrutasContraidas.has(nodo.item.id),
                )
                  ? "expanded"
                  : ""
              }`}
            >
              <header>
                <span>MOMENTO {String(momentoIndex + 1).padStart(2, "0")}</span>
                {momento.nodos.length > 1 ? (
                  <small>{momento.nodos.length} en paralelo</small>
                ) : null}
              </header>
              <div className="otp-workflow-stack">
                {momento.nodos.map((nodo) => {
                  const { paso, item, predecesorIds } = nodo;
                  const status = STATUS_OF[nodo.estado];
                  const IcoC = paso
                    ? (TICO[
                        familiaIcono(paso.familiaCodigo, paso.plantillaCodigo)
                      ] ?? TICO.Tool)
                    : TICO.Package;
                  const esComponente = nodo.tipo === "COMPONENTE";
                  const esEtapa = nodo.tipo === "ETAPA";
                  const tipo = esComponente
                    ? "Componente fabricado"
                    : esEtapa
                      ? "Etapa consolidada"
                      : "Paso de producción";
                  const duracion = etiquetaDuracion(nodo.duracionEstimadaMin);
                  const predecesores = predecesorIds
                    .map((id) => nodosPorId.get(id)?.nombre)
                    .filter((nombre): nombre is string => Boolean(nombre));
                  const abierto =
                    esComponente &&
                    vista === "completo" &&
                    !subrutasContraidas.has(item.id);

                  if (esComponente) {
                    const total = nodo.progreso?.total ?? item.pasos.length;
                    const completos = nodo.progreso?.completos ?? 0;
                    const porcentaje =
                      total > 0 ? Math.round((completos / total) * 100) : 0;

                    return (
                      <Collapsible
                        key={nodo.id}
                        open={abierto}
                        onOpenChange={() => onToggleSubruta(item.id)}
                        className="otp-workflow-component-collapsible"
                      >
                        <article
                          className={`otp-workflow-node component ${status} ${
                            abierto ? "expanded" : ""
                          }`}
                          title={
                            predecesores.length > 0
                              ? `Se habilita después de: ${predecesores.join(", ")}`
                              : "Puede comenzar con la orden"
                          }
                        >
                          <div className="otp-workflow-node-main otp-workflow-component-head">
                            <span className="otp-workflow-node-icon">
                              {status === "done" ? (
                                <TICO.Check />
                              ) : status === "blocked" ? (
                                <TICO.Block />
                              ) : (
                                <TICO.Package />
                              )}
                            </span>
                            <div className="otp-workflow-node-body">
                              <span className="otp-workflow-node-type">
                                {tipo}
                              </span>
                              <strong>{nodo.nombre}</strong>
                              <small>
                                {total} paso{total === 1 ? "" : "s"} ·{" "}
                                {porcentaje}% completo
                                {duracion ? ` · ${duracion}` : ""}
                              </small>
                            </div>
                            <span className={`otp-workflow-status ${status}`}>
                              {ST_LBL[status]}
                            </span>
                            <CollapsibleTrigger
                              render={
                                <Button
                                  aria-label={`${abierto ? "Contraer" : "Ver"} subruta de ${nodo.nombre}`}
                                  title={`${abierto ? "Contraer" : "Ver"} subruta`}
                                  className="otp-workflow-expand-button"
                                  size="icon-sm"
                                  variant="outline"
                                />
                              }
                            >
                              {abierto ? (
                                <ChevronDownIcon aria-hidden="true" />
                              ) : (
                                <ChevronRightIcon aria-hidden="true" />
                              )}
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent className="otp-workflow-subroute-panel">
                            <header className="otp-workflow-subroute-head">
                              <span>SUBRUTA · {nodo.nombre}</span>
                              <small>
                                {completos}/{total} operaciones completadas
                              </small>
                            </header>
                            <WorkflowOrden
                              items={items}
                              raizId={item.id}
                              vista={vista}
                              subrutasContraidas={subrutasContraidas}
                              onToggleSubruta={onToggleSubruta}
                              profundidad={profundidad + 1}
                            />
                          </CollapsibleContent>
                        </article>
                      </Collapsible>
                    );
                  }

                  const operacionesEtapa =
                    paso?.operacionesIncorporacionSnapshotJson ?? [];
                  return (
                    <article
                      className={`otp-workflow-node ${status} ${
                        esComponente ? "component" : esEtapa ? "stage" : "step"
                      } ${
                        esEtapa &&
                        vista === "completo" &&
                        operacionesEtapa.length > 0
                          ? "expanded"
                          : ""
                      }`}
                      key={nodo.id}
                      title={
                        predecesores.length > 0
                          ? `Se habilita después de: ${predecesores.join(", ")}`
                          : "Puede comenzar con la orden"
                      }
                    >
                      <div className="otp-workflow-node-main">
                        <span className="otp-workflow-node-icon">
                          {status === "done" ? (
                            <TICO.Check />
                          ) : status === "blocked" ? (
                            <TICO.Block />
                          ) : (
                            <IcoC />
                          )}
                        </span>
                        <div className="otp-workflow-node-body">
                          <span className="otp-workflow-node-type">{tipo}</span>
                          <strong>{nodo.nombre}</strong>
                          <small>
                            {paso?.centroCostoNombre ??
                              (paso?.tipoEjecucion === "tercerizado"
                                ? "Tercerizado"
                                : "Sin centro asignado")}
                            {duracion ? ` · ${duracion}` : ""}
                          </small>
                        </div>
                        <span className={`otp-workflow-status ${status}`}>
                          {ST_LBL[status]}
                        </span>
                      </div>
                      {esEtapa &&
                      vista === "completo" &&
                      operacionesEtapa.length > 0 ? (
                        <div className="otp-workflow-stage-breakdown">
                          <span>SUBTAREAS · UN ÚNICO ESTADO OPERATIVO</span>
                          <div>
                            {operacionesEtapa.map((operacion, index) => {
                              const componentes =
                                operacion.componentesNombres ??
                                (operacion.componenteNombre
                                  ? [operacion.componenteNombre]
                                  : []);
                              return (
                                <div
                                  className="otp-workflow-stage-operation"
                                  key={`${paso?.id ?? nodo.id}:${operacion.codigo}:${index}`}
                                >
                                  <span>
                                    {String(index + 1).padStart(2, "0")}
                                  </span>
                                  <div>
                                    <strong>{operacion.nombre}</strong>
                                    <small>
                                      {componentes.length > 0
                                        ? componentes.join(" + ")
                                        : "Trabajo general del producto"}
                                    </small>
                                  </div>
                                  <small>
                                    {etiquetaDuracion(operacion.duracionMin) ??
                                      "Sin tiempo"}
                                  </small>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          </React.Fragment>
        ))}
        <div className="otp-workflow-link" aria-hidden="true">
          <span />
        </div>
        <div className="otp-workflow-end" aria-hidden="true">
          <span />
          <small>FIN</small>
        </div>
      </div>
    </div>
  );
}

/* ─── Anillo de avance ─── */
function Ring({ pct }: { pct: number }) {
  return (
    <div className="otp-ring" style={{ ["--p" as string]: pct }}>
      <span className="otp-ring-hole" />
      <span className="otp-ring-val mono">{pct}%</span>
    </div>
  );
}

export function ProduccionOrdenTab({
  ordenId,
  onOrdenActualizada,
}: {
  ordenId: string;
  /** Avisa al padre que el estado de la OT pudo cambiar (ej: al avanzar una
   *  compra tercerizada que finaliza la orden) para refrescar header/stepper. */
  onOrdenActualizada?: () => void;
}) {
  const [items, setItems] = React.useState<TableroItemData[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [vistaWorkflow, setVistaWorkflow] = React.useState<
    "resumen" | "completo"
  >("completo");
  const [subrutasContraidas, setSubrutasContraidas] = React.useState<
    Set<string>
  >(() => new Set());

  const cargar = React.useCallback(() => {
    getOrdenPasos(ordenId)
      .then((res) => {
        setItems(res.items);
        setError(null);
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "No se pudieron cargar los pasos.",
        ),
      );
    onOrdenActualizada?.();
  }, [ordenId, onOrdenActualizada]);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) {
    return (
      <div className="pagos-empty">
        <div className="pe-ttl">No se pudo cargar la producción</div>
        <div className="pe-sub">{error}</div>
      </div>
    );
  }
  if (items === null) {
    return (
      <div className="pagos-empty">
        <div className="pe-sub">Cargando la ruta de producción…</div>
      </div>
    );
  }

  const conRuta = items.filter((it) => it.pasos.length > 0);
  if (conRuta.length === 0) {
    return (
      <div className="pagos-empty">
        <div className="pe-ico">
          <TICO.Factory />
        </div>
        <div className="pe-ttl">Sin ruta de producción cargada</div>
        <div className="pe-sub">
          Los productos de esta orden todavía no tienen ruta de producción
          materializada en el taller.
        </div>
      </div>
    );
  }

  const pasosTotales = conRuta.flatMap((item) => item.pasos);
  const componentesTotales = conRuta.filter(
    (item) => item.parentItemId != null,
  ).length;
  const etapasTotales = pasosTotales.filter(
    (paso) => (paso.operacionesIncorporacionSnapshotJson?.length ?? 0) > 0,
  ).length;
  const pasosTerminados = pasosTotales.filter(
    (paso) => paso.estado === "hecho",
  ).length;
  const overall =
    pasosTotales.length > 0
      ? Math.round((pasosTerminados / pasosTotales.length) * 100)
      : 0;
  const productosRaiz = conRuta.filter((item) => !item.parentItemId);
  const terminados = productosRaiz.filter((producto) => {
    const ids = new Set([producto.id]);
    let crecio = true;
    while (crecio) {
      crecio = false;
      for (const candidate of conRuta) {
        if (
          candidate.parentItemId &&
          ids.has(candidate.parentItemId) &&
          !ids.has(candidate.id)
        ) {
          ids.add(candidate.id);
          crecio = true;
        }
      }
    }
    return conRuta
      .filter((candidate) => ids.has(candidate.id))
      .flatMap((candidate) => candidate.pasos)
      .every((paso) => paso.estado === "hecho");
  }).length;
  const enCurso = conRuta.filter((p) =>
    p.pasos.some((s) => s.estado === "en_curso"),
  );
  const bloqueados = conRuta.filter((p) =>
    p.pasos.some((s) => s.estado === "bloqueado"),
  );
  const toggleSubruta = (itemId: string) => {
    if (vistaWorkflow === "resumen") {
      setVistaWorkflow("completo");
      setSubrutasContraidas(
        new Set(
          conRuta
            .filter((item) => item.parentItemId != null && item.id !== itemId)
            .map((item) => item.id),
        ),
      );
      return;
    }
    setSubrutasContraidas((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(itemId)) siguientes.delete(itemId);
      else siguientes.add(itemId);
      return siguientes;
    });
  };

  return (
    <div className="prodtab">
      {/* Avance general */}
      <div className="otd-card otp-overall">
        <Ring pct={overall} />
        <div className="otp-overall-body">
          <div className="otp-overall-ttl">Avance general de la orden</div>
          <div className="otp-overall-track">
            <div
              className="otp-overall-fill"
              style={{ width: `${overall}%` }}
            />
          </div>
          <div className="otp-overall-stats">
            <span>
              {productosRaiz.length} producto
              {productosRaiz.length === 1 ? "" : "s"} en ruta
            </span>
            <span className="dot-sep">·</span>
            <span>
              {terminados} terminado{terminados === 1 ? "" : "s"}
            </span>
            {enCurso.length > 0 ? (
              <>
                <span className="dot-sep">·</span>
                <span className="run">{enCurso.length} en curso</span>
              </>
            ) : null}
            {bloqueados.length > 0 ? (
              <>
                <span className="dot-sep">·</span>
                <span className="warn">
                  {bloqueados.length} bloqueado
                  {bloqueados.length === 1 ? "" : "s"}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Compras / Tercerizados (F2) */}
      <PanelComprasOt items={conRuta} onChanged={cargar} />

      {/* Workflow DAG completo: padre, componentes y etapas en un recorrido. */}
      <div className="otd-card">
        <div className="otd-card-head otp-workflow-card-head">
          <div className="otp-workflow-head-main">
            <span className="ttl">
              Workflow de producción{" "}
              <span className="ct">{pasosTotales.length}</span>
            </span>
            <span className="sub">
              El recorrido de la orden y el avance real de todas sus ramas.
            </span>
            <span className="otp-workflow-summary">
              {pasosTotales.length} operaciones · {componentesTotales} subruta
              {componentesTotales === 1 ? "" : "s"} · {etapasTotales} etapa
              {etapasTotales === 1 ? "" : "s"}
            </span>
          </div>
          <ToggleGroup
            aria-label="Nivel de detalle del Workflow"
            className="otp-workflow-view-toggle"
            multiple={false}
            onValueChange={(values) => {
              const value = values[0] as "resumen" | "completo" | undefined;
              if (!value) return;
              setVistaWorkflow(value);
              if (value === "completo") setSubrutasContraidas(new Set());
            }}
            value={[vistaWorkflow]}
            variant="outline"
          >
            <ToggleGroupItem value="resumen">
              <Rows3Icon aria-hidden="true" />
              Resumen
            </ToggleGroupItem>
            <ToggleGroupItem value="completo">
              <NetworkIcon aria-hidden="true" />
              Workflow completo
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="otp-root-workflows">
          {productosRaiz.map((producto) => (
            <section className="otp-root-workflow" key={producto.id}>
              {productosRaiz.length > 1 ? (
                <header className="otp-root-workflow-head">
                  <TICO.Package />
                  <strong>{producto.nombre}</strong>
                </header>
              ) : null}
              <div className="otp-workflow-view-stage">
                <div
                  aria-hidden={vistaWorkflow !== "resumen"}
                  className={`otp-workflow-view-panel ${
                    vistaWorkflow === "resumen" ? "active" : "inactive"
                  }`}
                >
                  <WorkflowOrden
                    items={conRuta}
                    raizId={producto.id}
                    vista="resumen"
                    subrutasContraidas={subrutasContraidas}
                    onToggleSubruta={toggleSubruta}
                  />
                </div>
                <div
                  aria-hidden={vistaWorkflow !== "completo"}
                  className={`otp-workflow-view-panel ${
                    vistaWorkflow === "completo" ? "active" : "inactive"
                  }`}
                >
                  <WorkflowOrden
                    items={conRuta}
                    raizId={producto.id}
                    vista="completo"
                    subrutasContraidas={subrutasContraidas}
                    onToggleSubruta={toggleSubruta}
                  />
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
