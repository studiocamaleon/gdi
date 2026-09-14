"use client";
import { useMemo, useState } from "react";
import { Card, Chip, SearchField } from "@heroui/react";
import {
  ArrowRight,
  Armchair,
  Ban,
  CalendarDays,
  Clock3,
  Cog,
  Cpu,
  Factory,
  Flame,
  HelpCircle,
  Layers,
  ListTodo,
  Route,
  Truck,
  Users,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { ListMetric } from "@/components/design-system/list-metric";
import { SelectField } from "@/components/design-system/select-field";
import { StationIcon } from "./estaciones-iconos";
import { StationDetail } from "./estacion-tareas";
import {
  buildStationsModel,
  computeStationStats,
  type StationInfo,
} from "@/lib/estaciones-operacion";
import type { ItemView } from "@/lib/produccion-item-view";
import {
  capacidadDiariaMaxMin,
  ETAPAS_ESTACION,
  etapaDeEstacion,
  etiquetaCalendario,
  etiquetaDias,
  proyectarColaDias,
  type Estacion,
} from "@/lib/estaciones";
import { etiquetaDuracion } from "@/lib/tablero-produccion";
import s from "./estaciones-operativas.module.css";
import layout from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";

type StationStats = ReturnType<typeof computeStationStats>;
export function StationCard({
  station,
  stats,
  noLaborables,
  hoyMin,
  config,
  onSelect,
  onConfigure,
}: {
  station: StationInfo;
  stats: StationStats;
  noLaborables: Set<string>;
  hoyMin: number;
  config?: Estacion;
  onSelect: (id: string) => void;
  onConfigure?: (id: string) => void;
}) {
  const dias =
    station.capacidad != null && stats.colaMin > 0
      ? proyectarColaDias(
          station.calendario,
          stats.colaMin,
          station.capacidad,
          new Date(),
          noLaborables,
        )
      : null;
  const max =
    (config?.planificacionPorEmpleados
      ? null
      : capacidadDiariaMaxMin(station.calendario, station.capacidad ?? 1)) ??
    Math.max(stats.colaMin + stats.entranteMin, 1);
  const segments = [
    { kind: "pending", value: stats.pendingMin },
    { kind: "urgent", value: stats.urgentMin },
    { kind: "blocked", value: stats.blockedMin },
    { kind: "incoming", value: stats.entranteMin },
  ];
  return (
    <Card
      className={s.stationCard}
      data-inactive={config?.activo === false || undefined}
    >
      <div className={s.cardMain}>
        <div className={s.cardHead}>
          <span className={s.stationIcon}>
            {station.tercerizada ? (
              <Truck />
            ) : station.sinEstacion ? (
              <Ban />
            ) : (
              <StationIcon icono={station.icono} />
            )}
          </span>
          <div className={s.cardTitle}>
            <h3>{station.nm}</h3>
            <span>
              {station.tercerizada
                ? "Compras a proveedores"
                : station.sinEstacion
                  ? "Máquinas o pasos sin asignación"
                  : etapaDeEstacion(station.etapa ?? "").nm}
            </span>
          </div>
          {config && onConfigure && (
            <ActionButton
              variant="ghost"
              isIconOnly
              aria-label={`Configurar ${config.nombre}`}
              onPress={() => onConfigure(config.id)}
            >
              <Cog />
            </ActionButton>
          )}
        </div>
        <div className={s.cardLoad}>
          <strong>{stats.total}</strong>
          <span>pasos activos</span>
          {config?.activo === false && (
            <Chip size="sm" variant="soft">
              Inactiva
            </Chip>
          )}
        </div>
        <div className={s.loadBar} aria-hidden>
          {segments.map((seg) => (
            <span
              key={seg.kind}
              data-kind={seg.kind}
              style={{ width: `${Math.min(100, (seg.value / max) * 100)}%` }}
            />
          ))}
        </div>
        <dl className={s.cardCounters} aria-label="Estado de las tareas">
          <div className={s.stateCounter}>
            <dt>
              <ListTodo aria-hidden />
              Pendientes
            </dt>
            <dd>{stats.pending}</dd>
          </div>
          <div
            className={s.stateCounter}
            data-tone={stats.urgent > 0 ? "warning" : undefined}
          >
            <dt>
              <Flame aria-hidden />
              Urgentes
            </dt>
            <dd>{stats.urgent}</dd>
          </div>
          <div
            className={s.stateCounter}
            data-tone={stats.entranteCount > 0 ? "info" : undefined}
          >
            <dt>
              <Route aria-hidden />
              En camino
            </dt>
            <dd>{stats.entranteCount}</dd>
          </div>
        </dl>
        {(stats.blocked > 0 || stats.sinEstimar > 0) && (
          <div className={s.cardNotices}>
            {stats.blocked > 0 && (
              <Chip size="sm" variant="soft" color="danger">
                <Ban aria-hidden />
                {stats.blocked} bloqueados
              </Chip>
            )}
            {stats.sinEstimar > 0 && (
              <span>
                <HelpCircle aria-hidden />
                {stats.sinEstimar} sin estimar
              </span>
            )}
          </div>
        )}
        <dl className={s.cardFacts}>
          {(station.capacidad != null || config?.planificacionPorEmpleados) && (
            <div>
              <dt>
                <Armchair aria-hidden />
                {config?.planificacionPorEmpleados
                  ? "Pasos en curso"
                  : "Puestos en curso"}
              </dt>
              <dd>
                {stats.enCurso}
                {station.capacidad != null && <> / {station.capacidad}</>}
              </dd>
            </div>
          )}
          {stats.colaMin > 0 && (
            <div>
              <dt>
                <Clock3 aria-hidden />
                Cola estimada
              </dt>
              <dd>
                {etiquetaDuracion(stats.colaMin)}
                {dias != null && dias >= 0.05 && (
                  <small>≈ {etiquetaDias(dias)}</small>
                )}
              </dd>
            </div>
          )}
          {stats.entranteMin > 0 && (
            <div>
              <dt>
                <Route aria-hidden />
                Carga en camino
              </dt>
              <dd>
                +{etiquetaDuracion(stats.entranteMin)}
                {hoyMin > 0 && <small>{etiquetaDuracion(hoyMin)} hoy</small>}
              </dd>
            </div>
          )}
        </dl>
        {stats.oldestBlocked && (
          <p className={s.cardWarning}>
            <Ban size={13} />
            {stats.oldestBlocked.step.paso.motivoBloqueo ||
              "Paso bloqueado sin detalle"}
          </p>
        )}
      </div>
      {config && (
        <div className={s.cardResources}>
          <div>
            <Cpu aria-hidden />
            <span>
              <strong>{config.maquinas.length}</strong>{" "}
              {config.maquinas.length === 1 ? "máquina" : "máquinas"} ·{" "}
              <strong>{config.empleados.length}</strong>{" "}
              {config.empleados.length === 1
                ? "empleado asignado"
                : "empleados asignados"}
            </span>
          </div>
          <div>
            <Users aria-hidden />
            <span>
              {config.planificacionPorEmpleados ? (
                config.empleados.length ? (
                  "Disponibilidad por horario personal"
                ) : (
                  "Sin empleados para planificar"
                )
              ) : config.equipoProduccion ? (
                <>
                  <span className={s.resourceLabel}>Capacidad anterior</span>
                  <strong>{config.equipoProduccion.nombre}</strong>
                </>
              ) : (
                "Asigná empleados y horarios"
              )}
            </span>
          </div>
          <div>
            <CalendarDays aria-hidden />
            <span>
              {etiquetaCalendario(config.calendario) ??
                "Sin horario configurado"}
            </span>
          </div>
        </div>
      )}
      {stats.minDias != null && (
        <p className={s.delivery} data-late={stats.minDias < 0 || undefined}>
          <CalendarDays size={15} aria-hidden />
          <span>
            <span className={s.deliveryLabel}>Próxima entrega</span>
            <strong>
              {stats.minDias < 0
                ? `Vencida hace ${Math.abs(stats.minDias)} d`
                : stats.minDias === 0
                  ? "Hoy"
                  : `En ${stats.minDias} d`}
            </strong>
          </span>
        </p>
      )}
      <div className={s.cardFooter}>
        <ActionButton
          variant="outline"
          onPress={() => onSelect(station.key)}
          aria-label={`Ver tareas de ${station.nm}`}
        >
          Ver tareas
          <ArrowRight />
        </ActionButton>
      </div>
    </Card>
  );
}

export function EstacionesOperativas({
  items,
  estaciones,
  medianas,
  noLaborables,
  llegadasHoyMin,
  canManage,
  estacionIdsEjecutables,
  onMesa,
  onOpen,
  onConfigure,
}: {
  items: ItemView[];
  estaciones: Estacion[];
  medianas: Map<string, number>;
  noLaborables: Set<string>;
  llegadasHoyMin: Map<string, number>;
  canManage: boolean;
  estacionIdsEjecutables: string[] | null;
  onMesa: (pasoId: string, en: boolean) => void;
  onOpen: (id: string) => void;
  onConfigure?: (id: string) => void;
}) {
  const [stationKey, setStationKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [etapa, setEtapa] = useState("all");
  const [estado, setEstado] = useState("activas");
  const { stations, tareas, entrantes } = useMemo(
    () => buildStationsModel(items, estaciones),
    [items, estaciones],
  );
  const all = stations.map((station) => ({
    station,
    stats: computeStationStats(
      tareas.get(station.key) ?? [],
      entrantes.get(station.key) ?? [],
      medianas,
    ),
  }));
  // Las inactivas no reciben tareas; siguen disponibles para consultar y reactivar.
  const inactive = estaciones
    .filter((e) => !e.activo)
    .map((e) => ({
      station: {
        key: e.id,
        nm: e.nombre,
        icono: e.icono,
        capacidad: e.planificacionPorEmpleados ? null : e.capacidadConcurrente,
        calendario: e.calendario,
        horario: etiquetaCalendario(e.calendario),
        etapa: e.etapa,
        sinEstacion: false,
        tercerizada: false,
      },
      stats: computeStationStats([], [], medianas),
    }));
  const visible = [...all, ...inactive].filter(({ station, stats }) => {
    const config = estaciones.find((e) => e.id === station.key);
    if (estado === "activas" && config?.activo === false) return false;
    if (estado === "inactivas" && config?.activo !== false) return false;
    if (estado === "con-trabajo" && !stats.total && !stats.entranteCount)
      return false;
    if (etapa !== "all" && station.etapa !== etapa) return false;
    return `${station.nm} ${config?.descripcion ?? ""}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase());
  });
  const total = all.reduce((n, e) => n + e.stats.total, 0),
    incoming = all.reduce((n, e) => n + e.stats.entranteCount, 0),
    blocked = all.reduce((n, e) => n + e.stats.blocked, 0);
  const groups = [
    ...ETAPAS_ESTACION.map((e) => ({
      key: e.key,
      name: e.nm,
      rows: visible
        .filter((v) => v.station.etapa === e.key)
        .sort(
          (a, b) =>
            b.stats.blocked - a.stats.blocked ||
            b.stats.urgent - a.stats.urgent ||
            b.stats.total - a.stats.total,
        ),
    })),
    {
      key: "tercerizados",
      name: "Proveedor tercerizado",
      rows: visible.filter((v) => v.station.tercerizada),
    },
    {
      key: "sin-estacion",
      name: "Sin estación asignada",
      rows: visible.filter((v) => v.station.sinEstacion),
    },
  ].filter((g) => g.rows.length);
  if (
    stationKey &&
    (stations.some((e) => e.key === stationKey) ||
      estaciones.some((e) => e.id === stationKey))
  )
    return (
      <StationDetail
        items={items}
        estaciones={estaciones}
        medianas={medianas}
        noLaborables={noLaborables}
        stationKey={stationKey}
        canManage={
          canManage &&
          (estacionIdsEjecutables === null ||
            estacionIdsEjecutables.includes(stationKey))
        }
        onMesa={onMesa}
        onBack={() => setStationKey(null)}
        onOpen={onOpen}
        onConfigure={onConfigure}
      />
    );
  return (
    <>
      <div className={s.metrics}>
        <ListMetric
          label="Estaciones activas"
          value={estaciones.filter((e) => e.activo).length}
          hint={`${estaciones.filter((e) => !e.activo).length} inactivas`}
          icon={Factory}
        />
        <ListMetric
          label="Pasos activos"
          value={total}
          hint="Trabajo actual del taller"
          icon={Layers}
          tone="brand"
        />
        <ListMetric
          label="En camino"
          value={incoming}
          hint="Pasos futuros de órdenes emitidas"
          icon={Route}
        />
        <ListMetric
          label="Bloqueados"
          value={blocked}
          hint="Requieren atención"
          icon={Ban}
          tone={blocked ? "danger" : "neutral"}
        />
      </div>
      <Card className={s.filters}>
        <SearchField
          aria-label="Buscar estación"
          value={query}
          onChange={setQuery}
          className={s.search}
        >
          <SearchField.Group
            className={`${layout.searchGroup} ${focus.singleBorder}`}
          >
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar estación…" />
          </SearchField.Group>
        </SearchField>
        <SelectField
          aria-label="Etapa productiva"
          value={etapa}
          onChange={setEtapa}
          options={[
            { value: "all", label: "Todas las etapas" },
            ...ETAPAS_ESTACION.map((e) => ({ value: e.key, label: e.nm })),
          ]}
        />
        <SelectField
          aria-label="Actividad de las estaciones"
          value={estado}
          onChange={setEstado}
          options={[
            { value: "activas", label: "Estaciones activas" },
            { value: "con-trabajo", label: "Con trabajo" },
            { value: "inactivas", label: "Inactivas" },
            { value: "todas", label: "Todas las estaciones" },
          ]}
        />
      </Card>
      {!visible.length && (
        <Card className={s.empty}>
          <Factory />
          <strong>
            {estaciones.length
              ? "No hay estaciones que coincidan"
              : "Todavía no hay estaciones"}
          </strong>
          <p>
            {estaciones.length
              ? "Probá cambiando la búsqueda o los filtros."
              : "Creá las estaciones del taller y asignales máquinas y pasos sin máquina."}
          </p>
        </Card>
      )}
      {groups.map((group) => (
        <section key={group.key} className={s.group}>
          <div className={s.groupHeader}>
            <h2>{group.name}</h2>
            <span>
              {group.rows.length}{" "}
              {group.rows.length === 1 ? "estación" : "estaciones"}
            </span>
          </div>
          <div className={s.grid}>
            {group.rows.map(({ station, stats }) => (
              <StationCard
                key={station.key}
                station={station}
                stats={stats}
                noLaborables={noLaborables}
                hoyMin={llegadasHoyMin.get(station.key) ?? 0}
                config={estaciones.find((e) => e.id === station.key)}
                onSelect={setStationKey}
                onConfigure={onConfigure}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
