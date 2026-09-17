"use client";

import * as React from "react";
import {
  ArrowDownToLineIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  Clock3Icon,
  FileTextIcon,
  HistoryIcon,
  ImageIcon,
  MapPinIcon,
  MessageCircleIcon,
  PackageIcon,
  PhoneIcon,
  QrCodeIcon,
  SparklesIcon,
  UserRoundIcon,
} from "lucide-react";
import {
  copyDePaso,
  estadoNarrativo,
  estadoPill,
  fechaLarga,
  getTrackingPublico,
  haceCuanto,
  resumenEstadoTracking,
  urlArchivoTracking,
  type TrackingArchivo,
  type TrackingItem,
  type TrackingPublico,
} from "@/lib/tracking";
import { formatBytes } from "@/lib/archivos";
import { ActionLink } from "@/components/design-system/action-link";
import {
  DocumentoPublico,
  EstadoPublico,
  SeccionPublica,
} from "@/components/publico/documento-publico";
import { cn } from "@/lib/utils";
import p from "@/components/publico/documento-publico.module.css";
import s from "./tracking-view.module.css";

const POLL_MS = 15000;

function fmtMomento(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "";
  return `${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")} · ${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
}

function ItemTimeline({ item }: { item: TrackingItem }) {
  if (!item.pasos.length)
    return (
      <p className={s.noSteps}>Estamos preparando el detalle de tu trabajo.</p>
    );
  return (
    <ol className={s.timeline} aria-label={`Avance de ${item.nombre}`}>
      {item.pasos.map((paso, i) => {
        // Pendiente no es en curso: conserva el estado real de producción.
        const state =
          paso.estado === "hecho"
            ? "done"
            : paso.estado === "en_curso" || paso.estado === "pausado"
              ? "current"
              : "pending";
        const copy = copyDePaso(paso.familiaCodigo, paso.plantillaCodigo);
        return (
          <li key={`${paso.indice}-${i}`} className={s.step} data-state={state}>
            <span className={s.stepDot} aria-hidden>
              {state === "done" ? (
                <CheckIcon />
              ) : (
                String(i + 1).padStart(2, "0")
              )}
            </span>
            <div className={s.stepBody}>
              <strong>{copy.simple}</strong>
              {state !== "pending" ? <p>{copy.desc}</p> : null}
              <span className={s.stepState}>
                {state === "done" ? (
                  <>
                    <CheckIcon aria-hidden />
                    Completado
                    {paso.completadoEl ? (
                      <>
                        {" "}
                        ·{" "}
                        <time dateTime={paso.completadoEl}>
                          {fmtMomento(paso.completadoEl)}
                        </time>
                      </>
                    ) : null}
                  </>
                ) : state === "current" ? (
                  "En curso"
                ) : (
                  "Pendiente"
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ArchivosCliente({
  archivos,
  token,
}: {
  archivos: TrackingArchivo[];
  token: string;
}) {
  if (!archivos.length) return null;
  return (
    <ul className={s.files} aria-label="Archivos compartidos">
      {archivos.map((archivo) => (
        <li key={archivo.id}>
          <a
            href={urlArchivoTracking(token, archivo.id)}
            target="_blank"
            rel="noreferrer"
            className={s.file}
          >
            {archivo.esImagen ? (
              <ImageIcon aria-hidden />
            ) : (
              <FileTextIcon aria-hidden />
            )}
            <span>
              <strong>{archivo.nombre}</strong>
              <small>{formatBytes(archivo.bytes)}</small>
            </span>
            <ArrowDownToLineIcon aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}

function ItemPanel({
  item,
  index,
  open,
  onToggle,
  token,
}: {
  item: TrackingItem;
  index: number;
  open: boolean;
  onToggle: () => void;
  token: string;
}) {
  const id = React.useId();
  const [verSpecs, setVerSpecs] = React.useState(false);
  const listo = item.progresoPct === 100;
  const actual = item.pasos.find((paso) => paso.estado !== "hecho");
  return (
    <article className={s.item}>
      <h3 className={s.itemHeading}>
        <button
          type="button"
          id={`${id}-titulo`}
          className={s.itemTrigger}
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-contenido`}
        >
          <span className={s.itemIndex}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className={s.itemIdentity}>
            <strong>{item.nombre}</strong>
            <span>
              {listo
                ? "Completado"
                : item.pasoActual && actual
                  ? copyDePaso(actual.familiaCodigo, actual.plantillaCodigo)
                      .simple
                  : "Por iniciar"}
            </span>
          </span>
          {listo ? (
            <CircleCheckIcon className={s.readyIcon} aria-hidden />
          ) : null}
          <ChevronDownIcon aria-hidden className={s.chevron} data-open={open} />
        </button>
      </h3>
      <div
        id={`${id}-contenido`}
        hidden={!open}
        aria-labelledby={`${id}-titulo`}
        className={s.itemBody}
      >
        <ItemTimeline item={item} />
        {item.specs.length ? (
          <div className={s.detail}>
            <button
              type="button"
              className={s.detailTrigger}
              onClick={() => setVerSpecs((value) => !value)}
              aria-expanded={verSpecs}
              aria-controls={`${id}-specs`}
            >
              <span>Detalle del producto</span>
              <ChevronDownIcon
                aria-hidden
                className={s.chevron}
                data-open={verSpecs}
              />
            </button>
            <div id={`${id}-specs`} hidden={!verSpecs}>
              <dl className={p.specs}>
                {item.specs.map((spec, i) => (
                  <div key={i}>
                    <dt>{spec.etiqueta}</dt>
                    <dd>{spec.valor}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ) : null}
        <ArchivosCliente archivos={item.archivos} token={token} />
      </div>
    </article>
  );
}

function ContactoAcciones({
  telefono,
  whatsapp,
}: {
  telefono: string | null;
  whatsapp: string | null;
}) {
  return (
    <div className={s.contactActions}>
      {whatsapp ? (
        <ActionLink
          size="md"
          variant="outline"
          href={`https://wa.me/${whatsapp}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircleIcon aria-hidden />
          WhatsApp
        </ActionLink>
      ) : null}
      {telefono ? (
        <ActionLink size="md" variant="outline" href={`tel:${telefono}`}>
          <PhoneIcon aria-hidden />
          Llamar
        </ActionLink>
      ) : null}
    </div>
  );
}

export function TrackingView({
  token,
  initialData,
}: {
  token: string;
  initialData: TrackingPublico;
}) {
  const [data, setData] = React.useState(initialData);
  const [sincronizando, setSincronizando] = React.useState(false);
  const [conectado, setConectado] = React.useState(true);
  React.useEffect(() => {
    let vivo = true;
    let pendiente = false;
    const refrescar = async () => {
      if (document.hidden || pendiente) return;
      pendiente = true;
      setSincronizando(true);
      try {
        const fresh = await getTrackingPublico(token);
        if (vivo) {
          setData(fresh);
          setConectado(true);
        }
      } catch {
        // Un error no borra los últimos datos ni anuncia una conexión inexistente.
        if (vivo) setConectado(false);
      } finally {
        pendiente = false;
        if (vivo) setSincronizando(false);
      }
    };
    const interval = window.setInterval(refrescar, POLL_MS);
    const onFocus = () => {
      if (!document.hidden) void refrescar();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      vivo = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [token]);

  const [abierto, setAbierto] = React.useState<string | null>(
    () =>
      (
        initialData.items.find(
          (item) =>
            item.progresoPct != null &&
            item.progresoPct > 0 &&
            item.progresoPct < 100,
        ) ?? initialData.items[0]
      )?.id ?? null,
  );
  const pill = estadoPill(data.estado);
  const entrega = fechaLarga(data.fechaEntrega);
  const ultimaAct = data.actividad[0]?.fecha;
  const contacto = data.imprenta.contacto;
  const urlMapa = contacto?.domicilio
    ? (contacto.urlPerfilGoogle ??
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contacto.domicilio)}`)
    : null;
  const hayContacto = Boolean(
    contacto?.domicilio ||
    contacto?.horario ||
    contacto?.telefono ||
    contacto?.whatsapp,
  );

  return (
    <DocumentoPublico
      negocio={data.imprenta.nombre}
      descripcion="Seguimiento de tu pedido"
      logo={
        data.imprenta.tieneLogo
          ? `/api/backend/ordenes-trabajo/track/${encodeURIComponent(token)}/logo`
          : undefined
      }
    >
      <section className={p.hero} aria-labelledby="seguimiento-titulo">
        <div className={p.heroTop}>
          <span className={p.eyebrow}>Hola, {data.cliente.nombre}</span>
          <EstadoPublico
            tone={
              pill.tone === "ok"
                ? "success"
                : pill.tone === "warm"
                  ? "accent"
                  : "default"
            }
          >
            {pill.label}
          </EstadoPublico>
        </div>
        <h1 id="seguimiento-titulo" className={cn(p.heroTitle, s.heroTitle)}>
          Tu pedido está <strong>{estadoNarrativo(data.estado)}.</strong>
        </h1>
        <p className={p.heroDescription}>
          {resumenEstadoTracking(data.estado)}
        </p>
        <dl className={p.heroMeta}>
          <div>
            <dt>Orden de trabajo</dt>
            <dd>
              <code>{data.numero}</code>
            </dd>
          </div>
          <div>
            <dt>Recibida</dt>
            <dd>{fechaLarga(data.creadaEl)?.dia ?? "Sin fecha"}</dd>
          </div>
          <div>
            <dt>Tu pedido</dt>
            <dd>
              {data.items.length}{" "}
              {data.items.length === 1 ? "producto" : "productos"}
            </dd>
          </div>
        </dl>
      </section>
      <div className={s.liveStrip}>
        <span className={s.liveStatus} data-connected={conectado} role="status">
          <span aria-hidden />
          {sincronizando
            ? "Actualizando seguimiento…"
            : conectado
              ? "En vivo desde planta"
              : "Reintentando conexión"}
        </span>
        <span>
          {ultimaAct
            ? `Última novedad ${haceCuanto(ultimaAct)}`
            : "Sin novedades todavía"}
        </span>
      </div>

      {data.estado === "finalizada" ? (
        <SeccionPublica titulo="¡Listo para retirar!" icon={QrCodeIcon}>
          <div className={s.pickup}>
            <div className={s.qr}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/backend/ordenes-trabajo/track/${encodeURIComponent(token)}/qr-retiro.png`}
                alt={`QR de retiro de la orden ${data.numero}`}
              />
            </div>
            <div>
              <h3>Tu pedido te está esperando.</h3>
              <p>Mostrá este QR en el mostrador para retirar tu trabajo.</p>
              <code>{data.numero}</code>
            </div>
          </div>
        </SeccionPublica>
      ) : null}

      <div className={p.columns}>
        <div className={p.stack}>
          <SeccionPublica
            titulo="Seguimiento por producto"
            icon={PackageIcon}
            detalle={String(data.items.length).padStart(2, "0")}
          >
            {data.items.length ? (
              data.items.map((item, i) => (
                <ItemPanel
                  key={item.id}
                  item={item}
                  index={i}
                  open={abierto === item.id}
                  onToggle={() =>
                    setAbierto((prev) => (prev === item.id ? null : item.id))
                  }
                  token={token}
                />
              ))
            ) : (
              <p className={s.noSteps}>
                Pronto vas a ver el detalle de tu pedido acá.
              </p>
            )}
          </SeccionPublica>
          {data.archivos.length ? (
            <SeccionPublica
              titulo="Archivos compartidos"
              icon={FileTextIcon}
              detalle={String(data.archivos.length).padStart(2, "0")}
            >
              <ArchivosCliente archivos={data.archivos} token={token} />
            </SeccionPublica>
          ) : null}
          {data.actividad.length ? (
            <SeccionPublica titulo="Últimas novedades" icon={HistoryIcon}>
              <ol className={s.activity}>
                {data.actividad.map((actividad, i) => (
                  <li key={`${actividad.fecha}-${i}`}>
                    <span className={s.activityDot} aria-hidden />
                    <p>{actividad.texto}</p>
                    <time
                      dateTime={actividad.fecha}
                      title={fmtMomento(actividad.fecha)}
                    >
                      {haceCuanto(actividad.fecha)}
                    </time>
                  </li>
                ))}
              </ol>
            </SeccionPublica>
          ) : null}
        </div>
        <aside className={p.stack} aria-label="Entrega y contacto">
          <SeccionPublica titulo="Entrega estimada" icon={CalendarDaysIcon}>
            <div className={s.delivery}>
              <div className={s.calendar} aria-hidden>
                <span>{entrega?.mes ?? "—"}</span>
                <strong>{entrega?.num ?? "—"}</strong>
              </div>
              <div>
                <strong>{entrega?.dia ?? "A confirmar"}</strong>
                <p>
                  {entrega
                    ? "Fecha prevista para tu pedido."
                    : "Te avisaremos cuando tengamos una fecha."}
                </p>
              </div>
            </div>
          </SeccionPublica>
          {data.vendedor ? (
            <SeccionPublica titulo="Tu asesor comercial" icon={UserRoundIcon}>
              <div className={s.advisor}>
                <span className={s.avatar}>{data.vendedor.iniciales}</span>
                <div>
                  <strong>{data.vendedor.nombre}</strong>
                  <p>Estamos para ayudarte.</p>
                </div>
              </div>
              {contacto && (contacto.telefono || contacto.whatsapp) ? (
                <ContactoAcciones
                  telefono={contacto.telefono}
                  whatsapp={contacto.whatsapp}
                />
              ) : null}
            </SeccionPublica>
          ) : null}
          {hayContacto && contacto ? (
            <SeccionPublica titulo="Dónde encontrarnos" icon={MapPinIcon}>
              <div className={s.shop}>
                {contacto.domicilio && urlMapa ? (
                  <a href={urlMapa} target="_blank" rel="noreferrer">
                    <MapPinIcon aria-hidden />
                    <span>
                      {contacto.domicilio}
                      <small>
                        Ver mapa <ArrowUpRightIcon aria-hidden />
                      </small>
                    </span>
                  </a>
                ) : null}
                {contacto.horario ? (
                  <div>
                    <Clock3Icon aria-hidden />
                    <span>{contacto.horario}</span>
                  </div>
                ) : null}
              </div>
              {!data.vendedor && (contacto.telefono || contacto.whatsapp) ? (
                <ContactoAcciones
                  telefono={contacto.telefono}
                  whatsapp={contacto.whatsapp}
                />
              ) : null}
            </SeccionPublica>
          ) : null}
          {data.fidelizacion.puntos > 0 ? (
            <SeccionPublica titulo="Puntos de este pedido" icon={SparklesIcon}>
              <div className={s.points}>
                <strong>
                  {data.fidelizacion.tipo === "CANJE" ? "−" : "+"}
                  {data.fidelizacion.puntos} puntos
                </strong>
                <span>{data.fidelizacion.estado.toLocaleLowerCase()}</span>
              </div>
            </SeccionPublica>
          ) : null}
        </aside>
      </div>
    </DocumentoPublico>
  );
}
