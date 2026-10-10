"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, KeyRound, MailCheck } from "lucide-react";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { GrafoprintBrand } from "@/components/brand/grafoprint-brand";
import { ActionButton } from "@/components/design-system/action-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  confirmarCorreo,
  restablecerClave,
  solicitarRecuperacion,
} from "@/lib/recuperacion-api";
import s from "@/components/plataforma/seguridad-backoffice.module.css";
import theme from "@/components/design-system/brand-workspace-theme.module.css";

type Modo = "solicitar" | "verificar" | "restablecer";
export function RecuperarAcceso() {
  const [modo, setModo] = useState<Modo>("solicitar");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [busy, setBusy] = useState(false);
  const inicializado = useRef(false),
    enviando = useRef(false);
  useEffect(() => {
    if (inicializado.current) return;
    inicializado.current = true;
    const fragmento = new URLSearchParams(window.location.hash.slice(1));
    const t = fragmento.get("token"),
      m = fragmento.get("modo");
    window.history.replaceState(null, "", window.location.pathname);
    if (!t && !m) return;
    if (
      !t ||
      !/^[a-f0-9]{64}$/.test(t) ||
      (m !== "verificar" && m !== "restablecer")
    ) {
      setError("El enlace no es válido. Solicitá uno nuevo.");
      return;
    }
    setToken(t);
    setModo(m);
    // Abrir un enlace nunca lo consume: hace falta confirmar el formulario.
  }, []);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando.current || mensaje) return;
    if (modo === "restablecer" && clave !== repetida) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (modo === "restablecer" && new TextEncoder().encode(clave).length > 72) {
      setError("La contraseña es demasiado larga. Usá menos caracteres.");
      return;
    }
    enviando.current = true;
    setBusy(true);
    setError("");
    try {
      if (modo === "solicitar") {
        const r = await solicitarRecuperacion(email.trim());
        setMensaje(
          r.mensaje ??
            "Si la cuenta tiene un correo verificado, vas a recibir un enlace para continuar.",
        );
      } else if (modo === "verificar") {
        await confirmarCorreo(token);
        setMensaje(
          "Correo confirmado. Ya podés usarlo para recuperar tu contraseña.",
        );
        setToken("");
      } else {
        await restablecerClave(token, clave);
        setToken("");
        setClave("");
        setRepetida("");
        setMensaje(
          "Tu contraseña se actualizó. Ingresá con la nueva clave y tu segundo factor, si lo tenés activado.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo completar la solicitud.",
      );
    } finally {
      enviando.current = false;
      setBusy(false);
    }
  }
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <main className={`${theme.theme} ${s.page}`} data-ui="heroui">
        <section className={s.card}>
          <GrafoprintBrand />
          <div className={s.intro}>
            <span>TU ACCESO A GRAFO</span>
            <h1>
              {modo === "verificar"
                ? "Confirmá tu correo"
                : modo === "restablecer"
                  ? "Elegí tu nueva clave"
                  : "Recuperá tu acceso"}
              <span>.</span>
            </h1>
            <p>
              {modo === "solicitar"
                ? "Usá el correo de tu cuenta. Si lo verificaste, te enviaremos un enlace para elegir una contraseña nueva."
                : modo === "verificar"
                  ? "Este paso confirma tu correo; no cambia tu contraseña ni inicia una sesión."
                  : "Tu segundo factor se mantiene. Al guardar, se cerrarán las sesiones anteriores."}
            </p>
          </div>
          {mensaje ? (
            <p role="status">{mensaje}</p>
          ) : (
            <form
              onSubmit={enviar}
              aria-busy={busy}
              className="flex flex-col gap-5"
            >
              <FieldGroup>
                {modo === "solicitar" && (
                  <Field data-invalid={!!error}>
                    <FieldLabel htmlFor="rec-email">
                      Correo de tu cuenta
                    </FieldLabel>
                    <Input
                      id="rec-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={254}
                      required
                      disabled={busy}
                      aria-invalid={!!error}
                    />
                  </Field>
                )}
                {modo === "restablecer" && (
                  <>
                    <Field data-invalid={!!error}>
                      <FieldLabel htmlFor="rec-clave">
                        Nueva contraseña
                      </FieldLabel>
                      <Input
                        id="rec-clave"
                        type="password"
                        autoComplete="new-password"
                        value={clave}
                        onChange={(e) => setClave(e.target.value)}
                        minLength={8}
                        maxLength={72}
                        required
                        disabled={busy}
                        aria-invalid={!!error}
                      />
                    </Field>
                    <Field data-invalid={!!error}>
                      <FieldLabel htmlFor="rec-repetida">
                        Repetí la contraseña
                      </FieldLabel>
                      <Input
                        id="rec-repetida"
                        type="password"
                        autoComplete="new-password"
                        value={repetida}
                        onChange={(e) => setRepetida(e.target.value)}
                        minLength={8}
                        maxLength={72}
                        required
                        disabled={busy}
                        aria-invalid={!!error}
                      />
                    </Field>
                  </>
                )}
              </FieldGroup>
              {error && (
                <p role="alert" className={s.error}>
                  {error}
                </p>
              )}
              <ActionButton type="submit" isPending={busy} isDisabled={busy}>
                {modo === "verificar" ? <MailCheck /> : <KeyRound />}
                {modo === "verificar"
                  ? "Confirmar mi correo"
                  : modo === "restablecer"
                    ? "Guardar nueva contraseña"
                    : "Enviar enlace"}
                <ArrowRight />
              </ActionButton>
            </form>
          )}
          <div className={s.actions}>
            <Link href="/login">Acceso a mi empresa</Link>
            <Link href="/backoffice">Acceso del equipo Grafo</Link>
          </div>
          {modo === "solicitar" && (
            <p className={s.note}>
              Si no verificaste el correo o también perdiste el segundo factor y
              los códigos de respaldo, contactá al equipo de Grafo.
            </p>
          )}
        </section>
      </main>
    </DesignSystemProvider>
  );
}
