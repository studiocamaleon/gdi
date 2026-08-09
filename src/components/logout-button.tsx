"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CirclePowerIcon } from "lucide-react";

import { logout } from "@/lib/auth";
import { clearSessionToken } from "@/lib/session";
import { Button } from "@/components/ui/button";

/**
 * Cerrar sesión, en el header. La identidad y sus acciones (cambiar empresa,
 * cambiar clave, perfil) se movieron al modal que abre el avatar del sidebar;
 * el logout queda acá, a un click, siempre visible.
 */
export function LogoutButton() {
  const router = useRouter();
  const [saliendo, startLogout] = React.useTransition();

  const handleLogout = () => {
    startLogout(async () => {
      try {
        await logout();
      } finally {
        await clearSessionToken();
        router.replace("/login");
        router.refresh();
      }
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={saliendo}
      className="gap-2"
    >
      <CirclePowerIcon className="size-4" />
      {saliendo ? "Cerrando sesión…" : "Cerrar sesión"}
    </Button>
  );
}
