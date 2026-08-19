"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  BadgeDollarSignIcon,
  BanknoteArrowDownIcon,
  BoxesIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  FactoryIcon,
  FileTextIcon,
  PanelsTopLeftIcon,
  PlusCircleIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
  WalletCardsIcon,
} from "lucide-react";

import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatearMoneda } from "@/lib/moneda";
import {
  getPanelGeneral,
  type PanelGeneralAccion,
  type PanelGeneralData,
  type PanelGeneralVista,
} from "@/lib/panel-general-api";
import s from "./panel-general-view.module.css";

const POLL_MS = 30_000;

const ICONOS: Record<
  PanelGeneralAccion["icono"],
  React.ComponentType<{ size?: number }>
> = {
  orden: PlusCircleIcon,
  presupuesto: ClipboardListIcon,
  produccion: FactoryIcon,
  estaciones: BoxesIcon,
  cobro: BadgeDollarSignIcon,
  egreso: BanknoteArrowDownIcon,
  facturacion: ReceiptTextIcon,
};

function primeraPalabra(nombre: string) {
  return nombre.trim().split(/\s+/)[0] || "";
}

function fechaHumana(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(y, m - 1, d));
}

function haceCuanto(iso: string, ahora: number) {
  const segundos = Math.max(0, Math.floor((ahora - Date.parse(iso)) / 1000));
  if (segundos < 15) return "ahora";
  if (segundos < 60) return `hace ${segundos} s`;
  return `hace ${Math.floor(segundos / 60)} min`;
}

export function saludoSegunMomento(iso: string, zonaHoraria: string) {
  const hora = Number(
    new Intl.DateTimeFormat("es-AR", {
      timeZone: zonaHoraria,
      hour: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .find((parte) => parte.type === "hour")?.value,
  );

  if (!Number.isFinite(hora) || hora < 12) return "Buen día";
  if (hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

function formatoPaso(estado: string) {
  if (estado === "en_curso") return "En curso";
  if (estado === "pausado") return "Pausado";
  if (estado === "bloqueado") return "Bloqueado";
  return "Por iniciar";
}

export function PanelGeneralView({
  initialData,
  nombreUsuario,
}: {
  initialData: PanelGeneralData | null;
  nombreUsuario: string;
}) {
  const router = useRouter();
  const { moneda, zonaHoraria } = useConfigRegional();
  const [data, setData] = React.useState(initialData);
  const [cargando, setCargando] = React.useState(initialData == null);
  const [error, setError] = React.useState<string | null>(null);
  const [ahora, setAhora] = React.useState(() => Date.now());
  const vistaRef = React.useRef<PanelGeneralVista>(
    initialData?.vistaActual ?? "actual",
  );

  const refrescar = React.useCallback(async (vista = vistaRef.current) => {
    setCargando(true);
    try {
      const siguiente = await getPanelGeneral(vista);
      vistaRef.current = siguiente.vistaActual;
      setData(siguiente);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos actualizar la información del Panel.",
      );
    } finally {
      setCargando(false);
      setAhora(Date.now());
    }
  }, []);

  const cambiarVista = React.useCallback(
    (vista: PanelGeneralVista) => {
      vistaRef.current = vista;
      const href = vista === "actual" ? "/" : `/?vista=${vista}`;
      router.replace(href, { scroll: false });
      void refrescar(vista);
    },
    [refrescar, router],
  );

  React.useEffect(() => {
    if (!initialData) void refrescar();
    const tick = window.setInterval(() => {
      setAhora(Date.now());
      if (document.visibilityState === "visible") void refrescar();
    }, POLL_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") void refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [initialData, refrescar]);

  const fecha = data
    ? fechaHumana(data.fechaLocal)
    : new Intl.DateTimeFormat("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date());
  const saludo = saludoSegunMomento(
    data?.generadoEl ?? new Date(ahora).toISOString(),
    zonaHoraria,
  );

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <p className={s.eyebrow}>{fecha}</p>
          <h1>
            {saludo}{nombreUsuario ? `, ${primeraPalabra(nombreUsuario)}` : ""}
          </h1>
          <p className={s.sub}>Lo que necesita atención en tu taller, ahora.</p>
        </div>
        <div className={s.refreshArea}>
          {data && data.vistasDisponibles.length > 1 ? (
            <label className={s.viewPicker}>
              <PanelsTopLeftIcon size={14} />
              <span>Vista</span>
              <select
                aria-label="Vista del Panel general"
                value={data.vistaActual}
                onChange={(event) =>
                  cambiarVista(event.target.value as PanelGeneralVista)
                }
                disabled={cargando}
              >
                {data.vistasDisponibles.map((vista) => (
                  <option key={vista.id} value={vista.id}>
                    {vista.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {data ? (
            <span aria-live="polite">
              Actualizado {haceCuanto(data.generadoEl, ahora)}
            </span>
          ) : null}
          <button
            type="button"
            className={s.refresh}
            onClick={() => void refrescar()}
            disabled={cargando}
          >
            <RefreshCwIcon
              size={14}
              className={cargando ? s.spinning : undefined}
            />
            Actualizar
          </button>
        </div>
      </header>

      {data?.previsualizando ? (
        <div className={s.previewNotice} role="status">
          <PanelsTopLeftIcon size={15} />
          Estás previsualizando el Panel como{" "}
          {
            data.vistasDisponibles.find(
              (vista) => vista.id === data.vistaActual,
            )?.etiqueta
          }
          . Tus permisos no cambiaron.
        </div>
      ) : null}

      {error ? (
        <div className={s.error} role="status">
          <TriangleAlertIcon size={15} />
          {data
            ? "No pudimos actualizar; conservamos la última información disponible."
            : error}
        </div>
      ) : null}

      {!data ? (
        <div aria-label="Cargando Panel general">
          <div className={s.kpis}>
            {Array.from({ length: 5 }, (_, i) => (
              <div className={s.skeleton} key={i} />
            ))}
          </div>
          <div className={s.layout}>
            <div className={s.skeleton} style={{ minHeight: 310 }} />
            <div className={s.skeleton} style={{ minHeight: 310 }} />
          </div>
        </div>
      ) : (
        <>
          {data.kpis.length > 0 ? (
            <section className={s.kpis} aria-label="Indicadores de hoy">
              {data.kpis.map((kpi) => (
                <Link
                  className={s.kpi}
                  data-tone={kpi.tono}
                  href={kpi.href}
                  key={kpi.id}
                >
                  <div className={s.kpiLabel}>{kpi.etiqueta}</div>
                  <div className={s.kpiValue}>
                    {kpi.formato === "moneda"
                      ? formatearMoneda(kpi.valor, moneda, { decimales: 0 })
                      : kpi.valor.toLocaleString("es-AR")}
                  </div>
                  <div className={s.kpiDetail}>{kpi.detalle}</div>
                </Link>
              ))}
            </section>
          ) : null}

          {data.accionesRapidas.length > 0 ? (
            <nav className={s.actions} aria-label="Acciones rápidas">
              {data.accionesRapidas.map((accion) => {
                const Icono = ICONOS[accion.icono] ?? FileTextIcon;
                return (
                  <Link className={s.action} href={accion.href} key={accion.id}>
                    <Icono size={15} />
                    {accion.etiqueta}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          <div className={s.layout}>
            <section className={s.card} aria-labelledby="atencion-title">
              <div className={s.cardHead}>
                <TriangleAlertIcon size={16} />
                <div>
                  <h2 id="atencion-title">Requieren atención</h2>
                  <p>Ordenado por urgencia</p>
                </div>
                <span className={s.grow} />
                <span className={s.count}>{data.atencionTotal}</span>
              </div>
              {data.atencion.length === 0 ? (
                <div className={s.empty}>
                  <div>
                    <CheckCircle2Icon size={25} />
                    <strong>Todo bajo control</strong>
                    No hay pendientes urgentes para este momento.
                  </div>
                </div>
              ) : (
                <div className={s.attentionList}>
                  {data.atencion.map((alerta) => (
                    <Link
                      className={s.attention}
                      data-severity={alerta.severidad}
                      href={alerta.href}
                      key={alerta.id}
                    >
                      <span className={s.signal} />
                      <span>
                        <span className={s.attTitle}>
                          {alerta.titulo}
                          <span className={s.domain}>{alerta.dominio}</span>
                        </span>
                        <span className={s.attDetail}>{alerta.detalle}</span>
                      </span>
                      <span className={s.attCount}>{alerta.cantidad}</span>
                      <ArrowRightIcon size={15} />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {data.trabajoPersonal.total > 0 ||
            (!data.taller && !data.administracion) ? (
              <section className={s.card} aria-labelledby="mesa-title">
                <div className={s.cardHead}>
                  <FactoryIcon size={16} />
                  <div>
                    <h2 id="mesa-title">Mi mesa</h2>
                    <p>Trabajo tomado por vos</p>
                  </div>
                  <span className={s.grow} />
                  <span className={s.count}>{data.trabajoPersonal.total}</span>
                </div>
                {data.trabajoPersonal.tareas.length === 0 ? (
                  <div className={s.empty}>
                    <div>
                      <strong>Tu mesa está libre</strong>Abrí Producción para
                      tomar el próximo trabajo.
                    </div>
                  </div>
                ) : (
                  <div className={s.workList}>
                    {data.trabajoPersonal.tareas.map((tarea) => (
                      <Link
                        className={s.work}
                        href={tarea.href}
                        key={tarea.pasoId}
                      >
                        <span className={s.workTop}>
                          <strong>{tarea.ordenNumero}</strong>
                          <span>· {formatoPaso(tarea.estado)}</span>
                          {tarea.activa ? (
                            <span className={s.activeTag}>Ahora</span>
                          ) : null}
                        </span>
                        <span className={s.workName}>{tarea.pasoNombre}</span>
                        <span className={s.workSub}>
                          {tarea.itemNombre}
                          {tarea.motivoBloqueo
                            ? ` · ${tarea.motivoBloqueo}`
                            : ""}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            ) : data.taller ? (
              <section className={s.card} aria-labelledby="taller-title">
                <div className={s.cardHead}>
                  <FactoryIcon size={16} />
                  <div>
                    <h2 id="taller-title">Estado del taller</h2>
                    <p>Foto operativa actual</p>
                  </div>
                </div>
                <div className={s.workshop}>
                  <div className={s.workshopGrid}>
                    <div className={s.workshopMetric}>
                      <strong>{data.taller.itemsActivos}</strong>
                      <span>ítems activos</span>
                    </div>
                    <div className={s.workshopMetric}>
                      <strong>{data.taller.pasosEnCurso}</strong>
                      <span>pasos en curso</span>
                    </div>
                    <div className={s.workshopMetric}>
                      <strong>{data.taller.pasosBloqueados}</strong>
                      <span>bloqueados</span>
                    </div>
                  </div>
                  {data.taller.cuelloBotella ? (
                    <div className={s.bottleneck}>
                      <TriangleAlertIcon size={16} />
                      <div>
                        <strong>
                          Mayor carga: {data.taller.cuelloBotella.estacion}
                        </strong>
                        <span>
                          {data.taller.cuelloBotella.pasos} pasos ·{" "}
                          {data.taller.cuelloBotella.colaMin} min en cola ·{" "}
                          {Math.round(data.taller.cuelloBotella.utilizacionPct)}
                          % de utilización
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={s.empty}
                      style={{ minHeight: 95, padding: 16 }}
                    >
                      La planificación todavía no generó una foto de carga para
                      hoy.
                    </div>
                  )}
                </div>
              </section>
            ) : data.administracion ? (
              <section
                className={s.card}
                aria-labelledby="administracion-title"
              >
                <div className={s.cardHead}>
                  <ReceiptTextIcon size={16} />
                  <div>
                    <h2 id="administracion-title">
                      Pendientes administrativos
                    </h2>
                    <p>Acciones abiertas ahora</p>
                  </div>
                </div>
                <div className={s.workshop}>
                  <div className={s.workshopGrid}>
                    <div className={s.workshopMetric}>
                      <strong>{data.administracion.cobrosVencidos}</strong>
                      <span>cobros vencidos</span>
                    </div>
                    <div className={s.workshopMetric}>
                      <strong>{data.administracion.porFacturar}</strong>
                      <span>por facturar</span>
                    </div>
                    <div className={s.workshopMetric}>
                      <strong>{data.administracion.pagosVencidos}</strong>
                      <span>pagos vencidos</span>
                    </div>
                  </div>
                  <Link
                    className={s.bottleneck}
                    href="/administracion/tesoreria/acreditaciones"
                  >
                    <WalletCardsIcon size={16} />
                    <div>
                      <strong>
                        {data.administracion.acreditacionesPendientes} cobros
                        por acreditar
                      </strong>
                      <span>
                        Revisar fecha estimada y estado de acreditación
                      </span>
                    </div>
                  </Link>
                </div>
              </section>
            ) : null}
          </div>

          <section className={s.card} aria-labelledby="entregas-title">
            <div className={s.cardHead}>
              <WalletCardsIcon size={16} />
              <div>
                <h2 id="entregas-title">Próximas entregas</h2>
                <p>Atrasadas primero · próximos siete días</p>
              </div>
              <span className={s.grow} />
              <span className={s.count}>{data.proximasEntregasTotal}</span>
            </div>
            {data.proximasEntregas.length === 0 ? (
              <div className={s.empty} style={{ minHeight: 130 }}>
                <div>
                  <strong>Sin entregas próximas</strong>No hay órdenes
                  comprometidas para los próximos siete días.
                </div>
              </div>
            ) : (
              <div className={s.tableWrap}>
                <table className={s.deliveries}>
                  <thead>
                    <tr>
                      <th>Orden</th>
                      <th>Trabajo</th>
                      <th>Etapa actual</th>
                      <th>Entrega</th>
                      <th>Avance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.proximasEntregas.map((entrega) => (
                      <tr
                        key={entrega.id}
                        tabIndex={0}
                        onClick={() => router.push(entrega.href)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            router.push(entrega.href);
                        }}
                      >
                        <td>
                          <span className={s.order}>{entrega.numero}</span>
                          <div className={s.secondary}>{entrega.cliente}</div>
                        </td>
                        <td>
                          <span className={s.product}>{entrega.producto}</span>
                        </td>
                        <td>
                          {entrega.pasoActual ?? "Lista para retirar"}
                          <div className={s.secondary}>
                            {entrega.estacionActual ?? "—"}
                          </div>
                        </td>
                        <td>
                          <span className={s.risk} data-risk={entrega.riesgo}>
                            {entrega.riesgo === "atrasada"
                              ? "Atrasada"
                              : entrega.riesgo === "hoy"
                                ? "Hoy"
                                : fechaHumana(entrega.fechaEntrega)}
                          </span>
                        </td>
                        <td>
                          <div className={s.progress}>
                            <div className={s.track}>
                              <div
                                className={s.fill}
                                style={{ width: `${entrega.progresoPct}%` }}
                              />
                            </div>
                            <span>{entrega.progresoPct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
