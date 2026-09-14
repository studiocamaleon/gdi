"use client";

import { Card, Input, TextArea, Modal, Checkbox, Label } from "@heroui/react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import { CampanaDialog } from "./campana-dialog";
import focus from "@/components/design-system/field-focus.module.css";
import form from "./campana-form.module.css";

import * as React from "react";
import {
  CheckCircle2Icon,
  ClipboardCheckIcon,
  CopyIcon,
  DownloadIcon,
  FileClockIcon,
  FilePlus2Icon,
  FlagIcon,
  Link2OffIcon,
  LockKeyholeIcon,
  MessageSquareWarningIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { toast } from "sonner";
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
import styles from "./desarrollo-documental-panel.module.css";

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
              <ActionButton
                variant="outline"
                size="sm"
                onPress={() => setGateOpen(true)}
              >
                <LockKeyholeIcon data-icon="inline-start" /> Configurar gate
              </ActionButton>
            ) : null}
            <ActionButton size="sm" onPress={() => setMaestroOpen(true)}>
              <PlusIcon data-icon="inline-start" /> Nuevo documento
            </ActionButton>
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
            <Card
              render={(props) => <article {...props} />}
              className={styles.masterCard}
              key={maestro.id}
            >
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
                                      <ActionButton
                                        variant="ghost"
                                        size="sm"
                                        isPending={
                                          working === `link-${solicitud.id}`
                                        }
                                        onPress={() =>
                                          void compartir(solicitud.id)
                                        }
                                      >
                                        <CopyIcon data-icon="inline-start" />{" "}
                                        Link
                                      </ActionButton>
                                      <ActionButton
                                        variant="ghost"
                                        size="sm"
                                        isPending={
                                          working === `revocar-${solicitud.id}`
                                        }
                                        onPress={() =>
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
                                      </ActionButton>
                                    </>
                                  ) : null}
                                  <ActionButton
                                    variant="outline"
                                    size="sm"
                                    onPress={() =>
                                      setDecisionDe({
                                        solicitudId: solicitud.id,
                                        revision: `V${revision.numero}`,
                                        decision: "OBSERVAR",
                                      })
                                    }
                                  >
                                    Observar
                                  </ActionButton>
                                  <ActionButton
                                    variant="outline"
                                    size="sm"
                                    onPress={() =>
                                      setDecisionDe({
                                        solicitudId: solicitud.id,
                                        revision: `V${revision.numero}`,
                                        decision: "RECHAZAR",
                                      })
                                    }
                                  >
                                    Rechazar
                                  </ActionButton>
                                  <ActionButton
                                    size="sm"
                                    onPress={() =>
                                      setDecisionDe({
                                        solicitudId: solicitud.id,
                                        revision: `V${revision.numero}`,
                                        decision: "APROBAR",
                                      })
                                    }
                                  >
                                    Aprobar
                                  </ActionButton>
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
                              <ActionButton
                                variant="outline"
                                size="sm"
                                onPress={() => setSolicitudDe(revision)}
                              >
                                <ClipboardCheckIcon data-icon="inline-start" />{" "}
                                Solicitar
                              </ActionButton>
                            ) : null}
                            {revision.estado === "APROBADA" &&
                            maestro.revisionLiberada?.id !== revision.id ? (
                              <ActionButton
                                size="sm"
                                isPending={working === `liberar-${revision.id}`}
                                onPress={() =>
                                  void ejecutar(
                                    `liberar-${revision.id}`,
                                    () => liberarRevision(revision.id),
                                    `V${revision.numero} liberada a producción.`,
                                  )
                                }
                              >
                                <FlagIcon data-icon="inline-start" /> Liberar
                              </ActionButton>
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
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    onPress={() => setRevisionDe(maestro)}
                  >
                    <FilePlus2Icon data-icon="inline-start" /> Agregar revisión
                  </ActionButton>
                ) : null}
              </footer>
            </Card>
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

      <CampanaDialog
        isOpen={maestroOpen}
        onOpenChange={setMaestroOpen}
        title={<>Nuevo documento controlado</>}
        description={
          <>
            Definí el propósito lógico; cada cambio de contenido será una
            revisión.
          </>
        }
      >
        <form onSubmit={guardarMaestro}>
          <div className={form.body}>
            <div className={form.grid}>
              <label className={form.span2}>
                <span className={form.label}>Nombre</span>
                <Input
                  className={`${form.input} ${focus.singleBorder}`}
                  name="nombre"
                  required
                  placeholder="Arte final gráfica de cenefa"
                />
              </label>
              <label>
                <span className={form.label}>Etapa</span>
                <SelectField
                  className={form.select}
                  name="etapa"
                  aria-label="Etapa"
                  options={[
                    ...ETAPAS.map(([v, l]) => ({ value: v, label: l })),
                  ]}
                />
              </label>
              <label>
                <span className={form.label}>Propósito</span>
                <SelectField
                  className={form.select}
                  name="proposito"
                  aria-label="Propósito"
                  options={[
                    ...PROPOSITOS.map(([v, l]) => ({ value: v, label: l })),
                  ]}
                />
              </label>
              <label className={form.span2}>
                <span className={form.label}>Descripción</span>
                <TextArea
                  className={`${form.textarea} ${focus.singleBorder}`}
                  name="descripcion"
                />
              </label>
            </div>
          </div>
          <Modal.Footer className={form.footer}>
            <ActionButton
              type="button"
              variant="outline"
              onPress={() => setMaestroOpen(false)}
            >
              Cancelar
            </ActionButton>
            <ActionButton type="submit" isPending={working === "maestro"}>
              Crear documento
            </ActionButton>
          </Modal.Footer>
        </form>
      </CampanaDialog>

      <CampanaDialog
        isOpen={Boolean(revisionDe)}
        onOpenChange={(open) => !open && setRevisionDe(null)}
        title={<>Agregar revisión</>}
        description={
          <>
            {revisionDe?.nombre}. Elegí un adjunto con SHA-256; su contenido
            quedará inmutable.
          </>
        }
      >
        <form onSubmit={guardarRevision}>
          <div className={form.body}>
            <div className={form.grid}>
              <label className={form.span2}>
                <span className={form.label}>Archivo de campaña</span>
                <SelectField
                  className={form.select}
                  name="archivoId"
                  required
                  defaultValue=""
                  aria-label="Archivo de campaña"
                  options={[
                    {
                      value: "",
                      label: "Seleccionar archivo…",
                      disabled: true,
                    },
                    ...archivos.map((a) => ({
                      value: a.id,
                      label: [
                        a.nombre,
                        " ",
                        "·",
                        " ",
                        formatBytes(a.bytes),
                      ].join(""),
                    })),
                  ]}
                />
              </label>
              <label className={form.span2}>
                <span className={form.label}>Qué cambió</span>
                <TextArea
                  className={`${form.textarea} ${focus.singleBorder}`}
                  name="comentario"
                  placeholder="Ajuste de color, medidas finales…"
                />
              </label>
            </div>
            <p className={form.hint}>
              Los adjuntos anteriores a esta fase pueden no tener hash. Si el
              sistema lo indica, volvé a subir el archivo desde el tab Archivos.
            </p>
          </div>
          <Modal.Footer className={form.footer}>
            <ActionButton
              type="button"
              variant="outline"
              onPress={() => setRevisionDe(null)}
            >
              Cancelar
            </ActionButton>
            <ActionButton
              type="submit"
              isPending={working === `revision-${revisionDe?.id}`}
            >
              Registrar revisión
            </ActionButton>
          </Modal.Footer>
        </form>
      </CampanaDialog>

      <CampanaDialog
        isOpen={Boolean(solicitudDe)}
        onOpenChange={(open) => !open && setSolicitudDe(null)}
        title={<>Solicitar aprobación de V{solicitudDe?.numero}</>}
        description={<>Definí quién decide y qué conformidad se necesita.</>}
      >
        <form onSubmit={guardarSolicitud}>
          <div className={form.body}>
            <div className={form.grid}>
              <label>
                <span className={form.label}>Tipo</span>
                <SelectField
                  className={form.select}
                  name="tipo"
                  aria-label="Tipo"
                  options={[...TIPOS.map(([v, l]) => ({ value: v, label: l }))]}
                />
              </label>
              <label>
                <span className={form.label}>Rol interno</span>
                <SelectField
                  className={form.select}
                  name="rol"
                  aria-label="Rol interno"
                  options={[
                    { value: "SUPERVISOR", label: "Supervisor" },
                    { value: "ADMINISTRADOR", label: "Administrador" },
                    { value: "OPERADOR", label: "Operador" },
                  ]}
                />
              </label>
              <Checkbox
                className={`${form.span2} ${form.checkRow}`}
                name="externa"
                value="on"
                defaultSelected
              >
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Label>
                    <strong>Permitir decisión externa</strong>
                    <small>
                      Genera un link mínimo y seguro para el cliente.
                    </small>
                  </Label>
                </Checkbox.Content>
              </Checkbox>
              <label className={form.span2}>
                <span className={form.label}>Indicaciones</span>
                <TextArea
                  className={`${form.textarea} ${focus.singleBorder}`}
                  name="comentario"
                  placeholder="Revisar color institucional y textos legales."
                />
              </label>
            </div>
          </div>
          <Modal.Footer className={form.footer}>
            <ActionButton
              type="button"
              variant="outline"
              onPress={() => setSolicitudDe(null)}
            >
              Cancelar
            </ActionButton>
            <ActionButton
              type="submit"
              isPending={working === `solicitud-${solicitudDe?.id}`}
            >
              Enviar a aprobación
            </ActionButton>
          </Modal.Footer>
        </form>
      </CampanaDialog>

      <CampanaDialog
        isOpen={Boolean(decisionDe)}
        onOpenChange={(open) => !open && setDecisionDe(null)}
        title={
          <>
            {decisionDe?.decision === "APROBAR"
              ? "Aprobar"
              : decisionDe?.decision === "RECHAZAR"
                ? "Rechazar"
                : "Observar"}{" "}
            {decisionDe?.revision}
          </>
        }
        description={
          <>La decisión y el comentario quedarán en el historial inmutable.</>
        }
      >
        <form onSubmit={guardarDecision}>
          <div className={form.body}>
            <label>
              <span className={form.label}>
                Comentario{" "}
                {decisionDe?.decision === "OBSERVAR" ||
                decisionDe?.decision === "RECHAZAR"
                  ? "obligatorio"
                  : ""}
              </span>
              <TextArea
                className={`${form.textarea} ${focus.singleBorder}`}
                name="comentario"
                required={
                  decisionDe?.decision === "OBSERVAR" ||
                  decisionDe?.decision === "RECHAZAR"
                }
              />
            </label>
          </div>
          <Modal.Footer className={form.footer}>
            <ActionButton
              type="button"
              variant="outline"
              onPress={() => setDecisionDe(null)}
            >
              Cancelar
            </ActionButton>
            <ActionButton
              type="submit"
              variant={
                decisionDe?.decision === "APROBAR" ? "primary" : "danger"
              }
              isPending={working === `decision-${decisionDe?.solicitudId}`}
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
            </ActionButton>
          </Modal.Footer>
        </form>
      </CampanaDialog>

      <CampanaDialog
        isOpen={gateOpen}
        onOpenChange={setGateOpen}
        title={<>Configurar gate productivo</>}
        description={
          <>
            La OT no podrá comenzar hasta que la revisión liberada tenga esta
            aprobación.
          </>
        }
      >
        <form onSubmit={guardarGate}>
          <div className={form.body}>
            <div className={form.grid}>
              <label>
                <span className={form.label}>Orden</span>
                <SelectField
                  className={form.select}
                  name="ordenId"
                  required
                  aria-label="Orden"
                  options={[
                    ...ordenes.map((o) => ({
                      value: o.id,
                      label: [o.numero, " ", "·", " ", o.estado].join(""),
                    })),
                  ]}
                />
              </label>
              <label>
                <span className={form.label}>Documento</span>
                <SelectField
                  className={form.select}
                  name="archivoMaestroId"
                  required
                  aria-label="Documento"
                  options={[
                    ...data.maestros.map((m) => ({
                      value: m.id,
                      label: m.nombre,
                    })),
                  ]}
                />
              </label>
              <label className={form.span2}>
                <span className={form.label}>Aprobación requerida</span>
                <SelectField
                  className={form.select}
                  name="tipo"
                  aria-label="Tipo"
                  options={[...TIPOS.map(([v, l]) => ({ value: v, label: l }))]}
                />
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
          <Modal.Footer className={form.footer}>
            <ActionButton
              type="button"
              variant="outline"
              onPress={() => setGateOpen(false)}
            >
              Cancelar
            </ActionButton>
            <ActionButton type="submit" isPending={working === "gate"}>
              Activar gate
            </ActionButton>
          </Modal.Footer>
        </form>
      </CampanaDialog>
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
