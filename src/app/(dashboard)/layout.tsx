import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getSessionToken } from "@/lib/session";
import { AppSidebar } from "@/components/app-sidebar";
import { UserTenantMenu } from "@/components/user-tenant-menu";
import { Separator } from "@/components/ui/separator";
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

  let current;

  try {
    current = await getCurrentUser();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }

    if (error instanceof ApiError && error.status === 503) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-background px-6">
          <div className="max-w-xl space-y-3 text-center">
            <h1 className="text-xl font-semibold">No se pudo conectar con el backend</h1>
            <p className="text-sm text-muted-foreground">
              Revisa que el API este ejecutandose en la URL configurada y vuelve a intentar.
            </p>
          </div>
        </main>
      );
    }

    throw error;
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar currentUser={current.currentUser} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-5" />
          <div className="ml-auto">
            <UserTenantMenu currentUser={current.currentUser} />
          </div>
        </header>

        <main className="flex flex-1 bg-background">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
