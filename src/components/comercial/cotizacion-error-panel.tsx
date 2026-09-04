"use client";

import Link from "next/link";
import { ArrowRightIcon, CircleAlertIcon } from "lucide-react";
import type { AccionErrorCotizacion } from "@/lib/productos-servicios-api";
import type { ErrorCotizacionPresentado } from "@/lib/cotizacion-errores";
import styles from "./cotizacion-error-panel.module.css";

export function CotizacionErrorPanel({
  error,
  adicionales,
  onAccion,
}: {
  error: ErrorCotizacionPresentado;
  adicionales: Array<{ codigo: string; mensaje: string }>;
  onAccion: (
    accion: AccionErrorCotizacion,
    activador: HTMLButtonElement,
  ) => void;
}) {
  const contenidoAccion = (
    <>
      {error.accion.etiqueta}
      <ArrowRightIcon aria-hidden="true" />
    </>
  );

  return (
    <div className={styles.panel} role="alert">
      <div className={styles.mark} aria-hidden="true">
        <CircleAlertIcon />
      </div>
      <div className={styles.content}>
        <span className={styles.eyebrow}>Cotización · requiere atención</span>
        <strong className={styles.title}>{error.titulo}</strong>
        <p className={styles.message}>{error.mensaje}</p>
        <p className={styles.suggestion}>{error.sugerencia}</p>

        <div className={styles.actions}>
          {error.accion.href ? (
            <Link
              className={styles.action}
              href={error.accion.href}
              target="_blank"
              rel="noreferrer"
            >
              {contenidoAccion}
            </Link>
          ) : (
            <button
              type="button"
              className={styles.action}
              onClick={(event) => onAccion(error.accion, event.currentTarget)}
            >
              {contenidoAccion}
            </button>
          )}
          {error.referencia ? (
            <span className={styles.reference}>
              Ref. {error.referencia.slice(0, 8).toUpperCase()}
            </span>
          ) : null}
        </div>

        {adicionales.length > 0 ? (
          <details className={styles.more}>
            <summary>
              Ver {adicionales.length} problema
              {adicionales.length === 1 ? " adicional" : "s adicionales"}
            </summary>
            <ul>
              {adicionales.map((item, index) => (
                <li key={`${item.codigo}-${index}`}>{item.mensaje}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}
