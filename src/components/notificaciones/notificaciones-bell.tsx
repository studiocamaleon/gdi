"use client";

import * as React from "react";
import { Bell, CheckCheck, Wifi, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useNotificaciones } from "./notificaciones-provider";
import styles from "./notificaciones.module.css";

const fecha = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function NotificacionesBell() {
  const router = useRouter();
  const [abierto, setAbierto] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const { notificaciones, noLeidas, estado, cargando, leer, leerTodas } =
    useNotificaciones();

  React.useEffect(() => {
    if (!abierto) return;
    const cerrar = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setAbierto(false);
    };
    const tecla = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  const abrir = async (id: string, href: string | null) => {
    await leer(id);
    if (href) {
      setAbierto(false);
      router.push(href);
    }
  };

  return (
    <div className={styles.root} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={`Notificaciones${noLeidas ? `, ${noLeidas} sin leer` : ""}`}
        aria-expanded={abierto}
        onClick={() => setAbierto((valor) => !valor)}
      >
        <Bell size={17} strokeWidth={1.8} />
        {noLeidas > 0 ? (
          <span className={styles.badge}>
            {noLeidas > 99 ? "99+" : noLeidas}
          </span>
        ) : null}
      </button>

      {abierto ? (
        <section className={styles.panel} aria-label="Centro de notificaciones">
          <header className={styles.header}>
            <div>
              <span className={styles.eyebrow}>ACTIVIDAD</span>
              <h2>Notificaciones</h2>
            </div>
            {noLeidas ? (
              <button
                type="button"
                className={styles.readAll}
                onClick={() => void leerTodas()}
              >
                <CheckCheck size={15} /> Marcar todas
              </button>
            ) : null}
          </header>
          <div className={styles.connection} data-state={estado}>
            {estado === "respaldo" ? <WifiOff size={13} /> : <Wifi size={13} />}
            {estado === "en_vivo"
              ? "Actualización en vivo"
              : estado === "respaldo"
                ? "Modo respaldo · revisando cada 15 s"
                : "Conectando…"}
          </div>
          <div className={styles.list}>
            {cargando ? (
              <div className={styles.empty}>Cargando actividad…</div>
            ) : notificaciones.length === 0 ? (
              <div className={styles.empty}>
                <Bell size={22} />
                <strong>Todo al día</strong>
                <span>Las novedades relevantes aparecerán acá.</span>
              </div>
            ) : (
              notificaciones.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={styles.item}
                  data-unread={!item.leidaEl}
                  data-severity={item.evento.severidad}
                  onClick={() => void abrir(item.id, item.evento.href)}
                >
                  <span className={styles.dot} />
                  <span className={styles.content}>
                    <strong>{item.evento.titulo}</strong>
                    <span>{item.evento.mensaje}</span>
                    <small>
                      {item.evento.actorNombre} ·{" "}
                      {fecha.format(new Date(item.createdAt))}
                    </small>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
