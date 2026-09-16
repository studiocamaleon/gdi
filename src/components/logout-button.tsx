"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

import { logout } from "@/lib/auth";
import { clearSessionToken } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Cerrar sesión, en el header. La identidad y sus acciones (cambiar empresa,
 * cambiar clave, perfil) se movieron al modal que abre el avatar del sidebar;
 * el logout queda acá, a un click, siempre visible.
 */
export function LogoutButton({ className }: { className?: string } = {}) {
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
      variant="outline"
      onClick={handleLogout}
      loading={saliendo}
      loadingText="Cerrando sesión…"
      className={cn("gap-2", className)}
    >
      Cerrar sesión
      <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
    </Button>
  );
}
