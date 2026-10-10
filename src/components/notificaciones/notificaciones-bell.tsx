"use client";

import * as React from "react";
import { Bell, CheckCheck, Wifi, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useNotificaciones } from "./notificaciones-provider";
import { NotificacionItem } from "./notificacion-item";
import { cn } from "@/lib/utils";
import styles from "./notificaciones.module.css";

export function NotificacionesBell({
  triggerClassName,
}: { triggerClassName?: string } = {}) {
  const router = useRouter();
  const [abierto, setAbierto] = React.useState(false);
  const [pendiente, setPendiente] = React.useState<string | null>(null);
  const guardando = React.useRef(false);
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

  const marcar = async (id: string, href?: string | null) => {
    if (guardando.current) return;
    guardando.current = true;
    setPendiente(id);
    try {
      if (id === "todas") await leerTodas();
      else await leer(id);
      if (href) {
        setAbierto(false);
        router.push(href);
      }
    } catch {
      toast.error("No se pudo confirmar la lectura. Intentá nuevamente.");
    } finally {
      guardando.current = false;
      setPendiente(null);
    }
  };

  return (
    <div className={styles.root} ref={ref}>
      <button
        type="button"
        className={cn(styles.trigger, triggerClassName)}
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
                disabled={pendiente !== null}
                onClick={() => void marcar("todas")}
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
                <NotificacionItem
                  key={item.id}
                  item={item}
                  pendiente={pendiente === item.id || pendiente === "todas"}
                  deshabilitado={pendiente !== null}
                  onLeer={() => void marcar(item.id)}
                  onAbrir={() => void marcar(item.id, item.evento.href)}
                />
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
