import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api";
import { getCurrentUserCached } from "@/lib/auth-server";
import { getSessionToken } from "@/lib/session";
import { AppSidebar } from "@/components/app-sidebar";
import { ConfigRegionalProvider } from "@/components/navigation/config-regional-provider";
import { NavigationFeedbackProvider } from "@/components/navigation/navigation-feedback";
import { PermisosProvider } from "@/components/navigation/permisos-provider";
import { PasosEnCursoWidget } from "@/components/produccion/pasos-en-curso-widget";
import { EntregaEscaneoWatcher } from "@/components/mostrador/entrega-escaneo-watcher";
import { ImpersonacionBanner } from "@/components/plataforma/impersonacion-banner";
import { SuscripcionGlobalBanner } from "@/components/suscripcion/suscripcion-global-banner";
import { NotificacionesProvider } from "@/components/notificaciones/notificaciones-provider";
import { DocumentosImpresionProvider } from "@/components/impresion/documentos-impresion-provider";
import { SidebarInset } from "@/components/ui/sidebar";
import {
  DashboardFrame,
  DashboardTopbar,
} from "@/components/navigation/dashboard-frame";

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
      // A /salir y no a /login: el token puede seguir vigente por reloj —el
      // proxy lo daría por bueno y rebotaría de vuelta acá— mientras la
      // sesión detrás está revocada. /salir borra la cookie y corta el bucle.
      redirect("/salir?motivo=sesion");
    }

    throw error;
  }

  // Clave provisoria puesta por un administrador: la sabe otra persona, así que
  // no se entra a ningún lado hasta cambiarla. El redirect vive acá y no en el
  // proxy porque el proxy sólo ve la cookie, no la sesión resuelta —
  // y /cambiar-clave está FUERA de este grupo justamente para que mandarlo ahí
  // no rebote contra este mismo layout.
  if (currentUser.debeCambiarPassword) {
    redirect("/cambiar-clave");
  }

  return (
    <PermisosProvider permisos={currentUser.tenantActual?.permisos}>
      <ConfigRegionalProvider regional={currentUser.tenantActual?.regional}>
        <NavigationFeedbackProvider>
          <NotificacionesProvider>
            <DocumentosImpresionProvider
              key={currentUser.tenantActual?.id}
              tenantId={currentUser.tenantActual?.id ?? ""}
            >
              <ImpersonacionBanner currentUser={currentUser} />
              <DashboardFrame>
                <AppSidebar currentUser={currentUser} />
                <SidebarInset className="main" style={{ minHeight: 0 }}>
                  <DashboardTopbar />

                  <SuscripcionGlobalBanner currentUser={currentUser} />

                  <main
                    className="gp-main flex flex-1"
                    style={{ minHeight: 0, overflowY: "auto" }}
                  >
                    {children}
                  </main>
                </SidebarInset>
                <PasosEnCursoWidget />
                {/* Escanear el QR del cliente abre la entrega desde cualquier
              pantalla. */}
                <EntregaEscaneoWatcher />
              </DashboardFrame>
            </DocumentosImpresionProvider>
          </NotificacionesProvider>
        </NavigationFeedbackProvider>
      </ConfigRegionalProvider>
    </PermisosProvider>
  );
}
