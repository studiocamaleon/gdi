"use client";

import { CheckCheck, ChevronDown, Eye, Loader2 } from "lucide-react";
import { useFecha } from "@/components/navigation/config-regional-provider";
import type { NotificacionInterna } from "@/lib/notificaciones-internas-api";
import styles from "./notificaciones.module.css";

export function NotificacionItem({
  item,
  pendiente,
  deshabilitado,
  onLeer,
  onAbrir,
}: {
  item: NotificacionInterna;
  pendiente: boolean;
  deshabilitado: boolean;
  onLeer: () => void;
  onAbrir: () => void;
}) {
  const { fechaHora, fechaNumerica, hora } = useFecha();
  // Compatible con una API anterior durante el despliegue gradual.
  const lecturas = item.lecturas ?? [];
  const nombres = lecturas
    .slice(0, 2)
    .map((lectura) => lectura.nombre)
    .join(", ");
  return (
    <article
      className={styles.item}
      data-unread={!item.leidaEl}
      data-severity={item.evento.severidad}
    >
      <span className={styles.dot} aria-hidden="true" />
      <div className={styles.itemBody}>
        <button
          type="button"
          className={styles.content}
          onClick={onAbrir}
          disabled={deshabilitado}
        >
          <strong>{item.evento.titulo}</strong>
          <span>{item.evento.mensaje}</span>
          <small>
            {item.evento.actorNombre} · {fechaHora(item.createdAt)}
          </small>
        </button>
        <div className={styles.itemActions}>
          {item.leidaEl ? (
            <span className={styles.readStatus}>
              <CheckCheck size={13} /> Leída
            </span>
          ) : (
            <button
              type="button"
              className={styles.markRead}
              disabled={deshabilitado}
              onClick={onLeer}
            >
              {pendiente ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <CheckCheck size={13} />
              )}
              {pendiente ? "Guardando…" : "Marcar leído"}
            </button>
          )}
        </div>
        {lecturas.length > 0 ? (
          <details className={styles.readers}>
            <summary>
              <Eye size={13} aria-hidden="true" />
              <span>
                Visto por {nombres}
                {lecturas.length > 2 ? ` y ${lecturas.length - 2} más` : ""}
              </span>
              <ChevronDown
                size={12}
                className={styles.readersChevron}
                aria-hidden="true"
              />
            </summary>
            <ul aria-label="Registro de lecturas">
              {lecturas.map((lectura) => (
                <li key={lectura.id}>
                  <span>{lectura.nombre}</span>
                  <time dateTime={lectura.leidaEl}>
                    {fechaNumerica(lectura.leidaEl)} · {hora(lectura.leidaEl)}
                  </time>
                </li>
              ))}
            </ul>
          </details>
        ) : item.leidaEl ? (
          <span className={styles.legacyReading}>
            Lectura anterior sin registro de autor.
          </span>
        ) : null}
      </div>
    </article>
  );
}
