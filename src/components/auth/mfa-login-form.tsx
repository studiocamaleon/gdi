"use client";

import { useRef, useState } from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { verificarMfa, type MfaChallenge } from "@/lib/auth";
import shared from "@/components/registro/registro-premium.module.css";
import s from "./login-premium.module.css";
import m from "./mfa-login-form.module.css";

export function MfaLoginForm({
  challenge,
  onSuccess,
  onBack,
  backoffice = false,
}: {
  challenge: MfaChallenge;
  backoffice?: boolean;
  onSuccess: (accessToken: string) => Promise<void>;
  onBack: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [recuperacion, setRecuperacion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const enviando = useRef(false);
  return (
    <form
      className={`${s.form} ${m.form} ${backoffice ? m.backoffice : ""}`}
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (enviando.current) return;
        enviando.current = true;
        setBusy(true);
        setError(null);
        try {
          const respuesta = await verificarMfa(
            challenge.challengeToken,
            codigo.trim(),
          );
          if (!respuesta.accessToken)
            throw new Error("No se pudo iniciar la sesión.");
          await onSuccess(respuesta.accessToken);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo verificar el código.",
          );
          enviando.current = false;
          setBusy(false);
        }
      }}
    >
      <div className={s.intro}>
        <span className={shared.formEyebrow}>PROTECCIÓN MFA</span>
        <h1>
          Confirmá que sos vos<span>.</span>
        </h1>
        <p>
          {recuperacion
            ? "Ingresá uno de los códigos de recuperación que guardaste al activar MFA."
            : "Ingresá el código de seis dígitos de tu app autenticadora."}
        </p>
      </div>
      <div className={shared.field}>
        <label htmlFor="mfa-login-codigo">
          {recuperacion ? "Código de recuperación" : "Código de verificación"}
        </label>
        <input
          className={shared.input}
          id="mfa-login-codigo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          inputMode={recuperacion ? "text" : "numeric"}
          autoComplete="one-time-code"
          autoFocus
          pattern={recuperacion ? undefined : "[0-9]{6}"}
          maxLength={recuperacion ? 32 : 6}
          required
          disabled={busy}
          aria-invalid={!!error}
          aria-describedby={error ? "mfa-login-error" : undefined}
        />
      </div>
      {error && (
        <p className={s.error} id="mfa-login-error" role="alert">
          {error}
        </p>
      )}
      <button
        className={`${shared.submit} ${s.submit}`}
        disabled={busy}
        type="submit"
      >
        <ShieldCheck size={18} />
        {busy ? "Verificando…" : "Verificar e ingresar"}
        <ArrowRight size={18} />
      </button>
      <div className={`${s.join} ${m.links}`}>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setRecuperacion(!recuperacion);
            setCodigo("");
            setError(null);
          }}
        >
          {recuperacion
            ? "Usar la app autenticadora"
            : "Usar un código de recuperación"}
        </button>
        <button type="button" disabled={busy} onClick={onBack}>
          Volver al inicio de sesión
        </button>
      </div>
    </form>
  );
}
