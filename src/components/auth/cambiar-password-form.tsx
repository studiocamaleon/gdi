"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cambiarPassword } from "@/lib/auth";

/**
 * Cambiar la propia clave.
 *
 * Dos modos: el normal —desde el menú del usuario— y el OBLIGADO, cuando un
 * administrador restableció la clave. En el obligado no hay botón de cancelar
 * ni link a ningún lado: la clave provisoria la sabe otra persona, así que el
 * sistema no deja entrar a ninguna pantalla hasta que se cambie.
 *
 * Ver docs/usuarios-roles-permisos-diseno.md
 */
export function CambiarPasswordForm({ obligado }: { obligado: boolean }) {
  const router = useRouter();
  const [actual, setActual] = React.useState("");
  const [nueva, setNueva] = React.useState("");
  const [repetida, setRepetida] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nueva.length < 8) {
      toast.error("La clave nueva tiene que tener 8 o más caracteres.");
      return;
    }
    if (nueva !== repetida) {
      toast.error("Las dos claves nuevas no coinciden.");
      return;
    }
    setEnviando(true);
    try {
      await cambiarPassword({ actual, nueva });
      toast.success("Listo, ya tenés tu clave nueva.");
      // Refresca la sesión del servidor: sin esto, el layout sigue viendo el
      // flag y lo devuelve a esta misma pantalla.
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cambiar la clave.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="cp-caja">
      <h1>{obligado ? "Elegí tu clave" : "Cambiar mi clave"}</h1>
      <p>
        {obligado
          ? "La clave con la que entraste te la dio un administrador, así que la sabe otra persona. Elegí una tuya para seguir."
          : "Vas a necesitar la que usás hoy. Las sesiones abiertas en otros dispositivos se cierran."}
      </p>

      <form onSubmit={(e) => void enviar(e)} className="cp-form">
        <label className="usr-campo">
          <span>{obligado ? "Clave provisoria" : "Clave actual"}</span>
          <input
            type="password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>
        <label className="usr-campo">
          <span>Clave nueva</span>
          <input
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="usr-campo">
          <span>Repetila</span>
          <input
            type="password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <button className="btn primary" type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar mi clave"}
        </button>
      </form>
    </div>
  );
}
