"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "@heroui/react";
import { Focusable } from "react-aria-components/Focusable";
import { useDesignScope, useDesignTheme } from "@/components/design-system/appearance";
import {
  ChevronDown,
  ChevronRight,
  Factory,
  Layers,
  UserRound,
  TriangleAlert,
  Clock3,
  Truck,
  Info,
  UserRoundPlus,
  UserRoundPen,
  Undo2,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import {
  agruparTrabajos,
  operadoresDelTrabajo,
  estacionDelPasoVisible,
  responsablesDeEspera,
  accionAsignacionManual,
  puedeReasignarPersonal,
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
  type ResultadoSimulacion,
  type PasoProgramado,
} from "@/lib/flujo-produccion";
import {
  cumplimientoPaso,
  finActualPaso,
  finPrevistoPaso,
} from "@/lib/tiempos-paso";
import s from "./tablero-lista.module.css";
import { revisionCeldasEnVivo, type CampoLista, type CambiosCeldas } from "@/lib/tablero-lista-en-vivo";
import { AsignacionPersonalSheet } from "./asignacion-personal-sheet";
import { useTransicionLista } from "./use-transicion-lista";
import { useCapacidad } from "@/components/navigation/capacidades-provider";

type AsignacionManual = {
  puedeReasignar: boolean;
  onConfirmar: (pasoId: string, token: string, motivo?: string) => Promise<void>;
  onReasignar?: (pasoId: string) => void;
  canManage: boolean;
  estacionIdsEjecutables: string[] | null;
  busy: boolean;
  onMesa: (pasoId: string, en: boolean) => Promise<void>;
};

type AtributosCampo = (campo: CampoLista) => {
  "data-field": CampoLista;
  "data-updating": true | undefined;
  "data-entering": true | undefined;
};

const EXPLICACION_TIEMPOS: Record<string, string> = {
  Previsto:
    "Fecha y hora en que este paso debería terminar según el plan de referencia. Se conserva al recalcular y cambia al aceptar una reprogramación.",
  Real: "Mientras el paso esté pendiente, muestra su finalización estimada con la situación actual del taller. Al completarse, muestra la fecha y hora registradas de finalización real.",
  Cumplimiento:
    "Diferencia entre la finalización prevista y la actual, en tiempo calendario y con precisión de un minuto. Mientras el paso esté pendiente es una proyección; al completarse es el resultado real.",
};

function FechaPaso({
  fecha,
  zona,
  nota,
  title,
}: {
  fecha: Date | null;
  zona: string;
  nota?: string;
  title?: string;
}) {
  if (!fecha) return <span className={s.secondary}>{nota ?? "Sin fecha"}</span>;
  return (
    <time dateTime={fecha.toISOString()} className={s.delivery} title={title}>
      <span>
        {fecha.toLocaleDateString("es-AR", {
          timeZone: zona,
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}
      </span>
      <strong>
        {fecha.toLocaleTimeString("es-AR", {
          timeZone: zona,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        })}
      </strong>
      {nota && <span className={s.secondary}>{nota}</span>}
    </time>
  );
}

function TiemposPaso({
  item,
  plan,
  zona,
  resultado,
  atributosCampo,
}: {
  item: ItemView;
  plan?: PasoProgramado;
  zona: string;
  resultado: ReturnType<typeof cumplimientoPaso>;
  atributosCampo: AtributosCampo;
}) {
  const paso = item.visibleStep?.paso;
  const previsto = finPrevistoPaso(paso);
  const actual = finActualPaso(paso, plan?.fin);
  const terminado = paso?.estado === "hecho";
  const noLlega = resultado.tipo === "demorado";
  return (
    <>
      <td {...atributosCampo("previsto")}>
        <FechaPaso
          fecha={previsto}
          zona={zona}
          nota={previsto ? undefined : "Sin referencia"}
          title={
            paso?.planReferencia
              ? `Referencia fijada el ${new Date(paso.planReferencia.fijadoEl).toLocaleString("es-AR", { timeZone: zona })}`
              : undefined
          }
        />
      </td>
      <td {...atributosCampo("real")}>
        <FechaPaso
          fecha={actual}
          zona={zona}
          nota={
            terminado
              ? actual
                ? "Finalizado"
                : "Sin registro"
              : actual
                ? "Estimado"
                : "Sin estimación"
          }
          title={
            !terminado && (plan?.parcial || item.blocked)
              ? "Estimación sujeta a resolver bloqueos y completar la configuración de recursos."
              : undefined
          }
        />
      </td>
      <td {...atributosCampo("cumplimiento")}>
        <div
          className={s.compliance}
          data-tone={
            noLlega
              ? "danger"
              : resultado.tipo === "sin-datos"
                ? "muted"
                : "success"
          }
        >
          <span>{resultado.texto}</span>
          {resultado.minutos != null && (
            <small>{terminado ? "Real" : "Proyectado"}</small>
          )}
        </div>
      </td>
    </>
  );
}

function EstadoTrabajo({
  item,
  esperas,
  cumplimiento,
  atributosCampo,
}: {
  item: ItemView;
  esperas: ReturnType<typeof responsablesDeEspera>;
  cumplimiento: ReturnType<typeof cumplimientoPaso>["tipo"];
  atributosCampo: AtributosCampo;
}) {
  const scope = useDesignScope();
  const designTheme = useDesignTheme();
  const celda = (
    <td
      {...atributosCampo("estado")}
      className={s.stateCell}
      data-state={item.state}
      data-compliance={cumplimiento}
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
        className={`${designTheme} ${s.waitTooltip}`}
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
  plan,
  zona,
  estaciones,
  onOpen,
  pasosPorId,
  asignacionManual,
  saliendo,
  entrando,
}: {
  item: ItemView;
  plan?: PasoProgramado;
  zona: string;
  estaciones: Estacion[];
  onOpen: (id: string) => void;
  pasosPorId: ReadonlyMap<string, TableroPasoData>;
  asignacionManual?: AsignacionManual;
  saliendo?: ReadonlySet<CampoLista>;
  entrando?: ReadonlySet<CampoLista>;
}) {
  const step = item.visibleStep;
  const cumplimiento = cumplimientoPaso(
    finPrevistoPaso(step?.paso),
    finActualPaso(step?.paso, plan?.fin),
  );
  const operadores = operadoresDelTrabajo(item);
  const progreso = calcularProgreso(item.data.pasos);
  const lote = item.data.loteEntrega;
  const esperas = responsablesDeEspera(item, pasosPorId);
  const puedeReasignar = puedeReasignarPersonal(item, estaciones, !!asignacionManual?.puedeReasignar);
  const accionManual = asignacionManual && !asignacionManual.puedeReasignar
    ? accionAsignacionManual(item, estaciones, asignacionManual.canManage, asignacionManual.estacionIdsEjecutables)
    : null;
  const atributosCampo: AtributosCampo = (campo) => ({
    "data-field": campo,
    "data-updating": saliendo?.has(campo) || undefined,
    "data-entering": entrando?.has(campo) || undefined,
  });
  return (
    <tr
      className={s.row}
      tabIndex={0}
      onClick={() => onOpen(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          onOpen(item.id);
        }
      }}
    >
      <td {...atributosCampo("trabajo")}>
        <div className={s.job}>
          <span className={s.product} title={item.product}>
            {item.product}
          </span>
          <span
            className={s.code}
            title={`${item.otCode} · ${item.customer}${item.data.fechaEntrega ? ` · Entrega comercial: ${item.data.fechaEntrega.slice(0, 10).split("-").reverse().join("/")}` : ""}`}
          >
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
      <td className={s.quantity} {...atributosCampo("cantidad")}><span>{item.qtyLabel}</span></td>
      <td {...atributosCampo("paso")}>
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
      <td {...atributosCampo("personal")} className={puedeReasignar ? s.personalEditable : undefined}>
        {operadores.length ? (
          <div className={s.operator}>
            <UserRound size={12} aria-hidden="true" />
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
        {puedeReasignar && step && <div className={s.reasignarAction} onClick={event => event.stopPropagation()}>
          <ActionButton variant="ghost" isIconOnly isDisabled={asignacionManual?.busy}
            title={operadores.length ? "Reasignar personal" : "Asignar personal"}
            aria-label={`${operadores.length ? "Reasignar" : "Asignar"} personal: ${step.paso.nombre}`}
            onPress={() => asignacionManual?.onReasignar?.(step.paso.id)}>
            {operadores.length ? <UserRoundPen /> : <UserRoundPlus />}
          </ActionButton>
        </div>}
        {accionManual && asignacionManual && step && (
          <div className={s.assignmentAction} onClick={(event) => event.stopPropagation()}>
            <ActionButton
              variant="outline"
              isDisabled={asignacionManual.busy}
              aria-label={`${accionManual === "asignarme" ? "Asignarme" : "Devolver"}: ${step.paso.nombre}`}
              onPress={() => void asignacionManual.onMesa(step.paso.id, accionManual === "asignarme")}
            >
              {accionManual === "asignarme" ? <UserRoundPlus /> : <Undo2 />}
              {accionManual === "asignarme" ? "Asignarme" : "Devolver"}
            </ActionButton>
          </div>
        )}
      </td>
      <EstadoTrabajo item={item} esperas={esperas} cumplimiento={cumplimiento.tipo} atributosCampo={atributosCampo} />
      <TiemposPaso item={item} plan={plan} zona={zona} resultado={cumplimiento} atributosCampo={atributosCampo} />
      <td {...atributosCampo("avance")}>
        <div className={s.progress} aria-label={progreso.explicacion}>
          <span className={s.track} aria-hidden>
            <span style={{ width: `${item.progressPct}%` }} />
          </span>
          <ProgresoValor progreso={progreso} />
        </div>
      </td>
    </tr>
  );
}

function Columnas() {
  const scope = useDesignScope();
  const designTheme = useDesignTheme();
  return (
    <>
      <colgroup>
        <col className={s.colJob} />
        <col className={s.colQuantity} />
        <col className={s.colStep} />
        <col className={s.colOperator} />
        <col className={s.colState} />
        <col className={s.colDate} />
        <col className={s.colDate} />
        <col className={s.colCompliance} />
        <col className={s.colProgress} />
      </colgroup>
      <thead>
        <tr>
          {[
            "Trabajo",
            "Cantidad",
            "Paso / Estación",
            "Personal asignado",
            "Estado",
            "Previsto",
            "Real",
            "Cumplimiento",
            "Avance",
          ].map((t) =>
            EXPLICACION_TIEMPOS[t] ? (
              <Tooltip key={t} delay={300}>
                <Focusable>
                  <th scope="col" tabIndex={0} className={s.explainedHeader}>
                    <span>
                      {t}
                      <Info size={11} aria-hidden="true" />
                    </span>
                  </th>
                </Focusable>
                <Tooltip.Content
                  {...scope}
                  className={`${designTheme} ${s.waitTooltip}`}
                >
                  {EXPLICACION_TIEMPOS[t]}
                </Tooltip.Content>
              </Tooltip>
            ) : (
              <th scope="col" key={t}>
                {t}
              </th>
            ),
          )}
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
  asignacionManual,
  saliendo,
  entrando,
}: {
  grupo: { key: string; title: string; items: ItemView[] };
  sim?: ResultadoSimulacion;
  zona: string;
  estaciones: Estacion[];
  onOpen: (id: string) => void;
  inicialmenteAbierto?: boolean;
  pasosPorId: ReadonlyMap<string, TableroPasoData>;
  asignacionManual?: AsignacionManual;
  saliendo: CambiosCeldas;
  entrando: CambiosCeldas;
}) {
  const [abierto, setAbierto] = useState(
    inicialmenteAbierto ?? grupo.items.length > 0,
  );
  const [limite, setLimite] = useState(30);
  const planes = useMemo(
    () => new Map(sim?.traza.map((p) => [p.pasoId, p]) ?? []),
    [sim],
  );
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
                  plan={
                    item.visibleStep
                      ? planes.get(item.visibleStep.paso.id)
                      : undefined
                  }
                  zona={zona}
                  estaciones={estaciones}
                  onOpen={onOpen}
                  pasosPorId={pasosPorId}
                  asignacionManual={asignacionManual}
                  saliendo={saliendo.get(item.id)}
                  entrando={entrando.get(item.id)}
                />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={9} className={s.groupFooter}>
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
  asignacionManual: solicitudAsignacion,
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
  asignacionManual?: AsignacionManual;
}) {
  const conAsignacionPersonal = useCapacidad("asignacion_automatica");
  const asignacionManual = useMemo(() => solicitudAsignacion ? {
    ...solicitudAsignacion,
    puedeReasignar: solicitudAsignacion.puedeReasignar && conAsignacionPersonal,
  } : undefined, [solicitudAsignacion, conAsignacionPersonal]);
  const scope = useDesignScope();
  const designTheme = useDesignTheme();
  const [pasoAsignacion, setPasoAsignacion] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const entrada = useMemo(() => {
    const pasosPorId = new Map(trabajosContexto.flatMap((item) => item.data.pasos.map((paso) => [paso.id, paso] as const)));
    const planes = new Map(sim?.traza.map((p) => [p.pasoId, p]) ?? []);
    const versiones = new Map(items.map((item) => [item.id, revisionCeldasEnVivo(
      item, estaciones, planes.get(item.visibleStep?.paso.id ?? ""), responsablesDeEspera(item, pasosPorId),
      !terminados && asignacionManual && !asignacionManual.puedeReasignar
        ? accionAsignacionManual(item, estaciones, asignacionManual.canManage, asignacionManual.estacionIdsEjecutables) : null,
      !terminados && puedeReasignarPersonal(item, estaciones, !!asignacionManual?.puedeReasignar),
    )]));
    return { items, estaciones, sim, pasosPorId, versiones, contexto: `${contextoFiltros}:${terminados}:${zona}` };
  }, [items, estaciones, sim, trabajosContexto, contextoFiltros, terminados, zona, asignacionManual]);
  const { datos, saliendo, entrando } = useTransicionLista(entrada);
  useEffect(() => {
    if (seccionInicial === "blocked")
      root.current
        ?.querySelector('[data-group="blocked"]')
        ?.scrollIntoView({ block: "nearest" });
  }, [seccionInicial]);
  const grupos = (
    terminados
      ? [{ key: "done", title: "Terminados", items: datos.items }]
      : agruparTrabajos(datos.items)
  ).filter((grupo) => grupo.items.length > 0);
  return (
    <div ref={root} {...scope} className={`${designTheme} ${s.root}`}>
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
          sim={datos.sim}
          zona={zona}
          estaciones={datos.estaciones}
          onOpen={onOpen}
          pasosPorId={datos.pasosPorId}
          saliendo={saliendo}
          entrando={entrando}
          asignacionManual={terminados || !asignacionManual ? undefined : { ...asignacionManual, onReasignar: setPasoAsignacion }}
        />
      ))}
      {pasoAsignacion && asignacionManual?.puedeReasignar && <AsignacionPersonalSheet key={pasoAsignacion} pasoId={pasoAsignacion} onClose={() => setPasoAsignacion(null)} onConfirmar={asignacionManual.onConfirmar} />}
    </div>
  );
}
