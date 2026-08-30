"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  DownloadIcon,
  FileCheck2Icon,
  MessageSquareWarningIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react";
import {
  decidirAprobacionDocumentalPublica,
  type AprobacionDocumentalPublica,
} from "@/lib/desarrollo-documental-api";
import { formatBytes } from "@/lib/archivos";
import styles from "./aprobacion-documental-publica.module.css";

export function AprobacionDocumentalPublicaView({
  token,
  initial,
}: {
  token: string;
  initial: AprobacionDocumentalPublica | null;
}) {
  const [data, setData] = React.useState(initial);
  const [decision, setDecision] = React.useState<"APROBAR" | "OBSERVAR" | "RECHAZAR" | null>(null);
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!data) {
    return (
      <main className={styles.page}>
        <section className={styles.invalid}>
          <XCircleIcon />
          <h1>Este link ya no está disponible</h1>
          <p>Puede haber vencido o haber sido revocado. Pedí a la empresa un enlace nuevo.</p>
        </section>
      </main>
    );
  }

  async function resolver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision || !data) return;
    const form = new FormData(event.currentTarget);
    setWorking(true);
    setError(null);
    try {
      const result = await decidirAprobacionDocumentalPublica(token, {
        decision,
        actorNombre: String(form.get("actorNombre")),
        comentario: String(form.get("comentario") || "") || undefined,
      });
      setData({ ...data, solicitud: { ...data.solicitud, estado: result.estado } });
      setDecision(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la decisión.");
    } finally {
      setWorking(false);
    }
  }

  const pendiente = data.solicitud.estado === "PENDIENTE";
  return (
    <main className={styles.page}>
      <header className={styles.brand}>
        <div className={styles.brandMark}>{data.negocio.slice(0, 2).toUpperCase()}</div>
        <div><strong>{data.negocio}</strong><span>Portal seguro de aprobación</span></div>
        <ShieldCheckIcon />
      </header>

      <section className={styles.hero}>
        <p>{data.campana.codigo} · {data.campana.nombre}</p>
        <h1>{data.documento.nombre}</h1>
        <div className={styles.tags}>
          <span>{data.documento.etapa.toLowerCase()}</span>
          <span>{data.documento.proposito.toLowerCase()}</span>
          <span data-status={data.solicitud.estado}>{data.solicitud.estado.toLowerCase()}</span>
        </div>
      </section>

      <section className={styles.sheet}>
        <div className={styles.revisionStamp}><small>REVISIÓN A EVALUAR</small><strong>V{data.revision.numero}</strong></div>
        <div className={styles.fileInfo}>
          <FileCheck2Icon />
          <div><strong>{data.revision.nombreArchivo}</strong><span>{formatBytes(data.revision.bytes)} · SHA-256 {data.revision.hash?.slice(0, 14)}…</span></div>
          <a href={`/api/backend/desarrollo-documental/publico/${token}/archivo`} target="_blank" rel="noreferrer"><DownloadIcon /> Ver archivo</a>
        </div>
        {data.solicitud.comentario ? (
          <div className={styles.instructions}><strong>Qué necesitamos validar</strong><p>{data.solicitud.comentario}</p></div>
        ) : null}

        {pendiente ? (
          <div className={styles.actions}>
            <button className={styles.approve} onClick={() => setDecision("APROBAR")}><CheckCircle2Icon /> Aprobar revisión</button>
            <button className={styles.observe} onClick={() => setDecision("OBSERVAR")}><MessageSquareWarningIcon /> Enviar observaciones</button>
            <button className={styles.reject} onClick={() => setDecision("RECHAZAR")}><XCircleIcon /> Rechazar revisión</button>
          </div>
        ) : (
          <div className={styles.resolved} data-status={data.solicitud.estado}>
            <CheckCircle2Icon />
            <div><strong>Decisión registrada</strong><span>Estado: {data.solicitud.estado.toLowerCase()}</span></div>
          </div>
        )}
      </section>

      <footer className={styles.footer}>Este acceso muestra únicamente el documento solicitado. No expone presupuestos, costos ni otros archivos.</footer>

      {decision ? (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <form className={styles.decisionCard} onSubmit={resolver}>
            <h2>{decision === "APROBAR" ? "Confirmar aprobación" : decision === "RECHAZAR" ? "Confirmar rechazo" : "Enviar observaciones"}</h2>
            <p>Tu nombre, comentario y fecha quedarán guardados como evidencia de esta decisión.</p>
            <label><span>Nombre y apellido</span><input name="actorNombre" required maxLength={160} /></label>
            <label><span>Comentario {decision === "OBSERVAR" || decision === "RECHAZAR" ? "*" : "(opcional)"}</span><textarea name="comentario" required={decision === "OBSERVAR" || decision === "RECHAZAR"} maxLength={2000} /></label>
            {error ? <div className={styles.error}>{error}</div> : null}
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setDecision(null)}>Cancelar</button>
              <button type="submit" disabled={working} data-primary>{working ? "Registrando…" : decision === "APROBAR" ? "Sí, aprobar V" + data.revision.numero : decision === "RECHAZAR" ? "Sí, rechazar V" + data.revision.numero : "Enviar observación"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
