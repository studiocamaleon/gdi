"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal } from "@heroui/react";
import {
  ArrowRight,
  BanknoteArrowDown,
  ChartNoAxesCombined,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Factory,
  FileText,
  Package,
  Play,
  Plus,
  TriangleAlert,
  TrendingUp,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { useDesignScope } from "@/components/design-system/appearance";
import theme from "@/components/design-system/brand-theme.module.css";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatearMoneda } from "@/lib/moneda";
import type { PanelGeneralData } from "@/lib/panel-general-api";
import { PanelCard, Empty } from "./panel-admin-card";
import { Entregas } from "./panel-admin-entregas";
import { ActividadLista } from "./panel-admin-actividad";
import { usePanelActividad } from "./use-panel-actividad";
import s from "./panel-admin-view.module.css";

const ICONOS: Record<string, LucideIcon> = {
  "entregas-hoy": Truck,
  atrasadas: Clock3,
  "en-produccion": Factory,
  bloqueados: TriangleAlert,
  "listos-retiro": Package,
  orden: Plus,
  produccion: Factory,
  egreso: BanknoteArrowDown,
  presupuesto: ClipboardList,
  facturacion: FileText,
};

export function PanelAdminView({
  data,
  nombre,
  fecha,
  saludo,
  actualizado,
  ahora,
  cargando,
  error,
  abrir,
}: {
  data: PanelGeneralData;
  nombre: string;
  fecha: string;
  saludo: string;
  actualizado: string;
  ahora: number;
  cargando: boolean;
  error: string | null;
  abrir: (href: string) => void;
}) {
  const scope = useDesignScope();
  const { moneda } = useConfigRegional();
  const [modal, setModal] = useState<"actividad" | "documentacion" | null>(
    null,
  );
  const {
    historial,
    cargando: cargandoActividad,
    error: errorActividad,
    cargar: cargarActividad,
    reiniciar: reiniciarActividad,
  } = usePanelActividad();
  const admin = data.administrador;
  const crear = data.accionesRapidas.find((a) => a.icono === "orden");
  const bloqueos = data.kpis.find((k) => k.id === "bloqueados");
  return (
    <div
      {...scope}
      className={`${theme.theme} ${s.page}`}
      data-panel-vista="administrador"
    >
      <header className={s.head}>
        <div>
          <p className={s.eyebrow}>{fecha}</p>
          <h1>
            {saludo}
            {nombre ? `, ${nombre}` : ""}
            <span className={s.period}>.</span>
          </h1>
          <p className={s.sub}>Tu industria gráfica, en movimiento.</p>
        </div>
        {crear && (
          <ActionButton onPress={() => abrir(crear.href)}>
            <Plus size={16} />
            Crear orden
          </ActionButton>
        )}
      </header>
      {error && (
        <p className={s.error} role="status">
          <TriangleAlert size={16} />
          No pudimos actualizar; conservamos la última información disponible.
        </p>
      )}
      <section className={s.overview} aria-label="Indicadores de hoy">
        <div className={s.overviewHead}>
          <h2>
            Tu operación, de un vistazo<span className={s.period}>.</span>
          </h2>
          <span
            className={s.actualizado}
            aria-live="polite"
            data-error={Boolean(error)}
          >
            <span aria-hidden />
            {cargando ? "Actualizando…" : `Actualizado ${actualizado}`}
          </span>
        </div>
        <div className={s.kpis}>
          {data.kpis.map((kpi) => {
            const Icono = ICONOS[kpi.id] ?? ChartNoAxesCombined;
            return (
              <Link
                href={
                  kpi.id === "bloqueados"
                    ? "/produccion/tablero?estado=blocked"
                    : kpi.href
                }
                key={kpi.id}
                className={s.kpi}
                data-tone={kpi.tono}
                data-kind={kpi.id}
              >
                <span className={s.kpiIcon}>
                  <Icono size={16} aria-hidden />
                </span>
                <div>
                  <p>{kpi.etiqueta}</p>
                  <strong>
                    {kpi.formato === "moneda"
                      ? formatearMoneda(kpi.valor, moneda, { decimales: 0 })
                      : kpi.valor.toLocaleString("es-AR")}
                  </strong>
                </div>
                <ArrowRight className={s.kpiArrow} size={16} aria-hidden />
                <small>{kpi.detalle}</small>
              </Link>
            );
          })}
        </div>
      </section>
      {(data.accionesRapidas.length > (crear ? 1 : 0) || bloqueos) && (
        <nav className={s.quickActions} aria-label="Acciones rápidas">
          <span className={s.quickLabel}>Accesos rápidos</span>
          {data.accionesRapidas
            .filter((a) => a !== crear)
            .map((a) => {
              const Icono = ICONOS[a.icono] ?? FileText;
              return (
                <Link href={a.href} key={a.id} className={s.quickAction}>
                  <Icono size={14} aria-hidden />
                  {a.etiqueta}
                </Link>
              );
            })}
          {bloqueos && (
            <Link
              href="/produccion/tablero?estado=blocked"
              className={s.quickAction}
            >
              <TriangleAlert size={14} aria-hidden />
              Ver bloqueos
            </Link>
          )}
        </nav>
      )}
      <div className={s.layout} data-deliveries={Boolean(data.entregas)}>
        {data.entregas && <Entregas grupos={data.entregas} abrir={abrir} />}
        <aside className={s.column}>
          <PanelCard
            titulo="Requieren atención"
            className={s.priorities}
            accion={
              <span className={s.sectionCount}>
                {data.atencionTotal} alertas
              </span>
            }
          >
            {data.atencion.length ? (
              <div className={s.attention}>
                {data.atencion.map((alerta) => (
                  <Link
                    href={alerta.href}
                    key={alerta.id}
                    data-severity={alerta.severidad}
                    onClick={
                      alerta.id === "documentacion-pendiente"
                        ? (e) => {
                            e.preventDefault();
                            setModal("documentacion");
                          }
                        : undefined
                    }
                  >
                    <b>{alerta.cantidad.toLocaleString("es-AR")}</b>
                    <div>
                      <strong>{alerta.titulo}</strong>
                      <p>{alerta.detalle}</p>
                    </div>
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty titulo="Todo bajo control">
                No hay pendientes urgentes para este momento.
              </Empty>
            )}
            {bloqueos?.valor === 0 && data.atencion.length > 0 && (
              <p className={s.quiet}>
                <CheckCircle2 size={14} aria-hidden /> Sin bloqueos de
                producción
              </p>
            )}
          </PanelCard>
          {data.taller && (
            <PanelCard
              titulo="Estado de planta"
              className={s.plant}
              accion={<Factory size={18} aria-hidden />}
            >
              <div className={s.metrics}>
                {[
                  {
                    label: "Ítems activos",
                    value: data.taller.itemsActivos,
                    icono: FileText,
                  },
                  {
                    label: "Pasos en curso",
                    value: data.taller.pasosEnCurso,
                    icono: Play,
                  },
                  {
                    label: "Bloqueados",
                    value: data.taller.pasosBloqueados,
                    icono: TriangleAlert,
                  },
                  {
                    label: "Pasos completados hoy",
                    value: admin?.pasosCompletadosHoy ?? null,
                    icono: TrendingUp,
                  },
                ].map((m) => (
                  <div key={m.label}>
                    <strong>{m.value ?? "—"}</strong>
                    <m.icono size={19} aria-hidden />
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
              {data.taller.cuelloBotella && (
                <Link className={s.bottleneck} href="/produccion/tablero">
                  <TriangleAlert size={16} />
                  <span>
                    <strong>{data.taller.cuelloBotella.estacion}</strong>
                    <small>
                      {Math.round(data.taller.cuelloBotella.colaMin)} min en
                      cola ·{" "}
                      {Math.round(data.taller.cuelloBotella.utilizacionPct)}% de
                      utilización
                    </small>
                  </span>
                  <ArrowRight size={14} />
                </Link>
              )}
            </PanelCard>
          )}
        </aside>
      </div>
      {admin && (
        <PanelCard
          titulo="Actividad reciente"
          descripcion="Los últimos movimientos de tu operación."
          className={s.recent}
          accion={
            <ActionButton
              variant="ghost"
              onPress={() => {
                setModal("actividad");
                reiniciarActividad();
                void cargarActividad();
              }}
            >
              Ver toda
              <ArrowRight size={14} aria-hidden />
            </ActionButton>
          }
        >
          {admin?.actividad.items.length ? (
            <ActividadLista
              items={admin.actividad.items}
              ahora={ahora}
              resumen
            />
          ) : (
            <Empty titulo="Sin actividad reciente">
              Los movimientos registrados aparecerán aquí.
            </Empty>
          )}
        </PanelCard>
      )}
      <Modal.Backdrop
        {...scope}
        className={theme.theme}
        isOpen={modal !== null}
        onOpenChange={(open) => !open && setModal(null)}
      >
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className={s.modalDialog}>
            <Modal.CloseTrigger aria-label="Cerrar" className={s.modalClose} />
            <Modal.Header className={s.modalHeader}>
              <Modal.Heading>
                {modal === "actividad"
                  ? "Actividad del taller"
                  : "Documentación pendiente"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {modal === "actividad" ? (
                <>
                  <p className={s.modalHelp}>
                    Órdenes, clientes, campañas, documentos y subidas
                    confirmadas. Del más reciente al más antiguo.
                  </p>
                  {historial?.items.length ? (
                    <ActividadLista
                      items={historial.items}
                      ahora={ahora}
                      onAbrir={() => setModal(null)}
                    />
                  ) : !cargandoActividad && !errorActividad ? (
                    <Empty titulo="Sin actividad registrada">
                      Los nuevos movimientos aparecerán aquí.
                    </Empty>
                  ) : null}
                  {errorActividad && (
                    <p role="alert" className={s.error}>
                      {errorActividad}
                    </p>
                  )}
                  {cargandoActividad && (
                    <p role="status" className={s.modalHelp}>
                      Cargando actividad…
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className={s.modalHelp}>
                    Órdenes activas con documentos sin liberar o con
                    aprobaciones pendientes.
                  </p>
                  <ul className={s.documents}>
                    {admin?.documentacionPendiente.ordenes.map((o) => (
                      <li key={o.id}>
                        <Link href={o.href} onClick={() => setModal(null)}>
                          <strong>{o.numero}</strong>
                          <span>
                            {o.requisitos} requisito
                            {o.requisitos === 1 ? "" : "s"} pendiente
                            {o.requisitos === 1 ? "" : "s"}
                          </span>
                          <ArrowRight size={16} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {(admin?.documentacionPendiente.total ?? 0) > 20 && (
                    <p className={s.modalHelp}>
                      Se muestran las primeras 20 de{" "}
                      {admin?.documentacionPendiente.total} órdenes.
                    </p>
                  )}
                </>
              )}
            </Modal.Body>
            {modal === "actividad" &&
              (historial?.siguienteCursor || errorActividad) && (
                <Modal.Footer>
                  <ActionButton
                    variant="outline"
                    isDisabled={cargandoActividad}
                    onPress={() => void cargarActividad(Boolean(historial))}
                  >
                    {errorActividad ? "Reintentar" : "Cargar más"}
                  </ActionButton>
                </Modal.Footer>
              )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
