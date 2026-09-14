"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "@heroui/react";
import { Focusable } from "react-aria-components/Focusable";
import { useDesignScope } from "@/components/design-system/appearance";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Factory,
  Layers,
  UserRound,
  TriangleAlert,
  Clock3,
  Truck,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { IdentityAvatar } from "@/components/design-system/identity-avatar";
import theme from "@/components/design-system/theme.module.css";
import {
  agruparTrabajos,
  operadoresDelTrabajo,
  estacionDelPasoVisible,
  responsablesDeEspera,
} from "@/lib/tablero-lista";
import type { TableroPasoData } from "@/lib/tablero-produccion";
import type { Estacion } from "@/lib/estaciones";
import {
  ESTADO_TRABAJO_LABELS,
  type ItemView,
} from "@/lib/produccion-item-view";
import { calcularProgreso } from "@/lib/progreso-produccion";
import { ProgresoValor } from "./progreso-produccion";
import {
  etiquetaEta,
  type ResultadoSimulacion,
  type SimulacionItem,
} from "@/lib/flujo-produccion";
import { claveFechaEnZona } from "@/lib/zona";
import s from "./tablero-lista.module.css";

function Entrega({
  item,
  eta,
  zona,
}: {
  item: ItemView;
  eta?: SimulacionItem;
  zona: string;
}) {
  const fecha = item.data.fechaEntrega;
  const fechaLabel = fecha
    ? fecha.slice(0, 10).split("-").reverse().join("/")
    : "Sin fecha";
  const noLlega =
    !!eta?.finEstimado &&
    !!fecha &&
    claveFechaEnZona(eta.finEstimado, zona) > fecha.slice(0, 10);
  return (
    <div className={s.delivery}>
      <span>{fechaLabel}</span>
      {!item.finished && item.dueDays != null && (
        <span
          className={s.secondary}
          data-tone={
            item.delayed ? "danger" : item.dueDays === 0 ? "brand" : undefined
          }
        >
          {item.delayed
            ? `${Math.abs(item.dueDays)} d de atraso`
            : item.dueDays === 0
              ? "Vence hoy"
              : item.dueIn}
        </span>
      )}
      {!item.finished && eta && (
        <span
          className={s.secondary}
          data-tone={noLlega ? "danger" : undefined}
          title={
            eta.motivoSinEstimar ??
            (eta.asumeDesbloqueo
              ? "La estimación supone resolver el bloqueo."
              : undefined)
          }
        >
          {eta.finEstimado
            ? `Fin ≈ ${etiquetaEta(eta.finEstimado, new Date(), zona)}${noLlega ? " · no llega" : ""}${eta.parcial || eta.asumeDesbloqueo ? " *" : ""}`
            : "Fin sin estimar"}
        </span>
      )}
    </div>
  );
}

function EstadoTrabajo({
  item,
  esperas,
}: {
  item: ItemView;
  esperas: ReturnType<typeof responsablesDeEspera>;
}) {
  const scope = useDesignScope();
  const celda = (
    <td
      className={s.stateCell}
      data-state={item.state}
      tabIndex={item.waitingReasons.length ? 0 : undefined}
    >
      <span className={s.state}>
        <span>{ESTADO_TRABAJO_LABELS[item.state]}</span>
        {esperas.length > 0 && (
          <span
            className={s.waitingPeople}
            aria-label="Asignaciones de los pasos previos pendientes"
          >
            {esperas.map((espera) => (
              <span key={espera.pasoId} className={s.waitingPerson}>
                {espera.tercerizado ? (
                  <Truck size={12} aria-hidden="true" />
                ) : (
                  <UserRound size={12} aria-hidden="true" />
                )}
                <span>{espera.texto}</span>
              </span>
            ))}
          </span>
        )}
      </span>
    </td>
  );
  if (!item.waitingReasons.length) return celda;
  return (
    <Tooltip delay={300} closeDelay={100}>
      <Focusable>{celda}</Focusable>
      <Tooltip.Content
        {...scope}
        className={`${theme.theme} ${s.waitTooltip}`}
        placement="left"
      >
        <strong>Motivos de la espera</strong>
        <ul
          className={s.waitReasons}
          aria-label="Dependencias y requisitos pendientes"
        >
          {item.waitingReasons.map((motivo, indice) => (
            <li key={indice} className={s.waitReason}>
              <Clock3 size={13} aria-hidden="true" />
              <span>{motivo}</span>
            </li>
          ))}
        </ul>
      </Tooltip.Content>
    </Tooltip>
  );
}

function FilaTrabajo({
  item,
  eta,
  zona,
  estaciones,
  onOpen,
  pasosPorId,
}: {
  item: ItemView;
  eta?: SimulacionItem;
  zona: string;
  estaciones: Estacion[];
  onOpen: (id: string) => void;
  pasosPorId: ReadonlyMap<string, TableroPasoData>;
}) {
  const step = item.visibleStep;
  const operadores = operadoresDelTrabajo(item);
  const progreso = calcularProgreso(item.data.pasos);
  const lote = item.data.loteEntrega;
  const esperas = responsablesDeEspera(item, pasosPorId);
  return (
    <tr className={s.row} onClick={() => onOpen(item.id)}>
      <td>
        <div className={s.job}>
          <span className={s.product} title={item.product}>
            {item.product}
          </span>
          <span className={s.code} title={`${item.otCode} · ${item.customer}`}>
            {item.code} · {item.customer}
          </span>
          {(lote || item.data.componenteDe) && (
            <span className={s.context}>
              <Layers size={12} />
              {lote
                ? `${lote.nombre} · ${lote.esProductoDelLote ? "Producto" : lote.productoNombre}`
                : `Componente de ${item.data.componenteDe!.nombre}`}
            </span>
          )}
        </div>
      </td>
      <td className={s.quantity}>{item.qtyLabel}</td>
      <td>
        <div className={s.step}>
          <span className={s.stepName} title={step?.paso.nombre}>
            {step?.paso.nombre ??
              (item.finished
                ? "Completado"
                : item.sinRuta
                  ? "Sin ruta"
                  : "En espera")}
          </span>
          {!item.finished && (
            <span className={s.station}>
              <Factory size={12} />
              {estacionDelPasoVisible(item, estaciones)}
            </span>
          )}
          {item.currentSteps.length > 1 && (
            <span
              className={s.secondary}
              title={item.currentSteps.map((s) => s.paso.nombre).join(" · ")}
            >
              +{item.currentSteps.length - 1} pasos activos
            </span>
          )}
          {item.blockedReason && (
            <span className={s.reason} title={item.blockedReason}>
              <TriangleAlert size={11} />
              <span>{item.blockedReason}</span>
            </span>
          )}
        </div>
      </td>
      <td>
        {operadores.length ? (
          <div className={s.operator}>
            <IdentityAvatar
              name={operadores[0]}
              initials={operadores[0]
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0])
                .join("")}
            />
            <span title={operadores.join(" · ")}>
              {operadores[0]}
              {operadores.length > 1 && (
                <small>
                  +{operadores.length - 1}{" "}
                  {operadores.length === 2 ? "persona" : "personas"}
                </small>
              )}
            </span>
          </div>
        ) : (
          <span className={s.unassigned}>
            <UserRound size={14} />
            {item.finished ? "—" : "Sin asignar"}
          </span>
        )}
        {step?.paso.asignacionPersonal?.personas.length ? (
          <span className={s.secondary}>
            {step.paso.asignacionPersonal.origen === "manual"
              ? "Asignación manual"
              : "Asignación automática"}
          </span>
        ) : null}
        {step?.paso.tramoAbierto && (
          <span className={s.secondary}>
            Ejecutando: {step.paso.tramoAbierto.usuarioNombre}
          </span>
        )}
        {step?.paso.asignacionPersonal?.conflicto && (
          <span
            className={s.reason}
            title={step.paso.asignacionPersonal.conflicto}
          >
            <TriangleAlert size={12} /> Revisar asignación
          </span>
        )}
      </td>
      <EstadoTrabajo item={item} esperas={esperas} />
      <td>
        <Entrega item={item} eta={eta} zona={zona} />
      </td>
      <td>
        <div className={s.progress} aria-label={progreso.explicacion}>
          <span className={s.track} aria-hidden>
            <span style={{ width: `${item.progressPct}%` }} />
          </span>
          <ProgresoValor progreso={progreso} />
        </div>
      </td>
      <td className={s.actions}>
        <ActionButton
          variant="outline"
          isIconOnly
          aria-label={`Ver detalle de ${item.code}`}
          onPress={() => onOpen(item.id)}
        >
          <Eye size={15} />
        </ActionButton>
      </td>
    </tr>
  );
}

function Columnas() {
  return (
    <>
      <colgroup>
        <col className={s.colJob} />
        <col className={s.colQuantity} />
        <col className={s.colStep} />
        <col className={s.colOperator} />
        <col className={s.colState} />
        <col className={s.colDelivery} />
        <col className={s.colProgress} />
        <col className={s.colActions} />
      </colgroup>
      <thead>
        <tr>
          {[
            "Trabajo",
            "Cantidad",
            "Paso / Estación",
            "Personal asignado",
            "Estado",
            "Entrega",
            "Avance",
            "",
          ].map((t, i) => (
            <th scope="col" key={i}>
              {t || <span className="sr-only">Acciones</span>}
            </th>
          ))}
        </tr>
      </thead>
    </>
  );
}

function Grupo({
  grupo,
  sim,
  zona,
  estaciones,
  onOpen,
  inicialmenteAbierto,
  pasosPorId,
}: {
  grupo: { key: string; title: string; items: ItemView[] };
  sim?: ResultadoSimulacion;
  zona: string;
  estaciones: Estacion[];
  onOpen: (id: string) => void;
  inicialmenteAbierto?: boolean;
  pasosPorId: ReadonlyMap<string, TableroPasoData>;
}) {
  const [abierto, setAbierto] = useState(
    inicialmenteAbierto ?? grupo.items.length > 0,
  );
  const [limite, setLimite] = useState(30);
  return (
    <section
      className={s.group}
      data-group={grupo.key}
      aria-label={grupo.title}
    >
      <h2 className={s.groupHeader}>
        <ActionButton
          variant="ghost"
          className={s.groupButton}
          aria-expanded={abierto}
          aria-label={`${abierto ? "Contraer" : "Expandir"} ${grupo.title}`}
          onPress={() => setAbierto(!abierto)}
        >
          {abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <span>{grupo.title}</span>
          <span className={s.count}>{grupo.items.length} trabajos</span>
        </ActionButton>
      </h2>
      {abierto && (
        <div
          className={s.scroller}
          tabIndex={0}
          role="region"
          aria-label={`Tabla de ${grupo.title.toLowerCase()}`}
        >
          <table className={s.table} aria-label={`Trabajos: ${grupo.title}`}>
            <Columnas />
            <tbody>
              {grupo.items.slice(0, limite).map((item) => (
                <FilaTrabajo
                  key={item.id}
                  item={item}
                  eta={sim?.porItem.get(item.id)}
                  zona={zona}
                  estaciones={estaciones}
                  onOpen={onOpen}
                  pasosPorId={pasosPorId}
                />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={8} className={s.groupFooter}>
                  {limite < grupo.items.length ? (
                    <ActionButton
                      variant="ghost"
                      onPress={() => setLimite((n) => n + 30)}
                    >
                      Mostrar más · {grupo.items.length - limite} restantes
                    </ActionButton>
                  ) : (
                    <span>
                      {grupo.items.length}{" "}
                      {grupo.items.length === 1 ? "trabajo" : "trabajos"}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

export function TableroLista({
  items,
  trabajosContexto = items,
  sim,
  zona,
  estaciones,
  onOpen,
  terminados = false,
  seccionInicial,
  contextoFiltros = "",
}: {
  items: ItemView[];
  trabajosContexto?: ItemView[];
  sim?: ResultadoSimulacion;
  zona: string;
  estaciones: Estacion[];
  onOpen: (id: string) => void;
  terminados?: boolean;
  seccionInicial?: string;
  contextoFiltros?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const pasosPorId = useMemo(
    () =>
      new Map(
        trabajosContexto.flatMap((item) =>
          item.data.pasos.map((paso) => [paso.id, paso] as const),
        ),
      ),
    [trabajosContexto],
  );
  useEffect(() => {
    if (seccionInicial === "blocked")
      root.current
        ?.querySelector('[data-group="blocked"]')
        ?.scrollIntoView({ block: "nearest" });
  }, [seccionInicial]);
  const grupos = (
    terminados
      ? [{ key: "done", title: "Terminados", items }]
      : agruparTrabajos(items)
  ).filter((grupo) => grupo.items.length > 0);
  return (
    <div ref={root} data-ui="heroui" className={`${theme.theme} ${s.root}`}>
      {!grupos.length && (
        <p className={s.emptyState} role="status">
          No hay trabajos para mostrar.
        </p>
      )}
      {grupos.map((grupo) => (
        <Grupo
          key={`${contextoFiltros}:${grupo.key}`}
          grupo={grupo}
          inicialmenteAbierto={grupo.key === seccionInicial ? true : undefined}
          sim={sim}
          zona={zona}
          estaciones={estaciones}
          onOpen={onOpen}
          pasosPorId={pasosPorId}
        />
      ))}
    </div>
  );
}
