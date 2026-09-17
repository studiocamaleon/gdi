"use client";

import type { CSSProperties, ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { LogoutButton } from "@/components/logout-button";
import { NotificacionesBell } from "@/components/notificaciones/notificaciones-bell";
import { TipoCambioIndicator } from "./tipo-cambio-indicator";
import { cn } from "@/lib/utils";
import s from "./dashboard-frame.module.css";

/** El marco compartido mantiene la misma navegación en todas las vistas. */
export function DashboardFrame({ children }: { children: ReactNode }) {
  return (
    <DesignSystemProvider>
      <SidebarProvider
        defaultOpen
        style={
          {
            height: "100dvh",
            overflow: "hidden",
            "--sidebar-width": "262px",
            "--sidebar-width-icon": "66px",
          } as CSSProperties
        }
      >
        {children}
      </SidebarProvider>
    </DesignSystemProvider>
  );
}

/** Barra aprobada de Tablero de producción; no depende de ruta ni de rol. */
export function DashboardTopbar() {
  return (
    <header className={cn("topbar", s.topbar)} data-appearance="light">
      <SidebarTrigger className={cn("icon-btn", s.trigger)} />
      <TipoCambioIndicator />
      <div className="ml-auto flex items-center gap-2">
        <NotificacionesBell triggerClassName={s.trigger} />
        <LogoutButton className={s.logout} />
      </div>
    </header>
  );
}
