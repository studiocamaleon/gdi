"use client";

/**
 * Presupuestos — listado + detalle del ciclo comercial
 * (docs/presupuestos-modulo-estudio.md). Comparte la base visual de los
 * listados HeroUI; conserva consultas, seguimiento y reglas comerciales.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, Button, SearchField } from "@heroui/react";
import {
  PlusIcon,
  SettingsIcon,
  Send,
  CircleCheck,
  TrendingUp,
  CircleX,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { ListMetric } from "@/components/design-system/list-metric";
import { useDesignScope } from "@/components/design-system/appearance";
import theme from "@/components/design-system/theme.module.css";
import layout from "@/components/design-system/list-page.module.css";
import fieldFocus from "@/components/design-system/field-focus.module.css";
import tabStyles from "@/components/design-system/navigation-tab-list.module.css";
import { ConfigPresupuestosSheet } from "./config-presupuestos-sheet";
import s from "./presupuestos-view.module.css";
import type { MembershipRole } from "@/lib/auth";
import {
  listarPresupuestos,
  type PresupuestoEstado,
  type PresupuestosListado,
} from "@/lib/presupuestos-api";
import { fmtMoneda, PresupuestosTable } from "./presupuestos-table";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";

export function PresupuestosView({
  initial,
  rol,
  filtroInicial,
}: {
  initial: PresupuestosListado;
  rol: MembershipRole;
  filtroInicial?: PresupuestoEstado;
}) {
  const scope = useDesignScope();
  const { moneda } = useConfigRegional();
  const router = useRouter();
  const [data, setData] = React.useState(initial);
  const [filtro, setFiltro] = React.useState<PresupuestoEstado | "todos">(
    filtroInicial ?? "todos",
  );
  const [busqueda, setBusqueda] = React.useState("");
  const [pagina, setPagina] = React.useState(0);
  const [configAbierta, setConfigAbierta] = React.useState(false);
  const puedeAprobar = rol === "administrador" || rol === "supervisor";

  const recargar = React.useCallback(async () => {
    try {
      setData(
        await listarPresupuestos({
          estado: filtro === "todos" ? undefined : filtro,
          busqueda: busqueda.trim() || undefined,
          skip: pagina * 50,
          limit: 50,
        }),
      );
    } catch {
      /* la vista conserva lo último */
    }
  }, [busqueda, filtro, pagina]);

  React.useEffect(() => {
    const timer = setTimeout(() => void recargar(), 250);
    return () => clearTimeout(timer);
  }, [recargar]);

  // La decisión del cliente llega por el link público desde OTRO
  // navegador: el estado se refresca por polling (patrón del tablero,
  // POLL_TABLERO_MS) sólo con la pestaña visible, y al volver a ella.
  React.useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void recargar();
    };
    const timer = setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [recargar]);

  const lista = data.presupuestos;

  const statDe = (estado: PresupuestoEstado) =>
    data.stats.find((s) => s.estado === estado) ?? { cantidad: 0, total: 0 };
  const pipeline = statDe("enviado");
  const aprobados = statDe("aprobado");
  const enviadosResueltos =
    statDe("aprobado").cantidad +
    statDe("rechazado").cantidad +
    statDe("vencido").cantidad +
    statDe("convertido").cantidad;
  const ganados = statDe("aprobado").cantidad + statDe("convertido").cantidad;

  const chips: Array<{ k: PresupuestoEstado | "todos"; label: string }> = [
    { k: "todos", label: "Todos" },
    { k: "borrador", label: "Borrador" },
    { k: "pendiente_aprobacion", label: "Pend. aprobación" },
    { k: "enviado", label: "Enviados" },
    { k: "aprobado", label: "Aprobados" },
    { k: "rechazado", label: "Rechazados" },
    { k: "vencido", label: "Vencidos" },
    { k: "convertido", label: "Convertidos" },
  ];
  const countChip = (k: PresupuestoEstado | "todos") =>
    k === "todos"
      ? data.stats.reduce((s, estado) => s + estado.cantidad, 0)
      : statDe(k).cantidad;

  return (
    <section
      {...scope}
      className={`${theme.theme} ${layout.page}`}
      aria-label="Presupuestos"
    >
      <header className={layout.header}>
        <div className="min-w-0">
          <h1>Presupuestos</h1>
          <p className={layout.subtitle}>
            El ciclo comercial: enviá, seguí la decisión del cliente y convertí
            en orden.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {puedeAprobar ? (
            <ActionButton
              variant="outline"
              onPress={() => setConfigAbierta(true)}
            >
              <SettingsIcon size={15} aria-hidden />
              Configuración
            </ActionButton>
          ) : null}
          <ActionLink href="/comercial/crear-propuesta">
            <PlusIcon size={15} aria-hidden />
            Nuevo presupuesto
          </ActionLink>
        </div>
      </header>

      <div className={s.kpis}>
        <ListMetric
          label="Pipeline abierto"
          value={fmtMoneda(pipeline.total, moneda)}
          hint={`${pipeline.cantidad} enviados esperando decisión`}
          icon={Send}
        />
        <ListMetric
          label="Aprobados sin convertir"
          value={fmtMoneda(aprobados.total, moneda)}
          hint={`${aprobados.cantidad} listos para pasar a OT`}
          icon={CircleCheck}
        />
        <ListMetric
          label="Tasa de cierre"
          value={
            enviadosResueltos > 0
              ? `${Math.round((ganados / enviadosResueltos) * 100)}%`
              : "—"
          }
          hint="ganados sobre resueltos"
          icon={TrendingUp}
        />
        <ListMetric
          label="Perdidos"
          value={statDe("rechazado").cantidad + statDe("vencido").cantidad}
          hint={`${fmtMoneda(statDe("rechazado").total + statDe("vencido").total, moneda)} rechazados o vencidos`}
          icon={CircleX}
          tone="brand"
        />
      </div>

      <Card className={layout.results}>
        <div className={layout.toolbar}>
          <div
            className={layout.filters}
            role="group"
            aria-label="Filtrar por estado"
          >
            {chips.map((f) => (
              <Button
                key={f.k}
                type="button"
                variant="ghost"
                className={`${tabStyles.tab} ${layout.filter}`}
                aria-pressed={filtro === f.k}
                onPress={() => {
                  setPagina(0);
                  setFiltro(f.k);
                  router.replace(
                    f.k === "todos"
                      ? "/comercial/presupuestos"
                      : `/comercial/presupuestos?estado=${f.k}`,
                  );
                }}
              >
                {f.label}
                <span className={tabStyles.count}>{countChip(f.k)}</span>
              </Button>
            ))}
          </div>
          <SearchField
            className={layout.search}
            aria-label="Buscar presupuestos por número o cliente"
            value={busqueda}
            onChange={(value) => {
              setPagina(0);
              setBusqueda(value);
            }}
          >
            <SearchField.Group
              className={`${layout.searchGroup} ${fieldFocus.singleBorder}`}
            >
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar por Nº, cliente…" />
            </SearchField.Group>
          </SearchField>
        </div>

        {lista.length === 0 ? (
          <div className={layout.empty}>
            <FileText size={28} aria-hidden />
            <p>
              {data.presupuestos.length === 0
                ? "Todavía no emitiste presupuestos. Crealos desde la ficha comercial con el selector en “Presupuesto”."
                : "Ningún presupuesto coincide con el filtro."}
            </p>
          </div>
        ) : (
          <PresupuestosTable
            lista={lista}
            moneda={moneda}
            onAbrir={(id) => router.push(`/comercial/presupuestos/${id}`)}
          />
        )}
        {data.paginacion.total > data.paginacion.limit ? (
          <footer className={layout.pager}>
            <span className="text-muted-foreground tabular-nums">
              {data.paginacion.skip + 1}–
              {data.paginacion.skip + data.presupuestos.length} de{" "}
              {data.paginacion.total}
            </span>
            <div className="flex items-center gap-2">
              <ActionButton
                variant="outline"
                isDisabled={pagina === 0}
                onPress={() => setPagina((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft size={15} aria-hidden />
                Anterior
              </ActionButton>
              <ActionButton
                variant="outline"
                isDisabled={!data.paginacion.hayMas}
                onPress={() => setPagina((p) => p + 1)}
              >
                Siguiente
                <ChevronRight size={15} aria-hidden />
              </ActionButton>
            </div>
          </footer>
        ) : null}
      </Card>

      {configAbierta ? (
        <ConfigPresupuestosSheet onCerrar={() => setConfigAbierta(false)} />
      ) : null}
    </section>
  );
}
