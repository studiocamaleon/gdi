"use client";

import * as React from "react";
import { Chip, Label, Modal, TextArea, TextField } from "@heroui/react";
import {
  CheckIcon,
  CircleCheckIcon,
  Clock3Icon,
  FileTextIcon,
  LockKeyholeIcon,
  MessageSquareIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import {
  decidirPresupuestoPublico,
  type PresupuestoPublico,
} from "@/lib/presupuestos-api";
import { formatearMonedaDoc, monedaDe, type Moneda } from "@/lib/moneda";
import { ActionButton } from "@/components/design-system/action-button";
import { FormDialog } from "@/components/design-system/form-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DocumentoNoEncontrado,
  DocumentoPublico,
  EstadoPublico,
  SeccionPublica,
} from "@/components/publico/documento-publico";
import p from "@/components/publico/documento-publico.module.css";
import s from "./presupuesto-publico.module.css";

const fmtMoneda = (n: number, moneda: Moneda) =>
  formatearMonedaDoc(n, moneda, { decimales: 0 });
const fmtFecha = (iso: string | null) => {
  if (!iso) return "Sin indicar";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

type Decision = "aprobado" | "rechazado";

export function PresupuestoPublicoView({
  token,
  initial,
}: {
  token: string;
  initial: PresupuestoPublico | null;
}) {
  const [d, setD] = React.useState(initial);
  const [confirmacion, setConfirmacion] = React.useState<Decision | null>(null);
  const [decidiendo, setDecidiendo] = React.useState(false);
  const enviando = React.useRef(false);
  const [comentario, setComentario] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const abrirConfirmacion = (decision: Decision) => {
    setError(null);
    setConfirmacion(decision);
  };
  const decidir = async () => {
    if (!confirmacion || enviando.current) return;
    enviando.current = true;
    setDecidiendo(true);
    setError(null);
    try {
      await decidirPresupuestoPublico(token, {
        decision: confirmacion,
        comentario:
          confirmacion === "rechazado"
            ? comentario.trim() || undefined
            : undefined,
      });
      setD((prev) => (prev ? { ...prev, estado: confirmacion } : prev));
      setConfirmacion(null);
      setComentario("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo registrar tu decisión. Volvé a intentarlo.",
      );
    } finally {
      enviando.current = false;
      setDecidiendo(false);
    }
  };

  if (!d) return <DocumentoNoEncontrado tipo="presupuesto" />;

  const vigente = d.estado === "enviado";
  const aprobado = d.estado === "aprobado" || d.estado === "convertido";
  const moneda = monedaDe(d.monedaCodigo);
  const fmt = (valor: number) => fmtMoneda(valor, moneda);
  const estado = aprobado
    ? "Aprobado"
    : d.estado === "rechazado"
      ? "No aceptado"
      : d.estado === "vencido"
        ? "Vencido"
        : vigente
          ? "Pendiente de tu aprobación"
          : "No disponible para aprobar";

  return (
    <DocumentoPublico
      negocio={d.negocio}
      descripcion="Presupuesto para vos"
      logo={
        d.tieneLogo
          ? `/api/backend/presupuestos/track/${encodeURIComponent(token)}/logo`
          : undefined
      }
    >
      <section className={p.hero} aria-labelledby="presupuesto-titulo">
        <div className={p.heroTop}>
          <span className={p.eyebrow}>Una propuesta para vos</span>
          <EstadoPublico
            tone={aprobado ? "success" : vigente ? "accent" : "default"}
          >
            {estado}
          </EstadoPublico>
        </div>
        <h1 id="presupuesto-titulo" className={p.heroTitle}>
          Tu presupuesto<span className={s.period}>.</span>
        </h1>
        <p className={p.heroDescription}>
          {d.cliente ? (
            <>
              Preparado para <strong>{d.cliente}</strong>.{" "}
            </>
          ) : null}
          Revisá el detalle y contanos si avanzamos.
        </p>
        <dl className={p.heroMeta}>
          <div>
            <dt>Presupuesto</dt>
            <dd>
              <code>{d.numero}</code>
            </dd>
          </div>
          <div>
            <dt>Emisión</dt>
            <dd>{fmtFecha(d.fechaEmision)}</dd>
          </div>
          <div>
            <dt>Válido hasta</dt>
            <dd>
              {d.fechaValidez ? fmtFecha(d.fechaValidez) : "Sin vencimiento"}
            </dd>
          </div>
        </dl>
      </section>

      {aprobado ? (
        <Alert role="status" className={p.notice} data-tone="success">
          <CircleCheckIcon />
          <AlertTitle>Presupuesto aprobado</AlertTitle>
          <AlertDescription>
            ¡Gracias! {d.negocio} se va a contactar para coordinar el trabajo.
          </AlertDescription>
        </Alert>
      ) : d.estado === "vencido" ? (
        <Alert role="status" className={p.notice}>
          <Clock3Icon />
          <AlertTitle>La validez de esta propuesta terminó</AlertTitle>
          <AlertDescription>
            Pedile a {d.negocio} una actualización para continuar. Los precios
            pueden haber cambiado.
          </AlertDescription>
        </Alert>
      ) : d.estado === "rechazado" ? (
        <Alert role="status" className={p.notice}>
          <MessageSquareIcon />
          <AlertTitle>Tu decisión quedó registrada</AlertTitle>
          <AlertDescription>
            Nos avisaste que no vas a avanzar con este presupuesto. Gracias por
            responder.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className={p.columns}>
        <div className={p.stack}>
          <SeccionPublica
            titulo="Detalle del trabajo"
            icon={FileTextIcon}
            detalle={`${d.items.length} ${d.items.length === 1 ? "producto" : "productos"}`}
          >
            <div className={s.items}>
              {d.items.map((item, idx) => (
                <article key={idx} className={s.item}>
                  <div className={s.itemHead}>
                    <span className={s.itemNumber}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className={s.itemIdentity}>
                      <h3>{item.nombre}</h3>
                      <p>
                        {item.cantidad.toLocaleString("es-AR")}{" "}
                        {item.cantidadUnidad}
                      </p>
                    </div>
                    <div className={s.itemPrice}>
                      {item.descuentoMonto && item.totalLista ? (
                        <del>{fmt(item.totalLista)}</del>
                      ) : null}
                      <strong>{fmt(item.total)}</strong>
                      {item.descuentoMonto ? (
                        <span className={s.saving}>
                          −
                          {(item.descuentoPct ?? 0).toLocaleString("es-AR", {
                            maximumFractionDigits: 1,
                          })}
                          %
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {item.specs.length ? (
                    <dl className={p.specs}>
                      {item.specs.map((spec, i) => (
                        <div key={`${spec.etiqueta}-${i}`}>
                          <dt>{spec.etiqueta}</dt>
                          <dd>{spec.valor}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {item.adicionales.length ? (
                    <div className={s.extras}>
                      <span>Opcionales incluidos</span>
                      <div>
                        {item.adicionales.map((extra, i) => (
                          <Chip size="sm" variant="soft" key={`${extra}-${i}`}>
                            <CheckIcon aria-hidden />
                            {extra}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </SeccionPublica>
          {d.observaciones ||
          (d.senaSugeridaPct ?? 0) > 0 ||
          d.fidelizacion.puntosEstimados > 0 ? (
            <SeccionPublica
              titulo="Para tener en cuenta"
              icon={ShieldCheckIcon}
            >
              <div className={s.conditions}>
                {(d.senaSugeridaPct ?? 0) > 0 ? (
                  <div>
                    <ShieldCheckIcon aria-hidden />
                    <p>
                      Seña del{" "}
                      <strong>
                        {d.senaSugeridaPct!.toLocaleString("es-AR")}%
                      </strong>{" "}
                      para iniciar el trabajo. El saldo se abona contra entrega.
                    </p>
                  </div>
                ) : null}
                {d.observaciones ? (
                  <div>
                    <MessageSquareIcon aria-hidden />
                    <p>{d.observaciones}</p>
                  </div>
                ) : null}
                {d.fidelizacion.puntosEstimados > 0 ? (
                  <div>
                    <SparklesIcon aria-hidden />
                    <p>
                      Esta compra suma aproximadamente{" "}
                      <strong>{d.fidelizacion.puntosEstimados} puntos</strong>;{" "}
                      {d.fidelizacion.condicion.toLocaleLowerCase()}.
                    </p>
                  </div>
                ) : null}
              </div>
            </SeccionPublica>
          ) : null}
        </div>
        <aside
          className={s.summary}
          aria-label="Resumen y decisión del presupuesto"
        >
          <SeccionPublica titulo="Resumen" icon={ReceiptTextIcon}>
            <dl className={s.totals}>
              {d.descuentoTotal > 0 ? (
                <>
                  <div>
                    <dt>Subtotal de lista</dt>
                    <dd>{fmt(d.subtotal + d.descuentoTotal)}</dd>
                  </div>
                  <div className={s.saving}>
                    <dt>Descuento</dt>
                    <dd>−{fmt(d.descuentoTotal)}</dd>
                  </div>
                </>
              ) : null}
              <div>
                <dt>Subtotal</dt>
                <dd>{fmt(d.subtotal)}</dd>
              </div>
              {d.cargosDirectos > 0 ? (
                <div>
                  <dt>Cargos</dt>
                  <dd>{fmt(d.cargosDirectos)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Impuestos</dt>
                <dd>{fmt(d.impuestos)}</dd>
              </div>
              {d.fidelizacion.canjePuntos > 0 ? (
                <div className={s.saving}>
                  <dt>Canje · {d.fidelizacion.canjePuntos} puntos</dt>
                  <dd>−{fmt(d.fidelizacion.canjeMonto)}</dd>
                </div>
              ) : null}
              <div className={s.total}>
                <dt>Total del presupuesto</dt>
                <dd>{fmt(d.total)}</dd>
              </div>
            </dl>
            {vigente ? (
              <div className={s.actions}>
                <ActionButton
                  size="lg"
                  onPress={() => abrirConfirmacion("aprobado")}
                >
                  <CheckIcon aria-hidden />
                  Aprobar presupuesto
                </ActionButton>
                <ActionButton
                  size="lg"
                  variant="outline"
                  onPress={() => abrirConfirmacion("rechazado")}
                >
                  No avanzar
                </ActionButton>
                <p>
                  <LockKeyholeIcon aria-hidden />
                  Tu decisión queda registrada con fecha y hora.
                </p>
              </div>
            ) : null}
          </SeccionPublica>
          {d.vendedor ? (
            <p className={s.advisor}>
              Tu asesor comercial <strong>{d.vendedor}</strong>
            </p>
          ) : null}
        </aside>
      </div>

      {confirmacion ? (
        <FormDialog
          isOpen
          isDismissable={!decidiendo}
          onOpenChange={(open) => {
            if (!open && !enviando.current) setConfirmacion(null);
          }}
          title={
            confirmacion === "aprobado"
              ? "¿Avanzamos con tu trabajo?"
              : "¿No vas a avanzar?"
          }
          description={
            confirmacion === "aprobado"
              ? `Vas a aprobar este presupuesto de ${d.negocio}.`
              : "Le avisaremos a la imprenta que no aceptás esta propuesta."
          }
          className={s.dialog}
        >
          <Modal.Body className={s.dialogBody}>
            <dl className={s.confirmationSummary}>
              <div>
                <dt>Presupuesto</dt>
                <dd>{d.numero}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{fmt(d.total)}</dd>
              </div>
            </dl>
            {confirmacion === "aprobado" && (d.senaSugeridaPct ?? 0) > 0 ? (
              <p className={s.dialogHint}>
                Seña del {d.senaSugeridaPct}% para iniciar el trabajo, saldo
                contra entrega.
              </p>
            ) : null}
            {confirmacion === "rechazado" ? (
              <TextField
                className={s.commentField}
                value={comentario}
                onChange={setComentario}
                isDisabled={decidiendo}
              >
                <Label>Comentario (opcional)</Label>
                <TextArea
                  className={s.commentInput}
                  rows={3}
                  placeholder="Podés contarnos el motivo o qué necesitás cambiar."
                />
              </TextField>
            ) : null}
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>No pudimos registrar tu decisión</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </Modal.Body>
          <Modal.Footer className={s.dialogFooter}>
            <ActionButton
              size="md"
              variant="outline"
              autoFocus
              isDisabled={decidiendo}
              onPress={() => setConfirmacion(null)}
            >
              Volver
            </ActionButton>
            <ActionButton
              size="md"
              variant={confirmacion === "aprobado" ? "primary" : "danger"}
              isPending={decidiendo}
              isDisabled={decidiendo}
              onPress={() => void decidir()}
            >
              {confirmacion === "aprobado" ? (
                <CheckIcon aria-hidden />
              ) : (
                <XIcon aria-hidden />
              )}
              {decidiendo
                ? "Registrando…"
                : confirmacion === "aprobado"
                  ? "Confirmar aprobación"
                  : "Confirmar que no avanzo"}
            </ActionButton>
          </Modal.Footer>
        </FormDialog>
      ) : null}
    </DocumentoPublico>
  );
}
