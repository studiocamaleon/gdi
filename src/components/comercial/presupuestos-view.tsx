"use client";

import { useCapacidad } from "@/components/navigation/capacidades-provider";

/**
 * Presupuestos — listado + detalle del ciclo comercial
 * (docs/presupuestos-modulo-estudio.md). Comparte la base visual de los
 * listados HeroUI; conserva consultas, seguimiento y reglas comerciales.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, Button, SearchField } from "@heroui/react";
import {
  ArrowUpRight,
  Layers3,
  FilePenLine,
  ShieldCheck,
  Clock3,
  ArrowRightLeft,
  SlidersHorizontal,
  X,
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
import {
  DesignSystemProvider,
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import layout from "@/components/design-system/list-page.module.css";
import fieldFocus from "@/components/design-system/field-focus.module.css";
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

type PresupuestosViewProps = {
  initial: PresupuestosListado;
  rol: MembershipRole;
  filtroInicial?: PresupuestoEstado;
};

export function PresupuestosView(props: PresupuestosViewProps) {
  return (
    <DesignSystemProvider appearance="light" theme="brand">
      <PresupuestosContent {...props} />
    </DesignSystemProvider>
  );
}

function PresupuestosContent({
  initial,
  rol,
  filtroInicial,
}: PresupuestosViewProps) {
  const scope = useDesignScope();
  const themeClass = useDesignTheme();
  const conPresupuestos = useCapacidad("presupuestos");
  const conCotizacion = useCapacidad("cotizacion");
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

  const filtroActivo = filtro !== "todos" || Boolean(busqueda.trim());
  const filtrar = (estado: PresupuestoEstado | "todos") => {
    setPagina(0);
    setFiltro(estado);
    router.replace(
      estado === "todos"
        ? "/comercial/presupuestos"
        : `/comercial/presupuestos?estado=${estado}`,
    );
  };
  const limpiarFiltros = () => {
    setBusqueda("");
    filtrar("todos");
  };
  const iconos = {
    todos: Layers3,
    borrador: FilePenLine,
    pendiente_aprobacion: ShieldCheck,
    enviado: Send,
    aprobado: CircleCheck,
    rechazado: CircleX,
    vencido: Clock3,
    convertido: ArrowRightLeft,
  };

  return (
    <section
      {...scope}
      data-visual="brand"
      className={`${themeClass} ${layout.page} ${s.page}`}
      aria-label="Presupuestos"
    >
      <header className={layout.header}>
        <div className="min-w-0">
          <p className={s.eyebrow}>
            <FileText aria-hidden /> Comercial / Presupuestos
          </p>
          <h1>
            Presupuestos<span className={s.titleDot}>.</span>
          </h1>
          <p className={layout.subtitle}>
            De la propuesta al trabajo: cada oportunidad, en un solo lugar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {puedeAprobar && conPresupuestos ? (
            <ActionButton
              variant="outline"
              onPress={() => setConfigAbierta(true)}
            >
              <SettingsIcon size={15} aria-hidden />
              Configuración
            </ActionButton>
          ) : null}
          {conPresupuestos && conCotizacion && <ActionLink href="/comercial/crear-propuesta">
            <PlusIcon size={15} aria-hidden />
            Nuevo presupuesto <ArrowUpRight aria-hidden />
          </ActionLink>}
        </div>
      </header>

      {!conPresupuestos && <p className={layout.subtitle}>
        El plan actual permite consultar y resolver los presupuestos ya emitidos.
        La creación de nuevos presupuestos no está incluida.
      </p>}
      <div className={s.kpis}>
        <ListMetric
          label="Pipeline abierto"
          value={fmtMoneda(pipeline.total, moneda)}
          hint={`${pipeline.cantidad} ${pipeline.cantidad === 1 ? "enviado esperando" : "enviados esperando"} decisión`}
          icon={Send}
        />
        <ListMetric
          label="Aprobados sin convertir"
          value={fmtMoneda(aprobados.total, moneda)}
          hint={`${aprobados.cantidad} ${aprobados.cantidad === 1 ? "listo" : "listos"} para pasar a OT`}
          icon={CircleCheck}
          tone="brand"
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
          tone="danger"
        />
      </div>

      <Card className={layout.results}>
        <div className={s.toolbar}>
          <SearchField
            className={s.search}
            aria-label="Buscar presupuestos por número o cliente"
            value={busqueda}
            onChange={(value) => {
              setPagina(0);
              setBusqueda(value);
            }}
          >
            <SearchField.Group
              className={`${s.searchGroup} ${fieldFocus.singleBorder}`}
            >
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar por número o cliente…" />
              <SearchField.ClearButton aria-label="Limpiar búsqueda" />
            </SearchField.Group>
          </SearchField>
          <span className={s.resultCount} role="status">
            {data.paginacion.total}{" "}
            {data.paginacion.total === 1 ? "presupuesto" : "presupuestos"}
          </span>
        </div>
        <div className={s.filters} role="group" aria-label="Filtrar por estado">
          {chips.map((f) => {
            const Icon = iconos[f.k];
            return (
              <Button
                key={f.k}
                type="button"
                variant="ghost"
                className={s.filter}
                aria-pressed={filtro === f.k}
                onPress={() => filtrar(f.k)}
              >
                <Icon aria-hidden />
                <span>{f.label}</span>
                <span className={s.filterCount}>{countChip(f.k)}</span>
              </Button>
            );
          })}
        </div>
        {filtroActivo && (
          <div className={s.activeFilters}>
            <span>
              <SlidersHorizontal aria-hidden />
              {chips.find((f) => f.k === filtro)?.label}
              {busqueda.trim() && (
                <span className={s.query}>“{busqueda.trim()}”</span>
              )}
            </span>
            <ActionButton variant="ghost" onPress={limpiarFiltros}>
              <X aria-hidden />
              Limpiar filtros
            </ActionButton>
          </div>
        )}

        {lista.length === 0 ? (
          <div className={`${layout.empty} ${s.empty}`}>
            {filtroActivo ? (
              <SlidersHorizontal aria-hidden />
            ) : (
              <FileText aria-hidden />
            )}
            <h2>
              {filtroActivo
                ? "No hay presupuestos con estos filtros"
                : "Tu próxima propuesta empieza acá"}
            </h2>
            <p>
              {filtroActivo
                ? "Probá con otro número, cliente o estado."
                : "Creá un presupuesto desde la ficha comercial y seguí cada oportunidad hasta convertirla en una orden."}
            </p>
            {filtroActivo ? (
              <ActionButton variant="outline" onPress={limpiarFiltros}>
                Limpiar filtros
              </ActionButton>
            ) : (
              <ActionLink href="/comercial/crear-propuesta">
                <PlusIcon aria-hidden />
                Nuevo presupuesto
              </ActionLink>
            )}
          </div>
        ) : (
          <PresupuestosTable
            lista={lista}
            moneda={moneda}
            onAbrir={(id) => router.push(`/comercial/presupuestos/${id}`)}
          />
        )}
        {data.paginacion.total > 0 ? (
          <footer className={layout.pager}>
            <span className={s.pageCount}>
              {data.paginacion.skip + 1}–
              {data.paginacion.skip + data.presupuestos.length} de{" "}
              {data.paginacion.total}
            </span>
            {data.paginacion.total > data.paginacion.limit && (
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
            )}
          </footer>
        ) : null}
      </Card>

      {configAbierta ? (
        <ConfigPresupuestosSheet onCerrar={() => setConfigAbierta(false)} />
      ) : null}
    </section>
  );
}
