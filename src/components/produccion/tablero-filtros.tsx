"use client";

import type { Dispatch, SetStateAction } from "react";
import { SearchField } from "@heroui/react";
import {
  BanIcon,
  CheckIcon,
  ClockIcon,
  LayersIcon,
  PauseIcon,
  PlayIcon,
  TimerIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { useDesignScope, useDesignTheme } from "@/components/design-system/appearance";
import type { FiltrosTrabajo, metricasTrabajos } from "@/lib/tablero-lista";
import s from "./tablero-toolbar.module.css";

export function TableroFiltros({
  filters,
  setFilters,
  onEstacionChange,
  counts,
  total,
  estaciones,
  empleados,
  puedeFiltrarPersonal,
}: {
  filters: FiltrosTrabajo;
  setFilters: Dispatch<SetStateAction<FiltrosTrabajo>>;
  onEstacionChange: (estacionId: string) => void;
  counts: ReturnType<typeof metricasTrabajos>;
  total: number;
  estaciones: { id: string; nombre: string }[];
  empleados: { id: string; nombre: string }[];
  puedeFiltrarPersonal: boolean;
}) {
  const scope = useDesignScope();
  const designTheme = useDesignTheme();
  const metricas = [
    { label: "Trabajos", value: counts.all, icon: LayersIcon },
    { label: "Listos", value: counts.ready, icon: CheckIcon },
    { label: "En curso", value: counts.inProgress, icon: PlayIcon },
    { label: "En espera", value: counts.waiting, icon: ClockIcon },
    { label: "Pausados", value: counts.paused, icon: PauseIcon },
    {
      label: "Bloqueados",
      value: counts.blocked,
      icon: BanIcon,
      tone: "danger",
    },
    {
      label: "Con retraso",
      value: counts.delayed,
      icon: TimerIcon,
      tone: "danger",
    },
    {
      label: "Vencen hoy",
      value: counts.today,
      icon: ClockIcon,
      tone: "brand",
    },
  ];
  const hayFiltros =
    filters.query ||
    filters.estacionId ||
    filters.asignadasAMi ||
    (puedeFiltrarPersonal && filters.empleadoId);
  return (
    <div {...scope} className={`${designTheme} ${s.filters}`}>
      <div className={s.metricsRow}>
        <dl
          className={s.metrics}
          aria-label="Métricas de los trabajos visibles"
        >
          {metricas.map(({ label, value, icon: Icon, tone }) => (
            <div
              key={label}
              className={s.metric}
              data-tone={value > 0 ? tone : undefined}
            >
              <dt>
                <Icon aria-hidden="true" />
                {label}
              </dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {hayFiltros && (
          <span className={s.summary} role="status">
            {counts.all} de {total} trabajos
          </span>
        )}
      </div>
      <div className={s.controls}>
        <SearchField
          className={s.search}
          aria-label="Buscar trabajos activos"
          value={filters.query}
          onChange={(query) => setFilters((current) => ({ ...current, query }))}
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar por OT, cliente o trabajo…" />
            <SearchField.ClearButton aria-label="Limpiar búsqueda" />
          </SearchField.Group>
        </SearchField>
        <ActionButton
          variant={filters.asignadasAMi ? "secondary" : "outline"}
          aria-pressed={filters.asignadasAMi}
          onPress={() =>
            setFilters((current) => ({
              ...current,
              asignadasAMi: !current.asignadasAMi,
            }))
          }
        >
          <UserRoundIcon aria-hidden="true" />
          Asignadas a mí
        </ActionButton>
        <SelectField
          className={s.select}
          aria-label="Filtrar por estación"
          value={filters.estacionId}
          onChange={onEstacionChange}
          options={[
            { value: "", label: "Todas las estaciones" },
            ...estaciones.map((e) => ({ value: e.id, label: e.nombre })),
          ]}
        />
        {puedeFiltrarPersonal && (
          <SelectField
            className={s.select}
            aria-label="Filtrar por personal asignado"
            value={filters.empleadoId}
            onChange={(empleadoId) =>
              setFilters((current) => ({ ...current, empleadoId }))
            }
            options={[
              { value: "", label: "Todo el personal" },
              ...empleados.map((e) => ({ value: e.id, label: e.nombre })),
            ]}
          />
        )}
        {hayFiltros && (
          <ActionButton
            variant="ghost"
            isIconOnly
            aria-label="Limpiar filtros"
            title="Limpiar filtros"
            onPress={() => {
              setFilters({
                query: "",
                asignadasAMi: false,
                estacionId: "",
                empleadoId: "",
              });
              onEstacionChange("");
            }}
          >
            <XIcon />
          </ActionButton>
        )}
      </div>
    </div>
  );
}
