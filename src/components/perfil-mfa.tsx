"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, ShieldCheck, ShieldOff } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import {
  estadoMfa,
  iniciarMfa,
  confirmarMfa,
  gestionarMfa,
  cancelarMfa,
  type EstadoMfa,
  type AltaMfa,
} from "@/lib/perfil-api";
import s from "./perfil-usuario-modal.module.css";

type Paso =
  | "estado"
  | "activar"
  | "verificar"
  | "codigos"
  | "desactivar"
  | "recuperacion";
export function PerfilMfa({
  onBloqueoChange,
}: {
  onBloqueoChange: (busy: boolean) => void;
}) {
  const [estado, setEstado] = useState<EstadoMfa | null>(null);
  const [paso, setPaso] = useState<Paso>("estado");
  const [alta, setAlta] = useState<AltaMfa | null>(null);
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigos, setCodigos] = useState<string[]>([]);
  const [guardados, setGuardados] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enviando = useRef(false);
  const cargar = async () => {
    setError(null);
    try {
      setEstado(await estadoMfa());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar MFA.");
    }
  };
  useEffect(() => {
    void cargar();
  }, []);
  useEffect(() => {
    onBloqueoChange(busy || paso === "codigos");
    return () => onBloqueoChange(false);
  }, [busy, paso, onBloqueoChange]);
  const elegir = (p: Paso) => {
    setPassword("");
    setCodigo("");
    setError(null);
    setPaso(p);
  };
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setBusy(true);
    setError(null);
    try {
      if (paso === "activar") {
        setAlta(await iniciarMfa(password));
        setPassword("");
        setPaso("verificar");
      } else {
        const r =
          paso === "verificar" && alta
            ? await confirmarMfa(alta.setupId, codigo)
            : await gestionarMfa(
                paso === "desactivar" ? "desactivar" : "recuperacion",
                password,
                codigo.trim(),
              );
        setPassword("");
        setCodigo("");
        setAlta(null);
        if (r.codigosRecuperacion.length) {
          setCodigos(r.codigosRecuperacion);
          setGuardados(false);
          setPaso("codigos");
        } else {
          setPaso("estado");
        }
        await cargar();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo actualizar MFA.",
      );
    } finally {
      enviando.current = false;
      setBusy(false);
    }
  };
  const cancelar = async () => {
    setBusy(true);
    try {
      if (alta) await cancelarMfa();
      setAlta(null);
      elegir("estado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar.");
    } finally {
      setBusy(false);
    }
  };
  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      setError("No se pudo copiar. Seleccioná el texto y copialo manualmente.");
    }
  };
  return (
    <section className={s.mfa} aria-busy={busy}>
      <div className={s.securityRow}>
        <div>
          <h2>Protección MFA</h2>
          <p>Un segundo paso para iniciar sesión.</p>
        </div>
        {estado && (
          <span className={estado.activo ? s.activo : s.inactivo}>
            {estado.activo ? (
              <ShieldCheck size={14} />
            ) : (
              <ShieldOff size={14} />
            )}
            {estado.activo ? "Activada" : "Desactivada"}
          </span>
        )}
      </div>
      {!estado && !error && (
        <p role="status" className={s.note}>
          Consultando protección…
        </p>
      )}
      {paso === "estado" && estado && (
        <>
          <p className={s.note}>
            {estado.activo
              ? `Tu cuenta está protegida. Tenés ${estado.codigosRestantes} códigos de recuperación disponibles.`
              : "Usá Google Authenticator, Microsoft Authenticator, 1Password u otra app compatible."}
          </p>
          {estado.activo ? (
            <div className={s.actions}>
              <ActionButton
                variant="outline"
                onPress={() => elegir("recuperacion")}
              >
                Renovar códigos
              </ActionButton>
              <ActionButton
                variant="ghost"
                onPress={() => elegir("desactivar")}
              >
                Desactivar MFA
              </ActionButton>
            </div>
          ) : (
            <ActionButton
              variant="primary"
              isDisabled={!estado.disponible}
              onPress={() => elegir("activar")}
            >
              <ShieldCheck size={15} />
              Activar MFA
            </ActionButton>
          )}
          {!estado.disponible && (
            <p className={s.note}>
              La activación no está disponible en este entorno.
            </p>
          )}
        </>
      )}
      {["activar", "verificar", "desactivar", "recuperacion"].includes(
        paso,
      ) && (
        <form className={s.mfaForm} onSubmit={enviar}>
          {paso === "activar" && (
            <p className={s.note}>
              Confirmá tu contraseña para vincular una app autenticadora.
            </p>
          )}
          {paso === "desactivar" && (
            <p className={s.note}>
              Al desactivarla, tu cuenta volverá a usar sólo la contraseña.
              Confirmá tu contraseña y un código de la app o de recuperación.
            </p>
          )}
          {paso === "recuperacion" && (
            <p className={s.note}>
              Los códigos anteriores dejarán de funcionar. Confirmá tu
              contraseña y un código de la app o de recuperación.
            </p>
          )}
          {paso === "verificar" && alta && (
            <>
              <p className={s.note}>
                Escaneá el QR con tu app e ingresá el código para terminar la
                activación.
              </p>
              <div className={s.qr}>
                {/* eslint-disable-next-line @next/next/no-img-element -- QR generado localmente por el API; no va a terceros. */}
                <img
                  src={alta.qrDataUrl}
                  width={224}
                  height={224}
                  alt="QR para vincular la app autenticadora"
                />
              </div>
              <details className={s.manual}>
                <summary>Ingresar la clave manualmente</summary>
                <code>{alta.secret}</code>
                <ActionButton
                  variant="outline"
                  onPress={() => void copiar(alta.secret)}
                >
                  <Copy size={14} />
                  Copiar clave
                </ActionButton>
              </details>
            </>
          )}
          {paso !== "verificar" && (
            <div className={s.field}>
              <label htmlFor="perfil-mfa-password">Contraseña actual</label>
              <input
                id="perfil-mfa-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
                maxLength={256}
              />
            </div>
          )}
          {paso !== "activar" && (
            <div className={s.field}>
              <label htmlFor="perfil-mfa-codigo">
                {paso === "verificar"
                  ? "Código de seis dígitos"
                  : "Código de la app o de recuperación"}
              </label>
              <input
                id="perfil-mfa-codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                autoComplete="one-time-code"
                inputMode={paso === "verificar" ? "numeric" : "text"}
                pattern={paso === "verificar" ? "[0-9]{6}" : undefined}
                maxLength={paso === "verificar" ? 6 : 32}
                required
                disabled={busy}
              />
            </div>
          )}
          <p className={s.note}>
            Al confirmar se cerrarán tus otras sesiones. Esta sesión seguirá
            abierta.
          </p>
          <div className={s.actions}>
            <ActionButton
              variant="outline"
              isDisabled={busy}
              onPress={() => void cancelar()}
            >
              Cancelar
            </ActionButton>
            <ActionButton
              variant={paso === "desactivar" ? "danger" : "primary"}
              type="submit"
              isDisabled={busy}
            >
              {busy
                ? "Verificando…"
                : paso === "activar"
                  ? "Continuar"
                  : paso === "verificar"
                    ? "Confirmar y activar"
                    : paso === "desactivar"
                      ? "Desactivar MFA"
                      : "Generar nuevos códigos"}
            </ActionButton>
          </div>
        </form>
      )}
      {paso === "codigos" && (
        <div className={s.mfaForm}>
          <h3>Guardá tus códigos de recuperación</h3>
          <p className={s.note}>
            Cada código sirve una sola vez si perdés acceso a tu app. Se
            muestran sólo ahora; guardalos en un lugar privado.
          </p>
          <div className={s.codigos}>
            {codigos.map((c) => (
              <code key={c}>{c}</code>
            ))}
          </div>
          <div className={s.actions}>
            <ActionButton
              variant="outline"
              onPress={() => void copiar(codigos.join("\n"))}
            >
              <Copy size={14} />
              Copiar
            </ActionButton>
            <ActionButton
              variant="outline"
              onPress={() => {
                const url = URL.createObjectURL(
                  new Blob(
                    [
                      `Grafo · Códigos de recuperación MFA\nCada código sirve una sola vez.\n\n${codigos.join("\n")}`,
                    ],
                    { type: "text/plain" },
                  ),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "grafo-codigos-recuperacion.txt";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download size={14} />
              Descargar
            </ActionButton>
          </div>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={guardados}
              onChange={(e) => setGuardados(e.target.checked)}
            />
            Ya guardé mis códigos
          </label>
          <ActionButton
            variant="primary"
            isDisabled={!guardados}
            onPress={() => {
              setCodigos([]);
              setPaso("estado");
            }}
          >
            <Check size={15} />
            Listo
          </ActionButton>
        </div>
      )}
      {error && (
        <div role="alert" className={s.error}>
          {error}
          {!estado && (
            <ActionButton variant="outline" onPress={() => void cargar()}>
              Reintentar
            </ActionButton>
          )}
        </div>
      )}
    </section>
  );
}
