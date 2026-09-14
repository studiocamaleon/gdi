"use client";
import * as React from "react";
import { Card } from "@heroui/react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BanIcon,
  BoxIcon,
  ClockIcon,
  CogIcon,
  FactoryIcon,
  GripVerticalIcon,
  SquareDashedIcon,
  UserIcon,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { EtiquetaLote, ContextoLote } from "./lote-contexto";
import {
  buildStationsModel,
  computeStationStats,
  taskId,
  type StationTask,
} from "@/lib/estaciones-operacion";
import type { ItemView } from "@/lib/produccion-item-view";
import {
  etapaDeEstacion,
  etiquetaCalendario,
  etiquetaDias,
  proyectarColaDias,
  type Estacion,
} from "@/lib/estaciones";
import {
  etiquetaDuracion,
  textoEntregaRelativa,
} from "@/lib/tablero-produccion";
import { StationIcon } from "./estaciones-iconos";
import s from "./estaciones-operativas.module.css";
const cx = (names: string) =>
  names
    .split(/\s+/)
    .map((name) => s[name])
    .filter(Boolean)
    .join(" ");
export function TaskCard({
  task,
  inMesa,
  canManage,
  onMoveToMesa,
  onOpen,
  dragHint,
}: {
  task: StationTask;
  inMesa: boolean;
  canManage: boolean;
  onMoveToMesa: (id: string) => void;
  onOpen: (id: string) => void;
  dragHint?: boolean;
}) {
  const statusLabel = task.isBlocked
    ? "BLOQUEADO"
    : task.step.status === "paused"
      ? "PAUSADO"
      : task.isCurrent
        ? "EN CURSO"
        : "PENDIENTE";
  const statusCls = task.isBlocked
    ? "blocked"
    : task.step.status === "paused"
      ? "paused"
      : task.isCurrent
        ? "current"
        : "pending";
  const [dragging, setDragging] = React.useState(false);
  // Reclamada por OTRO usuario (mesaEsMia la pondría en MI columna).
  const enMesaDe = !inMesa ? task.step.paso.mesaUsuarioNombre : null;

  return (
    <Card
      className={cx(
        `sta-task status-${statusCls} ${task.overdue ? "overdue" : ""} ${task.urgent ? "urgent" : ""} ${inMesa ? "in-mesa" : ""} ${dragging ? "dragging" : ""}`,
      )}
      draggable={canManage}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/paso-id", taskId(task));
        event.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
    >
      <div className={cx("sta-task-row1")}>
        {canManage ? (
          <span className={cx("grip")} title="Arrastrá para mover">
            <GripVerticalIcon />
          </span>
        ) : null}
        <span className={cx("code")}>{task.item.code}</span>
        <EtiquetaLote item={task.item.data} />
        <span className={cx(`task-status ${statusCls}`)}>{statusLabel}</span>
        {task.overdue ? (
          <span className={cx("task-vencido")}>
            <BanIcon />
            VENCIDO
          </span>
        ) : null}
        {enMesaDe ? (
          <span
            className={cx("task-mesa-de")}
            title="Otro usuario la tiene en su mesa"
          >
            <UserIcon />
            {enMesaDe}
          </span>
        ) : null}
        <span className={cx("ot")}>{task.item.otCode}</span>
      </div>
      <div className={cx("sta-task-body")}>
        <div className={cx("meta")}>
          <span className={cx("ic")}>
            <UserIcon />
          </span>
          <span className={cx("v")}>{task.item.customer}</span>
        </div>
        <div className={cx("meta")}>
          <span className={cx("ic")}>
            <BoxIcon />
          </span>
          <span className={cx("v")}>
            {task.item.product}{" "}
            <span className={cx("qty")}>· {task.item.qtyLabel}</span>
          </span>
        </div>
        <ContextoLote item={task.item.data} />
        <div className={cx("meta step")}>
          <span className={cx("ic")}>
            <CogIcon />
          </span>
          <span className={cx("v")}>{task.step.paso.nombre}</span>
        </div>
        {task.step.paso.motivoBloqueo ? (
          <div className={cx("meta sub-detail")}>
            <span className={cx("v")}>{task.step.paso.motivoBloqueo}</span>
          </div>
        ) : null}
      </div>
      <div className={cx("sta-task-foot")}>
        <div className={cx("ts")}>
          <ClockIcon />
          <span>{task.item.dueLabel}</span>
          <span className={cx("sep")}>·</span>
          <span className={cx(task.overdue ? "warn" : "")}>
            {textoEntregaRelativa(task.item.dueDays, task.item.dueIn)}
          </span>
        </div>
        <div className={cx("actions")}>
          {canManage ? (
            <ActionButton
              type="button"
              variant="outline"
              onPress={() => onMoveToMesa(taskId(task))}
            >
              {inMesa ? (
                <>
                  <ArrowLeftIcon />
                  Devolver
                </>
              ) : (
                <>
                  Mover a mi mesa
                  <ArrowRightIcon />
                </>
              )}
            </ActionButton>
          ) : null}
          <ActionButton
            type="button"
            variant="primary"
            onPress={() => onOpen(task.item.id)}
          >
            Ver detalles
          </ActionButton>
        </div>
      </div>
      {dragHint ? (
        <div className={cx("sta-task-hint")}>
          Arrastrá esta tarea a Mesa de trabajo o Pendientes.
        </div>
      ) : null}
    </Card>
  );
}

export function StationDetail({
  items,
  estaciones,
  medianas,
  noLaborables,
  stationKey,
  canManage,
  onMesa,
  onBack,
  onOpen,
  onConfigure,
}: {
  items: ItemView[];
  estaciones: Estacion[];
  medianas: Map<string, number>;
  noLaborables: Set<string>;
  stationKey: string;
  canManage: boolean;
  onMesa: (pasoId: string, en: boolean) => void;
  onBack: () => void;
  onOpen: (id: string) => void;
  onConfigure?: (id: string) => void;
}) {
  const { stations, tareas, entrantes } = buildStationsModel(items, estaciones);
  const station = stations.find((entry) => entry.key === stationKey);
  const tasks = tareas.get(stationKey) ?? [];
  const stats = computeStationStats(
    tasks,
    entrantes.get(stationKey) ?? [],
    medianas,
  );
  const diasCola =
    station && station.capacidad != null && stats.colaMin > 0
      ? proyectarColaDias(
          station.calendario,
          stats.colaMin,
          station.capacidad,
          new Date(),
          noLaborables,
        )
      : null;
  // Rango honesto (D12): el calendario caminado dos veces — sólo la cola,
  // y cola + lo en camino (cota superior si todo lo conocido llegara).
  const diasTotal =
    station && station.capacidad != null && stats.entranteMin > 0
      ? proyectarColaDias(
          station.calendario,
          stats.colaMin + stats.entranteMin,
          station.capacidad,
          new Date(),
          noLaborables,
        )
      : null;
  const [filter, setFilter] = React.useState("todos");
  /** Columna resaltada mientras se arrastra una tarea encima. */
  const [dragOver, setDragOver] = React.useState<"mesa" | "shared" | null>(
    null,
  );
  const etapa = station?.etapa ? etapaDeEstacion(station.etapa) : null;
  const estacionConfig = estaciones.find((entry) => entry.id === stationKey);

  // "Mi mesa" es PERSISTENTE por usuario (paso.mesaEsMia, backend):
  // reclamar acá lo ve todo el taller, y sobrevive recargas y sesiones.
  const mesaTasks = tasks.filter((task) => task.step.paso.mesaEsMia);
  const sharedTasks = tasks.filter((task) => !task.step.paso.mesaEsMia);

  const toggleMesa = (id: string) => {
    const task = tasks.find((entry) => taskId(entry) === id);
    if (task) onMesa(id, !task.step.paso.mesaEsMia);
  };

  const permitirSoltar =
    (zona: "mesa" | "shared") => (event: React.DragEvent) => {
      if (!canManage) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDragOver(zona);
    };

  const soltarEn = (zona: "mesa" | "shared") => (event: React.DragEvent) => {
    if (!canManage) return;
    event.preventDefault();
    setDragOver(null);
    const pasoId = event.dataTransfer.getData("text/paso-id");
    const task = tasks.find((entry) => taskId(entry) === pasoId);
    if (!task) return;
    const en = zona === "mesa";
    if (task.step.paso.mesaEsMia !== en) onMesa(pasoId, en);
  };
  let visibleShared = sharedTasks;
  let visibleMesa = mesaTasks;
  if (filter === "pendientes")
    visibleShared = sharedTasks.filter((task) => task.isPending);
  if (filter === "mesa") visibleShared = [];
  if (filter === "urgentes") {
    visibleShared = sharedTasks.filter((task) => task.urgent);
    visibleMesa = mesaTasks.filter((task) => task.urgent);
  }
  return (
    <div className={cx("sta-detail")}>
      <div className={cx("sta-detail-head")}>
        <div className={cx("sta-detail-head-top")}>
          <span className={cx("sta-detail-ico")}>
            {station ? <StationIcon icono={station.icono} /> : <FactoryIcon />}
          </span>
          <div className={cx("body")}>
            <h2>{station?.nm ?? estacionConfig?.nombre ?? "Estación"}</h2>
            <p>
              {station?.tercerizada
                ? "Pasos tercerizados (compras a proveedor): se gestionan desde Compras de la orden, no se ejecutan en el piso"
                : station?.sinEstacion
                  ? "Trabajos sin una máquina o un paso manual asignado a una estación activa"
                  : estacionConfig?.descripcion ||
                    [etapa?.nm, etiquetaCalendario(estacionConfig?.calendario)]
                      .filter(Boolean)
                      .join(" · ") ||
                    "Estación del taller"}
            </p>
            <div className={cx("actions")}>
              <ActionButton type="button" variant="outline" onPress={onBack}>
                <ArrowLeftIcon />
                Ver todas las estaciones
              </ActionButton>
            </div>
          </div>
          {estacionConfig && onConfigure && (
            <ActionButton
              variant="outline"
              isIconOnly
              aria-label={`Configurar ${estacionConfig.nombre}`}
              onPress={() => onConfigure(estacionConfig.id)}
            >
              <CogIcon />
            </ActionButton>
          )}
          <div className={cx("counter")}>
            <div className={cx("num")}>{tasks.length}</div>
            <div className={cx("lbl")}>pasos activos</div>
          </div>
        </div>
      </div>

      <div className={cx("sta-detail-kpis")}>
        {/* Ocupación instantánea (en curso/puestos) — el diseño tiene exactamente 5 cards. */}
        <div
          className={cx(
            `kpi ${station?.capacidad && stats.enCurso >= station.capacidad ? "warm" : ""}`,
          )}
        >
          <div className={cx("k")}>En curso</div>
          <div className={cx("v")}>
            {station?.capacidad
              ? `${stats.enCurso}/${station.capacidad}`
              : stats.enCurso}
          </div>
        </div>
        <div className={cx(`kpi ${mesaTasks.length > 0 ? "ok" : "warn"}`)}>
          <div className={cx("k")}>Mi mesa de trabajo</div>
          <div className={cx("v")}>{mesaTasks.length}</div>
        </div>
        <div className={cx("kpi cool")}>
          <div className={cx("k")}>Pendientes</div>
          <div className={cx("v")}>
            {tasks.filter((task) => task.isPending).length}
          </div>
        </div>
        <div
          className={cx(
            `kpi ${tasks.some((task) => task.urgent) ? "warm" : ""}`,
          )}
        >
          <div className={cx("k")}>Urgentes</div>
          <div className={cx("v")}>
            {tasks.filter((task) => task.urgent).length}
          </div>
        </div>
        <div className={cx("kpi")}>
          <div className={cx("k")}>
            {diasTotal != null && diasTotal >= 0.05
              ? `Cola · ≈ ${etiquetaDias(Math.max(diasCola ?? 0, 0))} · hasta ${etiquetaDias(diasTotal)}`
              : diasCola != null && diasCola >= 0.05
                ? `Cola · ≈ ${etiquetaDias(diasCola)}`
                : "Cola estimada"}
          </div>
          <div className={cx("v")}>
            {stats.colaMin > 0
              ? etiquetaDuracion(stats.colaMin)
              : stats.entranteMin > 0
                ? "0 min"
                : "—"}
            {stats.entranteMin > 0 ? (
              <span className={cx("kpi-extra")}>
                {" "}
                +{etiquetaDuracion(stats.entranteMin)} en camino
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className={cx("sta-detail-filters")}>
        <span className={cx("lbl")}>Filtros:</span>
        {[
          { k: "todos", l: "Todos" },
          { k: "pendientes", l: "Pendientes" },
          { k: "mesa", l: "Mi mesa" },
          { k: "urgentes", l: "Solo urgentes" },
        ].map((entry) => (
          <ActionButton
            key={entry.k}
            type="button"
            aria-pressed={filter === entry.k}
            variant={filter === entry.k ? "secondary" : "outline"}
            onPress={() => setFilter(entry.k)}
          >
            {entry.l}
          </ActionButton>
        ))}
      </div>

      <div className={cx("sta-detail-board")}>
        <div className={cx("sta-col mesa-col")}>
          <div className={cx("sta-col-head")}>
            <span className={cx("dot mesa")} />
            <span className={cx("ttl")}>Mi mesa de trabajo</span>
            <span className={cx("ct")}>
              <strong>{mesaTasks.length}</strong> pasos
            </span>
          </div>
          <div
            className={cx(
              `sta-col-body ${mesaTasks.length === 0 ? "empty-mesa" : ""} ${dragOver === "mesa" ? "drag-over" : ""}`,
            )}
            onDragOver={permitirSoltar("mesa")}
            onDragLeave={() =>
              setDragOver((current) => (current === "mesa" ? null : current))
            }
            onDrop={soltarEn("mesa")}
          >
            {mesaTasks.length === 0 ? (
              <div className={cx("sta-mesa-empty")}>
                <div className={cx("ic")}>
                  <SquareDashedIcon />
                </div>
                <div className={cx("ttl")}>
                  {canManage
                    ? "Arrastrá tareas acá para trabajar en ellas"
                    : "No hay tareas en tu mesa"}
                </div>
                <div className={cx("sub")}>
                  {canManage
                    ? "Las tareas pasan a tu mesa cuando las tomás de la fila compartida."
                    : "Esta vista es de sólo lectura."}
                </div>
              </div>
            ) : null}
            {visibleMesa.map((task) => (
              <TaskCard
                key={taskId(task)}
                task={task}
                inMesa
                canManage={canManage}
                onMoveToMesa={toggleMesa}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>

        <div className={cx("sta-col shared-col")}>
          <div className={cx("sta-col-head")}>
            <span className={cx("dot shared")} />
            <span className={cx("ttl")}>Pendientes compartidas</span>
            <span className={cx("ct")}>
              <strong>{visibleShared.length}</strong> pasos
            </span>
          </div>
          <div
            className={cx(
              `sta-col-body ${dragOver === "shared" ? "drag-over" : ""}`,
            )}
            onDragOver={permitirSoltar("shared")}
            onDragLeave={() =>
              setDragOver((current) => (current === "shared" ? null : current))
            }
            onDrop={soltarEn("shared")}
          >
            {visibleShared.length === 0 ? (
              <div className={cx("sta-shared-empty")}>
                {filter === "mesa"
                  ? "Solo se muestran las tareas de tu mesa."
                  : "No quedan tareas pendientes que coincidan con el filtro."}
              </div>
            ) : null}
            {visibleShared.map((task, index) => (
              <TaskCard
                key={taskId(task)}
                task={task}
                inMesa={false}
                canManage={canManage}
                onMoveToMesa={toggleMesa}
                onOpen={onOpen}
                dragHint={
                  canManage &&
                  index === 0 &&
                  mesaTasks.length === 0 &&
                  filter === "todos"
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
