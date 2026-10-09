"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Mail } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { estadoCorreo, verificarMiCorreo } from "@/lib/recuperacion-api";
import s from "@/components/perfil-usuario-modal.module.css";
export function CorreoRecuperacion({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const [estado, setEstado] = useState<Awaited<
    ReturnType<typeof estadoCorreo>
  > | null>(null);
  const [password, setPassword] = useState("");
  const [abierto, setAbierto] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [mensaje, setMensaje] = useState("");
  const enviando = useRef(false);
  useEffect(() => {
    let vivo = true;
    const cargar = () => {
      void estadoCorreo()
        .then((r) => {
          if (vivo) {
            setEstado(r);
            setError("");
          }
        })
        .catch(() => {
          if (vivo)
            setError("No se pudo consultar la verificación del correo.");
        });
    };
    cargar();
    window.addEventListener("focus", cargar);
    return () => {
      vivo = false;
      window.removeEventListener("focus", cargar);
    };
  }, []);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando.current || disabled) return;
    enviando.current = true;
    setBusy(true);
    setError("");
    try {
      await verificarMiCorreo(password);
      setPassword("");
      setAbierto(false);
      setMensaje(
        "Revisá tu correo para confirmar el enlace. Puede tardar un momento en llegar.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo enviar el correo.",
      );
    } finally {
      enviando.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="flex flex-col gap-4"
      aria-label="Correo de recuperación"
    >
      <div className={s.securityRow}>
        <div>
          <h2>Correo de recuperación</h2>
          <p>{estado?.email ?? "Tu correo de acceso"}</p>
        </div>
        {estado?.verificado ? (
          <span className="flex items-center gap-2">
            <Check aria-hidden="true" /> Verificado
          </span>
        ) : (
          <ActionButton
            variant="outline"
            isDisabled={
              disabled || busy || !estado?.habilitado || estado?.pendienteMfa
            }
            onPress={() => {
              setAbierto(!abierto);
              setMensaje("");
            }}
          >
            <Mail />
            Verificar correo
          </ActionButton>
        )}
      </div>
      <p className={s.note}>
        {estado && !estado.habilitado
          ? "La recuperación por correo todavía no está habilitada."
          : estado?.verificado
          ? "Podés recuperar tu contraseña usando este correo. El segundo factor se mantiene."
          : estado?.pendienteMfa
            ? "Completá el segundo factor para verificar tu correo."
            : "Confirmá que el correo te pertenece para recuperar tu contraseña cuando lo necesites."}
      </p>
      {abierto && !estado?.verificado && (
        <form onSubmit={enviar} className="flex flex-col gap-3">
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="correo-clave-actual">
                Contraseña actual
              </FieldLabel>
              <Input
                id="correo-clave-actual"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={256}
                disabled={busy || disabled}
                aria-invalid={!!error}
              />
            </Field>
          </FieldGroup>
          <ActionButton
            type="submit"
            isPending={busy}
            isDisabled={busy || disabled}
          >
            Enviar verificación
          </ActionButton>
        </form>
      )}
      {mensaje && !estado?.verificado && <p role="status">{mensaje}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
