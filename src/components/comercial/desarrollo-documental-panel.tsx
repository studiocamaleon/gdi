"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  ClipboardCheckIcon,
  CopyIcon,
  DownloadIcon,
  FileClockIcon,
  FilePlus2Icon,
  FlagIcon,
  LinkIcon,
  Link2OffIcon,
  LockKeyholeIcon,
  MessageSquareWarningIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Archivo } from "@/lib/archivos";
import { formatBytes, urlDeArchivo } from "@/lib/archivos";
import {
  crearArchivoMaestro,
  crearGateDocumento,
  crearRevisionArchivo,
  decidirAprobacionDocumento,
  emitirLinkAprobacion,
  liberarRevision,
  revocarLinkAprobacion,
  solicitarAprobacionDocumento,
  type ArchivoMaestro,
  type DecisionAprobacionDocumento,
  type DesarrolloDocumental,
  type EtapaDesarrolloDocumento,
  type PropositoArchivoMaestro,
  type TipoAprobacionDocumento,
} from "@/lib/desarrollo-documental-api";
import styles from "./campanas.module.css";

const ETAPAS: Array<[EtapaDesarrolloDocumento, string]> = [
  ["BRIEF", "Brief"],
  ["DISENO", "Diseño"],
  ["PROTOTIPO", "Prototipo"],
  ["MUESTRA", "Muestra"],
  ["PRODUCCION", "Producción"],
];
const PROPOSITOS: Array<[PropositoArchivoMaestro, string]> = [
  ["PRINT", "Impresión"],
  ["CUT", "Corte"],
  ["RENDER", "Render"],
  ["PLANO", "Plano"],
  ["INSTRUCTIVO", "Instructivo"],
  ["OTRO", "Otro"],
];
const TIPOS: Array<[TipoAprobacionDocumento, string]> = [
  ["CLIENTE", "Cliente"],
  ["DISENO", "Diseño"],
  ["COLOR_MUESTRA", "Color / muestra"],
  ["INGENIERIA", "Ingeniería"],
  ["LIBERACION_PRODUCTIVA", "Liberación productiva"],
];

type Orden = { id: string; numero: string; estado: string };

export function DesarrolloDocumentalPanel({
  campanaId,
  initial,
  archivos,
  ordenes,
  canManage,
}: {
  campanaId: string;
  initial: DesarrolloDocumental;
  archivos: Archivo[];
  ordenes: Orden[];
  canManage: boolean;
}) {
  const [data, setData] = React.useState(initial);
  const [maestroOpen, setMaestroOpen] = React.useState(false);
  const [revisionDe, setRevisionDe] = React.useState<ArchivoMaestro | null>(
    null,
  );
  const [solicitudDe, setSolicitudDe] = React.useState<
    ArchivoMaestro["revisiones"][number] | null
  >(null);
  const [decisionDe, setDecisionDe] = React.useState<{
    solicitudId: string;
    revision: string;
    decision: DecisionAprobacionDocumento;
  } | null>(null);
  const [gateOpen, setGateOpen] = React.useState(false);
  const [working, setWorking] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (
      !working &&
      !maestroOpen &&
      !revisionDe &&
      !solicitudDe &&
      !decisionDe &&
      !gateOpen
    ) {
      setData(initial);
    }
  }, [
    initial,
    working,
    maestroOpen,
    revisionDe,
    solicitudDe,
    decisionDe,
    gateOpen,
  ]);

  const actualizar = (next: DesarrolloDocumental) => setData(next);

  async function ejecutar(
    key: string,
    action: () => Promise<DesarrolloDocumental>,
    ok: string,
  ) {
    setWorking(key);
    try {
      actualizar(await action());
      toast.success(ok);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo completar la acción.",
      );
      return false;
    } finally {
      setWorking(null);
    }
  }

  async function guardarMaestro(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await ejecutar(
      "maestro",
      () =>
        crearArchivoMaestro({
          proyectoCampanaId: campanaId,
          nombre: String(form.get("nombre")),
          proposito: String(form.get("proposito")) as PropositoArchivoMaestro,
          etapa: String(form.get("etapa")) as EtapaDesarrolloDocumento,
          descripcion: String(form.get("descripcion") || "") || undefined,
        }),
      "Documento controlado creado.",
    );
    if (ok) setMaestroOpen(false);
  }

  async function guardarRevision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!revisionDe) return;
    const form = new FormData(event.currentTarget);
    const ok = await ejecutar(
      `revision-${revisionDe.id}`,
      () =>
        crearRevisionArchivo(revisionDe.id, {
          archivoId: String(form.get("archivoId")),
          comentario: String(form.get("comentario") || "") || undefined,
        }),
      "Nueva revisión registrada.",
    );
    if (ok) setRevisionDe(null);
  }

  async function guardarSolicitud(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!solicitudDe) return;
    const form = new FormData(event.currentTarget);
    const externa = form.get("externa") === "on";
    const ok = await ejecutar(
      `solicitud-${solicitudDe.id}`,
      () =>
        solicitarAprobacionDocumento(solicitudDe.id, {
          tipo: String(form.get("tipo")) as TipoAprobacionDocumento,
          comentario: String(form.get("comentario") || "") || undefined,
          asignadaARol: externa
            ? undefined
            : String(form.get("rol") || "SUPERVISOR"),
          permiteDecisionExterna: externa,
        }),
      "Solicitud de aprobación creada.",
    );
    if (ok) setSolicitudDe(null);
  }

  async function guardarDecision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decisionDe) return;
    const form = new FormData(event.currentTarget);
    const ok = await ejecutar(
      `decision-${decisionDe.solicitudId}`,
      () =>
        decidirAprobacionDocumento(decisionDe.solicitudId, {
          decision: decisionDe.decision,
          comentario: String(form.get("comentario") || "") || undefined,
        }),
      decisionDe.decision === "APROBAR"
        ? "Revisión aprobada."
        : "Observación registrada.",
    );
    if (ok) setDecisionDe(null);
  }

  async function compartir(solicitudId: string) {
    setWorking(`link-${solicitudId}`);
    try {
      const link = await emitirLinkAprobacion(solicitudId);
      await navigator.clipboard.writeText(link.url);
      toast.success("Link seguro copiado. Vence en 14 días.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo emitir el link.",
      );
    } finally {
      setWorking(null);
    }
  }

  async function guardarGate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const maestroId = String(form.get("archivoMaestroId"));
    const maestro = data.maestros.find((item) => item.id === maestroId);
    const tipo = String(form.get("tipo")) as TipoAprobacionDocumento;
    const ok = await ejecutar(
      "gate",
      () =>
        crearGateDocumento({
          proyectoCampanaId: campanaId,
          ordenId: String(form.get("ordenId")),
          archivoMaestroId: maestroId,
          tipoAprobacion: tipo,
          nombre: `${maestro?.nombre ?? "Documento"} · ${labelTipo(tipo)}`,
        }),
      "Gate productivo configurado.",
    );
    if (ok) setGateOpen(false);
  }

  const revisiones = data.maestros.reduce(
    (sum, item) => sum + item.revisiones.length,
    0,
  );
  const pendientes = data.maestros.reduce(
    (sum, item) =>
      sum +
      item.revisiones
        .flatMap((r) => r.solicitudes)
        .filter((s) => s.estado === "PENDIENTE").length,
    0,
  );
  const liberados = data.maestros.filter(
    (item) => item.revisionLiberada,
  ).length;

  return (
    <section className={styles.developmentPanel}>
      <div className={styles.developmentHeader}>
        <div>
          <p className={styles.technicalEyebrow}>CONTROL DOCUMENTAL · FASE 2</p>
          <h2>Desarrollo y aprobaciones</h2>
          <p>
            La producción usa la revisión liberada, nunca el último adjunto.
          </p>
        </div>
        {canManage ? (
          <div className={styles.developmentActions}>
            {ordenes.length && data.maestros.length ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGateOpen(true)}
              >
                <LockKeyholeIcon data-icon="inline-start" /> Configurar gate
              </Button>
            ) : null}
            <Button
              className={styles.primaryButton}
              size="sm"
              onClick={() => setMaestroOpen(true)}
            >
              <PlusIcon data-icon="inline-start" /> Nuevo documento
            </Button>
          </div>
        ) : null}
      </div>

      <div className={styles.developmentStats}>
        <div>
          <span>Documentos</span>
          <strong>{data.maestros.length}</strong>
        </div>
        <div>
          <span>Revisiones</span>
          <strong>{revisiones}</strong>
        </div>
        <div data-alert={pendientes > 0}>
          <span>Pendientes</span>
          <strong>{pendientes}</strong>
        </div>
        <div data-ok={liberados > 0}>
          <span>Liberados</span>
          <strong>{liberados}</strong>
        </div>
      </div>

      {data.maestros.length ? (
        <div className={styles.masterList}>
          {data.maestros.map((maestro) => (
            <article className={styles.masterCard} key={maestro.id}>
              <header className={styles.masterHeader}>
                <div className={styles.masterIdentity}>
                  <span className={styles.masterIcon}>
                    <FileClockIcon />
                  </span>
                  <div>
                    <div className={styles.masterTags}>
                      <span>{labelEtapa(maestro.etapa)}</span>
                      <span>{labelProposito(maestro.proposito)}</span>
                      {maestro.requerido ? (
                        <span data-required>Requerido</span>
                      ) : null}
                    </div>
                    <h3>{maestro.nombre}</h3>
                    {maestro.descripcion ? <p>{maestro.descripcion}</p> : null}
                  </div>
                </div>
                <div
                  className={styles.releaseBox}
                  data-released={Boolean(maestro.revisionLiberada)}
                >
                  {maestro.revisionLiberada ? (
                    <>
                      <ShieldCheckIcon />
                      <span>Liberada</span>
                      <strong>V{maestro.revisionLiberada.numero}</strong>
                    </>
                  ) : (
                    <>
                      <LockKeyholeIcon />
                      <span>Sin liberar</span>
                      <strong>—</strong>
                    </>
                  )}
                </div>
              </header>

              <div className={styles.revisionList}>
                {maestro.revisiones.length ? (
                  maestro.revisiones.map((revision) => {
                    const pendiente = revision.solicitudes.find(
                      (s) => s.estado === "PENDIENTE",
                    );
                    return (
                      <div
                        className={styles.revisionRow}
                        key={revision.id}
                        data-status={revision.estado}
                      >
                        <div className={styles.revisionNumber}>
                          V{revision.numero}
                        </div>
                        <div className={styles.revisionMain}>
                          <div className={styles.revisionTop}>
                            <a
                              href={urlDeArchivo(revision.archivo.id)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {revision.archivo.nombre} <DownloadIcon />
                            </a>
                            <span
                              className={styles.documentStatus}
                              data-status={revision.estado}
                            >
                              {labelEstado(revision.estado)}
                            </span>
                          </div>
                          <div className={styles.revisionMeta}>
                            {formatBytes(revision.archivo.bytes)} ·{" "}
                            {revision.autorNombre} · SHA-256{" "}
                            {revision.hash?.slice(0, 10)}…
                          </div>
                          {revision.comentario ? (
                            <p className={styles.revisionComment}>
                              {revision.comentario}
                            </p>
                          ) : null}
                          {revision.solicitudes.map((solicitud) => (
                            <div
                              className={styles.approvalStrip}
                              key={solicitud.id}
                              data-status={solicitud.estado}
                            >
                              <ClipboardCheckIcon />
                              <div>
                                <strong>
                                  {labelTipo(solicitud.tipo)} ·{" "}
                                  {labelEstado(solicitud.estado)}
                                </strong>
                                <span>
                                  {solicitud.comentario ||
                                    "Sin indicaciones adicionales"}
                                </span>
                              </div>
                              {solicitud.estado === "PENDIENTE" && canManage ? (
                                <div className={styles.inlineActions}>
                                  {solicitud.permiteDecisionExterna ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        loading={
                                          working === `link-${solicitud.id}`
                                        }
                                        onClick={() =>
                                          void compartir(solicitud.id)
                                        }
                                      >
                                        <CopyIcon data-icon="inline-start" />{" "}
                                        Link
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        loading={
                                          working === `revocar-${solicitud.id}`
                                        }
                                        onClick={() =>
                                          void ejecutar(
                                            `revocar-${solicitud.id}`,
                                            () =>
                                              revocarLinkAprobacion(
                                                solicitud.id,
                                              ),
                                            "Link externo revocado.",
                                          )
                                        }
                                      >
                                        <Link2OffIcon data-icon="inline-start" />{" "}
                                        Revocar
                                      </Button>
                                    </>
                                  ) : null}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setDecisionDe({
                                        solicitudId: solicitud.id,
                                        revision: `V${revision.numero}`,
                                        decision: "OBSERVAR",
                                      })
                                    }
                                  >
                                    Observar
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setDecisionDe({
                                        solicitudId: solicitud.id,
                                        revision: `V${revision.numero}`,
                                        decision: "RECHAZAR",
                                      })
                                    }
                                  >
                                    Rechazar
                                  </Button>
                                  <Button
                                    size="sm"
                                    className={styles.approveButton}
                                    onClick={() =>
                                      setDecisionDe({
                                        solicitudId: solicitud.id,
                                        revision: `V${revision.numero}`,
                                        decision: "APROBAR",
                                      })
                                    }
                                  >
                                    Aprobar
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        {canManage ? (
                          <div className={styles.revisionActions}>
                            {!pendiente &&
                            revision.estado !== "OBSOLETA" &&
                            revision.estado !== "APROBADA" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSolicitudDe(revision)}
                              >
                                <ClipboardCheckIcon data-icon="inline-start" />{" "}
                                Solicitar
                              </Button>
                            ) : null}
                            {revision.estado === "APROBADA" &&
                            maestro.revisionLiberada?.id !== revision.id ? (
                              <Button
                                size="sm"
                                className={styles.releaseButton}
                                loading={working === `liberar-${revision.id}`}
                                onClick={() =>
                                  void ejecutar(
                                    `liberar-${revision.id}`,
                                    () => liberarRevision(revision.id),
                                    `V${revision.numero} liberada a producción.`,
                                  )
                                }
                              >
                                <FlagIcon data-icon="inline-start" /> Liberar
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.noRevisions}>
                    Sin revisiones. Vinculá el primer archivo para iniciar el
                    circuito.
                  </div>
                )}
              </div>

              <footer className={styles.masterFooter}>
                <div className={styles.gateSummary}>
                  <LockKeyholeIcon />
                  {maestro.gates.length
                    ? maestro.gates
                        .map(
                          (g) =>
                            `${g.orden.numero}${g.paso ? ` / ${g.paso.nombre}` : ""}`,
                        )
                        .join(" · ")
                    : "Sin gates productivos configurados"}
                </div>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRevisionDe(maestro)}
                  >
                    <FilePlus2Icon data-icon="inline-start" /> Agregar revisión
                  </Button>
                ) : null}
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.developmentEmpty}>
          <FileClockIcon />
          <h3>Todavía no hay documentos controlados</h3>
          <p>
            Creá el primer maestro para separar versiones, decisiones y
            liberación productiva.
          </p>
        </div>
      )}

      <Dialog open={maestroOpen} onOpenChange={setMaestroOpen}>
        <DialogContent className={styles.dialog}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle>Nuevo documento controlado</DialogTitle>
            <DialogDescription>
              Definí el propósito lógico; cada cambio de contenido será una
              revisión.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={guardarMaestro}>
            <div className={styles.dialogBody}>
              <div className={styles.formGrid}>
                <label className={styles.span2}>
                  <span className={styles.label}>Nombre</span>
                  <input
                    className={styles.input}
                    name="nombre"
                    required
                    placeholder="Arte final gráfica de cenefa"
                  />
                </label>
                <label>
                  <span className={styles.label}>Etapa</span>
                  <select className={styles.select} name="etapa">
                    {ETAPAS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={styles.label}>Propósito</span>
                  <select className={styles.select} name="proposito">
                    {PROPOSITOS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.span2}>
                  <span className={styles.label}>Descripción</span>
                  <textarea className={styles.textarea} name="descripcion" />
                </label>
              </div>
            </div>
            <DialogFooter className={styles.dialogFooter}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMaestroOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className={styles.primaryButton}
                loading={working === "maestro"}
              >
                Crear documento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(revisionDe)}
        onOpenChange={(open) => !open && setRevisionDe(null)}
      >
        <DialogContent className={styles.dialog}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle>Agregar revisión</DialogTitle>
            <DialogDescription>
              {revisionDe?.nombre}. Elegí un adjunto con SHA-256; su contenido
              quedará inmutable.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={guardarRevision}>
            <div className={styles.dialogBody}>
              <div className={styles.formGrid}>
                <label className={styles.span2}>
                  <span className={styles.label}>Archivo de campaña</span>
                  <select
                    className={styles.select}
                    name="archivoId"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Seleccionar archivo…
                    </option>
                    {archivos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre} · {formatBytes(a.bytes)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.span2}>
                  <span className={styles.label}>Qué cambió</span>
                  <textarea
                    className={styles.textarea}
                    name="comentario"
                    placeholder="Ajuste de color, medidas finales…"
                  />
                </label>
              </div>
              <p className={styles.formHint}>
                Los adjuntos anteriores a esta fase pueden no tener hash. Si el
                sistema lo indica, volvé a subir el archivo desde el tab
                Archivos.
              </p>
            </div>
            <DialogFooter className={styles.dialogFooter}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRevisionDe(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className={styles.primaryButton}
                loading={working === `revision-${revisionDe?.id}`}
              >
                Registrar revisión
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(solicitudDe)}
        onOpenChange={(open) => !open && setSolicitudDe(null)}
      >
        <DialogContent className={styles.dialog}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle>
              Solicitar aprobación de V{solicitudDe?.numero}
            </DialogTitle>
            <DialogDescription>
              Definí quién decide y qué conformidad se necesita.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={guardarSolicitud}>
            <div className={styles.dialogBody}>
              <div className={styles.formGrid}>
                <label>
                  <span className={styles.label}>Tipo</span>
                  <select className={styles.select} name="tipo">
                    {TIPOS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={styles.label}>Rol interno</span>
                  <select className={styles.select} name="rol">
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="ADMINISTRADOR">Administrador</option>
                    <option value="OPERADOR">Operador</option>
                  </select>
                </label>
                <label className={`${styles.span2} ${styles.checkRow}`}>
                  <input type="checkbox" name="externa" defaultChecked />
                  <span>
                    <strong>Permitir decisión externa</strong>
                    <small>
                      Genera un link mínimo y seguro para el cliente.
                    </small>
                  </span>
                </label>
                <label className={styles.span2}>
                  <span className={styles.label}>Indicaciones</span>
                  <textarea
                    className={styles.textarea}
                    name="comentario"
                    placeholder="Revisar color institucional y textos legales."
                  />
                </label>
              </div>
            </div>
            <DialogFooter className={styles.dialogFooter}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSolicitudDe(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className={styles.primaryButton}
                loading={working === `solicitud-${solicitudDe?.id}`}
              >
                Enviar a aprobación
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(decisionDe)}
        onOpenChange={(open) => !open && setDecisionDe(null)}
      >
        <DialogContent className={styles.dialog}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle>
              {decisionDe?.decision === "APROBAR"
                ? "Aprobar"
                : decisionDe?.decision === "RECHAZAR"
                  ? "Rechazar"
                  : "Observar"}{" "}
              {decisionDe?.revision}
            </DialogTitle>
            <DialogDescription>
              La decisión y el comentario quedarán en el historial inmutable.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={guardarDecision}>
            <div className={styles.dialogBody}>
              <label>
                <span className={styles.label}>
                  Comentario{" "}
                  {decisionDe?.decision === "OBSERVAR" ||
                  decisionDe?.decision === "RECHAZAR"
                    ? "obligatorio"
                    : ""}
                </span>
                <textarea
                  className={styles.textarea}
                  name="comentario"
                  required={
                    decisionDe?.decision === "OBSERVAR" ||
                    decisionDe?.decision === "RECHAZAR"
                  }
                />
              </label>
            </div>
            <DialogFooter className={styles.dialogFooter}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDecisionDe(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className={
                  decisionDe?.decision === "APROBAR"
                    ? styles.approveButton
                    : styles.observeButton
                }
                loading={working === `decision-${decisionDe?.solicitudId}`}
              >
                {decisionDe?.decision === "APROBAR" ? (
                  <CheckCircle2Icon data-icon="inline-start" />
                ) : (
                  <MessageSquareWarningIcon data-icon="inline-start" />
                )}
                {decisionDe?.decision === "APROBAR"
                  ? "Aprobar revisión"
                  : decisionDe?.decision === "RECHAZAR"
                    ? "Confirmar rechazo"
                    : "Registrar observación"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={gateOpen} onOpenChange={setGateOpen}>
        <DialogContent className={styles.dialog}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle>Configurar gate productivo</DialogTitle>
            <DialogDescription>
              La OT no podrá comenzar hasta que la revisión liberada tenga esta
              aprobación.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={guardarGate}>
            <div className={styles.dialogBody}>
              <div className={styles.formGrid}>
                <label>
                  <span className={styles.label}>Orden</span>
                  <select className={styles.select} name="ordenId" required>
                    {ordenes.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.numero} · {o.estado}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={styles.label}>Documento</span>
                  <select
                    className={styles.select}
                    name="archivoMaestroId"
                    required
                  >
                    {data.maestros.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.span2}>
                  <span className={styles.label}>Aprobación requerida</span>
                  <select className={styles.select} name="tipo">
                    {TIPOS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.gateWarning}>
                <LockKeyholeIcon />
                <span>
                  El control se evalúa en el backend en cada intento de iniciar
                  producción.
                </span>
              </div>
            </div>
            <DialogFooter className={styles.dialogFooter}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setGateOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className={styles.primaryButton}
                loading={working === "gate"}
              >
                Activar gate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function labelEtapa(value: EtapaDesarrolloDocumento) {
  return ETAPAS.find(([key]) => key === value)?.[1] ?? value;
}
function labelProposito(value: PropositoArchivoMaestro) {
  return PROPOSITOS.find(([key]) => key === value)?.[1] ?? value;
}
function labelTipo(value: TipoAprobacionDocumento) {
  return TIPOS.find(([key]) => key === value)?.[1] ?? value;
}
function labelEstado(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}
