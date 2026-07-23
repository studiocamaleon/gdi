"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { salirDeImpersonacion, type CurrentUser } from "@/lib/auth";
import { clearSessionToken, setSessionToken } from "@/lib/session";

/**
 * La barra que le avisa al staff (y de rebote al cliente que mira la pantalla)
 * que está DENTRO de un tenant como soporte. Con countdown y salida.
 * Sólo se monta si la sesión es una impersonación. Ver docs/control-plane-diseno.md
 */
export function ImpersonacionBanner({
  currentUser,
}: {
  currentUser: CurrentUser;
}) {
  const router = useRouter();
  const imp = currentUser.impersonacion;
  const [restante, setRestante] = React.useState<number>(() =>
    imp ? Math.max(0, Math.round((new Date(imp.expiraEl).getTime() - Date.now()) / 1000)) : 0,
  );
  const [saliendo, setSaliendo] = React.useState(false);

  const salir = React.useCallback(async () => {
    if (saliendo) return;
    setSaliendo(true);
    try {
      const r = await salirDeImpersonacion();
      if (r.accessToken) {
        await setSessionToken(r.accessToken);
        toast.success("Saliste del tenant.");
        router.push("/plataforma");
      } else {
        await clearSessionToken();
        router.push("/login");
      }
      router.refresh();
    } catch {
      // Si falla (p. ej. ya expiró), el token igual no sirve: a login.
      await clearSessionToken();
      router.push("/login");
    }
  }, [router, saliendo]);

  React.useEffect(() => {
    if (!imp) return;
    const id = window.setInterval(() => {
      setRestante((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          void salir();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [imp, salir]);

  if (!imp) return null;

  const mm = String(Math.floor(restante / 60)).padStart(2, "0");
  const ss = String(restante % 60).padStart(2, "0");

  return (
    <div className="imp-banner">
      <span className="imp-live" />
      <span className="imp-txt">
        Estás dentro de <b>{currentUser.tenantActual.nombre}</b> como{" "}
        {imp.actorNombre} · el cliente lo ve
      </span>
      <span className="imp-time">
        expira en {mm}:{ss}
      </span>
      <span className="imp-grow" />
      <button
        type="button"
        className="imp-salir"
        onClick={() => void salir()}
        disabled={saliendo}
      >
        {saliendo ? "Saliendo…" : "Salir del tenant"}
      </button>
    </div>
  );
}
