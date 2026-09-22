"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { Input } from "@heroui/react";
import { loginPlataforma, type MfaChallenge } from "@/lib/auth";
import { MfaLoginForm } from "@/components/auth/mfa-login-form";
import { setSessionToken } from "@/lib/session";
import { GrafoprintBrand } from "@/components/brand/grafoprint-brand";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import s from "./backoffice-login.module.css";

/** Acceso del staff de Grafo, independiente de las cuentas de las empresas. */
export function BackofficeLogin() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [visible, setVisible] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [challenge, setChallenge] = React.useState<MfaChallenge | null>(null);
  const pendiente = React.useRef(false);

  const ingresar = async (token: string) => {
    await setSessionToken(token);
    router.replace("/plataforma");
    router.refresh();
  };
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendiente.current) return;
    pendiente.current = true;
    setEnviando(true);
    setError(null);
    try {
      const r = await loginPlataforma(email.trim(), password);
      if ("requiereMfa" in r) {
        setChallenge(r);
        setPassword("");
        setEnviando(false);
        pendiente.current = false;
        return;
      }
      if (!r.accessToken) throw new Error("No se pudo iniciar sesión.");
      await ingresar(r.accessToken);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo iniciar sesión.",
      );
      setEnviando(false);
      pendiente.current = false;
    }
  };

  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <main className={s.page} data-appearance="light" data-ui="heroui">
        <section className={s.editorial} aria-label="Plataforma Grafo">
          <GrafoprintBrand />
          <div className={s.story}>
            <span className={s.eyebrow}>EL EQUIPO DETRÁS DE GRAFO</span>
            <h2>
              Una plataforma.
              <br />
              Cada detalle<span>.</span>
            </h2>
            <p>
              El espacio para acompañar a cada gráfica y cuidar todo lo que hace
              posible su trabajo.
            </p>
            <div className={s.index}>
              <span>
                <b>01</b> Empresas
              </span>
              <span>
                <b>02</b> Planes
              </span>
              <span>
                <b>03</b> Operación
              </span>
            </div>
          </div>
          <div className={s.signature}>
            <ShieldCheck />
            <span>Administración de plataforma</span>
          </div>
        </section>
        <section className={s.access} aria-label="Acceso del equipo">
          <header className={s.topbar}>
            <span>PLATAFORMA</span>
            <Link href="/login">
              Acceso de empresa <ArrowUpRight />
            </Link>
          </header>
          <div className={s.formWrap}>
            {challenge ? (
              <MfaLoginForm
                backoffice
                challenge={challenge}
                onSuccess={ingresar}
                onBack={() => {
                  setChallenge(null);
                  setError(null);
                }}
              />
            ) : (
              <form
                className={s.form}
                onSubmit={enviar}
                aria-labelledby="backoffice-title"
                aria-busy={enviando}
              >
                <div className={s.intro}>
                  <span className={s.eyebrow}>ACCESO INTERNO</span>
                  <h1 id="backoffice-title">
                    Acceso del equipo<span>.</span>
                  </h1>
                  <p>
                    Ingresá con tu cuenta de Grafo para administrar la
                    plataforma.
                  </p>
                </div>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="staff-email">
                      Correo electrónico
                    </FieldLabel>
                    <Input
                      id="staff-email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      placeholder="nombre@empresa.com"
                      autoComplete="username"
                      required
                      disabled={enviando}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="staff-password">Contraseña</FieldLabel>
                    <div className={s.password}>
                      <Input
                        id="staff-password"
                        name="password"
                        type={visible ? "text" : "password"}
                        value={password}
                        onChange={(ev) => setPassword(ev.target.value)}
                        placeholder="Ingresá tu contraseña"
                        autoComplete="current-password"
                        required
                        disabled={enviando}
                      />
                      <ActionButton
                        type="button"
                        variant="ghost"
                        isIconOnly
                        isDisabled={enviando}
                        aria-label={
                          visible ? "Ocultar contraseña" : "Mostrar contraseña"
                        }
                        aria-pressed={visible}
                        onPress={() => setVisible(!visible)}
                      >
                        {visible ? <EyeOff /> : <Eye />}
                      </ActionButton>
                    </div>
                  </Field>
                </FieldGroup>
                {error && (
                  <p className={s.error} role="alert">
                    {error}
                  </p>
                )}
                <ActionButton
                  type="submit"
                  size="md"
                  isPending={enviando}
                  isDisabled={!email || !password || enviando}
                >
                  {enviando ? "Ingresando…" : "Ingresar a Plataforma"}
                  <ArrowRight />
                </ActionButton>
                <p className={s.note}>
                  <ShieldCheck /> Acceso exclusivo para el equipo autorizado de
                  Grafo.
                </p>
              </form>
            )}
          </div>
          <footer className={s.footer}>
            Grafo · Administración de plataforma
          </footer>
        </section>
      </main>
    </DesignSystemProvider>
  );
}
