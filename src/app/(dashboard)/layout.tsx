import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api";
import { getCurrentUserCached } from "@/lib/auth-server";
import { getSessionToken } from "@/lib/session";
import { AppSidebar } from "@/components/app-sidebar";
import { NavigationFeedbackProvider } from "@/components/navigation/navigation-feedback";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { PasosEnCursoWidget } from "@/components/produccion/pasos-en-curso-widget";
import { UserTenantMenu } from "@/components/user-tenant-menu";
import { ImpersonacionBanner } from "@/components/plataforma/impersonacion-banner";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    redirect("/login");
  }

  let currentUser;

  try {
    const current = await getCurrentUserCached();
    currentUser = current.currentUser;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }

    throw error;
  }

  // Clave provisoria puesta por un administrador: la sabe otra persona, así que
  // no se entra a ningún lado hasta cambiarla. El redirect vive acá y no en el
  // middleware porque el middleware sólo ve la cookie, no la sesión resuelta —
  // y /cambiar-clave está FUERA de este grupo justamente para que mandarlo ahí
  // no rebote contra este mismo layout.
  if (currentUser.debeCambiarPassword) {
    redirect("/cambiar-clave");
  }

  return (
    <PermisosProvider permisos={currentUser.tenantActual?.permisos}>
      <NavigationFeedbackProvider>
        <ImpersonacionBanner currentUser={currentUser} />
        <SidebarProvider
          defaultOpen
          style={{ height: "100dvh", overflow: "hidden" }}
        >
          <AppSidebar currentUser={currentUser} />
          <SidebarInset className="main" style={{ minHeight: 0 }}>
            <header className="topbar">
              <SidebarTrigger className="icon-btn" />
              <div className="ml-auto">
                <UserTenantMenu currentUser={currentUser} />
              </div>
            </header>

            <main
              className="gp-main flex flex-1"
              style={{ minHeight: 0, overflowY: "auto" }}
            >
              {children}
            </main>
          </SidebarInset>
          <PasosEnCursoWidget />
        </SidebarProvider>
      </NavigationFeedbackProvider>
    </PermisosProvider>
  );
}
