"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@heroui/react";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import { GrafoprintBrand } from "@/components/brand/grafoprint-brand";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { MfaLoginForm } from "@/components/auth/mfa-login-form";
import type { MfaChallenge } from "@/lib/auth";
import {
  aceptarInvitacionEquipo,
  consultarInvitacionEquipo,
  type EstadoInvitacionEquipo,
} from "@/lib/plataforma-equipo-api";
import { setSessionToken } from "@/lib/session";
import theme from "@/components/design-system/brand-workspace-theme.module.css";
import styles from "./seguridad-backoffice.module.css";

export function InvitacionBackoffice() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [datos, setDatos] = useState<EstadoInvitacionEquipo>();
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<MfaChallenge>();
  const enviando = useRef(false);
  // El token va en el fragmento: no se envía en URLs HTTP, referers ni logs de acceso.
  useEffect(() => {
    const valor =
      new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    setToken(valor);
  }, []);
  useEffect(() => {
    if (!token) return;
    let actual = true;
    setError("");
    consultarInvitacionEquipo(token)
      .then((d) => {
        if (actual) setDatos(d);
      })
      .catch((e) => {
        if (actual)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo consultar la invitación.",
          );
      });
    return () => {
      actual = false;
    };
  }, [token, intento]);
  const entrar = async (accessToken: string) => {
    await setSessionToken(accessToken);
    window.history.replaceState(null, "", "/backoffice/invitacion");
    router.replace("/backoffice/seguridad");
    router.refresh();
  };
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <main className={`${theme.theme} ${styles.page}`} data-ui="heroui">
        <section className={styles.card}>
          <GrafoprintBrand />
          {challenge ? (
            <MfaLoginForm
              backoffice
              challenge={challenge}
              onSuccess={entrar}
              onBack={() => setChallenge(undefined)}
            />
          ) : (
            <>
              <div className={styles.intro}>
                <span>EQUIPO DE GRAFO</span>
                <h1>
                  Tu invitación<span>.</span>
                </h1>
                {datos && (
                  <>
                    <p>
                      {datos.email} ·{" "}
                      {datos.rol === "ADMIN" ? "Administración" : "Soporte"}
                    </p>
                    <p>
                      Vence el{" "}
                      {new Date(datos.venceEl).toLocaleString("es-AR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                    <p>
                      {datos.requiereCrearClave
                        ? "Creá tu cuenta para aceptar la invitación."
                        : "Usá la contraseña de tu cuenta de Grafo. Conservamos tus accesos a empresas."}{" "}
                      Después completarás MFA para administrar la plataforma.
                    </p>
                  </>
                )}
              </div>
              {!token ? (
                <p className={styles.note}>
                  Abrí el enlace completo que te compartió el equipo de Grafo.
                </p>
              ) : !datos && !error ? (
                <p role="status">Consultando invitación…</p>
              ) : null}
              {datos && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (enviando.current) return;
                    if (datos.requiereCrearClave && password !== repetir) {
                      setError("Las contraseñas no coinciden.");
                      return;
                    }
                    enviando.current = true;
                    setBusy(true);
                    setError("");
                    try {
                      const r = await aceptarInvitacionEquipo(
                        token,
                        password,
                        datos.requiereCrearClave ? nombre.trim() : undefined,
                      );
                      setPassword("");
                      setRepetir("");
                      if ("requiereMfa" in r) setChallenge(r);
                      else if (r.accessToken) await entrar(r.accessToken);
                      else throw new Error("No se pudo completar el acceso.");
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "No se pudo aceptar la invitación.",
                      );
                    } finally {
                      enviando.current = false;
                      setBusy(false);
                    }
                  }}
                >
                  <FieldGroup>
                    {datos.requiereCrearClave && (
                      <Field>
                        <FieldLabel htmlFor="invitado-nombre">
                          Tu nombre
                        </FieldLabel>
                        <Input
                          id="invitado-nombre"
                          autoComplete="name"
                          required
                          maxLength={120}
                          value={nombre}
                          onChange={(e) => setNombre(e.target.value)}
                          disabled={busy}
                        />
                      </Field>
                    )}
                    <Field>
                      <FieldLabel htmlFor="invitado-password">
                        {datos.requiereCrearClave
                          ? "Creá tu contraseña"
                          : "Contraseña actual"}
                      </FieldLabel>
                      <Input
                        id="invitado-password"
                        type="password"
                        autoComplete={
                          datos.requiereCrearClave
                            ? "new-password"
                            : "current-password"
                        }
                        required
                        minLength={datos.requiereCrearClave ? 12 : 1}
                        maxLength={datos.requiereCrearClave ? 72 : 256}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={busy}
                      />
                      {datos.requiereCrearClave && (
                        <p className={styles.note}>
                          Usá al menos 12 caracteres.
                        </p>
                      )}
                    </Field>
                    {datos.requiereCrearClave && (
                      <Field>
                        <FieldLabel htmlFor="invitado-repetir">
                          Repetí la contraseña
                        </FieldLabel>
                        <Input
                          id="invitado-repetir"
                          type="password"
                          autoComplete="new-password"
                          required
                          value={repetir}
                          onChange={(e) => setRepetir(e.target.value)}
                          disabled={busy}
                        />
                      </Field>
                    )}
                    <ActionButton type="submit" isDisabled={busy}>
                      {busy ? "Verificando…" : "Aceptar invitación"}
                    </ActionButton>
                  </FieldGroup>
                </form>
              )}
              {error && (
                <p role="alert" className={styles.error}>
                  {error}
                </p>
              )}
              {token && !datos && error && (
                <ActionButton
                  variant="outline"
                  onPress={() => setIntento((v) => v + 1)}
                >
                  Reintentar
                </ActionButton>
              )}
              <p className={styles.note}>
                <Link href="/backoffice">Volver al acceso del equipo</Link>
              </p>
            </>
          )}
        </section>
      </main>
    </DesignSystemProvider>
  );
}
