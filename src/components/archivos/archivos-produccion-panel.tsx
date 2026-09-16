import {
  CheckCircle2Icon,
  DownloadIcon,
  LockKeyholeIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { urlDeArchivo } from "@/lib/archivos";
import type { EstadoDocumentalOrden } from "@/lib/desarrollo-documental-api";
import styles from "./archivos-produccion-panel.module.css";

export function ArchivosProduccionPanel({
  data,
}: {
  data: EstadoDocumentalOrden | null;
}) {
  if (!data) {
    return (
      <section className={styles.unavailable} role="status">
        <ShieldAlertIcon />
        <div>
          <strong>No se pudieron consultar los controles de archivos</strong>
          <p>
            Volvé a cargar la orden para comprobar qué revisión está liberada
            para producción.
          </p>
        </div>
      </section>
    );
  }
  if (!data.gates.length) return null;
  const pendientes = data.gates.filter((gate) => !gate.cumplido).length;
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p>CONTROL PRODUCTIVO</p>
          <h2>Archivos para producción</h2>
          <span>La referencia exacta que debe usar el taller.</span>
        </div>
        <div className={styles.summary} data-blocked={pendientes > 0}>
          {pendientes ? <ShieldAlertIcon /> : <CheckCircle2Icon />}
          <strong>
            {pendientes
              ? `${pendientes} ${pendientes === 1 ? "control pendiente" : "controles pendientes"}`
              : "Controles completos"}
          </strong>
        </div>
      </header>
      <div className={styles.list}>
        {data.gates.map((gate) => (
          <article className={styles.row} key={gate.id} data-ok={gate.cumplido}>
            <span className={styles.state}>
              {gate.cumplido ? <CheckCircle2Icon /> : <LockKeyholeIcon />}
            </span>
            <div className={styles.main}>
              <div className={styles.tags}>
                <span>{gate.documento.proposito.toLowerCase()}</span>
                <span>
                  {gate.tipoAprobacion.toLowerCase().replaceAll("_", " ")}
                </span>
                {gate.paso ? (
                  <span>{gate.paso.nombre}</span>
                ) : (
                  <span>OT completa</span>
                )}
              </div>
              <h3>{gate.documento.nombre}</h3>
              <p>{gate.nombre}</p>
            </div>
            <div className={styles.revision}>
              {gate.revisionLiberada ? (
                <>
                  <small>REVISIÓN LIBERADA</small>
                  <strong>V{gate.revisionLiberada.numero}</strong>
                  <span>{gate.revisionLiberada.archivo.nombre}</span>
                  <a
                    href={urlDeArchivo(gate.revisionLiberada.archivo.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <DownloadIcon /> Abrir
                  </a>
                </>
              ) : (
                <>
                  <small>REVISIÓN LIBERADA</small>
                  <strong>—</strong>
                  <span>Producción bloqueada</span>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
