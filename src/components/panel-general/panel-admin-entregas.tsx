"use client";
import { useState } from "react";
import Link from "next/link";
import { Tabs, Tooltip } from "@heroui/react";
import { ArrowUpRight, Factory } from "lucide-react";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { ActionButton } from "@/components/design-system/action-button";
import { useDesignScope } from "@/components/design-system/appearance";
import theme from "@/components/design-system/brand-theme.module.css";
import type {
  PanelGeneralData,
  PanelGeneralEntrega,
} from "@/lib/panel-general-api";
import { PanelCard, Empty } from "./panel-admin-card";
import s from "./panel-admin-view.module.css";

function Trabajo({ entrega }: { entrega: PanelGeneralEntrega }) {
  const scope = useDesignScope();
  if (entrega.productos.length < 2) return <strong>{entrega.producto}</strong>;
  return (
    <Tooltip>
      <ActionButton
        variant="ghost"
        className={s.producto}
        aria-label={`${entrega.producto}. Ver avance de cada producto`}
      >
        {entrega.producto}
      </ActionButton>
      <Tooltip.Content {...scope} className={theme.theme}>
        <ul className={s.productList}>
          {entrega.productos.map((p) => (
            <li key={p.id}>
              {p.nombre} ·{" "}
              {p.progresoPct == null ? "Sin ruta" : `${p.progresoPct}%`}
            </li>
          ))}
        </ul>
      </Tooltip.Content>
    </Tooltip>
  );
}

function Avance({ entrega: e }: { entrega: PanelGeneralEntrega }) {
  const scope = useDesignScope();
  const pct = e.progreso ? e.progreso.porcentaje : e.progresoPct;
  const texto = pct == null ? "—" : `${pct}%`;
  const explicacion =
    e.progreso?.explicacion ??
    (pct == null ? "Sin avance calculable" : "Avance del trabajo previsto");
  return (
    <div className={s.avance}>
      <div
        role="progressbar"
        aria-label={`Avance de ${e.numero}`}
        aria-valuenow={pct ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={explicacion}
        className={s.track}
      >
        <div style={{ width: `${pct ?? 0}%` }} />
      </div>
      <Tooltip>
        <ActionButton
          variant="ghost"
          className={s.progressValue}
          aria-label={`${texto}. ${explicacion}`}
        >
          {texto}
        </ActionButton>
        <Tooltip.Content {...scope} className={theme.theme}>
          {explicacion}
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}

type Riesgo = PanelGeneralEntrega["riesgo"];
const GRUPOS: { id: Riesgo; label: string; vacio: string; detalle: string }[] =
  [
    {
      id: "hoy",
      label: "Hoy",
      vacio: "Sin entregas para hoy",
      detalle: "No hay órdenes con entrega comprometida para hoy.",
    },
    {
      id: "atrasada",
      label: "Atrasadas",
      vacio: "Entregas al día",
      detalle: "No hay órdenes con una fecha de entrega vencida.",
    },
    {
      id: "proxima",
      label: "Próximas",
      vacio: "Sin entregas próximas",
      detalle:
        "No hay órdenes comprometidas entre mañana y los próximos siete días.",
    },
  ];

function ListaEntregas({
  items,
  total,
  vacio,
  detalle,
}: {
  items: PanelGeneralEntrega[];
  total: number;
  vacio: string;
  detalle: string;
}) {
  if (!items.length) return <Empty titulo={vacio}>{detalle}</Empty>;
  return (
    <>
      <ul className={s.deliveries}>
        {items.map((entrega) => {
          const pct = entrega.progreso
            ? entrega.progreso.porcentaje
            : entrega.progresoPct;
          const etapa =
            entrega.pasoActual ??
            (pct == null
              ? "Sin ruta de producción"
              : pct === 100
                ? "Producción completada"
                : "Sin etapa activa");
          return (
            <li key={entrega.id} className={s.delivery}>
              <div className={s.deliveryWork}>
                <Link
                  className={s.orden}
                  href={entrega.href}
                  aria-label={`Abrir ${entrega.numero}`}
                >
                  {entrega.numero}
                  <ArrowUpRight size={13} aria-hidden />
                </Link>
                <div className={s.workTitle}>
                  <Trabajo entrega={entrega} />
                </div>
                <p className={s.client}>
                  {entrega.cliente ?? "Sin cliente asignado"}
                </p>
              </div>
              <div className={s.deliveryDate} data-risk={entrega.riesgo}>
                <span>
                  {entrega.riesgo === "hoy"
                    ? "Hoy"
                    : entrega.riesgo === "atrasada"
                      ? "Atrasada"
                      : "Próxima"}
                </span>
                <time dateTime={entrega.fechaEntrega}>
                  {entrega.fechaEntrega
                    .slice(0, 10)
                    .split("-")
                    .reverse()
                    .join("/")}
                </time>
              </div>
              <div className={s.deliveryStatus}>
                <span className={s.stage}>
                  <Factory size={13} aria-hidden />
                  <span>
                    {etapa}
                    {entrega.estacionActual && (
                      <small> · {entrega.estacionActual}</small>
                    )}
                  </span>
                </span>
                <Avance entrega={entrega} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className={s.deliveryFoot}>
        Mostrando {items.length} de {total} {total === 1 ? "orden" : "órdenes"}.
      </p>
    </>
  );
}

export function Entregas({
  grupos,
  abrir,
}: {
  grupos: NonNullable<PanelGeneralData["entregas"]>;
  abrir: (href: string) => void;
}) {
  const [grupo, setGrupo] = useState<Riesgo>("hoy");
  return (
    <PanelCard
      titulo="Entregas a priorizar."
      className={s.deliveryPanel}
      descripcion="Cada compromiso, a tiempo."
      accion={
        <ActionButton
          variant="ghost"
          onPress={() => abrir("/produccion/ordenes")}
        >
          Ver órdenes
          <ArrowUpRight size={14} aria-hidden />
        </ActionButton>
      }
    >
      <Tabs
        selectedKey={grupo}
        onSelectionChange={(key) => setGrupo(key as Riesgo)}
        className={s.deliveryTabs}
      >
        <NavigationTabList
          label="Filtrar entregas"
          items={GRUPOS.map(({ id, label }) => ({
            id,
            label,
            count: grupos[id].total,
          }))}
        />
        {GRUPOS.map(({ id, vacio, detalle }) => (
          <Tabs.Panel key={id} id={id} className={s.deliveryTab}>
            <ListaEntregas {...grupos[id]} vacio={vacio} detalle={detalle} />
          </Tabs.Panel>
        ))}
      </Tabs>
    </PanelCard>
  );
}
