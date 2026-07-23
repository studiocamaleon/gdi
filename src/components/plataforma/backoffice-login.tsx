"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { loginPlataforma } from "@/lib/auth";
import { setSessionToken } from "@/lib/session";
import { BIco } from "@/components/plataforma/kit";

/**
 * El login del backoffice (opción A): entra el staff de Grafo sin necesitar
 * una empresa. Chrome oscuro propio, como el resto del control plane — es OTRA
 * superficie, no el login de tenant. Ver docs/control-plane-diseno.md
 */
export function BackofficeLogin() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await loginPlataforma(email.trim(), password);
      if (r.accessToken) await setSessionToken(r.accessToken);
      router.replace("/plataforma");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo iniciar sesión.",
      );
      setEnviando(false);
    }
  };

  return (
    <div className="bo-login-page">
      <form className="bo-login" onSubmit={enviar}>
        <div className="bo-login-brand">
          <span className="cpl-rail-mark">
            <BIco.node />
          </span>
          <div>
            <div className="nm">Grafo</div>
            <div className="sub">Control Plane</div>
          </div>
        </div>
        <h1>Acceso del equipo</h1>
        <p className="lead">
          Entrá con tu cuenta de Grafo. Este acceso es para el staff de la
          plataforma — para operar tu imprenta, usá el acceso de tu empresa.
        </p>

        <label className="bo-field">
          <span>Correo</span>
          <input
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="vos@grupoidea.com"
            autoComplete="email"
            disabled={enviando}
          />
        </label>
        <label className="bo-field">
          <span>Clave</span>
          <input
            type="password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            placeholder="Ingresá tu clave"
            autoComplete="current-password"
            disabled={enviando}
          />
        </label>

        {error ? <div className="bo-login-error">{error}</div> : null}

        <button
          type="submit"
          className="cpl-btn pri"
          style={{ justifyContent: "center", width: "100%" }}
          disabled={enviando || !email || !password}
        >
          {enviando ? "Ingresando…" : "Ingresar al control plane"}
        </button>

        <Link className="bo-login-alt" href="/login">
          ← Acceso de empresa (imprenta)
        </Link>
      </form>
    </div>
  );
}
