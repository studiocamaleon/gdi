"use client";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { useState } from "react";
import Link from "next/link";
import { Card, Chip, ListBox, Modal, Select } from "@heroui/react";
import {
  ArrowRight,
  BanknoteArrowDown,
  ChartNoAxesCombined,
  ClipboardList,
  Clock3,
  Factory,
  FileText,
  Package,
  PanelsTopLeft,
  Play,
  Plus,
  RefreshCw,
  Target,
  TriangleAlert,
  TrendingUp,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { useDesignScope } from "@/components/design-system/appearance";
import fieldFocus from "@/components/design-system/field-focus.module.css";
import theme from "@/components/design-system/theme.module.css";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatearMoneda } from "@/lib/moneda";
import {
  type PanelGeneralData,
  type PanelGeneralVista,
} from "@/lib/panel-general-api";
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
const DETALLES: Record<string, string> = {
  orden: "Nueva orden de trabajo",
  produccion: "Ver órdenes en taller",
  egreso: "Registrar un gasto",
  presupuesto: "Nueva propuesta comercial",
  facturacion: "Comprobantes pendientes",
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
  refrescar,
  cambiarVista,
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
  refrescar: () => void;
  cambiarVista: (vista: PanelGeneralVista) => void;
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
          </h1>
          <p className={s.sub}>Lo importante de tu taller, hoy.</p>
        </div>
        <div className={s.headerActions}>
          {data.vistasDisponibles.length > 1 && (
            <Select
              aria-label="Vista del Panel general"
              value={data.vistaActual}
              isDisabled={cargando}
              className={s.viewPicker}
              onChange={(key) =>
                key && cambiarVista(String(key) as PanelGeneralVista)
              }
            >
              <Select.Trigger className={fieldFocus.singleBorder}>
                <PanelsTopLeft size={15} />
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover {...scope} className={theme.theme}>
                <ListBox items={data.vistasDisponibles}>
                  {(vista) => (
                    <ListBox.Item id={vista.id} textValue={vista.etiqueta}>
                      {vista.etiqueta}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  )}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
          <span className={s.actualizado} aria-live="polite">
            Actualizado {actualizado}
          </span>
          <ActionButton
            variant="outline"
            isDisabled={cargando}
            onPress={refrescar}
          >
            {cargando ? <GdiSpinner /> : <RefreshCw size={14} />}
            Actualizar
          </ActionButton>
          {crear && (
            <ActionButton onPress={() => abrir(crear.href)}>
              <Plus size={16} />
              Crear orden
            </ActionButton>
          )}
        </div>
      </header>
      {error && (
        <p className={s.error} role="status">
          <TriangleAlert size={16} />
          No pudimos actualizar; conservamos la última información disponible.
        </p>
      )}
      <section className={s.kpis} aria-label="Indicadores de hoy">
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
                <Icono size={24} aria-hidden />
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
      </section>
      {data.accionesRapidas.length > 0 && (
        <Card className={s.focus}>
          <div className={s.focusTitle}>
            <span>
              <Target size={28} />
            </span>
            <div>
              <h2>Focus hoy</h2>
              <p>Acciones rápidas para mantener tu producción en movimiento.</p>
            </div>
          </div>
          <nav className={s.focusActions} aria-label="Acciones rápidas">
            {data.accionesRapidas.map((a) => {
              const Icono = ICONOS[a.icono] ?? FileText;
              return (
                <Link
                  href={a.href}
                  key={a.id}
                  className={s.focusAction}
                  data-primary={a.icono === "orden" || undefined}
                >
                  <span className={s.actionIcon}>
                    <Icono size={20} aria-hidden />
                  </span>
                  <div>
                    <strong>{a.etiqueta}</strong>
                    <small>{DETALLES[a.icono]}</small>
                  </div>
                  <ArrowRight size={16} aria-hidden />
                </Link>
              );
            })}
            {bloqueos && (
              <Link
                href="/produccion/tablero?estado=blocked"
                className={s.focusAction}
              >
                <span className={s.actionIcon}>
                  <TriangleAlert size={20} />
                </span>
                <div>
                  <strong>Ver bloqueos</strong>
                  <small>Revisar y resolver</small>
                </div>
                <ArrowRight size={16} />
              </Link>
            )}
          </nav>
        </Card>
      )}
      <div className={s.layout}>
        <div className={s.column}>
          <Entregas data={data} abrir={abrir} />
          <PanelCard
            titulo="Requieren atención"
            descripcion="Ordenado por urgencia"
            icono={TriangleAlert}
            accion={
              <Chip size="sm" variant="soft">
                {data.atencionTotal}
              </Chip>
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
                    <span className={s.dot} />
                    <div>
                      <strong>{alerta.titulo}</strong>
                      <span className={s.domain}>
                        {alerta.id === "documentacion-pendiente"
                          ? "Pre-prensa"
                          : alerta.dominio}
                      </span>
                      <p>{alerta.detalle}</p>
                    </div>
                    <b>{alerta.cantidad}</b>
                    <ArrowRight size={16} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty titulo="Todo bajo control">
                No hay pendientes urgentes para este momento.
              </Empty>
            )}
          </PanelCard>
        </div>
        <aside className={s.column}>
          {data.taller && (
            <PanelCard
              titulo="Estado del taller"
              descripcion="Foto operativa actual"
              icono={ChartNoAxesCombined}
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
          {admin && (
            <PanelCard
              titulo="Actividad reciente"
              icono={Clock3}
              accion={
                <ActionButton
                  variant="outline"
                  onPress={() => {
                    setModal("actividad");
                    reiniciarActividad();
                    void cargarActividad();
                  }}
                >
                  Ver toda
                </ActionButton>
              }
            >
              {admin?.actividad.items.length ? (
                <ActividadLista items={admin.actividad.items} ahora={ahora} />
              ) : (
                <Empty titulo="Sin actividad reciente">
                  Los movimientos registrados aparecerán aquí.
                </Empty>
              )}
            </PanelCard>
          )}
        </aside>
      </div>
      <Modal.Backdrop
        {...scope}
        className={theme.theme}
        isOpen={modal !== null}
        onOpenChange={(open) => !open && setModal(null)}
      >
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label="Cerrar" />
            <Modal.Header>
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
