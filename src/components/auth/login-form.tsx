"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { login } from "@/lib/auth";
import { setSessionToken } from "@/lib/session";
import shared from "@/components/registro/registro-premium.module.css";
import s from "./login-premium.module.css";

/** /salir y el proxy explican por qué se vuelve al acceso sin pedirlo. */
const AVISO_SESION =
  "Tu sesión se cerró por inactividad. Volvé a entrar y seguís donde estabas.";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const motivo = searchParams.get("motivo") === "sesion" ? AVISO_SESION : null;
  const registroToken = searchParams.get("registro");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const submitting = React.useRef(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await login(email.trim(), password);
      if (response.accessToken) await setSessionToken(response.accessToken);
      router.replace(
        registroToken
          ? `/registro/verificar?token=${encodeURIComponent(registroToken)}`
          : "/",
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo iniciar sesión.",
      );
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className={s.form}
      onSubmit={handleSubmit}
      aria-labelledby="login-titulo"
      aria-busy={isSubmitting}
    >
      <div className={s.intro}>
        <span className={shared.formEyebrow}>TU ESPACIO DE TRABAJO</span>
        <h1 id="login-titulo">
          Iniciar sesión<span>.</span>
        </h1>
        <p>
          Qué bueno tenerte de vuelta.
          <br />
          Entrá y seguí donde lo dejaste.
        </p>
      </div>
      {!errorMessage && (motivo || registroToken) ? (
        <div className={s.notice} role="status">
          <Info size={17} aria-hidden="true" />
          <p>
            {motivo ??
              "Ingresá con tu cuenta actual para continuar con el registro de tu empresa."}
          </p>
        </div>
      ) : null}
      <FieldGroup className={s.fields}>
        <Field className={shared.field}>
          <label htmlFor="login-email">Correo de trabajo</label>
          <Input
            className={shared.input}
            id="login-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="vos@tuempresa.com"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? "login-error" : undefined}
            disabled={isSubmitting}
          />
        </Field>
        <Field className={shared.field}>
          <label htmlFor="login-password">Contraseña</label>
          <InputGroup className={shared.passwordControl}>
            <InputGroupInput
              id="login-password"
              name="password"
              type={isPasswordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              required
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "login-error" : undefined}
              disabled={isSubmitting}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-sm"
                type="button"
                onClick={() => setIsPasswordVisible((current) => !current)}
                aria-label={
                  isPasswordVisible
                    ? "Ocultar contraseña"
                    : "Mostrar contraseña"
                }
                aria-pressed={isPasswordVisible}
                disabled={isSubmitting}
              >
                {isPasswordVisible ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </FieldGroup>
      <details className={s.help}>
        <summary>
          ¿Olvidaste tu contraseña? <ChevronDown size={13} aria-hidden="true" />
        </summary>
        <p>
          Si todavía no tenés contraseña o necesitás restablecerla, pedísela a
          quien administra tu empresa en Grafo.
        </p>
      </details>
      {errorMessage ? (
        <p className={s.error} id="login-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <button
        type="submit"
        className={[shared.submit, s.submit].join(" ")}
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        <span aria-live="polite">
          {isSubmitting ? "Ingresando a tu espacio…" : "Iniciar sesión"}
        </span>
        {isSubmitting ? (
          <GdiSpinner />
        ) : (
          <ArrowRight size={18} aria-hidden="true" />
        )}
      </button>
      <div className={s.join}>
        <span>¿Tu empresa todavía no está en Grafo?</span>
        <Link href="/registro">
          Creá tu espacio <ArrowUpRight size={14} />
        </Link>
      </div>
      <a className={s.backoffice} href="/backoffice">
        Acceso del equipo de Grafo <ArrowUpRight size={12} />
      </a>
    </form>
  );
}
