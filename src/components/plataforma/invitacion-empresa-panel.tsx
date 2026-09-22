"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, RefreshCw, Copy } from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/design-system/action-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  reenviarInvitacionEmpresa,
  type InvitacionEmpresa,
  type ResultadoInvitacionEmpresa,
} from "@/lib/plataforma-api";
import styles from "./invitacion-empresa.module.css";

export function InvitacionEmpresaPanel({
  tenantId,
  invitacion,
  enlace,
  puedeEnviar,
  onCambio,
}: {
  tenantId: string;
  invitacion: InvitacionEmpresa;
  enlace?: string;
  puedeEnviar: boolean;
  onCambio: (r: ResultadoInvitacionEmpresa) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [enPausa, setEnPausa] = useState(false);
  const enviando = useRef(false);
  useEffect(() => {
    const hasta =
      (invitacion.ultimoIntentoEl
        ? new Date(invitacion.ultimoIntentoEl).getTime()
        : 0) + (invitacion.correoEstado === "enviando" ? 120000 : 60000);
    const restante = hasta - Date.now();
    setEnPausa(restante > 0);
    if (restante <= 0) return;
    const timer = setTimeout(() => setEnPausa(false), restante);
    return () => clearTimeout(timer);
  }, [invitacion.ultimoIntentoEl, invitacion.correoEstado]);
  const enviada = invitacion.correoEstado === "enviado";
  const fallida = ["error", "sin_confirmar"].includes(invitacion.correoEstado);
  const fecha = (s: string) =>
    new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(s));
  const reenviar = async () => {
    if (enviando.current || enPausa) return;
    enviando.current = true;
    setOcupado(true);
    setError("");
    try {
      const r = await reenviarInvitacionEmpresa(tenantId);
      onCambio(r);
      if (r.invitacion.correoEstado === "enviado")
        toast.success("Invitación enviada por correo.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo reenviar la invitación.",
      );
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  };
  return (
    <section className={styles.stack} aria-label="Invitación del administrador">
      <Alert variant={fallida ? "destructive" : "default"}>
        <Mail />
        <AlertTitle>
          {invitacion.aceptadaEl
            ? "Invitación aceptada"
            : enviada
              ? "Invitación enviada por correo"
              : fallida
                ? "Empresa creada · correo sin confirmar"
                : invitacion.correoEstado === "enviando"
                  ? "Envío de invitación en curso"
                  : "Invitación pendiente de envío"}
        </AlertTitle>
        <AlertDescription>
          <p>{invitacion.email}</p>
          <p>
            {invitacion.aceptadaEl
              ? `Aceptada el ${fecha(invitacion.aceptadaEl)}.`
              : enviada
                ? `El proveedor aceptó el correo. El enlace vence el ${fecha(invitacion.venceEl)}.`
                : fallida
                  ? "La empresa ya está guardada. Podés reintentar el correo sin volver a crearla."
                  : `El enlace vence el ${fecha(invitacion.venceEl)}.`}
          </p>
        </AlertDescription>
      </Alert>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo reenviar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {puedeEnviar && !invitacion.aceptadaEl && (
        <>
          <div className={styles.actions}>
            <ActionButton
              variant="outline"
              onPress={() => void reenviar()}
              isDisabled={ocupado || enPausa}
            >
              <RefreshCw data-icon="inline-start" />
              {ocupado ? "Enviando…" : "Reenviar invitación"}
            </ActionButton>
            {enPausa && (
              <span className={styles.note}>
                Esperá un momento para volver a enviar.
              </span>
            )}
          </div>
          <p className={styles.note}>
            Al reenviar se genera un enlace nuevo y el anterior deja de ser
            válido.
          </p>
          {enlace && (
            <details className={styles.link}>
              <summary>Compartir el enlace manualmente</summary>
              <p>{enlace}</p>
              <ActionButton
                variant="outline"
                onPress={async () => {
                  try {
                    await navigator.clipboard.writeText(enlace);
                    toast.success("Enlace copiado.");
                  } catch {
                    toast.error(
                      "No se pudo copiar. Seleccioná el enlace para copiarlo.",
                    );
                  }
                }}
              >
                <Copy data-icon="inline-start" />
                Copiar enlace
              </ActionButton>
            </details>
          )}
        </>
      )}
    </section>
  );
}
