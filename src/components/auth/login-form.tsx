"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EyeIcon, EyeOffIcon, LogInIcon } from "lucide-react";

import { login } from "@/lib/auth";
import { setSessionToken } from "@/lib/session";

const wait = (milliseconds: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

/**
 * Por qué la persona terminó acá sin pedirlo.
 *
 * `/salir` y el proxy mandan al login cuando la sesión ya no sirve. Sin
 * este cartel, aparecer de golpe en la pantalla de login se lee como que el
 * sistema se cayó — que es exactamente lo que pasó la primera vez.
 */
const MOTIVOS: Record<string, string> = {
  sesion:
    "Tu sesión se cerró por inactividad. Volvé a entrar y seguís donde estabas.",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const motivo = MOTIVOS[searchParams.get("motivo") ?? ""] ?? null;
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    return () => {
      document.querySelector(".gp-login")?.classList.remove("ingressing");
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await login(email.trim(), password);

      if (response.accessToken) {
        await setSessionToken(response.accessToken);
      }

      await wait(220);
      document.querySelector(".gp-login")?.classList.add("ingressing");
      await wait(2730);
      router.replace("/");
      router.refresh();
    } catch (error) {
      document.querySelector(".gp-login")?.classList.remove("ingressing");
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo iniciar sesion.",
      );
      setIsSubmitting(false);
    }
  };

  return (
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="eyebrow">Acceso privado</div>
        <h1>Iniciar sesión</h1>
        <p className="lead">
          Accedé con tu correo corporativo y la clave asociada a tu usuario. El sistema te redirige a tu entorno activo al validar la sesión.
        </p>
        <hr />

        {/* Se esconde apenas hay un error de credenciales: dos carteles
            juntos compiten y el que importa es el del intento actual. */}
        {motivo && !errorMessage ? (
          <p className="login-aviso" role="status">
            {motivo}
          </p>
        ) : null}

        <div className="field">
          <label htmlFor="login-email">Correo</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="usuario@empresa.com"
            autoComplete="email"
            aria-invalid={Boolean(errorMessage)}
            disabled={isSubmitting}
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">
            Clave
            <span className="link">¿Olvidaste tu clave?</span>
          </label>
          <div className="input-wrap">
            <input
              id="login-password"
              type={isPasswordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ingresa tu clave"
              autoComplete="current-password"
              aria-invalid={Boolean(errorMessage)}
              disabled={isSubmitting}
            />
            <button
              type="button"
              className="eye"
              onClick={() => setIsPasswordVisible((current) => !current)}
              aria-label={isPasswordVisible ? "Ocultar clave" : "Mostrar clave"}
              disabled={isSubmitting}
            >
              {isPasswordVisible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
            </button>
          </div>
          {/* Nadie recibe una invitación por correo: el acceso se entrega con
              una clave que dicta quien administra. Ver usuarios.service.crear */}
          <span className="help">Si todavía no tenés clave, pedísela a quien administra el sistema.</span>
        </div>

        {errorMessage ? <p className="login-error">{errorMessage}</p> : null}

        <button
          type="submit"
          className={isSubmitting ? "submit loading" : "submit"}
          disabled={isSubmitting}
        >
          <span className="spin" aria-hidden="true" />
          <LogInIcon className="ingress-arrow" size={16} />
          <span className="btn-label">{isSubmitting ? "Ingresando" : "Ingresar"}</span>
        </button>

        <div className="footnote">
          <div className="sep" />
          Acceso administrado por invitación y asignación de empresa.
          <br />
          <a className="link" href="/backoffice">
            ¿Sos del equipo de Grafo? Acceso del backoffice
          </a>
        </div>
      </form>
  );
}
