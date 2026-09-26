"use client";

import { useEffect, useState } from "react";
import type { CurrentUser } from "@/lib/auth";
import {
  getDisponibilidadInbox,
  INBOX_CONEXION_ACTUALIZADA,
  type DisponibilidadInbox,
} from "@/lib/meta-inbox-api";

/** Oculto por defecto. Revalida al navegar, volver a la pestaña o comprobar
 * recepción en Configuración; nunca descarga conversaciones para el menú. */
export function useInboxDisponible(
  usuario: CurrentUser,
  incluidoEnPlan: boolean,
  pathname: string,
) {
  const empresaId = usuario.tenantActual?.id;
  const usuarioId = usuario.id;
  const autorizado = Boolean(
    empresaId &&
    incluidoEnPlan &&
    !usuario.impersonacion &&
    !usuario.debeCambiarPassword &&
    usuario.tenantActual?.rol === "administrador" &&
    usuario.tenantActual.permisos?.includes("configuracion.gestionar"),
  );
  const [estado, setEstado] = useState<DisponibilidadInbox | null>(null);

  useEffect(() => {
    let controller: AbortController | undefined;
    async function consultar() {
      controller?.abort();
      const actual = new AbortController();
      controller = actual;
      setEstado(null);
      if (!autorizado) return;
      try {
        const nuevo = await getDisponibilidadInbox(actual.signal);
        if (!actual.signal.aborted) setEstado(nuevo);
      } catch {
        if (!actual.signal.aborted) setEstado(null);
      }
    }
    const refrescar = () => {
      if (document.visibilityState === "visible") void consultar();
    };
    void consultar();
    if (!autorizado) return;
    window.addEventListener("focus", refrescar);
    document.addEventListener("visibilitychange", refrescar);
    window.addEventListener(INBOX_CONEXION_ACTUALIZADA, refrescar);
    return () => {
      controller?.abort();
      window.removeEventListener("focus", refrescar);
      document.removeEventListener("visibilitychange", refrescar);
      window.removeEventListener(INBOX_CONEXION_ACTUALIZADA, refrescar);
    };
  }, [autorizado, empresaId, usuarioId, pathname]);

  return (
    autorizado &&
    estado?.empresaId === empresaId &&
    estado?.usuarioId === usuarioId &&
    estado.disponible === true
  );
}
